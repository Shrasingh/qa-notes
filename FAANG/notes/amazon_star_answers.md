# 🎯 Amazon SDE-1 — Elite STAR Answers (full scripts)

> **Format per story:** Principle → Situation → Task → Action → Result → Probing follow-ups (with crisp answers) → Why it lands → Mistakes to avoid → Stronger-phrasing alternative.
> **Delivery time:** target 2 min for the STAR; expect 3–6 follow-ups after.

---

## ⭐ STAR-01 — The 8 PM Pipeline (Ownership · Highest Standards)

> **Anchor:** *"I built `report_job_history` + `report_delivery_logs` + `report_drive_upload_logs` BEFORE the aggregator. Observability before functionality."*

### Situation
Carolina Furniture Concepts runs two showrooms — Arden and Waynesville. The GM was Slack-screenshotting numbers to himself every night because nobody had consolidated UPS counts, revenue, closing ratios, RTS activity, abandoned UPs, and attendance into one place. The ask was *"can we get a daily email."*

### Task
Build the pipeline reliable enough that the GM could stop manually compiling numbers, runs in NY timezone on a UTC server, and **survives partial failures** — one bad recipient address can't kill the run, a Drive outage can't block the email.

### Action
- **Schedule:** `0 19,21 * * *` in `America/New_York`. 7 PM is the mid-evening snapshot; 9 PM is the revised final — both *before* the 9:01 PM `dailyReset` wipes queues.
- **Split orchestrator** into six named services so each step was independently testable:
  - `dailySalespersonSummary.orchestrator.js` — top-level flow + `force` flag for cron ticks.
  - `dailySalespersonSummary.service.js` — aggregator over `ups_logs`, `invoices_archive`, `customer_rts_entries`, `abandoned_up_logs`.
  - `dailySalespersonSummary.pdf.js` — three renderers (`renderSummaryPdf`, `renderExecutiveEmailHtml`, `renderSummaryCsv`).
  - `dailySalespersonSummary.drive.js` — best-effort Drive upload.
  - `dailySalespersonSummary.recipients.js` — env `REPORT_RECIPIENTS` ∪ DB admin emails, gated by `REPORT_INCLUDE_DB_RECIPIENTS`.
  - `dailySalespersonSummary.audit.js` — `startJobRun`, `finishJobRun`, `logDelivery`, `logDriveUpload`, `isAlreadySucceeded`.
- **Three audit tables before any feature code** — that was the deliberate ordering.
- **Idempotency:** `isAlreadySucceeded(business_date)` only returns true on `status='succeeded'`. A stuck `running` row doesn't block retry. Cron ticks pass `force: true` so 9 PM legitimately supersedes 7 PM.
- **Per-recipient independence:** each Gmail send is its own try/catch + audit row. One bad address fails its own row; the next recipient continues.
- **Drive is best-effort.** Email still goes out; Drive link injected only on successful upload.
- **NY-timezone anchor:** `todayISO()` via `Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' })` — never raw `new Date()`.

### Result
- GM gets two emails per day with PDF + Drive archive link.
- Every run provable via one SQL query against `report_job_history`.
- First week: a transient Gmail rate-limit failed one recipient — audit row showed which recipient, which error, which attempt. Next run sent successfully. **Zero false-fail re-sends.**
- Attendance section caught two real scheduling issues in the first week — feature *and* safeguard working.

### Probing Follow-ups
| Q | A |
|---|---|
| *Why three audit tables and not one?* | Different cardinality + failure semantics. Job-level is 1 row per attempt; recipient-level is N rows per attempt; Drive-level is independent of email. Coupling them would force one table to serve three queries. |
| *Why two runs per day?* | 7 PM mid-evening for the GM who leaves at 7:30. 9 PM final for the last two hours. Both before the 9:01 reset. |
| *How do you know an email was actually delivered?* | I know Gmail accepted it. `status='sent'` + `provider_message_id` is "Gmail accepted." Bounce-handling is a future integration. |
| *What if the job dies between Drive upload and Gmail send?* | Drive log says `status='succeeded'` with `file_id`; Gmail isn't logged. Next run sees `report_job_history.status='running'` from the dead one; `isAlreadySucceeded` returns false; runs fresh. |
| *What's the rollback path if the report format is wrong?* | Each renderer is independent; I can ship a fix to just `renderExecutiveEmailHtml` without touching the PDF or the aggregator. |

### Why It Lands
SDE-1 ownership = "I built this end-to-end and I can defend every piece." This story includes cron + retries + idempotency + observability + 3rd-party API integration + a real timezone gotcha — breadth without sacrificing depth.

### Mistakes to Avoid
- Saying "we" — the audit tables were a deliberate solo design decision.
- "Vague results" — name a number, a table, or an observable behavior.
- Forgetting the timezone story — bar raisers love DST follow-ups.

### Stronger-Phrasing Alternative
> *"If the audit tables disappeared, this pipeline would still work — but it wouldn't be operable. A working pipeline is necessary; an operable pipeline is sufficient. That's the distinction this project taught me."*

---

## ⭐ STAR-02 — Birdeye Duplicate SMS Root Cause (Dive Deep · Are Right A Lot)

> **Anchor:** *"Two lines of SQL did the work of a distributed lock."*

### Situation
Around April 14, 2026, the team reported customers occasionally receiving two Birdeye review-request SMS for the same invoice. The pattern was intermittent — roughly one in fifty saves. First hypothesis: a frontend double-click. Proposed fix: disable Save on click.

### Task
Find root cause. I rejected the surface fix because disabling a button masks a race instead of solving it.

### Action
1. Read `route.invpdf.js /invoice/save` end-to-end. Two effectful operations on save:
   - UPSERT into `invoices_archive` (dedup by `(name1, cell, DATE(created_at))`).
   - Birdeye SMS send branch.
2. The SMS branch had a classic non-atomic check-then-act:
   ```js
   const row = await getInvoice(slug);
   if (row.birdeye_sent === 0) {
     await sendBirdeyeSMS(...);   // network call
     await formQuery('UPDATE … SET birdeye_sent=1 WHERE slug=?', [slug]);
   }
   ```
3. Reproduced: opened the same invoice in two tabs, clicked Save in both within a second → two SMS, every time.
4. Replaced with **atomic claim**:
   ```sql
   UPDATE invoices_archive SET birdeye_sent = 1
     WHERE slug = ? AND birdeye_sent = 0
   ```
   Only the request whose `affectedRows === 1` actually sends. On SMS-send failure, roll back: `UPDATE … SET birdeye_sent = 0` so a retry can re-claim.
5. Deployed. Re-ran the two-tab reproduction → one SMS.

### Result
- **Zero duplicate SMS** in production since deploy.
- The `birdeye_sent` column doubles as a support flag — "did this customer receive the SMS?" is one SELECT.
- No new infrastructure (no Redis, no queue, no distributed lock library).
- Pattern adopted for any future exactly-once external call.

### Probing Follow-ups
| Q | A |
|---|---|
| *Why not `SELECT … FOR UPDATE`?* | It works but holds a row lock for the duration of the multi-hundred-ms Birdeye HTTP call. Atomic UPDATE releases the lock instantly; HTTP call happens lock-free. |
| *What about rollback if SMS fails?* | `UPDATE … SET birdeye_sent=0 WHERE slug=?` so the next retry can re-claim. The boolean is not a tombstone. |
| *Could you have added a unique constraint?* | Unique on what? `slug` is already unique. The bug was a non-atomic read-then-write, not a duplicate row. |
| *What if the process dies between claim and successful send?* | Claim says `1`, no SMS went. We accept this as "lost send" because Birdeye dedup on their side handles repeated requests cleanly. For stronger semantics I'd add `birdeye_claimed_at` and a sweeper that rolls back claims older than N seconds without a corresponding success log. |
| *Why not use Birdeye's idempotency key?* | If they exposed one, I would. The atomic claim is what I can do without external dependency on Birdeye's API contract. |

### Why It Lands
Canonical Dive Deep arc: rejected the surface fix → traced to root cause → solved with primitive simpler than the alleged solution. Bonus points for naming the pattern (CAS) without being pedantic.

### Mistakes to Avoid
- "We added a try/catch" — that's not a fix.
- Confusing this with the dedup path. Two different problems in the same route.
- Claiming the unique constraint was the fix.

### Stronger-Phrasing Alternative
> *"Compare-and-swap implemented in SQL. The database is the lock. The `affectedRows` count is the success signal. No application-level lock needed."*

---

## ⭐ STAR-03 — The 30-Second Rollback (Bias for Action)

> **Anchor:** *"I had the flag because I built the flag in advance. Bias for Action is partly preparation."*

### Situation
2026-05-23, three days after rolling out the package-component location dialog. An issue surfaced that impacted the live floor. I didn't have full root cause yet — investigation vs immediate mitigation was the decision.

### Task
Restore floor operations fast. Investigate calmly afterward.

### Action
- Flipped `PKG_COMPONENT_LOC_ENABLED` to `false` in `cfc/src/utils/packageWarnings.js`.
- No other code changes. No schema rollback. Saved rows in `pkg_component_locations` stayed in place for re-enablement.
- Dialog stopped mounting. Invoice rows stopped rendering child components. Warehouse reverted to the pre-May 20 single-row-per-package experience.
- Documented in my project-memory file `project_pkg_component_loc_rollback.md` so anyone walking up cold knows "flip the flag back to re-enable."

### Result
- Floor unaffected within minutes.
- Full afternoon to investigate calmly without operational pressure.
- Saved data survived for re-enablement — no data loss, no migration needed to revert.

### Probing Follow-ups
| Q | A |
|---|---|
| *Wasn't this a workaround, not a fix?* | Workaround now, fix later. The asymmetry of cost was the decision — broken floor costs revenue; an unnecessary flag-off costs an hour. |
| *How do you decide flag-off vs forward-fix?* | Containable + no flag → forward-fix fast. Stuck floor + flag exists → flag off, investigate calmly. |
| *Was the flag added pre-emptively or after a fire drill?* | Pre-emptively. Every behavior change ships with a flag. That's the cost-of-doing-business I committed to after the first painless rollback. |
| *What about the saved data in `pkg_component_locations`?* | Untouched. Schema migrations are forward-compatible (new columns nullable, new tables additive). Re-enabling the flag turns the feature back on with all historical assignments intact. |

### Why It Lands
SDE-1 bias for action = "I can make a small reversible decision quickly." The critical part is *preparation* — the flag existed because I designed it that way.

### Mistakes to Avoid
- Saying "I disabled the feature" — name the flag, name the file.
- Forgetting the data-preservation angle. Flags + idempotent schemas = clean revert.

---

## ⭐ STAR-04 — Be Back Metric Drift (Earn Trust · Dive Deep)

> **Anchor:** *"I led with the corrected numbers, not the diagnosis."*

### Situation
Around May 20, 2026, I noticed three independent services were each clamping closing ratio at 100% — `ups.routes.js /top-performers`, `todayReports.service.js`, and `dailySalespersonSummary.service.js`. Three clamps in three services is a compensation pattern. I traced root cause to `beBack.service.js` writing two `ups_logs` rows for every Be Back handoff: `ups_taken` (receiver) and `ups_handed_off` (giver). For ~2 weeks, the closing-ratio leaderboard had been systematically biased.

### Task
Tell the GM. He had used those numbers in Monday's all-hands meeting.

### Action
1. Drafted the message with three things in this order: (1) the leaderboard you used Monday is wrong, (2) here's the corrected number for each affected salesperson, (3) here's the root cause and the fix.
2. Delivered in person, not Slack — the conversation needed to be a conversation.
3. Same day, shipped the fix in `beBack.service.js`: removed `ups_taken` and `ups_handed_off` writes. Be Back is routing, not a metric event.
4. Added the **BB Accepted** column to the daily summary so handoffs stay visible without distorting metrics.
5. Removed two of the three downstream `LEAST(closing_ratio, 100)` clamps. The third stayed because the cap-at-100% is the official business definition (not a math bug).

### Result
- GM had the right numbers within 24 hours. He re-published the prior week's leaderboard with the correction noted.
- The fix shape (no metric writes for Be Back, visible BB Accepted column) became the model for the Abandoned UP feature the following week.
- The clamps that remained are now *intentional*, not compensating.

### Probing Follow-ups
| Q | A |
|---|---|
| *Why not silently fix it?* | He used the numbers in a meeting. Silent fix leaves him with a wrong memory of who's on top. Trust comes from leading with the bad news. |
| *Could you have caught this earlier?* | Yes — a metrics-integrity test asserting `closing_ratio` doesn't need a clamp under clean data would have flagged it. I added that to my "next time" list. |
| *How do you know removing the writes is root cause, not a symptom?* | Removing the writes made two clamps removable. If I'd only removed one write or one clamp, the others would still be needed. Removability is the proof of root cause. |
| *What if the GM didn't agree to republish?* | I'd have offered the choice: republish corrected, or stop using those numbers. Quietly suppressing the bad numbers while still trusting them wasn't an option. |

### Why It Lands
Earn Trust at SDE-1 = "I deliver bad news fast with the diagnosis and the fix in the same breath." Concrete numbers + re-published leaderboard + reused pattern in next feature.

### Mistakes to Avoid
- "We told stakeholders" — name the person, name the meeting, name the artifact (the leaderboard).
- Apologizing as the lead. The corrected numbers are the lead.

### Stronger-Phrasing Alternative
> *"Three clamps in three services taught me to look for *patterns of compensation*. Clamps are symptoms; the cure is upstream. The leaderboard was wrong because we were double-counting, not because the math couldn't be capped."*

---

## ⭐ STAR-05 — UPS Fairness V2 Shadow → On (Deliver Results · Earn Trust)

> **Anchor:** *"Eight days from shadow to on. The whole rollout was reversible at any moment because the read mode was a single env var."*

### Situation
The original UPS queue (V1) treated everyone the same way — a late joiner at 12:30 PM with zero UPs that day could land ahead of the crew that had been on the floor since 9 AM. The team wanted a fairness rule: ineligible new joiners go to the tail; eligible incumbents go where their `ups_count` says.

### Task
Roll out the new rule without breaking the live floor.

### Action
- **Tri-state env flag `UPS_FAIRNESS_V2 = off | shadow | on`.**
- **Shadow week (May 1–7):** V1 reads unchanged, dual-write to a new `ups_sessions` table. The crew observed the new table populating with no behavior change. I wrote a comparison script that compared what V2 *would* have done against what V1 *actually* did.
- **`upsFairness.js` (~415 lines):**
  - `withStoreTx(store, async (conn) => …)` — per-store named advisory lock + transaction.
  - `getOrOpenSession(conn, userId, store)` — idempotent open/re-open of today's session.
  - `fairInsertV2(conn, userId, store, session)` — eligibility-gated insertion.
- **Eligibility rule:** an employee earns fairness only after `first_ups_at` is stamped (first `/ups/take` of the day). Until then they FIFO-append to the tail.
- **Cutover (May 8):** flipped `UPS_FAIRNESS_V2 = on`. Reads switched. No data migration. No downtime.
- **Retry semantics:** deadlock + lock-wait-timeout retried twice with fresh connection; `LOCK_TIMEOUT` returned as 503 retryable.

### Result
- Behavior changed live with **one env-var flip**.
- Shadow week proved the algorithm against production data.
- Zero rollback needed; revert path was the same single flip.
- The new `ups_sessions` table now powers the closing-ratio numerator and the BB Accepted column too — single source of truth.

### Probing Follow-ups
| Q | A |
|---|---|
| *What if shadow showed a divergence?* | Flip back to `off`, debug, redeploy. The risk is bounded — no read-path changes during `shadow`. |
| *What's the deadlock story?* | `withStoreTx` retries twice with a fresh connection. Structured `UpsError` codes map to HTTP status + retryable flag for frontend backoff. |
| *Why a per-store lock, not a global lock?* | Single MySQL instance, two stores. Per-store sharding means adding stores is linear. Global lock would serialize all stores. |
| *What about position 1?* | Position 1 is locked — only manager `recycle` can move it. Joining at fair position never overwrites position 1 because the scan starts from 2. |

### Why It Lands
Textbook Deliver Results + Earn Trust: shadow-rollout pattern, single-toggle revert, observable behavior change.

### Stronger-Phrasing Alternative
> *"I shipped a behavioral change to a live system using a shadow-rollout pattern with a single-toggle revert. The pattern itself was the deliverable — the next behavioral change (package component dialog) used the same shape."*

---

## ⭐ STAR-06 — Server-Authoritative Finishing Up (Have Backbone · Disagree and Commit)

> **Anchor:** *"localStorage gives you a fast badge. The server gives you the truth. The hybrid is both."*

### Situation
The first version of the finishing-up paperwork timer was proposed as localStorage-only — "it's just a badge, no need for a server table." I disagreed because of cross-device behavior: a salesperson can start paperwork at the front counter on device A and finish at the manager's desk on device B; the badge would be wrong on device B.

### Task
Argue for a server-authoritative `ups_finish_logs` table without losing the snappiness of the localStorage badge.

### Action
- Proposed the hybrid: `ups_finish_logs` is the truth (the queue UI on every device reads from `/ups/finish-up/active`); localStorage is a same-tab elapsed-timer accelerator with a 30-min TTL.
- May 18 atomic fix: `/ups/finish` became the *only* opener of an `ups_finish_logs` row. Pre-fix, both `/ups/finish` and `/finish-up/start` could open a row, leaving two open rows for the same user.
- Added `clearAllFinishingUp(workflowType, fallbackUserId)` — if localStorage is empty (private browser, second device, cache wipe), the call still closes the open row by `(userId, ended_at IS NULL)` lookup.

### Result
- Cross-device finishing-up state is consistent.
- localStorage still makes the badge feel instant.
- The May 18 atomic fix eliminated the duplicate-row class of bug.
- The pattern (server-authoritative + same-tab accelerator) became the model for every subsequent feature.

### Probing Follow-ups
| Q | A |
|---|---|
| *How do you decide localStorage vs server?* | Server-authoritative for anything multi-device. localStorage for same-tab UX accelerators only. The litmus test: "if someone signs in on a second device, do they see the same state?" |
| *What about the lag of polling vs localStorage?* | Board polls every second. localStorage is "this tab's truth"; server is "everyone's truth." Lag is 1s for cross-device, 0s for same-tab — acceptable. |
| *What if you'd lost the argument?* | I'd have committed by adding cross-tab `storage` event listeners and writing 'this is a same-tab badge only' into the file header. The bug would have surfaced anyway. |

### Why It Lands
"I disagreed with a simpler design, made the case, got us to a hybrid that's both correct and fast." Concrete code anchors (`ups_finish_logs`, `fallbackUserId`, `/finish-up/active`) make it credible.

---

## ⭐ STAR-07 — Atomic Boolean Claim (Invent and Simplify)

> **Anchor:** *"One column replaced what teams reach for a queue to solve."*

(See STAR-02 for the technical detail; this story is the same fix viewed through the Invent and Simplify lens.)

### Situation
Concurrent invoice saves were sending duplicate Birdeye SMS.

### Task
Fix without introducing new infrastructure (no Redis, no queue, no library).

### Action
- One column: `birdeye_sent`.
- One query pattern: `UPDATE … SET birdeye_sent=1 WHERE slug=? AND birdeye_sent=0`. `affectedRows === 1` is the success signal.
- On send failure: `UPDATE … SET birdeye_sent=0 WHERE slug=?` so retry can re-claim.

### Result
- Zero duplicate SMS.
- The column doubles as a support flag and feeds the daily report aggregator.

### Why It Lands
"Solved a real concurrency problem with one column and one query." Bar raisers love clean primitives. Bonus: name the pattern (CAS) without being pedantic.

### Stronger-Phrasing Alternative
> *"The database is the lock. The `affectedRows` count is the success signal. The simplest form of the right answer."*

---

## ⭐ STAR-08 — Closing-Ratio Cap (Are Right, A Lot)

> **Anchor:** *"People wanted the cap removed. Data showed unbounded was an artifact of double-counting, not a math bug."*

### Situation
During the Be Back metric drift post-mortem, someone proposed removing the `LEAST(closing_ratio, 100)` cap entirely. The argument was: "the math should just work; if numbers exceed 100, the math is wrong."

### Task
Decide whether the cap was a bug or a definition.

### Action
1. Pulled the data. In the legitimate post-fix flow, a Be Back receiver who closes the sale gets `primary_tickets = 1` against `ups_taken_raw = 0`. The raw ratio is "undefined" or infinity.
2. Considered three options:
   - Remove the cap, accept undefined/infinity (broken UI).
   - Change the formula to a different denominator.
   - Keep the cap; it's the business definition, not a math bug.
3. Made the case with three concrete example rows showing what each produced.
4. Chose option 3. The business defines closing ratio as "primary tickets over UPs you personally took, capped at 100% by definition."

### Result
- Cap stayed in `dailySalespersonSummary.service.js`.
- Be Back metric writes were removed (the real bug).
- Two of three downstream clamps deleted; the surviving one is the official business cap.

### Probing Follow-ups
| Q | A |
|---|---|
| *How do you distinguish math bug from definition?* | A math bug breaks reproducibility — same data, different answers. A definition is "this is what the business calls it." If removing the cap would change the business's mental model of the KPI, it's a definition. |
| *How did you make the case?* | Three example rows. Walked through each: with cap, without cap. The without-cap version had a 500% closing ratio that was meaningless. |

### Stronger-Phrasing Alternative
> *"I trusted the data over the opinion that 'math should just work.' The unbounded ratios were artifacts of upstream double-counting, not a math problem the cap was solving."*

---

## ⭐ STAR-09 — `JSON_TABLE` + `FOR ORDINALITY` (Learn and Be Curious)

> **Anchor:** *"`FOR ORDINALITY` does in SQL what I'd been doing with in-process counters for years."*

### Situation
Per-salesperson revenue needed multi-seller split — a ticket with 3 sellers credits `subtotal / 3` to each. Daily summary aggregates ~hundreds of tickets per day; interactive endpoints (`/top-performers`, `/today`) are latency-sensitive.

### Task
Decide between (a) fanning out in Node and aggregating in-process, or (b) doing it in SQL.

### Action
1. Recognized that the same query was used by three endpoints. SQL CTE means one source of truth.
2. Spent an hour learning `JSON_TABLE` in MySQL 8. The killer feature was `FOR ORDINALITY` — the 1-based array index of each element. Exactly the `seller_index = 1` filter I needed for "primary only" operational metrics.
3. Built `TICKET_SELLER_CTE` in `backend/src/services/sales/ticketSeller.sql.js`:
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
4. Added `supportsJsonTable()` runtime check + JS fallback `expandTicketSellers` for older MySQL.
5. Validated parity by running both paths on same day's data and diffing per-row credited subtotals — identical.

### Result
- ~30x faster than in-Node fan-out on warmed-cache range queries.
- One CTE feeds three endpoints — single source of truth.
- Fallback path means older MySQL deployments still work.

### Probing Follow-ups
| Q | A |
|---|---|
| *What surprised you?* | `FOR ORDINALITY` — I'd been writing in-process counters to do exactly this for years. |
| *How do you know parity?* | Diffed identical per-row credited subtotals + primary-only filtering across both code paths on the same data. |
| *Why not require MySQL 8?* | Older deployments exist. Runtime feature detect + fallback is operational maturity, not over-engineering. |

### Why It Lands
"I learned something new because the simple answer wasn't good enough" + a graceful-degradation fallback shows operational discipline.

---

## ⭐ STAR-10 — Schema Wide Enough on Day One (Failure → Lesson)

> **Anchor:** *"Schema should support the worst-case data shape on day one, even if v1's UI only exposes the simple case."*

### Situation
First version of the package-component location dialog (May 20) supported one instance per item per package. First real package I tested in staging was a 4-chair set — `ItemPackageMaster` had four rows for the same chair item_id, one per piece. My schema had `UNIQUE(package_id, item_id)` — couldn't represent "chair #1 → S1, chair #2 → S2."

### Task
Rewrite without disrupting active use.

### Action
- Added `instance_index INT` column.
- New unique key: `UNIQUE(package_id, item_id, instance_index)`.
- Dialog rewrite: per-instance card with its own location picker.
- Qty parser still returned `required_qty = 4` for the chair component; validator checked `SUM(loc qty across all 4 instances) === 4`.

### Result
- Multi-instance support in production by end of week.
- Pattern generalized: every schema design now starts with "what's the worst-case shape?"

### Probing Follow-ups
| Q | A |
|---|---|
| *How did you discover the gap?* | First real package I tested. `ItemPackageMaster` had four rows for the same chair — that's how the ERP encodes multi-instance. |
| *Could you have known earlier?* | Yes — one query against `ItemPackageMaster ORDER BY (item_id, count(*)) DESC` would have surfaced multi-instance packages on day one. I added that as a "first query before schema" rule. |

### Why It Lands
Failure story with a generalizable lesson + concrete artifact (the schema change). Bar raisers reward self-awareness.

---

## ⭐ STAR-11 — Frugality (Reusing the Daily Summary Pipeline for RTS)

> **Anchor:** *"The 8 PM email already knew how to render and deliver. I just gave it a new section."*

### Situation
When we added the RTS interaction-capture feature, the ask included "we need it visible in the daily report."

### Task
Don't build a separate pipeline.

### Action
- Added one schema block: `customer_rts_entries(salesperson_id, username, store_name, returned_amount, written_sale, interaction_id, created_at)`.
- Added one service: `rts.service.js` with `createRtsEntry` + `fetchRtsEntriesForDay`.
- Added one section to the existing `dailySalespersonSummary.service.js` aggregator. The PDF renderer picked it up automatically (iterates over named sections).
- Linked to `customer_acquisition` via `interactionId` so each RTS shows which acquisition source led to the return.

### Result
- RTS section in daily PDF + executive email with zero new pipeline.
- Net new code: one table, one service, one section.

### Why It Lands
"Notice the right pipeline already exists; don't build a new one." Concrete reuse + minimal net new surface area.

---

## ⭐ STAR-12 — Observability Before Functionality (Highest Standards)

> **Anchor:** *"From day one, I could answer 'did the 9 PM run actually go out?' in one SQL query."*

(Same project as STAR-01; this is the same work viewed through the "highest standards" lens.)

### Situation
Daily summary email job — could ship happy-path-first and add logging when something broke, or build the audit tables first.

### Task
Pick the order.

### Action
- Wrote `report_job_history` first — one row per attempt with status/attempt_no/duration_ms/error_message.
- Wrote `report_delivery_logs` second — one row per recipient per attempt.
- Wrote `report_drive_upload_logs` third — one row per file upload.
- Wrote the orchestrator that emits rows into all three at the right boundaries.
- *Then* wrote the aggregator and renderer.

### Result
- First cron tick: every row in every audit table was already wired.
- Could prove the job ran without checking email.
- One transient Gmail rate-limit in week one: audit row told me which recipient, which error, which attempt. Retry logic handled it.

### Stronger-Phrasing Alternative
> *"A working pipeline is necessary. An operable pipeline is sufficient. Observability isn't a feature you add later — it's the feature that makes everything else operable."*

---

## 📋 STAR Quick-Reference Card

| # | Story | Primary LP | Secondary LP | Anchor |
|---|---|---|---|---|
| 01 | 8 PM Pipeline | Ownership | Highest Standards | Audit tables before aggregator |
| 02 | Birdeye Dup SMS | Dive Deep | Are Right A Lot | Two lines of SQL replaced distributed lock |
| 03 | PKG Flag Rollback | Bias for Action | — | 30-second revert because I built the flag |
| 04 | Be Back Metric Drift | Earn Trust | Dive Deep | Led with corrected numbers, not diagnosis |
| 05 | UPS Fairness V2 | Deliver Results | Earn Trust | One env-var flip; shadow week proved algo |
| 06 | Server-Auth Finishing | Have Backbone | — | localStorage gives badge; server gives truth |
| 07 | Atomic Claim | Invent & Simplify | — | One column replaced infrastructure |
| 08 | Closing-Ratio Cap | Are Right A Lot | — | Data over opinion; cap is definition not bug |
| 09 | JSON_TABLE | Learn & Be Curious | Frugality | FOR ORDINALITY in SQL; 30x faster |
| 10 | PKG Schema | Failure → Lesson | Are Right A Lot | Schema for worst-case shape day one |
| 11 | RTS Pipeline Reuse | Frugality | — | Existing pipeline absorbed new section |
| 12 | Audit-First | Highest Standards | Ownership | Operability is sufficient; working is necessary |

---

## 🎤 STAR Delivery Templates (use these stems on the fly)

- **Situation stem:** *"At Carolina Furniture Concepts, our two-showroom operation needed [specific operational need]…"*
- **Task stem:** *"My job was to [specific outcome], without [specific failure mode]."*
- **Action stem (3+ bullets always):** the file, the function, the table, and one tricky decision.
- **Result stem:** *"After we shipped, [observable behavior or named artifact]."* Avoid vague results — name a table, a column, or a behavior.

> **End every STAR on a hook** the interviewer can pull. Never close on "and that's how we did it" — close on the next interesting design choice.
