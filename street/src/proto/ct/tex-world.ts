import * as THREE from 'three';
import { pixTex, dither } from './paint';

// facades are ~8 px/m wide so brick size and window rhythm stay constant
// no matter how wide the building is
export function facadeTex(brick: string, floors: number, wMeters = 12): THREE.Texture {
  const W = Math.max(64, Math.round(wMeters * 8)), H = 32 + floors * 28;
  return pixTex(W, H, (g) => {
    g.fillStyle = brick;
    g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(0,0,0,0.22)';
    for (let y = 0; y < H; y += 5) g.fillRect(0, y, W, 1);
    for (let y = 0; y < H; y += 10) for (let x = (y % 20) ? 0 : 4; x < W; x += 9) g.fillRect(x, y, 1, 5);
    g.fillStyle = '#8a7a62';
    g.fillRect(0, 0, W, 6);
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.fillRect(0, 6, W, 2);
    const cols = Math.max(2, Math.floor((W - 10) / 22));
    for (let f = 0; f < floors; f++) {
      const y = 14 + f * 28;
      for (let c = 0; c < cols; c++) {
        const x = 8 + c * 22;
        const lit = ((f * 7 + c * 3) % 5) === 0;
        g.fillStyle = '#1a1c22';
        g.fillRect(x - 1, y - 1, 14, 18);
        g.fillStyle = lit ? '#c9a45e' : '#2e3a46';
        g.fillRect(x, y, 12, 16);
        if (!lit) { g.fillStyle = '#48586a'; g.fillRect(x + 7, y, 3, 16); }
        else { g.fillStyle = '#8a6a3a'; g.fillRect(x, y + 10, 12, 6); }
        g.fillStyle = '#9a8a72';
        g.fillRect(x - 1, y + 17, 14, 2);
      }
    }
    g.fillStyle = 'rgba(0,0,0,0.16)';
    for (let k = 0; k < 5; k++) {
      g.fillRect(Math.floor(Math.random() * W), 0, 2, Math.floor(H * Math.random()));
    }
    dither(g, W, H, 500);
  });
}

export function shopfrontTex(brick: string, name: string, awning: string, wMeters = 12): THREE.Texture {
  const W = Math.max(64, Math.round(wMeters * 8));
  return pixTex(W, 40, (g) => {
    g.fillStyle = brick; g.fillRect(0, 0, W, 40);
    g.fillStyle = 'rgba(0,0,0,0.2)';
    for (let y = 0; y < 40; y += 5) g.fillRect(0, y, W, 1);
    // sign band caps at ~12 m so wide buildings don't wear a mile of awning
    const bandW = Math.min(W - 8, 96), bandX = Math.round((W - bandW) / 2);
    g.fillStyle = awning;
    g.fillRect(bandX, 2, bandW, 10);
    g.fillStyle = '#f2ead0';
    g.font = 'bold 8px monospace';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(name, W / 2, 7);
    g.fillStyle = '#141820';
    g.fillRect(6, 14, W - 12, 24);
    g.fillStyle = '#3a3020';
    g.fillRect(8, 16, W - 16, 20);
    g.fillStyle = '#c9a45e';
    g.fillRect(10, 22, Math.round(W * 0.31), 12);
    g.fillStyle = '#5a6a7a';
    g.fillRect(Math.round(W * 0.6), 16, 6, 20);
    g.fillStyle = '#2a3440';
    g.fillRect(Math.round(W * 0.48), 16, 3, 22);
    dither(g, W, 40, 260);
  });
}

// one 64px tile ≈ 3.4 m × 4.5 m of road; callers pass the plane size in
// metres so the grain stays square instead of smearing on wide/short planes.
export function asphaltTex(wMeters = 10, dMeters = 134): THREE.Texture {
  const t = pixTex(64, 64, (g) => {
    g.fillStyle = '#3a3d42'; g.fillRect(0, 0, 64, 64);
    dither(g, 64, 64, 900);
    g.strokeStyle = 'rgba(0,0,0,0.3)';
    g.beginPath(); g.moveTo(4, 60); g.lineTo(30, 30); g.lineTo(28, 8); g.stroke();
    g.fillStyle = 'rgba(0,0,0,0.25)';
    for (let i = 0; i < 3; i++) g.fillRect(Math.random() * 60, Math.random() * 60, 4, 3);
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(Math.max(1, Math.round(wMeters / 3.4)), Math.max(1, Math.round(dMeters / 4.5)));
  return t;
}

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

// the sprite tree — a painted cutout that turns to face you, Quake-style.
//
// The crown is WIDER than the walk on purpose: a real street tree's canopy
// overhangs the kerb and the road. It clears head height, and collision is
// trunk-only, so the sidewalk stays as walkable as it was — the crown is
// allowed to be generous because you walk *under* it.
export const TREE_W = 60;   // texels; × TREE_PX(0.05) = 3.0 m of sprite

// TWO HARD LIMITS, both learned the hard way — keep them when tuning:
//
//  1. Painted canopy half-width must stay under 1.45 m. The trunk sits at
//     x = ±5.4 and the building facade is at x = ±7.0, so anything wider
//     punches into the wall and the crown gets clipped (this is what "the
//     tree in front of ARCADE is cut off" was).
//  2. Crown bottom must stay above ~2.2 m so you walk under it. The crown
//     occupies texels 0…(cy+RY), so H must be at least (cy+RY)+44.
//
// Hence a crown that is WIDE but SHALLOW — a broad shallow canopy, which is
// also what a limbed-up street tree actually looks like. Making it rounder
// either eats head height or hits the wall.
export function treeSprite(v: number, H = 96): THREE.Texture {
  let s = Math.imul(v + 1, 2654435761) >>> 0;
  const r = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  const PAL = [
    ['#2e5a30', '#25482a', '#3f7038'],
    ['#425c2e', '#364c26', '#527038'],
    ['#38562f', '#2a4326', '#4a6c36'],
    ['#2b5236', '#22412c', '#3a6a42'],
  ][v % 4];
  const cx = TREE_W / 2;
  const cy = 20 + Math.floor(r() * 5);          // crown centre, high on the sprite
  const RX = 23 + Math.floor(r() * 7);          // 1.15–1.45 m: wide…
  const RY = 16 + Math.floor(r() * 6);          // …but shallow, so heads clear it
  const lobes = 5 + Math.floor(r() * 3);
  return pixTex(TREE_W, H, (g) => {
    // trunk runs from inside the crown to the ground, so no gap ever shows
    const tTop = cy + RY - 4;
    g.fillStyle = '#4a3626'; g.fillRect(cx - 3, tTop, 6, H - tTop);
    g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(cx - 3, tTop, 2, H - tTop);
    // solid core first, then bushy lobes around its edge — reads as one mass
    // rather than a ring of disconnected blobs
    g.fillStyle = PAL[0];
    g.beginPath(); g.ellipse(cx, cy, RX, RY, 0, 0, Math.PI * 2); g.fill();
    for (let i = 0; i < lobes; i++) {
      const a = (i / lobes) * Math.PI * 2 + r() * 0.8;
      g.fillStyle = PAL[i % 3];
      g.beginPath();
      g.ellipse(cx + Math.cos(a) * RX * (0.45 + r() * 0.35),
                cy + Math.sin(a) * RY * (0.45 + r() * 0.35),
                RX * (0.34 + r() * 0.2), RY * (0.42 + r() * 0.24), 0, 0, Math.PI * 2);
      g.fill();
    }
    // dapples, clamped inside the crown so no stray pixels float off it
    for (let i = 0; i < 110; i++) {
      const a = Math.random() * Math.PI * 2, rr = Math.random();
      g.fillStyle = Math.random() < 0.5 ? 'rgba(200,220,140,0.45)' : 'rgba(10,25,10,0.45)';
      g.fillRect(Math.floor(cx + Math.cos(a) * rr * RX * 0.95),
                 Math.floor(cy + Math.sin(a) * rr * RY * 0.95), 2, 2);
    }
  });
}

// the pit replaces a 2×2 block of sidewalk slabs: concrete rim at slab
// tone, joint shadows on the edges, soil inset — it FITS the grid
export function treePitTex(): THREE.Texture {
  return pixTex(38, 38, (g) => {
    g.fillStyle = '#84817a'; g.fillRect(0, 0, 38, 38);
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.fillRect(0, 0, 38, 1); g.fillRect(0, 37, 38, 1);
    g.fillRect(0, 0, 1, 38); g.fillRect(37, 0, 1, 38);
    g.fillStyle = '#3e2f20'; g.fillRect(4, 4, 30, 30);
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(4, 4, 30, 2); // soil sits low
    for (let i = 0; i < 80; i++) {
      g.fillStyle = Math.random() < 0.5 ? '#4a3826' : '#30241a';
      g.fillRect(4 + Math.floor(Math.random() * 29), 5 + Math.floor(Math.random() * 28), 2, 1);
    }
  });
}

// residential ground floor — brick continues to the street, two barred
// windows, no shop band (the walk-up's own face)
export function resGroundTex(brick: string, wMeters = 12): THREE.Texture {
  const W = Math.max(64, Math.round(wMeters * 8));
  return pixTex(W, 32, (g) => {
    g.fillStyle = brick; g.fillRect(0, 0, W, 32);
    g.fillStyle = 'rgba(0,0,0,0.22)';
    for (let y = 0; y < 32; y += 5) g.fillRect(0, y, W, 1);
    for (let y = 0; y < 32; y += 10) for (let x = (y % 20) ? 0 : 4; x < W; x += 9) g.fillRect(x, y, 1, 5);
    for (let wx = 14; wx < W - 24; wx += 30) {
      g.fillStyle = '#141820'; g.fillRect(wx, 8, 16, 14);
      g.fillStyle = '#3a4450'; g.fillRect(wx + 1, 9, 14, 12);
      g.fillStyle = '#1a1c22';
      for (let bx = wx + 2; bx < wx + 15; bx += 4) g.fillRect(bx, 9, 1, 12);
    }
    dither(g, W, 32, 80);
  });
}

export function hydrantSprite(): THREE.Texture {
  return pixTex(32, 48, (g) => {
    g.fillStyle = '#8a2c22';
    g.fillRect(12, 14, 8, 30);
    g.fillRect(8, 22, 16, 6);
    g.fillStyle = '#a83a2e';
    g.fillRect(12, 14, 3, 30);
    g.fillRect(11, 10, 10, 6);
    g.fillStyle = '#6a2018';
    g.fillRect(13, 44, 7, 2);
    dither(g, 32, 48, 60);
  });
}

export function pigeonSprite(): THREE.Texture {
  return pixTex(24, 24, (g) => {
    g.fillStyle = '#6a6e78';
    g.beginPath(); g.arc(12, 15, 6, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#4a4e58';
    g.beginPath(); g.arc(17, 10, 3, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#c9a45e';
    g.fillRect(20, 10, 3, 1);
    g.fillStyle = '#3a3e46';
    g.fillRect(6, 13, 6, 4);
  });
}

export function payphoneTex(): THREE.Texture {
  return pixTex(32, 64, (g) => {
    g.fillStyle = '#2c4a7a'; g.fillRect(0, 0, 32, 12);
    g.fillStyle = '#e8e4d8'; g.font = 'bold 7px monospace'; g.textAlign = 'center';
    g.fillText('PHONE', 16, 9);
    g.fillStyle = '#8a8e94'; g.fillRect(2, 12, 28, 52);
    g.fillStyle = '#141820'; g.fillRect(6, 16, 20, 26);
    g.fillStyle = '#1c1e24'; g.fillRect(10, 46, 12, 14);
    dither(g, 32, 64, 60);
  });
}

// ── street litter ──────────────────────────────────────────────────────────
// Sparse gutter debris. Deliberately small and few: the note was "just trying
// to add detail and realism. dont go over board."

// A crushed can, drawn TOP-DOWN because it lies on the road as a flat decal.
// It must NOT be a billboard: billboards rotate to face the camera, so a can
// drawn in side view stands up on end as a flat card the moment you look down
// at it. Anything lying on the ground gets drawn from above.
export function canTopTex(v: number): THREE.Texture {
  const cols = ['#b8342a', '#2c6a8a', '#c9a02a', '#4a7a3a'];
  const c = cols[v % cols.length];
  return pixTex(20, 12, (g) => {
    // body: a squashed cylinder seen from above, ends lighter bare aluminium
    g.fillStyle = '#b9bcc0'; g.fillRect(2, 3, 16, 6);
    g.fillStyle = c; g.fillRect(6, 3, 9, 6);                    // label band
    g.fillStyle = 'rgba(255,255,255,0.30)'; g.fillRect(2, 3, 16, 1);  // top highlight
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(2, 8, 16, 1);        // contact shadow
    g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(10, 3, 1, 6);        // crush crease
    g.fillStyle = '#8f9296'; g.fillRect(1, 4, 2, 4); g.fillRect(17, 4, 2, 4); // rims
    g.fillStyle = 'rgba(0,0,0,0.20)'; g.fillRect(3, 9, 14, 1);
  });
}

// a sheet of newspaper gone soft and grey in the wet
export function newspaperTex(): THREE.Texture {
  return pixTex(22, 16, (g) => {
    g.fillStyle = '#b8b4a8'; g.fillRect(1, 1, 20, 14);
    g.fillStyle = '#8e8a7e'; g.fillRect(1, 1, 20, 3);                  // soaked edge
    g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(1, 9, 20, 4);         // wet patch
    g.fillStyle = '#54524c';
    for (let y = 4; y < 14; y += 2) g.fillRect(3, y, 10, 1);           // columns of type
    for (let y = 5; y < 13; y += 2) g.fillRect(14, y, 5, 1);
    g.fillStyle = 'rgba(0,0,0,0.30)'; g.fillRect(1, 14, 20, 1);        // it lies flat, edge shadow
    dither(g, 22, 16, 26);
  });
}

// nondescript flattened scraps — wrappers, cup, cardboard
export function scrapTex(v: number): THREE.Texture {
  return pixTex(14, 12, (g) => {
    const pal = [['#c9c2b2', '#a09884'], ['#8a6a4a', '#6a4f38'], ['#c0b0a0', '#93857a']][v % 3];
    g.fillStyle = pal[0]; g.fillRect(2, 3, 10, 7);
    g.fillStyle = pal[1]; g.fillRect(2, 8, 10, 2);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(2, 10, 10, 1);
    dither(g, 14, 12, 14);
  });
}
