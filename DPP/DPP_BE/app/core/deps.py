from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.core.auth import verify_google_token
from app.core.database import get_db
from app.core.jwt_tokens import try_decode_access_token
from app.models.user import Users


def get_current_user(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> Users:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header is required.",
        )

    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Bearer token is required.",
        )

    # 1) 앱 로그인 후 발급 JWT (수 주 유효) — Google ID 토큰 만료로 인한 401 방지
    payload = try_decode_access_token(token)
    if payload is not None:
        sub = payload.get("sub")
        if sub is not None:
            try:
                uid = int(sub)
            except (TypeError, ValueError):
                uid = None
            if uid is not None:
                user = db.query(Users).filter(Users.id == uid).first()
                if user:
                    return user
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid session: user not found.",
                )

    # 2) 구 Google ID 토큰 Bearer (하위 호환, 만료 짧음)
    idinfo = verify_google_token(token)
    email = idinfo.get("email")
    if not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google token payload is missing email.",
        )

    user = db.query(Users).filter(Users.email == email).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    return user
