import pytest
from fastapi.testclient import TestClient

from app.database import create_db_engine
from app.main import create_app


@pytest.fixture
def client():
    """Fresh in-memory database per test: fast and fully isolated."""
    return TestClient(create_app(create_db_engine("sqlite:///:memory:")))


def employee_payload(**overrides) -> dict:
    payload = {
        "full_name": "Asha Rao",
        "email": "asha.rao@acme.com",
        "job_title": "Software Engineer",
        "department": "Engineering",
        "country": "IN",
        "salary": 2_400_000,
        "hire_date": "2022-03-14",
    }
    payload.update(overrides)
    return payload


@pytest.fixture
def make_employee(client):
    counter = iter(range(1, 10_000))

    def _make(**overrides) -> dict:
        n = next(counter)
        overrides.setdefault("email", f"person{n}@acme.com")
        overrides.setdefault("full_name", f"Person {n:04d}")
        response = client.post("/api/employees", json=employee_payload(**overrides))
        assert response.status_code == 201, response.text
        return response.json()

    return _make
