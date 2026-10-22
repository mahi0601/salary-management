"""Seed the database with synthetic employees.

    python -m app.seed [--count 10000] [--seed 42] [--reset]

All data is synthetic (no real people). Generation is a pure function of the
RNG seed, so the same seed always produces the same dataset.
"""
import argparse
import random
from datetime import date, timedelta
from typing import Iterator

from sqlalchemy import delete, func, insert, select

from app.countries import COUNTRIES
from app.database import Base, create_db_engine, create_session_factory, database_url
from app.models import Employee

# department -> {job title: typical US-market annual base salary in USD}
JOB_CATALOG: dict[str, dict[str, int]] = {
    "Engineering": {
        "Software Engineer": 120_000,
        "Senior Software Engineer": 155_000,
        "Staff Engineer": 195_000,
        "Engineering Manager": 185_000,
        "QA Engineer": 95_000,
        "DevOps Engineer": 130_000,
    },
    "Product": {
        "Product Manager": 140_000,
        "Senior Product Manager": 170_000,
        "Product Designer": 115_000,
    },
    "Sales": {
        "Sales Representative": 65_000,
        "Account Executive": 100_000,
        "Sales Manager": 140_000,
    },
    "Marketing": {
        "Marketing Specialist": 70_000,
        "Content Strategist": 80_000,
        "Marketing Manager": 120_000,
    },
    "Human Resources": {
        "HR Generalist": 70_000,
        "Recruiter": 75_000,
        "HR Manager": 115_000,
    },
    "Finance": {
        "Accountant": 75_000,
        "Financial Analyst": 90_000,
        "Finance Manager": 140_000,
    },
    "Operations": {
        "Operations Analyst": 72_000,
        "Operations Manager": 118_000,
    },
    "Customer Support": {
        "Support Agent": 48_000,
        "Support Team Lead": 70_000,
    },
}

# Relative headcount per department (engineering-heavy, like many orgs).
DEPARTMENT_WEIGHTS = {
    "Engineering": 38, "Product": 8, "Sales": 16, "Marketing": 8,
    "Human Resources": 4, "Finance": 6, "Operations": 8, "Customer Support": 12,
}  # fmt: skip

# country -> (headcount weight, pay level relative to the US market)
COUNTRY_PROFILE = {
    "US": (30, 1.00), "IN": (20, 0.30), "GB": (10, 0.75), "DE": (8, 0.80),
    "CA": (7, 0.85), "FR": (6, 0.72), "AU": (5, 0.85), "SG": (5, 0.80),
    "BR": (5, 0.35), "JP": (4, 0.65),
}  # fmt: skip

FIRST_NAMES = [
    "Aarav", "Aisha", "Alex", "Amelia", "Ana", "Andre", "Anika", "Arjun", "Ben", "Camila",
    "Carlos", "Chen", "Chloe", "Daniel", "Diya", "Elena", "Emma", "Farah", "Felix", "Grace",
    "Hana", "Hiro", "Isabella", "Ivan", "Jamal", "Jin", "Julia", "Kavya", "Kenji", "Lars",
    "Layla", "Liam", "Lucas", "Maya", "Mei", "Mohammed", "Nadia", "Noah", "Olivia", "Omar",
    "Priya", "Rahul", "Rosa", "Ryan", "Sakura", "Sofia", "Tariq", "Uma", "Victor", "Zoe",
]  # fmt: skip
LAST_NAMES = [
    "Almeida", "Anderson", "Bose", "Brown", "Chatterjee", "Costa", "Davies", "Dubois", "Evans",
    "Fischer", "Garcia", "Gupta", "Hansen", "Hughes", "Iyer", "Jackson", "Johnson", "Kapoor",
    "Kim", "Kowalski", "Lee", "Lopez", "Martin", "Meyer", "Mukherjee", "Nair", "Nguyen",
    "Okafor", "Patel", "Perez", "Rao", "Reyes", "Rossi", "Sato", "Schmidt", "Sharma", "Silva",
    "Singh", "Smith", "Suzuki", "Tan", "Taylor", "Tanaka", "Wang", "Williams", "Wilson", "Yamamoto",
]  # fmt: skip

HISTORY_YEARS = 12
SALARY_NOISE_SIGMA = 0.12
RAISE_PER_YEAR_OF_TENURE = 0.02
MAX_TENURE_YEARS_FOR_RAISES = 10


def _round_local(amount: float, usd_rate: float) -> int:
    """Round to a figure that looks like a real salary in that currency."""
    step = 100 if usd_rate >= 0.1 else 1_000
    return max(step, int(round(amount / step)) * step)


def generate_employees(count: int, rng: random.Random, today: date) -> Iterator[dict]:
    departments = list(DEPARTMENT_WEIGHTS)
    dept_weights = list(DEPARTMENT_WEIGHTS.values())
    countries = list(COUNTRY_PROFILE)
    country_weights = [w for w, _ in COUNTRY_PROFILE.values()]

    for n in range(1, count + 1):
        department = rng.choices(departments, dept_weights)[0]
        job_title, base_usd = rng.choice(list(JOB_CATALOG[department].items()))
        country = rng.choices(countries, country_weights)[0]
        pay_level = COUNTRY_PROFILE[country][1]

        hire_date = today - timedelta(days=rng.randint(0, HISTORY_YEARS * 365))
        tenure_years = min((today - hire_date).days / 365, MAX_TENURE_YEARS_FOR_RAISES)
        noise = rng.lognormvariate(0, SALARY_NOISE_SIGMA)
        usd = base_usd * pay_level * noise * (1 + RAISE_PER_YEAR_OF_TENURE * tenure_years)

        first, last = rng.choice(FIRST_NAMES), rng.choice(LAST_NAMES)
        yield {
            "full_name": f"{first} {last}",
            # Sequence number guarantees uniqueness even when names collide.
            "email": f"{first}.{last}.{n}@acme.com".lower(),
            "job_title": job_title,
            "department": department,
            "country": country,
            "salary": _round_local(usd / COUNTRIES[country].usd_rate, COUNTRIES[country].usd_rate),
            "hire_date": hire_date,
        }


def seed(session, count: int = 10_000, seed_value: int = 42, today: date | None = None) -> int:
    rows = list(generate_employees(count, random.Random(seed_value), today or date.today()))
    session.execute(insert(Employee), rows)  # one bulk insert: ~10k rows in well under a second
    session.commit()
    return len(rows)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawTextHelpFormatter)
    parser.add_argument("--count", type=int, default=10_000)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--reset", action="store_true", help="delete existing employees first")
    parser.add_argument(
        "--if-empty", action="store_true", help="do nothing when employees already exist"
    )
    args = parser.parse_args()

    engine = create_db_engine(database_url())
    Base.metadata.create_all(engine)
    with create_session_factory(engine)() as session:
        existing = session.scalar(select(func.count(Employee.id))) or 0
        if args.if_empty and existing:
            print(f"Database already has {existing} employees; skipping seed.")
            return
        if args.reset:
            session.execute(delete(Employee))
            session.commit()
        elif existing:
            raise SystemExit(f"{existing} employees already exist; pass --reset to replace them.")
        print(f"Seeded {seed(session, args.count, args.seed)} employees.")


if __name__ == "__main__":
    main()
