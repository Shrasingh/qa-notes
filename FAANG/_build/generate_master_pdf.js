/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { marked } = require('marked');

// Reuse Puppeteer already installed in backend/node_modules
const ROOT = path.resolve(__dirname, '..', '..');
const puppeteer = require(path.join(ROOT, 'backend', 'node_modules', 'puppeteer'));

const NOTES_DIR = path.join(ROOT, 'FAANG', 'notes');
const OUT_PATH = path.join(ROOT, 'FAANG', 'Amazon_SDE1_Master_Interview_Handbook.pdf');

// ---------- Source markdowns (Part order matters) ----------
const PARTS = [
  {
    file: 'amazon_project_deep_dive.md',
    partNumber: 'I',
    partTitle: 'PROJECT DEEP DIVE',
    tagline: 'Architecture · Schema · Feature-by-Feature Mastery',
    icon: '🏛️',
    covers: [
      'Project Architecture',
      'Frontend + Backend Flow',
      'Database Design',
      'Package Allocation Logic',
      'Quantity Synchronization Logic',
      'Validation Architecture',
      'Role-Based Access Control',
      'Edge Cases Handled',
      'Performance Optimization',
      'Scalability Discussions',
      'Production Debugging Stories',
      'Production Risk Mitigation',
      'Security Considerations',
      'Technical Tradeoffs',
      'Refactoring Decisions',
    ],
  },
  {
    file: 'amazon_behavioral_questions.md',
    partNumber: 'II',
    partTitle: 'LEADERSHIP PRINCIPLES BANK',
    tagline: '11 Principles · Code-Grounded Anchors',
    icon: '🏛️',
    covers: ['Leadership Principles', 'Strongest Ownership Stories', 'Strongest Dive Deep Stories'],
  },
  {
    file: 'amazon_star_answers.md',
    partNumber: 'III',
    partTitle: 'STAR BEHAVIORAL ANSWERS',
    tagline: '12 Full Scripts · Probing Chains',
    icon: '⭐',
    covers: ['STAR Behavioral Answers'],
  },
  {
    file: 'amazon_bar_raiser.md',
    partNumber: 'IV',
    partTitle: 'BAR RAISER SIMULATION',
    tagline: 'Ambiguity · Conflict · Failure · Curveballs',
    icon: '🔥',
    covers: ['Amazon Bar Raiser Questions'],
  },
  {
    file: 'amazon_technical_cross_questions.md',
    partNumber: 'V',
    partTitle: 'TECHNICAL CROSS-QUESTIONING',
    tagline: '31 Deep Probes · Excellent vs Weak Answers',
    icon: '🛠️',
    covers: ['Technical Deep Dive Questions'],
  },
  {
    file: 'amazon_hiring_manager.md',
    partNumber: 'VI',
    partTitle: 'HIRING MANAGER ROUND',
    tagline: 'Resume Walkthrough · Polished Q&A',
    icon: '👔',
    covers: ['Resume Deep Dive', 'Hiring Manager Questions'],
  },
  {
    file: 'amazon_mock_interview.md',
    partNumber: 'VII',
    partTitle: 'FULL MOCK INTERVIEW LOOP',
    tagline: '5 Rounds · Weak vs Strong vs Stronger',
    icon: '🎬',
    covers: ['Mock Interviews', 'Common Weak Answers vs Strong Answers'],
  },
];

// ---------- Markdown rendering ----------
marked.setOptions({
  gfm: true,
  breaks: false,
  headerIds: true,
  mangle: false,
});

// Slugify for anchors
function slug(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 64);
}

// Strip the very first H1 from each markdown (we use our own Part heading)
function stripFirstH1(md) {
  const lines = md.split(/\r?\n/);
  let i = 0;
  while (i < lines.length && lines[i].trim() === '') i++;
  if (i < lines.length && /^#\s+/.test(lines[i])) {
    lines[i] = ''; // drop the H1, keep blank line for spacing
  }
  return lines.join('\n');
}

function renderMarkdown(md) {
  return marked.parse(md);
}

// ---------- Build cover + TOC + body ----------
function buildCover() {
  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  return `
<section class="cover">
  <div class="cover-frame">
    <div class="cover-eyebrow">Amazon Engineering Preparation</div>
    <h1 class="cover-title">SDE-1 MASTER<br/>INTERVIEW HANDBOOK</h1>
    <div class="cover-subtitle">FAANG Engineering Portfolio &middot; Bar Raiser Preparation</div>

    <div class="cover-divider"></div>

    <div class="cover-meta">
      <div class="cover-meta-row"><span class="k">Candidate</span><span class="v">Sunil Gupta</span></div>
      <div class="cover-meta-row"><span class="k">Role</span><span class="v">Software Development Engineer — I</span></div>
      <div class="cover-meta-row"><span class="k">Project</span><span class="v">Carolina Furniture Concepts — MERN Operations Platform</span></div>
      <div class="cover-meta-row"><span class="k">Stack</span><span class="v">React · Redux · Node · Express · MySQL · MSSQL · Puppeteer</span></div>
      <div class="cover-meta-row"><span class="k">Compiled</span><span class="v">${dateStr}</span></div>
    </div>

    <div class="cover-divider"></div>

    <div class="cover-pillars">
      <div class="pillar"><div class="pillar-num">7</div><div class="pillar-lbl">Parts</div></div>
      <div class="pillar"><div class="pillar-num">28</div><div class="pillar-lbl">Sections</div></div>
      <div class="pillar"><div class="pillar-num">12</div><div class="pillar-lbl">STAR Stories</div></div>
      <div class="pillar"><div class="pillar-num">11</div><div class="pillar-lbl">Leadership Principles</div></div>
    </div>

    <div class="cover-footer">
      Confidential preparation material &middot; Not for distribution<br/>
      <em>"Walk in calm. Lead with numbers. End on hooks."</em>
    </div>
  </div>
</section>
`;
}

function buildExecutiveSummary() {
  return `
<section class="page-break-before exec-summary">
  <h1 class="part-heading"><span class="part-num">EXEC</span>EXECUTIVE SUMMARY</h1>
  <p class="lead">A single, code-grounded preparation handbook for the Amazon SDE-1 loop. Every story, every primitive, every tradeoff in this document is sourced from actual implementation in <span class="kbd">cfc/</span> (React + Vite + Redux frontend) and <span class="kbd">backend/</span> (Node + Express + MySQL + MSSQL) — the two-showroom retail operations platform built end-to-end for Carolina Furniture Concepts.</p>

  <div class="callout callout-primary">
    <div class="callout-title">90-Second Elevator Pitch</div>
    <div class="callout-body">
      <em>"I own a MERN platform for Carolina Furniture Concepts — a two-showroom retailer in North Carolina. React + Vite + Redux Toolkit on top of Node, Express, MySQL for operational data and a read-only MSSQL legacy ERP for inventory. Three workflows: a real-time customer-opportunity queue called the UPS Board with a fairness algorithm, digital sales invoices with a returns-to-stock path, and an automated 7 PM / 9 PM PDF daily report that emails the GM and archives to Google Drive. Technically I'm proudest of a race-safe per-store advisory-lock transaction primitive, a multi-location quantity allocator whose required-qty is parsed from a free-text ERP description, NY-timezone-anchored business dates across a UTC server, and an idle-lock UX for shared kiosks with re-auth that replays a queued action only if the same employee unlocks within 60 seconds."</em>
    </div>
  </div>

  <h2>Primitives To Memorize (verbatim)</h2>
  <table class="primitives">
    <thead><tr><th>Primitive</th><th>Code-form</th><th>Why it matters</th></tr></thead>
    <tbody>
      <tr><td>Concurrency</td><td><code>GET_LOCK('ups_queue_lock:'||store, 5) + FOR UPDATE</code> inside <code>withStoreTx</code></td><td>Race-safe queue mutations, per-store sharded</td></tr>
      <tr><td>Idempotency</td><td><code>UPDATE … SET birdeye_sent=1 WHERE slug=? AND birdeye_sent=0</code></td><td>Exactly-once external side effect, no Redis</td></tr>
      <tr><td>Fairness</td><td><code>ups_sessions.first_ups_at IS NULL</code> ⇒ ineligible, FIFO tail</td><td>Anti-leapfrog rule, encoded in schema</td></tr>
      <tr><td>NY Timezone</td><td><code>Intl.DateTimeFormat('en-CA', { timeZone:'America/New_York' })</code></td><td>UTC server, NY business day, DST-safe</td></tr>
      <tr><td>Tri-state rollout</td><td><code>UPS_FAIRNESS_V2 = off | shadow | on</code></td><td>Reversible behavior change, 1-env-var revert</td></tr>
      <tr><td>Flag rollback</td><td><code>PKG_COMPONENT_LOC_ENABLED</code> in packageWarnings.js</td><td>30-second revert without code change</td></tr>
      <tr><td>Audit-first</td><td><code>report_job_history</code> · <code>report_delivery_logs</code> · <code>report_drive_upload_logs</code></td><td>Observability before functionality</td></tr>
    </tbody>
  </table>

  <h2>One-Page System Map</h2>
  <pre class="ascii">┌──────────────── React 18 + Vite + Redux ────────────────┐
│  Pages: InvoicePreview · Internalnvoice · RTSPreview     │
│         UPSBoard · Analytics                              │
│  Modals: PackageLocationAssignmentDialog ·               │
│          FinishCustomerModal · SignaturePad               │
│  Hooks: useUPSQueue (1s poll + optimistic lock)          │
│  State: formSlice (single Redux + redux-persist)         │
│  Auth:  AuthContext (idle-lock · cross-tab · re-auth)    │
└─────────────────────────────────────────────────────────────┘
                            │
                  apiClient + x-user-id
                            ▼
┌──────────────── Node + Express ─────────────────────────┐
│  middleware/requireRole — re-reads role from cfc_users   │
│  routes → services → repositories                         │
│  cron @ NY tz:  0 19,21 * * *  daily summary             │
│                 0 21 * * *      dailyReset               │
└──────────┬──────────────────────────────────┬───────────┘
           │                                    │
  ┌────────▼───────────┐              ┌────────▼─────────┐
  │ MySQL — cfc_form    │              │ MSSQL — ERP (RO) │
  │ ups_queue · logs ·  │              │ ItemMaster ·     │
  │ sessions · finish · │              │ PackageMaster ·  │
  │ invoices_archive ·  │              │ ItemPackageMaster│
  │ pkg_component_locs ·│              │ InvMasterReport  │
  │ abandoned_up_logs · │              └──────────────────┘
  │ report_* triad      │
  └─────────────────────┘</pre>

  <h2>What This Handbook Is</h2>
  <ul>
    <li><b>A code-grounded preparation deck.</b> Every primitive maps to a file path and a line number.</li>
    <li><b>A rehearsal manual.</b> Anchors are written for verbatim memorization; STAR scripts are written for delivery.</li>
    <li><b>A defense manual.</b> For every claim there is a probing follow-up answer ready.</li>
    <li><b>A bar-raiser playbook.</b> Weak vs Strong vs Stronger phrasings sit side by side so you know what to upgrade.</li>
  </ul>
</section>
`;
}

function buildSectionMap() {
  // 28 sections as required, mapped to source parts
  const sections = [
    ['1', 'Resume Deep Dive', 'VI'],
    ['2', 'Project Architecture', 'I'],
    ['3', 'Frontend + Backend Flow', 'I'],
    ['4', 'Database Design', 'I'],
    ['5', 'Package Allocation Logic', 'I'],
    ['6', 'Quantity Synchronization Logic', 'I'],
    ['7', 'Validation Architecture', 'I'],
    ['8', 'Role-Based Access Control', 'I'],
    ['9', 'Production Debugging Stories', 'I + III'],
    ['10', 'Leadership Principles', 'II'],
    ['11', 'STAR Behavioral Answers', 'III'],
    ['12', 'Amazon Bar Raiser Questions', 'IV'],
    ['13', 'Hiring Manager Questions', 'VI'],
    ['14', 'Technical Deep Dive Questions', 'V'],
    ['15', 'Scalability Discussions', 'I'],
    ['16', 'Performance Optimization', 'I'],
    ['17', 'Security Considerations', 'I'],
    ['18', 'Production Risk Mitigation', 'I'],
    ['19', 'Edge Cases Handled', 'I'],
    ['20', 'Technical Tradeoffs', 'I'],
    ['21', 'Refactoring Decisions', 'I'],
    ['22', 'Mock Interviews', 'VII'],
    ['23', 'Rapid Revision Notes', 'Cheat Sheet'],
    ['24', 'Most Important Talking Points', 'Cheat Sheet'],
    ['25', 'Strongest Ownership Stories', 'III'],
    ['26', 'Strongest Dive Deep Stories', 'III'],
    ['27', 'Weak vs Strong Answers', 'VII'],
    ['28', 'Final Interview Cheat Sheet', 'Cheat Sheet'],
  ];

  let html = `
<section class="page-break-before toc">
  <h1 class="part-heading"><span class="part-num">TOC</span>TABLE OF CONTENTS</h1>
  <p class="lead">Twenty-eight curated sections distributed across seven parts. Every topic an Amazon SDE-1 loop will probe.</p>

  <table class="toc-table">
    <thead><tr><th>#</th><th>Section</th><th>Located In Part</th></tr></thead>
    <tbody>
`;
  for (const [n, title, part] of sections) {
    html += `      <tr><td class="num">${n}</td><td>${title}</td><td class="part">${part}</td></tr>\n`;
  }
  html += `    </tbody>
  </table>

  <div class="toc-parts">
    <h2>Parts Index</h2>
    <table class="parts-index">
      <thead><tr><th>Part</th><th>Title</th><th>Theme</th></tr></thead>
      <tbody>
`;
  for (const p of PARTS) {
    html += `        <tr><td class="part">${p.partNumber}</td><td><b>${p.partTitle}</b></td><td>${p.tagline}</td></tr>\n`;
  }
  html += `        <tr><td class="part">★</td><td><b>FINAL CHEAT SHEET</b></td><td>Rapid revision · Top talking points · Pre-loop checklist</td></tr>
      </tbody>
    </table>
  </div>
</section>
`;
  return html;
}

function buildPartDivider(part) {
  return `
<section class="page-break-before part-divider">
  <div class="part-divider-inner">
    <div class="part-divider-icon">${part.icon}</div>
    <div class="part-divider-num">PART ${part.partNumber}</div>
    <h1 class="part-divider-title">${part.partTitle}</h1>
    <div class="part-divider-tagline">${part.tagline}</div>
    <div class="part-divider-sep"></div>
    <div class="part-divider-covers">
      <div class="part-divider-covers-label">Covers</div>
      <div class="part-divider-covers-list">${part.covers.join(' &middot; ')}</div>
    </div>
  </div>
</section>
`;
}

function buildPartBody(part) {
  const md = fs.readFileSync(path.join(NOTES_DIR, part.file), 'utf8');
  const stripped = stripFirstH1(md);
  const inner = renderMarkdown(stripped);
  return `<section class="page-break-before part-body" id="part-${part.partNumber}">${inner}</section>`;
}

function buildCheatSheet() {
  return `
<section class="page-break-before cheat">
  <h1 class="part-heading"><span class="part-num">★</span>FINAL AMAZON INTERVIEW CHEAT SHEET</h1>
  <p class="lead">The dense, last-mile revision page. Read on the morning of the loop.</p>

  <h2>The 10 Primitives — Memorize Verbatim</h2>
  <ol class="checklist">
    <li><b>Concurrency:</b> <code>GET_LOCK('ups_queue_lock:'||store, 5)</code> + <code>FOR UPDATE</code> inside <code>withStoreTx</code>. Every queue mutation routes through one function.</li>
    <li><b>Idempotency:</b> <code>UPDATE invoices_archive SET birdeye_sent=1 WHERE slug=? AND birdeye_sent=0</code>. CAS in SQL; <code>affectedRows === 1</code> is the success signal.</li>
    <li><b>Fairness:</b> <code>ups_sessions.first_ups_at IS NULL</code> ⇒ ineligible, FIFO tail. After first take, immutable for the day.</li>
    <li><b>Tri-state rollout:</b> <code>UPS_FAIRNESS_V2 = off | shadow | on</code>. Shadow dual-writes; cutover is one env-var flip.</li>
    <li><b>Flag-based revert:</b> <code>PKG_COMPONENT_LOC_ENABLED</code> in <code>cfc/src/utils/packageWarnings.js</code>. 30-second revert, no code change.</li>
    <li><b>NY timezone:</b> <code>Intl.DateTimeFormat('en-CA', { timeZone:'America/New_York' })</code>; weekday anchored to <code>T12:00:00Z</code>.</li>
    <li><b>Display rule:</b> <code>formatDisplayName(first, last)</code> — never username.</li>
    <li><b>Schema convention:</b> every block in <code>schema.sql</code> dated + "run this while deployment". Idempotent.</li>
    <li><b>Audit-first:</b> <code>report_job_history</code> + <code>report_delivery_logs</code> + <code>report_drive_upload_logs</code> written BEFORE the aggregator.</li>
    <li><b>Validation chain:</b> DB constraints → service rules → route role re-check → frontend gate. Validate once per layer.</li>
  </ol>

  <h2>Top 10 Talking Points (rank-ordered)</h2>
  <ol class="checklist">
    <li><b>UPS Fairness V2 shadow → on rollout</b> — one env-var flip, dual-write shadow week, zero downtime.</li>
    <li><b>Birdeye duplicate SMS fix</b> — atomic boolean claim CAS in SQL; replaced what a distributed lock would have done.</li>
    <li><b>Be Back metric drift root cause</b> — three clamps in three services pointed to upstream double-write; removed the writes; two clamps deleted.</li>
    <li><b>Audit tables before aggregator</b> — observability is not a feature you add later; it is what makes a feature operable.</li>
    <li><b>Package qty parser surface failures as null</b> — silent default of 1 would have shipped wrong picks; loud failure preserves correctness.</li>
    <li><b>30-second rollback via feature flag</b> — Bias for Action is partly preparation; the flag exists because I built it.</li>
    <li><b>Server-authoritative finishing-up + localStorage accelerator</b> — multi-device truth + same-tab snappiness.</li>
    <li><b>Idle-lock with re-auth replay</b> — three guards: identity snapshot, 60s TTL, cross-tab via storage event.</li>
    <li><b>Multi-instance schema for 4-chair packages</b> — schema should support worst-case shape on day one.</li>
    <li><b>Closing-ratio cap is definition, not a bug</b> — trust data over opinion; cap stays, double-counting goes.</li>
  </ol>

  <h2>Strongest Ownership Stories (rank-ordered)</h2>
  <ol class="checklist">
    <li><b>8 PM Daily Summary Pipeline</b> — built cron + PDF + Drive + Gmail + 3 audit tables before the aggregator. Two emails/day; every send provable in one SQL query.</li>
    <li><b>UPS Fairness V2</b> — designed the tri-state rollout pattern. The pattern became the model for every subsequent behavior change.</li>
    <li><b>Schema-as-history convention</b> — every block in <code>schema.sql</code> dated + idempotent. A second engineer can onboard from schema + one route file.</li>
  </ol>

  <h2>Strongest Dive Deep Stories (rank-ordered)</h2>
  <ol class="checklist">
    <li><b>Birdeye duplicate SMS</b> — rejected the surface fix (disable button) and traced to a non-atomic read-then-write. Solved with one SQL pattern.</li>
    <li><b>Be Back metric drift</b> — three clamps in three services as the smell; root cause was upstream <code>ups_logs</code> double-write.</li>
    <li><b>Stale queue ghost</b> — failed <code>dailyReset</code> would leave yesterday rows that broke fairness; fix is consumer-side <code>DATE(joined_at)=CURDATE()</code>.</li>
  </ol>

  <h2>Weak vs Strong — Universal Upgrade Table</h2>
  <table class="upgrade">
    <thead><tr><th>Vague (weak)</th><th>Specific (strong)</th></tr></thead>
    <tbody>
      <tr><td>"I led the project"</td><td>"I owned the schema, the orchestrator, and the three audit tables end-to-end."</td></tr>
      <tr><td>"Users found it useful"</td><td>"GM gets two emails a day; every send is provable in one SQL query."</td></tr>
      <tr><td>"We refactored it"</td><td>"I removed two <code>ups_logs</code> writes from <code>beBack.service.js</code>; two of three clamps became removable."</td></tr>
      <tr><td>"It scales well"</td><td>"Per-store advisory lock means adding stores is linear; no algorithm change."</td></tr>
      <tr><td>"There was a race condition"</td><td>"Two <code>/invoice/save</code> requests for the same slug could both read <code>birdeye_sent=0</code> before either wrote."</td></tr>
      <tr><td>"I learned a lot"</td><td>"I generalized 'consumer resilient to producer failure' from this fix; same pattern in <code>clearAllFinishingUp</code>."</td></tr>
      <tr><td>"We had a bug"</td><td>"Three <code>LEAST(closing_ratio, 100)</code> clamps in three services — a compensation pattern pointing to upstream double-write."</td></tr>
    </tbody>
  </table>

  <h2>Final Pre-Loop Mental Checklist</h2>
  <ul class="check-grid">
    <li>☐ 90-second pitch timed three times</li>
    <li>☐ Three STARs per principle ready</li>
    <li>☐ One "I failed" story without flinching</li>
    <li>☐ One "I disagreed and committed" with concrete commit action</li>
    <li>☐ One "I went deep" with root-cause trace</li>
    <li>☐ Scaling answer ("10 stores") rehearsed</li>
    <li>☐ Concurrency primitive memorized</li>
    <li>☐ Idempotency primitive memorized</li>
    <li>☐ Fairness eligibility rule memorized</li>
    <li>☐ NY-tz primitive memorized</li>
    <li>☐ Two questions to ask per round</li>
    <li>☐ First-person language audit (no "we")</li>
    <li>☐ Five-second pause rule rehearsed</li>
    <li>☐ Closing on hooks rehearsed</li>
  </ul>

  <div class="callout callout-final">
    <div class="callout-title">Closing Mindset</div>
    <div class="callout-body">
      <em>Walk in calm. Lead with numbers. Stay in first person. End each answer on a hook. Treat probes as curiosity, not attack. Acknowledge cost. Don't apologize as the lead — the corrected number is the lead.</em>
      <br/><br/>
      And the most important rule: <b>if you have to think more than 3 seconds, you don't know the story well enough. Rehearse until it lives in muscle memory.</b>
    </div>
  </div>
</section>
`;
}

// ---------- Top-level HTML + premium CSS ----------
function wrapDocument(bodyHtml) {
  // Pure CSS — no external fonts (offline rendering)
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>Amazon SDE-1 Master Interview Handbook</title>
<style>
  /* ============ Base palette ============ */
  :root {
    --ink: #0A2540;          /* deep navy */
    --ink-2: #1E3A5F;
    --accent: #FF9900;       /* Amazon orange */
    --accent-2: #E47911;
    --accent-soft: #FFF4E0;
    --muted: #4A5568;
    --muted-soft: #F4F6F9;
    --rule: #E2E8F0;
    --code-bg: #1A202C;
    --code-fg: #E2E8F0;
    --callout-bg: #FFF8E1;
    --callout-border: #F9A825;
    --success-bg: #E6F7EC;
    --success-border: #2E7D32;
  }

  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", "Helvetica Neue", Arial, sans-serif;
    color: var(--ink);
    font-size: 10.5pt;
    line-height: 1.55;
    background: #ffffff;
  }

  /* ============ Sections / page breaks ============ */
  section { padding: 0 0 8mm; }
  .page-break-before { page-break-before: always; break-before: page; }
  .page-break-after  { page-break-after: always; break-after: page; }
  .no-break, table, pre, blockquote, .callout { page-break-inside: avoid; break-inside: avoid; }
  h1, h2, h3, h4 { page-break-after: avoid; break-after: avoid; }

  /* ============ Typography ============ */
  h1 { font-size: 22pt; font-weight: 800; letter-spacing: -0.01em; color: var(--ink); margin: 0 0 6mm; }
  h2 { font-size: 15pt; font-weight: 700; color: var(--ink); margin: 9mm 0 3mm; border-bottom: 2px solid var(--accent); padding-bottom: 2mm; }
  h3 { font-size: 12pt; font-weight: 700; color: var(--ink-2); margin: 6mm 0 2mm; }
  h4 { font-size: 10.5pt; font-weight: 700; color: var(--ink-2); margin: 4mm 0 2mm; }
  p, li { font-size: 10.5pt; }
  strong, b { color: var(--ink); }
  em, i { color: #2D3748; }

  a, a:visited { color: var(--accent-2); text-decoration: none; border-bottom: 1px dotted var(--accent-2); }

  ul, ol { padding-left: 5mm; margin: 2mm 0 4mm; }
  li { margin: 1mm 0; }

  hr { border: 0; border-top: 1px solid var(--rule); margin: 6mm 0; }

  blockquote {
    border-left: 4px solid var(--accent);
    background: var(--accent-soft);
    margin: 4mm 0;
    padding: 3mm 4mm;
    color: var(--ink);
    border-radius: 0 2mm 2mm 0;
  }
  blockquote p:last-child { margin-bottom: 0; }

  /* ============ Code blocks & inline code ============ */
  code {
    font-family: "JetBrains Mono", "SF Mono", "Cascadia Code", "Consolas", "Menlo", monospace;
    font-size: 9.2pt;
    background: var(--muted-soft);
    color: var(--ink);
    padding: 0.6mm 1.2mm;
    border-radius: 1mm;
  }
  pre {
    background: var(--code-bg);
    color: var(--code-fg);
    padding: 3.5mm 4.5mm;
    border-radius: 2mm;
    overflow: hidden;
    margin: 3mm 0 5mm;
    font-size: 9pt;
    line-height: 1.45;
    white-space: pre-wrap;
    word-wrap: break-word;
  }
  pre code { background: transparent; color: inherit; padding: 0; font-size: 9pt; }
  pre.ascii { background: #F7FAFC; color: var(--ink); border: 1px solid var(--rule); font-size: 8.2pt; line-height: 1.35; }

  /* ============ Tables ============ */
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 3mm 0 6mm;
    font-size: 9.5pt;
    border: 1px solid var(--rule);
    border-radius: 2mm;
    overflow: hidden;
  }
  th, td { padding: 2mm 2.5mm; text-align: left; vertical-align: top; border-bottom: 1px solid var(--rule); }
  th { background: var(--ink); color: #fff; font-weight: 700; font-size: 9.2pt; letter-spacing: 0.02em; text-transform: uppercase; }
  tr:nth-child(even) td { background: #FBFCFD; }
  tr:last-child td { border-bottom: 0; }
  td code { font-size: 8.6pt; }

  /* ============ Cover page ============ */
  .cover { padding: 0; }
  .cover-frame {
    height: 270mm;
    background: linear-gradient(160deg, #0A2540 0%, #1E3A5F 60%, #2D4F7C 100%);
    color: #fff;
    padding: 30mm 22mm;
    border: 0;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    position: relative;
    overflow: hidden;
  }
  .cover-frame::before {
    content: "";
    position: absolute;
    right: -30mm; top: -30mm;
    width: 120mm; height: 120mm;
    background: radial-gradient(circle, rgba(255,153,0,0.18) 0%, rgba(255,153,0,0) 70%);
  }
  .cover-frame::after {
    content: "";
    position: absolute;
    left: -20mm; bottom: -20mm;
    width: 80mm; height: 80mm;
    background: radial-gradient(circle, rgba(255,153,0,0.12) 0%, rgba(255,153,0,0) 70%);
  }
  .cover-eyebrow {
    font-size: 10pt;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    color: var(--accent);
    font-weight: 700;
    margin-bottom: 8mm;
    position: relative; z-index: 2;
  }
  .cover-title {
    font-size: 44pt;
    font-weight: 900;
    line-height: 1.05;
    letter-spacing: -0.02em;
    color: #fff;
    margin: 0;
    position: relative; z-index: 2;
  }
  .cover-subtitle {
    font-size: 13pt;
    color: rgba(255,255,255,0.7);
    margin-top: 5mm;
    font-style: italic;
    position: relative; z-index: 2;
  }
  .cover-divider {
    height: 2px;
    background: linear-gradient(90deg, var(--accent) 0%, transparent 100%);
    margin: 9mm 0;
    position: relative; z-index: 2;
  }
  .cover-meta { position: relative; z-index: 2; }
  .cover-meta-row {
    display: flex;
    border-bottom: 1px solid rgba(255,255,255,0.12);
    padding: 2.5mm 0;
    font-size: 10.5pt;
  }
  .cover-meta-row .k {
    width: 38mm;
    color: var(--accent);
    text-transform: uppercase;
    letter-spacing: 0.12em;
    font-size: 8.5pt;
    font-weight: 700;
  }
  .cover-meta-row .v {
    flex: 1;
    color: rgba(255,255,255,0.92);
    font-weight: 500;
  }
  .cover-pillars {
    display: flex;
    gap: 4mm;
    margin: 6mm 0 4mm;
    position: relative; z-index: 2;
  }
  .pillar {
    flex: 1;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.15);
    border-radius: 2mm;
    padding: 4mm 3mm;
    text-align: center;
  }
  .pillar-num {
    font-size: 24pt;
    font-weight: 800;
    color: var(--accent);
    line-height: 1;
  }
  .pillar-lbl {
    font-size: 8.5pt;
    color: rgba(255,255,255,0.75);
    letter-spacing: 0.16em;
    text-transform: uppercase;
    margin-top: 2mm;
  }
  .cover-footer {
    text-align: center;
    font-size: 8.5pt;
    color: rgba(255,255,255,0.55);
    line-height: 1.6;
    position: relative; z-index: 2;
  }

  /* ============ Part heading & dividers ============ */
  .part-heading {
    font-size: 22pt;
    margin: 0 0 6mm;
    display: flex;
    align-items: center;
    gap: 4mm;
    border-bottom: 3px solid var(--accent);
    padding-bottom: 3mm;
  }
  .part-heading .part-num {
    display: inline-block;
    min-width: 22mm;
    padding: 2mm 3mm;
    background: var(--ink);
    color: #fff;
    font-size: 11pt;
    font-weight: 800;
    letter-spacing: 0.16em;
    border-radius: 1.5mm;
    text-align: center;
  }

  .part-divider .part-divider-inner {
    height: 240mm;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 0 18mm;
  }
  .part-divider-icon { font-size: 40pt; margin-bottom: 4mm; }
  .part-divider-num {
    font-size: 11pt;
    letter-spacing: 0.36em;
    color: var(--accent);
    font-weight: 800;
    text-transform: uppercase;
  }
  .part-divider-title {
    font-size: 38pt;
    font-weight: 900;
    color: var(--ink);
    margin: 4mm 0;
    letter-spacing: -0.02em;
  }
  .part-divider-tagline {
    font-size: 13pt;
    color: var(--muted);
    font-style: italic;
    max-width: 130mm;
    margin: 0 auto;
  }
  .part-divider-sep {
    width: 40mm; height: 3px;
    background: var(--accent);
    margin: 10mm auto;
  }
  .part-divider-covers {
    background: var(--muted-soft);
    padding: 4mm 6mm;
    border-radius: 2mm;
    max-width: 150mm;
    margin: 0 auto;
  }
  .part-divider-covers-label {
    font-size: 8.5pt;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--accent-2);
    font-weight: 700;
    margin-bottom: 2mm;
  }
  .part-divider-covers-list {
    font-size: 10pt;
    color: var(--ink);
    line-height: 1.6;
  }

  /* ============ Exec summary / TOC ============ */
  .lead {
    font-size: 11pt;
    color: var(--muted);
    line-height: 1.6;
    margin-bottom: 6mm;
  }
  .kbd {
    background: var(--muted-soft);
    border: 1px solid var(--rule);
    padding: 0.5mm 1.5mm;
    border-radius: 1mm;
    font-family: "JetBrains Mono", "Consolas", monospace;
    font-size: 9pt;
  }
  table.primitives td:first-child, table.primitives th:first-child { width: 30mm; }
  table.primitives td:nth-child(2) { font-family: "JetBrains Mono", "Consolas", monospace; font-size: 8.4pt; }

  table.toc-table td.num, table.parts-index td.part { width: 18mm; font-weight: 700; color: var(--accent-2); text-align: center; }
  table.toc-table td.part { width: 32mm; color: var(--muted); }
  .toc-parts { margin-top: 10mm; }

  /* ============ Callouts ============ */
  .callout {
    background: var(--callout-bg);
    border-left: 4px solid var(--callout-border);
    padding: 4mm 5mm;
    margin: 4mm 0;
    border-radius: 0 2mm 2mm 0;
  }
  .callout-title {
    font-weight: 800;
    color: var(--accent-2);
    text-transform: uppercase;
    letter-spacing: 0.12em;
    font-size: 8.8pt;
    margin-bottom: 2mm;
  }
  .callout-body { font-size: 10pt; line-height: 1.6; }
  .callout-primary { background: var(--accent-soft); border-left-color: var(--accent); }
  .callout-final { background: #E8F4FD; border-left-color: #1565C0; }
  .callout-final .callout-title { color: #1565C0; }

  /* ============ Cheat sheet ============ */
  .cheat ol.checklist { padding-left: 6mm; }
  .cheat ol.checklist li { margin: 2.5mm 0; line-height: 1.6; }
  .cheat .check-grid {
    columns: 2;
    column-gap: 8mm;
    list-style: none;
    padding-left: 0;
    margin-top: 3mm;
  }
  .cheat .check-grid li {
    break-inside: avoid;
    margin: 1mm 0;
    font-size: 9.8pt;
  }
  table.upgrade td:first-child {
    color: #B91C1C;
    width: 50%;
    font-style: italic;
  }
  table.upgrade td:nth-child(2) {
    color: #166534;
    font-weight: 500;
  }

  /* ============ Misc tweaks for the markdown content ============ */
  .part-body h1 { display: none; }   /* we already render the part heading separately */
  .part-body h2 {
    background: linear-gradient(90deg, var(--accent-soft) 0%, transparent 100%);
    padding: 2mm 3mm;
    border-bottom: 2px solid var(--accent);
    margin-top: 8mm;
    font-size: 14pt;
  }
  .part-body h3 {
    color: var(--ink);
    margin-top: 6mm;
    padding-left: 3mm;
    border-left: 3px solid var(--accent);
  }
  .part-body h4 {
    color: var(--accent-2);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-size: 9.5pt;
    margin-top: 4mm;
  }
  .part-body blockquote {
    font-size: 10.5pt;
  }
  .part-body table { font-size: 9.2pt; }
  .part-body table th { font-size: 8.6pt; padding: 1.5mm 2mm; }
  .part-body table td { padding: 1.8mm 2mm; }
  .part-body hr { margin: 5mm 0; }

  /* Ensure long pre blocks wrap and don't overflow page width */
  pre, table { max-width: 100%; }
</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}

// ---------- Build final HTML ----------
function buildHtml() {
  let body = '';
  body += buildCover();
  body += buildExecutiveSummary();
  body += buildSectionMap();
  for (const part of PARTS) {
    body += buildPartDivider(part);
    body += buildPartBody(part);
  }
  body += buildCheatSheet();
  return wrapDocument(body);
}

// ---------- Puppeteer render ----------
async function renderPdf(html) {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'load' });
  await page.emulateMediaType('print');

  const headerTemplate = `
    <div style="width:100%; font-size:7.5pt; padding:0 14mm; color:#0A2540;
                display:flex; justify-content:space-between; align-items:center;
                border-bottom:0.5pt solid #E2E8F0; padding-bottom:2mm;">
      <span style="font-weight:700; letter-spacing:0.12em;">AMAZON SDE-1 &middot; MASTER INTERVIEW HANDBOOK</span>
      <span style="color:#FF9900; font-weight:700; letter-spacing:0.16em;">CONFIDENTIAL PREP</span>
    </div>`;
  const footerTemplate = `
    <div style="width:100%; font-size:7.5pt; padding:0 14mm; color:#4A5568;
                display:flex; justify-content:space-between; align-items:center;
                border-top:0.5pt solid #E2E8F0; padding-top:2mm;">
      <span style="font-style:italic;">Carolina Furniture Concepts &middot; MERN Operations Platform</span>
      <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
    </div>`;

  await page.pdf({
    path: OUT_PATH,
    format: 'A4',
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate,
    footerTemplate,
    margin: { top: '22mm', bottom: '20mm', left: '14mm', right: '14mm' },
    preferCSSPageSize: false,
  });

  await browser.close();
}

(async () => {
  console.log('Building HTML...');
  const html = buildHtml();
  // Optionally dump HTML for debugging
  fs.writeFileSync(path.join(__dirname, 'handbook.html'), html, 'utf8');
  console.log(`HTML size: ${(html.length / 1024).toFixed(1)} KB`);

  console.log('Rendering PDF via Puppeteer (reusing backend chromium)...');
  await renderPdf(html);

  const stat = fs.statSync(OUT_PATH);
  console.log(`✅ PDF written: ${OUT_PATH}`);
  console.log(`   Size: ${(stat.size / 1024).toFixed(1)} KB`);
})().catch((err) => {
  console.error('❌ PDF build failed:', err);
  process.exit(1);
});
