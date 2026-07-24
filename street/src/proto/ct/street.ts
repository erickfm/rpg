import * as THREE from 'three';
import { pixTex, dither } from './paint';
import { facadeTex, shopfrontTex, resGroundTex } from './tex-world';
import { L, ROAD_HALF, WALK, FACE } from './rng';

// Every building on the block, hand-authored end to end, plus the alley
// cut into the west wall. Adds meshes + billboard sprites; owns no state.
export function buildStreet(o: {
  scene: THREE.Scene;
  flat: (m: THREE.Texture) => THREE.MeshBasicMaterial;
  wet: (m: THREE.MeshBasicMaterial) => THREE.MeshBasicMaterial;
  sidewalkY: number; KERB_H: number;
  boards: { m: THREE.Mesh }[];
  AZ0: number; AZ1: number;
  SIDE_X1: number; SIDE_Z0: number; SIDE_Z1: number;
}) {
  const { scene, flat, wet, sidewalkY, KERB_H, boards, AZ0, AZ1, SIDE_X1, SIDE_Z0, SIDE_Z1 } = o;
  interface BldSpec { nm: string; col: string; w: number; brick: string; floors: number; res?: boolean }
  const WEST: (BldSpec | 'alley')[] = [
    { nm: 'DINER', col: '#8a5a22', w: 12, brick: '#6b4034', floors: 4 },
    { nm: 'LAUNDRY', col: '#2c4a7a', w: 11, brick: '#7a4a3a', floors: 3 },
    { nm: 'PIZZA', col: '#2e6a34', w: 10.2, brick: '#5c4436', floors: 4 },
    { nm: 'PAWN', col: '#8a6a22', w: 18, brick: '#835444', floors: 5 },
    'alley',
    { nm: 'MUSIC', col: '#6a2c6a', w: 12.5, brick: '#6b4034', floors: 4 },
    { nm: 'BARBER', col: '#8a2c22', w: 12, brick: '#5c4436', floors: 4 },
    { nm: 'GROCERY', col: '#2e5a3c', w: 18, brick: '#835444', floors: 5 },
    { nm: 'HOTEL', col: '#6a4a2c', w: 12, brick: '#7a4a3a', floors: 5 },
  ];
  const EAST: BldSpec[] = [
    { nm: 'BOOKS', col: '#3a5a5a', w: 13, brick: '#5c4436', floors: 4 },
    { nm: 'HARDWARE', col: '#5a5a2c', w: 12.2, brick: '#6b4034', floors: 3 },
    { nm: 'CAFE', col: '#6a3a22', w: 11, brick: '#835444', floors: 4 },
    { nm: 'ARCADE', col: '#3a2c6a', w: 13, brick: '#7a4a3a', floors: 5 },
    { nm: '', col: '', w: 18, brick: '#835444', floors: 5, res: true }, // No. 227 — home, across from the alley, a bit off
    { nm: 'LIQUOR', col: '#8a2c42', w: 11, brick: '#5c4436', floors: 3 },
    { nm: 'DELI', col: '#2e6a5a', w: 10, brick: '#6b4034', floors: 3 },
    { nm: 'CINEMA', col: '#2c3c7a', w: 12, brick: '#7a4a3a', floors: 5 },
    { nm: 'BODEGA', col: '#b8342a', w: 10, brick: '#6b4034', floors: 3 }, // the corner store
  ];
  // the corner: shops lining the side street the main drag turns into
  const NORTH2: BldSpec[] = [
    { nm: 'FLOWERS', col: '#4a7a52', w: 12, brick: '#835444', floors: 3 },
    { nm: 'TAILOR', col: '#5a4a7a', w: 11, brick: '#5c4436', floors: 4 },
    { nm: 'CHOP SUEY', col: '#8a3a2e', w: 13, brick: '#6b4034', floors: 3 },
    { nm: 'OPTICIAN', col: '#2c5a6a', w: 12, brick: '#7a4a3a', floors: 4 },
  ];
  const SOUTH2: BldSpec[] = [
    { nm: 'GARAGE', col: '#5a5f66', w: 13, brick: '#5c4436', floors: 3 },
    { nm: 'THRIFT', col: '#7a5a2c', w: 12, brick: '#835444', floors: 4 },
    { nm: 'MISSION', col: '#6a5a4a', w: 14, brick: '#6b4034', floors: 3 },
    { nm: 'BILLIARDS', col: '#2c5a3a', w: 13, brick: '#7a4a3a', floors: 4 },
    { nm: 'SMOKES', col: '#8a6a22', w: 12, brick: '#5c4436', floors: 3 },
  ];
  const placeBld = (side: number, z: number, b: BldSpec) => {
    const cz = z - b.w / 2;
    const h = 3.4 + b.floors * 2.4;
    const facade = flat(facadeTex(b.brick, b.floors, b.w));
    const endM = new THREE.MeshBasicMaterial({ color: 0x53382e });
    const roofM = new THREE.MeshBasicMaterial({ color: 0x2b2d33 });
    const mats = side < 0
      ? [facade, endM, roofM, roofM, endM, endM]
      : [endM, facade, roofM, roofM, endM, endM];
    const wall = new THREE.Mesh(new THREE.BoxGeometry(3.4, h, b.w + 0.05), mats);
    wall.position.set(side * (FACE + 1.7), h / 2 + 3.2, cz);
    scene.add(wall);
    const shopM = flat(b.res ? resGroundTex(b.brick, b.w) : shopfrontTex(b.brick, b.nm, b.col, b.w));
    const shopMats = side < 0
      ? [shopM, endM, roofM, roofM, endM, endM]
      : [endM, shopM, roofM, roofM, endM, endM];
    const shop = new THREE.Mesh(new THREE.BoxGeometry(3.4, 3.2, b.w + 0.05), shopMats);
    shop.position.set(side * (FACE + 1.7), 1.6, cz);
    scene.add(shop);
  };
  let zw = 14.2;
  for (const b of WEST) {
    if (b === 'alley') { zw = AZ1; continue; }
    placeBld(-1, zw, b);
    zw -= b.w;
  }
  let ze = 14.2;
  for (const b of EAST) { placeBld(1, ze, b); ze -= b.w; }
  // side-street rosters run along x; facade on the street-facing z side
  const placeBldZ = (x0: number, zc: number, b: BldSpec, facing: 1 | -1) => {
    const cx = x0 + b.w / 2;
    const h = 3.4 + b.floors * 2.4;
    const facade = flat(facadeTex(b.brick, b.floors, b.w));
    const endM = new THREE.MeshBasicMaterial({ color: 0x53382e });
    const roofM = new THREE.MeshBasicMaterial({ color: 0x2b2d33 });
    const mats = facing > 0
      ? [endM, endM, roofM, roofM, facade, endM]
      : [endM, endM, roofM, roofM, endM, facade];
    const wall = new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.05, h, 3.4), mats);
    wall.position.set(cx, h / 2 + 3.2, zc);
    scene.add(wall);
    const shopM = flat(shopfrontTex(b.brick, b.nm, b.col, b.w));
    const shopMats = facing > 0
      ? [endM, endM, roofM, roofM, shopM, endM]
      : [endM, endM, roofM, roofM, endM, shopM];
    const shop = new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.05, 3.2, 3.4), shopMats);
    shop.position.set(cx, 1.6, zc);
    scene.add(shop);
  };
  let xn = 10.45; // east of the bodega — the corner belongs to it
  for (const b of NORTH2) { placeBldZ(xn, -94.3, b, -1); xn += b.w; }
  let xs = -7;
  for (const b of SOUTH2) { placeBldZ(xs, -111.7, b, 1); xs += b.w; }
  // the bodega wraps the corner: second shopfront on its side-street face,
  // striped awning, neon OPEN, fruit crates out front
  {
    const bodegaSouthM = flat(shopfrontTex('#6b4034', 'BODEGA', '#b8342a', 3.4));
    const southFront = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.2), bodegaSouthM);
    southFront.position.set(FACE + 1.7, 1.6, -96.1);
    southFront.rotation.y = Math.PI;
    scene.add(southFront);
    // brick + windows continue on the side-street face above the shop
    const southUp = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 10.6), flat(facadeTex('#6b4034', 3, 3.4)));
    southUp.position.set(FACE + 1.7, 3.2 + 5.3, -96.1);
    southUp.rotation.y = Math.PI;
    scene.add(southUp);
    const awnT = pixTex(48, 12, (g) => {
      for (let x = 0; x < 48; x += 8) {
        g.fillStyle = (x / 8) % 2 ? '#b8342a' : '#d8d0c0';
        g.fillRect(x, 0, 8, 12);
      }
      g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(0, 9, 48, 3);
    });
    const awnM = new THREE.MeshBasicMaterial({ map: awnT, side: THREE.DoubleSide });
    const awn = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.1, 0.9), awnM);
    awn.position.set(FACE + 1.7, 2.62, -96.45);
    awn.rotation.x = 0.18;
    scene.add(awn);
    const openT = pixTex(24, 12, (g) => {
      g.fillStyle = '#141416'; g.fillRect(0, 0, 24, 12);
      g.fillStyle = '#e8574a'; g.font = 'bold 7px monospace'; g.textAlign = 'center';
      g.fillText('OPEN', 12, 9);
    });
    const open = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.35), flat(openT));
    open.position.set(FACE + 0.6, 2.0, -96.14);
    open.rotation.y = Math.PI;
    scene.add(open);
    const crateT = pixTex(24, 16, (g) => {
      g.fillStyle = '#8a6a3a'; g.fillRect(0, 0, 24, 16);
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 5, 24, 1); g.fillRect(0, 11, 24, 1);
    });
    const fruitTop = (c1: string, c2: string) => pixTex(24, 24, (g) => {
      g.fillStyle = '#6a4a26'; g.fillRect(0, 0, 24, 24);
      for (let i = 0; i < 24; i++) {
        g.fillStyle = i % 2 ? c1 : c2;
        g.beginPath(); g.arc(3 + (i % 6) * 4, 4 + Math.floor(i / 6) * 5, 2, 0, Math.PI * 2); g.fill();
      }
    });
    const crateM = flat(crateT);
    for (const [cxx, czz, top] of [
      [7.9, -96.6, fruitTop('#d88a2a', '#c9762a')],
      [9.3, -96.55, fruitTop('#8a3a2e', '#a84a36')],
    ] as [number, number, THREE.Texture][]) {
      const crate = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.4, 0.55), [crateM, crateM, flat(top), crateM, crateM, crateM]);
      crate.position.set(cxx, sidewalkY + 0.2, czz);
      scene.add(crate);
    }
  }
  // south-west corner building closes the side street's west end
  placeBld(-1, -98, { nm: 'RADIO', col: '#3a4a7a', w: 12, brick: '#835444', floors: 4 });
  // east cross building — the side street disappears into the fog toward it
  {
    const eEnd = new THREE.MeshBasicMaterial({ color: 0x53382e });
    const eRoof = new THREE.MeshBasicMaterial({ color: 0x2b2d33 });
    const eWall = new THREE.Mesh(
      new THREE.BoxGeometry(6, 13.6, 24),
      [eEnd, flat(facadeTex('#5c4436', 4, 22)), eRoof, eRoof, eEnd, eEnd],
    );
    eWall.position.set(SIDE_X1 + 5, 6.8, (SIDE_Z0 + SIDE_Z1) / 2);
    scene.add(eWall);
  }

  // billboard registry (declared early — the alley adds to it too)
  interface Board { m: THREE.Mesh }

  // cross building closing the north end; the south end turns the corner now
  {
    const facade = flat(facadeTex('#5c4436', 4, 30));
    const endM = new THREE.MeshBasicMaterial({ color: 0x53382e });
    const roofM = new THREE.MeshBasicMaterial({ color: 0x2b2d33 });
    const wall = new THREE.Mesh(new THREE.BoxGeometry(30, 13.6, 6), [endM, endM, roofM, roofM, endM, facade]);
    wall.position.set(0, 6.8, 16.5);
    scene.add(wall);
  }

  // ── the alley: a dark cut in the left wall with a dumpster ──────────────
  {
    const alleyFloorT = pixTex(64, 64, (g) => {
      g.fillStyle = '#2e3034'; g.fillRect(0, 0, 64, 64);
      dither(g, 64, 64, 700);
      // stains + a drain
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.beginPath(); g.ellipse(20, 40, 12, 6, 0.5, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(46, 14, 8, 5, -0.3, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#17181c'; g.fillRect(30, 28, 8, 8);
      g.fillStyle = 'rgba(255,255,255,0.12)';
      g.fillRect(30, 31, 8, 1); g.fillRect(30, 34, 8, 1);
    });
    const floorA = new THREE.Mesh(new THREE.PlaneGeometry(6.6, AZ0 - AZ1), new THREE.MeshBasicMaterial({ map: alleyFloorT }));
    floorA.rotation.x = -Math.PI / 2;
    floorA.position.set(-FACE - 3.3, 0.005, (AZ0 + AZ1) / 2);
    scene.add(floorA);
    // bare-brick end wall (no shop, one grimy window) — same brick course
    // density as the street facades (~11.7 px/m, 5 px courses)
    const bareBrickT = pixTex(80, 150, (g) => {
      g.fillStyle = '#5a3a30'; g.fillRect(0, 0, 80, 150);
      g.fillStyle = 'rgba(0,0,0,0.22)';
      for (let y = 0; y < 150; y += 5) g.fillRect(0, y, 80, 1);
      for (let y = 0; y < 150; y += 10) for (let x = (y % 20) ? 0 : 4; x < 80; x += 9) g.fillRect(x, y, 1, 5);
      g.fillStyle = '#1a1c22'; g.fillRect(30, 35, 20, 28);
      g.fillStyle = '#3a4450'; g.fillRect(32, 37, 16, 24);
      g.fillStyle = 'rgba(0,0,0,0.3)';
      for (let k = 0; k < 4; k++) g.fillRect(Math.floor(Math.random() * 76), 0, 2, Math.floor(150 * Math.random()));
      dither(g, 80, 150, 700);
    });
    const endWallM = new THREE.MeshBasicMaterial({ color: 0x3d2a24 });
    const alleyEnd = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 12.8, 7),
      [new THREE.MeshBasicMaterial({ map: bareBrickT }), endWallM, endWallM, endWallM, endWallM, endWallM],
    );
    alleyEnd.position.set(-FACE - 6.9, 6.4, (AZ0 + AZ1) / 2);
    scene.add(alleyEnd);
    // the alley's long sides — plain brick. The tile is exactly 7 bricks ×
    // 12 courses so it wraps with no seam, and no baked edge highlights.
    const alleySideT = pixTex(63, 60, (g) => {
      g.fillStyle = '#54382e'; g.fillRect(0, 0, 63, 60);
      g.fillStyle = 'rgba(0,0,0,0.22)';
      for (let y = 0; y < 60; y += 5) g.fillRect(0, y, 63, 1);
      for (let y = 0; y < 60; y += 10) for (let x = (y % 20) ? 0 : 4; x < 63; x += 9) g.fillRect(x, y, 1, 5);
      g.fillStyle = 'rgba(255,255,255,0.05)';
      for (let i = 0; i < 26; i++) g.fillRect(((i * 23) % 61), ((i * 13) % 57), 2, 1); // worn faces
    });
    alleySideT.wrapS = alleySideT.wrapT = THREE.RepeatWrapping;
    alleySideT.repeat.set(1.3, 2.36); // ≈ facade brick course size
    const alleySideM = new THREE.MeshBasicMaterial({ map: alleySideT, side: THREE.DoubleSide });
    for (const [az, ry] of [[AZ0 - 0.02, Math.PI], [AZ1 + 0.02, 0]] as [number, number][]) {
      const sideWall = new THREE.Mesh(new THREE.PlaneGeometry(7.0, 12.8), alleySideM);
      sideWall.position.set(-FACE - 3.5, 6.4, az);
      sideWall.rotation.y = ry;
      scene.add(sideWall);
    }
    // the dumpster: ribbed tub with fork pockets, stencil on the long faces
    // only, lid hinged on the wall side and propped open onto the wall
    const dumpFrontT = pixTex(96, 48, (g) => {
      g.fillStyle = '#2e5a3c'; g.fillRect(0, 0, 96, 48);
      g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(0, 0, 96, 3);            // top lip
      g.fillStyle = 'rgba(0,0,0,0.3)';
      for (let x = 6; x < 96; x += 12) g.fillRect(x, 3, 2, 41);                   // ribs
      g.fillStyle = '#14161a'; g.fillRect(8, 38, 24, 7); g.fillRect(64, 38, 24, 7); // fork pockets
      g.fillStyle = 'rgba(122,66,40,0.55)';
      g.fillRect(38, 36, 16, 10); g.fillRect(82, 16, 12, 14);                     // rust
      g.fillStyle = '#c9c4b0'; g.font = 'bold 9px monospace';
      g.textAlign = 'center'; g.fillText('CITY WASTE', 48, 20);
      dither(g, 96, 48, 160);
    });
    const dumpSideT = pixTex(48, 48, (g) => {
      g.fillStyle = '#2e5a3c'; g.fillRect(0, 0, 48, 48);
      g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(0, 0, 48, 3);
      g.fillStyle = 'rgba(0,0,0,0.3)';
      for (let x = 5; x < 48; x += 12) g.fillRect(x, 3, 2, 41);
      g.fillStyle = 'rgba(122,66,40,0.5)'; g.fillRect(10, 34, 14, 12);
      dither(g, 48, 48, 90);
    });
    const dumpFrontM = new THREE.MeshBasicMaterial({ map: dumpFrontT });
    const dumpSideM = new THREE.MeshBasicMaterial({ map: dumpSideT });
    const dumpInsideM = new THREE.MeshBasicMaterial({ color: 0x101114 });
    const dump = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 1.1, 1.05),
      [dumpSideM, dumpSideM, dumpInsideM, dumpInsideM, dumpFrontM, dumpFrontM],
    );
    dump.position.set(-11.2, 0.69, AZ0 - 1.15);
    scene.add(dump);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(2.44, 0.06, 1.12), new THREE.MeshBasicMaterial({ color: 0x24482f }));
    lid.geometry.translate(0, 0.03, -0.56); // pivot runs along its hinge edge
    lid.position.set(-11.2, 1.24, AZ0 - 0.625);
    lid.rotation.x = 0.5;
    scene.add(lid);
    for (const [wx, wz] of [[-12.15, AZ0 - 0.78], [-10.25, AZ0 - 0.78], [-12.15, AZ0 - 1.52], [-10.25, AZ0 - 1.52]]) {
      const wheel = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.18, 0.14), new THREE.MeshBasicMaterial({ color: 0x0e0f12 }));
      wheel.position.set(wx, 0.09, wz);
      scene.add(wheel);
    }
    // trash bags: faceted low-poly lumps, vertex-lit from above so the
    // facets read even in flat shading
    // trash bags: chunky low-segment lumps wearing a PAINTED plastic
    // texture — dithered wrinkle sheens, dark base — same brush as the
    // rest of the world
    const bagT = pixTex(48, 32, (g) => {
      g.fillStyle = '#1e2026'; g.fillRect(0, 0, 48, 32);
      g.fillStyle = 'rgba(255,255,255,0.10)';
      for (let i = 0; i < 7; i++) {
        g.fillRect((i * 11) % 30, 3 + i * 4 + (i % 3), 14 + ((i * 5) % 12), 1); // wrinkles
      }
      g.fillStyle = 'rgba(255,255,255,0.16)'; g.fillRect(6, 1, 22, 2); // sky sheen up top
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, 26, 48, 6);      // sitting shadow
      dither(g, 48, 32, 70);
    });
    const bagM = new THREE.MeshBasicMaterial({ map: bagT });
    function trashBag(r: number): THREE.Mesh {
      const bag = new THREE.Mesh(new THREE.SphereGeometry(r, 7, 4), bagM);
      bag.scale.y = 0.62;
      return bag;
    }
    const bagSpots: [number, number, number, number][] = [
      [-9.45, AZ0 - 1.25, 0.34, 0.7],
      [-8.85, AZ0 - 1.0, 0.27, 2.1],
      [-9.15, AZ0 - 0.62, 0.22, 4.0],
    ];
    for (const [bx, bz, r, yaw] of bagSpots) {
      const bag = trashBag(r);
      bag.position.set(bx, r * 0.55, bz);
      bag.rotation.y = yaw;
      scene.add(bag);
    }
    // knot on the biggest bag, and one more bag heaped over the dumpster rim
    const knot = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.1, 0.07), new THREE.MeshBasicMaterial({ color: 0x2e3038 }));
    knot.position.set(-9.45, 0.44, AZ0 - 1.25);
    scene.add(knot);
    const rimBag = trashBag(0.3);
    rimBag.position.set(-10.55, 1.18, AZ0 - 1.15);
    scene.add(rimBag);
    // the saddest cat on the block, in a cardboard box
    const cardM = new THREE.MeshBasicMaterial({ color: 0xa8845a });
    const cardDark = new THREE.MeshBasicMaterial({ color: 0x8a6a44 });
    const catBox = new THREE.Group();
    const bfloor = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.04, 0.55), cardDark);
    bfloor.position.y = 0.02;
    catBox.add(bfloor);
    for (const [wx2, wz2, ww, wd] of [[0, -0.26, 0.55, 0.04], [0, 0.26, 0.55, 0.04], [-0.26, 0, 0.04, 0.55], [0.26, 0, 0.04, 0.55]] as [number, number, number, number][]) {
      const wallB = new THREE.Mesh(new THREE.BoxGeometry(ww, 0.3, wd), cardM);
      wallB.position.set(wx2, 0.17, wz2);
      catBox.add(wallB);
    }
    const flap = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.03, 0.28), cardM);
    flap.position.set(0, 0.33, -0.38);
    flap.rotation.x = -0.5; // one flap hangs open
    catBox.add(flap);
    catBox.position.set(-10.5, 0, AZ1 + 0.75);
    catBox.rotation.y = 0.4;
    scene.add(catBox);
    const catT = pixTex(24, 24, (g) => {
      g.fillStyle = '#7a7e86';
      g.fillRect(7, 10, 10, 10);                     // hunched body
      g.fillRect(8, 4, 8, 8);                        // head
      g.fillStyle = '#6a6e76';
      g.fillRect(7, 3, 3, 3); g.fillRect(14, 3, 3, 3); // ears, drooped
      g.fillStyle = '#141416';
      g.fillRect(9, 8, 2, 3); g.fillRect(13, 8, 2, 3); // big sad eyes
      g.fillStyle = '#4a4e56'; g.fillRect(11, 11, 2, 1); // little nose
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(8, 12, 8, 1); // downturned mouth
      g.fillStyle = '#6a6e76'; g.fillRect(6, 18, 12, 2); // tail curled round
    });
    const cat = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34), new THREE.MeshBasicMaterial({ map: catT, alphaTest: 0.5, side: THREE.DoubleSide }));
    cat.geometry.translate(0, 0.17, 0);
    cat.position.set(-10.5, 0.05, AZ1 + 0.75);
    boards.push({ m: cat });
    scene.add(cat);
    // plywood sheet leaning back against the south wall, feet kicked out
    const cardboard = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.3, 0.06), new THREE.MeshBasicMaterial({ color: 0x8a7248 }));
    cardboard.position.set(-12.9, 0.6, AZ1 + 0.26);
    cardboard.rotation.x = -0.35;
    scene.add(cardboard);
    // LA graffiti — cholo placa lineage (Bojórquez/Prime, not East-Coast
    // bubbles): ALL CAPS square block letters stood shoulder to shoulder,
    // upright, ONE color, hard underline. Hand-built 5×7 glyphs so the
    // strokes are square, not font curves.
    const PLACA: Record<string, [number, number, number, number][]> = {
      R: [[0, 0, 1, 7], [0, 0, 4, 1], [4, 1, 1, 2], [0, 3, 4, 1], [2, 4, 1, 1], [3, 5, 1, 1], [4, 6, 1, 1]],
      E: [[0, 0, 1, 7], [0, 0, 5, 1], [0, 3, 4, 1], [0, 6, 5, 1]],
      Z: [[0, 0, 5, 1], [4, 1, 1, 1], [3, 2, 1, 1], [2, 3, 1, 1], [1, 4, 1, 1], [0, 5, 1, 1], [0, 6, 5, 1]],
      O: [[0, 0, 5, 1], [0, 6, 5, 1], [0, 1, 1, 5], [4, 1, 1, 5]],
      S: [[0, 0, 5, 1], [0, 1, 1, 2], [0, 3, 5, 1], [4, 4, 1, 2], [0, 6, 5, 1]],
      N: [[0, 0, 1, 7], [4, 0, 1, 7], [1, 1, 1, 2], [2, 3, 1, 1], [3, 4, 1, 2]],
      A: [[0, 1, 1, 6], [4, 1, 1, 6], [1, 0, 3, 1], [1, 3, 3, 1]],
      K: [[0, 0, 1, 7], [3, 0, 1, 1], [2, 1, 1, 1], [1, 2, 1, 2], [2, 4, 1, 1], [3, 5, 1, 1], [4, 6, 1, 1]],
      B: [[0, 0, 1, 7], [0, 0, 4, 1], [4, 1, 1, 2], [0, 3, 4, 1], [4, 4, 1, 2], [0, 6, 4, 1]],
    };
    const placaTex = (word: string, ink: string) => {
      const W = word.length * 7 + 3;
      return pixTex(W, 20, (g) => {
        g.fillStyle = ink;
        for (let i = 0; i < word.length; i++) {
          const x0 = 2 + i * 7;
          for (const [sx, sy, sw, sh] of PLACA[word[i]] ?? []) {
            g.fillRect(x0 + sx, 1 + sy * 2, sw, sh * 2); // ×2 tall — soldiers, not squares
          }
        }
        g.fillRect(2, 17, W - 6, 1); // the hard underline
        g.fillRect(W - 5, 16, 2, 1); // finished with a flick
      });
    };
    const tag = (t: THREE.Texture, w: number, h: number, x: number, y: number, z: number, ry: number) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }));
      m.position.set(x, y, z);
      m.rotation.y = ry;
      scene.add(m);
    };
    tag(placaTex('REZO', '#16161a'), 1.7, 1.1, -9.6, 1.45, AZ0 - 0.05, Math.PI);
    tag(placaTex('SNAK', '#c9c4b0'), 1.35, 0.87, -11.6, 1.15, AZ1 + 0.05, 0);
    tag(placaTex('KOBRA', '#16161a'), 1.55, 0.82, -FACE - 6.27, 1.7, AZ0 - 2.3, Math.PI / 2);
  }

}
