import * as THREE from 'three';
import { pixTex, declareSurface } from './paint';
import { ALLEY2_SLAB_Y } from './alley-floor';
import type { LadderPose } from '../fp';

/** THE PAWN ALLEY'S WALLS — the vertical half of the dressing.
 *
 *  *"add some detail to this alley, like a gutter pip some vent stuff on the
 *  ground, etc"*, split so nobody is the bottleneck: these are the WALLS, and
 *  the floor, gutter channel, drain and ground vents are B's in
 *  `ct/tex-ground.ts`. Coordinated by note, not by reaching into that file.
 *
 *  ── why this is not the first alley's kit ──
 *
 *  The west alley is a SERVICE YARD behind shops: dumpster, gully, milk crates,
 *  a cat. This slot is 2.5 m wide between a PAWN SHOP and the back of a
 *  five-storey WALK-UP, so it is the back of where people LIVE. Nothing here is
 *  a second dumpster. A second identical alley halves the value of the first.
 *
 *  ── the constraint that shapes every number below ──
 *
 *  2.5 m wide against a 0.72 m player capsule. The sacred pavement lane is 2 m
 *  and this is narrower, so anything hung on a wall comes out of the room a
 *  player needs to walk. Two rules, applied to every object here:
 *
 *    · nothing protrudes more than 0.14 m below 2.2 m — the height a body
 *      occupies. The cables are ABOVE that, and the roof ladder (which
 *      replaced the fire escape and must reach the ground) hugs the brick at
 *      0.125 m, inside the rule.
 *    · nothing intersects anything. *"trash cannot be clipping through stuff
 *      like this"*, and in a slot this tight objects are close enough that it
 *      would happen by accident.
 *
 *  And the user's other standing rule for alleys: *"for all the trash in the
 *  alley i cant tell what any of it is. these should be recognizable."* Every
 *  object here is a thing you can name at a glance — a pipe, a meter, a vent, a
 *  ladder, a lamp, a bike.
 */
export function buildPawnAlley(o: {
  scene: THREE.Scene;
  /** the slot: x runs X0…X1, z from Z0 (north, the walk-up) to Z1 (south, pawn) */
  X0: number; X1: number; Z0: number; Z1: number;
  H: number;
  /** the top of No. 227 itself — the roof the ladder reaches. `H` is the
   *  taller of the two flanks and cannot stand in for it. */
  resTop: number;
  flat: (t: THREE.Texture) => THREE.MeshBasicMaterial;
  solid: (b: { minX: number; maxX: number; minZ: number; maxZ: number }) => void;
}): LadderPose {
  const { scene, X0, X1, Z0, Z1, H, resTop, flat } = o;
  const NORTH = Z0 - 0.02;          // the walk-up's flank, where people live
  const SOUTH = Z1 + 0.02;          // the pawn shop's back
  // ── EVERY `y` BELOW IS METRES ABOVE THE ALLEY FLOOR, NOT ABOVE ZERO ───────
  //
  // The floor moved. *"make the long alley flush with the sidewalk"*
  // (2026-08-04) lifted the slab from road level to the pavement's KERB_H, and
  // furniture measured from zero would have sunk 13 cm into it: the bike
  // half-buried to its hubs, the back door's step gone, the standpipe and the
  // downpipe's shoe both stubbed off at the ankle.
  //
  // So the offset is applied ONCE, in `box` below and at the handful of meshes
  // that set their own position — rather than added to thirty literals, where
  // the one that got missed would be the one nobody notices. Read every number
  // in this file as a height above the paving, which is how you would measure
  // any of these things in a real alley anyway.
  const Y = ALLEY2_SLAB_Y;
  const add = (m: THREE.Mesh) => { scene.add(m); return m; };
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material | THREE.Material[]) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y + Y, z);
    m.userData.alley2 = 'wall';
    return add(m);
  };

  // ── tones, matched to the two brick walls they hang on ────────────────────
  const iron = new THREE.MeshBasicMaterial({ color: 0x3b3d42 });
  const ironLit = new THREE.MeshBasicMaterial({ color: 0x4d5057 });
  const galv = new THREE.MeshBasicMaterial({ color: 0x8d9299 });
  const galvLo = new THREE.MeshBasicMaterial({ color: 0x6e737a });
  const rust = new THREE.MeshBasicMaterial({ color: 0x6b4a33 });

  // ── THE DOWNPIPE, which he named specifically ─────────────────────────────
  //
  // Full height, with brackets at every floor and a SHOE at the bottom that
  // turns the water out onto the ground. The shoe is the part that makes a
  // downpipe read as a downpipe rather than as a stripe: it is where the pipe
  // stops being architecture and starts being plumbing, and it points at the
  // gutter channel B is laying.
  const PIPE_X = X0 + 1.4, PIPE_R = 0.075;
  {
    // THE ONE THING HERE MEASURED FROM BOTH ENDS. Its foot sits on the paving
    // (0.55 above it, where the shoe takes over) and its head stops at the
    // parapet H — so raising the floor SHORTENS it rather than pushing its top
    // 14 cm into the sky above the wall it is fixed to.
    const PIPE_LEN = H - 0.55 - Y;
    const pipe = new THREE.Mesh(
      new THREE.CylinderGeometry(PIPE_R, PIPE_R, PIPE_LEN, 8),
      iron);
    pipe.position.set(PIPE_X, Y + 0.55 + PIPE_LEN / 2, NORTH - PIPE_R - 0.02);
    pipe.userData.alley2 = 'wall';
    add(pipe);
    // brackets: two straps per storey, so the eye reads the height as floors
    for (let y = 1.1; y < H - 0.6; y += 2.4) {
      box(0.02, 0.05, 0.20, PIPE_X, y, NORTH - 0.10, ironLit);
    }
    // the SHOE — a short elbow turning out and down to the ground
    const shoe = new THREE.Mesh(new THREE.CylinderGeometry(PIPE_R, PIPE_R * 1.25, 0.55, 8), iron);
    shoe.position.set(PIPE_X, Y + 0.30, NORTH - PIPE_R - 0.05);
    // 0.20 rad, not 0.34: measured, the steeper lean put the shoe 0.355 m out
    // from the wall at ankle height. It still turns visibly toward the channel
    // B is laying and now clears 0.24 m, in a slot where every centimetre out
    // from the wall is a centimetre off the walk.
    shoe.rotation.x = 0.20;
    shoe.userData.alley2 = 'wall';
    add(shoe);
    // the stain it has made down the brick and across the ground, which is what
    // tells you it has been running for years
    const stainT = declareSurface(pixTex(6, 40, (g) => {
      g.fillStyle = 'rgba(20,26,22,0.34)'; g.fillRect(1, 0, 4, 40);
      g.fillStyle = 'rgba(20,26,22,0.20)'; g.fillRect(0, 6, 6, 30);
    }), 'detail');
    const stain = new THREE.Mesh(new THREE.PlaneGeometry(0.34, H * 0.7),
      new THREE.MeshBasicMaterial({ map: stainT, transparent: true, depthWrite: false }));
    stain.position.set(PIPE_X, Y + H * 0.35, NORTH - 0.008);
    stain.userData.alley2 = 'wall';
    add(stain);
  }

  // ── THE LADDER TO THE ROOF, where the fire escape used to hang ────────────
  //
  // *"lets make it so the fire escape on the side of the building is actually
  // a ladder instead and allows you to have roof access."* (2026-09-02.) So
  // the three counterweighted landings are gone and this is ONE full-height
  // steel access ladder: foot on the paving, head rail over No. 227's
  // parapet, and it is REAL — `fp.ts` climbs it (see `LadderPose` there;
  // `ct/street.ts` publishes this pose and `crosstown.ts` wires the two [E]
  // spots, foot and roof lip).
  //
  // The alley's standing rule — nothing protrudes more than 0.14 m below
  // 2.2 m — still holds even though this now reaches the ground: the rungs
  // sit 0.11 m off the wall and their face stops at 0.125, tighter to the
  // brick than the downpipe's shoe. The line the rig holds you to while
  // climbing is 0.45 m out — the wall's collider plus the player's radius.
  const LADDER_X = X0 + 4.1;
  {
    const steel = galvLo;
    const topL = resTop - Y + 0.95;        // head rail clears the 0.62 m parapet
    // the two stringers, full height
    for (const sx of [-0.22, 0.22]) {
      box(0.05, topL - 0.1, 0.04, LADDER_X + sx, (topL + 0.1) / 2, NORTH - 0.11, steel);
    }
    // the rungs, ankle to lip
    for (let ry = 0.35; ry < resTop - Y + 0.35; ry += 0.31) {
      box(0.40, 0.025, 0.025, LADDER_X, ry, NORTH - 0.11, steel);
    }
    // standoff brackets every storey — what says BOLTED ON rather than leant
    for (let by = 1.2; by < resTop - Y; by += 2.4) {
      for (const sx of [-0.22, 0.22]) box(0.04, 0.05, 0.12, LADDER_X + sx, by, NORTH - 0.055, steel);
    }
  }

  // ── back-of-house on the PAWN side ────────────────────────────────────────
  {
    // two wall vents — a shop's extract, louvred, stained beneath
    for (const [vx, vy] of [[X0 + 2.2, 2.05], [X0 + 6.1, 2.3]] as [number, number][]) {
      box(0.52, 0.38, 0.09, vx, vy, SOUTH + 0.045, galvLo);
      for (let i = 0; i < 4; i++) box(0.46, 0.03, 0.02, vx, vy + 0.13 - i * 0.08, SOUTH + 0.10, galv);
    }
    // the meter bank: three boxes and the conduit that feeds them
    const MX = X0 + 8.4;
    for (let i = 0; i < 3; i++) box(0.30, 0.42, 0.12, MX + i * 0.36, 1.55, SOUTH + 0.06, i === 1 ? rust : galvLo);
    box(0.03, 1.5, 0.03, MX - 0.28, 0.9, SOUTH + 0.05, iron);            // conduit down
    box(1.35, 0.03, 0.03, MX + 0.36, 1.83, SOUTH + 0.05, iron);          // and across
    // a standpipe with its wheel — the thing a fire crew connects to
    box(0.09, 1.15, 0.09, X0 + 10.6, 0.58, SOUTH + 0.055, galvLo);
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.022, 6, 12), galv);
    wheel.position.set(X0 + 10.6, Y + 1.20, SOUTH + 0.055);
    wheel.userData.alley2 = 'wall';
    add(wheel);
  }

  // ── a back door with a step, and the light over it ────────────────────────
  {
    const DX = X0 + 12.4;
    box(1.02, 2.12, 0.07, DX, 1.06, SOUTH + 0.035, new THREE.MeshBasicMaterial({ color: 0x4a3f34 }));
    box(1.12, 0.05, 0.10, DX, 2.15, SOUTH + 0.05, iron);                 // lintel
    box(1.10, 0.12, 0.26, DX, 0.06, SOUTH + 0.13, new THREE.MeshBasicMaterial({ color: 0x63666b })); // step
    // the lamp: a shade and the pale disc under it. Unlit world, so the light is
    // PAINTED — a bright disc and a soft pool on the brick, not a light source.
    box(0.26, 0.09, 0.22, DX, 2.44, SOUTH + 0.11, iron);
    const glowT = declareSurface(pixTex(16, 16, (g) => {
      const r = g.createRadialGradient(8, 8, 1, 8, 8, 8);
      r.addColorStop(0, 'rgba(255,240,196,0.85)');
      r.addColorStop(1, 'rgba(255,240,196,0)');
      g.fillStyle = r; g.fillRect(0, 0, 16, 16);
    }), 'detail');
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5),
      new THREE.MeshBasicMaterial({ map: glowT, transparent: true, depthWrite: false }));
    glow.position.set(DX, Y + 2.15, SOUTH + 0.02);
    glow.userData.alley2 = 'wall';
    add(glow);
  }

  // ── cables crossing overhead, and a washing line ──────────────────────────
  //
  // The strip of sky is the whole character of a slot this narrow, so what
  // crosses it matters more than anything at eye level. All of it is at 4 m+,
  // where it reads against the sky and costs a walker nothing.
  {
    const cable = new THREE.MeshBasicMaterial({ color: 0x1c1e22 });
    for (const [cx, cy] of [[X0 + 2.8, 4.6], [X0 + 7.2, 5.2], [X0 + 11.9, 4.9]] as [number, number][]) {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, Z0 - Z1 + 0.1, 5), cable);
      c.rotation.x = Math.PI / 2;
      c.position.set(cx, Y + cy, (Z0 + Z1) / 2);
      c.userData.alley2 = 'wall';
      add(c);
    }
    // a washing line with three shirts on it — the one thing that says PEOPLE
    // live above this, which is the whole difference from the first alley
    const line = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, Z0 - Z1 + 0.1, 5),
      new THREE.MeshBasicMaterial({ color: 0xb9b2a2 }));
    line.rotation.x = Math.PI / 2;
    line.position.set(X0 + 5.3, Y + 3.9, (Z0 + Z1) / 2);
    line.userData.alley2 = 'wall';
    add(line);
    const shirts = ['#8fa2b8', '#c9c2ae', '#a8867a'];
    shirts.forEach((c, i) => {
      box(0.34, 0.46, 0.02, X0 + 5.3, 3.62, Z1 + 0.55 + i * 0.62,
        new THREE.MeshBasicMaterial({ color: new THREE.Color(c) }));
    });
  }

  // ── a bike chained to the rail by the back door ───────────────────────────
  //
  // Flat against the wall, 0.13 m proud, so it dresses the slot without taking
  // any of the walking room. Recognisable at a glance: two wheels, a frame bar,
  // a saddle.
  {
    const BX = X0 + 14.6;
    const frame = new THREE.MeshBasicMaterial({ color: 0x2f4a58 });
    const tyre = new THREE.MeshBasicMaterial({ color: 0x1a1c20 });
    for (const wx of [-0.32, 0.32]) {
      const w = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.035, 6, 14), tyre);
      w.position.set(BX + wx, Y + 0.30, NORTH - 0.13);
      w.userData.alley2 = 'wall';
      add(w);
    }
    box(0.70, 0.04, 0.03, BX, 0.52, NORTH - 0.13, frame);
    box(0.03, 0.30, 0.03, BX + 0.26, 0.42, NORTH - 0.13, frame);
    box(0.20, 0.05, 0.05, BX - 0.16, 0.66, NORTH - 0.13, frame);          // saddle
    box(0.03, 0.9, 0.03, BX + 0.6, 0.45, NORTH - 0.10, iron);             // the rail
  }

  // ── the pose the rig climbs — see `LadderPose` in fp.ts ───────────────────
  //
  // `y0`/`y1` are FEET heights in world Y: the paving and the roof deck. The
  // two step-off points are chosen off real clearances — `bottom` is 0.75 m
  // out, past the north wall's 0.12 collider plus the 0.3456 player radius
  // and still a metre clear of the pawn side; `top` is 1.1 m inside the roof,
  // past the parapet's 0.3 m upstand.
  return {
    x: LADDER_X, z: Z0 - 0.45, yaw: Math.PI,
    y0: Y, y1: resTop,
    top: { x: LADDER_X, z: Z0 + 1.1 },
    bottom: { x: LADDER_X, z: Z0 - 0.75 },
  };
}
