# GO-LIVE.md — R-PRM Production Readiness & Go-Live Checklist (§13.6)

> **Status:** Local-complete build active on `127.0.0.1:3000` with `local` drivers.
> Complete every item below before switching drivers from `local` to `live` or entering real partner/banking data.

---

## 1. Go-Live Blockers (Must Pass Before Real Data Enters)

- [ ] **BLOCKER 1 — Bank Details Lockdown (§13.1):**
  - Confirmed in code: `/api/partners` list endpoint strips `bankDetailsJson` from all collection responses.
  - `bankDetailsJson` is encrypted at rest (`AES-256-GCM` via `BANK_ENCRYPTION_KEY`) and returned only on single-partner requests (`/api/partners?id=...`) to authenticated Admin coworkers or the partner's own Main Contact.
  - **Go-live step:** Provision a 32-byte production `BANK_ENCRYPTION_KEY` in the host secret manager and pass security review before collecting real partner bank details.
- [ ] **BLOCKER 2 — Managed PostgreSQL & Tested Backup/Restore:**
  - Switch `prisma/schema.prisma` datasource provider to `"postgresql"`, run reviewed migrations against managed PostgreSQL, and verify point-in-time recovery (PITR) restore into a staging database.
- [ ] **BLOCKER 3 — HTTPS, Domain & Cookie Lockdown:**
  - Terminate TLS on the production domain (`app.partners.eber.co` / `partners.eber.co`).
  - Set `NODE_ENV=production` so `rprm_session` cookies enforce `Secure; HttpOnly; SameSite=Lax`.
- [ ] **BLOCKER 4 — Legal & PDPA Review:**
  - Counsel sign-off on clean-room R-PRM copy and Kiflo terms of service (§1.3).
  - Legal/DPO approval of the **Eber General Terms 7.2** PDPA prospect consent wording on `/forms/lead/[token]` and `/forms/apply/[programId]`.
- [ ] **BLOCKER 5 — Test Accounts Disabled & `SHOW_DEV_LOGINS` Off (§14.2 Slice 5):**
  - Ensure all synthetic test accounts (`alex@r-prm.example.com`, `sarah@r-prm.example.com`, `jordan.lee@apexcloud.example.com`, etc.) are removed or disabled before production launch.
  - Ensure `SHOW_DEV_LOGINS` is unset / `false` and `NODE_ENV=production` so neither `/login` nor `/p/login` renders any test account hints.

---

## 2. Outside-Service Connector Switchover Table (§13.2 & §13.4)

Every connector fails closed at startup if switched to `live` without its required environment variables.

| Connector | Env Selector | Local Driver (Default) | Live Driver & Required Secrets | Contract Test Command | Rollback Step |
|---|---|---|---|---|---|
| **Email** | `EMAIL_DRIVER` | `local` (In-app Outbox / Mailpit) | `smtp` (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`, SPF/DKIM/DMARC verified) | `npm test` (Email connector contract) | Set `EMAIL_DRIVER=local` & redeploy |
| **File Storage** | `STORAGE_DRIVER` | `disk` (`public/uploads/`) | `s3` (`S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, Cloudflare R2 / AWS S3) | `npm test` (Storage connector contract) | Set `STORAGE_DRIVER=disk` & restore volume |
| **Payouts** | `PAYOUT_DRIVER` | `manual` (Admin mark-as-paid + reference) | `wise` / `stripe` / `paypal` (`PAYOUT_API_KEY`, `PAYOUT_WEBHOOK_SECRET`) | `npm test` (Payout connector contract) | Set `PAYOUT_DRIVER=manual` |
| **HubSpot CRM** | `HUBSPOT_DRIVER` | `mock` (10-stage local mapping & sync log) | `live` (`HUBSPOT_PRIVATE_APP_TOKEN`, `HUBSPOT_WEBHOOK_SECRET`) | `npm test` (HubSpot 10-stage mapping contract) | Set `HUBSPOT_DRIVER=mock` |
| **Exchange Rates** | `FX_DRIVER` | `table` (Dated in-app MAS/ECB FX table) | `api` (`FX_API_URL`, `FX_API_KEY`, daily cron fetch) | `npm test` (Dated FX conversion contract) | Set `FX_DRIVER=table` |
| **SSO (SAML 2.0)** | `SSO_DRIVER` | `local` (Local test IdP) | `saml` (`SAML_IDP_LOGIN_URL`, `SAML_IDP_CERT`, `SAML_SP_ENTITY_ID`) | `npm test` (SSO metadata contract) | Set `SSO_DRIVER=local` (fallback to password + TOTP MFA) |
