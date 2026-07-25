import * as THREE from 'three';
import type { AABB } from '../fp';
import { BUILD, type CtxBuild } from './ctx';
import { pixTex, dither } from './paint';

// What stands IN the park. `ct/street.ts` owns the SITE — the ground, the two
// party walls the gap exposed, the rear elevation and the low boundary along
// the street line — and hands the extents over; this file owns everything you
// find once you are inside. Same split `ct/civic.ts` already has with the
// library and the church.
//
// This is the first thing on the block that is not a building, and that is
// the whole opportunity: everything else here is a wall you walk past. So the
// job is not "decorate 30 m of grass", it is to make a place you walk INTO —
// which means an edge you cross, and somewhere to walk once you are over it.
//
// The hand is the library's, which the user liked: municipal, once cared
// about, not cared for since. Nothing here is pretty. The paths are the
// cheapest surface a parks department could lay, they go where people
// actually walk, and where they do not, the grass is worn through to dirt
// anyway.

export interface Site { minX: number; maxX: number; minZ: number; maxZ: number; y: number }

// A local LCG, because `rnd()` in ct/rng.ts is the ONE seeded stream and its
// order is load-bearing for every tree height and pigeon in the world
// (GOTCHAS §2). Nothing in here may draw from it.
const clcg = (s: number) => () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);

const PATH = '#7d7565', PATH_D = '#6c6455', PATH_L = '#8d8574';
const DIRT = '#6b5d47', DIRT_D = '#5e5240';

// Takes the build context the whole world is given, plus the site extents
// ct/street.ts published. The entry point already holds both — it reads
// `street.park` for the floor height — so wiring this is one line there and
// nothing has to be threaded through street.ts.
export const ORDER = BUILD.SITE;

/**
 * The world loader's entry point — see `ct/world.ts`. A NEW export beside
 * `buildPark`, which is unchanged: it still takes its site explicitly, so any
 * existing caller keeps working.
 *
 * The site comes from the roster by name now instead of being relayed by the
 * desk. This module was finished and invisible for days waiting on exactly
 * that relay.
 */
export function register(ctx: CtxBuild) {
  const site = ctx.site('park');
  if (!site) { console.warn('[park] the block has no site named "park" — nothing built'); return; }
  buildPark(ctx, site);
}

export function buildPark(ctx: CtxBuild, site: Site, gate?: [number, number]) {
  const { scene, flat, wet, KERB_H, obstacle } = ctx;
  const colliders: AABB[] = [];
  const solid = (b: AABB) => { colliders.push(b); obstacle(b); return b; };

  const W = site.maxZ - site.minZ;                 // the frontage, 30 m
  // the opening in the street-line boundary. Defaults to the middle 28% —
  // what `openSite`'s `gate: 0.36` leaves either side. If D changes that
  // fraction this is the number that has to follow it.
  const [gz0, gz1] = gate ?? [site.minZ + W * 0.36, site.maxZ - W * 0.36];
  const gateMid = (gz0 + gz1) / 2;

  // How far back you can actually GET, which is NOT how far back the park
  // goes. The site is 32 m deep now; `crosstown.ts` still clamps the player
  // at x = -13.4, so 25 m of it cannot be walked into. See notes/BLOCKED-E.md.
  //
  // The layout is laid out at the site's TRUE size anyway, and that is a
  // deliberate call. Built to the clamp instead, the park was a 6 m strip of
  // path in front of 25 m of bare grass inside 13 m walls — which is what the
  // gate looked into, and it is worse than either a shallow park or a deep
  // one. The invisible wall at -13.4 exists either way; this at least makes
  // the space read as a park up to it and past it, and every metre becomes
  // walkable the moment the bound moves. Nothing here needs changing then.
  const REACH = -13.4;
  const backX = site.minX + 3.2;

  // ── THE EDGE LINE ────────────────────────────────────────────────────────
  //
  // The user's standing rule: *"in general we should not encroach the already
  // cramped sidewalk."* So the park has ONE line, and everything it owns is
  // west of it. Bins, benches, piers, planting, paths — all of it. Only the
  // railings and the gate opening touch the pavement, because those ARE the
  // boundary.
  //
  // It was not obeyed and the user photographed the result: the bin stood
  // 0.23 m out on the walk, the bench 0.36 m, the pier's cap 0.07 m. All
  // three were placed off the path rather than off the line, which is the
  // mistake — a rule you have to remember at every call site is a rule that
  // gets forgotten at one of them. `inside()` is that rule as arithmetic:
  // give it a half-width and it hands back the furthest east a thing may
  // stand.
  const KERB_W = 0.25;
  const EDGE_X = site.maxX - KERB_W;              // grass starts here
  const inside = (halfWidth: number) => EDGE_X - halfWidth - 0.05;

  // ── surfaces ─────────────────────────────────────────────────────────────
  //
  // Everything laid on the grass is a flat DECAL 6 mm above it, the way the
  // tree pits in ct/props.ts are — never a billboard, which would stand up on
  // end the moment you looked down at it (GOTCHAS §3). 6 mm because two
  // coplanar surfaces z-fight (§6) and this world has been bitten by that at
  // the corner roads, the sidewalk and the chamfer.
  const LIFT = 0.006;
  // 32 px/m, the ground art's density, and the canvas is sized from the
  // surface's real metres so the texels stay square whatever shape it is.
  const surfaceTex = (wM: number, dM: number, kind: 'path' | 'dirt') => {
    const PW = Math.max(8, Math.round(wM * 32)), PH = Math.max(8, Math.round(dM * 32));
    return pixTex(PW, PH, (g) => {
      const r = clcg(kind === 'path' ? 0x51c0de : 0x2b7f31);
      g.fillStyle = kind === 'path' ? PATH : DIRT;
      g.fillRect(0, 0, PW, PH);
      // the aggregate: hoggin is gravel rolled into clay, so it reads as
      // speckle at two scales rather than as a flat colour
      for (let i = 0; i < Math.round(PW * PH * 0.02); i++) {
        const k = r();
        g.fillStyle = kind === 'path'
          ? (k > 0.72 ? PATH_L : k > 0.34 ? PATH_D : PATH)
          : (k > 0.6 ? DIRT_D : DIRT);
        g.fillRect(Math.floor(r() * PW), Math.floor(r() * PH), 1 + Math.floor(r() * 2), 1);
      }
      // …and the edges go first: grass creeps in from both sides in patches
      g.fillStyle = 'rgba(96,104,78,0.55)';
      for (let i = 0; i < Math.round(PH * 0.5); i++) {
        const y = Math.floor(r() * PH), d = 1 + Math.floor(r() * 4);
        if (r() < 0.5) g.fillRect(0, y, d, 1 + Math.floor(r() * 3));
        else g.fillRect(PW - d, y, d, 1 + Math.floor(r() * 3));
      }
      if (kind === 'path') {                        // a patch of asphalt, once
        g.fillStyle = '#4c4a48';
        const ax = Math.round(PW * 0.2), ay = Math.round(PH * 0.42);
        g.fillRect(ax, ay, Math.round(PW * 0.55), Math.round(PH * 0.06));
        g.fillStyle = 'rgba(0,0,0,0.25)';
        g.fillRect(ax, ay, Math.round(PW * 0.55), 2);
      }
      dither(g, PW, PH, Math.round(wM * dM * 8));
    });
  };
  /** a flat run of surface, laid in the x/z plane */
  const lay = (x0: number, x1: number, z0: number, z1: number, kind: 'path' | 'dirt') => {
    const w = Math.abs(x1 - x0), d = Math.abs(z1 - z0);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), wet(flat(surfaceTex(w, d, kind))));
    m.rotation.x = -Math.PI / 2;
    m.position.set((x0 + x1) / 2, KERB_H + LIFT, (z0 + z1) / 2);
    scene.add(m);
    return m;
  };

  // ── the kerb ─────────────────────────────────────────────────────────────
  //
  // Grass ran straight into the pavement in a raw butt joint at a slightly
  // different level, so it read as two surfaces that happened to meet — worst
  // across the gate, where there is no boundary wall to hide it. A park has a
  // NAMED edge: granite kerb, grass inside it, paving outside, standing a
  // little proud of both so the join is a thing rather than an accident.
  //
  // It ABUTS and never overlaps (GOTCHAS §6): its east face stops 10 mm short
  // of the walk's west face at x = -FACE rather than meeting it exactly,
  // because two coincident vertical faces back to back are precisely what
  // z-fights, and that ragged look in the screenshot may already have been
  // it. The 10 mm is invisible at this world's texel density.
  const kerbT = pixTex(Math.round(KERB_W * 32), 64, (g) => {
    const r = clcg(0x9e31b2), KW = Math.round(KERB_W * 32);
    g.fillStyle = '#8e8b83'; g.fillRect(0, 0, KW, 64);
    for (let i = 0; i < 120; i++) {                 // granite, so speckle not grain
      const k = r();
      g.fillStyle = k > 0.7 ? '#9c998f' : k > 0.35 ? '#84817a' : '#77746d';
      g.fillRect(Math.floor(r() * KW), Math.floor(r() * 64), 1, 1);
    }
    g.fillStyle = 'rgba(40,38,34,0.4)';             // a joint every 1 m
    for (let y = 0; y < 64; y += 32) g.fillRect(0, y, KW, 1);
    g.fillStyle = 'rgba(74,86,58,0.35)';            // moss on the grass side
    for (let i = 0; i < 26; i++) g.fillRect(0, Math.floor(r() * 64), 1 + Math.floor(r() * 2), 1 + Math.floor(r() * 3));
  });
  kerbT.wrapS = kerbT.wrapT = THREE.RepeatWrapping;
  kerbT.repeat.set(1, W / 2);
  const KERB_TOP = 0.08;                            // how proud it stands
  const kerb = new THREE.Mesh(new THREE.BoxGeometry(KERB_W - 0.01, KERB_H + KERB_TOP, W),
    wet(flat(kerbT)));
  kerb.position.set(EDGE_X + (KERB_W - 0.01) / 2 - 0.005, (KERB_H + KERB_TOP) / 2, (site.minZ + site.maxZ) / 2);
  scene.add(kerb);

  // ── the field, and the loop around it ────────────────────────────────────
  //
  // The user's layout, and every part of it is doing something:
  //
  //   THE FIELD is the largest thing in the park, and it is open. Mown grass
  //     and nothing standing in it. A park you can see across is bigger than
  //     a park you cannot, and everything else here is arranged around
  //     keeping this one rectangle clear.
  //   THE LOOP goes AROUND the field, not across it. That is what makes a
  //     small park feel bigger than it is: a circuit has no end to arrive at,
  //     so you walk it rather than crossing it, and 60 m of walking fits in
  //     30 m of park. A path across would halve the field and finish in four
  //     seconds.
  //   The gate opens onto the loop rather than into the middle of the grass.
  //
  // It is all measured off the site extents and the reachable line, so when
  // the park is deepened the field grows and the loop grows with it — the
  // shape is right at 7 m and it is the same shape at 30 m.
  const PATH_W = 1.5;
  // The street leg stands far enough in that a bench and a bin fit BETWEEN it
  // and the kerb, backs to the railings, facing the field. That strip is what
  // the furniture was standing on the pavement for want of.
  const lx0 = backX, lx1 = EDGE_X - 1.35;                    // the loop's legs
  const lz0 = site.minZ + 1.7, lz1 = site.maxZ - 1.7;
  lay(lx0 - PATH_W / 2, lx0 + PATH_W / 2, lz0, lz1, 'path');  // back leg
  lay(lx1 - PATH_W / 2, lx1 + PATH_W / 2, lz0, lz1, 'path');  // street leg
  for (const lz of [lz0, lz1]) {                              // the two ends
    lay(lx0 - PATH_W / 2, lx1 + PATH_W / 2, lz - PATH_W / 2, lz + PATH_W / 2, 'path');
  }
  lay(site.maxX, lx1, gateMid - 1.9 / 2, gateMid + 1.9 / 2, 'path');   // in from the gate

  // The field itself: mown, and mown in stripes, because a parks department
  // mows in stripes and it is the cheapest way to say "this is maintained,
  // just about" over a large flat area that would otherwise be one colour.
  const fx0 = lx0 + PATH_W / 2, fx1 = lx1 - PATH_W / 2;
  const fz0 = lz0 + PATH_W / 2, fz1 = lz1 - PATH_W / 2;
  const fW = fx1 - fx0, fD = fz1 - fz0;
  if (fW > 0.5 && fD > 0.5) {
    const mownT = pixTex(Math.max(8, Math.round(fW * 16)), Math.max(8, Math.round(fD * 16)), (g) => {
      const r = clcg(0x4fd21a);
      const MW = Math.max(8, Math.round(fW * 16)), MH = Math.max(8, Math.round(fD * 16));
      g.fillStyle = '#6e7458'; g.fillRect(0, 0, MW, MH);
      const stripe = Math.max(4, Math.round(1.6 * 16));       // 1.6 m mower width
      for (let z = 0, i = 0; z < MH; z += stripe, i++) {
        if (i % 2) continue;
        g.fillStyle = 'rgba(140,150,110,0.16)';
        g.fillRect(0, z, MW, Math.min(stripe, MH - z));
      }
      g.fillStyle = '#5f6650';                                // the patchy bits
      for (let i = 0; i < Math.round(MW * MH * 0.01); i++) {
        g.fillRect(Math.floor(r() * MW), Math.floor(r() * MH), 1 + Math.floor(r() * 3), 1 + Math.floor(r() * 2));
      }
      g.fillStyle = 'rgba(120,104,72,0.5)';                   // and where it is thin
      for (let i = 0; i < 30; i++) {
        g.fillRect(Math.floor(r() * MW), Math.floor(r() * MH), 2 + Math.floor(r() * 6), 2 + Math.floor(r() * 4));
      }
      dither(g, MW, MH, Math.round(fW * fD * 5));
    });
    const field = new THREE.Mesh(new THREE.PlaneGeometry(fW, fD), wet(flat(mownT)));
    field.rotation.x = -Math.PI / 2;
    field.position.set((fx0 + fx1) / 2, KERB_H + LIFT * 0.5, (fz0 + fz1) / 2);
    scene.add(field);
  }

  // ── the desire lines ─────────────────────────────────────────────────────
  //
  // The loop is the path; these are what people do instead of walking it. Two
  // corners cut, and one straight across the field from the gate — the line
  // everyone takes when they are crossing the park rather than using it, and
  // the one piece of evidence that the loop is a choice.
  const worn = (x0: number, z0: number, x1: number, z1: number, w = 0.75) => {
    const dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, len), wet(flat(surfaceTex(w, len, 'dirt'))));
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = -Math.atan2(dx, dz);
    m.position.set((x0 + x1) / 2, KERB_H + LIFT * 0.75, (z0 + z1) / 2);
    scene.add(m);
  };
  // A NETWORK, not a line. At 7 m one shortcut was the whole story; across a
  // 26 m field one line reads as a scratch. These are the four crossings
  // anybody actually makes — gate to each far corner, gate straight through,
  // and the two corners of the loop nobody walks round.
  worn(lx1 - 0.4, gateMid, lx0 + 0.4, gateMid + 4.5, 0.72);       // straight across
  worn(lx1 - 1.2, gateMid - 1.4, lx0 + 3.0, lz0 + 5.0, 0.66);     // to the south corner
  worn(lx1 - 1.2, gateMid + 1.4, lx0 + 3.0, lz1 - 5.0, 0.66);     // and the north
  for (const sgn of [-1, 1]) {
    const cz = sgn < 0 ? lz0 : lz1;
    worn(lx0 + 0.9, cz - sgn * 0.9, lx0 + 2.6, cz - sgn * 2.4, 0.6);
    worn(lx1 - 0.9, cz - sgn * 0.9, lx1 - 2.6, cz - sgn * 2.4, 0.6);
  }

  // ── the fence ────────────────────────────────────────────────────────────
  //
  // street.ts puts a 0.62 m boundary wall along the street line with the gate
  // left open in the middle. That is an edge but it is not a room: you read a
  // low wall as something to sit on, and an iron fence as something you are
  // inside. So the railings stand ON that wall and the gate gets piers.
  //
  // COUPLING: the wall's height and thickness are street.ts's, not published,
  // and read off here as 0.62 / 0.36. If D changes them these follow.
  const WALL_H = 0.62, WALL_T = 0.36, RAIL_H = 0.95;
  const railTex = (lenM: number) => {
    const RW = Math.max(16, Math.round(lenM * 12)), RH = Math.round(RAIL_H * 12);
    return pixTex(RW, RH, (g) => {
      g.clearRect(0, 0, RW, RH);
      g.fillStyle = '#3a3f39';
      const pitch = Math.max(3, Math.round(0.17 * 12));
      for (let x = 2; x < RW; x += pitch) g.fillRect(x, 2, 2, RH - 3);
      g.fillRect(0, 0, RW, 2);                      // top rail
      g.fillRect(0, RH - 4, RW, 2);                 // bottom rail
      g.fillStyle = '#4a5049';                      // and the rust that follows
      for (let x = 2; x < RW; x += pitch * 3) g.fillRect(x, RH - 10, 2, 7);
    });
  };
  const railM = (lenM: number) => new THREE.MeshBasicMaterial({
    map: railTex(lenM), alphaTest: 0.5, side: THREE.DoubleSide, transparent: true,
  });
  // ct/street.ts stands its boundary wall on the PAVEMENT side of the line
  // (x -7.00…-6.64), so the railings belong at its centre — they were 0.18 m
  // inside the park, floating clear of the wall they are supposed to top.
  const RAIL_X = site.maxX + WALL_T / 2;
  for (const [rz0, rz1] of [[site.minZ + 0.3, gz0], [gz1, site.maxZ - 0.3]] as [number, number][]) {
    const len = rz1 - rz0;
    if (len <= 0.2) continue;
    const rail = new THREE.Mesh(new THREE.PlaneGeometry(len, RAIL_H), railM(len));
    rail.rotation.y = Math.PI / 2;
    rail.position.set(RAIL_X, KERB_H + WALL_H + RAIL_H / 2, (rz0 + rz1) / 2);
    scene.add(rail);
  }
  // the gate piers. Brick, not stone — this is a parks department, not a
  // civic architect, and the library is 90 m away being the other thing.
  const pierT = pixTex(16, 40, (g) => {
    const r = clcg(0x7ac91e);
    g.fillStyle = '#7a4a3a'; g.fillRect(0, 0, 16, 40);
    g.fillStyle = 'rgba(0,0,0,0.22)';
    for (let y = 0; y < 40; y += 5) g.fillRect(0, y, 16, 1);
    for (let y = 0; y < 40; y += 10) for (let x = (y % 20) ? 0 : 4; x < 16; x += 9) g.fillRect(x, y, 1, 5);
    g.fillStyle = 'rgba(0,0,0,0.12)';
    for (let i = 0; i < 14; i++) g.fillRect(Math.floor(r() * 16), Math.floor(r() * 40), 2, 1);
    g.fillStyle = '#8a7a62'; g.fillRect(0, 0, 16, 3);            // coping
  });
  const pierM = flat(pierT);
  const capM = new THREE.MeshBasicMaterial({ color: 0x8a7a62 });
  for (const gz of [gz0, gz1]) {
    const px = inside(0.35), dir = gz === gz0 ? -1 : 1;   // cap included
    const pier = new THREE.Mesh(new THREE.BoxGeometry(0.56, 1.62, 0.56), pierM);
    pier.position.set(px, KERB_H + 0.81, gz + dir * 0.28);
    scene.add(pier);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.13, 0.7), capM);
    cap.position.set(px, KERB_H + 1.69, gz + dir * 0.28);
    scene.add(cap);
    solid({ minX: px - 0.28, maxX: px + 0.28, minZ: gz + dir * 0.28 - 0.28, maxZ: gz + dir * 0.28 + 0.28 });
    // the leaf, standing open against the railing the way a park gate does
    const leaf = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.15), railM(1.2));
    leaf.rotation.y = Math.PI / 2;
    leaf.position.set(px - 0.62, KERB_H + 0.6, gz + dir * 0.86);
    scene.add(leaf);
  }

  // ── what you find once you are in ────────────────────────────────────────
  //
  // Four things, and all of them face INTO the park rather than out at the
  // traffic. A bench turned to the street is a bus stop; a bench turned to
  // the path is a park. That is most of the difference between this and the
  // 30 m of pavement outside it.
  const woodM = new THREE.MeshBasicMaterial({ color: 0x5c4a33 });
  const woodM2 = new THREE.MeshBasicMaterial({ color: 0x51402c });
  const ironM = new THREE.MeshBasicMaterial({ color: 0x39403a });
  const concM = new THREE.MeshBasicMaterial({ color: 0x8a8478 });

  // Benches: heavy cast ends and slatted seat and back, the pattern every
  // parks department in America bolted down and never replaced. They stand
  // along the spine, facing it, which is the only thing there is to look at.
  //
  // SITTABLE, through `ctx.seat` — the user's *"for every seat in the game i
  // want to be able to sit down"*, and F's registration means this needs
  // nothing from the desk. The seat pan is 0.45 above the park floor, and the
  // trigger sits on the seat with the approach out on the path, because the
  // bench's own collider would otherwise keep you further away than `r`.
  // Benches face the FIELD, with their backs to the perimeter — the whole
  // point of the loop is that there is something to look at from it. A bench
  // turned to the street is a bus stop.
  //
  // SITTABLE, through `ctx.seat` — the user's *"for every seat in the game i
  // want to be able to sit down"*, and F's registration means this needs
  // nothing from the desk. The trigger sits ON the pan with its approach out
  // on the path, because the bench's own collider would otherwise hold you
  // further away than `r`.
  const bench = (bx: number, bz: number, yaw: number) => {
    // yaw is axis-aligned for every bench here, so facing and lateral come
    // out as unit axes and every box can be sized exactly rather than rotated
    const fx = Math.round(Math.sin(yaw)), fz = Math.round(-Math.cos(yaw));   // facing
    const lx = Math.round(Math.cos(yaw)), lz = Math.round(Math.sin(yaw));    // across
    const box = (f: number, a: number) => [Math.abs(fx) * f + Math.abs(lx) * a,
      Math.abs(fz) * f + Math.abs(lz) * a] as [number, number];
    const y0 = KERB_H;
    for (const d of [-0.78, 0.78]) {                  // the two cast ends
      const [ew, ed] = box(0.62, 0.1);
      const end = new THREE.Mesh(new THREE.BoxGeometry(ew, 0.44, ed), ironM);
      end.position.set(bx + lx * d, y0 + 0.22, bz + lz * d);
      scene.add(end);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(ew, 0.07, ed), ironM);
      arm.position.set(bx + lx * d, y0 + 0.66, bz + lz * d);
      scene.add(arm);
    }
    for (let i = 0; i < 3; i++) {                     // the seat slats
      const off = -0.21 + i * 0.2;
      const [sw, sd] = box(0.17, 1.7);
      const sl = new THREE.Mesh(new THREE.BoxGeometry(sw, 0.05, sd), i % 2 ? woodM2 : woodM);
      sl.position.set(bx + fx * off, y0 + 0.45, bz + fz * off);
      scene.add(sl);
    }
    for (let i = 0; i < 2; i++) {                     // …and the back, behind you
      const [sw, sd] = box(0.05, 1.7);
      const sl = new THREE.Mesh(new THREE.BoxGeometry(sw, 0.16, sd), i % 2 ? woodM2 : woodM);
      sl.position.set(bx - fx * 0.26, y0 + 0.62 + i * 0.19, bz - fz * 0.26);
      scene.add(sl);
    }
    const [cw, cd] = box(0.34, 0.88);
    solid({ minX: bx - cw, maxX: bx + cw, minZ: bz - cd, maxZ: bz + cd });
    // …and it is a seat, if you can get to it. See the note on the run below.
    if (bx > REACH + 0.6) {
      ctx.seat({
        x: bx, z: bz, yaw, h: 0.45,
        approach: { x: bx + fx * 0.95, z: bz + fz * 0.95 },
        label: 'sit on the bench',
      });
    }
  };
  // A RUN of benches, not a token few. The park went from 7 m deep to 32 —
  // five times the area — and the furniture did not scale with it, which is
  // the whole reason it read as a yard with a bench in it. They stand along
  // the loop at roughly 9 m, close enough that there is always one in view
  // and far enough that two are never in the same shot.
  //
  // Only the ones the player can actually REACH register a seat. The clamp at
  // x = -13.4 has not moved with the depth, so a bench 20 m past it would
  // register as a seat nobody can walk to — F's harness calls that
  // UNREACHABLE and it is right to. They are placed anyway, because you see
  // the whole park from the gate, and they become sittable the moment the
  // bound moves. See notes/BLOCKED-E.md.
  //
  // The run is stepped off the gate rather than off the end of the park, and
  // it SKIPS the entry: the first cut of this walked a bench straight into the
  // gate opening at z = -83 and you could not get in. GOTCHAS §8 — anything
  // near a way in has to treat the approach as reserved space.
  const benchRun: [number, number, number][] = [];
  const clearOfGate = (z: number) => Math.abs(z - gateMid) > 2.6;
  for (let z = gateMid - 26.4; z <= lz1 - 4.5; z += 8.8) {
    if (z < lz0 + 4.0 || !clearOfGate(z)) continue;
    benchRun.push([lx1 + PATH_W / 2 + 0.42, z, -Math.PI / 2]);          // street leg
    if (z > lz0 + 8 && z < lz1 - 8) benchRun.push([lx0 - PATH_W / 2 - 0.42, z, Math.PI / 2]);
  }
  benchRun.push([lx1 - 5.5, lz0 - 1.05, Math.PI]);                      // the two ends
  benchRun.push([lx1 - 9.0, lz1 + 1.05, 0]);
  for (const [bx, bz, yaw] of benchRun) bench(bx, bz, yaw);

  // The drinking fountain. Municipal, chipped, and it has not worked in
  // years — which is the same sentence as the library, and on purpose.
  const fx = lx1 - PATH_W / 2 - 0.45, fz = gateMid - 3.4;   // west of the loop, well inside
  const fPed = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.86, 0.34), concM);
  fPed.position.set(fx, KERB_H + 0.43, fz);
  scene.add(fPed);
  const fBowl = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.44), concM);
  fBowl.position.set(fx, KERB_H + 0.93, fz);
  scene.add(fBowl);
  const fBasin = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.04, 0.26), new THREE.MeshBasicMaterial({ color: 0x4e5a52 }));
  fBasin.position.set(fx, KERB_H + 1.0, fz);
  scene.add(fBasin);
  const fSpout = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.06), ironM);
  fSpout.position.set(fx + 0.15, KERB_H + 1.05, fz);
  scene.add(fSpout);
  solid({ minX: fx - 0.3, maxX: fx + 0.3, minZ: fz - 0.28, maxZ: fz + 0.28 });

  // The bin, by the gate where the litter actually is
  const binT = pixTex(8, 14, (g) => {
    g.fillStyle = '#333a2b'; g.fillRect(0, 0, 8, 14);
    g.fillStyle = '#4e5340';
    for (const x of [1, 3, 5]) g.fillRect(x, 2, 1, 10);
    g.fillRect(0, 3, 8, 1); g.fillRect(0, 10, 8, 1);
    g.fillStyle = '#2b3226'; g.fillRect(0, 0, 8, 2); g.fillRect(0, 12, 8, 2);
  });
  // ── planting ─────────────────────────────────────────────────────────────
  //
  // The rear elevation IS the view from the gate at this depth — 13 m of
  // blank brick 7 m away — and the only thing that can be done about it
  // until the park is deepened is to break its base. There is exactly 0.75 m
  // between the back leg of the loop and the wall, so the hedge is 0.65 deep
  // and lives entirely in it. Its collider stops you 0.36 m short, which is
  // beside the path and not on it — walked, not assumed.
  //
  // It is a privet hedge that nobody has cut square in years: it runs in
  // lengths with gaps where bits have died out, and it is taller at one end
  // than the other. What this actually wants is TREES along the back, which
  // are ct/props.ts and builder B's — asked for through the desk rather than
  // reached into (GOTCHAS §2: the seeded stream's order is load-bearing).
  const shrubT = pixTex(16, 16, (g) => {
    const r = clcg(0x3ea77c);
    g.fillStyle = '#3f5232'; g.fillRect(0, 0, 16, 16);
    for (let i = 0; i < 90; i++) {
      const k = r();
      g.fillStyle = k > 0.62 ? '#4e6440' : k > 0.3 ? '#374a2c' : '#2b3a23';
      g.fillRect(Math.floor(r() * 16), Math.floor(r() * 16), 1 + Math.floor(r() * 2), 1);
    }
  });
  const shrubM = flat(shrubT);
  const rb = clcg(0x11d0ee);
  const hedgeX = site.minX + 0.33;                  // 0.65 deep against the wall
  for (let z = site.minZ + 1.2; z < site.maxZ - 1.2;) {
    const run = 3.0 + rb() * 4.0;
    const end = Math.min(z + run, site.maxZ - 1.2);
    const h = 1.5 + rb() * 0.55;
    const seg = new THREE.Mesh(new THREE.BoxGeometry(0.65, h, end - z), shrubM);
    seg.position.set(hedgeX, KERB_H + h / 2, (z + end) / 2);
    scene.add(seg);
    solid({ minX: site.minX, maxX: site.minX + 0.7, minZ: z, maxZ: end });
    z = end + 0.9 + rb() * 1.6;                     // the gaps where it died out
  }
  // and a shrub in each corner by the railings, where the mower never reaches
  for (const cz of [site.minZ + 0.62, site.maxZ - 0.62]) {
    const h = 1.1 + rb() * 0.7, w = 0.82;
    const sh = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), shrubM);
    sh.position.set(lx1 - 0.2, KERB_H + h / 2, cz);
    scene.add(sh);
    solid({ minX: lx1 - 0.2 - w / 2, maxX: lx1 - 0.2 + w / 2, minZ: cz - w / 2, maxZ: cz + w / 2 });
  }

  // Bins where the benches are, because that is where the litter is.
  for (const bz of [gateMid + 3.2, lz0 + 6.0, lz1 - 6.0, gateMid - 12.5]) {
    const bx2 = inside(0.23);
    const b2 = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.8, 0.46), flat(binT));
    b2.position.set(bx2, KERB_H + 0.4, bz);
    scene.add(b2);
    solid({ minX: bx2 - 0.26, maxX: bx2 + 0.26, minZ: bz - 0.26, maxZ: bz + 0.26 });
  }

  // The noticeboard at the gate. Every municipal park has one and nothing on
  // it is current: a byelaws plate nobody reads and the ghost of a poster.
  const nbT = pixTex(28, 20, (g) => {
    g.fillStyle = '#2e3a2c'; g.fillRect(0, 0, 28, 20);
    g.fillStyle = '#cfc9b8'; g.fillRect(2, 2, 24, 15);
    g.fillStyle = '#8d8878';
    for (let y = 5; y < 15; y += 2) g.fillRect(4, y, 20, 1);
    g.fillStyle = '#6a6456'; g.fillRect(4, 3, 20, 2);
    g.fillStyle = 'rgba(120,110,80,0.5)'; g.fillRect(15, 7, 9, 8);
  });
  const nbX = inside(0.28), nbZ = gateMid - 2.6;
  const nb = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.72, 1.0), flat(nbT));
  nb.position.set(nbX, KERB_H + 1.28, nbZ);
  scene.add(nb);
  for (const d of [-0.4, 0.4]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.6, 0.09), ironM);
    post.position.set(nbX, KERB_H + 0.8, nbZ + d);
    scene.add(post);
  }
  solid({ minX: nbX - 0.3, maxX: nbX + 0.3, minZ: nbZ - 0.55, maxZ: nbZ + 0.55 });

  // ── the loop, edged ──────────────────────────────────────────────────────
  //
  // A municipal path has an edging strip holding the grass off it, and
  // without one the loop's edges dissolve into the field at any distance.
  // Same granite as the frontage kerb, laid flat rather than proud.
  const edgeM = new THREE.MeshBasicMaterial({ color: 0x8a8780 });
  const edging = (x0: number, x1: number, z0: number, z1: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(Math.abs(x1 - x0), 0.07, Math.abs(z1 - z0)), edgeM);
    m.position.set((x0 + x1) / 2, KERB_H + 0.035, (z0 + z1) / 2);
    scene.add(m);
  };
  for (const lx of [lx0, lx1]) {
    for (const d of [-1, 1]) edging(lx + d * PATH_W / 2 - 0.06, lx + d * PATH_W / 2 + 0.06, lz0, lz1);
  }
  for (const lz of [lz0, lz1]) {
    for (const d of [-1, 1]) edging(lx0, lx1, lz + d * PATH_W / 2 - 0.06, lz + d * PATH_W / 2 + 0.06);
  }

  // ── ivy on the walls ─────────────────────────────────────────────────────
  //
  // Three blank brick flanks are what make it a yard, and the trees that
  // would really break them up are ct/props.ts and builder B's. What this
  // file CAN do is grow ivy up them: alpha-tested patches with a ragged top
  // edge, at different heights, so the wall reads as an old boundary rather
  // than as a new one. It does not fix the yard on its own — see
  // notes/BLOCKED-E.md — but it is the half that is mine.
  const ivyT = (seed: number, wM: number, hM: number) => {
    const IW = Math.max(16, Math.round(wM * 6)), IH = Math.max(16, Math.round(hM * 6));
    return pixTex(IW, IH, (g) => {
      const r = clcg(seed);
      g.clearRect(0, 0, IW, IH);
      for (let x = 0; x < IW; x++) {
        const top = Math.round(IH * (0.12 + 0.5 * Math.abs(Math.sin(x * 0.21 + seed))));
        for (let y = top; y < IH; y++) {
          if (y < top + 3 && r() < 0.45) continue;          // a ragged growing edge
          const k = r();
          g.fillStyle = k > 0.68 ? '#4a6238' : k > 0.34 ? '#3b5130' : '#2e4126';
          g.fillRect(x, y, 1, 1);
        }
      }
    });
  };
  const ivy = (x: number, z: number, wM: number, hM: number, ry: number, seed: number) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(wM, hM), new THREE.MeshBasicMaterial({
      map: ivyT(seed, wM, hM), alphaTest: 0.5, side: THREE.DoubleSide, transparent: true,
    }));
    m.position.set(x, hM / 2, z);
    m.rotation.y = ry;
    scene.add(m);
  };
  const iv = clcg(0x5b1ea2);
  for (let z = site.minZ + 2; z < site.maxZ - 2;) {          // the back wall
    const w2 = 4 + iv() * 5;
    ivy(site.minX + 0.06, z + w2 / 2, w2, 6.0 + iv() * 4.0, Math.PI / 2, 0x31 + Math.round(z));
    z += w2 + 1 + iv() * 3;
  }
  for (const [zAt, ry] of [[site.minZ + 0.06, 0], [site.maxZ - 0.06, Math.PI]] as [number, number][]) {
    for (let x = site.minX + 2; x < site.maxX - 4;) {        // and the two flanks
      const w2 = 4 + iv() * 5;
      ivy(x + w2 / 2, zAt, w2, 5.0 + iv() * 3.5, ry, 0x77 + Math.round(x));
      x += w2 + 2 + iv() * 4;
    }
  }

  // ── the one thing to look at ─────────────────────────────────────────────
  //
  // A park needs a reason to walk round it, and it goes where the loop turns
  // so that the turn is the reason. A borough war memorial: two steps, a
  // plinth with a plaque nobody has read in years, and a stone shaft. It is
  // the most municipal object there is, it is the right period, and it gives
  // the loop a destination that is not the gate you came in by.
  const memX = lx1 - 4.2, memZ = lz1 - 4.2;
  const stoneA = new THREE.MeshBasicMaterial({ color: 0x9a958a });
  const stoneB = new THREE.MeshBasicMaterial({ color: 0x8a8478 });
  for (const [i, w2] of [[0, 2.4], [1, 1.9]] as [number, number][]) {
    const st = new THREE.Mesh(new THREE.BoxGeometry(w2, 0.18, w2), i % 2 ? stoneB : stoneA);
    st.position.set(memX, KERB_H + 0.09 + i * 0.18, memZ);
    scene.add(st);
  }
  const plinthT = pixTex(16, 20, (g) => {
    const r = clcg(0x2f81aa);
    g.fillStyle = '#928c80'; g.fillRect(0, 0, 16, 20);
    for (let i = 0; i < 40; i++) {
      g.fillStyle = r() > 0.5 ? '#9c968a' : '#857f74';
      g.fillRect(Math.floor(r() * 16), Math.floor(r() * 20), 1, 1);
    }
    g.fillStyle = '#6e6a5e'; g.fillRect(3, 6, 10, 8);            // the plaque
    g.fillStyle = 'rgba(210,204,188,0.35)';
    for (let y = 8; y < 13; y += 2) g.fillRect(4, y, 8, 1);
    g.fillStyle = 'rgba(46,38,30,0.25)';                          // and its weather
    for (let i = 0; i < 10; i++) g.fillRect(Math.floor(r() * 16), 14, 1, Math.round(r() * 6));
  });
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.3, 1.15), flat(plinthT));
  plinth.position.set(memX, KERB_H + 0.36 + 0.65, memZ);
  scene.add(plinth);
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.62, 2.5, 0.62), stoneA);
  shaft.position.set(memX, KERB_H + 1.66 + 1.25, memZ);
  scene.add(shaft);
  const capStone = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), stoneB);
  capStone.position.set(memX, KERB_H + 4.12, memZ);
  scene.add(capStone);
  solid({ minX: memX - 1.25, maxX: memX + 1.25, minZ: memZ - 1.25, maxZ: memZ + 1.25 });

  // ── signs of use ─────────────────────────────────────────────────────────
  //
  // *"come at this with some more life and energy"* — and life in a park like
  // this one is not ornament, it is EVIDENCE that people are here when you
  // are not. A park with nothing dropped in it reads as a model of a park.
  // All of it lies flat as a decal (GOTCHAS §3: a billboard would stand on
  // end the moment you looked down) except the trolley, which is the joke.
  const litterT = (seed: number, kind: 'paper' | 'can' | 'leaves') => pixTex(16, 16, (g) => {
    const r = clcg(seed);
    g.clearRect(0, 0, 16, 16);
    if (kind === 'paper') {
      g.fillStyle = '#cfc9b4';
      for (let i = 0; i < 5; i++) g.fillRect(3 + Math.floor(r() * 8), 4 + Math.floor(r() * 8), 3 + Math.floor(r() * 3), 2);
      g.fillStyle = 'rgba(120,112,92,0.55)'; g.fillRect(5, 8, 6, 1);
    } else if (kind === 'can') {
      g.fillStyle = '#9aa2a6'; g.fillRect(6, 6, 5, 3);
      g.fillStyle = '#7a3e3c'; g.fillRect(6, 7, 5, 1);
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(6, 9, 5, 1);
    } else {
      for (let i = 0; i < 22; i++) {
        const k = r();
        g.fillStyle = k > 0.6 ? '#6a5a32' : k > 0.3 ? '#7b6a3c' : '#54492a';
        g.fillRect(Math.floor(r() * 16), Math.floor(r() * 16), 1 + Math.floor(r() * 2), 1);
      }
    }
  });
  const drop = (x: number, z: number, sz: number, kind: 'paper' | 'can' | 'leaves', seed: number) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(sz, sz), new THREE.MeshBasicMaterial({
      map: litterT(seed, kind), alphaTest: 0.5, side: THREE.DoubleSide, transparent: true,
    }));
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = seed;
    m.position.set(x, KERB_H + LIFT * 1.5, z);
    scene.add(m);
  };
  const lr = clcg(0x7c1de3);
  for (let i = 0; i < 14; i++) {                       // blown against the kerbs
    const along = lr();
    const z = site.minZ + 2 + along * (W - 4);
    const x = lr() < 0.55 ? lx1 + PATH_W / 2 + 0.2 + lr() * 0.9 : lx1 - PATH_W / 2 - 0.3 - lr() * 3.5;
    drop(x, z, 0.3 + lr() * 0.25, lr() < 0.45 ? 'paper' : 'can', 0x100 + i * 7);
  }
  for (let i = 0; i < 9; i++) {                        // leaf drift in the corners
    const cx = lr() < 0.5 ? site.minX + 1.6 + lr() * 3 : lx1 - lr() * 3;
    const cz = lr() < 0.5 ? site.minZ + 1.6 + lr() * 4 : site.maxZ - 1.6 - lr() * 4;
    drop(cx, cz, 1.1 + lr() * 0.9, 'leaves', 0x200 + i * 11);
  }

  // A trolley from the supermarket that is not on this block, on its side in
  // the grass. Nobody in the parks department is coming for it.
  const trolleyM = new THREE.MeshBasicMaterial({ color: 0x9aa0a4 });
  const meshT = pixTex(12, 10, (g) => {
    g.clearRect(0, 0, 12, 10);
    g.fillStyle = '#9aa0a4';
    for (let x = 0; x < 12; x += 3) g.fillRect(x, 0, 1, 10);
    for (let y = 0; y < 10; y += 3) g.fillRect(0, y, 12, 1);
  });
  const tx = lx0 + 3.4, tz = gateMid - 7.5;
  for (const [dx, dz, ry] of [[0, 0, 0], [0.42, 0, 0], [0.21, 0.3, Math.PI / 2]] as [number, number, number][]) {
    const side = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.42), new THREE.MeshBasicMaterial({
      map: meshT, alphaTest: 0.5, side: THREE.DoubleSide, transparent: true,
    }));
    side.position.set(tx + dx, KERB_H + 0.21, tz + dz);
    side.rotation.y = ry;
    scene.add(side);
  }
  for (const [wx2, wz2] of [[-0.2, -0.18], [0.55, -0.18]] as [number, number][]) {
    const wheel = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.05), trolleyM);
    wheel.position.set(tx + wx2, KERB_H + 0.33, tz + wz2);
    scene.add(wheel);
  }
  solid({ minX: tx - 0.35, maxX: tx + 0.75, minZ: tz - 0.35, maxZ: tz + 0.5 });

  return { colliders };
}
