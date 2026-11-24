# GO-LIVE.md — R-PRM Production Cutover Runbook (§16 Go-Live Readiness)

> **Purpose:** Every step required to take R-PRM from local verification (`http://127.0.0.1:3000`) to production go-live requires **only environment variables, external accounts, and DNS configuration — zero code changes**.
> **Rule (§16.0):** Every line in this file matches the running code at the commit it is written in.

---

## 1. Environment Variables & Fail-Closed Startup (`src/lib/config.ts`, `src/lib/connectors.ts`)

All secrets and driver selections are validated by `loadAndValidateAppSecrets()` (`src/lib/config.ts`) and `loadAndValidateConnectorConfig()` (`src/lib/connectors.ts`). **There are zero secret fallbacks or hard-coded passwords in `src/`.**

### 1.1 Required Core Environment Variables (App Refuses to Start if Missing or Invalid)

| Variable | Requirement | Enforcement in Code |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection URL (`postgresql://...`) | Validated by `loadAndValidateConnectorConfig()`. Must start with `postgres://` or `postgresql://`. |
| `SESSION_SECRET` | `>= 32` bytes (e.g. `openssl rand -hex 32`) | Validated by `getSessionSecret()` in `src/lib/config.ts`. Used to HMAC-sign session ID cookies (`rprm_session`). Throws `FAIL_CLOSED` if unset or `< 32` characters. |
| `BANK_ENCRYPTION_KEY` | `>= 32` bytes (e.g. `openssl rand -hex 32`) | Validated by `getBankEncryptionKeyBuffer()` in `src/lib/config.ts`. Used for AES-256-GCM encryption (`enc:v1:<iv>:<tag>:<ciphertext>`) of `Partner.bankDetailsJson`. Throws `FAIL_CLOSED` if unset or `< 32` characters. |
| `APP_BASE_URL` | Base origin (e.g. `https://partners.eber.co` in prod, `http://127.0.0.1:3000` in dev) | Used by `getAppBaseUrl()` in `src/lib/config.ts` to build activation links (`/p/activate?token=...`), public forms, and referral URLs. When `APP_BASE_URL` starts with `https://`, session cookies set `secure: true` (`G8`). |
| `CRON_SECRET` | High-entropy bearer secret (`>= 16` chars) | Checked by `POST /api/scheduler` (`src/app/api/scheduler/route.ts`) when called headlessly via `Authorization: Bearer $CRON_SECRET`. Fails closed (`HTTP 503`) if `CRON_SECRET` is unset. |

### 1.2 Seed-Only Environment Variables (Refused in Production)

| Variable | Requirement | Enforcement in Code |
|---|---|---|
| `SEED_ADMIN_PASSWORD` | Password used by `prisma/seed.ts` to hash coworker accounts | `prisma/seed.ts` refuses to run when `NODE_ENV=production` (`S5`, `G10`) and throws if `SEED_ADMIN_PASSWORD` or `SEED_PARTNER_PASSWORD` is missing. |
| `SEED_PARTNER_PASSWORD` | Password used by `prisma/seed.ts` to hash seeded partner accounts | Hashed with a per-user random 16-byte salt (`scrypt:<saltHex>:<keyHex>`) into the `User` table (`S6`, `S7`). |

---

## 2. Connector Drivers: Implemented Live vs Fail-Closed (`§16.3 G1 & G2`)

Every external boundary is controlled by a driver environment variable in `src/lib/connectors.ts`. Drivers that are not implemented in code **fail closed (`FAIL_CLOSED`)** when selected rather than returning fake success.

| Boundary | Driver Variable | Implemented Values (Working Today) | Unimplemented Values (Fail Closed with Explicit Error) |
|---|---|---|---|
| **Outbound Email** | `EMAIL_DRIVER` | `local` (writes escaped HTML to in-app Outbox `ManageItem`)<br>`smtp` (delivers real email via `nodemailer` using `SMTP_HOST`, `SMTP_PORT`, optional `SMTP_USER`/`SMTP_PASS`, `EMAIL_FROM` — works with local Mailpit or authenticated SMTP like Gmail/SendGrid/Postmark) | If `EMAIL_DRIVER=smtp` and `SMTP_HOST` is missing, throws `FAIL_CLOSED`. |
| **File Storage** | `STORAGE_DRIVER` | `local` (writes uploaded files to private `storage/uploads/` outside `public/` with a 15 MB size limit and extension allowlist; served only through authenticated `GET /api/files/[key]`) | `s3` — **Not implemented yet.** Setting `STORAGE_DRIVER=s3` throws `FAIL_CLOSED: STORAGE_DRIVER=s3 is not implemented in code yet`. |
| **Payout Provider** | `PAYOUT_DRIVER` | `manual` (records manual bank transfer reference and marks payout `Paid`) | `wise`, `stripe` — **Not implemented yet.** Setting `PAYOUT_DRIVER=wise` or `stripe` throws `FAIL_CLOSED`. |
| **CRM Sync** | `HUBSPOT_DRIVER` | `disabled` (logs skipped CRM sync locally) | `live` — **Not implemented yet.** Setting `HUBSPOT_DRIVER=live` throws `FAIL_CLOSED`. |
| **FX Rates** | `FX_DRIVER` | `table` (uses dated FX rate table in `src/lib/prmEngine.ts`) | `api` — Throws `FAIL_CLOSED` unless `FX_API_KEY` is provided. |
| **SSO / SAML** | `SSO_DRIVER` | `password` (database-backed `User` + server-side `Session` + TOTP MFA) | `saml` — Throws `FAIL_CLOSED` unless `SAML_ENTRY_POINT` and `SAML_CERT` are provided. |

---

## 3. Database & Baseline Migration (`§16.3 G4`)

1. Provision a PostgreSQL 16 database (`rprm_kiflo_parity` or production equivalent).
2. Set `DATABASE_URL` in the environment.
3. Apply the committed baseline migration (`prisma/migrations/0001_baseline/migration.sql`):
   ```bash
   npx prisma migrate deploy
   ```
4. Verify migration status:
   ```bash
   npx prisma migrate status
   # Output: 1 migration found in prisma/migrations — Database schema is up to date!
   ```
5. **Production note (`G10`):** Do **not** run `npx prisma db seed` in production (`prisma/seed.ts` aborts immediately when `NODE_ENV=production`). Instead, create the initial coworker Administrator user or import real records via the CSV Importer (`CSV_IMPORT`).

---

## 4. Health Check & Scheduler Wiring (`§16.3 G6 & G7`)

### 4.1 Health Endpoint (`GET /api/health`)
- Publicly reachable for load-balancer probes (`src/middleware.ts` allows `/api/health`).
- Returns `HTTP 200` (`status: "ok"`) when:
  1. `SESSION_SECRET` and `BANK_ENCRYPTION_KEY` pass length validation (`secretsValid: true`).
  2. PostgreSQL is reachable (`SELECT 1`).
  3. Prisma `_prisma_migrations` confirms `0001_baseline` is applied (`appliedMigrations >= 1`).
  4. All configured connector drivers pass `loadAndValidateConnectorConfig()`.
- Never outputs any secret values.

### 4.2 Durable Scheduler (`POST /api/scheduler` & `npm run scheduler`)
- To trigger scheduled jobs from system cron, Kubernetes CronJob, or GitHub Actions without a browser session:
  ```bash
  curl -X POST "$APP_BASE_URL/api/scheduler" \
    -H "Authorization: Bearer $CRON_SECRET" \
    -H "Content-Type: application/json" \
    -d '{"job":"all"}'
  ```
- Or run the local CLI helper:
  ```bash
  npm run scheduler
  ```
- Jobs executed and logged to `WorkflowRunLog`:
  1. `invitation_nurture` (2d reminder → 3d reminder → 2d internal task).
  2. `deal_expiration` (30d/7d/1d warnings + auto-expire).
  3. `monthly_payouts` (auto-bundles validated rewards meeting threshold).
  4. `custom_workflows` (evaluates structured conditions `field / operator / value` and runs structured actions `send_email | wait_days | create_task | update_field`).

---

## 5. Security & Data Protection Verification Checklist

- **Server-side Sessions (`S2`, `S3`):** Every login creates a row in the `Session` table (`id`, `userId`, `impersonatingPartnerId`, `createdAt`, `expiresAt`, `revokedAt`). The `rprm_session` cookie holds only `<sessionId>.<hmacSignature>`. Logging out or changing a password revokes the server-side `Session` row immediately.
- **Private Uploads (`S4`, `G3`):** `POST /api/upload` requires an authenticated session (`401` if logged out), enforces a 15 MB size limit and extension allowlist (`.pdf`, `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.doc`, `.docx`, `.xls`, `.xlsx`, `.ppt`, `.pptx`, `.csv`, `.txt` — `.html` is rejected with `400`), stores files in `storage/uploads/` outside `public/`, and serves them only via `GET /api/files/[key]` (`401` when logged out).
- **Bank Details Encryption at Rest (`S8`):** Every write to `Partner.bankDetailsJson` encrypts the JSON with AES-256-GCM (`enc:v1:...`). Raw database queries see only ciphertext. Decryption occurs only on single-partner reads (`GET /api/partners?id=...`) for authorized roles (`Administrator`, `Manager`, or the partner's own `Manager`).
- **Single-Use Hashed Activation Tokens (`S9`, `G5`):** Accepting a partner application or inviting a partner contact generates a 32-byte random token, stores only its SHA-256 hash in `ActivationToken` with a 72-hour expiry, and emails `${APP_BASE_URL}/p/activate?token=<rawToken>`. Visiting `/p/activate` lets the invitee set their own password, marks `usedAt`, and signs them in. Reusing or using an expired token is refused (`400`).
