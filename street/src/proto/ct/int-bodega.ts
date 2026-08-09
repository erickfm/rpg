import * as THREE from 'three';
import type { CtxBuild } from './ctx';
import { pixTex, dither, declareSurface, slabTex } from './paint';
import { buildRoom } from './interior';
import { type DoorDecl } from './doors';
import { boardTexture, boardStandoff, shopCounter, type ShopColumn, type BoardLook } from './shop';
import './goods';   // for the side effect: it is what declares the stock

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
    d: 12.6, h: 2.6,
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
    // DOOR IN THE CUT, which is the whole point and which I had left off.
    //
    // The user has now said this three times: "if the door for the bodega is
    // on a cut corner (literally) then the interior should match." The cut was
    // built; the DOOR stayed in the flat front wall, so walking in you met a
    // square doorway and the chamfer was just a bevel off to one side.
    //
    // I held `door: true` back because my own walk harness went red on it, and
    // I read that as the feature being wrong. It was not. The fault was the
    // harness heading: it computed an approach for a FRONT wall and then held
    // `w` for 3 s, which carries the player 3.15 m past a door set at 45
    // degrees. A test I had not proven was measuring the right thing kept a
    // working feature switched off for the user - GOTCHAS 27, a check you
    // never watched fail is one you will argue with.
    chamfer: { corner: 'front-right', cut: 2.0, door: true },
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
  // ── the stock, which is not a colour chart ──
  //
  // The user: *"THE SHELVES ARE A COLOUR CHART. Rows of flat coloured
  // rectangles at even spacing read as a grid, not as groceries. Real bodega
  // shelves have goods of DIFFERENT SIZES and depths — tall boxes beside short
  // cans beside bagged things — gaps where stock has sold, items pushed back
  // and pulled forward, a few facing the wrong way, and price labels on the
  // shelf edge."*
  //
  // Every one of those is a rule this draw now follows, and they are listed in
  // the order they matter. HEIGHT is first: the old draw gave every item the
  // full 7 px of shelf, so the eye read one continuous band per shelf and the
  // colours became a chart. Goods that stop at different heights break the band
  // before any of the rest is even noticed.
  //
  // Deterministic from the index — no Math.random. GOTCHAS 2: one seeded
  // stream, and its order is load-bearing, so a texture must not draw from it.
  //
  // A PAINTER PER ROW COUNT, one drawing. The mid-floor gondolas dropped to
  // 1.4 m (2026-08-09, below) and a 5-row texture squeezed onto a 3-row face
  // is squashed stock — cans half their own height. So the row count is the
  // parameter and the canvas is cut to it: 9 px per shelf course, same goods,
  // same gaps, same price ticks, at every height honestly.
  const stockRows = (rows: number) => (g: CanvasRenderingContext2D) => {
    const H = rows * 9 + 3;
    g.fillStyle = '#7a7263'; g.fillRect(0, 0, 64, H);
    const cols = ['#b8342a', '#d8b84a', '#3a6a8a', '#4a7a52', '#c86a2a', '#8a4a7a',
      '#d8d0c0', '#6a5a3a', '#2a8a7a', '#b85a5a'];
    for (let sh = 0; sh < rows; sh++) {
      const y0 = 2 + sh * 9, shelfY = y0 + 7;
      g.fillStyle = '#5a5348'; g.fillRect(0, shelfY, 64, 2);        // the shelf edge
      let x = 0, i = sh * 11 + 3;
      while (x < 64) {
        const k = (i * 7 + sh * 5) % 17;
        // A GAP where stock has sold. Roughly one slot in six, and it is the
        // single most effective thing here: full shelves are what read as a
        // chart, and a hole says somebody bought something.
        if (k === 4 || k === 11) { x += 2 + (k % 3); i++; continue; }
        const w = 3 + (k % 5);                       // widths 3…7
        const h = 3 + ((k * 3) % 5);                 // HEIGHTS 3…7: cans and boxes
        const top = shelfY - h;
        const pushedBack = k % 5 === 0;              // deeper on the shelf: darker, shorter
        const wrongWay = k % 7 === 3;                // turned around: plain card back
        g.fillStyle = wrongWay ? '#9a8468' : cols[(i * 3) % cols.length];
        g.fillRect(x, top + (pushedBack ? 1 : 0), w - 1, h - (pushedBack ? 1 : 0));
        if (pushedBack) { g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(x, top + 1, w - 1, h - 1); }
        else { g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(x, top, w - 1, 1); }
        // a label band on the taller boxes, so they are not flat colour
        if (h >= 6 && !wrongWay) {
          g.fillStyle = 'rgba(255,255,255,0.55)'; g.fillRect(x, top + 2, w - 1, 1);
        }
        x += w; i++;
      }
      // PRICE LABELS on the shelf edge — white ticks with a dark line, the way
      // a shelf-edge strip reads at a distance.
      for (let lx = 1 + (sh * 3) % 5; lx < 64; lx += 9 + (sh % 3)) {
        g.fillStyle = '#e4e0d4'; g.fillRect(lx, shelfY, 5, 2);
        g.fillStyle = '#4a443a'; g.fillRect(lx + 1, shelfY + 1, 3, 1);
      }
    }
    dither(g, 64, H, 60);
  };
  /** five courses: the tall WALL fixtures (the front-wall rack) */
  const stockT = declareSurface(pixTex(64, 48, stockRows(5)), 'detail');
  /** three courses: the 1.4 m mid-floor gondolas */
  const stockLowT = declareSurface(pixTex(64, 30, stockRows(3)), 'detail');
  // THE RUNS TURNED BROADSIDE, AND DROPPED TO CHEST HEIGHT.
  //
  // (2026-08-09) *"make shorter shelves which are horizontal here instead of
  // vertical pls"* — from beside the till the three 1.95 m runs ran AWAY from
  // him, deep into the room: three corridors that neither the keeper at the
  // till nor a player at the door could see into. Both words of the ask are
  // the fix:
  //
  //   HORIZONTAL — the runs lie ACROSS the room now, parallel to the front
  //   wall, so from the door and from the till you look along their faces,
  //   never into a corridor.
  //   SHORTER — 1.40 m, the corner-store gondola you see OVER: the keeper
  //   watches the whole floor from the till, the player reads the whole shop
  //   from the door. The WALL fixtures keep their 1.95 — it is the
  //   freestanding mid-floor runs he named.
  //
  // Two earlier layout lessons carry over, transposed, not dropped:
  //  · "the first thing you see is a blank grey slab" — every exposed steel
  //    end still wears a promo-stack cap; there are two per run and both now
  //    face the walking lanes (east: the till and the door approach; west:
  //    the perimeter lane).
  //  · the door-line slide (runs shifted so an aisle met the doorway) dies
  //    with the old orientation: broadside runs cannot wall off the door,
  //    because at 1.4 m you see over every one of them.
  const GOND_W = 0.62;                    // a run's depth, along z now
  const AISLE = 1.15;                     // held from the tall layout: a capsule is 0.72 across
  const PITCH = GOND_W + AISLE;
  const GOND_H = 1.4;
  // ENDS AND ROWS DERIVED FROM THE LANES, so no end butts a wall and traps a
  // browsing player:
  //  · west end 1.1 m off the left wall — a walkable perimeter lane, open at
  //    both aisle mouths
  //  · east end at x 1.1, where the tall layout's right aisle stood: 1.26 m
  //    short of the till counter top's west corner (2.36, from CTR_X below),
  //    which keeps the queue aisle exactly as wide as it was
  //  · the doorway centreline (x - z = hw - hd, the counter's own derivation)
  //    crosses the east-end line x = 1.1 at z = 3.0; the north run's face
  //    stops at z 1.8, 1.2 m south of it, so the entry diamond stays open
  //  · FOUR runs, not three: turning 7.0 m runs into 4.4 m runs costs a third
  //    of the shop's shelving, and "use the space fully" is two days old. The
  //    fourth run's south face still leaves 1.57 m of lane in front of the
  //    cooler — the tall layout left 0.85.
  const GX_W = -hw + 1.1, GX_E = 1.1;
  const GOND_L = GX_E - GX_W, GX_C = (GX_W + GX_E) / 2;
  const gondZs = [0, 1, 2, 3].map((i) => 1.8 - GOND_W / 2 - i * PITCH);
  // the END CAP: a run's end is the most-seen face from the lanes and bare
  // steel there is the "blank grey slab" of the original complaint. A real
  // end cap is a promo stack: cases of soda and boxes, two or three across,
  // uneven, with a hand-lettered price card over it — width variation is what
  // stops a row reading as colour banding. RE-CUT for the 1.4 m carcass: the
  // canvas is 34 px at the same ~26 px/m the tall cap used, and the stack
  // just piles fewer cases — not the old drawing squashed.
  const capT = declareSurface(pixTex(24, 34, (g) => {
    g.fillStyle = '#8a8478'; g.fillRect(0, 0, 24, 34);
    const cols = ['#b8452f', '#3f6a8a', '#c8a33a', '#4a7a4a', '#8a5a7a', '#c05a3a'];
    let y = 32;                                    // stack upward from the floor
    for (let r = 0; r < 9 && y > 9; r++) {
      const rh = 3 + ((r * 5) % 4);                // 3…6 px: case, box, case
      const k = (r * 7 + 2) % 13;
      const across = k % 3 === 0 ? 3 : 2;          // two or three items across
      const pad = 1;
      const cw = Math.floor((22 - pad * (across - 1)) / across);
      for (let c = 0; c < across; c++) {
        if ((k + c * 5) % 11 === 3) continue;      // a case taken off the stack
        const x = 1 + c * (cw + pad);
        const jitter = (k + c) % 3 === 0 ? 1 : 0;  // not a tidy stack
        g.fillStyle = cols[(r * 3 + c * 2) % cols.length];
        g.fillRect(x, y - rh + jitter, cw, rh - jitter);
        g.fillStyle = 'rgba(255,255,255,0.14)'; g.fillRect(x, y - rh + jitter, cw, 1);
        g.fillStyle = 'rgba(0,0,0,0.20)'; g.fillRect(x, y - 1, cw, 1);
      }
      y -= rh + 1;
    }
    // the promo card, hand-lettered, taped over the top of the stack
    g.fillStyle = '#e8e2d0'; g.fillRect(3, 3, 18, 8);
    g.fillStyle = '#a8302a';
    g.fillRect(5, 5, 14, 2); g.fillRect(5, 8, 9, 2);
    dither(g, 24, 34, 70);
  }), 'detail');
  for (const gz of gondZs) {
    const body = new THREE.Mesh(new THREE.BoxGeometry(GOND_L, GOND_H, GOND_W), steelM);
    put(body, GX_C, GOND_H / 2, gz);
    // caps on BOTH ends, aimed where the approach now comes from: +x toward
    // the till and the door, -x toward the perimeter lane
    for (const [sx, ry] of [[1, Math.PI / 2], [-1, -Math.PI / 2]] as [number, number][]) {
      const cap = new THREE.Mesh(new THREE.PlaneGeometry(GOND_W - 0.04, GOND_H - 0.12), ctx.flat(capT));
      cap.rotation.y = ry;
      put(cap, (sx > 0 ? GX_E : GX_W) + sx * 0.012, (GOND_H - 0.12) / 2 + 0.03, gz);
    }
    // the stock faces, on the long sides — the three-course cut, not the
    // five-course texture squeezed
    for (const sz of [-1, 1]) {
      const st = stockLowT.clone();
      st.wrapS = st.wrapT = THREE.RepeatWrapping;
      st.repeat.set(GOND_L / 2.4, 1);
      st.needsUpdate = true;
      const face = new THREE.Mesh(new THREE.PlaneGeometry(GOND_L, GOND_H - 0.1), ctx.flat(st));
      face.rotation.y = sz > 0 ? 0 : Math.PI;
      put(face, GX_C, GOND_H / 2 + 0.01, gz + sz * (GOND_W / 2 + 0.01));
    }
    solid(GX_C, gz, GOND_L, GOND_W);
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
  // THE COUNTER SITS BESIDE THE CORNER DOOR, NOT ACROSS IT.
  //
  // Walking in through the cut gave 0.45 m ahead: the counter spanned z 0.4 to
  // 3.0 and the diagonal you enter along ran straight into its front. A corner
  // shop puts the counter where it can watch the door — beside the entry, not
  // blocking it — so it moves back off the approach.
  //
  // …AND THEN `hd - 7.0` OVERSHOT. (2026-08-09) *"move the resiter closer to
  // the door"* — at z -0.7 the till was a mid-room island 6 m from the exit,
  // which is a supermarket layout, not a bodega guarding its door. The history
  // above is why it cannot simply go back to `hd - 2.6` or `hd - 4.6`: both
  // put the counter's near corner inside the entry diagonal. So the z is now
  // SOLVED AGAINST THAT DIAGONAL rather than picked. The doorway's centreline
  // is the 45° line x - z = hw - hd through the cut's midpoint; the counter's
  // exposed corner is its top's NW point (CTR_X - 0.54, CTR_Z + 1.34); its
  // distance to the line is |x - z - (hw - hd)| / √2. `hd - 5.4` puts that at
  // 1.43 m — a full 2 m lane through the door with margin — while the counter
  // ends 3.1 m from the doorway instead of 6. The register sits at the
  // counter's DOOR end (CTR_Z + 0.7), so the keeper rings you up on your way
  // out, which is the whole point of a bodega till.
  const CTR_X = hw - 1.5, CTR_Z = hd - 5.4;
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

  // THE REGISTER, which was the last bare box in this room.
  //
  // Raycast from a customer's eye at (441.0, 1.9) through the dark shape in
  // shots/f-bodega-counter2.png: all three probes returned THIS mesh, 1.34 m
  // away - a 0.4 x 0.28 x 0.32 box in #3a3a3e with no map on it. That is the
  // same fault as the grey gondola end the user complained about ("the first
  // thing you see is a blank grey slab"): an untextured box close to the eye
  // reads as a slab, whatever it is meant to be. So it gets a face.
  const regT = declareSurface(pixTex(20, 14, (g) => {
    g.fillStyle = '#4a4a50'; g.fillRect(0, 0, 20, 14);
    g.fillStyle = '#22262c'; g.fillRect(2, 1, 16, 5);              // the display well
    g.fillStyle = '#7fe0a0'; g.fillRect(3, 2, 9, 3);               // lit total
    for (let r = 0; r < 2; r++) for (let c = 0; c < 6; c++) {      // the keys
      g.fillStyle = (r + c) % 4 === 0 ? '#c8c0b0' : '#8a8478';
      g.fillRect(2 + c * 3, 8 + r * 3, 2, 2);
    }
    dither(g, 20, 14, 40);
  }), 'detail');
  const reg = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.28, 0.32),
    new THREE.MeshBasicMaterial({ color: 0x4a4a50 }));
  put(reg, CTR_X, 1.22, CTR_Z + 0.7);
  // the keys and display, facing the customer side of the counter
  const regFace = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.26), ctx.flat(regT));
  regFace.rotation.y = -Math.PI / 2;
  put(regFace, CTR_X - 0.205, 1.22, CTR_Z + 0.7);

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
  // THE CASE'S OWN MEASUREMENTS, ONCE. `-hw + 1.6` and `hd - 1.5` were each
  // typed three times across the four lines below and `2.2`/`0.72` twice — and
  // the coffee station further down had a fourth, independent opinion about
  // where this case ends. That is how the two came to occupy the same floor
  // (see CF_Z). One declaration, and everything that needs to stand clear of
  // this case reads it rather than remembering it (BUILDER-BRIEF §8).
  const DELI_W = 2.2, DELI_H = 1.1, DELI_D = 0.72;
  // AGAINST THE LEFT WALL, which is the second half of *"a bit crowded"*.
  //
  // At `-hw + 1.6` the case stood 0.41 m off the wall — a strip too narrow to
  // walk and too wide to read as joinery, so it was dead floor — and its right
  // end reached local x -1.70. The left aisle's mouth runs from there to the
  // second gondola run's face at -1.19, which is **0.51 m**. The player capsule
  // is 0.72 across, so THE LEFT AISLE COULD NOT BE ENTERED FROM THE FRONT OF
  // THE SHOP AT ALL: you had to walk the middle aisle to the cooler and come
  // back up. Walked, not deduced — `w68-bodega-walk.mjs` stops the player dead
  // at z 5.55 against this case, 11.1 m short of the back.
  //
  // Standing it against the wall gives that mouth 0.98 m and costs nothing: a
  // deli case belongs against a wall, and the 0.41 m behind it was not floor
  // anyone could use. DERIVED from the wall face and the case's own width, so
  // it cannot drift if either changes. `hw` is the clear half-width — the wall
  // colliders' inner faces sit at exactly ±hw — and 0.03 is a scribe gap, not
  // a coplanar butt.
  const DELI_X = -hw + 0.03 + DELI_W / 2, DELI_Z = hd - 1.5;
  /** the customer side of the case — the face everything else must clear */
  const DELI_FRONT = DELI_Z - DELI_D / 2;

  // ══ WHY THIS CORNER READ AS ONE JAMMED LUMP ═══════════════════════════════
  //
  // *"this whole area of the bodega is fucked up"*  (2026-08-06)
  //
  // THE TWO CARCASSES DO NOT INTERPENETRATE and have not since the last pass —
  // `CF_GAP` below holds a 60 mm shadow gap and the z is derived from
  // `DELI_FRONT`, so a nudge was never the fix. Two other things made them
  // read as one object with a seam through it:
  //
  //  1. THE CASE WAS A FEATURELESS SLAB. One `BoxGeometry` in flat `woodM`:
  //     no top, no edge, no plinth, no texture, 2.2 m of it. The bench 60 mm
  //     away was rebuilt for exactly this fault — *"a flat colour is not a
  //     material. an untextured quad has no grain for the eye to attach to
  //     and no joints to give it scale"* — and the rebuild stopped at the
  //     bench. Two flat brown areas meeting produce no corner: with nothing
  //     to read the near edge against, the eye takes the pair for one solid.
  //
  //  2. THE DISPLAY RAN STRAIGHT THROUGH THE BENCH. The glass was sized
  //     `DELI_W - 0.1` — from the case's own width and nothing else — so
  //     2.1 m of meat tray crossed a counter standing in front of the middle
  //     of it. What you saw wedged in the join was the far sliver of that
  //     display re-emerging past the bench: a shop fitting apparently driven
  //     through another one. Same fault class as the sign above and as the
  //     `hd - 2.2` collision this comment block already records — a dimension
  //     taken from one fixture with no knowledge of the one beside it.
  //
  // THE T IS GONE. (2026-08-09) *"move the coffee station over to the empty
  // space on the left here inside the bodega"* — the bench no longer stands
  // against this case's face at all; it lives on the front wall now (see the
  // coffee station below). So the display runs the case's full width again,
  // and the floor decision the 2026-08-06 pass declined to make on its own
  // has now been made by Erick.

  const DELI_TOP = 0.06, DELI_KICK = 0.09;
  const DELI_BODY = DELI_H - DELI_TOP - DELI_KICK;
  const kickM = new THREE.MeshBasicMaterial({ color: 0x40342a });
  // the carcass, standing on the plinth rather than on the floor
  const deli = new THREE.Mesh(new THREE.BoxGeometry(DELI_W, DELI_BODY, DELI_D), woodM);
  put(deli, DELI_X, DELI_KICK + DELI_BODY / 2, DELI_Z);
  // THE PLINTH — 60 mm recessed at the front, 30 mm at the ends. The cheapest
  // thing that stops a box reading as a box: the carcass's bottom edge lands
  // in shadow instead of flat on the tile.
  const deliKick = new THREE.Mesh(
    new THREE.BoxGeometry(DELI_W - 0.06, DELI_KICK, DELI_D - 0.08), kickM);
  put(deliKick, DELI_X, DELI_KICK / 2, DELI_Z + 0.02);
  // THE TOP, proud 50 mm at the front and 30 mm at the open end, and NOT at
  // the wall end — the case is scribed 30 mm off the wall and an overhang
  // there would sit exactly on the wall collider's face.
  const deliTopT = declareSurface(slabTex({
    wMeters: DELI_W, dMeters: DELI_D, base: '#6a5442', joint: 0.45, grain: 0.14,
  }), 'detail');
  const deliTop = new THREE.Mesh(new THREE.BoxGeometry(DELI_W + 0.03, DELI_TOP, DELI_D + 0.05),
    new THREE.MeshBasicMaterial({ map: deliTopT }));
  put(deliTop, DELI_X + 0.015, DELI_H - DELI_TOP / 2, DELI_Z - 0.025);
  // the front, a recessed panel — the same one the bench wears, so the corner
  // is two pieces of one shop's joinery and not two different mistakes
  const deliFrontT = declareSurface(pixTex(44, 16, (g) => {
    g.fillStyle = '#5e4a3a'; g.fillRect(0, 0, 44, 16);
    g.fillStyle = '#6a5442'; g.fillRect(2, 2, 40, 12);
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(2, 2, 40, 1);
    g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(2, 13, 40, 1);
    dither(g, 44, 16, 40);
  }), 'detail');
  const deliFront = new THREE.Mesh(new THREE.PlaneGeometry(DELI_W - 0.04, DELI_BODY - 0.03),
    ctx.flat(deliFrontT));
  put(deliFront, DELI_X, DELI_KICK + DELI_BODY / 2, DELI_FRONT - 0.008);
  // THE DISPLAY, one run the case's full width — the coffee bench that used to
  // stand against the middle of this face is on the front wall now, so there
  // is nothing to cut around. Off the case's face by 22 mm, 14 mm proud of the
  // panel.
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(DELI_W - 0.1, 0.6),
    new THREE.MeshBasicMaterial({ map: deliT, transparent: true, opacity: 0.92, side: THREE.DoubleSide }));
  put(pane, DELI_X, 0.72, DELI_FRONT - 0.022);
  solid(DELI_X, DELI_Z, DELI_W, DELI_D);

  // ── the coffee station, which has to SAY coffee station ──
  //
  // The user, on this corner: *"what is this"* — which is a diagnosis, not a
  // question. It was a large plain brown slab with three black cylinders
  // standing on it, and the desk could not name them either. His rule from the
  // alley applies indoors: *"for all the trash in the alley i cant tell what
  // any of it is. these should be recognizable."*
  //
  // A black cylinder with a white band is a SHAPE. An urn is a shape plus the
  // two or three details that identify it: a TAP you draw coffee from, a
  // domed LID with a handle, a DRIP TRAY under the taps, and a stack of paper
  // cups beside. Those are what make it nameable in one second from the door.
  // WHERE IT IS MATTERS MORE THAN WHAT IS ON IT.
  //
  // I gave the urns taps, lids, a drip tray and a cup stack, then finally got
  // a camera on the corner and it STILL did not read - because it sits in the
  // back-left corner BEHIND a gondola run. Two of the three urns are occluded
  // from anywhere on the floor. No amount of detail fixes a thing you cannot
  // see; the user's test is "stand at the door and name it in one second".
  //
  // So it moves to the front-left, ahead of the shelving (the runs start at
  // GOND_Z + GOND_L/2 going back), which is also where a corner shop actually
  // puts coffee: by the door, where you pick it up on the way in.
  // ⚠ AND THIS IS WHERE IT WENT WRONG, WHICH IS WHY THE FIX IS A DERIVATION
  // AND NOT A NUDGE.
  //
  // The user: *"bodega is a bit crowded and lots of clipping inside"*, with a
  // shot of the front-left corner. The bench and the deli case form an L, and
  // the two carcasses were INSIDE each other:
  //
  //     deli case   x -3.90 … -1.70   z 4.44 … 5.16
  //     bench       x -3.68 … -3.13   z 3.40 … 4.80     <- 0.36 m past the case
  //
  // 0.198 m2 of shared collider floor and 0.157 m3 of interpenetrating carcass
  // — the largest overlap in the room by an order of magnitude, and the only
  // one that is not a wall corner (`scripts/probes/w68-bodega-clip.mjs`).
  //
  // The cause is written in the comment directly above: this station USED to
  // stand in the back-left corner and was moved to the front-left so it could
  // be seen from the door. `hd - 2.2` was chosen for the new spot; the deli
  // case was already at `hd - 1.5` and nothing connected the two numbers. A
  // relocation that lands on a fixture already standing there cannot be caught
  // by re-reading either line, because each is individually reasonable.
  //
  // AND THEN IT MOVED AGAIN, TO THE FRONT WALL. (2026-08-09) *"move the coffee
  // station over to the empty space on the left here inside the bodega"* — his
  // shot is the blank run of front wall under the window and the ATM card,
  // dead floor between the deli case's open end and the door. The bench now
  // stands AGAINST that wall, long side along it, urns facing -z into the
  // shop, the way a wall station sits. Still visible from the door — more so:
  // it is square to you as you walk in through the cut.
  //
  // EVERY NUMBER DERIVED, because this station's whole history is typed
  // coordinates landing on fixtures nobody re-read:
  //  · z from the wall face and its own depth, with the deli case's 0.03
  //    scribe gap — the wall colliders' inner faces sit at exactly ±hd.
  //  · x from the DELI CASE'S OPEN END, not the wall: 0.7 m clear. The strip
  //    behind the case (z 5.16…hd) is entered past the diagonal between the
  //    case's back corner and this bench's near corner — hypot(0.7, 0.56) =
  //    0.90 m against the 0.72 m capsule, so that floor stays reachable. And
  //    0.7 lands the bench under the window with its far end short of the ATM
  //    card's centreline; the card hangs at 1.77 m, the urn lids top out at
  //    1.50, so the two never meet on the wall.
  const CF_W = 1.4, CF_D = 0.55, CF_H = 0.92;
  const CF_Z = hd - 0.03 - CF_D / 2;
  const CF_X = DELI_X + DELI_W / 2 + 0.7 + CF_W / 2;
  const urnM = new THREE.MeshBasicMaterial({ color: 0x2e3236 });
  const chromeM = new THREE.MeshBasicMaterial({ color: 0xb8bcc0 });

  // THE COUNTER IT STANDS ON. It was one untextured brown box, which is the
  // fault A published helpers for: "a flat colour is not a material. an
  // untextured quad has no grain for the eye to attach to and no joints to
  // give it scale." A counter reads as a counter because it has a top, an
  // edge and a front panel. slabTex keeps the colour I already had.
  const benchTopT = declareSurface(slabTex({
    wMeters: CF_W, dMeters: CF_D, base: '#6a5442', joint: 0.45, grain: 0.14,
  }), 'detail');
  // LONG SIDE ALONG THE WALL, urns facing -z into the shop — on the front wall
  // the sightline from the door runs down the room, so the bench's face and
  // all three urns are square to you as you walk in.
  // ON A PLINTH, like the deli case. The bench had the top and the front
  // panel already but sat flat on the tile, which is the one joinery cue the
  // deli case now has and it did not — and a pair that agrees everywhere but
  // the floor line still reads as mismatched.
  const CF_KICK = 0.09, CF_BODY = CF_H - 0.06 - CF_KICK;
  put(new THREE.Mesh(new THREE.BoxGeometry(CF_W, CF_BODY, CF_D * 0.92), woodM),
    CF_X, CF_KICK + CF_BODY / 2, CF_Z);                   // the carcass, set back
  put(new THREE.Mesh(new THREE.BoxGeometry(CF_W - 0.06, CF_KICK, CF_D * 0.78), kickM),
    CF_X, CF_KICK / 2, CF_Z);
  const top = new THREE.Mesh(new THREE.BoxGeometry(CF_W + 0.06, 0.06, CF_D + 0.06),
    new THREE.MeshBasicMaterial({ map: benchTopT }));
  put(top, CF_X, CF_H - 0.03, CF_Z);                      // the top, proud: an EDGE
  const frontT = declareSurface(pixTex(28, 18, (g) => {
    g.fillStyle = '#5e4a3a'; g.fillRect(0, 0, 28, 18);
    g.fillStyle = '#6a5442'; g.fillRect(2, 2, 24, 14);    // a recessed panel
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(2, 2, 24, 1);
    g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(2, 15, 24, 1);
    dither(g, 28, 18, 40);
  }), 'detail');
  const front = new THREE.Mesh(new THREE.PlaneGeometry(CF_W, CF_BODY - 0.06), ctx.flat(frontT));
  front.rotation.y = Math.PI;                             // faces -z, into the shop
  put(front, CF_X, CF_KICK + CF_BODY / 2, CF_Z - CF_D / 2 - 0.01);

  for (const dx of [-0.42, 0, 0.42]) {
    const ux = CF_X + dx, uz = CF_Z;
    const urn = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.125, 0.40, 10), urnM);
    put(urn, ux, CF_H + 0.20, uz);
    // the LID, domed, with a handle on top
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.125, 0.06, 10), chromeM);
    put(lid, ux, CF_H + 0.43, uz);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.026, 6, 5), urnM);
    put(knob, ux, CF_H + 0.475, uz);
    // THE TAP, on the customer side, which is the detail that says urn
    const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.09, 6), chromeM);
    put(spout, ux, CF_H + 0.10, uz - 0.13);
    const lever = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.07, 0.02), chromeM);
    lever.rotation.x = 0.5;
    put(lever, ux, CF_H + 0.17, uz - 0.13);
    // a sight glass up the side, so it is not one flat black
    const gauge = new THREE.Mesh(new THREE.PlaneGeometry(0.022, 0.24),
      new THREE.MeshBasicMaterial({ color: 0x6a4a2a }));
    gauge.rotation.y = Math.PI;
    put(gauge, ux + 0.11, CF_H + 0.21, uz - 0.055);
  }
  // THE DRIP TRAY, under the taps, running the width
  const tray = new THREE.Mesh(new THREE.BoxGeometry(CF_W - 0.2, 0.018, 0.14), chromeM);
  put(tray, CF_X, CF_H + 0.035, CF_Z - 0.13);

  // the paper cups, a stack of them, beside the urns
  for (let i = 0; i < 3; i++) {
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.034, 0.11, 8),
      new THREE.MeshBasicMaterial({ color: 0xd8d4c8 }));
    // AT THE DOOR END of the bench — the end you pass on the way in, and the
    // one thing on this bench a customer actually has to reach.
    put(cup, CF_X + 0.55, CF_H + 0.055 + i * 0.105, CF_Z);
  }
  solid(CF_X, CF_Z, CF_W, CF_D);

  // ── the rest of the front wall, which was bare for metres ──
  //
  // (2026-08-09) *"not using the space fully here. but yea its better"* — the
  // run of front wall from the coffee bench's door end to the cut corner, and
  // the lino in front of it, was painted wall and nothing else. A 1997 bodega
  // does not own an empty wall: it racks it, stands a chest freezer against
  // it, and stacks the overflow on the floor in front. Everything here is set
  // dressing — the till card stays the shop.
  //
  // THE ONE CONSTRAINT IS THE DOOR. The entry diagonal is the line
  // x - z = hw - hd through the cut's midpoint (same line the counter's z is
  // solved against, above), and every corner below keeps at least 1.1 m off
  // it — the thrift shop was rebuilt for exactly the sin of furniture in the
  // doorway's lane.

  // THE WALL RACK: a gondola turned against the wall — same steel, same 1.95
  // height, same stock texture the runs wear, so it reads as this shop's own
  // shelving and not a new species. From the bench's end toward the cut.
  const RACK_A = CF_X + CF_W / 2 + 0.15;            // 0.15 scribe off the bench end
  const RACK_B = RACK_A + 1.1;
  const RACK_W = RACK_B - RACK_A, RACK_X = (RACK_A + RACK_B) / 2;
  const RACK_D = 0.38, RACK_Z = hd - 0.03 - RACK_D / 2;
  put(new THREE.Mesh(new THREE.BoxGeometry(RACK_W, 1.95, RACK_D), steelM),
    RACK_X, 0.975, RACK_Z);
  const rackSt = stockT.clone();
  rackSt.wrapS = rackSt.wrapT = THREE.RepeatWrapping;
  rackSt.repeat.set(RACK_W / 2.4, 1);
  rackSt.needsUpdate = true;
  const rackFace = new THREE.Mesh(new THREE.PlaneGeometry(RACK_W, 1.85), ctx.flat(rackSt));
  rackFace.rotation.y = Math.PI;                    // faces -z, into the shop
  put(rackFace, RACK_X, 0.98, RACK_Z - RACK_D / 2 - 0.01);
  // the DOOR-SIDE end cap — the face you see walking in. Bare steel here is
  // the exact "grey slab a metre from the eye" the gondola ends were pulled
  // up for, so it gets the same promo-stack treatment, narrower.
  const rackCapT = declareSurface(pixTex(20, 48, (g) => {
    g.fillStyle = '#8a8478'; g.fillRect(0, 0, 20, 48);
    const cols = ['#b8452f', '#3f6a8a', '#c8a33a', '#4a7a4a'];
    let y = 46;
    for (let r = 0; r < 8 && y > 9; r++) {
      const rh = 3 + ((r * 3) % 4);
      const k = (r * 5 + 1) % 11;
      const across = k % 2 === 0 ? 2 : 1;
      const cw = Math.floor((18 - (across - 1)) / across);
      for (let c = 0; c < across; c++) {
        if ((k + c * 3) % 7 === 2) continue;         // a case sold off the stack
        g.fillStyle = cols[(r * 2 + c * 3) % cols.length];
        g.fillRect(1 + c * (cw + 1), y - rh, cw, rh);
        g.fillStyle = 'rgba(255,255,255,0.14)'; g.fillRect(1 + c * (cw + 1), y - rh, cw, 1);
      }
      y -= rh + 1;
    }
    g.fillStyle = '#e8e2d0'; g.fillRect(2, 3, 16, 7);
    g.fillStyle = '#a8302a'; g.fillRect(4, 5, 12, 2);
    dither(g, 20, 48, 70);
  }), 'detail');
  const rackCap = new THREE.Mesh(new THREE.PlaneGeometry(RACK_D - 0.04, 1.8), ctx.flat(rackCapT));
  rackCap.rotation.y = Math.PI / 2;                 // faces +x, toward the door
  put(rackCap, RACK_B + 0.01, 0.95, RACK_Z);
  solid(RACK_X, RACK_Z, RACK_W, RACK_D);

  // THE ICE MERCHANDISER, between the rack and the cut — the white chest with
  // blue letters every corner shop in 1997 kept by its door. Its east face
  // stops 0.26 short of where the cut begins: the near corner then sits 1.1 m
  // off the doorway centreline (measured with the formula above), outside the
  // entry lane.
  const ICE_B = (hw - 2.0) - 0.26, ICE_W = 0.8, ICE_D = 0.7, ICE_H = 0.95;
  const ICE_X = ICE_B - ICE_W / 2, ICE_Z = hd - 0.03 - ICE_D / 2;
  const iceM = new THREE.MeshBasicMaterial({ color: 0xe4e6e0 });
  put(new THREE.Mesh(new THREE.BoxGeometry(ICE_W, ICE_H - 0.05, ICE_D), iceM),
    ICE_X, (ICE_H - 0.05) / 2, ICE_Z);
  // the lid, proud, in the same white — the step is what says chest
  put(new THREE.Mesh(new THREE.BoxGeometry(ICE_W + 0.04, 0.05, ICE_D + 0.04), iceM),
    ICE_X, ICE_H - 0.025, ICE_Z);
  const iceT = declareSurface(pixTex(32, 24, (g) => {
    g.fillStyle = '#e4e6e0'; g.fillRect(0, 0, 32, 24);
    g.fillStyle = '#2a4a8a'; g.fillRect(0, 0, 32, 3);              // the blue band
    g.fillStyle = '#2a4a8a'; g.font = 'bold 9px monospace';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('ICE', 16, 10);
    g.fillStyle = '#8a8e88'; g.fillRect(2, 16, 28, 1);             // the seam
    // a printed bag of cubes, small, under the letters
    g.fillStyle = '#bcd8e0'; g.fillRect(12, 18, 8, 5);
    g.fillStyle = '#e4f0f4'; g.fillRect(13, 19, 2, 2); g.fillRect(16, 20, 2, 2);
    g.fillStyle = '#3a3e3a'; g.fillRect(0, 23, 32, 1);             // compressor vent
    dither(g, 32, 24, 25);
  }), 'detail');
  const iceFace = new THREE.Mesh(new THREE.PlaneGeometry(ICE_W - 0.04, ICE_H - 0.1), ctx.flat(iceT));
  iceFace.rotation.y = Math.PI;
  put(iceFace, ICE_X, (ICE_H - 0.05) / 2, ICE_Z - ICE_D / 2 - 0.01);
  solid(ICE_X, ICE_Z, ICE_W, ICE_D);

  // THE CORKBOARD, on the wall over the ice chest — room notices, a lotto
  // card, a missing-cat card. The one wall band this stretch has left
  // (the rack takes its run to 1.95; the chest stops at 0.95).
  const corkT = declareSurface(pixTex(36, 26, (g) => {
    g.fillStyle = '#a8845a'; g.fillRect(0, 0, 36, 26);             // the cork
    g.fillStyle = '#6a5442'; g.fillRect(0, 0, 36, 1); g.fillRect(0, 25, 36, 1);
    g.fillStyle = '#6a5442'; g.fillRect(0, 0, 1, 26); g.fillRect(35, 0, 1, 26);
    // pinned cards, askew the way a real board is
    g.fillStyle = '#e4dcc4'; g.fillRect(3, 4, 9, 7);
    g.fillStyle = '#2a3a6a'; g.fillRect(4, 6, 7, 1); g.fillRect(4, 8, 5, 1);
    g.fillStyle = '#e0c84a'; g.fillRect(15, 3, 8, 10);             // the lotto flyer
    g.fillStyle = '#a8302a'; g.fillRect(16, 5, 6, 3);
    g.fillStyle = '#e4dcc4'; g.fillRect(26, 6, 7, 9);
    g.fillStyle = '#6a6458'; g.fillRect(27, 8, 5, 4);              // the cat photo
    g.fillStyle = '#2a3a6a'; g.fillRect(27, 13, 5, 1);
    g.fillStyle = '#e4dcc4'; g.fillRect(6, 14, 8, 8);
    g.fillStyle = '#2a3a6a'; g.fillRect(7, 16, 6, 1); g.fillRect(7, 18, 6, 1); g.fillRect(7, 20, 4, 1);
    dither(g, 36, 26, 30);
  }), 'sign');
  room.sign(corkT, 0.72, 0.52, ICE_X, 1.5, hd - 0.06);

  // THE OVERFLOW ON THE FLOOR: soda multipacks stacked in front of the rack,
  // two up two across, the way stock that has no shelf left waits. Front face
  // 0.8 m into the room; the apron to the gondola ends keeps over 3 m.
  const PK_X = RACK_X, PK_Z = RACK_Z - RACK_D / 2 - 0.23;
  const pkCols = ['#b8342a', '#3a5a8a', '#c8a33a', '#b8342a'];
  const pk: [number, number, number][] =
    [[-0.16, 0, 0.25], [0.16, 0, 0.25], [-0.10, 0.25, 0.25], [0.13, 0.5, 0.22]];
  pk.forEach(([dx, dy, h], i) => {
    put(new THREE.Mesh(new THREE.BoxGeometry(0.30, h - 0.01, 0.40),
      new THREE.MeshBasicMaterial({ color: pkCols[i] })), PK_X + dx, dy + h / 2, PK_Z);
    // the printed side band that says case-of-cans and not painted box
    const band = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.08),
      new THREE.MeshBasicMaterial({ color: 0xe8e4d8 }));
    band.rotation.y = Math.PI;
    put(band, PK_X + dx, dy + h / 2, PK_Z - 0.201);
  });
  solid(PK_X, PK_Z, 0.66, 0.44);

  // THE MORNING PAPERS, still twine-tied, dropped at the counter's door end
  // where they get cut open — the till sells the PAPER on its card.
  const NP_X = CTR_X, NP_Z = CTR_Z + 1.3 + 0.04 + 0.18;
  const npM = new THREE.MeshBasicMaterial({ color: 0xc8c4b8 });
  const twM = new THREE.MeshBasicMaterial({ color: 0x4a443a });
  for (const [dy, ry] of [[0, 0.06], [0.13, -0.09]] as [number, number][]) {
    // bale + the twine that wraps it, grouped so the skew turns them together
    const bale = new THREE.Group();
    bale.add(new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.12, 0.32), npM));
    for (const sx of [-0.12, 0.12]) {
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.126, 0.33), twM);
      strap.position.set(sx, 0, 0);
      bale.add(strap);
    }
    bale.rotation.y = ry;
    put(bale, NP_X, dy + 0.06, NP_Z);
  }
  solid(NP_X, NP_Z, 0.46, 0.36);

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
  // DERIVED FROM THE BENCH, not typed. Moving the coffee station to the front
  // of the shop left this card behind at the old back-wall coordinates - a
  // sign standing over nothing, which is the exact floating-prop fault this
  // room was pulled up for twice. It now reads CF_X/CF_Z/CF_H, so the card
  // goes wherever the bench goes — including to the front wall (2026-08-09).
  room.sign(cardT('COFFEE', '2.50'), 0.5, 0.25, CF_X, CF_H + 0.125, CF_Z - 0.02);
  // ✗ `NO LOITERING` USED TO BE HERE, AND IT HUNG IN OPEN AIR.
  //   (2026-08-06) *"get rid of this floating sign"* — it was typed at
  //   `CTR_X - 0.6, 1.72, CTR_Z`, which is 0.1 m PAST the counter's customer
  //   face and 0.67 m above its top: nothing under it, nothing behind it, and
  //   the nearest wall 2.3 m away. Same fault as the COFFEE card two lines up
  //   — a typed y with no surface named — but it survived that sweep because
  //   the sweep only re-derived the cards it could pair with a fixture. This
  //   one could not be paired with anything, which was the finding, not an
  //   exemption. Removed rather than re-hung; if the room wants the notice
  //   back it belongs taped to the door glass or the till's back wall.
  room.sign(cardT('ATM INSIDE', 'CASH ONLY'), 0.52, 0.26, 0, 1.9, hd - 0.08);

  // ── the bell on the door ──
  const bell = new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 5),
    new THREE.MeshBasicMaterial({ color: 0xc9a83a }));
  put(bell, room.doorAt, 2.06, hd - 0.12);
  const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.14, 0.03), steelM);
  put(bracket, room.doorAt, 2.15, hd - 0.12);

  // ── the last four off the user's decor list ──
  //
  // *"a hand-lettered sign taped to the cooler, a lottery machine, a coffee
  // station, cigarettes behind the counter, a bell on the door, a cat, a
  // radio, a calendar from a food distributor."* The other four were already
  // here; these are the ones that were not.
  //
  // Every position below is DERIVED from the thing it sits on or hangs from,
  // never typed — the diner's wall props floated because they were typed, and
  // the COFFEE card above hung 0.575 m over its bench for the same reason.

  // Taped to the cooler glass. The cooler plane is at -hd + 0.06, so the tape
  // sits just proud of it; drift the cooler back and the sign follows.
  const COOL_Z = -hd + 0.06;
  room.sign(cardT('ICE COLD', '2 / $9'), 0.62, 0.31, -1.7, 1.62, COOL_Z + 0.03);

  // The lottery machine, floor-standing by the door where the queue forms.
  // Kept clear of the counter (which spans CTR_Z +/- 1.3) and of the cut
  // corner, which eats z >= hd - 2.
  const LOT_X = hw - 0.34, LOT_Z = CTR_Z + 1.9;
  const lotBody = new THREE.Mesh(new THREE.BoxGeometry(0.44, 1.35, 0.6),
    new THREE.MeshBasicMaterial({ color: 0x8a2a2a }));
  put(lotBody, LOT_X, 0.675, LOT_Z);
  const lotFaceT = declareSurface(pixTex(24, 32, (g) => {
    g.fillStyle = '#7a2424'; g.fillRect(0, 0, 24, 32);
    g.fillStyle = '#2a2f38'; g.fillRect(3, 4, 18, 12);            // the screen
    for (let i = 0; i < 5; i++) {
      g.fillStyle = ['#e0c84a', '#4ac8d8', '#e8e4d8'][i % 3];
      g.fillRect(5 + i * 3, 7 + (i % 3), 2, 5);
    }
    g.fillStyle = '#e8dcc0'; g.fillRect(3, 19, 18, 9);            // the ticket shelf
    for (let i = 0; i < 4; i++) {
      g.fillStyle = ['#e07a3a', '#3a8a5a', '#c8b04a'][i % 3];
      g.fillRect(4 + i * 4.5, 21, 4, 5);
    }
    dither(g, 24, 32, 50);
  }), 'detail');
  const lotFace = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 1.2), ctx.flat(lotFaceT));
  lotFace.rotation.y = -Math.PI / 2;                              // faces into the shop
  put(lotFace, LOT_X - 0.31, 0.72, LOT_Z);
  solid(LOT_X, LOT_Z, 0.44, 0.6);

  // The radio, on the counter behind the register where the keeper can reach
  // it. Counter top is 1.02 + the 0.05 of ctrTop, so 1.07 is the surface.
  const CTR_TOP = 1.07;
  const radioM = new THREE.MeshBasicMaterial({ color: 0x3a3630 });
  const radio = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.17, 0.13), radioM);
  put(radio, CTR_X - 0.2, CTR_TOP + 0.085, CTR_Z - 1.05);
  const spk = new THREE.Mesh(new THREE.CircleGeometry(0.055, 8),
    new THREE.MeshBasicMaterial({ color: 0x74695a }));
  put(spk, CTR_X - 0.28, CTR_TOP + 0.085, CTR_Z - 1.05);
  spk.rotation.y = -Math.PI / 2;
  // ONE antenna, not two. Two of them at the same tilt read as a pair of grey
  // sticks lying on the counter rather than as a radio — graded off my own
  // shot from the customer side, shots/f-bodega-counter.png.
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.2, 4), steelM);
  ant.rotation.z = 0.35;
  put(ant, CTR_X - 0.14, CTR_TOP + 0.17, CTR_Z - 1.05);

  // The calendar from a food distributor, on the side wall clear of the
  // cigarette rack (2.5 m wide, centred on CTR_Z).
  const calT = declareSurface(pixTex(32, 40, (g) => {
    g.fillStyle = '#e8e0cc'; g.fillRect(0, 0, 32, 40);
    g.fillStyle = '#2a5a8a'; g.fillRect(0, 0, 32, 13);
    g.fillStyle = '#e8e0cc'; g.font = 'bold 6px monospace';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('MARINO', 16, 5); g.fillText('FOODS', 16, 11);
    g.fillStyle = '#8a8478'; g.fillRect(2, 16, 28, 1);
    for (let r = 0; r < 5; r++) for (let c = 0; c < 7; c++) {
      g.fillStyle = (r * 7 + c) % 9 === 4 ? '#b8342a' : '#6a6458';
      g.fillRect(3 + c * 4, 19 + r * 4, 2, 2);
    }
    dither(g, 32, 40, 30);
  }), 'sign');
  room.sign(calT, 0.42, 0.53, hw - 0.07, 1.68, CTR_Z - 2.0, -Math.PI / 2);

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
  // THE KEEPER STANDS BEHIND HIS COUNTER, FACING THE ROOM.
  //
  // He did not. This is the user's original complaint and it survived several
  // rounds of "fixed" because the arithmetic looked right in isolation: the
  // comment said "behind the counter" and the facing was derived from the
  // counter rather than typed, which is the rule. Both were wrong about WHICH
  // SIDE.
  //
  // The counter is centred at CTR_X (local 2.90) with the side wall at
  // hw = 4.40. `CTR_X - 0.55` puts the keeper at 2.35 — between the counter
  // and the room, which is the CUSTOMER'S side. Facing him toward the counter
  // from there points him at the wall and shows the room his back, from
  // everywhere a customer can stand.
  //
  // B verified it from a station the game itself validates: (441.50, 0.40),
  // the frame with the `[E] buy cereal` prompt up, so the world agrees a
  // customer stands there — and the keeper's silhouette is all hair, no face.
  //
  // So: the far side of the counter, and facing back into the room. Both
  // derived from CTR_X, both with the sign the geometry actually requires.
  // `atan2(vx, vz)` with vx = -1 is -PI/2, which looks along -x: past the
  // counter, into the shop, at whoever is buying.
  const KEEP_AT = CTR_X + 0.55;   // the far side — 3.45, clear of the 4.40 wall
  const keeper = room.person({
    jacket: '#4a5a6a', pants: '#3a3a42', skin: '#a0703e', hair: '#2a2622',
    fit: 'plain', accent: '#d8d4c8', cut: 'short', build: 1,
  }, KEEP_AT, CTR_Z, { facing: Math.atan2(CTR_X - KEEP_AT, 0), h: 1.0, w: 0.98 });

  // ══ THE PRICE CARD ON THE COUNTER — AND IT IS THE WHOLE SHOP ══════════════
  //
  // *"for every business i just want to be able to talk to the shop keeper or
  //  cashier and see a diagetic list of options as like a sign or something for
  //  everything you can buy."*   (2026-08-06)
  //
  // ── THE SURFACE IS THE ONE THIS ROOM ALREADY USES ─────────────────────────
  //
  // A bodega does not have a menu board; it has HANDWRITTEN CARDS, and this room
  // has been making them since it was built — `cardT` above paints `COFFEE .65`
  // on the coffee bench, `ICE COLD` taped to the cooler, `ATM INSIDE CASH ONLY`
  // by the door: cream card stock, blue marker, a shadow along the bottom edge.
  // The price list is the same card, bigger, standing on the counter where the
  // customer reads it. Same stock, same marker, prices in red because that is
  // the second pen every corner shop owns.
  //
  // `band: ''` — the heading is WRITTEN with a rule under it. A filled colour
  // bar is a printed sign's idiom and would look machine-made on card.
  //
  // ── WHY IT STANDS ON THE COUNTER AND NOT ON THE WALL ──────────────────────
  //
  // Measured, not preferred. The obvious place is the wall behind the till,
  // beside the lottery rack — but that wall is 0.95 m behind the counter's far
  // edge and the keeper stands against it, at the SAME z as the rack. A card
  // small enough to be a card wants the eye about a metre off it, which puts the
  // camera behind the counter and the shopkeeper's own sprite between the eye
  // and the sign. On the counter's customer edge the eye settles at CTR_X−1.36,
  // which is where a customer already stands, with nothing between.
  //
  // At the FAR end of the counter from the register (CTR_Z − 0.85) so it is not
  // clutter standing in front of the till.
  const PRICES: ShopColumn[] = [
    { head: 'PRICES', lines: [
      { id: 'SANDWICH', name: 'SANDWICH', price: 9.00 },
      { id: 'CHIPS', name: 'CHIPS', price: 3.00 },
      { id: 'CEREAL', name: 'CEREAL', price: 10.00 },
      { id: 'SODA', name: 'SODA', price: 5.00 },
      { id: 'COFFEE', name: 'COFFEE', price: 2.50 },
      // *"caffeine pills you can buy in the bodega"* (2026-08-08). Rack by the
      // till, next to the coffee it outlasts: dearer than the cup, cheaper than
      // the cereal — a working stiff's tool, priced like one. The item is
      // `PILLS`, declared in ct/fatigue.ts with the rest of the awake mechanic,
      // whose STIMULANT_HOURS table keys on that id — sell anything else here
      // and the pills would go in the bag and do nothing.
      { id: 'PILLS', name: 'PILLS', price: 6.00 },
      // *"i want to be able to buy smokes at the bodega"* (2026-08-09). The
      // rack behind the till has drawn cigarette packs since the room was
      // built (`backT` above) — this makes them sellable. $8: a 1997 pack ran
      // about $2 and this economy prices at roughly ×4, which also seats it
      // where it belongs on the card — dearer than the pills beside it,
      // cheaper than the cereal. The item is `SMOKES`, declared in ct/goods.ts
      // with the rest of the bodega's stock.
      { id: 'SMOKES', name: 'SMOKES', price: 8.00 },
      { id: 'NEWSPAPER', name: 'PAPER', price: 2.00 },
      // (SOCKS $8 sold here until 2026-08-09 — *"socks seems like not usable
      // at all"*. The item stays in the world: the packages' weighted
      // disappointment, the fence's $2 and the dresser drawer all lean on it.
      // A till line for a thing that does nothing you'd want is a trap, so no
      // shop prints one any more — this card's and the thrift's went together.)
    ] },
  ];
  // Every colour off this room's own `cardT`: #e4dcc4 card, #2a3a6a marker.
  const PRICE_LOOK: BoardLook = {
    panel: '#e4dcc4', frame: '#cbbf9f', band: '', bandInk: '#2a3a6a',
    ink: '#2a3a6a', priceInk: '#8a2a22', rule: '#2a3a6a',
    hover: 'rgba(42,58,106,0.13)', flash: 'rgba(160,40,32,0.34)',
  };
  // 0.56 x 0.72 m of card at 500 texels per metre — the density `ct/drawer.ts`
  // uses for the other surface in this world you put your face right up to, and
  // for the same reason: it is read at arm's length, not across a room.
  const CARD_W = 0.56, CARD_H = 0.72;
  const CARD_X = CTR_X - 0.42, CARD_Z = CTR_Z - 0.85;
  const CARD_Y = 1.08 + CARD_H / 2;          // stood on the counter top
  const CARD_PX = Math.round(CARD_W * 500), CARD_PY = Math.round(CARD_H * 500);
  const cardFace = new THREE.Mesh(new THREE.PlaneGeometry(CARD_W, CARD_H),
    ctx.flat(boardTexture(CARD_PX, CARD_PY, PRICES, PRICE_LOOK)));
  cardFace.rotation.y = -Math.PI / 2;        // faces −x, into the shop
  put(cardFace, CARD_X, CARD_Y, CARD_Z);
  // the card's own thickness and the batten holding it up, so it is an object
  // standing on a counter rather than a picture floating over one
  const cardBack = new THREE.Mesh(new THREE.BoxGeometry(0.014, CARD_H, CARD_W),
    new THREE.MeshBasicMaterial({ color: 0xcbbf9f }));
  put(cardBack, CARD_X + 0.010, CARD_Y, CARD_Z);
  const prop = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.03, 0.16), woodM);
  put(prop, CARD_X + 0.055, 1.095, CARD_Z);

  // ══ AND THE TWO HAND-WRITTEN BUY SPOTS ARE GONE ═══════════════════════════
  //
  // They were `buy cereal` and `buy soda`, and they carried the same defect the
  // burger barn's pair did, found the same way:
  //
  //     ctx.purse.inv[item] = (ctx.purse.inv[item] ?? 0) + 1;
  //
  // **That bypasses `give`**, which is the only thing that knows a bag holds
  // twelve, a bare hand holds one, and cereal stacks four. So the shop took
  // $2.50 off a player whose hands were full and handed him nothing — and there
  // was no way to notice, because the money and the item were written by the
  // same two lines with nothing between them to fail. Every price and both items
  // survive into the card above; what changes is that the item goes in the bag
  // FIRST and the cash only moves if it went.
  //
  // The five other lines are things this shop visibly stocks and could not sell:
  // the deli case, the rack by the till, the coffee bench whose own card has
  // said `.65` since the day it was built, the papers, and the socks.
  shopCounter(ctx, {
    id: 'ct-shop-bodega',
    columns: PRICES, look: PRICE_LOOK,
    w: CARD_PX, h: CARD_PY,
    mesh: () => cardFace,
    standoff: boardStandoff({ wM: CARD_W, hM: CARD_H, fov: 45, riseM: CARD_Y - 1.75 }),
    fov: 45,
    stand: { x: room.wx(CTR_X - 1.15), z: room.wz(CTR_Z) },
    keeper: { x: keeper.mesh.position.x, z: keeper.mesh.position.z, obj: keeper.mesh },
    who: 'the shopkeeper',
    ok: room.inside,
  });
}
