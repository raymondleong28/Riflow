# AGENTS.md — R-PRM: Kiflo parity build

> Instruction file for Google Antigravity. Place at the repo root (Antigravity loads `AGENTS.md` automatically).
> Written 24 Nov 2026 from a live audit of R-PRM (`localhost:3000`) against Eber's Kiflo account (`app.kiflo.com`, account 68128177).
> Owner: Ray (Regional Head of Partnerships, Eber). Ray approves every gate and every ship.

- **Current priorities live in §14** (latest), then §13. Where a later section differs from an earlier one, the later section wins.
- See `docs/SPEC.md`, `docs/DECISIONS.md`, `docs/DATA-SAFETY.md`, `docs/DOMAIN.md`, `docs/ENVIRONMENT.md`, `docs/HANDOFF.md`, `docs/GO-LIVE.md`, and `docs/reference/kiflo-teardown.md`.

## §14.2 Third Audit Slices (24 Nov 2026, 15:51)
1. Remove the accidental preset reward ("SGD 1,000 Quarterly Quota Accelerator Bonus" from Silver Tier of `prog-strategic`) from DB, seed scripts, fixtures, sync scripts, and write DELETE audit log entry.
2. Partners see only their own program and level (`/api/programs` and any partner-facing payload returns only 1 program containing only the partner's own level).
3. Switch database from SQLite (`prisma/dev.db`) to Postgres running locally (stop and ask if Docker/Postgres is unavailable).
4. Payout schedule as a setting per account and per program (monthly or quarterly + threshold) with fixture test.
5. Test logins hidden outside local (`NODE_ENV !== 'production'` AND `SHOW_DEV_LOGINS=true`), plus `docs/GO-LIVE.md` blocker.
6. Prove onboarding actions per stage (all 6 types, stage completion & validation gates), all 9 Deal settings save & reload, MFA (enrolling, valid code, invalid code, one-time recovery code), scheduler (Day 2 & Day 5 reminders + Day 7 task, jobs survive restart), and connectors (each `live` driver without settings refuses to start).
