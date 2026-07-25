import * as THREE from 'three';
import { pixTex, dither } from './paint';
import { facadeTex, masonry, SHOP_BAND_H, SHOP_MULT } from './tex-world';
import { type BldSpec } from './civic';
import { type AABB } from '../fp';

// GOLDEN ACES and HOTEL ORPHEUS — the two buildings at the far end of the side
// street, and the ONLY TWO IN THE WORLD THAT ARE LIGHT SOURCES rather than lit
// surfaces. That sentence is the whole design and everything below serves it.
//
// They were split out of ct/street.ts for the same reason the library and the
// church went into ct/civic.ts: they share no vocabulary with the shopfront
// system. A barber and a deli are a brick box with a painted band and that is
// right for them. Built out of those parts, a casino and a hotel came out
// wearing a barber's clothes, which is what the user was looking at when they
// said "these building are meant to be some of the most insane".
//
// street.ts owns WHERE they stand — the NORTH2 roster and the cursor that walks
// it. This file owns what they look like.
//
// ── HOW A LIGHT SOURCE IS BUILT IN A WORLD WITH NO LIGHTS ─────────────────
//
// Everything here is unlit MeshBasicMaterial, so nothing actually emits. Three
// mechanisms do the work instead, and none of them needed a change to a file I
// do not own:
//
//  1. `props.dimWorld` grades the whole block down after dark, and it SKIPS any
//     material flagged `transparent`. So every bulb, tube and spill here is
//     transparent, which means the street falls away around them at night while
//     they hold their brightness. They do not get brighter; everything else
//     gets darker, and that reads as light.
//  2. `fog: false` on the lit parts only. The far end of the side street
//     dissolves into haze at 40 m, so neon that refuses to is read as neon —
//     the same reasoning the rooftop pylon already carried. The structure it is
//     mounted on DOES take fog, so the signs hang in the murk.
//  3. The night curve is read, not written. `scene.background` carries the sky
//     colour and the sim updates it every frame; its luminance runs from ~0.30
//     at noon to ~0.011 after 22:00 (measured, not guessed). A `mesh.onBefore
//     Render` hook reads it and drives the chase, the tube brightness and the
//     pavement spill from it. That is a read of a value that is already there —
//     no new export, no signature change, and in particular NO edit to
//     ct/props.ts, which the desk asked to be consulted about.
//
// Worth recording why `props.lit` is NOT used for the spill even though the
// brief suggested it: `lit()` registers an object to CATCH lamplight and take
// amber from the nearest lamp head. It is for things standing in the street,
// which is the opposite problem. A casino does not catch light.
//
// ── AND IT IS STILL 1997, AND PAST IT ─────────────────────────────────────
//
// Refitted in 1984 and losing money since. That is a specific look and it is
// mostly subtraction: grime streaking down from the gold, one dead bulb in the
// chase that never lights, one glazing panel replaced in a bronze that does not
// match, and a VACANCY sign that has been on for a long time.
export function buildVice(o: {
  scene: THREE.Scene;
  flat: (m: THREE.Texture) => THREE.MeshBasicMaterial;
  solid: (b: AABB) => AABB;
  KERB_H: number;
}) {
  const { scene, flat, solid, KERB_H } = o;

  const GOLD = '#d8a83a', GOLD_D = '#8a6a22', RED = '#8e1f2a', RED_D = '#5a1520';
  const BRONZE = '#6a5638', GLASS_LIT = '#e8c88a';

  // ── the night driver ──────────────────────────────────────────────────
  //
  // One hook, attached to a mesh that is always drawn with these buildings, and
  // guarded on the renderer's own frame counter so it runs once per frame no
  // matter how many meshes carry it.
  type Tick = (night: number, t: number) => void;
  const ticks: Tick[] = [];
  let lastFrame = -1;
  const driver = (renderer: THREE.WebGLRenderer, sc: THREE.Scene) => {
    const f = renderer.info.render.frame;
    if (f === lastFrame) return;
    lastFrame = f;
    const bg = sc.background as THREE.Color | null;
    // luminance → night, calibrated off the real sky curve: 0.30 at noon,
    // 0.24 at 18:00, 0.06 at 20:00, 0.011 by 22:00
    const lum = bg ? 0.2126 * bg.r + 0.7152 * bg.g + 0.0722 * bg.b : 0;
    const night = Math.max(0, Math.min(1, (0.20 - lum) / 0.16));
    const t = performance.now() / 1000;
    for (const fn of ticks) fn(night, t);
  };

  // ── the neon vocabulary: TUBES, not stripes ───────────────────────────
  //
  // A painted stripe is one colour. A tube is three things at once: the dark
  // glass casing, the phosphor glow through it, and the hot core with a
  // highlight where the glass catches the light. Drawn as three passes over the
  // same letterform — a thick dark stroke, a mid stroke in the neon colour, a
  // thin near-white fill — which is what separates neon from a painted sign.
  const tubeText = (
    g: CanvasRenderingContext2D, s: string, x: number, y: number,
    px: number, col: string, core = '#fff6e0', casing = '#1e1a24',
  ) => {
    g.font = `bold ${px}px monospace`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineJoin = 'round'; g.lineCap = 'round';
    g.strokeStyle = casing; g.lineWidth = Math.max(3, px * 0.30); g.strokeText(s, x, y);
    g.strokeStyle = col; g.lineWidth = Math.max(2, px * 0.17); g.strokeText(s, x, y);
    g.fillStyle = core; g.fillText(s, x, y);
  };

  /** a run of bulb sockets, evenly spaced, as texel centres */
  const sockets = (from: number, to: number, pitch: number) => {
    const n = Math.max(2, Math.round((to - from) / pitch));
    return Array.from({ length: n + 1 }, (_, i) => from + ((to - from) * i) / n);
  };

  // grime: vertical streaks weeping down from whatever is above them. The one
  // mark that says "and nobody has washed it since 1984".
  const grime = (g: CanvasRenderingContext2D, W: number, y0: number, h: number, n: number) => {
    for (let i = 0; i < n; i++) {
      const x = Math.round(((i * 37) % W));
      const len = 3 + ((i * 13) % Math.max(4, h));
      g.fillStyle = i % 3 === 0 ? 'rgba(0,0,0,0.20)' : 'rgba(0,0,0,0.12)';
      g.fillRect(x, y0, 1, len);
    }
  };

  // ═══ the casino's shopfront band ═══════════════════════════════════════
  //
  // The entrance is drawn at u = 0.4944 of the band, which is world x = 51.29,
  // which is where ct/int-casino.ts's [E] spot stands. That coupling is silent
  // if it breaks — you would walk up to a painted wall and the prompt would
  // come from a metre to your left — so it is stated in both files.
  //
  // Side-street buildings put the facade on the box's -z face, and that face's
  // u runs from HIGH x to low x. So texel 0 is the EAST end of the building.
  const acesBand = (b: BldSpec) => {
    const s = masonry(b.w, SHOP_BAND_H, 0, SHOP_MULT);
    const { W, H } = s;
    const yOf = (wy: number) => Math.round(((SHOP_BAND_H - wy) / SHOP_BAND_H) * H);
    const doorU = 0.4944;                       // == world x 51.29
    return s.paint((g) => {
      // the 1984 refit: polished red panelling, not brick
      g.fillStyle = RED_D; g.fillRect(0, 0, W, H);
      g.fillStyle = RED; g.fillRect(0, yOf(3.9), W, yOf(0.55) - yOf(3.9));
      // vertical joints in the panelling
      g.fillStyle = 'rgba(0,0,0,0.16)';
      for (let x = 0; x < W; x += 24) g.fillRect(x, yOf(3.9), 1, yOf(0.55) - yOf(3.9));
      // black granite base — the one honestly expensive material left
      g.fillStyle = '#1b1a1e'; g.fillRect(0, yOf(0.55), W, H - yOf(0.55));
      g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(0, yOf(0.55), W, 1);

      // ── the glazing: MIRRORED bronze, deliberately ──
      //
      // Not "lit from within so you see a lobby": you cannot see into this one,
      // and that is the point — it is why ct/int-casino.ts has no window in its
      // front wall. A casino does not let you see the floor from the street and
      // it does not let the floor see out. Bronzed mirror glass, 1984's
      // favourite material, reflecting the sky and the street rather than
      // showing anything behind it.
      const gy0 = yOf(3.25), gy1 = yOf(0.6);
      const bays = 7;
      for (let i = 0; i < bays; i++) {
        const x0 = Math.round(4 + (i * (W - 8)) / bays), x1 = Math.round(4 + ((i + 1) * (W - 8)) / bays);
        // the mismatched replacement panel: bay 4 was broken and the glass that
        // came back is greener and flatter than the rest of the run
        const swap = i === 4;
        const top = swap ? '#5c6a52' : '#7a6234';
        const bot = swap ? '#3c4636' : '#4a3a20';
        for (let y = gy0; y < gy1; y++) {
          const k = (y - gy0) / (gy1 - gy0);
          g.fillStyle = k < 0.42 ? top : bot;
          g.fillRect(x0, y, x1 - x0, 1);
        }
        // the sky, raked across the top of every pane — what makes mirror glass
        // read as mirror rather than as brown paint
        g.fillStyle = swap ? 'rgba(200,215,205,0.30)' : 'rgba(215,205,175,0.34)';
        for (let j = 0; j < 9; j++) g.fillRect(x0 + 1 + j, gy0 + 2 + j, Math.max(2, (x1 - x0) - 10 - j), 1);
        // bronze mullion
        g.fillStyle = BRONZE; g.fillRect(x1 - 2, gy0 - 2, 3, gy1 - gy0 + 4);
      }
      g.fillStyle = BRONZE;
      g.fillRect(2, gy0 - 3, W - 4, 3); g.fillRect(2, gy1, W - 4, 3);
      g.fillRect(2, gy0 - 3, 3, gy1 - gy0 + 6); g.fillRect(W - 5, gy0 - 3, 3, gy1 - gy0 + 6);

      // ── the entrance: gold portal, doors set back in a reveal ──
      const dc = Math.round(doorU * W), dw = s.at(1.5);
      g.fillStyle = '#141118'; g.fillRect(dc - dw, gy0 - 3, dw * 2, H - (gy0 - 3));
      // the reveal, so the doors are IN something
      g.fillStyle = GOLD_D; g.fillRect(dc - dw - 4, gy0 - 6, dw * 2 + 8, 5);
      g.fillStyle = GOLD; g.fillRect(dc - dw - 4, gy0 - 6, dw * 2 + 8, 2);
      for (const sx of [-1, 1]) {
        g.fillStyle = GOLD_D; g.fillRect(dc + sx * dw - (sx > 0 ? 4 : 0), gy0 - 6, 4, H - gy0 + 6);
        g.fillStyle = GOLD; g.fillRect(dc + sx * dw - (sx > 0 ? 3 : 0), gy0 - 6, 2, H - gy0 + 6);
      }
      // two leaves of bronzed glass with long gold pulls
      for (const sx of [-1, 1]) {
        const lx = dc + sx * (dw * 0.5) - dw * 0.42;
        g.fillStyle = '#3a3020'; g.fillRect(lx, gy0, Math.round(dw * 0.84), gy1 - gy0 + s.at(0.4));
        g.fillStyle = 'rgba(232,200,138,0.16)'; g.fillRect(lx + 1, gy0 + 1, Math.round(dw * 0.84) - 2, 10);
        g.fillStyle = GOLD; g.fillRect(lx + (sx > 0 ? 2 : Math.round(dw * 0.84) - 4), gy0 + 12, 2, s.at(1.0));
      }

      // ── the fascia over the glazing, and the grime on it ──
      const fy = yOf(4.2), fy1 = yOf(3.3);
      g.fillStyle = GOLD_D; g.fillRect(0, fy, W, fy1 - fy);
      g.fillStyle = GOLD; g.fillRect(0, fy + 2, W, Math.max(2, (fy1 - fy) - 6));
      g.fillStyle = 'rgba(255,255,255,0.20)'; g.fillRect(0, fy + 2, W, 1);
      g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(0, fy1 - 3, W, 3);
      // a row of small bulbs along the fascia — repetition is the vocabulary
      for (const bx of sockets(6, W - 6, 9)) {
        g.fillStyle = '#f6e2a2'; g.fillRect(Math.round(bx) - 1, fy + 5, 3, 3);
        g.fillStyle = 'rgba(246,226,162,0.30)'; g.fillRect(Math.round(bx) - 2, fy + 4, 5, 5);
      }
      grime(g, W, fy1, s.at(1.6), 42);
      grime(g, W, yOf(0.62), s.at(0.5), 18);
      dither(g, W, H, 320);
    });
  };

  // ═══ the hotel's shopfront band ════════════════════════════════════════
  //
  // The opposite decision to the casino's glass, and for the same reason it is
  // the right one: you SHOULD see the lobby. ct/int-hotel.ts has a window in
  // its front wall, the room behind it is warm, and a hotel wants you to see
  // that there is somewhere to sit. Entrance at u = 0.495 == world x 39.51,
  // where ct/int-hotel.ts's [E] spot stands.
  const orpheusBand = (b: BldSpec) => {
    const s = masonry(b.w, SHOP_BAND_H, 0, SHOP_MULT);
    const { W, H } = s;
    const yOf = (wy: number) => Math.round(((SHOP_BAND_H - wy) / SHOP_BAND_H) * H);
    const doorU = 0.495;                        // == world x 39.51
    return s.paint((g) => {
      // rusticated stone base — this building is older than its refit and the
      // ground floor is the part that still says so
      g.fillStyle = '#6e685c'; g.fillRect(0, 0, W, H);
      g.fillStyle = '#7a7466';
      for (let y = yOf(4.2); y < yOf(0.4); y += 11) g.fillRect(0, y, W, 9);
      g.fillStyle = 'rgba(0,0,0,0.22)';
      for (let y = yOf(4.2); y < yOf(0.4); y += 11) g.fillRect(0, y + 9, W, 2);
      g.fillStyle = '#4e4a42'; g.fillRect(0, yOf(0.4), W, H - yOf(0.4));

      // ── the lobby, seen through the glass ──
      const gy0 = yOf(3.3), gy1 = yOf(0.7);
      const bays = 6;
      for (let i = 0; i < bays; i++) {
        const x0 = Math.round(5 + (i * (W - 10)) / bays), x1 = Math.round(5 + ((i + 1) * (W - 10)) / bays);
        // warm interior, brighter deep in the room than at the glass
        for (let y = gy0; y < gy1; y++) {
          const k = (y - gy0) / (gy1 - gy0);
          g.fillStyle = k < 0.30 ? '#c8a468' : k < 0.72 ? GLASS_LIT : '#8a6c44';
          g.fillRect(x0, y, x1 - x0, 1);
        }
        // the reflection of the street ON the glass, over the top third — glass
        // is both a window and a mirror and drawing only one of them is what
        // makes a shopfront read as a hole
        g.fillStyle = 'rgba(150,170,180,0.26)';
        for (let j = 0; j < 7; j++) g.fillRect(x0 + 1, gy0 + 1 + j * 2, Math.max(2, (x1 - x0) - 4 - j * 2), 1);
        // silhouettes: a chair, a palm, the desk, somebody at it
        g.fillStyle = 'rgba(58,42,30,0.72)';
        if (i === 1) { g.fillRect(x0 + 4, gy1 - 14, 8, 14); g.fillRect(x0 + 3, gy1 - 18, 4, 5); }
        if (i === 2) { g.fillRect(x0 + 6, gy1 - 22, 3, 22); g.fillRect(x0 + 2, gy1 - 26, 11, 6); }
        if (i === 4) { g.fillRect(x0 + 2, gy1 - 12, x1 - x0 - 6, 12); }
        if (i === 4) { g.fillRect(x0 + 8, gy1 - 20, 5, 9); }
        g.fillStyle = BRONZE; g.fillRect(x1 - 2, gy0 - 2, 3, gy1 - gy0 + 4);
      }
      g.fillStyle = BRONZE;
      g.fillRect(3, gy0 - 3, W - 6, 3); g.fillRect(3, gy1, W - 6, 3);

      // ── the entrance: a revolving door in a stone case ──
      const dc = Math.round(doorU * W), dw = s.at(1.35);
      g.fillStyle = '#8a8478'; g.fillRect(dc - dw - 5, gy0 - 8, dw * 2 + 10, H - gy0 + 8);
      g.fillStyle = '#9a9488'; g.fillRect(dc - dw - 5, gy0 - 8, dw * 2 + 10, 3);
      g.fillStyle = '#141118'; g.fillRect(dc - dw, gy0 - 2, dw * 2, H - gy0 + 2);
      // the drum, and the two leaves you can see edge-on inside it
      g.fillStyle = '#3a3428'; g.fillRect(dc - dw + 2, gy0, dw * 2 - 4, gy1 - gy0 + s.at(0.5));
      g.fillStyle = 'rgba(232,200,138,0.30)'; g.fillRect(dc - dw + 3, gy0 + 1, dw * 2 - 6, gy1 - gy0 - 2);
      g.fillStyle = BRONZE;
      g.fillRect(dc - 1, gy0, 3, gy1 - gy0 + s.at(0.5));
      g.fillRect(dc - dw + 2, gy0, 2, gy1 - gy0 + s.at(0.5));
      g.fillRect(dc + dw - 4, gy0, 2, gy1 - gy0 + s.at(0.5));
      // brass kick plate, worn through in the middle where every shoe hits it
      g.fillStyle = '#8a7434'; g.fillRect(dc - dw + 2, yOf(0.45), dw * 2 - 4, s.at(0.3));
      g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(dc - 6, yOf(0.45), 12, s.at(0.3));

      grime(g, W, yOf(3.3), s.at(1.2), 30);
      grime(g, W, yOf(0.42), s.at(0.4), 14);
      dither(g, W, H, 300);
    });
  };

  // ── the shell ─────────────────────────────────────────────────────────
  const spans: Record<string, [number, number]> = {};
  const placeShell = (x0: number, zc: number, b: BldSpec) => {
    const cx = x0 + b.w / 2;
    const gh = SHOP_BAND_H;
    const h = 3.4 + b.floors * 2.4;
    spans[b.nm] = [x0, x0 + b.w];
    const facade = flat(facadeTex(b.brick, b.floors, b.w));
    const endM = new THREE.MeshBasicMaterial({ color: 0x53382e });
    const roofM = new THREE.MeshBasicMaterial({ color: 0x2b2d33 });
    const wall = new THREE.Mesh(new THREE.BoxGeometry(b.w, h, 3.4),
      [endM, endM, roofM, roofM, endM, facade]);
    wall.position.set(cx, h / 2 + gh, zc);
    scene.add(wall);
    const bandM = flat(b.nm === 'GOLDEN ACES' ? acesBand(b) : orpheusBand(b));
    const shop = new THREE.Mesh(new THREE.BoxGeometry(b.w, gh, 3.4),
      [endM, endM, roofM, roofM, endM, bandM]);
    shop.position.set(cx, gh / 2, zc);
    scene.add(shop);
    solid({ minX: x0, maxX: x0 + b.w, minZ: zc - 1.7 - 0.3, maxZ: zc + 1.7 + 8 });
  };

  // ── shared material factories ─────────────────────────────────────────
  //
  // Everything lit is `transparent` so dimWorld leaves it alone, and
  // `fog: false` so it burns through 40 m of haze. FrontSide, never
  // DoubleSide: a transparent double-sided plane puts both faces in the sorted
  // pass and the far one can paint over the near one, which is exactly the bug
  // that made the old HOTEL sign read backwards.
  const neon = (t: THREE.Texture) => new THREE.MeshBasicMaterial({
    map: t, transparent: true, alphaTest: 0.35, fog: false, side: THREE.FrontSide });
  const glowM = (col: number, op: number) => new THREE.MeshBasicMaterial({
    color: col, transparent: true, opacity: op, depthWrite: false, fog: false,
    blending: THREE.AdditiveBlending });
  const steel = new THREE.MeshBasicMaterial({ color: 0x35323a });
  const boardM = new THREE.MeshBasicMaterial({ color: 0x24222a, side: THREE.DoubleSide });
  const goldM = new THREE.MeshBasicMaterial({ color: 0xb98f30 });

  const soft = pixTex(32, 32, (g) => {
    const gr = g.createRadialGradient(16, 16, 1, 16, 16, 15);
    gr.addColorStop(0, 'rgba(255,255,255,0.85)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
  });
  /** a flat additive pool on the ground — GOTCHAS §3, top-down, never a board */
  const spill = (x: number, z: number, w: number, d: number, y: number, col: number, day: number, nite: number) => {
    const m = new THREE.MeshBasicMaterial({ map: soft, color: col, transparent: true,
      opacity: day, depthWrite: false, fog: false, blending: THREE.AdditiveBlending });
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, d), m);
    p.rotation.x = -Math.PI / 2;
    p.position.set(x, y, z);
    scene.add(p);
    ticks.push((n) => { m.opacity = day + (nite - day) * n; });
    return p;
  };

  const placeSigns = (sideSpans: Record<string, [number, number]>) => {
    const casino = sideSpans['GOLDEN ACES'], hotel = sideSpans['HOTEL ORPHEUS'];
    const FACE_Z0 = -96.0;

    // ── the chase, shared by both buildings ─────────────────────────────
    //
    // Hoisted out of the casino so the hotel's porte-cochère runs off the SAME
    // sequence. That is the point of the pair: two buildings blinking in step
    // read as one lit block at the end of the street, and two blinking out of
    // step read as two separate mistakes.
    //
    // Bulbs are FIXED sockets and the chase is which of them are alight, so the
    // light runs and the sockets do not — a scrolling texture would carry the
    // dead bulb along with it, and a dead bulb is a fixed socket. Three shared
    // phase materials do it in three colour writes a frame however many bulbs
    // there are, plus a fourth that never lights.
    const PHASES = 3;
    const chaseOn = new THREE.Color(0xfff2c0), chaseOff = new THREE.Color(0x6a5a3a);
    const phaseM = Array.from({ length: PHASES }, () => new THREE.MeshBasicMaterial({
      color: 0x6a5a3a, transparent: true, fog: false }));
    const deadM = new THREE.MeshBasicMaterial({ color: 0x4a453e, transparent: true, fog: false });
    const bulbGeo = new THREE.SphereGeometry(0.075, 6, 4);
    let bulbN = 0;
    /** hang a run of bulbs on the shared chase; every Nth socket is a dud */
    const bulbRun = (pts: [number, number, number][], deadEvery = 0) => {
      for (const [bx, by, bz] of pts) {
        const i = bulbN++;
        const dud = deadEvery > 0 && i % deadEvery === 0;
        const m = new THREE.Mesh(bulbGeo, dud ? deadM : phaseM[i % PHASES]);
        m.position.set(bx, by, bz);
        scene.add(m);
      }
    };
    ticks.push((n, t) => {
      const step = Math.floor(t * 6) % PHASES;          // six sockets a second
      for (let i = 0; i < PHASES; i++) {
        const on = i === step;
        phaseM[i].color.copy(on ? chaseOn : chaseOff);
        phaseM[i].opacity = on ? 1 : 0.55 + 0.30 * n;
      }
    });

    // ── a neon tube, run vertically up a facade ─────────────────────────
    //
    // The buildings were lit at the ground and dark above it, which is a lit
    // SHOPFRONT, not a lit building — and the brief is that these two are the
    // only light sources in the world. A tube up the full height turns the
    // whole elevation into the sign. Dull glass by day, burning at night, on
    // the same night factor as everything else.
    const tubeTex = (col: string) => {
      const t = pixTex(8, 16, (g) => {
        g.fillStyle = '#151119'; g.fillRect(0, 0, 8, 16);
        g.fillStyle = col; g.fillRect(2, 0, 4, 16);
        g.fillStyle = '#fff6e0'; g.fillRect(3, 0, 1, 16);
        g.fillStyle = 'rgba(255,255,255,0.30)'; g.fillRect(5, 0, 1, 16);
      });
      t.wrapT = THREE.RepeatWrapping;
      return t;
    };
    const riser = (x: number, y0: number, y1: number, col: string) => {
      const t = tubeTex(col);
      t.repeat.set(1, Math.round((y1 - y0) / 1.2));
      const m = new THREE.MeshBasicMaterial({
        map: t, transparent: true, opacity: 0.4, fog: false, side: THREE.FrontSide });
      const q = new THREE.Mesh(new THREE.PlaneGeometry(0.22, y1 - y0), m);
      q.rotation.y = Math.PI;                  // face the road, not the brick
      q.position.set(x, (y0 + y1) / 2, FACE_Z0 - 0.07);
      scene.add(q);
      ticks.push((n) => { m.opacity = 0.34 + 0.66 * n; });
    };

    const FACE_Z = -96.0;                        // the facade plane
    let driverHost: THREE.Mesh | null = null;

    // ═══ THE CASINO ═════════════════════════════════════════════════════
    if (casino) {
      const cxm = (casino[0] + casino[1]) / 2;
      const DOOR_X = 51.29;                      // == ct/int-casino.ts's [E] spot

      // ── the marquee ──────────────────────────────────────────────────
      //
      // 6 m wide, projecting 1.7 m over the pavement, its soffit at 3.7 m so
      // you walk under it — the eye is at 1.62. No collider: it is entirely
      // overhead, and an unnecessary box on this pavement would close a 1 m
      // walking lane (GOTCHAS §8/§9).
      const MQ_W = 6.0, MQ_Y0 = 3.7, MQ_Y1 = 5.35, MQ_Z1 = FACE_Z - 1.7;
      const mqCz = (FACE_Z + MQ_Z1) / 2, mqD = FACE_Z - MQ_Z1;

      // the fascia artwork: changeable copy, the way a real marquee carries it
      const fasciaT = pixTex(96, 26, (g) => {
        g.fillStyle = '#1a1620'; g.fillRect(0, 0, 96, 26);
        g.fillStyle = GOLD_D; g.fillRect(0, 0, 96, 3); g.fillRect(0, 23, 96, 3);
        g.fillStyle = GOLD; g.fillRect(0, 1, 96, 1); g.fillRect(0, 24, 96, 1);
        tubeText(g, 'LOOSEST SLOTS', 48, 10, 8, '#f2b83a');
        g.fillStyle = '#e8e0c8'; g.font = 'bold 6px monospace';
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText('$2 BLACKJACK  24 HRS', 48, 19);
        grime(g, 96, 3, 6, 14);
      });
      const fasciaM = neon(fasciaT);
      const mqBody = new THREE.MeshBasicMaterial({ color: 0x2a2028 });
      // index 5 is the -z face. On this street that is the one facing the
      // road; index 4 (+z) points back at the building. placeShell already
      // hangs the facade on 5 for the same reason, and getting it wrong here
      // hid the marquee's copy against the brick where nobody could read it.
      const marquee = new THREE.Mesh(new THREE.BoxGeometry(MQ_W, MQ_Y1 - MQ_Y0, mqD),
        [mqBody, mqBody, mqBody, mqBody, mqBody, fasciaM]);
      marquee.position.set(DOOR_X, (MQ_Y0 + MQ_Y1) / 2, mqCz);
      scene.add(marquee);
      driverHost = marquee;

      // the soffit: the brightest surface on the building, and the reason the
      // pavement under it is worth standing on
      const soffitT = pixTex(64, 24, (g) => {
        g.fillStyle = '#f4e0aa'; g.fillRect(0, 0, 64, 24);
        g.fillStyle = '#e8cf90';
        for (let x = 0; x < 64; x += 8) g.fillRect(x, 0, 1, 24);
        for (let y = 0; y < 24; y += 8) g.fillRect(0, y, 64, 1);
        g.fillStyle = '#fff6d8';
        for (let x = 4; x < 64; x += 8) for (let y = 4; y < 24; y += 8) g.fillRect(x - 1, y - 1, 3, 3);
        dither(g, 64, 24, 30);
      });
      const soffit = new THREE.Mesh(new THREE.PlaneGeometry(MQ_W - 0.1, mqD - 0.08),
        new THREE.MeshBasicMaterial({ map: soffitT, transparent: true, fog: false }));
      soffit.rotation.x = Math.PI / 2;
      soffit.position.set(DOOR_X, MQ_Y0 + 0.01, mqCz);
      scene.add(soffit);

      // ── the chase ────────────────────────────────────────────────────
      //
      // Bulbs are FIXED sockets and the chase is which of them are alight, so
      // the light runs and the sockets do not — a scrolling texture would carry
      // the dead bulb along with it, and a dead bulb is a fixed socket.
      //
      // Four shared materials do the whole thing: three phase classes that take
      // turns, and a fourth that never lights. Bulb i belongs to class i % 3,
      // so animating the chase is three colour writes a frame however many
      // bulbs there are.

      // round the front fascia and both returns, at both top and bottom edges
      const ring: [number, number, number][] = [];
      for (const y of [MQ_Y0 + 0.12, MQ_Y1 - 0.12]) {
        for (const bx of sockets(DOOR_X - MQ_W / 2 + 0.18, DOOR_X + MQ_W / 2 - 0.18, 0.36)) {
          ring.push([bx, y, MQ_Z1 - 0.02]);
        }
        for (const sx of [-1, 1]) {
          for (const bz of sockets(MQ_Z1 + 0.2, FACE_Z - 0.15, 0.4)) {
            ring.push([DOOR_X + sx * (MQ_W / 2 - 0.02), y, bz]);
          }
        }
      }
      // the dead one: 1984 refit, and nobody has been up the ladder since
      const DEAD = 11;
      bulbRun(ring);
      // the dead one: 1984 refit, and nobody has been up the ladder since. It is
      // placed by hand rather than by a modulo, so it is a specific socket on a
      // specific corner of the marquee and it never moves.
      const dud = new THREE.Mesh(bulbGeo, deadM);
      dud.position.set(...ring[DEAD]);
      scene.add(dud);
      // and the marquee's own glow, sitting in the air under the soffit
      const mqGlow = new THREE.Mesh(new THREE.PlaneGeometry(MQ_W + 1.4, mqD + 1.2),
        glowM(0xffd98a, 0.18));
      mqGlow.rotation.x = Math.PI / 2;
      mqGlow.position.set(DOOR_X, MQ_Y0 - 0.5, mqCz);
      scene.add(mqGlow);
      ticks.push((n) => { (mqGlow.material as THREE.MeshBasicMaterial).opacity = 0.10 + 0.30 * n; });

      // ── the blade: full height, and the tallest thing on the frontage ──
      //
      // It projects from the facade so its faces are ±x, which is the only axis
      // this street is ever seen along. Runs from over the marquee to 21.4 m —
      // above the casino's own roof at 17.2 and above the hotel's at 19.6. The
      // rooftop pylon still stands behind it and is still the skyline mark at
      // 26 m; this is the tallest thing on the building line, which is the read
      // you get walking toward it rather than seeing it over the rooftops.
      const BL_X = casino[0] + 0.95, BL_Y0 = 5.6, BL_Y1 = 21.4;
      const BL_Z1 = FACE_Z - 1.35;
      const blCz = (FACE_Z + BL_Z1) / 2, blD = FACE_Z - BL_Z1;
      const cab = new THREE.Mesh(new THREE.BoxGeometry(0.34, BL_Y1 - BL_Y0, blD), boardM);
      cab.position.set(BL_X, (BL_Y0 + BL_Y1) / 2, blCz);
      scene.add(cab);
      // bracketed back to the wall, the way a blade this size has to be
      for (const y of [7.4, 11.6, 15.8, 19.4]) {
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 1.5), steel);
        arm.position.set(BL_X, y, FACE_Z - 0.75);
        scene.add(arm);
        const stay = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.5, 0.06), steel);
        stay.position.set(BL_X, y + 0.62, FACE_Z - 0.7);
        stay.rotation.x = 0.72;
        scene.add(stay);
      }
      // ACES down the blade in tube neon, over a chevron of bulbs pointing at
      // the door. Both faces get their OWN painted texture so the back one is
      // not a mirror of the front (GOTCHAS §10).
      const bladeArt = (mirror: boolean) => pixTex(44, 224, (g) => {
        g.fillStyle = '#17141c'; g.fillRect(0, 0, 44, 224);
        g.fillStyle = GOLD_D; g.fillRect(0, 0, 44, 3); g.fillRect(0, 221, 44, 3);
        g.fillRect(0, 0, 3, 224); g.fillRect(41, 0, 3, 224);
        if (mirror) { g.translate(44, 0); g.scale(-1, 1); }
        'ACES'.split('').forEach((ch, i) => tubeText(g, ch, 22, 32 + i * 33, 30, '#ff5a4a'));
        // the chevrons, running down toward the marquee
        for (let k = 0; k < 4; k++) {
          const y = 168 + k * 13;
          g.fillStyle = k % 2 ? '#f2b83a' : '#f6e2a2';
          for (let j = 0; j < 9; j++) {
            g.fillRect(20 - j, y + j, 4, 3);
            g.fillRect(20 + j, y + j, 4, 3);
          }
        }
      });
      for (const s of [-1, 1]) {
        const face = new THREE.Mesh(new THREE.PlaneGeometry(blD * 0.92, BL_Y1 - BL_Y0),
          neon(bladeArt(s < 0)));
        face.position.set(BL_X + s * 0.18, (BL_Y0 + BL_Y1) / 2, blCz);
        face.rotation.y = s * Math.PI / 2;
        scene.add(face);
      }

      // ── the whole elevation, not just the shopfront ──────────────────
      //
      // This is what the user was actually looking at when they said "so low
      // effort and boring": a lit ground floor under four storeys of dark
      // brick. A downtown casino outlines the BUILDING. So the roofline and
      // both party edges carry the same chase as the marquee, and three tubes
      // run the full height between them.
      //
      // The vocabulary here is excess and repetition, which is exactly what a
      // pixel world is good at — one bulb is a dot, ninety bulbs on a rhythm is
      // a casino.
      {
        const CROWN = 17.2, BASE = 4.35;                 // roofline, top of band
        const x0 = casino[0] + 0.28, x1 = casino[1] - 0.28;
        const crown: [number, number, number][] = [];
        for (const bx of sockets(x0, x1, 0.42)) crown.push([bx, CROWN + 0.18, FACE_Z0 - 0.16]);
        for (const bx of [x0, x1]) {
          for (const by of sockets(BASE, CROWN, 0.52)) crown.push([bx, by, FACE_Z0 - 0.16]);
        }
        bulbRun(crown, 23);                              // roughly one dud in every 23
        riser(cxm, BASE, CROWN, '#ff4a3a');
        riser(x0 + 2.6, BASE, CROWN, '#f2b83a');
        riser(x1 - 2.6, BASE, CROWN, '#f2b83a');
      }

      // ── the entrance, in three dimensions ────────────────────────────
      // The band paints the portal; these are the parts that have to stand off
      // the wall for it to read as a way in rather than as a picture of one.
      for (const sx of [-1, 1]) {
        const jamb = new THREE.Mesh(new THREE.BoxGeometry(0.16, 3.3, 0.34), goldM);
        jamb.position.set(DOOR_X + sx * 1.52, 1.65, FACE_Z - 0.17);
        scene.add(jamb);
      }
      const head = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.22, 0.34), goldM);
      head.position.set(DOOR_X, 3.4, FACE_Z - 0.17);
      scene.add(head);
      // brass threshold, and the runner over it
      const sill = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 1.5),
        new THREE.MeshBasicMaterial({ color: 0x7a2028 }));
      sill.rotation.x = -Math.PI / 2;
      sill.position.set(DOOR_X, KERB_H + 0.012, FACE_Z - 0.9);
      scene.add(sill);

      // ── and what it throws on the ground ─────────────────────────────
      spill(DOOR_X, FACE_Z - 1.4, 8.5, 4.0, KERB_H + 0.03, 0xffcf7a, 0.05, 0.70);
      spill(DOOR_X, -99.4, 12.5, 6.8, 0.05, 0xffb85a, 0.03, 0.58);
      spill(BL_X, FACE_Z - 1.2, 4.0, 3.4, KERB_H + 0.028, 0xff6a4a, 0.04, 0.42);
    }

    // ═══ THE HOTEL ══════════════════════════════════════════════════════
    if (hotel) {
      const DOOR_X = 39.51;                      // == ct/int-hotel.ts's [E] spot

      // ── the porte-cochère ────────────────────────────────────────────
      //
      // 7.8 m across, projecting 2.05 m to the kerb line at z = -98, its
      // underside at 4.3 m. You walk under it.
      //
      // The two columns are the only thing here that touches the pavement, and
      // the pavement is 2 m wide with the building collider eating down to
      // z = -96.3, so there is about 1 m of walkable band. Each column is
      // 0.3 m, standing at z = -97.85 with its collider ending at -97.7: that
      // leaves 0.68 m of clear band between column and building for a 0.72 m
      // capsule to pass through, and the road side is open. Walked, not
      // eyeballed (GOTCHAS §9).
      const PC_W = 7.8, PC_Y0 = 4.3, PC_Y1 = 4.78, PC_Z1 = -98.05;
      const pcCz = (FACE_Z + PC_Z1) / 2, pcD = FACE_Z - PC_Z1;
      const fasciaT = pixTex(112, 14, (g) => {
        g.fillStyle = '#3a3630'; g.fillRect(0, 0, 112, 14);
        g.fillStyle = '#4a453c'; g.fillRect(0, 1, 112, 10);
        g.fillStyle = '#8a8478'; g.fillRect(0, 0, 112, 1);
        g.fillStyle = 'rgba(0,0,0,0.30)'; g.fillRect(0, 11, 112, 3);
        grime(g, 112, 1, 8, 22);
      });
      const pcFasciaM = flat(fasciaT);
      const pcBody = new THREE.MeshBasicMaterial({ color: 0x3f3a34 });
      const canopy = new THREE.Mesh(new THREE.BoxGeometry(PC_W, PC_Y1 - PC_Y0, pcD),
        [pcBody, pcBody, pcBody, pcBody, pcBody, pcFasciaM]);
      canopy.position.set(DOOR_X, (PC_Y0 + PC_Y1) / 2, pcCz);
      scene.add(canopy);
      if (!driverHost) driverHost = canopy;

      // lit from beneath: a warm panel and a row of recessed downlights
      const underT = pixTex(64, 20, (g) => {
        g.fillStyle = '#d8c49a'; g.fillRect(0, 0, 64, 20);
        g.fillStyle = '#c0ac86';
        for (let x = 0; x < 64; x += 16) g.fillRect(x, 0, 1, 20);
        g.fillStyle = '#fff4d2';
        for (let x = 8; x < 64; x += 16) { g.fillRect(x - 3, 8, 7, 5); }
        g.fillStyle = 'rgba(255,244,210,0.35)';
        for (let x = 8; x < 64; x += 16) { g.fillRect(x - 5, 6, 11, 9); }
        dither(g, 64, 20, 24);
      });
      const under = new THREE.Mesh(new THREE.PlaneGeometry(PC_W - 0.12, pcD - 0.1),
        new THREE.MeshBasicMaterial({ map: underT, transparent: true, fog: false }));
      under.rotation.x = Math.PI / 2;
      under.position.set(DOOR_X, PC_Y0 + 0.01, pcCz);
      scene.add(under);
      const pcGlow = new THREE.Mesh(new THREE.PlaneGeometry(PC_W + 1.2, pcD + 1.0), glowM(0xffe0a8, 0.16));
      pcGlow.rotation.x = Math.PI / 2;
      pcGlow.position.set(DOOR_X, PC_Y0 - 0.7, pcCz);
      scene.add(pcGlow);
      ticks.push((n) => { (pcGlow.material as THREE.MeshBasicMaterial).opacity = 0.08 + 0.26 * n; });

      // the columns, and the collider that has to be walked
      for (const sx of [-1, 1]) {
        const col = new THREE.Mesh(new THREE.BoxGeometry(0.3, PC_Y0 - KERB_H, 0.3),
          new THREE.MeshBasicMaterial({ color: 0x4a453c }));
        const cx0 = DOOR_X + sx * 2.9;
        col.position.set(cx0, KERB_H + (PC_Y0 - KERB_H) / 2, -97.85);
        scene.add(col);
        const cap = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.1, 0.42), goldM);
        cap.position.set(cx0, PC_Y0 - 0.06, -97.85);
        scene.add(cap);
        solid({ minX: cx0 - 0.15, maxX: cx0 + 0.15, minZ: -98.0, maxZ: -97.7 });
      }

      // ── the porte-cochère runs the same chase as the marquee ─────────
      //
      // Same sequence, deliberately. The two buildings blinking in step read as
      // one lit block at the end of the street; out of step they read as two
      // separate mistakes.
      {
        const ring: [number, number, number][] = [];
        for (const by of [PC_Y0 + 0.1, PC_Y1 - 0.08]) {
          for (const bx of sockets(DOOR_X - PC_W / 2 + 0.2, DOOR_X + PC_W / 2 - 0.2, 0.38)) {
            ring.push([bx, by, PC_Z1 - 0.03]);
          }
        }
        bulbRun(ring, 19);
      }

      // ── and the elevation above it ───────────────────────────────────
      //
      // Quieter than the casino on purpose. The hotel is the older building and
      // the one still pretending to be respectable, so it gets a cornice line
      // and two tubes rather than a full outline — but it is still LIT, which
      // is the point. A dark hotel beside a lit casino reads as derelict.
      {
        const CROWN = 19.6, BASE = 4.9;
        const x0 = hotel[0] + 0.3, x1 = hotel[1] - 0.3;
        const crown: [number, number, number][] = [];
        for (const bx of sockets(x0, x1, 0.5)) crown.push([bx, CROWN + 0.16, FACE_Z0 - 0.16]);
        bulbRun(crown, 17);
        riser(x0 + 1.1, BASE, CROWN, '#5ad2ea');
        riser(x1 - 1.1, BASE, CROWN, '#5ad2ea');
      }

      // ── ORPHEUS in applied letters on the fascia ─────────────────────
      //
      // Individual plaques standing 0.07 m off the fascia, one per letter, not
      // a word painted on a band. That is what "applied" means and the
      // difference is the shadow line down the side of every letter.
      const LETTERS = 'ORPHEUS';
      const lw = 0.62, lgap = 0.10;
      const total = LETTERS.length * lw + (LETTERS.length - 1) * lgap;
      LETTERS.split('').forEach((ch, i) => {
        // A plane's normal is +z, which on this street points INTO the
        // building, so each plaque is turned to face the road. Two things then
        // follow and the first one cost me a redraw:
        //
        //  · the GLYPH needs no mirroring. Turned through PI, the plane's u
        //    runs from high x to low x, and a viewer facing the building has
        //    low x on their right — so u already increases to screen-right.
        //  · the WORD does. Letters are laid out DESCENDING in x, because on
        //    this street screen-right IS descending x. Laid out ascending, every
        //    letter was correct and ORPHEUS read backwards.
        const t = pixTex(16, 20, (g) => {
          g.fillStyle = 'rgba(0,0,0,0)'; g.fillRect(0, 0, 16, 20);
          tubeText(g, ch, 8, 10, 17, '#ffd98a', '#fff8e4', '#6a5220');
        });
        const m = new THREE.Mesh(new THREE.PlaneGeometry(lw, 0.72), neon(t));
        m.rotation.y = Math.PI;
        m.position.set(DOOR_X + total / 2 - lw / 2 - i * (lw + lgap), (PC_Y0 + PC_Y1) / 2, PC_Z1 - 0.07);
        scene.add(m);
      });

      // ── the blade sign, redrawn as tubes ─────────────────────────────
      //
      // The old one was flat cyan letters on a dark plane — a stripe, not a
      // tube. Same position and same size; the artwork is what changes, plus a
      // VACANCY sign under it that has been on for a long time.
      const hx = hotel[1] - 1.1;
      const mast = new THREE.Mesh(new THREE.BoxGeometry(0.24, 7.6, 0.55), boardM);
      mast.position.set(hx, 8.2, -96.75);
      scene.add(mast);
      for (const y of [11.2, 6.4]) {
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.82), steel);
        arm.position.set(hx, y, -96.38);
        scene.add(arm);
        const stay = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.2, 0.07), steel);
        stay.position.set(hx, y + 0.46, -96.38);
        stay.rotation.x = 0.69;
        scene.add(stay);
      }
      const hotelArt = (mirror: boolean) => pixTex(22, 118, (g) => {
        g.fillStyle = '#17141c'; g.fillRect(0, 0, 22, 118);
        g.fillStyle = '#3a3630'; g.fillRect(0, 0, 22, 2); g.fillRect(0, 116, 22, 2);
        if (mirror) { g.translate(22, 0); g.scale(-1, 1); }
        'HOTEL'.split('').forEach((ch, i) => tubeText(g, ch, 11, 15 + i * 19, 16, '#5ad2ea'));
        g.fillStyle = '#ff5a8a'; g.fillRect(4, 110, 14, 3);
      });
      for (const s of [-1, 1]) {
        const face = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 6.9), neon(hotelArt(s < 0)));
        face.position.set(hx + s * 0.14, 8.2, -96.75);
        face.rotation.y = s * Math.PI / 2;
        scene.add(face);
      }
      // VACANCY, hung under the blade. Pink neon, and the NO has been dark for
      // long enough that the tube behind it has gone grey.
      const vacT = (mirror: boolean) => pixTex(34, 20, (g) => {
        g.fillStyle = '#17141c'; g.fillRect(0, 0, 34, 20);
        if (mirror) { g.translate(34, 0); g.scale(-1, 1); }
        tubeText(g, 'NO', 9, 10, 11, '#4a4640', '#6a6660', '#241f22');
        tubeText(g, 'VACANCY', 22, 10, 8, '#ff6a9a');
      });
      const vacM: THREE.MeshBasicMaterial[] = [];
      for (const s of [-1, 1]) {
        const mat = neon(vacT(s < 0));
        const v = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.56), mat);
        v.position.set(hx + s * 0.14, 4.5, -96.75);
        v.rotation.y = s * Math.PI / 2;
        scene.add(v);
        vacM.push(mat);
      }
      // It has a bad ballast. Not a clean blink — a long steady burn with an
      // occasional stutter, which is what a tube on its way out actually does
      // and what separates "broken" from "animated".
      ticks.push((n, t) => {
        const ph = t % 4.2;
        const flick = ph > 3.86 && ph < 3.94 ? 0.25 : ph > 4.02 && ph < 4.07 ? 0.4 : 1;
        for (const m of vacM) m.opacity = (0.35 + 0.65 * n) * flick;
      });

      // ── rooms that are occupied ──────────────────────────────────────
      //
      // Eight warm windows on the upper facade, out of the thirty the brick
      // carries. A hotel with every window dark is a derelict hotel; a hotel
      // with every window lit is a full one. Eight is losing money.
      const winT = pixTex(12, 16, (g) => {
        g.fillStyle = '#e0b878'; g.fillRect(0, 0, 12, 16);
        g.fillStyle = '#c89a58'; g.fillRect(0, 0, 12, 3);
        g.fillStyle = 'rgba(60,40,24,0.55)'; g.fillRect(3, 7, 6, 9);
      });
      const LIT: [number, number][] = [
        [-3.8, 6.4], [1.1, 6.4], [3.6, 8.8], [-1.3, 11.2],
        [3.6, 13.6], [-3.8, 13.6], [1.1, 16.0], [-1.3, 18.4],
      ];
      const winM = new THREE.MeshBasicMaterial({ map: winT, transparent: true, fog: false, opacity: 0.5 });
      for (const [dx, wy] of LIT) {
        const w = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.95), winM);
        w.rotation.y = Math.PI;                  // face the road, not the brick
        w.position.set(DOOR_X + dx, wy, FACE_Z - 0.04);
        scene.add(w);
      }
      ticks.push((n) => { winM.opacity = 0.16 + 0.74 * n; });

      spill(DOOR_X, -97.4, 9.5, 4.6, KERB_H + 0.026, 0xffd28a, 0.05, 0.58);
      spill(DOOR_X, -99.7, 12.5, 6.6, 0.045, 0xffc070, 0.03, 0.50);
      spill(hx, -97.0, 3.6, 3.0, KERB_H + 0.024, 0x6ad0ea, 0.03, 0.34);
    }

    // ═══ what the pair look like from the BLOCK ════════════════════════
    //
    // The view this whole build exists for is the one you get standing at the
    // corner and looking 45 m down the side street, and at that range every
    // individual bulb is sub-pixel. The signs still burn through — they are
    // `fog: false` — but they read as a thin bright sliver, because the AIR
    // around them does not do anything. Real neon at that distance is mostly
    // the glow it puts into the haze above itself.
    //
    // So: one soft additive sheet standing over the pair, facing back down the
    // street at the viewer, dark by day and up at night. It is the cheapest
    // possible version of light pollution and it is what makes the far end of
    // the street read as somewhere rather than as a wall with a sign on it.
    //
    // Kept deliberately weak and very soft-edged. The failure mode here is a
    // glowing rectangle hanging in the sky, so it is a radial falloff with no
    // hard edge anywhere near the frame, and it sits BEHIND the roofline of
    // both buildings so the silhouette still cuts it.
    if (casino && hotel) {
      const gx = (hotel[0] + casino[1]) / 2;
      const haze = new THREE.Mesh(new THREE.PlaneGeometry(26, 17), glowM(0xff9a5a, 0));
      haze.rotation.y = -Math.PI / 2;            // faces -x, back down the street
      haze.position.set(gx, 15.5, -95.4);
      scene.add(haze);
      const hazeM = haze.material as THREE.MeshBasicMaterial;
      hazeM.map = soft;
      // a second, tighter and warmer one down at marquee height, which is what
      // puts colour in the air over the road rather than over the roofs
      const low = new THREE.Mesh(new THREE.PlaneGeometry(22, 9), glowM(0xffb060, 0));
      low.rotation.y = -Math.PI / 2;
      low.position.set(gx, 5.2, -98.6);
      scene.add(low);
      const lowM = low.material as THREE.MeshBasicMaterial;
      lowM.map = soft;
      ticks.push((n) => { hazeM.opacity = 0.30 * n; lowM.opacity = 0.22 * n; });
    }

    // ═══ the rooftop pylon — kept, and still the skyline mark ═══════════
    //
    // Unchanged from the version street.ts carried, comment and all. It is the
    // thing you pick out of the haze from the far end of the block, it has been
    // verified once, and the blade below it does a different job.
    const neonOld = (t: THREE.Texture) => new THREE.MeshBasicMaterial({ map: t, alphaTest: 0.4, fog: false, side: THREE.FrontSide });
    const twoSided = (
      tw: number, th: number, draw: (g: CanvasRenderingContext2D) => void,
      w: number, h: number, x: number, y: number, z: number, gap: number,
    ) => {
      for (const s of [-1, 1]) {
        const t = pixTex(tw, th, draw);
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), neonOld(t));
        m.position.set(x + s * gap, y, z);
        m.rotation.y = s * Math.PI / 2;
        scene.add(m);
      }
    };
    if (casino) {
      const cxm = (casino[0] + casino[1]) / 2, top = SHOP_BAND_H + 3.4 + 4 * 2.4;
      const ROOF = top, BOT = ROOF + 2.2;
      for (const s of [-1, 1]) {
        const upright = new THREE.Mesh(new THREE.BoxGeometry(0.2, BOT - ROOF, 0.2), steel);
        upright.position.set(cxm, (ROOF + BOT) / 2, -94.3 + s * 1.2);
        scene.add(upright);
        const brace = new THREE.Mesh(new THREE.BoxGeometry(0.13, 2.78, 0.13), steel);
        brace.position.set(cxm, ROOF + 1.1, -94.3 + s * 1.75);
        brace.rotation.x = -s * 0.657;
        scene.add(brace);
      }
      const tie = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 2.8), steel);
      tie.position.set(cxm, BOT - 0.2, -94.3);
      scene.add(tie);
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6.6, 7.2), boardM);
      frame.position.set(cxm, BOT + 3.3, -94.3);
      scene.add(frame);
      twoSided(92, 74, (g) => {
        g.fillStyle = '#e8c25a'; g.font = 'bold 15px monospace';
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText('GOLDEN', 46, 26); g.fillText('ACES', 46, 45);
        g.fillStyle = '#e8574a';
        g.font = 'bold 9px monospace'; g.fillText('OPEN ALL NITE', 46, 62);
        g.fillStyle = '#f2d98a';
        for (let x = 3; x < 92; x += 8) { g.fillRect(x, 2, 4, 3); g.fillRect(x, 69, 4, 3); }
        for (let y = 6; y < 70; y += 8) { g.fillRect(2, y, 3, 4); g.fillRect(87, y, 3, 4); }
      }, 6.8, 6.2, cxm, BOT + 3.3, -94.3, 0.26);
    }

    // hang the one frame hook on the marquee — the biggest thing that is always
    // drawn with these two buildings
    if (driverHost) {
      driverHost.onBeforeRender = (renderer, sc) => driver(renderer as THREE.WebGLRenderer, sc as THREE.Scene);
    }
  };

  return { placeShell, placeSigns, VICE: ['GOLDEN ACES', 'HOTEL ORPHEUS'] as const };
}
