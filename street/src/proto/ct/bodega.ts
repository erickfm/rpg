import * as THREE from 'three';
import type { AABB } from '../fp';
import type { CtxBuild } from './ctx';
import { pixTex, dither } from './paint';

// The bodega interior — one bright little room off the corner. Self-contained:
// it only adds meshes to the scene and hands back its wall colliders.
export function buildBodega(ctx: CtxBuild): AABB[] {
  const { scene, player } = ctx;
  // The two door spots live HERE now, with the door they belong to, instead of
  // being hand-written into the entry point's SPOTS array. Same move C, F and H
  // already made — the shop that owns a door owns its [E].
  //
  // NOT moved: the cereal and soda counters. They need `purse` and
  // `hud.refreshWallet()`, and `ctx` carries neither; adding them changes the
  // CtxBuild interface, which is a desk operation across every caller. They are
  // still in crosstown.ts and flagged in notes/BLOCKED-D.md.
  ctx.spot({
    x: 8.7, z: -96.85, r: 1.1,
    ok: () => player.x() < 100,
    label: () => 'into the BODEGA',
    act: () => player.jumpTo(241.3, -17, Math.PI / 2, 0),
  });
  ctx.spot({
    x: 240.5, z: -17, r: 1.0,
    ok: () => player.x() > 230,
    label: () => 'out to the street',
    // step out onto the north side-street walk, facing OUT across the street —
    // clear of the corner wall and the fruit crates, and well outside the
    // re-enter trigger radius so you cannot be sucked straight back in
    act: () => player.jumpTo(11, -97.3, 0, ctx.KERB_H),
  });
  const bodegaColliders: AABB[] = [];
  {
    const texM2 = (t: THREE.Texture) => new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide });
    const linoT = pixTex(32, 32, (g) => {
      for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
        g.fillStyle = (x + y) % 2 ? '#8a8578' : '#b0a996';
        g.fillRect(x * 16, y * 16, 16, 16);
      }
      dither(g, 32, 32, 50);
    });
    linoT.wrapS = linoT.wrapT = THREE.RepeatWrapping;
    linoT.repeat.set(6, 6);
    const bfloor = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), texM2(linoT));
    bfloor.rotation.x = -Math.PI / 2;
    bfloor.position.set(244, 0.005, -15);
    scene.add(bfloor);
    const plasterT = pixTex(32, 54, (g) => {
      g.fillStyle = '#9aa88e'; g.fillRect(0, 0, 32, 54);
      g.fillStyle = 'rgba(0,0,0,0.15)'; g.fillRect(0, 46, 32, 8); // scuffed base
      dither(g, 32, 54, 60);
    });
    const bWall = (w: number, cx: number, cz: number, ry: number) => {
      const t = plasterT.clone();
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(w / 2.7, 1);
      t.needsUpdate = true;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 2.7), texM2(t));
      m.position.set(cx, 1.35, cz);
      m.rotation.y = ry;
      scene.add(m);
    };
    bWall(8, 244, -19, 0);
    bWall(8, 244, -11, Math.PI);
    bWall(8, 240, -15, Math.PI / 2);
    bWall(8, 248, -15, -Math.PI / 2);
    const bCeil = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.MeshBasicMaterial({ color: 0xb0aa9c, side: THREE.DoubleSide }));
    bCeil.rotation.x = -Math.PI / 2;
    bCeil.position.set(244, 2.7, -15);
    scene.add(bCeil);
    // interior door back to the street, on the west wall
    const bDoorT = pixTex(32, 64, (g) => {
      g.fillStyle = '#3a2c22'; g.fillRect(0, 0, 32, 64);
      g.fillStyle = '#8a97a2'; g.fillRect(4, 4, 24, 40); // daylight in the glass
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(4, 24, 24, 2);
      g.fillStyle = '#c9b45e'; g.fillRect(25, 34, 3, 3);
    });
    const bDoor = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 2.1), texM2(bDoorT));
    bDoor.position.set(240.02, 1.05, -17);
    bDoor.rotation.y = Math.PI / 2;
    scene.add(bDoor);
    // stocked shelves — two gondolas up the middle
    const shelfT = pixTex(64, 32, (g) => {
      g.fillStyle = '#5a4632'; g.fillRect(0, 0, 64, 32);
      const cols = ['#b8342a', '#d8a02a', '#2c6a8a', '#4a7a3a', '#d8d0c0', '#8a3a6a'];
      for (const sy of [2, 13, 24]) {
        g.fillStyle = '#3a2c20'; g.fillRect(0, sy + 8, 64, 2);
        for (let x = 2; x < 62; x += 5) {
          g.fillStyle = cols[(x / 5 + sy) % 6 | 0];
          g.fillRect(x, sy, 4, 8);
        }
      }
      dither(g, 64, 32, 40);
    });
    const shelfM = texM2(shelfT);
    const shelfEndM = new THREE.MeshBasicMaterial({ color: 0x4a3826 });
    for (const gz of [-16.2, -13.9]) {
      const gond = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.35, 0.8), [shelfEndM, shelfEndM, shelfEndM, shelfEndM, shelfM, shelfM]);
      gond.position.set(243.6, 0.675, gz);
      scene.add(gond);
      bodegaColliders.push({ minX: 242, maxX: 245.2, minZ: gz - 0.4, maxZ: gz + 0.4 });
    }
    // the cooler hums along the east wall
    const coolerT = pixTex(96, 48, (g) => {
      g.fillStyle = '#d8d4c8'; g.fillRect(0, 0, 96, 48);
      for (let d = 0; d < 3; d++) {
        const x = 4 + d * 30;
        g.fillStyle = '#16242e'; g.fillRect(x, 4, 26, 40);
        g.fillStyle = 'rgba(160,200,220,0.25)'; g.fillRect(x + 2, 6, 8, 36);
        for (let r = 0; r < 3; r++) for (let b = 0; b < 4; b++) {
          g.fillStyle = ['#b8342a', '#2c6a8a', '#d8a02a', '#4a7a3a'][(r + b + d) % 4];
          g.fillRect(x + 3 + b * 6, 12 + r * 10, 4, 7);
        }
      }
      dither(g, 96, 48, 30);
    });
    const cooler = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 2.0, 5),
      [new THREE.MeshBasicMaterial({ color: 0xd8d4c8 }), texM2(coolerT), new THREE.MeshBasicMaterial({ color: 0xb8b4a8 }), shelfEndM, shelfEndM, shelfEndM],
    );
    cooler.position.set(247.6, 1.0, -14.6);
    scene.add(cooler);
    bodegaColliders.push({ minX: 247.2, maxX: 248, minZ: -17.2, maxZ: -12 });
    // counter, register, and the man himself
    const counterT = pixTex(64, 24, (g) => {
      g.fillStyle = '#6a5038'; g.fillRect(0, 0, 64, 24);
      g.fillStyle = 'rgba(0,0,0,0.2)';
      for (let y = 6; y < 24; y += 8) g.fillRect(0, y, 64, 1);
      g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(0, 0, 64, 2);
    });
    const counter = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.95, 0.7), [shelfEndM, shelfEndM, texM2(counterT), shelfEndM, texM2(counterT), shelfEndM]);
    counter.position.set(242.2, 0.475, -18.15);
    scene.add(counter);
    bodegaColliders.push({ minX: 240.9, maxX: 243.5, minZ: -18.5, maxZ: -17.8 });
    const reg = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.32, 0.35), new THREE.MeshBasicMaterial({ color: 0x2a2c32 }));
    reg.position.set(242.9, 1.11, -18.2);
    scene.add(reg);
    const keeperT = pixTex(40, 64, (g) => {
      g.fillStyle = '#4a4a52'; g.fillRect(10, 44, 8, 18); g.fillRect(22, 44, 8, 18); // slacks
      g.fillStyle = '#8a95a0'; g.fillRect(8, 22, 24, 24);                            // shirt
      g.fillStyle = '#d8d4c8'; g.fillRect(12, 26, 16, 20);                           // apron
      g.fillStyle = 'rgba(0,0,0,0.15)'; g.fillRect(12, 26, 16, 2);
      g.fillStyle = '#c9946a'; g.fillRect(3, 24, 5, 13); g.fillRect(32, 24, 5, 13);  // arms
      g.fillStyle = '#b8845a'; g.fillRect(14, 8, 12, 13);                            // head
      g.fillStyle = '#241a12'; g.fillRect(13, 6, 14, 4);                             // hair
      g.fillStyle = '#241a12'; g.fillRect(16, 13, 2, 2); g.fillRect(22, 13, 2, 2);   // eyes
      g.fillStyle = '#3a2c20'; g.fillRect(15, 17, 10, 2);                            // moustache
      dither(g, 40, 64, 20);
    });
    const keeper = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.92), new THREE.MeshBasicMaterial({ map: keeperT, alphaTest: 0.5, side: THREE.DoubleSide }));
    keeper.position.set(242.2, 0.96, -18.68);
    scene.add(keeper);
    bodegaColliders.push(
      { minX: 239.8, maxX: 240, minZ: -19.2, maxZ: -10.8 },
      { minX: 248, maxX: 248.2, minZ: -19.2, maxZ: -10.8 },
      { minX: 239.8, maxX: 248.2, minZ: -19.2, maxZ: -19 },
      { minX: 239.8, maxX: 248.2, minZ: -11, maxZ: -10.8 },
    );
    // warm bulb glow over the aisle
    const bulbT = pixTex(32, 32, (g) => {
      const gr = g.createRadialGradient(16, 16, 2, 16, 16, 15);
      gr.addColorStop(0, 'rgba(255,235,190,0.8)');
      gr.addColorStop(1, 'rgba(255,235,190,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
    });
    const bulbM = new THREE.MeshBasicMaterial({ map: bulbT, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    for (const gz of [-17.5, -13.5]) {
      const gl = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.0), bulbM);
      gl.position.set(244, 2.45, gz);
      gl.rotation.x = Math.PI / 2;
      scene.add(gl);
    }
  }
  return bodegaColliders;
}
