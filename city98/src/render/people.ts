import * as THREE from 'three';
import type { Rng } from '../core/rng';
import { folk, plainFolk, type Folk } from '../core/folk';

const SKIN = [0xe8c49c, 0xc89670, 0x9c6a48, 0x7a4f34, 0xf0d4b0];
const SHIRTS = [0x9c2f2f, 0x2f6a9c, 0x3c8a5a, 0x8a3c8a, 0xd8a83c, 0x4a9c9c, 0xd86a2f, 0x6a6a72];
const JACKETS = [0x3c2f8a, 0x0f8a7a, 0xb03c78, 0x2f2f36]; // windbreaker era
const PANTS = [0x30425c, 0x3a3a40, 0x5c4a38, 0x2c3a52];
const HAIR = [0x2c2018, 0x4a3320, 0x8a6a3a, 0xb8b0a0, 0x1c1c20];
const BAGS = [0x4a3b2c, 0x2f3138, 0x6a2f2f];
const SHOE = 0x1c1c22;
const EYE = 0x24242e;

// Flat-shaded so every facet catches the light on its own — the PS1/N64 look,
// not the smooth uniform plastic of a block avatar.
const mat = (c: number) => new THREE.MeshLambertMaterial({ color: c, flatShading: true });

/** A box whose top face is a different width/depth than its bottom — a frustum.
 *  Tapered limbs and torsos are what separate a carved low-poly body from a stack of bricks. */
function taperBox(wTop: number, dTop: number, wBot: number, dBot: number, h: number): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(1, h, 1);
  const pos = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const top = pos.getY(i) > 0;
    pos.setX(i, pos.getX(i) * (top ? wTop : wBot));
    pos.setZ(i, pos.getZ(i) * (top ? dTop : dBot));
  }
  g.computeVertexNormals();
  return g;
}

export interface PersonMesh {
  group: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  setColors?: (shirt: number, hair: number, skin: number) => void;
}

export interface Look { shirt: number; hair: number; skin: number; }

interface Palette { skin: number; top: number; pants: number; hair: number; bag: number; }
interface Opts { cap?: boolean; capColor?: number; folk?: Folk; }

/** A tapered limb that pivots at its top (shoulder / hip), with a hand or shoe capping the end.
 *  The end cap swings with the limb because it lives inside the same group. */
function limb(
  len: number, wTop: number, wBot: number, sleeve: THREE.Material,
  x: number, y: number, cap: { mat: THREE.Material; w: number; h: number; toe: number },
): THREE.Group {
  const g = new THREE.Group();
  const arm = new THREE.Mesh(taperBox(wTop, wTop, wBot, wBot, len), sleeve);
  arm.position.y = -len / 2;
  arm.castShadow = true;
  g.add(arm);
  const end = new THREE.Mesh(new THREE.BoxGeometry(cap.w, cap.h, cap.w + cap.toe), cap.mat);
  end.position.set(0, -len + cap.h * 0.4, -cap.toe / 2); // toe pokes forward (−z is "front")
  end.castShadow = true;
  g.add(end);
  g.position.set(x, y, 0);
  return g;
}

/** Hair, from a shell over the crown to a bob framing the jaw. Style 2 is bald. */
function addHair(g: THREE.Group, style: number, hair: THREE.Material): void {
  const crown = () => {
    const m = new THREE.Mesh(taperBox(0.36, 0.36, 0.31, 0.34, 0.26), hair);
    m.position.set(0, 1.94, 0.03); m.castShadow = true; g.add(m);
  };
  const sideburns = () => {
    const geo = new THREE.BoxGeometry(0.04, 0.14, 0.16);
    const l = new THREE.Mesh(geo, hair); l.position.set(-0.17, 1.82, 0.02);
    const r = new THREE.Mesh(geo, hair); r.position.set(0.17, 1.82, 0.02);
    g.add(l, r);
  };
  switch (style) {
    case 0: crown(); sideburns(); break;
    case 1: { // side part with a fringe
      crown();
      const fringe = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, 0.06), hair);
      fringe.position.set(0.05, 1.99, -0.14); g.add(fringe); sideburns();
      break;
    }
    case 2: { // bald — just a hairline rim around the back
      const rim = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.08), hair);
      rim.position.set(0, 1.72, 0.13); g.add(rim);
      break;
    }
    case 3: { // long / bob framing the face
      crown();
      const back = new THREE.Mesh(taperBox(0.34, 0.1, 0.3, 0.1, 0.3), hair);
      back.position.set(0, 1.7, 0.17); back.castShadow = true;
      const side = new THREE.BoxGeometry(0.05, 0.26, 0.3);
      const l = new THREE.Mesh(side, hair); l.position.set(-0.185, 1.7, 0.02);
      const r = new THREE.Mesh(side, hair); r.position.set(0.185, 1.7, 0.02);
      g.add(back, l, r);
      break;
    }
    case 4: { // short with a ponytail out the back
      crown();
      const tail = new THREE.Mesh(taperBox(0.12, 0.12, 0.07, 0.07, 0.32), hair);
      tail.position.set(0, 1.78, 0.26); tail.rotation.x = 0.3; tail.castShadow = true;
      g.add(tail);
      break;
    }
    default: { // 5: receding — hair sits back off the forehead
      const m = new THREE.Mesh(taperBox(0.34, 0.3, 0.3, 0.33, 0.2), hair);
      m.position.set(0, 1.98, 0.07); m.castShadow = true; g.add(m);
      sideburns();
    }
  }
}

function addGlasses(g: THREE.Group): void {
  const frame = mat(0x24262d);
  const lens = new THREE.BoxGeometry(0.12, 0.09, 0.02);
  const l = new THREE.Mesh(lens, frame); l.position.set(-0.09, 1.86, -0.165);
  const r = new THREE.Mesh(lens, frame); r.position.set(0.09, 1.86, -0.165);
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.025, 0.02), frame);
  bridge.position.set(0, 1.87, -0.165);
  const temple = new THREE.BoxGeometry(0.02, 0.02, 0.16);
  const tl = new THREE.Mesh(temple, frame); tl.position.set(-0.16, 1.87, -0.08);
  const tr = new THREE.Mesh(temple, frame); tr.position.set(0.16, 1.87, -0.08);
  g.add(l, r, bridge, tl, tr);
}

function addBag(g: THREE.Group, kind: 'shoulder' | 'backpack', color: number, w: number): void {
  const bag = mat(color);
  const strap = mat(0x1e1e24);
  if (kind === 'backpack') {
    const pack = new THREE.Mesh(taperBox(0.4 * w, 0.2, 0.36 * w, 0.22, 0.5), bag);
    pack.position.set(0, 1.2, 0.28); pack.castShadow = true;
    const sGeo = new THREE.BoxGeometry(0.05, 0.5, 0.04);
    const sl = new THREE.Mesh(sGeo, strap); sl.position.set(-0.18 * w, 1.3, -0.16);
    const sr = new THREE.Mesh(sGeo, strap); sr.position.set(0.18 * w, 1.3, -0.16);
    g.add(pack, sl, sr);
  } else {
    const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.24, 0.12), bag);
    pouch.position.set(0.3 * w, 1.02, 0.06); pouch.castShadow = true;
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.72, 0.05), strap);
    band.position.set(0.02, 1.32, -0.02); band.rotation.z = 0.5;
    g.add(pouch, band);
  }
}

/** Shared humanoid builder. Faces local −z. Feet rest at y = 0. Variety comes from `folk`. */
function buildBody(p: Palette, opts: Opts = {}): PersonMesh {
  const f = opts.folk ?? plainFolk();
  const w = f.width; // lateral scale (build)
  const dw = 1 + (w - 1) * 0.5; // depth scales gently
  const skin = mat(p.skin);
  const top = mat(p.top);
  const pants = mat(p.pants);
  const hair = mat(p.hair);
  const shoe = mat(SHOE);
  const eye = mat(EYE);
  const g = new THREE.Group();

  // Torso: shoulders broad, waist tucked.
  const torso = new THREE.Mesh(taperBox(0.66 * w, 0.36 * dw, 0.48 * w, 0.3 * dw, 0.74), top);
  torso.position.y = 1.24; torso.castShadow = true;

  // Shoulder caps so the arms hang off a deltoid, not a flat wall.
  const shoulderGeo = new THREE.BoxGeometry(0.2 * w, 0.18, 0.34 * dw);
  const lSh = new THREE.Mesh(shoulderGeo, top); lSh.position.set(-0.32 * w, 1.54, 0); lSh.castShadow = true;
  const rSh = new THREE.Mesh(shoulderGeo, top); rSh.position.set(0.32 * w, 1.54, 0); rSh.castShadow = true;

  // Pelvis bridges waist to legs so nothing floats.
  const pelvis = new THREE.Mesh(taperBox(0.46 * w, 0.32 * dw, 0.4 * w, 0.3 * dw, 0.22), pants);
  pelvis.position.y = 0.98; pelvis.castShadow = true;

  // Neck, jaw-tapered head.
  const neck = new THREE.Mesh(taperBox(0.15, 0.15, 0.18, 0.17, 0.14), skin);
  neck.position.y = 1.68; neck.castShadow = true;
  const head = new THREE.Mesh(taperBox(0.34, 0.32, 0.25, 0.28, 0.38), skin);
  head.position.y = 1.84; head.castShadow = true;

  // A nose turns a cube into a face.
  const nose = new THREE.Mesh(taperBox(0.05, 0.04, 0.09, 0.08, 0.1), skin);
  nose.position.set(0, 1.82, -0.17);
  const brow = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.035, 0.04), hair);
  brow.position.set(0, 1.92, -0.16);
  const eyeGeo = new THREE.BoxGeometry(0.06, 0.045, 0.03);
  const lEye = new THREE.Mesh(eyeGeo, eye); lEye.position.set(-0.09, 1.86, -0.155);
  const rEye = new THREE.Mesh(eyeGeo, eye); rEye.position.set(0.09, 1.86, -0.155);

  g.add(torso, lSh, rSh, pelvis, neck, head, nose, brow, lEye, rEye);

  // Hat, hair, and glasses.
  if (opts.cap) {
    const capMat = mat(opts.capColor ?? SHIRTS[0]);
    const dome = new THREE.Mesh(taperBox(0.34, 0.33, 0.38, 0.36, 0.14), capMat);
    dome.position.set(0, 2.0, 0.01); dome.castShadow = true;
    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.05, 0.22), capMat);
    brim.position.set(0, 1.95, -0.26);
    g.add(dome, brim);
  } else {
    addHair(g, f.hairStyle, hair);
  }
  if (f.glasses) addGlasses(g);

  // Arms.
  const hand = { mat: skin, w: 0.15, h: 0.16, toe: 0.0 };
  const leftArm = limb(0.66, 0.17 * w, 0.13 * w, top, -0.4 * w, 1.56, hand);
  const rightArm = limb(0.66, 0.17 * w, 0.13 * w, top, 0.4 * w, 1.56, hand);

  // Legs — bare beneath a skirt, otherwise trousered.
  const bareLegs = f.outfit === 'skirt';
  const legMat = bareLegs ? skin : pants;
  const foot = { mat: shoe, w: 0.19, h: 0.14, toe: 0.16 };
  const leftLeg = limb(0.9, 0.2 * w, 0.16 * w, legMat, -0.17 * w, 0.9, foot);
  const rightLeg = limb(0.9, 0.2 * w, 0.16 * w, legMat, 0.17 * w, 0.9, foot);
  g.add(leftArm, rightArm, leftLeg, rightLeg);

  // Outerwear silhouettes.
  if (f.outfit === 'skirt') {
    const skirt = new THREE.Mesh(taperBox(0.46 * w, 0.34 * dw, 0.66 * w, 0.5 * dw, 0.42), pants);
    skirt.position.y = 0.78; skirt.castShadow = true; g.add(skirt);
  } else if (f.outfit === 'longcoat') {
    const coat = new THREE.Mesh(taperBox(0.6 * w, 0.34 * dw, 0.72 * w, 0.44 * dw, 1.0), top);
    coat.position.y = 1.0; coat.castShadow = true; g.add(coat);
  }

  if (f.bag !== 'none') addBag(g, f.bag, p.bag, w);

  g.scale.setScalar(f.height);

  return {
    group: g, leftArm, rightArm, leftLeg, rightLeg,
    setColors: (sh, ha, sk) => {
      top.color.setHex(sh);
      hair.color.setHex(ha);
      skin.color.setHex(sk);
    },
  };
}

/** A customizable avatar whose colors can change live (mirror reflection, character creation).
 *  Optional `folk` gives named citizens distinct builds; the player keeps the neutral build. */
export function makeAvatar(shirtColor: number, hairColor: number, skinColor: number, who?: Folk): PersonMesh {
  return buildBody(
    { skin: skinColor, top: shirtColor, pants: PANTS[0], hair: hairColor, bag: BAGS[0] },
    { folk: who ?? plainFolk() },
  );
}

/** A low-poly citizen of 1998 — a distinct individual drawn from the rng stream. */
export function makePerson(rng: Rng): PersonMesh {
  const f = folk(rng);
  const windbreaker = rng() < 0.35;
  const cap = f.hairStyle !== 2 && rng() < 0.22; // don't cap the bald guy over his rim
  return buildBody(
    {
      skin: SKIN[Math.floor(rng() * SKIN.length)],
      top: windbreaker ? JACKETS[Math.floor(rng() * JACKETS.length)] : SHIRTS[Math.floor(rng() * SHIRTS.length)],
      pants: PANTS[Math.floor(rng() * PANTS.length)],
      hair: HAIR[Math.floor(rng() * HAIR.length)],
      bag: BAGS[Math.floor(rng() * BAGS.length)],
    },
    { cap, capColor: SHIRTS[Math.floor(rng() * SHIRTS.length)], folk: f },
  );
}
