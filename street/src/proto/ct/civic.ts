import * as THREE from 'three';
import { pixTex, dither } from './paint';
import { FACE } from './rng';

// The two buildings on this block that are NOT shops.
//
// Split out of `ct/street.ts` on 2026-07-24. street.ts was 1277 lines with a
// single owner, and six queued user requests were stacked behind that one
// owner — church buttresses, the church tower, the library courtyard, the
// casino sign, hotel facade detail. None of them touch the shopfront system.
// A civic building shares nothing with a brick-box-and-awning except the
// street it stands on, so the seam was already there; this just cuts it.
//
// Takes what it needs from the caller and hands back two placers. Owns no
// state and registers nothing — street.ts still decides where these go.
export interface BldSpec {
  nm: string; col: string; w: number; brick: string; floors: number;
  res?: boolean; kind?: 'library' | 'church'; front?: 'burger' | 'pawn' | 'tax';
}

export function buildCivic(o: {
  scene: THREE.Scene;
  flat: (m: THREE.Texture) => THREE.MeshBasicMaterial;
  KERB_H: number;
}) {
  const { scene, flat, KERB_H } = o;
  //
  // The library and the church are the two buildings on this block that are
  // NOT shops, and they must not be built out of shop parts. Everything else
  // here is brick + awning + sign band + glass; these two get their own
  // vocabulary, and it is the vocabulary that does the work:
  //
  //   ASHLAR, not brick — squared stone in 9 px courses against brick's 5 px,
  //     with PALE lime joints instead of dark ones, so it reads cool and
  //     coarse next to the warm fine brick either side.
  //   ARCHED openings, not rectangular holes — round-headed for the library
  //     (Carnegie branches are classical), pointed for the church.
  //   CUT lettering, not a painted band — the letters are the shadow of a
  //     chisel cut with a lit lower lip, which is what makes stone lettering
  //     read as carved rather than stencilled.
  //   A REAL PROFILE — projecting doorcases, cornices, buttresses, copings.
  //     A shopfront is a flat plane; a civic building has depth in its
  //     silhouette, and that is most of what tells them apart at a glance.
  const STONE = '#a89e88', STONE_D = '#8a806c', STONE_L = '#c2b8a0';
  const SLATE = '#4a4e56';
  const clcg = (s: number) => () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  // squared stone, laid in courses, every third block a shade off
  const ashlar = (g: CanvasRenderingContext2D, W: number, H: number, r: () => number, courseH = 9, blockW = 22) => {
    g.fillStyle = STONE; g.fillRect(0, 0, W, H);
    for (let y = 0, i = 0; y < H; y += courseH, i++) {
      const off = (i % 2) ? 0 : Math.round(blockW / 2);
      for (let x = -off; x < W; x += blockW) {
        const k = r();
        if (k > 0.8) g.fillStyle = STONE_L; else if (k < 0.22) g.fillStyle = STONE_D; else continue;
        g.fillRect(x + 1, y + 1, blockW - 2, courseH - 2);
      }
    }
    g.fillStyle = 'rgba(255,255,255,0.16)';          // pale lime bed joint…
    for (let y = 0; y < H; y += courseH) g.fillRect(0, y, W, 1);
    g.fillStyle = 'rgba(0,0,0,0.15)';                // …and its shadow under
    for (let y = 0; y < H; y += courseH) g.fillRect(0, y + 1, W, 1);
    g.fillStyle = 'rgba(0,0,0,0.12)';
    for (let y = 0, i = 0; y < H; y += courseH, i++) {
      const off = (i % 2) ? 0 : Math.round(blockW / 2);
      for (let x = -off; x < W; x += blockW) g.fillRect(x, y, 1, courseH);
    }
  };
  // an arched opening. Round-headed by default; `pointed` gives the gothic
  // taper the church wants. Drawn as pixel steps, not a path, so it stays in
  // the same hand as the rest of the world.
  const archFill = (g: CanvasRenderingContext2D, cx: number, w: number, yTop: number, yBot: number, col: string, pointed = false) => {
    const rr = Math.floor(w / 2);
    const rise = pointed ? Math.round(rr * 1.9) : rr;
    const spring = yTop + rise;
    g.fillStyle = col;
    if (yBot > spring) g.fillRect(cx - rr, spring, w, yBot - spring);
    for (let dy = 0; dy <= rise; dy++) {
      const t = (rise - dy) / rise;
      const hw = pointed ? Math.round(rr * (1 - Math.pow(t, 1.8))) : Math.round(Math.sqrt(Math.max(0, rr * rr - (rise - dy) * (rise - dy))));
      if (hw > 0) g.fillRect(cx - hw, yTop + dy, hw * 2, 1);
    }
  };
  // lettering CUT into the stone: shadow first, then a lit lower lip
  const engrave = (g: CanvasRenderingContext2D, text: string, cx: number, cy: number, px: number) => {
    g.font = `bold ${px}px monospace`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = 'rgba(255,255,255,0.34)'; g.fillText(text, cx, cy + 1);
    g.fillStyle = 'rgba(38,30,22,0.62)'; g.fillText(text, cx, cy);
  };
  // rose window: stone surround, eight lights of coloured glass, stone boss
  const roseWin = (g: CanvasRenderingContext2D, cx: number, cy: number, R: number) => {
    // four hues, not eight. Real glass in a small parish rose is a limited
    // palette, and eight saturated ones at this texel size read as a beach
    // ball rather than as leaded glass in a muted street.
    const glass = ['#7a3e3c', '#3d5470', '#a08348', '#3f6050', '#7a3e3c', '#3d5470', '#a08348', '#3f6050'];
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      const d = Math.hypot(dx, dy);
      if (d > R) continue;
      const a = Math.atan2(dy, dx) + Math.PI;
      const seg = a / (Math.PI / 4);
      if (d > R - 2.4) g.fillStyle = STONE_D;
      else if (d < 3) g.fillStyle = STONE_L;
      else if (Math.abs(d - (R - 2.4) * 0.56) < 1.2) g.fillStyle = STONE;
      else if (Math.abs(seg - Math.round(seg)) < 0.075) g.fillStyle = STONE;
      else g.fillStyle = glass[Math.floor(seg) % 8];
      g.fillRect(cx + dx, cy + dy, 1, 1);
    }
  };
  const stoneM = () => new THREE.MeshBasicMaterial({ color: 0x9c9280 });
  const slateM = () => new THREE.MeshBasicMaterial({ color: 0x4a4e56 });

  // ── the library ─────────────────────────────────────────────────────────
  //
  // A Carnegie branch, and the brief for it is the user's own line: built by
  // people who thought public buildings should be beautiful, and not looked
  // after since. So it gets the full classical kit — rusticated plinth, five
  // bays, tall round-arched windows, a pedimented doorcase up a flight of
  // steps, the name CUT into the frieze in Roman capitals with V for U the
  // way the carvers did it — and then it gets soot down the cornice and
  // staining under every sill, because nobody has cleaned it in forty years.
  //
  // It is deliberately SHORTER than its neighbours. A civic building that
  // does not reach the party walls either side of it is a real condition and
  // it reads as one: the block grew past it and left it behind.
  const LIB_H = 13.2, BAY_H = 6.0, BAY_W = 5.0, BAY_D = 1.8;
  const placeLibrary = (z: number, b: BldSpec) => {
    const cz = z - b.w / 2;
    const LW = Math.round(b.w * 8), LH = Math.round(LIB_H * 11.73);
    const pm = LH / LIB_H;
    const yOf = (m: number) => Math.round(LH - m * pm);
    const bayPx = Math.round(BAY_W * 8);
    const bx0 = Math.round((LW - bayPx) / 2), bx1 = bx0 + bayPx;   // the bay in texels
    const wSide = (bx0 / LW) * b.w;                                 // …and in metres
    // ONE drawing of the whole elevation, sampled three times. Slicing the
    // same painting keeps the coursing, the quoins and the frieze running
    // dead straight across the entrance bay, which they would not if each
    // block were painted separately.
    const paint = (g: CanvasRenderingContext2D) => {
      const r = clcg(0x7ab31d);
      ashlar(g, LW, LH, r);
      const PL = yOf(2.6);
      g.fillStyle = 'rgba(0,0,0,0.13)'; g.fillRect(0, PL, LW, LH - PL);
      for (let y = PL; y < LH; y += 13) { g.fillStyle = 'rgba(0,0,0,0.34)'; g.fillRect(0, y, LW, 2); }
      for (let y = PL, i = 0; y < LH; y += 13, i++) {
        for (let x = (i % 2) ? 0 : 16; x < LW; x += 32) { g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(x, y, 2, 13); }
      }
      g.fillStyle = STONE_L; g.fillRect(0, PL - 3, LW, 3);
      g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(0, PL, LW, 1);
      for (let y = 0, i = 0; y < LH; y += 18, i++) {                 // quoins
        g.fillStyle = (i % 2) ? STONE_L : STONE_D;
        g.fillRect(0, y, 8, 18); g.fillRect(LW - 8, y, 8, 18);
      }
      for (const cx of [Math.round(LW * 0.11), Math.round(LW * 0.28), Math.round(LW * 0.72), Math.round(LW * 0.89)]) {
        archFill(g, cx, 22, yOf(9.2), yOf(3.2), STONE_D);
        archFill(g, cx, 18, yOf(9.0), yOf(3.35), '#26303a');
        g.fillStyle = 'rgba(196,212,222,0.22)';
        for (let y = yOf(8.3); y < yOf(3.35); y += 10) g.fillRect(cx - 9, y, 18, 1);
        g.fillRect(cx - 1, yOf(9.0), 2, yOf(3.35) - yOf(9.0));
        g.fillStyle = STONE_L; g.fillRect(cx - 3, yOf(9.6), 6, 9);
        g.fillRect(cx - 12, yOf(3.35), 24, 3);
        g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(cx - 12, yOf(3.35) + 3, 24, 2);
        g.fillStyle = 'rgba(58,48,36,0.18)'; g.fillRect(cx - 9, yOf(3.35) + 5, 18, 14);
      }
      // the archivolt round the recess — the only thing drawn at the bay, and
      // it stops at its edge because everything inside it is real geometry
      archFill(g, Math.round(LW / 2), bayPx + 12, yOf(BAY_H + 0.6), yOf(0), STONE_D);
      archFill(g, Math.round(LW / 2), bayPx + 4, yOf(BAY_H + 0.25), yOf(0), STONE_L);
      const FR = yOf(11.0), FRH = Math.round(1.1 * pm);
      g.fillStyle = STONE_L; g.fillRect(0, FR, LW, FRH);
      g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(0, FR, LW, 1); g.fillRect(0, FR + FRH - 1, LW, 1);
      engrave(g, 'PVBLIC LIBRARY', Math.round(LW / 2), FR + Math.round(FRH / 2), 9);
      const CO = yOf(11.9);
      g.fillStyle = STONE_D; g.fillRect(0, CO, LW, 3);
      g.fillStyle = STONE_L;
      for (let x = 2; x < LW; x += 6) g.fillRect(x, CO + 3, 3, 5);
      g.fillStyle = STONE; g.fillRect(0, CO + 8, LW, 4);
      g.fillStyle = STONE_L; g.fillRect(0, 0, LW, CO - 4);
      g.fillStyle = 'rgba(0,0,0,0.1)'; g.fillRect(0, 0, LW, CO - 4);
      for (let i = 0; i < 26; i++) {                                 // forty years of soot
        g.fillStyle = `rgba(46,38,30,${0.05 + r() * 0.08})`;
        g.fillRect(Math.floor(r() * LW), CO, 2 + Math.floor(r() * 3), Math.round(r() * LH * 0.5));
      }
      dither(g, LW, LH, 700);
    };
    const slice = (px0: number, px1: number, py0: number, py1: number) =>
      pixTex(px1 - px0, py1 - py0, (g) => { g.translate(-px0, -py0); paint(g); });
    const side = stoneM(), roof = new THREE.MeshBasicMaterial({ color: 0x2b2d33 });
    const box = (w: number, h: number, cx: number, cy: number, czz: number, face: THREE.Material) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(3.4, h, w), [face, side, roof, roof, side, side]);
      m.position.set(-(FACE + 1.7) + cx, cy, czz);
      scene.add(m);
    };
    // the mass, with the entrance bay left OUT of it
    box(wSide, LIB_H, 0, LIB_H / 2, cz + (b.w - wSide) / 2, flat(slice(0, bx0, 0, LH)));
    box(wSide, LIB_H, 0, LIB_H / 2, cz - (b.w - wSide) / 2, flat(slice(bx1, LW, 0, LH)));
    box(BAY_W, LIB_H - BAY_H, 0, (BAY_H + LIB_H) / 2, cz, flat(slice(bx0, bx1, 0, yOf(BAY_H))));
    // …and the back of the recess, 1.8 m in, carrying the doors
    const doorT = pixTex(40, 48, (g) => {
      g.fillStyle = STONE; g.fillRect(0, 0, 40, 48);
      const r2 = clcg(0x1188cd); ashlar(g, 40, 48, r2, 8, 18);
      archFill(g, 20, 26, 4, 48, STONE_D);
      archFill(g, 20, 22, 6, 48, '#2a2118');
      g.fillStyle = '#4a3a26'; g.fillRect(10, 16, 20, 32);
      g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(19, 16, 2, 32);
      g.fillStyle = '#c9a45e'; g.fillRect(16, 30, 2, 4); g.fillRect(22, 30, 2, 4);
      g.fillStyle = '#8a97a2'; g.fillRect(12, 8, 16, 6);          // fanlight over the doors
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(19, 8, 2, 6);
      dither(g, 40, 48, 120);
    });
    const back = new THREE.Mesh(new THREE.BoxGeometry(3.4 - BAY_D, BAY_H, BAY_W),
      [flat(doorT), side, side, side, side, side]);
    back.position.set(-(FACE + 1.7) - BAY_D / 2, BAY_H / 2, cz);
    scene.add(back);
    // The steps live INSIDE the recess. A projecting flight would eat a
    // sidewalk that is only WALK m wide, and this street has no setback to
    // spend — recessing the bay is how a zero-lot civic building gets its
    // climb, its depth and its shadow without taking the pavement.
    const RISE = 0.17, TREAD = (BAY_D - 0.5) / 5;
    for (let i = 0; i < 5; i++) {
      const front = -FACE - i * TREAD;                  // this step's nosing
      const d = Math.abs(front - (-FACE - BAY_D));
      const st = new THREE.Mesh(new THREE.BoxGeometry(d, KERB_H + (i + 1) * RISE, BAY_W - 0.9),
        new THREE.MeshBasicMaterial({ color: i % 2 ? 0xa89e88 : 0x9c9280 }));
      st.position.set(front - d / 2, (KERB_H + (i + 1) * RISE) / 2, cz);
      scene.add(st);
    }
    for (const s of [-1, 1]) {                          // cheek walls either side
      const ck = new THREE.Mesh(new THREE.BoxGeometry(BAY_D, 1.15, 0.42), stoneM());
      ck.position.set(-FACE - BAY_D / 2, 0.575, cz + s * (BAY_W / 2 - 0.21));
      scene.add(ck);
    }
    // The profile, all of it inside the 0.3 m the wall collider already
    // reserves, so the full length of this sidewalk stays walkable.
    const proj = (w: number, h: number, d: number, y: number, dz = 0, col = 0x9c9280) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(d, h, w), new THREE.MeshBasicMaterial({ color: col }));
      m.position.set(-FACE + d / 2 - 0.01, y, cz + dz);
      scene.add(m);
    };
    const jamb = BAY_W / 2 + 0.4;
    proj(0.8, BAY_H + 0.5, 0.28, (BAY_H + 0.5) / 2, -jamb);
    proj(0.8, BAY_H + 0.5, 0.28, (BAY_H + 0.5) / 2, jamb);
    proj(BAY_W + 2.4, 0.6, 0.28, BAY_H + 0.8);          // entablature over the pair
    proj(BAY_W + 1.2, 0.28, 0.28, BAY_H + 1.2, 0, 0xb2a892);
    proj(BAY_W - 1.4, 0.28, 0.28, BAY_H + 1.48, 0, 0xb2a892);
    proj(b.w, 0.62, 0.45, 12.15);                       // cornice, well above head height
    proj(b.w, 0.34, 0.28, LIB_H - 0.17);                // parapet coping
  };

  // ── the church ──────────────────────────────────────────────────────────
  //
  // A small urban Catholic parish church: gabled nave front, a tall pointed
  // doorway in three recessed orders, lancets, a rose window under the
  // coping, buttresses stepping down the front, and a tower with a louvred
  // belfry, a spire and a cross. It is the tallest thing for two streets and
  // that is the point — a landmark, not a storefront.
  const placeChurch = (x0: number, zc: number, b: BldSpec) => {
    const TOWER_W = 5, NAVE_W = b.w - TOWER_W;
    const NAVE_H = 17, RIDGE = 21.6, TOWER_H = 26, SPIRE = 5.2;
    const zFront = zc + 1.7;                       // the facade plane, on the street
    const naveCx = x0 + NAVE_W / 2, towCx = x0 + NAVE_W + TOWER_W / 2;
    const NW = Math.round(NAVE_W * 8), NH = Math.round(NAVE_H * 11.76);
    const pm = NH / NAVE_H, yOf = (m: number) => Math.round(NH - m * pm);
    const naveTex = pixTex(NW, NH, (g) => {
      const r = clcg(0x3c91e5);
      ashlar(g, NW, NH, r, 9, 20);
      const mid = Math.round(NW / 2);
      g.fillStyle = 'rgba(0,0,0,0.16)'; g.fillRect(0, yOf(1.5), NW, NH - yOf(1.5)); // plinth
      g.fillStyle = STONE_L; g.fillRect(0, yOf(1.5) - 2, NW, 2);
      // the doorway: three recessed orders, pointed, with a tympanum
      archFill(g, mid, 44, yOf(7.4), yOf(0.55), STONE_D, true);
      archFill(g, mid, 36, yOf(7.0), yOf(0.55), STONE, true);
      archFill(g, mid, 30, yOf(6.6), yOf(0.55), 'rgba(0,0,0,0.4)', true);
      archFill(g, mid, 26, yOf(6.3), yOf(0.55), '#2a2118', true);
      g.fillStyle = '#4a3524'; g.fillRect(mid - 12, yOf(4.4), 24, yOf(0.55) - yOf(4.4)); // the doors
      g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(mid - 1, yOf(4.4), 2, yOf(0.55) - yOf(4.4));
      g.fillStyle = '#8a7a4a';
      for (const hy of [yOf(3.4), yOf(2.2)]) { g.fillRect(mid - 10, hy, 8, 1); g.fillRect(mid + 3, hy, 8, 1); }
      g.fillStyle = '#c9a45e'; g.fillRect(mid - 4, yOf(2.4), 2, 4); g.fillRect(mid + 2, yOf(2.4), 2, 4);
      // steps
      for (let s = 0; s < 3; s++) {
        g.fillStyle = s % 2 ? STONE_L : STONE;
        g.fillRect(mid - 24 - s * 4, yOf(0.2 * (s + 1)), 48 + s * 8, Math.max(2, Math.round(0.2 * pm)));
      }
      g.fillStyle = STONE_L; g.fillRect(0, yOf(8.4), NW, 3);        // string course
      g.fillStyle = 'rgba(0,0,0,0.24)'; g.fillRect(0, yOf(8.4) + 3, NW, 1);
      // paired lancets either side
      for (const cx of [Math.round(NW * 0.19), Math.round(NW * 0.81)]) {
        archFill(g, cx, 16, yOf(13.2), yOf(9.2), STONE_D, true);
        archFill(g, cx, 12, yOf(13.0), yOf(9.35), '#26303a', true);
        g.fillStyle = '#7a4a4a'; g.fillRect(cx - 5, yOf(12.0), 10, 6);
        g.fillStyle = '#3a5a8a'; g.fillRect(cx - 5, yOf(11.0), 10, 6);
        g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(cx - 1, yOf(13.0), 2, yOf(9.35) - yOf(13.0));
        g.fillStyle = STONE_L; g.fillRect(cx - 8, yOf(9.35), 16, 2);
      }
      roseWin(g, mid, yOf(14.3), 22);
      g.fillStyle = 'rgba(46,38,30,0.1)';
      for (let i = 0; i < 16; i++) g.fillRect(Math.floor(r() * NW), yOf(8.4), 2, Math.round(r() * 60));
      dither(g, NW, NH, 620);
    });
    const roofM = slateM();
    const nave = new THREE.Mesh(new THREE.BoxGeometry(NAVE_W, NAVE_H, 3.4),
      [stoneM(), stoneM(), roofM, roofM, flat(naveTex), stoneM()]);
    nave.position.set(naveCx, NAVE_H / 2, zc);
    scene.add(nave);
    // the gable: a real prism, so the silhouette is a gable and not a box
    const gx0 = x0, gx1 = x0 + NAVE_W, gxm = naveCx;
    const zf = zc + 1.7, zb = zc - 1.7;
    // The gable carries the same coursing as the wall under it, mapped with
    // triangular UVs — (0,0),(1,0),(0.5,1) is the gable's own shape, so the
    // stone runs on across the eaves instead of stopping at a smooth plate.
    const gabW = Math.round(NAVE_W * 8), gabH = Math.round((RIDGE - NAVE_H) * 11.76);
    const gabTex = pixTex(gabW, gabH, (g) => {
      const r = clcg(0x5d21a7);
      ashlar(g, gabW, gabH, r, 9, 20);
      for (let y = 0; y < gabH; y++) {                 // coping along both rakes
        const xL = Math.round((gabW / 2) * (1 - y / gabH));
        g.fillStyle = STONE_L;
        g.fillRect(xL, y, 5, 1); g.fillRect(gabW - xL - 5, y, 5, 1);
      }
      dither(g, gabW, gabH, 160);
    });
    const triG = (z: number) => {
      const gm = new THREE.BufferGeometry();
      const front = z > zc;
      gm.setAttribute('position', new THREE.Float32BufferAttribute(
        front ? [gx0, NAVE_H, z, gx1, NAVE_H, z, gxm, RIDGE, z]
          : [gx1, NAVE_H, z, gx0, NAVE_H, z, gxm, RIDGE, z], 3));
      gm.setAttribute('uv', new THREE.Float32BufferAttribute(
        front ? [0, 0, 1, 0, 0.5, 1] : [1, 0, 0, 0, 0.5, 1], 2));
      gm.computeVertexNormals();
      return new THREE.Mesh(gm, flat(gabTex));
    };
    scene.add(triG(zf)); scene.add(triG(zb));
    for (const s of [-1, 1]) {                       // the two roof slopes
      const sm = new THREE.BufferGeometry();
      const xe = s < 0 ? gx0 : gx1;
      sm.setAttribute('position', new THREE.Float32BufferAttribute(
        s < 0 ? [xe, NAVE_H, zb, xe, NAVE_H, zf, gxm, RIDGE, zf, xe, NAVE_H, zb, gxm, RIDGE, zf, gxm, RIDGE, zb]
          : [xe, NAVE_H, zf, xe, NAVE_H, zb, gxm, RIDGE, zb, xe, NAVE_H, zf, gxm, RIDGE, zb, gxm, RIDGE, zf], 3));
      sm.computeVertexNormals();
      scene.add(new THREE.Mesh(sm, roofM));
    }
    // an oculus in the gable, and the coping along the rake
    const ocT = pixTex(16, 16, (g) => {
      for (let dy = -8; dy < 8; dy++) for (let dx = -8; dx < 8; dx++) {
        const d = Math.hypot(dx + 0.5, dy + 0.5);
        if (d > 7.5) continue;
        g.fillStyle = d > 5.5 ? STONE_D : (((dx + dy) & 1) ? '#3a5a8a' : '#8a3a3a');
        g.fillRect(dx + 8, dy + 8, 1, 1);
      }
    });
    const oc = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), new THREE.MeshBasicMaterial({ map: ocT, alphaTest: 0.5 }));
    oc.position.set(gxm, NAVE_H + 1.5, zf + 0.02);
    scene.add(oc);
    // buttresses — the vertical emphasis, and real depth in the silhouette
    for (const bx of [gx0 + 0.5, gxm - 3.4, gxm + 3.4, gx1 - 0.5]) {
      const bt = new THREE.Mesh(new THREE.BoxGeometry(0.9, 12.5, 0.3), stoneM());
      bt.position.set(bx, 6.25, zFront + 0.15);
      scene.add(bt);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.45, 0.42), new THREE.MeshBasicMaterial({ color: 0xb2a892 }));
      cap.position.set(bx, 12.6, zFront + 0.2);
      scene.add(cap);
    }
    // ── the tower ──
    const TW = Math.round(TOWER_W * 8), TH = Math.round(TOWER_H * 11.76);
    const tpm = TH / TOWER_H, tyOf = (m: number) => Math.round(TH - m * tpm);
    const towTex = pixTex(TW, TH, (g) => {
      const r = clcg(0x91b3c2);
      ashlar(g, TW, TH, r, 9, 18);
      for (let y = 0, i = 0; y < TH; y += 18, i++) {           // quoins
        g.fillStyle = (i % 2) ? STONE_L : STONE_D;
        g.fillRect(0, y, 6, 18); g.fillRect(TW - 6, y, 6, 18);
      }
      const mid = Math.round(TW / 2);
      for (const m of [8.4, 15.0]) {                           // string courses
        g.fillStyle = STONE_L; g.fillRect(0, tyOf(m), TW, 3);
        g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(0, tyOf(m) + 3, TW, 1);
      }
      for (const m of [5.4, 11.6]) {                           // slot lancets up the shaft
        archFill(g, mid, 10, tyOf(m + 2.6), tyOf(m), STONE_D, true);
        archFill(g, mid, 6, tyOf(m + 2.4), tyOf(m + 0.15), '#26303a', true);
      }
      // the belfry: two tall louvred openings
      for (const cx of [mid - 9, mid + 9]) {
        archFill(g, cx, 14, tyOf(23.0), tyOf(17.0), STONE_D, true);
        archFill(g, cx, 10, tyOf(22.8), tyOf(17.2), '#1a1e24', true);
        g.fillStyle = 'rgba(174,166,148,0.5)';
        for (let y = tyOf(21.6); y < tyOf(17.2); y += 4) g.fillRect(cx - 5, y, 10, 2);
      }
      g.fillStyle = STONE_D; g.fillRect(0, tyOf(24.4), TW, 4);   // cornice
      g.fillStyle = STONE_L;
      for (let x = 1; x < TW; x += 5) g.fillRect(x, tyOf(24.4) + 4, 3, 4);
      g.fillStyle = STONE_L; g.fillRect(0, 0, TW, tyOf(25.4));
      g.fillStyle = 'rgba(46,38,30,0.1)';
      for (let i = 0; i < 12; i++) g.fillRect(Math.floor(r() * TW), tyOf(15.0), 2, Math.round(r() * 70));
      dither(g, TW, TH, 520);
    });
    const towM = flat(towTex);
    const tower = new THREE.Mesh(new THREE.BoxGeometry(TOWER_W, TOWER_H, 3.7),
      [flat(towTex.clone()), stoneM(), slateM(), slateM(), towM, stoneM()]);
    tower.position.set(towCx, TOWER_H / 2, zc + 0.15);   // stands 0.3 m proud of the nave front
    scene.add(tower);
    // the spire, and the cross on top of it
    const apex = TOWER_H + SPIRE;
    const hw = TOWER_W / 2, hd = 1.85, tz = zc + 0.15;
    const corners: [number, number][] = [
      [towCx - hw, tz - hd], [towCx + hw, tz - hd], [towCx + hw, tz + hd], [towCx - hw, tz + hd],
    ];
    for (let i = 0; i < 4; i++) {
      const [ax, az] = corners[i], [bx, bz] = corners[(i + 1) % 4];
      const sp = new THREE.BufferGeometry();
      sp.setAttribute('position', new THREE.Float32BufferAttribute(
        [ax, TOWER_H, az, bx, TOWER_H, bz, towCx, apex, tz], 3));
      sp.computeVertexNormals();
      scene.add(new THREE.Mesh(sp, new THREE.MeshBasicMaterial({ color: 0x3f434b, side: THREE.DoubleSide })));
    }
    const crossM = new THREE.MeshBasicMaterial({ color: 0x8a8271 });
    const cUp = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.5, 0.14), crossM);
    cUp.position.set(towCx, apex + 0.75, tz);
    scene.add(cUp);
    const cAcross = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.14, 0.14), crossM);
    cAcross.position.set(towCx, apex + 1.02, tz);
    scene.add(cAcross);
    // the notice board every parish has, by the door
    const ntT = pixTex(24, 16, (g) => {
      g.fillStyle = '#2e3a2c'; g.fillRect(0, 0, 24, 16);
      g.fillStyle = '#d8d0c0'; g.fillRect(2, 2, 20, 12);
      g.fillStyle = '#4a4438'; g.font = 'bold 4px monospace'; g.textAlign = 'center';
      g.fillText('MASS', 12, 7); g.fillText('SUN 9', 12, 12);
    });
    const nt = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.75, 0.1), flat(ntT));
    nt.position.set(naveCx + 4.6, 1.75, zFront + 0.06);
    scene.add(nt);
  };

  return { placeLibrary, placeChurch };
}
