from typing import Iterator

from fastapi import Query, Request
from sqlalchemy.orm import Session

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
