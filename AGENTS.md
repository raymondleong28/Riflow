# AGENTS.md — R-PRM: Kiflo parity build

> Instruction file for Google Antigravity. Place at the repo root (Antigravity loads `AGENTS.md` automatically).
> Written 24 Nov 2026 from a live audit of R-PRM (`localhost:3000`) against Eber's Kiflo account (`app.kiflo.com`, account 68128177).
> Owner: Ray (Regional Head of Partnerships, Eber). Ray approves every gate and every ship.

- **Current priorities live in §15** (latest), then §14, then §13. Where a later section differs from an earlier one, the later section wins.
- See `docs/SPEC.md`, `docs/DECISIONS.md`, `docs/DATA-SAFETY.md`, `docs/DOMAIN.md`, `docs/ENVIRONMENT.md`, `docs/HANDOFF.md`, `docs/GO-LIVE.md`, and `docs/reference/kiflo-teardown.md`.

## §15.2 Fourth Audit Slices (24 Nov 2026, 16:34)
1. **Postgres (§14 Slice 3, now approved):** Run `brew install postgresql@16 && brew services start postgresql@16`, switch Prisma to `postgresql`, migrate schema and test data with identical IDs, relationships and amounts, stop the app using `prisma/dev.db`, run persistence test and all fixtures on Postgres, and update `docs/DECISIONS.md` and `docs/ENVIRONMENT.md`.
2. **Partner-facing allowlists for assets, manage items, and every partner-reachable endpoint:** Build one explicit partner serializer per object type (`src/lib/partnerSerializer.ts`) and route all partner responses through it. Never return raw `metadataJson`, `awardedPartners`, email subjects, or any other partner's name (`NovaBridge`, `Synthetix`, `BluePeak`, `Stratos`, `Horizon`, `Meridian`, `Vanguard`).
3. **Partner-facing settings:** Partner sessions receive only what the portal renders (`accountName`, `primaryColor`, `logo`, `portalDomain`, `mainCurrency`, `payoutProviders`, `selfInvoicingEnabled`, and the partner's own `user_preferences`). Everything else (SSO, MFA policy, validation strategy, conflict detection, deal expiry, payout schedule and threshold) is coworker-only.
