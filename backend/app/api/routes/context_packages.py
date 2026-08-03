from collections.abc import Iterable
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.audit import record_audit_log
from app.db import get_db
from app.models import ContextPackage, ContextPackageVersion, User, WorkspaceMembership
from app.permissions import EDIT_ROLES, ensure_package_editable, ensure_package_visible, require_workspace_role
from app.schemas import (
    ContextPackageCreate,
    ContextPackageImportRequest,
    ContextPackageRead,
    ContextPackageUpdate,
    ContextPackageVersionRead,
)

router = APIRouter()

SNAPSHOT_FIELDS = (
    "workspace_id",
    "title",
    "source_platform",
    "source_url",
    "visibility",
    "status",
    "summary",
    "key_decisions",
    "constraints",
    "open_questions",
    "tags",
    "sensitive_findings",
    "messages",
    "depth",
    "notes",
    "extraction_confidence",
    "review_warnings",
)


@router.post("", response_model=ContextPackageRead, status_code=status.HTTP_201_CREATED)
def create_context_package(
    payload: ContextPackageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ContextPackageRead:
    values = payload.model_dump()
    package_id = values.pop("id", None)
    values.pop("created_by", None)

    if values.get("workspace_id"):
        require_workspace_role(db, values["workspace_id"], current_user, EDIT_ROLES)

    context_package = ContextPackage(
        **values,
        **({"id": package_id} if package_id else {}),
        created_by=current_user.id,
        current_version=1,
    )
    db.add(context_package)
    db.flush()
    save_package_version(db, context_package, current_user)
    record_audit_log(
        db,
        action="context_package.create",
        entity_type="context_package",
        entity_id=context_package.id,
        actor=current_user,
        details={"title": context_package.title, "workspace_id": context_package.workspace_id},
    )
    db.commit()
    db.refresh(context_package)
    return to_context_package_read(db, context_package)


@router.get("", response_model=list[ContextPackageRead])
def list_context_packages(
    workspace_id: str | None = Query(default=None),
    q: str | None = Query(default=None),
    platform: str | None = Query(default=None),
    tag: str | None = Query(default=None),
    recent_days: int | None = Query(default=None, ge=1, le=3650),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ContextPackageRead]:
    visible_packages = filter_visible_packages(
        db,
        current_user,
        workspace_id=workspace_id,
        packages=db.scalars(
            select(ContextPackage)
            .where(ContextPackage.status != "deleted")
            .order_by(ContextPackage.updated_at.desc())
        ),
    )
    filtered_packages = rank_packages(
        visible_packages,
        query=q,
        platform=platform,
        tag=tag,
        recent_days=recent_days,
    )
    return [to_context_package_read(db, context_package) for context_package in filtered_packages]


@router.get("/{context_package_id}", response_model=ContextPackageRead)
def get_context_package(
    context_package_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ContextPackageRead:
    context_package = db.get(ContextPackage, context_package_id)
    if not context_package:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Context package not found.")
    ensure_package_visible(db, context_package, current_user)
    return to_context_package_read(db, context_package)


@router.patch("/{context_package_id}", response_model=ContextPackageRead)
def update_context_package(
    context_package_id: str,
    payload: ContextPackageUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ContextPackageRead:
    context_package = db.get(ContextPackage, context_package_id)
    if not context_package:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Context package not found.")
    ensure_package_editable(db, context_package, current_user)

    updates = payload.model_dump(exclude_unset=True)
    next_workspace_id = updates.get("workspace_id", context_package.workspace_id)
    if next_workspace_id and next_workspace_id != context_package.workspace_id:
        require_workspace_role(db, next_workspace_id, current_user, EDIT_ROLES)

    for field, value in updates.items():
        setattr(context_package, field, value)

    context_package.current_version += 1
    db.add(context_package)
    db.flush()
    save_package_version(db, context_package, current_user)
    record_audit_log(
        db,
        action="context_package.update",
        entity_type="context_package",
        entity_id=context_package.id,
        actor=current_user,
        details={"version": context_package.current_version},
    )
    db.commit()
    db.refresh(context_package)
    return to_context_package_read(db, context_package)


@router.delete("/{context_package_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_context_package(
    context_package_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    context_package = db.get(ContextPackage, context_package_id)
    if not context_package:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Context package not found.")
    ensure_package_editable(db, context_package, current_user)

    context_package.status = "deleted"
    context_package.current_version += 1
    db.add(context_package)
    db.flush()
    save_package_version(db, context_package, current_user)
    record_audit_log(
        db,
        action="context_package.delete",
        entity_type="context_package",
        entity_id=context_package.id,
        actor=current_user,
    )
    db.commit()


@router.post("/import", response_model=list[ContextPackageRead])
def import_context_packages(
    payload: ContextPackageImportRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ContextPackageRead]:
    synced: list[ContextPackage] = []

    for item in payload.packages:
        values = item.model_dump()
        package_id = values.pop("id", None)
        values.pop("created_by", None)
        if values.get("workspace_id"):
            require_workspace_role(db, values["workspace_id"], current_user, EDIT_ROLES)

        existing = db.get(ContextPackage, package_id) if package_id else None

        if existing:
            ensure_package_editable(db, existing, current_user)
            for field, value in values.items():
                setattr(existing, field, value)
            existing.created_by = current_user.id
            existing.current_version += 1
            db.add(existing)
            db.flush()
            save_package_version(db, existing, current_user)
            record_audit_log(
                db,
                action="context_package.import_update",
                entity_type="context_package",
                entity_id=existing.id,
                actor=current_user,
                details={"version": existing.current_version},
            )
            synced.append(existing)
            continue

        context_package = ContextPackage(
            **values,
            **({"id": package_id} if package_id else {}),
            created_by=current_user.id,
            current_version=1,
        )
        db.add(context_package)
        db.flush()
        save_package_version(db, context_package, current_user)
        record_audit_log(
            db,
            action="context_package.import_create",
            entity_type="context_package",
            entity_id=context_package.id,
            actor=current_user,
        )
        synced.append(context_package)

    db.commit()

    for item in synced:
        db.refresh(item)

    return [to_context_package_read(db, item) for item in synced]


@router.get("/{context_package_id}/versions", response_model=list[ContextPackageVersionRead])
def list_context_package_versions(
    context_package_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ContextPackageVersionRead]:
    context_package = db.get(ContextPackage, context_package_id)
    if not context_package:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Context package not found.")
    ensure_package_visible(db, context_package, current_user)

    versions = list(
        db.scalars(
            select(ContextPackageVersion)
            .where(ContextPackageVersion.context_package_id == context_package_id)
            .order_by(ContextPackageVersion.version_number.desc(), ContextPackageVersion.created_at.desc())
        )
    )
    return [to_version_read(version) for version in versions]


@router.post("/{context_package_id}/versions/{version_id}/restore", response_model=ContextPackageRead)
def restore_context_package_version(
    context_package_id: str,
    version_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ContextPackageRead:
    context_package = db.get(ContextPackage, context_package_id)
    if not context_package:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Context package not found.")
    ensure_package_editable(db, context_package, current_user)

    version = db.get(ContextPackageVersion, version_id)
    if not version or version.context_package_id != context_package_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Version not found.")

    for field, value in version.snapshot.items():
        if field in SNAPSHOT_FIELDS:
            setattr(context_package, field, value)

    context_package.status = "active"
    context_package.current_version += 1
    db.add(context_package)
    db.flush()
    save_package_version(db, context_package, current_user)
    record_audit_log(
        db,
        action="context_package.restore",
        entity_type="context_package",
        entity_id=context_package.id,
        actor=current_user,
        details={"restored_from": version.version_number, "version": context_package.current_version},
    )
    db.commit()
    db.refresh(context_package)
    return to_context_package_read(db, context_package)


def filter_visible_packages(
    db: Session,
    user: User,
    *,
    workspace_id: str | None,
    packages: Iterable[ContextPackage],
) -> list[ContextPackage]:
    memberships = {
        membership.workspace_id: membership.role
        for membership in db.scalars(select(WorkspaceMembership).where(WorkspaceMembership.user_id == user.id))
    }
    filtered: list[ContextPackage] = []

    for context_package in packages:
        if workspace_id and context_package.workspace_id != workspace_id:
            continue

        if not context_package.workspace_id:
            if context_package.created_by == user.id:
                filtered.append(context_package)
            continue

        role = memberships.get(context_package.workspace_id)
        if not role:
            continue
        if context_package.visibility == "private" and context_package.created_by != user.id and role not in {"owner", "admin"}:
            continue
        filtered.append(context_package)

    return filtered


def save_package_version(db: Session, context_package: ContextPackage, actor: User) -> ContextPackageVersion:
    version = ContextPackageVersion(
        context_package_id=context_package.id,
        version_number=context_package.current_version,
        created_by=actor.id,
        snapshot=build_package_snapshot(context_package),
    )
    db.add(version)
    return version


def build_package_snapshot(context_package: ContextPackage) -> dict:
    return {field: getattr(context_package, field) for field in SNAPSHOT_FIELDS}


def to_context_package_read(db: Session, context_package: ContextPackage) -> ContextPackageRead:
    version_count = db.scalar(
        select(func.count(ContextPackageVersion.id)).where(ContextPackageVersion.context_package_id == context_package.id)
    ) or context_package.current_version
    return ContextPackageRead.model_validate(
        {
            **build_package_snapshot(context_package),
            "id": context_package.id,
            "created_by": context_package.created_by,
            "created_at": context_package.created_at,
            "updated_at": context_package.updated_at,
            "current_version": context_package.current_version,
            "version_count": int(version_count),
        }
    )


def to_version_read(version: ContextPackageVersion) -> ContextPackageVersionRead:
    return ContextPackageVersionRead(
        id=version.id,
        context_package_id=version.context_package_id,
        version_number=version.version_number,
        created_by=version.created_by,
        title=str(version.snapshot.get("title", "")),
        summary=str(version.snapshot.get("summary", "")),
        visibility=str(version.snapshot.get("visibility", "private")),
        created_at=version.created_at,
    )


def rank_packages(
    packages: list[ContextPackage],
    *,
    query: str | None,
    platform: str | None,
    tag: str | None,
    recent_days: int | None,
) -> list[ContextPackage]:
    normalized_query = (query or "").strip().lower()
    normalized_platform = (platform or "").strip().lower()
    normalized_tag = (tag or "").strip().lower()
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=recent_days) if recent_days else None

    scored: list[tuple[int, ContextPackage]] = []
    query_terms = extract_terms(normalized_query)

    for context_package in packages:
        if normalized_platform and context_package.source_platform.lower() != normalized_platform:
            continue
        if normalized_tag and normalized_tag not in {item.lower() for item in context_package.tags}:
            continue
        updated_at = ensure_utc(context_package.updated_at)
        if cutoff and updated_at < cutoff:
            continue

        score = 0
        searchable = " ".join(
            [
                context_package.title,
                context_package.summary,
                " ".join(context_package.tags),
                " ".join(context_package.key_decisions),
                " ".join(context_package.constraints),
                " ".join(context_package.open_questions),
                " ".join(
                    str(message.get("content", ""))
                    for message in context_package.messages[:12]
                    if isinstance(message, dict)
                ),
            ]
        ).lower()

        if normalized_query:
            if normalized_query in context_package.title.lower():
                score += 12
            if normalized_query in context_package.summary.lower():
                score += 8
            score += sum(2 for term in query_terms if term and term in searchable)
            if score == 0:
                continue

        recency_bonus = max(0, 5 - int((now - updated_at).days / 30))
        score += recency_bonus
        score += min(len(context_package.tags), 4)
        scored.append((score, context_package))

    scored.sort(key=lambda item: (item[0], item[1].updated_at), reverse=True)
    return [item[1] for item in scored]


def extract_terms(text: str) -> set[str]:
    return {
        token.strip()
        for token in text.replace("-", " ").split()
        if len(token.strip()) > 2
    }


def ensure_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)
