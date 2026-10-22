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
- Initial prompt: the assessment document plus "finish it correctly".
- Standing constraints I applied to the assistant: match the surrounding code style, keep routers
  thin, prefer pure functions for logic, tests must be fast and deterministic, commit in small steps.

## Where human judgment is required
- The assumptions in `01-requirements.md` (annual base salary, email as identity, static FX) are
  product decisions that I would confirm with the stakeholder; the assessment invites questions.
- Anything deployed or demoed (hosting account, demo video) is done by me, not generated.
