# Amazon Bar Raiser Notes

Q1.1 -  "walk me through a project where requirements were unclear What did you do?"
    "My manager asked me to display the warehouse location for packages. Initially, I assumed packages would have their own location, but when I explored the schema, I discovered they didn't."
    At first the requirement sounded simple, but when I started looking into it, I realized packages themselves didn't have any location stored in the database.
    Instead of assuming how it should work, I went back to the schema and traced how packages were model e d. I found that a package is simply a collection of items. Each package stores multiple item IDs and their quantities, while each individual item already has its own warehouse location.
    Once I understood that relationship, I realized we didn't need to store a separate package location. We could derive it by mapping the package to its items and then retrieving the locations of those items.
    I discussed this approach with my manager, implemented the backend mapping, and returned the item-level locations to the frontend. That gave salespeople an accurate view of where every component of the package was located without introducing redundant data.
    Why didn't you simply add a location column to Package?
    "Because a package doesn't physically exist as a single inventory object. It's just a grouping of multiple inventory items. Storing a package location would duplicate information and could easily become inconsistent if one component moved."
    How did you know your understanding was correct?
    "After tracing the schema, I verified the relationships with existing package data and confirmed my understanding with my manager before implementing the solution."
    Shows ownership.
    What was the ambiguity?
    "The ambiguity was that the business asked for a package location, but our data model didn't actually define one. I first had to determine what 'package location' should mean before writing any code."

    This is a fantastic Amazon-style answer.

    Did you consider other approaches?
    Yes. One option was storing a location directly against the package, but that would duplicate data and could become stale if individual items moved. Since item locations were already the source of truth, deriving the package location dynamically kept the data consistent."

 Q1.2 — "You're handed a feature with no acceptance criteria. How do you define 'done'?"

      "If a feature doesn't come with acceptance criteria, I define 'done' by asking whether I can confidently release it to production.
      First, the primary user flow should work as expected from end to end.
      Second, expected failure scenarios should produce clear, actionable errors rather than generic failures.
      Third, I should be able to verify what happened after deployment through logs or audit records so that production issues can be diagnosed quickly.
      For example, on an automated reporting feature I worked on, I considered the feature complete only after confirming that the scheduled job executed successfully, the report was generated and delivered correctly, and the audit logs captured every stage of the pipeline. That gave both users and the operations team confidence that the feature was working reliably."
      What if happy path works but audit trail doesn't?
      Amazon answer- "I wouldn't consider it complete because once it's running in production, logs are the only reliable way to understand failures. Without an audit trail, operations and debugging become much harder.
      What if a completely unexpected error happens?
      I'd log the unexpected error with enough context to investigate it later. After understanding the root cause, I'd improve the error handling so future occurrences produce a more actionable message
      Isn't this over-engineering?t depends on the impact of the feature. For a customer-facing workflow or an automated reporting pipeline, detailed auditing is valuable because failures affect business operations. For a small internal debugging endpoint, that level of logging may not be necessary.
      

**THE TRAP:** Vague "done = working." Define falsifiable conditions.

**Probing chain:**

| *What if happy-path passes but you don't have an audit trail?* | Not done. Audit trail is the evidence that lets ops trust the pipeline. |
| *How do you handle a 500 you didn't design for?
    I'd first log the unexpected error with enough context—such as the request, timestamp, and stack trace—to investigate it. After identifying the root cause, I'd improve the application so that future occurrences return a more meaningful error instead of a generic 500.
| *Is this overkill?*
   It depends on the business impact. If the feature supports an important business process, like a daily reporting pipeline used by management, I'd invest in detailed logging, monitoring, and validation because failures have real consequences. For a small internal debugging endpoint, that same level of engineering wouldn't provide enough value to justify the extra complexity.

 | For a daily money-adjacent report read by the GM? No. For a debug endpoint? Yes — match rigor to consequence. |
If a feature doesn't have acceptance criteria, I define 'done' using measurable outcomes. First, the primary user should be able to complete the task successfully from start to finish—that's the happy path. Second, expected failure scenarios should return clear, actionable messages instead of generic server errors. Third, I should be able to verify what happened in production through logs or audit records, so the team can quickly investigate issues if something goes wrong. The exact level of logging depends on the business impact of the feature.
"First, the primary user should be able to complete the normal end-to-end flow successfully—the happy path. For example, in my package location feature, a salesperson should be able to select a package and immediately see the locations of all its component items without needing any manual intervention.

---

## 2️⃣ CONFLICT QUESTIONS

   ### Q2.2 — "Tell me about a time stakeholders had conflicting priorities.
   This is much closer to what an **Amazon SDE-3/Bar Raiser** would expect. The biggest improvement is to **avoid implementation jargon first** and instead **lead with customer impact**, then explain the technical decision. Bar Raisers don't care that you know `localStorage`; they care that you made the right engineering trade off.

  =

 Q2.1 — Tell me about a time you disagreed with a teammate's technical approach. -## Leadership Principles Tested
    Situation -While building the **Finishing Up** workflow, we needed to show how long a sale had been waiting after the salesperson clicked **Finish Up**.
     We had to make the timer accurate, fast, and reliable.
    Conflict- A teammate wanted to keep the timer only in **localStorage** because it was simple and fast.
    I believed that would fail whenever a salesperson switched to another computer.
    Instead of arguing opinions, I demonstrated the workflow using two devices.
    We started the timer on one computer and then opened the same sale on another.
    The second device showed incorrect information because localStorage exists only on one browser.
    Based on that demonstration, we agreed on a hybrid design:
     Server stores the real state.
     localStorage only updates the timer smoothly on the current browser.
     The solution supported multiple devices, remained responsive, and later made another race-condition fix much smaller because the server already owned the truth.

    If they ask "What timer?"The timer tracked **how long a sale had been in the Finishing Up stage**.
    After a salesperson finishes selling, there are still activities like paperwork, signatures, payment verification, or manager approval.
    The timer helped managers quickly identify sales that had been waiting too long.

--- # If they ask "What badge?"
   Answer: The badge was simply a small timer displayed beside each sale.
   Example: Finishing Up — **12 min**
   It gave real-time visibility into how long each sale had been waiting.
    If they ask "Why is the timer important?
    Answer:Without it, managers couldn't easily identify delayed sales.
    The timer improved operational visibility and helped reduce bottlenecks.
    # If they ask "Why was localStorage a problem?"
    Answer: localStorage only exists inside one browser on one device.
    If a salesperson started on Computer A and later continued on Computer B, Computer B had no knowledge of the timer.
>
> That meant different devices could display different information for the same sale.

---

# If they ask "Why not just store everything on the server?"

Answer:

> We could have.
>
> But then every second, every browser would have to ask the server for an updated timer.
>
> Instead, we stored only the start time on the server.
>
> Each browser calculated the elapsed time locally, giving us both correctness and responsiveness.

---

# If they ask "Why localStorage then?"

Answer:

> localStorage wasn't the source of truth.
>
> It was only a performance optimization.
>
> It allowed the current browser tab to continue showing the elapsed timer smoothly even during refreshes without unnecessary server requests.

---

# If they ask "How did you convince your teammate?"

Amazon loves this answer.

> I didn't try to win the argument verbally.
>
> I reproduced the workflow on two devices.
>
> Once everyone saw different timers for the same sale, the technical tradeoff became obvious.
>
> The customer workflow made the decision—not my opinion.

---

# If they ask "What if your idea wasn't selected?"

Answer:

> Once the team made the decision, I would have fully committed to implementing it well.
>
> I would have documented the limitations, added monitoring where possible, and revisited the design only if customer data showed it wasn't meeting our needs.

---

# If they ask "Why was the hybrid approach better?"

Answer:

> It separated responsibilities clearly.
>
> * The **server** guaranteed consistency across all devices.
> * The **browser** handled only the display logic.
>
> That separation also made later bug fixes much easier.

---

# If they ask "What race condition did it prevent?"

Answer:

> Initially, multiple paths could open the Finishing Up state, which occasionally created duplicate records.
>
> We simplified the workflow so that only one endpoint was responsible for opening the state.
>
> Having a single authoritative path eliminated duplicate-row creation and made the workflow deterministic.

---

# If they ask "How did this help customers?"

Answer:

> Managers always saw accurate information regardless of which device they used.
>
> Salespeople could move between workstations without losing state.
>
> That reduced confusion and improved operational efficiency.

---

# If they ask "What did you learn?"

Answer:

> I learned that technical disagreements are best resolved with evidence instead of opinions.
>
> Demonstrating a real customer workflow is often far more persuasive than debating architecture.
>
> I also reinforced the importance of separating the source of truth from performance optimizations.

---



# The One Sentence Amazon Loves

> **"I disagreed using customer impact and evidence, not opinion. Once the team aligned on the solution, I fully committed to delivering it successfully."**

This sentence demonstrates **Customer Obsession**, **Have Backbone; Disagree and Commit**, **Ownership**, and **Earn Trust** in one concise statement.


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
