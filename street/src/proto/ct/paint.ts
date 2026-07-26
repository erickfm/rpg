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

export function declareSurface<T extends THREE.Texture>(t: T, kind: SurfaceKind): T {
  t.userData.surface = kind;
  return t;
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
  return declareSurface(t, o.kind ?? 'ground');
}

export function dither(g: CanvasRenderingContext2D, w: number, h: number, n: number) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.16)' : 'rgba(255,255,255,0.1)';
    g.fillRect(Math.floor(Math.random() * w), Math.floor(Math.random() * h), 1, 1);
  }
}
