import random
from datetime import date

from sqlalchemy import func, select

from app.countries import COUNTRIES
from app.database import Base, create_db_engine, create_session_factory
from app.models import Employee, SalaryChange
from app.schemas import EmployeeIn
from app.seed import generate_employees, generate_history, seed

TODAY = date(2026, 1, 1)


def generate(count=500, seed_value=1):
    return list(generate_employees(count, random.Random(seed_value), TODAY))


def test_same_seed_gives_identical_data():
    assert generate(seed_value=7) == generate(seed_value=7)


def test_different_seed_gives_different_data():
    assert generate(seed_value=7) != generate(seed_value=8)


def test_emails_are_unique_even_when_names_collide():
    rows = generate(count=2_000)

    assert len({r["email"] for r in rows}) == 2_000


def test_every_generated_row_passes_api_validation():
    for row in generate(count=300):
        EmployeeIn(**{**row, "hire_date": row["hire_date"].isoformat()})


def test_hire_dates_are_never_in_the_future():
    assert all(r["hire_date"] <= TODAY for r in generate())


def test_covers_every_supported_country():
    assert {r["country"] for r in generate(count=2_000)} == set(COUNTRIES)


def test_pay_is_plausible_relative_to_country_cost_level():
    rows = generate(count=3_000)

    def mean_usd(code):
        values = [r["salary"] * COUNTRIES[code].usd_rate for r in rows if r["country"] == code]
        return sum(values) / len(values)

    assert mean_usd("US") > mean_usd("IN") * 2


def test_seed_persists_requested_number_of_rows():
    engine = create_db_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)

    with create_session_factory(engine)() as session:
        assert seed(session, count=250, seed_value=3, today=TODAY) == 250
        assert session.scalar(select(func.count(Employee.id))) == 250


def history_by_employee(count=800, seed_value=1):
    employees = generate(count, seed_value)
    rows = list(generate_history(employees, random.Random("h"), TODAY))
    grouped = {}
    for row in rows:
        grouped.setdefault(row["employee_id"], []).append(row)
    return employees, grouped


def test_every_employee_has_history_ending_at_their_current_salary():
    employees, grouped = history_by_employee()

    for emp in employees:
        rows = sorted(grouped[emp["id"]], key=lambda r: r["effective_date"])
        assert rows[-1]["salary"] == emp["salary"]


def test_history_starts_on_the_hire_date_and_never_precedes_it():
    employees, grouped = history_by_employee()

    for emp in employees:
        dates = sorted(r["effective_date"] for r in grouped[emp["id"]])
        assert dates[0] == emp["hire_date"]
        assert len(set(dates)) == len(dates)  # one change per day
        assert dates[-1] <= TODAY


def test_raises_are_real_raises():
    _, grouped = history_by_employee()

    for rows in grouped.values():
        salaries = [r["salary"] for r in sorted(rows, key=lambda r: r["effective_date"])]
        assert salaries == sorted(set(salaries))  # strictly increasing


def test_history_is_deterministic_and_some_people_have_raises():
    _, first = history_by_employee()
    _, second = history_by_employee()

    assert first == second
    assert any(len(rows) > 1 for rows in first.values())
    assert any(len(rows) == 1 for rows in first.values())


def test_seed_persists_history_with_the_employees():
    engine = create_db_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)

    with create_session_factory(engine)() as session:
        seed(session, count=100, seed_value=3, today=TODAY)

        assert session.scalar(select(func.count(SalaryChange.id))) >= 100
