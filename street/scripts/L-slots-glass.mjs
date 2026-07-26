#!/usr/bin/env node
// THE CLAIM: the glass shows the machine. The symbol on the payline is the
// symbol that paid, the six symbols are visually distinct, nothing is drawn
// outside the panel, no coordinate is ever NaN, and painting the same machine
// twice paints exactly the same pixels.
//
// NO BROWSER AND NO SCREENSHOT. GOTCHAS §1 is blunt that screenshots prove
// nothing in this project — `dither()` and thirteen other paint sites call an
// unseeded `Math.random()`, so 173 of 222 textures differ on every load. The
// answer everywhere else is the structural fingerprint, and this is the same
// idea one level down: `paintMachine` is given a RECORDING 2D context that
// writes every call into a list, and the list is the thing asserted.
//
// That is only possible because the panel is a deterministic function of
// (view, t) with no random grain in it — which is itself one of the things
// asserted below, because the day somebody adds a `Math.random()` speckle to
// the reel cream, this file stops being able to check anything at all.
//
//   node scripts/L-slots-glass.mjs             the glass shows the machine
//   node scripts/L-slots-glass.mjs symbols     the six symbols, and their signatures
//   node scripts/L-slots-glass.mjs all
//   node scripts/L-slots-glass.mjs --selftest  break the glass six ways
//
// Exit codes are the house convention (GOTCHAS §32): 0 fine, 1 wrong, 2 usage,
// 3 nothing measured.

import { execFileSync } from 'node:child_process';
import { register } from 'node:module';
import { fileURLToPath } from 'node:url';

const SELF = fileURLToPath(import.meta.url);
// Lets node resolve this project's extensionless relative imports. See the file.
register('./lib/L-ts-imports.mjs', import.meta.url);
const MODES = ['glass', 'symbols', 'all', '--selftest'];
const mode = process.argv[2] ?? 'glass';
if (!MODES.includes(mode)) {
  console.error(`usage: node scripts/L-slots-glass.mjs [${MODES.join('|')}]`);
  process.exit(2);
}

// ── mutations ────────────────────────────────────────────────────────────────
//
// GOTCHAS §27, and the same rule as its two siblings: break the GLASS, not the
// check. Each of these is a mistake that would ship looking almost right.
const MUTATIONS = {
  // THE GLASS STOPS FOLLOWING THE REEL. `pos` is pinned, so the window shows
  // whatever was at strip index 0 while the machine pays for the stop it
  // actually landed on. The machine is right and the player is shown a lie —
  // the fault this whole file exists for, and invisible to every other check.
  //
  // It is injected on the VIEW, which is the seam the painter really reads
  // through. My first attempt replaced the exported `symAt`, and `paintReel`
  // closes over the module's own binding, so the mutation applied, the glass
  // stayed correct, and the selftest reported a working check on a machine it
  // had not broken. Third time in this feature that a mutation missed its
  // target the same way (GOTCHAS §27).
  'frozen-pos': (S) => {
    const real = S.createMachine;
    S.createMachine = (o) => {
      const m = real(o), view = m.view;
      return { ...m, view: () => {
        const v = view();
        return { ...v, reels: v.reels.map((r) => ({ ...r, pos: 0 })) };
      } };
    };
  },
  // The payline is drawn a row too high, so the machine pays for a symbol that
  // is not the one under the line.
  'payline-off': (S) => { S.GLASS.rowH = 30; S.GLASS.y = S.GLASS.y - 30; },
  // Two symbols become the same mark. A double bar and a triple bar that look
  // identical is a machine you cannot read.
  'same-bars': (S) => {
    const real = S.paintSym;
    S.paintSym = (g, s, cx, cy) => real(g, s === 'BAR3' ? 'BAR2' : s, cx, cy);
  },
  // Grain in the paint. Harmless-looking, and it destroys the only mechanism
  // this project has for checking a panel at all (GOTCHAS §1).
  grain: (S) => {
    const real = S.paintSym;
    S.paintSym = (g, s, cx, cy) => { real(g, s, cx, cy); g.fillRect(cx + Math.random() * 4, cy, 1, 1); };
  },
  // The letterbox goes: the face is drawn at 1:1 in the corner of a wide panel
  // instead of scaled to fit, so most of the screen is empty.
  'no-fit': (S) => { S.FACE.w = 32; S.FACE.h = 24; },
  // A NaN creeps into a coordinate. Canvas silently draws nothing, so the reel
  // simply vanishes with no error anywhere.
  nan: (S) => {
    const real = S.paintSym;
    S.paintSym = (g, s, cx, cy) => real(g, s, cx, s === 'SEVEN' ? NaN : cy);
  },
};

let S;
try {
  S = { ...await import('../src/proto/ct/slots.ts') };
} catch (e) {
  console.error(`ABORTED: could not load ct/slots.ts — ${e.message}`);
  process.exit(3);
}

if (process.env.L_SLOTS_MUTATE) {
  const m = MUTATIONS[process.env.L_SLOTS_MUTATE];
  if (!m) { console.error(`ABORTED: no mutation "${process.env.L_SLOTS_MUTATE}"`); process.exit(3); }
  m(S);
  console.log(`  [MUTATED: ${process.env.L_SLOTS_MUTATE}] — this run is expected to FAIL\n`);
}

if (mode === '--selftest') {
  let slept = 0;
  const names = Object.keys(MUTATIONS);
  for (const name of names) {
    let code = 0, out = '';
    try {
      out = execFileSync(process.execPath, [SELF, 'all'], {
        env: { ...process.env, L_SLOTS_MUTATE: name }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (e) { code = e.status ?? -1; out = `${e.stdout ?? ''}${e.stderr ?? ''}`; }
    const failed = (out.match(/^FAIL/gm) ?? []).length;
    const caught = code === 1 && failed > 0;      // exit 3 is NOT a catch, GOTCHAS §32
    if (!caught) slept++;
    console.log(`${caught ? 'CAUGHT ' : 'SLEPT  '} ${name.padEnd(13)} exit=${code} fails=${failed}`);
  }
  console.log(slept === 0
    ? `\n  selftest: ${names.length} / ${names.length} CAUGHT. The check can fail.\n`
    : `\n  selftest: ${slept} mutation(s) SLEPT — the check passed a broken glass.\n`);
  process.exit(slept === 0 ? 0 : 2);
}

if (!S.paintMachine || !S.paintSym) {
  console.error('ABORTED: ct/slots.ts publishes no painter — every verdict below is free.');
  process.exit(3);
}

let bad = 0;
const check = (ok, msg) => { console.log(`${ok ? 'OK  ' : 'FAIL'}  ${msg}`); if (!ok) bad++; };

/**
 * A 2D context that draws nothing and remembers everything.
 *
 * It tracks the transform stack itself — only uniform scale and translate are
 * used — so every op is recorded twice: in LOCAL coordinates, which is what a
 * symbol signature is made of, and in SCREEN coordinates, which is what the
 * "nothing is drawn off the panel" verdict needs. Recording one and inferring
 * the other is how you end up asserting against the wrong space.
 */
const recorder = () => {
  const ops = [];
  let st = { tx: 0, ty: 0, s: 1 };
  const stack = [];
  const X = (x) => st.tx + x * st.s, Y = (y) => st.ty + y * st.s;
  const put = (op, style, a, b, c, d) => ops.push({
    op, style, x: a, y: b, w: c, h: d, sx: X(a), sy: Y(b), sw: c * st.s, sh: d * st.s,
  });
  const g = {
    fillStyle: '#000', strokeStyle: '#000', font: '', textAlign: '', globalAlpha: 1, lineWidth: 1,
    fillRect: (x, y, w, h) => put('fillRect', g.fillStyle, x, y, w, h),
    strokeRect: (x, y, w, h) => put('strokeRect', g.strokeStyle, x, y, w, h),
    clearRect: (x, y, w, h) => put('clearRect', g.fillStyle, x, y, w, h),
    fillText: (s, x, y) => ops.push({ op: 'fillText', style: g.fillStyle, text: s, x, y, w: 0, h: 0, sx: X(x), sy: Y(y), sw: 0, sh: 0 }),
    save: () => { stack.push({ ...st }); },
    restore: () => { st = stack.pop() ?? st; },
    translate: (x, y) => { st = { ...st, tx: X(x), ty: Y(y) }; },
    scale: (a, b) => { if (a !== b) throw new Error('non-uniform scale — the recorder only models uniform'); st = { ...st, s: st.s * a }; },
    beginPath: () => {}, fill: () => {}, clip: () => {},
    arc: (x, y, r) => put('arc', g.fillStyle, x, y, r, r),
    rect: (x, y, w, h) => put('rect', g.fillStyle, x, y, w, h),
  };
  return { g, ops };
};

const num = (n) => Math.round(n * 100) / 100;
/** A symbol's fingerprint: every mark it makes, relative to its own centre. */
const signature = (ops, cx, cy) => ops
  .filter((o) => o.op !== 'rect')
  .map((o) => `${o.op}|${o.style}|${num(o.x - cx)}|${num(o.y - cy)}|${num(o.w)}|${num(o.h)}`)
  .join(';');

const scripted = (stops) => { let i = 0; return () => { const s = stops[i++ % stops.length]; return (s + 0.5) / S.STOPS; }; };
const idxOf = (reel, sym) => S.STRIPS[reel].indexOf(sym);

/** Play one scripted spin all the way to rest and return the settled view. */
const settledOn = (stops) => {
  const m = S.createMachine({ rng: scripted(stops) });
  m.insert(500); m.play();
  for (let n = 0; n < 400 && !m.settled(); n++) m.tick(0.05);
  return { m, v: m.view() };
};

const W = 960, H = 720;

console.log('\nSEVENS — the glass. Recorded, not screenshotted; GOTCHAS §1.\n');

// ── the six symbols ──────────────────────────────────────────────────────────
const SIGS = {};
if (mode === 'symbols' || mode === 'all' || mode === 'glass') {
  for (const sym of S.SYMS) {
    const { g, ops } = recorder();
    S.paintSym(g, sym, 100, 100);
    SIGS[sym] = signature(ops, 100, 100);
  }
}

if (mode === 'symbols' || mode === 'all') {
  console.log('  THE SIX SYMBOLS\n');
  for (const sym of S.SYMS) {
    const { ops } = (() => { const r = recorder(); S.paintSym(r.g, sym, 100, 100); return r; })();
    console.log(`    ${(S.SYM_NAME[sym] || 'blank').padEnd(12)} ${String(ops.length).padStart(3)} marks`
      + `   ${[...new Set(ops.map((o) => o.style))].length} colours`);
  }
  console.log('');

  const drawn = S.SYMS.filter((s) => SIGS[s] !== '');
  check(drawn.length === 5,
    `five symbols draw something and BLANK draws nothing (${drawn.length} of ${S.SYMS.length})`
    + ' — a blank stop on a real strip is the reel showing through, not a mark');
  const distinct = new Set(drawn.map((s) => SIGS[s]));
  check(distinct.size === drawn.length,
    `all ${drawn.length} are visually DISTINCT — a double bar you cannot tell from a triple`
    + ' is a machine you cannot read');

  // Silhouette, not just colour: the bars have to differ by how many divisions
  // they have, which is the only thing separating a 20 from a 100.
  const barMarks = ['BAR1', 'BAR2', 'BAR3'].map((s) => {
    const r = recorder(); S.paintSym(r.g, s, 100, 100); return r.ops.length;
  });
  check(barMarks[0] < barMarks[1] && barMarks[1] < barMarks[2],
    `the bars count upward in the drawing itself — ${barMarks.join(', ')} marks`
    + ' — so they differ in silhouette, not only in colour');
}

if (mode === 'glass' || mode === 'all') {
  // ── the glass shows what the machine says ──────────────────────────────────
  //
  // The one that matters. Everything else about this feature can be right and
  // the player still be shown the wrong reel.
  console.log('  THE WHOLE WINDOW SHOWS THE REEL IT BELONGS TO\n');
  //
  // All THREE visible rows, not only the payline. The row above and the row
  // below come off the same strip, so checking the full column is what catches
  // a window drawing from the wrong reel — a hardcoded index in the painter
  // would leave the centre symbol matching by coincidence often enough, and
  // three rows agreeing by coincidence is vanishingly unlikely.
  //
  // It is also the near miss made checkable: the seven you watch slide past the
  // payline is a row this now verifies, and `windowAt` had those two rows the
  // wrong way up until the glass forced the question.
  let matched = 0, tested = 0;
  for (const sym of S.SYMS) {
    const stops = [0, 1, 2].map((i) => {
      const at = idxOf(i, sym);
      return at >= 0 ? at : idxOf(i, 'BLANK');
    });
    const { v } = settledOn(stops);
    const { g, ops } = recorder();
    S.paintMachine(g, W, H, v, 0);

    for (let i = 0; i < 3; i++) {
     const stop = v.reels[i].stop;
     if (S.symAt(i, stop) !== sym) continue;            // this reel has no such symbol
     // [above, centre, below] — the order `windowAt` publishes, which is the
     // order the drum turns in.
     const rows = S.windowAt(i, stop);
     for (let row = 0; row < 3; row++) {
      const sym2 = rows[row];
      tested++;
      const cx = S.GLASS.x + i * (S.GLASS.reelW + S.GLASS.gap) + S.GLASS.reelW / 2;
      const cy = S.GLASS.y + S.GLASS.h / 2 + (row - 1) * S.GLASS.rowH;
      // Isolate the marks that are a SYMBOL: inside this reel's cell, and small
      // enough not to be the reel's own cream, its blur wash or the payline —
      // all of which span the whole window. The filter is validated by the loop
      // itself: if it were wrong, the BLANK case below would not come out empty
      // and no symbol would match its own signature.
      //
      // The half-row band is the only value that works and it is not a guess: a
      // symbol reaches 13 px from its centre and the next one along is 30 px
      // away, so its nearest edge is 17. Anything in (13, 17) separates them.
      // Tightening it to 13 cut off each bar's own shadow rect and dropped six
      // pairs; it only LOOKED like a symbol mismatch. Widening it past 17 lets
      // the neighbour in.
      const cell = ops.filter((o) => o.op !== 'rect'
        && Math.abs(o.x - cx) < S.GLASS.reelW / 2 && Math.abs(o.y - cy) < S.GLASS.rowH / 2
        && o.w < S.GLASS.reelW * 0.7 && o.h < S.GLASS.rowH);
      if (signature(cell, cx, cy) === SIGS[sym2]) matched++;
      else console.log(`    reel ${i + 1} ${['above', 'ON', 'below'][row]} the line`
        + ` should show ${sym2 || 'blank'} and does not`);
     }
    }
  }
  console.log(`    ${matched} of ${tested} reel/row cells draw exactly the symbol the strip has there\n`);
  // The floor is MEASURED, not remembered (GOTCHAS §34): 6 symbols x 3 reels x
  // 3 rows is 54, and every symbol happens to appear on every reel. It sat at
  // ">= 12" while the check only looked at the payline, which was exactly the
  // number a broken run produced — the population guard passed on the nose
  // while the thing it guarded had stopped being measured.
  check(tested >= 45, `there are ${tested} reel/row cells to check`
    + ' — every verdict here is free at zero (GOTCHAS §34)');
  check(matched === tested,
    'every row of every window IS what that reel\'s strip has at that position —'
    + ' pixel for pixel, against the same painter drawing the symbol alone');

  // ── nothing is NaN, nothing is off the panel ───────────────────────────────
  const states = [];
  {
    const { m } = settledOn([idxOf(0, 'SEVEN'), idxOf(1, 'SEVEN'), idxOf(2, 'SEVEN')]);
    states.push(['a jackpot, paying', m.view()]);
    const m2 = S.createMachine({ rng: scripted([0, 0, 0]) });
    states.push(['cold, no credits', m2.view()]);
    m2.insert(20); m2.play(); m2.tick(0.3);
    states.push(['mid-spin', m2.view()]);
    m2.tick(1.0);
    states.push(['reel 1 down, 2 and 3 turning', m2.view()]);
  }
  console.log('  EVERY STATE, DRAWN INTO A 960 x 720 PANEL\n');
  let nan = 0, off = 0, total = 0;
  for (const [name, v] of states) {
    const { g, ops } = recorder();
    S.paintMachine(g, W, H, v, 1.7);
    total += ops.length;
    const bad1 = ops.filter((o) => ![o.x, o.y, o.w, o.h, o.sx, o.sy].every(Number.isFinite));
    const bad2 = ops.filter((o) => o.op !== 'rect'
      && (o.sx < -1 || o.sy < -1 || o.sx + o.sw > W + 1 || o.sy + o.sh > H + 1));
    nan += bad1.length; off += bad2.length;
    console.log(`    ${name.padEnd(30)} ${String(ops.length).padStart(4)} marks`
      + `   ${bad1.length} NaN   ${bad2.length} off-panel`);
  }
  console.log('');
  check(total > 600, `the face is actually drawn — ${total} marks across four states`);
  check(nan === 0,
    `no coordinate is ever NaN (${nan}) — canvas draws NOTHING for a NaN and says nothing,`
    + ' so a reel would simply vanish with no error anywhere');
  check(off === 0, `nothing is drawn outside the panel (${off}) — the face letterboxes into what it is given`);

  // The face has to FILL the panel it is given, not sit at 1:1 in a corner.
  {
    const { g, ops } = recorder();
    S.paintMachine(g, W, H, states[0][1], 0);
    const marks = ops.filter((o) => o.op === 'fillRect' && o.sw > 0 && o.sh > 0);
    const spanX = Math.max(...marks.map((o) => o.sx + o.sw)) - Math.min(...marks.map((o) => o.sx));
    const spanY = Math.max(...marks.map((o) => o.sy + o.sh)) - Math.min(...marks.map((o) => o.sy));
    console.log(`    the face spans ${spanX.toFixed(0)} x ${spanY.toFixed(0)} of ${W} x ${H}\n`);
    check(spanY > H * 0.9 && spanX > W * 0.5,
      `it fills the panel it is handed (${spanX.toFixed(0)} x ${spanY.toFixed(0)})`
      + ' rather than sitting 1:1 in a corner');
  }

  // ── deterministic, which is what makes any of this checkable ───────────────
  const twice = (v, t) => {
    const a = recorder(); S.paintMachine(a.g, W, H, v, t);
    const b = recorder(); S.paintMachine(b.g, W, H, v, t);
    return JSON.stringify(a.ops) === JSON.stringify(b.ops);
  };
  check(states.every(([, v]) => twice(v, 0.4)),
    'the same machine paints the same pixels twice — no unseeded grain anywhere in the'
    + ' panel, which is the only reason this file can check it at all (GOTCHAS §1)');

  // …and it does move on the clock, or the bulbs and the win flash are dead.
  {
    const v = states[0][1];
    const a = recorder(); S.paintMachine(a.g, W, H, v, 0.0);
    const b = recorder(); S.paintMachine(b.g, W, H, v, 0.34);
    check(JSON.stringify(a.ops) !== JSON.stringify(b.ops),
      'and it is not frozen — the bulbs chase and a win flashes, so `t` reaches the glass');
    // 0.34 s, not 0.1: the chase steps 6 times a second and the flash 8, so two
    // frames a tenth apart are the SAME frame and the check went red on a
    // machine that was working. A sampling interval shorter than the thing it
    // samples measures nothing — GOTCHAS 48 with the sign flipped.
  }

  // ── the three windows, left to right ──────────────────────────────────────
  {
    const { g, ops } = recorder();
    S.paintMachine(g, W, H, states[3][1], 0);
    const frames = ops.filter((o) => o.op === 'strokeRect'
      && Math.abs(o.w - (S.GLASS.reelW + 2)) < 0.01 && Math.abs(o.h - (S.GLASS.h + 2)) < 0.01);
    const xs = frames.map((o) => o.sx).sort((p, q) => p - q);
    const gaps = xs.slice(1).map((x, i) => x - xs[i]);
    console.log(`    three reel windows at x ${xs.map((x) => x.toFixed(0)).join(', ')}`
      + `   even to ${gaps.length ? (Math.max(...gaps) - Math.min(...gaps)).toFixed(2) : '-'} px\n`);
    check(frames.length === 3, `there are exactly three reel windows (${frames.length})`);
    check(gaps.length === 2 && Math.abs(gaps[0] - gaps[1]) < 0.01,
      'evenly spaced across the glass, left to right');
    // The payline must sit on the centre row of the windows, or the machine
    // pays for a symbol that is not under the line.
    const line = ops.find((o) => o.op === 'fillRect' && Math.abs(o.w - S.GLASS.w) < 0.01 && o.h <= 1);
    const mid = frames[0].sy + frames[0].sh / 2;
    check(!!line && Math.abs(line.sy - mid) < 2,
      `the payline is drawn across the CENTRE row of the windows`
      + ` (${line ? Math.abs(line.sy - mid).toFixed(2) : '?'} px off)`);
  }

  // ── the blur ──────────────────────────────────────────────────────────────
  //
  // A reel you can read at full speed is a reel that is not moving.
  {
    const m = S.createMachine({ rng: scripted([3, 3, 3]) });
    m.insert(20); m.play(); m.tick(0.35);
    const fast = m.view().reels[0];
    for (let n = 0; n < 200 && !m.settled(); n++) m.tick(0.02);
    const rest = m.view().reels[0];
    console.log(`    reel 1 at ${Math.abs(fast.speed).toFixed(1)} stops/s, then at rest\n`);
    check(Math.abs(fast.speed) > 20 && rest.speed === 0,
      `the view publishes reel SPEED (${Math.abs(fast.speed).toFixed(1)} stops/s spinning, 0 at rest)`
      + ' so the glass can blur on it');
  }
}

console.log(bad === 0 ? `\n  ${mode}: all checks pass.\n` : `\n  ${mode}: ${bad} FAILED.\n`);
process.exit(bad === 0 ? 0 : 1);
