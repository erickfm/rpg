import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { Building, DoorSide } from '../world/layout';
import { makeDieFace, makeGraffiti, makeSign, makeWindowGrid } from './textures';

const lambert = (color: number) => new THREE.MeshLambertMaterial({ color });

function sideRotation(side: DoorSide): number {
  switch (side) {
    case 's': return 0;
    case 'n': return Math.PI;
    case 'e': return Math.PI / 2;
    case 'w': return -Math.PI / 2;
  }
}

/** Position/rotation for a plane mounted on the door-side wall at height y. */
function onFrontWall(b: Building, y: number, off = 0.06): { pos: THREE.Vector3; rotY: number } {
  const rotY = sideRotation(b.side);
  let x = b.x;
  let z = b.z;
  if (b.side === 's') z = b.z + b.d / 2 + off;
  if (b.side === 'n') z = b.z - b.d / 2 - off;
  if (b.side === 'e') x = b.x + b.w / 2 + off;
  if (b.side === 'w') x = b.x - b.w / 2 - off;
  return { pos: new THREE.Vector3(x, y, z), rotY };
}

function addFrontPlane(
  group: THREE.Group,
  b: Building,
  material: THREE.Material,
  w: number,
  h: number,
  y: number,
  off = 0.06
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
  const { pos, rotY } = onFrontWall(b, y, off);
  mesh.position.copy(pos);
  mesh.rotation.y = rotY;
  group.add(mesh);
  return mesh;
}

/**
 * Building body: rounded walls with a crisp flat parapet roof — the rounded
 * top edge alone reads "melted" from the high camera, so every roof gets a
 * darker flat cap, and larger roofs get an AC unit for texture.
 */
function roundedBase(b: Building, color: number, h = b.h, withAc = false): THREE.Group {
  const g = new THREE.Group();
  const geo = new RoundedBoxGeometry(b.w, h, b.d, 3, 0.9);
  const mesh = new THREE.Mesh(geo, lambert(color));
  mesh.position.set(b.x, h / 2, b.z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  g.add(mesh);

  const capColor = new THREE.Color(color).multiplyScalar(0.42);
  const cap = new THREE.Mesh(
    new THREE.BoxGeometry(b.w + 0.6, 0.6, b.d + 0.6),
    new THREE.MeshLambertMaterial({ color: capColor })
  );
  cap.position.set(b.x, h + 0.05, b.z);
  cap.castShadow = true;
  cap.receiveShadow = true;
  g.add(cap);

  if (withAc) {
    const ac = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.2, 2), lambert(0xb9bdc4));
    ac.position.set(b.x - b.w / 4, h + 0.9, b.z + b.d / 5);
    ac.castShadow = true;
    const fan = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.25, 12), lambert(0x5a5e66));
    fan.position.set(b.x - b.w / 4, h + 1.55, b.z + b.d / 5);
    g.add(ac, fan);
  }
  return g;
}

function addDoor(group: THREE.Group, b: Building): void {
  const frame = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 4.8), lambert(0x2c2f38));
  const { pos, rotY } = onFrontWall(b, 2.4, 0.07);
  frame.position.copy(pos);
  frame.rotation.y = rotY;
  group.add(frame);
  const door = new THREE.Mesh(
    new THREE.PlaneGeometry(2.8, 4.2),
    new THREE.MeshLambertMaterial({ color: 0x14161c })
  );
  door.position.copy(pos);
  door.position.y = 2.1;
  door.rotation.y = rotY;
  door.translateZ(0.02);
  group.add(door);

  const pad = new THREE.Mesh(
    new THREE.CircleGeometry(1.8, 26),
    new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.5 })
  );
  pad.rotation.x = -Math.PI / 2;
  pad.position.set(b.doorX, 0.09, b.doorZ);
  group.add(pad);
}

function addSign(group: THREE.Group, b: Building, tex: THREE.CanvasTexture, w = 12, h = 2.6, y?: number): void {
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
  addFrontPlane(group, b, mat, w, h, y ?? Math.min(b.h - 1.2, 7.6), 0.12);
}

function makeVerticalSign(text: string, bg: string, fg: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 96;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(4, 4, 88, 504, 12);
  ctx.fill();
  ctx.translate(48, 256);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = fg;
  ctx.font = 'bold 52px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 0, 0, 480);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ---------- bespoke builders ----------

function buildApartment(b: Building, g: THREE.Group): void {
  g.add(roundedBase(b, b.color));
  // hip roof, red like the map — rotate the pyramid first, then scale the
  // wrapper so the rectangular footprint doesn't skew
  const roofCone = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 4), lambert(0xb03030));
  roofCone.rotation.y = Math.PI / 4;
  roofCone.castShadow = true;
  const roof = new THREE.Group();
  roof.add(roofCone);
  roof.scale.set((b.w / 2 + 1.2) * Math.SQRT2, 5, (b.d / 2 + 1.2) * Math.SQRT2);
  roof.position.set(b.x, b.h + 2.5, b.z);
  g.add(roof);
  // the map's 3×3 blue window grid
  const winTex = makeWindowGrid('#8a5a3c', 4, 3);
  addFrontPlane(g, b, new THREE.MeshLambertMaterial({ map: winTex }), b.w - 6, b.h - 9, b.h / 2 + 4);
  addSign(g, b, makeSign('Apartment', { border: 'none' }), 9, 2.1, b.h - 2.4);
}

function buildCastle(b: Building, g: THREE.Group): void {
  const keep = roundedBase(b, b.color, b.h);
  g.add(keep);
  // crenellations
  const merlon = lambert(0x7d838d);
  for (let i = -2; i <= 2; i++) {
    for (const [dx, dz] of [
      [i * (b.w / 5), -b.d / 2 + 0.8],
      [i * (b.w / 5), b.d / 2 - 0.8],
      [-b.w / 2 + 0.8, i * (b.d / 5)],
      [b.w / 2 - 0.8, i * (b.d / 5)],
    ]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(2, 1.6, 2), merlon);
      m.position.set(b.x + dx, b.h + 0.8, b.z + dz);
      g.add(m);
    }
  }
  // corner towers with blue cone caps and red flags
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    const tx = b.x + sx * (b.w / 2);
    const tz = b.z + sz * (b.d / 2);
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.8, b.h + 8, 12), lambert(0x9aa0aa));
    tower.position.set(tx, (b.h + 8) / 2, tz);
    tower.castShadow = true;
    g.add(tower);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(4, 5, 12), lambert(0x3c5db0));
    cap.position.set(tx, b.h + 8 + 2.5, tz);
    cap.castShadow = true;
    g.add(cap);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3), lambert(0x444444));
    pole.position.set(tx, b.h + 13 + 1.5, tz);
    g.add(pole);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1), new THREE.MeshBasicMaterial({ color: 0xd03030, side: THREE.DoubleSide }));
    flag.position.set(tx + 0.95, b.h + 14.4, tz);
    g.add(flag);
  }
  // portcullis gate
  addFrontPlane(g, b, lambert(0x23262e), 5, 6.5, 3.2, 0.07);
  addSign(g, b, makeSign('The Castle', { border: 'none' }), 9, 2.1, b.h - 3);
}

function buildBank(b: Building, g: THREE.Group): void {
  g.add(roundedBase(b, b.color));
  // gold dollar medallion, like the map
  addSign(g, b, makeSign('$', { bg: 'rgba(20,14,8,0.9)', fg: '#f2c84a', font: 'bold 96px Georgia, serif' }), 4, 4, b.h - 4);
  // small classical porch
  const rot = sideRotation(b.side);
  const porch = new THREE.Group();
  for (const off of [-2.6, 2.6]) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.55, 5.4, 10), lambert(0xe8e2d2));
    col.position.set(off, 2.7, 1.6);
    col.castShadow = true;
    porch.add(col);
  }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(7.4, 1, 3), lambert(0xe8e2d2));
  lintel.position.set(0, 5.9, 1.2);
  lintel.castShadow = true;
  porch.add(lintel);
  porch.position.set(b.doorX, 0, b.doorZ);
  porch.rotation.y = rot;
  g.add(porch);
  addSign(g, b, makeSign('BANK', { border: 'none' }), 7, 2, 8.6);
}

function buildNewLines(b: Building, g: THREE.Group): void {
  const winTex = makeWindowGrid('#6d737d', 5, 10);
  const side = new THREE.MeshLambertMaterial({ map: winTex });
  const tower = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), [
    side, side.clone(), lambert(0x596069) as THREE.Material, lambert(0x596069), side.clone(), side.clone(),
  ] as THREE.Material[]);
  tower.position.set(b.x, b.h / 2, b.z);
  tower.castShadow = true;
  tower.receiveShadow = true;
  g.add(tower);
  // crisp parapet + rooftop gear
  const cap = new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.6, 0.7, b.d + 0.6), lambert(0x33373e));
  cap.position.set(b.x, b.h + 0.1, b.z);
  cap.castShadow = true;
  g.add(cap);
  const ac = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.6, 2.6), lambert(0xb9bdc4));
  ac.position.set(b.x + b.w / 4, b.h + 1.2, b.z - b.d / 4);
  ac.castShadow = true;
  g.add(ac);
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 6), lambert(0x2a2c33));
  antenna.position.set(b.x - b.w / 4, b.h + 3, b.z + b.d / 4);
  g.add(antenna);
  const vsign = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 14),
    new THREE.MeshBasicMaterial({ map: makeVerticalSign('NEW LINES INC.', '#e8c93c', '#232323'), transparent: true })
  );
  const { pos, rotY } = onFrontWall(b, b.h - 12, 0.15);
  vsign.position.copy(pos);
  vsign.position.x -= 6;
  vsign.rotation.y = rotY;
  g.add(vsign);
}

function buildUofS(b: Building, g: THREE.Group): void {
  g.add(roundedBase(b, b.color, b.h - 6));
  // stepped entrance
  const rot = sideRotation(b.side);
  const steps = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(14 - i * 2, 0.7, 3.4 - i), lambert(0xcbbd85));
    step.position.set(0, 0.35 + i * 0.7, 1.2 - i * 0.6);
    step.receiveShadow = true;
    steps.add(step);
  }
  for (const off of [-5, -1.7, 1.7, 5]) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.7, 9, 12), lambert(0xe8dcae));
    col.position.set(off, 6.5, 0.4);
    col.castShadow = true;
    steps.add(col);
  }
  steps.position.set(b.doorX, 0, b.doorZ);
  steps.rotation.y = rot;
  g.add(steps);
  // pediment
  const tri = new THREE.Shape();
  tri.moveTo(-9, 0);
  tri.lineTo(9, 0);
  tri.lineTo(0, 4);
  tri.closePath();
  const ped = new THREE.Mesh(
    new THREE.ExtrudeGeometry(tri, { depth: 2.4, bevelEnabled: false }),
    lambert(0xe8dcae)
  );
  const { pos, rotY } = onFrontWall(b, 0, -1);
  ped.position.set(pos.x, b.h - 6 + 4.5, pos.z);
  ped.rotation.y = rotY;
  ped.castShadow = true;
  g.add(ped);
  addSign(g, b, makeSign('U of S', { bg: 'rgba(60,48,20,0.85)', fg: '#f5ecc8' }), 6.5, 1.9, b.h - 6 + 6.2);
}

function buildMcSticks(b: Building, g: THREE.Group): void {
  g.add(roundedBase(b, b.color, b.h, true));
  // red fascia band
  const band = new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.4, 2.2, b.d + 0.4), lambert(0xb03030));
  band.position.set(b.x, b.h - 1.1, b.z);
  g.add(band);
  // the golden arches: a proper double-arch "M" standing on the roof edge
  const gold = new THREE.MeshLambertMaterial({ color: 0xf2c026, emissive: 0x664c00 });
  const archGeo = new THREE.TorusGeometry(2.1, 0.55, 12, 28, Math.PI);
  const { pos, rotY } = onFrontWall(b, b.h + 1.6, -0.6);
  for (const off of [-1.9, 1.9]) {
    const arch = new THREE.Mesh(archGeo, gold);
    arch.position.copy(pos);
    arch.rotation.y = rotY;
    arch.translateX(off);
    arch.castShadow = true;
    g.add(arch);
  }
  addSign(g, b, makeSign('McSticks', { bg: 'rgba(122,26,26,0.94)', fg: '#f9e8b0', border: '#f2c026' }), 11, 2.6, 7.4);
}

function buildStickys(b: Building, g: THREE.Group): void {
  g.add(roundedBase(b, b.color));
  addSign(
    g, b,
    makeSign("Sticky's", { bg: 'rgba(24,20,10,0.9)', fg: '#f5a623', font: 'italic bold 64px Georgia, serif', border: '#f5a623' }),
    10, 2.6, 7.2
  );
  // beer mug emblem
  const mugTex = makeSign('🍺', { bg: 'rgba(0,0,0,0)', border: 'none', font: '84px serif', width: 128, height: 128 });
  addSign(g, b, mugTex as THREE.CanvasTexture, 3.4, 3.4, 4.4);
  // "Know When to Draw the Line" poster on the side wall
  const poster = new THREE.Mesh(
    new THREE.PlaneGeometry(5.4, 3),
    new THREE.MeshBasicMaterial({
      map: makeSign('Know When to Draw the Line', {
        bg: '#dcd6c8', fg: '#3a3a3a', border: '#8a2323',
        font: 'bold 34px Georgia, serif', width: 512, height: 256,
      }),
    })
  );
  poster.position.set(b.x, 4, b.z + b.d / 2 + 0.06);
  g.add(poster);
}

function buildCasino(b: Building, g: THREE.Group): void {
  g.add(roundedBase(b, b.color, b.h, true));
  const trim = new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.5, 1.2, b.d + 0.5), lambert(0xf2c84a));
  trim.position.set(b.x, b.h - 0.6, b.z);
  g.add(trim);
  // two giant dice on the roof
  const dieMats = (faces: number[]) =>
    faces.map(n => new THREE.MeshLambertMaterial({ map: makeDieFace(n) }));
  const die1 = new THREE.Mesh(new THREE.BoxGeometry(6, 6, 6), dieMats([1, 6, 2, 5, 3, 4]));
  die1.position.set(b.x - 5, b.h + 3.2, b.z - 2);
  die1.rotation.y = 0.5;
  die1.castShadow = true;
  g.add(die1);
  const die2 = new THREE.Mesh(new THREE.BoxGeometry(4.6, 4.6, 4.6), dieMats([5, 2, 4, 3, 6, 1]));
  die2.position.set(b.x + 3.5, b.h + 2.5, b.z + 3);
  die2.rotation.set(0, -0.4, 0.12);
  die2.castShadow = true;
  g.add(die2);
  // red carpet out the front door
  const rot = sideRotation(b.side);
  const carpet = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 9), new THREE.MeshLambertMaterial({ color: 0xa82434 }));
  carpet.rotation.x = -Math.PI / 2;
  carpet.rotation.z = rot;
  carpet.position.set(b.doorX, 0.08, b.doorZ);
  carpet.translateY(-3);
  carpet.receiveShadow = true;
  g.add(carpet);
  addSign(
    g, b,
    makeSign('SILVER LINING', { bg: 'rgba(16,20,40,0.94)', fg: '#e8ecf5', border: '#f2c84a' }),
    12, 2.6, 8.8
  );
  addSign(g, b, makeSign('CASINO', { bg: 'rgba(16,20,40,0)', fg: '#f2c84a', border: 'none' }), 8, 2, 5.6);
}

function buildStore(b: Building, g: THREE.Group): void {
  g.add(roundedBase(b, b.color, b.h, true));
  addSign(g, b, makeSign('CONVENIENCE STORE', { border: '#4ae86a' }), 13, 2.4, 7.4);
  const enter = makeSign('ENTER', { bg: 'rgba(10,30,12,0.95)', fg: '#5af57a', border: '#5af57a', width: 256, height: 96 });
  addSign(g, b, enter as THREE.CanvasTexture, 3.6, 1.35, 5.2);
  // graffiti on the side wall
  const graffiti = new THREE.Mesh(
    new THREE.PlaneGeometry(12, 6),
    new THREE.MeshBasicMaterial({ map: makeGraffiti(), transparent: true })
  );
  graffiti.position.set(b.x - b.w / 2 - 0.06, 3.4, b.z);
  graffiti.rotation.y = -Math.PI / 2;
  g.add(graffiti);
}

function buildBusDepot(b: Building, g: THREE.Group): void {
  g.add(roundedBase(b, b.color));
  addSign(g, b, makeSign('BUS DEPOT', { bg: 'rgba(12,30,44,0.94)', fg: '#cdeaf5', border: '#54a8c8' }), 11, 2.5, 6.8);
}

function buildPawn(b: Building, g: THREE.Group): void {
  g.add(roundedBase(b, b.color));
  addSign(g, b, makeSign('PAWN SHOP', { bg: 'rgba(30,16,40,0.94)', fg: '#e8d5f5', border: '#b07ae0' }), 10, 2.5, 8.2);
  // barred windows
  const bars = makeSign('▮▮▮▮▮', { bg: '#3a2a4a', fg: '#8a8f99', border: 'none', font: 'bold 60px monospace' });
  for (const off of [-5, 5]) {
    const win = new THREE.Mesh(new THREE.PlaneGeometry(4, 2.6), new THREE.MeshBasicMaterial({ map: bars }));
    const { pos, rotY } = onFrontWall(b, 4.6, 0.07);
    win.position.copy(pos);
    win.rotation.y = rotY;
    win.translateX(off);
    g.add(win);
  }
}

function buildFineLine(b: Building, g: THREE.Group): void {
  g.add(roundedBase(b, b.color));
  // storefront glass band
  addFrontPlane(g, b, new THREE.MeshLambertMaterial({ color: 0x9fc8d8 }), b.w - 8, 3.4, 3.6, 0.06);
  addSign(g, b, makeSign('FINE LINE FURNISHINGS', { bg: 'rgba(40,40,44,0.92)', fg: '#f2f2ee' }), 14, 2.3, 8.6);
}

export function buildBuilding(b: Building): THREE.Group {
  const g = new THREE.Group();
  switch (b.id) {
    case 'apartment': buildApartment(b, g); break;
    case 'castle': buildCastle(b, g); break;
    case 'bank': buildBank(b, g); break;
    case 'newlines': buildNewLines(b, g); break;
    case 'uofs': buildUofS(b, g); break;
    case 'mcsticks': buildMcSticks(b, g); break;
    case 'stickys': buildStickys(b, g); break;
    case 'casino': buildCasino(b, g); break;
    case 'store': buildStore(b, g); break;
    case 'busdepot': buildBusDepot(b, g); break;
    case 'pawn': buildPawn(b, g); break;
    case 'fineline': buildFineLine(b, g); break;
  }
  addDoor(g, b);
  return g;
}

// ---------- vehicles ----------

export function makeCarMesh(color: number): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new RoundedBoxGeometry(4.6, 1.3, 2.2, 2, 0.4), lambert(color));
  body.position.y = 1;
  body.castShadow = true;
  g.add(body);
  const cabin = new THREE.Mesh(new RoundedBoxGeometry(2.4, 1, 2, 2, 0.35), lambert(0xd8ecf5));
  cabin.position.set(-0.2, 1.9, 0);
  cabin.castShadow = true;
  g.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.4, 12);
  for (const [wx, wz] of [[-1.5, -1.1], [1.5, -1.1], [-1.5, 1.1], [1.5, 1.1]]) {
    const wheel = new THREE.Mesh(wheelGeo, lambert(0x1c1c22));
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(wx, 0.45, wz);
    g.add(wheel);
  }
  return g;
}

export function makeBusMesh(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new RoundedBoxGeometry(11, 3, 3, 2, 0.5), lambert(0xf2f2ee));
  body.position.y = 2;
  body.castShadow = true;
  g.add(body);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(11.05, 0.5, 3.05), lambert(0x3878c8));
  stripe.position.y = 1.4;
  g.add(stripe);
  const winBand = new THREE.Mesh(new THREE.BoxGeometry(10.2, 0.9, 3.02), lambert(0x9fc8d8));
  winBand.position.y = 2.8;
  g.add(winBand);
  const wheelGeo = new THREE.CylinderGeometry(0.7, 0.7, 0.5, 12);
  for (const [wx, wz] of [[-3.8, -1.5], [3.8, -1.5], [-3.8, 1.5], [3.8, 1.5]]) {
    const wheel = new THREE.Mesh(wheelGeo, lambert(0x1c1c22));
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(wx, 0.7, wz);
    g.add(wheel);
  }
  return g;
}
