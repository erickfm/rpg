import * as THREE from 'three';
import type { AABB } from '../fp';
import { type Look, citizenAtlas, viewFor } from './citizens';
import { L, ROAD_HALF, FACE } from './rng';
import { ORDER, type CtxBuild } from './ctx';

// ── the crowd: who is on the block, and how they walk it ───────────────────
//
// Split out of crosstown.ts, which was carrying both the cast and the walking
// sim inline. `ct/citizens.ts` is the ATLAS — it paints one person's sprite
// sheet and is shared by three modules, so it stays desk-owned. This file is
// the SIM: the cast list, the steering, the prop avoidance and the politeness
// rules about the player. Nothing here is called from anywhere else.
//
// Lifted verbatim in the split — same cast, same numbers, same order of
// construction, so every texture and position comes back identical.

/** What the crowd needs from the world that the build context does not carry. */
export interface CrowdOpts {
  /** solid props people steer AROUND — trees, lamps, parked cars, and the
   *  moving cruiser's box, which follows it. Read live every frame, so the
   *  list may still be appended to after the crowd is built. */
  citAvoid: AABB[];
  /** register a person's footprint as solid to the PLAYER. People are not in
   *  `citAvoid`, so they phase each other but never a tree. */
  solid: (b: AABB) => void;
  /** the lamplight registry — people walk through the pools too */
  lit: (root: THREE.Object3D) => void;
}

// Six of them, and no two are the same person recoloured. Each carries its
// own height, build, skin, hair shape, garment and walking speed. Build is
// a SILHOUETTE change in the atlas (torso and shoulder width), separate
// from the mesh scale, so the tall ones aren't just the short ones blown up.
//
// Skin runs the full range you'd actually see on a city street, and hair is
// matched to it the way it falls in life rather than assigned at random.
// Everyone is painted by the same routine with the same shading.
interface Person {
  look: Look; hs: number; ws: number; sp: number;
}
const CAST: Person[] = [
  // tall, broad, long coat, close-cropped hair
  { look: { jacket: '#3a4a63', pants: '#2b2f36', skin: '#6b4226', hair: '#141014', fit: 'coat', cut: 'crop', build: 1 },
    hs: 1.09, ws: 1.07, sp: 1.55 },
  // small and quick, ball cap, hair tied back under it
  { look: { jacket: '#7a3a34', pants: '#3f4650', skin: '#e6bb92', hair: '#8c5a2e', fit: 'cap', accent: '#8a3a2e', cut: 'tied', build: -1 },
    hs: 0.91, ws: 0.94, sp: 1.72 },
  // unhurried, long hair, dress
  { look: { jacket: '#3f5a46', pants: '#3f5a46', skin: '#c9946a', hair: '#241a10', fit: 'dress', cut: 'long', build: 0 },
    hs: 0.97, ws: 0.99, sp: 0.68 },
  // heavy-set, hood up, ambling
  { look: { jacket: '#5c5266', pants: '#2b2f36', skin: '#4a2c1a', hair: '#141014', fit: 'hoodie', cut: 'short', build: 1 },
    hs: 1.05, ws: 1.10, sp: 0.86 },
  // slight, older, bald, brisk
  { look: { jacket: '#6a5a3a', pants: '#23262c', skin: '#f0c8a0', hair: '#b8b2a6', fit: 'plain', cut: 'bald', build: -1 },
    hs: 0.94, ws: 0.92, sp: 1.34 },
  // average everything, long dark hair, steady pace
  { look: { jacket: '#37505e', pants: '#2b2f36', skin: '#8d5a34', hair: '#1c1410', fit: 'plain', cut: 'long', build: 0 },
    hs: 1.02, ws: 1.00, sp: 1.08 },
];
// Stride is tied to speed, and so is cadence — but each only by the ROOT of
// it, because a walker who doubles their pace does not double both. Longer
// legs also cover more ground, so height feeds in. Without this a fast
// walker just cycles the same short steps quicker, which reads as skating.
const strideFor = (sp: number, hs: number) =>
  Math.max(2, Math.min(5, Math.round(3.2 * Math.sqrt(sp) * hs)));

interface Citizen { mesh: THREE.Mesh; tex: THREE.Texture; lane: number; home: number; z: number; dir: number; sp: number; ph: number; box: AABB; stuck: number; ghost: boolean; anim: number; cad: number }

export interface Crowd {
  /** test affordance: every person's painted sprite sheet (scripts/people.mjs) */
  atlases: () => string[];
  /** test affordance: who is on the block, how big and how fast */
  people: () => { sp: number; cad: number; hs: number; ws: number; footY: number }[];
}

export function buildCrowd(ctx: CtxBuild, o: CrowdOpts): Crowd {
  const { scene, sidewalkY } = ctx;
  const citizens: Citizen[] = [];

  CAST.forEach((p, i) => {
    const tex = citizenAtlas({ ...p.look, stride: strideFor(p.sp, p.hs) });
    tex.repeat.set(1 / 5, 1 / 2);
    // the geometry is translated so the origin is at the FEET, so scaling
    // height never lifts anyone off the pavement or sinks them into it
    const geo = new THREE.PlaneGeometry(0.95, 1.9);
    geo.translate(0, 0.95, 0);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide }));
    mesh.scale.set(p.ws, p.hs, 1);
    // home lanes sit in the clear strip between the kerb props and the wall
    const lane = (i % 2 ? 1 : -1) * (ROAD_HALF + 1.05 + (i % 3) * 0.17);
    const z = 4 - i * 16; // spread thin over the whole block
    mesh.position.set(lane, sidewalkY, z);
    scene.add(mesh);
    o.lit(mesh);             // people walk through the pools too
    // ±0.25, not ±0.30: bodies read the tiniest bit too wide to slip past.
    // With the rig's 0.36 m radius that puts the gap needed to squeeze by a
    // person at 0.61 m instead of 0.72 m.
    const box: AABB = { minX: lane - 0.25, maxX: lane + 0.25, minZ: z - 0.25, maxZ: z + 0.25 };
    o.solid(box);            // people are solid — the box follows them
    citizens.push({
      mesh, tex, lane, home: lane, z, dir: i % 2 ? 1 : -1, sp: p.sp,
      ph: i * 1.3, box, stuck: 0, ghost: false, anim: i * 1.3,
      cad: 5 * Math.sqrt(p.sp) / p.hs,   // cadence: long legs swing slower
    });
  });

  // is a citizen's footprint clear of every solid PROP (trees, cars, …)?
  // (the player isn't in this set — people phase the player, never props)
  const clearAt = (x: number, z: number) =>
    !o.citAvoid.some((a) => x + 0.28 > a.minX && x - 0.28 < a.maxX && z + 0.28 > a.minZ && z - 0.28 < a.maxZ);

  // citizens: ping-pong the block, show the correct painted angle. They are
  // SOLID and politely halt a step short of you — but if held up against you
  // for a beat (stuck timer), they give up and squeeze through, going
  // non-solid only until they're clear, then solid again. So they never
  // wall you in for good, and never become permanently uncollidable.
  //
  // LATE: the crowd reads the world's finished state — including the moving
  // car's box, which the traffic pass writes at the end of the frame.
  ctx.onFrame(({ dt, px, pz }) => {
    for (const c of citizens) {
      const dist = Math.hypot(px - c.lane, pz - c.z);
      if (dist < 1.05) c.stuck += dt; else c.stuck = Math.max(0, c.stuck - dt * 2);
      if (!c.ghost && c.stuck > 1.4) c.ghost = true;       // fed up → push past YOU
      if (c.ghost && dist > 1.4) { c.ghost = false; c.stuck = 0; } // clear → solid again
      const holding = dist < 1.0 && !c.ghost;              // standing a step short of you
      let moving = !holding;
      if (moving) {
        const s = Math.sign(c.home);
        const nz = c.z + c.dir * c.sp * dt;
        if (clearAt(c.lane, nz)) {
          c.z = nz;
          c.lane += (c.home - c.lane) * Math.min(1, dt * 2); // ease back to home lane
        } else {
          // a solid prop is ahead — step laterally to go AROUND it (never through)
          let target: number | null = null;
          for (const off of [0.45, 0.8, -0.45, 1.15]) {
            const x = c.home + off * s;
            if (Math.abs(x) >= ROAD_HALF + 0.55 && Math.abs(x) <= FACE - 0.35 && clearAt(x, nz)) { target = x; break; }
          }
          if (target !== null) {
            c.lane += (target - c.lane) * Math.min(1, dt * 5);
            if (clearAt(c.lane, c.z + c.dir * c.sp * dt * 0.5)) c.z += c.dir * c.sp * dt * 0.5;
          } else { c.dir *= -1; moving = false; }  // boxed in — turn back
        }
      }
      if (c.z < -L + 4) { c.z = -L + 4; c.dir = 1; }
      if (c.z > 10) { c.z = 10; c.dir = -1; }
      if (c.ghost) {
        c.box.minX = c.box.maxX = 1e5; c.box.minZ = c.box.maxZ = 1e5; // slip past you
      } else {
        c.box.minX = c.lane - 0.25; c.box.maxX = c.lane + 0.25;
        c.box.minZ = c.z - 0.25; c.box.maxZ = c.z + 0.25;
      }
      c.mesh.position.set(c.lane, sidewalkY, c.z);
      c.mesh.rotation.y = Math.atan2(px - c.lane, pz - c.z);
      const facing = Math.atan2(0, c.dir); // 0 for +z, π for -z... atan2(0,-1)=π ✓
      const camAng = Math.atan2(px - c.lane, pz - c.z);
      const [col, mirror] = viewFor(camAng - facing);
      // feet only stride while actually walking; stand still (feet together)
      // when halted, so a stopped person isn't marching in place
      if (moving) c.anim += dt * c.cad;   // per-person cadence, see strideFor
      const row = moving ? Math.floor(c.anim) % 2 : 0;
      c.tex.repeat.x = mirror ? -1 / 5 : 1 / 5;
      c.tex.offset.x = mirror ? (col + 1) / 5 : col / 5;
      c.tex.offset.y = row === 0 ? 0.5 : 0;
    }
  }, ORDER.LATE);

  return {
    atlases: () => citizens.map((c) => (c.tex.image as HTMLCanvasElement).toDataURL()),
    people: () => citizens.map((c) => ({
      sp: c.sp, cad: c.cad, hs: c.mesh.scale.y, ws: c.mesh.scale.x,
      footY: c.mesh.position.y,
    })),
  };
}
