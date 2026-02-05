from pydantic import BaseModel, EmailStr
from typing import Optional

class GoogleLoginRequest(BaseModel):
    idtoken: str

class UserLoginResponse(BaseModel):
    id: int
    email: EmailStr
    nickname: str
    message: Optional[str] = "로그인 성공"

