from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import repository
from app.countries import COUNTRIES, to_usd
from app.errors import DuplicateEmail, EmployeeNotFound
from app.models import Employee
from app.schemas import EmployeeIn, EmployeeOut


def to_out(employee: Employee) -> EmployeeOut:
    return EmployeeOut(
        id=employee.id,
        full_name=employee.full_name,
        email=employee.email,
        job_title=employee.job_title,
        department=employee.department,
        country=employee.country,
        salary=employee.salary,
        currency=COUNTRIES[employee.country].currency,
        salary_usd=to_usd(employee.salary, employee.country),
        hire_date=employee.hire_date,
    )


def create_employee(session: Session, data: EmployeeIn) -> Employee:
    if repository.email_exists(session, data.email):
        raise DuplicateEmail(data.email)
    employee = Employee(**data.model_dump())
    session.add(employee)
    _commit(session, data.email)
    return employee


def update_employee(session: Session, employee_id: int, data: EmployeeIn) -> Employee:
    employee = repository.get_employee(session, employee_id)
    if employee is None:
        raise EmployeeNotFound(employee_id)
    if repository.email_exists(session, data.email, excluding_id=employee_id):
        raise DuplicateEmail(data.email)
    for field, value in data.model_dump().items():
        setattr(employee, field, value)
    _commit(session, data.email)
    return employee


def delete_employee(session: Session, employee_id: int) -> None:
    employee = repository.get_employee(session, employee_id)
    if employee is None:
        raise EmployeeNotFound(employee_id)
    session.delete(employee)
    session.commit()


def _commit(session: Session, email: str) -> None:
    try:
        session.commit()
    except IntegrityError as exc:  # lost a race with a concurrent insert
        session.rollback()
        raise DuplicateEmail(email) from exc
