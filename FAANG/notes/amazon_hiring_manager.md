# 👔 Amazon SDE-1 — Elite Hiring Manager Round

> **The hiring manager round = "can you talk about your work in a way that holds up to scrutiny."** They will hand you the rope; your job is not to hang yourself with it.
> Below are the 11 questions that **will** be asked, in the order they're usually asked, with polished answers + probing follow-ups + delivery notes.

---

## 📋 0 — Round Posture Cheat Sheet

| Behavior | Why |
|---|---|
| First person, always | They're hiring you, not your team. |
| Lead each answer with a one-line thesis | Sets the frame, lets them interrupt if curious. |
| End each answer with a hook | "And the most interesting part was…" gives them somewhere to go. |
| Numbers > adjectives | "Two emails a day, every send provable in one SQL query" beats "reliable." |
| Acknowledge cost | Every decision has a downside. Naming yours = maturity. |
| Stay on `cfc/` + `backend/` | They want to know what *you* built. |

---

## 1️⃣ "Tell me about yourself / your project." (90 seconds)

### POLISHED ANSWER

> *"I own a MERN platform for Carolina Furniture Concepts — a two-showroom retailer in North Carolina, stores in Arden and Waynesville. The frontend is React 18 + Vite + Redux Toolkit; the backend is Node and Express on MySQL for operational data and a read-only MSSQL legacy ERP for inventory.*
>
> *The platform runs three workflows: a real-time customer-opportunity queue called the UPS Board with a fairness algorithm, digital sales invoices including a returns-to-stock path, and an automated 7 PM / 9 PM PDF daily report that emails the GM and archives to Google Drive.*
>
> *The technical bits I'm proudest of: a race-safe per-store advisory-lock transaction primitive called `withStoreTx`, a multi-location quantity allocator whose required-qty has to be parsed out of a free-text ERP description, NY-timezone-anchored business dates across a UTC server, and an idle-lock UX for shared kiosks with re-auth that replays a queued action only if the same employee unlocks within 60 seconds.*
>
> *I implemented every feature in those folders personally — schema design, API routes, services, frontend components, Redux state, cron jobs, Gmail and Drive OAuth integrations, and the observability tables that monitor the pipeline."*

### DELIVERY NOTES
- Time it. **90 seconds, not 120.** Anything longer and they're tuning out.
- Drop one hook in the last sentence — "race-safe primitive" or "atomic boolean claim" — that they'll follow up on.
- **Pause after the last sentence.** Let them pick the thread.

### PROBING FOLLOW-UPS YOU'LL GET
| Likely follow-up | One-line answer ready in chamber |
|---|---|
| *Tell me more about the fairness algorithm* | Eligibility gated on first-UP-of-day; ineligible joiners FIFO-tail-append; eligible joiners insert by ups_count; tri-state env flag for rollout. |
| *What's the timezone gotcha?* | UTC server, NY business day; `Intl.DateTimeFormat` with `timeZone` is the only correct primitive. |
| *Tell me about the kiosk UX* | Idle-lock for employees only; queued action stores user-id snapshot + 60s TTL; cross-tab via `storage` event. |

---

## 2️⃣ "What are you most proud of?"

### POLISHED ANSWER

> *"The UPS Fairness V2 rollout. I designed a tri-state environment flag — `off`, `shadow`, `on` — and shipped the new fairness algorithm in shadow mode for a week, dual-writing to a new `ups_sessions` table while V1 reads stayed unchanged. That let me validate the algorithm's decisions against live production data before any user-visible behavior changed. The cutover was a single env-var flip with zero downtime and a clear path to revert.*
>
> *The reason I'm proud of it isn't that it worked — it's that the pattern worked. The next month, when I rolled out the package-component location dialog, I used the same shape: feature flag (`PKG_COMPONENT_LOC_ENABLED`), graceful degradation when the new schema isn't deployed yet, instant rollback when an issue surfaced on day three."*

### PROBING FOLLOW-UPS
| Q | A |
|---|---|
| *How did the cutover go?* | Quiet — which is what I want from infrastructure changes. Shadow week had already proven the algorithm. |
| *What if shadow had shown a divergence?* | Flip back to `off`, debug, redeploy. Risk is bounded — no read-path changes during shadow. |
| *Did you have to coordinate with anyone?* | Heads-up to the on-floor manager, no permission needed because the flag preserves invariants. |

---

## 3️⃣ "What was the hardest bug?"

### POLISHED ANSWER

> *"The Be Back metric drift. The symptom was three different services each clamping closing ratio at 100% — `ups.routes.js /top-performers`, `todayReports.service.js`, and `dailySalespersonSummary.service.js`. Three clamps in three services is a giant red flag that they're each compensating for an upstream bug.*
>
> *I traced it to `beBack.service.js` writing two `ups_logs` rows for every Be Back handoff: `ups_taken` for the receiver and `ups_handed_off` for the giver. The intent was 'Be Back is a metric event.' But the business rule was actually 'Be Back is routing, not a metric event.' The dual write was inflating one side and deflating the other.*
>
> *The fix on May 21, 2026: stop writing those two `ups_logs` rows. Add a 'BB Accepted' column to the daily summary so handoffs stay visible without distorting metrics. Two of the three clamps came out because the upstream data no longer breached the cap.*
>
> *The hardest part wasn't the code — it was telling the GM the leaderboard he used in Monday's meeting was wrong. I led with the corrected numbers, not the diagnosis."*

### PROBING FOLLOW-UPS
| Q | A |
|---|---|
| *How long?* | A day for the fix, a week for cleaning up downstream clamps and re-laying-out the daily PDF. |
| *How did you know it was root cause?* | Two of three clamps became removable. If I'd only fixed a symptom, all three would still be needed. |
| *What's the lesson?* | Three patches in three files for the same issue is a compensation pattern, not a fix. |

---

## 4️⃣ "Tell me about a production-like issue."

### POLISHED ANSWER

> *"May 23, 2026 — three days after rolling out the package-component location dialog. An issue surfaced that impacted the live floor. I didn't have full root cause yet, but I had `PKG_COMPONENT_LOC_ENABLED` — a feature flag in `cfc/src/utils/packageWarnings.js`. I flipped it to false in about 30 seconds.*
>
> *No other code changes. No schema rollback. Saved rows in `pkg_component_locations` stayed in place for re-enablement. The dialog stopped mounting, the invoice rows stopped rendering child components, and the warehouse reverted to the pre-May-20 experience.*
>
> *Then I had the rest of the day to investigate calmly. The key lesson: I had the flag because I built the flag in advance. Bias for Action is partly preparation."*

### PROBING FOLLOW-UPS
| Q | A |
|---|---|
| *Wasn't that a workaround?* | Workaround now, fix later. The asymmetry of cost was the decision. |
| *How do you decide?* | Stuck floor + flag exists → flag off. Containable + no flag → forward fix. |
| *Did you escalate first?* | Informed, didn't ask. Reversibility makes "ask forgiveness" the right move. |

---

## 5️⃣ "Tell me about a failure."

### POLISHED ANSWER

> *"The first version of the package-component location feature on May 20 supported only one instance per item per package. Then I tested with a real 4-chair package — `ItemPackageMaster` had four rows for the same chair item_id, one per piece. My schema only had one row per `(package_id, item_id)`.*
>
> *The lesson isn't 'check the data first' — that's the obvious lesson. The real lesson is: when I'm modeling a new domain, the schema should be as wide as the worst-case data shape, even if v1's UI only exposes the simple case. Cheap to widen the schema on day one; expensive to migrate later.*
>
> *The fix is in production now: `UNIQUE(package_id, item_id, instance_index)`. The dialog shows each instance as a separate card with its own location picker."*

### PROBING FOLLOW-UPS
| Q | A |
|---|---|
| *Who was affected?* | Internal — caught it in staging. But the schema migration the next week was avoidable cost. |
| *Could you have known earlier?* | Yes — one query against `ItemPackageMaster` grouped by item_id would have surfaced multi-instance packages. I added that as a "first query before schema" rule. |
| *Generalize the lesson* | Schema should support worst-case data on day one. Cheap to widen up-front; expensive to migrate after. |

---

## 6️⃣ "Tell me about a disagreement."

### POLISHED ANSWER

> *"The first version of the finishing-up paperwork timer. A teammate wanted localStorage-only — simpler, snappier, no server round trip. I disagreed because of cross-device behavior: a salesperson can start paperwork at the front counter and finish at the manager's desk on a different device, and the badge would be wrong on the second device.*
>
> *I made the case with a concrete user scenario, not abstract principles. We landed on the hybrid: server-authoritative `ups_finish_logs` table is the truth, localStorage is a same-tab elapsed-timer accelerator with a 30-minute TTL.*
>
> *Then on May 18 I shipped the atomic fix where `/ups/finish` is the only opener of an `ups_finish_logs` row — that eliminated a race condition between `/finish` and `/finish-up/start` that had been leaving duplicate open rows. I also added a `fallbackUserId` to `clearAllFinishingUp` so cleared-cache and second-device cases still close the row by `(userId, ended_at IS NULL)` lookup."*

### PROBING FOLLOW-UPS
| Q | A |
|---|---|
| *What if you'd lost?* | I'd have committed by adding cross-tab `storage` listeners and writing 'this is a same-tab badge only' into the file header. The cross-device bug would have surfaced anyway. |
| *What changed your teammate's mind?* | The concrete scenario walked through on two physical devices. The flow was the argument. |

---

## 7️⃣ "How did you improve an existing system?"

### POLISHED ANSWER

> *"Three I'd highlight:*
>
> 1. ***`idx_ia_created_at`** on `invoices_archive(created_at)` — turned a day-range list scan from O(n) over the full archive to O(log n) for the internal read API.*
> 2. ***Be Back as routing, not metric event** — removed two `ups_logs` writes that had been distorting closing ratio for ~2 weeks. Killed two of three downstream clamps. The math became boring, which is what you want.*
> 3. ***Server-authoritative finishing-up** — converted a localStorage-only badge into a server-of-truth + localStorage-accelerator pattern. Cross-device behavior went from broken to correct."*

---

## 8️⃣ "How would you scale this system?"

### POLISHED ANSWER

> *"Three changes for 10 stores at the current per-store activity:*
>
> 1. **WebSocket / SSE feed** to replace the 1-second `useUPSQueue` poll. At ~5 endpoints per poll and ~6 devices per store, the API is doing 30 reqs/sec per store today. At 10 stores that's 300 reqs/sec mostly returning unchanged data. SSE pushes deltas from `ups_logs` inserts.
> 2. **Parallel daily-summary builds** — currently sequential per store. With `Promise.all` and Puppeteer's ~5 PDFs/sec ceiling, the 7 PM / 9 PM window is fine for 10 stores.
> 3. **MSSQL inventory cache** — single in-memory cache layer per backend host. `ItemMaster` lookups are largely static and hit on every package fetch.
>
> *The thing that doesn't change is the fairness algorithm — it's sharded by store from day one via the per-store named advisory lock."*

### PROBING FOLLOW-UPS
| Q | A |
|---|---|
| *Bottleneck at 100 stores?* | MySQL connection pool — `GET_LOCK` holds a connection. Per-store pools + horizontal Node deployment + partitioned `ups_logs` by `business_date`. |
| *Where would I add caching first?* | MSSQL inventory reads. Same item lookups hit on every package fetch across stores. |

---

## 9️⃣ "How would you onboard a new engineer?"

### POLISHED ANSWER

> *"Three artifacts, in order: `schema.sql`, then `backend/src/routes/ups.routes.js`, then `cfc/src/AUTH/authContext.jsx`.*
>
> *Schema first because the schema tells the product's story. Every table block has a date prefix and a one-line purpose. Reading the schema chronologically is reading the product's history.*
>
> ***`ups.routes.js`** is the central nervous system — over 2,400 lines covering every queue action and every reporting query. If you understand this file you understand 70% of the backend.*
>
> ***`authContext.jsx`** next because the idle-lock and re-auth-replay UX is non-obvious. If you don't read this file first, you'll spend two days wondering why employees get logged out and managers don't.*
>
> *After those, I'd pair them on adding a new section to the daily summary — that touches a service, a renderer, an audit table, and the cron orchestrator. They get a full vertical slice on day three."*

---

## 🔟 "What technical debt exists?"

### POLISHED ANSWER

> *"Three honest items:*
>
> 1. ***No unit-test suite for routes.** Pure-logic services (`packageQtyParser`, `attendanceException`) are pure functions and would be easy to add Jest tests for first. Schema constraints carry most of the validation load today.*
> 2. ***Dual response shape on `/api/package/:packageId/components`** — `componentGroups` (new) + `components` (legacy). The flat list is unused; should be removed.*
> 3. ***`Internalnvoice.jsx` filename typo.** Missing an 'i' in 'Invoice.' Left because renaming requires a route change. Worth fixing in a quiet sprint.*
>
> *None of these are blockers; all are known and tracked in project memory. The discipline I've learned is 'refactor when the patch count tells me the model is wrong.' These don't meet that bar — they meet the 'fix in a quiet sprint' bar."*

---

## 1️⃣1️⃣ "What would you redesign if you could?"

### POLISHED ANSWER

> *"The single Redux slice for both SALE and RTS form state. Today every reducer checks `transactionMode`. It works because the form is one coherent thing, but it bloats the slice. If I were starting over I'd have two slices and a selector that produces the unified preview.*
>
> *Honestly though, the bigger redesign would be auth. Body `userId` is trusted everywhere, with role re-read from `cfc_users` for defense-in-depth. It's the right call for a LAN deployment, but if we went public-internet, I'd want HMAC-signed tokens over `{userId, issuedAt}`. The refactor would be small because every route already goes through `req.cfcUser`."*

---

## 🎤 12 — "Why Amazon? Why this team?" (customize per JD)

### POLISHED ANSWER TEMPLATE

> *"Three reasons.*
>
> *First, the scale. The work I've done is at one company, two showrooms — but the patterns I've used (per-store sharding, race-safe transactions, audit-driven observability, feature flags, idempotent jobs) are the same patterns you use at Amazon scale. I want to apply them to systems that 100× what I've worked on.*
>
> *Second, the customer-obsession is not lip service in the kind of work I do. Building the abandoned-UP feature because top performers were being penalized for greeting non-customers — that's the same instinct as 'work backwards from the customer.'*
>
> *Third, the bar. The audit tables I built before shipping the daily summary are a small example, but they're the kind of standard I want to be held to and to hold others to. Amazon's bar-raiser model is the system-level version of that instinct."*

### "Why SDE-1, not SDE-2 / not internship?"
> *"SDE-1 matches my experience — full ownership of features end-to-end, multi-system integration, but not yet leading multi-engineer projects. I'm hungry for the next step but honest about where I am."*

---

## ❓ 13 — Questions YOU ask back

Pick 2–3 per round based on context:

| Question | Why |
|---|---|
| What does success for an SDE-1 look like at 6 months? At 12? | Concrete expectations |
| Which part of the codebase has the most accumulated complexity? | Shows you'll engage with debt, not just features |
| How does code review work — checklist or cultural? | Maps to your conscientiousness |
| What's the deploy cadence and feature-flagging story? | Aligns with your rollout instincts |
| What's the most surprising thing about working here? | Open-ended; lets them say something real |
| What would make you regret hiring me? | Bold but works in last 5 min of round |

### NEVER ask
- Comp, perks, working hours, remote policy. Save for the recruiter.
- "Do you have a free lunch?"
- Anything you could Google.

---

## 🎯 14 — Polished one-liner answers (memorize these)

| Q | A |
|---|---|
| Why Node not Python/Java? | "JS end-to-end — frontend devs can write backend, and form state lives in JSON anyway." |
| Why MySQL not Postgres? | "Legacy ERP is MSSQL; ops experience is MySQL. Postgres would be new operational surface area for marginal benefit." |
| Most-used lib? | "Redux Toolkit + redux-persist on frontend, `mysql2/promise` on backend." |
| Most-regretted dep? | "Topaz signature SDK — vendor-locked and fragile. Worth it because no real alternative exists at price point." |
| Code style? | "Functional core, imperative shell. Pure services (`packageQtyParser`, `attendanceException`), I/O-driven routes." |
| Testing discipline? | "Honest gap. Pure-logic files first. Schema constraints carry the load today." |
| First thing if you had a free week? | "Request-id correlation across `ups_logs` and `report_*` tables. Cheap to add, huge debugging payoff." |
| Most surprising thing you learned? | "`FOR ORDINALITY` in `JSON_TABLE`. SQL had been doing what I'd been doing in Node for years." |

---

## 🛑 15 — Don't-say list

| Phrase | Why it fails |
|---|---|
| "It was easy" | Bar raisers will probe. |
| "We" (when you mean "I") | First-person ownership. |
| "I just…" | Downplays the work. |
| "I don't have a great example" | Pick a smaller story; never refuse. |
| "All my code is clean" | Lack of self-awareness. |
| "Looking back, the right answer was obvious" | Hindsight bias. |
| "I have no weaknesses" | Self-aware-ectomy. |
| "I work too hard" | The fakest weakness on Earth. |

---

## 📐 16 — Resume walkthrough rhythm

```
1. Name · current role at Carolina Furniture Concepts · location
2. Primary project — one sentence:
   "I own a MERN platform for a two-showroom retailer.
    React + Vite + Redux on top of Node + Express + MySQL + MSSQL."
3. Three named achievements (highest-impact first):
   • UPS Fairness V2 — per-store advisory-lock + shadow→on rollout
   • Daily Summary pipeline — 7 PM/9 PM PDF + Drive + Gmail + 3 audit tables
   • Birdeye duplicate-SMS fix — atomic boolean claim CAS in SQL
4. Stack list (one breath):
   React 18, Redux Toolkit, redux-persist, Vite, Tailwind,
   Node, Express, MySQL 8, MSSQL, Puppeteer, Gmail API, Drive API,
   cron, MySQL JSON_TABLE + CTE.
5. Education (one line).
```

> Time it. **Under 75 seconds.** Practice the rhythm of pauses — every comma is breath.

---

## ✅ 17 — Final pre-round mental checklist

- [ ] Pitch (90s) memorized and timed.
- [ ] 3 STARs per principle ready (especially Ownership, Dive Deep, Earn Trust).
- [ ] One "I failed" story without flinching.
- [ ] One "I disagreed and committed" story with a concrete commit action.
- [ ] One "I went deep" story with a root-cause trace.
- [ ] Scaling answer ("10 stores") rehearsed.
- [ ] Schema list memorized.
- [ ] Concurrency primitive memorized: `GET_LOCK + FOR UPDATE inside withStoreTx`.
- [ ] Idempotency primitive memorized: atomic boolean claim.
- [ ] Fairness eligibility rule memorized: `first_ups_at IS NULL → tail`.
- [ ] NY-tz primitive memorized: `Intl.DateTimeFormat('en-CA', { timeZone:'America/New_York' })`.
- [ ] Two questions to ask back per round.
- [ ] First-person language audit.
- [ ] Five-second pause rule rehearsed (never rush into the next sentence).

> **Walk in calm. Lead with numbers. Close on hooks.**
