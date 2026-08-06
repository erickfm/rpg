import * as THREE from 'three';
import type { CtxBuild } from './ctx';
import { pixTex, dither, declareSurface, slabTex } from './paint';
import { buildRoom } from './interior';
import { type DoorDecl } from './doors';
import { FACE } from './rng';
// The fence's prices live beside the loot table they price, not here — a second
// hand-typed copy of a number is this codebase's most expensive habit
// (BUILDER-BRIEF §8), and these two tables have to stay keyed on the same ids.
import { bestFence, fencePrice, itemOf, takeOne } from './inventory';
import { hudNote } from './hud';
import { boardTexture, boardStandoff, shopCounter, type ShopColumn, type BoardLook } from './shop';
import './goods';   // for the side effect: it is what declares the stock

// The PAWN SHOP, inside.
//
// ── WHAT WAS WRONG WITH THE FIRST ONE ─────────────────────────────────────
//
// The user: *"pawn shop interior is janky and odd. i immediately hit a counter.
// it's like i'm behind the counter i don't get it."*
//
// The first version took "a pawn shop keeps you at arm's length" and built it
// out of floor area: a counter running the length of the room with a 1.1 m
// strip in front of it. It was a faithful reading of the brief and it was
// wrong, because a metre of floor is not a shop — it is a service passage, and
// with every good thing on the far side of the counter the player read
// themselves as staff rather than as a customer.
//
// The lesson, and it generalises: **"kept at arm's length" is a property of the
// COUNTER, not of the customer's floor.** A high counter with the stock behind
// it says it on its own. Taking the floor away as well says something else —
// that you are not in the shop at all.
//
// So this version keeps every object and moves exactly one thing: the counter.
//
//   · ONE counter, straight across the back, wall to wall. Not wrapping — a
//     wrap is what makes a room read as the wrong side of the counter.
//   · 1.25 m high, which is chest height and is where the arm's length lives.
//   · The whole front of the room is customer floor: 5.8 m of clear depth
//     against the two the brief asked for. You can stand, turn, and walk the
//     length of the case without touching a wall.
//   · You land in the middle of that floor facing the shop, so the first thing
//     you see is the case, the guitars over it and the cage — not a worktop
//     40 cm from your face.
//
// Everything worth having is still behind the counter and still unreachable.
// That is the pawn shop. The customer just has somewhere to stand now.
//
// ── THE DOOR ──────────────────────────────────────────────────────────────
//
// PAWN stands on the east side of the block, z ∈ [-65.0, -53.0] in street.ts's
// EAST roster, facade on x = +7.0. `pawnFront` still paints no door — the only
// shopfront painter in that file that does not — so the desk set the door at
// the house convention, z = -59.06, which is the building's centre to within
// 6 cm.
//
// `at` is DERIVED from that world position rather than typed, so when the
// frontage descriptor lands and publishes a door centre, changing DOOR_Z moves
// the room's doorway, the standing room and the [E] spot together. Typing a
// local offset beside a world one is exactly how the diner's prompt ended up
// outside the bank.
/**
 * WHERE THIS ROOM'S DOOR IS — declared by the ROOM; the facade follows it.
 * See ct/doors.ts for why that direction. Written against the position this
 * room is actually laid out around, so the painted shopfront door moves to
 * match rather than the furniture moving to match the paint.
 */
export const DOOR: DoorDecl = {
  building: 'PAWN', w: 15, cz: -60.5, side: 1, at: 0, width: 1.15,
  // The reported one: "the LEAF IS MUCH NARROWER THAN ITS OPENING: pale panels
  // show either side of it". Declared now, so the opening and the leaf come from
  // one number. A pawn shop's street door is SOLID and single — no glazing, which
  // is why `glazing: 'none'` here and why the drawn leaf has a barred squint
  // rather than a pane.
  leaf: {
    clearW: 1.15, h: 2.15, leaves: 1,
    frame: { colour: 0x3d2a1e, material: 'timber' }, glazing: 'none',
  },
};

export function buildPawn(ctx: CtxBuild): void {
  const BLD_Z0 = -65.0, BLD_Z1 = -53.0;
  // Outside you face the facade and your right hand runs toward +z; inside you
  // face into the room and your right hand runs toward -x. The two are mirror
  // images because you turned round, so world +z maps to local +x.

  const room = buildRoom(ctx, {
    id: 'pawn',
    label: 'into the PAWN SHOP',
    d: 8.0, h: 2.8,
    palette: { floor: 0x6a6058, wall: 0x7a6f5e, ceil: 0x6e675c, trim: 0x3a2c22 },
    // The width DERIVES from the frontage now — roomWidthFor(15) = 13.8.
    //
    // It was pinned at an explicit 10.0 with the reason "a room that silently
    // grows to 13.8 strands its own fittings in the middle of the floor". That
    // was a fair worry and it does not hold: every fitting in here is placed
    // against `hw` or `room.doorAt`, not against a remembered number, so they
    // all tracked the walls. Tried it and looked — counter spans the full run,
    // the tools/guitars/brass spread across the longer back wall, the island
    // and the shelving unit stay against their own walls. Nothing stranded.
    //
    // And the pinned version had a cost the note did not mention: a 10 m room
    // behind a 15 m shopfront is the false front the kit's own comment objects
    // to.
    //
    // I also offered this as the likely cause of A's mirror harness reading this
    // room's door 6.23 m off centre. That was wrong and the claim is withdrawn:
    // A traced it to their scan measuring the BACK wall, not the doorway, and
    // retracted the finding. The width change stands on the two reasons above —
    // it does not fix anything, it just stops the room being smaller than the
    // shopfront it sits behind.
    frontage: { name: 'PAWN', w: 15, cz: -60.5, side: 1 },
    door: { r: 1.05, at: DOOR.at },   // width comes from the declared leaf
    // The glazing sits east of the door. One window rather than a pair either
    // side, because the kit opens one — and a pawn shop with a single barred
    // window and a solid pier beside it is right anyway.
    window: { at: 2.6, w: 3.6, h: 1.5, sill: 0.95 },
  });

  const { put, solid } = room;
  const hw = room.W / 2, hd = room.D / 2;

  // ── the way in, matched to the doorway you came through ───────────────
  //
  // Third of the doors the user's sweep turned up, and the mildest: outside,
  // this shop's door is a SOLID dark panel with no glazing at all -- which is
  // right, it is a pawn shop -- and inside the kit hangs a leaf with a window in
  // it. A shop that bars its windows does not put a pane in its door.
  //
  // Temporary and by hand for the same reason as the casino and the hotel: F is
  // extending the frontage descriptor to publish door FORM, ct/interior.ts is
  // F's, and all three of these should be deleted the day that lands. Single
  // leaf here, not double -- matching the facade is the point, and this facade
  // has one.
  // from the declaration — this is the fix for the reported fault
  // READ OFF THIS FILE'S OWN DECLARATION, not fetched with doorLeafFor(). Same
  // number, and the difference is that asking the registry is a RUNTIME import
  // of ./doors — which is the import cycle that drops a building's DOOR from the
  // built bundle with no error. G-rooms-walk caught it the moment I wrote it;
  // `standOf` above exists for exactly the same reason.
  const LEAF_P = DOOR.leaf!;
  const DW = LEAF_P.clearW, DH = Math.min(LEAF_P.h, room.H - 0.2), dAt = room.doorAt;
  {
    const hits: THREE.Mesh[] = [];
    room.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || m.geometry?.type !== 'PlaneGeometry') return;
      const mat = (Array.isArray(m.material) ? m.material[0] : m.material) as THREE.MeshBasicMaterial;
      const img = mat?.map?.image as HTMLCanvasElement | undefined;
      if (img && img.width === 32 && img.height === 64) hits.push(m);
    });
    if (hits.length === 1) hits[0].visible = false;
    else console.warn(`[interior:pawn] expected 1 kit door leaf to hide, found ${hits.length}`
      + ' — the shop now has both the kit door and its own. ct/interior.ts changed shape.');
  }
  const pLeafT = declareSurface(pixTex(24, 56, (g) => {
    g.fillStyle = '#2a1d16'; g.fillRect(0, 0, 24, 56);
    g.fillStyle = '#3d2a1e'; g.fillRect(2, 2, 20, 52);            // solid, no pane
    g.fillStyle = 'rgba(0,0,0,0.30)';                             // two sunk panels
    g.fillRect(5, 6, 14, 18); g.fillRect(5, 30, 14, 18);
    g.fillStyle = 'rgba(255,240,210,0.06)'; g.fillRect(5, 6, 14, 1); g.fillRect(5, 30, 14, 1);
    // the one concession to glass: a small barred squint at head height, which
    // is what a shop like this has instead of a window
    g.fillStyle = '#1a1c1e'; g.fillRect(7, 9, 10, 7);
    g.fillStyle = '#6a6258'; for (let x = 8; x < 17; x += 3) g.fillRect(x, 9, 1, 7);
    g.fillStyle = '#8a7c50'; g.fillRect(18, 26, 2, 8);            // the handle
    dither(g, 24, 56, 34);
  }), 'detail');
  {
    // HELD OPEN AGAINST THE JAMB, NOT HALF OPEN ACROSS THE OPENING.
    //
    // 0.80 rad is 46 degrees: the leaf stood diagonally IN its own doorway,
    // reaching to z 3.505 while the way-out spot is at 3.45. Two things came out
    // of that, and the first is a shipped bug:
    //
    //  - walk to the door and the way-out prompt GOES OUT. crosstown.ts:886 now
    //    requires line of sight to a spot, and this leaf is the thing in the way:
    //    measured, the prompt is live 0.16 m from the spot and null at 0.37 m,
    //    which is exactly where the doorway blocker stops you. So the last step
    //    toward the door is the one that takes the exit away. That is the
    //    *"im literally stuck here"* class, in a room the user has already sent
    //    back once.
    //  - it is the user's own complaint about the library entrance, in his words:
    //    *"the door reads as SHUT-BUT-OPEN — the leaf is swung in with a dark
    //    void behind it"*. A door somebody props open lies back against the
    //    return, it does not hang at 45 degrees in the gap.
    //
    // 1.35 rad is 77 degrees, so the leaf lies back along the west jamb from
    // local x -0.64 to -0.40 — clear of the door centreline at -0.06 by 0.34 m,
    // out of the sight line, and out of the way you walk. It is a plane with no
    // collider, so nothing about the lane changes.
    const LW = DW * 0.95, OPEN = 1.35;
    const hx = dAt - DW / 2;
    const leaf = new THREE.Mesh(new THREE.PlaneGeometry(LW, DH - 0.06),
      new THREE.MeshBasicMaterial({ map: pLeafT, side: THREE.DoubleSide }));
    leaf.rotation.y = -OPEN;
    put(leaf, hx + Math.cos(OPEN) * LW / 2, (DH - 0.06) / 2, hd - 0.10 - Math.sin(OPEN) * LW / 2);
  }
  const DARKWOOD = 0x3a2c22, STEEL = 0x8a8880;
  const woodM = new THREE.MeshBasicMaterial({ color: DARKWOOD });
  const steelM = new THREE.MeshBasicMaterial({ color: STEEL });

  // a handwritten tag, the one thing every object in this room has in common
  const tag = (g: CanvasRenderingContext2D, x: number, y: number) => {
    g.fillStyle = '#ded4b8'; g.fillRect(x, y, 5, 4);
    g.fillStyle = '#3a3630'; g.fillRect(x + 1, y + 1, 3, 1);
    g.fillStyle = '#8a8478'; g.fillRect(x + 2, y - 1, 1, 1);
  };

  // ── the floor ──
  const floorT = declareSurface(pixTex(40, 40, (g) => {
    g.fillStyle = '#6a6058'; g.fillRect(0, 0, 40, 40);
    g.fillStyle = 'rgba(0,0,0,0.10)';
    for (let i = 0; i < 60; i++) g.fillRect((i * 17) % 40, (i * 23) % 40, 3, 1);
    g.fillStyle = 'rgba(255,255,255,0.05)';
    for (let i = 0; i < 30; i++) g.fillRect((i * 29) % 40, (i * 11) % 40, 2, 2);
    dither(g, 40, 40, 70);
  }), 'ground');
  floorT.wrapS = floorT.wrapT = THREE.RepeatWrapping;
  floorT.repeat.set(Math.round(room.W / 2.0), Math.round(room.D / 2.0));
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(room.W, room.D), ctx.flat(floorT));
  floor.rotation.x = -Math.PI / 2;
  put(floor, 0, 0.012, 0);
  // Worn where people actually stand: a wide patch from the door to the case,
  // not the long thin strip the old corridor left. Wear is evidence of where
  // the room is used, so it has to agree with the new plan or it contradicts it.
  // slabTex, not a flat MeshBasicMaterial: an untextured quad over a grained
  // floor reads as a translucent tint rather than a worn patch of the same
  // floor (ct/paint.ts's slabTex doc-comment, and the whole diagnosis behind
  // item 0a). joint: 0 keeps it grain-only, the "worn ground" case the
  // comment names rather than a poured slab.
  const worn = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 4.4),
    ctx.flat(slabTex({ wMeters: 4.6, dMeters: 4.4, base: '#7c7268', joint: 0, grain: 0.09 })));
  worn.rotation.x = -Math.PI / 2;
  // the worn patch follows the DOOR, wherever the facade has put it
  put(worn, room.doorAt + 0.3, 0.014, -0.4);

  // ── the counter: one run, straight across the back ──
  const CTR_ZC = -hd + 1.1, CTR_D = 0.75;
  const caseT = declareSurface(pixTex(96, 22, (g) => {
    g.fillStyle = 'rgba(24,26,28,0.85)'; g.fillRect(0, 0, 96, 22);
    g.fillStyle = '#4a4640'; g.fillRect(0, 10, 96, 1);            // the shelf inside
    // rings on the top shelf, watches on the lower — each on its own tag
    for (let i = 0; i < 11; i++) {
      const x = 4 + i * 8;
      g.strokeStyle = '#c9a45e'; g.lineWidth = 1;
      g.beginPath(); g.arc(x + 2, 5, 2, 0, Math.PI * 2); g.stroke();
      g.fillStyle = i % 3 === 0 ? '#b8c0c8' : '#c9a45e'; g.fillRect(x, 13, 5, 4);
      g.fillStyle = '#8a8478'; g.fillRect(x + 1, 17, 3, 1);
      if (i % 2 === 0) tag(g, x, 18);
    }
    g.fillStyle = 'rgba(190,215,225,0.16)'; g.fillRect(0, 0, 96, 9);  // the glass
    g.fillStyle = '#8a8478'; g.fillRect(0, 0, 96, 1); g.fillRect(0, 21, 96, 1);
  }), 'detail');
  const frontT = declareSurface(pixTex(96, 26, (g) => {
    g.fillStyle = '#3a2c22'; g.fillRect(0, 0, 96, 26);
    g.fillStyle = '#4a3a2c';
    for (let x = 2; x < 96; x += 12) g.fillRect(x, 3, 9, 20);      // panelled
    g.fillStyle = 'rgba(0,0,0,0.35)';
    for (let x = 2; x < 96; x += 12) g.fillRect(x, 22, 9, 1);
    g.fillStyle = '#5a4636'; g.fillRect(0, 0, 96, 2);
    dither(g, 96, 26, 50);
  }), 'detail');
  const caseM = ctx.flat(caseT), frontM = ctx.flat(frontT);
  put(new THREE.Mesh(new THREE.BoxGeometry(room.W, 0.9, CTR_D),
    [frontM, frontM, woodM, frontM, frontM, frontM]), 0, 0.45, CTR_ZC);
  put(new THREE.Mesh(new THREE.BoxGeometry(room.W, 0.3, CTR_D),
    [caseM, caseM, caseM, caseM, caseM, caseM]), 0, 1.05, CTR_ZC);
  put(new THREE.Mesh(new THREE.BoxGeometry(room.W, 0.06, CTR_D + 0.1), woodM), 0, 1.23, CTR_ZC);
  // Wall to wall, so the staff strip behind it is sealed without needing a
  // second run of anything. This is the ONE counter and it does not turn.
  solid(0, CTR_ZC, room.W, CTR_D);

  // the till, and a tethered pen on the customer's side of the glass
  put(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.26, 0.34),
    new THREE.MeshBasicMaterial({ color: 0x4a4a44 })), 3.6, 1.39, CTR_ZC);
  put(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.02, 0.24),
    new THREE.MeshBasicMaterial({ color: 0xded4b8 })), -1.2, 1.27, CTR_ZC + 0.22);

  // ── the broker, behind the counter where he belongs ───────────────────
  //
  // The user: *"the people inside these places are always flat and not like the
  // people on the street"*. This shop had nobody in it, which undercut the
  // whole point of the room — a counter built to keep you at arm's length is
  // just furniture if there is nobody on the other side of it holding the line.
  //
  // He stands in the staff strip behind the counter, facing the customer floor:
  // FACING DERIVED FROM THE COUNTER, not typed. This read `facing: Math.PI` with
  // the comment "atan2(vx, vz) toward +z, which is out toward the door" — the
  // SAME sentence, wrong the same way, as the tax office had. `person` takes
  // 0 = +z, so PI is -z: the broker was facing the back wall with the customer
  // behind him. Two rooms carrying one copied mistake is GOTCHAS §23 exactly.
  //
  // He now faces across his own counter at whoever is on the customer side, so
  // moving the counter moves his head. A little grime, because this is a shop
  // where the proprietor works the bench himself. `room.person` is the kit's
  // wrapper over the same atlas the street citizens use, and it owns the
  // per-frame turn — see notes/CITIZEN-STYLE.md.
  const BROKER_X = room.doorAt + 1.6, BROKER_Z = CTR_ZC - 0.62;   // behind his counter
  room.person({ jacket: '#4a4238', pants: '#2e2a26', skin: '#c9946a', hair: '#6a6058',
      accent: '#8a2c22', fit: 'plain', cut: 'bald', build: 1, stride: 2, grime: 0.35 },
    BROKER_X, BROKER_Z,
    { facing: Math.atan2(0, (CTR_ZC + CTR_D) - BROKER_Z), h: 1.0, w: 1.03 });

  // ── …and he fences ────────────────────────────────────────────────────
  //
  // *"it should also serve as a fence for the stuff you steal from neighbors."*
  //
  // The design choice and the prices are stated where they belong, beside the
  // loot table they have to stay honest against — `ct/inventory.ts`, under
  // "what the pawn shop pays for it". Short version: he takes stolen goods and
  // only stolen goods, asks nothing, and pays badly.
  //
  // ⚠ NOTHING IS BUILT HERE. A spot is a trigger, not a mesh — no geometry is
  // added, no collider, and the counter's `solid()` above is untouched. That
  // matters twice over: the room's clearances are exactly what they were, and
  // the user's original complaint about this room was *"i immediately hit a
  // counter"*, so a fence that put anything else on the customer floor would be
  // reopening the bug it is built next to.
  //
  // DERIVED FROM THE COUNTER, so it cannot strand itself if the counter moves:
  // the collider spans `CTR_ZC ± CTR_D / 2`, and the player stands 0.55 m clear
  // of its customer face. `BROKER_X` puts him in front of the man, not in front
  // of the middle of an empty run.
  const FENCE_Z = CTR_ZC + CTR_D / 2 + 0.55;
  ctx.spot({
    x: room.wx(BROKER_X), z: room.wz(FENCE_Z), r: 1.0,
    ok: room.inside,
    // THE PROMPT NAMES THE THING AND THE PRICE BEFORE YOU PRESS, which is this
    // project's rule for a refusal being honest (`give()`'s own note): you are
    // never told "no" by nothing happening. With nothing he wants, the line
    // says so and says why in his voice rather than going blank — a blank spot
    // and a broken spot look identical.
    // BOTH WORDINGS NAME THE COUNTER, and that is not decoration — it is what
    // makes this room PUBLISH A CUSTOMER STATION.
    //
    // `interiors-walk.mjs:1431` looks for a spot near the room whose label
    // matches `/buy|order|serve|till|counter/i` and, finding none, falls back
    // to the keeper pair authored in this same file — which it then refuses to
    // trust, correctly: *"a station I authored, checked against a keeper I
    // authored, in a room I authored, agrees with itself whatever the player
    // sees. That is not a test, it is a mirror."* pawn is one of the four rooms
    // item 251 recorded as failing that way.
    //
    // ⚠ THE REFUSAL LINE HAS TO CARRY THE WORD TOO, and measuring is how I
    // learned it. `scripts/probes/w103-pawn-served-spot.mjs` read the room's
    // published spots with an empty-of-loot purse and found the label was
    // "the broker doesn’t want anything you’re carrying" — so a station that
    // only names itself while you happen to be holding stolen goods is a
    // station the harness sees only sometimes. A prompt's PLACE should not
    // depend on your pockets.
    //
    // This is the world publishing what the check hunts for, NOT the check
    // being loosened to accept what the world had (BUILDER-BRIEF §7). Nothing
    // in `interiors-walk.mjs` is touched, and naming the counter is better
    // player-facing text anyway — it is the house habit ("out to the street").
    label: () => {
      const id = bestFence(ctx.purse);
      if (!id) return 'the pawn counter — he doesn’t want anything you’re carrying';
      return `sell the ${itemOf(id).name} at the counter — $${fencePrice(id).toFixed(2)}, no questions`;
    },
    act: () => {
      const id = bestFence(ctx.purse);
      if (!id) return;
      const paid = fencePrice(id);
      // Take it out FIRST, and only pay if it actually left the pockets. The
      // opposite order pays for an item a concurrent change could have removed.
      if (!takeOne(ctx.purse, id)) return;
      ctx.purse.cash += paid;
      ctx.refreshWallet();
      hudNote(`He doesn’t ask. $${paid.toFixed(2)} for the ${itemOf(id).name}.`);
    },
  });

  // ══ …AND HE SELLS, WHICH IS THE OTHER HALF OF A PAWN SHOP ═════════════════
  //
  // *"for every business i just want to be able to talk to the shop keeper or
  //  cashier and see a diagetic list of options as like a sign or something for
  //  everything you can buy."*   (2026-08-06)
  //
  // A pawnbroker who only BUYS is a scrap dealer. The fence above is untouched —
  // same prices, same prompt, same one-item-at-a-time joke — and this is the
  // counter's other direction: a RATE CARD standing on the glass, with what he
  // is asking for the same kinds of things he takes in.
  //
  // ── THE SPREAD IS THE POINT AND IT IS DERIVED, NOT TYPED ──────────────────
  //
  // Four of the six lines are items `FENCE` in `ct/inventory.ts` already prices,
  // and the card's asking price is `MARKUP` times what he pays, rounded to the
  // period's own price points. He gives you $2 for a tape and wants $4; $5 for
  // the trainers and wants $12; **fifty cents for the socks and $1.50 for the
  // socks**. Read one number off the prompt and the other off the card and the
  // whole character of the shop is in the difference — which only works because
  // both numbers describe the same object, so the resale prices come OFF the
  // fence table (BUILDER-BRIEF §8) rather than being a second set of figures
  // that could drift away from it.
  //
  // The two lines that are not in that table are the two things this room draws
  // and could not sell: the radio on the shelf behind him and the watches lying
  // on their tags under the counter glass you are reading the card over.
  const ask = (id: string, mult: number, floor: number) =>
    Math.max(floor, Math.round(fencePrice(id) * mult * 2) / 2);
  const RATES: ShopColumn[] = [
    { head: 'FOR SALE', lines: [
      { id: 'WRISTWATCH', name: 'WATCH', price: 15.00 },
      { id: 'TRAINERS', name: 'SHOES', price: ask('TRAINERS', 2.4, 6) },
      { id: 'TOASTER', name: 'TOASTER', price: ask('TOASTER', 2.25, 4) },
      { id: 'RADIO', name: 'RADIO', price: 7.00 },
      { id: 'VHS', name: 'TAPE', price: ask('VHS', 2, 2) },
      { id: 'SOCKS', name: 'SOCKS', price: ask('SOCKS', 3, 1.5) },
    ] },
  ];
  // Card stock gone brown under a caged bulb, the shop's own gold for the
  // figures. `band: ''`: a rule under the heading, because this was written by
  // the man behind the counter and not printed for him.
  const RATE_LOOK: BoardLook = {
    panel: '#ded2b2', frame: '#8a7450', band: '', bandInk: '#3a2c22',
    ink: '#3a2c22', priceInk: '#8a2c22', rule: '#8a7450',
    hover: 'rgba(58,44,34,0.13)', flash: 'rgba(201,164,94,0.42)',
  };
  // 0.58 x 0.72 m of card at 500 texels per metre, STANDING ON THE COUNTER
  // GLASS. The obvious place is the back wall, and there is not a centimetre of
  // it left: the tool board, the guitars, the brass, the knife case, the bolt
  // cutters and the gun cabinet already fill it wall to wall, and every one of
  // them was placed to be visible OVER this counter. Nothing is moved for a
  // sign.
  //
  // At x 1.2 — halfway between the tethered pen at −1.2 and the till at 3.6,
  // which is the one clear stretch of glass, and derived from those two rather
  // than chosen.
  const CARD_W = 0.58, CARD_H = 0.72;
  const CARD_X = (-1.2 + 3.6) / 2;
  const CARD_Z = CTR_ZC + CTR_D / 2 - 0.07;
  const CARD_Y = 1.26 + CARD_H / 2;               // the counter top is 1.26
  const CARD_PX = Math.round(CARD_W * 500), CARD_PY = Math.round(CARD_H * 500);
  const rateCard = new THREE.Mesh(new THREE.PlaneGeometry(CARD_W, CARD_H),
    ctx.flat(boardTexture(CARD_PX, CARD_PY, RATES, RATE_LOOK)));
  put(rateCard, CARD_X, CARD_Y, CARD_Z);          // faces +z, at the customer
  put(new THREE.Mesh(new THREE.BoxGeometry(CARD_W, CARD_H, 0.014),
    new THREE.MeshBasicMaterial({ color: 0x8a7450 })), CARD_X, CARD_Y, CARD_Z - 0.011);
  put(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.03, 0.10), woodM),
    CARD_X, 1.275, CARD_Z - 0.035);

  // ── AND IT AIMS AT THE CARD, NOT AT THE MAN ──────────────────────────────
  //
  // The one place this shop departs from the pattern, and it is forced: the
  // broker ALREADY carries a prompt — the fence, 2.4 m along the same counter,
  // aimed at him. `fp.ts`'s picker resolves aimed selection out to several
  // metres, so two spots pointing at one sprite would trade the prompt back and
  // forth as the player's head moved and neither would be reliably reachable.
  //
  // So `aimX/aimZ` and `obj` are the CARD, and the label names him instead. The
  // two verbs stay legible and separable: you look at the man to sell, and at
  // his card to buy.
  shopCounter(ctx, {
    id: 'ct-shop-pawn',
    columns: RATES, look: RATE_LOOK,
    w: CARD_PX, h: CARD_PY,
    mesh: () => rateCard,
    standoff: boardStandoff({ wM: CARD_W, hM: CARD_H, fov: 45, riseM: CARD_Y - 1.75 }),
    fov: 45,
    stand: { x: room.wx(CARD_X), z: room.wz(FENCE_Z) },
    keeper: { x: room.wx(CARD_X), z: room.wz(CARD_Z), obj: rateCard },
    who: 'the broker — his rate card',
    ok: room.inside,
  });

  // ── the back wall, which is now what you walk in facing ──
  //
  // Everything the shop is proud of, hung where the customer sees it over the
  // case and cannot reach it. Read left to right: the tools, the guitars, the
  // brass. That order is deliberate — the guitars are dead centre because they
  // are the thing you come in for.
  const toolT = declareSurface(pixTex(64, 40, (g) => {
    g.fillStyle = '#4a453c'; g.fillRect(0, 0, 64, 40);
    g.fillStyle = '#3a3630'; g.fillRect(2, 2, 60, 36);
    g.fillStyle = 'rgba(0,0,0,0.18)';
    for (let y = 4; y < 38; y += 3) for (let x = 4; x < 62; x += 3) g.fillRect(x, y, 1, 1);
    const tools: [number, number, number, number, string][] = [
      [6, 5, 4, 14, '#8a8478'], [14, 5, 3, 11, '#8a8478'], [22, 6, 6, 7, '#6a5a3a'],
      [34, 5, 4, 15, '#8a8478'], [44, 6, 8, 5, '#7a6a4a'], [56, 5, 3, 12, '#8a8478'],
      [6, 24, 7, 9, '#6a5a3a'], [18, 25, 10, 6, '#8a8478'], [34, 23, 5, 11, '#7a6a4a'],
      [46, 25, 9, 7, '#8a8478'],
    ];
    for (const [x, y, w, h, col] of tools) {
      g.fillStyle = 'rgba(0,0,0,0.30)'; g.fillRect(x + 1, y + 1, w, h);
      g.fillStyle = col; g.fillRect(x, y, w, h);
      tag(g, x, y + h);
    }
    g.fillStyle = '#5a5348'; g.fillRect(2, 21, 60, 2); g.fillRect(2, 36, 60, 2);
    dither(g, 64, 40, 40);
  }), 'detail');
  put(new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.2), ctx.flat(toolT)), -3.1, 2.05, -hd + 0.07);

  const guitarT = declareSurface(pixTex(96, 44, (g) => {
    g.clearRect(0, 0, 96, 44);
    const bodies = ['#8a4a2a', '#3a3a44', '#6a3a2a', '#7a6a3a', '#4a2a2a', '#5a5a4a'];
    for (let i = 0; i < 6; i++) {
      const x = 5 + i * 15, col = bodies[i];
      g.fillStyle = '#2e2620'; g.fillRect(x + 4, 2, 2, 22);        // the neck
      g.fillStyle = '#4a3a2a'; g.fillRect(x + 3, 0, 4, 4);         // the head
      g.fillStyle = col;                                           // the body
      g.fillRect(x, 22, 11, 8); g.fillRect(x + 1, 30, 9, 6);
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.arc(x + 5, 27, 2, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#c9a45e'; g.fillRect(x + 2, 32, 7, 1);
      tag(g, x + 3, 37);
    }
  }), 'detail');
  // Sized and hung to clear the counter top at 1.25 m. Hung centred on the wall
  // instead, the counter ate the bottom half of every instrument — which is the
  // half with the body on it, so a wall of guitars read as a row of necks.
  put(new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.45),
    new THREE.MeshBasicMaterial({ map: guitarT, alphaTest: 0.5 })), 0.4, 2.05, -hd + 0.08);

  const brassT = declareSurface(pixTex(40, 72, (g) => {
    g.clearRect(0, 0, 40, 72);
    g.fillStyle = '#b08a3a';
    g.fillRect(6, 6, 20, 3); g.fillRect(24, 4, 4, 7);              // trumpet + bell
    g.fillStyle = '#c9a45e'; g.fillRect(8, 9, 3, 4); g.fillRect(13, 9, 3, 4); g.fillRect(18, 9, 3, 4);
    tag(g, 10, 14);
    g.fillStyle = '#a8823a';
    g.fillRect(4, 26, 26, 3); g.fillRect(4, 29, 3, 8); g.fillRect(28, 24, 5, 8);  // trombone
    tag(g, 12, 33);
    g.fillStyle = '#b08a3a';                                        // sax
    g.fillRect(14, 46, 4, 14); g.fillRect(12, 60, 10, 6); g.fillRect(15, 42, 3, 5);
    g.fillStyle = '#c9a45e'; for (let i = 0; i < 4; i++) g.fillRect(19, 48 + i * 3, 2, 2);
    tag(g, 24, 56);
  }), 'detail');
  put(new THREE.Mesh(new THREE.PlaneGeometry(0.95, 1.42),
    new THREE.MeshBasicMaterial({ map: brassT, alphaTest: 0.5 })), 3.9, 2.05, -hd + 0.08);

  // ── THE HARD STOCK: knives, bolt cutters, guns ────────────────────────
  //
  // The user: *"pawn shop should contain, knives, bolt cutters, guns, on top of
  // the regular stuff."* **ON TOP OF.** Nothing above this line is touched —
  // the tools, the guitars, the brass, the TV stack, the island case and the
  // west cabinet are all exactly where they were. This adds three fittings to
  // wall that was empty.
  //
  // WHERE, AND WHY THERE. A real shop puts this stock behind glass, behind the
  // counter, on the wall the customer cannot reach — which is both period-true
  // and how you say "not for browsing" without a word of text. The counter
  // already runs wall to wall at 1.26 m, so anything hung above it is visible
  // and unreachable at the same time, and the three gaps in the back wall are
  // the only places in the room where that is true:
  //
  //     x  -6.9 .. -4.75   west of the TV stack   -> the knife case
  //     x   2.60 ..  3.42  between guitars and brass -> the bolt cutters
  //     x   4.38 ..  6.9   east of the brass      -> the gun cabinet
  //
  // Those bounds are the existing art's own extents, not free numbers: the
  // tool board is 3.2 m at x −3.1, the guitars 4.4 m at 0.4, the brass 0.95 m
  // at 3.9. Everything below is placed against `hw`, so a change to the
  // frontage moves the new fittings with the old ones.
  //
  // ALL THREE ARE BOXES WITH ONE DRAWN FACE, the TV stack's own pattern —
  // material index 4 is +z, the face you look at. A case with 0.14 m of depth
  // reads as a case; a bare plane reads as a poster of one.
  //
  // DENSITY: every canvas below is sized `metres × HARD_PPM` on BOTH axes, and
  // declares it. That is item 163's `declareSurface(t, kind, ppm)` — the third
  // argument did not exist until today, and §7b's rule could not be obeyed
  // without it. The item's own instruction was "do not add to the gross count";
  // sizing both axes off one px/m makes every one of these faces exactly
  // square by construction rather than by luck, which is what the count is.
  const HARD_PPM = 40;
  const hardCanvas = (wM: number, hM: number, draw: (g: CanvasRenderingContext2D) => void) =>
    declareSurface(pixTex(Math.round(wM * HARD_PPM), Math.round(hM * HARD_PPM), draw), 'detail', HARD_PPM);
  const caseSideM = new THREE.MeshBasicMaterial({ color: 0x2e2a24 });
  /** a glazed wall case: dark carcass, one drawn face looking at the customer */
  const wallCase = (x: number, y: number, wM: number, hM: number, map: THREE.Texture) => {
    const m = new THREE.MeshBasicMaterial({ map });
    put(new THREE.Mesh(new THREE.BoxGeometry(wM, hM, 0.14),
      [caseSideM, caseSideM, caseSideM, caseSideM, m, caseSideM]),
      x, y, -hd + 0.16);
  };

  // THE KNIFE CASE — "a row of bright verticals under glass" is the whole read.
  // Blades point UP and are the palest thing in the room, on a felt back that is
  // the darkest; at this pixel scale that contrast IS the object, because a
  // knife drawn as a knife is four texels of nothing. Two shelves, because one
  // row of anything reads as a sample and two reads as stock.
  const KN_W = 2.0, KN_H = 1.0;
  const knifeT = hardCanvas(KN_W, KN_H, (g) => {
    const W = KN_W * HARD_PPM, H = KN_H * HARD_PPM;
    g.fillStyle = '#2e2a24'; g.fillRect(0, 0, W, H);                  // the carcass
    g.fillStyle = '#3a2a2e'; g.fillRect(3, 3, W - 6, H - 6);          // oxblood felt
    for (const [row, n, len] of [[8, 13, 17], [24, 11, 13]] as [number, number, number][]) {
      const step = (W - 12) / n;
      for (let i = 0; i < n; i++) {
        const x = 6 + Math.round(i * step);
        // the blade: pale, tapering, one texel of edge-light down its spine
        g.fillStyle = '#b8bec4'; g.fillRect(x, row, 3, len);
        g.fillStyle = '#d8dee4'; g.fillRect(x, row + 1, 1, len - 2);
        g.fillStyle = '#8a9098'; g.fillRect(x + 2, row, 1, len);
        // the handle, below it, in one of three horn/bone/black colours
        g.fillStyle = ['#3a2a1e', '#c8bca0', '#1e1c1a'][i % 3];
        g.fillRect(x - 1, row + len, 5, 6);
        g.fillStyle = '#8a8478'; g.fillRect(x, row + len + 2, 3, 1);  // the bolster
      }
      g.fillStyle = '#4a443c'; g.fillRect(3, row + len + 7, W - 6, 1);  // the shelf lip
    }
    tag(g, W - 14, H - 9);
    g.fillStyle = 'rgba(190,215,225,0.14)'; g.fillRect(3, 3, W - 6, Math.round(H * 0.42));
    g.fillStyle = '#8a8478'; g.fillRect(2, 2, W - 4, 1); g.fillRect(2, H - 3, W - 4, 1);
    dither(g, W, H, 60);
  });
  wallCase(-5.8, 1.95, KN_W, KN_H, knifeT);

  // THE GUN CABINET — "a dark angular silhouette against a pale pegboard".
  // Long guns racked upright because that is how they are stored and because a
  // vertical is the only way a 1.1 m object fits a 1.25 m case; two handguns on
  // the bottom shelf so the silhouettes are not all one shape. The pegboard is
  // the palest surface in the room, which is what makes the silhouettes read.
  const GN_W = 2.4, GN_H = 1.25;
  const gunT = hardCanvas(GN_W, GN_H, (g) => {
    const W = GN_W * HARD_PPM, H = GN_H * HARD_PPM;
    g.fillStyle = '#2e2a24'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#b0a892'; g.fillRect(3, 3, W - 6, H - 6);          // pale pegboard
    g.fillStyle = 'rgba(0,0,0,0.16)';
    for (let y = 7; y < H - 8; y += 4) for (let x = 7; x < W - 8; x += 4) g.fillRect(x, y, 1, 1);
    const SHELF = H - 17;
    // five long guns, upright, alternating rifle and shotgun silhouettes
    for (let i = 0; i < 5; i++) {
      const x = 10 + i * Math.round((W - 26) / 5), rifle = i % 2 === 0;
      g.fillStyle = '#23201c';                                        // barrel
      g.fillRect(x + 2, 8, rifle ? 2 : 3, SHELF - 24);
      if (!rifle) g.fillRect(x + 5, 8, 2, SHELF - 24);                // the second bore
      g.fillStyle = '#3a2a1e';                                        // stock, walnut
      g.fillRect(x, SHELF - 18, 6, 14);
      g.fillRect(x + 1, SHELF - 5, 4, 4);
      g.fillStyle = '#23201c';                                        // trigger guard
      g.fillRect(x + 4, SHELF - 12, 3, 2);
      if (rifle) { g.fillStyle = '#4a453c'; g.fillRect(x + 1, 12, 4, 3); }   // a scope
    }
    g.fillStyle = '#5a5348'; g.fillRect(3, SHELF, W - 6, 2);          // the shelf
    // two handguns lying on it, angled by being drawn as two blocks not one
    for (const hx of [12, W - 34]) {
      g.fillStyle = '#23201c'; g.fillRect(hx, SHELF + 5, 15, 4);
      g.fillRect(hx + 10, SHELF + 8, 4, 6);
      g.fillStyle = '#3a2a1e'; g.fillRect(hx + 10, SHELF + 9, 4, 5);
      tag(g, hx + 1, SHELF + 10);
    }
    // the glass, and the lock that says this one is not open
    g.fillStyle = 'rgba(190,215,225,0.13)'; g.fillRect(3, 3, W - 6, Math.round(H * 0.5));
    g.fillStyle = '#8a8478'; g.fillRect(Math.round(W / 2) - 1, 3, 2, H - 6);   // the mullion
    g.fillStyle = '#c9a45e'; g.fillRect(Math.round(W / 2) - 3, Math.round(H / 2), 6, 5);
    g.fillStyle = '#2e2a24'; g.fillRect(Math.round(W / 2) - 1, Math.round(H / 2) + 2, 2, 2);
    g.fillStyle = '#8a8478'; g.fillRect(2, 2, W - 4, 1); g.fillRect(2, H - 3, W - 4, 1);
    dither(g, W, H, 70);
  });
  wallCase(5.6, 2.08, GN_W, GN_H, gunT);

  // THE BOLT CUTTERS — "one long shape with red grips, and the red is what
  // sells them". So they hang OUTSIDE the glass, on a board of their own in the
  // 0.8 m gap between the guitars and the brass: they are hardware, not
  // treasure, and a shop that locks its bolt cutters up is telling a different
  // story from the one this street tells. Three pairs, descending, because a
  // size run is what a rack of tools looks like.
  //
  // He named a burglary tool between knives and guns and I have taken that as
  // deliberate — see the DONE line about making them a real item.
  const BC_W = 0.8, BC_H = 1.2;
  const cutterT = hardCanvas(BC_W, BC_H, (g) => {
    const W = BC_W * HARD_PPM, H = BC_H * HARD_PPM;
    g.fillStyle = '#4a453c'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#3a3630'; g.fillRect(2, 2, W - 4, H - 4);
    g.fillStyle = 'rgba(0,0,0,0.18)';
    for (let y = 4; y < H - 4; y += 3) for (let x = 4; x < W - 4; x += 3) g.fillRect(x, y, 1, 1);
    const LEN = [34, 28, 22];
    for (let i = 0; i < 3; i++) {
      const x = 5 + i * 10, top = 6;
      g.fillStyle = 'rgba(0,0,0,0.30)'; g.fillRect(x + 1, top + 1, 6, LEN[i]);
      g.fillStyle = '#8a8478'; g.fillRect(x + 2, top, 3, 9);            // the jaws
      g.fillStyle = '#b8bec4'; g.fillRect(x + 2, top, 1, 7);
      g.fillStyle = '#5a5348';                                          // the compound head
      g.fillRect(x + 1, top + 9, 5, 5);
      g.fillStyle = '#6a6058'; g.fillRect(x + 1, top + 14, 2, LEN[i] - 22);   // the shafts
      g.fillRect(x + 4, top + 14, 2, LEN[i] - 22);
      g.fillStyle = '#a8261e';                                          // THE GRIPS
      g.fillRect(x, top + LEN[i] - 8, 3, 8);
      g.fillRect(x + 4, top + LEN[i] - 8, 3, 8);
      g.fillStyle = '#c8362a'; g.fillRect(x, top + LEN[i] - 8, 1, 8);
      g.fillRect(x + 4, top + LEN[i] - 8, 1, 8);
      tag(g, x + 1, top + LEN[i] + 1);
    }
    g.fillStyle = '#5a5348'; g.fillRect(2, 4, W - 4, 1);                // the rail they hang on
    dither(g, W, H, 30);
  });
  wallCase(3.0, 2.05, BC_W, BC_H, cutterT);

  // ── the TV stack, standing in the staff strip behind the counter ──
  //
  // Four sets of four different vintages, none of them on. A pawn shop's TV
  // stack is always this: the thing nobody redeemed. Stacked to 2.1 m so it
  // shows well over a 1.25 m counter — a stack you cannot see is not a stack.
  const tvT = declareSurface(pixTex(32, 26, (g) => {
    g.fillStyle = '#4a453c'; g.fillRect(0, 0, 32, 26);
    g.fillStyle = '#2a2a2e'; g.fillRect(3, 3, 20, 17);             // the tube, dark
    g.fillStyle = 'rgba(255,255,255,0.07)'; g.fillRect(4, 4, 18, 6);
    g.fillStyle = '#5a5348'; g.fillRect(25, 4, 5, 16);             // the control panel
    g.fillStyle = '#8a8478'; g.fillRect(26, 6, 3, 2); g.fillRect(26, 10, 3, 2);
    tag(g, 25, 21);
    dither(g, 32, 26, 20);
  }), 'detail');
  const tvM = ctx.flat(tvT);
  const tvBackM = new THREE.MeshBasicMaterial({ color: 0x3a3630 });
  const sizes: [number, number, number][] = [[0.78, 0.62, 0.55], [0.7, 0.56, 0.5], [0.62, 0.5, 0.46], [0.54, 0.44, 0.42]];
  let ty = 0;
  for (const [w, h, d] of sizes) {
    put(new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
      [tvBackM, tvBackM, tvBackM, tvBackM, tvM, tvBackM]), -4.3, ty + h / 2, -hd + 0.42);
    ty += h;
  }

  // ── one floor case, so the customer floor has a reason to exist ──
  //
  // Not a second counter and not a wrap: a low island you walk around, which is
  // what stops 10 × 5.8 m of clear floor reading as a warehouse. Set well west
  // of the door so the way in and the way to the counter are both open.
  const ISL_X = -2.4, ISL_Z = 0.9;
  put(new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.78, 0.8),
    [frontM, frontM, woodM, frontM, frontM, frontM]), ISL_X, 0.39, ISL_Z);
  put(new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.26, 0.8),
    [caseM, caseM, caseM, caseM, caseM, caseM]), ISL_X, 0.91, ISL_Z);
  put(new THREE.Mesh(new THREE.BoxGeometry(2.06, 0.05, 0.86), woodM), ISL_X, 1.06, ISL_Z);
  solid(ISL_X, ISL_Z, 2.0, 0.8);

  // ── a locked cabinet on the west wall, on the customer's side ──
  //
  // The one thing the customer can walk right up to, and it is still glass and
  // still locked. It keeps that wall from being blank without giving anything
  // away.
  const cabT = declareSurface(pixTex(48, 40, (g) => {
    g.fillStyle = '#3a3630'; g.fillRect(0, 0, 48, 40);
    g.fillStyle = '#241f22'; g.fillRect(3, 3, 42, 34);
    g.fillStyle = '#4a4640'; g.fillRect(3, 14, 42, 1); g.fillRect(3, 26, 42, 1);
    const goods: [number, number, number, number, string][] = [
      [7, 6, 6, 6, '#c9a45e'], [17, 7, 5, 5, '#b8c0c8'], [26, 5, 8, 7, '#8a4a2a'],
      [8, 17, 7, 7, '#7a6a4a'], [20, 18, 9, 5, '#c9a45e'], [33, 17, 6, 7, '#b8c0c8'],
      [7, 29, 10, 6, '#6a5a3a'], [22, 29, 7, 6, '#8a4a2a'], [33, 30, 6, 5, '#c9a45e'],
    ];
    for (const [x, y, w, h, col] of goods) { g.fillStyle = col; g.fillRect(x, y, w, h); tag(g, x, y + h); }
    g.fillStyle = 'rgba(190,215,225,0.14)'; g.fillRect(3, 3, 42, 34);
    g.fillStyle = '#8a8478'; g.fillRect(23, 3, 2, 34);             // the mullion
    dither(g, 48, 40, 26);
  }), 'detail');
  const cab = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.6), ctx.flat(cabT));
  cab.rotation.y = Math.PI / 2;                                    // faces +x, into the room
  put(cab, -hw + 0.06, 1.5, -0.6);

  // ── the east wall: shelved stereo, and the sign that pays for the shop ──
  //
  // Found by looking, the same way builder F found the diner's bare wall. The
  // counter runs along the back and the case sits in the middle of the floor,
  // which left this whole wall — the one on your right as you come in — as
  // plaster. A pawn shop is defined by having something on every surface; an
  // empty wall in one reads as a room that was not finished.
  //
  // Shelved stereo separates, because the brief asks for stereo stacks and the
  // TV stack behind the counter is the only place they were. These are on the
  // CUSTOMER side, which is right: the big electronics are what a shop like
  // this puts where you can see the model numbers, and they are too heavy to
  // walk off with.
  const shelfT = declareSurface(pixTex(72, 48, (g) => {
    g.fillStyle = '#3a3630'; g.fillRect(0, 0, 72, 48);
    g.fillStyle = '#4a453c'; g.fillRect(1, 1, 70, 46);
    // four shelves of separates — amps, decks, tuners, a pair of speakers
    for (let r = 0; r < 4; r++) {
      const y = 3 + r * 11;
      g.fillStyle = '#2a2620'; g.fillRect(2, y + 9, 68, 2);            // the shelf edge
      const kit: [number, number, string][] = r === 3
        ? [[4, 26, '#2e2a26'], [42, 26, '#2e2a26']]                     // speakers, bottom
        : [[4, 20, '#3a3a40'], [26, 18, '#33333a'], [46, 22, '#3a3a40']];
      for (const [x, w, col] of kit) {
        g.fillStyle = col; g.fillRect(x, y, w, 9);
        g.fillStyle = '#8a8478'; g.fillRect(x + 1, y + 1, w - 2, 1);    // the fascia line
        g.fillStyle = '#c9a45e'; g.fillRect(x + 2, y + 5, 3, 2);        // a dial
        g.fillStyle = '#6a8a6a'; g.fillRect(x + w - 6, y + 4, 4, 2);    // a lit meter
        tag(g, x + Math.round(w / 2) - 2, y + 9);
      }
    }
    dither(g, 72, 48, 44);
  }), 'detail');
  const SH_W = 3.6, SH_H = 2.0, SH_X = hw - 0.22;
  const carcM = new THREE.MeshBasicMaterial({ color: 0x3a3630 });
  // Index 1 is the -x face, which is the one looking into the room. Index 0 is
  // +x and points into the wall — the same slip that hid the marquee's copy
  // against the brick outside. On a box, work out which face the player is on
  // before choosing the slot.
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.42, SH_H, SH_W),
    [carcM, ctx.flat(shelfT), carcM, carcM, carcM, carcM]);
  shelf.position.set(0, 0, 0);
  put(shelf, SH_X, SH_H / 2, -0.4);
  solid(SH_X, -0.4, 0.42, SH_W);

  // WE BUY GOLD, over it. The one sign a pawn shop always has, and the only
  // thing in this room that is addressed to the street rather than to you.
  const goldT = declareSurface(pixTex(64, 18, (g) => {
    g.fillStyle = '#2a2018'; g.fillRect(0, 0, 64, 18);
    g.fillStyle = '#8a6a2c'; g.fillRect(0, 0, 64, 1); g.fillRect(0, 17, 64, 1);
    g.fillStyle = '#e8c25a'; g.font = 'bold 9px monospace';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('WE BUY GOLD', 32, 9);
  }), 'sign');
  const goldSign = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.54), ctx.flat(goldT));
  goldSign.rotation.y = -Math.PI / 2;                 // faces -x, into the room
  put(goldSign, hw - 0.06, 2.32, -0.4);

  // and two horns hung high where nothing can reach them
  const hornT = declareSurface(pixTex(40, 24, (g) => {
    g.clearRect(0, 0, 40, 24);
    g.fillStyle = '#b08a3a';
    g.fillRect(3, 4, 22, 3); g.fillRect(23, 2, 5, 7);
    g.fillStyle = '#c9a45e'; for (const x of [7, 12, 17]) g.fillRect(x, 7, 3, 3);
    tag(g, 9, 11);
    g.fillStyle = '#a8823a';
    g.fillRect(3, 16, 24, 3); g.fillRect(26, 14, 5, 7);
    tag(g, 12, 19);
  }), 'detail');
  const horns = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.9),
    new THREE.MeshBasicMaterial({ map: hornT, alphaTest: 0.5 }));
  horns.rotation.y = -Math.PI / 2;
  put(horns, hw - 0.06, 2.3, 2.1);

  // ── bars on the INSIDE of the window as well as the outside ──
  //
  // The brief asks for them and they are the detail that decides how the room
  // feels: the daylight is already cut into strips before it gets to you. One
  // plane with an alphaTest cutout rather than thirty boxes.
  const barT = declareSurface(pixTex(48, 16, (g) => {
    g.clearRect(0, 0, 48, 16);
    g.fillStyle = '#2e2a26';
    for (let x = 1; x < 48; x += 4) g.fillRect(x, 0, 1, 16);
    g.fillRect(0, 1, 48, 1); g.fillRect(0, 14, 48, 1);
  }), 'detail');
  barT.wrapS = THREE.RepeatWrapping;
  barT.repeat.set(5, 1);
  const bars = new THREE.Mesh(new THREE.PlaneGeometry(3.7, 1.55),
    new THREE.MeshBasicMaterial({ map: barT, alphaTest: 0.5, side: THREE.DoubleSide }));
  put(bars, 2.6, 1.72, hd - 0.14);

  // ── the sign that says the quiet part ──
  const noticeT = declareSurface(pixTex(48, 18, (g) => {
    g.fillStyle = '#ded4b8'; g.fillRect(0, 0, 48, 18);
    g.fillStyle = '#3a2c22'; g.fillRect(0, 0, 48, 1); g.fillRect(0, 17, 48, 1);
    g.fillStyle = '#8a2c22'; g.font = 'bold 7px monospace';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('NO CHECKS', 24, 6);
    g.fillStyle = '#3a2c22'; g.font = '5px monospace';
    g.fillText('30 DAYS TO REDEEM', 24, 13);
  }), 'sign');
  put(new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.34), ctx.flat(noticeT)), 2.0, 2.42, -hd + 0.07);

  // two caged bulbs over the counter, hung clear of the ceiling so they light
  // the room rather than painting the plaster above it
  const glowT = declareSurface(pixTex(32, 32, (g) => {
    const gr = g.createRadialGradient(16, 16, 1, 16, 16, 15);
    gr.addColorStop(0, 'rgba(244,214,150,0.40)');
    gr.addColorStop(1, 'rgba(244,214,150,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
  }), 'detail');
  const glowM = new THREE.MeshBasicMaterial({
    map: glowT, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  for (const lx of [-2.6, 2.6]) {
    put(new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 0.12, 8), steelM), lx, room.H - 0.16, CTR_ZC + 0.6);
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 2.8), glowM);
    gl.rotation.x = Math.PI / 2;
    put(gl, lx, room.H - 0.42, CTR_ZC + 0.6);
  }
  // ── STOCK ON THE CUSTOMER SIDE ─────────────────────────────────────────
  //
  // F measured this room at 0.47 objects per square metre, the thinnest of the
  // ten, and the user's own words are "leaves a lot to be desired". His rule
  // decides the SHAPE of the answer, not just the amount: "MORE THINGS IS NOT
  // THE ANSWER ON ITS OWN ... a few considered things arranged and aligned, not
  // clutter. Density is a diagnosis, not a target."
  //
  // MEASURED WHERE THE EMPTINESS ACTUALLY IS before adding anything, because my
  // repeated failure on this project is building something over the top of
  // fittings that were already there. The counter runs the full width at
  // z -2.90, so the customer floor is 13.8 x 6.5 m; the WEST wall carries only
  // the locked cabinet, at z -1.8..0.6, leaving 3.4 m of bare plaster in front of
  // it and 2.2 m behind; the EAST wall is covered from z -2.2 to 2.85 by the
  // shelved stereo and the signs. So everything below goes on the bare west run
  // and in the front-east corner, and nothing lands on top of anything.
  //
  // Three groups, and two of them are hung or leaned against a wall, which costs
  // the aisle nothing — the thing that made this room feel thin is bare surfaces,
  // not a shortage of floor furniture.
  {
    const WALLX = -hw + 0.09;                    // the west wall's inner face
    const bx2 = (w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number) =>
      put(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m), x, y, z);

    // 1. A CLOCK WALL. The one display a pawn shop is defined by, and it is
    // aligned by construction: one line, one pitch, six different clocks,
    // because they came in one at a time and none of them matches.
    const clockFace = (rim: string, face: string, roman: boolean, hA: number, mA: number) =>
      declareSurface(pixTex(24, 24, (g) => {
        g.clearRect(0, 0, 24, 24);
        g.fillStyle = rim; g.beginPath(); g.arc(12, 12, 11, 0, Math.PI * 2); g.fill();
        g.fillStyle = face; g.beginPath(); g.arc(12, 12, 9, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#3a3630';
        // the marks: bars at the quarters, plus the in-betweens on the roman ones
        for (const [mx, my] of [[11, 3], [11, 19], [3, 11], [19, 11]] as [number, number][]) {
          g.fillRect(mx, my, 2, 2);
        }
        if (roman) for (const [mx, my] of [[6, 5], [16, 5], [6, 17], [16, 17]] as [number, number][]) {
          g.fillRect(mx, my, 1, 1);
        }
        // hands, each clock stopped at its OWN time — a wall of pawned clocks is
        // never in agreement, and that is the whole character of it. The angles
        // come in per clock: the first pass wrote that sentence in the comment and
        // then drew the same two hands on all six, which is a note describing
        // something the code did not do. Drawn as rect runs from the centre so
        // they stay on the texel grid at any angle.
        const hand = (ang: number, len: number, w: number) => {
          for (let r = 0; r <= len; r++) {
            g.fillRect(Math.round(12 + Math.sin(ang) * r) - (w >> 1),
              Math.round(12 - Math.cos(ang) * r) - (w >> 1), w, w);
          }
        };
        hand(hA, 5, 2);
        hand(mA, 8, 1);
        g.fillStyle = '#8a7c50'; g.fillRect(11, 11, 2, 2);
        tag(g, 8, 21);
      }), 'detail');
    // rim, face, roman marks, and the hour and minute each one stopped at
    const T = Math.PI / 6;                       // one hour on a dial
    const CLOCKS: [string, string, boolean, number, number][] = [
      ['#5a4a32', '#e8e2cc', true, 2.4 * T, 9.0 * T],
      ['#8a8478', '#dfe4d8', false, 7.1 * T, 2.0 * T],
      ['#3a3630', '#e6e0cc', false, 11.6 * T, 5.5 * T],
      ['#8a7c50', '#e8e4d2', true, 4.8 * T, 11.0 * T],
      ['#6a5a3a', '#dfd8c0', false, 9.3 * T, 3.5 * T],
      ['#4a4640', '#e8e2cc', true, 1.2 * T, 7.0 * T],
    ];
    CLOCKS.forEach(([rim, face, roman, hA, mA], i) => {
      const cl = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34),
        new THREE.MeshBasicMaterial({ map: clockFace(rim, face, roman, hA, mA), alphaTest: 0.5 }));
      cl.rotation.y = Math.PI / 2;                                // faces +x, into the room
      put(cl, WALLX + 0.03, 1.98, 1.15 + i * 0.5);
    });

    // 2. TWO BICYCLES, leaned against the bare west run. A bike is all
    // silhouette — wheels, a frame triangle, bars and a saddle — so it is a
    // sprite with alphaTest for the same reason the dead palm and the plant are:
    // a box cannot do it, and "i cant tell what any of it is" is the standard.
    const bikeT = (frame: string) => declareSurface(pixTex(56, 36, (g) => {
      g.clearRect(0, 0, 56, 36);
      const wheel = (cx3: number) => {
        g.fillStyle = '#2a2724';
        for (let a = 0; a < 40; a++) {                            // the tyre, as a ring
          const t = (a / 40) * Math.PI * 2;
          g.fillRect(Math.round(cx3 + Math.cos(t) * 10) , Math.round(24 + Math.sin(t) * 10), 2, 2);
        }
        g.fillStyle = '#8a8478';                                  // four spokes and a hub
        for (const t of [0.4, 1.9, 3.5, 5.0]) {
          for (let r = 2; r < 9; r++) {
            g.fillRect(Math.round(cx3 + Math.cos(t) * r), Math.round(24 + Math.sin(t) * r), 1, 1);
          }
        }
        g.fillRect(cx3 - 1, 23, 3, 3);
      };
      wheel(12); wheel(44);
      g.fillStyle = frame;                                        // the double triangle
      const bar = (x0: number, y0: number, x1: number, y1: number) => {
        const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
        for (let i = 0; i <= n; i++) {
          g.fillRect(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), 2, 2);
        }
      };
      bar(12, 24, 26, 10); bar(26, 10, 38, 10); bar(38, 10, 44, 24);
      bar(26, 10, 30, 24); bar(30, 24, 44, 24); bar(12, 24, 30, 24);
      g.fillStyle = '#3a3630';
      g.fillRect(24, 6, 6, 3);                                    // the saddle
      bar(38, 10, 38, 4); g.fillRect(33, 3, 11, 2);               // stem and bars
      g.fillStyle = '#8a8478'; g.fillRect(28, 22, 5, 2);          // the chainset
      tag(g, 20, 16);
    }), 'detail');
    [['#6a2a2a', 1.4], ['#2a4a5a', 3.05]].forEach(([col, lz], i) => {
      const bike = new THREE.Mesh(new THREE.PlaneGeometry(1.58, 1.02),
        new THREE.MeshBasicMaterial({ map: bikeT(col as string), alphaTest: 0.5,
          side: THREE.DoubleSide }));
      bike.rotation.y = Math.PI / 2;                              // along the wall, facing in
      bike.rotation.x = i ? 0.05 : -0.04;                         // leaned, and not equally
      put(bike, WALLX + 0.30, 0.51, lz as number);
      // the collider REACHES THE WALL, so there is no slot behind a leaned bike.
      // The tax office taught me this one 20 minutes ago: a collider sized to the
      // object leaves a gap you can stand in (GOTCHAS 9).
      solid(WALLX + 0.28, lz as number, 0.56, 1.62);
    });

    // 2b. THE BARE BAND ABOVE 2.3 m, which is the last thing that reads as
    // unfinished in here. Two wall pieces, both above head height, so they cost
    // the aisle nothing: the sign that names the business, and a pegboard on the
    // way to the counter.
    {
      // a lit LOANS box, high on the west run — the one sign a pawn shop has
      // that is not about what it sells
      const loanT = declareSurface(pixTex(40, 16, (g) => {
        g.fillStyle = '#241f22'; g.fillRect(0, 0, 40, 16);
        g.fillStyle = '#e8c25a'; g.fillRect(1, 1, 38, 14);
        g.fillStyle = '#241f22';
        // LOANS in a 3x5 block font, drawn as rects so the letters cannot pick up
        // the grey fringe canvas text antialiasing gives them
        const F: Record<string, string[]> = {
          L: ['100', '100', '100', '100', '111'], O: ['111', '101', '101', '101', '111'],
          A: ['111', '101', '111', '101', '101'], N: ['101', '111', '111', '111', '101'],
          S: ['111', '100', '111', '001', '111'],
        };
        let cx3 = 5;
        for (const ch of 'LOANS') {
          const rows = F[ch];
          for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) {
            if (rows[r][c] === '1') g.fillRect(cx3 + c * 2, 3 + r * 2, 2, 2);
          }
          cx3 += 7;
        }
      }), 'sign');
      // THE BOX GOES BEHIND THE SIGN. First pass put the sign at WALLX + 0.05 and
      // its 0.07 m backing box at WALLX + 0.02, so the box's front face landed at
      // +0.055 — 5 mm PROUD of the sign — and the whole thing read as a plain
      // dark rectangle with no lettering. That is the fault I keep making in this
      // project: building an enclosure over a fitting I have just placed, which
      // has now cost the confessional, the font, the votive stand and a library
      // stair foot. Caught by looking at it, one shot after adding it.
      bx2(0.07, 0.45, 1.0, new THREE.MeshBasicMaterial({ color: 0x3a3630 }), WALLX + 0.03, 2.48, 2.2);
      const loan = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 0.37), ctx.flat(loanT));
      loan.rotation.y = Math.PI / 2;
      put(loan, WALLX + 0.10, 2.48, 2.2);          // 3.5 cm clear of the box front

      // a pegboard of power tools on the customer side of the west run, between
      // the cabinet and the counter, where you pass it walking up
      const pegT = declareSurface(pixTex(48, 36, (g) => {
        g.fillStyle = '#9a8a6a'; g.fillRect(0, 0, 48, 36);
        g.fillStyle = 'rgba(0,0,0,0.22)';
        for (let y = 3; y < 34; y += 3) for (let x = 3; x < 46; x += 3) g.fillRect(x, y, 1, 1);
        // a drill, a sander, a circular saw and a jigsaw, hung on one line each
        const tool = (x: number, y: number, w: number, h: number, body: string, det: string) => {
          g.fillStyle = 'rgba(0,0,0,0.30)'; g.fillRect(x + 1, y + 1, w, h);
          g.fillStyle = body; g.fillRect(x, y, w, h);
          g.fillStyle = det; g.fillRect(x, y + h - 2, w, 2);
          tag(g, x + 1, y + h);
        };
        tool(4, 5, 11, 6, '#8a5a2a', '#3a3630');       // drill body
        g.fillStyle = '#8a8478'; g.fillRect(15, 7, 5, 2);
        tool(23, 4, 9, 8, '#3a5a6a', '#2e2a26');       // sander
        tool(36, 5, 8, 7, '#7a3a2a', '#2e2a26');       // jigsaw
        tool(5, 20, 13, 9, '#6a6258', '#3a3630');      // circular saw
        g.fillStyle = '#8a8478'; g.beginPath(); g.arc(18, 26, 5, -1.2, 1.2); g.fill();
        tool(28, 21, 10, 7, '#8a7c50', '#3a3630');     // a planer
        dither(g, 48, 36, 22);
      }), 'detail');
      const peg = new THREE.Mesh(new THREE.PlaneGeometry(1.30, 0.98), ctx.flat(pegT));
      peg.rotation.y = Math.PI / 2;
      put(peg, WALLX + 0.04, 1.62, -2.15);
    }

    // 3. THE FRONT-EAST CORNER: an amp stack and a golf bag. Two things nobody
    // came back for, squared into the corner rather than set out in the room.
    {
      const AX = hw - 0.55, AZ = hd - 0.72;
      const vinylBlack = new THREE.MeshBasicMaterial({ color: 0x22201e });
      const grille = declareSurface(pixTex(28, 20, (g) => {
        g.fillStyle = '#1e1c1a'; g.fillRect(0, 0, 28, 20);
        g.fillStyle = '#2e2a26';
        for (let y = 1; y < 20; y += 2) for (let x = 1; x < 28; x += 2) g.fillRect(x, y, 1, 1);
        g.fillStyle = '#8a7c50'; g.fillRect(2, 1, 9, 2);          // the maker's badge
        dither(g, 28, 20, 14);
      }), 'detail');
      const grilleM = ctx.flat(grille);
      // the cab, then the head on top of it — which is what makes it read as an
      // amp and not a crate
      put(new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.58, 0.42),
        [vinylBlack, vinylBlack, vinylBlack, vinylBlack, grilleM, vinylBlack]), AX, 0.29, AZ);
      put(new THREE.Mesh(new THREE.BoxGeometry(0.60, 0.22, 0.40),
        [vinylBlack, vinylBlack, vinylBlack, vinylBlack, grilleM, vinylBlack]), AX, 0.69, AZ);
      bx2(0.44, 0.05, 0.03, new THREE.MeshBasicMaterial({ color: 0xc9bfa0 }), AX, 0.74, AZ - 0.21);
      for (const kx of [-0.14, -0.05, 0.04, 0.13]) {              // its knobs
        put(new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.03, 6), steelM),
          AX + kx, 0.74, AZ - 0.215).rotation.x = Math.PI / 2;
      }
      // the golf bag, leaned into the corner, with the clubs showing
      const bagM = new THREE.MeshBasicMaterial({ color: 0x3d5a4a });
      const bag = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.13, 0.94, 8), bagM);
      bag.rotation.x = 0.13;
      put(bag, AX - 0.06, 0.48, AZ - 1.02);
      for (const [gx2, gh] of [[-0.05, 0.30], [0.02, 0.36], [0.07, 0.26]] as [number, number][]) {
        put(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, gh, 6), steelM),
          AX - 0.06 + gx2, 1.05 + gh / 2, AZ - 1.10);
        bx2(0.05, 0.06, 0.04, new THREE.MeshBasicMaterial({ color: 0x8a8478 }),
          AX - 0.06 + gx2, 1.05 + gh + 0.02, AZ - 1.10);
      }
      bx2(0.30, 0.04, 0.05, new THREE.MeshBasicMaterial({ color: 0x2e2a26 }),
        AX - 0.06, 0.72, AZ - 0.96);                              // the bag's strap
      // one collider for the corner, reaching BOTH walls
      const x0c = AX - 0.36, z0c = AZ - 1.30;
      solid((x0c + (hw - 0.09)) / 2, (z0c + (hd - 0.09)) / 2,
        (hw - 0.09) - x0c, (hd - 0.09) - z0c);
    }
  }
}
