from datetime import date, datetime, timezone

from sqlalchemy import Date, DateTime, Index, Integer, String, case
from sqlalchemy.orm import Mapped, mapped_column

from app.countries import COUNTRIES
from app.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Employee(Base):
    __tablename__ = "employees"

    id: Mapped[int] = mapped_column(primary_key=True)
    full_name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(200), unique=True)
    job_title: Mapped[str] = mapped_column(String(100))
    department: Mapped[str] = mapped_column(String(100))
    country: Mapped[str] = mapped_column(String(2))
    # Annual base salary in whole units of the country's local currency.
    # Integer on purpose: no floating-point drift for money.
    salary: Mapped[int] = mapped_column(Integer)
    hire_date: Mapped[date] = mapped_column(Date)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow
    )

    __table_args__ = (
        Index("ix_employees_country", "country"),
        Index("ix_employees_department", "department"),
        Index("ix_employees_job_title", "job_title"),
        Index("ix_employees_full_name", "full_name"),
    )


# Salary normalised to USD inside SQL so sorting and range filters compare
# like with like across countries (100,000 INR is not 100,000 USD).
salary_usd_expr = Employee.salary * case(
    {code: c.usd_rate for code, c in COUNTRIES.items()}, value=Employee.country
)
