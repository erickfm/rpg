// WEED TUFTS — grass sprouting through a hard surface, as one call.
//
// The user liked the ones at the car lot's fence base
// (`shots/user-weeds.png`) and wants them on the street and in the park.
// Exported here rather than re-drawn twice, the same way `citizenSprite` is one
// call for a person: the look lives in one place, and a fix to it fixes every
// caller.
//
//   import { weedTuft } from './weeds';
//   scene.add(weedTuft({ x, z, y: groundY }));                    // dark ground
//   scene.add(weedTuft({ x, z, y: groundY, tone: 'dry', scale: 1.2, seed: i }));
//
// ── the look, and why it is what it is ──
//
// TWO CROSSED QUADS, not one. A single plane vanishes edge-on, and a tuft of
// grass that disappears as you walk past is worse than no tuft: it draws the
// eye to the fact that it is a sprite. Two quads at 90° cost one extra
// triangle pair and never present zero width.
//
// `alphaTest`, never `transparent`. A cut-out discards the fragment rather
// than blending it, so tufts do not sort against each other or against the
// fence behind them — and `transparent: true` would put them on `dimWorld`'s
// skip list and leave them at full daylight brightness after dark, which is
// the fault the lot's bunting had for weeks.
//
// The blades lean, and lean differently per blade, from a fixed pattern rather
// than randomness — the texture is baked once and shared by every tuft in the
// world, so the variation between tufts comes from `scale` and `seed`, not
// from repainting the canvas.
import * as THREE from 'three';
import { pixTex, dither, declareSurface } from './paint';

/** How the tuft is coloured. See the note on GROUND CONTRAST below. */
export type WeedTone = 'dark' | 'dry';

export interface WeedOpts {
  /** where the tuft stands, in world x/z */
  x: number;
  z: number;
  /** the ground height it sits on. Ask `groundAt(x, z)` — do not remember it. */
  y?: number;
  /** 1 is the lot's tuft, about 0.30 m across and 0.35 m tall. 0.7-1.3 reads
   *  as the same species at different ages; past 1.6 it reads as a shrub. */
  scale?: number;
  /** which palette — `dark` for asphalt and shadow, `dry` for pale paving and
   *  grass. Default `dark`. */
  tone?: WeedTone;
  /** any integer. Turns the tuft a little and picks its lean, so a row of
   *  tufts from a loop counter does not look stamped. */
  seed?: number;
}

// One texture and one material per tone for the whole world. Every tuft shares
// them, so a thousand tufts cost two draw-call materials rather than a
// thousand — and a caller cannot accidentally make a second copy of the look.
const CACHE = new Map<WeedTone, THREE.MeshBasicMaterial>();

/** the three greens per tone, darkest first */
const PALETTE: Record<WeedTone, [string, string, string]> = {
  // The lot's own, tuned against asphalt: mid-dark olive, so it separates from
  // a dark ground by hue rather than by brightness.
  dark: ['#57682e', '#6e7a3a', '#7d8646'],
  // Straw and bleached olive, for ground that is PALER or GREENER than the
  // tuft. Against a mown field the dark palette is green-on-green and vanishes;
  // this one is what actually grows in a path crack — half dead, seeding, and
  // it reads as a different plant rather than a lighter copy of the same one.
  dry: ['#8a8248', '#a2955a', '#b9ad74'],
};

function materialFor(tone: WeedTone): THREE.MeshBasicMaterial {
  const hit = CACHE.get(tone);
  if (hit) return hit;
  const [lo, mid, hi] = PALETTE[tone];
  const t = declareSurface(pixTex(12, 14, (g) => {
    g.clearRect(0, 0, 12, 14);
    for (let b = 0; b < 7; b++) {
      const bx = 2 + ((b * 5) % 9), lean = ((b * 7) % 5) - 2, hgt = 6 + ((b * 11) % 7);
      g.fillStyle = b % 3 === 0 ? mid : (b % 3 === 1 ? lo : hi);
      for (let k = 0; k < hgt; k++) {
        const px = bx + Math.round((lean * k) / hgt);
        g.fillRect(px, 13 - k, 1, 1);
        // the tip splits, which is what makes it read as grass and not a comb
        if (k > hgt - 3) g.fillRect(px + (b % 2 ? 1 : -1), 13 - k, 1, 1);
      }
    }
    dither(g, 12, 14, 6);
  }), 'foliage');
  const m = new THREE.MeshBasicMaterial({ map: t, alphaTest: 0.4, side: THREE.DoubleSide });
  CACHE.set(tone, m);
  return m;
}

/**
 * One tuft, as a group of two crossed quads. Returns it; does not add it.
 *
 * The caller places it, because where a weed belongs is a fact about that
 * caller's ground — a lot puts them where no car drives, a street puts them in
 * the kerb seam, a park puts them at a path edge. This knows how a weed LOOKS,
 * not where one grows.
 */
export function weedTuft(o: WeedOpts): THREE.Group {
  const sc = o.scale ?? 1;
  const seed = (o.seed ?? 0) | 0;
  const m = materialFor(o.tone ?? 'dark');
  const g = new THREE.Group();
  // a fixed hash off the seed: same seed, same tuft, every run and every build
  const h = Math.imul(seed ^ 0x9e37, 2654435761) >>> 0;
  const spin = ((h % 360) / 360) * Math.PI * 2;
  for (const ry of [0, Math.PI / 2]) {
    const q = new THREE.Mesh(new THREE.PlaneGeometry(0.30 * sc, 0.35 * sc), m);
    q.rotation.y = ry + spin;
    q.position.y = 0.175 * sc;          // sits ON the ground, not through it
    g.add(q);
  }
  g.position.set(o.x, o.y ?? 0, o.z);
  return g;
}
