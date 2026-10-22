from dataclasses import asdict
from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app import insights, repository
from app.countries import to_usd
from app.deps import employee_filters, get_session
from app.repository import EmployeeFilters
from app.schemas import BandOut, GroupStatsOut, SalaryStatsOut, SummaryOut

router = APIRouter(prefix="/api/insights", tags=["insights"])

GroupBy = Literal["country", "department", "job_title"]
_KEY_INDEX = {"country": 0, "department": 1, "job_title": 2}


def _usd_rows(session: Session, filters: EmployeeFilters) -> list[tuple[str, str, str, int]]:
    return [
        (country, dept, title, to_usd(salary, country))
        for country, dept, title, salary in repository.salary_rows(session, filters)
    ]


@router.get("/summary", response_model=SummaryOut)
def summary(
    filters: EmployeeFilters = Depends(employee_filters), session: Session = Depends(get_session)
) -> SummaryOut:
    stats = insights.summarize(row[3] for row in _usd_rows(session, filters))
    return SummaryOut(stats=SalaryStatsOut(**asdict(stats)) if stats else None)


@router.get("/breakdown", response_model=list[GroupStatsOut])
def breakdown(
    group_by: GroupBy,
    filters: EmployeeFilters = Depends(employee_filters),
    session: Session = Depends(get_session),
) -> list[GroupStatsOut]:
    index = _KEY_INDEX[group_by]
    grouped = insights.summarize_by((row[index], row[3]) for row in _usd_rows(session, filters))
    ordered = sorted(grouped.items(), key=lambda kv: (-kv[1].headcount, kv[0]))
    return [GroupStatsOut(key=key, **asdict(stats)) for key, stats in ordered]


@router.get("/distribution", response_model=list[BandOut])
def distribution(
    bucket_size: int = Query(25_000, ge=1_000, le=1_000_000),
    filters: EmployeeFilters = Depends(employee_filters),
    session: Session = Depends(get_session),
) -> list[BandOut]:
    bands = insights.distribution((row[3] for row in _usd_rows(session, filters)), bucket_size)
    return [BandOut(**asdict(band)) for band in bands]
