# 🎯 Amazon SDE-1 — Elite Project Deep Dive

> **Codebase:** `cfc/` (React + Vite + Redux) + `backend/` (Node/Express + MySQL + MSSQL)
> **Product:** Carolina Furniture Concepts — 2-showroom retail operations platform
> **Owner:** End-to-end (schema → routes → services → frontend → cron → observability)
> **Use this doc to:** rehearse the project walkthrough until every paragraph survives 3 follow-ups.

---

## 📐 0 — The 90-second pitch (memorize verbatim)

> *"I own a MERN platform for Carolina Furniture Concepts — two physical showrooms in Arden and Waynesville, North Carolina. The frontend is React + Vite + Redux Toolkit; the backend is Node and Express on top of MySQL (operational) and a read-only MSSQL legacy ERP (inventory). The system runs three workflows: a real-time customer-opportunity queue called the UPS Board with a fairness algorithm, digital sales invoices with a returns-to-stock path, and an automated 7 PM / 9 PM PDF report that emails the GM and archives to Google Drive.*
>
> *The technical bits I'm proudest of: a race-safe per-store advisory-lock transaction primitive called `withStoreTx`, a multi-location quantity allocator whose required-qty is parsed from a free-text ERP description, NY-timezone-anchored business dates on a UTC server, and an idle-lock UX for shared kiosks with re-auth that replays the queued action only if the same employee unlocks within 60 seconds."*

🪝 **Hook for the follow-up:** drop "fairness algorithm" or "atomic boolean claim for SMS" — both make the interviewer pull the thread.

---

## 🏗️ 1 — High-Level Architecture

### 1.1 The picture you should be able to draw on a whiteboard

```
┌──────────────────────────────── BROWSER (React 18 + Vite) ─────────────────────────────┐
│                                                                                          │
│   ┌─ AuthContext ─┐   ┌─ Redux Persist (localStorage) ─┐   ┌─ useUPSQueue (1s poll) ─┐ │
│   │ user, role,    │   │   formSlice (invoice + RTS)    │   │   queue, working,       │ │
│   │ idle-lock,     │   │   redux-persist key="root"     │   │   breaks, finishing-up  │ │
│   │ activeStore    │   └────────────────────────────────┘   └─────────────────────────┘ │
│   └────────────────┘                                                                     │
│                                                                                          │
│   Pages:    InvoicePreview · Internalnvoice · RTSPreview · UPSBoard · Analytics         │
│   Modals:   PackageLocationAssignmentDialog · FinishCustomerModal · SignaturePad        │
│                                                                                          │
│   ──── apiClient.js (adds x-user-id header from localStorage) ────►                     │
└──────────────────────────────────────────────┬───────────────────────────────────────────┘
                                               │
                          ┌────────────────────▼────────────────────┐
                          │     Node 18 / Express  (backend/src)    │
                          │                                          │
                          │   middleware/requireRole.js              │
                          │      └─► re-reads role from cfc_users     │
                          │                                          │
                          │   routes/  →  services/  →  repositories/│
                          │                                          │
                          │   ┌───────────────────────────────────┐  │
                          │   │  cron @ America/New_York          │  │
                          │   │   0 19,21 * * *  daily summary    │  │
                          │   │   0 21    * * *  dailyReset       │  │
                          │   └───────────────────────────────────┘  │
                          └────┬──────────────────────────┬──────────┘
                               │                          │
              ┌────────────────▼─────────┐   ┌────────────▼────────────────────┐
              │  cfcFormPool (MySQL 8)   │   │  mssqlPool (legacy ERP, RO)     │
              │  ─────────────────────   │   │  ─────────────────────────────  │
              │  cfc_users               │   │  ItemMaster                     │
              │  ups_queue               │   │  PackageMaster   ← qty in       │
              │  ups_working_queue       │   │  ItemPackageMaster   item_desc  │
              │  ups_logs                │   │  InvMasterReport                │
              │  ups_sessions            │   └─────────────────────────────────┘
              │  ups_finish_logs         │
              │  invoices_archive        │     formQuery(sql, params)  — MySQL helper
              │  customer_acquisition    │     runSql(sql, params)     — MSSQL helper
              │  customer_leads          │
              │  customer_rts_entries    │
              │  abandoned_up_logs       │     withStoreTx(store, fn)  — per-store
              │  reminders               │       advisory lock + transaction
              │  pkg_component_locations │
              │  manager_store_sessions  │
              │  report_job_history      │
              │  report_delivery_logs    │
              │  report_drive_upload_logs│
              │  audit_results           │
              └──────────────────────────┘
```

### 1.2 Why two databases (the question that always comes)

| | MySQL (cfc_form) | MSSQL (legacy ERP) |
|---|---|---|
| **Ownership** | I own writes. | We have read-only access — owned by buyer/inventory team. |
| **Schema control** | Yes — every block in `schema.sql` is dated and idempotent. | No — ERP vendor + buyer team. |
| **Use case** | Operational state (queues, invoices, audits). | Inventory truth (items, packages, per-location qty). |
| **Migration story** | Self-service via `applyStartupMigrations()`. | Out of scope. |

> *"The two-DB split is a constraint we accepted, not an architecture we chose."* — say it exactly this way.

---

## 🔄 2 — Request Lifecycle (the canonical flow you'll be asked to trace)

### 2.1 "Walk me through `POST /api/invoice/save`"

| Step | What happens | Why |
|---|---|---|
| 1 | Browser dispatches Redux action; LeftPanel state is serialized to `form_json`. | Single source of truth — what we send is what we'll re-render. |
| 2 | `apiClient.js` attaches `x-user-id` from `localStorage`. | No JWT — body/header `userId` is the auth handle. |
| 3 | Express route `route.invpdf.js /invoice/save` receives request. | |
| 4 | `requireRole.js` reads `userId`, re-queries `cfc_users` for current role. | Forged role on client cannot escalate — DB is the truth. |
| 5 | Dedup lookup: `SELECT id FROM invoices_archive WHERE JSON_UNQUOTE(JSON_EXTRACT(form_json,'$.billTo.name1')) = ? AND …cell = ? AND DATE(created_at) = CURDATE() LIMIT 1`. | Multiple "Save" clicks for same customer/day must collapse to one row. |
| 6 | Match → UPDATE (idempotent). No match → INSERT. | UPSERT-by-natural-key without schema change. |
| 7 | Audit-style log line: `[StatsUpdate] primary=<seller[0]> split=[…]`. | Future post-mortems need this trail. |
| 8 | **Birdeye SMS claim:** `UPDATE invoices_archive SET birdeye_sent=1 WHERE slug=? AND birdeye_sent=0`. Only `affectedRows === 1` proceeds. | Atomic compare-and-swap — exactly-once semantics without Redis or a queue. |
| 9 | On SMS API failure, roll back claim: `UPDATE … SET birdeye_sent=0 WHERE slug=?`. | Failed send is *retry-able*; the claim is not a tombstone. |
| 10 | Response 200 → frontend redirects to `/ups-dashboard` and `clearAllFinishingUp('create_sale', user.id)` posts to `/ups/finish-up/end`. | Closes the open `ups_finish_logs` row that `/ups/finish` opened atomically. |

### 2.2 Mental model for any request

> *Identity (`requireRole`) → State load (`SELECT … FOR UPDATE` if mutating) → Business rule → Audit row → Idempotency primitive (if external side effect) → Response → Frontend cleanup.*

Memorize this skeleton; it works for every endpoint.

---

## 🧬 3 — Database Relationship & Schema Story

### 3.1 The schema tells the product's history

Every block in `backend/src/config/schema.sql` is **prefixed with a date and the phrase "run this while deployment"** — that's the convention I established. Reading the schema chronologically *is* reading the product's history.

### 3.2 Core relationship map

```
                       ┌───────────────┐
                       │   cfc_users    │
                       │  (role, store)  │
                       └───┬──────┬─────┘
                           │      │
        ┌──────────────────┘      └───────────────────┐
        │                                              │
┌───────▼────────┐  ┌──────────────────┐  ┌────────────▼───────────┐
│  ups_queue      │  │ ups_working_queue │  │ ups_sessions             │
│  (waiting line) │  │ (with customer)   │  │  business_date UNIQUE     │
│  pos, ups_count │  │ active_customers  │  │  first_ups_at (elig flag) │
└─────────────────┘  └──────────────────┘  └──────────────────────────┘
        │                                              │
        └────────────────┐         ┌───────────────────┘
                         │         │
                  ┌──────▼─────────▼─────┐
                  │   ups_logs (audit)   │ ← every state change
                  │   action_type ENUM   │
                  └──────────────────────┘
                         │
        ┌────────────────┼────────────────────────────┐
        │                │                            │
┌───────▼────────┐ ┌─────▼──────────┐ ┌───────────────▼─────────┐
│ ups_finish_logs│ │ abandoned_up_   │ │ customer_acquisition     │
│ (paperwork     │ │  logs (fraud    │ │  sources JSON, custom    │
│  timer)        │ │  trail)         │ └──────┬──────────────────┘
└────────────────┘ └─────────────────┘        │
                                              │ FK
                              ┌───────────────▼──────────────────┐
                              │  customer_rts_entries            │
                              │  customer_leads                  │
                              │  reminders                       │
                              └──────────────────────────────────┘

                  ┌──────────────────────────────────────────┐
                  │  invoices_archive (form_json LONGTEXT)   │
                  │  slug UNIQUE · birdeye_sent · created_at │
                  │  idx_ia_created_at  ← O(log n) day scans │
                  └──────────────────────────────────────────┘

                  ┌──────────────────────────────────────────────┐
                  │  pkg_component_locations                     │
                  │  UNIQUE(package_id, item_id, instance_index) │
                  └──────────────────────────────────────────────┘

                  ┌──────────────────────────────────────────────┐
                  │  report_job_history → report_delivery_logs   │
                  │                     → report_drive_upload_logs│
                  └──────────────────────────────────────────────┘
```

### 3.3 Three design decisions worth memorizing

| # | Decision | Why |
|---|---|---|
| **D1** | Separate **transient state** (`ups_queue`, `ups_working_queue` — wiped nightly) from **immutable audit** (`ups_logs`, `ups_sessions`, `ups_finish_logs` — never reset). | Reports read from audit; live board reads from transient. The 9 PM reset is safe by construction. |
| **D2** | `invoices_archive.form_json LONGTEXT` instead of normalized columns. | The form's shape changes every sprint (care plan, tax override, RTS, package components). JSON survives schema churn; `JSON_EXTRACT` on dedup is bounded to today's rows. |
| **D3** | `ups_sessions(user_id, store_name, business_date)` UNIQUE + `first_ups_at` NULL-default. | The eligibility flag *is* the schema. No separate enum, no flag column — a NULL timestamp is the rule. |

---

## ⚙️ 4 — Topic-by-Topic Deep Dives

> Each topic below follows a six-part structure so the same answer can be delivered in **strong**, **deep**, **concise**, or **rehearsed** modes depending on the interviewer's appetite.

---

### 🔸 TOPIC A — UPS Fairness V2 (per-store advisory lock + eligibility gate)

**📁 Files:** `backend/src/services/upsFairness.js` (~415 lines), `backend/src/routes/ups.routes.js` (~2,400 lines)
**🗄️ Tables:** `ups_queue`, `ups_working_queue`, `ups_logs`, `ups_sessions`
**🚩 Flag:** `UPS_FAIRNESS_V2 = off | shadow | on`

#### A.1 Strong Interview Answer
> "The UPS Board is a fairness queue across two stores. Each store has its own waiting line, working list, and audit log. The fairness rule is: an employee earns *fair insertion* only after their first UP of the day — until then they FIFO-append to the tail. I built it as a tri-state env flag: `off`, `shadow` (dual-write to `ups_sessions` while V1 reads), and `on`. The cutover was one env var. The concurrency primitive is a per-store named MySQL advisory lock — `GET_LOCK('ups_queue_lock:'||store, 5)` — held inside a transaction with `FOR UPDATE` on queue rows."

#### A.2 Technical Deep Dive
- **`withStoreTx(store, fn)`** owns all queue mutations. Acquires `GET_LOCK` (5s timeout → 503 retryable), opens transaction, runs callback, commits, releases lock. Deadlock/lock-wait-timeout retried twice with a fresh connection.
- **`fairInsertV2`** algorithm (lines 298–369):
  1. Load today's queue ordered by position, `FOR UPDATE`.
  2. Empty → joiner at position 1.
  3. `first_ups_at IS NULL` → append at tail (ineligible).
  4. Eligible → scan from position 2, insert before first incumbent with higher `ups_count`.
  5. Compress positions 1..N.
  6. Audit row `action_type = 'queue_join'`.
- **Stale-ghost defense:** `WHERE DATE(q.joined_at) = CURDATE()` — a failed nightly reset no longer corrupts fairness.
- **Structured `UpsError` codes:** `LOCK_TIMEOUT`, `DEADLOCK`, `NOT_FOUND`, `BAD_INPUT`, `DB_ERROR` — mapped to HTTP status + `retryable: bool` for frontend backoff.

#### A.3 Follow-Up Questions (and answers in your back pocket)
| Probe | Crisp answer |
|---|---|
| *Why advisory lock vs Redis?* | Single MySQL instance, two stores. Reaching for Redis to coordinate something MySQL does natively adds an operational dependency without bounded benefit. |
| *Why scan from position 2?* | Position 1 is "next to be served." Recycling that person is a privileged manager action (`/recycle`), not a side-effect of a join. |
| *What about ties on `ups_count`?* | First-come-first-served — whoever wins `GET_LOCK` first. Acceptable tie-break. |
| *Worst-case latency?* | 5s lock-acquire ceiling → 503 retryable. Frontend backs off and retries. |
| *Why is `first_ups_at` immutable for the day?* | Eligibility must survive Be Back / Abandoned UP / mid-day breaks. The day-long latch is the simplest correctness guarantee. |

#### A.4 Concise Senior-Level Response (40 seconds)
> "Per-store named advisory lock plus `FOR UPDATE` inside `withStoreTx` — that's the concurrency story. Fairness uses an eligibility flag stamped at first-UP-of-day; ineligible joiners tail-append, eligible joiners insert by `ups_count`. Rolled out via a tri-state env flag with a dual-write shadow week before the read cutover. Reversible with one env-var flip."

#### A.5 Mistakes Weak Candidates Make
- Saying "we use locks" without naming `GET_LOCK` and the 5-second timeout.
- Calling V2 "more fair" without explaining the eligibility rule that prevents leapfrog.
- Claiming "Redis" because that's what they've read about — and then having no answer for *which* Redis primitive.
- Forgetting the audit row — every state change must write to `ups_logs`.

#### A.6 Stronger Communication Version
> "I made one architectural call: every mutation to queue state routes through `withStoreTx`. That single function owns the lock, the transaction, the retry, and the error mapping. If you grep the codebase for `pool.query` inside a route that touches `ups_queue`, you find zero results — that invariant is how I know the algorithm is race-safe in production."

---

### 🔸 TOPIC B — Be Back: One-Click Customer Handoff

**📁 Files:** `backend/src/services/beBack.service.js` (~530 lines), frontend action menu in `UPSBoard.jsx`
**🗄️ Tables:** `ups_queue`, `ups_working_queue`, `ups_logs`, `ups_sessions`
**📅 Critical fix:** 2026-05-21 — Be Back is **routing**, not a metric event.

#### B.1 Strong Interview Answer
> "Be Back is a one-click handoff where the origin salesperson gives the current customer to a chosen employee. The atomic transition removes origin from working, decrements their `ups_count`, places selected at `+1 active_customer` (or promotes from waiting), reinserts origin at waiting position 1, and writes three audit rows: `be_back`, `be_back_accept`, `moved_to_working`. The hard-won business rule was that Be Back must NOT write `ups_taken` for the receiver or `ups_handed_off` for the giver — it's routing, not a metric event."

#### B.2 Technical Deep Dive
- All inside `withStoreTx` — serialized against concurrent `/take`, `/finish`, `/break`, `/abandoned-up`, and other `/be-back` on the same store.
- Capacity check: selected employee rejected if already at 6 active customers.
- Eligibility-list endpoint `GET /api/ups/be-back/eligible-employees?store=X&excludeUserId=Y` returns the snapshot for the picker UI (waiting + working under cap, excluding self/breaks/offline/inactive).
- The May 21 fix removed two `ups_logs` writes that had been distorting closing ratio for ~2 weeks. The downstream cleanup: two of three `LEAST(closing_ratio, 100)` clamps became removable in `todayReports.service.js` and `dailySalespersonSummary.service.js`.
- A new column **BB Accepted** was added to the daily summary so handoffs stay visible without polluting metrics.

#### B.3 Follow-Up Questions
| Probe | Crisp answer |
|---|---|
| *What if origin and selected are in different stores?* | Route rejects with 400. Cross-store handoff is a rule violation. |
| *What about position 1 in waiting?* | Origin returns to position 1; previous position-1 person shifts to 2. |
| *Why three audit rows, not one?* | Different queries read different rows — `be_back` for handoff counts, `be_back_accept` for receiver activity, `moved_to_working` for board reconciliation. |
| *How do you prove metrics are clean now?* | The three downstream clamps used to be load-bearing; now two of them are gone and the third is just the official business cap. Removability is the proof. |

#### B.4 Concise Senior-Level Response
> "Atomic transition inside `withStoreTx`. Origin loses customer + 1 ups, returns to waiting position 1. Selected gains customer + 1 ups. Three audit rows. Be Back doesn't write `ups_taken` or `ups_handed_off` because Be Back is routing, not a metric event — that fix killed two LEAST clamps downstream."

#### B.5 Mistakes Weak Candidates Make
- Forgetting that **revenue still flows** to the receiver's ticket (Be Back affects who serves, not who gets credit).
- Talking about audit rows without saying *which* downstream query each one feeds.
- Missing the May 21 lesson — the bug surfaced as "three clamps in three services," which is the architectural smell that pointed to root cause.

#### B.6 Stronger Communication Version
> "The Be Back fix taught me to look for *patterns of compensation* in the codebase. Three `LEAST(closing_ratio, 100)` clamps in three different services was the smell. The clamps weren't the answer — they were *symptoms* of upstream double-writing. The real fix was removing two `ups_logs` writes, after which two clamps became removable. That's the kind of refactor I look for: not 'add another clamp,' but 'why is everyone clamping?'"

---

### 🔸 TOPIC C — Abandoned UP (manager-approved restore to position #1)

**📁 File:** `backend/src/services/abandonedUp.service.js` (~596 lines)
**🗄️ Tables:** `abandoned_up_logs`, `ups_logs`, `ups_queue`, `ups_working_queue`, `ups_sessions`
**🔐 Role gate:** admin/manager only; self-approval rejected.

#### C.1 Strong Interview Answer
> "Abandoned UP is for when a salesperson took an UP but the visitor turned out to be a vendor, friend, or family — not a real customer. Manager or admin one-click restores the salesperson to waiting position 1. Two atomic cases: if stacked floor mode (`active_customers > 1`), decrement in place; otherwise remove from working, decrement, reinsert. Permanent audit trail in `abandoned_up_logs` plus `ups_logs` rows (`abandoned_up` + `ups_handed_off`) so served-count math nets out. Abuse flag triggers at ≥10 abandons per calendar month."

#### C.2 Technical Deep Dive
- **`abandoned_up_logs`** captures approver context: `(salesperson_id, approved_by_id, approved_by_role, queue_position_before, queue_position_after, source_location ENUM('working','waiting'), reason, business_date, created_at)`.
- **Why two audit destinations?** `abandoned_up_logs` is the fraud table (long-form auditor view). `ups_logs` is the live-board math table — `ups_handed_off` keeps `served_count` correctly netted out.
- **`computeAbuseFlag(salespersonId)`** counts current-calendar-month abandons against `ABANDONED_UP_ABUSE_THRESHOLD` (env, default 10). **Non-blocking** — returned in API response and surfaced in the daily PDF.
- **Defense-in-depth gate:** route checks role *and* service double-checks role. Belt and suspenders.

#### C.3 Follow-Up Questions
| Probe | Crisp answer |
|---|---|
| *Why can't the salesperson self-approve?* | Conflict of interest. The whole point is that an authority second-checks. |
| *Why non-blocking abuse flag?* | False positive on threshold day shouldn't block legitimate operations. Detection ≠ enforcement. |
| *Why both `abandoned_up_logs` and `ups_logs` rows?* | Different consumers — fraud auditor reads `abandoned_up_logs`, live board math reads `ups_logs`. Coupling them would force one table to serve two queries. |
| *What if a manager abandons their own UP?* | Self-approval explicitly rejected at service layer. |

#### C.4 Concise Senior-Level Response
> "Manager/admin-only restoration to waiting position 1. Inside `withStoreTx`. Permanent audit in dedicated table plus `ups_logs` for board math netting. Abuse flag at ≥10/month — non-blocking, surfaced in daily PDF."

#### C.5 Mistakes Weak Candidates Make
- Calling the abuse flag a "circuit breaker" — it isn't; it's a signal, not a block.
- Forgetting the stacked-customer case (`active_customers > 1`) — it's the edge case that makes the design feel mature.
- Lumping the audit tables together. They serve different consumers.

#### C.6 Stronger Communication Version
> "The Be Back and Abandoned UP features share an atomic transition shape — origin and target updates inside `withStoreTx`, plus a small audit-table per business concern. I'm proud of that pattern because the third feature in this family was almost free to build."

---

### 🔸 TOPIC D — Package Component Location Allocator

**📁 Files:** `backend/src/services/packageLocation.service.js` (~399 lines), `backend/src/services/packageQtyParser.js` (~232 lines, pure logic), `cfc/src/components/PackageLocationAssignmentDialog.jsx`
**🗄️ Table:** `pkg_component_locations` — `UNIQUE(package_id, item_id, instance_index)`
**🚩 Flag:** `PKG_COMPONENT_LOC_ENABLED` (in `cfc/src/utils/packageWarnings.js`)
**📅 Timeline:** rolled out 2026-05-20, multi-loc upgraded 2026-05-21, qty-parser fixed 2026-05-23, flagged off 2026-05-23.

#### D.1 Strong Interview Answer
> "A package is a bundle — Living Room Package = sofa + chair + table + lamp. Each component must be allocated to one or more physical locations: S1 (Arden), S2 (Waynesville), 999 (warehouse), NS1/NS2 (nailed/locked), SO (special order). The dialog opens after the package is fetched and presents per-component cards with a multi-location qty allocator. Each component's required qty is parsed from `PackageMaster.item_desc` — `BEST M23AC(3)/W(3)/F 19983C SHADOW` — because the ERP has no qty column. Save is gated by `SUM(loc qty) === required_qty`. Whole feature lives behind a flag so I rolled it back in 30 seconds when an issue surfaced."

#### D.2 Technical Deep Dive
- **Qty parser** (`packageQtyParser.js` — pure, unit-testable):
  - `extractSlashGroupSegments(desc)` → array of `{code, qty}` from `CODE(N)/CODE(N)/CODE`.
  - `computeDistinctiveWords(children)` → token positions where ALL children differ (avoids false-positives on shared words like "SHADOW").
  - **Two-pass matching:** Pass A exact-token, Pass B substring with **longest-overlap wins**.
  - Returns `Map<item_id, number|null>`. **`null` is preserved on purpose** — the dialog surfaces "qty unknown — fix package description in ERP" and disables Save.
- **Multi-instance schema:** `UNIQUE(package_id, item_id, instance_index)` — a 4-chair package writes four rows. Reopening the dialog preserves per-instance assignments.
- **Graceful degradation:** if `pkg_component_locations` is missing (deploy lag), the service returns empty allocations with a warning — no 500.
- **API response shape:** `{ componentGroups, components }` — grouped (new) + flat (legacy) for back-compat.

#### D.3 Follow-Up Questions
| Probe | Crisp answer |
|---|---|
| *Why parse qty from a free-text description?* | We don't own MSSQL writes. The ERP has no qty column on `ItemPackageMaster`. Parsing is the only path that doesn't require a buyer-team migration. |
| *What if the parser is wrong?* | It returns `null`, the dialog blocks Save with an actionable message ("fix package description in ERP"). Silent default of 1 was the original bug — the warehouse would have picked 1 sofa instead of 3. |
| *Why `instance_index`?* | Multi-instance packages (4 of the same chair) need per-piece location independence. Without `instance_index`, you can't say "chair #1 → S1, chair #2 → S2." |
| *Why is the feature flagged?* | Day-three issue on rollout. Flag flip rolled it back in 30 seconds while I investigated. Saved data in `pkg_component_locations` survived. |

#### D.4 Concise Senior-Level Response
> "Per-component, per-instance location allocator. Qty parsed from ERP description via two-pass distinctive-word matching; failures preserved as `null` and block Save. `UNIQUE(package_id, item_id, instance_index)` supports multi-instance packages. Whole feature is flagged for instant rollback."

#### D.5 Mistakes Weak Candidates Make
- Saying "we default qty to 1 if we can't parse." That was the bug.
- Forgetting `instance_index` — interviewers love asking about 4-chair packages.
- Missing the graceful-degradation path (missing table → warning, not 500).
- Not mentioning the flag — it's the strongest part of the design.

#### D.6 Stronger Communication Version
> "This feature taught me to be loud about parsing failures. The simple answer — 'default to 1' — would have shipped a silent picking error. The correct answer — `null` plus an actionable dialog message — costs the operator 30 seconds in the ERP and saves the warehouse a wrong-pick incident. The cost asymmetry was the whole design."

---

### 🔸 TOPIC E — Daily Salesperson Summary (7 PM + 9 PM PDF + Drive + Gmail)

**📁 Files:** `backend/src/jobs/dailySalespersonSummary.job.js`, `backend/src/services/reports/dailySalespersonSummary.{orchestrator,service,pdf,drive,recipients,audit}.js`
**🗄️ Tables:** `report_job_history`, `report_delivery_logs`, `report_drive_upload_logs`
**⏰ Cron:** `0 19,21 * * *` America/New_York

#### E.1 Strong Interview Answer
> "Cron-driven daily PDF report. Runs at 7 PM and 9 PM in NY timezone, both before the 9:01 PM `dailyReset` wipes queues. Pipeline: aggregate from `ups_logs` + `invoices_archive` + `customer_rts_entries` + `abandoned_up_logs` → render PDF with Puppeteer → upload to Google Drive (best-effort) → resolve recipients (env + DB admins) → send Gmail per recipient (independent failures). Idempotent via `isAlreadySucceeded(business_date)`; cron passes `force: true` so 9 PM legitimately supersedes 7 PM."

#### E.2 Technical Deep Dive
- **Observability-first:** I wrote `report_job_history` + `report_delivery_logs` + `report_drive_upload_logs` *before* the aggregator. Every run is provable.
- **Idempotency model:** `isAlreadySucceeded(date)` only matches `status='succeeded'`. A stuck `running` row doesn't block retry. `force` bypasses entirely.
- **Per-recipient independence:** one bad address doesn't kill the run; failure recorded in `report_delivery_logs.status='failed'`, next recipient continues.
- **Drive failure is best-effort:** email still goes out, Drive link omitted if upload failed.
- **NY-timezone anchor:** `todayISO()` uses `Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' })`. `weekdayForDate(dateIso, tz)` anchors to noon UTC (`T12:00:00Z`) so DST transitions don't flip the calendar day.
- **Executive email body** (May 16 redesign): `renderExecutiveEmailHtml` — three sections (Combined, Arden, Waynesville). PDF attachment unchanged.

#### E.3 Follow-Up Questions
| Probe | Crisp answer |
|---|---|
| *Why two runs per day?* | 7 PM for the GM who leaves at 7:30; 9 PM final captures the last two hours. Both before 9:01 reset. |
| *What if Gmail is rate-limited?* | Per-recipient send is independent. Failed row in `report_delivery_logs` → next run retries. |
| *How do you know the report worked?* | One SQL query against `report_job_history.status` + `report_delivery_logs` aggregate. Don't need to check email. |
| *What's the timezone gotcha?* | UTC server vs NY business day. `Intl.DateTimeFormat` with `timeZone` is the only correct primitive. Avoid raw `new Date()`. |

#### E.4 Concise Senior-Level Response
> "Cron + Puppeteer + Drive + Gmail pipeline with three audit tables wired *before* the aggregator. Idempotent at the business-date level. Per-recipient independence. NY-anchored dates via `Intl.DateTimeFormat`. Reversible via env flag."

#### E.5 Mistakes Weak Candidates Make
- Treating "audit logging" as an afterthought. The audit tables are what make the system *operate*.
- Saying "we log to Sentry" when there's no Sentry — be honest about your observability primitives.
- Forgetting per-recipient independence — interviewers love asking "what happens if one email fails."

#### E.6 Stronger Communication Version
> "If the audit tables disappeared, this pipeline would still work — but it wouldn't be *operable*. That's the distinction I learned to make. A working pipeline is necessary; an operable pipeline is sufficient."

---

### 🔸 TOPIC F — Idle-Lock UX + Re-auth Replay (shared kiosk)

**📁 File:** `cfc/src/AUTH/authContext.jsx`
**🗄️ Storage:** `localStorage.cfc_locked_at`

#### F.1 Strong Interview Answer
> "Employees-only 5-minute idle lock. While locked, polling continues but action clicks queue in `pendingActionRef = { run, queuedAsUserId, queuedAt }`. Re-auth hits `POST /auth/verify-password` (no-side-effects). Response can include `{ switched: true, userId, user }` — different employee unlocked the same device. Session-takeover guard discards the queued action if the unlocker differs; 60-second TTL discards stale clicks; cross-tab via `storage` event."

#### F.2 Technical Deep Dive
- **Three guards in order:**
  1. `queuedAsUserId !== res.userId` → discard, toast "different user — re-click."
  2. `Date.now() - queuedAt > 60_000` → discard, toast "stale click."
  3. Otherwise replay `pendingActionRef.run()`.
- **Managers/admins are NOT locked.** On non-employee mount, `cfc_locked_at` is purged defensively in case it leaked from a previous employee session.
- **Cross-tab sync:** `addEventListener('storage', ...)` propagates lock/unlock to all open tabs of same origin.
- **Polling unaffected:** `useUPSQueue` continues polling even while locked — UI shows board state, just gates mutation clicks.

#### F.3 Follow-Up Questions
| Probe | Crisp answer |
|---|---|
| *Why employees only?* | Managers/admins are trusted device-level roles; locking them creates friction with no security benefit. |
| *What if the queued action stales out and user typed password 90s later?* | TTL expiry → discard, message "stale click — please retry." Better than executing a stale intent. |
| *How does the cross-tab story work?* | `storage` events fire on every tab in the same origin when localStorage changes. Tab A locks → tabs B/C see the event and lock. |

#### F.4 Concise Senior-Level Response
> "Server-side verify-password endpoint with no side effects. Frontend queues action with snapshot userId + timestamp. On unlock: identity-check + TTL-check, then replay or discard. Cross-tab via `storage` events. Managers/admins exempt."

#### F.5 Mistakes Weak Candidates Make
- Saying "JWT refresh" — there's no JWT in this codebase.
- Missing the session-takeover case — that's the interesting half of the design.
- Treating localStorage as the source of truth — it's a UX accelerator; verify-password is the actual auth boundary.

#### F.6 Stronger Communication Version
> "Shared-kiosk auth needed three guards, not one. The naive design — 'check password, replay action' — gets two of three cases wrong: a different employee can unlock, and a stale click can replay long after intent expired. The TTL + session-takeover snapshot together cover both."

---

### 🔸 TOPIC G — Multi-Seller Split Attribution (financial vs operational)

**📁 Files:** `backend/src/services/sales/ticketSeller.sql.js`, `backend/src/services/sales/salesCredit.js`
**📜 Rule (2026-05-13):** Financial split → all N sellers; Operational counts (UPs/served/tickets/closing/Comp Care) → primary (`sellerNames[0]`) only.

#### G.1 Strong Interview Answer
> "A ticket can list up to four sellers in `form_json.sellerNames`. Revenue splits equally: `credited_subtotal = subtotal / GREATEST(N, 1)` across all N. Operational metrics — UPS, served, tickets, closing ratio, care plan attach — credit the primary only (`sellerNames[0]`). I built it as a SQL CTE using `JSON_TABLE` + `FOR ORDINALITY` on MySQL 8, with a JS fallback (`expandTicketSellers`) for older servers. Runtime feature-detect via `supportsJsonTable()`."

#### G.2 Technical Deep Dive
- **CTE shape:**
  ```sql
  WITH TICKET_SELLER_CTE AS (
    SELECT ia.id AS invoice_id,
           JSON_UNQUOTE(JSON_EXTRACT(ia.form_json,
             CONCAT('$.sellerNames[', t.seller_idx - 1, '].name'))) AS seller_name,
           t.seller_idx AS seller_index,
           ia.form_json ->> '$.subtotal'
             / GREATEST(JSON_LENGTH(ia.form_json, '$.sellerNames'), 1)
             AS credited_subtotal
    FROM invoices_archive ia
    JOIN (... JSON_TABLE(...) ... FOR ORDINALITY ...) t
  )
  ```
- `FOR ORDINALITY` returns the 1-based array index — exactly the filter we need for "primary only" (`seller_index = 1`).
- The CTE is reused by `/api/ups/top-performers`, `/api/reports/today/*`, and `dailySalespersonSummary.service.js`. One source of truth for split attribution.

#### G.3 Follow-Up Questions
| Probe | Crisp answer |
|---|---|
| *Why split financial but not operational?* | Revenue is shared work; UPs/closing ratio measure individual performance. Splitting operational would dilute accountability. |
| *What if MySQL is older than 8.0.4?* | `supportsJsonTable()` returns false, callers fall through to `expandTicketSellers` — JS fan-out with the same output shape. |
| *How did you validate the two paths agree?* | Ran both on the same day's data and diffed per-row credited subtotals. Identical. |

#### G.4 Concise Senior-Level Response
> "`JSON_TABLE` + `FOR ORDINALITY` CTE for the canonical fan-out; JS fallback for older MySQL. Same output shape; runtime feature detect. Financial splits across N sellers; operational credits primary."

#### G.5 Mistakes Weak Candidates Make
- Splitting operational metrics. That would have shipped a "fair" leaderboard that no one trusts.
- Not knowing what `FOR ORDINALITY` does.
- Forgetting the fallback path — interviewers ask about MySQL version compatibility.

---

### 🔸 TOPIC H — Mandatory Signature Chain (rule engine on the frontend)

**📁 File:** `cfc/src/components/right/validateInvoiceSignatures.js`

#### H.1 Strong Interview Answer
> "Single function that returns an array of validation errors. Gated by invoice type (RG/PH/QS), payment method, balance status, item attributes (TW = took-with, NS1/NS2 = nailed locations), and care plan opt-in. RG has six customer signatures plus one manager signature in the worst case; PH (phone order) has zero customer signatures on screen — Adobe eSign tags fire in PDF only via `HeadlessChrome` user-agent detection. QS (quote sheet) and `store5` (admin/manager test flow) are exempt."

#### H.2 Technical Deep Dive

| Trigger | Required signature | Scope |
|---|---|---|
| Always | store location, ≥1 item, every item has `salePrice > 0` and (`extPrice` OR applied package) | RG + PH + QS |
| RG + TW item | `quantityAndPriceApprovalSignature` | Customer |
| RG + `carePlan==="Yes"` | `carePlanCharge > 0` + `carePlanApprovalSignature` | Customer |
| RG + `cash > 0` | `managerApprovalForCashSign` | Manager |
| RG + `balanceDue === total` | `managerApprovalForCashSign` | Manager |
| RG + any item from NS1/NS2 | `managerApprovalForCashSign` | Manager |
| RG | `saleApprovalSignature`, `paymentSummaryApprovalSignature`, `policiesSignature` | Customer |
| PH + `cash > 0` | `managerApprovalForCashSign` | Manager |
| PH (any) | Adobe eSign tags in PDF only | (via HeadlessChrome detection) |
| `storeLocation === "store5"` | All checks skipped | Admin/manager test flow |

#### H.3 Follow-Up Questions
| Probe | Crisp answer |
|---|---|
| *Why so many distinct signatures?* | Each has a distinct legal/operational purpose: policies (legal), sale-final (legal), payment-summary (financial), TW (logistics), care-plan (sales opt-in), manager-cash (override). Lumping them loses audit specificity. |
| *Why is `store5` exempt?* | It's the admin/manager test workflow — no real customer, no signature needed. |
| *How do you render Adobe eSign in HTML?* | `userAgent.includes('HeadlessChrome')` branch renders `{{Sig1_es_:signer1:signature}}` strings; live browser renders empty signature line. |

#### H.4 Concise Senior-Level Response
> "Pure rule-engine function. Six customer signatures plus one manager signature in worst case (RG). Phone order pushes signatures to PDF via Adobe eSign tags in a HeadlessChrome branch. Store5 exempts admin/manager test flow."

---

### 🔸 TOPIC I — NY-Timezone Anchoring (Daylight Saving correctness)

**🔧 Helpers:** `todayISO()`, `weekdayForDate(dateIso, tz)` in `backend/src/services/reports/dailySalespersonSummary.orchestrator.js` and `backend/src/config/employeeSchedule.js`

#### I.1 Strong Interview Answer
> "Server runs in UTC; the store's business day is anchored to America/New_York. Midnight UTC ≠ midnight NY, and on DST transition nights the 1–3 AM window can be ambiguous. I anchor all date-sensitive logic with `Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year:'numeric', month:'2-digit', day:'2-digit' })`. For weekday derivation, I anchor the input ISO to noon UTC (`T12:00:00Z`) so every IANA zone agrees on the calendar date."

#### I.2 Technical Deep Dive
```js
const todayISO = () => {
  const tz = process.env.STORE_TIMEZONE || 'America/New_York';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date());
  // parts is [{type:'year',value:'2026'}, {type:'month',value:'05'}, {type:'day',value:'25'}, …]
  return `${y}-${m}-${d}`;
};
```
- `ups_sessions.business_date` is an explicit `DATE` column (never `DATE(created_at)` which is ambiguous in UTC).
- `weekdayForDate(dateIso, tz)` constructs `new Date(`${dateIso}T12:00:00Z`)` then reads weekday in target tz — DST-safe.

#### I.3 Follow-Up Questions
| Probe | Crisp answer |
|---|---|
| *Why not just store everything as UTC?* | Business day boundaries are NY-anchored. Storing UTC and converting on read is fine; the bug is using UTC dates *as if they were NY dates*. |
| *What's the DST gotcha?* | Spring forward (1:59 AM → 3:00 AM) and fall back (1:59 AM → 1:00 AM). Naive `new Date()` math in local-server-tz silently breaks one day a year. |
| *Why noon-UTC anchor?* | Any time in `12:00–11:59` UTC maps to the same calendar date in every IANA zone (max offset is ±14 hours, so noon is always "today" everywhere). |

---

## 🛡️ 5 — Validation Architecture

| Layer | Mechanism | Examples |
|---|---|---|
| **DB constraints** | `UNIQUE`, `FK`, `CHK`, `ENUM` | `CHK_rts_returned_pos`, `CHK_rts_written_pos`, `UNIQUE(user_id, store_name, business_date)`, `ENUM('available','break','with_customer','offline')` on `ups_queue.status` |
| **Service layer** | Pure-logic validators | `validateManualFulfillment`, `parseComponentQuantities` (returns `null` for unconfident matches) |
| **Route layer** | `requireRole` middleware + in-route role re-check | Defense-in-depth for `/abandoned-up`, `/update-ups`, `/users CRUD` |
| **Frontend reducer** | `FIELD_NORMALIZERS` keyed by `section.field` | Phone format, currency 2dp, date MM-DD-YYYY — applied on dispatch, not in input |
| **Frontend gate** | `validateInvoiceSignatures.js` | Mandatory chain disables "Watch Invoice" button when errors exist |

> *"Validate at every layer that can corrupt state, but only once per kind."* — schema for shape, service for business rule, frontend for UX.

---

## ⏱️ 6 — Async Workflow Handling

### 6.1 Three patterns I rely on

| Pattern | Use case | Example |
|---|---|---|
| **Atomic boolean claim** | Exactly-once external side effect | Birdeye SMS: `UPDATE invoices_archive SET birdeye_sent=1 WHERE slug=? AND birdeye_sent=0` |
| **Per-store advisory lock + tx** | Race-safe state mutation | `withStoreTx(store, fn)` for every queue mutation |
| **Optimistic-lock + manual refetch** | Frontend poll vs in-flight mutation | `optimisticLockUntilRef = Date.now() + 2000` in `useUPSQueue` |

### 6.2 The flow you should be ready to draw

```
┌── User clicks "UP" ──┐
│                       │
│   1. setOptimisticLockUntilRef(now + 2000)
│   2. POST /api/ups/take
│   3. Server: withStoreTx → take → audit row → response
│   4. Frontend: setQueueState(serverResponse)
│   5. Optimistic-lock expires (~2s)
│   6. 1s poller resumes overwriting state from server
└───────────────────────┘
```

---

## 🛂 7 — Role-Based Access Flow

### 7.1 The model

```
            ┌─────────────────────────────────┐
            │  Browser sends userId in body / │
            │  query / x-user-id header        │
            └────────────────┬────────────────┘
                             │
                             ▼
            ┌─────────────────────────────────┐
            │  requireRole.js middleware       │
            │  1. SELECT role FROM cfc_users   │
            │     WHERE id = ? AND is_active   │
            │  2. If not in allowedRoles → 403 │
            │  3. req.cfcUser = {id, role, …}  │
            └────────────────┬────────────────┘
                             │
                             ▼
            ┌─────────────────────────────────┐
            │  Route handler                    │
            │  (sensitive ops double-check role)│
            └─────────────────────────────────┘
```

### 7.2 Permission matrix

| Action | Employee | Manager | Admin |
|---|:---:|:---:|:---:|
| View own-store queue | ✅ | ✅ | ✅ |
| Take UP | ✅ | ✅ | ✅ |
| Be Back | ✅ | ✅ | ✅ |
| Break | ✅ | ✅ | ✅ |
| **Abandoned UP** | ❌ | ✅ | ✅ |
| **Floor Mode toggle** | ❌ | ❌ | ✅ |
| **Idle-lock (5 min)** | ✅ | ❌ | ❌ |
| Store-5 (test flow) | ❌ | ✅ | ✅ |
| Analytics | ❌ | ❌ | ✅ |

---

## 🔄 8 — Rollback & Recovery

| Mechanism | Where used | Reversal time |
|---|---|---|
| Tri-state env flag (`UPS_FAIRNESS_V2`) | Fairness V2 rollout | seconds — one env-var flip |
| In-code feature flag (`PKG_COMPONENT_LOC_ENABLED`) | Package component dialog | 30 seconds — flip and redeploy frontend |
| Atomic claim rollback | Birdeye SMS retry | immediate — `UPDATE … SET birdeye_sent=0` |
| Audit-table-only writes | Daily summary | safe replay — `force: true` |
| Graceful degradation | Missing `pkg_component_locations` table | automatic — warning, not 500 |

> *"The expensive part of rollback isn't the flip — it's having a flag at all. I build the flag with the feature."*

---

## 🧩 9 — Edge Cases (the ones interviewers love)

| Edge case | Where I handle it | Lesson |
|---|---|---|
| Stale queue ghost from failed `dailyReset` | `fairInsertV2` filters `DATE(q.joined_at) = CURDATE()` | Consumers should be resilient to cleanup failures. |
| DST midnight ambiguity | `weekdayForDate` anchors to noon UTC | `new Date(ISO)` is ambiguous; `Intl.DateTimeFormat` is not. |
| Package description typo (parser can't match) | Returns `null`, dialog disables Save | Loud failure > silent default. |
| Two `/invoice/save` racing for same slug | Atomic boolean claim | Single column replaces a distributed lock. |
| Re-auth replays on shared kiosk | `queuedAsUserId` snapshot + 60s TTL | Three guards: identity, time, intent. |
| `/finish-up/start` racing `/finish` | `/finish` is the only opener | One atomic transition replaces two endpoints racing. |
| Manager state leaking to next employee on shared device | `cfc_locked_at` purged on non-employee mount | Defense-in-depth at component level. |
| 4 chairs in a package | `UNIQUE(package_id, item_id, instance_index)` | Schema must support worst-case shape on day one. |

---

## ⚡ 10 — Performance Optimizations

| Change | Impact | File |
|---|---|---|
| `idx_ia_created_at` on `invoices_archive(created_at)` | Day-range scan O(n) → O(log n) | `schema.sql` (May 19, 2026 block) |
| `TICKET_SELLER_CTE` with `JSON_TABLE` | In-DB fan-out replaces in-Node loop; ~30x faster on warmed cache | `services/sales/ticketSeller.sql.js` |
| Optimistic-lock in `useUPSQueue` | Eliminates poll-vs-mutation UI ghosts | `hooks/useUPSQueue.js` |
| Be Back removes `ups_taken`/`ups_handed_off` writes | Killed 2 of 3 closing-ratio clamps | `services/beBack.service.js` |
| Atomic claim instead of distributed lock | Zero new infrastructure for exactly-once | `routes/route.invpdf.js` |

---

## 📈 11 — Scalability Considerations (10× the current load)

| Bottleneck today | At 10× | Mitigation |
|---|---|---|
| 1s poll across 5 endpoints | 300+ reqs/sec at 10 stores | SSE feed off `ups_logs` inserts; fall back to poll |
| Sequential per-store daily summary build | 7 PM window stretches | `Promise.all` per-store, Puppeteer ~5 PDFs/sec |
| MSSQL inventory reads | Cache hit-rate matters | In-process LRU + 60s TTL per host |
| MySQL connection pool | `GET_LOCK` holds connections | Raise `connectionLimit`, per-store pools |
| `JSON_EXTRACT` on dedup | Bounded today; not bounded at scale | MySQL 8 functional index on `(name1, cell, DATE(created_at))` |
| `ups_logs` size | Year-long table grows | Partition by `business_date` |

---

## 🐛 12 — Debugging Strategies (the playbook)

| Symptom | First thing I check | Why |
|---|---|---|
| "Queue position wrong" | `ups_logs` for that user around the timestamp + lock-wait timing | 5s lock acquire could indicate concurrent mutation; audit row is canonical truth. |
| "Email said the wrong attendance" | `employeeSchedule.js` config — is the employee tracked? | Attendance is pure logic; bug is almost always input (untracked, name normalization, or timezone). |
| "Customer got two SMS" | `birdeye_sent` history on the slug | Pre-fix race; post-fix this should never happen. |
| "Salesperson appears twice on the board" | Open `ups_finish_logs` rows for that user | Pre-May-18 race; `clearAllFinishingUp` with `fallbackUserId` self-heals. |
| "Leaderboard hits 100% repeatedly" | Look for `LEAST(x, 100)` clamps in multiple services | Compensation pattern → root cause is upstream double-write. |

> **Heuristic:** *Three patches in three files for the same issue → you have a compensation pattern, not a fix.*

---

## 🛡️ 13 — Production-Risk Mitigation

| Risk | Mitigation |
|---|---|
| Cron job dies mid-write | Append-only audit; `status='running'` rows don't block retry; `force: true` for cron ticks. |
| Concurrent invoice saves | Atomic boolean claim + UPSERT-by-natural-key. |
| Failed nightly reset | `fairInsertV2` filters today's rows only. |
| Schema migration not deployed | Graceful degradation — service warns, doesn't 500. |
| Wrong user replays queued action | Session-takeover guard + 60s TTL. |
| Feature regression | Flag-able rollback for every behavior change. |
| Email delivery failure | Per-recipient independence + per-attempt logging. |

---

## 🔒 14 — Security Considerations (be honest about tradeoffs)

| Concern | Today's state | Threat model | Future move |
|---|---|---|---|
| No JWT | Body `userId` is trusted | LAN-only deployment, behind store firewall | HMAC-signed token over `{userId, issuedAt}` if going public-internet |
| Body `userId` forge-able | Role re-read from `cfc_users` per request | Privilege escalation via stale role is impossible | Same |
| `JSON_EXTRACT` on form_json | Parameterized, safe from SQL injection | Performance at scale | Materialize hot columns or functional indexes |
| Topaz signatures as base64 in form_json | LONGTEXT rows can grow | Storage size for two stores is acceptable | S3/object storage at scale |
| No CSRF tokens | API behind LAN | Internal-only consumers | Origin checks + CSRF tokens if public |

---

## 🔧 15 — Technical Tradeoffs (the table I memorize)

| Decision | Chose | Rejected | Why |
|---|---|---|---|
| Auth | Body `userId` + DB role re-check | JWT + cookies + middleware | LAN deployment; speed of delivery; no escalation risk |
| Concurrency | MySQL advisory lock + `FOR UPDATE` | Redis distributed lock | Single MySQL instance — adding Redis is operational debt for marginal gain |
| Idempotency | Atomic boolean claim | Distributed lock / message queue | One column replaces infrastructure |
| Daily report | Cron in-process | External worker / SQS | Two showrooms; cron is sufficient and observable via audit tables |
| State management | Single Redux slice | Multiple slices | Form is one coherent thing; `transactionMode` gates SALE vs RETURN |
| Storage of form | `form_json LONGTEXT` | Normalized columns | Schema churn would be expensive; JSON_EXTRACT is fast enough at our scale |
| Cron schedule | 7 PM + 9 PM | Single 9 PM | GM leaves at 7:30 PM — two runs is product-driven, not technical |

---

## 🧹 16 — Refactoring Decisions (what I changed mid-flight)

| Refactor | Trigger | Result |
|---|---|---|
| Removed Be Back metric writes | Three downstream clamps signaled compensation | Two of three clamps deleted; metrics math became correct by construction |
| Added `instance_index` to `pkg_component_locations` | First real package was 4 chairs | Schema now supports multi-instance; dialog rewrite was localized |
| Split `renderSummaryHtml` into `renderExecutiveEmailHtml` | GM was reading email on mobile and skipping rows | Three-section executive body for email; PDF unchanged |
| Made `/ups/finish` the only opener of `ups_finish_logs` | Two endpoints racing | Single atomic opener + `clearAllFinishingUp` with `fallbackUserId` for cleanup |
| Wrapped every queue mutation in `withStoreTx` | Original code had ad-hoc transactions | One primitive owns lock + tx + retry + error mapping |

---

## 🧱 17 — Maintainability Improvements

- **Schema-as-history:** every block in `schema.sql` is dated and idempotent.
- **Memory files:** `MEMORY.md` index of feature-specific notes (e.g., `project_pkg_component_loc_rollback.md`).
- **Pure-logic services:** `packageQtyParser`, `attendanceException.service` — no I/O, trivially unit-testable.
- **Naming:** `requireRole`, `withStoreTx`, `markFinishingUp`, `clearAllFinishingUp` — verbs that read like the action they perform.
- **Feature flags as code:** `PKG_COMPONENT_LOC_ENABLED` lives in `packageWarnings.js`, not in env, because it's a render-time decision the client must know.

---

## 🗂️ 18 — Code Organization Strategy

| Folder | Layer | Pattern |
|---|---|---|
| `backend/src/routes/` | HTTP boundary | Thin handlers — validation + auth + delegate to service |
| `backend/src/services/` | Business logic | Pure where possible; stateful only when DB is required |
| `backend/src/repositories/` | DB access | `formQuery`, `runSql` wrappers; prepared statements only |
| `backend/src/middleware/` | Cross-cutting | `requireRole`, error mappers |
| `backend/src/jobs/` | Cron entry points | One file per cron — orchestrator pattern delegates to services |
| `backend/src/config/` | Bootstrap | `schema.sql`, `initSchema.js`, `db.js`, `employeeSchedule.js` |
| `cfc/src/pages/` | Top-level views | One file per route |
| `cfc/src/components/` | UI primitives | Co-located helpers (`leftPanelHelpers.js`) for tight render loops |
| `cfc/src/UPS/` | Self-contained feature | Pages + hooks + services + utils inside the feature folder |
| `cfc/src/store/` | Redux | Single `formSlice` (intentional — form is one coherent thing) |
| `cfc/src/AUTH/` | Auth context | One provider, one consumer pattern (`useAuth`) |

---

## 🎤 19 — Six-Mode Answer Cheat Sheet (use the right mode for the question)

| Mode | When to use | Length |
|---|---|---|
| **Strong** | Default for "tell me about X" | 60–90s |
| **Deep** | Follow-up "go deeper" | 2–3 min |
| **Concise** | Final-round, time-pressed | 30s |
| **Mistake comparison** | "What would a junior engineer get wrong?" | 30s |
| **Stronger communication** | Bar raiser pushing on framing | 45s |
| **Tradeoff** | "Why this over X?" | 60s |

> Practice each topic in all six modes. The interviewer's question dictates the mode; your job is to match.

---

## 📋 20 — One-Page Memorization Card

```
Concurrency:   GET_LOCK('ups_queue_lock:'||store, 5) + FOR UPDATE inside withStoreTx
Idempotency:   UPDATE … SET birdeye_sent=1 WHERE slug=? AND birdeye_sent=0
Fairness:      ups_sessions.first_ups_at NULL → ineligible, FIFO tail
Timezone:      Intl.DateTimeFormat('en-CA', {timeZone:'America/New_York'})
Flag rollback: PKG_COMPONENT_LOC_ENABLED in packageWarnings.js (30s revert)
Tri-state:     UPS_FAIRNESS_V2 = off | shadow | on (shadow → on cutover)
Display:       formatDisplayName(first, last) — never username
Schema:        every block dated + "run this while deployment"
Audit-first:   report_job_history / report_delivery_logs / report_drive_upload_logs written BEFORE aggregator
Validation:    DB constraints → service rules → route role check → frontend gate
Cron:          0 19,21 * * * America/New_York
```

---

> **Final note to self:** *Every answer should end with a hook the interviewer can pull. Never close on "and that's how it works" — close on the next interesting design choice.*
