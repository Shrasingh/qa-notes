# 🏛️ Amazon SDE-1 — Elite Leadership Principles Question Bank

> **How to use:** the strongest stories sit in `amazon_star_answers.md`. This file is the question-and-anchor inventory, mapped principle-by-principle to actual CFC code.
> Every Q has: **Question · Code Inspiration · Anchor Line · STAR Skeleton · Probing Follow-ups · Interviewer Criteria · Why It Lands · Mistakes to Avoid**.

---

## 📜 Master Mapping — Principle → Strongest Code Anchor

| # | Leadership Principle | Strongest Story | Code Anchor |
|---|---|---|---|
| 1 | Ownership | 8 PM Daily Summary pipeline | `dailySalespersonSummary.orchestrator.js` |
| 2 | Dive Deep | Birdeye duplicate SMS root cause | `route.invpdf.js` (atomic claim) |
| 3 | Bias for Action | PKG flag rollback in 30 seconds | `cfc/src/utils/packageWarnings.js` |
| 4 | Customer Obsession | Abandoned UP restoring fairness | `abandonedUp.service.js` |
| 5 | Deliver Results | UPS Fairness V2 shadow → on rollout | `upsFairness.js` |
| 6 | Invent and Simplify | Atomic boolean claim for SMS | `route.invpdf.js` |
| 7 | Learn and Be Curious | `JSON_TABLE` + `FOR ORDINALITY` | `sales/ticketSeller.sql.js` |
| 8 | Earn Trust | Telling GM the leaderboard was wrong | `beBack.service.js` (May 21 fix) |
| 9 | Are Right, A Lot | Defending the closing-ratio cap | `todayReports.service.js` |
| 10 | Have Backbone | Server-authoritative finishing-up | `ups_finish_logs` schema |
| 11 | Insist on Highest Standards | Observability-first audit tables | `report_*` triad |

---

## 1️⃣ OWNERSHIP

### Q1.1 — "Tell me about a time you took ownership of something beyond your assigned scope."

| Field | Content |
|---|---|
| **Code inspiration** | I was asked for "an end-of-day email" — I built the cron + PDF + Drive + Gmail + 3 audit tables. |
| **Anchor** | *"I built `report_job_history` + `report_delivery_logs` + `report_drive_upload_logs` **before** the aggregator. Observability before functionality."* |
| **STAR skeleton** | S: GM wanted a single daily email. T: build it reliable enough to stop checking dashboards. A: split into 6 named services; audit tables first; per-recipient independence; idempotent via `isAlreadySucceeded(date)`. R: two emails/day, every send provable in one SQL query, attendance section flagged 2 real scheduling issues week one. |
| **Probing follow-ups** | • Why three audit tables? *(Different cardinality + failure semantics)* • What if Gmail fails? *(Per-recipient log, next run retries)* • Why two cron times? *(GM leaves 7:30; final 9 PM before reset)* |
| **Interviewer criteria** | Did you go beyond literal ask? Did you build operability, not just functionality? |
| **Why it lands** | Ownership at SDE-1 = "I own end-to-end including the parts no one specced." |
| **Mistakes to avoid** | Saying "we" instead of "I"; describing audit as an afterthought; vague results. |

### Q1.2 — "Tell me about a time you noticed a problem nobody had reported."

| Field | Content |
|---|---|
| **Code inspiration** | Three `LEAST(closing_ratio, 100)` clamps in three services. |
| **Anchor** | *"Three clamps in three services screamed 'compensation pattern.' That's the architectural smell I learned to chase to root cause."* |
| **STAR skeleton** | S: closing-ratio math was capped at three layers. T: was this load-bearing math or a real bug? A: traced to `beBack.service.js` writing `ups_taken` + `ups_handed_off` — Be Back was double-counted as a metric event. Removed the writes; two clamps became removable. R: leaderboard reflects reality; only the *official* business cap remains. |
| **Probing follow-ups** | • What's the smell test? • How do you know you didn't break something else? • What's the difference between this cap and the others? |
| **Interviewer criteria** | Architectural intuition; root-cause discipline; lesson generalization. |
| **Mistakes to avoid** | Saying "I found a bug" — find the *pattern*, not the bug. |

### Q1.3 — "Tell me about a time you cleaned up someone else's mess."

| Field | Content |
|---|---|
| **Code inspiration** | Stale queue ghosts from a silently failed `dailyReset`. |
| **Anchor** | *"The reset job had a silent fail mode. I made the consumer resilient — `fairInsertV2` filters today's rows — so future failures of the reset are invisible to fairness correctness."* |
| **STAR skeleton** | S: morning queue had a ghost row from yesterday. T: stop scoping the bug to the reset job. A: scoped fairness function to `DATE(joined_at) = CURDATE()`. R: future reset failures are invisible to fairness; cleanup reliability is decoupled from correctness. |
| **Probing follow-ups** | • Why not fix the reset job? • Doesn't this hide failures? • What if both fail? |
| **Why it lands** | "Make the consumer resilient to producer failures" is a senior-engineering instinct. |

### Q1.4 — "Tell me about a system you owned that nobody else understood."

| Field | Content |
|---|---|
| **Code inspiration** | `upsFairness.js` and the tri-state env flag. |
| **Anchor** | *"I established the schema-as-history convention — every block dated and idempotent — so anyone walking up cold can read the schema and understand the product."* |
| **STAR skeleton** | S: I was the only one who understood the fairness rules. T: not become a single point of failure. A: dated migration blocks, project memory files, naming conventions (`withStoreTx`, `requireRole`), pure-logic services. R: a second engineer could onboard from schema + one route file. |
| **Mistakes to avoid** | "I documented it" — anyone can say that. Show the artifacts (dated blocks, naming, memory files). |

---

## 2️⃣ DIVE DEEP

### Q2.1 — "Tell me about a bug that took a long time to debug."

| Field | Content |
|---|---|
| **Code inspiration** | Birdeye duplicate SMS — one in fifty saves. |
| **Anchor** | *"First hypothesis was 'frontend double-click — disable the button.' That would have masked the race. I read the route and saw a non-atomic read-then-write. Fix is two lines of SQL."* |
| **STAR skeleton** | S: customers sometimes got two SMS. T: find root cause, not the surface fix. A: reproduced by opening invoice in two tabs and clicking Save fast; read `route.invpdf.js`; saw read-then-write on `birdeye_sent`; replaced with atomic claim `UPDATE … SET birdeye_sent=1 WHERE slug=? AND birdeye_sent=0`. R: zero duplicates; column doubles as support flag. |
| **Probing follow-ups** | • Why not `FOR UPDATE`? *(Holds row lock through HTTP call — multi-hundred ms)* • What about rollback on send failure? *(`UPDATE … SET birdeye_sent=0` so retry can re-claim)* • Why not a queue? *(One column replaces infra)* |
| **Why it lands** | "I rejected the surface fix" + concrete reproduction + one-column solution. |
| **Mistakes to avoid** | "We added a unique constraint" — wrong fix, not the actual solution. |

### Q2.2 — "Tell me about a problem where the obvious solution was wrong."

| Field | Content |
|---|---|
| **Code inspiration** | Package qty parser — "default to 1 when you can't parse." |
| **Anchor** | *"Silent default would have meant the warehouse picked 1 sofa instead of 3 and the customer was furious. The right answer was a louder failure mode, not a quieter one."* |
| **STAR skeleton** | S: ERP description has typos sometimes. T: pick between silent default and explicit failure. A: parser returns `null`; dialog disables Save with "fix package description in ERP." R: zero wrong-pick incidents; operator has actionable error. |
| **Probing follow-ups** | • What's the cost of each failure mode? • Why not 50% confidence threshold? *(Confidence ≠ correctness — wrong qty silently is worse than no qty loudly)* |

### Q2.3 — "Walk me through a piece of code you wrote that you're most proud of."

| Field | Content |
|---|---|
| **Code inspiration** | `withStoreTx` — the queue concurrency primitive. |
| **Anchor** | *"415 lines, three error codes, one transaction primitive. Every queue mutation routes through one function. Grep for `pool.query` inside a queue-mutating route — zero results."* |
| **STAR skeleton** | S: queue could be mutated from /take, /finish, /break, /be-back, /abandoned-up. T: prevent any of those from racing on the same store. A: per-store named advisory lock + `FOR UPDATE` + deadlock retry + structured `UpsError` codes. R: zero corruption events in production; new queue features inherit safety. |
| **Probing follow-ups** | • What's the worst-case lock contention? *(5s acquire timeout → 503 retryable)* • Why named lock not table lock? *(Per-store, doesn't block other stores)* |

### Q2.4 — "Tell me about a time you went deeper than the team needed."

| Field | Content |
|---|---|
| **Code inspiration** | Distinctive-word matching in `packageQtyParser.js`. |
| **Anchor** | *"Substring matching was 80% accurate. The two-pass distinctive-word algorithm got to 100%. The 20% I chased was the 20% the warehouse called about."* |
| **STAR skeleton** | S: package descriptions share tokens like "SHADOW." T: precision matters because wrong qty = wrong picks. A: Pass A exact-token; Pass B substring with longest-overlap-wins. R: zero false-positive parses in production. |

---

## 3️⃣ BIAS FOR ACTION

### Q3.1 — "Tell me about a time you made a decision with incomplete information."

| Field | Content |
|---|---|
| **Code inspiration** | 2026-05-23 — PKG component location rollback. |
| **Anchor** | *"I didn't fully understand root cause yet, but I had a flag. Flipped `PKG_COMPONENT_LOC_ENABLED` to false in 30 seconds. Floor was unaffected within minutes; I had the rest of the day to investigate calmly."* |
| **STAR skeleton** | S: day-three issue on live floor. T: restore operations fast; investigate later. A: flag flip in `packageWarnings.js`; saved data in `pkg_component_locations` preserved; dialog stops mounting; warehouse reverts to pre-rollout behavior. R: minutes-to-mitigation; full investigation calmly that afternoon. |
| **Probing follow-ups** | • Wasn't that a workaround? *(Workaround now, fix later — the asymmetry of cost was the decision)* • How do you decide flag-off vs forward-fix? *(Containable + no flag → forward; stuck floor + flag → flag off)* |
| **Why it lands** | Bias for Action = preparation. The flag exists because I built the flag. |

### Q3.2 — "Tell me about a time you shipped something faster than expected."

| Field | Content |
|---|---|
| **Code inspiration** | Abandoned UP, 2026-05-15 — same-day request to production. |
| **Anchor** | *"One service file, one route, one schema block, one report section. I cut scope by reusing the Be Back transition pattern and made manager approval explicit."* |
| **STAR skeleton** | S: top performers being penalized for greeting non-customers. T: same-day fix. A: `abandonedUp.service.js` reused `withStoreTx`; `abandoned_up_logs` table + `ups_logs` rows for dual-purpose audit; role gate at route + service. R: same-day deploy; first abuse flag surfaced in week one. |

### Q3.3 — "Tell me about a time you didn't wait for permission."

| Field | Content |
|---|---|
| **Code inspiration** | `idx_ia_created_at` — May 19, 2026. |
| **Anchor** | *"The new endpoint would have full-scanned the archive. I bundled the index migration with the code release and documented the deploy step. No meeting required."* |
| **STAR skeleton** | S: internal read API needed day-range scans. T: avoid full table scan. A: added migration block to `schema.sql` with date + "run this while deployment"; coordinated with ops via deploy notes. R: query went from O(n) to O(log n) on day one. |

### Q3.4 — "When did you choose to act fast over acting correctly?"

| Field | Content |
|---|---|
| **Code inspiration** | The first executive email body (pre-May 16). |
| **Anchor** | *"I shipped the table format knowing it wasn't ideal — wanted the GM to actually read it for a week before redesigning. Real usage feedback beat my pre-design taste."* |
| **STAR skeleton** | S: needed daily summary in email body fast. T: ship v1 even if imperfect. A: single-table format; logged GM's actual reading behavior on mobile. R: redesign on May 16 was data-driven (three-section Combined/Arden/Waynesville executive body). |

---

## 4️⃣ CUSTOMER OBSESSION

### Q4.1 — "Tell me about a feature you built specifically because of a customer."

| Field | Content |
|---|---|
| **Code inspiration** | Abandoned UP — top performers being penalized for greeting vendors/friends. |
| **Anchor** | *"The salespeople were losing position for being polite. Manager one-click puts them back. It's a UX feature for them, but a fairness feature for the customer queue."* |
| **STAR skeleton** | S: top performers reluctant to greet ambiguous visitors. T: restore fairness without enabling abuse. A: manager-gated, audited, abuse-flagged. R: first abuse flag surfaced legitimately in week one — feature *and* safeguard both worked. |

### Q4.2 — "Tell me about a customer frustration that changed your design."

| Field | Content |
|---|---|
| **Code inspiration** | Phone Order (`PH`) signature flow. |
| **Anchor** | *"Customers were being asked to sign twice — once in store, once in the PDF. I gated on-screen sigs by invoice type and let Adobe eSign handle remote signing in PDF."* |
| **STAR skeleton** | S: duplicate signature requests on phone orders. T: collapse to one. A: `validateInvoiceSignatures.js` skips customer sigs for `PH`; `InvoicePreview.jsx` HeadlessChrome branch renders Adobe eSign tags only in PDF. R: zero duplicate-sig complaints since deploy. |

### Q4.3 — "Tell me about two customers with conflicting needs."

| Field | Content |
|---|---|
| **Code inspiration** | Warehouse vs salesperson on the package dialog. |
| **Anchor** | *"Same data, two render targets. `/internal-invoice/:slug` shows per-component LOC for warehouse; `/invoice/:slug` shows one clean package line for the customer."* |

### Q4.4 — "Tell me about a feature you killed because customers didn't need it."

| Field | Content |
|---|---|
| **Code inspiration** | The legacy flat `components` list in `/api/package/:packageId/components`. |
| **Anchor** | *"I shipped a dual response shape — `componentGroups` (new) + `components` (legacy). The legacy list became dead code. I'd remove it next quiet sprint."* |
| **Why it lands** | Honest acknowledgment of over-engineering — bar raisers reward self-criticism. |

---

## 5️⃣ DELIVER RESULTS

### Q5.1 — "Tell me about a project where you owned the outcome."

| Field | Content |
|---|---|
| **Code inspiration** | UPS Fairness V2 — shadow → on rollout. |
| **Anchor** | *"Eight days from `shadow` to `on`. Whole rollout was reversible at any moment because the read mode was a single env var."* |
| **STAR skeleton** | S: late joiners leapfrogging in V1. T: ship V2 without breaking the live floor. A: tri-state env flag; dual-write to `ups_sessions` during shadow week; comparison script; cutover via single env-var flip. R: behavior changed live; zero downtime; revert path proven. |

### Q5.2 — "Tell me about a time you delivered under pressure."

| Field | Content |
|---|---|
| **Code inspiration** | Daily summary deadline before fiscal close. |
| **Anchor** | *"I wrote the audit tables before the aggregator. Observability before functionality — so I could ship and iterate."* |
| **STAR skeleton** | S: GM needed daily summary by fiscal week-close. T: ship reliable, not just working. A: `report_job_history` + `report_delivery_logs` + `report_drive_upload_logs` first; then orchestrator; then renderer. R: every run provable; transient Gmail rate-limit recovered automatically via per-recipient logs. |

### Q5.3 — "Tell me about a goal you missed."

| Field | Content |
|---|---|
| **Code inspiration** | PKG component allocation v1 — single instance per item_id. |
| **Anchor** | *"I shipped a 1-instance version when the data needed 4. Lesson: schema should support worst-case shape on day one."* |
| **STAR skeleton** | S: dialog deployed May 20; first real package was 4 chairs. T: rewrite without disrupting active use. A: schema migration to add `instance_index`; dialog rewrite to per-instance cards. R: multi-instance support in production by end of week. |

---

## 6️⃣ INVENT AND SIMPLIFY

### Q6.1 — "Tell me about a clever solution you came up with."

| Field | Content |
|---|---|
| **Code inspiration** | Atomic boolean claim for Birdeye. |
| **Anchor** | *"Two lines of SQL did the work of a distributed lock. `UPDATE … SET birdeye_sent=1 WHERE slug=? AND birdeye_sent=0`; if `affectedRows === 1`, you won — go send."* |
| **STAR skeleton** | S: concurrent saves sent duplicate SMS. T: exactly-once without new infra. A: atomic compare-and-swap via SQL UPDATE; rollback on send failure. R: zero duplicates; column doubles as support flag. |

### Q6.2 — "Tell me about a time you simplified an over-engineered design."

| Field | Content |
|---|---|
| **Code inspiration** | Closing-ratio clamps in three services. |
| **Anchor** | *"Three clamps in three files. One root cause. Removing the root cause removed two clamps."* |

### Q6.3 — "Tell me about a reusable abstraction you built."

| Field | Content |
|---|---|
| **Code inspiration** | `withStoreTx` + `safeAuditLog` + `formatDisplayName` + `locAllocation.js`. |
| **Anchor** | *"`locAllocation.js` is shared between the item allocator and the package-component dialog. LeftPanel keeps inline copies on purpose — hot render path shouldn't pay import cost."* |

---

## 7️⃣ LEARN AND BE CURIOUS

### Q7.1 — "Tell me about a new technology you picked up."

| Field | Content |
|---|---|
| **Code inspiration** | MySQL `JSON_TABLE` + `FOR ORDINALITY`. |
| **Anchor** | *"`FOR ORDINALITY` returns the 1-based array index of each JSON element. That's exactly the `seller_index = 1` filter I needed for primary-only operational metrics."* |
| **STAR skeleton** | S: needed per-seller revenue with split attribution. T: do it in DB or in Node? A: learned `JSON_TABLE`; built `TICKET_SELLER_CTE`; added `supportsJsonTable()` runtime check + JS fallback. R: ~30x faster than in-Node fan-out; one source of truth for all reporting endpoints. |

### Q7.2 — "Tell me about a time you taught yourself something to unblock."

| Field | Content |
|---|---|
| **Code inspiration** | Puppeteer + Gmail OAuth + Drive API for the daily report. |
| **Anchor** | *"Three Google APIs in two days. I built each with a small smoke-test endpoint first so integration came up incrementally."* |

### Q7.3 — "Tell me about a time you went out of your way to understand a system you didn't own."

| Field | Content |
|---|---|
| **Code inspiration** | `/api/audit/rv-schema` — discovery endpoint for the legacy ERP. |
| **Anchor** | *"I built `/api/audit/rv-schema` as my discovery tool so anyone after me could see what fields existed without reading the legacy ERP docs."* |

---

## 8️⃣ EARN TRUST

### Q8.1 — "Tell me about a time you delivered bad news."

| Field | Content |
|---|---|
| **Code inspiration** | Telling the GM the leaderboard was wrong (Be Back metric drift). |
| **Anchor** | *"I led with the corrected numbers, not the diagnosis. 'The leaderboard you used Monday is wrong, here's what it should be, here's the fix.' Trust came from delivering the number, not the apology."* |
| **STAR skeleton** | S: closing-ratio biased for ~2 weeks. T: tell GM before fixing. A: in-person; corrected numbers first; then root cause; then fix; then BB Accepted column. R: GM had right numbers in 24 hours and re-published prior week. |

### Q8.2 — "Tell me about a time you admitted a mistake."

| Field | Content |
|---|---|
| **Code inspiration** | `/finish-up/start` race I shipped before the May 18 fix. |
| **Anchor** | *"Two endpoints opened the same `ups_finish_logs` row. I told the team, made `/finish` the only opener, and added `fallbackUserId` so old open rows self-heal."* |

### Q8.3 — "Tell me about a time you changed your mind."

| Field | Content |
|---|---|
| **Code inspiration** | Package dialog block-on-save → surface error inline. |
| **Anchor** | *"My first design blocked save with no path forward. Teammate argued operators would be stuck if ERP description was wrong. I changed to inline-error + disabled Save with actionable message."* |

---

## 9️⃣ ARE RIGHT, A LOT

### Q9.1 — "Tell me about a judgment call you got right."

| Field | Content |
|---|---|
| **Code inspiration** | Picking MySQL advisory lock over Redis for the queue. |
| **Anchor** | *"Single MySQL instance, two showrooms. Reaching for Redis adds operational debt for marginal benefit."* |

### Q9.2 — "Tell me about a judgment call you got wrong."

| Field | Content |
|---|---|
| **Code inspiration** | First PKG schema — one row per `(package_id, item_id)`. |
| **Anchor** | *"I modeled for the easy case. First real package was 4 chairs. Schema should support worst-case data shape on day one."* |

### Q9.3 — "Tell me about a time you trusted data over opinion."

| Field | Content |
|---|---|
| **Code inspiration** | Closing-ratio 100% cap — kept after debate. |
| **Anchor** | *"People wanted the cap removed. Data showed unbounded values were artifacts of double-counting Be Back. I removed the double-counting; the cap stayed because the business defines it that way."* |

---

## 🔟 HAVE BACKBONE; DISAGREE AND COMMIT

### Q10.1 — "Tell me about a time you disagreed with a teammate."

| Field | Content |
|---|---|
| **Code inspiration** | localStorage-only finishing-up vs server-authoritative `ups_finish_logs`. |
| **Anchor** | *"localStorage gives you a fast badge. But two devices show different truths. I put the source of truth on the server and used localStorage as a same-tab elapsed-timer only."* |
| **STAR skeleton** | S: teammate proposed localStorage-only finish-up timer. T: argue for hybrid. A: made case with concrete cross-device scenario; landed on `ups_finish_logs` truth + localStorage accelerator; May 18 atomic-opener fix eliminated race class. R: cross-device consistency; same-tab snappiness. |

### Q10.2 — "Tell me about a design choice you fought for."

| Field | Content |
|---|---|
| **Code inspiration** | Surfacing parser `null` instead of defaulting qty to 1. |
| **Anchor** | *"Silent default would have shipped picking errors. Loud failure is the right shape — operator can fix the ERP description; warehouse can't fix a wrong pick after the fact."* |

### Q10.3 — "Tell me about a time you disagreed but committed."

| Field | Content |
|---|---|
| **Code inspiration** | Body `userId` auth model. |
| **Anchor** | *"I'd have built JWT. Team's call was to ship faster on LAN deployment. I committed by hardening `requireRole.js` to re-read role from DB on every request — privilege escalation via stale role is impossible even without JWT."* |

---

## 1️⃣1️⃣ INSIST ON THE HIGHEST STANDARDS

### Q11.1 — "Tell me about a time you raised the quality bar."

| Field | Content |
|---|---|
| **Code inspiration** | Three audit tables before the aggregator. |
| **Anchor** | *"Operations was going to forward emails as proof of delivery. I built three audit tables so we'd know if delivery succeeded — even if no human eye saw the email."* |

### Q11.2 — "Tell me about a time you refused to take a shortcut."

| Field | Content |
|---|---|
| **Code inspiration** | Two-pass distinctive-word qty parser. |
| **Anchor** | *"Substring was a shortcut. I wrote the two-pass matcher because the warehouse can't recover from a silently wrong qty — but they can recover from a loud one."* |

### Q11.3 — "Tell me about a time you held the line on engineering quality."

| Field | Content |
|---|---|
| **Code inspiration** | Schema migration convention — dated + idempotent. |
| **Anchor** | *"Every block in `schema.sql` is dated and idempotent. The convention isn't documented in a README — it's enforced by code review. That's how it survives."* |

---

## 🎯 12 — Quick-Fire Anchor Bank (one-liners ready to drop)

| Principle | One-liner anchor |
|---|---|
| Ownership | *"I built the audit tables before the aggregator. Observability before functionality."* |
| Dive Deep | *"Three clamps in three files. One root cause. Removing the cause removed two clamps."* |
| Bias for Action | *"30-second rollback because I built the flag with the feature."* |
| Customer Obsession | *"Salespeople were losing position for being polite. Manager one-click restores them."* |
| Deliver Results | *"Eight days from shadow to on. One env-var flip. Zero downtime."* |
| Invent and Simplify | *"Two lines of SQL replaced what a lot of teams reach for a queue to solve."* |
| Learn and Be Curious | *"`FOR ORDINALITY` does in SQL what I'd been doing with in-process counters for years."* |
| Earn Trust | *"I led with the corrected numbers, not the diagnosis."* |
| Are Right, A Lot | *"People wanted the cap removed. Data showed unbounded was an artifact of double-counting."* |
| Have Backbone | *"localStorage gives you a fast badge. The server gives you the truth."* |
| Highest Standards | *"A working pipeline is necessary. An operable pipeline is sufficient."* |

---

## 🎤 13 — Interviewer Evaluation Rubric

For each STAR you deliver, the interviewer is silently scoring:

| Dimension | Weak (1) | Strong (5) |
|---|---|---|
| **Specificity** | "We solved a bug" | "Atomic UPDATE on `birdeye_sent` column; `affectedRows === 1` signals winner" |
| **First-person ownership** | "We" / "the team" | "I made this call; here's why" |
| **Tradeoff awareness** | "It was the right choice" | "I rejected Redis; the cost was operational debt for marginal benefit" |
| **Result orientation** | "Users were happy" | "Two clamps became removable; closing ratio is correct by construction" |
| **Generalization** | "We fixed it" | "The pattern (consumer resilient to producer failure) is now how I think about audit-vs-state tables" |
| **Backbone** | Always agreed | "I made the case; we landed on a hybrid; here's how I committed" |
| **Self-awareness** | "I have no weaknesses" | "I undertest. Pure-logic services would be where I'd add Jest first" |

> Aim for 4–5 on every dimension for every STAR.
