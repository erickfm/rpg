// The street's fixed dimensions. Everything else is measured off these.
export const L = 96;          // street length into -z
export const ROAD_HALF = 5.0; // road: parking lane + travel lane each side, tight
export const WALK = 2.0;      // sidewalk width
export const FACE = ROAD_HALF + WALK; // building faces at ±7
export const PARK_X = 3.9;    // parking lane centre
export const DRIVE_X = 1.5;   // travel lane centre
// Haze used to start 9 m from your face and go opaque by 60 m, which blurred
// things well inside the block. Pushed back so you can read the length of the
// street. NOT pushed further: the fog is load-bearing — it's what swallows the
// cross-buildings closing each end (street runs 96 m) and the far end of the
// side street (which runs to x=55). Take FOG_FAR much past ~100 and you start
// seeing the seams of the world instead of a city continuing past them.
export const FOG_NEAR = 22, FOG_FAR = 100;

// ONE shared seeded stream. Order of rnd() calls determines tree heights
// and pigeon placement — do not reorder construction across modules.
let seed = 9797 >>> 0;
export const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
