# AGENTS.md — R-PRM: Kiflo parity build

> Instruction file for Google Antigravity. Place at the repo root (Antigravity loads `AGENTS.md` automatically).
> Written 24 Nov 2026 from a live audit of R-PRM (`localhost:3000`) against Eber's Kiflo account (`app.kiflo.com`, account 68128177).
> Owner: Ray (Regional Head of Partnerships, Eber). Ray approves every gate and every ship.

---

## 0. Read this first

You are extending **R-PRM**, a Next.js (App Router) partner relationship management app. Its screens already mirror Kiflo closely. Its engine does not. Your job is to close that gap as far as possible, slice by slice, without breaking what works.

**Read these before writing any code, every session:**
1. This file.
2. `docs/DECISIONS.md`, `docs/SPEC.md`, `docs/DATA-SAFETY.md`, `docs/HANDOFF.md` (create them in Slice 0 if missing).
3. `docs/reference/kiflo-teardown.md` — Ray will export the Notion page "Kiflo research by Claude" (id `37c9fed2563b80c09501f8fb0150b7ec`, Phases 1–11) into this path. It is the primary specification for Kiflo behaviour. If the file is missing, stop and ask Ray for it. Do not reconstruct Kiflo behaviour from memory.

**Current priorities live in §16** (latest), then §15, §14, §13. Where a later section differs from an earlier one, the later section wins.

**Definition of "maximum copy":** every Kiflo admin screen, partner-portal screen, setting and workflow that was observed in the teardown exists in R-PRM **and actually works** — data is computed, rules are enforced, actions persist. Matching the look without the behaviour does not count as done.

---

## 1. Hard rules (non-negotiable)

### 1.1 One writer
- You are the **only code writer on branch `antigravity/kiflo-parity`**. Create it from the current default branch in Slice 0. Never commit to the default branch.
- If another tool (e.g. Claude Code) has been writing this repo, record in `docs/DECISIONS.md`: "Antigravity is sole writer on `antigravity/kiflo-parity` from 24 Nov 2026; other tools are read-only reviewers on this branch." Ray merges, not you.

### 1.2 Kiflo is strictly read-only
You may open Kiflo in the browser to look at a screen. You may never change anything there. It is Eber's live production account with real partners.
- **Allowed:** navigate, scroll, read text, take screenshots, open a modal and close it with Cancel/Escape, switch tabs inside a page.
- **Forbidden — never click:** Save, Update, Add, Create, Submit, Send, Test, Send to group, Delete, Accept, Reject, Validate, Refuse, Start onboarding, Complete onboarding, Open partner portal (impersonation), Export, Download, Invite, Connect, Disconnect, Enable/Disable toggles, Rename, Move, Copy share link.
- Treat Create/Export/Download/Delete as writes. If a control's effect is unclear, do not click it — note it in `docs/HANDOFF.md` and ask Ray.
- If Kiflo navigation fails (nested dropdowns are known to fail with browser agents), stop retrying after 2 attempts and log it. Do not try workarounds that involve clicking unknown controls.
- **Never copy real Kiflo records** (partner names, contacts, leads, deals, bank details) into R-PRM. Seed data is synthetic only.

### 1.3 Copy behaviour, not brand
- Replicate structure, fields, flows and logic. **Do not copy Kiflo's logo, name, icons, illustrations, help-center articles, email wording or marketing copy verbatim.** Write R-PRM's own labels and text.
- Kiflo's terms of service likely restrict using customer access to build a competing product. This build is an internal Eber tool; keep it that way and keep Kiflo text out of the codebase. Ray will have counsel confirm before go-live.

### 1.4 Data safety
- **No reset, reseed, truncate or bulk replace of existing data** without Ray's explicit approval in chat for that specific operation. This includes the "Account data → Reset data" feature in R-PRM itself.
- Every number shown as fact must be **computed from records** or labelled as a manual/stored value. No hard-coded dashboard figures.
- Every lookup returns one of: **found / not found / couldn't check (with reason)**. A failure must never render as an empty list or zero.
- Missing input stays unknown. No silent defaults for country, currency, dates or status.
- Personal data (partner contacts, leads, bank details): synthetic in dev; bank and ID fields encrypted at rest before any real data enters.

### 1.5 Work in slices
- One slice = one user outcome = one session = one commit/checkpoint.
- Tests first; each test must fail for the right reason before the fix.
- If a slice breaks existing behaviour, **roll back to the checkpoint**. Do not patch forward.
- No source file over ~60 KB. Put new logic in small modules, not existing large files.
- Stop and report after 3 failed attempts at the same problem.
- No new dependency without a one-line reason in the slice report.

### 1.6 Stop and ask Ray when
- A business rule (commission, payout, ownership, permissions, privacy) is ambiguous or not in the teardown.
- The teardown and live Kiflo disagree.
- A change would alter or delete existing data.
- You want to expand scope beyond the current slice.

---

## 2. Current state of R-PRM (verified 24 Nov 2026)

### 2.1 Stack and data
- Next.js App Router, production build served on `localhost:3000`.
- **All data goes through one endpoint: `/api/prm`** (GET returns the whole dataset ~79 KB; POST writes). Methods allowed: GET, HEAD, OPTIONS, POST.
- Collections returned: `programs`(3), `partners`(8), `teamMembers`(5), `leads`(6), `deals`(10), `customers`(5), `transactions`(6), `rewards`(6), `payouts`(3), `tasks`(5), `businessPlans`(3), `accounts`(6), `collaborations`(4), `dataSources`(3), `trackingLinks`(3), `manageItems`(58), `notes`(3), `settings`.
- Team member IDs are cuid-style (suggests an ORM server-side). Other IDs are hand-written (`prt-1`, `deal-1`, `prog-strategic`).
- No login, no session, no roles enforced. Anyone reaching the URL is admin.
- Emails go to an in-app sandbox outbox unless Gmail SMTP is configured in Manage → Email setup.

### 2.2 Routes that exist (HTTP 200)
`/dashboard`, `/partners/views/all`, `/partners/[id]`, `/team-members/views/all`, `/partner-prospection/views/all`, `/partner-onboarding/[pipelineId]`, `/account-mapping-overview`, `/accounts/views/all`, `/overlaps/views/all`, `/collaborations/views/all`, `/data-sources`, `/leads/views/all`, `/leads/[id]`, `/deals/views/all`, `/deals/[id]`, `/customers/views/all`, `/transactions/views/all`, `/rewards/views/all`, `/payouts/views/all`, `/tasks/views/all`, `/business-plans/views/all`, `/programs/views/all`, `/programs/[id]`, `/manage` (14 modules inline), `/account` (12 settings tabs), `/settings` (user preferences), `/portal`, `/help`.

### 2.3 Routes missing (HTTP 404)
Detail pages: `/customers/[id]`, `/transactions/[id]`, `/tasks/[id]`, `/payouts/[id]`, `/rewards/[id]`, `/business-plans/[id]`, `/accounts/[id]`, `/collaborations/[id]`, `/team-members/[id]`.
Partner public lead form: `/forms/lead/[uuid]`. Partner sign-up / application form. Login.

### 2.4 What works
- Navigation matches Kiflo one-for-one (Partners menu: Partners, Team Members, Prospection, Onboarding; Account Mapping: Overview, Accounts, Overlaps, Collaborations, Data sources; overflow: Deals, Customers, Transactions, Tasks, Business Plans, Programs, Payouts, Rewards, Manage).
- Manage hub has the same 14 modules as Kiflo: Assets, Certifications, Email setup, Email templates, Groups, Help Center, Integrations, News, Partner dashboards, Partner directories, Partner onboarding, Products, Team, Workflows.
- Account Settings has the same 12 tabs as Kiflo: Account defaults, Partner portal, Directories, Security, Partner settings, Lead settings, Deal settings, Payout settings, Properties, Account data, Billing, Integration.
- Writes persist across reload (asset create, reward add confirmed).
- Dashboard "Leads from partners", "Shared leads" and the 12-month Transactions chart are computed from records (chart total SGD 82,100 = sum of `transactions.amountSgd`).
- Deals kanban with 9 stages: To Work On, Appointment Scheduled, Discovery, Presentation, Quotation, Negotiation, Closing, Closed Won, Closed Lost. Kiflo has a 10th, Holding — see §6.
- Partner record: 8 tabs; Team tab with roles (Manager / Sales Rep / Stakeholder) and Invite.
- Program detail: Members, Applications, Links, Levels, Settings; levels show Rewards / Benefits / Requirements.
- Onboarding kanban with pipeline switcher and Advance.
- Portal preview with partner switcher, quick deal registration, lead submission, assets and news.
- No console errors on audited pages.

### 2.5 Known defects (fix these first — Slice 1)
| # | Defect | Evidence | Fix |
|---|---|---|---|
| D1 | Rewards are free text | Reward stored as `{id, title, trigger: "On every transaction from won deals", rate: "10%"}` — nothing can compute from it | Structured rule model (§4.1) |
| D2 | "+ Add reward" inserts a hard-coded preset with no form | Clicking it added "SGD 1,000 Quarterly Quota Accelerator Bonus" to Silver Tier instantly | Open a rule-builder form; nothing saves until the admin confirms |
| D3 | Rewards cannot be edited or deleted | No controls on reward cards | Add edit and delete with confirmation |
| D4 | "Top sales partners" is hard-coded | Shows 38 won deals across partners; data has 2 Closed Won deals | Compute from deals |
| D5 | Partner KPIs are stored values | `submittedLeads365d`, `registeredDeals365d`, `sourcedRevenue365d`, `influencedRev365d`, `pendingRewardsAll` are fields, not calculations | Compute from records; drop stored copies or mark them cache-with-timestamp |
| D6 | Asset access not enforced | Strategic-program partner's portal shows asset shared with "ISV & Tech Partners" | Enforce scoping server-side (§4.3) |
| D7 | Partner/Lead/Deal/Payout settings tabs are one generic template | All four show the same fields (channel conflict, validation, deal expiration, payout providers) | Distinct options per tab (§5.2) |
| D8 | Onboarding stages have no action types | None of Kiflo's 6 action types exist in the bundle | §4.5 |
| D9 | Automated emails are on/off checkboxes | Kiflo assigns a specific template per trigger | Template picker per trigger (§4.6) |
| D10 | Security tab has SAML/MFA fields but no auth exists | No login anywhere | Auth first (§3), SSO later |
| D11 | Account Mapping overlaps are seeded | Overlap counts not derived from data sources | Compute overlaps from imported account lists |
| D12 | Portal is a preview inside the admin app | Partner switcher, admin header visible | Separate partner route group and login (§4.4) |
| D13 | Single whole-dataset write endpoint | One `/api/prm` POST for everything — likely overwrites concurrent edits (verify in code) | Per-resource API with server-side validation (§3) |

**Cleanup flagged for Ray (do not act without his yes):** the preset reward "SGD 1,000 Quarterly Quota Accelerator Bonus" on Silver Tier of *R-Cloud Strategic Solution Partners* was added by accident during the audit. Remove only after Ray confirms.

---

## 3. Wave 0 — Foundations (must pass before any feature wave)

**Slice 0 — Docs and branch**
- Create branch `antigravity/kiflo-parity`.
- Create `docs/` with: `SPEC.md` (outcomes, acceptance criteria, non-goals from §8), `DECISIONS.md`, `DATA-SAFETY.md` (§1.4), `DOMAIN.md` (objects and states from §6), `ENVIRONMENT.md`, `HANDOFF.md`.
- Inventory the codebase: where `/api/prm` reads/writes, which store backs it, file sizes. Report before changing anything.

**Slice 0b — Data layer**
- Replace the single blob endpoint with per-resource routes (`/api/partners`, `/api/programs`, `/api/leads`, `/api/deals`, `/api/customers`, `/api/transactions`, `/api/rewards`, `/api/payouts`, `/api/tasks`, `/api/assets`, …) or server actions, each with input validation and per-record writes.
- Use a real relational database with the **same engine in dev and prod** (Postgres recommended). Migrations reviewed, never run in build/startup scripts.
- Keep `/api/prm` working read-only during transition so existing screens don't break; remove it in the last slice of this wave.
- **Persistence test:** create a partner, edit it, restart the server, confirm IDs, values and relationships intact; apply a small schema change; confirm old records still load.
- Missing DB config or secrets → app refuses to start (fail closed).

**Slice 0c — Auth and roles**
- Two identities: **coworker** (admin side) and **partner user** (portal side). Separate login screens; partner users can never reach admin routes (server-side check on every request, not just hidden links).
- Coworker roles: at minimum Admin and Member. Partner user roles: Manager, Sales Rep, Stakeholder (as already modelled), plus "main contact" flag.
- Every read checks ownership server-side (partner sees only own records).
- **Audit log** table: who, what object, what change, when — written for every create/update/delete and every impersonation.

**Slice 0d — Known-answer fixtures**
Create automated tests with known correct outputs. Every later slice must keep them green:
1. Transactions chart total = SGD 82,100 for current seed.
2. Deals stats: 10 registered, 2 won, 1 lost for current seed.
3. Commission fixtures in §4.1.4.
4. Asset scoping fixture: a Strategic-program partner must NOT see an asset shared only with ISV & Tech program.

---

## 4. Wave 1–3 — Engine and behaviour (priority order)

### 4.1 Reward / commission engine (Wave 1 — highest priority)
Kiflo's core. Read teardown §2–§4 and P2.2–P2.3 for the exact trigger, condition, value-type and duration options. **Do not invent options that aren't in the teardown; mark gaps as OPEN in `docs/DECISIONS.md`.**

**4.1.1 Rule model (per level)** — replace free-text rewards with:
- `trigger` (enum, from teardown — e.g. transaction on a won deal, deal closed won, lead accepted)
- `conditions` (structured: field, operator, value; e.g. deal type, plan, amount threshold, count threshold within period)
- `valueType`: Cash, Coupon, Gift card, Credit (Cash verified live; the other three exist in Kiflo but their configs were not captured — build the type, mark configs OPEN)
- `amountMode`: percentage of amount, or fixed amount (with currency)
- `duration`: one-off, or recurring for N months/periods, with optional rate steps (rate A for months x–y, rate B for months y–z)
- `startOffset`: e.g. start at a given billing month
- `requiresValidation`: rewards created as Pending until an admin validates
- `clawback`: reverse a reward when the underlying payment is refunded

**4.1.2 Generation:** when a qualifying record is created/updated, generate reward records (`Pending`) linked to source transaction/deal, partner, level and rule. Idempotent — re-processing the same transaction must not double-pay.

**4.1.3 Lifecycle:** Pending → Validated → In payout → Paid; Pending → Refused (with reason); Validated/Paid → Clawed back (creates a negative adjustment, never deletes history).

**4.1.4 Commission fixtures (Eber's real programs — configure as rules, never hard-code):**
- **Biz Partner (one-off):** commission = one month's subscription, earned when the merchant's month-4 invoice is paid; nothing for months 1–3; paid in the next quarterly payout; clawback only if Eber refunds the fees it was based on.
- **Biz Partner Premium (recurring):** 20% of fees for merchant months 4–15, 10% for months 16–27 (24-month commission period starting month 4); stops if the merchant is no longer the partner's client.
- **Referral entry:** no commission unless a rate was agreed in writing before order acceptance (model as a per-deal override with an "agreed before acceptance" timestamp).
- Write each as a test: given a merchant's monthly invoice history, assert exact reward amounts and dates. Ask Ray to confirm expected numbers before marking these tests authoritative.

**4.1.5 Multi-currency:** store original amount + currency + converted base amount + FX rate + rate date on every transaction and reward. FX source configurable; never convert with an undated rate.

**4.1.6 UI:** rule-builder form on Levels tab (add / edit / delete with confirmation). Rewards list with inline Validate / Refuse (already present on dashboard — wire to the lifecycle above).

### 4.2 Payouts (Wave 1)
- Manual "Create payout" bundling validated rewards for a partner.
- Automatic payout creation on a schedule (Kiflo option: every month on the first day) — needs a scheduler (§4.7).
- Payout fields (Kiflo admin list): Name, Partner, Amount, Amount (base), From, Rewards, Status, **Invoice**, Creation date, Payout #, Paid date. Partner-side list omits Invoice.
- Self-invoicing: partner opt-in/out flag; if opted in, generate the partner's invoice document from payout data (company name, registered name, address from partner record).
- Payout providers (Kiflo offers PayPal, Payoneer, Stripe, Wise, Chargebee): build the provider interface and a manual "mark as paid" provider first. Real provider integration is Wave 5 and needs Ray's accounts.

### 4.3 Permissions and content scoping (Wave 2)
- **Program settings toggles** (Kiflo has ~20 across Leads, Deals, Line items, Others — full list in teardown §5). Examples verified live: allow partners to view leads; submit leads; view deals; convert lead to deal; register deals; update deals. Each toggle must actually hide/disable the matching partner-portal page or action, enforced server-side.
- **Asset access** — "Who has access": My team / Some partners / Everyone. "Some partners" = three pickers usable together: program levels, groups, individual partners. Combination logic was not observed in Kiflo: implement **OR** (visible if the partner matches any picker) and record it as ASSUMPTION in `docs/DECISIONS.md` for Ray to confirm.
- **Groups** are a segmentation dimension (e.g. Asia / Europe / US) used by asset scoping and filters — not a permission system on their own.
- Admin views show more fields than partner views (e.g. Leads: Owner and Source-partner vs Assigned-partner split; Payouts: Invoice). Define partner-visible field lists explicitly per object.

### 4.4 Partner portal (Wave 2)
Separate route group (e.g. `/p/...`) with its own login, layout and navigation — no admin header.
- Pages: Home (dashboard configured per program in Manage → Partner dashboards), Leads, Deals (if toggled on), Rewards, Payouts, Assets, Help Center, News, Team (if main contact may add members), Profile.
- **Impersonation:** admin "Open partner portal" opens the portal as that partner with a visible banner ("Viewing as …") and an exit; every impersonation session written to the audit log.
- **Public per-partner lead form:** `/forms/lead/[uuid]` — no login, unique per partner, attributes the lead to that partner, linked from the portal's Submit-lead modal ("Use your personal lead form").
- **Referral tracking links** (`trackingLinks` collection exists): per-partner link, click and conversion counting.

### 4.5 Onboarding (Wave 3)
- Pipelines: name + "visible to partner main contacts" flag; stages; partner cards move through stages.
- **Pipeline-to-program link:** Kiflo's mechanism was never located. Design it explicitly: each pipeline is assigned to program(s)/level(s); "Start onboarding" uses the assigned pipeline and lets the admin override. Record as a design decision.
- **Six stage action types** (fields verified live in Kiflo):

| Action type | Fields |
|---|---|
| View asset | Title, Description, Asset (picker from Assets) |
| Read article | Title, Description, Article (picker from Help Center) |
| Upload document | Title, Description, Require admin validation (checkbox), Document title |
| Provide information | Title, Description, Require validation (checkbox), List of fields with "Add field" (dynamic form builder) |
| Book meeting | Title, Description, Calendar type (Calendly / HubSpot / Other), calendar link |
| Opt-in/out from self-invoicing | Title, Description (sets the partner's self-invoicing flag) |

- A stage completes when all its actions are done; actions with validation stay pending until an admin approves.
- Partner sees and completes actions in the portal.

### 4.6 Applications, enrollment, invitations and emails (Wave 3)
- **Public sign-up / application form** per program. Kiflo's intake captures: registered company name, phone, website, industry, social links (LinkedIn/FB/IG/other), how they heard about you, reason for interest, role, country, preferred contact method, timezone, bank fields. **Enhancement:** collect bank details after acceptance, not at application (reduces exposure of unvetted applicants' bank data) — confirm with Ray.
- **Review:** Applications tab → Accept or Reject on the application record.
  - Kiflo's docs describe two accept modes: accept as **prospect** (enters Prospection pipeline, no portal access) or as **active partner** (portal access now). Not live-verified — implement both and record as ASSUMPTION.
  - **Reject:** require a reason (enhancement over Kiflo, whose reject email has no reason).
- **Manual enrollment** ("Add a new partner"): Partner name*, Partner program, Language; main contact First name, Last name, Email, Job title, Phone; checkbox "This contact has access to the partner portal". The checkbox is the single access-grant primitive — reuse it on team-member add/edit.
- **Team members on a partner record:** Add form (First name, Last name, Email, Phone, Job title, LinkedIn, portal-access checkbox). Delete is via row selection + bulk action bar: Delete, Change main contact, Update.
- **Automated emails per program**, each trigger assigned a template:
  - Acknowledge partner signup (receipt, no link)
  - Notify accepted partner (must contain the activation link)
  - Notify rejected partner
- **Activation link** generated per recipient **at send time** (time-limited token), never stored as a static URL.
- **Email templates:** per-template From name, Reply-to, BCC, Subject, rich-text body, language translations, Test send, Send to group. Merge fields to support: User first/last name, User activation URL, Owner first/last name/email/phone/job title, Lead name, Lead URL, Lead form URL, Deal name, Deal URL, Partner referral link. Write R-PRM's own email copy.
- **Invitation nurture workflow** (Kiflo default, disabled in Eber's account): trigger = invitation status Pending or Sent → wait 2 days → reminder email → wait 3 days → reminder email → wait 2 days → create internal task.

### 4.7 Workflows and scheduler (Wave 3)
- Trigger → (wait) → condition → action chains. Triggers seen in Kiflo: partner invitation status changed, partner properties changed, payout validated. Actions: send email, wait, create task.
- Needs a durable job runner that survives restarts (queue table + worker, or host queue service). No in-memory timers.
- Every workflow run logged (start, each step, outcome, errors). Enable/disable per workflow.
- Tasks object (Kiflo columns): Status, Name, Type, Due date, Description, Assigned to, Association (deal/partner/lead), Created by, Creation date, Completed by, Completed date.

---

## 5. Wave 4 — Remaining surfaces

### 5.1 Missing pages and tabs
- Detail pages for every object in §2.3.
- Partner record: add tabs **Notes** (data already exists — 3 notes), **Meetings**, **Tasks**, **Attachments**, **Customize**; add the KPI strip (Submitted leads, Registered deals, Partner-sourced revenue, Partner-influenced revenue — last 365 days; Pending rewards — all time), computed.
- Program kebab: Delete (Kiflo has only this). **Enhancement:** Duplicate program and Archive program.
- Admin list views (match Kiflo columns, all computed, all with saved views "All / My … / Pending …", Add view, Manage views, edit columns, filters, CSV export with formula escaping):

| Object | Columns |
|---|---|
| Leads | Name, Company, Lead status, Owner, Source, Source partner, Assigned partner, Assigned contact, Assigned date, Deadline, Creation date |
| Customers | Name, Email, Status, Source, Source partner, Transactions, Revenues, Creation date |
| Transactions | Name, Amount, Amount (base), Partner, Customer, Deal, Creation date |
| Business Plans | Name, Partner, Partner owner, Status, Start date, End date, Creation date, Achieved % |
| Payouts | §4.2 |
| Tasks | §4.7 |

### 5.2 Account Settings — distinct options per tab (Kiflo, verified live)
- **Account defaults:** account name, timezone, main currency, multi-currency tracking toggle.
- **Partner portal:** company logo (rectangular + square), sign-in background, primary colour, favicon, portal domain (subdomain or custom domain).
- **Directories:** directory subdomain (add-on; low priority).
- **Security:** require MFA for coworkers; require MFA for partner users; SAML 2.0 SSO for coworkers and for partners (SP entity ID, callback URL). Build MFA after auth; SSO last.
- **Partner settings:** partner properties, partner types, prospection pipeline, prospection cards, onboarding cards.
- **Lead settings:** lead properties; channel-conflict detection (who may submit duplicates); validation strategy; acknowledge lead submissions.
- **Deal settings:** deal properties; deal stages; deal cards; channel-conflict detection; deal expiration; deal resubmission; associate customers automatically; validation strategy; acknowledge deal registrations.
- **Payout settings:** automatic payout creation and schedule; payout providers shown on portal and allowed list; self-invoicing enable + company details.
- **Properties:** custom property builder for Contacts, Customers, Deals, Leads, Partners, Rewards, Payouts, Tasks, Transactions, Products — custom fields must appear in forms, detail pages, list columns and filters.
- **Account data:** test-data insert and reset — reset must require typed confirmation and must never be callable from an agent session (§1.4).
- **Billing:** placeholder (internal tool).
- **Integration:** API access tokens (create, revoke, last used); show token once at creation, store hashed.

### 5.3 Account Mapping
- Data sources: import account lists (CSV first; CRM later).
- Overlaps computed by matching accounts across Eber's lists (customers / opportunities / prospects) and each partner's lists — matching on normalised domain and company name. Overview matrix and recent overlaps derived, never seeded.
- Collaborations on an overlap (request intro, share, status).
- Kiflo's own Account Mapping screens could not be opened during the audit; build from this description and record as ASSUMPTION.

### 5.4 Manage modules (already present — make them real)
Certifications (tracks, validity, award to partner members; feeds the "certified sales reps" requirement), Partner dashboards (per-program widget layout for portal Home), Help Center (articles, collections, attachments; feeds "Read article"), News (announcements with visibility scoping like assets), Products (SKUs for deal line items), Team (internal coworkers, roles, invites), Groups, Partner directories (add-on, lowest priority).

---

## 6. Wave 5 — Integrations
- **HubSpot:** deal sync with stage mapping (Kiflo stages in Eber's account: To Work On, Appointment Scheduled, Holding, Discovery, Presentation, Quotation, Negotiation, Closing, Closed Won, Closed Lost). Note **Holding** exists in Kiflo but not in R-PRM — add it. Deal field `hubspotDealId` already exists.
- **Email:** real SMTP or provider with Eber's sending domain, SPF/DKIM; bounce handling.
- **Payout provider:** one real provider first, chosen by Ray.
- **Webhooks / Zapier:** outbound events for partner, lead, deal, reward, payout changes; signed payloads.
- Integration credentials in environment/secret store only — never in the database in plain text, never in URLs or browser storage.

---

## 7. What cannot be copied (do not attempt)
- Kiflo's server-side logic beyond what the teardown observed. Where behaviour is unknown, design it, mark it ASSUMPTION, and ask Ray.
- Items never observed: Prospection internals, pipeline-to-program binding, AND/OR asset logic, Coupon/Gift card/Credit configs, which email fires on manual enrollment. Build reasonable versions; label them.
- Third-party relationships (payout providers, HubSpot marketplace listing) — need Eber's own accounts.
- Kiflo brand, text, icons, help content.

---

## 8. Non-goals
- Billing/subscription management for R-PRM itself.
- Public partner marketplace/directories beyond a basic version.
- Re-creating Kiflo's own marketing site, onboarding tours, "What's new" feed content or "Refer Kiflo".
- Any change to live Kiflo.
- Migrating real Kiflo data (separate, Ray-approved project).

---

## 9. Enhancements beyond Kiflo (do after parity in the same area)
- Reject with a reason, plus an optional "re-apply after" date.
- Program Duplicate and Archive.
- Explicit pipeline-to-program assignment.
- Per-row delete as well as bulk delete for team members.
- Bank details collected after acceptance.
- Reward and payout audit trail visible to admins.

---

## 10. Slice workflow

**Slice brief (write it in `docs/HANDOFF.md` before coding):**
```
SLICE <n>: <one user outcome>
Scope: ONLY this.
Must keep working: <existing behaviour + known-answer fixtures>
May change: <files/areas>
Won't touch: <files/areas>
Tests first: <tests that must fail before the fix>
Covers: fresh install AND existing data
Done means: <acceptance checks>
```

**Slice report (append to `docs/HANDOFF.md` after coding):**
- Files changed
- Tests actually run, with results (typecheck, unit, build)
- Known-answer fixtures: pass/fail
- What remains unverified
- Judgement calls and ASSUMPTIONs made
- Next slice proposed

**Done checklist for every slice:**
- [ ] Typecheck, tests and production build pass
- [ ] Known-answer fixtures green
- [ ] No hard-coded figures introduced (grep the slice diff for literal currency amounts and counts in UI code)
- [ ] Server-side permission check on every new read/write
- [ ] Audit log entry on every new write
- [ ] Honest states: loading / empty / error each rendered distinctly
- [ ] No file over ~60 KB
- [ ] `docs/DECISIONS.md` updated for any decision or ASSUMPTION

---

## 11. Suggested slice order
| # | Slice | Wave |
|---|---|---|
| 0 | Docs, branch, codebase inventory | 0 |
| 0b | Database + per-resource API + persistence test | 0 |
| 0c | Coworker + partner auth, roles, audit log | 0 |
| 0d | Known-answer fixtures | 0 |
| 1 | Fix D4/D5: compute dashboard and partner KPIs | 1 |
| 2 | Reward rule model + builder UI (D1–D3) | 1 |
| 3 | Reward generation, lifecycle, validate/refuse, clawback | 1 |
| 4 | Multi-currency with dated FX | 1 |
| 5 | Payouts manual + self-invoicing | 1 |
| 6 | Program toggles enforced in portal | 2 |
| 7 | Asset scoping enforced (D6) | 2 |
| 8 | Separate partner portal + impersonation (D12) | 2 |
| 9 | Public per-partner lead form + tracking links | 2 |
| 10 | Onboarding action types + validation (D8) | 3 |
| 11 | Application form, accept (prospect/active), reject with reason | 3 |
| 12 | Manual enrollment + team add/bulk actions + activation links | 3 |
| 13 | Email templates per trigger + merge fields (D9) | 3 |
| 14 | Scheduler + workflows + invitation nurture + auto payouts | 3 |
| 15 | Missing detail pages + partner tabs + list views | 4 |
| 16 | Distinct account settings (D7) + custom properties | 4 |
| 17 | Account Mapping computed overlaps (D11) | 4 |
| 18 | Manage modules made real | 4 |
| 19 | MFA, then SSO (D10) | 4 |
| 20+ | HubSpot, email provider, payout provider, webhooks | 5 |

Ray may reorder. Do not start a slice from a later wave while an earlier wave's foundation slice is failing.

---

## 12. Open questions for Ray (ask, don't guess)
1. ~~Which tool wrote R-PRM so far, and should Antigravity be the sole writer on this branch?~~ **Answered:** Antigravity is the sole writer on `antigravity/kiflo-parity`.
2. ~~Remove the accidental "SGD 1,000 Quarterly Quota Accelerator Bonus" reward?~~ **Answered 24 Nov: remove it** (§14.2, slice 1).
3. Database and host for the live version?
4. Confirm expected numbers for the commission fixtures in §4.1.4.
5. Asset scoping: OR (any picker matches) or AND (all must match)?
6. Accept-as-prospect vs active-partner: keep both modes?
7. Collect bank details at application or after acceptance?
8. First payout provider to integrate?

---

## 13. Local-complete build (added 24 Nov 2026, 13:56)

**Goal:** build everything to production standard on Ray's machine. Anything that needs an outside service gets a working local stand-in now and a real version later. Going live should be accounts, keys, DNS and a test pass — not rebuilding.

### 13.1 Re-audit results (24 Nov, 13:50) — fix these first
Verified live. These replace the status column of §2.5 where they differ.

| Area | Status | What to do |
|---|---|---|
| D3, D4, D5, D9, D12 | Done | Keep green |
| D7 settings tabs | Done, one gap | Deal settings is missing three Kiflo options: channel-conflict detection for deals, deal resubmission, associate customers automatically (§5.2) |
| Bank details exposure | Open (deferred while local) | `/api/partners` returns every partner's `bankDetailsJson` in list responses. Acceptable on localhost with synthetic data; before any real data: return bank fields only on the single-partner endpoint, only to authorised roles, encrypted at rest |
| D8 onboarding actions | Done, one gap | Attach actions to individual stages (Kiflo attaches them per stage), not one list per pipeline |
| D1 / D13 two sources of truth | **Broken** | `/api/prm` returns structured rules; `/api/programs` returns the old free-text rules. Make every endpoint read one store. Retire `/api/prm` once screens use per-object endpoints |
| Auth (D10) | **Not working** | Admin pages and every API return full data with no session or cookie. Login has a pre-filled password and a self-selected role. See §13.3 |
| Reward generation | **Wrong** | Every reward is 18% of its transaction regardless of tier. Apex and Synthetix are Platinum (25% + 5% kickback). Fixture: Apex's SGD 28,500 transaction must produce SGD 7,125 and SGD 1,425. The portal also shows Apex "18%" — must read the partner's actual level rule |
| D6 asset scoping | Partial | Hidden in the portal, but `/api/assets` without a partner filter returns everything. Scope on the server from the session, never from a query parameter |
| Audit log | Not writing | `/api/audit` exists with 0 entries. Every create/update/delete must write one |
| Public lead form | Partial | Uses the partner ID (`/forms/lead/prt-1`), guessable; an unknown ID still shows a form. Use an unguessable per-partner token; show "This link isn't valid" for bad tokens; add a consent checkbox (Eber General Terms 7.2) |
| UI text | Fix | Remove internal labels such as "(§3 Slice 0c)" from user-facing screens |
| D2, D11 | Not re-checked | Verify in the next slice report |

**Do not touch** the reward "SGD 1,000 Quarterly Quota Accelerator Bonus" until Ray decides (§12 Q2).

### 13.2 The connector rule (applies to every outside service)
- Each outside service is one module with one interface and **two implementations**: `local` and `live`.
- The implementation is chosen by an environment setting (e.g. `EMAIL_DRIVER=local|smtp`, `PAYOUT_DRIVER=manual|wise`, `STORAGE_DRIVER=disk|s3`). Business logic never imports a provider SDK directly.
- All keys, URLs and hostnames come from environment settings through one config module. Nothing hard-coded.
- If a `live` driver is selected and its settings are missing, the app refuses to start (fail closed). It must never fall back to `local` silently.
- Every connector has a contract test that runs against `local` now and against `live` at go-live.

### 13.3 In scope — build fully, locally
- **Auth:** hashed passwords, server-side sessions in httpOnly cookies, a session check on every admin page, portal page and API. Coworker roles and partner-user roles assigned by an admin and stored in the database — never chosen at login. Partner users can read and write only their own partner's records, enforced on the server.
- **MFA:** authenticator-app codes (TOTP) with recovery codes. No SMS.
- **Permissions:** program toggles and asset/news scoping enforced on the server from the session.
- **Commission engine:** rules → reward generation → validation → clawback → payouts → self-invoice PDFs, with the fixtures in §4.1.4 and §13.1.
- **Onboarding, applications, enrollment, team management, workflows** as in §4.5–4.7.
- **Scheduler:** a local worker process for workflows, reminders and automatic payouts; jobs survive restarts.
- **Audit log, custom properties, CSV import/export** (escape formulas on export).
- **Account Mapping:** import account lists by CSV; compute overlaps by normalised domain and company name.
- **Public lead form and application form**, working on localhost.
- **Database:** Postgres running locally (e.g. Docker) — the same engine as production.
- **HTTPS locally** (e.g. a locally trusted certificate) so cookie and redirect settings match production.
- **Bind to this machine only:** start with `next start -H 127.0.0.1` (and the dev server equivalent). Document this in the README.

### 13.4 Online-only — build the local stand-in now, the live driver later

| Service | Local driver (build now) | Live driver (go-live) |
|---|---|---|
| Email | Local mail catcher (e.g. Mailpit) — every email visible, none sent | Email provider/SMTP; SPF, DKIM, DMARC on Eber's domain |
| Portal domain + HTTPS | localhost + local certificate | DNS record, SSL certificate on the host |
| SSO (SAML 2.0) | Test identity provider running locally (Docker) | Eber's identity provider metadata (Google Workspace or Microsoft) |
| Payouts | `manual` driver: admin marks a payout paid, records reference | One real provider first (PayPal / Wise / Stripe / Payoneer / Chargebee); sandbox accounts optional for API tests |
| HubSpot | Mock connector with the 10-stage mapping and fake deal IDs | Eber HubSpot token/app, field mapping verified |
| Incoming callbacks (HubSpot, payout status) | Endpoint + signature check, tested through a temporary tunnel | Public HTTPS URL on the live host |
| Exchange rates | Rate table maintained in the app, each rate dated | Rate API with a daily scheduled fetch |
| File storage | Local folder behind the storage connector | S3-compatible storage (e.g. Cloudflare R2) |
| Monitoring / error alerts | Console + log file | Error-tracking service, uptime check |
| Zapier, public directory pages | Outbound webhook sender; directory preview | Public deployment |

### 13.5 Not in this build
- Live hosting, real DNS, real email delivery, real payouts, real HubSpot writes.
- Importing real partner data from Kiflo (separate, Ray-approved migration).
- Any real personal or bank data — synthetic only until a security review is done.

### 13.6 Go-live checklist (write it as `docs/GO-LIVE.md`, keep it current)
For each connector: account owner, settings needed, contract test to run against `live`, rollback step. Plus: managed Postgres with tested backup and restore, file storage migrated, HTTPS and secure cookies on the real domain, email domain authenticated, PDPA consent wording approved, counsel's view on Kiflo's terms, security review passed before real bank details are entered.

### 13.7 Slice order from here
1. One source of truth (retire `/api/prm`)
2. Real auth, sessions and admin-assigned roles; server-side scoping on every API
3. Audit log writes
4. Reward generation from rules + fixtures
5. Lead form token, invalid-link page, consent
6. Onboarding actions per stage; the 3 missing Deal settings options
7. Connector modules with local drivers (email, storage, payouts, HubSpot, FX, SSO)
8. MFA
9. Scheduler + automatic payouts
10. `docs/GO-LIVE.md` (include the bank-details lockdown from §13.1 as a go-live blocker)

---

## 14. Third audit fixes (added 24 Nov 2026, 15:51)

### 14.1 Status after the §13 build
An independent check (logged out, as admin, and as partner user `jordan.lee@apexcloud.example.com`) confirmed: pages and APIs locked when logged out; httpOnly session cookie; `/api/prm` returns 410; one structured rule store; Apex rewards SGD 7,125 + SGD 1,425 and Synthetix SGD 3,150 + SGD 630; partner lists scoped to the partner's own records; admin pages redirect for partner users; `/api/audit` and `/api/tasks` return 403 for partners; bank details absent from list responses; audit log writing; lead-form token and invalid-link page working; portal shows the correct tier rate. **Keep all of these green.**

**Context:** all data in this build is fabricated test data. Data-safety rules (§1.4) still apply to code behaviour, but test data may be changed or removed when a slice requires it.

### 14.2 Slices (in order)

**Slice 1 — Remove the accidental preset reward**
- Ray approved removal. Delete the reward rule "SGD 1,000 Quarterly Quota Accelerator Bonus" from Silver Tier of `prog-strategic`.
- Remove it from every place it lives: database, seed scripts, fixtures, sync scripts — so a reseed does not bring it back.
- Done when: `/api/programs` Silver Tier of `prog-strategic` lists only "10% Recurring Deal Commission"; a full reseed still doesn't contain it; audit log has a DELETE entry for it.

**Slice 2 — Partners see only their own program and level**
- Problem: a partner user receives all 3 programs from `/api/programs`, including every tier's commission rates. Eber's Biz Partner Premium rates (20%/10%) are invite-only and must never be visible to other partners.
- Fix: for partner sessions, `/api/programs` (and any other endpoint or page payload) returns only the partner's own program, and within it only the level the partner is on, with the fields the portal needs. Coworker sessions unchanged.
- Check every partner-facing response for other programs' or levels' data, including server-rendered page payloads, not just JSON APIs.
- Done when: as `jordan.lee@apexcloud.example.com`, `/api/programs` returns exactly 1 program containing only the Platinum Elite level; no response or page source seen by that user contains "Global Affiliate", "ISV & Technology", "Silver Tier" or "Gold Tier".

**Slice 3 — Postgres, as planned**
- The build uses SQLite (`prisma/dev.db`). The plan (§3, §13.3) requires the same engine as production. Switch to Postgres running locally (Docker).
- If Docker or Postgres isn't available on Ray's machine, **stop and ask** — don't fall back to SQLite silently.
- Migrate schema and test data; keep IDs, relationships and amounts identical.
- Done when: app runs on Postgres; all fixtures pass; the persistence test (§3, Slice 0b) passes on Postgres; `docs/DECISIONS.md` and `docs/ENVIRONMENT.md` updated; SQLite file no longer used by the app.

**Slice 4 — Payout schedule as a setting**
- The scheduler creates payouts monthly. Eber's Biz Partner terms pay **quarterly**.
- Make the schedule a setting per account and, if overridden, per program: monthly or quarterly, plus payout threshold. No schedule hard-coded in the scheduler.
- Add a fixture: a program set to quarterly creates one payout per partner per quarter, bundling that quarter's validated rewards; a monthly program creates one per month.

**Slice 5 — Test logins hidden outside local**
- Both login screens print test emails and passwords. Show them only when `NODE_ENV !== 'production'` **and** an explicit `SHOW_DEV_LOGINS=true` setting is on.
- Add to `docs/GO-LIVE.md` as a blocker: test accounts removed or disabled, `SHOW_DEV_LOGINS` off.

**Slice 6 — Prove the items not independently verified**
For each, add or extend an automated test and include evidence in the report:
- Onboarding actions attached to individual stages (each of the 6 types in at least one stage; a stage completes only when its actions are done; validation-required actions stay pending until a coworker approves).
- All 9 Deal settings options save and reload.
- MFA: enrolling, signing in with a valid code, rejecting an invalid code, one-time use of a recovery code.
- Scheduler: invitation nurture sends Day 2 and Day 5 reminders and creates the Day 7 task; jobs survive a server restart.
- Connectors: selecting each `live` driver without settings makes the app refuse to start.

### 14.3 Report requirements (so results can be checked)
Your final report must include:
- For every slice: the exact check performed, the URL or test name, and the observed result.
- **Credentials copied from the running app**, not from memory. Sign in with each listed account before reporting it.
- Anything you couldn't do or verify, stated plainly.
- No claim of "verified" for anything checked only by your own subagent without the evidence above.

### 14.4 Acceptance checks Ray's reviewer will run
| Check | Expected |
|---|---|
| Logged out: `/dashboard`, `/p`, every `/api/*` | Redirect to login / 401 |
| Admin: Silver Tier of `prog-strategic` | Only "10% Recurring Deal Commission" |
| Partner (`jordan.lee@…`): `/api/programs` | 1 program, Platinum Elite level only |
| Partner: any page or API | No other program or level names |
| Partner: lists | Only Apex records |
| Admin: Apex rewards | SGD 7,125 and SGD 1,425 |
| Database | Postgres |
| Quarterly program | One payout per quarter per partner |
| Production mode | No test logins on login screens |
| `/forms/lead/prt-1` | "This link isn't valid" |

---

## 15. Fourth audit fixes (added 24 Nov 2026, 16:34)

### 15.1 Status after §14
Independently verified passing: logged-out lockout; test logins hidden; preset reward removed with DELETE audit entry; Apex SGD 7,125 + SGD 1,425; partner `/api/programs` returns 1 program with only Platinum Elite; no other program or tier names in 22 partner-reachable endpoints or the portal page; admin-only endpoints return 403 for partners; invalid lead link page; per-program payout cadence and threshold on the program Settings tab. **Keep all green.**

### 15.2 Slices (in order)

**Slice 1 — Postgres (§14 Slice 3, now approved)**
- Ray approved: run `brew install postgresql@16 && brew services start postgresql@16`.
- Then complete §14 Slice 3 exactly: switch Prisma to `postgresql`, migrate schema and test data with identical IDs, relationships and amounts, run the persistence test and every fixture on Postgres, stop the app using `prisma/dev.db`, update `docs/DECISIONS.md` and `docs/ENVIRONMENT.md`.
- Done when: the running app reads and writes Postgres only; all fixtures pass; persistence test passes after a server restart.

**Slice 2 — Partner-facing allowlists for assets and manage items**
- Problem: as `jordan.lee@apexcloud.example.com`, `/api/assets` and `/api/manage-items` return each item's full `metadataJson`, including `awardedPartners` (names another partner, "NovaBridge Digital Systems") and admin-only settings such as email subjects.
- Fix: for partner sessions, return an **explicit allowlist** of fields per item type (e.g. asset: id, name, subtitle, category, folder, file reference, size; news: title, body, date; certification: name, validity, and whether *this* partner holds it). Never return lists of other partners, admin configuration, or raw `metadataJson`.
- Apply the same allowlist approach to every partner-reachable endpoint, not only these two: build one partner serializer per object type and route all partner responses through it.

**Slice 3 — Partner-facing settings**
- Problem: partner sessions receive the full `account_settings` (SSO entity ID and callback, MFA policy, validation strategy, conflict detection, deal expiry, payout schedule and threshold, etc.).
- Fix: partner sessions get only what the portal renders — branding (account name, primary colour, logo, portal domain), main currency, payout providers allowed, self-invoicing enabled, and the partner's own user preferences. Everything else coworker-only.

### 15.3 Acceptance checks Ray's reviewer will run
| Check | Expected |
|---|---|
| Database the app uses | Postgres; `prisma/dev.db` unused |
| Fixtures | All pass on Postgres |
| Partner: every endpoint and portal page | No other partner's name (e.g. NovaBridge, Synthetix, BluePeak, Stratos, Horizon, Meridian, Vanguard) |
| Partner: `/api/assets`, `/api/manage-items` | No `metadataJson`, no `awardedPartners`, no email subjects |
| Partner: `/api/settings` | No SSO, MFA policy, validation, conflict-detection, deal-expiry or payout-schedule fields |
| Everything in §14.4 and §15.1 | Still passing |

Report rules in §14.3 still apply.

---

## 16. Go-live readiness and parity fixes (added 24 Nov 2026, 17:20)

Based on a full browser pass of the running app **and** a code review of `raymondleong28/Riflow`, branch `antigravity/kiflo-parity`, commit `52315b0`.

### 16.0 Rules for this section
- **Keep this file whole.** The repo's `AGENTS.md` was cut down to a §15 summary, which dropped the hard rules (§1). Replace it with this full file and never shorten or rewrite it. Ray edits it; you only read it. Put your own notes in `docs/HANDOFF.md`.
- **The goal of §16:** going live must need only environment settings, accounts and DNS — no code changes. Anything that today would need code at go-live is a defect here.
- **Docs must match code.** `docs/GO-LIVE.md` currently claims bank-detail encryption, reviewed migrations and per-connector contract tests that don't exist. Every claim in a doc must be true in code at the commit it's written in.

### 16.1 Verified working (keep green)
Logged-out lockout; API handlers re-check the session (not only middleware); partner data allowlists; partner program/level scoping; Postgres; Apex SGD 7,125 + SGD 1,425; structured rule builder with Eber templates (Premium `rateSteps` stored correctly); accept as Prospect / Active Partner; reject with required reason and re-apply date; impersonation banner + audit log; all 14 Manage modules; custom properties builder; self-invoice PDF; list export; connector fail-closed checks; test logins hidden.

### 16.2 Security fixes (do first)
| # | Problem (file) | Fix | Done when |
|---|---|---|---|
| S1 | Session secret and bank encryption key fall back to hard-coded strings that are now public on GitHub (`src/middleware.ts`, `src/lib/authSession.ts`, `src/lib/connectors.ts`) | Remove all fallbacks. Read `SESSION_SECRET` and `BANK_ENCRYPTION_KEY` from the environment through one config module; refuse to start if missing or shorter than 32 bytes. Add both to `.env.example` (names only) | App won't start without them; `grep` finds no secret literals |
| S2 | Admin "Log out" only shows a toast: "Signed out preview (Demo session remains active)" (`src/components/AppShell.tsx` ~line 631) | Call `POST /api/auth {action:"logout"}`, then redirect to `/login`. Same for the portal's sign-out | After logout, `/api/partners` returns 401 |
| S3 | Sessions never expire and can't be revoked (stateless token, `issuedAt` never checked) | Server-side `Session` table (id, user, created, expires, revokedAt). Cookie holds a random session id only. Check expiry and revocation on every request. Logout and password change revoke | Revoked or expired session → 401 |
| S4 | `/api/upload` has no session check, no size or type limit, and writes to `public/uploads`, which middleware serves to anyone without login | Session check in the handler; size limit; allowlist of types (PDF, images, Office docs); never serve uploads from `public/` — serve through an authorised download route that checks the user may see that file; route all file writes through the storage connector (S8) | Logged-out upload → 401; logged-out download → 401; an `.html` upload is refused |
| S5 | Passwords use one fixed salt for everyone; every partner user shares one hard-coded password (`DEFAULT_PARTNER_HASH`); coworkers fall back to a default hash | Per-user random salt (or `crypto.scrypt` with stored salt); per-user password hash on a real user record; no default hashes in code. Seed creates local test users with passwords from `.env` (`SEED_ADMIN_PASSWORD`, `SEED_PARTNER_PASSWORD`) | No password literal in `src/` |
| S6 | Coworker login matches `subtitle.includes(email)` — a partial email can match another person | Exact match on a unique, normalised email column | Fixture: `x@r-prm.example.com` does not log in as alex |
| S7 | No users table: coworkers live in `ManageItem` (`category: "team"`) with the hash in `metadataJson` | Add `User` (coworkers and partner users, unique email, role, partnerId, passwordHash, mfaSecret, status). Migrate existing rows | Auth reads only `User` |
| S8 | Bank details stored in plain text; `encryptBankDetails` is never called | Encrypt on every write, decrypt only on the single-partner read for authorised roles; migrate existing rows | Raw database value is ciphertext |
| S9 | Activation link token is built with `Math.random()` and never checked; links are hard-coded to `http://127.0.0.1:3000` | Store a hashed random token (`crypto.randomBytes(32)`) with expiry and single use; new public route `/p/activate?token=…` that validates it and lets the invitee **set their password**; build links from `APP_BASE_URL` | Invitee in a logged-out browser sets a password and signs in; reused or expired token refused |
| S10 | Next.js 14.2.15 has a known middleware-bypass vulnerability (fixed in 14.2.25) | Upgrade to the latest 14.2.x patch (or a supported newer major if Ray approves) | `npm ls next` ≥ 14.2.25; all tests pass |
| S11 | Email HTML is built by pasting `subject` and `body` into HTML unescaped | Escape all values; use templates with merge fields | Fixture: a partner name containing `<script>` is escaped in the email |
| S12 | Gmail app password can be saved in the database from the Email setup screen | Secrets only from the environment; the screen shows "configured / not configured" and sends a test | No credentials stored in `AppSetting` |
| S13 | No rate limit on login or public forms | Rate limit by IP and email on `/api/auth`, `/api/public-forms`, `/forms/*`; lock out after repeated failures | Fixture: 10 bad logins → temporary lockout |

### 16.3 Go-live wiring (so going live is settings only)
| # | Problem | Fix |
|---|---|---|
| G1 | Connectors only validate settings. `syncDealToHubSpotConnector` returns a fake ID even when `HUBSPOT_DRIVER=live`; `executePayoutConnector` returns "Paid" with a fake reference even when `PAYOUT_DRIVER=wise/stripe` — a live setting would mark real payouts paid without paying | Each connector gets a real `live` implementation behind the same interface, or the `live` option is removed until it exists. A live payout driver must never set "Paid" without a confirmed provider response |
| G2 | Email ignores `EMAIL_DRIVER`; it's hard-wired to Gmail (`service: "gmail"`) in `src/app/api/[resource]/route.ts` | Email connector with `local` (outbox/Mailpit) and `smtp` (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`) drivers. Gmail becomes just one SMTP config. Move email code out of the route file |
| G3 | `STORAGE_DRIVER` is never used | Storage connector: `disk` (outside `public/`) and `s3` (`S3_ENDPOINT`, `S3_BUCKET`, keys). All uploads and downloads go through it |
| G4 | No migration history (`prisma db push` only; no `prisma/migrations`) | Baseline migration from the current schema; use `prisma migrate dev` locally and `prisma migrate deploy` in production; remove `db:push` from the normal workflow |
| G5 | No `APP_BASE_URL`; redirects jump between `127.0.0.1` and `localhost` | One `APP_BASE_URL` setting used for every absolute link and redirect |
| G6 | Scheduler only runs when a logged-in coworker calls it | Add a cron-safe trigger: `POST /api/scheduler` accepts `Authorization: Bearer $CRON_SECRET` (fail closed if unset); document a local runner (`npm run scheduler`) and the production cron |
| G7 | No health check | `/api/health`: database reachable, migrations current, required settings present; no secrets in output |
| G8 | Cookies lack `Secure` | `secure: true` when `APP_BASE_URL` is `https` |
| G9 | No import | CSV import for partners, contacts, leads, deals, customers, transactions, rewards and payouts, with a dry-run preview, row-level errors and an audit entry — needed to move real partners off Kiflo |
| G10 | Seed and test accounts could reach production | Seed refuses to run when `NODE_ENV=production`; test accounts flagged and blocked from signing in in production |
| G11 | Files over 60 KB: `manage/page.tsx` (90 KB), `api/[resource]/route.ts` (65 KB), `AppShell.tsx` (64 KB) | Split into modules (one route handler per resource, one component per Manage module) before adding features to them |
| G12 | `docs/reference/kiflo-teardown.md` is a 1.9 KB stub | Don't expand it from memory. Ray will supply the full Notion export; until then mark it "STUB — not the source of truth" |

### 16.4 Parity fixes
| # | Problem | Fix |
|---|---|---|
| P1 | Payout totals are stored, not calculated: PO-2026-04 shows SGD 2,268, its rewards total SGD 3,780; PO-2026-02 is "Paid" SGD 6,400 with no linked rewards. Rewards link by a `payoutNumber` string | Real relation reward → payout; payout amount always computed from linked rewards; a payout can't be paid with zero rewards; fix seed data |
| P2 | Accepting an applicant from the Strategic program put Meridian's email on "Global Affiliate & Referral Network" and its portal on the Strategic pipeline | The accepted partner joins the program the application was made to; email and pipeline use that program; fixture |
| P3 | Custom workflows: IF and THEN are free-text boxes; only the built-in invitation reminder runs | Structured conditions (field, operator, value) and actions (send email template, wait N days, create task, update field), executed by the scheduler, each run logged |
| P4 | Account Mapping: overlaps are typed in as pre-matched pairs; no file upload or matching | CSV upload of Eber's list and each partner's list; overlaps computed by normalised domain and company name |
| P5 | Rate steps (e.g. 20% → 10%) only come from the template; not visible or editable | Show and edit rate steps in the rule form |
| P6 | Custom properties: not confirmed in forms and list columns | Custom fields appear in create/edit forms, detail pages, list columns, filters and export; fixture |

### 16.5 Repo visibility (Ray's decision, not yours)
The repo is public. It contains Eber's Kiflo account ID, is named `r-prm-kiflo-clone`, and includes the Kiflo teardown. No real partner data or secrets were found. Recommend making it private again; never commit `.env`, real data or Kiflo text.

### 16.6 Slice order
1. S1, S2, S10 (secrets out of code, real logout, Next.js patch)
2. S7, S5, S6, S3 (user table, per-user passwords, exact match, server sessions)
3. S9 + G5 (activation and set-password flow, base URL)
4. S4 + G3 (secure uploads through storage connector)
5. S8, S11, S12, S13
6. G4 (baseline migration) — before any further schema change
7. G2, G1 (real email driver; real or removed live drivers)
8. G6, G7, G8, G10
9. P1, P2
10. G11 (split large files)
11. P3, P4, P5, P6, G9
12. Rewrite `docs/GO-LIVE.md` so every line is true

### 16.7 Acceptance checks Ray's reviewer will run
| Check | Expected |
|---|---|
| `grep` for secret or password literals in `src/` | None |
| Start with `SESSION_SECRET` unset | Refuses to start |
| Admin Log out, then `/api/partners` | 401 |
| Session older than its expiry | 401 |
| Logged out: upload, and download of an uploaded file | 401 |
| Invite a partner → open link logged out → set password → sign in | Works; reused link refused |
| Activation link host | From `APP_BASE_URL` |
| Raw bank value in Postgres | Ciphertext |
| `EMAIL_DRIVER=smtp` with Mailpit SMTP settings | Email arrives in Mailpit |
| `HUBSPOT_DRIVER=live` / `PAYOUT_DRIVER=wise` without a real implementation | Refuses to start (not fake success) |
| `prisma/migrations` | Exists; `prisma migrate status` clean |
| `/api/health` | 200 with checks, no secrets |
| Scheduler with `CRON_SECRET`, no session | Runs |
| Each payout amount | Equals the sum of its linked rewards |
| Accept an applicant from program X | Email, pipeline and partner record all program X |
| `npm ls next` | ≥ 14.2.25 |
| Files in `src/` | None over 60 KB |
| Everything in §14.4, §15.3 and §16.1 | Still passing |
