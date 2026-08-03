from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.audit import record_audit_log
from app.db import get_db
from app.models import ContextPackage, User, Workspace, WorkspaceInvite, WorkspaceMembership, utc_now
from app.permissions import ADMIN_ROLES, get_workspace_membership, require_workspace_role
from app.schemas import (
    WorkspaceCreate,
    WorkspaceInviteCreate,
    WorkspaceInviteRead,
    WorkspaceMembershipRead,
    WorkspaceRead,
)

router = APIRouter(prefix="/api/workspaces")


@router.get("", response_model=list[WorkspaceRead])
def list_workspaces(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[WorkspaceRead]:
    memberships = list(
        db.scalars(
            select(WorkspaceMembership)
            .where(WorkspaceMembership.user_id == current_user.id)
            .order_by(WorkspaceMembership.created_at.asc())
        )
    )
    if not memberships:
        return []

    workspace_ids = [membership.workspace_id for membership in memberships]
    workspaces = {
        workspace.id: workspace
        for workspace in db.scalars(select(Workspace).where(Workspace.id.in_(workspace_ids)))
    }
    member_counts = {
        workspace_id: count
        for workspace_id, count in db.execute(
            select(WorkspaceMembership.workspace_id, func.count(WorkspaceMembership.id))
            .where(WorkspaceMembership.workspace_id.in_(workspace_ids))
            .group_by(WorkspaceMembership.workspace_id)
        )
    }
    package_counts = {
        workspace_id: count
        for workspace_id, count in db.execute(
            select(ContextPackage.workspace_id, func.count(ContextPackage.id))
            .where(ContextPackage.workspace_id.in_(workspace_ids))
            .where(ContextPackage.status != "deleted")
            .group_by(ContextPackage.workspace_id)
        )
    }

    results: list[WorkspaceRead] = []
    for membership in memberships:
        workspace = workspaces.get(membership.workspace_id)
        if not workspace:
            continue
        results.append(
            WorkspaceRead(
                id=workspace.id,
                name=workspace.name,
                slug=workspace.slug,
                role=membership.role,
                member_count=member_counts.get(workspace.id, 1),
                package_count=package_counts.get(workspace.id, 0),
                created_at=workspace.created_at,
                updated_at=workspace.updated_at,
            )
        )

    return results


@router.post("", response_model=WorkspaceRead, status_code=status.HTTP_201_CREATED)
def create_workspace(
    payload: WorkspaceCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WorkspaceRead:
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Workspace name is required.")

    slug = build_workspace_slug(db, name)
    workspace = Workspace(name=name, slug=slug, created_by=current_user.id)
    db.add(workspace)
    db.flush()
    membership = WorkspaceMembership(workspace_id=workspace.id, user_id=current_user.id, role="owner")
    db.add(membership)
    record_audit_log(
        db,
        action="workspace.create",
        entity_type="workspace",
        entity_id=workspace.id,
        actor=current_user,
        details={"name": workspace.name},
    )
    db.commit()
    db.refresh(workspace)
    db.refresh(membership)
    return WorkspaceRead(
        id=workspace.id,
        name=workspace.name,
        slug=workspace.slug,
        role=membership.role,
        member_count=1,
        package_count=0,
        created_at=workspace.created_at,
        updated_at=workspace.updated_at,
    )


@router.get("/{workspace_id}/members", response_model=list[WorkspaceMembershipRead])
def list_workspace_members(
    workspace_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[WorkspaceMembershipRead]:
    require_workspace_role(db, workspace_id, current_user, {"owner", "admin", "member", "viewer"})
    memberships = list(
        db.scalars(
            select(WorkspaceMembership)
            .where(WorkspaceMembership.workspace_id == workspace_id)
            .order_by(WorkspaceMembership.created_at.asc())
        )
    )
    users = {
        user.id: user
        for user in db.scalars(select(User).where(User.id.in_([membership.user_id for membership in memberships])))
    }
    return [
        WorkspaceMembershipRead(
            id=membership.id,
            workspace_id=membership.workspace_id,
            user_id=membership.user_id,
            role=membership.role,
            email=users[membership.user_id].email,
            name=users[membership.user_id].name,
            created_at=membership.created_at,
        )
        for membership in memberships
        if membership.user_id in users
    ]


@router.get("/{workspace_id}/invites", response_model=list[WorkspaceInviteRead])
def list_workspace_invites(
    workspace_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[WorkspaceInvite]:
    require_workspace_role(db, workspace_id, current_user, ADMIN_ROLES)
    return list(
        db.scalars(
            select(WorkspaceInvite)
            .where(WorkspaceInvite.workspace_id == workspace_id)
            .order_by(WorkspaceInvite.created_at.desc())
        )
    )


@router.post("/{workspace_id}/invites", response_model=WorkspaceInviteRead, status_code=status.HTTP_201_CREATED)
def invite_workspace_member(
    workspace_id: str,
    payload: WorkspaceInviteCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WorkspaceInvite:
    workspace, _ = require_workspace_role(db, workspace_id, current_user, ADMIN_ROLES)
    email = payload.email.strip().lower()
    if not email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invite email is required.")

    existing_invite = db.scalar(
        select(WorkspaceInvite)
        .where(WorkspaceInvite.workspace_id == workspace_id)
        .where(WorkspaceInvite.email == email)
    )
    if existing_invite:
        return existing_invite

    user = db.scalar(select(User).where(User.email == email))
    if user:
        membership = get_workspace_membership(db, workspace_id, user.id)
        if membership:
            if membership.role != payload.role:
                membership.role = payload.role
                db.add(membership)
                db.commit()
                db.refresh(membership)
            invite = WorkspaceInvite(
                workspace_id=workspace_id,
                email=email,
                role=payload.role,
                invited_by=current_user.id,
                accepted_at=utc_now(),
            )
            db.add(invite)
            db.flush()
            record_audit_log(
                db,
                action="workspace.member_update",
                entity_type="workspace",
                entity_id=workspace.id,
                actor=current_user,
                details={"email": email, "role": payload.role},
            )
            db.commit()
            db.refresh(invite)
            return invite

        membership = WorkspaceMembership(workspace_id=workspace_id, user_id=user.id, role=payload.role)
        db.add(membership)

    invite = WorkspaceInvite(
        workspace_id=workspace_id,
        email=email,
        role=payload.role,
        invited_by=current_user.id,
    )
    if user:
        invite.accepted_at = utc_now()
    db.add(invite)
    db.flush()
    record_audit_log(
        db,
        action="workspace.invite",
        entity_type="workspace",
        entity_id=workspace.id,
        actor=current_user,
        details={"email": email, "role": payload.role},
    )
    db.commit()
    db.refresh(invite)
    return invite


def build_workspace_slug(db: Session, name: str) -> str:
    base = "-".join(filter(None, "".join(char.lower() if char.isalnum() else " " for char in name).split()))
    slug = base or "workspace"
    candidate = slug
    suffix = 2
    while db.scalar(select(Workspace).where(Workspace.slug == candidate)):
        candidate = f"{slug}-{suffix}"
        suffix += 1
    return candidate
