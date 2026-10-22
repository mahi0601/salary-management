from typing import Iterator

from fastapi import Depends, HTTPException, Query, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import auth
from app.models import User
from app.repository import EmployeeFilters


def get_session(request: Request) -> Iterator[Session]:
    with request.app.state.session_factory() as session:
        yield session


def employee_filters(
    search: str | None = Query(None, max_length=100, description="Name or email contains"),
    country: str | None = Query(None, min_length=2, max_length=2),
    department: str | None = None,
    job_title: str | None = None,
    min_salary_usd: int | None = Query(None, ge=0),
    max_salary_usd: int | None = Query(None, ge=0),
) -> EmployeeFilters:
    return EmployeeFilters(search, country, department, job_title, min_salary_usd, max_salary_usd)


def current_user(request: Request, session: Session = Depends(get_session)) -> User:
    header = request.headers.get("Authorization", "")
    scheme, _, token = header.partition(" ")
    email = auth.read_token(token, request.app.state.jwt_secret) if scheme.lower() == "bearer" else None
    user = session.scalar(select(User).where(User.email == email)) if email else None
    if user is None:
        raise HTTPException(
            status_code=401, detail="Please sign in", headers={"WWW-Authenticate": "Bearer"}
        )
    return user
