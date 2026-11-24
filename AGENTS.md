# AGENTS.md — R-PRM: Kiflo parity build

> Instruction file for Google Antigravity. Place at the repo root (Antigravity loads `AGENTS.md` automatically).
> Written 24 Nov 2026 from a live audit of R-PRM (`localhost:3000`) against Eber's Kiflo account (`app.kiflo.com`, account 68128177).
> Owner: Ray (Regional Head of Partnerships, Eber). Ray approves every gate and every ship.

- **Current priorities live in §13** (local-complete build and the 24 Nov re-audit). Where §13 differs from earlier sections, §13 wins.
- See `docs/SPEC.md`, `docs/DECISIONS.md`, `docs/DATA-SAFETY.md`, `docs/DOMAIN.md`, `docs/ENVIRONMENT.md`, `docs/HANDOFF.md`, `docs/GO-LIVE.md`, and `docs/reference/kiflo-teardown.md`.

## §13.7 Slice Order (Local-Complete Build — 24 Nov 2026)
1. One source of truth (retire `/api/prm` in favor of unified store + per-object endpoints)
2. Real auth, sessions and admin-assigned roles; server-side scoping on every API
3. Audit log writes on every create/update/delete
4. Reward generation from partner tier level rules + fixtures (Apex Platinum 25% + 5% kickback on SGD 28,500 -> SGD 7,125 and SGD 1,425)
5. Lead form unguessable token, invalid-link page ("This link isn't valid"), Eber General Terms 7.2 consent checkbox
6. Onboarding actions attached per individual stage; all 9 Deal settings options (including channel-conflict detection for deals, deal resubmission, associate customers automatically); scrub internal § labels from user-facing UI
7. Connector modules with `local` and `live` drivers (`email`, `storage`, `payouts`, `hubspot`, `fx`, `sso`) failing closed when `live` config is missing
8. TOTP Authenticator-app MFA with recovery codes
9. Durable Scheduler + automatic payouts & invitation nurture
10. `docs/GO-LIVE.md` checklist (including bank-details lockdown as go-live blocker)
