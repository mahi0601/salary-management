# How AI was used

**Tooling:** Claude Code (agentic coding assistant) in the terminal/VS Code, working directly in this repo.
AI assistance is disclosed here as the assessment requests.

## Workflow
1. **Frame first.** The assessment brief was given to the assistant as the starting prompt. Before any
   code, the one-page requirements (`01-requirements.md`) fixed scope, exclusions and assumptions.
2. **Backend, test-first slices**, each committed separately: CRUD and validation -> seed -> pure
   statistics -> insights API -> CSV export. Each slice was run against the tests before moving on.
3. **Verify against reality, not just tests.** The seeded 10k database was queried for timing, the built
   UI was served by the API, and both screens were rendered in headless Chrome and inspected.
4. **Review pass on AI output** for things generators commonly get wrong: money as float, sorting
   across currencies, pagination instability with tied sort keys, CSV injection, static-file path
   traversal. Each has a test.

## Prompts / instructions used
Prompts given to the assistant, in order (paraphrased lightly, none omitted):
1. The assessment PDF and the invitation email, with the instruction "finish it correctly".
2. Follow-up: review the code so it reads like a senior developer wrote it (short, plain,
   human comments; sensible names), and host it. Result: comment pass in `refactor: tighten comments`.
3. Hosting choices (GitHub public repo, Render) were answered when the assistant asked.
4. Commit attribution lines were removed at my request; this document is the disclosure instead.
5. Final request: re-check the PDF against the repo and track what is done (checklist in the README).

Standing constraints applied: match the surrounding code style, keep routers thin, prefer pure
functions for logic, tests must be fast and deterministic, commit in small steps.

## Where human judgment is required
- The assumptions in `01-requirements.md` (annual base salary, email as identity, static FX) are
  product decisions that I would confirm with the stakeholder; the assessment invites questions.
- Anything deployed or demoed (hosting account, demo video) is done by me, not generated.
