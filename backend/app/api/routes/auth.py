from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.audit import record_audit_log
from app.db import get_db
from app.models import SessionToken, User
from app.schemas import AuthLoginRequest, AuthSessionResponse, UserRead

router = APIRouter(prefix="/auth")


@router.post("/login", response_model=AuthSessionResponse)
def login(payload: AuthLoginRequest, db: Session = Depends(get_db)) -> AuthSessionResponse:
    email = payload.email.strip().lower()
    if not email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email is required.")

    user = db.scalar(select(User).where(User.email == email))
    if not user:
        user = User(email=email, name=payload.name.strip())
        db.add(user)
        db.commit()
        db.refresh(user)
    elif payload.name.strip() and user.name != payload.name.strip():
        user.name = payload.name.strip()
        db.add(user)
        db.commit()
        db.refresh(user)

    session_token = SessionToken(user_id=user.id)
    db.add(session_token)
    db.flush()
    record_audit_log(
        db,
        action="auth.login",
        entity_type="session",
        entity_id=session_token.id,
        actor=user,
        details={"email": user.email},
    )
    db.commit()
    db.refresh(session_token)

    return AuthSessionResponse(token=session_token.token, user=user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> None:
    if not authorization:
        return

    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        return

    session_token = db.scalar(select(SessionToken).where(SessionToken.token == token))
    if session_token:
        user = db.get(User, session_token.user_id)
        record_audit_log(
            db,
            action="auth.logout",
            entity_type="session",
            entity_id=session_token.id,
            actor=user,
        )
        db.delete(session_token)
        db.commit()


@router.get("/me", response_model=UserRead)
def me(current_user: User = Depends(get_current_user)) -> User:
    return current_user
