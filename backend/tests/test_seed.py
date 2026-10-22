import random
from datetime import date

from sqlalchemy import func, select

from app.countries import COUNTRIES
from app.database import Base, create_db_engine, create_session_factory
from app.models import Employee
from app.schemas import EmployeeIn
from app.seed import generate_employees, seed

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
