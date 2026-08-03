import * as THREE from 'three';
import type { CtxBuild } from './ctx';
import type { DoorDecl } from './doors';
import { pixTex, dither, declareSurface, slabTex } from './paint';
import { buildRoom, seatTaken } from './interior';
import { leafPair } from './vice';

// ST BRIGID'S — the inside, because the user asked to go in and could not.
//
// *"church i still cant walk into i cant walk up the stairs or go in, same as
// library."* The stairs were the first half and they climb now. The second half
// — GO IN — was never delivered: the flight got a locked-door response while
// the desk's own note said the choice was *"a prompt that opens a real room, or
// a locked-door response"* and nobody ever ruled. The user re-reported it. A
// locked door is a fine answer to a building nobody asked to enter, and the
// wrong answer to one they have now asked about twice.
//
// The brief for the outside was *"catholic, beautiful"*, and the inside has to
// pay that off in the one currency an interior has, which is not detail — it is
// PROPORTION. Every other room in this world is a box you are in; a church is
// a volume you are under. So:
//
//   height    6.4 m, against 2.75 for the thrift and 2.5 for the casino. It is
//             the tallest interior in the game by a factor of two, and that
//             single number does more than any amount of furniture.
//   length    16 m of nave, so the altar is far enough away to walk toward.
//   width     kept NARROW at 8.5. A wide room reads as a hall; a tall narrow
//             one reads as a nave, and the ratio is the whole effect.
//
// Everything else in here is subtraction. A church at 3 p.m. on a weekday is
// empty, dim and quiet, and the temptation is to fill it — but the thrift store
// two doors down is the room that earns its density, and this one earns the
// opposite. Pews, a floor, a window, an altar, and a great deal of air.
/**
 * THE DOOR, as one fact: a world point and an outward normal — the general
 * form `ct/doors.ts` takes, and the same fix `ct/int-jail.ts`'s `JAIL_DOOR` /
 * `standOf` already applies one file over. Measured off the flight the player
 * actually climbs — the landing tops out at x 9.1…9.6 over z −81.7…−77.2, so
 * the doors are at the far edge of that, facing back down the steps toward
 * the street.
 *
 * Before this, -79.5 was typed three times below (`cz`, `face.z`, and the
 * room's own `door.z`/`outZ`) and 9.6 was typed once here and twice more,
 * 0.75 m and 2.4 m out along the same normal, as the unrelated-looking
 * literals 8.85 and 7.2 — two authorings of one fact that happened to still
 * agree, the exact shape queue item 8 named. Nothing below retypes it.
 */
const CHURCH_FACE = { x: 9.6, z: -79.5, nx: -1, nz: 0 } as const;

/** where you stand to work the door, offset from the face along its own
 *  outward normal — same derivation as `ct/int-jail.ts`'s `standOf`, kept
 *  local rather than imported: a runtime edge back to a sibling `int-*.ts`
 *  is a real risk here (GOTCHAS §28 — see the note by `import('./hud')`
 *  elsewhere in this file's siblings), and the whole function is two lines. */
const standOff = (standoff: number) =>
  ({ x: CHURCH_FACE.x + CHURCH_FACE.nx * standoff, z: CHURCH_FACE.z + CHURCH_FACE.nz * standoff });

export const DOOR: DoorDecl = {
  building: 'ST BRIGID',
  // A CUT FACE, like the bodega's: the church sits back behind its own forecourt
  // rather than on the shopfront line, so its door is not on the building band
  // at all.
  w: 12, cz: CHURCH_FACE.z, side: 1, at: 0,
  face: CHURCH_FACE,
  /**
   * WHAT THE DOOR IS. The user, twice, and it is his most-repeated complaint in
   * a different building each time: outside is a **5.5 m pointed arch in three
   * recessed orders with two tall timber leaves and brass ring handles**;
   * inside was a **1.4 m brown domestic door with a grey pane** — a back door
   * on the front of a church.
   *
   * The 1.4 was the `width` that used to sit on this line, and it was never the
   * fault. `width` is deprecated in favour of this object precisely because it
   * says how WIDE and not what it IS; and neither of them was ever read,
   * because `buildRoom` could not find this declaration at all (see the
   * `building:` line in the spec below).
   *
   * **MEASURED OFF THE FACADE, NOT CHOSEN.** `ct/civic.ts:1179-1185` paints the
   * leaves inline, cut to the innermost order by `archHW` after two roundings,
   * so re-running that arithmetic by hand is exactly the retyping
   * BUILDER-BRIEF §8 is about. `scripts/probes/w57-church-leaf.mjs` reads the
   * block of leaf timber straight off the west front's own canvas and converts
   * with the density `masonry()` stamped on it: **2.750 m across both leaves,
   * 3.750 m tall**, sill 0.625 m, head 4.250 m. `glazing: 'none'` because there
   * is no glass in it — the detail is two straps and a ring, not a window.
   *
   * COPIED, AND SAYING SO: `0x4a3524` is `ct/civic.ts:1181`'s own leaf timber,
   * cited rather than matched by eye. **FOLLOW-UP FOR THE DESK:** that painter
   * should read `doorLeafFor('ST BRIGID')` instead of carrying its own
   * literals, the way `ct/int-jail.ts` and `ct/jail.ts` now share one texture.
   * That edits `ct/civic.ts`, which this item does not name.
   */
  leaf: {
    clearW: 2.75, h: 3.75, leaves: 2,
    frame: { colour: 0x4a3524, material: 'timber' }, glazing: 'none',
  },
};

export function buildChurch(ctx: CtxBuild) {
  // The sanctuary floor, 0.18 m up, at the ALTAR end. `RoomSpec.floor` arrived in
  // bd3ee7d7a and this is the second thing to use it after the library's stair.
  //
  // The step is RAMPED over 0.36 m rather than being a hard 0.18 lip, which is
  // ct/civic.ts's rule for its flights: answer the smooth gradient and let the
  // drawn nosing ride within half a riser of it, or the camera jolts as you
  // cross. On a single low step that matters more, not less — a hard 0.18 at
  // walking pace is a visible hop.
  const CHANCEL_Z = -4.60, CHANCEL_Y = 0.18;

  // ── ITEM 145: THE USER, IN THREE WORDS — *"church could be darker."* ──────
  //
  // THE WORLD IS UNLIT, so tone is the only tool there is. `light:` below builds
  // a fixture and a weak additive halo decal and NOTHING else — ct/interior.ts
  // :1425 says it outright: *"the room is lit by its flat materials"*. There is
  // no lamp to turn down. A room's brightness IS its palette.
  //
  // MEASURED BEFORE TOUCHING IT (`scripts/probes/w95-interior-tone.mjs`, 16
  // frames per room — 4 stations x 4 yaws — on the built bundle):
  //
  //     hotel 0.191 | casino 0.243 | pawn 0.407 | CHURCH 0.589
  //                 | library 0.624 | diner 0.645 | thrift 0.675 | bank 0.689
  //
  // The church sat between the pawn shop and the LIBRARY READING ROOM, 0.056
  // off the diner — a nave lit like a sandwich counter. The user is right.
  //
  // ⚠ THE FIRST VERSION OF THAT TABLE READ 0.552 AND WAS WRONG, because the
  // probe that produced it waited on a TIMEOUT instead of a painted frame. A
  // sibling probe on the identical warp wrote a SOLID WHITE nave, which is what
  // exposed it (GOTCHAS 78/80). An unpainted frame reads luminance ~1.0, so
  // every one that slipped through dragged a room's mean toward white — the
  // instrument was wrong in the direction that MATTERED, understating how bright
  // this room already was. Both probes now call `waitPainted` and throw on a
  // void frame rather than averaging it in. Every number in this comment is from
  // after that fix, five runs a side, with the PAWN SHOP carried through as an
  // untouched control: it read 0.4065-0.4068 in both states, so the church's
  // move is the change and not the weather.
  //
  // `dim(original, k)` RATHER THAN FOUR RETYPED HEX LITERALS. The colours this
  // room was authored with stay legible in the source, the amount they are
  // pulled down is one number per surface, and the desk can retune the room by
  // moving those numbers instead of re-deriving the palette. Retyping the
  // literals would have thrown away *why* they were those literals — the
  // comment under `palette` is about the values below, not about my arithmetic.
  //
  // INTEGER CHANNEL MATH, NOT `THREE.Color` MULTIPLICATION. `new THREE.Color()`
  // takes a hex through colour management into the linear working space, so
  // scaling there and calling `.getHex()` back is a round trip whose output is
  // not the plain 74% of the input it reads like. This is deliberately dumb and
  // does exactly what it says.
  //
  // ONE FACTOR ACROSS EVERY STONE SURFACE, AND I TRIED IT GRADED FIRST. The
  // item's caveat is *"do not let it go so dark the geometry stops reading"*,
  // and my first pass took that to mean protecting the 9.5 m ceiling — walls
  // 0.72, ceiling 0.80, floor 0.82, so the vault stayed pale. Pulling the walls
  // down HARDER than the ceiling and floor squeezed the three together: the
  // shell's luminance range closed from 106..184 to 87..147. That is the room
  // going flat as well as dark, arriving by the exact route the caveat warns
  // about.
  //
  // A UNIFORM FACTOR CANNOT DO THAT, because multiplying every surface by the
  // same k leaves every RATIO between them untouched — the ceiling stays the
  // brightest thing in the room, the floor the darkest, in the order the
  // `palette` note intends.
  //
  // BUT IT DOES NOT KEEP `sd/lum` FIXED, AND I BRIEFLY WROTE HERE THAT IT
  // WOULD. Measured, it falls 0.203 -> 0.177. The claim was wrong for a reason
  // worth keeping: these are FLAT UNLIT materials, so a surface's contribution
  // to contrast is proportional to its brightness, and scaling the stone by k
  // scales the differences BETWEEN stone surfaces by k too — while the mean is
  // held up by everything deliberately NOT dimmed (glass, flames, gold, timber).
  // Absolute contrast therefore has to fall when an unlit room is darkened; that
  // is arithmetic, not a defect, and no choice of factors avoids it.
  //
  // SO `sd` IS NOT THE LEGIBILITY TEST — SURFACE SEPARATION IS. What "reading"
  // depends on is whether adjacent planes are still tellable apart, and those
  // gaps stay large (0-255 luminance):
  //
  //                     before   after
  //       wall - floor    55.9    42.1
  //       wall - trim     31.4    23.7
  //       ceil - wall     21.8    16.8
  //
  // The smallest is still ~17 levels on flat colour, which is an obvious step.
  // Confirmed by LOOKING, which is the only thing that can actually answer it:
  // `shots/church-before-nave.png` against `shots/church-stone076-nave.png`,
  // and the `-up` pair for the height.
  // IT IS NOT ENOUGH TO DIM THE PALETTE, AND THE FIRST FRAME I LOOKED AT SAID
  // SO. `palette.floor` is only the slab under the flagstones — the nave floor
  // the player actually sees is `flagT`, a texture built from its own hex
  // literals a hundred lines below, and the narthex, chancel, font and altar
  // carry another nine. Dimming the shell alone pulled the walls down to ~123
  // luminance while the flagstones stayed at ~106, and the wall/floor edge
  // — which was a 56-point step — nearly vanished. The room did get darker and
  // it also stopped reading, which is precisely the trade the item forbids.
  //
  // So the factor is applied to STONE, wherever the stone is declared, and
  // `dimS` is the same arithmetic for the `'#rrggbb'` strings the canvas
  // textures are painted with.
  //
  // WHAT IS DELIBERATELY *NOT* DIMMED: the stained glass, the candle flames,
  // the sanctuary lamp and the gold. Those are the light SOURCES — "a church is
  // lit by its windows" is this file's own line — and scaling them down with the
  // stone would darken the room by turning its lights off, which is not what
  // "darker" means and would flatten the contrast the windows provide. Holding
  // them fixed while the stone drops is what makes the glass read STRONGER
  // afterwards than before. The altar cloth is left bright for the same reason:
  // white linen catching window light is what draws the eye up a dim nave.
  const STONE_DIM = 0.76;
  const dim = (hex: number, k = STONE_DIM) =>
    (Math.round(((hex >> 16) & 255) * k) << 16)
    | (Math.round(((hex >> 8) & 255) * k) << 8)
    | Math.round((hex & 255) * k);
  const dimS = (s: string, k = STONE_DIM) =>
    '#' + dim(parseInt(s.slice(1), 16), k).toString(16).padStart(6, '0');

  const room = buildRoom(ctx, {
    id: 'church',
    // THE ONE LINE THAT MAKES THE DECLARATION ABOVE REACHABLE, and its absence
    // is the whole of item 147. `buildRoom` finds a room's `DoorDecl` by
    // building name, and it has exactly two ways to learn one: this field, or
    // the frontage the room sits on. **A room on a cut face publishes no
    // frontage** — the church stands behind its own forecourt, not on the
    // shopfront line — so with this missing there was nothing to look up,
    // `LEAF` came back `null`, and every reader in the kit took its `??`
    // branch: the generic 1.1 m timber leaf with a vision panel. `ST BRIGID`
    // had a perfectly good door declared four lines above and it was never
    // consulted, silently, for as long as this room has existed.
    //
    // `ct/interior.ts` now says so out loud when it happens (`[interior:<id>]
    // NO BUILDING NAME`), which two registered walks already fail on — so the
    // next room to lose its door cannot do it quietly.
    building: 'ST BRIGID',
    floor: (lx, lz) => {
      if (lz > CHANCEL_Z) return null;                       // the nave, flat
      if (lz > CHANCEL_Z - 0.36) return CHANCEL_Y * (CHANCEL_Z - lz) / 0.36;
      return CHANCEL_Y;                                      // the sanctuary
    },
    label: 'into ST BRIGID\'S',
    // 9.5, up from 6.4. "Much taller than anything else you can enter" was the
    // instruction and 6.4 did not deliver it — the library reading room is 6.4
    // too, so the church was merely joint-tallest. Nothing else in the world
    // comes within 3 m of this now, which is the only way the height reads as a
    // fact about the church rather than as a number in a file.
    // WIDER THAN THE BUILDING, on the user's own ruling: "by matching the
    // exterior i really mean in general positioning. no one is going to take a
    // ruler and measure the width of the inner and outer." So the rule was
    // always WHICH SIDE THE DOOR IS ON and roughly where things sit — the door
    // is centred on this facade and it is centred in here — not dimensional
    // equality. 8.5 x 16 was me enforcing a constraint nobody set.
    //
    // 13.0 x 20.0. The nave is wide enough for its pews to be pews and long
    // enough that the altar is a walk away, and the narthex sequence the user
    // likes — low compressed lobby, then the arch — is untouched by either.
    // 24 m deep, not 20. The user: "if the rear needs another two metres of
    // clear floor to hold the confessionals properly, take it rather than
    // deleting a fourth pew." Four metres, so the nave keeps its length AND the
    // back of the church gets the empty floor a church actually has behind the
    // last pew — which is also what the narthex sequence he likes is made of.
    w: 13.0, d: 24.0, h: 9.5,
    // Cold stone, not shop plaster. The floor is the flagstone the forecourt
    // uses so the threshold reads as continuous; the walls go pale and chalky
    // and the ceiling is nearly white, because height you cannot see the top of
    // is height you do not feel.
    // (The kit's `floor` demo line that used to sit here put the dais at
    // z 4.5..8 — the DOOR end. Measured before removing it: gy 0.18 at lz 7.5
    // and 6.0, gy 0 at the altar on -5.6. It landed after the altar had been
    // moved to the far end, so the step was under the entrance and the
    // sanctuary was flat. The real one is the `floor` function above.)
    palette: {
      floor: dim(0x6e6a62, STONE_DIM), wall: dim(0xa8a294, STONE_DIM),
      ceil: dim(0xbdb8ab, STONE_DIM), trim: dim(0x8a8274, STONE_DIM),
    },
    door: {
      // 0.75 m off the face — DERIVED, not the literal 8.85 this used to
      // carry beside -79.5 typed a third time. See `CHURCH_FACE`/`standOff`
      // above.
      ...standOff(0.75), r: 1.2,
      // OUT ONTO THE FLIGHT, clear of the way IN.
      //
      // This first read `outX: 8.6` — 0.25 m from the door spot, which has a
      // 1.2 m radius. So you stepped out of the church and were standing in the
      // trigger that puts you back in it: the prompt still said "[E] into ST
      // BRIGID'S" and pressing E again, which is the natural thing to do after
      // arriving somewhere, sucked you straight back inside. Verified as a
      // player, not inferred — walked out, read the prompt, pressed E, ended up
      // back in the nave.
      //
      // 2.4 m off the face (DERIVED — this was the unrelated-looking literal
      // 7.2) is 1.65 m from the door spot, so you land OUTSIDE it, on the
      // flight, facing down the steps toward the street. The way back in is
      // one step forward, which is what a door should cost.
      outX: standOff(2.4).x, outZ: standOff(2.4).z, outYaw: -Math.PI / 2,
      // `width` REMOVED, and that removal is load-bearing. `spec.door.width`
      // beats the declaration by design — six rooms predate `DoorLeaf` and an
      // unconverted one must be unchanged rather than broken — so leaving 1.4
      // here would have kept the domestic opening even with `building` set, and
      // the fix would have looked like it did nothing. The opening is
      // `DOOR.leaf.clearW` now, which is the facade's own measurement.
      at: 0,
    },
    // ONE light source, and it is not a fitting. A church is lit by its
    // windows; a strip of fluorescents would undo the room in a single frame.
    light: { kind: 'dome', tint: 0xd8d2c0, count: 2 },
  });

  const { put, solid, wx, wz } = room;
  // DERIVED, not typed. These were `8.5 / 2` and `16 / 2` — the room's size
  // written a second time — so changing the spec above moved the walls and left
  // every fitting behind. Same two-authorings fault the door declarations exist
  // to kill, in the room's own file.
  const hw = room.W / 2, hd = room.D / 2;

  // ── the door, which is the half a `DoorLeaf` cannot carry ───────────────
  //
  // Naming the building (above) fixes the OPENING — 2.75 m wide and 3.75 m
  // tall instead of 1.4 x 2.15 — and it fixes the leaf's colour and glazing,
  // because `ct/interior.ts` reads both off the declaration. It cannot fix the
  // leaf COUNT: the kit's own note (`ct/interior.ts:1327`) records that drawing
  // a second mesh there gave three other rooms two stacked doors, and points
  // any room that declares `leaves: 2` at this one-file recipe instead — hide
  // the kit's single leaf, hang the room's own pair. Bank, casino, hotel,
  // library, pawn and now jail all do exactly this.
  //
  // A CHURCH DOOR IS TWO LEAVES OR IT IS NOT A CHURCH DOOR. One 2.75 m slab
  // swinging on one hinge is a garage.
  const DW = DOOR.leaf!.clearW, DH = Math.min(DOOR.leaf!.h, room.H - 0.2);
  const dAt = room.doorAt;
  {
    // The 32x64 signature is the kit's leaf, and it is how five other rooms
    // find it — `ct/int-bank.ts:203-210` first. Hidden rather than removed, so
    // nothing downstream that counts meshes changes its mind about the room.
    const hits: THREE.Mesh[] = [];
    room.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || m.geometry?.type !== 'PlaneGeometry') return;
      const mat = (Array.isArray(m.material) ? m.material[0] : m.material) as THREE.MeshBasicMaterial;
      const img = mat?.map?.image as HTMLCanvasElement | undefined;
      if (img && img.width === 32 && img.height === 64) hits.push(m);
    });
    if (hits.length === 1) hits[0].visible = false;
    else console.warn(`[interior:church] expected 1 kit door leaf to hide, found ${hits.length}`
      + ' — the nave now has both the kit door and its own. ct/interior.ts changed shape.');
  }
  // THE LEAF, PAINTED FROM THE DECLARATION rather than from a second set of
  // colours. `frame.colour` is the timber `ct/civic.ts:1181` puts on the west
  // front; the straps and the ring are that painter's `#8a7a4a` and `#c9a45e`,
  // copied with the citation because they are drawn inline into a facade canvas
  // and there is nothing to import (BUILDER-BRIEF §8 — the follow-up to hoist a
  // `churchLeafTex()`, the way `ct/jail.ts` hoisted `jailLeafTex()`, is in the
  // handoff note).
  //
  // DENSITY, DECLARED AND DERIVED (§7b). One leaf is `DW/2 - gap` = 1.345 m
  // across and `DH - 0.06` = 3.69 m up. A 28 x 76 canvas over that is
  // 20.8 px/m across and 20.6 px/m up — square within 1%, and deliberately the
  // same order as the jail's shared leaf (20.0 / 20.9) so the two entrances in
  // this world that have real leaves are drawn at the same scale.
  const LEAF_PPM = 20.7;
  const LW_M = DW / 2 - 0.03, LH_M = DH - 0.06;
  const LT_W = Math.round(LW_M * LEAF_PPM), LT_H = Math.round(LH_M * LEAF_PPM);
  const churchLeafT = declareSurface(pixTex(LT_W, LT_H, (g) => {
    const m = (v: number) => Math.max(1, Math.round(v * LEAF_PPM));
    g.fillStyle = '#' + DOOR.leaf!.frame.colour.toString(16).padStart(6, '0');
    g.fillRect(0, 0, LT_W, LT_H);
    // vertical boards, which is what a church door is made of and what reads at
    // this distance. The shadow line is one texel and the pitch is derived, so
    // a wider leaf gets MORE boards rather than wider ones.
    const boards = Math.max(3, Math.round(LW_M / 0.22));
    g.fillStyle = 'rgba(0,0,0,0.30)';
    for (let i = 1; i < boards; i++) g.fillRect(Math.round(i * LT_W / boards), 0, 1, LT_H);
    // two iron straps across, at the heights the facade draws them: the painter
    // puts them at church-frame y 2.2 and 3.4 over a leaf running 0.625 -> 4.25,
    // so they sit 43% and 76% up the leaf.
    g.fillStyle = '#8a7a4a';
    for (const t of [0.43, 0.76]) g.fillRect(0, Math.round((1 - t) * LT_H), LT_W, m(0.05));
    g.fillStyle = 'rgba(0,0,0,0.35)';
    for (const t of [0.43, 0.76]) g.fillRect(0, Math.round((1 - t) * LT_H) + m(0.05), LT_W, 1);
    // the ring handle, on the FREE edge — `leafPair` mirrors the whole leaf, so
    // local +x is the free edge on both and one drawing serves both.
    g.fillStyle = '#c9a45e';
    const rx = LT_W - m(0.20), ry = Math.round(LT_H * (1 - 0.32));
    g.fillRect(rx - m(0.06), ry, m(0.12), m(0.03));
    g.fillRect(rx - m(0.06), ry + m(0.10), m(0.12), m(0.03));
    g.fillRect(rx - m(0.07), ry, m(0.02), m(0.13));
    g.fillRect(rx + m(0.05), ry, m(0.02), m(0.13));
    dither(g, LT_W, LT_H, Math.round(LW_M * LH_M * 30));
  }), 'detail');
  // SHUT, like the pair painted into the west front's innermost order
  // (`ct/civic.ts:1178-1181` draws one timber rectangle with a meeting-stile
  // shadow down the middle — a closed door, and a painted facade cannot show
  // any other state). The swing is `LEAF_AJAR` and is not this file's to pick.
  leafPair(put, new THREE.MeshBasicMaterial({ map: churchLeafT, side: THREE.DoubleSide }),
    dAt, DW, DH, hd - 0.12, 'church', 0.03);

  // ── the floor is flagstones, not boards ──
  const flagT = declareSurface(pixTex(64, 64, (g) => {
    g.fillStyle = dimS('#6e6a62'); g.fillRect(0, 0, 64, 64);
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        g.fillStyle = dimS(['#6a665e', '#726e66', '#67635b', '#757168'][(r * 4 + c) % 4]);
        g.fillRect(c * 16 + 1, r * 16 + 1, 14, 14);
      }
    }
    dither(g, 64, 64, 420);
  }), 'ground');
  flagT.wrapS = flagT.wrapT = THREE.RepeatWrapping;
  // off the ROOM, not off the numbers the room used to be — the flags stopped
  // 4.5 m short of the new walls and left bare floor round the edges
  flagT.repeat.set(room.W / 2, room.D / 2);       // GOTCHAS 5: repeat off real metres
  const flags = new THREE.Mesh(new THREE.PlaneGeometry(room.W, room.D), ctx.flat(flagT));
  flags.rotation.x = -Math.PI / 2;
  put(flags, 0, 0.012, 0);

  // ── the pews ──
  //
  // Two banks either side of a centre aisle you can actually process down. The
  // aisle is 1.6 m: wide enough that the room invites you up it, which is the
  // whole point of a nave, and the one place in this world where a WIDE gap is
  // correct rather than lazy.
  const woodM = new THREE.MeshBasicMaterial({ color: 0x5a4632 });
  // The confessionals' footprint, declared ONCE and read by the pew loop below
  // as well as by the booth itself — three separate clipping reports in this
  // corner say the two were being placed independently.
  const CONF_D = 2.70, CONF_Z = hd - 2.6 - 1.9;
  const AISLE = 1.6, PEW_W = (room.W - AISLE) / 2 - 0.55;
  const PEW_CX = AISLE / 2 + PEW_W / 2;
  // THE FIRST ROW STARTS OFF THE CHANCEL STEP, NOT OFF THE ALTAR TABLE.
  //
  // *"why are there pews where the alter is?"* This used to read `-hd + 3.2`,
  // sized against the ALTAR's own 0.75 m footprint (back edge -hd + 2.775,
  // so 0.425 m of "clearance") — math from before the chancel platform at
  // CHANCEL_Z existed. That platform is 7.4 m deep (`room.floor` above
  // returns CHANCEL_Y for every lz < CHANCEL_Z) and pews are placed with
  // `put()`, which does not consult `room.floor` — every other object on the
  // sanctuary (the dais, the rail, the tabernacle) manually adds CHANCEL_Y to
  // its y, and the pew loop below did not. So the true bug was worse than
  // "0.425 m to a small table": the first four pew rows stood AT z -8.8,
  // -7.75, -6.7 and -5.65, all inside -12..-4.6, i.e. their legs sat 0.18 m
  // *below* the sanctuary floor they were standing on — pews sunk into the
  // chancel step, not just close to the altar.
  //
  // PEW_FRONT_CLEAR is the gap between the chancel's own edge and the first
  // kneeler (which projects to pz - 0.66), sized like every other "stand and
  // use it" clearance in this file (REAR_CLEAR's 1.2 m). Fixing the start
  // point re-flows PEW_ROWS below, so this is the one number to change.
  const PEW_FRONT_CLEAR = 1.0;
  const PEW_Z0 = CHANCEL_Z + PEW_FRONT_CLEAR;
  // ENOUGH ROWS TO FILL THE NAVE. Nine was right for a 16 m church; at 20 m it
  // left almost six metres of bare floor between the narthex arch and the first
  // pew, because the rows are laid from the ALTAR end and all the new length
  // arrived at the other one. Derived so the nave stays full whatever the room
  // becomes: rows from PEW_Z0 up to 3.6 short of the narthex face.
  // THE REAR PEWS STOP CLEAR OF THE CONFESSIONALS, which is the user's own
  // remedy: "pews in the church clip into the confession booths, lets get rid of
  // some of the rear pews". Filling the nave to the rear wall is what caused the
  // collision — the row count was derived to fill, and it filled straight into
  // the furniture standing there.
  //
  // Derived from the confessional's own front face rather than a row count I
  // pick, so moving the booth moves the last pew with it. 1.2 m of clearance,
  // which is enough to stand and open a door.
  // MINUS, not plus. The pews march from the altar end toward the door, so the
  // limit is the confessional's NEAR face — CONF_Z - CONF_D/2 — less clearance.
  // I wrote `+` first and the footprint check caught it: it put the limit 3.9 m
  // BEHIND the booth and left three pew rows still inside it. Eleventh sign
  // error of the session and the first one a check found before the user did.
  const REAR_CLEAR = CONF_Z - CONF_D / 2 - 1.2;
  // A PEW'S SEAT HEIGHT IS ITS TOP FACE, AND IT IS DECLARED ONCE.
  //
  // This was the casino stool bug again, pointing the other way, and my own seated
  // checker found it. The seat board is a 0.08 box that sat at y 0.46, so it spans
  // 0.42..0.50 and its TOP FACE is 0.50 — while `ctx.seat()` registered **0.54**.
  // Four centimetres, and it means a PLAYER who sits in a pew FLOATS.
  //
  // The tell was that the praying figure was already right: it is placed at 0.50
  // with the comment "0.46 + the 0.08 seat board's half", and the checker reports
  // it ON the seat while the registered height disagreed with both. Three numbers
  // for one surface, two of them agreeing and the authority wrong.
  //
  // Declared as the TOP and derived downward, so the board's thickness can change
  // without the seat height silently moving — the same shape as STOOL_TOP in
  // ct/int-casino.ts, and for the same reason.
  const PEW_TOP = 0.50, PEW_T = 0.08;
  const PEW_ROWS = Math.max(6, Math.floor((REAR_CLEAR - PEW_Z0) / 1.05) + 1);
  for (let i = 0; i < PEW_ROWS; i++) {
    const pz = PEW_Z0 + i * 1.05;
    for (const side of [-1, 1]) {
      // THE SEAT TOP IS DECLARED ONCE AND THE BOARD DERIVES FROM IT. See PEW_TOP.
      const seat = new THREE.Mesh(new THREE.BoxGeometry(PEW_W, PEW_T, 0.42), woodM);
      put(seat, side * PEW_CX, PEW_TOP - PEW_T / 2, pz);
      const back = new THREE.Mesh(new THREE.BoxGeometry(PEW_W, 0.62, 0.07), woodM);
      // the back is on the DOOR side of the seat, so you sit facing -z, down the
      // nave toward the altar
      put(back, side * PEW_CX, 0.75, pz + 0.24);
      // A LIGHTER TOP RAIL, so eighteen pews are eighteen pews at nave length.
      //
      // Graded my own nave from the entrance and logged this: up close the
      // pews are correct - individual seats, backs, and 18 of them sittable -
      // but seen down the length of the room the identical brown backs merge
      // into two solid masses and the bank reads as a block, not as seating.
      // What separates them at distance is the highlight along each top edge,
      // which is where a pew is worn pale by hands and elbows. One rail per
      // pew, and the rhythm comes back.
      const rail = new THREE.Mesh(new THREE.BoxGeometry(PEW_W, 0.05, 0.10),
        new THREE.MeshBasicMaterial({ color: 0x8a6a44 }));
      put(rail, side * PEW_CX, 1.065, pz + 0.24);
      for (const end of [-PEW_W / 2 + 0.05, PEW_W / 2 - 0.05]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.46, 0.4), woodM);
        put(leg, side * PEW_CX + end, 0.23, pz);
      }
      // THE BACKREST IS SOLID, THE SEAT IS NOT.
      //
      // This was `solid(…, pz, PEW_W, 0.5)` — the whole pew — which put the
      // seat point INSIDE its own collider, so 14 of the 18 came back
      // "UNREACHABLE — no standable point within its 0.62 m trigger". The
      // user asked that every seat in the game be sittable and I shipped a
      // church of benches you cannot reach, which is the same fault as the
      // burger stool that took three attempts to find.
      //
      // A pew is not a wall. You step into the row and sit, so only the back
      // rail blocks — which is what stops you walking through the bank and is
      // the only part that should.
      solid(side * PEW_CX, pz + 0.24, PEW_W, 0.16);

      // THE KNEELER, in the brief's list and the thing that makes a bench a pew.
      // Hinged down in front of each row: a padded board on two brackets, low
      // enough to kneel at and clear of where your feet go when seated. No
      // collider — you step over it, and a 0.13 m rail that stops you walking
      // the row would be worse than not having one.
      put(new THREE.Mesh(new THREE.BoxGeometry(PEW_W, 0.07, 0.26),
        new THREE.MeshBasicMaterial({ color: 0x5a2a2e })), side * PEW_CX, 0.13, pz - 0.60);
      for (const end of [-PEW_W / 2 + 0.12, PEW_W / 2 - 0.12]) {
        put(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.13, 0.20), woodM),
          side * PEW_CX + end, 0.065, pz - 0.60);
      }
      // …and you can sit in it. The user asked that EVERY seat in the game be
      // sittable, and a church full of benches you cannot use would be the
      // largest exception in the world.
      //
      // AND IT DECLARES AN `approach`, WHICH IS NOT COSMETIC.
      //
      // A seat registered without one puts its SIT spot and its STAND spot on the
      // identical coordinate, and C measured what that costs across the world:
      // of 225 seats, 149 have a non-stand spot inside the 0.5 m stand radius and
      // **69 sit at exactly 0.00 m**, where the tiebreak between two spots at
      // distance 0 is undefined. That is the *"pressing e doesnt get me out of
      // it — stuck in the TV seat"* row.
      //
      // I re-measured it because that row names the casino stools as the 0.00 m
      // cluster and they are NOT: mine declare an approach and come out at
      // 0.41 m minimum. **The 69 are burger 28, church 28 and diner 13 — and the
      // church is mine.** All 36 of these pews were registered with no approach.
      //
      // THE APPROACH GOES IN THE ROW, NOT IN THE AISLE, and I tried it the other
      // way first and it was worse. An aisle approach at `side * (AISLE / 2 +
      // 0.45)` put all eighteen rows' sit spots in a single line 1.05 m apart —
      // the row pitch — each with r 0.62 and a 0.6 m reach margin on top, so they
      // overlapped heavily and E picked whichever won rather than the row you were
      // standing at. Measured: I approached row 3 and came to rest seated in
      // row 1. That trades an undefined tiebreak for a wrong-row teleport.
      //
      // So it is `pz - 0.42`: in the leg space between the kneeler at pz - 0.60
      // and the bench at pz, which is exactly where somebody stands before they
      // sit down, and which is standable because only the back rail carries a
      // collider. Adjacent rows are no closer than they already were.
      //
      // 0.42 m is deliberately INSIDE the 0.5 m band my own clash report flags,
      // and I am not going to move it to clear a threshold: a pew's standing space
      // is only ~0.55 m deep, so anywhere a person would really stand is inside
      // it. The property that matters is that the distance is NOT ZERO — a
      // tiebreak between two spots at distance 0 is undefined, and at 0.42 m it
      // is not a tiebreak at all.
      //
      // This does NOT replace the kit fix C routed to F — *"while `rig.seated`, E
      // stands, full stop, no selection"* — which is the real answer. It is
      // defence in depth at the room level, so this room is not relying on a
      // tiebreak that is undefined even after the kit changes.
      ctx.seat({
        x: wx(side * PEW_CX), z: wz(pz), yaw: 0, h: PEW_TOP, r: 0.62,
        approach: { x: wx(side * PEW_CX), z: wz(pz - 0.42) },
        label: 'sit in the pew',
        // *"if you sit in his pew you sit where he sits and that just breaks
        // immersion."* The praying woman four rows back is placed at exactly
        // this seat's coordinates, and this row registered it as free. She
        // claims it through `room.person`; see `seatTaken` in ct/interior.ts.
        // Every OTHER pew is unaffected — 35 of the 36 are still offered, and
        // the free half of her own row still is.
        ok: () => !seatTaken(wx(side * PEW_CX), wz(pz)),
      });
    }
  }

  // ── the altar end ──
  //
  // Raised one step, which is the only level change inside and the reason the
  // far end reads as somewhere rather than as the back wall — built below as
  // the nave-width platform from -hd to CHANCEL_Z, textured with its own
  // slabTex (see "Altar and chancel step" further down, item 0a's census).
  //
  // THIS USED TO BE WHERE A SECOND, DEAD RAISED BOX STOOD: a leftover
  // `dais` mesh from an earlier wrong-end chancel attempt, placed at
  // `hd - 2.2` — the DOOR end, 19.4 m from the altar below at `-hd + 2.4` —
  // stranded there when the altar-end convention got corrected (see the
  // altar's own placement comment just below) and never removed. Flagged by
  // w5 (`notes/w5-church-chancel.md`) rather than fixed there because it was
  // outside that item. Confirmed unreferenced beyond its own declaration and
  // deleted here: no `solid()` collider depended on it, no other mesh reads
  // `dais` or the `stoneTop` texture it alone used.
  const altar = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.95, 0.75),
    new THREE.MeshBasicMaterial({ color: dim(0xb0a894) }));
  // -hd + 2.4, NOT hd - 2.4. The kit cuts the door into the front wall at local
  // +hd and puts the way-out spot at hd - 0.55, so the FAR end of a room is
  // negative z. At hd - 2.4 this altar stood 2.4 m from the door: you walked in
  // and were on it, every pew faced away down the nave, and the 16 m of length
  // this room's own comment calls "the whole effect" was behind you. It also
  // blocked the entrance outright -- 0.51 m in and you were against the altar's
  // collider, which is what "the church is locked" turned into once the door
  // opened.
  put(altar, 0, 0.18 + 0.475, -hd + 2.4);
  solid(0, -hd + 2.4, 2.2, 0.75);
  const cloth = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.3, 0.8),
    new THREE.MeshBasicMaterial({ color: 0xd8d0bc }));
  put(cloth, 0, 0.18 + 0.82, -hd + 2.4);
  for (const dx of [-0.7, 0.7]) {
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.34, 6),
      new THREE.MeshBasicMaterial({ color: 0xb8a24e }));
    put(stick, dx, 0.18 + 0.95 + 0.17, -hd + 2.4);
  }

  // ── THE WEST END: a narthex, and an arch in three recessed orders ─────
  //
  // The user: "outside, this church has a POINTED ARCHED DOORWAY IN THREE
  // RECESSED ORDERS — that is what you should meet on the inside too: an arched
  // opening, a shallow narthex or porch inside the west end. A flat rectangular
  // hole in a plain wall is the opposite of what the facade promises."
  //
  // The narthex is a dropped stone ceiling over the first 2.6 m inside the door,
  // the same move the library's vestibule uses: the kit gives a room ONE height,
  // and a porch under the roof of the nave beyond is what a narthex physically
  // is. Coming through it you meet a low dark ceiling and then 9.5 m of air,
  // which is the contrast the facade is promising.
  {
    // NAR_Y 4.20, not 3.10, and the arch is why: its apex sits at SPRING 2.35 +
    // RISE 1.35 + the keystone = 3.80, so at 3.10 the narthex ceiling cut the
    // head off the arch it was supposed to frame. A pointed arch needs the
    // height to be pointed in. 4.20 still reads as low against 9.50 of nave —
    // which is the contrast the facade promises — and now the whole arch is
    // under it.
    const NAR_D = 2.60, NAR_Y = 4.20;
    const zc = hd - NAR_D / 2, zFace = hd - NAR_D;
    const stone = new THREE.MeshBasicMaterial({ color: dim(0x8a8478) });
    const stoneD = new THREE.MeshBasicMaterial({ color: dim(0x6e6a60) });
    const stoneL = new THREE.MeshBasicMaterial({ color: dim(0x9a9488) });

    put(new THREE.Mesh(new THREE.BoxGeometry(room.W, 0.26, NAR_D), stoneD), 0, NAR_Y + 0.13, zc);

    // THE ARCH, three orders, each stepped back and in. A pointed arch is two
    // struck curves meeting at a point; at 8 px/m the honest way to draw one is
    // a run of small boxes following that profile, which is also how the facade
    // outside is painted. Each order is 0.16 narrower and 0.18 further into the
    // room, so the reveal reads as depth rather than as a line.
    const ORDERS: [number, number, number][] = [
      [2.30, 0.00, 0], [2.14, 0.18, 1], [1.98, 0.36, 2],
    ];
    for (const [halfSpanX2, inset, oi] of ORDERS) {
      const hx2 = halfSpanX2 / 2, zAt = zFace + inset;
      const m = oi === 1 ? stone : oi === 2 ? stoneL : stoneD;
      const SPRING = 2.35;                          // where the curve starts
      // the jambs
      for (const sx of [-1, 1]) {
        put(new THREE.Mesh(new THREE.BoxGeometry(0.20, SPRING, 0.20), m),
          sx * (hx2 + 0.10), SPRING / 2, zAt);
      }
      // the two struck curves, meeting at a point above the springing
      const N = 9, RISE = 1.35;
      for (const sx of [-1, 1]) {
        for (let i = 0; i < N; i++) {
          const t = i / (N - 1);
          // a pointed profile: x falls to zero as y rises to the apex
          const x = sx * hx2 * (1 - t * t);
          const y = SPRING + RISE * Math.sqrt(t);
          put(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.20), m), x, y, zAt);
        }
      }
      // the keystone
      put(new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.34, 0.22), stoneL),
        0, SPRING + RISE + 0.10, zAt);
    }
    // the piers either side of the arch carry the narthex ceiling and stop you
    // walking round it
    //
    // COURSED, not a flat fill. Each pier is 2.9 x 4.2 m and you look straight
    // at both of them every time you turn back down the nave, so 12 m2 of one
    // solid colour reads as a blank slab — the same fault the user named in
    // the bodega ("a blank grey slab") and that a sweep for untextured boxes
    // found here. Stone that shows its courses is what stops it.
    const courseT = declareSurface(pixTex(48, 64, (g) => {
      g.fillStyle = '#8a8478'; g.fillRect(0, 0, 48, 64);
      const H = 8;                                   // a course is ~0.52 m
      for (let r = 0; r * H < 64; r++) {
        const y = r * H, off = (r % 2) * 8;          // alternate courses break joint
        for (let x = -off; x < 48; x += 16) {
          const k = (r * 7 + x) % 11;
          g.fillStyle = ['#8e887c', '#847e72', '#918b7f', '#888276'][k % 4];
          g.fillRect(x + 1, y + 1, 14, H - 2);       // the block
          g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(x + 1, y + 1, 14, 1);
        }
        g.fillStyle = '#6e6a60'; g.fillRect(0, y, 48, 1);   // the bed joint
      }
      dither(g, 48, 64, 60);
    }), 'detail');
    for (const sx of [-1, 1]) {
      const pw = (room.W - 2.7) / 2, px = sx * (2.7 / 2 + pw / 2);
      const ct = courseT.clone(); ct.needsUpdate = true;
      // GOTCHAS 5: repeat from real metres, so the courses are the same size
      // on both piers and match the 0.52 m course the texture draws.
      ct.wrapS = ct.wrapT = THREE.RepeatWrapping;
      ct.repeat.set(pw / 3.0, NAR_Y / 4.2);
      put(new THREE.Mesh(new THREE.BoxGeometry(pw, NAR_Y, 0.26),
        new THREE.MeshBasicMaterial({ map: ct })), px, NAR_Y / 2, zFace);
      solid(px, zFace, pw, 0.30);
    }
  }

  // ── the chancel, at the altar end where it belongs ───────────────────
  //
  // "Altar and chancel step." Built once before at the wrong end of the nave —
  // I had the kit's convention backwards, it landed across the ENTRANCE, and
  // walking in stopped dead after 0.49 m. It was also blocked then on a floor
  // function the kit did not have. Both are fixed: the ends are right and
  // bd3ee7d7a gave rooms levels, so this is the step you actually walk up.
  {
    // FLAGGED, not flat. Verifying A's row - "123 ground-facing surfaces
    // across the world are untextured flat colour" - I measured the world and
    // the single largest untextured ground surface in it was THIS: 96 m2 of
    // #9a9284 at (680, -8), the chancel platform. Mine.
    //
    // I had already seen these plinths in my own untextured-box sweep and
    // written them off as "floor plinths, seen from above and walked on. Not
    // slabs." That was right about whether they read as a WALL and wrong for
    // this row, which is precisely about the floor. A's point holds: a flat
    // colour has no joints to give it scale, and a chancel is flagstone.
    const stoneM = new THREE.MeshBasicMaterial({
      map: declareSurface(slabTex({
        wMeters: room.W, dMeters: CHANCEL_Z - (-hd), base: dimS('#9a9284'),
        joint: 0.9, grain: 0.12,
      }), 'detail'),
    });
    const stoneLM = new THREE.MeshBasicMaterial({ color: dim(0xa8a094) });
    const platD = CHANCEL_Z - (-hd);
    // the platform, and a lighter nosing so the step reads as a step rather
    // than as a shadow on the flags
    put(new THREE.Mesh(new THREE.BoxGeometry(room.W, CHANCEL_Y, platD), stoneM),
      0, CHANCEL_Y / 2, -hd + platD / 2);
    put(new THREE.Mesh(new THREE.BoxGeometry(room.W, 0.04, 0.12), stoneLM),
      0, CHANCEL_Y + 0.02, CHANCEL_Z);

    // The altar rail, turned balusters under a dark oak top — and OPEN in the
    // middle, with no collider across the opening. A rail you cannot pass is a
    // fence, and the brief asks for a step you climb, not a barrier you look
    // over. The two runs get colliders; the 1.7 m gap on the centreline does
    // not, so you walk up the aisle and onto the sanctuary.
    const railM = new THREE.MeshBasicMaterial({ color: 0x5a4028 });
    const balM = new THREE.MeshBasicMaterial({ color: dim(0xb0a894) });
    for (const sx of [-1, 1]) {
      const x0 = sx * 0.85, x1 = sx * (hw - 0.15), w2 = Math.abs(x1 - x0);
      put(new THREE.Mesh(new THREE.BoxGeometry(w2, 0.09, 0.16), railM),
        (x0 + x1) / 2, CHANCEL_Y + 0.92, CHANCEL_Z - 0.30);
      for (let bx = Math.min(x0, x1) + 0.18; bx < Math.max(x0, x1) - 0.10; bx += 0.26) {
        put(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.74, 6), balM),
          bx, CHANCEL_Y + 0.51, CHANCEL_Z - 0.30);
      }
      solid((x0 + x1) / 2, CHANCEL_Z - 0.30, w2, 0.22);
    }
  }

  // ── the note that used to be here ────────────────────────────────────
  //
  // "Altar and chancel step" is in the brief and I built one: a raised sanctuary
  // floor across the width with an altar rail. It went in on top of the
  // ENTRANCE, and walking in stopped dead — 0.49 m and you are against a rail.
  //
  // I had the room's ends backwards. Measured rather than assumed once it broke:
  // the way-out spot is at local z 7.45 and the altar's collider is at z 5.22 to
  // 5.97, so the door and the altar are at the SAME end of this nave, with the
  // pews running away from both. I had reasoned "altar at hd - 2.4, therefore the
  // door is at -hd" from the file's own prose about a 16 m nave, and the prose
  // and the geometry do not agree.
  //
  // That disagreement is E's room to settle, not mine to guess at on a room I
  // was handed an hour ago — moving an altar is a bigger decision than adding a
  // step. So the step is not here, the entrance is clear, and this is written
  // down where the next person will find it.
  //
  // It is also blocked twice over: a step you can walk UP needs the floor
  // function that ct/interior.ts:1000 hardcodes to `() => 0`, which is the same
  // missing spec field as the library's stair. See notes/BLOCKED-G.md.

  // one stone for the sanctuary furniture, so the tabernacle plinth and the font
  // read as the same quarry as the chancel step
  const stoneMx = new THREE.MeshBasicMaterial({ color: dim(0x9a9284) });

  // ── THE CRUCIFIX IS FURTHER DOWN, AND THERE IS ONLY ONE ──────────────
  //
  // I built a second, freestanding one here — a 3 m cross standing clear of the
  // east window so it would silhouette against the rose. There was already a
  // wall-mounted crucifix over the altar, so the sanctuary had TWO, superimposed
  // on the same axis at different depths and different heights.
  //
  // That is what the user was looking at when he said "the crucifix has come
  // apart... the figure is not on the cross": two crosses and two corpora at
  // four different z, read from the nave as one broken object. Not a parenting
  // bug — a duplicate. Mine is gone; the wall-mounted one below is correct and
  // its corpus is already proud of its own cross on the same axis.
  //
  // The lesson is the cheap one: before adding the centrepiece a room is
  // missing, grep the file for it. "wheres the jesus on the cross" was answered
  // twice because two people read the same complaint.

  // ── the tabernacle, and the lamp that says it is occupied ────────────
  //
  // The tabernacle is behind the altar on the same axis; the sanctuary lamp
  // hangs beside it and is ALWAYS LIT, which is what it means. It is also the
  // one warm point in a cold room, so it does more work than its size.
  {
    const TAB_Z = -hd + 0.55;
    const gold = new THREE.MeshBasicMaterial({ color: 0xb8912e });
    const goldD = new THREE.MeshBasicMaterial({ color: 0x7a6020 });
    put(new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.42, 0.36), stoneMx), 0, CHANCEL_Y + 0.21, TAB_Z);
    put(new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.58, 0.30), goldD), 0, CHANCEL_Y + 0.71, TAB_Z);
    put(new THREE.Mesh(new THREE.BoxGeometry(0.50, 0.46, 0.02), gold), 0, CHANCEL_Y + 0.71, TAB_Z + 0.16);
    put(new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.10, 0.03), gold), 0, CHANCEL_Y + 1.04, TAB_Z + 0.16);

    // the sanctuary lamp: red glass on a chain, and a glow that never goes out
    const LX = 1.45, LZ = -hd + 1.6, LY = CHANCEL_Y + 2.05;
    put(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.5, 4),
      new THREE.MeshBasicMaterial({ color: 0x6a5a3a })), LX, LY + 0.95, LZ);
    put(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.11, 0.26, 8),
      new THREE.MeshBasicMaterial({ color: 0x8e1f2a })), LX, LY, LZ);
    // THE FLAME IS INSIDE THE GLASS, and there is no halo sphere round it.
    //
    // This was an additive sphere of radius 0.34 wrapped around a 0.15 vessel —
    // at eight segments that reads as a flat pink disc facing you with a red cup
    // floating in the middle of it, which is exactly what the user described. A
    // low-poly additive sphere is a billboard whether you meant one or not.
    //
    // So: a small flame INSIDE the cup, sized under the vessel's own radius, and
    // the light it throws is a patch on the sanctuary floor below rather than a
    // ball in the air. A lamp is a thing with light in it, not a thing with a
    // glow around it.
    put(new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.10, 8),
      new THREE.MeshBasicMaterial({
        color: 0xffb070, transparent: true, opacity: 0.95, depthWrite: false,
        blending: THREE.AdditiveBlending, fog: false })), LX, LY + 0.02, LZ);
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5),
      new THREE.MeshBasicMaterial({
        color: 0xff6a4a, transparent: true, opacity: 0.10, depthWrite: false,
        blending: THREE.AdditiveBlending, fog: false }));
    pool.rotation.x = -Math.PI / 2;
    put(pool, LX, CHANCEL_Y + 0.02, LZ);
  }

  // ── the fourteen Stations of the Cross ───────────────────────────────
  //
  // Seven a side down the nave walls, small and dark and evenly spaced. They are
  // what stops a nave reading as a hall with benches in it: a wall with fourteen
  // identical marks on it is unmistakably a church even at a glance.
  {
    const relief = declareSurface(pixTex(16, 20, (g) => {
      g.fillStyle = '#6a6258'; g.fillRect(0, 0, 16, 20);
      g.fillStyle = '#8a8278'; g.fillRect(1, 1, 14, 18);
      g.fillStyle = '#4a443c'; g.fillRect(3, 3, 10, 14);
      g.fillStyle = '#9a9288'; g.fillRect(7, 5, 2, 9); g.fillRect(5, 7, 6, 2);  // a cross in each
      dither(g, 16, 20, 24);
    }), 'detail');
    const relM = ctx.flat(relief);
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 7; i++) {
        const sz = 4.6 - i * 1.55;
        const m = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.52), relM);
        m.rotation.y = sx > 0 ? -Math.PI / 2 : Math.PI / 2;
        put(m, sx * (hw - 0.06), 2.25, sz);
      }
    }
  }

  // ── the font, by the door, where you are received ────────────────────
  {
    // The user likes the stoup here — "right at the entrance, which is correct"
    // — so it stays by the door and gets CLEARANCE instead. It was clipping the
    // same narthex pier (bowl r 0.44 at z 5.80 against the pier at 5.40). Now in
    // the middle of the narthex with a metre of air round it.
    const FZ = hd - 1.25, FX = hw - 1.7;
    put(new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.30, 0.16, 8), stoneMx), FX, 1.02, FZ);
    put(new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.30, 0.86, 8), stoneMx), FX, 0.47, FZ);
    put(new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.06, 8), stoneMx), FX, 0.05, FZ);
    put(new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.02, 8),
      new THREE.MeshBasicMaterial({ color: 0x3a4a52 })), FX, 1.11, FZ);   // the water
    solid(FX, FZ, 0.9, 0.9);
  }

  // ── the side chapel, and the candles nobody is tending ────────────────
  //
  // A votive stand at the back of the north aisle: a rack of lit candles, most
  // of them burnt down, in front of a small painted statue on a bracket. It is
  // the one warm thing in the room, which is what makes the rest read as cold.
  {
    // Clear of the narthex pier, which stands at z = hd - NAR_D. The stand was
    // ON that line — the footprint check's last overlapping pair, and the fourth
    // thing I have found buried in a pier I added after it.
    const CX = -hw + 0.95, CZ = hd - 2.6 - 1.5;
    const ironM = new THREE.MeshBasicMaterial({ color: 0x3a3630 });
    const waxM = new THREE.MeshBasicMaterial({ color: 0xe8dfc4 });
    const flameM = new THREE.MeshBasicMaterial({
      color: 0xffd88a, transparent: true, opacity: 0.9, depthWrite: false,
      blending: THREE.AdditiveBlending, fog: false });
    // the stand
    put(new THREE.Mesh(new THREE.BoxGeometry(1.30, 0.06, 0.34), ironM), CX, 0.86, CZ);
    for (const dx of [-0.6, 0.6]) {
      put(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.86, 0.05), ironM), CX + dx, 0.43, CZ);
    }
    // the candles: five rows of unequal stubs, and only some alight
    let ci = 0;
    for (let gx = -0.55; gx <= 0.56; gx += 0.135) {
      for (const gz of [-0.09, 0.09]) {
        const burn = [0.16, 0.09, 0.21, 0.05, 0.13, 0.07][ci % 6];
        const lit = ci % 3 !== 1;                       // two in three still going
        put(new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, burn, 6), waxM),
          CX + gx, 0.89 + burn / 2, CZ + gz);
        if (lit) {
          put(new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 4), flameM),
            CX + gx, 0.89 + burn + 0.045, CZ + gz);
        }
        ci++;
      }
    }
    // ── the statue, ON the wall rather than beside it ──────────────────
    //
    // The user, with a screenshot: "what is this floating thing in the
    // church?" — and the sharper half of that is that he did not recognise
    // it as a statue at all.
    //
    // MEASURED BEFORE CHANGING, because both of the obvious causes were
    // wrong. The bracket was not missing, not undersized, and not drawn
    // behind the wall plane: it was there at x -5.72..-5.38, y 1.37..1.47,
    // in front of everything, with the figure's foot resting on its top to
    // within 0.000 m. It was attached to NOTHING. The west wall's inner face
    // is at x = -hw = -6.5 and the bracket's back edge stood 0.78 m clear of
    // it, hanging in mid-air over the rack — which is precisely the thing in
    // the frame. (The plaster it appears to sit against IS that west wall:
    // from the aisle you face it nearly head-on, while the narthex masonry
    // rakes away to the left. The eye pairs the two and nothing joins them.)
    //
    // So the shrine is built off the WALL PLANE now — every depth below is
    // measured out from `WALL` in +x, never from the rack's centre. Move the
    // room's width and the shrine stays on its wall.
    const WALL = -hw;
    const stoneM = new THREE.MeshBasicMaterial({ color: dim(0x8a8274) });
    // The corbel is three stages, and the two under the shelf are the point:
    // a lone slab is exactly what read as floating. Nothing in this world
    // casts a shadow, so an underside that visibly dies into the plaster is
    // the only thing that can say "carried" at 8 px/m.
    put(new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.07, 0.38), stoneM),
      WALL + 0.15, 1.425, CZ);                        // the shelf, back flush to the wall
    put(new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.12, 0.24), stoneM),
      WALL + 0.095, 1.330, CZ);                       // the wedge under it
    put(new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.11, 0.15), stoneM),
      WALL + 0.045, 1.215, CZ);                       // and its foot, into the wall
    // And the figure — PAINTED, which is what the note above this block has
    // always claimed and what the geometry never was. It was a tapered
    // cylinder and a ball in #c8c2b2 / #d8d2c4, against #a8a294 plaster:
    // three tones inside one narrow band of warm grey. Unlit, at 8 px/m,
    // that is a chess pawn, and he read it as one. Silhouette and palette
    // are the whole toolkit here, so it gets a cream robe under a blue
    // mantle, a face, joined hands and a halo — a cheap parish plaster
    // saint, not a good one. Nothing here is pretty; it is only legible.
    const mantleM = new THREE.MeshBasicMaterial({ color: 0x3f5580 });
    const robeM = new THREE.MeshBasicMaterial({ color: 0xd9d2bf });
    const skinM = new THREE.MeshBasicMaterial({ color: 0xc9a184 });
    const goldM = new THREE.MeshBasicMaterial({ color: 0xbf9a3a });
    const FX = WALL + 0.17;            // the figure's axis, standing on the shelf
    const FOOT = 1.46;                 // = the shelf's top (1.425 + 0.07/2)
    put(new THREE.Mesh(new THREE.CylinderGeometry(0.122, 0.135, 0.16, 8), robeM),
      FX, FOOT + 0.08, CZ);                           // the robe's hem
    put(new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.122, 0.34, 8), mantleM),
      FX, FOOT + 0.33, CZ);                           // the mantle over it
    // hands joined at the breast: the one gesture that survives this scale
    put(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.075, 0.11), skinM),
      FX + 0.108, FOOT + 0.38, CZ);
    // The halo sits BEHIND the head, its disc flat to the room — rotated on
    // the GEOMETRY, not the mesh, because `put` owns the object's transform.
    //
    // ITS RADIUS IS SET BY PARALLAX, NOT BY TASTE. First cut was r 0.12 stood
    // 0.095 m behind the veil, and you never see this shrine square on — you
    // come at it up the aisle, 20-30 degrees off its axis. That offset throws
    // the disc ~0.04 m sideways, which was more than the 0.038 m of ring that
    // showed past the veil, so the whole halo bunched into a gold crescent on
    // one side and read as a smudge behind the head. The ring has to be wider
    // than the throw: r 0.14 past a 0.082 veil leaves 0.058, and it reads as
    // a disc from anywhere you can actually stand.
    put(new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.14, 0.015, 12).rotateZ(Math.PI / 2), goldM),
    FX - 0.108, FOOT + 0.575, CZ);
    put(new THREE.Mesh(new THREE.SphereGeometry(0.082, 8, 6), mantleM),
      FX - 0.020, FOOT + 0.578, CZ);                  // the veil, over the back of the head
    put(new THREE.Mesh(new THREE.SphereGeometry(0.072, 8, 6), skinM),
      FX + 0.012, FOOT + 0.565, CZ);                  // and the face
    solid(CX, CZ, 1.4, 0.5);
  }

  // ── the confessional ──────────────────────────────────────────────────
  //
  // Back of the south aisle, where it belongs: a dark oak box with three bays —
  // priest in the middle behind a curtain, a kneeler either side — and a violet
  // stole hung on the outside of the middle door, which is how you know it is
  // in use rather than furniture.
  {
    // CLEAR OF THE NARTHEX PIER. The user: "the confessional is buried in the
    // wall... it should stand proud against the wall as a piece of furniture."
    // It was not in the outer wall — it was inside the pier I added round the
    // arch two commits later, which spans the width at z = hd - NAR_D. Measured:
    // box x 3.01..3.99 z 3.75..6.45 against a pier at z 5.40. Moved into the
    // nave behind the pier, and it stands 0.26 m off the side wall, which is
    // what "proud, as furniture" means.
    const FX = hw - 0.75, FZ = CONF_Z;
    const oakM = new THREE.MeshBasicMaterial({ color: 0x4a3826 });
    const oakDM = new THREE.MeshBasicMaterial({ color: 0x372a1c });
    const BOXW = 0.98, BOXH = 2.42, BOXD = CONF_D;
    put(new THREE.Mesh(new THREE.BoxGeometry(BOXW, BOXH, BOXD), oakM), FX, BOXH / 2, FZ);
    // the cornice, which is what stops it reading as a wardrobe
    put(new THREE.Mesh(new THREE.BoxGeometry(BOXW + 0.14, 0.12, BOXD + 0.14), oakDM),
      FX, BOXH + 0.06, FZ);
    // three bays down the aisle face: two kneeler openings and the priest's
    for (const [dz, tall] of [[-0.92, false], [0, true], [0.92, false]] as [number, boolean][]) {
      put(new THREE.Mesh(new THREE.BoxGeometry(0.05, tall ? 1.95 : 1.55, 0.74), oakDM),
        FX - BOXW / 2 - 0.02, (tall ? 1.95 : 1.55) / 2 + 0.16, FZ + dz);
    }
    // the violet stole over the middle door
    put(new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.62, 0.11),
      new THREE.MeshBasicMaterial({ color: 0x5a3a6a })), FX - BOXW / 2 - 0.05, 1.42, FZ + 0.22);
    solid(FX, FZ, BOXW + 0.2, BOXD);
  }

  // ── the east window, which is the light in the room ──
  //
  // Painted rather than glazed: the lancets outside are texel work in E's
  // facade, so the inside answers them in the same idiom instead of pretending
  // to be glass. Deep colours on a black lead grid — a rose reads as jewels in
  // a dark room, which is exactly what it is for.
  const roseT = declareSurface(pixTex(48, 72, (g) => {
    g.fillStyle = '#14120f'; g.fillRect(0, 0, 48, 72);
    const cols = ['#2f4a7a', '#7a2f38', '#8a6a2a', '#2f6a4a', '#5a2f6a'];
    for (let y = 2; y < 70; y += 5) {
      for (let x = 2; x < 46; x += 5) {
        const dx = (x - 24) / 22, dy = (y - 36) / 34;
        if (dx * dx + dy * dy > 1) continue;
        g.fillStyle = cols[(x * 7 + y * 3) % cols.length];
        g.fillRect(x, y, 4, 4);
      }
    }
  }), 'sign');
  // The east window belongs at the far end over the altar — and HIGH. At centre
  // 3.4 it spanned y 1.6 to 5.2, which is exactly the masonry the crucifix needs:
  // the cross sat over glass, and the user is right that the window is the one
  // place it must not go. It is the same fault as the church's own pillars
  // blocking its lancets, which he has already flagged once.
  //
  // Centre 6.6 puts it at y 4.8 to 8.4 in a 9.5 m wall — up in the gable, where
  // a rose actually is — and leaves the whole lower wall solid. The eye now runs
  // altar, cross, light, which is the order the crucifix comment below asks for
  // and could not have while the two overlapped.
  room.sign(roseT, 2.4, 3.6, 0, 6.6, -hd + 0.09);

  // ── …and the light it throws on the stone ─────────────────────────────
  //
  // "The lancets and rose window throwing coloured light on stone" is the line
  // in the brief, and until now the rose was a lit picture on a wall: bright
  // itself and changing nothing around it. A window that does not colour the
  // room it is in reads as a poster of a window.
  //
  // Everything in this world is unlit MeshBasicMaterial, so "light" is not a
  // lighting change — it is additive geometry, the same trick the casino's
  // spill and the lamp pools use. Five patches in the rose's own five glass
  // colours, thrown DOWN the nave from a window 3.4 m up: a long lozenge on the
  // floor where the sun would land, and two smaller ones riding up the side
  // walls where the splay catches them.
  //
  // Deliberately weak. A church in the afternoon is dim with a few burning
  // colours in it, not a disco; each patch is opacity 0.10 to 0.16, which reads
  // as stain on stone rather than as a projector.
  {
    const GLASS = ['#2f4a7a', '#7a2f38', '#8a6a2a', '#2f6a4a', '#5a2f6a'];
    const patch = (hex: string, w: number, d: number, lx: number, lz: number, op: number) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({
        color: new THREE.Color(hex), transparent: true, opacity: op,
        depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
      m.rotation.x = -Math.PI / 2;
      put(m, lx, 0.02, lz);
      return m;
    };
    // the floor lozenge, brightest nearest the window and stretched up the nave
    for (let i = 0; i < 5; i++) {
      const t = i / 4;
      patch(GLASS[i], 2.3 - t * 0.6, 1.5, (i % 2 ? 0.28 : -0.28) * (1 - t),
        -hd + 1.5 + i * 1.45, 0.16 - t * 0.06);
    }
    // I also put two patches on the side walls, where a reveal would splay the
    // light sideways, and took them out again after looking: additive blue on a
    // pale stone wall desaturates to grey, so a 2.6 x 1.7 rectangle of it reads
    // as a flat PANEL hung on the wall rather than as light falling on one. On
    // the floor the same colours work, because the floor is darker and the shape
    // is long and irregular. Not every surface takes the same trick.
  }

  // ── one person, four rows back, and she is the difference ──
  //
  // The room shipped with `keeper: null` and the reasoning was sound as far as
  // it went: a weekday afternoon church is empty, and the emptiness is the
  // effect. But the user has said twice that interiors here feel wrong for
  // exactly the neighbouring reason — *"the people inside these places are
  // always flat and not like the people on the street"*, and of the bodega,
  // *"a bit small and sad"*. Empty and SAD are one bad decision apart.
  //
  // So: one woman, seated, four rows back on the left, facing the altar. Not a
  // keeper — nobody is minding a church — which is why `keeper: null` in the
  // harness stays correct: there is no counter and nobody to serve you. She is
  // scenery with a pulse, and a single figure in a sixteen-metre nave reads as
  // quiet, where nobody at all reads as unfinished.
  //
  // Head bowed is not something the atlas can do, so this does the readable
  // version: seated height, dark coat, still. From the 8-angle atlas like every
  // other figure in the world — the whole point of the user's complaint was
  // that interior people were cardboard when the street's were not.
  const PRAY_Z = PEW_Z0 + 3 * 1.05;
  room.person({
    jacket: '#3a3640', pants: '#2e2b33', skin: '#c9a48a', hair: '#7a7068',
    fit: 'coat', accent: '#5a5260', cut: 'short', build: 0,
  }, -PEW_CX, PRAY_Z, {
    // H's SEATED pose, which landed today. This was a standing sprite squashed
    // to h 0.62 to fake sitting - the exact cardboard the user complained
    // about. The origin moves with the pose: seated is the hip and goes on the
    // SEAT TOP, which is PEW_TOP — the same constant ctx.seat() now registers,
    // rather than the arithmetic written out a second time here.
    // citizenPlane owns the 0.445 m hip offset; no fudge here.
    seated: true, y: PEW_TOP, facing: Math.PI,
  });

  // ── the crucifix, over the altar ──
  //
  // The user: *"this church is catholic wheres the jesus on the cross?"* Fair,
  // and it is the one thing a Catholic church cannot be missing. It hangs on
  // the sanctuary wall above the altar, below the window, which is where it
  // goes — the eye travels altar, cross, light.
  //
  // Built rather than painted, because a cross read from an angle has to stay a
  // cross: two boxes make it solid from every heading, where a plane would go
  // edge-on and vanish exactly when you walked up the nave to look at it.
  // SCALED UP. The brief asks for "a LARGE one... so it is the first thing you
  // see down the nave", and at 1.5 m tall on a 9.5 m wall it read as modest —
  // correct in every other way and too small to be the focal point. 2.6 m of
  // cross, centred at 3.05, now fills the masonry between the altar and the
  // rose. Every dimension below is scaled from the same factor rather than
  // re-typed, so the corpus cannot drift off the cross.
  const CRX_Z = -hd + 0.16, CRX_Y = 3.05, K = 1.74;
  const woodDark = new THREE.MeshBasicMaterial({ color: 0x4a3a28 });
  const upright = new THREE.Mesh(new THREE.BoxGeometry(0.13 * K, 1.5 * K, 0.09), woodDark);
  put(upright, 0, CRX_Y, CRX_Z);
  const crossarm = new THREE.Mesh(new THREE.BoxGeometry(0.86 * K, 0.13 * K, 0.09), woodDark);
  put(crossarm, 0, CRX_Y + 0.36 * K, CRX_Z);
  // the corpus: pale against the dark wood, small enough to read as a figure
  // rather than a shape, and inset so the cross stays proud of it
  const skinM = new THREE.MeshBasicMaterial({ color: 0xc9b49a });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.17 * K, 0.42 * K, 0.07), skinM);
  put(torso, 0, CRX_Y + 0.26 * K, CRX_Z + 0.07);
  const arms = new THREE.Mesh(new THREE.BoxGeometry(0.62 * K, 0.07 * K, 0.06), skinM);
  put(arms, 0, CRX_Y + 0.37 * K, CRX_Z + 0.07);
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.11 * K, 0.34 * K, 0.06), skinM);
  put(legs, 0, CRX_Y - 0.05 * K, CRX_Z + 0.07);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.11 * K, 0.12 * K, 0.07), skinM);
  put(head, 0, CRX_Y + 0.53 * K, CRX_Z + 0.07);
  // INRI, the small board above the head
  const inri = new THREE.Mesh(new THREE.BoxGeometry(0.17 * K, 0.07 * K, 0.05),
    new THREE.MeshBasicMaterial({ color: 0xbdb08c }));
  put(inri, 0, CRX_Y + 0.63 * K, CRX_Z + 0.07);

  // ── a rack of votive candles by the door, the one warm thing ──
  //
  // MOVED, and it is the same sign error as the altar. This sat at `-hd + 2.0`
  // while the comment above it said "by the door" — and -hd is the FAR end under
  // the kit's convention, so it was up beside the altar, 11 m from the door it
  // was written for. The prose was right and the arithmetic was not, which is
  // exactly how the altar was wrong too.
  //
  // It now stands beside the votive stand at the near end rather than duplicating
  // it: this is the plain iron rack people actually light candles at, and the
  // stand a couple of metres along has the statue over it. Two racks eleven
  // metres apart, one of them contradicting its own comment, was the state
  // before.
  const rack = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.34),
    new THREE.MeshBasicMaterial({ color: 0x4a4038 }));
  put(rack, -hw + 0.9, 0.78, hd - 5.4);
  for (let i = 0; i < 7; i++) {
    const lit = i !== 2 && i !== 5;                 // most of them burnt out
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, lit ? 0.13 : 0.05, 6),
      new THREE.MeshBasicMaterial({ color: lit ? 0xe8c87a : 0xbdb6a4 }));
    put(c, -hw + 0.9 - 0.36 + i * 0.12, 0.81 + (lit ? 0.065 : 0.025), hd - 5.4);
  }
  const stand = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.78, 0.12),
    new THREE.MeshBasicMaterial({ color: 0x4a4038 }));
  put(stand, -hw + 0.9, 0.39, hd - 5.4);
  solid(-hw + 0.9, hd - 5.4, 0.9, 0.36);
  // ── the clerestory, because the upper nave was blank plaster ──
  //
  // Graded my own nave from the entrance and named this: between the stations
  // of the cross and the ceiling there was a large flat pale expanse either
  // side, and the ceiling another. Same fault the user named in the bodega,
  // an untextured field with nothing to give it scale.
  //
  // The fix is not texture, it is WINDOWS. A nave this tall has a row of high
  // ones — that is what a church's upper wall is — and they light the space
  // from above instead of leaving it flat. Lancets: tall, narrow, pointed,
  // paired between the bays, in the rose's palette so the room's glass agrees
  // with itself.
  {
    const lancetT = declareSurface(pixTex(16, 40, (g) => {
      g.fillStyle = '#14120f'; g.fillRect(0, 0, 16, 40);
      const cols = ['#2f4a7a', '#7a2f38', '#8a6a2a', '#2f6a4a', '#5a2f6a'];
      for (let y = 2; y < 38; y += 4) {
        for (let x = 2; x < 14; x += 4) {
          // the pointed head: narrow the opening as it rises
          const halfAt = y < 10 ? 2 + y * 0.5 : 7;
          if (Math.abs(x + 2 - 8) > halfAt) continue;
          g.fillStyle = cols[(x * 5 + y * 3) % cols.length];
          g.fillRect(x, y, 3, 3);
        }
      }
    }), 'sign');
    const stoneM = new THREE.MeshBasicMaterial({ color: dim(0x8a8478) });
    // Spaced along the NAVE only — clear of the narthex at the door end and of
    // the chancel at the altar end, both of which have their own glass.
    const Z0 = -hd + 4.0, Z1 = hd - 5.0;
    const BAYS = 4;
    for (let i = 0; i < BAYS; i++) {
      const cz2 = Z0 + ((Z1 - Z0) * (i + 0.5)) / BAYS;
      for (const sx of [-1, 1]) {
        for (const dz of [-0.55, 0.55]) {            // paired lancets per bay
          const gl = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 1.75),
            new THREE.MeshBasicMaterial({ map: lancetT.clone() }));
          gl.rotation.y = sx > 0 ? -Math.PI / 2 : Math.PI / 2;
          put(gl, sx * (hw - 0.07), 6.15, cz2 + dz);
          // a stone surround, so it reads as an opening in a wall and not a
          // poster hung on one
          const surr = new THREE.Mesh(new THREE.BoxGeometry(0.10, 2.05, 0.86), stoneM);
          put(surr, sx * (hw - 0.02), 6.15, cz2 + dz);
        }
        // the pier between each pair of bays, which is what a clerestory sits on
        const pier = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.6, 0.34), stoneM);
        put(pier, sx * (hw - 0.05), 6.15, cz2);
      }
    }
  }

}
