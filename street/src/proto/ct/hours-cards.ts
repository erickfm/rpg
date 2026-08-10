import * as THREE from 'three';
import { BUILD, type CtxBuild } from './ctx';
import { pixTex, declareSurface, dither } from './paint';
import { doorPointFor, doorLeafFor } from './doors';
import { HOURS, fmtHour, type BizHours } from './hours';

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
//   open24   the die-cut red plastic OPEN 24 HOURS sign — bodega, diner,
//            hotel desk, casino. Rounded, white-rimmed, corners cut away.
//   gilt     a painted card, gold serif on deep green behind bank glass —
//            First Federal and the tax office, who would not use plastic.
//   taped    a hand-lettered card stuck up with tape, hung slightly crooked —
//            the pawn shop and the thrift, who would not buy a sign.
//   plastic  everyone else: the mall-bought BUSINESS HOURS placard, colour
//            band on white, in the two colourways the sign shop stocked.
//
// ⚠ A SEPARATE MODULE FROM `hours.ts`, NOT TIDINESS. This file needs
// `ct/doors.ts` for where the doors are, doors.ts eagerly globs `int-*.ts`,
// and every int-*.ts reaches `hours.ts` through shop.ts/jobs.ts — so hours.ts
// importing doors.ts would close the GOTCHAS §28 cycle and drop rooms from
// the built bundle only. Nothing imports THIS file; it is a leaf on the safe
// side of the glob, registered by `ct/world.ts`'s own sweep.
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

// who gets which sign — the 24-hour places are decided by their hours, the
// rest by what kind of business would hang what
const STYLE: Record<string, (h: BizHours) => Card> = {
  'FIRST FEDERAL': giltCard,
  'A-1 TAX': giltCard,
  'PAWN': tapedCard,
  'THRIFT': tapedCard,
};

function cardFor(h: BizHours): Card {
  if (h.close - h.open >= 24) return open24Card();
  return (STYLE[h.building] ?? plasticCard)(h);
}

export function register(ctx: CtxBuild): void {
  for (const h of HOURS) {
    const d = doorPointFor(h.building);
    // a business whose room has not declared a door gets no card rather than
    // a card floating at a guess — the same fallback shape doors.ts itself uses
    if (!d) continue;
    const leaf = doorLeafFor(h.building);
    // beside the jamb, not on the leaf: half the clear opening plus a hand's
    // width along the wall, 25 mm proud of the facade plane so it cannot
    // z-fight the painted shopfront. Tangent is the normal turned a quarter —
    // works the same on the bodega's cut corner as on a flat frontage.
    const off = leaf.clearW / 2 + 0.28;
    const tx = d.nz, tz = -d.nx;
    const card = cardFor(h);
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
    // sidewalk sits at KERB_H = 0.14 (crosstown.ts); centre the card at the
    // eye line of somebody reading it off the walk
    m.position.set(d.x + tx * off + d.nx * 0.025, 0.14 + 1.48, d.z + tz * off + d.nz * 0.025);
    ctx.scene.add(m);
  }
}
