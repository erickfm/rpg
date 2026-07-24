import * as THREE from 'three';
import { pixTex } from './paint';
import { L, ROAD_HALF, FACE, rnd } from './rng';
import { treeSprite, TREE_W, treePitTex, hydrantSprite, pigeonSprite, payphoneTex,
         canTopTex, newspaperTex, scrapTex } from './tex-world';
import type { CtxBuild } from './ctx';

// ── everything standing on the sidewalk, and the weather over it ──────────
//
// Rain, street trees, the bishop-crook lamps, the hydrant, the payphone, and
// the pigeons that peck along the kerb. Grouped because they share one job:
// they are the block's furniture. Nothing here is a building.
//
// ORDER IS LOAD-BEARING. The seeded stream (rnd) sets tree heights and pigeon
// placement, and the harness seeds Math.random to fingerprint the painted
// textures — so the sequence rain → trees → lamps → hydrant → pigeons →
// payphone must not be shuffled, here or against the modules around it.

export interface Props {
  /** streetlamp lenses + halos + road pools, on the night curve (0…1) */
  setLampNight: (v: number) => void;
  /** rain flattens the light — nudge the sky colour toward the storm grey */
  rainSky: (c: THREE.Color) => void;
  /** advance the weather: fades in/out by the hour, tints the wet ground */
  updateRain: (dt: number, px: number, pz: number, hAbs: number) => void;
  /** drop a handful of cereal — replaces whatever was already down */
  scatter: (x: number, z: number, y: number) => void;
  updatePigeons: (dt: number, t: number, px: number, pz: number) => void;
}

export function buildProps(ctx: CtxBuild): Props {
  const { scene, flat, obstacle, boards, wetMats, sidewalkY, KERB_H } = ctx;
  const WET = new THREE.Color(0x5a626e);
  // ── weather: some hours it rains ────────────────────────────────────────
  const RAIN_N = 500;
  const RAIN_BOX = 30;   // world-space wrap period for raindrops
  const rainPos = new Float32Array(RAIN_N * 3);
  for (let i = 0; i < RAIN_N; i++) {
    rainPos[i * 3] = (Math.random() - 0.5) * RAIN_BOX;
    rainPos[i * 3 + 1] = Math.random() * 14;
    rainPos[i * 3 + 2] = (Math.random() - 0.5) * RAIN_BOX;
  }
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.Float32BufferAttribute(rainPos, 3));
  const rainT = pixTex(8, 16, (g) => {
    g.fillStyle = 'rgba(214,222,232,0.8)'; g.fillRect(3, 1, 2, 13);
  });
  const rainM = new THREE.PointsMaterial({ map: rainT, size: 0.3, transparent: true, opacity: 0, depthWrite: false });
  const rain = new THREE.Points(rainGeo, rainM);
  rain.visible = false;
  scene.add(rain);
  let rainLevel = 0;
  const RAIN_SKY = new THREE.Color('#5a626e');
  const rainAt = (h: number) => ((Math.imul(h, 2246822519) >>> 0) % 100) < 22;

  // billboard sprites: trees, hydrant, pigeons
  function board(tex: THREE.Texture, w: number, h: number, x: number, z: number): THREE.Mesh {
    const geo = new THREE.PlaneGeometry(w, h);
    geo.translate(0, h / 2, 0);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide }));
    m.position.set(x, 0, z);
    boards.push({ m });
    scene.add(m);
    return m;
  }
  // street trees — the sprite cutouts are back (they belong here): fixed
  // crown texels, trunk-only variation, planted in dirt pits, and only the
  // trunk is solid so the sidewalk stays walkable. The bed hugs the KERB side
  // (a 1×2-slab strip) so the building half of the 2 m walk is a clear lane
  // you can always slip past on — no more full-width tree blocking the path.
  const TREE_PX = 0.05; // world units per texel
  const pitT = treePitTex();
  // a 0.8 m planting strip flush against the kerb (x 5.0–5.8). The player
  // RADIUS is 0.42 and the building wall's collider already reaches x≈6.28,
  // so the trunk collider must be tight and kerb-hugging to leave a real lane:
  // trunk to 5.48 + 0.42 = walkable from x≈5.9, wall from x≈6.28 → ~0.4 m clear.
  // Width 0.8 is deliberate and stays — it's what leaves a real lane past the
  // tree. Length was 2.0 (two whole slabs down the walk, which read as a long
  // trench); 1.0 is a single slab, so the pit is a square-ish bed like a real
  // tree well instead of a strip.
  const pitGeo = new THREE.PlaneGeometry(0.8, 1.0);
  const pitMat = new THREE.MeshBasicMaterial({ map: pitT });
  // Hand-tuned height exceptions. This is a hand-authored block, so a tree
  // that reads wrong in its particular spot gets trimmed by index rather than
  // by re-rolling the seed and disturbing every other tree. treeIdx 2 stands
  // at z=-30, in front of ARCADE (which spans z -35..-22), and drew tall
  // enough to crowd the sign.
  const TREE_TRIM: Record<number, number> = { 2: 0.85 };
  let treeIdx = 0;
  for (let z = -2; z > -L + 8; z -= 14) {
    const s = Math.round(z / 14) % 2 === 0 ? 1 : -1;
    const tx = s * (ROAD_HALF + 0.4);               // kerb-side; pit road-edge sits on the kerb
    const pz2 = Math.round(z - 0.5) + 0.5;          // snapped to the 1 m slab grid
    // rnd() is consumed for EVERY tree regardless, so trimming one does not
    // shift the seeded stream and change the others.
    const H = Math.round((90 + Math.floor(rnd() * 24)) * (TREE_TRIM[treeIdx] ?? 1));
    const tree = board(treeSprite(treeIdx, H), TREE_W * TREE_PX, H * TREE_PX, tx, pz2);
    tree.position.y = sidewalkY;
    const pit = new THREE.Mesh(pitGeo, pitMat);
    pit.rotation.x = -Math.PI / 2;
    pit.position.set(tx, sidewalkY + 0.006, pz2);
    scene.add(pit);
    obstacle({ minX: tx - 0.08, maxX: tx + 0.08, minZ: pz2 - 0.12, maxZ: pz2 + 0.12 });
    treeIdx++;
  }

  // ── streetlamps: sodium-vapor heads on bishop-crook poles. Dark cast iron
  //    by day; at dusk the lens warms up and an amber halo pools over the wet
  //    asphalt. Opacity is driven off the same night curve as the sky. ──────
  const nightLit: { mat: THREE.MeshBasicMaterial; base: number }[] = [];
  const lampGlowT = pixTex(32, 32, (g) => {
    const gr = g.createRadialGradient(16, 16, 1, 16, 16, 16);
    gr.addColorStop(0, 'rgba(255,198,120,0.90)');
    gr.addColorStop(0.5, 'rgba(255,178,96,0.30)');
    gr.addColorStop(1, 'rgba(255,178,96,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
  });
  const lampPoolT = pixTex(48, 48, (g) => {
    const gr = g.createRadialGradient(24, 24, 2, 24, 24, 24);
    gr.addColorStop(0, 'rgba(255,190,110,0.55)');
    gr.addColorStop(0.55, 'rgba(255,180,100,0.15)');
    gr.addColorStop(1, 'rgba(255,180,100,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 48, 48);
  });
  const poleM = new THREE.MeshBasicMaterial({ color: 0x24291f });   // dark cast iron
  const poleHi = new THREE.MeshBasicMaterial({ color: 0x323826 });
  const lensM = new THREE.MeshBasicMaterial({ color: 0x3a3324 });   // shared: dark glass by day, warms at night
  const lensDay = new THREE.Color(0x3a3324), lensLit = new THREE.Color(0xffcc82);
  const LAMP_H = 5.0;
  const makeLamp = (s: number, z: number) => {
    const bx = s * (ROAD_HALF + 0.55);          // just inside the kerb
    const reach = 1.25;                         // crook arm reaches over the road
    const headX = bx - s * reach;
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.5, 0.28), poleHi);
    base.position.set(bx, sidewalkY + 0.25, z); scene.add(base);
    const pole = new THREE.Mesh(new THREE.BoxGeometry(0.14, LAMP_H, 0.14), poleM);
    pole.position.set(bx, sidewalkY + LAMP_H / 2, z); scene.add(pole);
    // clean L crook: vertical pole + one horizontal arm (no diagonal strut) +
    // a lamp head that hangs DOWN off the arm's far end
    const arm = new THREE.Mesh(new THREE.BoxGeometry(reach, 0.12, 0.12), poleM);
    arm.position.set(bx - s * reach / 2, sidewalkY + LAMP_H - 0.05, z); scene.add(arm);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.26, 0.32), poleHi);
    head.position.set(headX, sidewalkY + LAMP_H - 0.16, z); scene.add(head);
    const lens = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.08, 0.24), lensM);
    lens.position.set(headX, sidewalkY + LAMP_H - 0.31, z); scene.add(lens);
    obstacle({ minX: bx - 0.2, maxX: bx + 0.2, minZ: z - 0.2, maxZ: z + 0.2 });
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.7),
      new THREE.MeshBasicMaterial({ map: lampGlowT, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.position.set(headX, sidewalkY + LAMP_H - 0.22, z);
    boards.push({ m: halo }); scene.add(halo);
    nightLit.push({ mat: halo.material as THREE.MeshBasicMaterial, base: 1.0 });
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4),
      new THREE.MeshBasicMaterial({ map: lampPoolT, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    pool.rotation.x = -Math.PI / 2; pool.position.set(headX, 0.02, z); scene.add(pool);
    nightLit.push({ mat: pool.material as THREE.MeshBasicMaterial, base: 0.85 });
  };
  // staggered down the block, kept clear of the tree pits (every 14 m at −2,−16…)
  [[-1, -9], [1, -23], [-1, -37], [1, -51], [-1, -65], [1, -79]].forEach(([s, z]) => makeLamp(s, z));
  // two more lighting the corner turn
  makeLamp(-1, -93);
  makeLamp(1, -93);

  // hydrant on the right sidewalk — hard against the kerb like the trees, with
  // a tight collider, so it doesn't block the building-side walking lane
  const hyX = ROAD_HALF + 0.35, hyZ = -6;
  const hyd = board(hydrantSprite(), 0.8, 1.2, hyX, hyZ);
  hyd.position.y = sidewalkY;
  obstacle({ minX: hyX - 0.18, maxX: hyX + 0.18, minZ: hyZ - 0.18, maxZ: hyZ + 0.18 });
  // pigeons peck along the kerb — most spook when you walk up; the odd bold
  // one holds its ground until you all but step on it
  interface Pigeon {
    m: THREE.Mesh; x: number; z: number; y: number;
    vx: number; vy: number; vz: number;
    state: 'peck' | 'fly'; bold: boolean; t: number; ph: number;
  }
  const pigeons: Pigeon[] = [];
  const pigeonT = pigeonSprite();
  for (let i = 0; i < 4; i++) {
    const x = -(ROAD_HALF + 0.5 + rnd() * 1.2), z = -20 - rnd() * 4;
    const b = board(pigeonT, 0.42, 0.42, x, z);
    pigeons.push({ m: b, x, z, y: 0, vx: 0, vy: 0, vz: 0, state: 'peck', bold: rnd() < 0.18, t: 0, ph: i * 2.4 });
  }
  // scattered cereal draws them in and holds them there
  const crumbT = pixTex(32, 32, (g) => {
    g.fillStyle = '#d9c9a0';
    for (let i = 0; i < 42; i++) g.fillRect(Math.floor(Math.random() * 30), Math.floor(Math.random() * 30), 2, 2);
  });
  const crumbMat = new THREE.MeshBasicMaterial({ map: crumbT, alphaTest: 0.5, side: THREE.DoubleSide });
  let crumbs: { x: number; z: number; y: number; t: number; m: THREE.Mesh } | null = null;

  // payphone against the left wall
  const phone = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.3, 0.9), flat(payphoneTex()));
  phone.position.set(-(FACE - 0.55), sidewalkY + 1.15, -11);
  scene.add(phone);
  obstacle({ minX: -(FACE - 0.05), maxX: -(FACE - 1.05), minZ: -11.55, maxZ: -10.45 });

  // weather: the rain comes and goes by the hour, and the ground
  // remembers it — every registered wet surface darkens as it comes in
  const updateRain = (dt: number, px: number, pz: number, hAbs: number) => {
    const wantRain = rainAt(hAbs) && px < 100 ? 1 : 0;
    rainLevel += (wantRain - rainLevel) * Math.min(1, dt * 0.6);
    if (px > 100) rainLevel = 0; // it NEVER rains indoors — cut, don't fade
    // the ground darkens + cools as it wets down (roads and walks)
    for (const w of wetMats) w.m.color.copy(w.base).lerp(WET, rainLevel * 0.8);
    rain.visible = rainLevel > 0.02;
    if (rain.visible) {
      rainM.opacity = 0.55 * rainLevel;
      // Rain belongs to the WORLD, not to the camera. The volume used to be
      // pinned to the player every frame (rain.position.set(px,0,pz)) with
      // fixed local x/z, so every drop translated exactly with you — a
      // personal rain cloud you could never walk out from under.
      //
      // Now drops live in world coordinates and only ever wrap by a WHOLE box
      // width when they fall outside the volume around you. Because the
      // distribution is uniform, a full-period jump is invisible — so you get
      // rain that stays put in the world while still covering wherever you are.
      const rp = rain.geometry.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < RAIN_N; i++) {
        let ry = rp.getY(i) - dt * 13;
        if (ry < 0) ry += 14;
        const rx = rp.getX(i), rz = rp.getZ(i);
        rp.setXYZ(i,
          rx - RAIN_BOX * Math.round((rx - px) / RAIN_BOX),
          ry,
          rz - RAIN_BOX * Math.round((rz - pz) / RAIN_BOX));
      }
      rp.needsUpdate = true;
    }
  };

  // pigeons: peck, chase scattered cereal, spook when approached
  const updatePigeons = (dt: number, t: number, px: number, pz: number) => {
    if (crumbs) {
      crumbs.t -= dt;
      if (crumbs.t <= 0) { scene.remove(crumbs.m); crumbs = null; }
    }
    for (const pg of pigeons) {
      if (pg.state === 'peck') {
        const cd = crumbs ? Math.hypot(crumbs.x - pg.x, crumbs.z - pg.z) : Infinity;
        if (crumbs && cd > 1.1 && cd < 9) { // cereal pulls them in
          const a = Math.atan2(crumbs.x - pg.x, crumbs.z - pg.z);
          pg.x += Math.sin(a) * 1.5 * dt; pg.z += Math.cos(a) * 1.5 * dt;
        }
        const d = Math.hypot(px - pg.x, pz - pg.z);
        const spookAt = cd < 1.4 ? 0.5 : pg.bold ? 0.7 : 3.5; // feeding birds let you get close
        if (d < spookAt) {
          pg.state = 'fly'; pg.t = 0;
          const a = Math.atan2(pg.x - px, pg.z - pz) + (rnd() - 0.5) * 0.8;
          pg.vx = Math.sin(a) * 3.2; pg.vz = Math.cos(a) * 3.2; pg.vy = 2.6;
        }
        const pgy = Math.abs(pg.x) > ROAD_HALF && Math.abs(pg.x) < FACE + 0.3 ? KERB_H : 0;
        pg.m.position.set(pg.x, pgy + Math.max(0, Math.sin(t * 6 + pg.ph)) * 0.06, pg.z);
      } else {
        pg.t += dt;
        pg.x += pg.vx * dt; pg.z += pg.vz * dt;
        pg.vy = Math.min(pg.vy + dt * 1.5, 3.4);
        pg.y += pg.vy * dt;
        if (Math.abs(pg.x) > FACE - 0.6) { pg.x = Math.sign(pg.x) * (FACE - 0.6); pg.vx = 0; } // climb the wall, don't pass it
        pg.m.position.set(pg.x, sidewalkY + pg.y + Math.sin(t * 24) * 0.05, pg.z);
        if (pg.t > 4) {
          // settle somewhere new down the block, away from the player
          pg.state = 'peck'; pg.y = 0; pg.bold = rnd() < 0.18;
          pg.x = (rnd() < 0.5 ? -1 : 1) * (ROAD_HALF + 0.4 + rnd() * 1.4);
          pg.z = -8 - rnd() * (L - 20);
          if (Math.hypot(px - pg.x, pz - pg.z) < 8) {
            pg.z = Math.max(-L + 6, Math.min(2, pz > -L / 2 ? pz - 25 : pz + 25));
          }
        }
      }
    }
  };


  // ── litter, in the gutter where it actually collects ────────────────────
  // Placed LAST on purpose: rnd() is a shared seeded stream and the trees and
  // pigeons above draw from it, so anything new has to come after them or it
  // shifts the whole world. Kept deliberately sparse — the note was "just
  // trying to add detail and realism. dont go over board." Nothing here is
  // solid; you walk straight over it.
  const flatDecal = (tex: THREE.Texture, w: number, d: number, x: number, z: number, rot: number, y: number) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d),
      new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5, transparent: true }));
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = rot;
    m.position.set(x, y + 0.004, z);
    scene.add(m);
    return m;
  };
  const npT = newspaperTex();
  const scrapT = [scrapTex(0), scrapTex(1), scrapTex(2)];
  // the gutter line: just off the kerb face, on the road side
  const GUT = ROAD_HALF - 0.22;
  for (let i = 0; i < 7; i++) {
    const s2 = rnd() < 0.5 ? -1 : 1;
    const z = -6 - rnd() * (L - 18);
    const x = s2 * (GUT - rnd() * 0.30);
    if (rnd() < 0.42) {
      flatDecal(canTopTex(i), 0.32, 0.19, x, z, rnd() * Math.PI, 0.001);
    } else {
      flatDecal(scrapT[i % 3], 0.26, 0.22, x, z, rnd() * Math.PI, 0.001);
    }
  }
  // two soaked newspapers, flat against the road
  for (let i = 0; i < 2; i++) {
    const s2 = i === 0 ? 1 : -1;
    flatDecal(npT, 0.44, 0.32, s2 * (GUT - 0.10), -20 - i * 37, rnd() * Math.PI, 0.001);
  }
  // one can up on the sidewalk, against the kerb
  flatDecal(canTopTex(3), 0.32, 0.19, ROAD_HALF + 0.22, -47.5, 0.7, sidewalkY);

  return {
    setLampNight: (v) => {
      for (const g of nightLit) g.mat.opacity = g.base * v;
      lensM.color.copy(lensDay).lerp(lensLit, v);
    },
    rainSky: (c) => { if (rainLevel > 0.01) c.lerp(RAIN_SKY, rainLevel * 0.5); },
    scatter: (x, z, y) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.6), crumbMat);
      m.rotation.x = -Math.PI / 2;
      m.rotation.z = rnd() * Math.PI;
      m.position.set(x, y + 0.012, z);
      scene.add(m);
      if (crumbs) scene.remove(crumbs.m);
      crumbs = { x, z, y, t: 35, m };
    },
    updateRain,
    updatePigeons,
  };
}
