# ENVIRONMENT.md — R-PRM Environment & Database Configuration

## Required Environment Variables (`.env`)
- `DATABASE_URL`: Relational database connection string (local SQLite `file:./dev.db` or PostgreSQL `postgresql://...`).
- `GMAIL_USER` *(optional)*: Gmail address for outbound SMTP email delivery via `smtp.gmail.com`.
- `GMAIL_APP_PASSWORD` *(optional)*: 16-character Google App Password (stored in environment or encrypted setting, never exposed in URLs).

## Running Commands
- `npm run dev` — Start development server on `http://localhost:3000`
- `npm test` — Run automated known-answer parity fixture suite (`tests/parity-fixtures.test.ts`)
- `npm run build` — Run typecheck and Next.js production build
