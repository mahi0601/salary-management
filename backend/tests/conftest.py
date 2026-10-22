import pytest
from fastapi.testclient import TestClient

from app import auth
from app.database import create_db_engine
from app.main import create_app

HR_EMAIL, HR_PASSWORD = "hr@acme.com", "correct horse battery"
JWT_SECRET = "x" * 32


@pytest.fixture(scope="session", autouse=True)
def cheap_password_hashing():
    # real scrypt cost would add ~50 ms to every test that builds an app
    with pytest.MonkeyPatch.context() as mp:
        mp.setattr(auth, "COST_N", 2**4)
        yield


@pytest.fixture
def app():
    # new in-memory DB every test
    engine = create_db_engine("sqlite:///:memory:")
    return create_app(engine, jwt_secret=JWT_SECRET, hr_user=(HR_EMAIL, HR_PASSWORD))


@pytest.fixture
def anonymous_client(app):
    return TestClient(app)


@pytest.fixture
def client(app):
    """Signed in as the HR user, like the real UI."""
    test_client = TestClient(app)
    token = test_client.post(
        "/api/auth/login", json={"email": HR_EMAIL, "password": HR_PASSWORD}
    ).json()["token"]
    test_client.headers["Authorization"] = f"Bearer {token}"
    return test_client


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
