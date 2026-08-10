import * as THREE from 'three';
import { makePanel, hudNote, screenFade, type Panel } from './hud';
import { pixTex, declareSurface, dither } from './paint';
import { jobChance, stat } from './stats';
import { registerSlice } from './save';
import { boardStandoff } from './shop';
import type { CtxBuild } from './ctx';
import type { Room } from './interior';

// ══ JOBS — THE APPLICATION ON THE WALL, THE PUNCH CLOCK BESIDE IT ═══════════
//
// *"need to be able to submit job application at all of the shops. with
//  varying degrees of int needed"*   (2026-08-09)
//
// …and then he used the first pass (a HELP WANTED column on the counter
// board) and re-shaped it, verbatim:
//
// *"so instead of help wanted being an option i just want a little section of
//  the interior to have an application. similar to loan app. diagetic in that
//  way. then apply if you get a job theres a clock in station that you can
//  'work' at. it's like [E] sleep. just [E] work. at the clock in part of the
//  interior. each place you work has this. each shift is 8 hrs long. on the
//  app it states the hourly wage."*   (2026-08-09)
//
// So a job is TWO OBJECTS ON A WALL, not a line on a menu:
//
//   THE APPLICATION   a clipboard under a HELP WANTED card. [E] leans you
//                     onto the paper — the bank's loan form's own grammar
//                     (`int-bank.ts`: the overlay is not a screen standing in
//                     for the paper, it IS the paper) — and the sheet states
//                     the POSITION and the HOURLY WAGE, his explicit spec.
//                     SIGN AND SUBMIT rolls `jobChance(reqInt)` once, on
//                     `Math.random` — a hiring is luck, never the seeded
//                     build stream. Hired or rejected, the paper says so in
//                     its own voice; a rejection tapes a POSITION FILLED slip
//                     over the form for REAPPLY_DAYS, so the never-zero
//                     chance cannot be brute-forced by leaning on [E].
//
//   THE TIME CLOCK    a punch clock and its card rack. The prompt is one
//                     word — `[E] work`, like `[E] sleep` — it answers only
//                     where you are hired, and every shift is EIGHT HOURS:
//                     the screen fades, the clock snaps forward the shift
//                     (the college's fade + snap), and hourly × 8 lands in
//                     cash at punch-out. One shift a day.
//
// ONE TABLE, ONE BUILDER. `jobStation()` below builds the whole wall section
// — card, clipboard, form, punch clock, rack, both [E] spots — so an interior
// contributes one call with a wall position, and the config never scatters
// into eleven rooms. One job at a time: taking a new one quits the old.
//
// ── THE WAGES, AGAINST THE RULER ────────────────────────────────────────────
//
// Rent is $500 a season = $17.86 a day; subsistence eating ~$5.50, the barn
// ~$14 (shop.ts's own table). Eight hours at the bottom rung ($3.75–4.25/hr,
// which is also honestly 1997 minimum-wage money) covers a day's rent and
// food with a few dollars left; the college's $10.00/hr pays ~4.5× the
// bodega. The BANK — his "highest" tier — has no row in this table yet
// because its teller window is bespoke; when it hires it slots in at
// ~$12/hr and req INT 10, and nothing else changes.
export const REAPPLY_DAYS = 3;
export const SHIFT_HOURS = 8;

export interface JobDef {
  /** the position, as the application prints it */
  title: string;
  /** the INT the position wants — `jobChance`'s reqInt, 1…10 */
  reqInt: number;
  /** dollars an hour — the number the application states */
  hourly: number;
  /** how the notes name the employer — 'the barn', 'the hotel' */
  at: string;
}

/**
 * THE ONE TABLE, keyed by the shop ids `shopCounter` already coined.
 *
 * ⚠ THE INT COLUMN WAS RAISED WHOLESALE — *"make int required much more for
 * all jobs. lowest int to get a job is 5"* (2026-08-09). The floor is 5 and
 * the whole ladder moved up with it, ending at 10, so the spread still means
 * something. The consequence is deliberate: a fresh average character (INT 5)
 * qualifies for the bottom rung ONLY, and everything above runs through the
 * never-zero small chance — or through the community college, which is now
 * the ladder between the rungs. Wages did not move; the same money just
 * wants a sharper head.
 */
export const JOBS: Record<string, JobDef> = {
  'ct-shop-bodega':  { title: 'COUNTER CLERK',     reqInt: 5,  hourly: 3.75,  at: 'the bodega' },
  'ct-shop-burger':  { title: 'GRILL CREW',        reqInt: 5,  hourly: 4.00,  at: 'the barn' },
  'ct-shop-video':   { title: 'REWIND CLERK',      reqInt: 6,  hourly: 4.25,  at: 'the hut' },
  'ct-shop-thrift':  { title: 'FLOOR CLERK',       reqInt: 6,  hourly: 5.00,  at: 'the thrift store' },
  'ct-shop-diner':   { title: 'LINE COOK',         reqInt: 7,  hourly: 5.50,  at: 'the diner' },
  'ct-shop-gym':     { title: 'DESK TRAINER',      reqInt: 7,  hourly: 6.00,  at: 'the gym' },
  'ct-shop-pawn':    { title: 'COUNTER MAN',       reqInt: 8,  hourly: 6.50,  at: 'the pawn shop' },
  'ct-shop-sleep':   { title: 'MATTRESS SALESMAN', reqInt: 8,  hourly: 7.25,  at: 'the showroom' },
  'ct-shop-volt':    { title: 'FLOOR SALESMAN',    reqInt: 9,  hourly: 7.75,  at: 'VOLT VILLAGE' },
  'ct-shop-hotel':   { title: 'NIGHT CLERK',       reqInt: 9,  hourly: 8.50,  at: 'the hotel' },
  'ct-shop-college': { title: 'ADJUNCT TUTOR',     reqInt: 10, hourly: 10.00, at: 'the college' },
};

// ── the employment record — module state, saved as a slice ─────────────────
//
// `hiredAt` is a JOBS key or null; `lastShiftDay` is the one-shift-a-day gate
// (GLOBAL, one body); `noAskUntil[shop]` is the first day that shop's slip
// comes off the form. NEW GAME needs no line anywhere: the state lives only
// in the `ct-save` blob, which `ct/newgame.ts` wipes whole — stats.ts's rule.
let hiredAt: string | null = null;
let lastShiftDay = -1;
let noAskUntil: Record<string, number> = {};

registerSlice('jobs', {
  capture: () => ({ hiredAt, lastShiftDay, noAskUntil: { ...noAskUntil } }),
  restore: (v: unknown) => {
    const o = v as Record<string, unknown>;
    if (!o || typeof o !== 'object') return;
    // BY NAME AND VALIDATED, stats.ts's restore rule: a corrupt blob cannot
    // hire you somewhere that does not exist.
    if (typeof o.hiredAt === 'string' && o.hiredAt in JOBS) hiredAt = o.hiredAt;
    else if (o.hiredAt === null) hiredAt = null;
    if (typeof o.lastShiftDay === 'number' && Number.isFinite(o.lastShiftDay)) {
      lastShiftDay = o.lastShiftDay;
    }
    if (o.noAskUntil && typeof o.noAskUntil === 'object') {
      noAskUntil = {};
      for (const [k, d] of Object.entries(o.noAskUntil as Record<string, unknown>)) {
        if (k in JOBS && typeof d === 'number' && Number.isFinite(d)) noAskUntil[k] = d;
      }
    }
  },
});

const dayNow = (ctx: CtxBuild): number => Math.floor(ctx.clock.now().totalMin / 1440);

/** what the form should look like right now, at one shop */
type FormState =
  | { kind: 'open' }
  | { kind: 'filled'; wait: number }     // the rejection slip, days left on it
  | { kind: 'hired' };

function formState(ctx: CtxBuild, shopId: string): FormState {
  if (hiredAt === shopId) return { kind: 'hired' };
  const wait = (noAskUntil[shopId] ?? 0) - dayNow(ctx);
  return wait > 0 ? { kind: 'filled', wait } : { kind: 'open' };
}

// ── the application, decided ────────────────────────────────────────────────
function submitApplication(ctx: CtxBuild, shopId: string): void {
  const job = JOBS[shopId];
  if (Math.random() < jobChance(job.reqInt)) {
    const old = hiredAt && hiredAt !== shopId ? JOBS[hiredAt] : null;
    hiredAt = shopId;
    hudNote(old
      ? `you're hired — ${job.title.toLowerCase()}, $${job.hourly.toFixed(2)} an hour. ${old.at} can keep the apron`
      : `you're hired — ${job.title.toLowerCase()}, $${job.hourly.toFixed(2)} an hour. clock in when you're ready`);
  } else {
    noAskUntil[shopId] = dayNow(ctx) + REAPPLY_DAYS;
    // told plainly, in period voice — and the unqualified case says what was
    // missing, because "varying degrees of int needed" is a thing the player
    // has to be able to discover.
    hudNote(stat('int') < job.reqInt
      ? `"we need somebody sharper." they keep your name on file`
      : `they went with somebody else — the position is filled for now`);
  }
}

// ── the shift ───────────────────────────────────────────────────────────────
//
// The college's own arithmetic for time passing at a fixture: `screenFade`
// with the clock SNAPPED in the dark middle (`overSeconds: 0`), 140/90/170,
// because the world going by is the same event wherever it happens.
function workShift(ctx: CtxBuild, shopId: string): void {
  const job = JOBS[shopId];
  const d = dayNow(ctx);
  if (lastShiftDay === d) {
    hudNote('you have already worked a shift today');
    return;
  }
  lastShiftDay = d;
  void screenFade({
    mid: () => ctx.clock.advance(SHIFT_HOURS * 60, { overSeconds: 0 }),
    outMs: 140, holdMs: 90, inMs: 170,
  });
  const pay = job.hourly * SHIFT_HOURS;
  ctx.purse.cash += pay;
  ctx.refreshWallet();
  hudNote(`${SHIFT_HOURS} hours at ${job.at} — $${pay.toFixed(2)}, cash`);
}

// ══ THE FORM, PAINTED ════════════════════════════════════════════════════════
//
// ONE PAINTER, TWO SURFACES — shop.ts's board rule, kept for the same reason:
// the sheet on the clipboard and the sheet you lean onto are the same piece
// of paper. The only thing the view has that the wall cannot is the wash
// under SIGN AND SUBMIT while your pointer is on it.
//
// The paper is cut at 1000 px/m off its own plane (the loan form's SHEET_PPM,
// and BUILDER-BRIEF §7b's same-both-ways rule): 0.22 × 0.30 m → 220 × 300.
const SHEET_W_M = 0.22, SHEET_H_M = 0.30;
const PPM = 1000;
const SHEET_W = Math.round(SHEET_W_M * PPM), SHEET_H = Math.round(SHEET_H_M * PPM);
/** the one live band. DECLARED ONCE and read by the painter AND the hit test
 *  (the loan form's BOX rule), so it cannot look pressable and do nothing. */
const SUBMIT = { x: 24, y: 238, w: SHEET_W - 48, h: 36 };
const inRect = (r: { x: number; y: number; w: number; h: number }, x: number, y: number) =>
  x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

const INK = '#2e2a24', DIM = '#6a6458', RED = '#8a2c22', PAPER = '#ece7d6';

function paintForm(
  g: CanvasRenderingContext2D, W: number, H: number,
  job: JobDef, state: FormState, hover: boolean,
): void {
  g.fillStyle = PAPER; g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(0,0,0,0.08)'; g.fillRect(0, 0, W, 2); g.fillRect(0, H - 3, W, 3);
  g.textBaseline = 'middle';
  // the letterhead
  g.textAlign = 'center';
  g.fillStyle = INK; g.font = 'bold 17px monospace';
  g.fillText('APPLICATION', W / 2, 24);
  g.fillStyle = DIM; g.font = 'bold 10px monospace';
  g.fillText('FOR EMPLOYMENT', W / 2, 41);
  g.fillStyle = RED; g.fillRect(14, 52, W - 28, 2);
  // ── the block he specified: the position, and the HOURLY wage ────────────
  const row = (label: string, val: string, y: number, em = false): void => {
    g.textAlign = 'left'; g.font = 'bold 11px monospace'; g.fillStyle = DIM;
    g.fillText(label, 18, y);
    g.textAlign = 'right';
    g.fillStyle = em ? RED : INK;
    g.font = em ? 'bold 13px monospace' : 'bold 11px monospace';
    g.fillText(val, W - 18, y);
  };
  row('POSITION', job.title, 70);
  row('WAGE', `$${job.hourly.toFixed(2)} / HR`, 89, true);
  row('SHIFT', `${SHIFT_HOURS} HOURS`, 108);
  g.fillStyle = 'rgba(70,62,50,0.35)'; g.fillRect(14, 121, W - 28, 1);
  // the fields a 1997 form asks for — printed furniture, ruled and labelled
  const field = (label: string, y: number): void => {
    g.textAlign = 'left'; g.fillStyle = DIM; g.font = '8px monospace';
    g.fillText(label, 18, y - 10);
    g.fillStyle = 'rgba(70,62,50,0.55)'; g.fillRect(18, y, W - 36, 1);
  };
  field('NAME', 148); field('ADDRESS', 176); field('LAST POSITION', 204);
  // your biro on the name line — the form is filled in; what's left is to sign
  g.strokeStyle = 'rgba(40,44,92,0.60)'; g.lineWidth = 1.4;
  g.beginPath();
  for (let i = 0; i < 46; i++) {
    const x = 24 + i * 1.6;
    const y = 143 + Math.sin(i * 1.1) * 2.4 + Math.sin(i * 0.31) * 1.4;
    if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
  }
  g.stroke();

  if (state.kind === 'hired') {
    // the rubber stamp, skewed the way a hand stamps
    g.save();
    g.translate(W / 2, 172); g.rotate(-0.14);
    g.globalAlpha = 0.85;
    g.strokeStyle = RED; g.lineWidth = 4; g.strokeRect(-74, -26, 148, 52);
    g.fillStyle = RED; g.font = 'bold 30px monospace'; g.textAlign = 'center';
    g.fillText('HIRED', 0, 1);
    g.restore();
    g.fillStyle = DIM; g.font = 'bold 10px monospace'; g.textAlign = 'center';
    g.fillText('REPORT TO THE TIME CLOCK', W / 2, 256);
  } else if (state.kind === 'filled') {
    // the slip, taped over the fields at a working angle
    g.save();
    g.translate(W / 2, 170); g.rotate(0.05);
    g.fillStyle = '#f4efdc'; g.fillRect(-92, -30, 184, 60);
    g.strokeStyle = 'rgba(70,62,50,0.45)'; g.lineWidth = 1; g.strokeRect(-92, -30, 184, 60);
    g.fillStyle = RED; g.font = 'bold 16px monospace'; g.textAlign = 'center';
    g.fillText('POSITION FILLED', 0, -7);
    g.fillStyle = DIM; g.font = 'bold 9px monospace';
    g.fillText(`ASK AGAIN IN ${state.wait} DAY${state.wait === 1 ? '' : 'S'}`, 0, 13);
    // the tape
    g.fillStyle = 'rgba(220,214,190,0.8)';
    g.fillRect(-100, -36, 30, 12); g.fillRect(70, 24, 30, 12);
    g.restore();
  } else {
    // SIGN AND SUBMIT — the one live thing on the sheet
    if (hover) { g.fillStyle = 'rgba(138,44,34,0.12)'; g.fillRect(SUBMIT.x, SUBMIT.y, SUBMIT.w, SUBMIT.h); }
    g.strokeStyle = RED; g.lineWidth = 2;
    g.strokeRect(SUBMIT.x, SUBMIT.y, SUBMIT.w, SUBMIT.h);
    g.fillStyle = RED; g.font = 'bold 13px monospace'; g.textAlign = 'center';
    g.fillText('SIGN AND SUBMIT', W / 2, SUBMIT.y + SUBMIT.h / 2 + 1);
  }
  dither(g, W, H, Math.round((W * H) / 1400));
}

// ══ THE STATION — ONE CALL PER INTERIOR ══════════════════════════════════════
//
// A ~1.5 m section of wall: HELP WANTED card over the clipboard on the left,
// the punch clock and its card rack on the right. The caller hands over a
// LOCAL wall position (the section's centre, on the wall face like a sign)
// and which way the wall looks; everything else — geometry, the form panel,
// both [E] spots — is built here, once, for all eleven shops.
//
// Nothing stands proud of the wall by more than 0.13 m, so the section needs
// no collider and cannot pinch a lane — it is wall furniture, like a sign.

export interface StationAt {
  /** the section's centre, LOCAL, on the wall face (proud like a sign) */
  x: number; z: number;
  /** which way the wall looks into the room; 0 faces +z, like `room.sign` */
  rotY?: number;
}

export function jobStation(ctx: CtxBuild, room: Room, shopId: string, at: StationAt): void {
  const job = JOBS[shopId];
  if (!job) {
    console.warn(`[jobs] no position in the table for '${shopId}' — building nothing.`);
    return;
  }
  const rotY = at.rotY ?? 0;
  // the wall's outward normal and its rightward tangent, off rotY alone
  const nx = Math.sin(rotY), nz = Math.cos(rotY);
  const tx = Math.cos(rotY), tz = -Math.sin(rotY);
  /** local coords `along` the wall and `proud` of it */
  const lx = (along: number, proud: number) => at.x + tx * along + nx * proud;
  const lz = (along: number, proud: number) => at.z + tz * along + nz * proud;
  const APP = -0.40, CLK = 0.30, RACK = 0.66;   // the three columns, along the wall

  // ── HELP WANTED, the card that names the section ──────────────────────────
  const cardT = declareSurface(pixTex(64, 18, (g) => {
    g.fillStyle = '#f0e9d2'; g.fillRect(0, 0, 64, 18);
    g.fillStyle = RED; g.fillRect(0, 0, 64, 2); g.fillRect(0, 16, 64, 2);
    g.font = 'bold 8px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = RED; g.fillText('HELP WANTED', 32, 9);
    dither(g, 64, 18, 6);
  }), 'sign');
  room.sign(cardT, 0.46, 0.13, lx(APP, 0.015), 1.86, lz(APP, 0.015), rotY);

  // ── the clipboard, and the paper on it ────────────────────────────────────
  const boardM = new THREE.MeshBasicMaterial({ color: 0x6a4a2a });
  const clipM = new THREE.MeshBasicMaterial({ color: 0x8a8f93 });
  const cb = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.42, 0.018), boardM);
  cb.rotation.y = rotY;
  const cbMesh = room.put(cb, lx(APP, 0.02), 1.44, lz(APP, 0.02));
  const clip = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.035, 0.030), clipM);
  clip.rotation.y = rotY;
  room.put(clip, lx(APP, 0.028), 1.63, lz(APP, 0.028));
  // THE SHEET — the same painter the panel uses, at the same canvas size,
  // shop.ts's one-painter rule: the paper cannot say one thing on the wall
  // and another in your hands. (The wall copy is painted at build in the
  // blank OPEN state; the slip and the stamp are session state, read at
  // panel size, where you read them.)
  const sheetT = declareSurface(pixTex(SHEET_W, SHEET_H, (g) =>
    paintForm(g, SHEET_W, SHEET_H, job, { kind: 'open' }, false)), 'sign');
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(SHEET_W_M, SHEET_H_M), ctx.flat(sheetT));
  sheet.rotation.y = rotY;
  const sheetMesh = room.put(sheet, lx(APP, 0.032), 1.42, lz(APP, 0.032));

  // ── the panel: you lean onto the paper, the loan form's grammar ───────────
  let panel: Panel | null = null;
  let hover = false;
  const open = (): void => {
    if (!panel) {
      panel = makePanel({
        id: `ct-job-${shopId.slice('ct-shop-'.length)}`,
        w: SHEET_W, h: SHEET_H, chrome: 'none',
        hint: () => {
          const s = formState(ctx, shopId);
          if (s.kind === 'hired') return 'yours already — ESC  step back';
          if (s.kind === 'filled') return 'position filled — ESC  step back';
          return 'click SIGN AND SUBMIT   ·   ESC  step back';
        },
        draw: (g, W, H) => paintForm(g, W, H, job, formState(ctx, shopId), hover),
        surface: {
          mesh: () => sheetMesh,
          // a reading distance off a vertical sheet at chest height — derived
          // from the sheet's own metres, not typed (shop.ts's boardStandoff)
          standoff: boardStandoff({ wM: SHEET_W_M, hM: SHEET_H_M, fov: 45, riseM: 0 }),
          fov: 45,
          hot: (x, y) => formState(ctx, shopId).kind === 'open' && inRect(SUBMIT, x, y),
          move: (x, y) => {
            const h = formState(ctx, shopId).kind === 'open' && inRect(SUBMIT, x, y);
            if (h !== hover) { hover = h; panel?.repaint(); }
          },
          click: (x, y) => {
            if (formState(ctx, shopId).kind !== 'open' || !inRect(SUBMIT, x, y)) return;
            submitApplication(ctx, shopId);
            panel?.repaint();
          },
        },
        onOpen: () => { hover = false; },
        onClose: () => { hover = false; },
      });
    }
    panel.open();
  };
  ctx.spot({
    x: room.wx(lx(APP, 0.75)), z: room.wz(lz(APP, 0.75)),
    aimX: room.wx(lx(APP, 0)), aimZ: room.wz(lz(APP, 0)),
    r: 0.9, obj: cbMesh,
    ok: room.inside,
    label: () => 'apply',
    act: open,
  });

  // ── the punch clock ────────────────────────────────────────────────────────
  const steelM = new THREE.MeshBasicMaterial({ color: 0x74787c });
  const bodyM = new THREE.MeshBasicMaterial({ color: 0x2e3134 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.36, 0.12), bodyM);
  body.rotation.y = rotY;
  const clockMesh = room.put(body, lx(CLK, 0.06), 1.55, lz(CLK, 0.06));
  // the dome bell on top — the thing that makes it a punch clock at a glance
  const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.035, 10), steelM);
  room.put(bell, lx(CLK, 0.06), 1.75, lz(CLK, 0.06));
  // a REAL face, on the kit, so it tells the time like every clock in town
  room.clock({ lx: lx(CLK, 0.125), y: 1.60, lz: lz(CLK, 0.125), r: 0.075, rotY });
  // the card throat, under the face
  const throat = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.022, 0.03), steelM);
  throat.rotation.y = rotY;
  room.put(throat, lx(CLK, 0.125), 1.44, lz(CLK, 0.125));
  // the rack of time cards beside it — painted, one plane, read at arm's length
  const rackT = declareSurface(pixTex(40, 60, (g) => {
    g.fillStyle = '#5a4228'; g.fillRect(0, 0, 40, 60);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 58, 40, 2);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 2; c++) {
      const x = 5 + c * 17, y = 5 + r * 14;
      g.fillStyle = '#3a2c1c'; g.fillRect(x - 1, y + 5, 15, 6);      // the pocket
      g.fillStyle = c === 0 && r === 1 ? '#e8e2cc' : '#d8d2ba';      // the cards
      g.fillRect(x, y, 13, 9);
      g.fillStyle = 'rgba(70,62,50,0.5)'; g.fillRect(x + 2, y + 2, 9, 1);
    }
    dither(g, 40, 60, 10);
  }), 'detail');
  const rack = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.36), ctx.flat(rackT));
  rack.rotation.y = rotY;
  room.put(rack, lx(RACK, 0.02), 1.50, lz(RACK, 0.02));

  // [E] work — one word, like sleep, and only where you are on the payroll
  ctx.spot({
    x: room.wx(lx(CLK, 0.75)), z: room.wz(lz(CLK, 0.75)),
    aimX: room.wx(lx(CLK, 0)), aimZ: room.wz(lz(CLK, 0)),
    r: 0.9, obj: clockMesh,
    ok: () => room.inside() && hiredAt === shopId,
    label: () => 'work',
    act: () => workShift(ctx, shopId),
  });
}
