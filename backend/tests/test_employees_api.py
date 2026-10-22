from datetime import date, timedelta

import pytest

from tests.conftest import employee_payload


class TestCreate:
    def test_creates_employee_and_derives_currency_and_usd(self, client):
        response = client.post("/api/employees", json=employee_payload())

        assert response.status_code == 201
        body = response.json()
        assert body["currency"] == "INR"
        assert body["salary"] == 2_400_000
        assert body["salary_usd"] == 28_800  # 2.4M INR * 0.012

    def test_normalises_email_and_country_case(self, client):
        response = client.post(
            "/api/employees", json=employee_payload(email="  Asha.RAO@Acme.com ", country="in")
        )

        assert response.json()["email"] == "asha.rao@acme.com"
        assert response.json()["country"] == "IN"

    def test_rejects_duplicate_email_case_insensitively(self, client):
        client.post("/api/employees", json=employee_payload())

        response = client.post("/api/employees", json=employee_payload(email="ASHA.RAO@acme.com"))

        assert response.status_code == 409

    @pytest.mark.parametrize(
        "overrides",
        [
            {"salary": 0},
            {"salary": -5},
            {"salary": 1.5},
            {"country": "ZZ"},
            {"email": "not-an-email"},
            {"full_name": "   "},
            {"hire_date": (date.today() + timedelta(days=1)).isoformat()},
        ],
    )
    def test_rejects_invalid_input(self, client, overrides):
        response = client.post("/api/employees", json=employee_payload(**overrides))

        assert response.status_code == 422


class TestReadUpdateDelete:
    def test_get_returns_404_for_unknown_id(self, client):
        assert client.get("/api/employees/999").status_code == 404

    def test_update_replaces_fields(self, client, make_employee):
        created = make_employee()

        response = client.put(
            f"/api/employees/{created['id']}",
            json=employee_payload(email=created["email"], salary=3_000_000, job_title="Staff Engineer"),
        )

        assert response.status_code == 200
        assert response.json()["salary"] == 3_000_000
        assert client.get(f"/api/employees/{created['id']}").json()["job_title"] == "Staff Engineer"

    def test_update_may_keep_own_email_but_not_take_anothers(self, client, make_employee):
        first = make_employee(email="a@acme.com")
        second = make_employee(email="b@acme.com")

        keep = client.put(f"/api/employees/{first['id']}", json=employee_payload(email="a@acme.com"))
        steal = client.put(f"/api/employees/{second['id']}", json=employee_payload(email="a@acme.com"))

        assert keep.status_code == 200
        assert steal.status_code == 409

    def test_update_unknown_id_is_404(self, client):
        assert client.put("/api/employees/999", json=employee_payload()).status_code == 404

    def test_delete_removes_employee(self, client, make_employee):
        created = make_employee()

        assert client.delete(f"/api/employees/{created['id']}").status_code == 204
        assert client.get(f"/api/employees/{created['id']}").status_code == 404

    def test_delete_unknown_id_is_404(self, client):
        assert client.delete("/api/employees/999").status_code == 404


class TestList:
    def test_paginates_and_reports_total(self, client, make_employee):
        for _ in range(5):
            make_employee()

        page = client.get("/api/employees", params={"page": 2, "page_size": 2}).json()

        assert page["total"] == 5
        assert len(page["items"]) == 2
        assert page["page"] == 2

    def test_pages_do_not_overlap_when_sort_values_tie(self, client, make_employee):
        for _ in range(5):
            make_employee(department="Sales")  # identical sort key

        params = {"sort_by": "department", "page_size": 2}
        seen = [
            e["id"]
            for p in (1, 2, 3)
            for e in client.get("/api/employees", params={**params, "page": p}).json()["items"]
        ]

        assert len(seen) == len(set(seen)) == 5

    def test_filters_by_country_department_and_title(self, client, make_employee):
        make_employee(country="US", department="Sales", job_title="Account Executive")
        make_employee(country="US", department="Engineering", job_title="Software Engineer")
        make_employee(country="IN", department="Engineering", job_title="Software Engineer")

        def total(**params):
            return client.get("/api/employees", params=params).json()["total"]

        assert total(country="US") == 2
        assert total(country="us", department="Engineering") == 1
        assert total(job_title="Software Engineer") == 2

    def test_search_matches_name_or_email_case_insensitively(self, client, make_employee):
        make_employee(full_name="Grace Hopper", email="grace@acme.com")
        make_employee(full_name="Alan Turing", email="alan@acme.com")

        by_name = client.get("/api/employees", params={"search": "HOPPER"}).json()
        by_email = client.get("/api/employees", params={"search": "alan@"}).json()

        assert [e["full_name"] for e in by_name["items"]] == ["Grace Hopper"]
        assert [e["full_name"] for e in by_email["items"]] == ["Alan Turing"]

    def test_salary_range_filter_compares_in_usd_not_local_currency(self, client, make_employee):
        make_employee(country="IN", salary=5_000_000)  # 60,000 USD
        make_employee(country="US", salary=90_000)  # 90,000 USD

        page = client.get("/api/employees", params={"min_salary_usd": 70_000}).json()

        assert [e["country"] for e in page["items"]] == ["US"]

    def test_sorts_by_usd_salary_descending(self, client, make_employee):
        make_employee(country="JP", salary=20_000_000)  # 134,000 USD
        make_employee(country="US", salary=100_000)
        make_employee(country="IN", salary=9_000_000)  # 108,000 USD

        page = client.get("/api/employees", params={"sort_by": "salary_usd", "order": "desc"}).json()

        assert [e["country"] for e in page["items"]] == ["JP", "IN", "US"]

    def test_rejects_unknown_sort_field(self, client):
        assert client.get("/api/employees", params={"sort_by": "password"}).status_code == 422

    def test_rejects_oversized_page(self, client):
        assert client.get("/api/employees", params={"page_size": 5000}).status_code == 422


class TestMeta:
    def test_lists_countries_and_distinct_values(self, client, make_employee):
        make_employee(department="Sales", job_title="Account Executive")
        make_employee(department="Sales", job_title="Sales Manager")

        meta = client.get("/api/meta").json()

        assert {c["code"] for c in meta["countries"]} >= {"US", "IN", "JP"}
        assert meta["departments"] == ["Sales"]
        assert meta["job_titles"] == ["Account Executive", "Sales Manager"]
