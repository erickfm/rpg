import * as THREE from 'three';
import type { CtxBuild } from './ctx';
import { pixTex, dither, declareSurface } from './paint';
import { buildRoom } from './interior';
import { type DoorDecl } from './doors';

// THE BODEGA, inside — rebuilt on the interior kit.
//
// The user: *"bodega is also a bit small and sad. and the people inside these
// places are always flat and not like the people on the street."*
//
// It was the one room never built on the kit — it predated it — and it showed
// in every way the kit exists to prevent: paper-thin walls with no jambs, no
// reveal on the doorway, its own hand-rolled lighting, a floor picker special
// case in the entry point, and a keeper who was one painted plane. This is
// that room brought onto `buildRoom` like every other, and then made CRAMMED,
// which is the actual character note.
//
// What makes a corner bodega a bodega, and none of it is the size: aisles too
// narrow for two people, stock to the ceiling, a deli case, coffee going all
// day, lottery and cigarettes locked behind the counter where they can be
// watched, handwritten card signs, and a cat asleep on something. It is a
// shop with more stock than room, run by someone who knows where all of it is.
//
// ── the door ──
//
// On the CANTED BAY, cut at 45° across the corner — not on a flat frontage.
// D reported the geometry: the cut face runs A (7, -94) to B (9, -96), so its
// midpoint and the drawn door is (8.0, -95.0), outward normal (-1,-1)/root 2.
//
// THE FACADE IS APPROVED and does not move — *"do not change the facade i love
// it just make the entrance where i press e actually aligned"* — so this feeds
// the [E] spot only. ct/doors.ts skips chamfered doors when it tells the
// painter where to draw.
export const DOOR: DoorDecl = {
  building: 'BODEGA', w: 10, cz: -95, side: 1, at: 0, width: 1.1,
  face: { x: 8.0, z: -95.0, nx: -Math.SQRT1_2, nz: -Math.SQRT1_2 },
};

export function buildBodega(ctx: CtxBuild): void {
  const room = buildRoom(ctx, {
    id: 'bodega',
    label: 'into the BODEGA',
    // Bigger than the 8 x 8 box it was, and LOWER — 2.6 m, the lowest ceiling
    // in the world. The cramped feeling is height as much as floor area: a
    // corner shop with a generous ceiling reads as a minimart.
    // 11.0 DEEP, up from 8.4, and the ceiling stays at 2.6.
    //
    // The desk owning the same overshoot it owned on the thrift: *"I told you
    // to make the bodega CRAMMED — narrow aisles, stock to the ceiling. It has
    // overshot the same way. Grow the room; keep every fixture. Crowded is
    // right for a bodega, unwalkable is not."*
    //
    // Every fixture stays; the floor grows under them. 8.8 x 11.0 is 97 m2
    // against 74. The HEIGHT is deliberately untouched — 2.6 is low on purpose
    // and low ceiling is half of what makes a corner shop feel like one. It is
    // floor the player was short of, not headroom.
    d: 11.0, h: 2.6,
    // THE CUT CORNER, matching the building. The user: "if the door for the
    // bodega is on a cut corner (literally) then the interior should match."
    //
    // Outside, the canted bay runs A(7, -94) to B(9, -96) — a 2.83 m face at
    // 45° across the +x/+z corner, which is the street corner and the one the
    // player walks up to. `front-right` is that same corner in room-local
    // terms, and 2.0 of cut along each wall reproduces its length: hypot(2,2)
    // = 2.83, the face's own measurement rather than a number that looks right.
    // The kit CAN put the door in the cut — `door: true` on this line, and the
    // diagonal builds as two segments with the opening between them. It is not
    // switched on here yet, and the reason is not the geometry: with it set the
    // room drops 25/25 -> 20/25 because five checks locate "the inside of the
    // door" from the FRONT WALL, and the door is no longer in that wall.
    //
    // So the door-in-cut needs interiors-walk to take the doorway from the room
    // rather than assume the front wall — the same "ask, do not remember" the
    // room dimensions already went through. Shape now, door when the harness
    // can follow it, because a room that walks red is a room nobody can verify
    // the next change against.
    chamfer: { corner: 'front-right', cut: 2.0 },
    palette: { floor: 0xa89e88, wall: 0xc4c8b4, ceil: 0xbcbcae, trim: 0x5a4a34 },
    // Fluorescent battens, and all three work. A bodega is over-lit on
    // purpose — it is open at 2am and the light is half of why you go in.
    light: { kind: 'strip', tint: 0xe8f0e4, count: 3 },
    frontage: { name: 'BODEGA', w: 10, cz: -95, side: 1 },
    // 1.8. Each bump has been a measurement, not a guess, and each measured a
    // different approach — which is the story of a door in a recessed 45°
    // bay:
    //
    //   1.05 -> 1.3   the flat-frontage default only reached the bay
    //                 diagonally; you clipped the corner of the radius
    //   1.3  -> 1.5   walking AT the door from the side street you come to
    //                 rest against the wing wall 1.38 m out, outside 1.3, so
    //                 the prompt appeared mid-stride and was gone once you
    //                 stopped
    //   1.5  -> 1.8   request-audit's 2D patch sweep: the trigger is large and
    //                 healthy, 2.4 x 2.4 m over 109 standable points, but its
    //                 nearest edge is x 6.2 and THE PAVEMENT CENTRELINE IS
    //                 x 5.9. "My line sweep missed it by 30 cm, and so does a
    //                 player." Every other door on the block reaches the
    //                 centreline; this was the only one that did not.
    //
    // The cause is geometric and does not go away: the centre sits deep in the
    // recess, so the same radius that covers a flat frontage falls short here
    // by exactly the depth of the bay. Nearest neighbouring spot is 5.4 m
    // away, so there is no overlap to buy at this size.
    //
    // THERE IS A CEILING AT ~1.90 AND I DID NOT CHECK IT WHEN I WENT TO 1.8.
    // ct/interior.ts:859 guards against stepping out INTO the trigger you just
    // used — "that has shipped once" — with `outGap < doorR + 0.35`. Measured
    // here: you enter at the bay and come out at (5.88, -97.12), which is
    //
    //     2.248 m from this spot's centre
    //     r 1.5 needed 1.85   margin +0.398
    //     r 1.8 needed 2.15   margin +0.098   <- where it stands
    //     r > 1.898 trips the guard
    //
    // So the centreline fix spent three quarters of the margin. It passes, and
    // it is the right radius, but anyone reaching for 2.0 to solve some future
    // approach will trip a guard whose whole point is that the failure it
    // catches is invisible until someone walks it. Move the way-out first.
    door: { r: 1.8, at: DOOR.at, width: DOOR.width },
  });

  const { put, solid } = room;
  const hw = room.W / 2, hd = room.D / 2;
  const steelM = new THREE.MeshBasicMaterial({ color: 0xa8a49a });
  const woodM = new THREE.MeshBasicMaterial({ color: 0x6a5442 });

  // ── the floor: scuffed vinyl tile, not a checker ──
  const vinylT = declareSurface(pixTex(32, 32, (g) => {
    g.fillStyle = '#9a9080'; g.fillRect(0, 0, 32, 32);
    for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
      g.fillStyle = (x + y) % 2 ? '#a89e88' : '#948a78';
      g.fillRect(x * 16, y * 16, 15, 15);
    }
    dither(g, 32, 32, 70);
  }), 'ground');
  vinylT.wrapS = vinylT.wrapT = THREE.RepeatWrapping;
  vinylT.repeat.set(Math.round(room.W / 1.2), Math.round(room.D / 1.2));
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(room.W, room.D), ctx.flat(vinylT));
  floor.rotation.x = -Math.PI / 2;
  put(floor, 0, 0.012, 0);

  // ── the gondolas ──
  //
  // Stock to the ceiling, in runs down the room with aisles between them.
  // 0.95 m of clear aisle: the player is 0.72 across, so you fit and not much
  // else does, which is the whole point. Wider and it is a supermarket.
  const stockT = declareSurface(pixTex(64, 48, (g) => {
    g.fillStyle = '#7a7263'; g.fillRect(0, 0, 64, 48);
    const cols = ['#b8342a', '#d8b84a', '#3a6a8a', '#4a7a52', '#c86a2a', '#8a4a7a',
      '#d8d0c0', '#6a5a3a', '#2a8a7a', '#b85a5a'];
    // five shelves, each a tight row of boxes and cans
    for (let sh = 0; sh < 5; sh++) {
      const y0 = 2 + sh * 9;
      g.fillStyle = '#5a5348'; g.fillRect(0, y0 + 7, 64, 2);      // the shelf edge
      let x = 0, i = sh * 7;
      while (x < 64) {
        const w = 3 + ((i * 5) % 4);
        g.fillStyle = cols[(i * 3) % cols.length];
        g.fillRect(x, y0, w - 1, 7);
        g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(x, y0, w - 1, 1);
        x += w; i++;
      }
    }
    dither(g, 64, 48, 60);
  }), 'detail');
  const GOND_L = room.D - 3.2;            // leaves the front and back clear
  const GOND_Z = -0.35;
  const AISLE = 0.95;
  const GOND_W = 0.62;
  const gondXs = [-hw + 1.5, -hw + 1.5 + GOND_W + AISLE, -hw + 1.5 + 2 * (GOND_W + AISLE)];
  for (const gx of gondXs) {
    const body = new THREE.Mesh(new THREE.BoxGeometry(GOND_W, 1.95, GOND_L), steelM);
    put(body, gx, 0.975, GOND_Z);
    for (const sx of [-1, 1]) {
      const st = stockT.clone();
      st.wrapS = st.wrapT = THREE.RepeatWrapping;
      st.repeat.set(GOND_L / 2.4, 1);
      st.needsUpdate = true;
      const face = new THREE.Mesh(new THREE.PlaneGeometry(GOND_L, 1.85), ctx.flat(st));
      face.rotation.y = sx > 0 ? Math.PI / 2 : -Math.PI / 2;
      put(face, gx + sx * (GOND_W / 2 + 0.01), 0.98, GOND_Z);
    }
    solid(gx, GOND_Z, GOND_W, GOND_L);
  }

  // ── the cooler, the whole back wall ──
  const coolerT = declareSurface(pixTex(96, 48, (g) => {
    g.fillStyle = '#2a3a42'; g.fillRect(0, 0, 96, 48);
    g.fillStyle = '#5a7a86'; g.fillRect(2, 2, 92, 44);            // lit glass
    const cols = ['#b8342a', '#e0d84a', '#3a6a8a', '#4a7a52', '#d8d0c0'];
    for (let sh = 0; sh < 4; sh++) {
      const y0 = 4 + sh * 11;
      g.fillStyle = '#33434a'; g.fillRect(2, y0 + 9, 92, 2);
      for (let i = 0; i < 22; i++) {
        g.fillStyle = cols[(i * 3 + sh) % cols.length];
        g.fillRect(4 + i * 4, y0, 3, 9);
      }
    }
    g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(2, 2, 92, 3);
    for (const dx of [24, 48, 72]) { g.fillStyle = '#1e2a30'; g.fillRect(dx, 2, 2, 44); }
    dither(g, 96, 48, 30);
  }), 'detail');
  const cooler = new THREE.Mesh(new THREE.PlaneGeometry(room.W - 1.2, 2.05), ctx.flat(coolerT));
  put(cooler, 0, 1.05, -hd + 0.06);
  solid(0, -hd + 0.3, room.W - 1.2, 0.6);

  // ── the counter, by the door, and everything behind it ──
  //
  // The lottery and the cigarettes are the one part of the shop the customer
  // cannot reach, which is exactly why they are the part worth drawing.
  // BACK FROM THE CORNER, because the door is in the corner now.
  //
  // At `hd - 2.6` the counter's collider spanned z 1.6…4.2 and the cut door's
  // approach runs through (2.76, 3.86) — so the entrance opened straight into
  // the till. Measured, not guessed: walking out along the doorway's own normal
  // was blocked at 0.6, 0.9, 1.3 and 1.8 m and clear only at 2.5.
  //
  // A corner shop puts its counter where it can watch the door, not across it.
  // `hd - 4.6` keeps it on the same wall, still facing the entrance, with the
  // corner itself left as the way in.
  const CTR_X = hw - 1.5, CTR_Z = hd - 4.6;
  const ctrTopT = declareSurface(pixTex(64, 16, (g) => {
    g.fillStyle = '#b0a692'; g.fillRect(0, 0, 64, 16);
    g.fillStyle = 'rgba(90,70,50,0.22)';
    for (let i = 0; i < 70; i++) g.fillRect(Math.floor(Math.random() * 64), Math.floor(Math.random() * 16), 1, 1);
  }), 'detail');
  const counterBody = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.02, 2.6), woodM);
  put(counterBody, CTR_X, 0.51, CTR_Z);
  const ctrTop = new THREE.Mesh(new THREE.BoxGeometry(1.08, 0.06, 2.68), ctx.flat(ctrTopT));
  put(ctrTop, CTR_X, 1.05, CTR_Z);
  solid(CTR_X, CTR_Z, 1.0, 2.6);

  const backT = pixTex(64, 64, (g) => {
    g.fillStyle = '#6a6152'; g.fillRect(0, 0, 64, 64);
    // cigarettes, in their rack
    g.fillStyle = '#4a4438'; g.fillRect(2, 2, 60, 26);
    for (let r = 0; r < 3; r++) for (let i = 0; i < 15; i++) {
      g.fillStyle = ['#d8d0c0', '#b8342a', '#2a6a4a', '#d8b84a', '#3a5a8a'][(i + r) % 5];
      g.fillRect(3 + i * 4, 4 + r * 8, 3, 7);
    }
    // lottery, in strips
    g.fillStyle = '#2a3a5a'; g.fillRect(2, 32, 60, 16);
    for (let i = 0; i < 8; i++) {
      g.fillStyle = ['#e0c84a', '#e07a3a', '#4ac8d8'][i % 3];
      g.fillRect(4 + i * 7, 34, 6, 12);
    }
    g.fillStyle = '#d8d0c0'; g.font = 'bold 7px monospace';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('LOTTO', 32, 54);
    dither(g, 64, 64, 40);
  });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 1.9), ctx.flat(backT));
  back.rotation.y = -Math.PI / 2;
  put(back, hw - 0.06, 1.35, CTR_Z);

  const reg = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.28, 0.32),
    new THREE.MeshBasicMaterial({ color: 0x3a3a3e }));
  put(reg, CTR_X, 1.22, CTR_Z + 0.7);

  // ── the deli case and the coffee station ──
  const deliT = declareSurface(pixTex(64, 24, (g) => {
    g.fillStyle = 'rgba(200,220,226,0.32)'; g.fillRect(0, 0, 64, 24);
    g.fillStyle = '#cfc7b6'; g.fillRect(0, 0, 64, 2); g.fillRect(0, 22, 64, 2);
    const meats = ['#b8645a', '#d8a08a', '#8a4a3a', '#e0d0a0', '#c88a6a'];
    for (let i = 0; i < 9; i++) {
      g.fillStyle = meats[i % meats.length];
      g.fillRect(2 + i * 7, 12, 5, 8);
      g.fillStyle = '#e8e4d8'; g.fillRect(2 + i * 7, 5, 5, 5);
    }
  }), 'detail');
  const deli = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.1, 0.72), woodM);
  put(deli, -hw + 1.6, 0.55, hd - 1.5);
  const deliGlass = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 0.6),
    new THREE.MeshBasicMaterial({ map: deliT, transparent: true, opacity: 0.92, side: THREE.DoubleSide }));
  put(deliGlass, -hw + 1.6, 0.72, hd - 1.5 - 0.37);
  solid(-hw + 1.6, hd - 1.5, 2.2, 0.72);

  const urnM = new THREE.MeshBasicMaterial({ color: 0x2e3236 });
  const coffeeBench = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.92, 0.55), woodM);
  put(coffeeBench, -hw + 1.0, 0.46, -hd + 1.4);
  for (const dx of [-0.38, 0, 0.38]) {
    const urn = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.42, 8), urnM);
    put(urn, -hw + 1.0 + dx, 1.13, -hd + 1.4);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.135, 0.05, 8), steelM);
    put(band, -hw + 1.0 + dx, 1.05, -hd + 1.4);
  }
  const cups = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.3, 8),
    new THREE.MeshBasicMaterial({ color: 0xd8d4c8 }));
  put(cups, -hw + 1.62, 1.07, -hd + 1.4);
  solid(-hw + 1.0, -hd + 1.4, 1.4, 0.55);

  // ── the handwritten signs ──
  const cardT = (a: string, bl: string) => declareSurface(pixTex(48, 24, (g) => {
    g.fillStyle = '#e4dcc4'; g.fillRect(0, 0, 48, 24);
    g.fillStyle = 'rgba(0,0,0,0.13)'; g.fillRect(0, 21, 48, 3);
    g.fillStyle = '#2a3a6a'; g.font = 'bold 7px monospace';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(a, 24, 8);
    g.font = '7px monospace'; g.fillText(bl, 24, 16);
  }), 'sign');
  // ON the coffee bench (top 0.92) plus the card's own half-height. Placed at
  // a typed 1.62 it hung 0.575 m in the air above it.
  room.sign(cardT('COFFEE', '.65'), 0.5, 0.25, -hw + 1.0, 0.92 + 0.125, -hd + 1.42);
  room.sign(cardT('NO', 'LOITERING'), 0.5, 0.25, CTR_X - 0.6, 1.72, CTR_Z);
  room.sign(cardT('ATM INSIDE', 'CASH ONLY'), 0.52, 0.26, 0, 1.9, hd - 0.08);

  // ── the bell on the door ──
  const bell = new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 5),
    new THREE.MeshBasicMaterial({ color: 0xc9a83a }));
  put(bell, room.doorAt, 2.06, hd - 0.12);
  const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.14, 0.03), steelM);
  put(bracket, room.doorAt, 2.15, hd - 0.12);

  // ── the cat ──
  //
  // Asleep on the counter, which is where it is not supposed to be. Drawn from
  // above as a curled shape rather than side-on, because a cat lying down is
  // the one animal shape you read from the top (GOTCHAS §3 is about ground
  // litter, and the same logic applies to anything resting on a surface).
  const catT = declareSurface(pixTex(24, 16, (g) => {
    g.clearRect(0, 0, 24, 16);
    g.fillStyle = '#6a6258';
    g.fillRect(5, 4, 13, 8); g.fillRect(4, 6, 2, 4); g.fillRect(17, 5, 4, 6);
    g.fillStyle = '#5a5248'; g.fillRect(18, 10, 5, 2);            // the tail, curled round
    g.fillStyle = '#7a7268'; g.fillRect(7, 5, 9, 3);
    g.fillStyle = '#3a3630'; g.fillRect(19, 5, 1, 2); g.fillRect(21, 5, 1, 2);  // ears
  }), 'detail');
  const cat = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.42),
    new THREE.MeshBasicMaterial({ map: catT, transparent: true, side: THREE.DoubleSide }));
  cat.rotation.x = -Math.PI / 2;
  cat.rotation.z = 0.4;
  put(cat, CTR_X, 1.09, CTR_Z - 0.75);

  // ── the keeper ──
  //
  // From the 8-angle atlas. He was the OLDEST hand-painted plane in the world
  // — this room predates the kit and predates `ctx.seat`, and it predated the
  // atlas helper too. Standing behind the counter where he can see the door
  // and the lottery at the same time.
  // FACING DERIVED FROM THE COUNTER, not typed.
  //
  // This read `facing: Math.PI`, which is -z — the BACK WALL. `ct/citizens.ts`
  // documents the convention as `atan2(vx, vz)` with `0 = facing +z`, and in
  // every one of these rooms the counter sits near the back and the customer
  // floor is on the +z side of it, so the keeper was turned away from the shop.
  //
  // Builder G hit exactly this in `int-pawn.ts` — "two of my four keepers faced
  // their back walls" (15f86d64) — and the literal they name as the bug is the
  // one that was in all four of mine. I nearly cleared my rooms on `turn.mjs`
  // showing "8 distinct frames over 8 headings": that proves the ATLAS picks an
  // angle, not that the angle is right. A figure facing a wall still turns.
  //
  // Derived from the counter so it cannot drift if the counter moves.
  const KEEP_AT = CTR_X - 0.55;   // behind the counter
  room.person({
    jacket: '#4a5a6a', pants: '#3a3a42', skin: '#a0703e', hair: '#2a2622',
    fit: 'plain', accent: '#d8d4c8', cut: 'short', build: 1,
  }, KEEP_AT, CTR_Z, { facing: Math.atan2(CTR_X - KEEP_AT, 0), h: 1.0, w: 0.98 });

  // ── the two things you can buy ──
  //
  // Kept exactly as they were: same items, same prices, same wallet. They move
  // onto the counter and gate on `room.inside` instead of a hand-written
  // `player.x() > 230`, which was the old room's own address showing through.
  const buy = (lx: number, lz: number, item: string, price: number, what: string) => {
    ctx.spot({
      x: room.wx(lx), z: room.wz(lz), r: 1.0,
      ok: room.inside,
      label: () => (ctx.purse.cash >= price
        ? `buy ${what} — $${price.toFixed(2)}`
        : `${what} $${price.toFixed(2)} — you’re short`),
      act: () => {
        if (ctx.purse.cash < price) return;
        ctx.purse.cash -= price;
        ctx.purse.inv[item] = (ctx.purse.inv[item] ?? 0) + 1;
        ctx.refreshWallet();
      },
    });
  };
  buy(CTR_X - 1.15, CTR_Z + 0.6, 'CEREAL', 2.5, 'cereal');
  buy(CTR_X - 1.15, CTR_Z - 0.6, 'SODA', 1.25, 'soda');
}
