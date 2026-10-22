import csv
import io
from typing import Iterable, Iterator

from app import services
from app.models import Employee

COLUMNS = [
    "id", "full_name", "email", "job_title", "department",
    "country", "currency", "salary", "salary_usd", "hire_date",
]

_FORMULA_PREFIXES = ("=", "+", "-", "@", "\t", "\r")


def neutralise_formula(value: object) -> object:
    # Excel runs cells starting with = + - @ as formulas. Prefix a quote so it stays text.
    if isinstance(value, str) and value.startswith(_FORMULA_PREFIXES):
        return "'" + value
    return value


def rows_as_csv(employees: Iterable[Employee]) -> Iterator[str]:
    buffer = io.StringIO()
    writer = csv.writer(buffer)

    def flush() -> str:
        data = buffer.getvalue()
        buffer.seek(0)
        buffer.truncate()
        return data

    writer.writerow(COLUMNS)
    yield flush()
    for employee in employees:
        out = services.to_out(employee).model_dump()
        writer.writerow([neutralise_formula(out[c]) for c in COLUMNS])
        yield flush()
