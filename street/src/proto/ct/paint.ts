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

export function dither(g: CanvasRenderingContext2D, w: number, h: number, n: number) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.16)' : 'rgba(255,255,255,0.1)';
    g.fillRect(Math.floor(Math.random() * w), Math.floor(Math.random() * h), 1, 1);
  }
}
