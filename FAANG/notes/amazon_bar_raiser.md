# 🔥 Amazon SDE-1 — Elite Bar Raiser Simulation

> **Bar Raiser ≠ technical screen.** They test *judgment under uncertainty*. They will probe until you flinch, then probe one more time.
> **Format per question:** Question · What they're really probing · Strong answer · The trap · Probing chain (4–6 deep) · Stronger phrasing.

---

## 🎯 0 — Pre-Round Mindset

| Bar Raiser is looking for | Antidote (what to demonstrate) |
|---|---|
| Vague results | Name a table, a column, a number, a re-published artifact. |
| "We" instead of "I" | Stay first-person all the way through. |
| No tradeoff | Every decision has a cost — name yours. |
| Failure theater ("I learned humility") | Name the concrete artifact of the failure (wrong schema, wrong shape, wrong default). |
| Always-agreed | Surface a disagreement that ended in a hybrid or a commit. |
| Hindsight bias ("the right answer was obvious") | Acknowledge what you didn't know at the time. |

> *"Brief is good — silent is not. Vague is worse than wrong."*

---

## 1️⃣ AMBIGUITY HANDLING

### Q1.1 — "Walk me through a project where requirements were unclear. What did you do?"

**They're probing:** Do you wait for spec or produce a draft and iterate?

**STRONG ANSWER**
> "The package-component location feature started with one sentence — 'salespeople need to assign each component to a location.' No spec.
>
> I started with the schema, not the UI. Schema forces decisions. `pkg_component_locations(package_id, item_id, instance_index, location_id, saved_by_user_id)` — two questions answered themselves: multi-instance support (yes, `instance_index`), allowed locations (S1, S2, 999, NS1, NS2, SO, codified as `ALLOWED_ALLOCATION_LOCATIONS`).
>
> Then I drafted the API response shape (`componentGroups` + `components` for back-compat) and built the dialog against it. We iterated on UX after seeing it work end-to-end — that's where the multi-location qty allocator came from on May 21 and the qty-unknown error on May 23."

**THE TRAP:** Saying "I asked questions until I had clarity." Real PMs don't have answers either — produce a draft.

**Probing chain:**
| Q | A |
|---|---|
| *How did you decide what to defer?* | I deferred multi-instance to v1.1 mentally — then realized day-one that real packages had it (4 chairs in `ItemPackageMaster`). Rewrote schema same week. |
| *How did you know your draft schema was right?* | I didn't. The `UNIQUE(package_id, item_id, instance_index)` was a guess that paid off. If the worst-case shape had been `(location, qty)`-keyed instead, I'd have rewritten. |
| *Wasn't that wasteful?* | Less wasteful than over-specifying for a year. Two-week feedback cycle on a real schema beats four-month spec on a hypothetical one. |
| *How do you decide schema-first vs UI-first?* | Schema first when the data model is non-obvious. UI first when the data is well-understood and the question is "how do users interact." For PKG, data was non-obvious. |

**STRONGER PHRASING**
> *"Schema forces decisions. If I can write the unique key, I understand the domain. If I can't, the domain is ambiguous."*

---

### Q1.2 — "You're handed a feature with no acceptance criteria. How do you define 'done'?"

**STRONG ANSWER**
> "Three observable conditions:
> 1. Happy-path user completes the flow without help.
> 2. Every failure mode I designed for surfaces an actionable error, not a 500.
> 3. The audit trail proves the system did what it claimed.
>
> Concretely on the daily summary: done was 'audit tables `report_job_history`, `report_delivery_logs`, `report_drive_upload_logs` all show consistent state after a real 7 PM run, recipients receive a PDF, the Drive link works.' If any of those wasn't true, it wasn't done."

**THE TRAP:** Vague "done = working." Define falsifiable conditions.

**Probing chain:**
| Q | A |
|---|---|
| *What if happy-path passes but you don't have an audit trail?* | Not done. Audit trail is the evidence that lets ops trust the pipeline. |
| *How do you handle a 500 you didn't design for?* | New audit row with the unexpected error. Then a follow-up to make it actionable. |
| *Is this overkill?* | For a daily money-adjacent report read by the GM? No. For a debug endpoint? Yes — match rigor to consequence. |

---

## 2️⃣ CONFLICT QUESTIONS

### Q2.1 — "Tell me about a time you disagreed with a teammate's technical approach."

**They're probing:** Do you have backbone AND can you commit?

**STRONG ANSWER**
> "localStorage-only finishing-up timer. A teammate argued simpler + snappier; I argued cross-device behavior would break. I made the case with a concrete user scenario: salesperson starts at front counter, finishes at manager's desk on a different device — badge would be wrong on the second device.
>
> We agreed on the hybrid: server-authoritative `ups_finish_logs` for truth, localStorage as same-tab elapsed-timer accelerator. I committed by building the May 18 atomic fix — `/ups/finish` became the only opener — eliminating the duplicate-row race that came from the original design."

**THE TRAP:** "I won and now everyone uses my design." Bar raisers reward collaboration + commit.

**Probing chain:**
| Q | A |
|---|---|
| *What if you'd lost?* | I'd have committed by adding cross-tab `storage` event listeners and writing 'this is a same-tab badge only' into the file header. The cross-device bug would have surfaced anyway and we'd have rebuilt then. |
| *How did you bring the data?* | I asked them to walk through the flow on two physical devices. The first device's badge stayed alive; the second's was wrong. The flow was the argument. |
| *Was the hybrid actually better?* | Yes — and the proof is the May 18 fix landed cleanly because the server side was already authoritative. If we'd been localStorage-only, the duplicate-row class of bug would have required a much bigger rewrite. |

**STRONGER PHRASING**
> *"I disagreed loudly during design, committed completely during build. Backbone is a design behavior; commit is an execution behavior. They're not contradictory."*

---

### Q2.2 — "Tell me about a time stakeholders had conflicting priorities."

**STRONG ANSWER**
> "Warehouse wanted per-component LOC on every invoice line; salespeople wanted the invoice clean. Both customers, both valid.
>
> I solved it with two render targets reading from the same data: `/invoice/:slug` is the customer-facing invoice with one clean package row; `/internal-invoice/:slug` is the warehouse view with per-component LOC rows expanded. Same `form_json`, different `*Invoice.jsx` files (`InvoicePreview.jsx` vs `Internalnvoice.jsx`)."

**Probing chain:**
| Q | A |
|---|---|
| *Why not just two checkboxes on one page?* | Each audience has a different mental model. Single page with toggle puts cognitive load on the user. Two URLs makes the affordance physical — print this one, send that one. |
| *What if requirements diverge further?* | The data layer stays one; the render layer can split as many ways as needed. Adding a third audience is a third file, not a third data shape. |

---

### Q2.3 — "Tell me about a disagreement with a non-engineer."

**STRONG ANSWER**
> "The proposal to remove the closing-ratio 100% cap. Argument was 'math should just work.' I pulled three example rows showing what each looked like with cap vs without. One had a 500% closing ratio that was meaningless. We landed on: keep the cap (it's the business definition), but remove the upstream double-counting (the real bug). The cap stopped being load-bearing and started being intentional."

**Probing chain:**
| Q | A |
|---|---|
| *How did you persuade?* | Three example rows. Not principles, not best-practices — three rows you could read off a screen. |
| *What if they still didn't agree?* | I'd have asked the GM to choose. Engineering disagreement with a stakeholder is escalated to the customer of the decision, which is the GM. |

---

## 3️⃣ FAILURE QUESTIONS

### Q3.1 — "Tell me about a time you failed. What did you learn?"

**They're probing:** Self-awareness + second-order lesson.

**STRONG ANSWER**
> "First version of the package-component dialog (May 20) supported one instance per item per package. Then I tested with a real 4-chair package — `ItemPackageMaster` had four rows for the same chair item_id, one per piece. My schema couldn't represent 'chair #1 → S1, chair #2 → S2.'
>
> I rewrote with `instance_index`. The lesson isn't 'look at the data first' — that's the obvious lesson. The lesson is: when I'm modeling a new domain, the schema should be as wide as the worst-case data shape on day one, even if v1's UI only exposes the simple case. Cheap to widen the schema on day one; expensive to migrate later."

**THE TRAP:** Fake failures ("I took on too much"). Real failures have an artifact.

**Probing chain:**
| Q | A |
|---|---|
| *How did you discover the gap?* | First real package I tested. `ItemPackageMaster` had four rows for the same chair. |
| *Could you have known earlier?* | Yes. One query: `SELECT item_id, COUNT(*) FROM ItemPackageMaster GROUP BY item_id ORDER BY 2 DESC` would have flagged multi-instance packages on day one. |
| *Was anyone affected?* | Internal — I caught it in staging before any user saw it. But the schema migration the next week was avoidable cost. |
| *What did the team learn?* | "First query before schema" became my rule. I added it to my project memory. |
| *What if you had shipped the broken version?* | Warehouse would have picked the wrong number of pieces. Recovery would have required reconciling with customers post-delivery — much more expensive than a staging-stage catch. |

**STRONGER PHRASING**
> *"Failure with a generalizable lesson and a concrete artifact. 'Run the worst-case query before designing the schema' is my new rule."*

---

### Q3.2 — "Tell me about a bug you shipped to production."

**STRONG ANSWER**
> "The `/finish-up/start` race. Both `/ups/finish` and `/finish-up/start` could open an `ups_finish_logs` row, leaving two open rows for the same user. Showed up as a duplicate salesperson in the 'Finishing Up' section of the board.
>
> I traced it by reading the route handlers side-by-side. Fix was making `/ups/finish` the only atomic opener. `/finish-up/start` became a fallback used only when localStorage state had drifted. Also added `clearAllFinishingUp(workflowType, fallbackUserId)` so even with an empty localStorage map, the end call still closes the right row by `(userId, ended_at IS NULL)` lookup."

**Probing chain:**
| Q | A |
|---|---|
| *Why did you have two endpoints opening the same row?* | Original design used `/finish-up/start` for the dialog open; later refactor moved opening into `/finish` atomically. The orphaned start endpoint wasn't removed. |
| *What was the blast radius?* | Visible duplicates on the board but no data corruption. Hours of UX confusion. |
| *How did you catch it?* | Manager called out the dup on a Tuesday. I had the fix that afternoon. |

---

### Q3.3 — "Tell me about a time you missed a deadline."

**STRONG ANSWER**
> "First version of the executive email body before the May 16 redesign. I shipped a single-table format thinking it would be readable. The GM was reading on mobile and skipping rows — effectively missing the deadline-of-being-useful even though the email itself shipped on time.
>
> I split into `renderExecutiveEmailHtml` with three sections (Combined, Arden, Waynesville) and KPI cards at the top. PDF stayed unchanged. Lesson: I designed for the data, not the consumption channel."

**Probing chain:**
| Q | A |
|---|---|
| *Why didn't you ask before designing?* | I should have. I assumed "table" was the right shape because that's how the GM verbally described it. He meant 'I want to see the numbers,' not 'I want a table.' |

---

## 4️⃣ TRADEOFF QUESTIONS

### Q4.1 — "Walk me through a hard tradeoff."

**STRONG ANSWER**
> "Auth model. Body `userId` is trusted, no JWT, no cookies, no session middleware. Sacrificed defense-in-depth against userId forgery for simplicity and speed on a LAN-only deployment.
>
> To compensate, `requireRole.js` re-reads the role from `cfc_users` on every request. Forged userIds can still impersonate, but they cannot escalate to admin/manager via a stale local role. Sensitive operations (`/abandoned-up`, `/update-ups`, user CRUD) double-check role in the route.
>
> If this were public-internet, I'd reach for HMAC-signed tokens. Refactor is small because every route already goes through `req.cfcUser`."

**THE TRAP:** Defending as "the right answer." Tradeoffs have downsides — name yours.

**Probing chain:**
| Q | A |
|---|---|
| *What would convince you to change?* | Going public-internet, regulated industry, or a single incident of internal misuse. |
| *What's the threat model that's uncovered?* | An authenticated employee could forge another employee's userId and act as them. Detection would come from `ups_logs.username` not matching the device's localStorage user. |
| *Is the detection real?* | Yes — `ups_logs` writes username separately from action data. Cross-check is one query. |

---

### Q4.2 — "Why MySQL + MSSQL? Why not consolidate?"

**STRONG ANSWER**
> "Two databases on purpose. MSSQL is the legacy ERP — owns inventory (`ItemMaster`, `PackageMaster`, `ItemPackageMaster`, `InvMasterReport`). We don't own writes. Migrating it would require a yearlong project to replace the buyer/inventory team's tools.
>
> MySQL is operational data we own end-to-end. The cost of two databases is cross-DB joins at the app level (`runSql` for MSSQL, `formQuery` for MySQL, join in Node). The hot read paths are single-row lookups, so latency is fine."

**Probing chain:**
| Q | A |
|---|---|
| *How do you maintain consistency?* | For PKG components: source-of-truth for components is MSSQL (`ItemPackageMaster`); source-of-truth for assignments is MySQL (`pkg_component_locations`). One-way relationship — if MSSQL removes a component, the MySQL row is orphaned but never returned (lookup starts from MSSQL). |
| *What if MSSQL goes down?* | Inventory and package fetches fail. Operational features (queue, audit, reports) continue. Acceptable degradation. |

---

## 5️⃣ PRIORITIZATION QUESTIONS

### Q5.1 — "You have three high-priority tasks. How do you sequence?"

**STRONG ANSWER**
> "Concrete from May 20 week: PKG component location dialog, Abandoned UP, daily summary refinements. I sequenced by **blast radius and reversibility**:
> 1. PKG dialog first — biggest user impact (warehouse), longest UX iteration lead time, protected by `PKG_COMPONENT_LOC_ENABLED` so reversible.
> 2. Abandoned UP second — clear scope, short build time, reuses the Be Back transition pattern.
> 3. Daily summary tweaks last — incremental, low-risk, ships when ready.
>
> Spend uncertainty budget on the highest-impact / hardest-to-reverse work first, while you still have the calendar to fix mistakes."

**THE TRAP:** Pick by "what's hardest" or "what's easiest." Bar raisers want a *framework*.

**Probing chain:**
| Q | A |
|---|---|
| *What if all three were urgent?* | Negotiate scope. Each gets a "v0.5" version that ships within the same window. Reversibility says PKG must have the flag from day one. |
| *Who decides priority if you can't?* | The GM. Engineering's job is to surface the tradeoff with concrete options. |

---

### Q5.2 — "When do you refactor vs patch?"

**STRONG ANSWER**
> "I refactor when the patch *count* tells me the model is wrong. Three `LEAST(closing_ratio, 100)` clamps in three services was three patches compensating for one upstream bug — the signal to refactor (remove Be Back metric writes), not patch (add a fourth clamp).
>
> I patch when the model is right and one specific case slipped. Adding NS1/NS2 nailed-location handling to the manager-approval check was a patch; the model (manager-approval reasons in `systemNotes`) was already right."

**Probing chain:**
| Q | A |
|---|---|
| *Always refactor when there are multiple patches?* | No — sometimes the patches are independent. The heuristic is "are they compensating for the same upstream cause?" If yes, refactor. |

---

## 6️⃣ TECHNICAL TRADEOFFS

### Q6.1 — "Why advisory lock vs Redis vs application-level mutex?"

**STRONG ANSWER**
> "Single MySQL instance, two stores. MySQL's `GET_LOCK` is per-store, gives us mutual exclusion across processes, holds the connection for the transaction lifetime, and releases atomically with commit/rollback. Redis would add an operational dependency (a new piece of infrastructure to monitor and back up) for marginal benefit at our scale. Application-level mutex would only work if all writes went through one Node process — which isn't guaranteed."

**Probing chain:**
| Q | A |
|---|---|
| *What if MySQL has multiple primaries (Galera, etc)?* | `GET_LOCK` is per-connection-per-node. Wouldn't work cross-node. We'd reach for Redis or a coordination service. |
| *What's the cost of `GET_LOCK` holding a connection?* | Connection pool pressure. With 2 stores and burst contention it's negligible; at 10 stores I'd raise `connectionLimit` proportionally. |

---

## 7️⃣ PRODUCTION INCIDENTS

### Q7.1 — "Walk me through a production-like issue you handled."

**STRONG ANSWER**
> "May 23, 2026. Day three after PKG component location rollout. An issue surfaced on the live floor. I had two options: investigate first, or pull the feature flag.
>
> Flipped `PKG_COMPONENT_LOC_ENABLED = false` in `cfc/src/utils/packageWarnings.js`. 30 seconds. No schema rollback. Saved data in `pkg_component_locations` preserved. Dialog stopped mounting; invoice rows reverted to pre-May-20 behavior. Floor was unaffected within minutes.
>
> Then I had the rest of the day to investigate calmly. The critical preparation was building the flag *with* the feature, not after the fire."

**Probing chain:**
| Q | A |
|---|---|
| *Wasn't this a workaround?* | Yes — workaround now, fix later. Asymmetry of cost: stuck floor costs revenue; unnecessary flag-off costs an hour. |
| *How do you balance flag-off vs forward-fix?* | Stuck floor + flag exists → flag off. Containable + no flag → forward fix. The flag has to exist for the choice to exist. |
| *Did you tell anyone before flipping?* | The on-floor manager via Slack as I flipped — not asking permission, informing. Reversibility makes "ask forgiveness" the right move; irreversibility makes "ask permission" the right move. |

---

## 8️⃣ DEBUGGING PRESSURE

### Q8.1 — "You're paged at 11 PM. Daily report didn't go out. Walk me through your first hour."

**STRONG ANSWER**
> "First five minutes — read `report_job_history` for tonight's date. Three possibilities:
> 1. No row → cron didn't fire. Check cron logs. Likely process didn't start.
> 2. Row with `status='running'` → process started but didn't finish. Read `error_message`. Likely a Puppeteer crash or DB connectivity blip.
> 3. Row with `status='succeeded'` but recipients didn't get email → check `report_delivery_logs.status`. Likely Gmail rate limit on bulk send.
>
> Next ten minutes — depending on which branch, take the targeted action:
> - For (1): manually invoke `runDailyReport({ triggerSource: 'manual', force: true })`.
> - For (2): same as (1), but check for the underlying cause first.
> - For (3): retry just the failed recipients; the PDF and Drive upload already succeeded.
>
> The whole story is in three append-only audit tables. I don't have to grep logs."

**Probing chain:**
| Q | A |
|---|---|
| *What if the audit tables themselves are corrupt?* | They're append-only. Corruption is unlikely. If they're gone, schema migration is incomplete — re-run `applyStartupMigrations()`. |
| *What if Puppeteer is the issue every night?* | Move PDF rendering to a long-running side process; cron triggers it via HTTP. Decouples the renderer's stability from the cron. |
| *No alarms — would you add them?* | Yes: `report_job_history.status='failed'` count > 0 in last 24h, recipient-failure rate > 30% in last week. CloudWatch / Datadog if available; Slack webhook fallback if not. |

---

## 9️⃣ INCOMPLETE REQUIREMENTS

### Q9.1 — "PM gives you 'we need fraud detection on this feature.' What do you do?"

**STRONG ANSWER**
> "First, define fraud specifically. 'Self-approval' is one form (manager approving their own UP). 'Threshold abuse' is another (10+ abandons per month). 'Pattern abuse' is a third (always abandoning on Saturday afternoons).
>
> For Abandoned UP I built two: self-approval blocked at service level (explicit rejection); threshold abuse flagged non-blocking via `computeAbuseFlag(salespersonId)` against env `ABANDONED_UP_ABUSE_THRESHOLD`. Surfaced in API response and daily PDF.
>
> Pattern abuse I deferred — needs longer history and a clear signal. Added to the backlog with a note."

**Probing chain:**
| Q | A |
|---|---|
| *Why non-blocking on threshold?* | False positive on threshold day shouldn't block legitimate operations. Detection ≠ enforcement. |
| *What if pattern abuse becomes real?* | The `abandoned_up_logs` table already has `business_date`, `approved_by_id`, `reason`. The data shape supports any future detection. |

---

## 🔟 CUSTOMER-IMPACT QUESTIONS

### Q10.1 — "How did you measure the impact of something you shipped?"

**STRONG ANSWER**
> "Abandoned UP: counted abuse flags. `computeAbuseFlag(salespersonId)` counts current-calendar-month abandons; threshold default 10. Two flags surfaced in the first two weeks — both legitimate, both surfaced in the daily PDF, both addressed by management. The feature was working *and* the safeguard was working.
>
> The fairness fix on the queue was harder to measure quantitatively — I leaned on user feedback. The day after the fix, no salesperson complained about being penalized for greeting non-customers. Absence-of-complaint is a weak signal but a real one."

**Probing chain:**
| Q | A |
|---|---|
| *Is absence-of-complaint enough?* | No — but it's data. I'd combine it with `abandoned_up_logs` volume (decreased? increased?) and qualitative GM feedback. |
| *What metric would you build if you could?* | "Time-spent-on-floor / UP" — a productivity metric that decouples from queue position. |

---

### Q10.2 — "Tell me about a feature that didn't have the impact you expected."

**STRONG ANSWER**
> "First executive email body (pre-May 16). Single-table format. The GM was on mobile, skipping rows. I assumed table = readable; data said no. Redesign on May 16: three sections (Combined / Arden / Waynesville) with KPI cards at the top. PDF unchanged because the GM uses email body in meetings and PDF for archiving."

---

## 1️⃣1️⃣ SCALING PRESSURE

### Q11.1 — "What breaks first at 10× current load?"

**STRONG ANSWER**
> "Three predictable failure modes:
> 1. **The 1-second `useUPSQueue` poll.** Five endpoints per poll, ~6 devices per store. At 10 stores → 300 reqs/sec for state that's mostly unchanged. Mitigation: SSE feed off `ups_logs` inserts; fall back to poll on disconnect.
> 2. **MSSQL inventory reads.** Same item lookups hit on every package fetch and item search. Mitigation: in-process LRU + 60s TTL per host.
> 3. **MySQL pool exhaustion.** `GET_LOCK` holds a connection for the transaction. At burst contention across 10 stores, the pool can run out. Mitigation: per-store connection pool sizing + raise `connectionLimit`."

**Probing chain:**
| Q | A |
|---|---|
| *What doesn't change at 10×?* | The fairness algorithm. Per-store advisory lock is sharded by store, so adding stores is linear. |
| *What's the single biggest engineering investment?* | SSE/WebSocket. The 1-second poll wastes the most resources at scale. |

---

## 1️⃣2️⃣ DEADLINE TRADEOFFS

### Q12.1 — "You have one week. Fix tech debt or ship a feature. What do you do?"

**STRONG ANSWER**
> "Depends on the debt and the feature. The deciding question is 'what's the cost of *not* doing this?'
>
> If the debt is making every PR slower (three closing-ratio clamps compensating for an upstream bug), the cost of ignoring is compounding — fix it. If the debt is a typo'd filename (`Internalnvoice.jsx`), the cost of ignoring is zero — ship the feature.
>
> Most weeks the answer is 'a little of both' — bundle a small debt fix into the feature PR. Last week of fiscal quarter? Feature wins by default."

---

## 1️⃣3️⃣ AGGRESSIVE PROBING TEMPLATES (rehearse these answers)

| Probe | Template answer |
|---|---|
| *Why did you choose that approach?* | "I considered [other] and rejected it because [concrete cost]. The chosen approach has [benefit] at the cost of [downside], which was acceptable because [context]." |
| *What would you do differently?* | "On reflection, [specific thing I'd do earlier]. The reason I didn't was [honest reason]. The cost was [observable cost]." |
| *What metrics improved?* | "Before: [observable behavior]. After: [observable behavior]. Mechanism: [code change]." |
| *How did you know it was root cause?* | "Removing the root cause removed downstream compensation. If I'd fixed a symptom, the others would have remained needed." |
| *How did you handle disagreement?* | "Brought [concrete artifact: data, example, scenario]. Landed on [resolution]. If I'd lost, I'd have [specific commit action]." |
| *Biggest risk?* | "Worst case: [scenario]. Protected by [specific mechanism]." |
| *What was your biggest mistake?* | "[Concrete artifact of the failure]. Lesson: [generalizable rule]. Application: [where I use it now]." |
| *Why was this production safe?* | "Reversible because [flag/env/schema decision]. Observable because [audit row]. Idempotent because [pattern]." |

---

## 1️⃣4️⃣ CURVEBALL QUESTIONS

### Q14.1 — "If we deleted your most-loved feature tomorrow, what would the system look like?"

**STRONG ANSWER**
> "Delete the package-component location dialog. Saved rows in `pkg_component_locations` stay (re-enable is one flag flip). The invoice goes back to one row per package, exactly the pre-May 20 experience. Warehouse loses per-component picking info; they revert to reading the package description.
>
> I'd be sad but the system wouldn't break. That's actually the test I aim for when I build a feature — can it be deleted cleanly? If no, the design coupled too tightly."

### Q14.2 — "Tell me about the worst code you wrote in this project."

**STRONG ANSWER**
> "`InvoicePreview.jsx` has too many `// 🔥` flow markers and the page-break-driven PDF layout is intricate. It's the right shape for the use case (one source of truth for screen + print + Adobe eSign tags via HeadlessChrome detection), but a junior reader spends a while figuring out which branch fires when.
>
> I'd refactor by extracting the Adobe eSign tag branch into a dedicated render helper, but I haven't because the file isn't changing weekly anymore."

### Q14.3 — "Walk me through what your skip-level would say about you."

**STRONG ANSWER**
> "He'd say I sometimes optimize for the small team I'm currently in. I've built audit tables, idempotency patterns, and feature flags that are right for two showrooms and one engineer. He'd push me to design for what the team will look like in two years — more engineers, more review, more documentation overhead.
>
> What I'm doing about it: I write durable project memories that survive my own absence. Naming conventions, dated migration blocks, rollback flags — that's the 'second engineer onboarding' I'd need if the team grew tomorrow."

---

## 🛑 1️⃣5️⃣ Bar Raiser Anti-Patterns (do not do these)

| Anti-pattern | Why it fails |
|---|---|
| Vague results ("users loved it") | Bar raisers will dig for a number. |
| "We" instead of "I" | They're hiring you, not your team. |
| No tradeoff | Every decision has a downside. Naming yours = maturity. |
| Failure theater ("I learned humility") | Real failures have an artifact. |
| Always-agreed | Pick one disagreement that resolved cleanly. |
| Hindsight bias ("the answer was obvious") | Acknowledge what you didn't know at the time. |
| Apologizing as the lead | Lead with the diagnosis or the corrected number. |
| Defensive when probed | Treat probes as curiosity. Expand depth. |

---

## ✅ 1️⃣6️⃣ Pre-loaded depth questions (have answers ready for each STAR)

For every STAR you deliver, the Bar Raiser may dig into any of these:

1. What did you reject and why?
2. What was the most surprising thing you learned?
3. What would you build differently with hindsight?
4. What was the metric you cared about?
5. Who depended on this and how did you confirm they were unblocked?
6. What was the failure mode you didn't design for?
7. What's the next thing you'd ship on this?
8. Did you talk to anyone before deciding? Why or why not?
9. If your manager said "stop building this," what would you say?
10. What was the riskiest 30 minutes of this project?

> **Rule of thumb:** if you have to think for more than 3 seconds, you don't know the story well enough. Rehearse.
