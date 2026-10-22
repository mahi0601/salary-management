from datetime import datetime, timedelta, timezone

import pytest

from app import auth
from app.database import create_db_engine
from app.main import create_app
from tests.conftest import HR_EMAIL, HR_PASSWORD, JWT_SECRET, employee_payload


def login(client, email=HR_EMAIL, password=HR_PASSWORD):
    return client.post("/api/auth/login", json={"email": email, "password": password})


class TestPasswords:
    def test_hash_is_not_the_password_and_differs_each_time(self):
        first, second = auth.hash_password("hunter2"), auth.hash_password("hunter2")

        assert "hunter2" not in first
        assert first != second  # random salt

    def test_verifies_only_the_right_password(self):
        stored = auth.hash_password("hunter2")

        assert auth.verify_password("hunter2", stored)
        assert not auth.verify_password("hunter3", stored)

    @pytest.mark.parametrize("junk", ["", "plain-text", "scrypt$1$2", "md5$16$8$1$aa$bb", "scrypt$x$8$1$aa$bb"])
    def test_malformed_stored_hash_is_rejected_not_crashed_on(self, junk):
        assert not auth.verify_password("anything", junk)


class TestTokens:
    def test_round_trip(self):
        assert auth.read_token(auth.create_token("a@b.com", JWT_SECRET), JWT_SECRET) == "a@b.com"

    def test_expired_token_is_rejected(self):
        long_ago = datetime.now(timezone.utc) - timedelta(days=2)

        assert auth.read_token(auth.create_token("a@b.com", JWT_SECRET, now=long_ago), JWT_SECRET) is None

    def test_token_signed_with_another_secret_is_rejected(self):
        assert auth.read_token(auth.create_token("a@b.com", "y" * 32), JWT_SECRET) is None

    def test_garbage_is_rejected(self):
        assert auth.read_token("not.a.token", JWT_SECRET) is None


class TestLogin:
    def test_returns_a_token_for_the_right_credentials(self, anonymous_client):
        response = login(anonymous_client)

        assert response.status_code == 200
        assert response.json()["email"] == HR_EMAIL

    def test_email_is_case_insensitive(self, anonymous_client):
        assert login(anonymous_client, email="HR@ACME.com").status_code == 200

    def test_wrong_password_and_unknown_user_get_the_same_answer(self, anonymous_client):
        wrong_password = login(anonymous_client, password="nope")
        unknown_user = login(anonymous_client, email="nobody@acme.com")

        assert wrong_password.status_code == unknown_user.status_code == 401
        assert wrong_password.json() == unknown_user.json()


class TestProtectedRoutes:
    @pytest.mark.parametrize(
        "path",
        [
            "/api/employees",
            "/api/employees/export.csv",
            "/api/employees/1",
            "/api/insights/summary",
            "/api/insights/breakdown?group_by=country",
            "/api/insights/distribution",
            "/api/meta",
            "/api/audit",
            "/api/auth/me",
        ],
    )
    def test_require_a_token(self, anonymous_client, path):
        assert anonymous_client.get(path).status_code == 401

    def test_writes_require_a_token(self, anonymous_client):
        assert anonymous_client.post("/api/employees", json=employee_payload()).status_code == 401
        assert anonymous_client.put("/api/employees/1", json=employee_payload()).status_code == 401
        assert anonymous_client.delete("/api/employees/1").status_code == 401

    def test_health_stays_public(self, anonymous_client):
        assert anonymous_client.get("/api/health").status_code == 200

    def test_a_valid_token_gets_in(self, client):
        assert client.get("/api/auth/me").json() == {"email": HR_EMAIL}

    def test_tampered_token_is_rejected(self, client):
        client.headers["Authorization"] = client.headers["Authorization"][:-3] + "abc"

        assert client.get("/api/employees").status_code == 401

    def test_other_auth_schemes_are_rejected(self, client):
        client.headers["Authorization"] = "Basic " + client.headers["Authorization"].split()[1]

        assert client.get("/api/employees").status_code == 401


class TestSetup:
    def test_no_user_exists_unless_one_is_configured(self):
        from fastapi.testclient import TestClient

        app = create_app(create_db_engine("sqlite:///:memory:"), jwt_secret=JWT_SECRET)

        assert login(TestClient(app)).status_code == 401

    def test_changing_the_configured_password_takes_effect_on_restart(self):
        from fastapi.testclient import TestClient

        engine = create_db_engine("sqlite:///:memory:")
        create_app(engine, jwt_secret=JWT_SECRET, hr_user=(HR_EMAIL, "old password"))
        restarted = TestClient(create_app(engine, jwt_secret=JWT_SECRET, hr_user=(HR_EMAIL, "new password")))

        assert login(restarted, password="old password").status_code == 401
        assert login(restarted, password="new password").status_code == 200

    def test_short_signing_secret_is_refused(self):
        with pytest.raises(RuntimeError):
            create_app(create_db_engine("sqlite:///:memory:"), jwt_secret="too short")
