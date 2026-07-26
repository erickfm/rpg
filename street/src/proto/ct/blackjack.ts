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

const BETS = [1, 2, 5, 10, 25];

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
    if (phase === 'dealing') return '';
    if (phase === 'player') {
      const h = hands[active];
      if (!h) return '';
      const v = value(h.cards.map((c) => c.card));
      return hands.length > 1 ? `HAND ${active + 1} — ${v.total}${v.soft ? ' SOFT' : ''}` : '';
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
      const alive = hands.some((h) => !value(h.cards.map((c) => c.card)).bust && h.outcome !== 'lose');
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
