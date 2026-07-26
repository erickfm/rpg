import * as THREE from 'three';
import type { CtxBuild } from './ctx';
import { pixTex, dither, declareSurface, slabTex } from './paint';
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
  const stockT = declareSurface(pixTex(64, 48, (g) => {
    g.fillStyle = '#7a7263'; g.fillRect(0, 0, 64, 48);
    const cols = ['#b8342a', '#d8b84a', '#3a6a8a', '#4a7a52', '#c86a2a', '#8a4a7a',
      '#d8d0c0', '#6a5a3a', '#2a8a7a', '#b85a5a'];
    for (let sh = 0; sh < 5; sh++) {
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
    dither(g, 64, 48, 60);
  }), 'detail');
  // THE RUNS CLEAR THE CORNER ENTRY.
  //
  // With the door in the CUT, you no longer arrive on the front wall's
  // centreline — you arrive diagonally at the front-right corner, and the runs
  // were still laid out against the old front-wall door. Walking in gave
  // 0.44 m ahead and about a metre each way: the user's "cramped", produced by
  // furniture placed against a door that had moved.
  //
  // "Cramped is a statement about SHAPE, not area" — so this is measured as
  // the largest continuous free run from where you actually come to rest, not
  // in square metres. The runs are shortened and pushed back off the corner,
  // and the extra 1.6 m of depth goes into the approach rather than into more
  // shelving.
  const GOND_L = room.D - 5.6;            // was -3.2: the front end comes back
  const GOND_Z = -1.35;                   // was -0.35: pushed toward the cooler
  const AISLE = 1.15;                     // was 0.95: a capsule is 0.72 across
  const GOND_W = 0.62;
  // THE DOOR LOOKS DOWN AN AISLE, not into the end of a run.
  //
  // The user, with a screenshot: *"THE FIRST THING YOU SEE WALKING INTO THE
  // BODEGA IS A BLANK GREY SLAB filling the middle of the view."* It was a
  // gondola carcass — a 0.62 x 1.95 x 7.8 steel box whose near END sat at
  // z 3.55, 0.8 m in front of where the player comes to rest, on the door's
  // centreline. Untextured, because only the two long FACES ever carried stock.
  // "a grey wall a metre away", precisely.
  //
  // Two things were wrong and both are fixed here. The runs are shifted so the
  // door's centreline falls in an AISLE — walk in and you see down the shop,
  // which is the second half of what the user asked for — and the near end of
  // every run now carries an end cap rather than bare steel.
  const PITCH = GOND_W + AISLE;
  const doorLine = room.doorAt ?? 0;
  const raw = [-hw + 1.5, -hw + 1.5 + PITCH, -hw + 1.5 + 2 * PITCH];
  // slide the whole set so the nearest AISLE centre lands on the door line
  const nearest = raw.reduce((b, g) => Math.abs(g + PITCH / 2 - doorLine) < Math.abs(b + PITCH / 2 - doorLine) ? g : b);
  const shift = doorLine - (nearest + PITCH / 2);
  const gondXs = raw.map((g) => g + shift);
  for (const gx of gondXs) {
    const body = new THREE.Mesh(new THREE.BoxGeometry(GOND_W, 1.95, GOND_L), steelM);
    put(body, gx, 0.975, GOND_Z);
    // the END CAP: a run's end is the most-seen face in the shop and was the
    // only one with nothing on it. Bagged stock, stacked, facing the door.
    // A run's end is the most-seen face in the shop: the dump says these two
    // sit 1.11 m from where you stop walking in, flanking the aisle. The first
    // version drew ONE full-width colour per row, which at that distance is a
    // 0.5 m × 0.22 m slab — seven of them stacked read as colour banding, not
    // as goods, and that is what I graded myself down for last commit.
    //
    // A real end cap is a promo stack: cases of soda and boxes, two or three
    // across, uneven, with a hand-lettered price card over it. Two or three
    // ACROSS is the whole fix — width variation is what stops a row being a band.
    const capT = declareSurface(pixTex(24, 48, (g) => {
      g.fillStyle = '#8a8478'; g.fillRect(0, 0, 24, 48);
      const cols = ['#b8452f', '#3f6a8a', '#c8a33a', '#4a7a4a', '#8a5a7a', '#c05a3a'];
      let y = 46;                                    // stack upward from the floor
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
      dither(g, 24, 48, 70);
    }), 'detail');
    const cap = new THREE.Mesh(new THREE.PlaneGeometry(GOND_W - 0.04, 1.8), ctx.flat(capT));
    put(cap, gx, 0.95, GOND_Z + GOND_L / 2 + 0.012);
    // AND THE FAR END. Capping only the door end left the same bare
    // 0.62 x 1.95 steel face at the back of every run — the user's original
    // complaint reproduced exactly, just seen from the cooler instead of from
    // the door. A sweep for untextured boxes in my rooms is what turned these
    // up; nothing about standing at the entrance would have.
    const capFar = new THREE.Mesh(new THREE.PlaneGeometry(GOND_W - 0.04, 1.8), ctx.flat(capT));
    capFar.rotation.y = Math.PI;
    put(capFar, gx, 0.95, GOND_Z - GOND_L / 2 - 0.012);
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
  // THE COUNTER SITS BESIDE THE CORNER DOOR, NOT ACROSS IT.
  //
  // Walking in through the cut gave 0.45 m ahead: the counter spanned z 0.4 to
  // 3.0 and the diagonal you enter along ran straight into its front. A corner
  // shop puts the counter where it can watch the door — beside the entry, not
  // blocking it — so it moves back off the approach.
  const CTR_X = hw - 1.5, CTR_Z = hd - 7.0;
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
  const deli = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.1, 0.72), woodM);
  put(deli, -hw + 1.6, 0.55, hd - 1.5);
  const deliGlass = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 0.6),
    new THREE.MeshBasicMaterial({ map: deliT, transparent: true, opacity: 0.92, side: THREE.DoubleSide }));
  put(deliGlass, -hw + 1.6, 0.72, hd - 1.5 - 0.37);
  solid(-hw + 1.6, hd - 1.5, 2.2, 0.72);

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
  const CF_X = -hw + 1.0, CF_Z = -hd + 1.4, CF_W = 1.4, CF_D = 0.55, CF_H = 0.92;
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
  put(new THREE.Mesh(new THREE.BoxGeometry(CF_W, CF_H - 0.06, CF_D * 0.92), woodM),
    CF_X, (CF_H - 0.06) / 2, CF_Z);                       // the carcass, set back
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
  const front = new THREE.Mesh(new THREE.PlaneGeometry(CF_W, CF_H - 0.12), ctx.flat(frontT));
  put(front, CF_X, (CF_H - 0.12) / 2, CF_Z + CF_D / 2 + 0.01);

  for (const dx of [-0.42, 0, 0.42]) {
    const ux = CF_X + dx;
    const urn = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.125, 0.40, 10), urnM);
    put(urn, ux, CF_H + 0.20, CF_Z);
    // the LID, domed, with a handle on top
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.125, 0.06, 10), chromeM);
    put(lid, ux, CF_H + 0.43, CF_Z);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.026, 6, 5), urnM);
    put(knob, ux, CF_H + 0.475, CF_Z);
    // THE TAP, on the customer side, which is the detail that says urn
    const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.09, 6), chromeM);
    put(spout, ux, CF_H + 0.10, CF_Z + 0.13);
    const lever = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.07, 0.02), chromeM);
    lever.rotation.x = 0.5;
    put(lever, ux, CF_H + 0.17, CF_Z + 0.13);
    // a sight glass up the side, so it is not one flat black
    const gauge = new THREE.Mesh(new THREE.PlaneGeometry(0.022, 0.24),
      new THREE.MeshBasicMaterial({ color: 0x6a4a2a }));
    put(gauge, ux + 0.11, CF_H + 0.21, CF_Z + 0.055);
  }
  // THE DRIP TRAY, under the taps, running the width
  const tray = new THREE.Mesh(new THREE.BoxGeometry(CF_W - 0.2, 0.018, 0.14), chromeM);
  put(tray, CF_X, CF_H + 0.035, CF_Z + 0.13);

  // the paper cups, a stack of them, beside the urns
  for (let i = 0; i < 3; i++) {
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.034, 0.11, 8),
      new THREE.MeshBasicMaterial({ color: 0xd8d4c8 }));
    put(cup, CF_X + 0.62, CF_H + 0.055 + i * 0.105, CF_Z - 0.12);
  }
  solid(CF_X, CF_Z, CF_W, CF_D);

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
  room.sign(cardT('ICE COLD', '2 / $3'), 0.62, 0.31, -1.7, 1.62, COOL_Z + 0.03);

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
