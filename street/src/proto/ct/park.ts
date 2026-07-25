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
  worn(lx1 - 0.4, gateMid, lx0 + 0.4, gateMid + 4.5, 0.72);    // straight across
  for (const s of [-1, 1]) {
    const cz = s < 0 ? lz0 : lz1;
    worn(lx0 + 0.9, cz + s * -0.9, lx0 + 2.6, cz + s * -2.4, 0.6);   // the cut corners
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
    ctx.seat({
      x: bx, z: bz, yaw, h: 0.45,
      approach: { x: bx + fx * 0.95, z: bz + fz * 0.95 },
      label: 'sit on the bench',
    });
  };
  // one on the street leg looking back across the grass, one at each end of
  // the loop looking down the length of it
  bench(inside(0.34), gateMid + 4.6, -Math.PI / 2);
  // the two end benches sit at the STREET end of each end leg — the middle of
  // a 25 m leg is well past the clamp, so a seat there could not be sat on
  bench(Math.max(lx1 - 4.0, REACH + 0.8), lz0 - 1.05, Math.PI);
  bench(Math.max(lx1 - 6.5, REACH + 0.8), lz1 + 1.05, 0);

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
  const binX = inside(0.23), binZ = gateMid + 1.5;
  const binT = pixTex(8, 14, (g) => {
    g.fillStyle = '#333a2b'; g.fillRect(0, 0, 8, 14);
    g.fillStyle = '#4e5340';
    for (const x of [1, 3, 5]) g.fillRect(x, 2, 1, 10);
    g.fillRect(0, 3, 8, 1); g.fillRect(0, 10, 8, 1);
    g.fillStyle = '#2b3226'; g.fillRect(0, 0, 8, 2); g.fillRect(0, 12, 8, 2);
  });
  const bin = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.8, 0.46), flat(binT));
  bin.position.set(binX, KERB_H + 0.4, binZ);
  scene.add(bin);
  solid({ minX: binX - 0.26, maxX: binX + 0.26, minZ: binZ - 0.26, maxZ: binZ + 0.26 });

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

  return { colliders };
}
