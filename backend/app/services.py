import json

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import repository
from app.countries import COUNTRIES, to_usd
from app.errors import DuplicateEmail, EmployeeNotFound
from app.models import AuditLog, Employee
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


def create_employee(session: Session, data: EmployeeIn, actor: str) -> Employee:
    if repository.email_exists(session, data.email):
        raise DuplicateEmail(data.email)
    employee = Employee(**data.model_dump())
    session.add(employee)
    _flush(session, data.email)  # need the id for the audit row
    _audit(session, actor, "create", employee.id, {"email": employee.email, "salary": employee.salary})
    session.commit()
    return employee


def update_employee(session: Session, employee_id: int, data: EmployeeIn, actor: str) -> Employee:
    employee = repository.get_employee(session, employee_id)
    if employee is None:
        raise EmployeeNotFound(employee_id)
    if repository.email_exists(session, data.email, excluding_id=employee_id):
        raise DuplicateEmail(data.email)
    changes = {}
    for field, value in data.model_dump().items():
        old = getattr(employee, field)
        if old != value:
            changes[field] = [old, value]
            setattr(employee, field, value)
    if changes:
        _audit(session, actor, "update", employee_id, changes)
    _flush(session, data.email)
    session.commit()
    return employee


def delete_employee(session: Session, employee_id: int, actor: str) -> None:
    employee = repository.get_employee(session, employee_id)
    if employee is None:
        raise EmployeeNotFound(employee_id)
    _audit(session, actor, "delete", employee_id, {"email": employee.email, "salary": employee.salary})
    session.delete(employee)
    session.commit()


def _audit(session: Session, actor: str, action: str, employee_id: int, details: dict) -> None:
    # default=str because hire_date comes through as a date
    session.add(
        AuditLog(actor=actor, action=action, employee_id=employee_id, details=json.dumps(details, default=str))
    )


def _flush(session: Session, email: str) -> None:
    try:
        session.flush()
    except IntegrityError as exc:  # lost a race with a concurrent insert
        session.rollback()
        raise DuplicateEmail(email) from exc
