from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import ContextPackage, User, Workspace, WorkspaceMembership

EDIT_ROLES = {"owner", "admin", "member"}
ADMIN_ROLES = {"owner", "admin"}


def get_workspace_membership(db: Session, workspace_id: str, user_id: str) -> WorkspaceMembership | None:
    return db.scalar(
        select(WorkspaceMembership)
        .where(WorkspaceMembership.workspace_id == workspace_id)
        .where(WorkspaceMembership.user_id == user_id)
    )


def require_workspace_membership(db: Session, workspace_id: str, user: User) -> tuple[Workspace, WorkspaceMembership]:
    workspace = db.get(Workspace, workspace_id)
    if not workspace:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found.")

    membership = get_workspace_membership(db, workspace_id, user.id)
    if not membership:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not belong to this workspace.")

    return workspace, membership


def require_workspace_role(
    db: Session,
    workspace_id: str,
    user: User,
    allowed_roles: set[str],
) -> tuple[Workspace, WorkspaceMembership]:
    workspace, membership = require_workspace_membership(db, workspace_id, user)
    if membership.role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission for this workspace action.",
        )
    return workspace, membership


def ensure_package_visible(db: Session, context_package: ContextPackage, user: User) -> None:
    if context_package.status == "deleted":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Context package not found.")

    if not context_package.workspace_id:
        if context_package.created_by != user.id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Context package not found.")
        return

    _, membership = require_workspace_membership(db, context_package.workspace_id, user)
    if context_package.visibility == "private" and context_package.created_by != user.id and membership.role not in ADMIN_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This package is private to its creator.")


def ensure_package_editable(db: Session, context_package: ContextPackage, user: User) -> None:
    ensure_package_visible(db, context_package, user)
    if not context_package.workspace_id:
        if context_package.created_by != user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You cannot edit this package.")
        return

    _, membership = require_workspace_role(db, context_package.workspace_id, user, EDIT_ROLES)
    if context_package.visibility == "private" and context_package.created_by != user.id and membership.role not in ADMIN_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This private package cannot be edited.")
