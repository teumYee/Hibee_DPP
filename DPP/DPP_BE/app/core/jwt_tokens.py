"""앱 API용 액세스 JWT (Google ID 토큰은 수명이 짧아 로그인 시 여기서 발급)."""
import os
import time

from jose import JWTError, jwt

JWT_SECRET = os.getenv("JWT_SECRET", "dpp-dev-change-in-production")
JWT_ALG = "HS256"
ACCESS_TOKEN_EXPIRE_SECONDS = 60 * 60 * 24 * 30  # 30일


def create_access_token(user_id: int, email: str) -> str:
    now = int(time.time())
    payload = {
        "sub": str(user_id),
        "email": email,
        "iat": now,
        "exp": now + ACCESS_TOKEN_EXPIRE_SECONDS,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


def try_decode_access_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except JWTError:
        return None
