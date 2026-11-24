# DECISIONS.md — Architecture Decisions & Assumptions Log

1. **Sole Writer Rule (§1.1):**
   - Antigravity is sole writer on branch `antigravity/kiflo-parity` from 24 Nov 2026; other tools are read-only reviewers on this branch.
2. **Accidental Preset Reward Cleanup (§2.5 & §14.2 Slice 1):**
   - Ray approved removal of the accidental `"SGD 1,000 Quarterly Quota Accelerator Bonus"` preset reward from Silver Tier of `prog-strategic`. It has been removed from PostgreSQL, seed scripts, and sync scripts, with an immutable `DELETE` entry recorded in `AuditLog`.
3. **Database Engine Cutover to Local PostgreSQL 16 (§3 Slice 0b, §14.2 Slice 3 & §15.2 Slice 1):**
   - Installed and started `postgresql@16` (`16.16`) via Homebrew (`sh.brew.postgresql@16` on `127.0.0.1:5432`), switched `prisma/schema.prisma` to `provider = "postgresql"`, migrated all tables and records with identical IDs, relationships, and amounts into database `rprm_kiflo_parity`, and deleted `prisma/dev.db`.
4. **Partner-Facing Explicit Field Allowlists (§15.2 Slice 2 & Slice 3):**
   - Built one explicit partner serializer per partner-reachable object type in `src/lib/partnerSerializer.ts`. Partner sessions never receive raw `metadataJson`, `awardedPartners`, email template subjects, other partners' names, or coworker-only `account_settings` fields (SSO, MFA policy, validation strategy, conflict detection, deal expiry, payout schedule/threshold).
5. **ASSUMPTION — Asset Scoping Combination Logic (§4.3 / D6):**
   - When an asset's `"Who has access"` is set to `"Some partners"`, the three pickers (`programLevels`, `groups`, `partnerIds`) are evaluated with **OR** logic (an authenticated partner can access the asset if they match any configured picker, or if a picker is empty/unrestricted within the selected scope).
4. **ASSUMPTION — Application Acceptance Modes (§4.6):**
   - Partner application review supports both Kiflo acceptance modes:
     1. **Accept as Prospect:** Creates/updates the partner in the `Prospection` pipeline (`prospectionStage: "New"`, `portalAccess: false`).
     2. **Accept as Active Partner:** Activates the partner (`status: "Active"`, `portalAccess: true`), generates a time-limited activation token, and sends the assigned `"Notify accepted partner"` email template.
   - Rejecting an application requires a rejection reason (and optional `reapplyAfterDate`).
5. **ASSUMPTION — Bank Details Collection Timing (§4.6 / §9):**
   - Public partner applications (`/forms/apply/[programId]`) do NOT collect sensitive bank details at initial application; bank payout details are collected inside the Partner Portal after acceptance (or via the `Opt-in/out from self-invoicing` / `Provide information` onboarding action).
6. **DESIGN DECISION — Pipeline-to-Program Binding (§4.5):**
   - Each Onboarding Pipeline stores `assignedProgramIds` and `visibleToMainContacts`. Starting onboarding for a partner defaults to their program's assigned pipeline while allowing admin override.
7. **OPEN — Non-Cash Value Type Configs (§4.1.1):**
   - `valueType` supports `Cash`, `Coupon`, `Gift card`, and `Credit`. `Cash` computes numeric percentage/fixed payouts; `Coupon`, `Gift card`, and `Credit` store structured voucher/credit metadata and are flagged `OPEN` for future third-party issuer integration.
