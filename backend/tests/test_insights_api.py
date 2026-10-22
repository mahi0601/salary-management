def test_summary_is_null_when_no_employees(client):
    assert client.get("/api/insights/summary").json() == {"stats": None}


def test_summary_normalises_currencies_to_usd(client, make_employee):
    make_employee(country="US", salary=100_000)
    make_employee(country="IN", salary=5_000_000)  # 60,000 USD

    stats = client.get("/api/insights/summary").json()["stats"]

    assert stats["headcount"] == 2
    assert stats["total_usd"] == 160_000
    assert stats["average_usd"] == 80_000
    assert (stats["min_usd"], stats["max_usd"]) == (60_000, 100_000)


def test_summary_respects_filters(client, make_employee):
    make_employee(country="US", department="Sales", salary=100_000)
    make_employee(country="US", department="Engineering", salary=200_000)

    stats = client.get("/api/insights/summary", params={"department": "Sales"}).json()["stats"]

    assert (stats["headcount"], stats["median_usd"]) == (1, 100_000)


def test_breakdown_by_country_orders_by_headcount(client, make_employee):
    make_employee(country="IN", salary=5_000_000)
    make_employee(country="US", salary=100_000)
    make_employee(country="US", salary=120_000)

    rows = client.get("/api/insights/breakdown", params={"group_by": "country"}).json()

    assert [r["key"] for r in rows] == ["US", "IN"]
    assert rows[0]["average_usd"] == 110_000
    assert rows[0]["headcount"] == 2


def test_breakdown_by_job_title_can_be_scoped_to_one_country(client, make_employee):
    make_employee(country="US", job_title="Software Engineer", salary=150_000)
    make_employee(country="IN", job_title="Software Engineer", salary=5_000_000)
    make_employee(country="US", job_title="QA Engineer", salary=90_000)

    rows = client.get(
        "/api/insights/breakdown", params={"group_by": "job_title", "country": "US"}
    ).json()

    assert {r["key"]: r["median_usd"] for r in rows} == {
        "Software Engineer": 150_000,
        "QA Engineer": 90_000,
    }


def test_breakdown_rejects_unknown_grouping(client):
    assert client.get("/api/insights/breakdown", params={"group_by": "email"}).status_code == 422


def test_distribution_returns_bands_in_usd(client, make_employee):
    make_employee(country="US", salary=30_000)
    make_employee(country="US", salary=60_000)
    make_employee(country="IN", salary=5_000_000)  # 60,000 USD

    bands = client.get("/api/insights/distribution", params={"bucket_size": 25_000}).json()

    assert bands == [
        {"from_usd": 0, "to_usd": 25_000, "count": 0},
        {"from_usd": 25_000, "to_usd": 50_000, "count": 1},
        {"from_usd": 50_000, "to_usd": 75_000, "count": 2},
    ]


def test_distribution_rejects_tiny_buckets(client):
    assert client.get("/api/insights/distribution", params={"bucket_size": 1}).status_code == 422
