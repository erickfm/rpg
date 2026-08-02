// Item 66: re-verify sampled CONFIRMED ledger rows against the world AS IT IS
// NOW — not against the evidence the row cites, which is the whole point.
//
// Each row gets a fresh measurement and a verdict. A row that cannot be
// reproduced today is not confirmed, whatever it says; demoting is the success
// case, not the failure case.
//
// Usage: SHOT_URL=http://localhost:4193/ node scripts/probes/w30-ledger-verify.mjs
import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage();
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4193/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });

const verdicts = [];
const say = (line, claim, ok, detail) => {
  verdicts.push({ line, ok });
  console.log(`\nL${line}  ${ok ? 'HOLDS' : 'DEMOTE'}  — ${claim}\n        ${detail}`);
};

// ── L125 [F] "thrift interior too thin" ───────────────────────────────────
// The row's claim is a RANKING: thrift 11.3 x 9.4, "sixth of ten" by narrowest
// dimension, five rooms narrower. Re-rank from roomDims() rather than trusting
// the cited numbers.
{
  const dims = await p.evaluate(() => window.__ct.roomDims()
    .map((d) => ({ id: d.id, w: d.w, d: d.d })));
  const narrow = dims.map((r) => ({ id: r.id, n: Math.min(r.w, r.d), w: r.w, d: r.d }))
    .sort((a, z) => a.n - z.n);
  const rank = narrow.findIndex((r) => r.id === 'thrift') + 1;
  const th = narrow.find((r) => r.id === 'thrift');
  const narrower = narrow.filter((r) => r.n < (th?.n ?? 0)).map((r) => `${r.id} ${r.n.toFixed(1)}`);
  say(125, 'thrift interior too thin — claim: 11.3 x 9.4, sixth of ten, five rooms narrower',
    !!th && rank >= 6 && narrower.length >= 5,
    `thrift is ${th ? `${th.w.toFixed(1)} x ${th.d.toFixed(1)}` : 'ABSENT'}, `
    + `rank ${rank} of ${narrow.length} by narrowest side; `
    + `${narrower.length} narrower: ${narrower.join(', ')}`);
}

// ── L320 [J] "things feel cramped in the library" ─────────────────────────
// The row makes it measurable on purpose: red in the V overlay is
// trapAgainst() flagging a corridor under 0.95 m, and the user's shot had the
// library's left half almost entirely red. So: count red among the LIBRARY's
// own colliders. Actors are excluded the way the overlay now excludes them
// (item 65) — there are none indoors, but the rule should be the same one.
{
  const r = await p.evaluate(async () => {
    const { trapAgainst } = await import('/src/proto/ct/gap.ts');
    const lib = window.__ct.roomDims().find((d) => d.id === 'library');
    if (!lib) return null;
    const key = (c) => `${c.minX} ${c.maxX} ${c.minZ} ${c.maxZ} ${c.rot ?? 0}`;
    const actorKeys = new Set((window.__ct.actorColliders?.() ?? []).map(key));
    const cols = window.__ct.colliders().filter((c) => !actorKeys.has(key(c)));
    const hw = lib.w / 2, hd = lib.d / 2;
    const inLib = cols.filter((c) => (c.minX + c.maxX) / 2 > lib.cx - hw
      && (c.minX + c.maxX) / 2 < lib.cx + hw
      && (c.minZ + c.maxZ) / 2 > lib.cz - hd && (c.minZ + c.maxZ) / 2 < lib.cz + hd);
    const red = inLib.filter((c) => trapAgainst(c, cols) !== null);
    return { w: lib.w, d: lib.d, n: inLib.length, red: red.length,
      gaps: red.map((c) => +trapAgainst(c, cols).toFixed(3)).sort((a, z) => a - z) };
  });
  if (!r) say(320, 'library cramped', false, 'no library in roomDims() at all');
  else say(320, 'library cramped — spread things out; red = a corridor under 0.95 m',
    r.red === 0,
    `library ${r.w.toFixed(1)} x ${r.d.toFixed(1)}, ${r.n} colliders inside, `
    + `${r.red} still RED${r.red ? ' (gaps ' + r.gaps.join(', ') + ')' : ''}`);
}

const held = verdicts.filter((v) => v.ok).length;
console.log(`\n${held}/${verdicts.length} of the rows measured here still hold`);
await b.close();
