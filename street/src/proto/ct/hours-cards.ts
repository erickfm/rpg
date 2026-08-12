import * as THREE from 'three';
import { BUILD, type CtxBuild } from './ctx';
import { pixTex, declareSurface, dither } from './paint';
import { doorPointFor, doorLeafFor } from './doors';
import { frontageWorld, signNight } from './tex-world';
import { tube, VICE_PORTAL_W } from './vice';
import { HOURS, fmtHour, neverCloses, type BizHours } from './hours';

// ══ THE HOURS SIGN BY EVERY DOOR ═════════════════════════════════════════════
//
// The enforcement half of opening hours lives in `ct/hours.ts` (the table),
// `ct/shop.ts` (the counter) and `ct/jobs.ts` (the punch clock). This module
// is the DISCOVERY half: posted hours beside each business door, because a
// sign on the glass is how 1997 answers "when do you open" — not a tooltip.
//
// *"hours signs are kinda ugly, make them less ugly pls"* (2026-08-10) — so
// the one cream card became the four things that actually hang in shop doors:
//
//   open24   the die-cut red plastic OPEN 24 HOURS sign. Rounded,
//            white-rimmed, corners cut away.
//   gilt     a painted card, gold serif on deep green behind bank glass —
//            First Federal and the tax office, who would not use plastic.
//   taped    a hand-lettered card stuck up with tape, hung slightly crooked —
//            the pawn shop and the thrift, who would not buy a sign.
//   plastic  the mall-bought BUSINESS HOURS placard, colour band on white, in
//            the two colourways the sign shop stocked.
//   neon     a small tube in a black casing over a painted rider — added
//            2026-08-11, see `FACADE` below.
//
// ⚠ A SEPARATE MODULE FROM `hours.ts`, NOT TIDINESS. This file needs
// `ct/doors.ts` for where the doors are, doors.ts eagerly globs `int-*.ts`,
// and every int-*.ts reaches `hours.ts` through shop.ts/jobs.ts — so hours.ts
// importing doors.ts would close the GOTCHAS §28 cycle and drop rooms from
// the built bundle only. Nothing imports THIS file; it is a leaf on the safe
// side of the glob, registered by `ct/world.ts`'s own sweep. (`ct/tex-world.ts`
// is imported here too, for `frontageWorld` — no new edge: `ct/doors.ts`
// already imports it, and this file already imports doors.)
export const ORDER = BUILD.PROPS + 7;

// 200 px/m — above the 150 floor because these are small planes carrying
// text, and texel starvation is the blur disease signs die of here.
const PPM = 200;

// deterministic per-building coin: which colourway, which way a taped card
// leans. Name-hashed, never Math.random — the street must not reshuffle its
// signage every reload.
const hash = (s: string): number => {
  let n = 0;
  for (let i = 0; i < s.length; i++) n = (n * 31 + s.charCodeAt(i)) >>> 0;
  return n;
};

// largest whole font size (<= cap) at which `text` fits maxW — MIDNIGHT is a
// long word and "10 AM – MIDNIGHT" must shrink, not clip
function fitFont(g: CanvasRenderingContext2D, text: string, family: string, maxW: number, cap: number): void {
  for (let s = cap; s > 5; s--) {
    g.font = `bold ${s}px ${family}`;
    if (g.measureText(text).width <= maxW) return;
  }
}

// rounded-rect path by hand — no reliance on ctx.roundRect
function rr(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

const hoursLine = (h: BizHours) => `${fmtHour(h.open)} – ${fmtHour(h.close)}`;

interface Card {
  tex: THREE.Texture;
  wM: number;      // plane size, metres
  hM: number;
  tilt: number;    // z-roll, radians — only the taped card hangs crooked
  diecut: boolean; // transparent corners → needs its own alpha-tested material
  /** IS THIS SIGN A LIGHT. Only the neon one is. Declared rather than left to
   *  `ct/props.ts`'s texel heuristic, which is the rule 380a05fc set for every
   *  fascia on the block: a card of ink is stamped `printed` and grades away
   *  after dark with the wall it is stuck to, and a tube holds its own. */
  lit?: boolean;
}

// ── the die-cut plastic OPEN 24 HOURS sign ───────────────────────────────────
function open24Card(): Card {
  const W = 80, H = 60; // 0.40 × 0.30 m
  const tex = pixTex(W, H, (g) => {
    // corners stay transparent — the sign is cut to its shape
    rr(g, 1, 1, W - 2, H - 2, 10);
    g.fillStyle = '#c22a1a'; g.fill();
    g.strokeStyle = '#7f1810'; g.lineWidth = 2; g.stroke();
    rr(g, 5, 5, W - 10, H - 10, 7);
    g.strokeStyle = '#f4f2ea'; g.lineWidth = 2; g.stroke();
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#f4f2ea';
    fitFont(g, 'OPEN', 'sans-serif', 62, 22);
    g.fillText('OPEN', W / 2, 23);
    rr(g, 13, 39, W - 26, 14, 4);
    g.fillStyle = '#f4f2ea'; g.fill();
    g.fillStyle = '#c22a1a';
    fitFont(g, '24 HOURS', 'sans-serif', 48, 9);
    g.fillText('24 HOURS', W / 2, 46);
  });
  return { tex, wM: W / PPM, hM: H / PPM, tilt: 0, diecut: true };
}

// ── the gilt-lettered painted card ───────────────────────────────────────────
function giltCard(h: BizHours): Card {
  const W = 64, H = 52; // 0.32 × 0.26 m
  const tex = pixTex(W, H, (g) => {
    g.fillStyle = '#152b20'; g.fillRect(0, 0, W, H);
    g.strokeStyle = '#c9a648'; g.lineWidth = 1;
    g.strokeRect(2.5, 2.5, W - 5, H - 5);
    g.strokeRect(5.5, 5.5, W - 11, H - 11);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#c9a648'; g.font = 'bold 9px serif';
    g.fillText('H O U R S', W / 2, 15);
    // the sign painter's diamond between the word and the times
    g.beginPath();
    g.moveTo(W / 2, 20); g.lineTo(W / 2 + 2.5, 22.5); g.lineTo(W / 2, 25); g.lineTo(W / 2 - 2.5, 22.5);
    g.closePath(); g.fill();
    g.fillStyle = '#e6c96f';
    fitFont(g, hoursLine(h), 'serif', 50, 10);
    g.fillText(hoursLine(h), W / 2, 36);
    dither(g, W, H, 20);
  });
  return { tex, wM: W / PPM, hM: H / PPM, tilt: 0, diecut: false };
}

// ── the hand-lettered card, taped up crooked ─────────────────────────────────
function tapedCard(h: BizHours): Card {
  const W = 60, H = 52; // 0.30 × 0.26 m
  const lean = (hash(h.building) & 1 ? 1 : -1) * 0.045; // ~2.5°, name-fixed
  const tex = pixTex(W, H, (g) => {
    g.fillStyle = '#f3ecd8'; g.fillRect(0, 0, W, H);
    // curled-edge shade along bottom and right
    g.fillStyle = 'rgba(0,0,0,0.12)';
    g.fillRect(0, H - 1, W, 1); g.fillRect(W - 1, 0, 1, H);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#232a33';
    g.font = 'bold 12px sans-serif';
    g.fillText('OPEN', W / 2, 15);
    g.fillRect(W / 2 - 13, 21, 26, 2); // the marker underline
    fitFont(g, hoursLine(h), 'sans-serif', 54, 10);
    g.fillText(hoursLine(h), W / 2, 34);
    dither(g, W, H, 26);
    // tape across all four corners, drawn last so it lies OVER the ink
    g.fillStyle = 'rgba(216,204,158,0.65)';
    const strip = (x: number, y: number, a: number) => {
      g.save(); g.translate(x, y); g.rotate(a); g.fillRect(-9, -3, 18, 6); g.restore();
    };
    strip(5, 5, -Math.PI / 4); strip(W - 5, 5, Math.PI / 4);
    strip(5, H - 5, Math.PI / 4); strip(W - 5, H - 5, -Math.PI / 4);
  });
  return { tex, wM: W / PPM, hM: H / PPM, tilt: lean, diecut: false };
}

// ── the mall-bought BUSINESS HOURS placard ───────────────────────────────────
function plasticCard(h: BizHours): Card {
  const W = 80, H = 64; // 0.40 × 0.32 m
  const band = hash(h.building) & 1 ? '#b3271e' : '#1f3f7a'; // the two colourways
  const tex = pixTex(W, H, (g) => {
    g.fillStyle = '#26262b'; g.fillRect(0, 0, W, H);      // the plastic frame
    g.fillStyle = '#f2f1ec'; g.fillRect(2, 2, W - 4, H - 4);
    g.fillStyle = band; g.fillRect(2, 2, W - 4, 15);       // the header band
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#f2f1ec';
    fitFont(g, 'BUSINESS HOURS', 'monospace', 70, 9);
    g.fillText('BUSINESS HOURS', W / 2, 10);
    g.fillStyle = '#17181c';
    fitFont(g, hoursLine(h), 'sans-serif', 72, 13);
    g.fillText(hoursLine(h), W / 2, 37);
    g.fillStyle = band; g.font = 'bold 7px sans-serif';
    g.fillText('OPEN DAILY', W / 2, 53);
    // a lick of bevel so the plastic reads moulded, not printed
    g.fillStyle = 'rgba(255,255,255,0.45)'; g.fillRect(2, 2, W - 4, 1);
    g.fillStyle = 'rgba(0,0,0,0.20)'; g.fillRect(2, H - 3, W - 4, 1);
  });
  return { tex, wM: W / PPM, hM: H / PPM, tilt: 0, diecut: false };
}

// ── a neon tube in a black casing, over a painted rider ──────────────────────
//
// The block's three LIT frontages hang a real sign, not a bought one: the two
// vice buildings burn gold and neon at the end of the side street and the
// diner's own projecting blade is a neon tube. A red plastic sticker on a
// rusticated stone hotel front was the wrong object in all three doorways.
//
// The tube is `ct/vice.ts`'s own `tube()` — three passes over one letterform,
// dark casing / phosphor / hot core — deliberately, so this card is drawn by
// the same hand as the marquee it hangs under rather than by something that
// resembles it. The rider under it is FLAT ink and not a second tube: nobody
// bends "10 AM – MIDNIGHT" in glass, and a 16-character tube at this size
// would be mush (`fitTube` would rightly throw).
function neonCard(h: BizHours): Card {
  const W = 88, H = 52; // 0.44 × 0.26 m
  const line = neverCloses(h) ? 'OPEN ALL NIGHT' : hoursLine(h);
  const tex = pixTex(W, H, (g) => {
    // the casing — corners cut away, so the sign is a shape and not a sticker
    rr(g, 1, 1, W - 2, H - 2, 6);
    g.fillStyle = '#14111a'; g.fill();
    g.strokeStyle = '#3a3540'; g.lineWidth = 2; g.stroke();
    tube(g, 'OPEN', W / 2, 19, 22, '#ff3a4a', '#ffe2dc', '#3a1016');
    // the rider: a painted strip screwed under the tube, the way a real one
    // carries the changeable half
    g.fillStyle = '#241f2a'; g.fillRect(6, 34, W - 12, 13);
    g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(6, 34, W - 12, 1);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#7ad8ea';
    fitFont(g, line, 'sans-serif', W - 18, 10);
    g.fillText(line, W / 2, 41);
  });
  return { tex, wM: W / PPM, hM: H / PPM, tilt: 0, diecut: true, lit: true };
}

// ══ WHICH CARD, DECIDED BY WHAT THE BUILDING IS MADE OF ══════════════════════
//
// *"in general have signs match the facades"* (2026-08-11).
//
// It used to be a short name→style map with everything else falling to the
// mall placard, and the colourway inside a style is still a name hash — which
// is fine for a colourway and was wrong for the style itself. A gilt card is
// not a gilt card because the business is called FIRST FEDERAL; it is a gilt
// card because the frontage is cut stone and a stone building does not hang
// plastic. So the building declares its MATERIAL and the material picks the
// sign, which means adding a shop means saying what its front is made of
// rather than remembering which of five cards to point at.
//
// (`ct/tex-world.ts` has a private `characterOf()` doing the same job for the
// FASCIA painter. These want to be one table and are not, because that file is
// the painter's and this is a leaf on the safe side of the door glob. When it
// is exported this map should read it instead of restating it.)
type Facade =
  /** cut stone, granite, civic masonry — the bank, the tax office, the college */
  | 'stone'
  /** the lit frontages: neon, chase bulbs, gold — the casino, the hotel */
  | 'vice'
  /** stainless and glass block, with its own neon blade over the door */
  | 'steel'
  /** a cheap painted board screwed to the brick — the junk shops */
  | 'board'
  /** moulded plastic, plexi and applied letters — a 1997 chain shopfront */
  | 'chain';

const FACADE: Record<string, Facade> = {
  'FIRST FEDERAL': 'stone',       // granite pilasters and a 0.30 m stone jamb
  'A-1 TAX': 'stone',             // an office floor over a masonry ground storey
  'COMMUNITY COLLEGE': 'stone',   // civic: a board screwed to institutional brick
  'SEVENS': 'vice',               // gold portal, 777 in tube, ninety chase bulbs
  'HOTEL ORPHEUS': 'vice',        // rusticated stone under a lit porte-cochère
  'DINER': 'steel',               // stainless fascia, glass block, a neon blade
  'PAWN': 'board',                // painted board, three balls over the door
  'THRIFT': 'board',              // painted board, and nobody has repainted it
  'BURGER BARN': 'chain',         // a moulded plastic light box
  'VIDEO HUT': 'chain',           // blue plexi with the tube showing through
  'VOLT VILLAGE': 'chain',        // a backlit box on a discounter
  'SLEEP CENTER': 'chain',        // applied plastic letters across the band
  'CROSSTOWN FITNESS': 'chain',   // a painted signboard, bought not made
  'BODEGA': 'chain',              // a corner store under a red plastic awning
};

function cardFor(h: BizHours): Card {
  switch (FACADE[h.building] ?? 'chain') {
    case 'stone': return giltCard(h);
    // the diner belongs here with the casino and the hotel: steel and neon is
    // one vocabulary, and all three of them burn all night
    case 'vice': case 'steel': return neonCard(h);
    case 'board': return tapedCard(h);
    // The die-cut OPEN 24 HOURS sign and the BUSINESS HOURS placard come off
    // the same rack in the same sign shop — which one you buy is decided by
    // your hours, not by your taste. So the bodega gets the first and the
    // other four get the second, from one rule.
    default: return neverCloses(h) ? open24Card() : plasticCard(h);
  }
}

// ══ WHERE A CARD CAN ACTUALLY HANG ═══════════════════════════════════════════
//
// *"make sure all open signs arent blocked by building geometry"* (2026-08-11),
// with a screenshot of the OPEN 24 HOURS card edge-on inside a door jamb: the
// letters O and P clear the stone and the rest of the sign is inside it.
//
// The old rule was one hand-tuned number — `clearW / 2 + 0.28` along the wall,
// 25 mm proud — and it could not have been right. A shopfront is not a flat
// plane at this height. `shopfrontRelief` stands a 0.12 m JAMB either side of
// the glazing, `ct/bank.ts` stands a 0.30 m GRANITE JAMB either side of its
// entrance, and both of those live at exactly the height a card is read at.
// A card 25 mm proud of the wall behind a 300 mm jamb is not a sign, it is a
// fossil. Measured off the constants: FIRST FEDERAL's gilt card sat dead
// centre in its own granite reveal.
//
// Nudging the number moves the fault to a different shop, which is how it got
// here. So the placement is DERIVED, and from the only authority that knows
// about jambs, mullions, pillars, portals and the bodega's canted bay all at
// once: THE GEOMETRY ITSELF. This module builds at `BUILD.PROPS + 7`, by which
// point every facade, every relief moulding and every prop on the block is
// standing (the interiors, at `BUILD.INTERIOR`, are 30 m away up the belt), so
// a sight-line from the street to a candidate spot answers the question
// exactly rather than by proxy.
//
// This is the sweep CLAUDE.md sanctions — *"mass quality control, where the
// question is about EVERY instance"*. It is not a probe proving one change: it
// is the placement rule, and it re-derives itself if a facade moves.
//
// The frontage descriptor still gets the last word on ONE thing the sight-line
// cannot see: a neighbour's wall is a wall, so a card walked far enough along
// finds clear brick on the shop next door. `frontageWorld()` fences it in.

/** how far out from the facade the sight-line test starts */
const PROBE = 0.9;
/** the card's own standoff from the facade plane — enough to beat z-fighting,
 *  small enough that a card reads as stuck ON the wall and not floating */
const PROUD = 0.03;
/** eye line of somebody reading it off the walk, above the pavement */
const CARD_Y = 0.14 + 1.48;

const UP = new THREE.Vector3(0, 1, 0);

interface Occluder { m: THREE.Mesh; x: number; z: number; r: number }

/** every opaque mesh standing on the block, with a world bounding sphere, so
 *  the per-card test can be aimed at the handful near one door rather than at
 *  the whole scene. Glows and billboards are skipped: a halo is not something
 *  you can be behind, and a citizen who happens to be walking past at build
 *  time is not a reason to move a sign for the rest of the game.
 *
 *  ⚠ OPACITY AT BUILD TIME IS NOT WHAT YOU WILL SEE. This test used to read
 *  `transparent && opacity < 0.6` as "you can see through it", and that is the
 *  second half of *"casino sign STILL overlapping"*: `ct/vice.ts`'s neon
 *  risers are 0.22 m tubes hung 0.07 m proud of the facade, constructed at
 *  `opacity: 0.4` and driven to 1.0 by their own night tick. A sweep run at
 *  build time therefore called them see-through, walked the casino's card in
 *  behind one, and after dark the tube came up solid gold across it.
 *
 *  So the question is DEPTH, not alpha: anything that writes depth will hide
 *  what is behind it whatever its opacity does later. `depthWrite: false` and
 *  additive blending are the two honest declarations of "you can see through
 *  me", and both are made once at construction and never animated. */
function occludersNear(ctx: CtxBuild): Occluder[] {
  const boards = new Set<THREE.Object3D>(ctx.boards.map((b) => b.m));
  const out: Occluder[] = [];
  ctx.scene.updateMatrixWorld(true);
  ctx.scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.geometry || boards.has(m)) return;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    const solid = mats.some((x) => {
      const mm = x as THREE.Material & { blending?: THREE.Blending };
      return !!mm && mm.depthWrite !== false && mm.blending !== THREE.AdditiveBlending;
    });
    if (!solid) return;
    if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere();
    const bs = m.geometry.boundingSphere;
    if (!bs) return;
    const c = bs.center.clone().applyMatrix4(m.matrixWorld);
    out.push({ m, x: c.x, z: c.z, r: bs.radius * m.matrixWorld.getMaxScaleOnAxis() });
  });
  return out;
}

const ray = new THREE.Raycaster();

/**
 * Can a card of this size, hung on the facade plane at `p`, be READ from the
 * street? Seven sight-lines — the centre, the four corners and the two side
 * midpoints — cast inward from `PROBE` metres out.
 *
 * Three ways to fail, and the second two matter as much as the first:
 *   · something in front of the card plane  → the sign is buried (the ask)
 *   · nothing hit at all                    → there is no wall there; the card
 *                                             would float past the building's
 *                                             own corner
 *   · the first thing hit is far back       → same, through a doorway or a gap
 */
function readable(p: THREE.Vector3, n: THREE.Vector3, t: THREE.Vector3,
  wM: number, hM: number, targets: THREE.Object3D[]): boolean {
  const dir = n.clone().negate();
  const hw = wM / 2 - 0.02, hh = hM / 2 - 0.02;
  const S: [number, number][] = [[0, 0], [-hw, -hh], [hw, -hh], [-hw, hh], [hw, hh], [-hw, 0], [hw, 0]];
  const o = new THREE.Vector3();
  for (const [su, sv] of S) {
    o.copy(p).addScaledVector(t, su).addScaledVector(UP, sv).addScaledVector(n, PROBE);
    ray.set(o, dir);
    const hit = ray.intersectObjects(targets, false)[0];
    if (!hit) return false;
    if (hit.distance < PROBE - PROUD - 0.01) return false;
    if (hit.distance > PROBE + 0.55) return false;
  }
  return true;
}

/** the span on the frontage axis the card centre must stay inside, so a card
 *  never walks off its own building onto the neighbour's brick. Null when this
 *  door is not on a registered flat frontage — the bodega's door is on a 45°
 *  bay and `__frontages['BODEGA']` describes its side-street WING, a different
 *  wall 5 m away (see the note in ct/street.ts), so it must not be trusted. */
function frontageSpan(name: string, d: { x: number; z: number }): { lo: number; hi: number; axis: 'x' | 'z' } | null {
  const f = frontageWorld(name);
  if (!f) return null;
  const on = f.axis === 'z' ? d.x : d.z;      // the coordinate off the frontage
  const along = f.axis === 'z' ? d.z : d.x;   // …and the one along it
  if (Math.abs(on - f.facePos) > 0.06) return null;
  if (along < f.loWorld - 0.01 || along > f.hiWorld + 0.01) return null;
  return { lo: f.loWorld, hi: f.hiWorld, axis: f.axis };
}

export function register(ctx: CtxBuild): void {
  const all = occludersNear(ctx);
  for (const h of HOURS) {
    const d = doorPointFor(h.building);
    // a business whose room has not declared a door gets no card rather than
    // a card floating at a guess — the same fallback shape doors.ts itself uses
    if (!d) continue;
    const leaf = doorLeafFor(h.building);
    const card = cardFor(h);
    // Tangent is the normal turned a quarter — works the same on the bodega's
    // cut corner as on a flat frontage.
    const n = new THREE.Vector3(d.nx, 0, d.nz);
    const t = new THREE.Vector3(d.nz, 0, -d.nx);
    // only what is standing within reach of this door, so the sweep is seven
    // rays against a dozen meshes and not against the whole city
    const targets = all.filter((o) => Math.hypot(o.x - d.x, o.z - d.z) < 5.5 + o.r).map((o) => o.m);
    const span = frontageSpan(h.building, d);

    // WALK OUT FROM THE DOOR UNTIL THE WALL IS CLEAR. Nearest wins, and each
    // step tries the near side first so a card stays where it has always been
    // whenever that spot was already fine.
    // CLEAR OF THE OPENING AS DRAWN, not merely of the leaf. A sight-line
    // cannot see paint, and on the two vice frontages the whole entrance —
    // portal, reveal, revolving-door case — IS paint on a flat band, so every
    // ray through it lands on wall at exactly the right distance and reports
    // clear. That is *"hotel sign is over the doors in a janky way"*: the card
    // came to rest 0.875 m from the door centre, which is inside a 3.4 m stone
    // case. `ct/vice.ts` publishes the painted width because it is the file
    // that paints it; every other shopfront on the block stands its jambs off
    // the brick, where the sight-line finds them on its own.
    const opening = Math.max(leaf.clearW, VICE_PORTAL_W[h.building] ?? 0);
    const minOff = opening / 2 + card.wM / 2 + 0.10;
    const p = new THREE.Vector3();
    let placed: THREE.Vector3 | null = null;
    for (let step = 0; step <= 24 && !placed; step++) {
      const off = minOff + step * 0.06;
      for (const sgn of [1, -1]) {
        p.set(d.x + t.x * sgn * off, CARD_Y, d.z + t.z * sgn * off);
        if (span) {
          const a = span.axis === 'z' ? p.z : p.x;
          if (a < span.lo + card.wM / 2 + 0.05 || a > span.hi - card.wM / 2 - 0.05) continue;
        }
        if (readable(p, n, t, card.wM, card.hM, targets)) { placed = p.clone(); break; }
      }
    }
    // NOTHING CLEAR EITHER SIDE. Do not bury it anyway: stand the card off far
    // enough to clear whatever is in the way, which is what a shop does with a
    // sign it needs read — bracket it out past the stonework. Announced,
    // because a frontage with no clear metre of wall beside its door is worth
    // a builder's eye.
    let proud = PROUD;
    if (!placed) {
      placed = new THREE.Vector3(d.x + t.x * minOff, CARD_Y, d.z + t.z * minOff);
      const o = placed.clone().addScaledVector(n, PROBE);
      ray.set(o, n.clone().negate());
      const hit = ray.intersectObjects(targets, false)[0];
      if (hit) proud = Math.min(0.35, Math.max(PROUD, PROBE - hit.distance + 0.03));
      console.warn(`[hours-cards] no clear wall beside ${h.building}'s door — `
        + `standing its card ${proud.toFixed(2)} m proud to keep it readable`);
    }

    const tex = declareSurface(card.tex, 'sign', PPM);
    const mat = card.diecut
      ? new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.5 })
      : ctx.flat(tex);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(card.wM, card.hM), mat);
    // YXZ so the roll is IN the sign's own plane after it faces the street —
    // default XYZ would roll it about the world axis and skew it off the wall
    m.rotation.order = 'YXZ';
    m.rotation.y = Math.atan2(d.nx, d.nz);
    m.rotation.z = card.tilt;
    m.position.copy(placed).addScaledVector(n, proud);
    // The neon one is a light and holds its own after dark; every other card
    // is ink on a plane and grades away with the wall behind it. Declared, so
    // no future repaint can light a card by drifting a colour (380a05fc).
    signNight(m, !!card.lit);
    ctx.scene.add(m);
  }
}
