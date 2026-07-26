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
