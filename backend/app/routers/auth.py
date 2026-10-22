from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import auth
from app.deps import current_user, get_session
from app.errors import InvalidCredentials
from app.models import User

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginIn(BaseModel):
    email: str
    password: str


class TokenOut(BaseModel):
    token: str
    email: str


@router.post("/login", response_model=TokenOut)
def login(data: LoginIn, request: Request, session: Session = Depends(get_session)) -> TokenOut:
    email = data.email.strip().lower()
    user = session.scalar(select(User).where(User.email == email))
    if not auth.verify_password(data.password, user.password_hash if user else auth.DUMMY_HASH) or not user:
        raise InvalidCredentials()
    return TokenOut(token=auth.create_token(user.email, request.app.state.jwt_secret), email=user.email)


@router.get("/me")
def me(user: User = Depends(current_user)) -> dict:
    return {"email": user.email}
