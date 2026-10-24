# Travel Photo Journal

Backend developer assessment submission. Monorepo of two independent packages (each with its own dependencies and tooling): `backend` (Express + TS + Prisma) and `frontend` (Next.js, `src/`). Docs in `docs/`.

## Working rules

- Work in phases; after each phase, stop, summarize in a few lines, wait for "next".
- Teach as building: 2-4 sentences before each file/concept (what + why over the alternative).
- Strict TypeScript, no `any`, small functions. Comments only where the "why" is non-obvious.
- Never mention AI assistance in code, comments, commits, PRs, README or docs. No attribution trailers. Summary generation is documented neutrally as "summary generation via OpenRouter".
- Never print, log or commit secrets. The user fills `.env` themselves.
- Conventional commits. Tailwind utility classes only for styling.
- `.claude/` and `AGENTS.md` are gitignored.

## Agent skills

### Issue tracker

GitHub Issues via `gh`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-label vocabulary. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `docs/CONTEXT.md` + `docs/adr/`. See `docs/agents/domain.md`.
