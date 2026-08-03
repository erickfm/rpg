// ┌───────────────────────────────────────────────────────────────────────┐
// │  ⚠ THIS ONE CHECK IS DEV-ONLY. IT CANNOT RUN ON `vite preview`.       │
// │                                                                       │
// │  Everything else in this project is verified on the BUILT BUNDLE —    │
// │  GOTCHAS 28, and BUILDER-BRIEF §10 tells every builder so. This file  │
// │  is the documented exception, and the contradiction is stated here    │
// │  rather than lived with (item 246).                                   │
// │                                                                       │
// │  WHY. It reads its declarations out of the TypeScript sources at      │
// │  runtime — four sites, `import('/src/proto/ct/doors.ts')` x3 and      │
// │  `import('/src/proto/ct/interior.ts')` x1. `vite dev` serves those    │
// │  transpiled and the app has already imported them, so the ES module   │
// │  cache hands back the SAME instance: the harness reads the live       │
// │  declaration and a party wall added tomorrow is understood for free.  │
// │  `vite preview` serves only `dist/`, so all four 404.                 │
// │                                                                       │
// │  WHAT IT WOULD TAKE TO LIFT IT — measured, not guessed, by            │
// │  `scripts/probes/w93-item246-iw-bundle-gap.mjs` on 2026-08-03:        │
// │                                                                       │
// │    doorStandFor / doorPointFor  ALREADY on `__ct.doors()`, and they   │
// │                                 agree exactly, 12/12 and 12/12.       │
// │    roomWidthFor -> `r.W`        DEAD — assigned at one line and read  │
// │                                 nowhere. (`inRoom` uses lower-case    │
// │                                 `r.w`, measured off the colliders.)   │
// │    declaredDoors().at -> r.at   fallback only, at the `|| { x:        │
// │                                 room.at … }` arm of DOOR.             │
// │    interior.ts `PARTY`          NOT published anywhere. 1 declared    │
// │                                 party wall, and this file exits 3     │
// │                                 without it, deliberately: a           │
// │                                 containment run that does not know    │
// │                                 the party doorways reports the        │
// │                                 feature as a hole.                    │
// │                                                                       │
// │  So THREE of the four sites are already redundant and the whole       │
// │  remaining blocker is publishing `PARTY` on `__ct` — one line in      │
// │  `src/proto/crosstown.ts`, beside `roomDims()`. That file was not     │
// │  in item 246's scope, so it is queued, not done.                      │
// │                                                                       │
// │  Until then: run this on `vite dev`. The preflight below aborts with  │
// │  EXIT 3 (nothing measured) rather than the exit 1 it used to give,    │
// │  which read as twelve failing rooms. (GOTCHAS 32.)                    │
// └───────────────────────────────────────────────────────────────────────┘
// ┌───────────────────────────────────────────────────────────────────────┐
// │  HEADING CONVENTION — atan2(-nx, nz).  NOT atan2(nx, nz).             │
// │                                                                       │
// │  Yaw 0 looks along -z, so heading y points along (sin y, -cos y).     │
// │  A door publishes its INWARD normal n; walking AT it means -n, so     │
// │      sin y = -nx,  cos y = nz   =>   y = atan2(-nx, nz)               │
// │                                                                       │
// │  THE TRAP: for every flat-wall door nx === 0, and atan2(-0, nz) and   │
// │  atan2(0, nz) give the SAME direction. The wrong form is correct for  │
// │  nine rooms out of ten and points you down the street for the tenth,  │
// │  the bodega's 45-degree cut face. Testing the easy cases cannot catch │
// │  it. I got it wrong twice in one session and walked 200 m off the map │
// │  both times, the second time hours after diagnosing and fixing it.    │
// │                                                                       │
// │  DO NOT RETYPE IT. Import it:                                         │
// │      import { approachHeading, exitHeading } from './lib/viewof.mjs'; │
// │  A formula you retype is a formula you will retype wrong.             │
// │                                                                       │
// │  And take the POSITION from doorStandFor(building), not from          │
// │  door - normal * k. That arithmetic put me on ground that does not    │
// │  hold you up, and fixing the heading only revealed it.                │
// └───────────────────────────────────────────────────────────────────────┘
// Walk every interior in the belt. Interiors cannot be verified from a
// screenshot (GOTCHAS §1) and floors/collision least of all (§7), so this
// drives the real rig: it walks up to the door on the street, presses E, and
// then walks the room until something stops it.
//
// Usage: SHOT_URL=http://localhost:4185/ node scripts/interiors-walk.mjs [id]
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { flags } from './lib/flags.mjs';
import { approachHeading } from './lib/viewof.mjs';
import { reportWorld } from './lib/which-world.mjs';
import { reportEndOfRun } from './lib/server-state.mjs';
import { entrySpots } from './lib/entry-spot.mjs';
import { sampleFloors, installRayFloorQuery, selfTestRayQuery } from './lib/floors.mjs';

const FACE = 7.0, KERB_H = 0.14, RADIUS = 0.36;

// One entry per room. The slab centre is NOT hardcoded — it is discovered by
// walking in and reading where you land. Slabs are handed out in build order,
// so hardcoding them means every room's test breaks the day another builder's
// room is wired in ahead of yours, which with four agents on this programme is
// a matter of days.
const ROOMS = [
  {
    // ADDED because the coverage guard refused to run without it - the jail
    // landed and this hand-written list did not have it. The guard catching a
    // brand-new room within hours of being written is the whole reason it
    // exists; before it, the suite would have reported on eleven rooms and
    // looked complete.
    //
    // Its door is declared by `face:` like the bodega's chamfer, not by a
    // frontage along an axis, and it publishes no `__frontages` entry - so no
    // `front` tuple. The harness reads the door from ct/doors.ts, which is
    // exactly the case `chamfer: true` already covers.
    //
    // `keeper: null` because it publishes no served spot. A desk sergeant with
    // a prompt would make the facing check decidable; until then it abstains
    // rather than leaning on a station I typed, which is the fault that let the
    // bodega keeper face his own wall for weeks.
    keeper: null,
    // `east: true` — the jail's own file (`ct/jail.ts`) is unambiguous: the
    // door's outward normal is `nx: -1` (`JAIL_DOOR`), and `ct/street.ts`
    // says so in its own words, "the jail takes a WEST-FACING [door]". The
    // road is in -x from the door, not +x.
    //
    // Every other room in this list gets `east` computed automatically from
    // its `front:` tuple (`if (side > 0) r.east = true;`, above). The jail
    // has no `front:` — it is a `chamfer:`-style door read from ct/doors.ts —
    // so `r.east` was silently staying `undefined`, and every check below
    // that branches on it (`off`, the kerb approach heading, "out to the
    // road") defaulted to the OTHER building's convention: +x.
    //
    // Measured, not guessed (`scripts/O-jail-landing-probe.mjs`): from the
    // landing at (60.12, -100.8), walking +x moved 0.35 m before the
    // building's own collider (ctx.obstacle 60.88..65 in ct/jail.ts) — the
    // player was being walked back INTO THE BUILDING and called boxed in.
    // Walking -x (this fix) moved 6.19 m, clean, out past the site edge and
    // onto the road (gy 0.14 -> 0). Nothing in ct/jail.ts changed — the
    // forecourt was open the whole time; the harness was aiming the wrong way.
    east: true,
    // THIS ROW USED TO CARRY `label: /JAIL|HOUSE OF DETENTION/` — a
    // hand-maintained alias list, written after the display name was changed
    // under it and six prompt checks failed against a door that works. Item 213
    // removed the whole class: `building` is the DECLARATION key
    // (ct/jail.ts's JAIL_DOOR), and the prompt text is read back from the world.
    // A third rename now costs nothing instead of six red rows.
    id: 'jail', building: 'JAIL', D: 26.0, chamfer: true,
  },
  {
    // ADDED because the suite refused to run without them - the world published
    // `bank` and `library` and this hand-written list did not have them, so
    // nine rooms were being reported as if they were the world. The guard above
    // now makes that impossible; these are the entries it demanded.
    //
    // Neither publishes a served spot yet, so the keeper check will say so
    // rather than lean on a station I typed - which is the fault that let the
    // bodega keeper face his own wall for weeks. A teller window in the bank
    // and a desk prompt in the library would make both decidable.
    keeper: null,
    id: 'bank', D: 12.0, front: ['FIRST FEDERAL', 19.2, 4.6, -1],
  },
  {
    keeper: null,
    id: 'library', D: 22.0, front: ['LIBRARY', 16, -13, -1],
  },
  {
    // the bodega's door is on a CHAMFER, so its [E] spot is not on an axis —
    // the harness reads it from ct/doors.ts like everything else
    // `keeper` is where a PLAYER STANDS to be served — the customer side of the
    // corner counter.
    //
    // WAS [3.90, 1.60], which is the WALL side: between the keeper and the side
    // wall at 4.40, where no customer can be. It was only ever consistent with
    // the keeper standing on the room side of his own counter, which is the
    // fault the user reported and B verified — from the room side you saw his
    // back. Both the harness and the room agreed with each other and disagreed
    // with the player.
    //
    // The world publishes the right answer and I should have used it: the buy
    // spots sit at local x ~ 1.75, and B's station (441.50, 0.40) is the frame
    // where `[E] buy cereal` is up, so the game itself says a customer stands
    // there. Room side, and now the keeper faces it.
    keeper: [1.50, 0.40],
    id: 'bodega', D: 11.0, front: ['BODEGA', 10, -95, 1], chamfer: true,
  },
  {
    // ST BRIGID'S. Reached from the TOP OF A FLIGHT, not from the pavement —
    // the only room in the belt whose door is 0.55 m up its own steps, so the
    // street-level approach legs the other eight use do not apply.
    //
    // `keeper: null` is the explicit opt-out, not an omission: a weekday
    // afternoon church has nobody in it, and that emptiness is the room.
    id: 'church', building: 'ST BRIGID', D: 16, W: 8.5,
    keeper: null,
    doorX: 8.85, doorZ: -79.5, at: 0, sideStreet: true,
  },
  {
    // `keeper` is where a PLAYER STANDS to be served — a stool-width out from the service counter.
    keeper: [-1.40, -1.00],
    id: 'diner', D: 7.0, front: ['DINER', 12, -49.5, -1],
  },
  {
    // `keeper` is where a PLAYER STANDS to be served — in front of the order counter.
    keeper: [-2.33, -2.00],
    id: 'burger', D: 8.5, front: ['BURGER BARN', 16, -29, -1],
  },
  {
    // `keeper` is where a PLAYER STANDS to be served — at the till, where you are handed your change.
    keeper: [2.20, -1.75],
    // THE BRIEF'S HEADLINE, and the only room with one. The user: "too much
    // stuff in too little room — density is the whole effect, a thrift store
    // with clear floor space reads as a boutique." The desk measured the
    // failure as 21 placed objects, thinnest room in the world.
    //
    // 115 is CALIBRATED AGAINST THE FAILURE, not guessed under the current
    // count. My first attempt was 90 — "comfortably below the 128 it builds
    // today" — and it could never have fired: deleting the entire density pass
    // leaves 92, because the count is dominated by the shell and the fixtures
    // that were always there. A floor below the failure state is decoration.
    //
    //     density pass present   128 meshes
    //     density pass deleted    92 meshes   <- what this must catch
    //
    // 115 sits between them with 13 of slack for ordinary edits. Absence of
    // `minMeshes` means NO DENSITY MANDATE for that room, which is a statement
    // — seven briefs did not ask for one.
    minMeshes: 115,
    id: 'thrift', D: 9.4, front: ['THRIFT', 12.5, -61.75, -1],
    // …and because "dense but walkable" is this room's whole risk, it also
    // gets its aisles walked: between rail rows, and down the open spine.
    aisles: [
      ['between the front two rails', 0.45],
      ['between the back two rails', -0.9],
      ['down the open spine to the till', 1.8],
    ],
  },
  // ── builder G's three, on the SIDE STREET (north side, facing −z) ──
  //
  // These sat finished and unreachable for a while: written, committed, and
  // never called from crosstown.ts. Their doors are on the side street rather
  // than the block, so the approaches run along x, not z.
  // RE-SYNCED BY G, 2026-07-26. These two are copies of MY numbers and they had
  // gone stale, which is the cost of the copy rather than anybody's mistake: both
  // rooms GREW when the maxZ depth clamp was lifted — the casino from d 9 to 36
  // and the hotel from d 9 to 26 — and the hotel's reception desk moved with it.
  //
  // What that produced was a FALSE FAILURE against my rooms, not a real one. The
  // hotel's authored station sat at local (-3.6, -0.65) while its clerk stands at
  // (-5.17, 8.75) — 9.4 m apart — so the run reported "no atlas figure within 4 m
  // of the customer spot", which reads as a missing keeper and is in fact a
  // missing update. Measured both from the world before writing them down.
  //
  // The `D` here is dead data — nothing reads it, only `W` is used and only as a
  // fallback — but a wrong number in a table is a trap for the next reader, so it
  // is corrected rather than left.
  {
    // across the felt from the dealer, who stands at local (-2.6, -13.95):
    // the table is at (-2.6, -13.0) and a player stands on the near side of it
    keeper: [-2.6, -12.0],
    // `/SEVENS/` until item 196, which REPAINTED this elevation to the user's
    // own ask — *"make it a combo orpheus hotel and casino"*. `ct/vice.ts` now
    // draws ORPHEUS over CASINO on the marquee and ORPHEUS / HOTEL & CASINO on
    // the board, so the word SEVENS is no longer painted on the building, and
    // `int-casino.ts:134` renamed the prompt to match its own sign. The regex
    // was the last thing still saying the old address; the world is right.
    // (`building`/roster keys elsewhere are still 'SEVENS' and must stay — the
    // address changed, the registry key did not.)
    // Deliberately NOT bare `/ORPHEUS/`: that is the HOTEL's label two entries
    // down, and the two rooms are now one property with adjacent doors.
    // RESOLVED (item 213): identify by the REGISTRY KEY, not the label. The
    // comment above already said the key must stay; matching on a display
    // name is the very thing 213 exists to remove, since the user renames
    // businesses (this one, and the mattress store, item 166).
    id: 'casino', building: 'SEVENS', W: 11.0, D: 36.0,
    doorX: 51.29, doorZ: -97.0, at: -3.2, sideStreet: true,
  },
  {
    // the guest side of the reception desk. The desk face is at x -4.175 and the
    // clerk is behind it at (-5.17, 8.75); this is the same pair
    // scripts/G-rooms-walk.mjs uses, re-copied now that it has moved.
    keeper: [-4.0, 8.75],
    id: 'hotel', building: 'HOTEL ORPHEUS', W: 11.0, D: 26.0,
    doorX: 39.51, doorZ: -97.0, at: -3.4, sideStreet: true,
  },
  {
    // NO EXPLICIT W ANY MORE — it DERIVES, per the note just below this table.
    // It was pinned at 10.0 and the room is 13.8: the pin overrode the derivation
    // and went stale the moment the room grew, which is the exact failure that
    // note warns about ("a test asserting a stale number is worse than no test").
    // Removing it is better than typing 13.8, which can go stale the same way.
    // The keeper pair is measured and still right: the broker stands at local
    // (1.6, -3.52) and this is the customer side of his counter, 1.92 m away.
    keeper: [1.6, -1.6],
    id: 'pawn', D: 8.0, front: ['PAWN', 15, -60.5, 1],
  },
  {
    // G's OWN spot, copied from scripts/G-rooms-walk.mjs — the client chair
    keeper: [-2.6, -0.75],
    id: 'tax', D: 8.5, front: ['A-1 TAX', 13, -15.5, 1],
  },
];

// ── ROOMS THAT ARE NOT IN THE BELT, and cannot be walked the way the twelve are
//
// Everything in `ROOMS` above shares four facts that this whole file is built
// on: the room is a kit slab at x >= 400, its cz is 0, its floor is y 0, and
// you get in by pressing [E] at a door on the pavement. Section 1 walks the
// street up to that door, section 5 walks back out of it and checks you landed
// on the kerb, and the entry leg locates the room by `400 + floor((x-400)/80)
// * 80 + 40` — the slab address. None of that means anything for a room that
// has none of those four properties.
//
// `apt301` has none of them. Measured from the world's own registry
// (`scripts/probes/w32-roomdims-dump.mjs`):
//
//     twelve belt rooms   cx 440..1320   cz 0.00     y 0.000   w 8.8..20.0
//     apt301              cx 198.40      cz -16.25   y 5.400   w 3.06
//
// It is a 3 m flat on the THIRD FLOOR of the walk-up, reached by climbing a
// stair shaft, and its door is an interior door onto a landing — there is no
// street approach to walk and no "out to the street" prompt to press.
//
// So it is walked, but for the legs that are ACTUALLY DECIDABLE about it (see
// `walkOffBelt` below): was it built, does the floor picker agree with where
// the rig stands three storeys up, is there floor to stand on, can you cross
// it. The street-approach, [E]-entry, way-out and landing legs are declared
// not-applicable and PRINTED as such — not silently dropped, which is the
// GOTCHAS 34 failure this file's coverage guard exists to prevent.
//
// `covers` names the check that DOES test the parts this one cannot, so the
// opt-out points at a real instrument rather than at nothing.
const OFF_BELT = [
  { id: 'apt301', covers: 'door301' },   // no `label`: it was dead data, never read (item 213)
];

// Rooms that name a building get their door and width DERIVED from the same
// published frontage the kit and the painter use. Hand-typed door positions in
// a test file go stale exactly the way they did in the rooms — three of them
// did, and a test asserting a stale number is worse than no test.
// The room filter is POSITIONAL, so it must skip flags. `process.argv[2]` took
// `--selftest` as a room name, matched nothing, and the run walked zero rooms.
// …and unknown flags are REFUSED, not skipped. Skipping them was half a fix:
// `--selftst` would drop out of the room filter AND out of the selftest test at
// :165, running the ordinary walk and exiting 0 — a selftest pass for a
// selftest that never ran (GOTCHAS 34 shape one).
const SELFTEST = flags(['--selftest']).selftest;
const only = process.argv.slice(2).find((a) => !a.startsWith('--'));
const rooms = only ? ROOMS.filter((r) => r.id === only) : ROOMS;
// The positional filter has to reach the off-belt rooms too, or `apt301` would
// be the one room in the world you could not ask this suite about by name.
const offBelt = only ? OFF_BELT.filter((r) => r.id === only) : OFF_BELT;
if (only && !rooms.length && !offBelt.length) {
  console.log(`no room called "${only}" — ids are: ${[...ROOMS, ...OFF_BELT].map((r) => r.id).join(', ')}`);
  process.exit(1);
}

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 960, height: 600 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
p.on('console', (m) => { if (m.type() === 'warning' && /\[interior:/.test(m.text())) errs.push('KIT WARNING: ' + m.text()); });
await p.goto(aim('http://localhost:4185/'), { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p, aim('http://localhost:4185/'));   // GOTCHAS 26: prove it, do not just name it
await p.waitForTimeout(400);

// ── DEV-SERVER PREFLIGHT (item 246) ───────────────────────────────────────
//
// THIS SUITE IS DEV-ONLY, AND UNTIL NOW IT SAID SO BY CRASHING. See the banner
// at the top of this file for why it is dev-only and what would lift it. This
// block exists only so the constraint arrives as a sentence rather than as a
// stack trace with an exit code that means the opposite of the truth:
//
//   before   page.evaluate: TypeError: Failed to fetch dynamically imported
//            module: http://localhost:4490/src/proto/ct/doors.ts
//            ...unhandled, node turns it into  EXIT 1
//
// **Exit 1 is "measured, and it is WRONG" (GOTCHAS 32).** Nothing was measured.
// A builder following the standing verify-on-the-bundle instruction got a red
// against twelve rooms that are fine, from a check that never started — the
// exact ambiguity GOTCHAS 32 was written about, in the one suite the rule
// points at most often.
//
// EXIT 3 IS THE HONEST CODE: aborted, wrong world, nothing follows about the
// interiors. And it is checked HERE, four hundred lines before the first
// import site, so the answer costs a page load instead of a full launch.
{
  const devModules = await p.evaluate(async () => {
    try { await import('/src/proto/ct/doors.ts'); return true; } catch { return false; }
  });
  if (!devModules) {
    console.log('');
    console.log('DEV SERVER REQUIRED — nothing measured.');
    console.log('  This suite reads its door and party-wall declarations from the TypeScript');
    console.log('  sources at runtime (`import("/src/proto/ct/doors.ts")`, `.../ct/interior.ts`).');
    console.log('  `vite dev` serves those transpiled; `vite preview` serves only the bundle,');
    console.log('  so they 404 and every room would be walked against a guess.');
    console.log('');
    console.log('  Re-run against a dev server:  npx vite --port <yours> --strictPort');
    console.log('                                SHOT_URL=http://localhost:<yours>/ node scripts/interiors-walk.mjs');
    console.log('');
    console.log('  This is the ONE check in the suite that cannot honour the');
    console.log('  verify-on-the-built-bundle rule. See notes/BUILDER-BRIEF.md §10 and the');
    console.log('  banner at the top of this file. Exit 3 = aborted, not failed.');
    await b.close();
    process.exit(3);
  }
}

// ── AND ASK IT WHAT EACH DOOR CALLS ITSELF (item 213) ───────────────────
//
// Every row above used to carry a `label` regex over the [E] prompt text — the
// jail's was already a hand-maintained TWO-name alias list, `/JAIL|HOUSE OF
// DETENTION/`, written after a rename broke six checks on a working door. The
// casino's `/SEVENS/` then broke the same way when item 196 moved it to the
// Orpheus wing: measured on build 9fbd3b781 this suite scored **13/30 on the
// casino**, every prompt leg red, on a door that opens perfectly.
//
// The rows now name their `building` — the DoorDecl roster key, which is not
// user-facing and does not move on a rename — and the expected text is read
// back from `__ct.spots()` at the coordinate `__ct.doors()` publishes.
// See scripts/lib/entry-spot.mjs.
const entryIndex = await entrySpots(p);
console.log(`entry spots: ${entryIndex.resolved} of ${entryIndex.total} declared doors resolved to an [E] spot`);
for (const r of ROOMS) {
  // `front[0]` IS the roster key for the rooms that publish a frontage, so
  // those rows need nothing extra; the four chamfer/`face:` rooms name it.
  r.building = r.building ?? (r.front ? r.front[0] : null);
  r.entryLabel = r.building ? (entryIndex.byBuilding.get(r.building)?.label ?? null) : null;
}
const isEntry = (r, txt) => r.entryLabel != null && txt != null && String(txt).includes(r.entryLabel);
{
  const unresolved = ROOMS.filter((r) => r.entryLabel == null).map((r) => `${r.id}(${r.building ?? 'no building key'})`);
  if (unresolved.length) console.log(`  note  no entry label resolved for: ${unresolved.join(', ')}`);
}

for (const r of ROOMS) {
  if (!r.front) continue;
  const [name, w, cz, side] = r.front;
  // From the ROOM's declaration, which is the authority — the facade follows
  // it. Reading `frontageOf` here tested the old direction and failed every
  // room the moment it flipped.
  const d = await p.evaluate(async ([name, w]) => {
    const dm = await import('/src/proto/ct/doors.ts');
    const decl = dm.declaredDoors().find((x) => x.building === name);
    return { z: dm.doorWorldFor(name), at: decl.at, W: dm.roomWidthFor(w) };
  }, [name, w]);
  const stand = await p.evaluate(async ([n]) => {
    const dm = await import('/src/proto/ct/doors.ts');
    return dm.doorStandFor(n);
  }, [name]);
  r.doorX = stand ? stand.x : side * (FACE - 0.75);
  r.doorZ = stand ? stand.z : d.z;
  r.at = d.at; if (r.W === undefined) r.W = d.W;
  if (side > 0) r.east = true;
}

const pos = () => p.evaluate(() => window.__ct.pos());
const prompt = () => p.evaluate(() => {
  const d = document.getElementById('ct-prompt');
  return d && d.style.display !== 'none' ? d.textContent : null;
});
const warp = (x, z, yaw, gy) => p.evaluate(([x, z, yaw, gy]) => window.__ct.warp(x, z, yaw, gy, 0), [x, z, yaw, gy]);
const press = async () => { await p.keyboard.down('e'); await p.waitForTimeout(90); await p.keyboard.up('e'); await p.waitForTimeout(260); };
const hold = async (k, ms) => { await p.keyboard.down(k); await p.waitForTimeout(ms); await p.keyboard.up(k); await p.waitForTimeout(120); };
// Hold a key until the WORLD says to stop, with wall-clock only as a cap.
//
// A fixed `hold('w', ms)` does not walk a DISTANCE, it walks however far the
// frame budget got through in that many milliseconds — and this suite's §5 leg
// starts 0.9 m from a door whose way-out spot has r = 1.4 (ct/interior.ts:1255).
// Measured on the bodega with scripts/probes/w30-iw-wayout-flake.mjs: the same
// `hold('w', 2600)` travelled 0.79 m on one run and 1.79 m on another, and the
// long ones walk straight out of the far side of the trigger, so the prompt is
// gone by the time it is read. 3 failures in 10 at CPU x1.
//
// NOTE THE SIGN, because it is the opposite of the other fixed-wait bug this
// project has fixed: item 50's `jump-walk.mjs` was TRUNCATED by a slow frame.
// This one OVERSHOOTS on a fast one — under CPU throttle x8 it passed 10/10,
// because throttling makes the player travel less. Throttling is not a
// worst case for a wall-clock wait; it is just a different case.
//
// So: settle on the condition the check is about. The cap is still wall-clock
// because something has to bound a walk that never arrives — but the cap is an
// upper bound on patience, not the measurement.
const holdUntil = async (k, ready, capMs) => {
  await p.keyboard.down(k);
  const t0 = Date.now();
  let hit = false;
  while (Date.now() - t0 < capMs) {
    await p.waitForTimeout(80);
    if (await ready()) { hit = true; break; }
  }
  await p.keyboard.up(k);
  await p.waitForTimeout(120);
  return hit;
};

const results = [];
let room = null;
const check = (name, ok, detail) => results.push([ok, `${room.id}: ${name}`, detail]);
const f2 = (n) => +n.toFixed(2);
const YAW = { '+x': Math.PI / 2, '-x': -Math.PI / 2, '+z': Math.PI, '-z': 0 };

// ASK the world how big each room is, do not remember it.
//
// This table carried a `W` and `D` per room, and the pawn shop's read
// "room width stays G's explicit 10.0". That explicit 10.0 was then removed
// from the room (358d82cc) so it takes the kit's rule, roomWidthFor(15) = 13.8
// — and this harness went on believing 10.0 and reported THREE ESCAPES from a
// room that was holding the player in perfectly well. The players stopped dead
// at local x -6.51, -6.53, -6.54: a wall at 6.9, exactly where 13.8 puts it.
//
// A containment check that invents its own idea of where the walls are will
// eventually accuse a sound room, and it did. The kit publishes the RESOLVED
// size now (`__ct.roomDims()`), which is the same fix as the doors: one
// authoring, asked for rather than copied.
const DIMS = await p.evaluate(() => window.__ct.roomDims());

// ── THE ROOMS ARE NO LONGER ALL SEPARATE, AND THIS FILE HAS TO KNOW ────────
//
// Item 196 cut a doorway through the flank walls the hotel and the casino
// share, because the user asked for it in those words: *"i should be able to
// walk from one into the other."* Leg 3 below was a per-room BOX test, so a
// player using that doorway read as a player leaving the world, and the casino
// has been failing containment ever since — a KNOWN-GOOD RED that has now cost
// three separate investigations (items 222, 226).
//
// ASK `ct/interior.ts`, DO NOT COPY IT. `PARTY` is the one authoring of the
// doorway: the pair, the local z, the clear width. Retyping any of it here is
// the defect BUILDER-BRIEF §8 exists for, and this file has already paid for it
// once (the pawn shop's `W`, four hundred lines up). vite dev serves TS
// transpiled and the app has already imported this module, so the ES module
// cache hands back the same instance — this reads the live declaration, and a
// second party wall added tomorrow is understood here for free, with no edit.
const PARTY = await p.evaluate(async () => {
  const m = await import('/src/proto/ct/interior.ts');
  return m.PARTY ?? null;
});
if (!Array.isArray(PARTY)) {
  console.log('could not read PARTY from /src/proto/ct/interior.ts — refusing to');
  console.log('guess which rooms are joined. A containment run that does not know');
  console.log('about the party doorways reports the feature as a hole.');
  await b.close(); process.exit(3);
}
/** are these two rooms joined by a DECLARED opening? */
const joined = (a, c) => PARTY.some((w) =>
  (w.west === a && w.east === c) || (w.east === a && w.west === c));
/** is this world point inside that room, allowing for the wall's own thickness?
 *  T is the OUTER face (0.18) plus 0.05: a doorway is a real reveal you can
 *  stand in, and calling that "out" fails a room for having a door. Reads `cz`
 *  rather than assuming 0, so it is true of `apt301` as well as of the belt. */
const ROOM_T = 0.18 + 0.05;
const inRoom = (r, x, z) =>
  Math.abs(x - r.cx) <= r.w / 2 + ROOM_T && Math.abs(z - r.cz) <= r.d / 2 + ROOM_T;

// ── AND WHERE THERE IS ACTUALLY A FLOOR ───────────────────────────────────
//
// Leg 3's invariant used to be "you are inside your own box". That cannot tell
// *left the world* from *walked next door*, which is why the doorway read as an
// escape. The invariant that survives a doorway is the one item 215 arrived at
// on the sites, from the user's own words (*"allow for out of bounds"*):
//
//     THE PLAYER MUST NEVER STAND WHERE THERE IS NO FLOOR.
//
// A room rectangle says who OWNS ground, not where the world ENDS.
// `groundAt()` cannot answer it — `groundPick` never returns null — so the
// floors come from the scene. See `scripts/lib/floors.mjs`.
// ── RAYCAST, NOT THE AABB BOX. CONVERTED 2026-08-03, ITEM 250 ─────────────
//
// This used to be `makeHasFloor(await sampleFloors(p))` — a bounding-box test
// over meshes that survive a size filter. Item 238 reconciled the two
// predicates over all 731,322 grid cells: they agree 97.37%, and **the
// disagreement is asymmetric in the direction that decides authority** —
// raycast errors are 92.4% sealed inside colliders and harmless, AABB errors
// are 88.4% on OPEN WALKABLE GROUND. An over-claiming floor test reports ground
// where there is none, and for THIS suite — which classifies every interior
// endpoint — that is the false-GREEN direction. 11,948 cells over-claimed.
//
// The real weakness was never boxes-versus-rays. It is the **size filter in
// front of the box, which hides 7,513 of 7,870 meshes**: item 172 gave the park
// relief and its ground plane's world box became 0.653 m against a 0.600 m
// filter — over by 53 mm — so a 32x30 m floor vanished outright and the park
// read 60 escapes / 624 FAIL. On the raycast it is 0 / 544 PASS.
//
// ⚠⚠ **THE QUERY IS ASYNC AND THAT IS THE KILLER — GOTCHAS 90.** `if
// (!hasFloor(x, z))` on a Promise is ALWAYS FALSE, so every check silently
// passes forever, and no self-test can catch it: a check that cannot fail is
// green on a wrong world too. Every call site below is `await`ed, and they were
// found by grepping the USE (`if (hasFloor(`, `!hasFloor(`) and not the name.
const RAY = await installRayFloorQuery(p);
const hasFloor = RAY.query;                      // (x, z, gy) => Promise<boolean>
// AND `sampleFloors` SURVIVES, FOR A QUESTION THAT IS NOT A FLOOR TEST.
//
// The off-belt ceiling derivation (search this file for `const ceil =`) needs
// the floor MESHES — their x/z extents and their y — so it can take the lowest
// slab above head height inside a room's footprint. A point predicate cannot
// answer that, ray or box, because it returns a boolean and not an elevation.
//
// The over-claim item 250 is about does not reach it: this is a `Math.min` over
// slabs, so the AABB size filter can only make it miss one, and missing one is
// caught loudly by the `Number.isFinite(ceil)` check two lines below the use.
// The failure direction here is the safe one. **Do not "finish the conversion"
// by deleting this** — it is not the predicate.
//
// (I found it by running the off-belt room and getting `ReferenceError: FLOORS
// is not defined`. Grepping `hasFloor` by use, as item 250 instructs, does not
// find a second symbol drawn from the same import. Grep the IMPORT LIST too.)
const FLOORS = await sampleFloors(p);
{
  const bad = await selfTestRayQuery(p, hasFloor, RAY.tris);
  if (bad.length) {
    console.log('FLOOR PREDICATE FAILED ITS OWN CONTROLS — nothing measured:\n  ' + bad.join('\n  '));
    await b.close(); process.exit(3);
  }
  console.log(`floor predicate ok (RAYCAST): ${RAY.tris} triangles from ${RAY.meshes} meshes, `
    + `${RAY.buckets} buckets, road solid, off-world void`);
}

// A ROOM MAY DECLARE ITS DOOR BY `face:` AND PUBLISH NO FRONTAGE.
//
// The jail does. Its door is a cut face like the bodega's chamfer, it has no
// `__frontages` entry and no axis extent, so the `front`-tuple path above never
// runs and `doorX` comes out undefined - the suite crashed on `toFixed`.
//
// `doorStandFor()` already answers for these: it reads the declaration in
// ct/doors.ts, which carries the face, and it is the same call the front path
// uses. So a room with no `front` gets its approach from the world's own door
// rather than from a tuple I would otherwise have to hand-write - which is the
// rule that keeps being right tonight: ask what the world publishes.
for (const r of ROOMS) {
  if (r.front || r.doorX !== undefined) continue;
  const nm = (r.id || '').toUpperCase();
  const stand = await p.evaluate(async ([n]) => {
    const dm = await import('/src/proto/ct/doors.ts');
    const s = dm.doorStandFor(n);
    const pt = dm.doorPointFor(n);
    return s ? { x: s.x, z: s.z, at: pt ? pt.x : 0 } : null;
  }, [nm]);
  if (stand) { r.doorX = stand.x; r.doorZ = stand.z; if (r.at === undefined) r.at = 0; }
}


// EVERY ROOM THE WORLD PUBLISHES MUST BE IN `ROOMS`, OR THIS SUITE IS LYING.
//
// `ROOMS` is a hand-written list and the world grows rooms without asking it.
// A new `bank` room landed today and this suite did not test it, did not skip
// it, and did not say so — it simply reported on nine rooms and looked
// complete. That is the same fault as `doorside2.mjs` looping `slab < 8`
// against eight hard-coded names while the world had ten, which quietly
// dropped tax and thrift, and it is the fault the whole GOTCHAS 34 family
// keeps wearing: a check that passes because it never looked.
//
// So the world's own list is the authority and the hand-written one has to
// keep up with it. This cannot be silent, so it exits 2 — "refused to run",
// distinguishable from "ran and found a fault", per lib/flags.mjs.
//
// IT ASKS THE ROOM WHICH LIST IT BELONGS IN, rather than requiring every room
// to be in `ROOMS`. That single `known` set was one question too few and it
// cost the whole suite: `apt301` joined the registry so `seat-facing` could see
// its bed, and because a third-floor flat with no street door is not something
// `ROOMS` can hold, this guard exited 2 for EVERY room — twelve working rooms
// reported as `FAILED (2)` by scripts/checks.mjs on the strength of one room it
// had no way to describe. The guard was right that it could not report on a
// subset; it was wrong that there was only one kind of room.
//
// The teeth are unchanged in both directions, and that is the point: a belt
// room missing from `ROOMS` still exits 2, and an off-belt room missing from
// `OFF_BELT` exits 2 as well. Nothing is waved through — a new room still has
// to be declared somewhere before this suite will run at all.
{
  const known = new Set(ROOMS.map((r) => r.id));
  const knownOff = new Set(OFF_BELT.map((r) => r.id));
  // `d.belt` is published by ct/interior.ts. If it is missing the world is
  // OLDER than this harness, and guessing (`cx >= 400`) would be exactly the
  // hand-typed duplicate of a value the registry owns that §8 of the brief
  // forbids — so say so and refuse, rather than quietly mis-sorting rooms.
  const unsorted = DIMS.filter((d) => typeof d.belt !== 'boolean').map((d) => d.id);
  if (unsorted.length) {
    console.error(`\nthe world does not publish \`belt\` for: ${unsorted.join(', ')}`);
    console.error('this harness needs ct/interior.ts to say which rooms are street-entered slabs');
    console.error('refusing to guess from cx — see the note above OFF_BELT');
    await b.close();
    process.exit(2);
  }
  const missing = DIMS.filter((d) => d.belt && !known.has(d.id)).map((d) => d.id);
  const missingOff = DIMS.filter((d) => !d.belt && !knownOff.has(d.id)).map((d) => d.id);
  if (missing.length || missingOff.length) {
    if (missing.length) {
      console.error(`\nthe world publishes BELT rooms this suite does not test: ${missing.join(', ')}`);
      console.error('add them to ROOMS (with a `keeper` entry, or `keeper: null` if unstaffed)');
    }
    if (missingOff.length) {
      console.error(`\nthe world publishes OFF-BELT rooms this suite does not test: ${missingOff.join(', ')}`);
      console.error('add them to OFF_BELT, naming in `covers` the check that walks their door');
    }
    console.error('refusing to report on a subset and call it the world — see GOTCHAS 34');
    await b.close();
    process.exit(2);
  }
}

// --selftest: wall every declared door shut from the STREET and require this
// to go red.
//
// This is the largest check I own — 195 assertions across eight rooms — and it
// was registered in scripts/checks.mjs with `false` in the selftest column,
// which by GOTCHAS 27's own closing line makes that column a to-do list I had
// not worked. The other five fire; this one had never been watched fail.
//
// The mutation is a collider pushed onto the LIVE __ct.colliders() over each
// building's PUBLISHED door stand point, so it is the real array the movement
// code tests and the real place a player walks to. Nothing else about the
// world changes: the rooms are still built, still furnished, still lit. Only
// the way in is gone — which is precisely the failure this script exists for,
// the one that had five modules shipped and unreachable.
if (SELFTEST) {
  const n = await p.evaluate(() => {
    let k = 0;
    for (const d of window.__ct.doors()) {
      if (!d.stand) continue;
      window.__ct.colliders().push({
        minX: d.stand.x - 1.4, maxX: d.stand.x + 1.4,
        minZ: d.stand.z - 1.4, maxZ: d.stand.z + 1.4 });
      k++;
    }
    return k;
  });
  console.log(`selftest: walled ${n} declared doors shut — this MUST now go red\n`);
  // ── …AND TAKE THE ROOMS' LIGHT AWAY, which the door mutation cannot reach ──
  //
  // Item 192: leg 6 ("the room keeps its own light after dark") was FLAKY and
  // had never been watched go red for the right reason. The door mutation above
  // reddens the entry legs and says nothing about this one, so a rewrite of leg
  // 6 could pass its selftest while measuring nothing at all — GOTCHAS 34, and
  // exactly the trap the flake itself was an instance of.
  //
  // The mutation is the failure leg 6 exists for: the night sweep reaching
  // inside and dimming an interior surface. `ct/props.ts` publishes `addLit`,
  // the one runtime way into the grade, so handing it an interior mesh IS the
  // real path rather than a simulation of one — and the dimmer's own registry
  // then owns the material, which is what leg 6 is looking for.
  // AIMED AT THE ROOMS BEING WALKED, and at the same 8 m box leg 6 samples —
  // a first cut took the first 40 interior meshes it found anywhere past
  // x = 300 and the casino stayed green, because those 40 were in somebody
  // else's room. A mutation that misses the subject is a selftest that passes
  // having broken nothing.
  const lit = await p.evaluate(() => {
    const s = window.__ct.scene();
    const add = s.userData.addLit;
    if (typeof add !== 'function') return -1;
    const centres = window.__ct.roomDims().map((d) => d.cx);
    let k = 0;
    s.traverse((o) => {
      if (!o.isMesh) return;
      const w = new o.position.constructor(); o.getWorldPosition(w);
      if (Math.abs(w.z) > 8) return;
      if (!centres.some((cx) => Math.abs(w.x - cx) <= 8)) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      if (!mats.some((m) => m && m.color && !m.transparent)) return;
      add(o); k++;
    });
    return k;
  });
  console.log(lit < 0
    ? 'selftest: scene.userData.addLit is missing — the light leg was NOT mutated\n'
    : `selftest: handed ${lit} interior meshes to the night dimmer — leg 6 MUST now go red\n`);
}

// ROOMS THAT ACTUALLY GOT WALKED, counted rather than assumed. `results.length`
// cannot answer this: assertions per room vary from 9 to 30-odd, so a run that
// lost five rooms and a run that lost one both just print a smaller number, and
// neither says which. Item 239 asks for legs run against legs REGISTERED, and
// the room is this file's leg.
let roomsWalked = 0;
for (room of rooms) {
  roomsWalked++;
  const built = DIMS.find((d) => d.id === room.id);
  if (!built) { check('the room was actually built', false, 'no room of that id in __ct.roomDims()'); continue; }
  const W = built.w, D = built.d;
  const hw = W / 2, hd = D / 2;
  let cx = 0;   // discovered on entry, below
  // ASK for cz too. It is 0 for every room in the belt today, which is exactly
  // what makes it dangerous to write as a bare `z`: the shortcut is invisibly
  // correct until a room declares otherwise, and `apt301` already does at
  // -16.25. Same argument as `cx` at GOTCHAS 86, one field over.
  const cz = built.cz;

  // ── 1. can you get in AT ALL, and from every direction someone would try ──
  //
  // This is the part the user actually hit: "cant go inside burger barn".
  // A trigger you can only reach from one angle is a trigger that does not
  // work (GOTCHAS §8 — the bodega's crates ate its door exactly this way).
  // Which way the pavement runs depends on which street the door is on. The
  // block's walks run along z; the side street's run along x. Getting this
  // wrong makes the approach tests walk into a wall and report the door
  // broken, which is exactly the wrong answer to give about a working door.
  const off = room.east ? -1.7 : 1.7;         // toward the road from the facade
  const approaches = room.sideStreet
    ? [
      // ON the door line, not offset off it. The side-street walk outside the
      // casino is pinched by a 0.4 m post at (50.0, -97.65): between the post
      // and the shopfront there is 1.15 m, which is 0.43 m of standing room
      // once the 0.72 m player is subtracted. The only continuous lane past it
      // runs at z = -97.0, which is the door line. Offsetting the test lane by
      // 0.3 or 0.75 put it inside the post and read as a broken door.
      ['walking east along the walk', room.doorX - 3.0, room.doorZ, Math.PI / 2],
      ['walking west along the walk', room.doorX + 3.0, room.doorZ, -Math.PI / 2],
      // the side street's north-side shops face -z, so you come at them from
      // the road side walking +z (yaw π), not -z
      ['straight at the door from the kerb', room.doorX, room.doorZ - 1.7, Math.PI],
    ]
    : [
      ['walking north up the walk', room.doorX + off * 0.18, room.doorZ + 3.0, 0],
      ['walking south down the walk', room.doorX + off * 0.18, room.doorZ - 3.0, Math.PI],
      ['straight at the door from the kerb', room.doorX + off, room.doorZ,
        room.east ? Math.PI / 2 : -Math.PI / 2],
    ];
  // Hold for 4 s, not the 1.5 s the walk actually takes. Citizens are SOLID
  // and one of them WILL be standing on this stretch of pavement sooner or
  // later — but `crowd.ts` turns a citizen non-solid once it has blocked you
  // for 1.4 s, so a player who keeps walking always gets through. A shorter
  // hold tests whether a pedestrian happened to be in the way, which is not a
  // question about the door.
  // The prompt is only up while you are within the trigger, and 4 s of walking
  // is 13 m — so this WATCHES for the prompt as it goes rather than reading it
  // at the end, which would just prove you had already walked past the door.
  // Nudge each start point to somewhere you could actually be standing. The
  // street is not empty: a car parked outside the hotel put the "from the
  // kerb" start inside a collider, the player could not take a step, and the
  // test reported a working door as broken. Same lesson as the citizen on the
  // burger barn's pavement — the harness must not assume the world is clear.
  // It backs off ALONG the approach — straight backwards, away from the door —
  // before it will consider stepping sideways, and it never steps sideways far.
  // The first version searched a plain ring and shifted the hotel's start 1.2 m
  // east to dodge the car, which walked the player up a line that never came
  // within the door's 1.05 m trigger: a working door, reported broken, by a
  // fix for the previous false alarm.
  const standableAt = (x, z, yaw) => p.evaluate(([x, z, yaw, R]) => {
    const cols = window.__ct.colliders();
    const free = (a, c) => !cols.some((k) =>
      a > k.minX - R && a < k.maxX + R && c > k.minZ - R && c < k.maxZ + R);
    if (free(x, z)) return { x, z };
    const fx = Math.sin(yaw), fz = -Math.cos(yaw);          // the way we will walk
    for (let back = 0.4; back <= 6; back += 0.4) {
      for (const side of [0, 0.35, -0.35, 0.7, -0.7]) {     // stay near the door's line
        const nx = x - fx * back - fz * side;
        const nz = z - fz * back + fx * side;
        if (free(nx, nz)) return { x: nx, z: nz };
      }
    }
    return { x, z };
  }, [x, z, yaw, RADIUS]);

  // For the head-on approach, back up the door's own normal only as far as
  // there is pavement to stand on. A car is parked right outside the hotel and
  // the strip in front of it is barely a metre deep; starting on the far side
  // of the car and walking at the door just walks into the car, which says
  // nothing about the door. A player would step around onto the pavement, and
  // so does this.
  const backUpTheNormal = (dx, dz, yaw, want) => p.evaluate(([dx, dz, yaw, want, R]) => {
    const cols = window.__ct.colliders();
    const free = (a, c) => !cols.some((k) =>
      a > k.minX - R && a < k.maxX + R && c > k.minZ - R && c < k.maxZ + R);
    const fx = Math.sin(yaw), fz = -Math.cos(yaw);
    let last = null;
    for (let d = 0.45; d <= want; d += 0.15) {
      const x = dx - fx * d, z = dz - fz * d;
      if (!free(x, z)) break;
      last = { x, z };
    }
    return last;
  }, [dx, dz, yaw, want, RADIUS]);

  // Two goes at each approach. Citizens are solid and one that happens to be
  // walking the same way as you never triggers the 1.4 s ghost timer — it just
  // stays a step ahead the whole length of the pavement. A second attempt
  // starts from a different moment in the crowd's cycle, which is enough. The
  // casino's east approach failed this way and its walk is otherwise clear:
  // the only thing on it was one 0.4 x 0.4 box, which is a person.
  for (const [how, sx0, sz0, yaw] of approaches) {
    const headOn = /from the kerb/.test(how);
    const backed = headOn ? await backUpTheNormal(room.doorX, room.doorZ, yaw, 2.6) : null;
    const { x: sx, z: sz } = backed ?? await standableAt(sx0, sz0, yaw);
    await warp(sx, sz, yaw, KERB_H);
    await p.waitForTimeout(160);
    await p.keyboard.down('w');
    let seen = null, at = null;
    for (let t = 0; t < 4000 && !seen; t += 130) {
      await p.waitForTimeout(130);
      const pr = await prompt();
      if (isEntry(room, pr)) { seen = pr; at = await pos(); }
    }
    await p.keyboard.up('w');
    await p.waitForTimeout(120);
    if (!seen) {
      // second go
      await warp(sx, sz, yaw, KERB_H);
      await p.waitForTimeout(200);
      await p.keyboard.down('w');
      for (let t = 0; t < 4000 && !seen; t += 130) {
        await p.waitForTimeout(130);
        const pr = await prompt();
        if (isEntry(room, pr)) { seen = pr; at = await pos(); }
      }
      await p.keyboard.up('w');
      await p.waitForTimeout(120);
    }
    check(`you can reach the door ${how}`, !!seen,
      seen ? `prompt "${seen}" came up at ${at.slice(0, 3).map(f2)}`
        : `walked the whole stretch TWICE and the door never announced itself (ended ${(await pos()).slice(0, 3).map(f2)})`);
  }

  // …and independently of any of that: prove nothing STATIC is sitting on the
  // trigger. This is the bodega bug (GOTCHAS §8) asked directly rather than
  // inferred from a walk that could fail for a dozen reasons.
  const onSpot = await p.evaluate(([x, z]) => {
    const R = 0.36;
    return window.__ct.colliders()
      .filter((c) => {
        // A TURNED collider (`AABB.rot`, fp.ts) keeps its min/max in ITS OWN
        // frame, so the plain world-axis test below is asking about a box that
        // is not there. Put the point in the collider's frame first — the same
        // thing `fp.ts`'s `blocked()` does, and the reason this must match it
        // is that the question here IS "would this stop me standing on the
        // trigger". `rot` absent leaves the arithmetic exactly as it was.
        //
        // Nor is the collider's world AABB good enough as a stand-in: the
        // bodega's chamfer is 45°, and its bounding box covers the whole corner
        // wedge including the pavement the [E] spot stands on. Tested that way
        // this check failed a door you can demonstrably walk to, stand on and
        // open (scripts/probes/w24-bodega-door.mjs).
        let qx = x, qz = z;
        if (c.rot) {
          const cx = (c.minX + c.maxX) / 2, cz = (c.minZ + c.maxZ) / 2;
          const s = Math.sin(c.rot), k = Math.cos(c.rot);
          const dx = x - cx, dz = z - cz;
          qx = cx + dx * k - dz * s; qz = cz + dx * s + dz * k;
        }
        return qx > c.minX - R && qx < c.maxX + R && qz > c.minZ - R && qz < c.maxZ + R;
      })
      .map((c) => ({
        w: +(c.maxX - c.minX).toFixed(2), d: +(c.maxZ - c.minZ).toFixed(2),
        s: `x ${c.minX.toFixed(2)}..${c.maxX.toFixed(2)} z ${c.minZ.toFixed(2)}..${c.maxZ.toFixed(2)}`
          + (c.rot ? ` rot ${c.rot.toFixed(3)}` : ''),
      }));
  }, [room.doorX, room.doorZ]);
  // What counts as "parked on the trigger" is a PROP. Two things are expected
  // to be there and are not defects:
  //   · the building's own facade wall — the [E] spot stands 0.45 m off the
  //     wall face and you reach it from the pavement. Recognised by being
  //     structural: metres long in both directions, not furniture.
  //   · a citizen walking past, which is ~0.5 m square and gone a second later.
  // The first version of this filter recognised the wall by hardcoding the
  // WEST one's coordinates, so the east-side tax office reported its own
  // building as a defect.
  const statics = onSpot.filter((c) => {
    const structural = c.w > 4 || c.d > 4;
    const citizen = c.w > 0.4 && c.w < 0.6 && c.d > 0.4 && c.d < 0.6;
    return !structural && !citizen;
  }).map((c) => c.s);
  check('no static collider is parked on the [E] spot', statics.length === 0,
    statics.length ? statics.join(' | ') : `${onSpot.length} transient (citizen) overlaps, no props`);

  // and the spot really is on the PAINTED door, not merely somewhere near it
  await warp(room.doorX, room.doorZ, -Math.PI / 2, KERB_H);
  await p.waitForTimeout(200);
  check('the [E] prompt is up standing on the painted door',
    isEntry(room, await prompt()),
    `at x=${f2(room.doorX)} z=${f2(room.doorZ)}, declared entry ${JSON.stringify(room.entryLabel)}`);

  await press();
  const inside = await pos();
  // ASK THE ROOM WHERE IT IS. This was
  //
  //     cx = 400 + Math.floor((inside[0] - 400) / 80) * 80 + 40;
  //
  // — the SLAB centre, which was the room centre only while every room was
  // centred in its slab. Item 196's party wall (`PARTY` in `ct/interior.ts`)
  // shoves two rooms to a shared boundary so one opening can be cut through
  // both flank walls, and the hotel now stands at 874.32 in a slab centred on
  // 840. Every leg below that measures "the room" from `cx` was measuring the
  // dead ground beside it — 34.32 m out — and reporting the room broken.
  // GOTCHAS 86.
  //
  // `__ct.roomDims()` publishes `cx`, and this file already holds it: `DIMS` is
  // fetched at :370 and `built` is picked out of it at the top of this loop. So
  // this is not new plumbing, it is using a value already in hand — and it is
  // the same argument `Slab.w`'s docstring makes one field over: *"Two
  // authorings of one number … Published so a harness can ASK."*
  //
  // The slab formula is still true about which SLAB a point is in, so it stays
  // — as the ASSERTION that E landed you in your own room's slab, which is what
  // this check was really for.
  cx = built.cx;
  const slab = 400 + Math.floor((inside[0] - 400) / 80) * 80 + 40;
  check('E puts you inside a room in the interior belt',
    inside[0] >= 400 && Math.abs(inside[0] - cx) < 40,
    `pos=${inside.slice(0, 3).map(f2)} → room centre ${f2(cx)} (slab centre ${slab})`);

  // ── 2. facing and floor ──
  const beforeF = await pos();
  await hold('w', 260);
  const afterF = await pos();
  check('you spawn facing INTO the room, not at the wall you came through',
    afterF[2] < beforeF[2] - 0.05, `forward moved z ${f2(beforeF[2])} → ${f2(afterF[2])}`);
  const gyIn = (await pos())[3];
  // ASK THE PICKER WHAT THE FLOOR IS HERE, do not assume 0.
  //
  // Rooms can have LEVELS now — buildRoom takes a `floor`, so G can build the
  // library's stairs and the church has a chancel step. "Every interior floor
  // is 0" was true when it was written and became a bug the moment a room had
  // a dais: this reported the church sunk on its own altar step, and would have
  // gone red on G's stair the first time they ran it.
  //
  // The question that survives a level change is the one cc2d8bb56 asked of the
  // exterior: does the rig stand where the GROUND says, at the point it is
  // standing? That is true on a flat floor and on the fourth step alike.
  const pIn = await pos();
  const groundIn = await p.evaluate(([x, z]) => window.__ct.groundAt(x, z), [pIn[0], pIn[2]]);
  check('you stand where the floor picker says — not sunk, not floating',
    groundIn !== null && Math.abs(gyIn - groundIn) < 0.001,
    `rig gy=${f2(gyIn)}, groundAt=${groundIn === null ? 'null' : f2(groundIn)}`);
  // gy is what the rig stands ON; prove the floor MESH agrees with it, or you
  // are standing on an invisible plane a few centimetres off the lino.
  const floorY = await p.evaluate((cx) => {
    let best = null;
    window.__ct.scene().traverse((o) => {
      if (!o.isMesh || !o.geometry?.parameters) return;
      const wp = new o.position.constructor();
      o.getWorldPosition(wp);
      if (Math.abs(wp.x - cx) > 0.2 || Math.abs(wp.z) > 0.2) return;
      if (Math.abs(o.rotation.x + Math.PI / 2) > 0.01) return;   // faces up
      if (best === null || wp.y < best) best = wp.y;
    });
    return best;
  }, cx);
  // …and the mesh check has to allow for levels too: it finds the LOWEST floor
  // plane in the slab, which is the nave's, while the rig may legitimately be
  // standing on a dais above it. What it is really guarding is "you are not on
  // an invisible plane a few centimetres off the lino", so it compares against
  // the picker's answer at the rig's own position and only requires the mesh to
  // be at or below that.
  check('the floor mesh is where the rig thinks the floor is',
    floorY !== null && floorY <= gyIn + 0.03 && (gyIn - floorY) < 0.6,
    `lowest floor mesh y=${floorY === null ? 'not found' : f2(floorY)}, rig gy=${f2(gyIn)}`);

  // ── 3. you cannot get out of the room, from ANYWHERE in it ──
  //
  // This replaces four hand-picked wall probes. Those needed a start point
  // that was clear of furniture, which meant knowing the layout — fine for a
  // room you wrote, useless for one you did not: pointed at builder G's
  // casino they started inside a blackjack table and reported the walls
  // broken. Six rooms by three authors and four more coming; the harness has
  // to find its own footing.
  //
  // So: ask the collider list where you can legally stand, take a spread of
  // those points, and run in all four directions from each. The invariant is
  // simply that you are still inside the room afterwards, which is the thing
  // the four probes were circling anyway.
  const standables = await p.evaluate(([cx, cz, hw, hd, R]) => {
    const cols = window.__ct.colliders();
    const free = (x, z) => !cols.some((c) =>
      x > c.minX - R && x < c.maxX + R && z > c.minZ - R && z < c.maxZ + R);
    const out = [];
    for (let z = -hd + R; z <= hd - R; z += 0.45) {
      for (let x = -hw + R; x <= hw - R; x += 0.45) if (free(cx + x, cz + z)) out.push([+x.toFixed(2), +z.toFixed(2)]);
    }
    return out;
  }, [cx, cz, hw, hd, RADIUS]);
  check('there is standable floor in the room at all', standables.length >= 6,
    `${standables.length} clear spots on a 0.45 m grid`);

  // a spread rather than all of them — six runs a room, evenly sampled
  const spread = standables.filter((_, i) => i % Math.max(1, Math.floor(standables.length / 6)) === 0).slice(0, 6);

  // ── CLASSIFY THE ENDPOINT. DO NOT COUNT IT AGAINST A BOX. ────────────────
  //
  // The old test was `|a.x - cx| > hw + 0.23 || |a.z| > hd + 0.23`, and it
  // asked "are you still inside YOUR OWN room" — a question that cannot
  // distinguish LEFT THE WORLD from WALKED NEXT DOOR. Item 196 gave exactly
  // two rooms a doorway to next door, and so exactly two rooms "leaked": the
  // ten scoring 0 were read as proof the check worked, when what they
  // identified was the ten rooms with no party wall.
  //
  // Four outcomes, and only one of them is a defect in the WORLD:
  //
  //   OWN      still inside your own room, tolerance as before
  //   PARTY    inside a room this one is DECLARED joined to — the feature
  //   OTHER    inside a room it is NOT joined to — a real leak, walls missing
  //   FLOORED  no room, but there is ground under you — off the belt entirely
  //   VOID     no room and NO FLOOR — the escape, and the thing that matters
  //
  // MEASURED BEFORE THIS WAS WRITTEN, over all 12 belt rooms, 288 runs
  // (`scripts/probes/w82-classify-belt-endpoints.mjs`):
  //
  //     OWN 287   PARTY 1   OTHER 0   FLOORED 0   VOID 0
  //
  // So OTHER and FLOORED are asserted on rather than tolerated: they do not
  // occur in a sound world, which is what licenses failing on them instead of
  // inventing a threshold. And the escape count this file has been reporting
  // as 1 for the casino is really **0** — nobody has ever left the world here.
  let voids = 0, leaks = 0, party = 0, ranFrom = 0;
  const where = [];
  for (const [lx, lz] of spread) {
    for (const key of ['-x', '+x', '-z', '+z']) {
      await warp(cx + lx, cz + lz, YAW[key], built.y);
      await p.waitForTimeout(90);
      await hold('w', 1800);
      const a = await pos();
      // "Out of the room" is past the OUTER face of the wall (T = 0.18), not
      // past the inner one. The doorway is a real reveal you can stand in —
      // the diner's lets you reach z = 3.28 against an inner face at 3.5 —
      // and calling that an escape fails a room for having a doorway.
      if (inRoom(built, a[0], a[2])) continue;

      const other = DIMS.find((d) => d.id !== built.id && inRoom(d, a[0], a[2]));
      if (other) {
        if (joined(built.id, other.id)) {
          party++;
          where.push(`${key} from local ${f2(lx)},${f2(lz)} → ${other.id} through the party doorway`);
        } else {
          leaks++;
          if (leaks <= 3) check(`walked into ${other.id} going ${key}`, false,
            `from local ${f2(lx)},${f2(lz)} ended at ${f2(a[0])},${f2(a[2])} — `
            + `${built.id} and ${other.id} share no declared party wall, so this is a hole`);
        }
        continue;
      }
      if (await hasFloor(a[0], a[2], a[3])) {          // AWAIT — GOTCHAS 90
        leaks++;
        if (leaks <= 3) check(`walked out of every room going ${key}`, false,
          `from local ${f2(lx)},${f2(lz)} ended at ${f2(a[0])},${f2(a[2])} gy=${f2(a[3])} — `
          + 'on floor, but floor belonging to no room in the registry');
        continue;
      }
      voids++;
      if (voids <= 3) check(`walked OFF THE WORLD going ${key}`, false,
        `from local ${f2(lx)},${f2(lz)} ended at ${f2(a[0])},${f2(a[2])} gy=${f2(a[3])} — no floor mesh under the player`);
    }
    ranFrom++;
  }
  // THE ASSERTION IS THE USER'S, NOT THE RECTANGLE'S: never stand on nothing.
  check('you never walk off the world, from anywhere in the room',
    voids === 0,
    `${ranFrom * 4} runs from ${ranFrom} spread points, ${voids} ended with no floor`
    + (party ? `, ${party} crossed a declared party doorway` : ''));
  // …and the room still has to HOLD you: the only way out is a declared one.
  check('the only way out of the room is a declared doorway',
    leaks === 0,
    leaks ? `${leaks} runs left the room somewhere the world does not declare an opening`
          : `${ranFrom * 4} runs, every endpoint in this room or through a declared opening`
            + (party ? ` (${party} used it: ${where[0]})` : ''));
  // A LEG THAT WALKED NOTHING IS NOT A PASS. Every classification above can
  // shrink the population silently; this is the floor under all of them.
  check('…and it actually walked the room to find that out', ranFrom >= 2,
    `${ranFrom} spread points of ${standables.length} standable spots`);
  // The floor predicate's POSITIVE leg, asked where it will actually be used.
  // Its startup controls are the road and a point past the world clamp — both
  // OUTDOORS. A predicate that could not see interior floors at all would pass
  // those two and then call every endpoint in this room VOID; conversely this
  // is the leg that fails if a room's floor stops being floor-shaped.
  // Hoisted to ONE awaited value. It used to call the predicate twice inline,
  // which under the async query would have handed `check` a Promise (truthy —
  // always green) and then printed a second Promise into the message. GOTCHAS 90.
  const centreFloored = await hasFloor(cx, cz, built.y);
  check('the floor predicate can see this room\'s own floor',
    centreFloored,
    `room centre ${f2(cx)},${f2(cz)} at y=${f2(built.y)} reads ${centreFloored ? 'FLOORED' : 'VOID'}`);

  // the doorway is the one deliberate gap in the collider line, so it gets
  // walked at head-on as well
  // nearest standable spot to the DOORWAY, not merely to its x — picking by x
  // alone can start you at the back of the room behind a counter, walk you two
  // metres into it, and report the door broken.
  // ASK THE ROOM WHERE ITS DOORWAY IS. This computed it as (room.at, hd - 1.3)
  // — the middle of the FRONT WALL — which is right for eight rooms and wrong
  // for any room whose door is in a cut corner. The bodega's belongs in its
  // canted face, and with it there five checks located the door on the wrong
  // wall and reported a correct room as broken. Same fix as the room
  // dimensions, which used to be hand-carried here until a stale `W: 10.0`
  // made this file accuse the pawn shop of leaking: the room states it.
  const DOOR = (built && built.door) || { x: room.at, z: hd, nx: 0, nz: -1 };
  // a stride inside the opening, along its own inward normal
  const inX = DOOR.x + DOOR.nx * 1.3, inZ = DOOR.z + DOOR.nz * 1.3;
  const nearDoor = (lx, lz) => Math.hypot(lx - inX, lz - inZ);
  const doorLane = standables.reduce((best, c) =>
    (best === null || nearDoor(c[0], c[1]) < nearDoor(best[0], best[1]) ? c : best), null);
  if (doorLane) {
    // ALONG the normal from the lane, ACROSS it from the door: project the
    // standable lane onto the normal line through the doorway. On a front wall
    // (n = 0,-1) that is exactly (DOOR.x, lane.z), which is what this did
    // before; on the bodega's cut it slides along the 45 degree face instead of
    // standing at the door's x and the lane's z, which is out in the shop.
    const _d = (doorLane[0] - DOOR.x) * DOOR.nx + (doorLane[1] - DOOR.z) * DOOR.nz;
    await warp(cx + DOOR.x + DOOR.nx * _d, DOOR.z + DOOR.nz * _d,
      // yaw 0 is -z (see ctx.Seat), so facing along the INWARD normal is
      // atan2(nx, nz) — which is Math.PI for a front-wall door, exactly what
      // this warped to before. Negating it turned every room to face the back
      // wall and cost diner 25->20 and thrift 29->24 in one edit.
      Math.atan2(DOOR.nx, DOOR.nz), 0);
    await p.waitForTimeout(150);
    await hold('w', 3000);
    const doorRun = await pos();
    check('you cannot walk out through the doorway onto dead ground',
      doorRun[2] < hd + 0.4, `walking at the door reached z=${f2(doorRun[2])} (front wall at ${f2(hd)})`);
  }

  // ── 4. the room is walkable end to end ──
  //
  // The widest clear run in x that the room has, found rather than declared.
  const lane = await p.evaluate(([cx, hw, hd, R]) => {
    const cols = window.__ct.colliders();
    const free = (x, z) => !cols.some((c) =>
      x > c.minX - R && x < c.maxX + R && z > c.minZ - R && z < c.maxZ + R);
    let best = { z: 0, x0: 0, run: 0 };
    for (let z = -hd + R; z <= hd - R; z += 0.1) {
      let start = null, run = 0;
      for (let x = -hw + R; x <= hw - R; x += 0.1) {
        if (free(cx + x, z)) {
          if (start === null) { start = x; run = 0; }
          run += 0.1;
          if (run > best.run) best = { z: +z.toFixed(2), x0: +start.toFixed(2), run: +run.toFixed(2) };
        } else { start = null; run = 0; }
      }
    }
    return best;
  }, [cx, hw, hd, RADIUS]);
  check('the room has a clear run across most of its width',
    lane.run > W * 0.55, `widest clear run is ${f2(lane.run)} m at local z=${f2(lane.z)} (room is ${f2(W)} wide)`);

  for (const [what, from, yaw] of [
    ['end to end', lane.x0, Math.PI / 2],
    ['…and back the other way', lane.x0 + lane.run, -Math.PI / 2],
  ]) {
    await warp(cx + from, lane.z, yaw, 0);
    await p.waitForTimeout(150);
    const a0 = await pos();
    // long enough for the run that actually exists. A fixed 3.2 s is 10.56 m
    // at the walk speed, so the moment a room got wider than that the test
    // started reporting "blocked" for a player who had simply run out of
    // clock — which is what the burger barn did when the frontage rule took
    // it to 14.8 m.
    await hold('w', Math.round((lane.run / 3.3) * 1000) + 900);
    const a1 = await pos();
    check(`you can walk the room ${what}`, Math.abs(a1[0] - a0[0]) > lane.run * 0.8,
      `travelled ${f2(Math.abs(a1[0] - a0[0]))} m of a ${f2(lane.run)} m run`);
  }

  // ── 4b. the tight aisles, for rooms whose whole brief is being crowded ──
  //
  // "End to end" is satisfied by one clear lane, which is not enough for a
  // room designed to be a squeeze: a shop you can only cross by one route is a
  // corridor. Each declared aisle is walked in full.
  for (const [what, az] of room.aisles ?? []) {
    const half = hw - RADIUS;
    await warp(cx - half, az, Math.PI / 2, 0);
    await p.waitForTimeout(150);
    const a0 = await pos();
    await hold('w', Math.round((half * 2 / 3.3) * 1000) + 900);
    const a1 = await pos();
    check(`you can walk ${what}`, a1[0] - a0[0] > half * 1.5,
      `travelled ${f2(a1[0] - a0[0])} m of ${f2(half * 2)} (want > ${f2(half * 1.5)})`);
  }

  // ── 5. the way out, and NOT straight back in ──
  // start from the standable spot nearest the door and walk at it
  // A DOOR AT 45 DEGREES. Nine rooms have their door in a flat wall, where the
  // inward normal is (0, +-1); the bodega's is in a CUT CORNER, where it is
  // (+-0.707, +-0.707). Both legs below were written for the flat case and are
  // wrong for the cut one — which is what made me switch `door: true` off in
  // ct/int-bodega.ts for days rather than fix six lines of my own harness.
  //
  // The heading. We walk OUTWARD, so d = -n. With yaw 0 = -z the convention is
  // d = (sin y, -cos y), so sin y = -nx and cos y = nz, giving
  //
  //     y = atan2(-nx, nz)
  //
  // For every flat-wall door nx = 0 and atan2(-0, nz) === atan2(0, nz), so
  // this is a NO-OP for the other nine rooms — it cannot repeat the regression
  // that cost diner 25->20 and thrift 29->24. At 45 degrees it flips the x
  // component the old form had backwards, which walked the player diagonally
  // AWAY from the door and then reported the door missing.
  //
  // And the start point: offsetting x by nx*0.9 while taking z from the lane
  // only lands next to the door when nz carries the whole normal. Step off the
  // door along BOTH axes.
  const cut = Math.abs(DOOR.nx) > 0.01 && Math.abs(DOOR.nz) > 0.01;
  await warp(cx + DOOR.x + DOOR.nx * 0.9,
    cut ? built.cz + DOOR.z + DOOR.nz * 0.9 : (doorLane ? doorLane[1] : lane.z),
      approachHeading(DOOR), 0);   // see the banner: never retype this
  await p.waitForTimeout(150);
  // Walk at the door until the way-out prompt is ACTUALLY up, not for 2600 ms
  // and a hope — see `holdUntil`. This does not weaken the assertion: the check
  // below still reads the live prompt and still fails if it never appeared. It
  // only stops the walk from carrying the player back out of the trigger it
  // just entered, which is what made this and the five checks after it fail as
  // a block, one run in four.
  await holdUntil('w', async () => /out to the street/.test((await prompt()) ?? ''), 2600);
  const dPrompt = await prompt();
  check('walking to the inside of the door raises the way-out prompt',
    /out to the street/.test(dPrompt ?? ''), `prompt=${JSON.stringify(dPrompt)}`);

  await press();
  const back = await pos();
  check('E at the inside door puts you back on the street', back[0] < 100,
    `pos=${back.slice(0, 3).map(f2)}`);
  // the corner return RAMPS down to the crossing, so a chamfered door's
  // landing legitimately sits part way between the walk and the road
  check('you land on the raised walk, not in the road',
    room.chamfer ? back[3] > -0.001 : Math.abs(back[3] - KERB_H) < 0.001, `gy=${back[3]}`);
  // NEGATIVE ASSERTION, so it carries its own population floor: if no entry
  // label resolved, `isEntry` is false for everything and this row would go
  // green having measured nothing. `room.entryLabel != null` is what stops it.
  check('you are NOT standing in the re-entry trigger after stepping out',
    room.entryLabel != null && !isEntry(room, await prompt()),
    room.entryLabel == null
      ? `NO entry label resolved for building ${JSON.stringify(room.building)} — nothing was measured`
      : `prompt=${JSON.stringify(await prompt())}`);
  await press();
  check('a second E on the landing does not suck you straight back in',
    (await pos())[0] < 100, `pos=${(await pos()).slice(0, 3).map(f2)}`);

  // …and the same orientation question for the landing: on the block the walk
  // runs along z and the road is across x; on the side street it is the other
  // way round. Testing a side-street landing with block directions just walks
  // it into the shopfront and calls the pavement boxed in.
  const landingDirs = room.sideStreet
    ? [['out to the road', 0], ['east along the walk', Math.PI / 2], ['west along the walk', -Math.PI / 2]]
    : [['out to the road', room.east ? -Math.PI / 2 : Math.PI / 2], ['up the walk', 0], ['down the walk', Math.PI]];
  for (const [what, yaw] of landingDirs) {
    // RETRIED, because the thing in your way may not be part of the building.
    //
    // 2 s rather than 0.5 s was the first fix here: a citizen is solid until it
    // has blocked you for 1.4 s (crowd.ts), and a half-second nudge reported
    // that as boxed-in pavement. It was not enough. This went red on the bodega
    // in a full run — "out to the road, moved 0.18 m" — and the landing is not
    // boxed in at all: eight consecutive attempts walked 2.4–3.6 m off it with
    // ZERO colliders ahead. What blocked that one run was a citizen or a car,
    // and the corner landings face live traffic.
    //
    // Crucially a static pre-check cannot see it: crowd and traffic actors are
    // NOT in `__ct.colliders()`, so "is anything in the way" is unanswerable
    // from the array this script reads. What IS answerable is the question the
    // check actually asks — is this landing SEALED — and a seal does not move.
    // So: up to three attempts, pass on the first that gets away. A real box
    // fails all three; a pedestrian fails at most the one it is standing in.
    let best = 0, a, c;
    for (let attempt = 0; attempt < 3 && best <= 0.9; attempt++) {
      await warp(back[0], back[2], yaw, KERB_H);
      await p.waitForTimeout(attempt ? 700 : 120);   // let a walker clear the landing
      a = await pos();
      await hold('w', 2000);
      c = await pos();
      best = Math.max(best, Math.hypot(c[0] - a[0], c[2] - a[2]));
    }
    check(`the landing is not boxed in — ${what}`, best > 0.9, `moved ${f2(best)} m`);
  }

  // ── 5b. the keeper is looking AT you, not away ──
  //
  // Three builders, one bug: the user found the tax preparer facing his back
  // wall, G found two of their four, I found ALL FOUR of mine — every one the
  // literal `facing: Math.PI`, which is -z, the wall behind their own till.
  //
  // DECODE IS H'S PUBLISHED LAYOUT VIA G (`64c13034`, `notes/H-atlas-facing.md`),
  // not my reading of it. `ct/citizens.ts` puts the column in `map.offset.x` and
  // the MIRROR FLAG in the sign of `map.repeat.x`:
  //
  //     mirror = repeat.x < 0
  //     col    = round(offset.x * 5) - (mirror ? 1 : 0)
  //
  // `[col, mirror]` is a bijection over the eight sectors, so one reading from a
  // known bearing pins the authored facing to ±22.5°. Thresholding `offset.x`
  // alone does NOT: 0.8 is col 4 or col 3 mirrored, same number, two answers.
  // I shipped that version to myself first and it passed with the bug put back.
  //
  // `keeper` IS AUTHORED PER ROOM AND THAT IS DELIBERATE. It is where a PLAYER
  // STANDS TO BE SERVED, which room geometry does not contain — and I proved
  // that by trying twice to derive it.
  //
  // ALL EIGHT ROOMS ARE COVERED, including G's four, and the REASON has changed
  // twice — so here is where it stands rather than what I first believed.
  //
  // I wrote "G's four are covered by G's own harness". That was false at the
  // time: checks-registered reported `G-rooms-walk.mjs` in no tier of
  // `npm run checks`, i.e. running exactly never, so I took their four spots
  // and covered them here. `c7a9a09af` has since REGISTERED it, so the original
  // sentence is true now and my reason for duplicating is gone.
  //
  // Keeping the coverage anyway, for a different and smaller reason: these
  // rooms are already being entered and walked by this file, so the marginal
  // cost is four sprite reads, and the two harnesses agreeing is independent
  // reproduction rather than one author checking their own arithmetic. When
  // they disagreed it was mine that was wrong — my derived viewpoint called G's
  // casino "in profile" — and finding that out cost one run instead of a bug
  // report. Their four spots below are G's OWN, copied from their
  // file rather than derived by me, because the whole lesson of the two failed
  // attempts is that this coordinate belongs to whoever built the room. "Between the keeper and the room centre"
  // reported G's casino as `in profile` when G has verified it reads `facing
  // you`: the dealer stands across the felt. A room with no `keeper` here is
  // SKIPPED rather than guessed at; G's four are covered by G's own harness.
  // GOTCHAS 34, shape two: a room that simply OMITS `keeper` used to be skipped
  // in silence, so a ninth room would arrive unguarded and nothing would say
  // so — a check passing because it found nothing to check, in code written one
  // commit after I hit that exact bug elsewhere in this file ("0/0 passed" for
  // a world with every door sealed).
  //
  // Absent is now a FAILURE. A room with nobody in it is a real possibility, so
  // there is an explicit opt-out — `keeper: null` — which is recorded rather
  // than skipped. The distinction that matters is between "declared unstaffed"
  // and "nobody thought about it", and only one of those should be quiet.
  if (room.keeper === undefined) {
    check('declares where a customer stands (keeper: [x,z], or null if unstaffed)',
      false, 'no `keeper` in the ROOMS entry — the facing check cannot run');
  } else if (room.keeper === null) {
    check('is declared unstaffed', true, 'keeper: null — no facing check, by declaration');
  } else {
    // PREFER A STATION THE WORLD PUBLISHES OVER ONE I TYPED.
    //
    // The bodega's authored station was [3.90, 1.60] — the wall side, where no
    // customer can stand. It was consistent with the keeper standing on the
    // wrong side of his own counter, so the check and the room agreed with
    // each other and both disagreed with the player. It passed for weeks while
    // the user kept filing the fault.
    //
    // A station I authored, checked against a keeper I authored, in a room I
    // authored, agrees with itself whatever the player sees. That is not a
    // test, it is a mirror. So: if the room publishes a spot where a customer
    // is SERVED, stand there instead — the game raises that prompt, so it
    // cannot be wrong about where a customer can be. The authored pair stays
    // as the fallback for rooms that publish nothing, and the run says which
    // source it used so the weak ones are visible rather than silent.
    let [kvx, kvz] = room.keeper;
    let src = 'authored';
    const served = await p.evaluate(([rcx]) => {
      const near = window.__ct.spots()
        .filter((q) => q.x > 400 && Math.abs(q.x - rcx) < 40
          && /buy|order|serve|till|counter/i.test(q.label || ''));
      if (!near.length) return null;
      return [near[0].x, near[0].z, near[0].label];
    }, [cx]);
    if (served) { kvx = served[0] - cx; kvz = served[1]; src = `published: ${served[2]}`; }
    check(`the customer station comes from the world, not from memory`,
      src !== 'authored',
      src === 'authored'
        ? 'no served-spot published in this room — falling back to the AUTHORED pair, '
          + 'which cannot falsify a keeper authored in the same file (see F-keeper-stations-audit.md)'
        : src);
    await warp(cx + kvx, kvz, 0, 0);
    await p.waitForTimeout(150);
    // the sprite picks its column from where the CAMERA is, so it needs frames
    // after the warp — reading immediately gets the view from the last position
    await hold('w', 60);
    await p.waitForTimeout(500);
    const v = await p.evaluate(([sx, sz]) => {
      const sc = window.__ct.scene(); sc.updateMatrixWorld(true);
      let best = null;
      sc.traverse((o) => {
        if (!o.isMesh || o.geometry?.type !== 'PlaneGeometry') return;
        const m = Array.isArray(o.material) ? o.material[0] : o.material;
        if (!m?.map?.image || m.map.image.width !== 160) return;   // the atlas
        const wp = new o.position.constructor(); o.getWorldPosition(wp);
        const d = Math.hypot(wp.x - sx, wp.z - sz);
        if (d > 4 || (best && d >= best.d)) return;
        const mirror = m.map.repeat.x < 0;
        best = { d: +d.toFixed(2), mirror,
          col: Math.round(m.map.offset.x * 5) - (mirror ? 1 : 0), x: wp.x, z: wp.z };
      });
      return best;
    }, [cx + kvx, kvz]);
    const SECTOR = { '0f': 0, '1f': 1, '2f': 2, '3f': 3, '4f': 4, '3t': 5, '2t': 6, '1t': 7 };
    const WHAT = ['facing you', 'three-quarter on', 'in profile', 'three-quarter away',
      'facing away', 'three-quarter away', 'in profile', 'three-quarter on'];
    const sec = v ? SECTOR[`${v.col}${v.mirror ? 't' : 'f'}`] : undefined;
    let detail = 'no atlas figure within 4 m of the customer spot';
    if (sec !== undefined) {
      const a = Math.atan2((cx + kvx) - v.x, kvz - v.z) - sec * Math.PI / 4;
      detail = `col ${v.col}${v.mirror ? ' mirrored' : ''} → sector ${sec}, ${WHAT[sec]}`
        + ` — authored facing ${f2(Math.atan2(Math.sin(a), Math.cos(a)))} rad ±0.39, ${v.d} m away`;
    }
    check('the keeper is looking at you, not away',
      sec === 0 || sec === 1 || sec === 7, detail);
  }

  // ── 5c. the room is still as full as its brief demands ──
  //
  // Only for rooms whose brief named density. G guarded "one lamp out" — the
  // last line of the hotel brief — after finding it unchecked; this is the same
  // move for the line the thrift was rebuilt around. A brief detail nobody
  // checks is a brief detail that quietly comes back out.
  if (room.minMeshes) {
    const n = await p.evaluate(([cx, hw2, hd2]) => {
      let k = 0;
      const V = window.__ct.scene().position.constructor;
      window.__ct.scene().traverse((o) => {
        if (!o.isMesh) return;
        const w = new V(); o.getWorldPosition(w);
        if (Math.abs(w.x - cx) > hw2 + 1 || Math.abs(w.z) > hd2 + 1) return;
        k++;
      });
      return k;
    }, [cx, hw, hd]);
    check('is as full as its brief demands', n >= room.minMeshes,
      `${n} meshes in the room, floor is ${room.minMeshes}`);
  }

  await lightLeg(built);
}

// ── 6. the room keeps its light after dark ──
//
// A FUNCTION, AND NOT INLINE IN THE BELT LOOP, BECAUSE IT WAS SILENTLY SKIPPING
// A ROOM. `apt301` is walked by the off-belt loop below, which never ran this
// leg — and the "NOT APPLICABLE here" line that loop prints, the one this file's
// coverage guard exists to force, does not mention the light. So the flat's
// lighting was neither tested nor declared untested: it was simply absent, which
// is the exact GOTCHAS 34 shape ("a report that reads as though it covered
// something it never looked at") that the rest of this file is careful about.
// Nothing decides it for that room — `door301` covers the door, not the dark.
// `box` is the half-extent sampled around the room centre, and `yMax` the
// height above which meshes are not this room's business. The BELT passes
// neither and gets exactly today's behaviour — 8 x 8, unbounded in y — because
// a room-sized box measurably changes what twelve passing rooms judge (the
// hotel goes 58 -> 39 materials) and this item has no business moving that.
// See `scripts/probes/w82-sample-box-rules.mjs` for the full 13-room table.
async function lightLeg(built, box = { x: 8, z: 8, yMax: Infinity }) {
  const cx = built.cx, cz = built.cz;
  //
  // ⚠ THIS COMPARED BY ARRAY INDEX AND WAS FLAKY, AND A FLAKY CHECK IS WORSE
  // THAN NO CHECK. It returned 109, 109, 110 and then 0 over four runs of the
  // SAME source, and worker sixtyfive very nearly reported the 0 as its own
  // fix. That is GOTCHAS 76 reappearing in this file.
  //
  // Two independent reasons index N was not the same material twice:
  //
  //   · THE ROOM MOVES. The sample is everything within 8 m of the room's
  //     centre, and citizens walk in and out of that box between the two
  //     samples. One extra mesh at the front shifts every index after it, so
  //     the comparison silently pairs a bulb against a coat.
  //   · THE BULBS ANIMATE. The casino's marquee chases on its own clock, so a
  //     lit bulb legitimately differs between two samples taken at the SAME
  //     hour. Nothing about that is the night sweep.
  //
  // So the comparison is BY MATERIAL IDENTITY — three's `uuid`, which is what
  // makes a material the same material — and only over materials present in
  // both samples. A citizen who left the room is not a dimmed surface.
  //
  // AND THE ANIMATED SET IS DERIVED, NOT LISTED. Several samples are taken at
  // each clock time with the clock HELD STILL; a material that is not identical
  // across all of them is moving under its own power and is not judged. No file
  // here has to know which meshes the casino chases, and the exclusion stays
  // correct if somebody animates something new.
  //
  // FOUR SAMPLES AT EACH HOUR, NOT TWO, AND THAT IS MEASURED. The first fix
  // took one extra sample 450 ms after the first and it was STILL flaky — three
  // reds in five runs, always `2/58`, always `0 excluded as self-animating`. Two
  // samples 450 ms apart can land on the same phase of the marquee chase and
  // agree, and the check then judges a bulb that was simply lit at a different
  // moment. Four samples spanning ~1.5 s at each hour catch it: the chase has
  // to be stationary across the whole span to escape, which it is not.
  // ⚠ AND THE SAMPLE BOX ASKED THE ROOM WHERE IT WAS ON ONE AXIS OUT OF THREE.
  //
  // This was `Math.abs(wp.x - cx) > 8 || Math.abs(wp.z) > 8` — cx from the
  // registry, but z against a bare 0 and y not considered at all. True of every
  // room in the belt, and false of the one room that is not: `apt301` sits at
  // cz -16.25, three storeys up at y 5.40. Measured
  // (`scripts/probes/w82-party-and-apt301-sampler.mjs`):
  //
  //     as written (|z| < 8 about z = 0)   1 mesh,   2 materials
  //     asking the room for cz           436 meshes, 156 materials
  //     …and its storey too              344 meshes, 130 materials
  //
  // One mesh. The single thing inside that box is an unnamed plane at y 5.33 —
  // the flat's own floor slab, caught by its width — and everything the leg
  // exists to judge was outside it. This is GOTCHAS 86 one field over, and the
  // same shape as `cx` before item 192: the shortcut is invisibly correct until
  // a room declines to sit where it was assumed to.
  //
  // AND THERE IS DELIBERATELY NO y BOUND, WHICH I TRIED FIRST AND MEASURED OUT.
  //
  // A storey bound looks obviously right — 301's own ±8 m box takes in the flats
  // above and below it — and there is no constant that does not break something
  // else (`scripts/probes/w82-storey-extent.mjs`, mesh origins relative to each
  // room's own floor):
  //
  //     ten belt rooms   0.00 .. +3.60      church  0.01 .. +9.50
  //     library          0.00 .. +6.40      apt301  -7.90 .. +5.25
  //
  // Any bound tight enough to isolate one flat of a 2.7 m stack throws away the
  // church's nave and the library's upper floor, reddening or hollowing two
  // rooms that are fine today to sharpen a third. And the cost of NOT bounding
  // is small in a way the cost of bounding is not: this leg asserts that no
  // interior material dims after dark, so judging the neighbouring flats'
  // materials too BROADENS the population rather than corrupting it — they are
  // interior materials and they must not dim either.
  //
  // The principled fix is for `RoomDims` to publish the room's height, the same
  // way item 192 made it publish `cx`. That is a change to `ct/interior.ts`,
  // which item 226 does not name — filed for the desk (BUILDER-BRIEF §9).
  const sample = () => p.evaluate(([cx, cz, bx, bz, yMax]) => {
    const out = {};
    window.__ct.scene().traverse((o) => {
      if (!o.isMesh) return;
      const wp = new o.position.constructor();
      o.getWorldPosition(wp);
      if (Math.abs(wp.x - cx) > bx || Math.abs(wp.z - cz) > bz) return;
      if (wp.y > yMax) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) if (m && m.color && !m.transparent) out[m.uuid] = m.color.getHex();
    });
    return out;
  }, [cx, cz, box.x, box.z, box.yMax]);
  /** four samples with the clock held at `h`, and the set that never moved */
  const steadyAt = async (h, settle) => {
    await p.evaluate((hh) => window.__ct.clock(hh, 0), h);
    await p.waitForTimeout(settle);
    const shots = [];
    for (let i = 0; i < 4; i++) {
      shots.push(await sample());
      if (i < 3) await p.waitForTimeout(500);
    }
    const steady = {}, moved = new Set();
    for (const u of Object.keys(shots[0])) {
      if (shots.every((s) => s[u] === shots[0][u])) steady[u] = shots[0][u];
      else moved.add(u);
    }
    return { steady, moved };
  };
  const day = await steadyAt(12, 500);
  const dark = await steadyAt(2, 900);
  // Judged: present and STEADY at both hours. Anything that moved at either
  // hour is animating, and anything missing from one is a citizen who walked.
  const judged = Object.keys(day.steady).filter((u) => dark.steady[u] !== undefined);
  const dimmed = judged.filter((u) => dark.steady[u] !== day.steady[u]).length;
  const animated = new Set([...day.moved, ...dark.moved]);
  check('the room keeps its own light after dark', dimmed === 0,
    `${dimmed}/${judged.length} interior materials dimmed by the night sweep`
    + ` (${animated.size} excluded as self-animating,`
    + ` ${Object.keys(day.steady).length - judged.length} not steady at both hours)`);
  // AND IT MUST HAVE JUDGED SOMETHING. Every exclusion above is a way for the
  // population to shrink, and a leg that passes on an empty set is the failure
  // this whole row is about — GOTCHAS 34. The floor is a fraction of what was
  // actually there rather than a typed count, so it scales with the room.
  const seen = Object.keys(day.steady).length + animated.size;
  check('…and it judged enough of the room to mean anything',
    judged.length >= Math.max(8, Math.round(seen * 0.5)),
    `judged ${judged.length} of the ${seen} materials sampled in the room`);
  await p.evaluate(() => window.__ct.clock(13, 20));
}


// ── OFF-BELT ROOMS ─────────────────────────────────────────────────────────
//
// The legs above cannot run here (see the note above `OFF_BELT`), but "cannot
// walk it the way I walk the twelve" is not the same as "cannot walk it". What
// IS decidable about a room off the belt is the part that has nothing to do
// with doors: was it built, is its floor where the picker says it is, is there
// anywhere to stand, and can you cross it. Those are exactly the questions the
// walk-up's third floor was never asked — `scripts/seat-facing.mjs` only got
// the room's dimensions, and nothing has ever put a rig inside it and walked.
//
// EVERY WARP HERE PASSES `built.y`, NOT 0. That is the whole reason `RoomDims.y`
// exists: `ct/interior.ts` records that bugsweep's three `bug-apt301-*` stations
// passed `verifyLanded` — which only checks x and z — while standing at street
// level and photographing the OUTSIDE of the building. A harness that hardcodes
// gy 0 here does not test this room, it tests the pavement under it.
for (const spec of offBelt) {
  roomsWalked++;
  room = spec;
  const built = DIMS.find((d) => d.id === spec.id);
  check('the room was actually built', !!built, built ? `w=${f2(built.w)} d=${f2(built.d)} y=${f2(built.y)}` : 'no room of that id in __ct.roomDims()');
  if (!built) continue;
  const { cx, cz, y: gy } = built;
  const hw = built.w / 2, hd = built.d / 2;

  // ── does the floor picker agree with where the rig stands, three floors up ──
  await warp(cx, cz, 0, gy);
  await p.waitForTimeout(200);
  const at = await pos();
  const ground = await p.evaluate(([x, z]) => window.__ct.groundAt(x, z), [at[0], at[2]]);
  check('you stand where the floor picker says — not sunk, not floating',
    ground !== null && Math.abs(at[3] - ground) < 0.001,
    `rig gy=${f2(at[3])}, groundAt=${ground === null ? 'null' : f2(ground)} (room floor y=${f2(gy)})`);
  // …and that it is THIS room's floor and not the pavement three storeys below,
  // which is the exact failure RoomDims.y was published to stop.
  // AGAINST `built.y`, THE PUBLISHED VALUE — never against the local `gy` this
  // function warps with. Those are the same number today and that is exactly
  // what makes the distinction easy to lose: written as `at[3] - gy` this leg
  // compares the harness's own input to itself, so it holds whatever the
  // harness happens to be doing and can never fail. Caught by mutation:
  // replacing `const { y: gy } = built` with `gy = 0` — the precise bug
  // `RoomDims.y` was published to stop, and the one bugsweep's three
  // `bug-apt301-*` stations shipped for weeks — left this reporting
  // "rig gy=0, room floor y=0" and passing 6/6, standing in the street under
  // the building it claimed to be inside. Reading the room's own y back from
  // the registry is what makes the mutation go red.
  check('the floor you are standing on is the room\'s own, not the street',
    Math.abs(at[3] - built.y) < 0.05, `rig gy=${f2(at[3])}, room's published floor y=${f2(built.y)}`);

  // ── is there floor to stand on, and can you cross it ──
  //
  // Same grid as the belt rooms', but around the room's OWN centre on both
  // axes. The belt version writes bare `z` because every slab has cz 0; this
  // room's cz is -16.25 and that shortcut would sample the street outside.
  const standables = await p.evaluate(([cx, cz, hw, hd, R]) => {
    const cols = window.__ct.colliders();
    const free = (x, z) => !cols.some((c) =>
      x > c.minX - R && x < c.maxX + R && z > c.minZ - R && z < c.maxZ + R);
    const out = [];
    for (let z = -hd + R; z <= hd - R; z += 0.3) {
      for (let x = -hw + R; x <= hw - R; x += 0.3) if (free(cx + x, cz + z)) out.push([+x.toFixed(2), +z.toFixed(2)]);
    }
    return out;
  }, [cx, cz, hw, hd, RADIUS]);
  check('there is standable floor in the room at all', standables.length >= 6,
    `${standables.length} clear spots on a 0.3 m grid in a ${f2(built.w)} x ${f2(built.d)} room`);

  // The widest clear run in x, found rather than declared — the same question
  // the belt asks, at the same 0.1 m resolution.
  const lane = await p.evaluate(([cx, cz, hw, hd, R]) => {
    const cols = window.__ct.colliders();
    const free = (x, z) => !cols.some((c) =>
      x > c.minX - R && x < c.maxX + R && z > c.minZ - R && z < c.maxZ + R);
    let best = { z: 0, x0: 0, run: 0 };
    for (let z = -hd + R; z <= hd - R; z += 0.1) {
      let start = null, run = 0;
      for (let x = -hw + R; x <= hw - R; x += 0.1) {
        if (free(cx + x, cz + z)) {
          if (start === null) { start = x; run = 0; }
          run += 0.1;
          if (run > best.run) best = { z: +z.toFixed(2), x0: +start.toFixed(2), run: +run.toFixed(2) };
        } else { start = null; run = 0; }
      }
    }
    return best;
  }, [cx, cz, hw, hd, RADIUS]);
  // The player's own diameter, which is the only non-arbitrary floor for "can a
  // person be in here": 2 * RADIUS = 0.72 m. The belt's `W * 0.55` is a
  // proportion of a shop's frontage and means nothing in a 3 m bedroom.
  check('there is a clear run a player actually fits down',
    lane.run > RADIUS * 2, `widest clear run is ${f2(lane.run)} m at local z=${f2(lane.z)} (player is ${f2(RADIUS * 2)} wide)`);

  // …and WALK it, because a gap in the collider list is not the same as a lane
  // the movement code will carry you down (the whole premise of this file).
  //
  // MEASURED AS ARRIVAL AT THE FAR END, NOT AS DISTANCE TRAVELLED — and that
  // distinction is not pedantry here, it is the difference between testing this
  // room and testing the landing outside it. The belt's version asks for
  // `travelled > run * 0.8`, which is safe in a shop because the doorway is a
  // dead reveal you cannot walk through. 301's door is a REAL door onto a REAL
  // landing, and in a room only 3.06 m wide the widest clear lane is the one
  // straight through it: the lane comes out at local z -0.22 and the doorway is
  // at local z -0.25, the same band. First version of this leg reported
  // "travelled 4.43 m of a 2.20 m run" and passed — the rig had crossed the
  // room, carried on out of the door and was 3.44 m local when it stopped, one
  // and a half room-widths past the far wall (scripts/probes/
  // w32-apt301-lane-overshoot.mjs; gy stays 5.40 throughout, so it is the
  // landing, not a fall, and not a wall clip).
  //
  // A distance test that a doorway can inflate is a test the room can fail
  // while it passes. Arrival at `x0 + run` — a point that is INSIDE the room,
  // because the lane search is clipped to the walls — cannot be reached without
  // actually crossing the floor.
  if (lane.run > RADIUS * 2) {
    await warp(cx + lane.x0, cz + lane.z, Math.PI / 2, gy);
    await p.waitForTimeout(150);
    const a0 = await pos();
    await hold('w', Math.round((lane.run / 3.3) * 1000) + 900);
    const a1 = await pos();
    const farEnd = lane.x0 + lane.run;          // local x, inside the room
    const gotTo = a1[0] - cx;                   // local x reached
    check('you can walk the room end to end',
      gotTo >= farEnd - 0.1,
      `started local x=${f2(a0[0] - cx)}, reached ${f2(gotTo)}, far end of the lane is ${f2(farEnd)}`
        + (gotTo > hw ? ` (and kept going out of the doorway to ${f2(gotTo)} — the flat's door is a real one)` : ''));
  }

  // ── the room keeps its light after dark, HERE TOO ──
  //
  // This leg used to be inline in the belt loop and so never ran for this room,
  // and the not-applicable line below did not name it either — so the flat's
  // lighting was neither tested nor declared untested. It IS decidable here.
  //
  // BUT NOT WITH THE BELT'S SAMPLE BOX, AND FINDING THAT OUT IS MOST OF THIS.
  // The belt samples a fixed ±8 m, which is about room-sized for a shop and
  // FIVE TIMES this room: 301 is 3.06 x 3.36. Run with the belt's box the leg
  // reported `1/156 materials dimmed`, and the offender
  // (`scripts/probes/w82-which-material-dims.mjs`) is at y 8.23 — **2.83 m
  // above this flat's floor, and 12 cm above the floor slab at 8.11 that is the
  // next storey.** It is in 302. Reporting it against 301 would be reporting a
  // room as defective on evidence about the one above it.
  //
  // So the box is DERIVED from the room instead of typed:
  //
  //   x/z  the room's own half-extent plus a wall, capped at the belt's 8 so
  //        no room can lose coverage it has today
  //   y    the lowest floor-shaped mesh above HEAD height in this room's
  //        footprint — for a stacked building that is the ceiling, and the
  //        1.6 m cut is what stops a table or a counter qualifying (the casino
  //        has floor-shaped meshes at 0.83 m; bounding a belt room this way
  //        would clip it at knee height, which is why this is off-belt only)
  //
  // A single hardcoded storey height would have been wrong in both directions:
  // tight enough to isolate one flat of a 2.7 m stack, it throws away the
  // church's nave at +9.50 and the library's upper floor at +6.40
  // (`scripts/probes/w82-storey-extent.mjs`).
  const ceil = FLOORS
    .filter((fl) => fl.maxX >= cx - hw && fl.minX <= cx + hw
                 && fl.maxZ >= cz - hd && fl.minZ <= cz + hd
                 && fl.y > gy + 1.6)
    .reduce((lo, fl) => Math.min(lo, fl.y), Infinity);
  check('the room\'s own ceiling is derivable, so the light leg can be scoped to it',
    Number.isFinite(ceil),
    Number.isFinite(ceil)
      ? `lowest floor-shaped mesh above head height in this footprint is y=${f2(ceil)} (floor ${f2(gy)})`
      : 'no slab above head height — cannot tell this room from the one above it');
  // NO MARGIN ON x/z, AND THAT IS THE POINT. A first cut allowed the room's
  // half-extent PLUS 0.5 m for the wall, and the leg then judged a box at
  // x 200.25 — 1.85 m from a centre in a room 1.53 m to its own wall, so
  // 0.32 m OUTSIDE the flat, on the landing. The margin was mine; the extent is
  // the room's. `w`/`d` are the resolved, published footprint (`Slab.w`'s
  // docstring: *"Published so a harness can ASK"*), so ask for exactly that and
  // stop inventing tolerances the room did not declare.
  await lightLeg(built, {
    x: Math.min(8, built.w / 2),
    z: Math.min(8, built.d / 2),
    yMax: Number.isFinite(ceil) ? ceil : Infinity,
  });

  // ── and SAY what was not asked, rather than looking complete ──
  //
  // GOTCHAS 34 is not only about rooms that go untested; it is about a report
  // that reads as though it covered something it never looked at. These legs
  // are genuinely undecidable here, so they are named, with the check that does
  // decide them.
  console.log(`\n  ${spec.id}: NOT APPLICABLE here — street approach, [E] entry, way-out prompt,`);
  console.log(`  kerb landing, keeper facing. It has no street door; \`${spec.covers}\` walks its door.\n`);
}

console.log('');
for (const [ok, name, detail] of results) console.log(`${ok ? ' ok ' : 'FAIL'}  ${name}\n        ${detail}`);
const bad = results.filter((r) => !r[0]).length;
console.log(`\n${results.length - bad}/${results.length} passed`);
// AN EMPTY RUN IS NOT A PASS.
//
// This printed "0/0 passed" and exited 0 when it walked no rooms at all —
// found while writing the selftest, whose flag the positional filter had
// swallowed. The same green would have come back from a typo'd room name, and
// from a world where every door had been sealed: the more completely broken
// the world, the fewer assertions run, and at total failure the count reaches
// zero and the check reports success.
//
// That is the worst shape a check can have, and it is the one this script was
// written to catch in the WORLD — five modules shipped unreachable because
// nothing asked. It should not have had it too.
if (!results.length) {
  console.log('NO CHECKS RAN AT ALL. That is a failure, not a pass — the harness');
  console.log('never reached a room. Expected ' + (rooms.length + offBelt.length) + ' room(s).');
  process.exit(1);
}
if (errs.length) console.log('\npage errors / kit warnings:\n  ' + errs.slice(0, 8).join('\n  '));

// ── DID THE WORLD OUTLIVE THE RUN? (item 239) ──────────────────────────────
//
// THE FLOOR ABOVE RUNS AT THE START AND THIS FILE IS THE REASON THAT IS NOT
// ENOUGH. Its own author wrote the row: *"my dev server was killed mid-run by
// something outside this worktree, and the suite kept going against the page it
// had already loaded… I only did so because I happened to notice the
// notification"* (`notes/w82-item226-containment-classified.md`). The floor
// counted 359 floor meshes at room 0 and was right to; the server died at room 7.
//
// It cannot see it BY CONSTRUCTION. There is exactly one `p.goto` in this file,
// at the top, and 369 assertions after it are `p.evaluate` against a world that
// now lives in the browser. Kill the server and the page keeps answering — every
// remaining leg passes, and the report is full, confident and about nothing.
//
// So ask at the END, and ask both halves: is the server still there, and did all
// 13 rooms actually get walked. The liveness answer is `lib/server-state.mjs`'s,
// not a fourth one invented here.
const liveness = await reportEndOfRun(aim('http://localhost:4185/'), {
  ran: roomsWalked, registered: rooms.length + offBelt.length, leg: 'room',
});
await b.close();
// A red outranks an unmeasured: `bad` means this run FOUND something, and a
// finding survives the server dying afterwards. 3 rather than 1 when there is no
// finding — GOTCHAS 32, "measured, and it is WRONG" is not what happened here.
process.exit(bad || errs.length ? 1 : liveness);
