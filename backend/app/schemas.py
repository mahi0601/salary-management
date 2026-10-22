from datetime import date

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.countries import COUNTRIES

MAX_SALARY = 2_000_000_000  # comfortably above any real annual salary in JPY


class EmployeeIn(BaseModel):
    full_name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    job_title: str = Field(min_length=1, max_length=100)
    department: str = Field(min_length=1, max_length=100)
    country: str
    salary: int = Field(gt=0, le=MAX_SALARY, description="Annual base salary, local currency")
    hire_date: date

    @field_validator("full_name", "job_title", "department")
    @classmethod
    def _strip_and_require_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("must not be blank")
        return value

    @field_validator("email")
    @classmethod
    def _normalise_email(cls, value: str) -> str:
        return value.strip().lower()

    @field_validator("country")
    @classmethod
    def _known_country(cls, value: str) -> str:
        value = value.strip().upper()
        if value not in COUNTRIES:
            raise ValueError(f"unsupported country; expected one of {sorted(COUNTRIES)}")
        return value

    @field_validator("hire_date")
    @classmethod
    def _not_in_future(cls, value: date) -> date:
        if value > date.today():
            raise ValueError("hire_date cannot be in the future")
        return value


class EmployeeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    email: str
    job_title: str
    department: str
    country: str
    salary: int
    currency: str
    salary_usd: int
    hire_date: date


class EmployeePage(BaseModel):
    items: list[EmployeeOut]
    total: int
    page: int
    page_size: int


class SalaryStatsOut(BaseModel):
    headcount: int
    total_usd: int
    average_usd: int
    min_usd: int
    p25_usd: int
    median_usd: int
    p75_usd: int
    max_usd: int


class GroupStatsOut(SalaryStatsOut):
    key: str


class SummaryOut(BaseModel):
    """`stats` is null when no employee matches the filters."""

    stats: SalaryStatsOut | None


class BandOut(BaseModel):
    from_usd: int
    to_usd: int
    count: int
