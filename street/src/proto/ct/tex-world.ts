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

// ── the entrance bay ──────────────────────────────────────────────────────
// The span of residential ground floor reserved for the front door and its
// furniture. resGroundTex keeps the window rhythm OUT of it and paints a
// narrow stone doorcase in the middle; ct/apartment.ts hangs the door,
// transom, buzzer and stoop inside it. Both sides read these same numbers —
// that is the whole point of the constant.
//
// Before this existed the windows tiled at a fixed pitch straight down the
// middle of the facade and the entrance props were positioned independently,
// so the buzzer sat on a window pane and the nameplate ran behind the door
// frame with its last letter clipped off. Nothing knew about anything else.
//
// Datum: y is metres above the base of the ground-floor band (the shop box
// spans world y 0…3.2, so these are world heights too). The sidewalk top is
// at y = KERB_H = 0.14. Widths are metres either side of the door centreline.
//
// COUPLING, and it is load-bearing: the bay is centred on the BUILDING, so
// ct/apartment.ts's DOOR_Z must equal the residential building's centre z.
// It does (No. 227 is 18 m wide with its centre at z = -44, laid out by
// ct/street.ts's EAST roster). Move the building and the door moves with it.
export const ENTRANCE = {
  /** reserved span, centred on the building: no window may enter it. The
   *  brick runs straight through — reserving the span is a LAYOUT act, not
   *  a paint act. (It was briefly painted as one big pale stone panel. It
   *  read as a blank slab pasted onto the building; the brick belongs.)
   *  4 m, down from 5: the nameplate that used to need the extra room is
   *  gone, and only the narrow buzzer panel hangs on the brick now. */
  BAY_W: 4.0,
  /** the dark doorway opening — 14 texels at 8 px/m */
  OPEN_W: 1.75,
  /** the limestone doorcase, outer edge to outer edge: a narrow frame that
   *  hugs the door and transom, 3 texels of stone down each side */
  CASE_W: 2.5,
  /** opening head and threshold; the threshold is the top of the stoop */
  OPEN_TOP: 2.9,
  OPEN_BOT: 0.3,
  /** centre of the buzzer panel, offset from the door centreline — out on
   *  the brick, clear of the doorcase, well inside the reserved span */
  FURN_C: 1.55,
  /** the ground-floor band's height — what converts metres to texels */
  BAND_H: 3.2,
} as const;

// residential ground floor — brick continues to the street, barred windows
// built into the wall (stone lintel over, stone sill under), no shop band:
// the walk-up's own face. The middle of the facade is given over to the
// stone entrance bay; the windows are laid out symmetrically in the two
// panels either side of it and never enter it.
//
// Pass bayW = 0 for a residential ground floor with no street door — the
// window rhythm then runs evenly across the whole width.
export function resGroundTex(brick: string, wMeters = 12, bayW = ENTRANCE.BAY_W): THREE.Texture {
  const W = Math.max(64, Math.round(wMeters * 8)), H = 32;
  const ppmX = W / wMeters, ppmY = H / ENTRANCE.BAND_H;
  // limestone that reads as STONE against brick, not as bare canvas: warm,
  // a shade darker than the kerb so it never goes near white, and the same
  // family as the window sills facadeTex uses on the floors above (#9a8a72)
  const STONE = '#8b8272', STONE_HI = '#9a9080', STONE_LO = '#6b6355', DARK = '#141820';
  // the bay, snapped to whole texels and forced symmetric (bx1 = W - bx0) so
  // its jambs line up with the door ct/apartment.ts hangs between them
  const bay = Math.min(Math.round(W * 0.55), Math.round(bayW * ppmX));
  const hasBay = bayW > 0 && bay >= 8;
  const bx0 = hasBay ? Math.round((W - bay) / 2) : -1, bx1 = W - bx0;
  // window rhythm: as many as fit the panel with at least a pier's worth of
  // brick between them and at each end, then spread the slack evenly
  const winW = Math.max(6, Math.round(1.5 * ppmX));
  const pierMin = Math.max(4, Math.round(1.0 * ppmX));
  const panel = (x0: number, x1: number): number[] => {
    const span = x1 - x0;
    const n = Math.floor((span - pierMin) / (winW + pierMin));
    if (n < 1) return [];
    const pier = (span - n * winW) / (n + 1);
    return Array.from({ length: n }, (_, i) => Math.round(x0 + pier * (i + 1) + winW * i));
  };
  const wins = hasBay ? [...panel(0, bx0), ...panel(bx1, W)] : panel(0, W);
  return pixTex(W, H, (g) => {
    g.fillStyle = brick; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(0,0,0,0.22)';
    for (let y = 0; y < H; y += 5) g.fillRect(0, y, W, 1);
    for (let y = 0; y < H; y += 10) for (let x = (y % 20) ? 0 : 4; x < W; x += 9) g.fillRect(x, y, 1, 5);
    for (const wx of wins) {
      g.fillStyle = STONE; g.fillRect(wx - 1, 6, winW + 2, 2);          // lintel
      g.fillStyle = STONE_HI; g.fillRect(wx - 1, 6, winW + 2, 1);
      g.fillStyle = DARK; g.fillRect(wx, 8, winW, 14);                  // reveal
      g.fillStyle = '#3a4450'; g.fillRect(wx + 1, 9, winW - 2, 12);     // glass
      g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(wx + 1, 9, 3, 12);
      // bars every 3 texels, not 4: at a 12-texel window a 4-texel pitch only
      // fits two, and two bars read as window mullions rather than security
      g.fillStyle = '#1a1c22';
      for (let bx = wx + 2; bx < wx + winW - 1; bx += 3) g.fillRect(bx, 9, 1, 12);
      g.fillStyle = STONE; g.fillRect(wx - 1, 22, winW + 2, 2);         // sill
      g.fillStyle = STONE_HI; g.fillRect(wx - 1, 22, winW + 2, 1);
      g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(wx - 1, 24, winW + 2, 1);
    }
    if (hasBay) {
      // The doorcase: a NARROW limestone frame hugging the door and transom,
      // three texels of stone down each side and a lintel over the head —
      // the way a real walk-up dresses its entrance. The brick either side of
      // it is untouched; all the reserved span does is keep windows away.
      const cx0 = Math.round(W / 2 - (ENTRANCE.CASE_W / 2) * ppmX), cx1 = W - cx0;
      const ox0 = Math.round(W / 2 - (ENTRANCE.OPEN_W / 2) * ppmX), ox1 = W - ox0;
      const oy0 = Math.round((ENTRANCE.BAND_H - ENTRANCE.OPEN_TOP) * ppmY);
      const oy1 = Math.round((ENTRANCE.BAND_H - ENTRANCE.OPEN_BOT) * ppmY);
      g.fillStyle = STONE; g.fillRect(cx0, 0, cx1 - cx0, H);
      // jamb stones, stacked — coursed only inside the two narrow uprights
      g.fillStyle = STONE_LO;
      for (let y = 5; y < H; y += 5) {
        g.fillRect(cx0, y, ox0 - cx0, 1); g.fillRect(ox1, y, cx1 - ox1, 1);
      }
      g.fillStyle = STONE_HI;                                            // lit outer arris
      g.fillRect(cx0, 0, 1, H); g.fillRect(ox1, oy0, 1, H - oy0);
      g.fillStyle = 'rgba(0,0,0,0.16)';                                  // shaded inner arris
      g.fillRect(ox0 - 1, oy0, 1, H - oy0); g.fillRect(cx1 - 1, 0, 1, H);
      g.fillStyle = STONE_HI; g.fillRect(cx0, 0, cx1 - cx0, 1);          // lintel top
      // one-texel shadow joint where stone meets brick: a built joint, never
      // a gap you can see the background through
      g.fillStyle = 'rgba(0,0,0,0.30)';
      g.fillRect(cx0 - 1, 0, 1, H); g.fillRect(cx1, 0, 1, H);
    }
    dither(g, W, H, 80);
    // The doorway is punched AFTER the grain, and is the only thing that is.
    // dither() sprays white specks over the whole texture; inside the black
    // reveal around the door leaf one white texel is the brightest thing in
    // frame and reads as a stuck pixel. Nothing in a doorway catches light.
    if (hasBay) {
      const ox0 = Math.round(W / 2 - (ENTRANCE.OPEN_W / 2) * ppmX), ox1 = W - ox0;
      const oy0 = Math.round((ENTRANCE.BAND_H - ENTRANCE.OPEN_TOP) * ppmY);
      const oy1 = Math.round((ENTRANCE.BAND_H - ENTRANCE.OPEN_BOT) * ppmY);
      g.fillStyle = DARK; g.fillRect(ox0, oy0, ox1 - ox0, oy1 - oy0);
      g.fillStyle = 'rgba(0,0,0,0.45)';                                  // shadow cast into it
      g.fillRect(ox0, oy0, 1, oy1 - oy0); g.fillRect(ox0, oy0, ox1 - ox0, 1);
    }
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

// Paper trash: flyers, handbills, folded sheets — gone soft and grey in the
// wet. Not "a newspaper": the note was "like paper. like flyers and stuff.
// folded paper trash wet from rain".
export function paperTex(v: number): THREE.Texture {
  return pixTex(22, 16, (g) => {
    const k = v % 4;
    if (k === 0) {          // flyer, headline block + columns, half soaked
      g.fillStyle = '#c2beb2'; g.fillRect(1, 1, 20, 14);
      g.fillStyle = '#8e8a7e'; g.fillRect(1, 9, 20, 6);           // wet half, darker
      g.fillStyle = '#4e4c46'; g.fillRect(3, 3, 14, 3);           // headline bar
      for (let y = 8; y < 14; y += 2) g.fillRect(3, y, 9, 1);
    } else if (k === 1) {   // folded in half — a crease and a lifted edge
      g.fillStyle = '#bdb9ad'; g.fillRect(2, 3, 18, 11);
      g.fillStyle = 'rgba(0,0,0,0.26)'; g.fillRect(10, 3, 1, 11); // fold crease
      g.fillStyle = '#a9a496'; g.fillRect(11, 3, 9, 11);          // far leaf in shade
      g.fillStyle = 'rgba(0,0,0,0.30)'; g.fillRect(2, 13, 18, 1);
    } else if (k === 2) {   // pulpy, soaked through, edges gone dark and curled
      g.fillStyle = '#a49f92'; g.fillRect(2, 2, 18, 12);
      g.fillStyle = '#7e796e'; g.fillRect(2, 2, 18, 3);
      g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(2, 11, 18, 3);
      g.fillStyle = '#8d887c'; g.fillRect(5, 6, 12, 3);
    } else {                // torn handbill, one ragged edge
      g.fillStyle = '#c8c2b4'; g.fillRect(3, 2, 16, 12);
      g.fillStyle = '#9a9488'; g.fillRect(3, 2, 3, 12);
      g.fillStyle = '#54524c'; for (let y = 5; y < 13; y += 3) g.fillRect(7, y, 9, 1);
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(3, 13, 16, 1);
    }
    dither(g, 22, 16, 20);
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
