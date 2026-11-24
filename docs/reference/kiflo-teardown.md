# Kiflo Teardown Reference Specification

> Consolidated behavioural specification from the live Kiflo PRM (`app.kiflo.com`) crawl and audit report (`AGENTS.md`).

## 1. Reward & Commission Engine (§4.1)
- **Triggers:**
  - `deal_closed_won` (When a deal stage moves to Closed Won)
  - `transaction_paid` (On every paid transaction from a won deal)
  - `lead_accepted` (When a partner-submitted lead is accepted)
  - `lead_converted` (When a partner-submitted lead converts to a deal)
- **Value Types:** `Cash`, `Coupon`, `Gift card`, `Credit`
- **Amount Modes:** `percentage` (% of transaction/deal amount) or `fixed` (fixed amount + currency)
- **Duration & Stepping:**
  - `one_off` (Single reward, with optional `startOffsetMonths`, e.g., earned when month-4 invoice is paid)
  - `recurring` (Recurring for `durationMonths`, with optional `rateSteps`: e.g., `20%` for months `4–15`, `10%` for months `16–27`)
- **Validation & Clawback:**
  - `requiresValidation`: creates reward in `Pending` state until validated by admin.
  - `clawbackOnRefund`: refunding a transaction creates a negative clawback reward adjustment.

## 2. Onboarding 6 Action Types (§4.5)
1. `view_asset`: Title, Description, Asset ID (from Assets)
2. `read_article`: Title, Description, Article ID (from Help Center)
3. `upload_document`: Title, Description, Require admin validation, Document title
4. `provide_information`: Title, Description, Require validation, Dynamic field list
5. `book_meeting`: Title, Description, Calendar type (`Calendly | HubSpot | Other`), Calendar link
6. `self_invoicing_opt_in`: Title, Description (toggles partner self-invoicing flag)

## 3. Asset & Content Scoping (§4.3)
- `accessScope`: `"my_team"` (Admin/Coworkers only) | `"everyone"` (All active partners) | `"some_partners"` (Filtered by `allowedPrograms`, `allowedLevels`, `allowedGroups`, `allowedPartnerIds` combined with `OR`).
