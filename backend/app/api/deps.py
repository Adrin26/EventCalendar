from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.db.session import get_db
from app.models import User

bearer = HTTPBearer(auto_error=False)
DbDep = Annotated[Session, Depends(get_db)]


def get_current_user(
    db: DbDep,
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
) -> User | None:
    if not creds:
        return None
    user_id = decode_access_token(creds.credentials)
    if not user_id:
        return None
    return db.get(User, user_id)


def require_user(
    user: Annotated[User | None, Depends(get_current_user)],
) -> User:
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    return user


def require_admin(
    user: Annotated[User, Depends(require_user)],
) -> User:
    if user.role not in ("superadmin", "admin", "editor"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin access required")
    return user


CurrentUser = Annotated[User | None, Depends(get_current_user)]
AdminUser = Annotated[User, Depends(require_admin)]
