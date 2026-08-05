// ── WHAT THE PLAYER IS WEARING ─────────────────────────────────────────────
//
// *"the following can be customized and are not mutually exclusive between
//  category (one shirt swaps for jacket but shirt doesnt swap for pants). tops
//  (short shirts, long sleeves, jackets, sweaters, dresses, etc), bottoms
//  (pants, shorts, skirts), shoes (sandals, sneakers), hats (baseball, sunhat),
//  glasses (sunglasses, regular glasses), watch (no watch, digital watch,
//  analog watch). maximum naked must include white undies."*   (2026-08-04)
//
// SIX SLOTS. Within a slot the options are exclusive — a jacket replaces a
// sweater, because you have one torso. Across slots nothing interacts except
// the one case he created himself by listing dresses under tops; see `full`.
//
// ── WHY THIS IS ITS OWN MODULE, AND WHY IT IMPORTS NOTHING ─────────────────
//
// `ct/hud.ts` draws your forearm and your watch, `ct/mirror.ts` draws the whole
// of you, and `ct/apartment.ts` hangs the glass they are seen in. Those three
// cannot import each other — hud is imported BY apartment, and a module in an
// import cycle can be silently dropped from the BUILT BUNDLE ONLY (GOTCHAS §28:
// dev looks perfect and the artifact has no wardrobe in it). So the fact lives
// here, in a leaf that imports nothing at all — not three, not `ctx`, not
// `paint` — exactly like `ct/calendar.ts`, which exists for the same reason.
// **Do not add an import to this file.**
//
// ── "MAXIMUM NAKED MUST INCLUDE WHITE UNDIES", STRUCTURALLY ────────────────
//
// The underwear is NOT the first option in a list — an option can be replaced,
// and a rule that says "never take the last one off" is a rule someone deletes
// in six weeks. **The white vest and the white briefs are what an EMPTY slot
// IS.** `TOPS[0]` and `BOTTOMS[0]` are the empty states and they are drawn as
// underwear by every painter that reads this file. There is no index that means
// bare, so there is no state to forbid, and nothing anyone adds to either list
// can create one.

export type Slot = 'top' | 'bottom' | 'shoes' | 'hat' | 'glasses' | 'watch' | 'bag';

/** The six, in the order he said them — which is also head-to-toe enough to
 *  read as a list in the mirror. */
export const SLOTS: readonly Slot[] = ['top', 'bottom', 'shoes', 'hat', 'glasses', 'watch', 'bag'];

/** What the mirror calls each slot when you have a hand on it. */
export const SLOT_NAME: Record<Slot, string> = {
  top: 'TOP', bottom: 'BOTTOM', shoes: 'SHOES', hat: 'HAT',
  glasses: 'GLASSES', watch: 'WATCH', bag: 'BAG',
};

/**
 * One thing you can put on.
 *
 * `kind` is what the PAINTERS switch on, and it is deliberately coarser than
 * `id`: two sweaters in different colours are one shape and one `kind`, so
 * adding a colourway costs a row in a table and no drawing code at all. Every
 * painter must have a default arm for a `kind` it does not know — a new garment
 * should look wrong, never crash the mirror.
 */
export interface Garment {
  /** stable across sessions — this is what is written to storage */
  id: string;
  /** what the mirror prints. Short: the glass is 0.42 m wide. */
  name: string;
  /** which silhouette to draw */
  kind: string;
  /** the main cloth */
  cloth: string;
  /** trim: a cuff, a peak, a sole, a waistband, a frame */
  trim: string;
  /**
   * TOPS ONLY — how far down the arm the cloth goes. 0 bare (a tee: the
   * forearm you see in first person is skin), 2 to the wrist.
   *
   * This is the field `ct/hud.ts` reads, and it is the reason a top is not
   * purely cosmetic: put a sweater on and your own forearm has a sleeve and a
   * cuff on it for the rest of the game.
   */
  sleeve?: 0 | 2;
  /** TOPS ONLY — rows of hem below the waist. A tee tucks; a jacket hangs. */
  hem?: number;
  /**
   * TOPS ONLY — THIS GARMENT FILLS THE BOTTOM SLOT AS WELL. A dress.
   *
   * He listed dresses under TOPS, so a dress is a top; but a dress is also
   * unarguably the thing on your legs. **It CLAIMS both slots** rather than
   * merely hiding what is under it — `showing('bottom')` returns the dress, so
   * every painter draws one garment and no painter needs to know the rule.
   *
   * The trousers you had on are remembered, not discarded, and `wear` handles
   * the swap in both directions (see it). The alternative — an inert bottoms
   * control while a dress is on — is a control the player clicks and nothing
   * happens, which is worse than the ambiguity it avoids.
   */
  full?: boolean;
  /** BOTTOMS ONLY — how far down the leg. 0 briefs, 1 shorts, 2 knee, 3 ankle */
  leg?: 0 | 1 | 2 | 3;
  /**
   * BAGS ONLY — HOW MUCH IT CARRIES, and it is not decoration.
   *
   * *"add to mirror options: bag (backpack, tote, crossbody)"*, and the bag you
   * WEAR is the bag you OPEN — the carousel on your wrist has nothing to show
   * when this slot is empty, the same way *"no watch"* means nothing rises.
   * So a tote genuinely holds less than a backpack, and the number lives on the
   * garment because the garment IS the container: there is no second table
   * anywhere that could disagree about how big your bag is.
   *
   * 8 / 4 / 5 — a backpack, a tote you carry in one hand, and a crossbody that
   * is small but deep. **These are a first guess and they are cheap to retune**;
   * the design decision that matters is that they DIFFER, which is what makes
   * choosing a bag a choice rather than a colour.
   */
  hold?: number;
}

// ── THE RACK ───────────────────────────────────────────────────────────────
//
// A few real options each, and no more: this is a wardrobe in a rented room in
// 1997, not a shop. Colours are the block's own palette — the greys, rusts and
// navies the street is already painted in — so a dressed player standing in the
// world does not read as a character from a different game.
//
// **INDEX 0 OF `top` AND `bottom` IS THE UNDERWEAR AND MUST STAY THERE.** See
// the header. Everything else in a list may be reordered freely.

const TOPS: readonly Garment[] = [
  { id: 'vest', name: 'WHITE VEST', kind: 'vest', cloth: '#e9e6de', trim: '#c9c5ba', sleeve: 0, hem: 0 },
  { id: 'tee', name: 'RUST TEE', kind: 'tee', cloth: '#a4574a', trim: '#7d4038', sleeve: 0, hem: 2 },
  { id: 'longsleeve', name: 'LONG SLEEVE', kind: 'tee', cloth: '#2f4f6b', trim: '#24405a', sleeve: 2, hem: 2 },
  // the colours `ct/hud.ts`'s player palette has carried since it was written,
  // where they were commented "a sweater here" and never drawn. They are drawn
  // now, and this is the garment they were always describing.
  { id: 'sweater', name: 'SWEATER', kind: 'sweater', cloth: '#3f4a5c', trim: '#333c4a', sleeve: 2, hem: 4 },
  { id: 'denim', name: 'DENIM JACKET', kind: 'jacket', cloth: '#4a6285', trim: '#35496a', sleeve: 2, hem: 6 },
  { id: 'dress', name: 'SUNDRESS', kind: 'dress', cloth: '#7f9a6a', trim: '#61794f', sleeve: 0, hem: 4, full: true },
];

const BOTTOMS: readonly Garment[] = [
  { id: 'briefs', name: 'WHITE UNDIES', kind: 'briefs', cloth: '#e9e6de', trim: '#c9c5ba', leg: 0 },
  { id: 'jeans', name: 'JEANS', kind: 'trousers', cloth: '#46536e', trim: '#37425a', leg: 3 },
  { id: 'track', name: 'TRACK PANTS', kind: 'trousers', cloth: '#2b2f36', trim: '#d8d4c8', leg: 3 },
  { id: 'shorts', name: 'SHORTS', kind: 'trousers', cloth: '#6d7a52', trim: '#57633f', leg: 1 },
  { id: 'skirt', name: 'SKIRT', kind: 'skirt', cloth: '#5c4658', trim: '#483644', leg: 2 },
];

const SHOES: readonly Garment[] = [
  { id: 'bare', name: 'BARE FEET', kind: 'bare', cloth: '#c9946a', trim: '#a87a54' },
  { id: 'sneakers', name: 'SNEAKERS', kind: 'sneaker', cloth: '#dcd8cd', trim: '#9a2f34' },
  { id: 'sandals', name: 'SANDALS', kind: 'sandal', cloth: '#8a6a45', trim: '#6b5136' },
  { id: 'boots', name: 'BOOTS', kind: 'boot', cloth: '#3a2e26', trim: '#261e19' },
];

const HATS: readonly Garment[] = [
  { id: 'nohat', name: 'NO HAT', kind: 'none', cloth: '#000000', trim: '#000000' },
  { id: 'cap', name: 'BALL CAP', kind: 'cap', cloth: '#2f4f6b', trim: '#24405a' },
  { id: 'sunhat', name: 'SUN HAT', kind: 'sun', cloth: '#d9c894', trim: '#8a6a45' },
];

const GLASSES: readonly Garment[] = [
  { id: 'noglasses', name: 'NO GLASSES', kind: 'none', cloth: '#000000', trim: '#000000' },
  // `cloth` IS UNUSED ON THIS ONE and that is the point of it: *"regular
  // glasses should be see through"*, so the figure paints the frame and leaves
  // the lens empty. The colour is kept rather than blanked so a future painter
  // that wants a glint on the glass has the value to hand.
  { id: 'specs', name: 'GLASSES', kind: 'clear', cloth: '#b6c6cf', trim: '#2a2a2e' },
  // `shades`, not `sun` — the SUN HAT already owns that kind, and the item
  // painter switches on `kind` alone with no idea which slot it came from.
  { id: 'shades', name: 'SUNGLASSES', kind: 'shades', cloth: '#1e232b', trim: '#16161a' },
];

/**
 * THE WATCH, AND IT IS NOT COSMETIC.
 *
 * `ct/hud.ts` raises a whole forearm when you look down, with an LCD on it
 * reading CROSSTOWN QUARTZ. So the three options here have three different
 * consequences, and the hud implements all of them:
 *
 *   none    — nothing to raise. Looking down at a bare wrist shows a bare
 *             wrist, so the limb stays off-screen entirely.
 *   digital — the LCD that has always been there, unchanged, texel for texel.
 *   analog  — a brass case with a cream dial and two hands, on a leather strap.
 *
 * `cloth` is the STRAP and `trim` is the CASE; the hud reads both rather than
 * keeping a second copy of either colour.
 */
const WATCHES: readonly Garment[] = [
  { id: 'nowatch', name: 'NO WATCH', kind: 'none', cloth: '#000000', trim: '#000000' },
  { id: 'digital', name: 'DIGITAL WATCH', kind: 'digital', cloth: '#26282e', trim: '#3a3d45' },
  { id: 'analog', name: 'ANALOG WATCH', kind: 'analog', cloth: '#5a3f2a', trim: '#b9a267' },
];

/**
 * THE SEVENTH SLOT, and the only one whose choice has consequences beyond
 * looking at yourself.
 *
 * *"add to mirror options: bag (backpack, tote, crossbody)"*   (2026-08-04)
 *
 * `kind` is the SHAPE and the shape is what the figure paints — a pack behind
 * the shoulders, a bag hanging off a hand, a strap across the chest are three
 * genuinely different silhouettes rather than one bag in three colours.
 *
 * INDEX 0 IS NO BAG, exactly as index 0 is the underwear on tops and bottoms
 * and *"no watch"* on the wrist. Cycling reaches it, so a bag can always be
 * taken off — and `bagWorn()` is what the carousel asks before it offers you
 * anything to open.
 */
const BAGS: readonly Garment[] = [
  { id: 'nobag', name: 'NO BAG', kind: 'none', cloth: '#000000', trim: '#000000', hold: 0 },
  { id: 'backpack', name: 'BACKPACK', kind: 'pack', cloth: '#3f4a3a', trim: '#2a3227', hold: 8 },
  { id: 'tote', name: 'TOTE BAG', kind: 'tote', cloth: '#c9a45e', trim: '#8a7a52', hold: 4 },
  { id: 'crossbody', name: 'CROSSBODY', kind: 'sling', cloth: '#4a3626', trim: '#2f2318', hold: 5 },
];

const RACK: Record<Slot, readonly Garment[]> = {
  top: TOPS, bottom: BOTTOMS, shoes: SHOES, hat: HATS, glasses: GLASSES,
  watch: WATCHES, bag: BAGS,
};

/** Everything that can be put in a slot. The mirror scrubs through this. */
export function options(slot: Slot): readonly Garment[] { return RACK[slot]; }

// ── WHAT IS ON RIGHT NOW ───────────────────────────────────────────────────
//
// THE DEFAULT IS WHAT THE PLAYER ALREADY LOOKED LIKE. A tee (bare forearm) and
// a digital watch is exactly what `ct/hud.ts` drew before this file existed, so
// a save-less first load is pixel-identical to yesterday's world and nobody
// wakes up dressed differently because a feature shipped.

const wornAt: Record<Slot, number> = {
  top: 1, bottom: 1, shoes: 1, hat: 0, glasses: 0, watch: 1, bag: 0,
};

/** THE BAG YOU HAVE ON, which is the bag you can open. `hold` is 0 when there
 *  is none, so a caller can ask one question instead of two. */
export function bagWorn(): Garment { return worn('bag'); }
/** How much the bag on your back carries. 0 = you are not wearing one. */
export function bagCapacity(): number { return worn('bag').hold ?? 0; }

/** the last top that was NOT a dress, so taking a dress off can put it back */
let lastPlainTop = 1;

const WATCHERS: (() => void)[] = [];
/** Called whenever anything is put on or taken off. The hud uses it to throw
 *  away a cached watch face; the mirror repaints from it. */
export function onWardrobeChange(fn: () => void): void { WATCHERS.push(fn); }

/** What is in a slot. Never null — an empty slot holds the empty garment. */
export function worn(slot: Slot): Garment { return RACK[slot][wornAt[slot]]; }

/** Its index, for a UI that wants to scrub rather than name. */
export function wornIndex(slot: Slot): number { return wornAt[slot]; }

/**
 * WHAT IS ACTUALLY DRAWN ON A SLOT — the dress rule, in one place.
 *
 * A painter asks this and never asks `worn('bottom')` directly, so no painter
 * carries the rule and no painter can implement it differently from the next
 * one. For the other five slots this is `worn`.
 */
export function showing(slot: Slot): Garment {
  if (slot === 'bottom' && worn('top').full) return worn('top');
  return worn(slot);
}

const clamp = (i: number, n: number) => ((i % n) + n) % n;

/**
 * Put something on. Wraps, so a UI can just add or subtract.
 *
 * THE DRESS SWAP, BOTH WAYS, because a dress occupies two slots and both
 * controls have to keep doing something visible:
 *
 *   · choose a BOTTOM while a dress is on → the dress comes off and the last
 *     top you actually wore goes back on. You cannot end up in a dress and
 *     jeans, and you never lose your shirt to a control you did not touch.
 *   · choose the DRESS → your trousers stay in the drawer at `wornAt.bottom`
 *     and come back the moment the dress does off, so the slot is claimed and
 *     not cleared.
 */
export function wear(slot: Slot, index: number): void {
  const n = RACK[slot].length;
  const i = clamp(index, n);
  if (slot === 'bottom' && worn('top').full) {
    // taking the dress off is part of choosing trousers — see above
    wornAt.top = lastPlainTop;
  }
  if (wornAt[slot] === i && slot !== 'bottom') return;
  wornAt[slot] = i;
  if (slot === 'top' && !worn('top').full) lastPlainTop = i;
  save();
  for (const f of WATCHERS) f();
}

/** Next/previous in a slot. `dir` is +1 or −1 and it wraps. */
export function cycle(slot: Slot, dir: number): void {
  // FROM WHAT IS SHOWING, not from what is stored: while a dress is on, the
  // bottoms slot reads as the dress, and stepping forward from a remembered
  // pair of jeans would look like the control skipped.
  const from = slot === 'bottom' && worn('top').full ? -1 : wornAt[slot];
  wear(slot, from + dir);
}

// ── IT SURVIVES A RELOAD ───────────────────────────────────────────────────
//
// By `id`, never by index, so re-ordering a rack or dropping a garment does not
// silently dress the player in whatever moved into that row. An id that is no
// longer in the rack falls back to the default for that slot.
//
// ⚠ EVERY TOUCH OF `localStorage` IS GUARDED. The published artifact runs in a
// sandboxed iframe where reading it can THROW rather than return null, and an
// exception at module init is a black page with no world in it. A player who
// cannot persist an outfit should get an unremembered outfit, not no game.

const KEY = 'ct-wardrobe';

function save(): void {
  try {
    const out: Record<string, string> = {};
    for (const s of SLOTS) out[s] = RACK[s][wornAt[s]].id;
    localStorage.setItem(KEY, JSON.stringify(out));
  } catch { /* private mode, sandboxed iframe, quota — none of it is fatal */ }
}

function load(): void {
  let raw: string | null = null;
  try { raw = localStorage.getItem(KEY); } catch { return; }
  if (!raw) return;
  try {
    const got = JSON.parse(raw) as Record<string, unknown>;
    for (const s of SLOTS) {
      const id = got[s];
      if (typeof id !== 'string') continue;
      const i = RACK[s].findIndex((g) => g.id === id);
      if (i >= 0) wornAt[s] = i;
    }
    if (!worn('top').full) lastPlainTop = wornAt.top;
  } catch { /* corrupt entry: keep the defaults rather than half-apply it */ }
}
load();
