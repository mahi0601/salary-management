from typing import Literal

from fastapi import APIRouter, Depends, Query, Response, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app import csv_export, repository, services
from app.deps import current_user, employee_filters, get_session
from app.errors import EmployeeNotFound
from app.models import User
from app.repository import EmployeeFilters
from app.schemas import EmployeeIn, EmployeeOut, EmployeePage, SalaryChangeIn, SalaryChangeOut

router = APIRouter(prefix="/api/employees", tags=["employees"])

SortField = Literal["full_name", "job_title", "department", "country", "hire_date", "salary_usd"]
SortOrder = Literal["asc", "desc"]


@router.get("", response_model=EmployeePage)
def list_employees(
    filters: EmployeeFilters = Depends(employee_filters),
    sort_by: SortField = "full_name",
    order: SortOrder = "asc",
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    session: Session = Depends(get_session),
) -> EmployeePage:
    rows, total = repository.list_employees(
        session, filters, sort_by=sort_by, descending=order == "desc", page=page, page_size=page_size
    )
    return EmployeePage(
        items=[services.to_out(r) for r in rows], total=total, page=page, page_size=page_size
    )


@router.get("/export.csv")
def export_csv(
    filters: EmployeeFilters = Depends(employee_filters),
    sort_by: SortField = "full_name",
    order: SortOrder = "asc",
    session: Session = Depends(get_session),
) -> StreamingResponse:
    # streamed row by row so a big export doesn't sit in memory
    rows = repository.iter_employees(session, filters, sort_by=sort_by, descending=order == "desc")
    return StreamingResponse(
        csv_export.rows_as_csv(rows),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="employees.csv"'},
    )


@router.post("", response_model=EmployeeOut, status_code=status.HTTP_201_CREATED)
def create_employee(
    data: EmployeeIn, session: Session = Depends(get_session), user: User = Depends(current_user)
) -> EmployeeOut:
    return services.to_out(services.create_employee(session, data, user.email))


@router.get("/{employee_id}", response_model=EmployeeOut)
def get_employee(employee_id: int, session: Session = Depends(get_session)) -> EmployeeOut:
    employee = repository.get_employee(session, employee_id)
    if employee is None:
        raise EmployeeNotFound(employee_id)
    return services.to_out(employee)


@router.put("/{employee_id}", response_model=EmployeeOut)
def update_employee(
    employee_id: int,
    data: EmployeeIn,
    session: Session = Depends(get_session),
    user: User = Depends(current_user),
) -> EmployeeOut:
    return services.to_out(services.update_employee(session, employee_id, data, user.email))


@router.delete("/{employee_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_employee(
    employee_id: int, session: Session = Depends(get_session), user: User = Depends(current_user)
) -> Response:
    services.delete_employee(session, employee_id, user.email)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{employee_id}/salary-history", response_model=list[SalaryChangeOut])
def salary_history(employee_id: int, session: Session = Depends(get_session)) -> list[SalaryChangeOut]:
    return services.salary_history(session, employee_id)


@router.post(
    "/{employee_id}/salary-changes", response_model=list[SalaryChangeOut], status_code=status.HTTP_201_CREATED
)
def add_salary_change(
    employee_id: int,
    data: SalaryChangeIn,
    session: Session = Depends(get_session),
    user: User = Depends(current_user),
) -> list[SalaryChangeOut]:
    return services.add_salary_change(session, employee_id, data, user.email)
