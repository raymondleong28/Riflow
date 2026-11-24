# SPEC.md — R-PRM: Kiflo Parity Specification

## 1. Objective
Close the behavioural and engine gap between **R-PRM** and **Kiflo PRM**: every admin screen, partner-portal screen, setting, public intake form, detail view, and workflow must not only exist visually, but compute its numbers from records, enforce scoping and role permissions server-side, log audit trails, and persist cleanly.

## 2. Acceptance Criteria
- **Zero Hard-Coded KPIs (D4, D5):** Dashboard "Top sales partners" and Partner KPIs (`submittedLeads365d`, `registeredDeals365d`, `sourcedRevenue365d`, `influencedRev365d`, `pendingRewardsAll`) are computed dynamically from live `leads`, `deals`, and `rewards` records.
- **Structured Commission & Reward Engine (D1–D3, §4.1):**
  - Program tier levels store structured reward rules (`trigger`, `conditions`, `valueType`, `amountMode`, `rateOrAmount`, `currency`, `duration`, `startOffsetMonths`, `durationMonths`, `rateSteps`, `requiresValidation`, `clawbackOnRefund`).
  - Rule Builder UI modal on Program Levels tab supports Create, Edit, and Delete (with confirmation).
  - Idempotent reward generation linked to source transaction/deal and rule.
  - Full reward lifecycle: `Pending → Validated (Accepted) → In payout → Paid`, `Pending → Refused (with reason)`, `Validated/Paid → Clawed back` (creates negative adjustment record).
  - Multi-currency transactions and rewards store original amount, currency, base amount (`SGD`), FX rate, FX rate date, and FX source.
- **Server-Side Asset & Content Scoping (D6, §4.3):**
  - Assets support `"Who has access"`: `My team`, `Everyone`, or `Some partners` (Program Levels, Groups, Individual Partners combined via `OR`).
  - Partner Portal endpoints filter assets server-side so a partner only sees assets matching their program/level/group/ID.
- **Distinct Account Settings Tabs (D7, §5.2):**
  - `Partner settings`, `Lead settings`, `Deal settings`, and `Payout settings` each render their own distinct Kiflo-authentic controls.
  - `Account data → Reset data` requires typed confirmation (`RESET`).
  - `Integration → API Access Tokens` shows raw token once at creation and stores/displays a hashed/masked token with revocation.
- **Onboarding 6 Action Types (D8, §4.5):**
  - Onboarding pipeline stages support all 6 action types: `View asset`, `Read article`, `Upload document`, `Provide information`, `Book meeting`, and `Opt-in/out from self-invoicing`, with admin validation gating.
- **Automated Emails & Template Pickers (D9, §4.6):**
  - Each program trigger (`Acknowledge partner signup`, `Notify accepted partner`, `Notify rejected partner`) is assigned a specific email template, and generates time-limited activation tokens at send time.
- **Auth, Roles, Impersonation & Separate Partner Portal (D10, D12, §3, §4.4):**
  - Separate Coworker (`/login`) and Partner (`/p/login`) login flows, server-side role checks, Audit Log table (`/api/audit`), and standalone Partner Portal at `/p` with no admin header.
- **Computed Account Mapping Overlaps (D11, §5.3):**
  - Overlaps are computed dynamically by matching normalized company name / domain across internal CRM accounts and partner account data sources.
- **Per-Resource APIs (D13, §3) & All Missing Detail/Form Routes (§2.3):**
  - Per-resource REST routes (`/api/partners`, `/api/programs`, `/api/leads`, `/api/deals`, `/api/customers`, `/api/transactions`, `/api/rewards`, `/api/payouts`, `/api/tasks`, `/api/assets`, `/api/audit`, `/api/auth`).
  - All 9 missing detail pages (`/customers/[id]`, `/transactions/[id]`, `/tasks/[id]`, `/payouts/[id]`, `/rewards/[id]`, `/business-plans/[id]`, `/accounts/[id]`, `/collaborations/[id]`, `/team-members/[id]`) plus `/forms/lead/[uuid]` and `/forms/apply/[programId]`.

## 3. Non-Goals (§8)
- Billing/subscription management for R-PRM itself.
- Re-creating Kiflo's marketing site or copying Kiflo's copyrighted copy/logos.
- Mutating or migrating live Kiflo production records.
