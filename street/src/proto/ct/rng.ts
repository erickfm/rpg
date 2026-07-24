// The street's fixed dimensions. Everything else is measured off these.
export const L = 96;          // street length into -z
export const ROAD_HALF = 5.0; // road: parking lane + travel lane each side, tight
export const WALK = 2.0;      // sidewalk width
export const FACE = ROAD_HALF + WALK; // building faces at ±7
export const PARK_X = 3.9;    // parking lane centre
export const DRIVE_X = 1.5;   // travel lane centre
export const FOG_NEAR = 9, FOG_FAR = 60;

// ONE shared seeded stream. Order of rnd() calls determines tree heights
// and pigeon placement — do not reorder construction across modules.
let seed = 9797 >>> 0;
export const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
