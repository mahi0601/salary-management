import json
from datetime import date

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import importer, repository
from app.countries import COUNTRIES, to_usd
from app.errors import DuplicateEmail, EmployeeNotFound, InvalidSalaryChange, SalaryChangeConflict
from app.models import AuditLog, Employee, SalaryChange
from app.schemas import (
    EmployeeIn,
    EmployeeOut,
    ImportReportOut,
    ImportRowError,
    SalaryChangeIn,
    SalaryChangeOut,
)

START_REASON = "Starting salary"
MAX_ERRORS_SHOWN = 100


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
    _flush(session, data.email)  # need the id for the history and audit rows
    session.add(
        SalaryChange(
            employee_id=employee.id,
            salary=employee.salary,
            effective_date=employee.hire_date,
            reason=START_REASON,
            changed_by=actor,
        )
    )
    _audit(session, actor, "create", employee.id, {"email": employee.email, "salary": employee.salary})
    session.commit()
    return employee


def update_employee(session: Session, employee_id: int, data: EmployeeIn, actor: str) -> Employee:
    employee = repository.get_employee(session, employee_id)
    if employee is None:
        raise EmployeeNotFound(employee_id)
    if repository.email_exists(session, data.email, excluding_id=employee_id):
        raise DuplicateEmail(data.email)
    if data.hire_date != employee.hire_date:
        _move_hire_date(session, employee, data.hire_date)
    changes = {}
    for field, value in data.model_dump().items():
        old = getattr(employee, field)
        if old != value:
            changes[field] = [old, value]
            setattr(employee, field, value)
    if "salary" in changes:
        # editing the salary on the form counts as a change effective today
        _set_salary_for_day(session, employee, date.today(), employee.salary, "Salary edited", actor)
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


def import_employees(
    session: Session, filename: str, content: bytes, actor: str, dry_run: bool
) -> ImportReportOut:
    """All or nothing: one bad row and nothing is saved, so a half-imported sheet can't happen."""
    parsed = importer.parse(filename, content)
    taken = repository.existing_emails(session, [e.email for _, e in parsed.employees])
    errors = parsed.errors + [
        importer.RowError(row, "email", "An employee with this email already exists")
        for row, e in parsed.employees
        if e.email in taken
    ]
    errors.sort(key=lambda e: e.row)
    valid = parsed.total_rows - len({e.row for e in errors})

    created = 0
    if not errors and not dry_run:
        created = _create_many(session, [e for _, e in parsed.employees], actor, filename)

    return ImportReportOut(
        dry_run=dry_run,
        total_rows=parsed.total_rows,
        valid_rows=valid,
        created=created,
        error_count=len(errors),
        errors=[ImportRowError(row=e.row, field=e.field, message=e.message) for e in errors[:MAX_ERRORS_SHOWN]],
    )


def _create_many(session: Session, rows: list[EmployeeIn], actor: str, filename: str) -> int:
    employees = [Employee(**r.model_dump()) for r in rows]
    session.add_all(employees)
    try:
        session.flush()
    except IntegrityError as exc:  # someone added one of these emails while we were checking
        session.rollback()
        raise DuplicateEmail("one of the emails in the file") from exc
    session.add_all(
        SalaryChange(
            employee_id=e.id,
            salary=e.salary,
            effective_date=e.hire_date,
            reason=START_REASON,
            changed_by=actor,
        )
        for e in employees
    )
    # one audit row for the whole file, not 20,000
    session.add(
        AuditLog(actor=actor, action="import", employee_id=None, details=json.dumps({"file": filename, "created": len(employees)}))
    )
    session.commit()
    return len(employees)


def salary_history(session: Session, employee_id: int) -> list[SalaryChangeOut]:
    employee = repository.get_employee(session, employee_id)
    if employee is None:
        raise EmployeeNotFound(employee_id)
    return _history_out(employee, repository.salary_history(session, employee_id))


def add_salary_change(
    session: Session, employee_id: int, data: SalaryChangeIn, actor: str
) -> list[SalaryChangeOut]:
    employee = repository.get_employee(session, employee_id)
    if employee is None:
        raise EmployeeNotFound(employee_id)
    rows = repository.salary_history(session, employee_id)

    if data.effective_date < employee.hire_date:
        raise InvalidSalaryChange("The effective date is before the hire date")
    if any(r.effective_date == data.effective_date for r in rows):
        raise SalaryChangeConflict(f"A salary change is already recorded for {data.effective_date}")
    earlier = [r for r in rows if r.effective_date < data.effective_date]
    if earlier and earlier[-1].salary == data.salary:
        raise InvalidSalaryChange("That is already the salary on that date")

    old_salary = employee.salary
    session.add(
        SalaryChange(
            employee_id=employee_id,
            salary=data.salary,
            effective_date=data.effective_date,
            reason=data.reason,
            changed_by=actor,
        )
    )
    try:
        session.flush()
    except IntegrityError as exc:  # same day recorded by someone else a moment ago
        session.rollback()
        raise SalaryChangeConflict(f"A salary change is already recorded for {data.effective_date}") from exc

    rows = repository.salary_history(session, employee_id)
    employee.salary = rows[-1].salary  # a back-dated change leaves today's pay alone
    _audit(
        session,
        actor,
        "salary_change",
        employee_id,
        {"salary": [old_salary, employee.salary], "effective_date": data.effective_date, "reason": data.reason},
    )
    session.commit()
    return _history_out(employee, rows)


def _history_out(employee: Employee, rows: list[SalaryChange]) -> list[SalaryChangeOut]:
    currency = COUNTRIES[employee.country].currency
    out = []
    for i, row in enumerate(rows):
        previous = rows[i - 1].salary if i else None
        out.append(
            SalaryChangeOut(
                id=row.id,
                effective_date=row.effective_date,
                salary=row.salary,
                currency=currency,
                salary_usd=to_usd(row.salary, employee.country),
                change_pct=round((row.salary - previous) / previous * 100, 1) if previous else None,
                reason=row.reason,
                changed_by=row.changed_by,
            )
        )
    return out


def _set_salary_for_day(
    session: Session, employee: Employee, day: date, salary: int, reason: str, actor: str
) -> None:
    """Make `salary` the pay for `day`: correct that day's row if there is one, else add one."""
    rows = repository.salary_history(session, employee.id)
    same_day = next((r for r in rows if r.effective_date == day), None)
    if same_day:
        same_day.salary, same_day.changed_by = salary, actor
    else:
        session.add(
            SalaryChange(
                employee_id=employee.id, salary=salary, effective_date=day, reason=reason, changed_by=actor
            )
        )


def _move_hire_date(session: Session, employee: Employee, new_date: date) -> None:
    # the first history row is the starting salary and always sits on the hire date
    rows = repository.salary_history(session, employee.id)
    if not rows:
        return
    if any(r.effective_date <= new_date for r in rows[1:]):
        raise InvalidSalaryChange("The new hire date is on or after a recorded salary change")
    rows[0].effective_date = new_date


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
