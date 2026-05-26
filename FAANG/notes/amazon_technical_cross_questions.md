# 🛠️ Amazon SDE-1 — Elite Technical Cross-Questioning

> **Audience:** an SDE-3 / staff-engineer interviewer who will probe one technical decision at a time.
> **Format per question:** Question · Excellent Answer · Weak Answer (so you know what NOT to say) · Concise Senior Version · What the Interviewer Expects.

---

## 📋 Master question index

| # | Topic | Question |
|---|---|---|
| A1 | Architecture | Why two databases (MySQL + MSSQL)? |
| A2 | Architecture | Walk through the UPS schema. |
| A3 | Architecture | How does `fairInsertV2` work? |
| B1 | Concurrency | How is Be Back race-safe? |
| B2 | Concurrency | How does Birdeye guarantee exactly-once? |
| B3 | Concurrency | How does idle-lock re-auth handle races? |
| C1 | Data Model | Why is `form_json` a LONGTEXT JSON blob? |
| C2 | Data Model | How does `instance_index` handle a 4-chair package? |
| C3 | Data Model | Walk through invoice dedup logic. |
| D1 | Validation | Walk through the mandatory signature chain. |
| D2 | Validation | How do you handle partial failures in the daily job? |
| D3 | Validation | What's your error model? |
| E1 | Performance | Where are the bottlenecks? |
| E2 | Performance | How would you scale to 10 stores? |
| E3 | Performance | Tell me about an optimization you made. |
| F1 | Frontend | How does Redux fit into the app? |
| F2 | Frontend | Walk me through Focus Flow. |
| F3 | Frontend | How does the package-location dialog open? |
| G1 | Operations | How do you test without dedicated QA? |
| G2 | Operations | What's your observability story? |
| G3 | Operations | How do you deploy? |
| H1 | Specific Code | Show me where `withStoreTx` is implemented. |
| H2 | Specific Code | How does the seller-split CTE fall back? |
| H3 | Specific Code | What's the 12-employee schedule? |
| H4 | Specific Code | What's the schema migration convention? |
| H5 | Specific Code | What are the package allocator locations? |
| I1 | System Design | Design a queue for 10 stores, 1000 visits/day. |
| I2 | System Design | Design observability for this system. |
| J1 | Code Quality | Show me code you regret. |
| J2 | Code Quality | Where's the most over-engineered code? |
| J3 | Code Quality | Where's the worst naming? |

---

## 🅰️ ARCHITECTURE & DATABASE DESIGN

### A1 — "Why two databases (MySQL + MSSQL)? Why not consolidate?"

**EXCELLENT ANSWER**
> "MSSQL is the legacy ERP. It owns inventory — `ItemMaster`, `PackageMaster`, `ItemPackageMaster`, `InvMasterReport`. We don't own writes. Migrating it would mean a multi-quarter project to replace the buyer/inventory team's tools.
>
> MySQL is the operational system I own end-to-end — `ups_queue`, `ups_logs`, `ups_sessions`, `invoices_archive`, `customer_acquisition`, `customer_leads`, `customer_rts_entries`, `abandoned_up_logs`, `reminders`, `pkg_component_locations`, `manager_store_sessions`, `report_*` triad, `audit_results`.
>
> The cost of two databases is real: cross-DB joins are app-level. Two pools (`cfcFormPool`, `mssqlPool`) with helpers (`formQuery`, `runSql`). Hot read paths are single-row lookups so latency is fine."

**WEAK ANSWER**
> "We use MySQL for the app and MSSQL for inventory."

(No reasoning, no ownership context, no cost discussion.)

**CONCISE SENIOR VERSION**
> "Constraint, not a choice. ERP is MSSQL and read-only. We own MySQL for operational state. Cross-DB joins are app-level — acceptable because hot reads are single-row."

**WHAT THE INTERVIEWER EXPECTS**
- You acknowledge it's a constraint, not a design.
- You can name what each DB owns.
- You can name the integration cost.
- You can describe a future migration path (don't claim to do it today).

---

### A2 — "Walk me through the UPS schema."

**EXCELLENT ANSWER**
> "Five tables in the queue layer:
>
> 1. **`ups_queue`** — waiting line. One row per (user_id, store_name), UNIQUE.
> 2. **`ups_working_queue`** — currently with customer. `active_customers` supports stacked floor mode.
> 3. **`ups_logs`** — append-only audit. 20+ `action_type` ENUMs (`ups_taken`, `queue_join`, `break_start`, `break_end`, `be_back`, `be_back_accept`, `moved_to_working`, `abandoned_up`, `ups_handed_off`, `queue_leave`). `reason` JSON. `idx_ups_logs_store_action_date` for day aggregations.
> 4. **`ups_sessions`** — per-day fairness state. UNIQUE on `(user_id, store_name, business_date)`. `first_ups_at` is the eligibility flag — NULL until first take, then immutable for the day.
> 5. **`ups_finish_logs`** — paperwork timer. `(user_id, started_at, ended_at, duration_sec, workflow_type)`.
>
> The design separates **transient state** (`ups_queue`, `ups_working_queue` — wiped nightly by `dailyReset`) from **immutable audit** (`ups_logs`, `ups_sessions`, `ups_finish_logs` — never reset). Reports read from immutable audit; live board reads from transient. The 9 PM reset is safe by construction."

**WEAK ANSWER**
> "There's a queue table and a log table."

**CONCISE SENIOR VERSION**
> "Transient state in `ups_queue` + `ups_working_queue` (nightly reset). Immutable audit in `ups_logs` + `ups_sessions` + `ups_finish_logs`. Reports query audit; board queries state."

**WHAT THE INTERVIEWER EXPECTS**
- You can name every table without thinking.
- You explain *why* state vs audit are separated.
- You can describe the UNIQUE constraints and the role of `first_ups_at`.

---

### A3 — "Walk through `fairInsertV2` step by step."

**EXCELLENT ANSWER**
> "Inside `withStoreTx(store, async (conn) => …)`, so we hold `GET_LOCK('ups_queue_lock:'||store, 5)` and are in a transaction.
>
> 1. Load today's queue: `SELECT user_id, queue_position, ups_count FROM ups_queue WHERE store_name=? AND DATE(joined_at)=CURDATE() ORDER BY queue_position FOR UPDATE`. The DATE filter is the stale-queue-ghost defense.
> 2. Load joiner's session: `SELECT first_ups_at, ups_count FROM ups_sessions WHERE user_id=? AND store_name=? AND business_date=CURDATE() FOR UPDATE`.
> 3. Empty queue → joiner at position 1.
> 4. `first_ups_at IS NULL` → append at tail (ineligible).
> 5. Eligible → scan from position 2 forward. Insert before first incumbent whose `ups_count > joiner.ups_count`.
> 6. Position 1 never overwritten — `recycle` is the only way to move it.
> 7. Compress positions 1..N.
> 8. Write `ups_logs.action_type='queue_join'`.
>
> The eligibility gate is the key insight. It separates 'I'm new today' from 'I belong in rotation by ups count.'"

**WEAK ANSWER**
> "We sort by ups_count."

**CONCISE SENIOR VERSION**
> "Lock + FOR UPDATE on today's rows. Empty → pos 1. Ineligible (`first_ups_at IS NULL`) → tail. Eligible → insert before first incumbent with higher `ups_count`. Compress and audit."

**WHAT THE INTERVIEWER EXPECTS**
- You explain the eligibility rule and why it exists (anti-leapfrog).
- You can defend the `DATE(joined_at) = CURDATE()` filter (stale-ghost defense).
- You acknowledge position 1 is privileged (manager recycle only).

---

## 🅱️ CONCURRENCY, RACES, IDEMPOTENCY

### B1 — "Walk through how Be Back is race-safe."

**EXCELLENT ANSWER**
> "Single transaction in `executeOneClickHandoff`:
> 1. Verify origin is in `ups_working_queue` (`FOR UPDATE`).
> 2. Verify selected is in waiting or working with `active_customers < 6` (`FOR UPDATE`).
> 3. Remove origin from working; decrement `ups_count`.
> 4. If selected in working → +1 active_customers, +1 ups_count. If in waiting → delete from waiting, insert into working, +1 ups_count.
> 5. Reinsert origin at position 1 of waiting.
> 6. Compress waiting positions.
> 7. Write three audit rows: `be_back`, `be_back_accept`, `moved_to_working`.
>
> Inside `withStoreTx` so it's serialized against concurrent `/take`, `/finish`, `/break`, `/abandoned-up`, other `/be-back` on the same store. Selected employee can only be in one state at a time — guaranteed by `FOR UPDATE` reads."

**WEAK ANSWER**
> "We use a transaction."

**CONCISE SENIOR VERSION**
> "Per-store advisory lock + `FOR UPDATE` on both origin and selected rows. Atomic transition. Three audit rows. Does NOT write `ups_taken`/`ups_handed_off` since 2026-05-21 — Be Back is routing, not a metric event."

**WHAT THE INTERVIEWER EXPECTS**
- You can name the lock primitive and the `FOR UPDATE` requirement.
- You know the May 21 metric rule (Be Back doesn't write `ups_taken`).
- You acknowledge cross-store handoff is rejected at the route.

---

### B2 — "How does Birdeye SMS guarantee exactly-once?"

**EXCELLENT ANSWER**
> "Atomic boolean claim:
> ```sql
> UPDATE invoices_archive SET birdeye_sent = 1
>   WHERE slug = ? AND birdeye_sent = 0
> ```
> Check `affectedRows`. Only `affectedRows === 1` (the winner) sends the SMS. On send failure, roll back: `UPDATE … SET birdeye_sent = 0` so a retry can re-claim.
>
> This is compare-and-swap implemented in SQL. The database is the lock; `affectedRows` is the success signal. No application lock, no Redis, no message queue. The `birdeye_sent` column doubles as a support flag."

**WEAK ANSWER**
> "We use a transaction with SELECT FOR UPDATE."

(Works but holds a row lock across the multi-hundred-ms HTTP call — the atomic UPDATE pattern releases the lock instantly.)

**CONCISE SENIOR VERSION**
> "CAS-in-SQL. Atomic UPDATE with predicate; `affectedRows === 1` is the winner. Roll back on SMS failure. No external infra."

**WHAT THE INTERVIEWER EXPECTS**
- You name the pattern (compare-and-swap).
- You explain why this beats `SELECT FOR UPDATE` (no row-lock held across HTTP).
- You handle the failure case (rollback so retry can re-claim).
- You acknowledge that exactly-once is a *cooperative* property — Birdeye also dedups on their side.

---

### B3 — "How does the 5-minute idle lock handle a re-auth race?"

**EXCELLENT ANSWER**
> "Three guards in `cfc/src/AUTH/authContext.jsx`:
>
> 1. **Queued action snapshot.** When an action is taken while locked, we store `pendingActionRef = { run, queuedAsUserId: user?.id, queuedAt }`.
> 2. **Session-takeover guard.** On unlock, the response can be `{ switched: true, userId, user }` — a different employee unlocked the same device. If `pending.queuedAsUserId !== res.userId`, the action is discarded with a toast.
> 3. **TTL expiry.** `Date.now() - pending.queuedAt > 60_000` → discard. If the user walked away and someone unlocked 90s later, the queued action is stale.
>
> Cross-tab sync via `storage` event listener on `cfc_locked_at`. Managers and admins are not locked — `cfc_locked_at` is purged defensively on non-employee mount."

**WEAK ANSWER**
> "We re-check the password."

**CONCISE SENIOR VERSION**
> "Identity snapshot + 60s TTL + cross-tab `storage` event. Verify-password endpoint has no side effects. Different unlocker → discard queued action."

**WHAT THE INTERVIEWER EXPECTS**
- You name all three guards (identity, TTL, storage event).
- You explain why verify-password has no side effects (no commit, just identity check).
- You acknowledge the shared-kiosk threat model.

---

## 🅲 DATA MODELING & API DESIGN

### C1 — "Why is `form_json` a LONGTEXT JSON blob instead of normalized columns?"

**EXCELLENT ANSWER**
> "Tradeoff between flexibility and queryability. Chose flexibility because:
> 1. The invoice has ~80 fields including 6 customer signatures (base64), nested items with package components and multi-location allocations, payments object with 8 methods, delivery block, RTS sub-tree.
> 2. The shape changes often (we added care plan, then `taxOverride`, then package components, then RTS). Schema migrations for each would be expensive.
> 3. The customer-facing invoice is rendered from this JSON directly — keeping it together preserves the 'what the customer signed' guarantee.
>
> Where queryability matters, we use `JSON_EXTRACT`. The dedup query is `JSON_UNQUOTE(JSON_EXTRACT(form_json, '$.billTo.name1'))`. Slower than a column but bounded to today's rows."

**WEAK ANSWER**
> "JSON is easier to work with."

**CONCISE SENIOR VERSION**
> "Form shape churns every sprint. JSON survives churn. `JSON_EXTRACT` on dedup is bounded to today's rows. Functional indexes would help if we grew 100×."

**WHAT THE INTERVIEWER EXPECTS**
- You acknowledge the tradeoff (queryability vs flexibility).
- You name the rescue pattern (functional indexes, MySQL 8) if scale demands it.
- You preserve the integrity argument (what was signed = what's stored).

---

### C2 — "How does `instance_index` handle a 4-chair package?"

**EXCELLENT ANSWER**
> "Schema:
> ```sql
> CREATE TABLE pkg_component_locations (
>   package_id INT,
>   item_id VARCHAR(...),
>   instance_index INT,             -- 0..N-1 for N pieces
>   location_id VARCHAR(...),       -- S1/S2/999/NS1/NS2/SO
>   saved_by_user_id INT,
>   UNIQUE KEY (package_id, item_id, instance_index)
> );
> ```
>
> For a 4-chair package, four rows: `(pkg, chair, 0, S1)`, `(pkg, chair, 1, S1)`, `(pkg, chair, 2, S2)`, `(pkg, chair, 3, 999)`.
>
> The dialog shows 4 separate rows. The qty parser still returns `required_qty = 4` for the chair component; the validator checks `SUM(loc qty across all 4 instances) === 4`."

**WEAK ANSWER**
> "We have a row per chair."

**CONCISE SENIOR VERSION**
> "`UNIQUE(package_id, item_id, instance_index)`. Four rows for four chairs, each with independent location. UPDATE is row-wise; concurrency clean."

**WHAT THE INTERVIEWER EXPECTS**
- You can name the unique key.
- You can defend per-instance rows vs JSON-array-of-locations (UPDATE concurrency).

---

### C3 — "Walk through invoice dedup on `/invoice/save`."

**EXCELLENT ANSWER**
> "```js
> const [existing] = await formQuery(`
>   SELECT id FROM invoices_archive
>   WHERE JSON_UNQUOTE(JSON_EXTRACT(form_json, '$.billTo.name1')) = ?
>     AND JSON_UNQUOTE(JSON_EXTRACT(form_json, '$.billTo.cell'))  = ?
>     AND DATE(created_at) = CURDATE()
>   LIMIT 1
> `, [custName, custCell]);
>
> if (existing) {
>   await formQuery(`UPDATE invoices_archive SET form_json=?, updated_at=NOW() WHERE id=?`, [json, existing.id]);
> } else {
>   await formQuery(`INSERT INTO invoices_archive (slug, …, form_json, …) VALUES (?, …, ?, …)`, [...]);
> }
> ```
> Natural key for 'ticket today' is `(customer_name, customer_cell, business_date)`. JSON_EXTRACT instead of materialized columns because the natural key matured over time and the JSON has always had `billTo.cell`."

**WEAK ANSWER**
> "We do an upsert."

**CONCISE SENIOR VERSION**
> "UPSERT-by-natural-key via JSON_EXTRACT. Bounded to today's rows. Two simultaneous saves for a brand-new customer could both INSERT — hardened version uses a MySQL 8 functional index on the extracted fields."

**WHAT THE INTERVIEWER EXPECTS**
- You can name the natural key.
- You name the race (two simultaneous INSERTs for new customer) and the future hardening (functional index).
- You catch the NY-timezone bug (`DATE(created_at)` uses server time — should be `CONVERT_TZ`).

---

## 🅳 VALIDATION, ERROR HANDLING

### D1 — "Walk through the mandatory signature chain."

**EXCELLENT ANSWER**
> "`cfc/src/components/right/validateInvoiceSignatures.js` returns an error array. Rules in order:
>
> | Trigger | Required signature |
> |---|---|
> | Always | store location, ≥1 item, every item `salePrice > 0` + (`extPrice` OR applied package) |
> | RG + any TW item | `quantityAndPriceApprovalSignature` (customer) |
> | RG + `carePlan="Yes"` | `carePlanCharge > 0`, `carePlanApprovalSignature` (customer) |
> | RG + `cash > 0` | `managerApprovalForCashSign` (manager) |
> | RG + `balanceDue === total` | `managerApprovalForCashSign` (manager) |
> | RG + items from NS1/NS2 | `managerApprovalForCashSign` (manager) |
> | RG | `saleApprovalSignature`, `paymentSummaryApprovalSignature`, `policiesSignature` (all customer) |
> | PH + cash > 0 | `managerApprovalForCashSign` (manager). No customer sigs on screen — Adobe eSign tags in PDF only via HeadlessChrome detection. |
> | QS | none |
> | storeLocation === 'store5' | exempt |
>
> Returns `{ valid, errors[] }`. 'Watch Invoice' button disabled when `errors.length > 0`; toast shows first error."

**WEAK ANSWER**
> "We check that signatures exist."

**CONCISE SENIOR VERSION**
> "Pure rule-engine function. Returns errors array. Gated by invoice type, payment, balance, item attrs (TW, NS1/NS2), care plan opt-in, role. PH pushes sigs to PDF via Adobe eSign tags."

**WHAT THE INTERVIEWER EXPECTS**
- You can recite at least 4 distinct signature triggers.
- You explain why so many (legal/financial/logistics specificity).
- You name the store5 exemption.

---

### D2 — "How does the daily job handle partial failures?"

**EXCELLENT ANSWER**
> "Per-recipient sends are independent. Orchestrator builds the PDF and Drive upload once, then iterates recipients:
> ```js
> for (const email of recipients) {
>   try {
>     const result = await gmailMailer.sendEmail({ to: email, … });
>     await logDelivery({ recipient_email: email, status: 'sent', provider_message_id: result.id });
>   } catch (err) {
>     await logDelivery({ recipient_email: email, status: 'failed', error: err.message });
>   }
> }
> ```
> Drive failure is best-effort — email goes out, Drive link omitted. Up to 3 attempts at the job level; per-recipient retries happen on the next run. `report_job_history.status='running'` from a dead process doesn't block retry — `isAlreadySucceeded` only matches `succeeded`."

**WEAK ANSWER**
> "We try/catch each email."

**CONCISE SENIOR VERSION**
> "Per-recipient independence. Drive best-effort. Job-level retries with `force: true`. Idempotency via `isAlreadySucceeded(business_date)` matching only `succeeded`."

---

### D3 — "What's your error model on the backend?"

**EXCELLENT ANSWER**
> "Two layers:
> - **Structured `UpsError`** for UPS routes with machine-readable codes: `LOCK_TIMEOUT`, `DEADLOCK`, `NOT_FOUND`, `BAD_INPUT`, `DB_ERROR`. `sendUpsError(res, err)` maps to HTTP status + `retryable: bool`. Frontend honors retryable with backoff.
> - **Generic try/catch on other routes** returning JSON `{ ok: false, error: 'message' }` with 4xx/5xx. Less rigorous but consistent.
>
> For the daily job, errors are written into `report_job_history.error_message` so post-mortems don't require log file access."

**WHAT THE INTERVIEWER EXPECTS**
- You acknowledge the inconsistency (two layers) honestly.
- You name what's missing (correlation id per request).

---

## 🅴 PERFORMANCE, SCALABILITY

### E1 — "Where are the bottlenecks today?"

**EXCELLENT ANSWER**
> "Three I can name:
> 1. **1s `useUPSQueue` poll.** Five endpoints per poll, ~6 devices per store → ~30 reqs/sec per store. Wasteful but manageable. Replacement: SSE off `ups_logs` inserts.
> 2. **MSSQL inventory reads.** `InvMasterReport` lookups on every package fetch and item search. In-process cache 60s would help; read replica or Redis would be the next step.
> 3. **`JSON_EXTRACT` on `invoices_archive` for dedup.** Bounded to today's rows so cheap today. Functional indexes on `(name1, cell, DATE(created_at))` would help at 100×."

**WEAK ANSWER**
> "We don't have any."

**CONCISE SENIOR VERSION**
> "Polling overhead (replace with SSE), MSSQL inventory cache miss (in-process LRU), JSON_EXTRACT dedup (functional index at scale)."

---

### E2 — "How would you scale to 10 stores?"

**EXCELLENT ANSWER**
> "The hot path is per-store advisory locks — queue layer scales horizontally already. What changes:
>
> 1. **MySQL pool tuning.** `GET_LOCK` holds a connection; raise `connectionLimit` to ~10× minimum, or per-store pools.
> 2. **Daily summary fanout.** Sequential per-store today; parallelize with `Promise.all`. Puppeteer ceiling ~5 PDFs/sec.
> 3. **WebSocket / SSE** to replace 1s poll. 60 devices × 5 endpoints × 1 Hz across 10 stores = 3000 reqs/sec for state mostly unchanged.
> 4. **MSSQL caching.** Same item lookups happen across stores. Per-host cache layer.
> 5. **Composite indexes.** `ups_logs(store_name, business_date, action_type)` and `invoices_archive(store_name, created_at)` for store-scoped reports.
> 6. **Partition `ups_logs` by `business_date`** to keep day-range scans bounded.
>
> What doesn't change: fairness algorithm. Single-store shard means adding stores is linear."

---

### E3 — "Tell me about an optimization you made."

**EXCELLENT ANSWER**
> "Two real ones:
>
> 1. **`idx_ia_created_at`** (May 19, 2026) — day-range list scan O(n) → O(log n) for the internal read API. Migration block in `schema.sql` with deploy comment.
> 2. **Optimistic lock in `useUPSQueue`** — 1s poll was overwriting in-flight mutation results, causing brief UI ghosts. Added `optimisticLockUntilRef = Date.now() + 2000` set just before mutation; poller's setState noops until expired. Explicit refetch after mutation resolves."

---

## 🅵 FRONTEND STATE, REACT PATTERNS

### F1 — "How does Redux fit into the app?"

**EXCELLENT ANSWER**
> "Single slice (`formSlice.js`) holds the invoice + RTS form state. `redux-persist` to localStorage so a Topaz disconnect or a refresh during a multi-page invoice doesn't lose customer input.
>
> `updateField({ section, field, value })` is the central reducer — routes through `FIELD_NORMALIZERS` keyed by `section.field`. Phone formats on dispatch, not in input component. Currency rounds at the reducer level.
>
> UPS data is **not in Redux** — `useUPSQueue` is a hook with its own state. AuthContext owns user + idle-lock + active-store. Rule I follow: Redux for *form state* (user input surviving routes); local hook state for *server-fetched live data*."

**WEAK ANSWER**
> "We use Redux for state."

---

### F2 — "Walk me through Focus Flow."

**EXCELLENT ANSWER**
> "`cfc/src/components/left/comp/ui/` — `FocusFlowContext`, `FocusFlowProvider`, `FocusField`, `useFocusFlow`. The provider builds a tab order across registered field IDs; fields register on mount and unregister on unmount.
>
> ```jsx
> <FocusFlowProvider deps={[form.deliveryOption]}>
>   <FocusField fieldId="salesperson" ref={spRef} />
>   <FocusField fieldId="customer_name" ref={cnRef} />
> </FocusFlowProvider>
> ```
> `deps` invalidates the order when conditional fields appear/disappear (e.g., 'delivery_special' reveals a special-date input). `useFocusFlow()` exposes `focusNext(currentId)` and `focusPrev(currentId)`.
>
> Why it exists: native tab order is DOM-based and doesn't skip conditionally-hidden fields cleanly. Plus we want Enter to advance like Tab in specific contexts (autocompletes)."

---

### F3 — "How does the package-location dialog open?"

**EXCELLENT ANSWER**
> "Flow in `LeftPanel.jsx`:
>
> 1. User selects a package.
> 2. `LeftPanel` calls `packageLocationApi.getPackageComponents(packageId)` → hits `GET /api/package/:packageId/components`.
> 3. Backend returns `{ packageId, package, components, componentGroups }`.
> 4. Frontend prefers `componentGroups`. If `required_qty` is `null` → 'qty unknown' state, disable Save with `g.qty_unknown_reason`.
> 5. `PackageLocationAssignmentDialog` mounts. Per-component card with multi-loc qty allocator. `validateManualFulfillment(required_qty, allocations)` on every keystroke.
> 6. Save → `POST /api/package/component-location` with `{ packageId, allocations }`. Backend writes per `(package_id, item_id, instance_index)` row.
>
> Feature flag `PKG_COMPONENT_LOC_ENABLED` (in `cfc/src/utils/packageWarnings.js`) gates dialog mount and the parent/child row rendering on invoices."

---

## 🅶 TESTING, OBSERVABILITY, OPERATIONS

### G1 — "How do you test something this complex without dedicated QA?"

**EXCELLENT ANSWER**
> "Three lines of defense:
> 1. **Schema as test scaffolding.** UNIQUE / FK / CHK / ENUM constraints catch malformed writes. `CHK_rts_returned_pos`, `CHK_rts_written_pos` reject negatives at DB. ENUM on `ups_queue.status` rejects typos.
> 2. **Idempotency by design.** `isAlreadySucceeded`, atomic boolean claim — re-running is safe while testing.
> 3. **Audit tables as proof.** `report_job_history.duration_ms` + `report_delivery_logs.status` tell me the system worked when no one was looking.
>
> What I don't have: unit test suite for routes. Honest gap. Pure-logic services (`packageQtyParser`, `attendanceException`, `employeeSchedule`) are pure functions — easy to test, where I'd add Jest first."

**WEAK ANSWER**
> "We do manual testing."

**WHAT THE INTERVIEWER EXPECTS**
- You acknowledge the gap (no automated route tests).
- You name what mitigates it (schema constraints, idempotency, audit tables).
- You name what you'd add at Amazon (Jest on pure services first).

---

### G2 — "What's your observability story?"

**EXCELLENT ANSWER**
> "Append-only audit tables:
> - `ups_logs` — every user action with reason JSON.
> - `report_job_history` + `report_delivery_logs` + `report_drive_upload_logs` — daily job audit.
> - `manager_store_sessions` — manager store picks per day.
> - `abandoned_up_logs` — fraud trail with approver context.
> - `audit_results` — ticket-vs-RV reconciliation comparisons.
>
> Monitoring: I rely on the daily PDF itself — if email arrives, pipeline worked. If not, check `report_job_history`. No APM yet (would add at Amazon).
>
> What I'd add first: request-id correlation across `ups_logs` rows for the same atomic operation. `be_back`, `be_back_accept`, `moved_to_working` are written by the same transaction but currently uncorrelated. One column."

---

### G3 — "How do you deploy?"

**EXCELLENT ANSWER**
> "Backend has `applyStartupMigrations()` in `config/initSchema.js` for idempotent DDL on boot. Bigger/risky migrations (like `idx_ia_created_at`) are dated blocks in `schema.sql` with 'run this while deployment' — ops applies them manually before code release. `backend/admin-deploy/` has the deploy scripts. Frontend deploys are static-built with Vite.
>
> Rollback strategy:
> - Feature-flag-able changes → env var or in-code flag (e.g., `PKG_COMPONENT_LOC_ENABLED`).
> - Behavior changes → tri-state env (`UPS_FAIRNESS_V2 = off | shadow | on`) — revert without code change.
> - Schema additions: forward-compatible (new tables, new columns nullable, new indexes additive). Schema removals: never."

---

## 🅷 SPECIFIC CODE PROBES

### H1 — "Show me where `withStoreTx` is implemented."
`backend/src/services/upsFairness.js` lines 86–151. Acquires `GET_LOCK(name, 5)`, opens transaction on the same connection, runs the callback, commits or rolls back, releases the lock, returns the connection. Deadlock retry up to 2 attempts with a fresh connection.

### H2 — "How does the seller-split CTE fall back?"
`backend/src/services/sales/ticketSeller.sql.js` exports `supportsJsonTable()` — feature-detect at startup. If false, callers fall through to `backend/src/services/sales/salesCredit.js` `expandTicketSellers(tickets)` — JS fan-out + division. Same output shape; callers don't care which path.

### H3 — "What's the 12-employee schedule?"
`backend/src/config/employeeSchedule.js`, `RAW_OFF_DAYS`:

| Name | Off |
|---|---|
| Chris Butler | Tue |
| Justin Reeves | Wed |
| Billy Terry | Tue, Thu |
| Evey Young | Mon, Wed |
| Reis McCall | Wed, Fri |
| Carol Terry | Tue, Thu |
| Missy Garvitte | Tue, Fri |
| Jon Weidenmiller | Tue, Fri |
| Joe Cole | Mon, Wed |
| Amy Heatherly | Thu, Sun |
| Donna Owle | Mon, Wed |
| Jeff Reece | Fri, Sat |

API: `isEmployeeTracked`, `getScheduledOffDays`, `isEmployeeOffDay`, `weekdayForDate(dateIso, tz)`, `normalizeWeekday`, `normalizeEmployeeKey`.

### H4 — "What's the schema migration convention?"
Every block in `backend/src/config/schema.sql` is dated and prefixed `"run this while deployment"`. Idempotent (`CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS`). This is in my project memory because I established it as a hard rule.

### H5 — "Allowed package allocator locations?"
`ALLOWED_ALLOCATION_LOCATIONS = ['S1', 'S2', '999', 'NS1', 'NS2', 'SO']`. S1 = Arden, S2 = Waynesville, 999 = warehouse, NS1/NS2 = nailed (require manager approval), SO = Special Order.

---

## 🅸 SYSTEM DESIGN PROBES

### I1 — "Design a queue for 10 stores, 60 salespeople/store, 1000 visits/day."

**EXCELLENT ANSWER**
> - **Storage.** Keep MySQL for state. Partition `ups_logs` by `business_date`. Per-store advisory locks survive — already sharded by store.
> - **Real-time.** Drop 1s poll. SSE feed per store, server-pushes deltas from `ups_logs` inserts (one event per insert). Fall back to poll on disconnect.
> - **Fairness.** Unchanged — single-store shard already handles 60 salespeople. Fair-insert is O(n) over today's queue, bounded by salespeople-on-floor.
> - **Daily summary.** Parallel per-store builds. PDF rendering is the bottleneck; Puppeteer does ~5 PDFs/sec.
> - **Read replicas.** MSSQL reads to a replica. MySQL reads (`/top-performers`, `/today`) to a replica with master-write.
> - **Frontend.** Virtualize the queue list (60 rows is small but at 100+ I'd want windowing).

### I2 — "Design observability for this system."

**EXCELLENT ANSWER**
> - Per-request correlation id propagated through `ups_logs.request_id` and `report_*` audit columns.
> - Structured logging (JSON to stdout) with `event`, `userId`, `store`, `requestId`, `durationMs`.
> - APM (CloudWatch / Datadog) for HTTP and DB query timings.
> - Daily KPI dashboard from `report_job_history` + `report_delivery_logs` (uptime SLO for the report).
> - Alarms: any `report_job_history.status='failed'`, Birdeye claim rollbacks > N/hour, `withStoreTx` lock-timeout rate > X%.

---

## 🅹 CODE QUALITY PROBES

### J1 — "Show me a piece of code you regret."

**EXCELLENT ANSWER**
> "`Internalnvoice.jsx` is doing too much in one file. Renders the warehouse invoice with per-component LOC rows, package summary rows, multi-instance qty multipliers like `(qty/pkg × qty_pkgs = total)`. It's correct, but cognitive load to read is high. I'd refactor by extracting the package-component row renderer into its own component — but I haven't because the file isn't changing weekly."

### J2 — "Where's your most over-engineered code?"

**EXCELLENT ANSWER**
> "Dual `componentGroups` + `components` response shape from `/api/package/:packageId/components`. I kept the legacy flat `components` list for back-compat with code that might still consume it; the new grouped shape was what the dialog actually needed. The flat list is now unused. I'd remove it."

### J3 — "Where's the worst naming?"

**EXCELLENT ANSWER**
> "`cfc/src/pages/Internalnvoice.jsx` — typo in the filename. 'Invoice' missing an 'i.' I left it because renaming is a route change and the page is rendered at `/internal-invoice/:slug` regardless of filename. Worth fixing in a quiet week."

---

## 🎯 Universal evaluation rubric

For each technical answer, the interviewer is silently scoring:

| Dimension | Weak (1) | Strong (5) |
|---|---|---|
| Specificity | "We use locks" | "Per-store named advisory lock via `GET_LOCK('ups_queue_lock:'||store, 5)` + `FOR UPDATE` inside `withStoreTx`" |
| Tradeoff | "It's the right choice" | "Rejected Redis because [cost]; chose advisory lock because [benefit] at the cost of [downside]" |
| Failure modes | "It just works" | "Lock-timeout → 503 retryable; deadlock retried twice with fresh connection" |
| Generalization | "I fixed this bug" | "The pattern (resilient consumer, append-only audit, atomic CAS in SQL) generalizes to [other use cases]" |
| Self-awareness | "All my code is clean" | "I have a typo'd filename and a dual-shape response. Both deliberate compromises with known refactor paths" |

> **Aim for 4–5 across the board on every answer. The interviewer is looking for the candidate who can defend AND criticize their own work.**
