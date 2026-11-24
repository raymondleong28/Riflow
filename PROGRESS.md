# R-PRM (Kiflo PRM Clone) — Build Progress & Hosting Migration Guide

## Completed Checkpoints (100% Complete)

- [x] **Phase 1: Foundation, Complete Database Schema, Seed Data & Global Shell**
  - Next.js 14 (App Router) + TypeScript + Tailwind CSS (Blue theme + **"R"** logo)
  - Full Prisma ORM schema ([schema.prisma](prisma/schema.prisma)) + synthetic seed script ([seed.ts](prisma/seed.ts))
  - Live Home Dashboard (`/dashboard`) with 8 active widgets, 12-month stacked transaction bar chart, reward validation table, and 9-category / 23-widget `Add widget` slide-over drawer.
- [x] **Phase 2: Partners Suite & Partner Programs**
  - Partners Directory (`/partners/views/all`) with 14 columns & `Add a new partner` modal
  - 2-Column Partner Detail (`/partners/[id]`) with `Open partner portal` preview, inline level customization, onboarding progress, rewards, links, and certifications
  - Partner Team Members (`/team-members/views/all`)
  - Partner Prospection Kanban (`/partner-prospection/views/all`)
  - Partner Onboarding Kanban (`/partner-onboarding/[id]`)
  - Partner Programs (`/programs/views/all`) & Program Detail (`/programs/[id]`) with Tier Level Rewards/Benefits/Requirements builders, Tracking Links, and Role Permissions Matrix (`Manager`, `Sales Rep`, `Stakeholder`).
- [x] **Phase 3: Revenue Pipeline — Leads, Deals, Customers, Tasks & Business Plans**
  - Leads (`/leads/views/all`) & Lead Detail (`/leads/[id]`) with 1-click **`Convert to deal`** and HubSpot sync card
  - Deals (`/deals/views/all`) with **10-Stage Kanban Board** & **16-Column Table View**, 3-Step `Register deal` wizard, Deal Detail (`/deals/[id]`), Customer association, and automatic 18% Pending Commission Reward generation on `Closed Won`
  - Customers (`/customers/views/all`), Tasks (`/tasks/views/all`), and Business Plans (`/business-plans/views/all`).
- [x] **Phase 4: Financials & Account Mapping (5 Pages)**
  - Transactions (`/transactions/views/all`) with Stripe `Pull` sync & multi-currency entry
  - Rewards (`/rewards/views/all`) with validation workflow
  - Payouts (`/payouts/views/all`) with batch reward aggregation & invoice tracking
  - Account Mapping Overview (`/account-mapping-overview` 3×3 Overlap Matrix), Accounts (`/accounts/views/all`), Grouped-Header Overlaps (`/overlaps/views/all`), Collaborations (`/collaborations/views/all`), and Data Sources (`/data-sources`).
- [x] **Phase 5: Manage Hub (14 Sub-Modules), Account Settings (12 Categories), User Preferences (5 Tabs) & Help Center**
  - Manage Hub (`/manage`) covering all 14 sub-modules (`Assets`, `Certifications`, `Email setup` CNAME validator, `Email templates`, `Groups` 14-column table, `Help Center`, `Integrations` 14 cards, `News`, `Partner dashboards`, `Partner directories`, `Partner onboarding`, `Products`, `Team`, `Workflows`)
  - Account Settings (`/account` & `/account/[tab]`) across all 12 categories (including Custom Properties builder across 10 object types, `r.js` snippet & API tokens, and `Insert Test data` / `Reset data`)
  - User Preferences (`/settings` & `/settings/[tab]`) across all 5 tabs (`Profile`, `Security`, `Notifications` matrix, `Calendar`, `Connected apps`)
  - Help Center (`/help`).

---

## Running Locally

```bash
npm run dev
```

Open `http://localhost:3000`.

## Migrating Internal SQLite DB to Hosted PostgreSQL (Vercel / Railway / Supabase / Neon)

1. In [prisma/schema.prisma](prisma/schema.prisma), change `provider = "sqlite"` to `provider = "postgresql"`.
2. Set `DATABASE_URL="postgresql://user:pass@host:5432/rprm"` in your hosting environment.
3. Run:
   ```bash
   npx prisma db push && npm run db:seed
   ```
