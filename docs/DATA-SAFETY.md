# DATA-SAFETY.md — Data Safety & Integrity Policy

1. **No Unapproved Destructive Resets (§1.4):**
   - No automated script, build step, or agent test may truncate or reset the database.
   - The UI `Account Settings → Account data → Reset data` button is gated behind an explicit typed confirmation (`RESET`) and logs to the Audit Log.
2. **Computed Facts Only:**
   - Every KPI on the Dashboard, Partner directory, Partner detail KPI strip, and Account Mapping 3×3 matrix is computed dynamically from underlying records (`leads`, `deals`, `transactions`, `rewards`, `accounts`).
3. **Honest Lookup States:**
   - Every lookup endpoint and detail page distinguishes between:
     - `found` (renders record)
     - `not_found` (renders explicit Not Found state with link back)
     - `error` / `could_not_check` (renders explicit error banner with reason, never disguised as `0` or empty array).
4. **Synthetic Data Only:**
   - All development and test records are 100% synthetic. No live Kiflo partner, contact, deal, lead, or banking data is ever copied into R-PRM.
