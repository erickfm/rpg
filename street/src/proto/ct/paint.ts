import * as THREE from 'three';

// Texel painting: every surface in the world is a hand-drawn canvas.
// NOTE: dither() uses UNSEEDED Math.random on purpose — the grain is
// different every load. Test harnesses seed Math.random to compare builds.

/**
 * SAY WHAT A SURFACE IS, in one line, on the texture.
 *
 * Asked for by the seam audit's closing round: *"Every unstamped wall-sized face
 * is currently unjudgeable by any seam tool — not suspect, unjudgeable. A face
 * declaring 'I am brick' or 'I am a painted sign' would move 150 pairs from
 * unknown into one of the two answered columns."*
 *
 * That is right, and it is the same pattern that has already answered three
 * other questions nobody could settle from outside: `userData.mod` for whose a
 * mesh is, `userData.masonry` for how dense a wall was painted, `userData.selfLit`
 * for whether a bright thing is bright on purpose. Each replaced a tool guessing
 * from shape with the module that knows saying so.
 *
 * A seam tool can only ask "do these two brick faces draw the same size brick"
 * of things that are both brick. It cannot tell a hand-painted ashlar wall from
 * a painted signboard by looking, and it should not try — that is how ivy ended
 * up on a list of brick candidates.
 *
 *     declareSurface(myTex, 'brick')   // compare me against other brick
 *     declareSurface(myTex, 'sign')    // I am artwork; density means nothing
 *
 * `masonry().paint()` sets 'brick' for you. Everything else is one line at the
 * point the texture is made.
 */
export type SurfaceKind = 'brick' | 'sign' | 'foliage' | 'ground' | 'detail';

export function declareSurface<T extends THREE.Texture>(t: T, kind: SurfaceKind, ppm?: number): T {
  t.userData.surface = kind;
  if (ppm !== undefined) {
    if (!(ppm > 0) || !isFinite(ppm)) {
      console.warn(`[paint] declareSurface got ppm=${ppm}; a density must be a positive`
        + ' number of texels per metre. Ignoring it, which leaves this surface UNDECLARED'
        + ' — that is worse than not calling it, so fix the caller.');
    } else t.userData.ppm = ppm;
  }
  return t;
}

/**
 * SAY THAT A SHEET IS STRETCHED ON PURPOSE — and say WHY, in the same call.
 *
 * ── the trap this exists to stop ────────────────────────────────────────────
 *
 * `scripts/texdensity.mjs` judges an UNDECLARED face on one invariant: *on a
 * correctly mapped face a texel is square.* That is the only thing it can check
 * without a declaration, and it is right about nearly everything — 155 gross
 * faces on this world, and the backlog is real.
 *
 * **But it cannot tell a stretched face from a ONE-DIMENSIONAL GRADIENT, and
 * the eight worst faces in the whole world are the second thing.** Worker
 * onehundredsix's warning, which is queue item 266: the drain rails are
 * `castTex`, a 16x16 sheet whose sixteen ROWS over a 2.8 cm arris **are** the
 * worn edge — a bright top row, a dark bottom row, flat grit between. Across the
 * rail it is uniform by construction, so `15.84 x 571.43 px/m` is not damage,
 * it is the whole drawing. **"Squaring" it destroys the detail it exists to
 * draw**, and it would look like progress: the number would fall by eight.
 *
 * ── so: excluded BY DECLARATION, never by a builder remembering ─────────────
 *
 *     declareAnisotropic(t, 'the 16 rows over a 2.8 cm arris ARE the worn edge');
 *
 * **The reason is mandatory and is printed by the checker**, which is the point.
 * A bare boolean is an off switch and would be reached for the moment a face is
 * inconvenient; a sentence has to be true, and the next reader can disagree with
 * it. `texdensity` lists these faces in their own counted category rather than
 * dropping them silently — an exclusion nobody can see is the guard "sleeping"
 * (GOTCHAS 58, BUILDER-BRIEF §7).
 *
 * **It excuses ASPECT and nothing else.** A face that also declares a `ppm` is
 * still checked against it, because being deliberately 1-D says nothing about
 * being the right density.
 */
export function declareAnisotropic<T extends THREE.Texture>(t: T, why: string): T {
  if (!why || !why.trim()) {
    console.warn('[paint] declareAnisotropic needs a REASON, and got an empty one.'
      + ' A silent exclusion is a guard that has stopped guarding. Ignoring it,'
      + ' which leaves this surface checked — fix the caller.');
    return t;
  }
  t.userData.anisotropic = why.trim();
  return t;
}

/**
 * SAY HOW DENSE A SURFACE IS, and then never type a repeat again.
 *
 * ── the gap this closes ────────────────────────────────────────────────────
 *
 * The user, on the jail, 2026-08-02: *"why aren't we catching these? what's
 * causing them and do we need to set a rule against them so they aren't
 * created?"* BUILDER-BRIEF §7b is the rule he asked for — *"every textured
 * surface DECLARES its density and DERIVES its repeat from its own
 * dimensions"* — and until now **there was no way to obey the first half.**
 * `declareSurface` declared a KIND. `masonry().paint()` is the only thing in
 * the world that stamps a px/m, and it only paints brick. Measured by worker
 * sixtytwo: **7.4% of the world's textured faces can declare a density at all;
 * 3,782 have no API to state one even if the author wanted to** (item 163).
 *
 * So every density guard has had to fall back on an invariant that needs no
 * declaration — *on a correctly mapped face a texel is square* — which catches
 * a stretched face and **cannot** catch a face that is uniformly, squarely,
 * wrongly dense. A 4 px/m wall and a 200 px/m sill both pass it.
 *
 * ── the three calls, smallest first ────────────────────────────────────────
 *
 *     declareSurface(t, 'detail', 12)      // I painted this at 12 px/m
 *     fitRepeat(t, 2.4, 0.8)               // …so on a 2.4 x 0.8 m face, this repeat
 *     boxFaces(t, w, h, d)                 // …and on a BOX, one per face
 *
 * `slabTex` stamps its own — it is sized from real metres and already knows.
 *
 * ── why `boxFaces` is the one that matters ─────────────────────────────────
 *
 * **Almost every gross face in this world is a box wearing ONE material on all
 * six sides**, with a repeat computed for whichever side the author was looking
 * at. Of civic's 39, the biggest cluster is a single 48x48 canvas on boxes whose
 * six faces span 0.15 m to 4.1 m. `ct/interior.ts`'s `boxMats` already solved
 * exactly this for the interior kit and its author left the trap written at the
 * call site — **`±x` is DEPTH across, `±z` is WIDTH** — because all three of its
 * callers had got it wrong. This is that solution, hoisted so it is not the
 * interior kit's private property.
 */

/** THREE's material order for a BoxGeometry, and the two real dimensions each
 *  face spans. Written once, here, because getting it wrong is this repo's most
 *  expensive recurring mistake: it produced two retracted findings (42
 *  "off-density" faces, 135 "disagreeing" junctions) and `scripts/lib/faces.mjs`
 *  exists solely because of it. */
export const BOX_FACE_DIMS = (w: number, h: number, d: number): [number, number][] => [
  [d, h],   // 0  +x
  [d, h],   // 1  -x
  [w, d],   // 2  +y
  [w, d],   // 3  -y
  [w, h],   // 4  +z
  [w, h],   // 5  -z
];

/**
 * Set `t`'s repeat so it draws at its DECLARED density on a `w` x `h` m face.
 *
 * Returns `t` unchanged and warns if nothing declared a density — silently
 * doing nothing would make this the second way to get an undeclared surface,
 * and the whole point is that there is no longer any excuse for one.
 */
export function fitRepeat<T extends THREE.Texture>(t: T, wMeters: number, hMeters: number): T {
  const ppm = t.userData.ppm as number | undefined;
  const img = t.image as { width: number; height: number } | undefined;
  if (!(ppm && ppm > 0)) {
    console.warn('[paint] fitRepeat on a texture with no declared density — call'
      + " declareSurface(t, kind, ppm) first. Repeat left alone.");
    return t;
  }
  if (!img || !img.width || !img.height) {
    console.warn('[paint] fitRepeat before the canvas exists — repeat left alone.');
    return t;
  }
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set((wMeters * ppm) / img.width, (hMeters * ppm) / img.height);
  return t;
}

/**
 * Six materials for a `BoxGeometry(w, h, d)`, each face's repeat derived from
 * ITS OWN two dimensions at `t`'s declared density.
 *
 * One texture cannot serve six differently-sized faces — `repeat` lives on the
 * texture, not on the face — so this CLONES per distinct face size. A box has
 * at most three distinct sizes, so it is at most three clones and usually
 * fewer; they are cached by size so a cube costs one.
 *
 * `make` builds the material from a texture, so a caller keeps whatever
 * material options it already had. The default is the plain opaque one.
 */
export function boxFaces(
  t: THREE.Texture, w: number, h: number, d: number,
  make: (map: THREE.Texture) => THREE.Material = (map) => new THREE.MeshBasicMaterial({ map }),
): THREE.Material[] {
  const cache = new Map<string, THREE.Material>();
  return BOX_FACE_DIMS(w, h, d).map(([fw, fh]) => {
    const key = `${fw.toFixed(4)}x${fh.toFixed(4)}`;
    let m = cache.get(key);
    if (!m) {
      const c = t.clone();
      c.needsUpdate = true;
      // `clone()` copies `userData` by reference in three, so the density
      // declaration survives — which matters, because the audit reads it off
      // the texture that is actually on the face, not off the original.
      c.userData = { ...t.userData };
      fitRepeat(c, fw, fh);
      m = make(c);
      cache.set(key, m);
    }
    return m;
  });
}

export function pixTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): THREE.Texture {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  draw(cv.getContext('2d')!);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestMipmapNearestFilter;
  return t;
}

/**
 * A FLAT COLOUR IS NOT A MATERIAL. Turn one into a material without changing it.
 *
 * B's diagnosis, and it is the whole of this function's reason for existing:
 * *"an untextured quad has no grain for the eye to attach to and no joints to
 * give it scale, so it reads as a TINT OVER the paving rather than as a piece
 * of paving."* B measured 123 ground-facing surfaces in that state, about
 * 454 m² — civic 14 surfaces and 92 m², lot 12 and 82, street 27 and 43 — and
 * it is behind four separate user complaints: the shadow-geometry patches at
 * the library forecourt, the driveway apron reading as a large flat grey plane,
 * the blank slab in the library interior, and the park paths reading as road.
 *
 * B already built three ground painters — `walkTex`, `apronTex`, `plazaTex` in
 * `ct/tex-ground.ts` — each an ANSWER for one surface: this is the sidewalk,
 * this is an apron, these are civic flags. Adopt those where they fit; they are
 * better than anything generic because they know what they are drawing.
 *
 * This is for everything else, and it deliberately does the smaller thing:
 *
 *     IT KEEPS YOUR COLOUR. `base` is the tone you already chose and it is
 *     filled unchanged. The brief on this work was "do not repaint anyone's
 *     approved artwork", and the fault was never the colour — it was that a
 *     colour alone has no grain and no joint, so nothing gives it scale. This
 *     adds those two things to the tone you approved.
 *
 * Sized from REAL METRES at the world's ground density, mapped 1:1 with no
 * repeat, so a joint lands where you put it rather than where a tile happens to
 * cut — the same contract as B's three, and the reason the apron needed its own
 * sheet in the first place.
 *
 * It works on a BOX TOP FACE as well as a plane: a BoxGeometry's +Y face UVs
 * span the full 0..1 on both axes (measured), so a 1:1 ClampToEdge texture
 * covers it exactly. That matters because civic's worst offenders are box
 * landings and flights in a materials array, where the top is index 2 of
 * `[+x, -x, +y, -y, +z, -z]`.
 *
 *     const top = new THREE.MeshBasicMaterial({
 *       map: slabTex({ wMeters: 3.6, dMeters: 4.1, base: '#7d7d79', joint: 1.5 }),
 *     });
 *     mesh.material = [side, side, top, side, side, side];
 *
 * `joint: 0` gives grain with no joints, which is what a park path or a patch
 * of worn ground wants — scale without pretending to be a slab.
 */
export function slabTex(o: {
  /** the surface's real width in metres, along the texture's u */
  wMeters: number;
  /** its real depth in metres, along v */
  dMeters: number;
  /** THE COLOUR YOU ALREADY HAVE. Filled unchanged; this never restyles it. */
  base: string;
  /** metres between joints, both ways. 0 or omitted = no joints, grain only. */
  joint?: number;
  /** texels per metre. 32 is the world's ground density and the default. */
  ppm?: number;
  /** speckle per texel, 0..1. Higher reads coarser — gravel rather than stone. */
  grain?: number;
  kind?: SurfaceKind;
}): THREE.Texture {
  const ppm = o.ppm ?? 32;
  const w = Math.max(8, Math.round(o.wMeters * ppm));
  const h = Math.max(8, Math.round(o.dMeters * ppm));
  const grain = o.grain ?? 0.10;
  const t = pixTex(w, h, (g) => {
    g.fillStyle = o.base;
    g.fillRect(0, 0, w, h);
    // Per-slab tone drift BEFORE the speckle, so a big surface is not one flat
    // field even where there are no joints to break it. This is the trick
    // walkTex uses and it is most of why a paved run reads as many stones.
    const cell = Math.max(8, Math.round((o.joint || 1.5) * ppm));
    for (let sy = 0; sy < h; sy += cell) {
      for (let sx = 0; sx < w; sx += cell) {
        const v = Math.random();
        g.fillStyle = v < 0.5 ? `rgba(0,0,0,${0.02 + v * 0.05})`
                              : `rgba(255,255,255,${(v - 0.5) * 0.06})`;
        g.fillRect(sx, sy, cell, cell);
      }
    }
    // AGGREGATE: the grain the eye attaches to.
    //
    // The contrast is tied to `grain` rather than fixed, and that is not a
    // nicety — it is the defect my own proof caught. A fine low-contrast
    // speckle is invisible next to a joint and carries a surface fine WITH
    // one; with `joint: 0` it carried nothing, and the park-path case measured
    // 1.2% edge density against 4.9% for the jointed civic slab. A path with no
    // joints would have read as exactly the tint-over-paving this function
    // exists to end. So a surface asking for more grain gets harder grain, and
    // above 0.14 it also gets PEBBLES — 2 px stones, which is what actually
    // distinguishes a gravel path from a poured slab at this density.
    const hard = Math.min(0.55, 0.16 + grain * 1.8);
    for (let i = 0; i < w * h * grain; i++) {
      const x = Math.random() * w, y = Math.random() * h, v = Math.random();
      g.fillStyle = v < 0.55 ? `rgba(46,42,36,${0.10 + v * hard})`
                             : `rgba(232,227,214,${(v - 0.55) * (hard + 0.10)})`;
      g.fillRect(x, y, 1, 1);
    }
    if (grain > 0.14) {
      for (let i = 0; i < w * h * grain * 0.06; i++) {
        const x = Math.floor(Math.random() * w), y = Math.floor(Math.random() * h);
        const v = Math.random();
        g.fillStyle = v < 0.5 ? `rgba(40,36,30,${0.22 + v * 0.30})`
                              : `rgba(238,233,220,${0.14 + (v - 0.5) * 0.34})`;
        g.fillRect(x, y, 2, 2);
      }
    }
    // the joints, 2 px = about 6 cm at 32 px/m, as everywhere else on the ground
    if (o.joint && o.joint > 0) {
      const J = Math.round(o.joint * ppm);
      g.fillStyle = 'rgba(0,0,0,0.26)';
      for (let k = 0; k <= h; k += J) g.fillRect(0, k, w, 2);
      for (let k = 0; k <= w; k += J) g.fillRect(k, 0, 2, h);
    }
  });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;             // 1:1, no repeat
  // …AND IT DECLARES ITS OWN DENSITY, for free. This function is sized from
  // real metres at a stated `ppm`, so it is the one painter in the world that
  // already knows the answer §7b asks every surface for. One argument, and
  // every existing `slabTex` call site in the world becomes a declared surface
  // without being touched.
  //
  // It is also where the need showed up in the wild: the hotel's upholstery was
  // converted to `slabTex` on 2026-08-03 (item 96) — correctly, it is this
  // file's own doctrine — and the conversion added SIX gross faces, because a
  // 1:1 sheet sized for a chair's front was handed to its 0.1 m arm ends
  // unchanged. `boxFaces` is the fix for that shape and this stamp is what
  // lets the audit see it.
  return declareSurface(t, o.kind ?? 'ground', ppm);
}

/** The smallest canvas `slabTex` will produce on either axis. It clamps with
 *  `Math.max(8, …)` because a surface 1–2 texels tall cannot hold detail
 *  (GOTCHAS 4) — a good rule that becomes a trap the moment you size a canvas
 *  from a face rather than from a surface. See `slabBox`. */
const SLAB_MIN_PX = 8;

/**
 * SIX MATERIALS FOR A `BoxGeometry(w, h, d)`, EACH FACE SLABBED AT ITS OWN SIZE.
 *
 * This is the wrapper five hand-fixes asked for. **A box authored `(W, H, D)`
 * presents `±x = D×H`, `±y = W×D`, `±z = W×H` — three different sizes — and
 * `slabTex` maps 1:1, so ONE sheet is correct for at most one of them.** Every
 * time someone hands a single map to a box the other four faces draw at the
 * wrong scale and nothing complains, because `slabTex` returns a texture with no
 * idea what geometry it is about to land on.
 *
 * Fixed by hand, all the same shape, before this existed: the church treads
 * (29.8x), the park kerb (**16,363x**, once the worst face in the world), the
 * bench seat (u and v swapped, 12× the aspect), the hotel upholstery (sized to
 * the largest face, applied 1:1 to all six — slivers at 250 px/m against a
 * declared 48), and the jail threshold (**184.8x**, and its call site had
 * explicitly considered and rejected a per-face array).
 *
 *     mesh.material = slabBox(w, h, d, { base: '#26282c', joint: 0, grain: 0.12 });
 *
 * ── WHY THIS IS NOT JUST "ONE `slabTex` PER FACE" ──────────────────────────
 *
 * That is the obvious implementation and it is silently wrong on thin faces,
 * which is exactly where this bug lives. `slabTex` clamps its canvas to
 * `SLAB_MIN_PX` on both axes, so a face thinner than `8 / ppm` metres — 0.25 m
 * at the default 32, 0.17 m at the upholstery's 48 — gets **8 texels whatever
 * you ask for**, and its density comes out at `8 / faceMetres` instead of `ppm`.
 *
 * Measured, not reasoned: the jail threshold's edge is 2.4 × 0.05 m. A fresh
 * per-face sheet at 32 ppm is `round(0.05 × 32) = 2 → clamped to 8`, giving
 * 32 × 160 px/m — a **5× stretch, still gross**, on a face the naive wrapper
 * would report as fixed. The clamp is right (GOTCHAS 4); sizing a canvas from a
 * 5 cm face is what is wrong.
 *
 * So each distinct face size takes whichever path is correct FOR IT:
 *
 *   · **fat enough for its own sheet** → a fresh 1:1 `slabTex` at exactly its
 *     metres. No tiling, no cropping, exact density. This is the primary path
 *     and it is what `fabric()` in `ct/int-hotel.ts` does privately.
 *   · **too thin** → a clone of the largest face's sheet with a derived repeat
 *     (`fitRepeat`), which lands exactly `ppm` on both axes at any thinness.
 *     `fitRepeat` sets `RepeatWrapping`, so this does NOT smear the edge texels
 *     of a `ClampToEdge` sheet — that only happens if you raise `repeat` while
 *     leaving the wrap mode alone.
 *
 * ⚠ **THE THIN PATH TILES, SO IT IS ONLY SAFE WITHOUT JOINTS.** `slabTex` draws
 * its joint grid from the canvas origin, and the canvas is not generally a whole
 * number of joints across — so a tiled sheet can show a seam where the grid
 * restarts. It does not matter for grain (`joint: 0`), and a joint grid on a
 * sub-0.25 m sliver is meaningless anyway, but if you pass `joint > 0` and have
 * faces that thin, look at them. Warned rather than forbidden, because refusing
 * would send callers straight back to the one-sheet-for-six-faces bug.
 *
 * Canvases are cached per distinct face size, so a box costs at most three and
 * usually two.
 */
export function slabBox(
  w: number, h: number, d: number,
  o: Omit<Parameters<typeof slabTex>[0], 'wMeters' | 'dMeters'>,
  make: (map: THREE.Texture) => THREE.Material = (map) => new THREE.MeshBasicMaterial({ map }),
): THREE.Material[] {
  const ppm = o.ppm ?? 32;
  const dims = BOX_FACE_DIMS(w, h, d);
  // The biggest face by area is the one whose sheet a thin face borrows: it has
  // the most real detail drawn into it, and it is the face the author was
  // looking at.
  const [bw, bh] = dims.reduce((a, b) => (a[0] * a[1] >= b[0] * b[1] ? a : b));
  let borrowed: THREE.Texture | null = null;

  const cache = new Map<string, THREE.Material>();
  return dims.map(([fw, fh]) => {
    const key = `${fw.toFixed(4)}x${fh.toFixed(4)}`;
    let m = cache.get(key);
    if (!m) {
      const thin = fw * ppm < SLAB_MIN_PX || fh * ppm < SLAB_MIN_PX;
      let map: THREE.Texture;
      if (!thin) {
        map = slabTex({ ...o, wMeters: fw, dMeters: fh });
      } else {
        borrowed ??= slabTex({ ...o, wMeters: bw, dMeters: bh });
        map = borrowed.clone();
        map.needsUpdate = true;
        // `clone()` copies userData BY REFERENCE in three, so spread it — the
        // audit reads the density declaration off the texture actually on the
        // face, not off the original.
        map.userData = { ...borrowed.userData };
        fitRepeat(map, fw, fh);
      }
      m = make(map);
      cache.set(key, m);
    }
    return m;
  });
}

export function dither(g: CanvasRenderingContext2D, w: number, h: number, n: number) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.16)' : 'rgba(255,255,255,0.1)';
    g.fillRect(Math.floor(Math.random() * w), Math.floor(Math.random() * h), 1, 1);
  }
}
