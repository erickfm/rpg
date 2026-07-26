#!/usr/bin/env node
// THE CLAIM: the felt shows the hand. Every card on the table is drawn as the
// card the table dealt, the hole card is not shown until it turns, the buttons
// offer exactly what the rules allow, and nothing is NaN or off the panel.
//
// No browser and no screenshot, for the reason `L-slots-glass.mjs` gives at
// length: GOTCHAS §1 says two runs of this project differ in 20% of pixels, so
// `paintTable` is handed a RECORDING 2D context and the call list is asserted.
// It works because the felt is a deterministic function of the view.
//
// THE HOLE CARD IS THE VERDICT THIS FILE EXISTS FOR. A blackjack interface that
// shows the dealer's down card costs the house nothing — the money is identical
// — so no RTP figure will ever move on it, no playtest will notice, and it
// destroys the game. It is checkable only by reading what was drawn.
//
//   node scripts/L-blackjack-felt.mjs             the felt shows the hand
//   node scripts/L-blackjack-felt.mjs cards       the 52 cards, and their pips
//   node scripts/L-blackjack-felt.mjs all
//   node scripts/L-blackjack-felt.mjs --selftest  break the felt six ways
//
// Exit codes are the house convention (GOTCHAS §32): 0 fine, 1 wrong, 2 usage,
// 3 nothing measured.

import { execFileSync } from 'node:child_process';
import { register } from 'node:module';
import { fileURLToPath } from 'node:url';

const SELF = fileURLToPath(import.meta.url);
register('./lib/L-ts-imports.mjs', import.meta.url);

const MODES = ['felt', 'cards', 'all', '--selftest'];
// `--selftest` is detected ANYWHERE in argv, not just as the first argument.
// `scripts/checks.mjs` builds its command as `[script, ...extra, '--selftest']`,
// so a registration carrying a mode would give this file `all --selftest` — and
// reading only argv[2] would see `all`, run the ordinary checks, pass, and
// report a selftest that never happened. A false green in the one tier whose
// entire job is proving checks can fail (GOTCHAS §27).
const mode = process.argv.includes('--selftest') ? '--selftest' : (process.argv[2] ?? 'felt');
if (!MODES.includes(mode)) {
  console.error(`usage: node scripts/L-blackjack-felt.mjs [${MODES.join('|')}]`);
  process.exit(2);
}

const MUTATIONS = {
  // THE HOLE CARD IS PAINTED FACE UP. Costs the house nothing, moves no money,
  // ruins the game. The reason this file exists.
  'hole-face-up': (S) => {
    const real = S.paintCard;
    S.paintCard = (g, c, x, y, flip, lift) => real(g, c, x, y, flip ?? 1, lift ?? 0);
    const rt = S.paintTable;
    S.paintTable = (g, w, h, v) => rt(g, w, h, {
      ...v, dealer: { ...v.dealer, cards: v.dealer.cards.map((c) => ({ ...c, faceDown: false })) },
    });
  },
  // Suits stop being distinguishable — every card draws a spade.
  'one-suit': (S) => {
    const real = S.paintCard;
    S.paintCard = (g, c, x, y, flip, lift) =>
      real(g, c ? { ...c, s: 0 } : c, x, y, flip ?? 1, lift ?? 0);
  },
  // Ranks stop being distinguishable — every card draws as a two.
  'one-rank': (S) => {
    const real = S.paintCard;
    S.paintCard = (g, c, x, y, flip, lift) =>
      real(g, c ? { ...c, r: 2 } : c, x, y, flip ?? 1, lift ?? 0);
  },
  // The buttons stop asking the rules and light up regardless — the interface
  // disagreeing with the game, which is the fault the whole feature is arranged
  // to prevent.
  'buttons-always-live': (S) => {
    const rt = S.paintTable;
    S.paintTable = (g, w, h, v) => rt(g, w, h, { ...v, moves: ['hit', 'stand', 'double', 'split'] });
  },
  // The face is drawn 1:1 in a corner instead of scaled to fit.
  'no-fit': (S) => { S.FELT.w = 32; S.FELT.h = 26; },
  // THE SHOE STOPS SAYING HOW MANY DECKS.
  //
  // It REMOVES the placard rather than moving RULES.decks, and the difference
  // matters: the check reads its expectation from RULES too, so a mutation that
  // moved the constant would move the expectation with it and sleep. That is
  // exactly the fault I had just fixed in the slots' attract check — a test
  // point taken from the thing under test cannot fail when that thing moves.
  'silent-shoe': (S) => {
    const real = S.paintTable;
    S.paintTable = (g, w, h, v) => real(new Proxy(g, {
      get: (o, k) => (k === 'fillText'
        ? (str, x, y) => { if (!/DECKS/.test(str)) o.fillText(str, x, y); }
        : Reflect.get(o, k)),
      set: (o, k, val) => Reflect.set(o, k, val),
    }), w, h, v);
  },
  // A NaN in a coordinate. Canvas draws NOTHING for one and reports nothing, so
  // a card would simply not appear and no error would say why.
  //
  // Injected through LAYOUT, which the painter reads at call time — NOT by
  // wrapping the exported `paintCard`, because `paintTable` calls the module's
  // own binding and a wrapped export never reaches the felt. That mutation
  // applied, drew a perfect table, and certified as a working check: the sixth
  // time in this feature, and the reason both games publish their tunables.
  nan: (S) => { S.LAYOUT.cardW = NaN; },
};

let S;
try {
  S = { ...await import('../src/proto/ct/blackjack.ts') };
} catch (e) {
  console.error(`ABORTED: could not load ct/blackjack.ts — ${e.message}`);
  process.exit(3);
}

if (process.env.L_BJF_MUTATE) {
  const m = MUTATIONS[process.env.L_BJF_MUTATE];
  if (!m) { console.error(`ABORTED: no mutation "${process.env.L_BJF_MUTATE}"`); process.exit(3); }
  m(S);
  console.log(`  [MUTATED: ${process.env.L_BJF_MUTATE}] — this run is expected to FAIL\n`);
}

if (mode === '--selftest') {
  let slept = 0;
  const names = Object.keys(MUTATIONS);
  for (const name of names) {
    let code = 0, out = '';
    try {
      out = execFileSync(process.execPath, [SELF, 'all'], {
        env: { ...process.env, L_BJF_MUTATE: name }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (e) { code = e.status ?? -1; out = `${e.stdout ?? ''}${e.stderr ?? ''}`; }
    const failed = (out.match(/^FAIL/gm) ?? []).length;
    const caught = code === 1 && failed > 0;        // exit 3 is NOT a catch, GOTCHAS §32
    if (!caught) slept++;
    console.log(`${caught ? 'CAUGHT ' : 'SLEPT  '} ${name.padEnd(20)} exit=${code} fails=${failed}`);
  }
  console.log(slept === 0
    ? `\n  selftest: ${names.length} / ${names.length} CAUGHT. The check can fail.\n`
    : `\n  selftest: ${slept} mutation(s) SLEPT — the check passed a broken felt.\n`);
  process.exit(slept === 0 ? 0 : 2);
}

if (!S.paintTable || !S.paintCard) {
  console.error('ABORTED: ct/blackjack.ts publishes no painter — every verdict below is free.');
  process.exit(3);
}

let bad = 0;
const check = (ok, msg) => { console.log(`${ok ? 'OK  ' : 'FAIL'}  ${msg}`); if (!ok) bad++; };

/** The same recording context `L-slots-glass.mjs` uses: draws nothing, records
 *  everything, and tracks the transform stack so ops exist in both local and
 *  screen space. Recording one and inferring the other is how you end up
 *  asserting against the wrong space. */
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
    clearRect: () => {},
    fillText: (s, x, y) => ops.push({ op: 'fillText', style: g.fillStyle, text: s, x, y, w: 0, h: 0, sx: X(x), sy: Y(y), sw: 0, sh: 0 }),
    save: () => { stack.push({ ...st }); },
    restore: () => { st = stack.pop() ?? st; },
    translate: (x, y) => { st = { ...st, tx: X(x), ty: Y(y) }; },
    scale: (a, b) => { if (a !== b) throw new Error('non-uniform scale'); st = { ...st, s: st.s * a }; },
    beginPath: () => {}, fill: () => {}, clip: () => {},
    arc: (x, y, r) => put('arc', g.fillStyle, x, y, r, r),
    rect: (x, y, w, h) => put('rect', g.fillStyle, x, y, w, h),
  };
  return { g, ops };
};

const num = (n) => Math.round(n * 100) / 100;
const signature = (ops, cx, cy) => ops
  .map((o) => `${o.op}|${o.style}|${o.text ?? ''}|${num(o.x - cx)}|${num(o.y - cy)}|${num(o.w)}|${num(o.h)}`)
  .join(';');

const lcg = (seed) => { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };
const W = 960, H = 768;

console.log('\nSEVENS — the blackjack FELT. Recorded, not screenshotted; GOTCHAS §1.\n');

// ── all 52 cards, and the back ───────────────────────────────────────────────
const SIGS = new Map();
for (let s = 0; s < 4; s++) {
  for (let r = 1; r <= 13; r++) {
    const rec = recorder();
    S.paintCard(rec.g, { r, s }, 100, 100, 1, 0);
    SIGS.set(`${r}/${s}`, signature(rec.ops, 100, 100));
  }
}
const backRec = recorder();
S.paintCard(backRec.g, null, 100, 100, 1, 0);
const BACK_SIG = signature(backRec.ops, 100, 100);

if (mode === 'cards' || mode === 'all') {
  const uniq = new Set(SIGS.values());
  console.log(`  THE DECK\n`);
  console.log(`    52 cards drawn, ${uniq.size} distinct pictures, plus the back\n`);
  check(uniq.size === 52,
    `all 52 cards are visually DISTINCT (${uniq.size}) — a table where you cannot`
    + ' tell a seven of hearts from a seven of spades is not a card game');
  check(!uniq.has(BACK_SIG), 'and none of them looks like the back of a card');

  // Suits and ranks must each carry information on their own, or "distinct"
  // could be satisfied by 52 arbitrary marks. Same rank across suits must
  // differ, and same suit across ranks must differ.
  let suitPairs = 0, rankPairs = 0;
  for (let r = 1; r <= 13; r++) {
    const set = new Set([0, 1, 2, 3].map((s) => SIGS.get(`${r}/${s}`)));
    if (set.size === 4) suitPairs++;
  }
  for (let s = 0; s < 4; s++) {
    const set = new Set(Array.from({ length: 13 }, (_, i) => SIGS.get(`${i + 1}/${s}`)));
    if (set.size === 13) rankPairs++;
  }
  console.log(`    ranks whose four suits all differ   ${suitPairs} of 13`);
  console.log(`    suits whose thirteen ranks all differ ${rankPairs} of 4\n`);
  check(suitPairs === 13, 'the SUIT is legible on every rank — the pips are drawn, not typed');
  check(rankPairs === 4, 'and the RANK is legible in every suit');

  // Red suits red, black suits black. It is the fastest thing the eye reads.
  const redOf = (s) => {
    const rec = recorder();
    S.paintCard(rec.g, { r: 12, s }, 100, 100, 1, 0);
    return rec.ops.some((o) => o.style === '#c8342c');
  };
  const reds = [0, 1, 2, 3].map(redOf);
  console.log(`    hearts and diamonds print red        ${reds[1] && reds[2]}`);
  console.log(`    spades and clubs print black         ${!reds[0] && !reds[3]}\n`);
  check(reds[1] && reds[2] && !reds[0] && !reds[3],
    'hearts and diamonds are red, spades and clubs are not');
}

if (mode === 'felt' || mode === 'all') {
  /**
   * Deal real hands until the table is in a named phase, and hand back that
   * view — so every state below is one the table actually reaches rather than
   * one I hand-built out of what I think its fields mean.
   *
   * IT DEALS AGAIN RATHER THAN GIVING UP, and that is not padding. One deal is
   * not enough to see the PLAYER phase: about one hand in twenty is a natural,
   * which the table resolves straight from `dealing` to `dealer` without ever
   * asking the player anything. The first version dealt once, drew a blackjack
   * on its seed, and aborted with "never reached the player phase" — a check
   * reporting a broken table because it had asked for a hand that does not
   * always exist.
   */
  const at = (phase, rng = lcg(4)) => {
    const tb = S.createTable({ rng });
    tb.buyIn(500_000);
    for (let hand = 0; hand < 200; hand++) {
      if (!tb.deal()) return null;
      for (let i = 0; i < 4000; i++) {
        const v = tb.view();
        if (v.phase === phase) return { tb, v };
        if (v.phase === 'betting' && i) break;         // hand over; deal another
        if (v.phase === 'player' && v.active >= 0 && v.moves.length) {
          const h = v.hands[v.active];
          let m = S.basicStrategy(h.cards.map((c) => c.card), v.dealer.cards[0].card,
            { canDouble: v.moves.includes('double'), canSplit: v.moves.includes('split') });
          if (!v.moves.includes(m)) m = 'stand';
          tb.act(m);
          continue;
        }
        tb.tick(0.1);
      }
    }
    return null;
  };

  // ── THE HOLE CARD ─────────────────────────────────────────────────────────
  console.log('  THE HOLE CARD\n');
  const during = at('player');
  if (!during) { console.error('ABORTED: never reached the player phase.'); process.exit(3); }
  const rec = recorder();
  S.paintTable(rec.g, W, H, during.v);
  const hole = during.v.dealer.cards[1];
  const holeSig = SIGS.get(`${hole.card.r}/${hole.card.s}`);
  const upSig = SIGS.get(`${during.v.dealer.cards[0].card.r}/${during.v.dealer.cards[0].card.s}`);

  // Is the hole card's FACE anywhere on the table?
  //
  // Asked by the two marks that separate a back from a face, both derived from
  // `paintCard` rather than probed for: a face prints its RANK at a known
  // offset and fills its body in the card cream; a back prints no text at all
  // and fills in the house red. A signature comparison over a neighbourhood
  // cannot do this — cards overlap by more than the distance to their own
  // glyph, so no radius separates a card from the one beside it.
  const near = (ops, cx, cy, rad = 20) => ops.filter((o) =>
    Math.abs(o.x - cx) < rad && Math.abs(o.y - cy) < rad);
  const dx = S.LAYOUT.dealer.x + S.LAYOUT.overlap / 2, dy = S.LAYOUT.dealer.y;
  const gx = dx - S.LAYOUT.cardW / 2 + 2, gy = dy - S.LAYOUT.cardH / 2 + 9;
  const faceGlyph = rec.ops.find((o) => o.op === 'fillText'
    && Math.abs(o.x - gx) < 0.6 && Math.abs(o.y - gy) < 0.6);
  const backFill = rec.ops.some((o) => o.op === 'fillRect' && o.style === '#7a2430'
    && Math.abs(o.x - (dx - S.LAYOUT.cardW / 2 + 1)) < 0.6);
  const drawnFace = !!faceGlyph;
  const drawnBack = backFill && !faceGlyph;
  void holeSig;
  console.log(`    dealer shows ${S.RANKS[during.v.dealer.cards[0].card.r]}${S.SUITS[during.v.dealer.cards[0].card.s]}`
    + `, hole is ${S.RANKS[hole.card.r]}${S.SUITS[hole.card.s]}`);
  console.log(`    the second slot draws: ${drawnBack ? 'THE BACK' : drawnFace ? 'ITS FACE' : 'something else'}\n`);
  check(hole.faceDown, 'the table says the hole card is face down — the population for this verdict');
  check(drawnBack && !drawnFace,
    'and the felt draws its BACK, never its face. Showing it costs the house nothing,'
    + ' moves no money and ruins the game, so this is the only check that can see it');
  check(during.v.dealer.value.total === S.cardValue(during.v.dealer.cards[0].card.r)
    || (during.v.dealer.cards[0].card.r === 1 && during.v.dealer.value.total === 11),
    'and the dealer total shown counts only the upcard');
  void upSig;

  // …and it TURNS. Sampled across the turn rather than at one instant: the flip
  // is 0.5 s long and a single sample proves nothing about an animation
  // (GOTCHAS §48 — sample inside the shape, not at its edge).
  const turning = at('dealer');
  if (turning) {
    const widths = [];
    for (let k = 0; k <= 10; k++) {
      const v = { ...turning.v, t: turning.v.holeTurnT + (k / 10) * S.PACE.holeTurn };
      const r2 = recorder();
      S.paintTable(r2.g, W, H, v);
      const cell = near(r2.ops, dx, dy, 24).filter((o) => o.op === 'fillRect' && o.h === S.LAYOUT.cardH);
      widths.push(cell.length ? Math.max(...cell.map((o) => o.w)) : 0);
    }
    const narrowest = Math.min(...widths);
    console.log(`    across the turn the card is ${widths.map((w) => w.toFixed(0)).join(' ')} wide\n`);
    check(narrowest < S.LAYOUT.cardW * 0.35,
      `it TURNS rather than swapping — squashed to ${narrowest.toFixed(1)} px of`
      + ` ${S.LAYOUT.cardW} at the midpoint, which is a card standing on its edge`);
    check(widths[0] > S.LAYOUT.cardW * 0.8 && widths[10] > S.LAYOUT.cardW * 0.8,
      'and it is full width at both ends of the turn');
  }

  // ── every card on the felt is the card the table dealt ─────────────────────
  console.log('  EVERY CARD ON THE FELT IS THE CARD THE TABLE DEALT\n');
  let cells = 0, right = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const st = at('settle', lcg(seed * 7717));
    if (!st) continue;
    const v = { ...st.v, t: st.v.t + 5 };            // everything landed, nothing mid-flight
    const r3 = recorder();
    S.paintTable(r3.g, W, H, v);
    const check1 = (hand, cx, cy) => {
      const span = (hand.cards.length - 1) * S.LAYOUT.overlap;
      hand.cards.forEach((p, i) => {
        const x = cx - span / 2 + i * S.LAYOUT.overlap;
        cells++;
        // LOOKED UP AT ITS EXACT PLACE, not searched for in a neighbourhood.
        //
        // Cards overlap by 15 px and the rank is printed 11 px left of a card's
        // centre, so ANY radius wide enough to reach a card's own glyph also
        // reaches the next card's — there is no neighbourhood that separates
        // them. The first version searched within half the overlap and matched
        // nothing at all, which read as 221 wrong cards on a felt that was
        // drawing them correctly.
        //
        // The position is not a mystery: `paintCard` prints at
        // `left + 2, top + 9`, so for a card centred at (x, cy) the glyph is at
        // (x - cardW/2 + 2, cy - cardH/2 + 9). Deriving it from LAYOUT rather
        // than probing for it is the same rule as aiming a walk from the source
        // (GOTCHAS §20).
        const gx = x - S.LAYOUT.cardW / 2 + 2, gy2 = cy - S.LAYOUT.cardH / 2 + 9;
        const glyph = r3.ops.find((o) => o.op === 'fillText'
          && Math.abs(o.x - gx) < 0.6 && Math.abs(o.y - gy2) < 0.6);
        const wantR = p.faceDown ? null : S.RANKS[p.card.r];
        if ((glyph?.text ?? null) === wantR) right++;
      });
    };
    check1(v.dealer, S.LAYOUT.dealer.x, S.LAYOUT.dealer.y);
    v.hands.forEach((hand, i) => {
      const hx = v.hands.length > 1 ? S.LAYOUT.player.x + (i === 0 ? -68 : 68) : S.LAYOUT.player.x;
      check1(hand, hx, S.LAYOUT.player.y);
    });
  }
  console.log(`    ${right} of ${cells} card slots draw the rank the table dealt there\n`);
  check(cells >= 150, `there are ${cells} card slots across 40 settled hands to check`
    + ' — every verdict here is free at zero (GOTCHAS §34)');
  check(right === cells, 'the felt shows the hand the table is holding, card for card');

  // ── the buttons are the RULES speaking ────────────────────────────────────
  console.log('  THE BUTTONS OFFER WHAT THE RULES ALLOW\n');
  let btnCells = 0, btnRight = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const st = at('player', lcg(seed * 131));
    if (!st) continue;
    const r4 = recorder();
    S.paintTable(r4.g, W, H, st.v);
    const live = new Set(['HIT', 'STAND', 'DOUBLE', 'SPLIT'].filter((label) => {
      const t = r4.ops.find((o) => o.op === 'fillText' && o.text === label);
      return t && t.style === '#2a2018';                // the live button's ink
    }));
    for (const m of ['hit', 'stand', 'double', 'split']) {
      btnCells++;
      if (live.has(m.toUpperCase()) === st.v.moves.includes(m)) btnRight++;
    }
  }
  console.log(`    ${btnRight} of ${btnCells} buttons match the table's own move list\n`);
  check(btnCells >= 160, `there are ${btnCells} button states to check`);
  check(btnRight === btnCells,
    'every button is live exactly when the RULES allow it — a button the painter'
    + ' lights and `act` refuses is the interface disagreeing with the game');

  // ── the ordinary hygiene ──────────────────────────────────────────────────
  const states = ['betting', 'dealing', 'player', 'dealer', 'settle']
    .map((ph) => [ph, at(ph, lcg(11))]).filter(([, x]) => x);
  let nan = 0, off = 0, total = 0;
  const cardsIn = {};
  console.log('  EVERY PHASE, DRAWN INTO A 960 x 768 PANEL\n');
  for (const [ph, st] of states) {
    const r5 = recorder();
    S.paintTable(r5.g, W, H, st.v);
    total += r5.ops.length;
    // COUNT THE CARDS, not the marks. A raw mark total is a bad population
    // guard here and it very nearly became a false green: adding the betting
    // arc took the total from 403 to 1,844 in one commit, because the arc is
    // ~288 one-pixel rects. The threshold would then have been satisfied by a
    // decoration while the table drew no cards at all. A card body is a
    // `fillRect` exactly `cardH` tall, so they can simply be counted.
    cardsIn[ph] = r5.ops.filter((o) => o.op === 'fillRect' && o.h === S.LAYOUT.cardH).length;
    const b1 = r5.ops.filter((o) => ![o.x, o.y, o.w, o.h, o.sx, o.sy].every(Number.isFinite));
    const b2 = r5.ops.filter((o) => o.op !== 'rect'
      && (o.sx < -1 || o.sy < -1 || o.sx + o.sw > W + 1 || o.sy + o.sh > H + 1));
    nan += b1.length; off += b2.length;
    console.log(`    ${ph.padEnd(10)} ${String(r5.ops.length).padStart(4)} marks`
      + `   ${b1.length} NaN   ${b2.length} off-panel`);
  }
  console.log('');
  console.log(`    card bodies drawn per phase: `
    + Object.entries(cardsIn).map(([k, n]) => `${k} ${n}`).join(', ') + '\n');
  check(total > 300, `the felt is actually drawn — ${total} marks across ${states.length} phases`);
  // Each card is drawn as a shadow, an edge and a body, so four cards on the
  // table is twelve `cardH`-tall rects. The floor is MEASURED off that rather
  // than remembered (GOTCHAS §34) — the dealing phase can legitimately hold
  // fewer, so it is excluded by name rather than by lowering the bar for all.
  for (const ph of ['player', 'dealer', 'settle']) {
    if (cardsIn[ph] === undefined) continue;
    check(cardsIn[ph] >= 8,
      `the ${ph} phase actually draws cards (${cardsIn[ph]} card-sized marks) —`
      + ' a mark TOTAL would be satisfied by the felt pattern alone');
  }
  check(nan === 0, `no coordinate is ever NaN (${nan}) — canvas draws NOTHING for one and says nothing`);
  check(off === 0, `nothing is drawn outside the panel (${off})`);

  {
    const r6 = recorder();
    S.paintTable(r6.g, W, H, states[2][1].v);
    const marks = r6.ops.filter((o) => o.op === 'fillRect' && o.sw > 0 && o.sh > 0);
    const spanY = Math.max(...marks.map((o) => o.sy + o.sh)) - Math.min(...marks.map((o) => o.sy));
    check(spanY > H * 0.9, `it fills the panel it is handed (${spanY.toFixed(0)} of ${H} tall)`);
    const a = recorder(); S.paintTable(a.g, W, H, states[2][1].v);
    const b2 = recorder(); S.paintTable(b2.g, W, H, states[2][1].v);
    check(JSON.stringify(a.ops) === JSON.stringify(b2.ops),
      'the same view paints the same pixels twice — no unseeded grain, which is the'
      + ' only reason this file can check anything (GOTCHAS §1)');
  }

  // The two lines a real table prints, and the dealer's rule derived from RULES
  // rather than typed beside it.
  {
    const r7 = recorder();
    S.paintTable(r7.g, W, H, states[2][1].v);
    const texts = r7.ops.filter((o) => o.op === 'fillText').map((o) => o.text);
    check(texts.includes('BLACKJACK PAYS 3 TO 2'), 'the felt prints what a blackjack pays');
    check(texts.includes(S.dealerRule()),
      `and the dealer's rule, derived from RULES rather than typed beside it: "${S.dealerRule()}"`);
    // "Real cards, real deck, shuffled — and if you shoe it, say how many." He
    // asked for the deck count to be SAID, and it was said in a comment, a
    // commit message and a ledger cell — everywhere except where a player can
    // see it. Six decks and one deck are different games and the difference is
    // invisible from the outside.
    check(texts.includes(`${S.RULES.decks} DECKS`),
      `and the SHOE SAYS HOW MANY DECKS are in it — "${S.RULES.decks} DECKS", on the`
      + ' table, read from RULES so the placard and the shoe cannot disagree');
  }
}

console.log(bad === 0 ? `\n  ${mode}: all checks pass.\n` : `\n  ${mode}: ${bad} FAILED.\n`);
process.exit(bad === 0 ? 0 : 1);
