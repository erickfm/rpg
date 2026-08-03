#!/usr/bin/env node
// Write street/desk.html — one card per live agent: what it is doing and how far
// it has got. Serve it from the dev server that is already running:
//
//     node scripts/desk-page.mjs && open http://localhost:5177/desk.html
//
// WHY THIS EXISTS. The user asked for "the latest info on each of the agents …
// the progress and the intent at a glance". Both facts are already on disk and
// nobody was joining them:
//
//   INTENT   `notes/QUEUE.md`'s DOING rows carry `| id | DOING <who> <hh:mm> |`
//            plus the whole brief. That is the agent's assignment in its own
//            words, and the claim stamp is when it took it.
//   PROGRESS every builder works in `.claude/worktrees/agent-*` on its own
//            branch. Last commit subject + age + unlanded count is the honest
//            answer to "how far has it got".
//
// THE JOIN IS THE ONLY FIDDLY PART, and it is why this reads git rather than
// asking the harness: the queue knows agents by NAME (`onehundredten`) and the
// filesystem knows them by worktree ID (`agent-a5aaa71a…`). Nothing records the
// mapping. Two bridges, tried in order, both derived from things builders
// already do rather than from anything new they must remember:
//
//   1. COMMIT SUBJECTS. Builders write `Item 258: …`, so a branch carrying the
//      item a name has claimed is that name's branch.
//   2. HANDOFF NOTES. Builders write `notes/<name>-item<N>-*.md`. When a branch
//      has not committed against its item yet, its note filename still names it.
//
// A worktree that matches neither is still shown — as UNMATCHED, not hidden.
// Silently dropping an agent would defeat the point of the page.
//
// This is a SNAPSHOT, and it says so in the corner. Re-run it to refresh; the
// desk regenerates it each tick. It deliberately does not poll or embed a
// timer — a page that lies about being live is worse than one that is honestly
// stale, and this project has spent a session removing instruments that
// reported things they had not measured.

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const STREET = join(HERE, '..');
const REPO = join(STREET, '..');
const QUEUE = join(STREET, 'notes/QUEUE.md');
const OUT = join(STREET, 'desk.html');

const sh = (cmd, cwd = REPO) => {
  try { return execSync(cmd, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch { return ''; }
};

// ── the queue ──────────────────────────────────────────────────────────────
const queue = existsSync(QUEUE) ? readFileSync(QUEUE, 'utf8') : '';
const rows = queue.split('\n').filter((l) => /^\| *[0-9]+[a-z]* *\|/.test(l));

const cell = (line, n) => (line.split('|')[n] ?? '').trim();

const doing = [];
const counts = { todo: 0, doing: 0, done: 0, deferred: 0, ask: 0 };
for (const line of rows) {
  const id = cell(line, 1);
  const status = cell(line, 2);
  const what = cell(line, 4) || cell(line, 3);
  if (/^TODO$/.test(status)) counts.todo++;
  else if (/^DONE/.test(status)) counts.done++;
  else if (/^DEFERRED/.test(status)) counts.deferred++;
  else if (/^ASK-USER/.test(status)) counts.ask++;
  else if (/^DOING/.test(status)) {
    counts.doing++;
    const m = status.match(/^DOING\s+(\S+)\s+(\S+)/);
    doing.push({ id, who: m?.[1] ?? '?', since: m?.[2] ?? '?', files: cell(line, 3), what });
  }
}

// the user's own asks, still open — he cares about these more than the rest
const userOpen = rows
  .filter((l) => /^\| *[0-9]+[a-z]* *\| *TODO *\|/.test(l) && /The user/.test(l))
  .map((l) => {
    const q = l.match(/The user[^*]{0,20}\*"([^"]{0,90})/);
    return { id: cell(l, 1), quote: q?.[1] ?? cell(l, 3).slice(0, 80) };
  });

// ── the worktrees ──────────────────────────────────────────────────────────
const wtDir = join(REPO, '.claude/worktrees');
const worktrees = existsSync(wtDir)
  ? readdirSync(wtDir).filter((d) => d.startsWith('agent-'))
  : [];

const notesDir = join(STREET, 'notes');
const noteNames = existsSync(notesDir) ? readdirSync(notesDir) : [];

const agents = worktrees.map((dir) => {
  const path = join(wtDir, dir);
  const branch = sh('git rev-parse --abbrev-ref HEAD', path);
  const subject = sh('git log -1 --format=%s', path);
  const ago = sh('git log -1 --format=%cr', path);
  const iso = sh('git log -1 --format=%ct', path);
  const unlanded = sh(`git rev-list --count HEAD..${branch}`) || '0';
  const recent = sh('git log -8 --format=%s', path).split('\n').filter(Boolean);

  // bridge 1: a commit subject naming an item somebody has claimed
  let who = null;
  for (const d of doing) {
    if (recent.some((s) => new RegExp(`\\bitem ${d.id}\\b`, 'i').test(s))) { who = d.who; break; }
  }
  // bridge 2: a handoff note named after a claimant
  if (!who) {
    for (const d of doing) {
      if (noteNames.some((n) => n.startsWith(`${d.who}-item`))) {
        if (recent.some((s) => new RegExp(d.who, 'i').test(s))) { who = d.who; break; }
      }
    }
  }
  return { dir, id: dir.replace('agent-', '').slice(0, 8), branch, subject, ago, iso: Number(iso) || 0, unlanded, who };
});

const byWho = new Map(agents.filter((a) => a.who).map((a) => [a.who, a]));

// ── html ───────────────────────────────────────────────────────────────────
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** the brief is enormous; the first sentence is the intent */
const gist = (what) => {
  const plain = String(what).replace(/\*\*/g, '').replace(/⚠+/g, '').replace(/`/g, '').trim();
  const stop = plain.search(/[.?!]\s/);
  return (stop > 30 ? plain.slice(0, stop + 1) : plain.slice(0, 220)).trim();
};

const now = new Date();
const stamp = now.toLocaleString('en-GB', { hour12: false });

const cards = doing.map((d) => {
  const a = byWho.get(d.who);
  const quiet = a?.iso ? Math.round((Date.now() / 1000 - a.iso) / 60) : null;
  const state = quiet === null ? 'unknown' : quiet > 45 ? 'quiet' : 'working';
  return `
  <article class="card ${state}">
    <header>
      <span class="who">${esc(d.who)}</span>
      <span class="item">item ${esc(d.id)}</span>
      <span class="since">claimed ${esc(d.since)}</span>
    </header>
    <p class="intent">${esc(gist(d.what))}</p>
    <div class="files">${esc(d.files.slice(0, 110))}</div>
    <footer>
      ${a ? `<span class="commit">${esc(a.subject.slice(0, 96))}</span>
             <span class="meta">${esc(a.ago)} · ${esc(a.unlanded)} unlanded · ${esc(a.id)}</span>`
          : `<span class="meta nomatch">no worktree matched — it may not have committed yet</span>`}
    </footer>
  </article>`;
}).join('\n');

// MOST WORKTREES ARE DEAD. 62 exist against a handful of live agents — every
// builder all session left one behind, and `git worktree prune` only clears
// entries whose directory is already gone. Showing all of them would bury the
// four cards that matter under fifty headstones, which is the opposite of "at a
// glance". So an unmatched worktree is only worth a card if it has committed
// recently enough to plausibly still be running; the rest are counted, not drawn.
const FRESH_MIN = 120;
const fresh = (a) => a.iso && (Date.now() / 1000 - a.iso) / 60 < FRESH_MIN;
const dormant = agents.filter((a) => !a.who && !fresh(a)).length;

const orphans = agents.filter((a) => !a.who && fresh(a)).map((a) => `
  <article class="card unmatched">
    <header><span class="who">${esc(a.id)}</span><span class="item">unmatched</span></header>
    <p class="intent">Holds no claimed row the desk could match. Either between items, or finished and not yet reaped.</p>
    <footer><span class="commit">${esc(a.subject.slice(0, 96))}</span>
            <span class="meta">${esc(a.ago)} · ${esc(a.unlanded)} unlanded</span></footer>
  </article>`).join('\n');

const asks = userOpen.map((u) => `<li><b>${esc(u.id)}</b> “${esc(u.quote)}”</li>`).join('\n') || '<li class="none">none open</li>';

writeFileSync(OUT, `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>CROSSTOWN desk — agents</title>
<style>
  :root { color-scheme: dark; --bg:#141317; --card:#1c1b21; --line:#2c2a33;
          --ink:#e8e2d0; --dim:#8d8798; --warm:#d8a83a; --good:#7fb069; --quiet:#c9683f; }
  * { box-sizing:border-box }
  body { margin:0; background:var(--bg); color:var(--ink);
         font:14px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace; padding:24px }
  h1 { font-size:15px; letter-spacing:.14em; text-transform:uppercase; margin:0 0 2px; color:var(--warm) }
  .stamp { color:var(--dim); font-size:12px; margin-bottom:20px }
  .stamp b { color:var(--ink) }
  .tallies { display:flex; flex-wrap:wrap; gap:18px; padding:12px 14px; margin-bottom:22px;
             background:var(--card); border:1px solid var(--line); border-radius:6px }
  .tallies div { font-size:12px; color:var(--dim) }
  .tallies b { display:block; font-size:22px; color:var(--ink); font-weight:600 }
  h2 { font-size:12px; letter-spacing:.14em; text-transform:uppercase; color:var(--dim);
       margin:26px 0 10px; border-bottom:1px solid var(--line); padding-bottom:6px }
  .grid { display:grid; gap:14px; grid-template-columns:repeat(auto-fill,minmax(340px,1fr)) }
  .card { background:var(--card); border:1px solid var(--line); border-left:3px solid var(--dim);
          border-radius:6px; padding:13px 15px }
  .card.working { border-left-color:var(--good) }
  .card.quiet   { border-left-color:var(--quiet) }
  .card.unmatched { opacity:.62 }
  header { display:flex; flex-wrap:wrap; gap:10px; align-items:baseline; margin-bottom:8px }
  .who { font-weight:600; color:var(--warm) }
  .item { font-size:12px; color:var(--dim) }
  .since { font-size:12px; color:var(--dim); margin-left:auto }
  .intent { margin:0 0 8px; color:var(--ink) }
  .files { font-size:12px; color:var(--dim); margin-bottom:10px; word-break:break-word }
  footer { border-top:1px solid var(--line); padding-top:8px; display:grid; gap:3px }
  .commit { font-size:12px }
  .meta { font-size:11px; color:var(--dim) }
  .nomatch { color:var(--quiet) }
  ul { margin:0; padding-left:20px } li { margin-bottom:5px }
  li.none { list-style:none; color:var(--dim); padding-left:0 }
  .note { color:var(--dim); font-size:12px; margin-top:26px; border-top:1px solid var(--line); padding-top:12px }
  @media (max-width:640px){ body{padding:14px} .grid{grid-template-columns:1fr} }
</style></head><body>
<h1>Crosstown '97 — the desk</h1>
<p class="stamp">snapshot taken <b>${esc(stamp)}</b> · re-run <code>node scripts/desk-page.mjs</code> to refresh. This page does not poll; it is honest about being a snapshot.</p>

<div class="tallies">
  <div><b>${counts.doing}</b>in flight</div>
  <div><b>${counts.todo}</b>claimable</div>
  <div><b>${userOpen.length}</b>your asks open</div>
  <div><b>${counts.deferred}</b>deferred by you</div>
  <div><b>${counts.ask}</b>awaiting you</div>
</div>

<h2>Agents at work</h2>
<div class="grid">${cards || '<p class="stamp">Nobody is holding an item. If the queue is not empty, that is the desk failing.</p>'}</div>

${orphans ? `<h2>Recently active, no matched claim</h2><div class="grid">${orphans}</div>` : ''}
${dormant ? `<p class="note">${dormant} dormant worktree${dormant === 1 ? '' : 's'} not shown — no commit in ${FRESH_MIN} minutes. Every builder this session left one behind; <code>git worktree prune</code> only clears entries whose directory is already gone.</p>` : ''}

<h2>Your asks still open</h2>
<ul>${asks}</ul>

<p class="note">Intent is the first sentence of the queue row the agent claimed. Progress is its worktree's latest commit.
A card is marked <span style="color:var(--quiet)">quiet</span> after 45 minutes without a commit — long runs are normal here,
so quiet is a prompt to look, not a verdict.</p>
</body></html>
`);

console.log(`wrote ${OUT}`);
console.log(`  ${doing.length} in flight, ${agents.length} worktrees, ${agents.filter((a) => a.who).length} matched`);
