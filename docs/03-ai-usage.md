# How AI was used

**Tool:** Claude Code (an agentic coding assistant) working directly in this repository, from the terminal and
VS Code. It wrote most of the code and documents; the prompts, scope decisions and acceptance were mine to give.
AI assistance is disclosed here because the assessment asks for it.

## Working method
1. **Frame first.** The assessment brief and invitation email went in as the first prompt. Before code, the
   assistant wrote the one-page requirements (`01-requirements.md`): scope, exclusions, assumptions.
2. **Small vertical slices, each committed on its own:** CRUD and validation, seed, pure statistics, insights
   API, CSV export, UI, deployment files, docs. Later: login, pay history, import. Each slice ran its tests before
   the next one started.
3. **Check against the running thing, not just the tests:** the seeded 10,000-row database was timed, the built
   UI was served by the API and driven in headless Chrome (including signing in), screenshots were read, the
   deployed site was probed with `curl`.
4. **Look for the usual AI mistakes** and write a test for each: money as float, sorting across currencies,
   pagination that repeats rows, CSV formula injection, static-file path traversal, auth that is only in the
   browser, and uploads that load everything into memory.

## Prompt log
Condensed, in order. Everything the assistant was asked to do is listed.

| # | What I asked | What the assistant did | Result in the repo |
|---|--------------|------------------------|--------------------|
| 1 | Assessment PDF + invitation email: "finish it correctly" | Chose FastAPI + SQLite + React/MUI; wrote requirements, API, seed, insights, UI, tests, Docker/CI | Commits `docs: requirements` through `docs: README` |
| 2 | Make the code look human-written (plain, short comments, like a 20-year developer); host it | Rewrote comments to explain why, removed formatter markers; created the GitHub repo; prepared Render config | `refactor: tighten comments` |
| 3 | What to fill in on the Render blueprint page | Explained the form fields | Deployed |
| 4 | Remove the Claude commits | Rewrote history to drop the assistant's co-author lines (a force-push); code untouched | This document is the disclosure instead |
| 5 | Check the PDF again and track what is done | Audited each requirement against the repo, CI and live site | Test counts and docs corrected |
| 6 | Change the UI a bit more | Dark mode, loading bar, result count, clear filters, avatars, toasts, richer cards | `ui: dark mode, ...` |
| 7 | Is the repo and deployment ready to send? | Checked GitHub, CI and the live URL | README links the live site |
| 8 | Demo-video script, then rewrites in plainer spoken language; how to explain the diagram | Wrote and rewrote a script and a diagram walkthrough | The script is for recording only and is not in the repo |
| 9 | Draw architecture and flow diagrams in the README; think about scalability | Nine Mermaid diagrams (all rendered locally to check them), a scalability table and a target architecture | README "Architecture" and "Scalability" |
| 10 | "Any more things to add?" then: add the worthwhile ones and the optional ones too | Coverage numbers and CI floors; tests for the insights page, app shell and employee form; this log; screenshots; and the features below | Commits from `build: coverage tooling` on |
| 11 | (part of 10) Login with a demo account in the README; requirements doc gets a "Revision 2" section | Scrypt + JWT login, protected routes, audit log, login page | `feat(auth)`, `feat(ui): login page` |
| 12 | (part of 10) Pay history and Excel/CSV import | Effective-dated salary changes with rules and seeded history; import with dry run, row-level errors, all-or-nothing save | `feat(history)`, `feat(import)` and their UI commits |

## Mistakes the assistant made and how they were caught
- **A file edit truncated `deps.py`** (it opened the file for writing before reading it). Caught immediately by an
  import error; restored from git and redone.
- **A CSV "Export" link would have stopped working once login existed**, because a plain link cannot send the
  `Authorization` header. Found by thinking through the login change before shipping; export now downloads
  through `fetch`.
- **Import loaded every spreadsheet row into memory before applying the row limit.** Found in review; the parser
  now streams and stops at the limit.
- **A message-cleanup helper lowercased country codes** (`'us'` instead of `'US'`). Caught by a test written for
  that exact message.
- **Screenshots first came out in dark mode** because headless Chrome reports a dark system theme; the script now
  forces light mode for the main shots.

## Where human judgment still matters
- The assumptions in `01-requirements.md` (annual base pay, email as identity, fixed exchange rates, one HR login)
  are product decisions to confirm with the people who own them. The invitation says to ask rather than assume.
- The demo password is public on purpose because the data is synthetic. A real deployment would use a secret and
  SSO.
- Hosting, the demo video and the reply email are mine to do.
