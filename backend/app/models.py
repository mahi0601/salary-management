from datetime import date, datetime, timezone

from sqlalchemy import Date, DateTime, Index, Integer, String, Text, case
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
    # whole units of local currency, per year. int, never float - it's money
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


# salary in USD, worked out in SQL. Sorting/filtering on the raw number would
# rank 3,000,000 INR above 100,000 GBP, which is nonsense.
salary_usd_expr = Employee.salary * case(
    {code: c.usd_rate for code, c in COUNTRIES.items()}, value=Employee.country
)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(200), unique=True)
    password_hash: Mapped[str] = mapped_column(String(200))


class AuditLog(Base):
    __tablename__ = "audit_log"

    id: Mapped[int] = mapped_column(primary_key=True)
    actor: Mapped[str] = mapped_column(String(200))
    action: Mapped[str] = mapped_column(String(40))
    # plain int, no foreign key: the log has to outlive a deleted employee
    employee_id: Mapped[int | None] = mapped_column(Integer, index=True)
    details: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
