// ── THE BODY YOU ARE STUCK WITH ────────────────────────────────────────────
//
// *"in character creation the options should simply be hair, height, build,
//  skin color, immutables. start them in some unisex boring outfit."*
//   (2026-08-05)
//
// **CHARACTER CREATION IS FOR WHAT YOU CANNOT CHANGE LATER.** The first pass at
// that screen offered the seven wardrobe slots, which was a second copy of the
// mirror in 301 — clothes are the one thing in this world you can already
// change any time you like, so putting them behind a one-time screen was
// exactly backwards. What belongs there is the body: five facts about a person
// that the game never offers to alter again.
//
// ── WHY THIS IS NOT IN `ct/wardrobe.ts` ────────────────────────────────────
//
// That file's whole contract is *"the single source of what he is WEARING"* —
// exclusive within a slot, independent across, index 0 is the empty state, and
// every entry can be cycled off at the glass. None of that is true of a shin
// bone. A build is not a garment you can take off, there is no "no skin", and
// nothing here may ever appear in the mirror's click-through. Two different
// lifetimes, two different files.
//
// ── AND WHY IT IMPORTS NOTHING ─────────────────────────────────────────────
//
// The same reason `ct/wardrobe.ts` and `ct/calendar.ts` import nothing:
// `ct/hud.ts` reads it for the first-person arm, `ct/mirror.ts` reads it for the
// figure, `ct/create.ts` writes it, and hud is imported BY mirror. A module in
// an import cycle can be silently dropped from the BUILT BUNDLE ONLY (GOTCHAS
// §28: dev looks perfect and the artifact has no skin colour in it). **Do not
// add an import to this file.**

export type Trait = 'hair' | 'hairCol' | 'height' | 'build' | 'skin';

/**
 * ── SKIN, AND IT IS THREE COLOURS RATHER THAN ONE ─────────────────────────
 *
 * `base` is the lit face of a limb, `lo` the shaded side (the neck under the
 * jaw, the far leg), `hi` a highlight the figure uses sparingly. Three values
 * per tone rather than one darkened programmatically, because a computed shade
 * of a deep tone goes muddy and a computed shade of a pale one goes pink —
 * these are picked as sets.
 *
 * ⚠ INDEX 2 IS `#c9946a` AND MUST STAY THE DEFAULT. That literal is what
 * `ct/mirror.ts` and `ct/hud.ts` both hard-coded before this file existed, so a
 * player who never opens creation is pixel-identical to yesterday's world.
 */
export interface Tone { name: string; base: string; lo: string; hi: string }

const SKINS: readonly Tone[] = [
  { name: 'PALE',  base: '#e8c3a3', lo: '#c9a183', hi: '#f4d8bd' },
  { name: 'FAIR',  base: '#dcae86', lo: '#bb8e68', hi: '#ecc5a3' },
  { name: 'TAN',   base: '#c9946a', lo: '#a87a54', hi: '#d8a67d' },
  { name: 'OLIVE', base: '#ac7c50', lo: '#8b613b', hi: '#c0946a' },
  { name: 'BROWN', base: '#8a5a38', lo: '#6c4227', hi: '#a0714c' },
  { name: 'DEEP',  base: '#5c3a24', lo: '#452a19', hi: '#74503a' },
];

/**
 * ── HAIR IS A SILHOUETTE, NOT STRANDS ─────────────────────────────────────
 *
 * `ct/mirror.ts` already drew one haircut as a single shape and said why: this
 * world paints a head the way `ct/citizens.ts` paints five views of one, as a
 * block. So a style is a `kind` the painter switches on, exactly as a garment
 * is — two people with the same cut in different colours are one shape and one
 * branch, and adding a colourway costs a row in the table below.
 *
 * `SHORT` is index 1 and is the cut the figure has always had.
 */
export interface Hair { name: string; kind: string }

const HAIRS: readonly Hair[] = [
  { name: 'SHAVED', kind: 'shaved' },
  { name: 'SHORT', kind: 'short' },
  { name: 'CROPPED', kind: 'crop' },
  { name: 'MESSY', kind: 'messy' },
  { name: 'BOWL', kind: 'bowl' },
  { name: 'PONYTAIL', kind: 'tail' },
  { name: 'LONG', kind: 'long' },
];

/** ⚠ INDEX 1 IS `#3a2c22`, the literal the mirror drew hair with before this
 *  file — the same "nobody wakes up different" rule as the skin default. */
export interface HairCol { name: string; hex: string; lo: string }

const HAIR_COLS: readonly HairCol[] = [
  { name: 'BLACK', hex: '#1d1813', lo: '#100d0a' },
  { name: 'DARK BROWN', hex: '#3a2c22', lo: '#291f18' },
  { name: 'BROWN', hex: '#5a3f28', lo: '#412c1c' },
  { name: 'AUBURN', hex: '#6e3320', lo: '#4f2317' },
  { name: 'SANDY', hex: '#a9803f', lo: '#7e5d2c' },
  { name: 'BLONDE', hex: '#c9a45e', lo: '#9a7a42' },
  { name: 'GREY', hex: '#8e8b86', lo: '#6b6864' },
  { name: 'WHITE', hex: '#d8d4cc', lo: '#a9a59d' },
];

/**
 * ── HEIGHT, AND WHAT IT IS ALLOWED TO TOUCH TODAY ─────────────────────────
 *
 * A UNIFORM SCALE ABOUT THE FEET, applied by `ct/mirror.ts` to the whole figure
 * — never a vertical stretch. *"give me true proportions in the mirror i feel
 * stretched"* cost that file three fixes and a measured table; a taller person
 * is a bigger person, not a longer one.
 *
 * ⚠ IT DOES NOT MOVE THE EYE YET, and that is a decision rather than an
 * oversight — see the note at `heightScale`.
 */
export interface Step { name: string; k: number }

const HEIGHTS: readonly Step[] = [
  { name: 'VERY SHORT', k: 0.92 },
  { name: 'SHORT', k: 0.96 },
  { name: 'AVERAGE', k: 1 },
  { name: 'TALL', k: 1.04 },
  { name: 'VERY TALL', k: 1.08 },
];

/**
 * ── BUILD, IN THE UNITS THE FIGURE IS ALREADY DRAWN FROM ──────────────────
 *
 * `torso` is added to `TORSO_HW` (12) and `leg` to `LEG_HW` (4), which are the
 * half-widths every span, every hem, every waistband and every hit zone in
 * `ct/mirror.ts` is derived from — so widening the build widens the shirt over
 * it for free, at all eight facings, with no garment knowing it happened.
 *
 * ⚠ `+2` IS THE CEILING AND IT IS GEOMETRIC, not taste. The figure is 40 design
 * units wide with the centre line at 20, and the arms hang at
 * `CX - TORSO_HW - ARM_W + 1`. At `TORSO_HW` 14 that is x = 1; one step wider
 * and the far arm is off the canvas.
 */
export interface BuildStep { name: string; torso: number; leg: number }

const BUILDS: readonly BuildStep[] = [
  { name: 'SLIGHT', torso: -2, leg: -1 },
  { name: 'AVERAGE', torso: 0, leg: 0 },
  { name: 'STOCKY', torso: 2, leg: 1 },
];

const RACK = {
  hair: HAIRS, hairCol: HAIR_COLS, height: HEIGHTS, build: BUILDS, skin: SKINS,
} as const;

export const TRAITS: readonly Trait[] = ['hair', 'hairCol', 'height', 'build', 'skin'];
export const TRAIT_NAME: Record<Trait, string> = {
  hair: 'HAIR', hairCol: 'HAIR COL', height: 'HEIGHT', build: 'BUILD', skin: 'SKIN',
};

/** THE DEFAULTS ARE WHAT THE FIGURE ALREADY LOOKED LIKE — see the two ⚠ notes
 *  above. A world with no `ct-body` in storage paints exactly as it did before
 *  this file was written. */
const at: Record<Trait, number> = { hair: 1, hairCol: 1, height: 2, build: 1, skin: 2 };

const WATCHERS: (() => void)[] = [];
/** the mirror repaints from it, the hud throws away its cached arm, and the
 *  creation screen redraws the doll — nobody polls */
export function onBodyChange(fn: () => void): void { WATCHERS.push(fn); }

export function traitIndex(t: Trait): number { return at[t]; }
export function traitName(t: Trait): string { return RACK[t][at[t]].name; }
export function traitCount(t: Trait): number { return RACK[t].length; }

export function skin(): Tone { return SKINS[at.skin]; }
export function hair(): Hair { return HAIRS[at.hair]; }
export function hairColour(): HairCol { return HAIR_COLS[at.hairCol]; }
export function build(): BuildStep { return BUILDS[at.build]; }

/**
 * How tall he is drawn, as a multiplier on the figure's 152 design units.
 *
 * ⚠ **THIS IS NOT THE EYE HEIGHT AND MUST NOT BE WIRED TO IT WITHOUT DOING THE
 * ARITHMETIC.** `fp.ts` already takes a `height` option and defaults it to 1.62,
 * so the wiring itself is one line — but `HEAD_CLEAR` (0.06) is documented there
 * as *"squeezed from both sides and the band is 0.10 m wide"*, measured as the
 * headroom above a **1.62** eye standing on each top in flat 301: bed 0.47,
 * drawer 0.38, radiator 0.31, TV 0.11, dresser 0.10. A `VERY TALL` eye at 1.75
 * puts the TV and the dresser UNDER the standing eye, which switches the head
 * clamp off exactly where it was added to stop *"i clip through the ceiling"*.
 * The change costs a re-measure of that table and of every lintel, not a line.
 */
export function heightScale(): number { return HEIGHTS[at.height].k; }

const clamp = (i: number, n: number) => ((i % n) + n) % n;

/** Set a trait by index. Wraps, so a UI can just add or subtract. */
export function setTrait(t: Trait, i: number): void {
  const n = RACK[t].length;
  const k = clamp(i, n);
  if (at[t] === k) return;
  at[t] = k;
  save();
  for (const f of WATCHERS) f();
}
/** Next/previous. `dir` is +1 or −1 and it wraps. */
export function cycleTrait(t: Trait, dir: number): void { setTrait(t, at[t] + dir); }

// ── IT SURVIVES A RELOAD ───────────────────────────────────────────────────
//
// BY NAME, never by index, exactly as `ct/wardrobe.ts` stores a garment by id —
// re-ordering the skin table must not silently repaint somebody.
//
// ⚠ EVERY TOUCH OF `localStorage` IS GUARDED. Reading it can THROW in a
// sandboxed iframe rather than return null, and an exception at module init is
// a black page with no world in it.

const KEY = 'ct-body';

function save(): void {
  try {
    const out: Record<string, string> = {};
    for (const t of TRAITS) out[t] = RACK[t][at[t]].name;
    localStorage.setItem(KEY, JSON.stringify(out));
  } catch { /* private mode, sandboxed iframe, quota — none of it is fatal */ }
}

function load(): void {
  let raw: string | null = null;
  try { raw = localStorage.getItem(KEY); } catch { return; }
  if (!raw) return;
  try {
    const got = JSON.parse(raw) as Record<string, unknown>;
    for (const t of TRAITS) {
      const n = got[t];
      if (typeof n !== 'string') continue;
      const i = RACK[t].findIndex((o) => o.name === n);
      if (i >= 0) at[t] = i;
    }
  } catch { /* corrupt entry: keep the defaults rather than half-apply it */ }
}
load();

/** everything, for `ct/save.ts` — names, so the blob survives a re-ordered
 *  table the same way storage does */
export function captureBody(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const t of TRAITS) out[t] = RACK[t][at[t]].name;
  return out;
}
export function restoreBody(v: Record<string, string>): void {
  for (const t of TRAITS) {
    const n = v[t];
    if (typeof n !== 'string') continue;
    const i = RACK[t].findIndex((o) => o.name === n);
    if (i >= 0) at[t] = i;
  }
  save();
  for (const f of WATCHERS) f();
}
