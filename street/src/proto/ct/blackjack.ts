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
  /** chips in front of the player. Not money — see `cashOut`. */
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
  /** raise or lower the stake between hands */
  betBy(d: number): void;
  /** deal a round. False if it cannot — no chips, or a hand in progress. */
  deal(): boolean;
  act(m: Move): boolean;
  buyIn(chips: number): void;
  cashOut(): number;
  settled(): boolean;
}

/**
 * THE STAKES, AND WHY THEY ARE ALL EVEN.
 *
 * A blackjack pays 3:2, so an ODD bet pays a half chip — and it did: twenty
 * hands of playtesting left the rail reading `101.5`, and `cashOut` handed that
 * to `ctx.purse.cash` as `25.375`, a third of a cent the wallet paints as
 * $25.38 while holding something else. That is float money in the one account,
 * which is precisely the fault `ct/slots.ts` fixed by paying in whole credits.
 *
 * A real table solves it with a MINIMUM, which is what a minimum is partly for:
 * every stake here is even, so 3:2 is always a whole number of chips, and so is
 * a double (2x) and a split (two equal bets). At 25c a chip this is a 50c
 * table, which is what a 1997 neighbourhood floor would have had.
 *
 * The alternative — rounding the payout down — would have quietly shortchanged
 * the player on every natural, which is the same swindle as 6:5 wearing a
 * different hat.
 */
const BETS = [2, 4, 10, 20, 50];

/**
 * A table. Holds a shoe, the chips in front of you and a hand in progress;
 * knows nothing about money, panels, seats or the world.
 *
 * Same shape as `createMachine` in `ct/slots.ts` on purpose — chips exist only
 * between sitting down and standing up, `cashOut` empties the rail, and
 * whatever wires it up is required to call that when the player leaves. It is
 * what makes "two games, one wallet" true rather than hoped for.
 */
export function createTable(opts: { rng?: Rng } = {}): Table {
  const shoe = makeShoe(opts.rng ?? Math.random);
  let phase: Phase = 'betting';
  let chips = 0, betIx = 0, t = 0;
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
    h.cards.length === 2 && chips >= h.bet && (hands.length === 1 || RULES.doubleAfterSplit);
  const canSplit = (h: typeof hands[0]) =>
    h.cards.length === 2 && hands.length < RULES.maxHands && chips >= h.bet
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

  const settle = () => {
    const dv = value(dealer.map((c) => c.card));
    owed = 0;
    for (const h of hands) {
      const pv = value(h.cards.map((c) => c.card));
      if (h.outcome) { owed += h.outcome === 'blackjack' ? h.bet * (1 + RULES.blackjackPays)
        : h.outcome === 'push' ? h.bet : 0; continue; }
      if (pv.bust) { h.outcome = 'bust'; continue; }
      if (dv.bust || pv.total > dv.total) { h.outcome = 'win'; owed += h.bet * 2; }
      else if (pv.total < dv.total) { h.outcome = 'lose'; }
      else { h.outcome = 'push'; owed += h.bet; }
    }
    phase = 'settle'; phaseT = 0; paid = 0; payRamp = 0;
  };

  const says = (): string => {
    if (phase === 'betting') return chips < BETS[betIx] ? 'BUY IN TO PLAY' : 'PLACE YOUR BET';
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
    phase, chips, bet: BETS[betIx], active, t, holeTurnT,
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
      chips += whole - paid; paid = whole;
      if (payRamp >= owed) {
        chips += owed - paid; paid = owed; returned += owed;
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
      chips -= h.bet; staked += h.bet; h.bet *= 2;
      place(h.cards);
      h.done = true; queueAdvance();
      return true;
    }
    if (m === 'split') {
      splitAces = h.cards[0].card.r === 1;
      const moved = h.cards.pop()!;
      chips -= h.bet; staked += h.bet;
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
    betBy: (d) => {
      if (phase !== 'betting') return;
      betIx = Math.max(0, Math.min(BETS.length - 1, betIx + d));
    },
    deal: () => {
      if (phase !== 'betting') return false;
      const bet = BETS[betIx];
      if (chips < bet) return false;
      if (shoe.remaining() <= 12) shoe.shuffle();     // the cut card, between rounds only
      chips -= bet; staked += bet;
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
    buyIn: (n) => { if (n > 0 && phase === 'betting') chips += Math.floor(n); },
    cashOut: () => {
      // Same contract as the slot machine's: whatever is ON THE RAIL always
      // comes back, whenever you stand up. A bet already in the middle of a
      // hand is gone, exactly as it is at a real table.
      const n = chips; chips = 0;
      phase = 'betting'; hands = []; dealer = []; active = -1;
      owed = 0; paid = 0; payRamp = 0;
      return n;
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
// The user: "'Very nice and impressive' is about the presentation: the felt, the
// cards, the chips, the deal animation, the dealer's hole card turning over.
// Same 1997 idiom, same shared panel."
//
// THE CARDS ARE DRAWN, NOT TYPED. The pips are pixel shapes rather than the
// Unicode ♠♥♦♣, because a glyph is whatever font the browser happens to have and
// this world draws everything by hand at a known density. It also means the
// check can tell a heart from a diamond, which it could not do with text.

/** Same logical size as the slot machine's face, so the two games sit in the
 *  same cabinet rather than resizing K's bezel between them. */
export const FELT = { w: 320, h: 256 } as const;

/** What one chip costs, for the ONE question the felt has to answer about money:
 *  can this player buy in at all. The authority is `CREDIT` in `ct/slots.ts` and
 *  `register()` below reads it from there — this is the painter's fallback for
 *  when it is drawn outside the world, and the in-world check asserts the two
 *  agree so the fallback cannot quietly become a second rate. */
let CHIP_HINT = 0.25;
export const setChipValue = (v: number): void => { CHIP_HINT = v; };

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
 *  eventually been wrong (GOTCHAS §20). */
export const LAYOUT = {
  shoe: { x: 292, y: 30 },
  dealer: { x: 160, y: 56 },
  player: { x: 160, y: 148 },
  // 18, not 15. At 15 of a 26 px card the second card covered more than half
  // the first and a five-card hand was a stack of edges; 18 leaves each card's
  // corner and its pip readable, which is how a hand is actually fanned.
  cardW: 26, cardH: 38, overlap: 18,
  say: [22, 186, 276, 14] as const,
  meterY: 204, meterH: 20,
  btnY: 230, btnH: 15,
} as const;

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
  g.fillRect(left + 1, top + 2 + lift, w, h);            // its shadow stays on the felt
  if (!c) {
    // face down: the house's own back, a red lattice
    g.fillStyle = T.cardEdge; g.fillRect(left, top, w, h);
    g.fillStyle = T.back; g.fillRect(left + 1, top + 1, w - 2, h - 2);
    if (w > 8) {
      g.fillStyle = T.backHi;
      for (let i = 2; i < h - 2; i += 4) g.fillRect(left + 2, top + i, w - 4, 1);
      g.fillStyle = T.gold;
      g.fillRect(left + w / 2 - 2, top + h / 2 - 2, 4, 4);
    }
    return;
  }
  g.fillStyle = T.cardEdge; g.fillRect(left, top, w, h);
  g.fillStyle = T.card; g.fillRect(left + 1, top + 1, w - 2, h - 2);
  g.fillStyle = T.cardLo; g.fillRect(left + 1, top + h - 2, w - 2, 1);
  if (w < 9) return;                                     // edge-on: no face to read
  const red = c.s === 1 || c.s === 2;
  g.fillStyle = red ? T.red : T.black;
  g.font = 'bold 8px monospace'; g.textAlign = 'left';
  g.fillText(RANKS[c.r], left + 2, top + 9);
  PIP[c.s](g, x, y - lift + 4, 1);
}

/** The value badge under a hand — what it is worth, said plainly, because a
 *  player should never be counting in their head at a table that knows. */
const badge = (g: Paint2D, v: HandValue, x: number, y: number, lit: boolean) => {
  const label = v.bust ? 'BUST' : `${v.total}${v.soft && v.total !== 21 ? ' SOFT' : ''}`;
  const w = Math.max(22, label.length * 5 + 8);
  g.fillStyle = v.bust ? T.lose : lit ? T.gold : T.feltLo;
  g.fillRect(x - w / 2, y, w, 11);
  g.fillStyle = v.bust || lit ? T.black : T.ink;
  g.font = 'bold 7px monospace'; g.textAlign = 'center';
  g.fillText(label, x, y + 8);
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
    paintCard(g, card, x, y, flip, k < 1 ? (1 - e) * 6 : 0);
  });
};

/**
 * Draw the table, letterboxed into whatever the panel gives us.
 *
 * `t` is the TABLE's own clock, the same one the cards were timed against —
 * not a wall clock. Handing it anything else would make cards fly from the
 * wrong place, which is why `TableView` publishes it rather than leaving the
 * caller to keep its own.
 */
export function paintTable(
  g: Paint2D, w: number, h: number, v: TableView,
  /** the player's POCKETS, in the wallet's units. Same contract as the slot
   *  machine's: the table knows nothing about dollars and is handed the one
   *  fact it cannot derive — whether "BUY IN TO PLAY" is advice or a taunt. */
  cash?: number,
): void {
  const s = Math.max(0.1, Math.min(w / FELT.w, h / FELT.h));
  g.save();
  g.fillStyle = T.rail; g.fillRect(0, 0, w, h);
  g.translate((w - FELT.w * s) / 2, (h - FELT.h * s) / 2);
  g.scale(s, s);

  // the felt, and the rail round it
  g.fillStyle = T.rail; g.fillRect(0, 0, FELT.w, FELT.h);
  g.fillStyle = T.felt; g.fillRect(6, 6, FELT.w - 12, 190);
  g.fillStyle = T.feltHi; g.fillRect(6, 6, FELT.w - 12, 1);
  g.fillStyle = T.feltLo; g.fillRect(6, 195, FELT.w - 12, 1);

  // THE ARC, and the two lines every real table has printed on it. The user
  // asked for the dealer's rule to be visible; `dealerRule()` derives it from
  // RULES so the printed line and the behaviour cannot drift.
  // THE ARC. A real table has a curve swept across the felt between the dealer
  // and the players, with the two printed lines sitting inside it. This was a
  // `strokeRect` — an axis-aligned box, which is the one shape a betting arc is
  // not, and it read as a stray empty frame around nothing.
  g.fillStyle = T.feltHi;
  for (let x = 16; x < FELT.w - 16; x += 1) {
    const k = (x - FELT.w / 2) / (FELT.w / 2 - 16);
    g.fillRect(x, 96 + Math.round(k * k * 10), 1, 1);
  }
  g.textAlign = 'center'; g.font = 'bold 9px monospace';
  g.fillStyle = T.gold;
  g.fillText('BLACKJACK PAYS 3 TO 2', FELT.w / 2, 114);
  g.font = '7px monospace'; g.fillStyle = T.dim;
  g.fillText(dealerRule(), FELT.w / 2, 126);

  // the shoe, top right, which is where every card comes from
  g.fillStyle = T.railHi; g.fillRect(LAYOUT.shoe.x - 12, LAYOUT.shoe.y - 16, 24, 30);
  g.fillStyle = T.rail; g.fillRect(LAYOUT.shoe.x - 10, LAYOUT.shoe.y - 14, 20, 26);
  g.fillStyle = T.back; g.fillRect(LAYOUT.shoe.x - 8, LAYOUT.shoe.y - 12, 16, 20);
  // HOW MANY DECKS ARE IN IT, said on the table.
  //
  // The user asked for this in as many words — *"Real cards, real deck, shuffled
  // — and if you shoe it, say how many"* — and I had said it in a comment, in a
  // commit message and in the ledger, which is everywhere except the one place
  // a player can see. A shoe with an unstated deck count is exactly the thing he
  // was guarding against: six decks and one deck are different games and the
  // difference is invisible from the outside.
  //
  // Read from RULES, so the placard and the shoe cannot disagree.
  g.fillStyle = T.gold; g.font = 'bold 6px monospace'; g.textAlign = 'center';
  g.fillText(`${RULES.decks} DECKS`, LAYOUT.shoe.x, LAYOUT.shoe.y + 22);
  g.fillStyle = T.dim; g.font = '6px monospace';
  g.fillText(String(Math.max(0, v.shoeLeft)), LAYOUT.shoe.x, LAYOUT.shoe.y + 30);

  // ── the dealer ──
  if (v.dealer.cards.length) {
    paintHand(g, v.dealer, LAYOUT.dealer.x, LAYOUT.dealer.y, v.t, v.holeTurnT);
    const showing = v.dealer.cards.every((c) => !c.faceDown);
    badge(g, v.dealer.value, LAYOUT.dealer.x, LAYOUT.dealer.y + 24, showing && v.phase === 'dealer');
  }

  // ── the player, one hand or two ──
  v.hands.forEach((hand, i) => {
    const many = v.hands.length > 1;
    const hx = many ? LAYOUT.player.x + (i === 0 ? -68 : 68) : LAYOUT.player.x;
    paintHand(g, hand, hx, LAYOUT.player.y, v.t, -1);
    badge(g, hand.value, hx, LAYOUT.player.y + 24, i === v.active);
    // THE STAKE, as a chip BESIDE the badge rather than under it. It was at
    // `player.y + 44`, which is inside the message strip — the chip was drawn
    // and then painted over, so a split hand's individual bet was invisible
    // exactly when two of them mattered.
    g.fillStyle = T.chip;
    g.beginPath(); g.arc(hx - 32, LAYOUT.player.y + 29, 7, 0, Math.PI * 2); g.fill();
    g.fillStyle = T.goldLo;
    g.beginPath(); g.arc(hx - 32, LAYOUT.player.y + 29, 4, 0, Math.PI * 2); g.fill();
    g.fillStyle = T.black; g.font = 'bold 7px monospace'; g.textAlign = 'center';
    g.fillText(String(hand.bet), hx - 32, LAYOUT.player.y + 32);
    if (hand.outcome) {
      // OPPOSITE THE CHIP, on the badge's line — not above the cards, which is
      // where it was and which is where the printed rule already is. It landed
      // across "DEALER MUST DRAW TO 16" on every settled hand.
      //
      // Kept per-hand even though the message strip says it too, because on a
      // SPLIT the two hands can differ and the strip can only say "1 WON 1
      // LOST" — which does not tell you which.
      const won = hand.outcome === 'win' || hand.outcome === 'blackjack';
      g.fillStyle = won ? T.win : hand.outcome === 'push' ? T.dim : T.lose;
      g.font = 'bold 7px monospace'; g.textAlign = 'center';
      g.fillText(hand.outcome.toUpperCase(), hx + 34, LAYOUT.player.y + 32);
    }
    if (many && i === v.active) {
      g.strokeStyle = T.gold; g.lineWidth = 1;
      g.strokeRect(hx - 44.5, LAYOUT.player.y - 23.5, 89, 60);
    }
  });

  // ── what the table is saying ──
  const [sx, sy, sw, sh] = LAYOUT.say;
  g.fillStyle = T.rail; g.fillRect(sx, sy, sw, sh);
  g.fillStyle = T.railHi; g.fillRect(sx, sy, sw, 1);
  g.textAlign = 'center'; g.font = '7px monospace';
  g.fillStyle = v.phase === 'settle' || v.phase === 'paying' ? T.win : T.dim;
  // Telling a player with nothing in their pockets to BUY IN is the same taunt
  // the slot machine used to give — see the note beside `NO CASH IN YOUR
  // POCKETS` in ct/slots.ts. One fact, two games, said the same way.
  const says = (v.phase === 'betting' && v.chips < v.bet
    && cash !== undefined && cash < CHIP_HINT) ? 'NO CASH IN YOUR POCKETS' : v.says;
  if (says) g.fillText(says, FELT.w / 2, sy + 10);

  // ── the meters ──
  const meter = (mx: number, mw: number, label: string, val: string, lit: boolean) => {
    g.fillStyle = '#12180f'; g.fillRect(mx, LAYOUT.meterY, mw, LAYOUT.meterH);
    g.strokeStyle = T.railHi; g.lineWidth = 1;
    g.strokeRect(mx + 0.5, LAYOUT.meterY + 0.5, mw - 1, LAYOUT.meterH - 1);
    g.fillStyle = '#2c4a24'; g.font = '6px monospace'; g.textAlign = 'left';
    g.fillText(label, mx + 4, LAYOUT.meterY + 8);
    g.fillStyle = lit ? T.win : '#7ae05a';
    g.font = 'bold 10px monospace'; g.textAlign = 'right';
    g.fillText(val, mx + mw - 4, LAYOUT.meterY + 17);
  };
  meter(22, 130, 'CHIPS', String(v.chips), v.phase === 'paying');
  meter(160, 66, 'BET', String(v.bet), false);
  meter(232, 66, 'PAID', String(v.paid), v.phase === 'paying');

  // ── the buttons ──
  //
  // What the TABLE says you may do, never a fixed row greyed out by the
  // painter's own opinion. `moves` is the rules speaking; a button drawn live
  // here and refused by `act` would be the interface disagreeing with the game,
  // which is the fault this whole feature is arranged to prevent.
  const btns: [string, string, boolean][] = v.phase === 'betting'
    ? [['DEAL', 'deal', v.chips >= v.bet], ['BET -', 'betdown', true], ['BET +', 'betup', true],
      ['BUY IN', 'buyin', true]]
    : [['HIT', 'hit', v.moves.includes('hit')], ['STAND', 'stand', v.moves.includes('stand')],
      ['DOUBLE', 'double', v.moves.includes('double')], ['SPLIT', 'split', v.moves.includes('split')]];
  const bw = (FELT.w - 44 - 3 * 6) / 4;
  btns.forEach(([label, , live], i) => {
    const bx = 22 + i * (bw + 6);
    g.fillStyle = live ? T.gold : '#4a4842';
    g.fillRect(bx, LAYOUT.btnY, bw, LAYOUT.btnH);
    g.fillStyle = live ? '#f0d68a' : '#5a5852';
    g.fillRect(bx, LAYOUT.btnY, bw, 1);
    g.fillStyle = live ? T.black : '#7a7872';
    g.font = 'bold 7px monospace'; g.textAlign = 'center';
    g.fillText(label, bx + bw / 2, LAYOUT.btnY + 10);
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
 * THE SEAT THIS OPENS AT, and the reason it is not wired yet.
 *
 * The slots bridge on G's `'sit at the slot'`, which is unambiguous — 96 stools
 * and nothing else carries it. **Every table stool on that floor publishes
 * `'sit at the table'`**: roulette's five, craps's six and poker's six. Bridging
 * on that string would open a blackjack game at the roulette wheel, which is
 * worse than not shipping it.
 *
 * So this waits for a label of its own. `notes/BLOCKED-L.md` asks G for three or
 * four seats on the player side of the felt table at `TX = -2.6, TZ = -13.0` —
 * the only game on that floor with a dealer standing at it, and the only one
 * shaped like dealer-versus-player. It registers no seats today, so the one
 * table that is already a blackjack table is the one you cannot sit at.
 *
 * The moment any seat carries this string, the game opens by sitting down with
 * no further change here. `__blackjack.open()` works meanwhile.
 */
export const SEAT_LABEL = 'sit at the blackjack table';

interface SeatRow { pose: object; label: string }
interface CtWindow { __ct?: { seated: () => object | null; seats: () => SeatRow[] } }

function seatedAtTable(): object | null {
  const ct = (globalThis as unknown as CtWindow).__ct;
  if (!ct) return null;
  const pose = ct.seated();
  if (!pose) return null;
  return ct.seats().find((s) => s.pose === pose)?.label === SEAT_LABEL ? pose : null;
}

export function register(ctx: CtxBuild): void {
  const table = createTable();
  let panel: Panel | null = null;
  let lastT = -1;
  // The same dismissal guard `ct/slots.ts` carries, and the same note applies:
  // since C's seat-exit fix (`e090a74fa`, `f110b7f5a`) leaving the panel leaves
  // the seat as well, so this is currently unreachable. Kept for the reason
  // given there — its unreachability is a fact about K's and C's files, not
  // about this one.
  let dismissed: object | null = null;
  /** What a chip is worth. NOT a second number — read from `ct/slots.ts`, which
   *  is where the one rate lives, so the casino cannot quietly have two
   *  exchange rates in two rooms of the same building. */
  let CHIP = 0.25;

  const cashOut = () => {
    const n = table.cashOut();
    if (n <= 0) return;
    ctx.purse.cash += n * CHIP;
    ctx.refreshWallet();
  };
  const buyIn = () => {
    if (!table.settled()) return;
    const spend = Math.min(20, ctx.purse.cash);          // a twenty, at a table
    const chips = Math.floor(spend / CHIP);
    if (chips <= 0) return;
    ctx.purse.cash -= chips * CHIP;
    ctx.refreshWallet();
    table.buyIn(chips);
  };

  void Promise.all([import('./hud'), import('./slots')]).then(([{ makePanel }, slots]) => {
    CHIP = slots.CREDIT;
    setChipValue(CHIP);          // one rate, and the felt reads the same one
    panel = makePanel({
      // FRAMELESS. `paintTable` already paints a complete table — rail, felt,
      // and its own `BLACKJACK PAYS 3 TO 2` legend (line 1024) — filling the
      // whole FELT.w×FELT.h canvas. The framework's moulded 'machine' bezel
      // used to wrap a SECOND rail around that picture of a first one and
      // stamp the game's name a second time in its title bar. Item 0c,
      // *"i never want there to be menus popping up unless they are embedded
      // to look as if they are in the actual game."*
      id: 'ct-blackjack',
      w: FELT.w, h: FELT.h, scale: 2,
      chrome: 'none',
      hint: () => (table.view().phase === 'betting'
        ? (ctx.purse.cash < CHIP
          ? 'SPACE deal · +/- bet · C cash out'          // no I: nothing to buy in with
          : 'SPACE deal · +/- bet · I buy in $20 · C cash out')
        : 'H hit · S stand · D double · P split'),
      draw: (g, w, h) => paintTable(g, w, h, table.view(), ctx.purse.cash),
      key: (k) => {
        const v = table.view();
        if (v.phase === 'betting') {
          if (k === ' ' || k === 'enter') table.deal();
          else if (k === '+' || k === '=' || k === 'arrowup') table.betBy(1);
          else if (k === '-' || k === 'arrowdown') table.betBy(-1);
          else if (k === 'i') buyIn();
          else if (k === 'c') cashOut();
        } else {
          if (k === 'h') table.act('hit');
          else if (k === 's') table.act('stand');
          else if (k === 'd') table.act('double');
          else if (k === 'p') table.act('split');
        }
        panel?.repaint();
      },
      // Same contract as the slot machine's: the chips always come back, so
      // "what you win is in your wallet when you stand up" is true by
      // construction rather than by remembering to press a button.
      onClose: () => { dismissed = seatedAtTable(); cashOut(); },
    });
  });

  // Registered synchronously so its declared ORDER is honoured — `crosstown.ts`
  // sorts HOOKS once, at build time, and a hook pushed after that runs last
  // whatever it asked for. It no-ops until the panel arrives.
  ctx.onFrame((f) => {
    if (!panel) return;
    const seat = seatedAtTable();
    // ── NOT SEATED MEANS NOT OPEN. NO CONDITION ON IT. ────────────────────
    //
    // This block used to read:
    //
    //     if (seat === null) dismissed = null;        // clears it …
    //     …
    //     if (seat === null && dismissed !== null)    // … then requires it
    //       { panel.close(); return; }
    //
    // The guard cleared `dismissed` and the close then demanded it be
    // non-null, so **the close could never fire.** Any force-stand that was not
    // the panel's own Escape handler — `__ct.stand()` from `ct/hud.ts`, a warp,
    // a floor change — left the table open with nobody sitting at it.
    //
    // And an open panel is not a local problem: `hud.ts` swallows keydown while
    // one is up, so `[E]` was dead EVERYWHERE IN THE WORLD until the page was
    // reloaded. That is the trap the user has already been bitten by twice
    // (the TV seat, his own front door), in its worst form yet — global, and
    // reachable by standing up from a table.
    //
    // Found by w11 while fixing a different seat bug, reported rather than
    // reached for, and confirmed here from the two lines alone.
    if (seat === null) {
      dismissed = null;
      if (panel.isOpen()) { panel.close(); }
      lastT = -1;
      return;
    }
    if (!panel.isOpen()) {
      lastT = -1;
      if (seat !== dismissed) { lastT = f.t; panel.open(); }
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
