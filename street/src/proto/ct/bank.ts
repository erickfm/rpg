import * as THREE from 'three';
import { pixTex, dither, declareSurface } from './paint';
import { FACE } from './rng';
import { masonry, SHOP_BAND_H, SHOP_MULT, wallHeight, facadeTex, FLOOR_M } from './tex-world';
import { type BldSpec } from './civic';
import type { AABB } from '../fp';
import type { CtxBuild } from './ctx';

/** FIRST FEDERAL — the bank, and the ATM in its wall.
 *
 *  Third cut of the split my queue file asks for. The alley and the canted
 *  corner went first; this one is here because **the ATM is the single most
 *  iterated object in the world**: four attempts, a rejection, a desk ruling on
 *  two named candidates, and an auditor confirmation. Every one of those rounds
 *  meant opening a 2,294-line file to change 60 lines. It is 491 lines and its
 *  own file now, and the next note about it lands somewhere a reader can hold.
 *
 *  **A MOVE, not a rewrite** — every line stood in `ct/street.ts` in this order
 *  and nothing was re-tuned. The call site is unchanged, which is a different
 *  edit from moving the file: paint order re-grains every texture created after
 *  it (GOTCHAS §31) and the seeded `rnd()` stream moves every tree height and
 *  pigeon downstream (GOTCHAS §2). Proved with `npm run fp`, dist against dist.
 *
 *  ── what is in here, and what the record says about it ─────────────────────
 *
 *  The ATM is a NICHE: a 0.15 m recess cut back from the facade plane with a
 *  reveal on all four sides, and inside it a fascia of two raked planes plus an
 *  apron. Screen 8.1° off vertical, keypad 33.7°, apron −21.3°. Screen centre
 *  1.37 m above the pavement and keypad 1.10, so you look slightly DOWN at both.
 *
 *  Two numbers here are RULINGS and not preferences, so do not tune them back:
 *
 *  · **Body `#414a52` against the wall's `#9a9ca0`** — 74 against 156. It was
 *    `#8d949b`, four percent apart, and that was the whole fault: a genuine
 *    recess with nothing to read against is not visible from where a player
 *    walks. Same shape as the puddles that were present, filled and invisible
 *    because they matched the wet road.
 *  · **`M_BOT` at 0.75, which is the NUMBER the user asked for.** It had been
 *    0.68 on my reading that the *target* — "0.9–1.0 m of fascia" — was what the
 *    number was reaching for, since the TOP is pinned at 1.58 by the screen
 *    height and 0.75 therefore yields 0.83 m rather than 0.90. I flagged that
 *    twice and the user said 0.75 both times, so **the number wins over my
 *    inference of the target.** Fascia is 0.83 m. Do not "fix" it back to 0.68
 *    without asking: 0.68 is the taller reading and 0.75 is the ruling.
 */
export function buildBank(k: {
  scene: THREE.Scene;
  KERB_H: number;
  flat: (m: THREE.Texture) => THREE.MeshBasicMaterial;
  solid: (b: AABB) => AABB;
  /** the shell material set, which binds this build's `flat` */
  shellMats: (
    fi: number, facade: THREE.Material, dx: number, dy: number, dz: number,
    brick: string, baseY: number, cope: boolean, roofM: THREE.Material,
  ) => THREE.Material[];
  depthOf: (nm: string) => number;
  roofKit: (cx: number, cz: number, dx: number, dz: number, top: number, nm: string) => void;
  litSheets: (b: BldSpec, w: number, h: number, cx: number, cy: number, front: number,
              ry: number, rx: number, facing: number) => void;
  /** the four `CtxBuild` fields this module needs to own its own `[E]` */
  spot: CtxBuild['spot'];
  purse: CtxBuild['purse'];
  refreshWallet: CtxBuild['refreshWallet'];
}) {
  const { scene, KERB_H, flat, solid, shellMats, depthOf, roofKit, litSheets } = k;
  const o = k;   // the block below reads `o.spot` / `o.purse` / `o.refreshWallet`
  // ── the bank ────────────────────────────────────────────────────────────
  //
  // LAUNDRY and MERIDIAN merged: 9.2 + 10 = 19.2 m, so the run before the
  // alley still totals 51.2 and nothing is paid for out of a neighbour.
  // MERIDIAN was the corporation — bland, modern, standing next to the
  // library on purpose — and a branch bank does that job better, so this
  // settles the corporation slot too.
  //
  // It is NOT a shopfront, and the difference is the point. No brick, no
  // awning, no painted fascia: precast panel and polished granite, deep-set
  // windows with bronze frames, applied metal letters with a drop shadow, an
  // ATM in the wall. Dimensions are declared in METRES and converted once,
  // which is A's convention on the shopfront painters — the ground band still
  // uses masonry() at SHOP_MULT so its course datum is the same world grid as
  // every other band on the block and the two neighbours line up with it.
  //
  // It also stands beside the LIBRARY, the other stone building on this side,
  // and must not read as the same institution. The library is warm worn
  // ashlar with arched openings and forty years of soot; the bank is cool
  // grey precast, dead flat, square-headed, and looks like it was cleaned
  // last year.
  const BANK_STONE = '#9a9ca0', BANK_DARK = '#7c7f85', BANK_LIGHT = '#b3b5b8';
  const BANK_GRANITE = '#4e5358', BANK_BRONZE = '#7a6a44';
  // ── the ATM, as a NICHE in the wall ───────────────────────────────────────
  //
  // Declared here because two things need to agree exactly: `bankBand` cuts the
  // hole and `atmNiche` fills it. One set of numbers, so the opening and the
  // machine cannot drift apart — the same rule the drain's DRAIN_U/DRAIN_V pair
  // follows in the alley.
  //
  // HEIGHTS ARE WORLD y AND THE PAVEMENT IS AT KERB_H. The old painted unit
  // measured from the band's base at y = 0, which is 14 cm BELOW the walk you
  // stand on, so a "1.35 m" screen was really 1.21 m off the pavement. The
  // request is explicit — "screen at 1.30-1.40 m, keypad lower" — and that is
  // measured from the floor under your feet, so it is measured from KERB_H.
  // ATTEMPT TWO OVERSHOT AND THIS IS THE SUBTRACTION. The first niche was
  // 1.10 x 2.10 m — plinth to above head height, with a FIRST FEDERAL plate
  // taking the top half and the machine crammed into the bottom third. The
  // user: *"it reads as a display case or a vending machine, not as an ATM in a
  // wall. THE SIZE IS THE MAIN FAULT … A real wall ATM fascia is roughly
  // 0.6-0.7 m wide and about 1.0 m tall, set at working height — it is a modest
  // object. Yours is maybe three times that."* It was: 2.3 m² against 0.7 m².
  //
  // So: 0.68 x 1.05, the screen and keypad ARE the object, the name is a strip
  // above the screen rather than a plate, the heavy bronze surround is gone and
  // the recess is SHALLOW — 9 cm, not 15.
  // ATTEMPT THREE. Two goes at this missed the same two words — INLAID and
  // SLANTED — so both are now measured rather than intended.
  //
  // Attempt one was 1.10 x 2.10 m and read as a display case. Attempt two got
  // the size right and still read as "stuck ON the wall": the recess was 9 cm
  // and the rake was composed as mesh rotation.y THEN rotation.z, which is
  // Euler-order dependent and did not produce the tilt I thought it did. The
  // fix is not a bigger number, it is baking the rotation into the GEOMETRY in
  // a known order and then measuring the normal that comes out.
  //
  // THE SHAPE, as specified. A recess 0.15 m deep, a little larger than the
  // machine so the reveal shows on all four sides; inside it a fascia of TWO
  // planes at different angles, each with its top edge further back than its
  // bottom edge so it tilts up toward the face. The keypad shelf comes closest
  // to horizontal, the screen stays closer to vertical.
  const ATM_U = 0.36;                       // across the frontage; band u runs -z
  const ATM_R = 0.15;                       // recess depth
  // the OPENING, a little larger than the machine on every side
  const ATM_W = 0.74, ATM_SILL = KERB_H + 0.62, ATM_TOP = KERB_H + 1.66;
  // the MACHINE inside it.
  //
  // THE FASCIA GREW DOWNWARD, which dissolves the conflict I had flagged. It
  // measured 0.68 m against the "about 1.0 m tall" asked for, and the obvious
  // fix — raise the top — fought the screen height, because the screen centre is
  // the midpoint of the top panel and pinning one moves the other. The desk's
  // ruling: extend DOWN instead. Nothing pinned moves.
  //
  //     M_TOP          1.58   unchanged
  //     screen centre  1.37   unchanged
  //     keypad centre  1.10   unchanged
  //     M_BOT          0.90 -> 0.68 -> 0.75
  //     fascia height  0.68 -> 0.90 -> 0.83 m
  //
  // THE USER ASKED FOR 0.75 TWICE, so 0.75 it is. I had read the "0.9-1.0 m of
  // fascia" in the same ruling as the thing the number was reaching for, and
  // since the top is pinned at 1.58 by the screen height, only a bottom of 0.68
  // reaches 0.90. Raised that twice; the answer came back 0.75 both times. A
  // number the user has repeated is a decision, not an oversight, so it wins
  // over my reading of the target and the fascia is 0.83 m rather than 0.90.
  // The 7 cm that comes off is apron — the blank panel below the cash slot —
  // and nothing pinned moves: screen 1.37, keypad 1.10, both rakes, recess.
  const M_W = 0.62;
  const M_TOP = KERB_H + 1.58, M_SCREEN_BOT = KERB_H + 1.16;
  const M_KEYS_BOT = KERB_H + 1.04, M_BOT = KERB_H + 0.75;
  const ATM_SCREEN_Y = (M_TOP + M_SCREEN_BOT) / 2;      // 1.37 above the walk
  const ATM_KEYS_Y = (M_SCREEN_BOT + M_KEYS_BOT) / 2;   // 1.10 above the walk
  // depths, from the facade plane. Top deepest, keypad front edge shallowest,
  // then the apron runs back to the wall underneath.
  const D_TOP = 0.15, D_SCREEN_BOT = 0.09, D_KEYS_BOT = 0.01, D_BOT = 0.15;
  const bankBand = (wM: number) => {
    const surf = masonry(wM, SHOP_BAND_H, 0, SHOP_MULT);
    const { W, H, ppm } = surf;
    const m = (v: number) => Math.round(v * ppm);
    return surf.paint((g) => {
      g.fillStyle = BANK_STONE; g.fillRect(0, 0, W, H);
      // precast panels: wide bays with a recessed joint, NOT brick courses
      g.fillStyle = 'rgba(0,0,0,0.16)';
      for (let x = 0; x <= W; x += m(2.4)) g.fillRect(x, 0, Math.max(1, m(0.05)), H);
      g.fillStyle = 'rgba(255,255,255,0.1)';
      for (let x = 0; x <= W; x += m(2.4)) g.fillRect(x + Math.max(1, m(0.05)), 0, 1, H);
      g.fillStyle = 'rgba(0,0,0,0.1)'; g.fillRect(0, m(0.5), W, Math.max(1, m(0.06)));  // one shadow line
      // polished granite plinth
      g.fillStyle = BANK_GRANITE; g.fillRect(0, H - m(0.62), W, m(0.62));
      g.fillStyle = 'rgba(255,255,255,0.14)'; g.fillRect(0, H - m(0.62), W, Math.max(1, m(0.06)));
      // deep-set windows: a dark reveal, bronze frame, blinds half down
      const win = (cx: number, wWin: number) => {
        g.fillStyle = 'rgba(0,0,0,0.5)';
        g.fillRect(cx - m(wWin / 2) - m(0.14), m(1.28), m(wWin) + m(0.28), m(2.1) + m(0.14));
        g.fillStyle = BANK_BRONZE;
        g.fillRect(cx - m(wWin / 2), m(1.36), m(wWin), m(2.1));
        g.fillStyle = '#26303a';
        g.fillRect(cx - m(wWin / 2) + m(0.1), m(1.46), m(wWin) - m(0.2), m(1.9));
        g.fillStyle = '#9aa2a8';                                   // venetian blinds, half down
        for (let y = m(1.5); y < m(2.5); y += Math.max(2, m(0.13))) {
          g.fillRect(cx - m(wWin / 2) + m(0.1), y, m(wWin) - m(0.2), Math.max(1, m(0.05)));
        }
        g.fillStyle = 'rgba(255,255,255,0.12)';
        g.fillRect(cx - m(wWin / 2) + m(0.1), m(1.46), m(0.25), m(1.9));
        g.fillStyle = BANK_LIGHT;                                   // sill
        g.fillRect(cx - m(wWin / 2) - m(0.1), m(3.46), m(wWin) + m(0.2), m(0.12));
      };
      win(Math.round(W * 0.18), 2.2);
      win(Math.round(W * 0.82), 2.2);
      // applied metal letters — a shadow under each, no painted band
      g.font = `bold ${m(0.5)}px monospace`;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillText('FIRST FEDERAL', W / 2 + m(0.06), m(0.78) + m(0.06));
      g.fillStyle = '#c9ccd0'; g.fillText('FIRST FEDERAL', W / 2, m(0.78));
      // THE ATM IS NOT PAINTED HERE ANY MORE — it is real geometry, recessed.
      //
      // It used to be a flat rectangle on this canvas, and the user named the
      // consequence exactly: *"the ATM is PAINTED INTO bankBand's texture — a
      // flat rectangle on the facade plane — which is why it reads flat and why
      // 'too high' and 'doesn't work' both landed on it."* A painted machine
      // cannot be looked into or stood at, so every complaint about it was
      // really the same complaint.
      //
      // What this painter does now is cut the HOLE. `clearRect` takes the band's
      // alpha to zero over the opening and the material carries `alphaTest`, so
      // the facade quad genuinely stops existing there and the niche behind it
      // is visible. Without the hole a recess is impossible: the shell's +x face
      // is one opaque quad at x = -FACE and anything set back from it is simply
      // occluded — a "recess" built in front of that plane is a box stuck on the
      // wall, which is what was being complained about in the first place.
      //
      // Cleared LAST, after the dither below, or the speckle paints back over
      // the hole. See `atmNiche` for what stands in it.
      const nx = Math.round(W * 0.62);
      g.fillStyle = BANK_GRANITE; g.fillRect(nx - m(0.24), m(2.0), m(0.48), m(0.62));
      g.fillStyle = '#16181c'; g.fillRect(nx - m(0.16), m(2.12), m(0.32), m(0.1));
      g.fillStyle = BANK_BRONZE; g.fillRect(nx + m(0.4), m(2.0), m(0.3), m(0.42));   // plaque
      g.fillStyle = '#2a2c30'; g.fillRect(Math.round(W * 0.28), m(0.28), m(0.22), m(0.16)); // camera
      dither(g, W, H, Math.round(wM * SHOP_BAND_H * 4));
      // …and now the hole, after the dither.
      const ax = Math.round(W * ATM_U);
      g.clearRect(ax - m(ATM_W / 2), m(SHOP_BAND_H - ATM_TOP), m(ATM_W), m(ATM_TOP - ATM_SILL));
    });
  };
  /** One face of the raked fascia. Only what was asked for and nothing else:
   *  a card slot with its lit arrow, a cash slot with a shutter lip, a receipt
   *  slot, and a keypad that reads as separate keys. No name plate, no frame —
   *  those are what made attempt two ugly.
   */
  const atmPanelTex = (which: 'screen' | 'keys' | 'apron', wM: number, hM: number) => {
    const PXM = 160;
    const W = Math.max(2, Math.round(wM * PXM)), H = Math.max(2, Math.round(hM * PXM));
    const px = (v: number) => Math.max(1, Math.round(v * PXM));
    return declareSurface(pixTex(W, H, (g) => {
      // GUNMETAL, and this is the ruling's main half. The body was #8d949b
      // against a #9a9ca0 wall — ten levels apart, 4%, so a real 0.17 m recess
      // had nothing to read against and three geometry attempts were always
      // going to miss. Same shape of fault as the puddles that were present,
      // filled, and invisible because they had crushed to the tone of the wet
      // road: the geometry was never the problem there either.
      //
      // #414a52 against #9a9ca0 is 74 against 156 — a 53% separation, and cooler
      // as well as darker, so it reads as METAL set into STONE rather than as
      // more stone. Nothing warm: the library next door is the warm building.
      g.fillStyle = '#414a52'; g.fillRect(0, 0, W, H);
      if (which === 'screen') {
        // the CRT is most of this panel — it is the object, not a detail
        const sx = px(0.055), sy = px(0.045), sw = W - px(0.19), sh = H - px(0.09);
        g.fillStyle = '#1c2026'; g.fillRect(sx, sy, sw, sh);
        g.fillStyle = '#0d1418'; g.fillRect(sx + px(0.012), sy + px(0.012), sw - px(0.024), sh - px(0.024));
        g.fillStyle = '#3f6a4a'; g.fillRect(sx + px(0.024), sy + px(0.024), sw - px(0.048), sh - px(0.048));
        g.fillStyle = 'rgba(180,255,190,0.32)';
        g.fillRect(sx + px(0.05), sy + px(0.06), px(0.20), px(0.016));
        g.fillRect(sx + px(0.05), sy + px(0.10), px(0.13), px(0.016));
        g.fillStyle = 'rgba(255,255,255,0.07)';
        g.fillRect(sx + px(0.024), sy + px(0.024), px(0.06), sh - px(0.048));
        // CARD SLOT down the right edge, with its lit arrow
        const cx = W - px(0.115);
        g.fillStyle = '#2b3036'; g.fillRect(cx, sy + px(0.03), px(0.075), sh - px(0.12));
        g.fillStyle = '#0a0c0e'; g.fillRect(cx + px(0.016), sy + px(0.05), px(0.043), sh - px(0.16));
        g.fillStyle = '#63c27a';
        g.fillRect(cx + px(0.012), sy + px(0.012), px(0.05), px(0.012));
        for (let i = 0; i < 4; i++) g.fillRect(cx + px(0.032) + i, sy + px(0.002) + i, 1, px(0.03) - 2 * i);
      } else if (which === 'keys') {
        // SEPARATE KEYS, not one grey block: each in its own well with a lit
        // top edge and a shadow under it, which is what makes them read as keys
        // on a shelf you are looking down at.
        g.fillStyle = '#363d44'; g.fillRect(0, 0, W, H);   // shelf, under the body tone
        const kw = px(0.072), kh = px(0.026), gx = px(0.022), gy = px(0.012);
        const k0x = W / 2 - (3 * kw + 2 * gx) / 2, k0y = px(0.012);
        for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) {
          const x = k0x + c * (kw + gx), y = k0y + r * (kh + gy);
          g.fillStyle = '#31363c'; g.fillRect(x - px(0.005), y - px(0.004), kw + px(0.01), kh + px(0.008));
          g.fillStyle = c === 1 ? '#c6cbcf' : '#aab0b6';       // middle column worn pale
          g.fillRect(x, y, kw, kh);
          g.fillStyle = 'rgba(255,255,255,0.30)'; g.fillRect(x, y, kw, px(0.005));
          g.fillStyle = 'rgba(0,0,0,0.38)'; g.fillRect(x, y + kh - px(0.005), kw, px(0.005));
        }
      } else {
        // CASH SLOT with a shutter LIP standing proud of the mouth, and a
        // receipt slot beside it
        g.fillStyle = '#2b3036'; g.fillRect(px(0.05), px(0.02), W - px(0.10), px(0.055));
        g.fillStyle = '#0a0c0e'; g.fillRect(px(0.07), px(0.032), W - px(0.14), px(0.03));
        g.fillStyle = '#9aa1a8'; g.fillRect(px(0.06), px(0.014), W - px(0.12), px(0.012)); // the lip
        g.fillStyle = 'rgba(255,255,255,0.28)'; g.fillRect(px(0.06), px(0.014), W - px(0.12), px(0.004));
        g.fillStyle = '#2b3036'; g.fillRect(px(0.06), px(0.088), px(0.22), px(0.03));
        g.fillStyle = '#0a0c0e'; g.fillRect(px(0.072), px(0.096), px(0.196), px(0.014));
      }
      dither(g, W, H, Math.round(wM * hM * 30));
    }), 'sign');
  };

  /** The niche: a 0.15 m recess with a two-plane RAKED fascia inside it. */
  const atmNiche = (zc: number) => {
    const xF = -FACE;                       // facade plane; -x goes into the wall
    const hOpen = ATM_TOP - ATM_SILL, yMid = (ATM_TOP + ATM_SILL) / 2;
    // A LIT TOP EDGE AND SHADOWED SIDES, which is what says "cut into" rather
    // than "laid on". Three tones, not one: the head catches light, the jambs
    // are the darkest thing in the opening, the sill sits between them.
    // THE REVEAL IS CUT PRECAST, not its own colour. It is the sawn edge of the
    // wall, so every tone here is the wall's #9a9ca0 shaded by which way the
    // face points: the head looks DOWN and is in shadow, the sill looks UP and
    // catches the sky, the jambs sit between and differ from each other so the
    // opening has a light side and a dark side.
    //
    // This is the half of the ruling that makes the recess legible. Previously
    // the jambs were near-black and the machine was pale — so the reveal read as
    // a dark frame drawn AROUND a pale panel, which is a picture. Pale cut stone
    // around a dark machine reads as a hole with something in it.
    const head = new THREE.MeshBasicMaterial({ color: 0x74797f });   // faces down: shaded
    const jamb = new THREE.MeshBasicMaterial({ color: 0x8a8d92 });   // lit side
    const jambDark = new THREE.MeshBasicMaterial({ color: 0x6b7076 }); // shadowed side
    const sill = new THREE.MeshBasicMaterial({ color: 0xb2b5b9 });   // faces up: lit
    const backM = new THREE.MeshBasicMaterial({ color: 0x23282d });
    const add = (w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      b.position.set(x, y, z);
      b.userData.atmPart = 'niche';
      scene.add(b);
    };
    const t = 0.02;
    add(ATM_R, t, ATM_W + t * 2, xF - ATM_R / 2, ATM_TOP + t / 2, zc, head);
    add(ATM_R, t, ATM_W + t * 2, xF - ATM_R / 2, ATM_SILL - t / 2, zc, sill);
    add(ATM_R, hOpen, t, xF - ATM_R / 2, yMid, zc + ATM_W / 2 + t / 2, jamb);
    add(ATM_R, hOpen, t, xF - ATM_R / 2, yMid, zc - ATM_W / 2 - t / 2, jambDark);
    add(0.02, hOpen, ATM_W, xF - ATM_R - 0.01, yMid, zc, backM);   // back of the recess

    /** A raked panel. Its TOP edge sits `dTop` behind the facade and its BOTTOM
     *  edge `dBot`, with dTop > dBot, so the face tilts UP toward the user.
     *
     *  The rotation is baked into the GEOMETRY, in this order, rather than set
     *  as mesh Euler angles — that is what went wrong last time. rotateX(-θ)
     *  takes the normal from +z to (0, sinθ, cosθ); rotateY(π/2) then maps
     *  (x,y,z) -> (z,y,-x), giving (cosθ, sinθ, 0): out of the wall and UP.
     *  Order-independent, and the resulting normal is asserted in the check.
     */
    const panel = (which: 'screen' | 'keys' | 'apron', yTop: number, yBot: number, dTop: number, dBot: number) => {
      const dy = yTop - yBot, dd = dTop - dBot;
      const len = Math.hypot(dy, dd), theta = Math.atan2(dd, dy);
      const geo = new THREE.PlaneGeometry(M_W, len);
      geo.rotateX(-theta);
      geo.rotateY(Math.PI / 2);
      const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: atmPanelTex(which, M_W, len) }));
      mesh.position.set(xF - (dTop + dBot) / 2, (yTop + yBot) / 2, zc);
      mesh.userData.atmPart = which;
      mesh.userData.atmTilt = +(theta * 180 / Math.PI).toFixed(1);
      scene.add(mesh);
    };
    panel('screen', M_TOP, M_SCREEN_BOT, D_TOP, D_SCREEN_BOT);
    panel('keys', M_SCREEN_BOT, M_KEYS_BOT, D_SCREEN_BOT, D_KEYS_BOT);
    panel('apron', M_KEYS_BOT, M_BOT, D_KEYS_BOT, D_BOT);
  };

  const bankWall = (wM: number, hM: number, floors: number) => {
    const surf = masonry(wM, hM, SHOP_BAND_H);
    const { W, H, ppm } = surf;
    const m = (v: number) => Math.round(v * ppm);
    return surf.paint((g) => {
      g.fillStyle = BANK_STONE; g.fillRect(0, 0, W, H);
      g.fillStyle = 'rgba(0,0,0,0.15)';                       // precast panel joints
      for (let x = 0; x <= W; x += m(2.4)) g.fillRect(x, 0, Math.max(1, m(0.05)), H);
      for (let y = 0; y <= H; y += m(FLOOR_M)) g.fillRect(0, y, W, Math.max(1, m(0.05)));
      g.fillStyle = 'rgba(255,255,255,0.09)';
      for (let y = 0; y <= H; y += m(FLOOR_M)) g.fillRect(0, y + Math.max(1, m(0.05)), W, 1);
      const cols = Math.max(2, Math.floor(wM / 2.4));
      for (let f = 0; f < floors; f++) {
        for (let c = 0; c < cols; c++) {
          const cx = Math.round(W * (c + 0.5) / cols);
          const y = m(0.7) + f * m(FLOOR_M);
          g.fillStyle = 'rgba(0,0,0,0.42)'; g.fillRect(cx - m(0.78), y - m(0.08), m(1.56), m(1.42));
          g.fillStyle = BANK_BRONZE; g.fillRect(cx - m(0.7), y, m(1.4), m(1.26));
          g.fillStyle = '#2b343d'; g.fillRect(cx - m(0.62), y + m(0.08), m(1.24), m(1.1));
          g.fillStyle = 'rgba(160,180,200,0.18)'; g.fillRect(cx - m(0.62), y + m(0.08), m(0.4), m(1.1));
          g.fillStyle = BANK_LIGHT; g.fillRect(cx - m(0.78), y + m(1.26), m(1.56), m(0.1));
        }
      }
      g.fillStyle = BANK_DARK; g.fillRect(0, 0, W, m(0.55));          // flat capping, no cornice
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, m(0.55), W, Math.max(1, m(0.08)));
      dither(g, W, H, Math.round(wM * hM * 3));
    });
  };
  const placeBank = (z: number, w: number) => {
    const cz = z - w / 2, floors = 4, h = wallHeight(floors);
    // ── the ATM answers when you press E ──────────────────────────────────
    //
    // Reported: *"'doesn't work' is a request for an interaction … What is not
    // an answer is a machine that looks usable and ignores you."* Agreed, so it
    // does something rather than becoming a taped OUT OF ORDER sign — the unit
    // is clean precast on a bank that looks like it was cleaned last year, and
    // a broken machine would have to be dressed for it to read as deliberate.
    //
    // Real data, not a prop: the balance is `ctx.purse.cash`, the same number
    // the wallet shows on right-click, so it cannot drift from it. Buy cereal
    // in the bodega and the ATM says so.
    //
    // WHERE IT IS, derived rather than guessed. `bankBand` paints the ATM at
    // u = 0.36 across the frontage, and the band's u runs -z (measured, not
    // assumed: the depository at u 0.62 photographs at z 2.3). The frontage
    // runs from `z` back to `z - w`, so u maps to `z - u * w`.
    const atmZ = z - 0.36 * w;
    let readAt = -1e9;
    o.spot({
      x: -FACE, z: atmZ, r: 1.25,
      ok: () => true,
      label: () => (performance.now() - readAt < 6000
        ? `FIRST FEDERAL — balance $${o.purse.cash.toFixed(2)}`
        : 'FIRST FEDERAL — check balance'),
      act: () => { readAt = performance.now(); o.refreshWallet(); },
    });
    const dep = depthOf('FIRST FEDERAL'), cx = -(FACE + dep / 2);
    const roofM = new THREE.MeshBasicMaterial({ color: 0x2b2d33 });
    // THE HOLE NEEDS alphaTest, or `clearRect` buys nothing: an untested
    // transparent texel still writes depth and still occludes the niche behind
    // it. alphaTest discards the fragment outright, so the facade genuinely
    // stops at the opening.
    //
    // 0.5 rather than `transparent: true` on purpose. GOTCHAS §10 and the
    // graffiti round: `ct/props.ts` gates its dimmer on
    // `isGlass = m.transparent && !(m.alphaTest > 0)`, so a transparent facade
    // with no alphaTest would be classed as GLAZING and quietly excused from
    // night grading — the whole bank front would stay bright after dark. With
    // alphaTest set it grades like the masonry it is.
    const bandM = flat(bankBand(w));
    bandM.alphaTest = 0.5;
    // THE REPORTED DEFECT. The bank's front is pale precast and its returns
    // were the block's brown brick, so it read as a stage flat. bankWall with
    // floors = 0 is the same panel, the same joints and the same palette with
    // no windows in it — which is what a blind precast return actually is.
    // THE RETURN, and it is a DECISION rather than a leftover.
    //
    // The complaint, twice: the front is a pale precast panel system with a
    // regular window grid and the return was flat brick with nothing in it —
    // not the wrong shade, a different building, two materials meeting at a
    // sharp arris with nothing reconciling them.
    //
    // A blind flank IS real. Buildings do have windowless sides where they
    // expected a neighbour. But it has to look like a party wall, and the
    // strongest answer for a bank on a corner is the one real banks of the
    // period use: CARRY THE FRONT ROUND THE FIRST BAY, then let it become a
    // party wall behind that. The corner stays architecture; the depth of the
    // site admits it was never meant to be seen.
    //
    // One texture, not two meshes: the transition IS the drawing. The bay is
    // the same `bankWall` panel, joints, capping and window rhythm the FRONT
    // is painted from — derived from that spec, never from a shared constant.
    const BANK_PARTY = '#7d5140';        // cheaper, duller, NOT the block brick
    const BAY_M = 3.2;
    const bankReturn = (depM: number, hM: number, streetAt: 'left' | 'right') => {
      const surf = masonry(depM, hM, SHOP_BAND_H);
      const { W, H, ppm } = surf;
      const m = (v: number) => Math.round(v * ppm);
      const bayW = Math.min(m(BAY_M), Math.round(W * 0.45));
      const bx = streetAt === 'right' ? W - bayW : 0;   // +z face reads +x; -z reads -x
      return surf.paint((g) => {
        // ── behind the bay: a party wall nobody was meant to see ──────────
        g.fillStyle = BANK_PARTY; g.fillRect(0, 0, W, H);
        surf.courses(g);
        // tar ghosts — the roofline of what stood against it, painted over
        g.fillStyle = 'rgba(30,24,20,0.28)';
        const ghost = m(hM * 0.46);
        g.fillRect(streetAt === 'right' ? 0 : bayW, ghost, W - bayW, H - ghost);
        g.fillStyle = 'rgba(0,0,0,0.22)';
        g.fillRect(streetAt === 'right' ? 0 : bayW, ghost, W - bayW, Math.max(1, m(0.14)));
        // a painted sign that has almost gone, the way they do
        g.fillStyle = 'rgba(214,198,170,0.10)';
        g.fillRect(streetAt === 'right' ? m(0.8) : bayW + m(0.8), ghost + m(1.4), Math.max(2, W - bayW - m(1.6)), m(1.9));
        // weather, per metre, heaviest at the top where it runs off
        g.fillStyle = 'rgba(0,0,0,0.17)';
        for (let i = 0; i < Math.max(6, Math.round(depM * 1.2)); i++) {
          g.fillRect((i * 37) % W, 0, 2, Math.round(H * (0.25 + ((i % 5) / 6))));
        }
        // NO capping across the party wall. That is the tell: a cornice costs
        // money and nobody spends it on a face that was going to be buried.
        // ── the bay: the front, turning the corner ────────────────────────
        g.fillStyle = BANK_STONE; g.fillRect(bx, 0, bayW, H);
        g.fillStyle = 'rgba(0,0,0,0.15)';                      // the same panel joints
        for (let x = bx; x <= bx + bayW; x += m(2.4)) g.fillRect(x, 0, Math.max(1, m(0.05)), H);
        for (let y = 0; y <= H; y += m(FLOOR_M)) g.fillRect(bx, y, bayW, Math.max(1, m(0.05)));
        g.fillStyle = 'rgba(255,255,255,0.09)';
        for (let y = 0; y <= H; y += m(FLOOR_M)) g.fillRect(bx, y + Math.max(1, m(0.05)), bayW, 1);
        // ONE window per floor, on the front's own rhythm and sill line, so
        // the grid genuinely continues round the corner instead of restarting
        const cx = bx + Math.round(bayW / 2);
        for (let f = 0; f < 4; f++) {
          const y = m(0.7) + f * m(FLOOR_M);
          g.fillStyle = 'rgba(0,0,0,0.42)'; g.fillRect(cx - m(0.78), y - m(0.08), m(1.56), m(1.42));
          g.fillStyle = BANK_BRONZE; g.fillRect(cx - m(0.7), y, m(1.4), m(1.26));
          g.fillStyle = '#2b343d'; g.fillRect(cx - m(0.62), y + m(0.08), m(1.24), m(1.1));
          g.fillStyle = 'rgba(160,180,200,0.18)'; g.fillRect(cx - m(0.62), y + m(0.08), m(0.4), m(1.1));
          g.fillStyle = BANK_LIGHT; g.fillRect(cx - m(0.78), y + m(1.26), m(1.56), m(0.1));
        }
        // the capping returns over the bay ONLY, and stops dead
        g.fillStyle = BANK_DARK; g.fillRect(bx, 0, bayW, m(0.55));
        g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(bx, m(0.55), bayW, Math.max(1, m(0.08)));
        // the arris itself: a shadow where precast meets brick, so the change
        // reads as two materials meeting and not as a seam in one
        g.fillStyle = 'rgba(0,0,0,0.34)';
        g.fillRect(streetAt === 'right' ? bx - Math.max(1, m(0.07)) : bx + bayW, 0, Math.max(1, m(0.07)), H);
        dither(g, W, H, Math.round(depM * hM * 4));
      });
    };
    // the BACK is party wall all the way — no bay, nobody turns that corner
    const bankFlank = (wM: number, hM: number) => flat(bankReturn(wM, hM, 'right'));
    const wall = new THREE.Mesh(new THREE.BoxGeometry(dep, h, w),
      [flat(bankWall(w, h, floors)), bankFlank(w, h), roofM, roofM,
        flat(bankReturn(dep, h, 'right')),      // +z face: u runs with +x, street is at max
        flat(bankReturn(dep, h, 'left'))]);     // -z face: u runs with -x, street is at min
    wall.userData.facing = 'x';        // the bank fronts the main street
    wall.position.set(cx, h / 2 + SHOP_BAND_H, cz);
    scene.add(wall);
    const band = new THREE.Mesh(new THREE.BoxGeometry(dep, SHOP_BAND_H, w),
      [bandM, bankFlank(w, SHOP_BAND_H), roofM, roofM,
        flat(bankReturn(dep, SHOP_BAND_H, 'right')), flat(bankReturn(dep, SHOP_BAND_H, 'left'))]);
    band.position.set(cx, SHOP_BAND_H / 2, cz);
    scene.add(band);
    atmNiche(atmZ);
    solid({ minX: -FACE - dep, maxX: -FACE + 0.3, minZ: cz - w / 2, maxZ: cz + w / 2 });
    // A recessed entrance, because a bank door is not a glass hole in a band.
    // Same trick as the bodega's canted bay: the leaf sits back behind the
    // wall line and the reveal is boxed in, so the opening has a shadow.
    const DW = 1.9, DH = 2.6, DREC = 0.30;
    const XF = -FACE;
    const doorT = declareSurface(pixTex(60, 82, (g) => {
      g.fillStyle = BANK_BRONZE; g.fillRect(0, 0, 60, 82);
      g.fillStyle = '#232a31'; g.fillRect(5, 5, 22, 58); g.fillRect(33, 5, 22, 58);
      g.fillStyle = 'rgba(170,190,210,0.16)'; g.fillRect(7, 7, 7, 54); g.fillRect(35, 7, 7, 54);
      g.fillStyle = BANK_BRONZE; g.fillRect(28, 0, 4, 82);            // meeting stile
      g.fillStyle = '#c9b07a'; g.fillRect(24, 30, 3, 20); g.fillRect(33, 30, 3, 20);  // pull handles
      g.fillStyle = '#3a4048'; g.fillRect(0, 66, 60, 16);             // kick rail
      g.fillStyle = 'rgba(255,255,255,0.1)'; g.fillRect(0, 66, 60, 1);
    }), 'detail');
    // The surround PROJECTS and the leaf sits flush behind it, rather than the
    // leaf being set back into a solid wall — a band box is opaque, so a door
    // buried behind it is just a hole with nothing in it. Three granite pieces
    // make a portal: two jambs and a head, standing 0.30 m proud, which is
    // exactly the cushion the footprint already reserves so it takes no
    // pavement. The depth of those three is what casts the shadow.
    const leaf = new THREE.Mesh(new THREE.PlaneGeometry(DW, DH), flat(doorT));
    leaf.position.set(XF + 0.02, DH / 2, cz);
    leaf.rotation.y = Math.PI / 2;
    scene.add(leaf);
    const graniteM = new THREE.MeshBasicMaterial({ color: 0x4e5358 });
    for (const sg of [-1, 1]) {
      const jb = new THREE.Mesh(new THREE.BoxGeometry(DREC, DH + 0.42, 0.46), graniteM);
      jb.position.set(XF + DREC / 2 - 0.01, (DH + 0.42) / 2, cz + sg * (DW / 2 + 0.23));
      scene.add(jb);
    }
    const head = new THREE.Mesh(new THREE.BoxGeometry(DREC, 0.42, DW + 0.92), graniteM);
    head.position.set(XF + DREC / 2 - 0.01, DH + 0.21, cz);
    scene.add(head);
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(DREC + 0.06, 0.14, DW + 1.16),
      new THREE.MeshBasicMaterial({ color: 0x6a6f75 }));
    lintel.position.set(XF + DREC / 2 + 0.01, DH + 0.49, cz);
    scene.add(lintel);
  };
  return { placeBank };
}
