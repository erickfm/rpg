import type { ActionResult, GameState } from './types';
import { owns, ownedRecords } from './goods';
import { FRIENDS_THRESHOLD, citizenById } from './citizens';

/**
 * Personal favors — a two-part quest each named citizen asks of you as you earn
 * their trust. Tier 1 opens once you're friends; clearing it unlocks a bigger,
 * more personal Tier 2. Each checks state you've already built and pays off in
 * cash and a line that deepens who they are. Pure and testable; talking to the
 * citizen with the condition met completes the current favor.
 *
 * NOTE: a Tier-1 favor's id IS the citizen id, so old saves (which stored bare
 * citizen ids in state.favors) still read as "Tier 1 done".
 */

export interface Favor {
  id: string;
  citizen: string;
  requires?: string; // a prior favor id that must be complete first
  title: string;
  ask: string;
  objective: string;
  reward: number;
  met: (s: GameState) => boolean;
  done: string;
}

export const FAVORS: Favor[] = [
  // ---- Gloria: thrift, then real security ----
  {
    id: 'gloria', citizen: 'gloria', title: 'A Word to the Wise', reward: 50,
    ask: 'Gloria: "You\'re young. Put something by — get $500 into savings at First Federal. Promise an old woman."',
    objective: 'Gloria asked you to save $500 in the bank.',
    met: s => s.savings >= 500,
    done: 'Gloria beams. "Five hundred dollars! My kid never listened like that." She folds $50 into your palm. "Seed money."',
  },
  {
    id: 'gloria2', citizen: 'gloria', requires: 'gloria', title: 'Something to Show', reward: 80,
    ask: 'Gloria: "Now the real test — twenty-five hundred in the bank. That\'s not luck anymore. That\'s a person with a future."',
    objective: 'Gloria believes in you: bank $2,500 in savings.',
    met: s => s.savings >= 2500,
    done: 'Gloria looks at the number a long moment, then at you. "I\'m proud of you. I don\'t say that easy." $80, and she means it.',
  },
  // ---- Marcus: a shelf, then the whole collection ----
  {
    id: 'marcus', citizen: 'marcus', title: 'The Listening Club', reward: 40,
    ask: 'Marcus: "Want in the club? Real heads own at least three records. Come back when your shelf means something."',
    objective: 'Marcus wants you to own 3 records.',
    met: s => ownedRecords(s).length >= 3,
    done: 'Marcus flips through your picks, nodding slow. "Okay. Okay — you\'re in." He tucks $40 in your pocket. "Dues, refunded."',
  },
  {
    id: 'marcus2', citizen: 'marcus', requires: 'marcus', title: 'The Complete Set', reward: 70,
    ask: 'Marcus: "There\'s four records worth owning in this whole city. You know the ones. Get all four and we\'ll talk legacy."',
    objective: 'Marcus dares you to own all 4 records.',
    met: s => ownedRecords(s).length >= 4,
    done: 'Marcus lines your four spines up and just grins. "That\'s a collection. That\'s YOU now." He slides you $70. "For the archive."',
  },
  // ---- Rosa: an umbrella, then a real roof ----
  {
    id: 'rosa', citizen: 'rosa', title: 'Rainy Day', reward: 30,
    ask: 'Rosa: "My knee says storms all week. Do me a kindness — buy a real umbrella at the Gas-N-Go. I worry about you."',
    objective: 'Rosa wants you to buy the Golf Umbrella.',
    met: s => owns(s, 'up_umbrella'),
    done: 'Rosa taps your umbrella with her cane, satisfied. "Good. Now you\'ll outlive me." $30, folded small, for your trouble.',
  },
  {
    id: 'rosa2', citizen: 'rosa', requires: 'rosa', title: 'A Roof That Holds', reward: 90,
    ask: 'Rosa: "An umbrella\'s a bandage. What you need is a real place — that loft over on the good side. Get the loft. Then I\'ll rest easy."',
    objective: 'Rosa wants you settled: move into the Skyline Loft.',
    met: s => s.home === 'loft',
    done: 'Rosa stands in your new doorway and nods slowly. "Now THAT\'S a home. My work here is done." She palms you $90 and won\'t explain why.',
  },
  // ---- Dale: any upgrade, then the Regalia ----
  {
    id: 'dale', citizen: 'dale', title: 'A Real Set of Wheels', reward: 40,
    ask: 'Dale: "That beater? Please. Trade up at Big Ray\'s and roll back in something with a pulse. Then we\'ll talk."',
    objective: 'Dale wants you driving something better than the beater.',
    met: s => s.car !== 'beater',
    done: 'Dale walks a slow lap around your ride, whistling. "Now THAT\'S a car." A $40 "finder\'s fee" hits your palm.',
  },
  {
    id: 'dale2', citizen: 'dale', requires: 'dale', title: 'Top of the Line', reward: 75,
    ask: 'Dale: "You want my respect? The Regalia LX. Big Ray\'s finest. Park one of THOSE out front and I\'ll salute you."',
    objective: 'Dale dares you to own the Regalia LX (the sedan).',
    met: s => s.car === 'sedan',
    done: 'Dale actually salutes. "A man of taste. I misjudged you." He slips you $75. "Don\'t tell Ray I said the LX was worth it."',
  },
];

function citizenFavors(citizenId: string): Favor[] {
  return FAVORS.filter(f => f.citizen === citizenId);
}

/** The current favor a citizen is offering (next uncompleted, prerequisites met), or null. */
export function activeFavor(s: GameState, citizenId: string): Favor | null {
  if ((s.friends[citizenId] ?? 0) < FRIENDS_THRESHOLD) return null;
  for (const f of citizenFavors(citizenId)) {
    if (s.favors.includes(f.id)) continue;
    if (f.requires && !s.favors.includes(f.requires)) return null; // gated behind an earlier tier
    return f;
  }
  return null;
}

/** True if the citizen has any favor on offer right now. */
export function favorActive(s: GameState, citizenId: string): boolean {
  return activeFavor(s, citizenId) !== null;
}

/** The request line while the current favor is offered but its condition is unmet. */
export function favorAsk(s: GameState, citizenId: string): string | null {
  const f = activeFavor(s, citizenId);
  return f && !f.met(s) ? f.ask : null;
}

/** Complete the current favor when you talk to the citizen with the condition met. */
export function completeFavor(s: GameState, citizenId: string): ActionResult | null {
  const f = activeFavor(s, citizenId);
  if (!f || !f.met(s)) return null;
  const name = citizenById(citizenId)?.name ?? 'They';
  const state: GameState = {
    ...s,
    favors: [...s.favors, f.id],
    cash: s.cash + f.reward,
    messages: [...s.messages, `${f.title}: done. ${name} won't forget it.`],
  };
  return { ok: true, state, msg: `${f.done} +$${f.reward}` };
}

/** Objective lines for every currently-offered favor, for the journal. */
export function activeFavorObjectives(s: GameState): string[] {
  const out: string[] = [];
  for (const c of ['gloria', 'marcus', 'rosa', 'dale']) {
    const f = activeFavor(s, c);
    if (f) out.push(`${f.met(s) ? '✓ ' : '• '}${f.objective}`);
  }
  return out;
}
