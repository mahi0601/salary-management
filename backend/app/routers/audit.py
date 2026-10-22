import json

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps import get_session
from app.models import AuditLog

router = APIRouter(prefix="/api/audit", tags=["audit"])


@router.get("")
def recent(
    employee_id: int | None = None,
    limit: int = Query(50, ge=1, le=200),
    session: Session = Depends(get_session),
) -> list[dict]:
    stmt = select(AuditLog).order_by(AuditLog.id.desc()).limit(limit)
    if employee_id is not None:
        stmt = stmt.where(AuditLog.employee_id == employee_id)
    return [
        {
            "id": row.id,
            "actor": row.actor,
            "action": row.action,
            "employee_id": row.employee_id,
            "details": json.loads(row.details),
            "at": row.created_at.isoformat(),
        }
        for row in session.scalars(stmt)
    ]
