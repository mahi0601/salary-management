import csv
import io

from app.csv_export import neutralise_formula


def parse(response):
    return list(csv.DictReader(io.StringIO(response.text)))


def test_exports_header_and_rows_with_usd_column(client, make_employee):
    make_employee(full_name="Grace Hopper", country="US", salary=150_000)

    response = client.get("/api/employees/export.csv")

    assert response.headers["content-type"].startswith("text/csv")
    assert "attachment" in response.headers["content-disposition"]
    [row] = parse(response)
    assert (row["full_name"], row["currency"], row["salary"], row["salary_usd"]) == (
        "Grace Hopper", "USD", "150000", "150000",
    )  # fmt: skip


def test_export_honours_filters(client, make_employee):
    make_employee(country="US")
    make_employee(country="IN")

    rows = parse(client.get("/api/employees/export.csv", params={"country": "IN"}))

    assert [r["country"] for r in rows] == ["IN"]


def test_export_is_not_capped_by_pagination(client, make_employee):
    for _ in range(60):
        make_employee()

    assert len(parse(client.get("/api/employees/export.csv"))) == 60


def test_formula_like_text_is_neutralised():
    assert neutralise_formula("=HYPERLINK(\"http://evil\")") == "'=HYPERLINK(\"http://evil\")"
    assert neutralise_formula("+1") == "'+1"
    assert neutralise_formula("Grace") == "Grace"
    assert neutralise_formula(150_000) == 150_000


def test_csv_quotes_commas_in_names(client, make_employee):
    make_employee(full_name="Hopper, Grace")

    [row] = parse(client.get("/api/employees/export.csv"))

    assert row["full_name"] == "Hopper, Grace"
