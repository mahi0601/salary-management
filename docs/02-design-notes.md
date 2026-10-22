# Design notes & trade-offs

## Architecture

See the diagrams in the [README](../README.md#architecture): system and deployment, backend
layers, request flows, data model and the scalability target.

| Layer | Responsibility | Why separate |
|-------|----------------|--------------|
| `routers/` | HTTP shape: params, status codes | Thin; no business rules |
| `schemas.py` | Input validation (Pydantic) | One definition of "valid employee" |
| `services.py` | Duplicate-email rule, create/update/delete | Testable rules, domain errors -> HTTP in one handler |
| `repository.py` | Filtering, sorting, pagination SQL | Filters are shared by list, export and insights |
| `insights.py` | Percentiles, grouping, histogram | Pure functions: unit-tested without a DB |
| `seed.py` | Deterministic data generation | Same seed => same data; tests rely on that |

## Key decisions

1. **Money as integers in local currency.** No float drift; the currency is derived from the country so
   it can never disagree with it. USD is a *derived view* (static rates in `countries.py`).
2. **USD normalisation happens in SQL for sort/filter** (a `CASE` on country in `models.py`) so "sort by
   salary" and "min salary" are meaningful across countries. Sorting raw local amounts would put 3M INR
   (~$36K) above 100K GBP (~$127K).
3. **Insights are computed in Python from a narrow 4-column select**, not SQL aggregates. SQLite has no
   median/percentile, and the dataset is 10k rows; doing it in Python keeps the logic simple and unit
   testable. See "Scaling" below for when this stops being right.
4. **Median and quartiles, not just average.** HR questions are about "typical" pay; averages are skewed
   by a few executives.
5. **Server-side pagination, filtering and sorting.** 10k rows in the browser would be slow and wasteful;
   the API caps `page_size` at 200. A stable `id` tie-breaker prevents rows repeating across pages.
6. **CSV export is streamed** and neutralises formula-leading cells (`=`, `+`, `-`, `@`) because the
   export is meant to be opened in Excel.
7. **One deployable.** FastAPI serves the built React app, so there is one container, one origin and no
   CORS configuration.
8. **App factory (`create_app(engine)`)** lets every test get a fresh in-memory database; the whole backend
   suite runs in about two seconds.
9. **Login is a signed token, checked in one place.** One dependency (`deps.current_user`) is attached to every
   router except health and login, so a new route is protected by default. Passwords use scrypt with the cost
   stored in the hash (it can be raised later without locking anyone out). Login answers identically for an
   unknown user and a wrong password and does the same hashing work for both. The signing secret must be 32+
   characters; Render generates it. The token lives in `sessionStorage`: a script injected into the page could
   read it, which is why the page has no user-supplied HTML.
10. **Pay history keeps the current salary on the employee.** `salary_changes` is the record of truth and
    `employees.salary` is its latest row, so lists, sorting and insights do not join. One change per employee per
    day (a database constraint as well as a check), dates between hire date and today. A back-dated change
    leaves today's pay alone. Editing the salary on the employee form counts as a change effective today.
11. **Import is all-or-nothing and checks first.** The file is parsed and validated by a pure module, every row
    problem is reported with row and column in plain words, and saving happens in one transaction. The upload is
    the raw request body, which avoids a multipart dependency; limits are 5 MB and 20,000 rows. Uploaded XML is
    read through `defusedxml` because `openpyxl` does not guard against malicious XML by itself.
12. **Audit rows are written in the same transaction as the change**, so a change cannot exist without its audit
    row. The log has no foreign key to the employee, so it survives deletion.

## Performance (10,000 rows, local, SQLite)

Measured with the FastAPI test client against the seeded database:

| Call | Time |
|------|------|
| Seed 10,000 employees + 22,490 history rows (bulk insert) | ~0.7 s |
| List page (50 rows) | ~3 ms |
| List filtered + sorted by USD salary | ~4 ms |
| Name search | ~11 ms |
| Insights summary / breakdown | ~26 ms |
| One employee's salary history | ~3 ms |
| Import 20,000-row .xlsx: check only / check and save | ~2.4 s / ~4.6 s |

(Warm calls, best of a few runs, on a laptop. The first request after start is slower.) The history tables did
not change list or insight times because those endpoints read only `employees`.

Indexes exist on country, department, job title and name. The name search uses `LIKE '%x%'`, which
cannot use an index; at 10k rows it is a trivial scan.

## Scaling: what I would change first
- **SSO with roles** in place of the single local login (login and audit log exist today).
- **>~500k rows:** move to Postgres, compute percentiles with `percentile_cont`, add a `salary_usd`
  column (or materialised view) maintained on write, and use keyset pagination instead of `OFFSET`.
- **Live FX / historical rates:** store the rate used per snapshot so past reports are reproducible.
- **Large imports:** move the parse-and-save into a background job and poll for the report; today a 20,000-row
  file runs inside one request (about 5 s).

## Testing approach
- **Backend (175 tests, 96% statement coverage, CI fails under 85%):** API tests through `TestClient` with an
  in-memory database, written as behaviour ("salary range filter compares in USD, not local currency", "a
  back-dated raise does not change today's salary", "one bad import row saves nothing"); pure-function tests for
  statistics, the importer and seed determinism; security tests for path traversal in static serving, CSV
  formula injection, unauthenticated access to every route, expired and tampered tokens. Password hashing is
  made cheap in tests so building an app costs nothing.
- **Frontend (74 tests, 87% statement coverage, CI fails under 80%):** Vitest + Testing Library with the API
  layer mocked: validation rules, API error mapping and token handling, and the user flows (sign in and out,
  sort, create / edit / delete, salary history, import check and import, insights grouping, dark mode).
- Deterministic: seeded RNG, fixed dates passed in, no network, no sleeps.
