import io

from openpyxl import Workbook

HEADER = ["full_name", "email", "job_title", "department", "country", "salary", "hire_date"]


def good_row(n: int = 1, **overrides) -> list:
    row = dict(
        zip(HEADER, [f"Person {n}", f"person{n}@acme.com", "Engineer", "Engineering", "US", 100_000, "2022-03-14"])
    )
    row.update(overrides)
    return [row[h] for h in HEADER]


def xlsx_bytes(rows: list[list], header: list[str] | None = None) -> bytes:
    workbook = Workbook()
    sheet = workbook.active
    sheet.append(header or HEADER)
    for row in rows:
        sheet.append(row)
    buffer = io.BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()


def csv_bytes(rows: list[list], header: list[str] | None = None, bom: bool = False) -> bytes:
    lines = [",".join(header or HEADER)] + [",".join(str(c) for c in r) for r in rows]
    return (("﻿" if bom else "") + "\n".join(lines) + "\n").encode()

