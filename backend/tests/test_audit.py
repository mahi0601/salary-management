from tests.conftest import HR_EMAIL, employee_payload


def entries(client, **params):
    return client.get("/api/audit", params=params).json()


def test_create_is_recorded_with_who_did_it(client, make_employee):
    created = make_employee(salary=100_000, country="US")

    [entry] = entries(client)

    assert (entry["action"], entry["employee_id"], entry["actor"]) == ("create", created["id"], HR_EMAIL)
    assert entry["details"]["salary"] == 100_000


def test_update_records_only_the_fields_that_changed(client, make_employee):
    created = make_employee(salary=100_000, country="US", job_title="Engineer")
    body = employee_payload(
        email=created["email"], full_name=created["full_name"], salary=120_000, country="US", job_title="Engineer"
    )

    client.put(f"/api/employees/{created['id']}", json=body)

    update = entries(client, employee_id=created["id"])[0]
    assert update["action"] == "update"
    assert update["details"] == {"salary": [100_000, 120_000]}


def test_saving_without_changes_writes_nothing(client, make_employee):
    created = make_employee(country="US")
    body = employee_payload(
        email=created["email"], full_name=created["full_name"], salary=created["salary"], country="US"
    )

    client.put(f"/api/employees/{created['id']}", json=body)

    assert [e["action"] for e in entries(client)] == ["create"]


def test_delete_is_recorded_and_outlives_the_employee(client, make_employee):
    created = make_employee(salary=90_000, country="US")

    client.delete(f"/api/employees/{created['id']}")

    latest = entries(client)[0]
    assert (latest["action"], latest["employee_id"]) == ("delete", created["id"])
    assert latest["details"]["salary"] == 90_000


def test_failed_requests_leave_no_trace(client, make_employee):
    make_employee(email="taken@acme.com")

    client.post("/api/employees", json=employee_payload(email="taken@acme.com"))

    assert [e["action"] for e in entries(client)] == ["create"]


def test_newest_first_and_limit(client, make_employee):
    for _ in range(3):
        make_employee()

    assert len(entries(client, limit=2)) == 2
    assert entries(client)[0]["id"] > entries(client)[-1]["id"]
