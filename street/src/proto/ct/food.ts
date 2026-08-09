import { BUILD } from './ctx';
import { hudNote } from './hud';
import { heal } from './health';
import { itemOf } from './inventory';
import {
  BURGER, CHICKEN, FRIES, PIE, SHAKE,
  EGGS, PLATTER, SANDWICH, CHIPS,
} from './goods';
import { flush } from './save';

// ══ EATING, AND WHAT IT PUTS BACK ═══════════════════════════════════════════
//
// *"you can heal by sleeping or by eating food with food giving diff amounts
//  of health"*   (2026-08-08)
//
// The sleeping half is `ct/fatigue.ts` — a real night restores him in full.
// This is the food half, and it follows fatigue's own pattern exactly: the
// items already exist and already sell (`ct/goods.ts`, plus CEREAL and SODA in
// `ct/inventory.ts`'s founding table), they just could not be eaten. So each
// gets an EAT/DRINK verb attached at registration by mutation — `defineItem`
// returns the stored object, so this touches the one def the bag reads, no
// second declaration, no load-order race with the shops that sell the ids.
//
// There is exactly ONE way food reaches your mouth in this world: every food
// line at every counter goes through `ct/shop.ts`'s `buy()`, which `give()`s
// the item into the bag (only the hotel sells through `serve`, and a night is
// not food). Nothing is "eaten at the counter" — you buy the parcel, and you
// eat it out of the bag, the same gesture as drinking the coffee. One path,
// one table, one place for the numbers.
//
// ── THE TABLE — the one copy, keyed by inventory id ─────────────────────────
//
// Points of health per item, scaled against the two fixed stars it sits
// between: a night's sleep is a FREE full restore (~100 on the average spec),
// and the economy is ×4 with rent at $500 a season, so food is already paid
// for at the counter. The shape is roughly two points a dollar, with a proper
// sit-down meal earning a better rate than a snack — a platter is dinner, a
// bag of chips is mostly air and the icon says so. Nothing on a menu comes
// near out-healing a night in a bed, and nothing is so stingy that buying it
// for the health is a mistake.
//
// COFFEE is deliberately absent: it is a stimulant, `ct/fatigue.ts`'s tenant,
// and a cup of burnt diner coffee is not a meal. POPCORN too — it is a carton
// of UNCOOKED microwave bags ("the box says two and a half minutes") and this
// world has no microwave; the bag offering EAT on raw kernels would be a verb
// that lies. The prices in the margin are each seller's own board price.
export const FOOD_HEAL: Record<string, number> = {
  PLATTER: 30,     // $15.00 diner — the proper meal, the ceiling of the table
  CHICKEN: 18,     // $9.00 barn
  EGGS: 18,        // $9.00 diner
  SANDWICH: 18,    // $9.00 bodega deli
  BURGER: 15,      // $7.50 barn
  CEREAL: 12,      // $10.00 bodega — a box eaten dry, no milk in this world
  SHAKE: 10,       // $5.00 barn / $6.00 diner
  PIE: 8,          // $2.75 barn / $5.50 diner
  FRIES: 6,        // $3.50 barn
  CHIPS: 4,        // $3.00 bodega — mostly air, and it always was
  SODA: 3,         // $3.00 barn / $3.50 diner / $5.00 bodega
};

/** One meal. The item's `use.act` calls this; the bag consumes the item
 *  (a void return is "eaten outright" — `ct/bag.ts`'s own rule). Healing past
 *  full just clamps: `heal` goes through `setHealth`, which cannot overfill. */
function eat(id: string, line: string): void {
  heal(FOOD_HEAL[id] ?? 0);
  // One short line, no panel — the HUD bar moving is most of the receipt; the
  // words are the flavour, in the world's grain, and they describe the eating
  // rather than promise a number (a man already at full still ate the pie).
  hudNote(line, 3000);
  flush();
}

/** Late in the second band, beside `ct/fatigue.ts` and for its reasons: every
 *  `defineItem` this touches ran at module import, well before any register
 *  band, and nothing here constructs a THREE object (GOTCHAS §2). */
export const ORDER = BUILD.INTERIOR + 10;      // 90

export function register(): void {
  // The nine `ct/goods.ts` declares, mutated the way fatigue.ts made COFFEE
  // drinkable — the import IS the load-order guarantee.
  BURGER.use = { verb: 'eat', act: () => eat('BURGER', 'gone in six bites. you feel steadier.') };
  CHICKEN.use = { verb: 'eat', act: () => eat('CHICKEN', 'the box rattled because it was full. better already.') };
  FRIES.use = { verb: 'eat', act: () => eat('FRIES', 'the ones at the bottom were the good ones.') };
  PIE.use = { verb: 'eat', act: () => eat('PIE', 'the filling takes the roof of your mouth. worth it.') };
  SHAKE.use = { verb: 'drink', act: () => eat('SHAKE', 'you fight the straw and win.') };
  EGGS.use = { verb: 'eat', act: () => eat('EGGS', 'gone cold in the clamshell. they land where they should.') };
  PLATTER.use = { verb: 'eat', act: () => eat('PLATTER', 'the whole platter. a real meal, and you feel it.') };
  SANDWICH.use = { verb: 'eat', act: () => eat('SANDWICH', 'the deli did you right.') };
  CHIPS.use = { verb: 'eat', act: () => eat('CHIPS', 'mostly air, some salt.') };
  // The two founding foods in `ct/inventory.ts`, not exported by name —
  // `itemOf` returns the stored def for a declared id, so the mutation lands
  // on the same object the bag reads.
  itemOf('CEREAL').use = { verb: 'eat', act: () => eat('CEREAL', 'dry, by the handful. the birds can have the rest.') };
  itemOf('SODA').use = { verb: 'drink', act: () => eat('SODA', 'warm sugar water. it counts, barely.') };
}
