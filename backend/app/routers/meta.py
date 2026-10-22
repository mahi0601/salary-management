from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import repository
from app.countries import COUNTRIES
from app.deps import get_session
from app.models import Employee

router = APIRouter(prefix="/api/meta", tags=["meta"])


@router.get("")
def options(session: Session = Depends(get_session)) -> dict:
    # feeds the filter dropdowns and form suggestions
    return {
        "countries": [
            {"code": c.code, "name": c.name, "currency": c.currency, "usd_rate": c.usd_rate}
            for c in COUNTRIES.values()
        ],
        "departments": repository.distinct_values(session, Employee.department),
        "job_titles": repository.distinct_values(session, Employee.job_title),
    }
