# CLEANUP.md — temporary

> Used once for AGENTS.md §3.1, then deleted. Lists the third-party product traces to remove.
> After deleting this file, nothing in the working tree should mention these terms.

## Terms to remove everywhere (case-insensitive)
- `kiflo`
- `68128177` (an external account ID)
- `parity` and `clone` where they describe copying another product
- `app.kiflo.com`

## Known locations (24 Nov 2026, commit 92f1967)
| File | What to change |
|---|---|
| `package.json`, `package-lock.json` | Package name `r-prm-kiflo-clone` → `r-prm` (regenerate the lock file with `npm install`) |
| `src/app/layout.tsx` | Page `description` metadata ("cloned from …") → R-PRM's own description |
| `src/app/account/page.tsx` | Settings subtitle ("…-parity configuration tabs"); "DEAL SETTINGS (All 9 … Deal Options)" comment; tracking snippet `data-account="68128177"` → workspace ID |
| `src/app/partner-onboarding/[id]/page.tsx` | `KIFLO_6_ACTION_TYPES` → `ONBOARDING_ACTION_TYPES`; comments and the "(6 … Action Types)" heading |
| `src/components/AppShell.tsx` | Logo comment |
| `src/app/overlaps/views/all/page.tsx` | Column-band comment |
| `src/lib/prmEngine.ts` | Lead-form salt string (also replaced entirely by AGENTS.md F2) |
| `prisma/seed.ts` | Integrations comment; move all demo data to `demo:seed` (AGENTS.md §3.2) |
| `docs/reference/kiflo-teardown.md` | Delete file and the `docs/reference/` folder |
| `docs/*.md`, `PROGRESS.md` | Rewrite per AGENTS.md §3.1 step 4 |
| Branch `antigravity/kiflo-parity` | Retired; work continues on `develop` |

## Verification (paste output in the report, then delete this file)
```bash
grep -rniE "kiflo|68128177" . --exclude-dir=.git --exclude-dir=node_modules --exclude=CLEANUP.md
grep -rniE "\b(parity|clone[d]?)\b" src prisma docs README.md package.json
```
Both must print nothing.
