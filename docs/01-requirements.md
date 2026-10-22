# Salary Management: Requirements (one page)

**Persona:** HR Manager at ACME (10,000 employees, multiple countries). Today: Excel.

## Goal
Replace the spreadsheets with a web app where the HR Manager can (1) maintain employee salary
records quickly and safely, and (2) answer "how do we pay people?" without building pivot tables.

## Key questions the product must answer
- What is our total payroll and average/median pay, in one comparable currency?
- How does pay differ by **country**, **department** and **job title**? (min / P25 / median / P75 / max)
- Where are people in the salary distribution (bands)?
- Who is at the top or bottom of a given job title / country (outliers)?

## Scope: features
| # | Feature | Why |
|---|---------|-----|
| 1 | Employee CRUD (name, email, job title, department, country, annual salary, hire date) | Core replacement for the sheet |
| 2 | Searchable, filterable, sortable, **server-paginated** list (country, department, job title, salary range) | 10k rows must stay fast; HR looks people up constantly |
| 3 | Validation (positive salary, unique email, supported country, no future hire date) | Spreadsheets silently allow bad data; this is the main quality win |
| 4 | Salary in **local currency**; currency derived from country; USD-normalised for comparison | Multi-country payroll is meaningless without a common unit |
| 5 | Insights dashboard: headline KPIs, stats by country / department / job title, distribution chart | Answers the "how do we pay" questions |
| 6 | Seed script: 10,000 realistic synthetic employees | Demo and performance testing |
| 7 | CSV export of the current filtered view | HR still shares data with Finance; low-cost bridge off Excel |

## Deliberately left out (and why)
- **Authentication / roles / audit log**: single persona, take-home scope. In production this is the first
  addition because salary data is highly sensitive. The API is structured so auth drops in as a dependency.
- **Live FX rates**: static, documented rates in config. Live rates add an external dependency and
  non-determinism; insights are for comparison, not accounting.
- **Pay history / raises / bonuses / equity**: one current annual base salary per person. History is a
  natural v2 (effective-dated table) but doubles the model for no answer the HR Manager asked for.
- **Excel import**: would be needed for real migration, but the seed covers the demo and a robust importer
  (error reporting, dedupe) is a feature of its own.
- **Gender / demographic pay-equity analysis**: valuable, but sensitive data with legal implications; needs a
  deliberate privacy design, so it is excluded rather than half-built.
- **Payroll processing, tax, benefits, approvals/workflow**: different product.
- **Multi-tenant, i18n, mobile-specific UI**: not needed for one org's HR manager.

## Non-functional requirements
- List and insight endpoints respond in well under 500 ms at 10k rows (SQLite, indexed filters).
- Money stored as integers (whole units of local currency); no floating-point drift.
- Unit tests are fast (< 5 s total), deterministic (seeded RNG, in-memory DB) and readable.
- One-command local run and a single-container deployment.

## Assumptions (would be questions to the product owner)
1. One salary figure = **annual base**, in the local currency of the employee's country.
2. Email is the unique identifier for a person.
3. ~10 countries are enough to demonstrate the multi-country problem.
4. Terminated employees are deleted (no soft-delete) for this version.
