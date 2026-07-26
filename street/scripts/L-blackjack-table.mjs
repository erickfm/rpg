#!/usr/bin/env node
// THE CLAIM: the table you SIT AT plays the same game that was costed.
//
// `ct/blackjack.ts` has two implementations of one set of rules, and it has to:
// `playRound` resolves a whole hand in one call, which is what an RTP proof
// needs and is useless to a player, and `createTable` deals the same hand a card
// at a time with the decisions handed back. Every rule that is a FACT — what a
// hand is worth, when the dealer draws, what a blackjack pays — is shared. What
// cannot be shared is the FLOW: who draws when, and who beats whom at the end.
//
// That is the two-authorings fault this project keeps paying for, in its most
// expensive form: the table could settle a push as a loss, or let you double on
// three cards, and `L-blackjack-rtp.mjs` would go on reporting 99.546% about the
// OTHER implementation for ever. Nothing in a screenshot would show it and no
// amount of playing would prove it either — a fraction of a percent is invisible
// to a person.
//
// So it is closed by measurement. A basic-strategy player is sat at the real
// table, driven entirely through its public API — `deal`, `view`, `act`, `tick`
// — for a million hands, and the return has to match `playRound`'s to within
// sampling error. If the interface plays a different game, the two numbers
// separate.
//
//   node scripts/L-blackjack-table.mjs            the table agrees with the proof
//   node scripts/L-blackjack-table.mjs rules      the fiddly rules, one at a time
//   node scripts/L-blackjack-table.mjs all
//   node scripts/L-blackjack-table.mjs --selftest break the table seven ways
//
// Exit codes are the house convention (GOTCHAS §32): 0 fine, 1 wrong, 2 usage,
// 3 nothing measured.

import { execFileSync } from 'node:child_process';
import { register } from 'node:module';
import { fileURLToPath } from 'node:url';

const SELF = fileURLToPath(import.meta.url);
register('./lib/L-ts-imports.mjs', import.meta.url);

const MODES = ['agree', 'rules', 'all', '--selftest'];
// `--selftest` is detected ANYWHERE in argv, not just as the first argument.
// `scripts/checks.mjs` builds its command as `[script, ...extra, '--selftest']`,
// so a registration carrying a mode would give this file `all --selftest` — and
// reading only argv[2] would see `all`, run the ordinary checks, pass, and
// report a selftest that never happened. A false green in the one tier whose
// entire job is proving checks can fail (GOTCHAS §27).
const mode = process.argv.includes('--selftest') ? '--selftest' : (process.argv[2] ?? 'agree');
if (!MODES.includes(mode)) {
  console.error(`usage: node scripts/L-blackjack-table.mjs [${MODES.join('|')}]`);
  process.exit(2);
}

const HANDS = 300_000;
/** Both figures are means over the same number of hands from the same rules, so
 *  the gap is pure sampling. A blackjack hand's standard deviation is about
 *  1.14 units, so over 300,000 hands the error on each mean is ~0.21% and on
 *  their difference ~0.29%. 0.5% is a shade under two sigma — tight enough to
 *  catch any real rule divergence (the smallest one that matters, hitting soft
 *  17, is worth 0.2% and shows up as a consistent bias, not as noise) and loose
 *  enough not to go red on a Tuesday. Measured, not picked. */
const AGREE_TOL = 0.005;

// Every mutation here is injected by WRAPPING THE TABLE'S OWN API — the same
// seam a panel drives it through — so what goes red is what a player would
// actually experience. `createTable` closes over its own bindings, so patching
// an export would not reach it: five mutations slept exactly that way in
// `L-blackjack-rtp.mjs` before its rules moved into a table the game reads
// through, and I am not paying for that lesson a sixth time.
//
// Three mutations I first wrote are GONE rather than left in looking useful —
// `dealer-always-draws` and `no-reshuffle` could not be injected through this
// seam at all, and would have sat in the list as two permanently-sleeping
// entries that nothing could fix. A mutation that cannot break the thing is
// worse than no mutation, because it reads as coverage.
const MUTATIONS = {
  // A push settled as a loss. It costs the house nothing in chips, so ONLY a
  // check that reads the view can see it.
  'push-loses': (v) => ({
    ...v, hands: v.hands.map((h) => (h.outcome === 'push' ? { ...h, outcome: 'lose' } : h)),
  }),
  // The table pays a natural even money while `playRound` pays 3:2 — the two
  // implementations disagreeing, which is the whole point of this file.
  'natural-pays-evens': (v) => ({
    ...v, hands: v.hands.map((h) => (h.outcome === 'blackjack' ? { ...h, outcome: 'win' } : h)),
  }),
  // The dealer's hole card counts toward the total the player is shown. The
  // classic interface lie, and again it moves no money.
  'hole-shows': (v, S) => ({
    ...v, dealer: { ...v.dealer, value: S.value(v.dealer.cards.map((c) => c.card)) },
  }),
  // Doubling offered on three cards.
  'late-double': (v) => (v.phase === 'player' && v.moves.length && !v.moves.includes('double')
    ? { ...v, moves: [...v.moves, 'double'] } : v),
  // Split aces offered another card, which is worth real money and is a rule
  // people genuinely forget.
  'hit-split-aces': (v) => (v.phase === 'player' && v.hands.length > 1 && !v.moves.length
    ? { ...v, moves: ['hit', 'stand'] } : v),
  // Splitting never offered. Catches the agree check AND the population guard.
  'no-split': (v) => ({ ...v, moves: v.moves.filter((m) => m !== 'split') }),
  // Doubling never offered. Worth 1.75 points, so the two implementations
  // separate by more than three times the tolerance.
  'no-double': (v) => ({ ...v, moves: v.moves.filter((m) => m !== 'double') }),
};

let S;
try {
  S = { ...await import('../src/proto/ct/blackjack.ts') };
} catch (e) {
  console.error(`ABORTED: could not load ct/blackjack.ts — ${e.message}`);
  process.exit(3);
}

if (process.env.L_BJT_MUTATE) {
  const m = MUTATIONS[process.env.L_BJT_MUTATE];
  if (!m) { console.error(`ABORTED: no mutation "${process.env.L_BJT_MUTATE}"`); process.exit(3); }
  const make = S.createTable;
  S.createTable = (opts) => {
    const tb = make(opts);
    return { ...tb, view: () => m(tb.view(), S) };
  };
  console.log(`  [MUTATED: ${process.env.L_BJT_MUTATE}] — this run is expected to FAIL\n`);
}

if (mode === '--selftest') {
  let slept = 0;
  const names = Object.keys(MUTATIONS);
  for (const name of names) {
    let code = 0, out = '';
    try {
      out = execFileSync(process.execPath, [SELF, 'all'], {
        env: { ...process.env, L_BJT_MUTATE: name }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (e) { code = e.status ?? -1; out = `${e.stdout ?? ''}${e.stderr ?? ''}`; }
    const failed = (out.match(/^FAIL/gm) ?? []).length;
    const caught = code === 1 && failed > 0;         // exit 3 is NOT a catch, GOTCHAS §32
    if (!caught) slept++;
    console.log(`${caught ? 'CAUGHT ' : 'SLEPT  '} ${name.padEnd(20)} exit=${code} fails=${failed}`);
  }
  console.log(slept === 0
    ? `\n  selftest: ${names.length} / ${names.length} CAUGHT. The check can fail.\n`
    : `\n  selftest: ${slept} mutation(s) SLEPT — the check passed a broken table.\n`);
  process.exit(slept === 0 ? 0 : 2);
}

if (!S.createTable) {
  console.error('ABORTED: ct/blackjack.ts publishes no table — every verdict below is free.');
  process.exit(3);
}

let bad = 0;
const check = (ok, msg) => { console.log(`${ok ? 'OK  ' : 'FAIL'}  ${msg}`); if (!ok) bad++; };
const pct = (x) => `${(x * 100).toFixed(3)}%`;
const lcg = (seed) => { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };

/**
 * Sit a basic-strategy player at the real table and play one hand, entirely
 * through the API a panel would use.
 *
 * `dt` is a quarter-second because the table is schedule-driven and gives the
 * same answer at any step — the same property the slot machine has, being used
 * rather than merely asserted. A guard counts iterations so a table that stops
 * advancing fails loudly instead of hanging: a check that never returns is
 * worse than one that goes red.
 */
const playHand = (tb, seen) => {
  if (!tb.deal()) return false;
  for (let guard = 0; guard < 4000; guard++) {
    const v = tb.view();
    if (v.phase === 'betting') return true;
    if (v.phase === 'player' && v.active >= 0 && v.moves.length) {
      const h = v.hands[v.active];
      const cards = h.cards.map((c) => c.card);
      const up = v.dealer.cards[0].card;
      let m = S.basicStrategy(cards, up, {
        canDouble: v.moves.includes('double'),
        canSplit: v.moves.includes('split'),
      });
      if (!v.moves.includes(m)) m = m === 'double' ? 'hit' : m === 'split' ? 'hit' : 'stand';
      if (seen) {
        // Record what the table OFFERED, for the rules block below.
        if (v.moves.includes('double') && cards.length > 2) seen.lateDouble++;
        if (v.hands.length > 1 && cards[0].r === 1 && v.moves.length) seen.aceOffered++;
        const dv = v.dealer.value.total;
        const faceUp = v.dealer.cards.filter((c) => !c.faceDown).length;
        if (faceUp === 1 && dv !== S.cardValue(up.r) && !(up.r === 1 && dv === 11)) seen.holeLeak++;
      }
      // A refused move means the view is offering something the table will not
      // do — which is a real fault and not a reason to spin. Fall back to a move
      // the table cannot refuse, so the hand finishes and the VERDICTS report
      // the disagreement rather than the check hanging on it.
      if (!tb.act(m) && !tb.act('stand')) tb.tick(0.25);
      continue;
    }
    tb.tick(0.25);
  }
  // A check that dies has no result. GOTCHAS §32's spirit: report it as a
  // verdict rather than throwing, so the run still says what else it found.
  stalled++;
  return true;
};
let stalled = 0;

const runTable = (n, rng, seen) => {
  const tb = S.createTable({ rng });
  // Buy in far above any stake so "can I afford to double" never binds — that
  // is a bankroll effect, not a rule, and `playRound` has no bankroll at all.
  // Comparing the two with it in play would be GOTCHAS §29's fault: two numbers
  // quoted the same way that are not the same measurement.
  tb.buyIn(50_000_000);
  const start = tb.view().chips;
  for (let i = 0; i < n; i++) playHand(tb, seen);
  const v = tb.view();
  return { perBet: 1 + (v.chips - start) / n, staked: v.staked, returned: v.returned, chips: v.chips };
};

const runProof = (n, rng) => {
  const shoe = S.makeShoe(rng);
  let net = 0;
  for (let i = 0; i < n; i++) {
    if (shoe.remaining() <= 12) shoe.shuffle();
    net += S.playRound(shoe).net;
  }
  return { perBet: 1 + net / n };
};

console.log('\nSEVENS — the blackjack TABLE, played through the API a panel uses.\n');

if (mode === 'agree' || mode === 'all') {
  const seen = { lateDouble: 0, aceOffered: 0, holeLeak: 0 };
  const table = runTable(HANDS, lcg(0x7AB1E), seen);
  const proof = runProof(HANDS, lcg(0x9F0F));
  console.log(`  ${HANDS.toLocaleString()} hands each, basic strategy both sides\n`);
  console.log(`    dealt one card at a time (the table)   ${pct(table.perBet)}`);
  console.log(`    resolved in one call (the proof)       ${pct(proof.perBet)}`);
  console.log(`    apart                                  ${pct(Math.abs(table.perBet - proof.perBet))}`
    + `   tolerance ${pct(AGREE_TOL)}\n`);

  check(Math.abs(table.perBet - proof.perBet) < AGREE_TOL,
    'the table you SIT AT returns what the table that was COSTED returns'
    + ' — two implementations, one game');
  check(table.perBet > 0.98 && table.perBet < 1.005,
    `and it is blackjack rather than something else: ${pct(table.perBet)} to the player`);
  check(table.staked > HANDS, `it really staked ${table.staked.toLocaleString()} over ${HANDS.toLocaleString()}`
    + ' hands — doubles and splits happened (a table that never offered them would tie'
    + ' on the headline and be a different game)');
  // Set by the driver when a hand never reaches a conclusion. It was recorded
  // and never reported for one revision, which is a check keeping a fact to
  // itself — the exact shape of a verdict that cannot fail.
  check(stalled === 0,
    `every hand reached a conclusion (${stalled} did not) — a table that stops`
    + ' advancing would otherwise show up as a plausible RTP over fewer hands');
}

if (mode === 'rules' || mode === 'all') {
  console.log('  THE FIDDLY RULES, each asked directly\n');
  const seen = { lateDouble: 0, aceOffered: 0, holeLeak: 0 };
  runTable(40_000, lcg(0x5EE), seen);
  console.log(`    doubles offered on 3+ cards      ${seen.lateDouble}`);
  console.log(`    split aces offered another card  ${seen.aceOffered}`);
  console.log(`    hands where the shown dealer total included the hole card   ${seen.holeLeak}\n`);

  check(seen.lateDouble === 0, 'double is offered on the first two cards and never after');
  check(seen.aceOffered === 0,
    'a split ace takes exactly one card — offered nothing further, which is a RULE'
    + ' worth real money and one people genuinely forget');
  check(seen.holeLeak === 0,
    'the total shown for the dealer NEVER includes the hole card — the classic way'
    + ' an interface lies to its player, and it costs the house nothing so only'
    + ' a check that reads the view can see it');

  // Naturals, splits and pushes have to actually OCCUR, or three of the verdicts
  // above are free (GOTCHAS §34).
  let bj = 0, bjWrong = 0, splits = 0, pushes = 0, doubles = 0, dealerBust = 0;
  // Outcomes have to be WATCHED as they settle rather than sampled at the end:
  // the table clears its hands when it pays, which is correct and means the
  // result exists only for the moment it is on the felt.
  const tb2 = S.createTable({ rng: lcg(0xC0FFEE) });
  tb2.buyIn(1_000_000);
  for (let i = 0; i < 20_000; i++) {
    if (!tb2.deal()) break;
    let last = null;
    for (let g = 0; g < 4000; g++) {
      const v = tb2.view();
      if (v.phase === 'betting' && last) break;
      if (v.phase === 'settle' || v.phase === 'paying') last = v;
      if (v.phase === 'player' && v.active >= 0 && v.moves.length) {
        const h = v.hands[v.active];
        let m = S.basicStrategy(h.cards.map((c) => c.card), v.dealer.cards[0].card,
          { canDouble: v.moves.includes('double'), canSplit: v.moves.includes('split') });
        if (!v.moves.includes(m)) m = m === 'double' ? 'hit' : m === 'split' ? 'hit' : 'stand';
        tb2.act(m);
        continue;
      }
      tb2.tick(0.25);
    }
    if (!last) continue;
    if (last.hands.some((h) => h.blackjack)) {
      bj++;
      // A natural has to SETTLE as a natural, not merely be flagged as one.
      // Without this, a table paying blackjack even money keeps its 3:2 label
      // and loses the player half a bet a time — and every other verdict here
      // passes, because the chips are the table's own and nothing compares them.
      if (!last.hands.some((h) => h.blackjack && (h.outcome === 'blackjack' || h.outcome === 'push'))) bjWrong++;
    }
    if (last.hands.length > 1) splits++;
    if (last.hands.some((h) => h.outcome === 'push')) pushes++;
    if (last.hands.some((h) => h.bet > last.bet)) doubles++;
    if (last.dealer.value.bust) dealerBust++;
  }
  console.log(`    in 20,000 hands: ${bj} naturals, ${splits} splits, ${doubles} doubles,`
    + ` ${pushes} pushes, dealer busted ${dealerBust}\n`);
  check(bj > 700, `naturals happen (${bj}) — ~4.75% of 20,000 is 950`);
  check(bjWrong === 0,
    `every natural settles AS a natural (${bjWrong} did not) — a table that quietly`
    + ' pays them even money keeps its 3:2 label and takes half a bet a time');
  check(splits > 200, `splits happen (${splits}) — the split rules above are not free`);
  check(doubles > 1500, `doubles happen (${doubles}) — nor are the double rules`);
  check(pushes > 1200, `pushes happen (${pushes}) — the push-settles-correctly verdict is not free`);
  check(dealerBust > 4000, `the dealer busts (${dealerBust}) — ~28% of hands, as it must`);
  check(stalled === 0, `and no hand stalled (${stalled})`);

  // ── THE RAIL IS WHOLE CHIPS, ALWAYS ───────────────────────────────────────
  //
  // Blackjack pays 3:2, so an odd stake pays a half chip. Twenty hands of
  // playtesting left the rail on 101.5 and cashing that out put 25.375 into a
  // wallet that paints two decimal places. Every stake is even now, but the
  // invariant is what matters, not the constant that currently satisfies it —
  // so it is asserted across a run rather than by reading the BETS array.
  {
    const tb3 = S.createTable({ rng: lcg(0x5A1E) });
    tb3.buyIn(200_000);
    let fractional = 0, sawBJ = 0, sawDouble = 0;
    for (let i = 0; i < 20_000; i++) {
      if (!tb3.deal()) break;
      for (let g = 0; g < 4000; g++) {
        const v = tb3.view();
        if (!Number.isInteger(v.chips)) fractional++;
        if (v.phase === 'betting' && g) break;
        if (v.hands.some((h) => h.blackjack)) sawBJ++;
        if (v.hands.some((h) => h.bet > v.bet)) sawDouble++;
        if (v.phase === 'player' && v.active >= 0 && v.moves.length) {
          const h = v.hands[v.active];
          let m = S.basicStrategy(h.cards.map((c) => c.card), v.dealer.cards[0].card,
            { canDouble: v.moves.includes('double'), canSplit: v.moves.includes('split') });
          if (!v.moves.includes(m)) m = m === 'double' ? 'hit' : m === 'split' ? 'hit' : 'stand';
          tb3.act(m);
          continue;
        }
        tb3.tick(0.25);
      }
    }
    const out = tb3.cashOut();
    console.log(`    20,000 more hands: ${fractional} frames with a fractional rail,`
      + ` cashed out ${out}\n`);
    check(sawBJ > 0 && sawDouble > 0,
      `naturals and doubles both occurred (${sawBJ} / ${sawDouble} frames) — the`
      + ' two payouts that can produce a half chip');
    check(fractional === 0,
      `the rail is a whole number of chips in every frame (${fractional} were not)`
      + ' — 3:2 on an odd stake pays a half chip, and a fractional rail becomes'
      + ' float money in the one wallet');
    check(Number.isInteger(out), `and cashing out hands back a whole number (${out})`);
  }

  // ── THE DEALER DOES NOT PLAY A HAND THAT IS ALREADY OVER ──────────────────
  //
  // On a player natural the peek settles the hand and pays 3:2 before anyone
  // acts, so the dealer must not then deal itself cards. It did — and the money
  // was RIGHT, because settle() skips a hand whose outcome is already set, so
  // the 300,000-hand agreement check could never have seen it. Only watching a
  // hand play out could.
  {
    const tb4 = S.createTable({ rng: lcg(0xBEEF) });
    tb4.buyIn(200_000);
    let naturals = 0, drewAnyway = 0;
    for (let i = 0; i < 20_000 && naturals < 400; i++) {
      if (!tb4.deal()) break;
      let settled = null;
      for (let g = 0; g < 4000; g++) {
        const v = tb4.view();
        if (v.phase === 'betting' && g) break;
        if ((v.phase === 'settle' || v.phase === 'paying') && !settled) settled = v;
        if (v.phase === 'player' && v.active >= 0 && v.moves.length) { tb4.act('stand'); continue; }
        tb4.tick(0.25);
      }
      if (!settled) continue;
      if (settled.hands.some((h) => h.blackjack)) {
        naturals++;
        // The dealer holds two cards at the deal; a third means it played on.
        if (settled.dealer.cards.length > 2) drewAnyway++;
      }
    }
    console.log(`    ${naturals} player naturals watched; the dealer drew on ${drewAnyway}\n`);
    check(naturals >= 100, `${naturals} naturals to check — free at zero (GOTCHAS §34)`);
    check(drewAnyway === 0,
      'the dealer takes no card after a player natural — the hand is already paid,'
      + ' and a dealer that plays on is a table telling the player it might still lose');
  }
}

console.log(bad === 0 ? `\n  ${mode}: all checks pass.\n` : `\n  ${mode}: ${bad} FAILED.\n`);
process.exit(bad === 0 ? 0 : 1);
