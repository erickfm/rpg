// SEVENS — the blackjack table.
//
// ─────────────────────────────────────────────────────────────────────────────
// PART ONE: THE MATHS. As with `ct/slots.ts`, nothing here draws anything or
// touches the world, and the number comes before any of it.
//
// The user: *"i would like a black jack interface. very nice and impressive and
// try hard."* And on the arithmetic specifically:
//
//   "a correctly-implemented blackjack with dealer-stands-on-17 lands around
//    99.5% RTP for perfect play, which is far better for the player than your
//    slot machine and that is CORRECT - that difference is why a casino floor
//    has both. Do not nerf it to match the slots."
//
// So this table is NOT tuned. There is no dial in this file. Blackjack's return
// is a CONSEQUENCE of its rules, not a target you aim at — you choose the rules
// a 1997 neighbourhood table would have and the number falls out. If it comes
// out at 99.5% the rules and the strategy are right; if it comes out at 97% one
// of the two is wrong. That makes the RTP a TEST of this file rather than a
// property of it, which is the exact opposite of the slot machine, where the
// strips were designed backwards from the number I wanted.
//
// It is the same discipline pointed the other way, and it is worth saying out
// loud because "compute the RTP" means two different things in the two files.
//
// ─────────────────────────────────────────────────────────────────────────────
// THE RULES OF THIS TABLE, stated because every one of them moves the number
//
//   · SIX DECKS, dealt from a shoe, reshuffled at the cut card (75% dealt).
//     The user asked for this to be said out loud — "if you shoe it, say how
//     many". Six is what a 1997 floor used; single-deck was already a
//     high-limit curiosity by then.
//   · DEALER STANDS ON ALL 17, soft or hard. The user named this rule, and it
//     is the player-friendly one — hitting soft 17 costs the player about 0.2%.
//   · BLACKJACK PAYS 3:2. Also named. The 6:5 tables that eat 1.4% of the
//     player's return are a 2000s invention and would be an anachronism here as
//     well as a swindle.
//   · DOUBLE ON ANY FIRST TWO CARDS, including after a split.
//   · SPLIT ONCE — up to two hands. No re-splitting.
//   · SPLIT ACES GET ONE CARD EACH, and 21 on a split ace is 21, not blackjack.
//   · NO SURRENDER, and NO INSURANCE. Insurance is a side bet with a house
//     edge of its own that basic strategy never takes; offering it would be
//     authentic and would only ever be a way for the player to lose more.
//   · DEALER PEEKS for blackjack on a ten or an ace, so the player never loses
//     a doubled or split bet to a dealer natural.
//
// Under those rules the house edge against perfect basic strategy is a little
// over half a percent. THE NUMBER THIS FILE COMPUTES IS AT THE FOOT OF PART ONE
// and `scripts/L-blackjack-rtp.mjs` recomputes it from these exact tables.

// The 2D-context slice both games paint through, shared rather than declared
// twice. A TYPE-ONLY import, so it is erased and this file stays loadable by
// node with no bundler — which is what lets three of its four checks run without
// a browser (GOTCHAS §28's cycle fault needs a RUNTIME import to bite).
import type { Paint2D } from './slots';

/** A card is a RANK 1–13. Aces are 1 and count 11 when they can. Suits exist
 *  only for the felt, so they ride along and the maths ignores them. */
export type Rank = number;
export interface Card { readonly r: Rank; readonly s: 0 | 1 | 2 | 3 }

export const SUITS = ['♠', '♥', '♦', '♣'] as const;
export const RANKS = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const;

/**
 * THE HOUSE RULES, as one published table the game reads through.
 *
 * Every number here moves the return, and the felt is going to PRINT most of
 * them — a blackjack table whose rules you cannot see is a worse table, and the
 * user asked specifically that the dealer's rule be visible.
 *
 * It is also exported MUTABLE for the same reason `FEEL` is in `ct/slots.ts`:
 * `scripts/L-blackjack-rtp.mjs` has to be able to break this table and watch the
 * check go red (GOTCHAS §27), and while these were module-private consts the
 * mutations could not reach `playRound`, which closes over its own bindings.
 * Five of six mutations slept on the first run — applied, table broken, check
 * green — which is the fourth time in this feature that a mutation has missed
 * its target the same way. A rule the game reads through is a rule a check can
 * bend.
 */
export const RULES = {
  decks: 6,
  /** reshuffle once this fraction of the shoe is gone: a real table's cut card */
  penetration: 0.75,
  /** 1.5 is 3:2. The 6:5 tables that eat 1.4% of the return are a 2000s
   *  invention and would be an anachronism here as well as a swindle. */
  blackjackPays: 1.5,
  /** the dealer draws below this and stands on it */
  standOn: 17,
  /** …unless it is soft, at tables that hit soft 17. Not this one — the user
   *  named stand-on-all-17, and it is the player-friendly rule, worth ~0.2%. */
  hitsSoft17: false,
  /** two hands, so: split once, no re-splitting */
  maxHands: 2,
  doubleAfterSplit: true,
};

export const DECKS = RULES.decks;
export const PENETRATION = RULES.penetration;

/** What a card is worth. Face cards are ten; an ace is one here and the hand
 *  decides whether it can be eleven. */
export const cardValue = (r: Rank): number => (r > 10 ? 10 : r);

export interface HandValue {
  /** the best total that is not a bust, or the bust total */
  readonly total: number;
  /** is an ace still counting as eleven */
  readonly soft: boolean;
  readonly bust: boolean;
}

/**
 * A hand's value, done the only way that is not fiddly: count every ace as one,
 * then promote ONE of them to eleven if that still fits.
 *
 * Two aces can never both be eleven (22 busts), so a single promotion is the
 * whole of the ace rule and the loop everybody writes is unnecessary.
 */
export function value(cards: readonly Card[]): HandValue {
  let total = 0, aces = 0;
  for (const c of cards) { total += cardValue(c.r); if (c.r === 1) aces++; }
  const soft = aces > 0 && total + 10 <= 21;
  if (soft) total += 10;
  return { total, soft, bust: total > 21 };
}

/** Two cards totalling 21 — and only ever two. A 21 built from three cards, or
 *  on a split ace, is an ordinary 21 and pushes against a natural. */
export const isBlackjack = (cards: readonly Card[]): boolean =>
  cards.length === 2 && value(cards).total === 21;

// ─────────────────────────────────────────────────────────────────────────────
// THE SHOE

export type Rng = () => number;

export interface Shoe {
  draw(): Card;
  /** cards left before the cut card */
  remaining(): number;
  /** true if the shoe was reshuffled since this was last asked */
  needsShuffle(): boolean;
  shuffle(): void;
  readonly size: number;
}

/**
 * Six decks, shuffled by Fisher–Yates with an injected rng.
 *
 * NOT `ct/rng.ts` — GOTCHAS §2, that stream is a single LCG whose DRAW ORDER
 * decides every tree height and pigeon position in the world, and a card game
 * pulling 312 numbers out of it at every shuffle would rearrange the street.
 * `Math.random` at play time, injectable so the proof is reproducible. Same
 * reasoning as the slot machine's, and for the same reason.
 */
export function makeShoe(rng: Rng = Math.random, decks = RULES.decks): Shoe {
  const size = decks * 52;
  const cards: Card[] = [];
  let i = 0, shuffled = true;
  const build = () => {
    cards.length = 0;
    for (let d = 0; d < decks; d++) {
      for (let s = 0; s < 4; s++) for (let r = 1; r <= 13; r++) cards.push({ r, s: s as 0 | 1 | 2 | 3 });
    }
    for (let k = cards.length - 1; k > 0; k--) {
      const j = Math.floor(rng() * (k + 1));
      [cards[k], cards[j]] = [cards[j], cards[k]];
    }
    i = 0; shuffled = true;
  };
  build();
  return {
    size,
    shuffle: build,
    remaining: () => Math.floor(size * RULES.penetration) - i,
    needsShuffle: () => { const was = shuffled; shuffled = false; return was; },
    draw: () => {
      // The cut card is checked BETWEEN ROUNDS by the caller, never mid-hand —
      // a shoe that reshuffles in the middle of a hand would deal the player a
      // card that was already in the discard tray.
      if (i >= cards.length) build();
      return cards[i++];
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// BASIC STRATEGY
//
// The player's side of the maths. It is here rather than in the check for the
// same reason `exactRTP` is in `ct/slots.ts`: the RTP is a property of the game
// PLUS correct play, so correct play is part of the game's own description —
// and the table has a second job the check does not, which is that the felt is
// going to PRINT it. The user asked for the dealer's rule to be visible; the
// player's best move is the same courtesy and it is the difference between a
// blackjack table and a guessing game.
//
// This is the standard 6-deck, dealer-stands-on-17, double-after-split table.
// It is not my invention and it should not be adjusted: it is the solved answer
// to these exact rules, and every deviation from it costs the player money.
// If the computed RTP comes out low, the bug is here or in the dealer, not in
// the pay rules.

export type Move = 'hit' | 'stand' | 'double' | 'split';

/** The dealer's upcard as a strategy column: 2…10 as themselves, ace as 11. */
const upIndex = (up: Card): number => (up.r === 1 ? 11 : cardValue(up.r));

/** Stand ranges for hard totals, by dealer upcard. `hard[t]` lists the upcards
 *  you stand against; anything else you hit. */
const HARD_STAND: Record<number, number[]> = {
  12: [4, 5, 6],
  13: [2, 3, 4, 5, 6], 14: [2, 3, 4, 5, 6], 15: [2, 3, 4, 5, 6], 16: [2, 3, 4, 5, 6],
};
/** Hard doubles: total → the upcards you double against. */
const HARD_DOUBLE: Record<number, number[]> = {
  9: [3, 4, 5, 6],
  10: [2, 3, 4, 5, 6, 7, 8, 9],
  11: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
};
/** Soft doubles: the NON-ace card → upcards you double against. */
const SOFT_DOUBLE: Record<number, number[]> = {
  2: [5, 6], 3: [5, 6], 4: [4, 5, 6], 5: [4, 5, 6], 6: [3, 4, 5, 6], 7: [2, 3, 4, 5, 6],
};
/** Pairs: the card's value → upcards you split against. Aces and eights are
 *  always; tens never — splitting a 20 is the most expensive habit in the game. */
const PAIR_SPLIT: Record<number, number[]> = {
  1: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  2: [2, 3, 4, 5, 6, 7], 3: [2, 3, 4, 5, 6, 7],
  4: [5, 6],
  6: [2, 3, 4, 5, 6], 7: [2, 3, 4, 5, 6, 7],
  8: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  9: [2, 3, 4, 5, 6, 8, 9],
};

/**
 * What a perfect player does. `canDouble` and `canSplit` describe what the
 * table is offering right now, and the strategy falls back the way a real
 * player has to when it cannot double: soft 18 stands, everything else hits.
 */
export function basicStrategy(
  hand: readonly Card[], up: Card,
  opts: { canDouble: boolean; canSplit: boolean },
): Move {
  const u = upIndex(up);
  const v = value(hand);

  if (opts.canSplit && hand.length === 2 && cardValue(hand[0].r) === cardValue(hand[1].r)) {
    // Pair-splitting is keyed on the RANK for aces and on the VALUE otherwise,
    // so a king and a jack are a pair of tens — which they are, and which is a
    // hand you never split.
    const key = hand[0].r === 1 ? 1 : cardValue(hand[0].r);
    if (PAIR_SPLIT[key]?.includes(u)) return 'split';
  }

  if (v.soft) {
    const other = v.total - 11;                       // the non-ace half
    if (v.total >= 19) return 'stand';                // soft 19, 20 — never move
    if (v.total === 18) {
      if (opts.canDouble && SOFT_DOUBLE[7].includes(u)) return 'double';
      return u >= 9 ? 'hit' : 'stand';                // 9, 10, A: hit. 7, 8: stand.
    }
    if (opts.canDouble && SOFT_DOUBLE[other]?.includes(u)) return 'double';
    return 'hit';
  }

  if (opts.canDouble && HARD_DOUBLE[v.total]?.includes(u)) return 'double';
  if (v.total >= 17) return 'stand';
  if (v.total <= 11) return 'hit';
  return HARD_STAND[v.total]?.includes(u) ? 'stand' : 'hit';
}

/** The house's rule, and the whole of it. Read off RULES so the printed line
 *  and the behaviour cannot drift — the user asked for the dealer's rule to be
 *  something the player can SEE, and a rule that is stated in one place and
 *  implemented in another is the two-authorings fault with a sign on it. */
export const dealerRule = (): string =>
  `DEALER MUST DRAW TO ${RULES.standOn - 1} AND ${RULES.hitsSoft17 ? 'HIT' : 'STAND ON'}`
  + ` ${RULES.hitsSoft17 ? 'SOFT' : 'ALL'} ${RULES.standOn}`;
export const dealerDraws = (v: HandValue): boolean =>
  v.total < RULES.standOn || (RULES.hitsSoft17 && v.total === RULES.standOn && v.soft);

// ─────────────────────────────────────────────────────────────────────────────
// A ROUND
//
// Played headless, for the proof. The interactive version in PART TWO drives
// the same rules one decision at a time.


/** What one seat won or lost, in units of the initial bet. */
export interface RoundResult {
  /** net to the player: −1 a loss, +1.5 a natural, 0 a push */
  readonly net: number;
  /** total actually put at risk, which doubles and splits increase */
  readonly wagered: number;
  readonly playerBlackjack: boolean;
  readonly dealerBlackjack: boolean;
  readonly hands: number;
}

/**
 * One round against the dealer, both sides played by the book.
 *
 * `strategy` is injected so a check can play the table BADLY on purpose and
 * watch the return fall — which is the only way to know the number below is
 * measuring the rules rather than measuring itself.
 */
export function playRound(
  shoe: Shoe,
  strategy: (hand: readonly Card[], up: Card, o: { canDouble: boolean; canSplit: boolean }) => Move
    = basicStrategy,
): RoundResult {
  const player: Card[][] = [[shoe.draw(), shoe.draw()]];
  const dealer: Card[] = [shoe.draw(), shoe.draw()];
  const up = dealer[0];
  const bets = [1];
  let wagered = 1;

  const pBJ = isBlackjack(player[0]), dBJ = isBlackjack(dealer);

  // THE PEEK. On a ten or an ace the dealer checks the hole card before anyone
  // acts, so a natural cannot take a doubled or split bet with it.
  if (dBJ || pBJ) {
    const net = pBJ && dBJ ? 0 : pBJ ? RULES.blackjackPays : -1;
    return { net, wagered, playerBlackjack: pBJ, dealerBlackjack: dBJ, hands: 1 };
  }

  let splitAces = false;
  for (let h = 0; h < player.length; h++) {
    for (;;) {
      const hand = player[h];
      if (splitAces && player.length > 1) break;      // split aces get one card, no more
      const v = value(hand);
      if (v.bust || v.total === 21) break;
      const move = strategy(hand, up, {
        canDouble: hand.length === 2 && (player.length === 1 || RULES.doubleAfterSplit),
        // SPLIT ONCE. `player.length < RULES.maxHands` is the whole of it.
        canSplit: hand.length === 2 && player.length < RULES.maxHands,
      });
      if (move === 'stand') break;
      if (move === 'double') { bets[h] *= 2; wagered += 1; hand.push(shoe.draw()); break; }
      if (move === 'split') {
        splitAces = hand[0].r === 1;
        const moved = hand.pop()!;
        player.push([moved, shoe.draw()]);
        bets.push(1); wagered += 1;
        hand.push(shoe.draw());
        continue;
      }
      hand.push(shoe.draw());
    }
  }

  // The dealer only plays if there is something left to beat.
  const alive = player.some((h) => !value(h).bust);
  if (alive) while (dealerDraws(value(dealer))) dealer.push(shoe.draw());
  const dv = value(dealer);

  let net = 0;
  for (let h = 0; h < player.length; h++) {
    const pv = value(player[h]);
    if (pv.bust) { net -= bets[h]; continue; }
    if (dv.bust || pv.total > dv.total) net += bets[h];
    else if (pv.total < dv.total) net -= bets[h];
  }
  return { net, wagered, playerBlackjack: false, dealerBlackjack: false, hands: player.length };
}

// ─────────────────────────────────────────────────────────────────────────────
// THE NUMBER
//
//   house edge         0.454% of every dollar first bet
//   RETURN TO PLAYER   99.546%   (99.599% per dollar actually wagered)
//
//   player naturals    4.748%    against a textbook 4.75%
//   dealer naturals    4.741%    the same, as it must be
//   hands split         2.498%
//
// Measured over 2,000,000 hands. Both return figures are printed because
// GOTCHAS §29's lesson is that a number gets quoted and its caveat does not:
// "99.5% RTP" always means PER INITIAL BET, and per dollar wagered is a
// different and slightly higher number because doubles and splits put more money
// on the table at advantageous moments.
//
// against the slot machine's 92.83%, and the gap is the point. The user:
// "that difference is why a casino floor has both." One room, two games, and
// the one that rewards knowing what you are doing gives back fourteen times
// less of every dollar.
//
// `scripts/L-blackjack-rtp.mjs` computes it from these tables and also plays the
// table four WRONG ways, requiring the return to fall each time:
//
//   by the book            99.546%
//   never doubles          97.795%    -1.75 pts
//   never splits           98.715%    -0.83 pts
//   mimics the dealer      94.202%    -5.34 pts
//   always stands on 12+   92.050%    -7.50 pts
//
// Those four gaps are the real evidence, more than the headline is. A strategy
// table that cannot be beaten by playing worse is a strategy table that is not
// being consulted — and blackjack is a close enough game that a broken
// implementation still lands somewhere in the nineties and looks plausible. All
// four penalties match their published values to a tenth of a point, which is
// not something a wrong strategy table does by accident.

// ─────────────────────────────────────────────────────────────────────────────
// PART TWO: THE TABLE YOU SIT AT.
//
// `playRound` above plays a whole hand in one call, which is what the proof
// needs and is useless to a player: you cannot decide anything, and nothing
// takes any time. This is the same rules dealt one card at a time, advanced by
// a `dt`, with the decisions handed back to whoever is sitting there.
//
// TWO IMPLEMENTATIONS OF ONE GAME IS THE OBVIOUS DANGER HERE, and it is the
// exact two-authorings fault this project keeps paying for. The table below
// could quietly settle a push as a loss, or let you double after three cards,
// and the RTP script would keep reporting 99.546% about the OTHER
// implementation.
//
// Reusing `value`, `isBlackjack`, `dealerDraws` and `RULES` closes most of it —
// every rule that is a fact lives in one place. What it cannot close is the
// FLOW: who draws when, and who beats whom at the end. So that is closed by
// measurement instead. `scripts/L-blackjack-table.mjs` sits a basic-strategy
// player at THIS table, through its own public API, deals it a million hands,
// and requires the return to match `playRound`'s to within sampling error. If
// the interface plays a different game from the one that was costed, the two
// numbers separate and the check goes red.
//
// The user's brief for the feel: "cards dealt one at a time face up except the
// dealer's hole card, hit, stand, double, split if you want to go that far. The
// dealer plays a fixed rule and the player should be able to see what it is."

/** How the table paces itself, in seconds. Published and mutable for the same
 *  reason `FEEL` is in `ct/slots.ts` — a check has to be able to break the
 *  pacing and watch a verdict go red, and while these were private consts the
 *  mutations could not reach the code that reads them. */
export const PACE = {
  /** one card's flight from the shoe to its place */
  deal: 0.26,
  /** between one card landing and the next leaving the shoe */
  gap: 0.20,
  /** the hole card turning over. The user named this one. */
  holeTurn: 0.50,
  /** the dealer's pause before each card it draws for itself. This is the
   *  tension in blackjack and it is worth more than any of the others: a dealer
   *  that resolves instantly is a dealer you never watch. */
  dealerDraw: 0.60,
  /** how long the result sits on screen before the chips move */
  settle: 0.90,
  /** chips a second, once they start moving */
  payRate: 14,
};

export type Phase = 'betting' | 'dealing' | 'player' | 'dealer' | 'settle' | 'paying';
export type Outcome = 'win' | 'lose' | 'push' | 'blackjack' | 'bust' | null;

/** One card on the felt, and when it got there — the painter needs both. */
export interface Placed {
  readonly card: Card;
  /** table time the card left the shoe. The glass animates from this. */
  readonly t0: number;
  readonly faceDown: boolean;
}

export interface HandView {
  readonly cards: readonly Placed[];
  readonly value: HandValue;
  readonly bet: number;
  readonly done: boolean;
  readonly outcome: Outcome;
  readonly blackjack: boolean;
}

export interface TableView {
  readonly phase: Phase;
  /** what the wallet can stake right now, in chips — the bank's balance.
   *  There is no rail: chips never pool at the table (2026-08-10). */
  readonly chips: number;
  readonly bet: number;
  readonly hands: readonly HandView[];
  /** which hand is acting, or −1 */
  readonly active: number;
  readonly dealer: HandView;
  /** table time, for the glass */
  readonly t: number;
  /** when the hole card started turning, or −1 */
  readonly holeTurnT: number;
  /** what the player may do right now, in button order */
  readonly moves: readonly Move[];
  /** what the table is saying */
  readonly says: string;
  /** chips paid so far this settlement — counts up, like the slot's meter */
  readonly paid: number;
  readonly staked: number;
  readonly returned: number;
  readonly shoeLeft: number;
}

export interface Table {
  view(): TableView;
  tick(dt: number): void;
  /** stack another chip on the stake, between hands. Clamped to the bank. */
  betAdd(n: number): void;
  betClear(): void;
  /** deal a round. False if it cannot — no bet, no cash, or a hand going. */
  deal(): boolean;
  act(m: Move): boolean;
  /** fund the DEFAULT bank — the headless checks' way in. The world injects
   *  the wallet as `opts.bank` and never calls this. */
  buyIn(chips: number): void;
  /** leave: pay anything the house still owes straight to the bank and clear
   *  the felt. The wiring calls this whenever the panel closes. */
  flush(): void;
  settled(): boolean;
}

/**
 * WHERE THE MONEY LIVES: nowhere on the table. 2026-08-10, Erick: *"i dont
 * like this cash out buy in thing. i just want it simple."* So the buy-in /
 * cash-out layer is gone — the table plays straight against a BANK, and the
 * world hands it the wallet: a bet leaves the purse the moment you DEAL, a
 * win counts straight back in (which is what makes the HUD's green tick fire
 * on every win, the thing he loves watching). Nothing ever pools at the
 * table, so there is nothing a walk-away can lose — the contract the slot
 * cabinets moved to the same day (see ct/slotcab.ts).
 */
export interface Bank {
  /** whole chips the player can stake right now */
  get(): number;
  /** move chips: negative stakes a bet, positive pays a win */
  add(d: number): void;
}

/**
 * THE CHIP RACK — the denominations printed on the felt. *"i want to be able
 * to bet whatever amount"* (2026-08-10), so the fixed even-bet ladder is
 * gone: you stack any bet a chip at a time, up to the wallet, CLEAR to start
 * over.
 *
 * ODD BETS ARE LEGAL NOW. The ladder was all-even so 3:2 never paid a half
 * chip; at the casino's $1 chip (`CREDIT` in ct/slots.ts) a half chip is
 * 50¢ — exact in cents and exact in binary floating point, so the float-money
 * fault that forced the even ladder (a third of a cent, at the old 25¢ chip)
 * cannot happen. If CREDIT ever becomes an odd number of cents, this is the
 * comment to reread.
 */
export const CHIPS = [1, 5, 25, 100] as const;

/**
 * A table. Holds a shoe and a hand in progress; knows nothing about panels,
 * seats or the world, and holds NO money of its own — every chip staked or
 * paid moves through the `Bank` the caller injects, which in the world is
 * K's wallet itself. The default bank is a plain pocket so the headless
 * checks can fund a table with `buyIn()` and play a million hands.
 */
export function createTable(opts: { rng?: Rng; bank?: Bank } = {}): Table {
  const shoe = makeShoe(opts.rng ?? Math.random);
  const bank: Bank = opts.bank
    ?? (() => { let n = 0; return { get: () => n, add: (d: number) => { n += d; } }; })();
  let phase: Phase = 'betting';
  let bet = 0, t = 0;
  let staked = 0, returned = 0;
  let hands: { cards: Placed[]; bet: number; done: boolean; outcome: Outcome; bj: boolean }[] = [];
  let dealer: Placed[] = [];
  let active = -1, holeTurnT = -1, splitAces = false;
  let queue: (() => void)[] = [];      // what happens when the last card lands
  let ready = 0;                       // table time at which the felt is still again
  let owed = 0, paid = 0, payRamp = 0, phaseT = 0;

  const hv = (cards: Placed[], bet: number, done: boolean, outcome: Outcome, bj: boolean): HandView => ({
    cards, bet, done, outcome, blackjack: bj,
    // The hole card is not part of the total the player can see. Showing the
    // dealer's real total while one card is face down is the single most common
    // way a blackjack interface lies to its player, and it is a one-line
    // mistake: `value(dealer)` rather than `value(the cards that are face up)`.
    value: value(cards.filter((c) => !c.faceDown).map((c) => c.card)),
  });

  /** Put a card on the felt, timed so it leaves the shoe after everything
   *  already in flight has landed. */
  const place = (to: Placed[], faceDown = false): Card => {
    const c = shoe.draw();
    const t0 = Math.max(t, ready);
    to.push({ card: c, t0, faceDown });
    ready = t0 + PACE.deal + PACE.gap;
    return c;
  };

  const canDouble = (h: typeof hands[0]) =>
    h.cards.length === 2 && bank.get() >= h.bet && (hands.length === 1 || RULES.doubleAfterSplit);
  const canSplit = (h: typeof hands[0]) =>
    h.cards.length === 2 && hands.length < RULES.maxHands && bank.get() >= h.bet
    && cardValue(h.cards[0].card.r) === cardValue(h.cards[1].card.r);

  const movesFor = (): Move[] => {
    // Nothing is offered while a card is still in the air. `act` guards on this
    // too; the view needs it as well or the buttons light up mid-deal.
    if (phase !== 'player' || active < 0 || t < ready) return [];
    const h = hands[active];
    if (h.done) return [];
    // A split ace takes exactly one card and then stands, which is a RULE and
    // not a convention — `playRound` enforces it by breaking out of its loop,
    // and this is the same rule stated where the player can see it.
    if (splitAces && hands.length > 1) return [];
    const out: Move[] = ['hit', 'stand'];
    if (canDouble(h)) out.push('double');
    if (canSplit(h)) out.push('split');
    return out;
  };

  /**
   * Move to the first hand that still needs playing, or to the dealer.
   *
   * SCANS FROM ZERO, not from `active + 1`. Starting past the current hand is
   * the obvious way to write it and is wrong after a SPLIT: the hand you just
   * split is still yours to play, and skipping it would deal you two hands and
   * let you act on only the second. `done` is what says a hand is finished, so
   * a scan from the start cannot skip one that is not.
   */
  const advance = () => {
    for (let i = 0; i < hands.length; i++) {
      const h = hands[i];
      if (h.done) continue;
      const v = value(h.cards.map((c) => c.card));
      // A split ace takes exactly one card; 21 and a bust need no decision.
      if (splitAces && hands.length > 1) { h.done = true; continue; }
      if (v.bust || v.total === 21) { h.done = true; continue; }
      active = i; return;
    }
    active = -1;
    phase = 'dealer';
    phaseT = 0;
    // The hole card turns as the dealer takes over — the moment the user named.
    holeTurnT = Math.max(t, ready);
    dealer = dealer.map((c) => ({ ...c, faceDown: false }));
    ready = holeTurnT + PACE.holeTurn;
  };

  /** what a hand whose outcome is ALREADY decided (the peek's naturals and
   *  pushes) pays — one formula, read by `settle`, which `flush` runs too,
   *  covering the window where an outcome is announced but not yet settled */
  const preOwed = (h: { bet: number; outcome: Outcome }): number =>
    h.outcome === 'blackjack' ? h.bet * (1 + RULES.blackjackPays)
      : h.outcome === 'push' ? h.bet : 0;

  const settle = () => {
    const dv = value(dealer.map((c) => c.card));
    owed = 0;
    for (const h of hands) {
      const pv = value(h.cards.map((c) => c.card));
      if (h.outcome) { owed += preOwed(h); continue; }
      if (pv.bust) { h.outcome = 'bust'; continue; }
      if (dv.bust || pv.total > dv.total) { h.outcome = 'win'; owed += h.bet * 2; }
      else if (pv.total < dv.total) { h.outcome = 'lose'; }
      else { h.outcome = 'push'; owed += h.bet; }
    }
    phase = 'settle'; phaseT = 0; paid = 0; payRamp = 0;
  };

  const says = (): string => {
    if (phase === 'betting') {
      // The bank IS the wallet, so the one fact the painter used to be handed
      // — is "no money" true of the pockets or just the rail — no longer
      // splits in two. One balance, one message.
      const b = bank.get();
      if (b < 1) return 'NO CASH IN YOUR POCKETS';
      if (bet < 1) return 'PLACE YOUR BET';
      if (b < bet) return 'NOT ENOUGH FOR THAT BET';
      return `${bet} ON THE SPOT — DEAL WHEN READY`;
    }
    if (phase === 'dealing') return 'DEALING';
    if (phase === 'player') {
      const h = hands[active];
      if (!h) return '';
      // It said NOTHING for a single hand, which is the commonest case by far —
      // so the strip sat empty and dark through most of every round and read as
      // a broken element rather than as a quiet one.
      if (hands.length > 1) {
        const v = value(h.cards.map((c) => c.card));
        return `HAND ${active + 1} OF ${hands.length} — ${v.total}${v.soft ? ' SOFT' : ''}`;
      }
      return 'YOUR MOVE';
    }
    if (phase === 'dealer') return dealerRule();
    const bj = hands.some((h) => h.outcome === 'blackjack');
    if (bj) return 'BLACKJACK — PAYS 3 TO 2';
    const w = hands.filter((h) => h.outcome === 'win').length;
    const l = hands.filter((h) => h.outcome === 'lose' || h.outcome === 'bust').length;
    const p = hands.filter((h) => h.outcome === 'push').length;
    if (hands.length === 1) {
      return w ? 'YOU WIN' : p ? 'PUSH' : hands[0].outcome === 'bust' ? 'BUST' : 'DEALER WINS';
    }
    return `${w} WON  ${l} LOST${p ? `  ${p} PUSHED` : ''}`;
  };

  const view = (): TableView => ({
    phase, chips: bank.get(), bet, active, t, holeTurnT,
    hands: hands.map((h) => hv(h.cards, h.bet, h.done, h.outcome, h.bj)),
    dealer: hv(dealer, 0, phase !== 'player' && phase !== 'dealing', null, isBlackjack(dealer.map((c) => c.card))),
    moves: movesFor(), says: says(), paid, staked, returned,
    shoeLeft: shoe.remaining(),
  });

  const tick = (dt: number) => {
    if (!(dt > 0)) return;
    // Not clamped, for the same reason `ct/slots.ts` does not clamp: every
    // animation here is a function of `t0` and the table time, so a long frame
    // lands in the right place rather than somewhere behind.
    t += dt; phaseT += dt;
    if (t < ready) return;             // something is still in the air

    if (phase === 'dealing') {
      const q = queue.shift();
      if (q) { q(); return; }
      // Everything is down. Check for naturals BEFORE anyone acts — the peek.
      const pbj = isBlackjack(hands[0].cards.map((c) => c.card));
      const dbj = isBlackjack(dealer.map((c) => c.card));
      if (pbj || dbj) {
        holeTurnT = t;
        dealer = dealer.map((c) => ({ ...c, faceDown: false }));
        ready = t + PACE.holeTurn;
        hands[0].bj = pbj; hands[0].done = true;
        hands[0].outcome = pbj && dbj ? 'push' : pbj ? 'blackjack' : 'lose';
        phase = 'dealer'; phaseT = 0;
        return;
      }
      phase = 'player'; active = -1; advance();
      if (phase === 'player' && active < 0) advance();
      return;
    }

    if (phase === 'dealer') {
      // One card at a time, with a pause before each. The pause IS the game
      // here — a dealer that resolves instantly is a dealer you never watch.
      if (phaseT < PACE.dealerDraw) return;
      // THE DEALER ONLY PLAYS IF SOMETHING IS STILL UNDECIDED.
      //
      // `!h.outcome` is the whole of it, and it was `h.outcome !== 'lose'`,
      // which let the dealer draw after a PLAYER NATURAL: the peek had already
      // settled the hand and paid 3:2, and the dealer then dealt itself cards to
      // reach a total nobody was going to compare against. The money was right —
      // `settle` skips a hand whose outcome is already set — so nothing in the
      // 300,000-hand agreement check could see it. Found by playing twenty hands
      // and reading the log: hand 18 showed `Ks Ad` paid as a blackjack against
      // a dealer holding THREE cards.
      const alive = hands.some((h) => !h.outcome && !value(h.cards.map((c) => c.card)).bust);
      if (alive && dealerDraws(value(dealer.map((c) => c.card)))) {
        place(dealer); phaseT = 0; return;
      }
      settle();
      return;
    }

    if (phase === 'settle') {
      if (phaseT < PACE.settle) return;
      if (owed <= 0) { phase = 'betting'; hands = []; dealer = []; return; }
      phase = 'paying'; payRamp = 0; paid = 0;
      return;
    }

    if (phase === 'paying') {
      payRamp = Math.min(owed, payRamp + PACE.payRate * dt);
      const whole = Math.min(owed, Math.floor(payRamp));
      // Straight into the bank — the wallet — as it counts, whole chips at a
      // time so the HUD's tick rides the count; the 3:2 half-chip (50¢, exact
      // — see CHIPS) lands with the final remainder.
      if (whole > paid) { bank.add(whole - paid); paid = whole; }
      if (payRamp >= owed) {
        if (owed > paid) bank.add(owed - paid);
        paid = owed; returned += owed;
        phase = 'betting'; hands = []; dealer = [];
      }
      return;
    }
  };

  const act = (m: Move): boolean => {
    if (phase !== 'player' || active < 0 || t < ready) return false;
    const h = hands[active];
    if (h.done || !movesFor().includes(m)) return false;
    if (m === 'stand') { h.done = true; advance(); return true; }
    if (m === 'hit') {
      place(h.cards);
      const after = value(h.cards.map((c) => c.card));
      if (after.bust || after.total === 21) { h.done = true; queueAdvance(); }
      return true;
    }
    if (m === 'double') {
      bank.add(-h.bet); staked += h.bet; h.bet *= 2;
      place(h.cards);
      h.done = true; queueAdvance();
      return true;
    }
    if (m === 'split') {
      splitAces = h.cards[0].card.r === 1;
      const moved = h.cards.pop()!;
      bank.add(-h.bet); staked += h.bet;
      const second = { cards: [moved], bet: h.bet, done: false, outcome: null as Outcome, bj: false };
      hands.splice(active + 1, 0, second);
      // One card to each of the two hands, in order, so the felt shows the
      // split being dealt out rather than two hands appearing.
      place(h.cards);
      place(second.cards);
      // Re-decide once both cards are down: for aces that means both hands are
      // finished, and for anything else it means playing the FIRST of the two.
      queueAdvance();
      return true;
    }
    return false;
  };

  /** Advance once the cards in flight have landed, rather than immediately —
   *  otherwise a bust jumps to the dealer while the card that busted you is
   *  still in the air, which is the single ugliest thing this table could do. */
  const queueAdvance = () => {
    const at = ready;
    const hook = () => { if (t >= at) { advance(); return true; } return false; };
    pending.push(hook);
  };
  const pending: (() => boolean)[] = [];
  const tickPending = () => { for (let i = pending.length - 1; i >= 0; i--) if (pending[i]()) pending.splice(i, 1); };

  return {
    view,
    tick: (dt) => { tick(dt); tickPending(); },
    betAdd: (n) => {
      if (phase !== 'betting' || !(n > 0)) return;
      // clamped to the bank: you cannot stack a bet the wallet cannot cover
      bet = Math.min(bet + Math.floor(n), Math.max(0, bank.get()));
    },
    betClear: () => { if (phase === 'betting') bet = 0; },
    deal: () => {
      if (phase !== 'betting') return false;
      if (bet < 1 || bank.get() < bet) return false;
      if (shoe.remaining() <= 12) shoe.shuffle();     // the cut card, between rounds only
      bank.add(-bet); staked += bet;
      hands = [{ cards: [], bet, done: false, outcome: null, bj: false }];
      dealer = []; active = -1; holeTurnT = -1; splitAces = false;
      ready = t; phase = 'dealing'; phaseT = 0;
      // Player, dealer, player, dealer-face-down. The order a real table deals
      // in, and the reason the hole card is the LAST thing on the felt.
      queue = [
        () => place(hands[0].cards),
        () => place(dealer),
        () => place(hands[0].cards),
        () => place(dealer, true),
      ];
      return true;
    },
    act,
    buyIn: (n) => { if (n > 0 && phase === 'betting') bank.add(Math.floor(n)); },
    flush: () => {
      // Standing up (Escape, [E], the printed LEAVE) settles the table
      // HONESTLY and instantly. Money never pools here, so most of the time
      // there is nothing to do — but anything the house still owes (`owed −
      // paid`, a win the counting animation had not finished moving) goes
      // straight to the bank before the felt clears.
      //
      // MID-DEALER, THE ROUND PLAYS OUT FIRST. Once your decisions are made
      // the bet is beyond your hands — a real dealer finishes the draw and
      // pays whether you stand at the rail or not, and an Escape pressed in
      // the 600 ms between dealer cards must never eat a hand you had
      // already won. (This also covers the peek's naturals: their outcome is
      // set, so the dealer draws nothing and `settle` pays them — the window
      // `preOwed` was written for.) Mid-DEAL or mid-DECISION there is
      // nothing to settle: the bet in the middle is forfeit, exactly as at a
      // real table.
      if (phase === 'dealer') {
        const alive = hands.some((h) => !h.outcome && !value(h.cards.map((c) => c.card)).bust);
        if (alive) {
          while (dealerDraws(value(dealer.map((c) => c.card)))) {
            dealer.push({ card: shoe.draw(), t0: t, faceDown: false });
          }
        }
        settle();
      }
      const due = Math.max(0, owed - paid);
      if (due > 0) { bank.add(due); returned += due; }
      phase = 'betting'; hands = []; dealer = []; active = -1; holeTurnT = -1;
      owed = 0; paid = 0; payRamp = 0; queue = []; pending.length = 0;
    },
    settled: () => phase === 'betting',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PART THREE: THE FELT.
//
// Same contract as `ct/slots.ts`'s glass and for the same reasons: a pure
// function of (view, t), painted at a small logical size and scaled up, with no
// `Math.random()` anywhere in it. That determinism is what lets
// `scripts/L-blackjack-felt.mjs` assert the table through a recording context
// rather than a screenshot (GOTCHAS §1).
//
// 2026-08-09, the user: *"blackjack and roulettte need to be diagetic similar
// to all the other locked perspective UIs."* So this painter no longer draws a
// PICTURE of a table into a floating cabinet — it paints the TABLETOP ITSELF.
// The canvas hangs on the `blackjack-felt` mesh in ct/int-casino.ts (one mesh,
// the mirror/calendar rule), the view locks straight down onto it, the world's
// own wood rail frames it, and the dealer stands across the table in the room.
// `paintTable(g, w, h, null)` is the same felt with nothing live on it — the
// texture the world mesh wears whenever nobody is sitting at it, so the printed
// felt and the played felt are ONE painter (shop.ts's one-painter rule).
//
// THE CARDS ARE DRAWN, NOT TYPED. The pips are pixel shapes rather than the
// Unicode ♠♥♦♣, because a glyph is whatever font the browser happens to have and
// this world draws everything by hand at a known density. It also means the
// check can tell a heart from a diamond, which it could not do with text.

/** The tabletop canvas. 512 × 272 over the 1.6 × 0.85 m felt mesh is the same
 *  aspect exactly (1.882) and an even 320 px/m — BUILDER-BRIEF §7b's
 *  same-both-ways rule, so nothing stretches between build and play. */
export const FELT = { w: 512, h: 272 } as const;

const T = {
  felt: '#1e5a3e', feltLo: '#17462f', feltHi: '#2a6d4c',
  rail: '#3a2226', railHi: '#54353a',
  card: '#e8e2d0', cardLo: '#b8b2a0', cardEdge: '#2a2018',
  back: '#7a2430', backHi: '#a03848',
  red: '#c8342c', black: '#2a2018',
  gold: '#d8a83a', goldLo: '#8a6a22',
  ink: '#e8e2d0', dim: '#9ab0a0',
  chip: '#c9a45e', win: '#fff0bc', lose: '#c86a5a',
} as const;

/** Where things sit on the felt. Exported so the check can ask rather than
 *  hard-code — every coordinate hand-typed into a probe on this project has
 *  eventually been wrong (GOTCHAS §20). Canvas TOP is the dealer's side of the
 *  table (the mesh's −z edge), which is where he stands in the room. */
export const LAYOUT = {
  shoe: { x: 448, y: 46 },
  // 42/152, walked down from 46/158 in the overlap audit: the player's chip
  // row (badge line + 10 px of chip) now clears the meter row at 208 by 3 px,
  // and the dealer's badge clears the PAYS legend — every band on the felt
  // has its own air. *"make sure the diagetic overlays … arent overlapping."*
  dealer: { x: 256, y: 42 },
  player: { x: 256, y: 152 },
  // The overlap keeps each card's corner index readable — how a hand is
  // actually fanned. Cards grew from 26 × 38 with the move onto the tabletop:
  // *"cards … lie ON the felt, big and pixel-crisp."*
  cardW: 40, cardH: 58, overlap: 26,
  say: [126, 208, 242, 18] as const,
  meterY: 208, meterH: 18,
  btnY: 234, btnH: 30,
} as const;

/** The action regions printed along the player's edge of the felt —
 *  *"bet/hit/stand/double live as printed regions of the felt"* — declared once
 *  and read by the painter AND the click handler (the loan form's BOX rule).
 *  The row divides its width by however many regions the phase offers, so the
 *  rects come from `btnRect(i, n)` with `n = buttonsFor(...).length`. */
export const BTN = { x: 14, y: 234, h: 30, gap: 8, right: 498 } as const;
export const btnRect = (i: number, n: number): { x: number; y: number; w: number; h: number } => {
  const w = (BTN.right - BTN.x - (n - 1) * BTN.gap) / n;
  return { x: BTN.x + i * (w + BTN.gap), y: BTN.y, w, h: BTN.h };
};
export const buttonIx = (x: number, y: number, n: number): number | null => {
  if (y < BTN.y || y > BTN.y + BTN.h) return null;
  for (let i = 0; i < n; i++) {
    const r = btnRect(i, n);
    if (x >= r.x && x <= r.x + r.w) return i;
  }
  return null;
};

export type BtnAct = 'deal' | 'chip' | 'clear' | 'leave'
  | 'hit' | 'stand' | 'double' | 'split';
/**
 * What the printed regions mean RIGHT NOW. The rules speaking, never a fixed
 * row greyed out by the painter's own opinion — `moves` is the authority.
 *
 * EVERY VERB THE TABLE HAS IS A REGION — *"lets make the games totally
 * playable with just click"* (2026-08-09), and later the same day the regions
 * became the ONLY way: *"make that click only"*. The table binds no game keys
 * at all now. Escape and [E] still leave — framework law — and LEAVE is
 * printed on the felt with the rest.
 *
 * BUY IN and CASH OUT are GONE (2026-08-10, *"i dont like this cash out buy
 * in thing"*): the betting row is the chip rack — stack any bet a chip at a
 * time, CLEAR, DEAL. A `chip` region carries its denomination in `n`.
 */
export const buttonsFor = (v: TableView): { label: string; act: BtnAct; n?: number; live: boolean }[] =>
  v.phase === 'betting'
    ? [...CHIPS.map((n): { label: string; act: BtnAct; n?: number; live: boolean } => ({
         // a chip stays live only while the wallet covers the stack PLUS it
         label: String(n), act: 'chip', n, live: v.chips >= v.bet + n,
       })),
       { label: 'CLEAR', act: 'clear', live: v.bet > 0 },
       { label: 'DEAL', act: 'deal', live: v.bet >= 1 && v.chips >= v.bet },
       { label: 'LEAVE', act: 'leave', live: true }]
    : [{ label: 'HIT', act: 'hit', live: v.moves.includes('hit') },
       { label: 'STAND', act: 'stand', live: v.moves.includes('stand') },
       { label: 'DOUBLE', act: 'double', live: v.moves.includes('double') },
       { label: 'SPLIT', act: 'split', live: v.moves.includes('split') },
       { label: 'LEAVE', act: 'leave', live: true }];

const PIP: Record<number, (g: Paint2D, x: number, y: number, s: number) => void> = {
  // 0 spade, 1 heart, 2 diamond, 3 club — the order of `SUITS`.
  0: (g, x, y, s) => {                                   // spade
    for (let i = 0; i < 4; i++) g.fillRect(x - i, y - 3 + i, i * 2 + 1, 1);
    g.fillRect(x - 3, y + 1, 7, 2);
    g.fillRect(x - 1, y + 3, 3, 2 * s);
  },
  1: (g, x, y) => {                                      // heart
    g.fillRect(x - 3, y - 2, 2, 2); g.fillRect(x + 2, y - 2, 2, 2);
    g.fillRect(x - 4, y, 9, 2);
    for (let i = 0; i < 4; i++) g.fillRect(x - 3 + i, y + 2 + i, 7 - i * 2, 1);
  },
  2: (g, x, y) => {                                      // diamond
    for (let i = 0; i < 4; i++) g.fillRect(x - i, y - 3 + i, i * 2 + 1, 1);
    for (let i = 0; i < 4; i++) g.fillRect(x - 3 + i, y + 1 + i, 7 - i * 2, 1);
  },
  3: (g, x, y, s) => {                                   // club
    g.fillRect(x - 1, y - 4, 3, 3);
    g.fillRect(x - 4, y - 1, 3, 3); g.fillRect(x + 2, y - 1, 3, 3);
    g.fillRect(x - 1, y - 1, 3, 4);
    g.fillRect(x - 1, y + 3, 3, 2 * s);
  },
};

/**
 * One card. `flip` is 1 face-up, 0 edge-on, and the painter squashes the card
 * horizontally by it — which is the whole of the hole-card turn.
 */
export function paintCard(
  g: Paint2D, c: Card | null, x: number, y: number, flip = 1, lift = 0,
): void {
  const w = LAYOUT.cardW * Math.max(0.02, Math.abs(flip)), h = LAYOUT.cardH;
  const left = x - w / 2, top = y - h / 2 - lift;
  g.fillStyle = 'rgba(0,0,0,0.28)';
  g.fillRect(left + 2, top + 3 + lift, w, h);            // its shadow stays on the felt
  if (!c) {
    // face down: the house's own back, a red lattice
    g.fillStyle = T.cardEdge; g.fillRect(left, top, w, h);
    g.fillStyle = T.back; g.fillRect(left + 2, top + 2, w - 4, h - 4);
    if (w > 12) {
      g.fillStyle = T.backHi;
      for (let i = 4; i < h - 4; i += 5) g.fillRect(left + 4, top + i, w - 8, 2);
      g.fillStyle = T.gold;
      g.fillRect(left + w / 2 - 3, top + h / 2 - 3, 6, 6);
    }
    return;
  }
  g.fillStyle = T.cardEdge; g.fillRect(left, top, w, h);
  g.fillStyle = T.card; g.fillRect(left + 2, top + 2, w - 4, h - 4);
  g.fillStyle = T.cardLo; g.fillRect(left + 2, top + h - 4, w - 4, 2);
  if (w < 14) return;                                    // edge-on: no face to read
  const red = c.s === 1 || c.s === 2;
  g.fillStyle = red ? T.red : T.black;
  g.font = 'bold 13px monospace'; g.textAlign = 'left';
  g.fillText(RANKS[c.r], left + 4, top + 16);
  // the pip, at 2× — the shapes are integer fillRects, so an integer scale
  // keeps every edge on a texel and the mark pixel-crisp at the bigger size
  g.save();
  g.translate(x, y - lift + 8); g.scale(2, 2);
  PIP[c.s](g, 0, 0, 1);
  g.restore();
}

/** The value badge under a hand — what it is worth, said plainly, because a
 *  player should never be counting in their head at a table that knows. */
const badge = (g: Paint2D, v: HandValue, x: number, y: number, lit: boolean) => {
  const label = v.bust ? 'BUST' : `${v.total}${v.soft && v.total !== 21 ? ' SOFT' : ''}`;
  const w = Math.max(30, label.length * 7 + 10);
  g.fillStyle = v.bust ? T.lose : lit ? T.gold : T.feltLo;
  g.fillRect(x - w / 2, y, w, 14);
  g.fillStyle = v.bust || lit ? T.black : T.ink;
  g.font = 'bold 10px monospace'; g.textAlign = 'center';
  g.fillText(label, x, y + 11);
};

/** One hand's cards, fanned, each flying in from the shoe if it is still
 *  arriving. Returns the width it took, so the caller can lay two side by side. */
const paintHand = (
  g: Paint2D, h: HandView, cx: number, cy: number, t: number, holeTurnT: number,
) => {
  const n = h.cards.length;
  const span = (n - 1) * LAYOUT.overlap;
  h.cards.forEach((p, i) => {
    const home = cx - span / 2 + i * LAYOUT.overlap;
    // THE FLIGHT. A card leaves the shoe at `t0` and takes `PACE.deal` to land,
    // and until it does it is drawn between the two — which is the deal
    // animation, and it is a function of the table's clock rather than a
    // tween anybody has to drive.
    const k = Math.min(1, Math.max(0, (t - p.t0) / PACE.deal));
    const e = 1 - (1 - k) ** 3;
    const x = LAYOUT.shoe.x + (home - LAYOUT.shoe.x) * e;
    const y = LAYOUT.shoe.y + (cy - LAYOUT.shoe.y) * e;
    // THE HOLE CARD TURNING OVER — the moment the user named. Squash to nothing
    // and back, swapping the face at the midpoint, which is what a card does.
    let flip = 1, card: Card | null = p.faceDown ? null : p.card;
    if (holeTurnT >= 0 && i === 1 && h.bet === 0) {
      const q = (t - holeTurnT) / PACE.holeTurn;
      if (q >= 0 && q < 1) { flip = Math.abs(1 - 2 * q); card = q < 0.5 ? null : p.card; }
    }
    paintCard(g, card, x, y, flip, k < 1 ? (1 - e) * 9 : 0);
  });
};

/**
 * Draw the TABLETOP, full bleed. This canvas IS the felt: it hangs on the
 * `blackjack-felt` mesh, so there is no painted rail any more — the table's
 * own wood and leather frame it in the world, which is the whole point of the
 * move. `v` is `null` for the WORLD COPY: the same felt with nothing live on
 * it, painted once at build time onto the mesh (one painter, two moments).
 *
 * `t` is the TABLE's own clock, the same one the cards were timed against —
 * not a wall clock. Handing it anything else would make cards fly from the
 * wrong place, which is why `TableView` publishes it rather than leaving the
 * caller to keep its own.
 */
export function paintTable(
  g: Paint2D, w: number, h: number, v: TableView | null,
  // No `cash` parameter any more: since the buy-in layer went (2026-08-10)
  // the table's bank IS the wallet, so `v.chips` already answers the one
  // money question the painter used to be handed separately.
  /** which printed region the pointer is over, from `buttonIx`, or null */
  hover: number | null = null,
): void {
  const s = Math.max(0.1, Math.min(w / FELT.w, h / FELT.h));
  g.save();
  g.fillStyle = T.felt; g.fillRect(0, 0, w, h);
  g.translate((w - FELT.w * s) / 2, (h - FELT.h * s) / 2);
  g.scale(s, s);

  // the baize, with a printed border line where the wood begins
  g.fillStyle = T.felt; g.fillRect(0, 0, FELT.w, FELT.h);
  g.fillStyle = T.feltHi;
  g.fillRect(4, 4, FELT.w - 8, 1); g.fillRect(4, 4, 1, FELT.h - 8);
  g.fillRect(FELT.w - 5, 4, 1, FELT.h - 8);
  g.fillStyle = T.feltLo; g.fillRect(4, FELT.h - 5, FELT.w - 8, 1);

  // THE ARC, and the two lines every real table has printed on it. The user
  // asked for the dealer's rule to be visible; `dealerRule()` derives it from
  // RULES so the printed line and the behaviour cannot drift.
  g.fillStyle = T.feltHi;
  for (let x = 28; x < FELT.w - 28; x += 1) {
    const k = (x - FELT.w / 2) / (FELT.w / 2 - 28);
    g.fillRect(x, 90 + Math.round(k * k * 12), 1, 1);
  }
  g.textAlign = 'center'; g.font = 'bold 13px monospace';
  g.fillStyle = T.gold;
  g.fillText('BLACKJACK PAYS 3 TO 2', FELT.w / 2, 106);
  g.font = '9px monospace'; g.fillStyle = T.dim;
  g.fillText(dealerRule(), FELT.w / 2, 119);

  // the shoe, printed at the dealer's right hand, where every card comes from
  g.fillStyle = T.railHi; g.fillRect(LAYOUT.shoe.x - 17, LAYOUT.shoe.y - 22, 34, 42);
  g.fillStyle = T.rail; g.fillRect(LAYOUT.shoe.x - 14, LAYOUT.shoe.y - 19, 28, 36);
  g.fillStyle = T.back; g.fillRect(LAYOUT.shoe.x - 11, LAYOUT.shoe.y - 16, 22, 28);
  // HOW MANY DECKS ARE IN IT, said on the table — the user asked for this in
  // as many words. Read from RULES, so the placard and the shoe cannot
  // disagree.
  g.fillStyle = T.gold; g.font = 'bold 8px monospace'; g.textAlign = 'center';
  g.fillText(`${RULES.decks} DECKS`, LAYOUT.shoe.x, LAYOUT.shoe.y + 32);

  // the betting spot, printed on the felt whether anyone is sitting or not —
  // an empty table still says where the hand goes
  if (!v || !v.hands.length) {
    g.fillStyle = T.feltHi;
    g.beginPath();
    g.arc(LAYOUT.player.x, LAYOUT.player.y, 30, 0, Math.PI * 2);
    g.arc(LAYOUT.player.x, LAYOUT.player.y, 28, 0, Math.PI * 2, true);
    g.fill();
  }

  // ── THE WORLD COPY STOPS HERE — printed felt, no live game on it ──
  if (!v) { g.restore(); return; }

  g.fillStyle = T.dim; g.font = '8px monospace'; g.textAlign = 'center';
  g.fillText(String(Math.max(0, v.shoeLeft)), LAYOUT.shoe.x, LAYOUT.shoe.y + 42);

  // ── the dealer ──
  if (v.dealer.cards.length) {
    paintHand(g, v.dealer, LAYOUT.dealer.x, LAYOUT.dealer.y, v.t, v.holeTurnT);
    const showing = v.dealer.cards.every((c) => !c.faceDown);
    badge(g, v.dealer.value, LAYOUT.dealer.x, LAYOUT.dealer.y + 38, showing && v.phase === 'dealer');
  }

  // ── the player, one hand or two ──
  v.hands.forEach((hand, i) => {
    const many = v.hands.length > 1;
    const hx = many ? LAYOUT.player.x + (i === 0 ? -96 : 96) : LAYOUT.player.x;
    paintHand(g, hand, hx, LAYOUT.player.y, v.t, -1);
    badge(g, hand.value, hx, LAYOUT.player.y + 36, i === v.active);
    // THE STAKE, as a chip BESIDE the badge rather than under it — on a split
    // the two hands' bets can differ and both have to be readable.
    g.fillStyle = T.chip;
    g.beginPath(); g.arc(hx - 58, LAYOUT.player.y + 43, 10, 0, Math.PI * 2); g.fill();
    g.fillStyle = T.goldLo;
    g.beginPath(); g.arc(hx - 58, LAYOUT.player.y + 43, 6, 0, Math.PI * 2); g.fill();
    // free bets can run to three or four digits now — shrink to fit the chip
    g.fillStyle = T.black; g.textAlign = 'center';
    g.font = `bold ${hand.bet >= 100 ? 7 : 9}px monospace`;
    g.fillText(String(hand.bet), hx - 58, LAYOUT.player.y + 46);
    if (hand.outcome) {
      // OPPOSITE THE CHIP, on the badge's line. Kept per-hand even though the
      // message strip says it too, because on a SPLIT the two hands can differ
      // and the strip can only say "1 WON 1 LOST" — which does not tell you
      // which.
      const won = hand.outcome === 'win' || hand.outcome === 'blackjack';
      g.fillStyle = won ? T.win : hand.outcome === 'push' ? T.dim : T.lose;
      g.font = 'bold 10px monospace'; g.textAlign = 'center';
      g.fillText(hand.outcome.toUpperCase(), hx + 58, LAYOUT.player.y + 46);
    }
    if (many && i === v.active) {
      g.strokeStyle = T.gold; g.lineWidth = 1;
      g.strokeRect(hx - 64.5, LAYOUT.player.y - 30.5, 129, 76);
    }
  });

  // ── what the table is saying ──
  const [sx, sy, sw, sh] = LAYOUT.say;
  g.fillStyle = T.feltLo; g.fillRect(sx, sy, sw, sh);
  g.fillStyle = T.feltHi; g.fillRect(sx, sy, sw, 1);
  g.textAlign = 'center'; g.font = '9px monospace';
  g.fillStyle = v.phase === 'settle' || v.phase === 'paying' ? T.win : T.dim;
  // "NO CASH IN YOUR POCKETS" is the table's own line now — its bank is the
  // wallet, so the taunt-vs-advice distinction ct/slots.ts taught no longer
  // needs a second fact handed in.
  if (v.says) g.fillText(v.says, sx + sw / 2, sy + 13);

  // ── the meters, printed like a scoreboard let into the felt ──
  const meter = (mx: number, mw: number, label: string, val: string, lit: boolean) => {
    g.fillStyle = '#12180f'; g.fillRect(mx, LAYOUT.meterY, mw, LAYOUT.meterH);
    g.strokeStyle = T.railHi; g.lineWidth = 1;
    g.strokeRect(mx + 0.5, LAYOUT.meterY + 0.5, mw - 1, LAYOUT.meterH - 1);
    g.fillStyle = '#2c4a24'; g.font = '7px monospace'; g.textAlign = 'left';
    g.fillText(label, mx + 4, LAYOUT.meterY + 13);
    g.fillStyle = lit ? T.win : '#7ae05a';
    g.font = 'bold 12px monospace'; g.textAlign = 'right';
    g.fillText(val, mx + mw - 4, LAYOUT.meterY + 14);
  };
  // No CHIPS meter: the bank is the wallet and the wallet lives on the HUD —
  // a second cash readout on the felt would be slotcab.ts's "janky ass money
  // screen" wearing green baize. BET and PAID are the table's own numbers.
  meter(374, 56, 'BET', String(v.bet), false);
  meter(436, 62, 'PAID', String(v.paid), v.phase === 'paying');

  // ── the action regions, printed along the player's edge of the felt ──
  //
  // What the TABLE says you may do, never a fixed row greyed out by the
  // painter's own opinion. `buttonsFor` reads `moves` — the rules speaking —
  // and the click handler reads the SAME table, so a region drawn live here
  // and refused by `act` cannot happen.
  const btns = buttonsFor(v);
  btns.forEach((b, i) => {
    const r = btnRect(i, btns.length);
    g.fillStyle = b.live ? (i === hover ? '#f0d68a' : T.gold) : '#3c443c';
    g.fillRect(r.x, r.y, r.w, r.h);
    g.fillStyle = b.live ? '#f8e6ac' : '#4c544c';
    g.fillRect(r.x, r.y, r.w, 2);
    g.fillStyle = b.live ? T.black : '#6c746c';
    g.font = 'bold 10px monospace'; g.textAlign = 'center';
    g.fillText(b.label, r.x + r.w / 2, r.y + 19);
  });

  g.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
// PART FOUR: THE MACHINERY AROUND IT.
//
// Deliberately almost identical to `ct/slots.ts`'s PART FOUR, and that identity
// is the point. The desk's instruction when it ranked this second was that the
// second game should be CHEAP, and only if the first one was built right:
//
//   "the panel framework is K's and shared, the money in and out is K's
//    pockets, and the seat-opens-the-game mechanism is the same. If you build
//    slots as a self-contained blob, blackjack costs you the same again."
//
// It did not. This section is ninety lines and every one of them is a line the
// slot machine already proved.

import { BUILD, ORDER as HOOK } from './ctx';
import type { CtxBuild } from './ctx';
import type { Panel } from './hud';

/** After the interiors, and after `ct/slots.ts`, so the two games register in a
 *  stable order. Only a sort key; ties break on filename anyway. */
export const ORDER = BUILD.INTERIOR + 6;

/**
 * THE SEAT THIS OPENS AT. **WIRED — you sit down at the felt table and it
 * opens.** `ae4147cee` did it; before that commit this docstring said the seat
 * did not exist, and it was right at the time.
 *
 * The slots bridge on G's `'sit at the slot'`, which is unambiguous — 96 stools
 * and nothing else carries it. **Every table stool on that floor used to publish
 * `'sit at the table'`**: roulette's five, craps's six and poker's six, AND the
 * felt table's, because `int-casino.ts`'s `gameStool()` hard-coded the string.
 * Bridging on it would have opened a blackjack game at the roulette wheel, which
 * is worse than not shipping it — so this waited for a label of its own instead.
 *
 * `ae4147cee` gave `gameStool()` an optional `label` (default unchanged, so
 * roulette, craps and poker still carry `'sit at the table'`) and put four
 * stools on the player side of the felt table — since the 2026-08-09 layout
 * overhaul that table sits in the pit at `TX = 2.7, TZ = -5.0`, mirrored by
 * the roulette wheel across the avenue — the only green felt on that floor
 * with a standing dealer. They import this constant rather than retyping it,
 * so the two sides of the bridge cannot drift apart.
 *
 * Measured in the world when first wired
 * (`scripts/probes/w19-blackjack-seats.mjs`): four seats carry this string
 * (world z −4.15 since the move), each with its own stand point 0.80 m behind
 * — which is the
 * `approach` the ask insisted on, and 69 of this world's seats still lack.
 *
 * `__blackjack.open()` still works and is still the right way to drive the
 * cabinet from a check that is not about the seat.
 *
 * STILL STALE ELSEWHERE, and not mine to edit under the item that fixed this
 * one: `scripts/L-blackjack-inworld.mjs` (its header, and a paragraph it PRINTS
 * on every run) and the `L-blackjack-inworld` entry in `scripts/checks.mjs` both
 * still say the felt table registers no seats. Both also cite
 * `notes/BLOCKED-L.md`, which has moved to `notes/archive/`.
 */
export const SEAT_LABEL = 'sit at the blackjack table';

/**
 * THE STANDING WAY IN. 2026-08-10: "remove chairs for all games and tables in
 * casino. it actually is just annoying." No seat carries SEAT_LABEL any more —
 * ct/int-casino.ts places an [E] spot at the rail and calls this instead. The
 * locked diegetic view is unchanged; only the sitting is gone, so the seat
 * watcher this file used to run went with the stools. No-op until register()
 * has run; the panel opens once ./hud lands, the same promise the seat had.
 */
let openStanding: (() => void) | null = null;
export function openTable(): void { openStanding?.(); }

export function register(ctx: CtxBuild): void {
  /** What a chip is worth. NOT a second number — read from `ct/slots.ts`, which
   *  is where the one rate lives, so the casino cannot quietly have two
   *  exchange rates in two rooms of the same building. */
  let CHIP = 1;
  // THE BANK IS THE WALLET. 2026-08-10, Erick: *"i dont like this cash out
  // buy in thing. i just want it simple."* No buy-in, no rail, no cash-out:
  // DEAL takes the bet straight out of the purse, and every win counts
  // straight back in — which is exactly what makes the HUD's green tick fire
  // per win, the thing he loves watching in this room. `flush()` on close
  // pays anything the count had not finished; money never pools at the felt.
  const table = createTable({
    bank: {
      get: () => Math.floor(ctx.purse.cash / CHIP + 1e-9),
      add: (d) => { ctx.purse.cash += d * CHIP; ctx.refreshWallet(); },
    },
  });
  let panel: Panel | null = null;
  let lastT = -1;
  openStanding = () => panel?.open();

  /** which printed region the pointer is over, for the painter's wash */
  let hover: number | null = null;
  void Promise.all([import('./hud'), import('./slots')]).then(([{ makePanel }, slots]) => {
    CHIP = slots.CREDIT;
    panel = makePanel({
      // ON THE FELT ITSELF. 2026-08-09: *"blackjack and roulettte need to be
      // diagetic similar to all the other locked perspective UIs."* The canvas
      // hangs on the `blackjack-felt` mesh ct/int-casino.ts names for it, and
      // the view locks straight down onto the table — the drawer's grammar,
      // not the calendar's, because a felt is horizontal and its normal
      // carries no heading (`faceYaw` says which way to square up: the seats
      // face −z, at the dealer). Cards land ON the table, the action regions
      // are printed on the baize, and the world's own rail and dealer frame
      // it. `mesh()` returning null still degrades to the screen-space
      // cabinet, the framework's own promise.
      id: 'ct-blackjack',
      w: FELT.w, h: FELT.h, scale: 2,
      chrome: 'none',
      // CLICK-ONLY (2026-08-09): *"make that click only"* — no `key` handler.
      // Every verb is a printed region on the felt (`buttonsFor`); Escape and
      // [E] still leave, through the framework.
      hint: () => (table.view().phase === 'betting'
        ? 'stack chips on the felt, then DEAL'
        : 'click the felt — HIT · STAND · DOUBLE · SPLIT'),
      draw: (g, w, h) => paintTable(g, w, h, table.view(), hover),
      surface: {
        mesh: () => ctx.scene.getObjectByName('blackjack-felt') ?? null,
        // the eye clamps to 1.75 m over the floor (`poseFor`), so 0.92 above
        // the 0.83 m felt lands exactly on the clamp — as high over the table
        // as a body gets. The fov is what fits the 1.6 m width, derived with
        // boardStandoff's pessimistic 1.5 window aspect.
        standoff: 0.92,
        fov: 62,
        faceYaw: 0,
        hot: (x, y) => {
          const btns = buttonsFor(table.view());
          const i = buttonIx(x, y, btns.length);
          return i !== null && btns[i].live;
        },
        move: (x, y) => { hover = buttonIx(x, y, buttonsFor(table.view()).length); },
        click: (x, y) => {
          const btns = buttonsFor(table.view());
          const i = buttonIx(x, y, btns.length);
          if (i === null) return;
          const b = btns[i];
          if (!b.live) return;
          if (b.act === 'deal') table.deal();
          else if (b.act === 'chip') table.betAdd(b.n ?? 0);
          else if (b.act === 'clear') table.betClear();
          // LEAVE closes the panel — Escape's own path, so onClose flushes
          // the table exactly as if the player had pressed the key. [E]
          // still leaves too, through the framework.
          else if (b.act === 'leave') { panel?.close(); return; }
          else table.act(b.act);
          panel?.repaint();
        },
      },
      // The wallet already holds everything but the bet in play, so leaving
      // is honest by construction; flush() pays any win the count had not
      // finished moving (and plays out a mid-dealer round) before the felt
      // clears — a mid-decision exit forfeits only the bet in the middle,
      // as at a real table.
      onClose: () => { hover = null; table.flush(); },
    });
  });

  // Registered synchronously so its declared ORDER is honoured — `crosstown.ts`
  // sorts HOOKS once, at build time, and a hook pushed after that runs last
  // whatever it asked for. It no-ops until the panel arrives.
  ctx.onFrame((f) => {
    if (!panel) return;
    // Since the chairs went (2026-08-10) the panel is opened by openTable()
    // — the [E] spot at the rail — and closed only by its own ways out:
    // Escape, [E], and the printed LEAVE all close through the framework
    // (hud.ts), which is what keeps "a panel you cannot close" impossible
    // here. The seat watcher that used to open and force-close this panel
    // (the hard-won "NOT SEATED MEANS NOT OPEN" block — see git history)
    // went with the stools: with no seat to lose, there is nothing for a
    // force-stand to strand.
    if (!panel.isOpen()) {
      lastT = -1;
      return;
    }
    // `Frame.t` is wall time; `Frame.dt` is clamped to 0.05 by src/main.ts so a
    // long frame cannot teleport a body through a wall. A table you sit at is an
    // interface, not physics — see the same note in ct/slots.ts.
    const dt = lastT < 0 ? 0 : Math.max(0, f.t - lastT);
    lastT = f.t;
    table.tick(dt);
    panel.repaint();
  }, HOOK.LATE);

  (globalThis as unknown as Record<string, unknown>).__blackjack = {
    open: () => panel?.open(),
    close: () => panel?.close(),
    view: () => table.view(),
    buyIn: (n: number) => table.buyIn(n),
    deal: () => table.deal(),
    act: (m: Move) => table.act(m),
    cash: () => ctx.purse.cash,
    chip: () => CHIP,
    rules: () => ({ ...RULES, dealer: dealerRule() }),
  };
}
