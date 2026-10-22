from datetime import date, datetime

import openpyxl
import pytest

from app import importer
from app.errors import ImportFileError
from tests.helpers import HEADER, csv_bytes, good_row, xlsx_bytes


def errors_of(parsed):
    return [(e.row, e.field) for e in parsed.errors]


class TestFormats:
    def test_reads_a_csv(self):
        parsed = importer.parse("people.csv", csv_bytes([good_row(1), good_row(2)]))

        assert parsed.total_rows == 2
        assert [e.email for _, e in parsed.employees] == ["person1@acme.com", "person2@acme.com"]
        assert parsed.errors == []

    def test_reads_an_xlsx_with_real_excel_cells(self):
        row = good_row(1, hire_date=datetime(2022, 3, 14), salary=120000.0)

        parsed = importer.parse("people.xlsx", xlsx_bytes([row]))

        [(_, employee)] = parsed.employees
        assert employee.hire_date == date(2022, 3, 14)  # a date cell, not text
        assert employee.salary == 120_000  # Excel stores whole numbers as floats

    def test_excel_csv_with_a_byte_order_mark_still_finds_the_first_column(self):
        parsed = importer.parse("people.csv", csv_bytes([good_row(1)], bom=True))

        assert parsed.errors == [] and len(parsed.employees) == 1

    def test_headers_are_case_and_space_insensitive_and_extra_columns_are_ignored(self):
        header = ["Full Name", "EMAIL", "Job Title", "Department", "Country", "Salary", "Hire Date", "Notes"]

        parsed = importer.parse("p.csv", csv_bytes([good_row(1) + ["whatever"]], header=header))

        assert len(parsed.employees) == 1

    def test_salary_typed_with_thousand_separators(self):
        content = b'full_name,email,job_title,department,country,salary,hire_date\nA B,a@b.com,T,D,US,"2,400,000",2022-01-01\n'

        [(_, employee)] = importer.parse("p.csv", content).employees

        assert employee.salary == 2_400_000

    def test_blank_rows_are_skipped_and_do_not_shift_row_numbers(self):
        rows = [good_row(1), [None] * 7, good_row(2, salary=-1)]

        parsed = importer.parse("p.xlsx", xlsx_bytes(rows))

        assert parsed.total_rows == 2
        assert errors_of(parsed) == [(4, "salary")]  # row 4 in Excel: header, row, blank, this one


class TestFileProblems:
    @pytest.mark.parametrize("name", ["people.xls", "people.txt", "people"])
    def test_wrong_extension(self, name):
        with pytest.raises(ImportFileError, match=r"\.xlsx or \.csv"):
            importer.parse(name, b"x")

    def test_missing_columns_are_named(self):
        content = csv_bytes([], header=["full_name", "email"])

        with pytest.raises(ImportFileError, match="Missing columns: job_title, department"):
            importer.parse("p.csv", content)

    def test_empty_file(self):
        with pytest.raises(ImportFileError, match="empty"):
            importer.parse("p.csv", b"")

    def test_not_really_an_xlsx(self):
        with pytest.raises(ImportFileError, match="not a valid .xlsx"):
            importer.parse("p.xlsx", b"this is not a zip file")

    def test_csv_that_is_not_utf8(self):
        with pytest.raises(ImportFileError, match="UTF-8"):
            importer.parse("p.csv", b"\xff\xfe\x00bad")

    def test_oversize_file(self):
        with pytest.raises(ImportFileError, match="larger than"):
            importer.parse("p.csv", b"x" * (importer.MAX_BYTES + 1))

    def test_too_many_rows(self, monkeypatch):
        monkeypatch.setattr(importer, "MAX_ROWS", 3)

        with pytest.raises(ImportFileError, match="More than 3"):
            importer.parse("p.csv", csv_bytes([good_row(n) for n in range(1, 6)]))

    def test_defusedxml_is_active_so_malicious_xml_cannot_blow_up(self):
        assert openpyxl.xml.DEFUSEDXML is True


class TestRowValidation:
    def test_reports_every_problem_with_its_row_and_field(self):
        rows = [
            good_row(1),
            good_row(2, email="not-an-email", salary=0),
            good_row(3, country="ZZ", hire_date="2999-01-01"),
        ]

        parsed = importer.parse("p.csv", csv_bytes(rows))

        assert errors_of(parsed) == [(3, "email"), (3, "salary"), (4, "country"), (4, "hire_date")]
        assert len(parsed.employees) == 1

    def test_missing_value_is_reported_as_a_blank_field(self):
        parsed = importer.parse("p.csv", csv_bytes([good_row(1, job_title="")]))

        assert errors_of(parsed) == [(2, "job_title")]

    def test_duplicate_email_inside_the_file_points_at_the_first_row(self):
        rows = [good_row(1), good_row(2, email="PERSON1@acme.com")]

        parsed = importer.parse("p.csv", csv_bytes(rows))

        [error] = parsed.errors
        assert (error.row, error.field, error.message) == (3, "email", "Same email as row 2")

    def test_template_is_itself_a_valid_import(self):
        parsed = importer.parse("t.csv", importer.TEMPLATE_CSV.encode())

        assert parsed.errors == [] and len(parsed.employees) == 1
        assert importer.TEMPLATE_CSV.splitlines()[0].split(",") == HEADER


class TestPlainMessages:
    def message(self, **override):
        parsed = importer.parse("p.csv", csv_bytes([good_row(1, **override)]))
        [error] = parsed.errors
        return error.message

    def test_blank_cell(self):
        assert self.message(job_title="") == "Required"

    def test_salary_that_is_not_a_number(self):
        assert self.message(salary="lots") == "Must be a whole number, like 120000"

    def test_salary_with_decimals(self):
        assert self.message(salary="1200.5") == "Must be a whole number, like 120000"

    def test_zero_or_negative_salary(self):
        assert self.message(salary=-5) == "Must be a whole number above 0"

    def test_unparseable_date(self):
        assert self.message(hire_date="last spring") == "Use a date like 2023-05-01"

    def test_bad_email(self):
        assert self.message(email="nope") == "Not a valid email address"

    def test_unknown_country_lists_the_valid_codes(self):
        message = self.message(country="ZZ")

        assert message == "Unsupported country; use one of AU, BR, CA, DE, FR, GB, IN, JP, SG, US"

    def test_future_hire_date(self):
        assert self.message(hire_date="2999-01-01") == "Hire date cannot be in the future"
