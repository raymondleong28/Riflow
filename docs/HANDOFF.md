# HANDOFF.md — R-PRM Kiflo Parity Build (§13 Local-Complete Build)

> Updated: 24 Nov 2026 (Post-13:50 Re-Audit Complete)
> Branch: `antigravity/kiflo-parity`
> Sole Code Writer: Antigravity (`AGENTS.md` §1.1)

---

## 1. Completed Slices (§13.7 Local-Complete Build Order)

| Slice | Requirement | Status | Key Files & Verification |
| :--- | :--- | :--- | :--- |
| **1. One source of truth** | Retire `/api/prm` (`410 Gone`), store normalized `StructuredRewardRule` objects in `Program.levelsJson` in SQLite, and route all reads/mutations through per-object `/api/[resource]` endpoints | **DONE** | [src/app/api/prm/route.ts](file:///Users/raymondleong/Downloads/Antigravity%20playground/Kiflo%20Copy%20Test/src/app/api/prm/route.ts), [src/app/api/[resource]/route.ts](file:///Users/raymondleong/Downloads/Antigravity%20playground/Kiflo%20Copy%20Test/src/app/api/%5Bresource%5D/route.ts), [src/context/PrmContext.tsx](file:///Users/raymondleong/Downloads/Antigravity%20playground/Kiflo%20Copy%20Test/src/context/PrmContext.tsx), [scripts/sync-single-store.ts](file:///Users/raymondleong/Downloads/Antigravity%20playground/Kiflo%20Copy%20Test/scripts/sync-single-store.ts) |
| **2. Real auth, sessions & server-side scoping** | `scrypt` password hashes, HMAC-SHA256 `httpOnly` cookie (`rprm_session`), Edge middleware protecting admin/portal/API routes, DB-assigned roles (no self-chosen role dropdown, no pre-filled password), server-side session scoping on `/api/assets` & partner APIs, `bankDetailsJson` stripped from `/api/partners` list | **DONE** | [src/lib/authSession.ts](file:///Users/raymondleong/Downloads/Antigravity%20playground/Kiflo%20Copy%20Test/src/lib/authSession.ts), [src/middleware.ts](file:///Users/raymondleong/Downloads/Antigravity%20playground/Kiflo%20Copy%20Test/src/middleware.ts), [src/app/api/auth/route.ts](file:///Users/raymondleong/Downloads/Antigravity%20playground/Kiflo%20Copy%20Test/src/app/api/auth/route.ts), [src/app/login/page.tsx](file:///Users/raymondleong/Downloads/Antigravity%20playground/Kiflo%20Copy%20Test/src/app/login/page.tsx), [src/app/p/login/page.tsx](file:///Users/raymondleong/Downloads/Antigravity%20playground/Kiflo%20Copy%20Test/src/app/p/login/page.tsx) |
| **3. Audit log writes** | `/api/audit` returns real entries and every create/update/delete/auth/impersonation/scheduler action writes to `AuditLog` | **DONE** | [src/app/api/audit/route.ts](file:///Users/raymondleong/Downloads/Antigravity%20playground/Kiflo%20Copy%20Test/src/app/api/audit/route.ts), [src/app/api/[resource]/route.ts](file:///Users/raymondleong/Downloads/Antigravity%20playground/Kiflo%20Copy%20Test/src/app/api/%5Bresource%5D/route.ts) |
| **4. Reward generation from partner tier level rules** | Rewards generated from the partner's actual Program Level rules (`getPartnerLevelRules` / `generateRewardsFromPartnerLevel`). `Apex Cloud Solutions Pte Ltd` (`Platinum Elite`, 25% + 5%) on `SGD 28,500` (`tx-1`) produces **`SGD 7,125`** (`RW-1041`) and **`SGD 1,425`** (`RW-1040`); `/p` displays the partner's actual level rules | **DONE** | [src/lib/prmEngine.ts](file:///Users/raymondleong/Downloads/Antigravity%20playground/Kiflo%20Copy%20Test/src/lib/prmEngine.ts), [src/app/p/page.tsx](file:///Users/raymondleong/Downloads/Antigravity%20playground/Kiflo%20Copy%20Test/src/app/p/page.tsx), [tests/parity-fixtures.test.ts](file:///Users/raymondleong/Downloads/Antigravity%20playground/Kiflo%20Copy%20Test/tests/parity-fixtures.test.ts) |
| **5. Public lead form unguessable token & consent** | `/forms/lead/[uuid]` uses an unguessable token (`lf_a4b4c406355ed9b9810f24e2` for `prt-1`), renders `"This link isn't valid"` for raw/unknown IDs (`/forms/lead/prt-1`), and enforces the **Eber General Terms 7.2** consent checkbox | **DONE** | [src/app/forms/lead/[uuid]/page.tsx](file:///Users/raymondleong/Downloads/Antigravity%20playground/Kiflo%20Copy%20Test/src/app/forms/lead/%5Buuid%5D/page.tsx), [src/app/api/public-forms/route.ts](file:///Users/raymondleong/Downloads/Antigravity%20playground/Kiflo%20Copy%20Test/src/app/api/public-forms/route.ts) |
| **6. Per-stage onboarding actions, 9 Deal settings & UI scrub** | Onboarding stage actions attached inside each individual stage column on `/partner-onboarding/[id]`; all 9 Deal settings options on `/account` (including channel-conflict detection for deals, deal resubmission, and automatic customer association); internal `(§...)` spec labels scrubbed from user-facing UI | **DONE** | [src/app/partner-onboarding/[id]/page.tsx](file:///Users/raymondleong/Downloads/Antigravity%20playground/Kiflo%20Copy%20Test/src/app/partner-onboarding/%5Bid%5D/page.tsx), [src/app/account/page.tsx](file:///Users/raymondleong/Downloads/Antigravity%20playground/Kiflo%20Copy%20Test/src/app/account/page.tsx) |
| **7. Connectors (`local` & `live` fail-closed)** | `email`, `storage`, `payouts`, `hubspot`, `fx`, `sso` drivers in `src/lib/connectors.ts` fail closed (`FAIL_CLOSED`) when a `live` driver is selected without credentials | **DONE** | [src/lib/connectors.ts](file:///Users/raymondleong/Downloads/Antigravity%20playground/Kiflo%20Copy%20Test/src/lib/connectors.ts), [docs/ENVIRONMENT.md](file:///Users/raymondleong/Downloads/Antigravity%20playground/Kiflo%20Copy%20Test/docs/ENVIRONMENT.md) |
| **8. Authenticator-app TOTP MFA** | RFC 6238 HMAC-SHA1 6-digit TOTP generator/verifier with one-time emergency recovery codes (no SMS) | **DONE** | [src/lib/connectors.ts](file:///Users/raymondleong/Downloads/Antigravity%20playground/Kiflo%20Copy%20Test/src/lib/connectors.ts), [src/app/account/page.tsx](file:///Users/raymondleong/Downloads/Antigravity%20playground/Kiflo%20Copy%20Test/src/app/account/page.tsx) |
| **9. Durable Scheduler & `127.0.0.1` binding** | `/api/scheduler` durable job runner for invitation nurture (Day 2/5 reminders + Day 7 task) and monthly automatic payout creation; `next dev` and `next start` bound to `-H 127.0.0.1` | **DONE** | [src/app/api/scheduler/route.ts](file:///Users/raymondleong/Downloads/Antigravity%20playground/Kiflo%20Copy%20Test/src/app/api/scheduler/route.ts), [package.json](file:///Users/raymondleong/Downloads/Antigravity%20playground/Kiflo%20Copy%20Test/package.json) |
| **10. `docs/GO-LIVE.md` checklist** | Production cutover checklist including bank-details lockdown as a go-live blocker | **DONE** | [docs/GO-LIVE.md](file:///Users/raymondleong/Downloads/Antigravity%20playground/Kiflo%20Copy%20Test/docs/GO-LIVE.md) |

---

## 2. Local Sign-In Credentials & Test Commands

- **Coworker (Admin) Login (`/login`)**:
  - Email: `alex@r-prm.example.com` (Administrator) or `sarah@r-prm.example.com` (Team Member)
  - Password: `RprmAdmin2026!`
- **Partner Portal Login (`/p/login`)**:
  - Email: `jordan@apexcloud.example.com` (Manager, Apex Cloud Solutions Pte Ltd)
  - Password: `RprmPartner2026!`
- **Apex Unguessable Public Lead Form URL**:
  - Valid token: `http://127.0.0.1:3000/forms/lead/lf_a4b4c406355ed9b9810f24e2`
  - Invalid/guessable ID test: `http://127.0.0.1:3000/forms/lead/prt-1` (renders `"This link isn't valid"`)
- **Run 11 Parity & §13 Contract Fixtures**:
  ```bash
  npm test
  ```

---

## 3. Protected Data Items Awaiting Owner Decision (§12 Q2)
- The preset reward `"SGD 1,000 Quarterly Quota Accelerator Bonus"` on Silver Tier remains untouched in `prog-strategic` per `AGENTS.md` §12 Q2 / §13.1 until Ray explicitly confirms whether to keep or remove it.
