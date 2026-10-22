import pytest

from tests.helpers import csv_bytes, good_row, xlsx_bytes


def upload(client, content, filename="people.csv", dry_run=True):
    return client.post(
        "/api/employees/import",
        params={"filename": filename, "dry_run": dry_run},
        content=content,
        headers={"Content-Type": "application/octet-stream"},
    )


def count(client):
    return client.get("/api/employees").json()["total"]


def test_dry_run_checks_the_file_but_saves_nothing(client):
    response = upload(client, csv_bytes([good_row(1), good_row(2)]), dry_run=True)

    body = response.json()
    assert (body["total_rows"], body["valid_rows"], body["error_count"], body["created"]) == (2, 2, 0, 0)
    assert count(client) == 0


def test_import_creates_the_employees_with_their_starting_salary(client):
    body = upload(client, xlsx_bytes([good_row(1), good_row(2)]), "people.xlsx", dry_run=False).json()

    assert body["created"] == 2
    [first] = client.get("/api/employees", params={"search": "person1@"}).json()["items"]
    [start] = client.get(f"/api/employees/{first['id']}/salary-history").json()
    assert (start["salary"], start["effective_date"], start["reason"]) == (100_000, "2022-03-14", "Starting salary")


def test_one_bad_row_means_nothing_is_saved(client):
    rows = [good_row(1), good_row(2), good_row(3, salary=-5)]

    body = upload(client, csv_bytes(rows), dry_run=False).json()

    assert (body["created"], body["error_count"], body["valid_rows"]) == (0, 1, 2)
    assert body["errors"] == [{"row": 4, "field": "salary", "message": body["errors"][0]["message"]}]
    assert count(client) == 0


def test_email_already_in_the_database_is_reported(client, make_employee):
    make_employee(email="person1@acme.com")

    body = upload(client, csv_bytes([good_row(1), good_row(2)]), dry_run=False).json()

    assert body["created"] == 0
    assert [(e["row"], e["field"]) for e in body["errors"]] == [(2, "email")]
    assert "already exists" in body["errors"][0]["message"]
    assert count(client) == 1


def test_only_the_first_hundred_errors_are_listed_but_all_are_counted(client):
    rows = [good_row(n, salary=-1) for n in range(1, 151)]

    body = upload(client, csv_bytes(rows)).json()

    assert body["error_count"] == 150
    assert len(body["errors"]) == 100


def test_import_is_written_to_the_audit_log_once(client):
    upload(client, csv_bytes([good_row(n) for n in range(1, 6)]), "march.csv", dry_run=False)

    entries = client.get("/api/audit").json()

    assert [(e["action"], e["details"]) for e in entries] == [("import", {"file": "march.csv", "created": 5})]


def test_bad_file_is_a_422_with_a_readable_message(client):
    response = upload(client, b"nope", "people.pdf")

    assert response.status_code == 422
    assert ".xlsx or .csv" in response.json()["detail"]


def test_oversize_upload_is_rejected_by_its_declared_size(client):
    response = upload(client, b"x" * (5 * 1024 * 1024 + 1))

    assert response.status_code == 413


def test_needs_a_signed_in_user(anonymous_client):
    assert upload(anonymous_client, csv_bytes([good_row(1)])).status_code == 401
    assert anonymous_client.get("/api/employees/import-template.csv").status_code == 401


def test_template_downloads_as_csv_and_is_not_swallowed_by_the_id_route(client):
    response = client.get("/api/employees/import-template.csv")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    assert response.text.startswith("full_name,email,")


@pytest.mark.parametrize("dry_run", [True, False])
def test_the_template_imports_cleanly(client, dry_run):
    template = client.get("/api/employees/import-template.csv").content

    assert upload(client, template, dry_run=dry_run).json()["error_count"] == 0
