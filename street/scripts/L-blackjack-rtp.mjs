#!/usr/bin/env node
// THE CLAIM: this blackjack table returns about 99.5% to a player using basic
// strategy, and it does so BECAUSE OF ITS RULES rather than because anybody
// tuned it.
//
// That distinction is the whole reason this file reads differently from
// `L-slots-rtp.mjs`. The slot machine's strips were designed backwards from a
// number I wanted, so its check asserts the number came out where it was aimed.
// Blackjack is a solved game: pick the rules a 1997 table would have, play it
// correctly, and the return is whatever it is. So here the number is a TEST OF
// THE IMPLEMENTATION — 99.5% means the rules and the strategy are both right,
// and 97% means one of them is wrong and I do not get to adjust a pay table
// until it agrees.
//
// The user: "Do not nerf it to match the slots."
//
//   node scripts/L-blackjack-rtp.mjs            the return, and where it comes from
//   node scripts/L-blackjack-rtp.mjs strategy   playing worse must pay worse
//   node scripts/L-blackjack-rtp.mjs all
//   node scripts/L-blackjack-rtp.mjs --selftest break the table six ways
//
// Exit codes are the house convention (GOTCHAS §32): 0 fine, 1 wrong, 2 usage,
// 3 nothing measured.

import { execFileSync } from 'node:child_process';
import { register } from 'node:module';
import { fileURLToPath } from 'node:url';

const SELF = fileURLToPath(import.meta.url);
register('./lib/L-ts-imports.mjs', import.meta.url);

const MODES = ['rtp', 'strategy', 'all', '--selftest'];
// `--selftest` is detected ANYWHERE in argv, not just as the first argument.
// `scripts/checks.mjs` builds its command as `[script, ...extra, '--selftest']`,
// so a registration carrying a mode would give this file `all --selftest` — and
// reading only argv[2] would see `all`, run the ordinary checks, pass, and
// report a selftest that never happened. A false green in the one tier whose
// entire job is proving checks can fail (GOTCHAS §27).
const mode = process.argv.includes('--selftest') ? '--selftest' : (process.argv[2] ?? 'rtp');
if (!MODES.includes(mode)) {
  console.error(`usage: node scripts/L-blackjack-rtp.mjs [${MODES.join('|')}]`);
  process.exit(2);
}

// ── the band ─────────────────────────────────────────────────────────────────
//
// Six decks, stand on all 17, 3:2, double any two and after a split, split once,
// no surrender, no insurance. The published house edge for that rule set is
// 0.5–0.6%, so the band is not a guess and it is not mine — it is what these
// rules are worth to anyone who looks them up. A run outside it means the table
// I built is not the table I documented.
const RTP_MIN = 0.990, RTP_MAX = 0.998;
const HANDS = 2_000_000;

const MUTATIONS = {
  // 6:5 blackjack — the swindle that arrived in the 2000s. It costs the player
  // about 1.4%, which is nearly three times this table's whole edge, and it is
  // exactly the change somebody would make without thinking it mattered.
  'six-five': (S) => { S.RULES.blackjackPays = 1.2; },
  // Blackjack pays even money. Worse again, and it should be loud.
  'even-money': (S) => { S.RULES.blackjackPays = 1.0; },
  // The dealer hits soft 17. A real rule at real tables, worth about 0.2% —
  // small, deliberate, and the check has to be sharp enough to see it.
  'h17': (S) => { S.RULES.hitsSoft17 = true; },
  // The dealer draws to 18. Wildly wrong in the player's favour, which is the
  // direction nobody reports.
  'dealer-18': (S) => { S.RULES.standOn = 18; },
  // A hand's aces ALL count eleven where they fit. The classic value() bug.
  //
  // It cannot be injected into `playRound`, which closes over the real `value` —
  // so it is caught by asserting `value()` DIRECTLY against a table of known
  // hands instead, which is a better check than a mutation anyway: it says what
  // a hand is worth rather than only that something changed.
  'double-ace': (S) => {
    S.value = (cards) => {
      let t = 0, a = 0;
      for (const c of cards) { t += S.cardValue(c.r); if (c.r === 1) a++; }
      for (let i = 0; i < a; i++) if (t + 10 <= 21) t += 10;
      return { total: t, soft: a > 0, bust: t > 21 };
    };
  },
  // The shoe is not shuffled. Every round deals the same cards in the same
  // order — a table you could beat by remembering one sequence.
  unshuffled: (S) => {
    const real = S.makeShoe;
    S.makeShoe = (rng, decks) => real(() => 0.5, decks);
  },
};

let S;
try {
  S = { ...await import('../src/proto/ct/blackjack.ts') };
} catch (e) {
  console.error(`ABORTED: could not load ct/blackjack.ts — ${e.message}`);
  process.exit(3);
}

if (process.env.L_BJ_MUTATE) {
  const m = MUTATIONS[process.env.L_BJ_MUTATE];
  if (!m) { console.error(`ABORTED: no mutation "${process.env.L_BJ_MUTATE}"`); process.exit(3); }
  m(S);
  console.log(`  [MUTATED: ${process.env.L_BJ_MUTATE}] — this run is expected to FAIL\n`);
}

if (mode === '--selftest') {
  let slept = 0;
  const names = Object.keys(MUTATIONS);
  for (const name of names) {
    let code = 0, out = '';
    try {
      out = execFileSync(process.execPath, [SELF, 'all'], {
        env: { ...process.env, L_BJ_MUTATE: name }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (e) { code = e.status ?? -1; out = `${e.stdout ?? ''}${e.stderr ?? ''}`; }
    const failed = (out.match(/^FAIL/gm) ?? []).length;
    const caught = code === 1 && failed > 0;         // exit 3 is NOT a catch, GOTCHAS §32
    if (!caught) slept++;
    console.log(`${caught ? 'CAUGHT ' : 'SLEPT  '} ${name.padEnd(12)} exit=${code} fails=${failed}`);
  }
  console.log(slept === 0
    ? `\n  selftest: ${names.length} / ${names.length} CAUGHT. The check can fail.\n`
    : `\n  selftest: ${slept} mutation(s) SLEPT — the check passed a broken table.\n`);
  process.exit(slept === 0 ? 0 : 2);
}

// GOTCHAS §34: assert the population before anything that is free over an empty
// one. A strategy table with no entries would play every hand as a hit and
// still produce a number.
if (!S.playRound || !S.basicStrategy || !S.makeShoe) {
  console.error('ABORTED: ct/blackjack.ts publishes no game — every verdict below is free.');
  process.exit(3);
}

let bad = 0;
const check = (ok, msg) => { console.log(`${ok ? 'OK  ' : 'FAIL'}  ${msg}`); if (!ok) bad++; };
const pct = (x) => `${(x * 100).toFixed(3)}%`;
const lcg = (seed) => { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };

/**
 * Deal `n` hands and report the return.
 *
 * PER INITIAL BET, which is the figure "99.5% RTP" always means and is not the
 * same as per dollar wagered — doubles and splits put more money on the table,
 * and at advantageous moments, so the two differ by about a tenth of a point.
 * Both are printed, because GOTCHAS §29's lesson is that a number gets quoted
 * and its caveat does not: say which one you mean in the sentence with the
 * number.
 */
const run = (n, rng, strategy) => {
  const shoe = S.makeShoe(rng);
  let net = 0, wagered = 0, hands = 0, naturals = 0, dealerNaturals = 0, splits = 0;
  for (let i = 0; i < n; i++) {
    // The cut card is checked BETWEEN rounds, never inside one.
    if (shoe.remaining() <= 12) shoe.shuffle();
    const r = S.playRound(shoe, strategy);
    net += r.net; wagered += r.wagered; hands++;
    if (r.playerBlackjack) naturals++;
    if (r.dealerBlackjack) dealerNaturals++;
    if (r.hands > 1) splits++;
  }
  return {
    hands, net, wagered,
    perBet: 1 + net / hands,
    perWagered: 1 + net / wagered,
    naturals, dealerNaturals, splits,
  };
};

console.log(`\nSEVENS — blackjack. ${S.RULES.decks} decks, ${S.dealerRule().toLowerCase()},`
  + ` blackjack pays ${S.RULES.blackjackPays === 1.5 ? '3:2' : `${S.RULES.blackjackPays}:1`}.\n`);

// ── what a hand is WORTH ─────────────────────────────────────────────────────
//
// Asserted directly, before anything that plays a hand. Every verdict below
// rests on this and none of them names it: a valuation bug shows up as a
// slightly wrong RTP, which reads as a tuning problem rather than as arithmetic.
// The ace rule is the whole of the difficulty and it is one line of the file.
{
  const C = (r) => ({ r, s: 0 });
  const cases = [
    [[1, 13], 21, true, 'ace and a king is a soft 21'],
    [[1, 1], 12, true, 'two aces are 12, not 22 — only ONE can be eleven'],
    [[1, 1, 9], 21, true, 'and a nine makes 21'],
    [[1, 1, 1, 8], 21, true, 'three aces and an eight, still 21'],
    [[1, 9, 5], 15, false, 'an ace demoted by a bust is a HARD 15'],
    [[13, 12, 11], 30, false, 'three faces are thirty and a bust'],
    [[10, 10], 20, false, 'ten and ten is a hard 20'],
    [[1, 6], 17, true, 'ace-six is a soft 17'],
  ];
  let vbad = 0;
  for (const [rs, total, soft, why] of cases) {
    const v = S.value(rs.map(C));
    if (v.total !== total || v.soft !== soft) {
      console.log(`FAIL  ${why} — got ${v.total}${v.soft ? ' soft' : ' hard'}`);
      vbad++;
    }
  }
  if (vbad === 0) console.log(`OK    ${cases.length} known hands value correctly, ace rule included`);
  else bad += vbad;
}

// ── the dealer plays the rule it PRINTS ──────────────────────────────────────
//
// Asserted behaviourally rather than left to the RTP band, and that is a
// judgement worth recording. Hitting soft 17 is a REAL rule at real tables; it
// costs the player about 0.2%, so a table that quietly switched to it would
// still land inside the 99.0–99.8% band and the return would look fine. The
// `h17` mutation slept on exactly that.
//
// The fix is not to tighten the band until 0.2% shows — that would make the
// check brittle against ordinary sampling noise and is precisely the kind of
// tolerance-by-argument GOTCHAS §27 warns about. It is to assert the rule
// itself, on every total the dealer can hold, against the line the felt prints.
{
  const V = (total, soft) => ({ total, soft, bust: total > 21 });
  let dbad = 0;
  for (let t = 4; t <= 21; t++) {
    for (const soft of [false, true]) {
      if (soft && t < 12) continue;                  // a soft total is at least 12
      const want = t < S.RULES.standOn || (S.RULES.hitsSoft17 && t === S.RULES.standOn && soft);
      if (S.dealerDraws(V(t, soft)) !== want) dbad++;
    }
  }
  check(dbad === 0, 'the dealer draws and stands correctly on every total it can hold');
  check(S.dealerDraws(V(16, false)) && !S.dealerDraws(V(17, false)) && !S.dealerDraws(V(17, true)),
    `it STANDS ON SOFT 17 — the player-friendly rule the user named, worth ~0.2%,`
    + ' and small enough to hide inside the RTP band if nobody asserts it');
  check(S.dealerRule() === 'DEALER MUST DRAW TO 16 AND STAND ON ALL 17',
    `and the line the felt prints says so: "${S.dealerRule()}"`);
}

const r = run(HANDS, lcg(0xB1ACC), S.basicStrategy);

if (mode === 'rtp' || mode === 'all') {
  console.log(`  ${r.hands.toLocaleString()} hands, played by the book\n`);
  console.log(`    return per INITIAL BET     ${pct(r.perBet)}`);
  console.log(`    house edge                 ${pct(1 - r.perBet)}`);
  console.log(`    return per dollar WAGERED  ${pct(r.perWagered)}   (doubles and splits`
    + ' put more on the table, and at good moments)');
  console.log(`    player naturals            ${pct(r.naturals / r.hands)}`);
  console.log(`    dealer naturals            ${pct(r.dealerNaturals / r.hands)}`);
  console.log(`    hands that were split      ${pct(r.splits / r.hands)}\n`);

  check(r.perBet >= RTP_MIN && r.perBet <= RTP_MAX,
    `${pct(r.perBet)} to the player, inside the ${pct(RTP_MIN)}–${pct(RTP_MAX)} these RULES are worth`
    + ' — the number is a test of the implementation, not a dial');

  // A natural is 2 x (16/52-ish) x (4/13-ish); the textbook figure for a shoe is
  // 4.75%, and both sides get it. Getting this wrong is the single likeliest way
  // to be dealing something that is not blackjack.
  check(Math.abs(r.naturals / r.hands - 0.0475) < 0.004,
    `naturals come up ${pct(r.naturals / r.hands)} of the time against a textbook 4.75%`
    + ' — the shoe really is 6 decks of 52');
  check(Math.abs(r.naturals / r.hands - r.dealerNaturals / r.hands) < 0.004,
    'and the dealer gets them just as often — nothing is dealing off the top for either side');

  // The gap to the slot machine is the reason the room has both games, so it is
  // asserted rather than left as a remark.
  check(r.perBet - 0.92834 > 0.05,
    `it returns ${pct(r.perBet - 0.92834)} MORE than the slot machine's 92.834%`
    + ' — "that difference is why a casino floor has both"');
}

if (mode === 'strategy' || mode === 'all') {
  // PLAYING WORSE MUST PAY WORSE.
  //
  // Without this the RTP verdict is nearly free: a strategy table that is never
  // consulted, or one full of nonsense, would still produce a plausible-looking
  // number somewhere in the nineties, because blackjack is a close game however
  // badly you play it. The only way to know the table is doing work is to take
  // it away and watch the return fall.
  const worse = {
    'never doubles': (h, u, o) => {
      const m = S.basicStrategy(h, u, o);
      return m === 'double' ? (S.value(h).soft && S.value(h).total >= 18 ? 'stand' : 'hit') : m;
    },
    'never splits': (h, u, o) => {
      const m = S.basicStrategy(h, u, { ...o, canSplit: false });
      return m;
    },
    'mimics the dealer': (h) => (S.value(h).total < 17 ? 'hit' : 'stand'),
    'always stands on 12+': (h) => (S.value(h).total < 12 ? 'hit' : 'stand'),
  };
  console.log('  PLAYING IT WORSE, on the same shoe and the same seed\n');
  console.log(`    by the book            ${pct(r.perBet)}`);
  const results = {};
  for (const [name, fn] of Object.entries(worse)) {
    const w = run(HANDS / 4, lcg(0xB1ACC), fn);
    results[name] = w.perBet;
    console.log(`    ${name.padEnd(22)} ${pct(w.perBet)}   ${((w.perBet - r.perBet) * 100).toFixed(2)} pts`);
  }
  console.log('');
  for (const [name, v] of Object.entries(results)) {
    check(v < r.perBet - 0.002,
      `${name}: ${pct(v)}, worse than the book by ${((r.perBet - v) * 100).toFixed(2)} points`);
  }
  check(results['mimics the dealer'] < 0.95,
    `mimicking the dealer costs ${((r.perBet - results['mimics the dealer']) * 100).toFixed(1)} points`
    + ' — the classic worst "sensible" strategy, and the table has to be able to show it');
}

console.log(bad === 0
  ? `\n  ${mode}: all checks pass. ${pct(r.perBet)} to the player.\n`
  : `\n  ${mode}: ${bad} FAILED.\n`);
process.exit(bad === 0 ? 0 : 1);
