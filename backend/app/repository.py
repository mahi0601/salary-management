from dataclasses import dataclass
from typing import Iterator

from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

from app.models import Employee, salary_usd_expr

SORT_COLUMNS = {
    "full_name": Employee.full_name,
    "job_title": Employee.job_title,
    "department": Employee.department,
    "country": Employee.country,
    "hire_date": Employee.hire_date,
    "salary_usd": salary_usd_expr,
}


@dataclass(frozen=True)
class EmployeeFilters:
    search: str | None = None
    country: str | None = None
    department: str | None = None
    job_title: str | None = None
    min_salary_usd: int | None = None
    max_salary_usd: int | None = None


def apply_filters(stmt: Select, f: EmployeeFilters) -> Select:
    if f.search:
        term = f"%{f.search.strip().lower()}%"
        stmt = stmt.where(
            func.lower(Employee.full_name).like(term) | func.lower(Employee.email).like(term)
        )
    if f.country:
        stmt = stmt.where(Employee.country == f.country.upper())
    if f.department:
        stmt = stmt.where(Employee.department == f.department)
    if f.job_title:
        stmt = stmt.where(Employee.job_title == f.job_title)
    if f.min_salary_usd is not None:
        stmt = stmt.where(salary_usd_expr >= f.min_salary_usd)
    if f.max_salary_usd is not None:
        stmt = stmt.where(salary_usd_expr <= f.max_salary_usd)
    return stmt


def _ordered(stmt: Select, sort_by: str, descending: bool) -> Select:
    column = SORT_COLUMNS[sort_by]
    order = column.desc() if descending else column.asc()
    # tie-break on id, otherwise rows can repeat or vanish between pages
    return stmt.order_by(order, Employee.id)


def list_employees(
    session: Session,
    filters: EmployeeFilters,
    *,
    sort_by: str = "full_name",
    descending: bool = False,
    page: int = 1,
    page_size: int = 50,
) -> tuple[list[Employee], int]:
    base = apply_filters(select(Employee), filters)
    total = session.scalar(apply_filters(select(func.count(Employee.id)), filters)) or 0
    stmt = _ordered(base, sort_by, descending).limit(page_size).offset((page - 1) * page_size)
    return list(session.scalars(stmt)), total


def iter_employees(
    session: Session, filters: EmployeeFilters, *, sort_by: str = "full_name", descending: bool = False
) -> Iterator[Employee]:
    stmt = _ordered(apply_filters(select(Employee), filters), sort_by, descending)
    yield from session.scalars(stmt.execution_options(yield_per=500))


def get_employee(session: Session, employee_id: int) -> Employee | None:
    return session.get(Employee, employee_id)


def email_exists(session: Session, email: str, *, excluding_id: int | None = None) -> bool:
    stmt = select(Employee.id).where(Employee.email == email)
    if excluding_id is not None:
        stmt = stmt.where(Employee.id != excluding_id)
    return session.scalar(stmt) is not None


def distinct_values(session: Session, column) -> list[str]:
    return list(session.scalars(select(column).distinct().order_by(column)))


def salary_rows(session: Session, filters: EmployeeFilters) -> list[tuple[str, str, str, int]]:
    # plain tuples, not ORM objects - 10k of those is noticeably slower
    stmt = apply_filters(
        select(Employee.country, Employee.department, Employee.job_title, Employee.salary), filters
    )
    return [tuple(row) for row in session.execute(stmt)]
