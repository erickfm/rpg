import * as THREE from 'three';
import { pixTex, dither } from './paint';

// ── the ground: everything you walk on and everything at your feet ────────
//
// Split out of tex-world.ts so the sidewalk/kerb/gutter track can move
// independently of the facades and the street furniture.

// one 64px tile = a 2×2 block of 1 m slabs. Callers pass the surface size
// so the slab grid is exactly 1 m everywhere — walks, corners, all of it.
export function walkTex(wMeters: number, dMeters: number): THREE.Texture {
  const t = pixTex(64, 64, (g) => {
    g.fillStyle = '#84817a'; g.fillRect(0, 0, 64, 64);
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.fillRect(0, 0, 64, 2); g.fillRect(0, 32, 64, 2);
    g.fillRect(0, 0, 2, 64); g.fillRect(32, 0, 2, 64);
    dither(g, 64, 64, 500);
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(wMeters / 2, dMeters / 2);
  return t;
}
