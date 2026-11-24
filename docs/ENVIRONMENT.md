# ENVIRONMENT.md — R-PRM Environment & Database Configuration

## Required Environment Variables (`.env`)
- `DATABASE_URL`: PostgreSQL 16 connection string:
  ```env
  DATABASE_URL="postgresql://raymondleong@127.0.0.1:5432/rprm_kiflo_parity?schema=public"
  ```
  *(Note: `prisma/dev.db` SQLite file has been retired and deleted per §14.2 Slice 3 / §15.2 Slice 1.)*
- `SHOW_DEV_LOGINS` *(optional, local dev only)*: Set `SHOW_DEV_LOGINS=true` when `NODE_ENV !== 'production'` to display test login hints on `/login` and `/p/login`. Must remain unset/`false` in production.
- **Outside-Service Connector Selectors (§13.2 — Fail Closed if `live` selected without secrets):**
  - `EMAIL_DRIVER`: `local` (default) | `smtp` (requires `SMTP_USER` and `SMTP_PASS`)
  - `STORAGE_DRIVER`: `disk` (default) | `s3` (requires `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`)
  - `PAYOUT_DRIVER`: `manual` (default) | `wise` | `stripe` (requires `PAYOUT_API_KEY`)
  - `HUBSPOT_DRIVER`: `mock` (default) | `live` (requires `HUBSPOT_PRIVATE_APP_TOKEN`)
  - `FX_DRIVER`: `table` (default) | `api` (requires `FX_API_KEY`)
  - `SSO_DRIVER`: `local` (default) | `saml` (requires `SAML_IDP_LOGIN_URL`, `SAML_IDP_CERT`)

## Local PostgreSQL 16 Service Commands
- Start service: `/opt/homebrew/bin/brew services start postgresql@16`
- Check status: `/opt/homebrew/opt/postgresql@16/bin/pg_isready`

## Running Commands (Bound to `127.0.0.1`)
- `npm run dev` — Start development server on `http://127.0.0.1:3000` (`next dev -H 127.0.0.1`)
- `npm test` — Run automated known-answer parity & contract fixture suite against PostgreSQL (`tests/parity-fixtures.test.ts`)
- `npm run build` — Run typecheck and Next.js production build
- `npm run start -- -p 3000` — Start production server bound to `127.0.0.1:3000` (`next start -H 127.0.0.1`)
