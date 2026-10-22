from datetime import date, timedelta

import pytest
from sqlalchemy import func, select

from app.models import SalaryChange
from tests.conftest import employee_payload

TODAY = date.today()


def day(days_ago: int) -> str:
    return (TODAY - timedelta(days=days_ago)).isoformat()


def history(client, employee_id):
    return client.get(f"/api/employees/{employee_id}/salary-history").json()


def record(client, employee_id, salary, effective, reason="Annual review"):
    return client.post(
        f"/api/employees/{employee_id}/salary-changes",
        json={"salary": salary, "effective_date": effective, "reason": reason},
    )


@pytest.fixture
def hired_long_ago(make_employee):
    return make_employee(country="US", salary=100_000, hire_date=day(1000))


class TestStartingRow:
    def test_creating_an_employee_records_the_starting_salary_on_the_hire_date(self, client, hired_long_ago):
        [first] = history(client, hired_long_ago["id"])

        assert (first["salary"], first["effective_date"], first["reason"]) == (
            100_000, day(1000), "Starting salary",
        )
        assert first["change_pct"] is None

    def test_unknown_employee_is_404(self, client):
        assert client.get("/api/employees/999/salary-history").status_code == 404
        assert record(client, 999, 1, day(1)).status_code == 404


class TestRecordingAChange:
    def test_a_raise_becomes_the_current_salary_and_shows_the_percentage(self, client, hired_long_ago):
        response = record(client, hired_long_ago["id"], 110_000, day(30), "Promotion")

        assert response.status_code == 201
        rows = response.json()
        assert [r["salary"] for r in rows] == [100_000, 110_000]
        assert rows[1]["change_pct"] == 10.0
        assert rows[1]["reason"] == "Promotion"
        assert client.get(f"/api/employees/{hired_long_ago['id']}").json()["salary"] == 110_000

    def test_history_is_ordered_by_effective_date_not_by_when_it_was_typed_in(self, client, hired_long_ago):
        record(client, hired_long_ago["id"], 120_000, day(10))
        record(client, hired_long_ago["id"], 110_000, day(200))

        assert [r["salary"] for r in history(client, hired_long_ago["id"])] == [100_000, 110_000, 120_000]

    def test_a_back_dated_change_does_not_touch_todays_salary(self, client, hired_long_ago):
        record(client, hired_long_ago["id"], 120_000, day(10))
        record(client, hired_long_ago["id"], 110_000, day(200))

        assert client.get(f"/api/employees/{hired_long_ago['id']}").json()["salary"] == 120_000

    def test_usd_value_uses_the_employees_currency(self, client, make_employee):
        indian = make_employee(country="IN", salary=2_000_000, hire_date=day(900))

        [row] = history(client, indian["id"])

        assert (row["currency"], row["salary_usd"]) == ("INR", 24_000)

    @pytest.mark.parametrize(
        "effective, expected_status",
        [
            (day(2000), 422),  # before the hire date
            ((TODAY + timedelta(days=1)).isoformat(), 422),  # future
            (day(1000), 409),  # same day as the starting salary
        ],
    )
    def test_rejects_bad_dates(self, client, hired_long_ago, effective, expected_status):
        assert record(client, hired_long_ago["id"], 150_000, effective).status_code == expected_status

    def test_rejects_a_second_change_on_the_same_day(self, client, hired_long_ago):
        record(client, hired_long_ago["id"], 110_000, day(30))

        assert record(client, hired_long_ago["id"], 120_000, day(30)).status_code == 409

    def test_rejects_a_change_that_changes_nothing(self, client, hired_long_ago):
        assert record(client, hired_long_ago["id"], 100_000, day(30)).status_code == 422

    @pytest.mark.parametrize("salary", [0, -5, 1.5])
    def test_rejects_invalid_salary(self, client, hired_long_ago, salary):
        assert record(client, hired_long_ago["id"], salary, day(30)).status_code == 422

    def test_rejects_blank_reason(self, client, hired_long_ago):
        assert record(client, hired_long_ago["id"], 110_000, day(30), reason="  ").status_code == 422

    def test_is_written_to_the_audit_log(self, client, hired_long_ago):
        record(client, hired_long_ago["id"], 110_000, day(30), "Promotion")

        latest = client.get("/api/audit").json()[0]

        assert latest["action"] == "salary_change"
        assert latest["details"]["salary"] == [100_000, 110_000]
        assert latest["details"]["reason"] == "Promotion"

    def test_needs_a_signed_in_user(self, anonymous_client):
        assert record(anonymous_client, 1, 1, day(1)).status_code == 401
        assert anonymous_client.get("/api/employees/1/salary-history").status_code == 401


class TestEditingTheEmployee:
    def update(self, client, employee, **overrides):
        body = employee_payload(
            email=employee["email"],
            full_name=employee["full_name"],
            country=employee["country"],
            hire_date=employee["hire_date"],
        )
        body["salary"] = employee["salary"]
        body.update(overrides)
        return client.put(f"/api/employees/{employee['id']}", json=body)

    def test_changing_the_salary_adds_a_row_effective_today(self, client, hired_long_ago):
        self.update(client, hired_long_ago, salary=130_000)

        rows = history(client, hired_long_ago["id"])

        assert [(r["effective_date"], r["salary"]) for r in rows] == [
            (day(1000), 100_000), (day(0), 130_000),
        ]

    def test_editing_twice_in_a_day_corrects_that_days_row(self, client, hired_long_ago):
        self.update(client, hired_long_ago, salary=130_000)
        self.update(client, hired_long_ago, salary=125_000)

        assert [r["salary"] for r in history(client, hired_long_ago["id"])] == [100_000, 125_000]

    def test_editing_other_fields_leaves_history_alone(self, client, hired_long_ago):
        self.update(client, hired_long_ago, job_title="Staff Engineer")

        assert len(history(client, hired_long_ago["id"])) == 1

    def test_moving_the_hire_date_moves_the_starting_row(self, client, hired_long_ago):
        body = {**hired_long_ago, "hire_date": day(1200)}
        client.put(f"/api/employees/{hired_long_ago['id']}", json=body)

        assert history(client, hired_long_ago["id"])[0]["effective_date"] == day(1200)

    def test_hire_date_cannot_jump_past_a_recorded_raise(self, client, hired_long_ago):
        record(client, hired_long_ago["id"], 110_000, day(300))
        body = {**hired_long_ago, "hire_date": day(100)}

        assert client.put(f"/api/employees/{hired_long_ago['id']}", json=body).status_code == 422


def test_deleting_an_employee_deletes_their_history(app, client, hired_long_ago):
    record(client, hired_long_ago["id"], 110_000, day(30))

    client.delete(f"/api/employees/{hired_long_ago['id']}")

    with app.state.session_factory() as session:
        assert session.scalar(select(func.count(SalaryChange.id))) == 0
