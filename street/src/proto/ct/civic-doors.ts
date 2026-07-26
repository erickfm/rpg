// A flight of steps that leads to nothing.
//
// NAMED `civic-doors.ts`, NOT `int-civic.ts`. It was the latter for one commit,
// and scripts/world-wired.mjs was right to go red at it: `ct/int-*.ts` means
// "an interior room you can walk into", and this registers no room — it is the
// answer for a door with NO room behind it. The prefix is a contract with the
// check, and I took it because the file felt interior-adjacent. GOTCHAS 24
// says the same thing about scripts: name a thing for what it is, not for the
// subject it stands near.
//
// The user, about the civic buildings: *"Do NOT leave a flight of steps that
// leads to nothing."* Both civic flights climb now — the library reaches its
// doors, the church stops 0.44 m short inside a collider that is not mine —
// and at the top of each there is no `[E]` and no room. You walk up, you stand
// at a pair of doors, and the world has nothing to say.
//
// This is not a content gap, it is the interior kit's DEGENERATE CASE. The kit
// owns "door → room". A door with no room behind it is still the kit's to
// answer for, and the honest answer is a locked door: a climb that ends in a
// response is a climb that meant something, a climb that ends in silence is a
// bug the player cannot distinguish from an unfinished build.
//
// So: no new rooms. The two civic doors get a locked-door response, and the
// day builder E lands the library interior it takes the door over — see
// `claimed()` below, which is why that handover needs no coordination.
//
// ── why this file scans instead of typing coordinates ────────────────────
//
// notes/AUDIT-INSTRUMENTS.md, on twenty-odd probes' worth of hindsight:
// *"Every probe that tried to infer what a thing is from its shape has
// eventually been wrong… prefer a probe that asks over a probe that guesses."*
// The queue's own history says the same about world-building: the diner's
// prompt sat on the bank, the tax office's beside its door, and the thrift's
// spot survived me moving its building onto the park — all of them hand-typed
// coordinates that were right when written.
//
// The one thing I refuse to type here is therefore WHERE THE DOORS ARE. A
// flight of steps is already a declaration: it is a raised patch of ground
// that somebody built to be climbed. So this asks the ground picker for the
// raised patches, and the top of each patch IS the landing, and the far edge
// of the landing from the street IS the doorway. If E rebuilds the library
// steps a metre north, this follows them with no edit.
import { BUILD, type CtxBuild } from './ctx';
import { courtGround } from './civic';
import { interiorRoomIds } from './interior';

/** after the rooms, so `claimed()` can see which buildings actually got one */
export const ORDER = BUILD.INTERIOR + 1;

/**
 * The one authored thing in this file: what to CALL the two civic buildings.
 *
 * Everything else — where the doors are, which way they face, how far back you
 * stand — is measured off the world at build time. A name cannot be measured;
 * the library's is engraved on its frieze as `PUBLIC LIBRARY` and the church
 * carries no lettering at all.
 *
 * Keyed by which side of the street the flight is on, because that is the one
 * fact about a civic building that its own geometry states. A third civic
 * flight appearing on either side gets the name of its side; a flight
 * somewhere unexpected still gets the generic response, which is the point —
 * the failure mode is a slightly vague prompt, never silence.
 */
const CIVIC: Record<'west' | 'east', { name: string; shut: string }> = {
  west: { name: 'the PUBLIC LIBRARY', shut: 'closed — opening hours are on the board' },
  east: { name: 'the church', shut: 'locked' },
};

/** the street runs up the middle; a patch is west or east of it */
const sideOf = (x: number): 'west' | 'east' => (x < 0 ? 'west' : 'east');

/** how long the response stays up after you try the handle */
const RESPONSE_MS = 2600;

/**
 * Has a real room claimed this door?
 *
 * The kit parks every interior in the belt out along +x and gives each a room
 * id. When E's library interior lands it will register one, and this stops
 * offering a locked door for a building you can now walk into — WITHOUT E
 * having to know this file exists.
 *
 * That matters more than it looks. Nine times on this project a builder has
 * finished something that could not reach the world because the last line
 * lived in a file they did not own. This is the same hazard pointed the other
 * way: a placeholder that outlives the thing it stood in for. Making the
 * handover automatic is the only version that cannot be forgotten.
 */
function claimed(name: string): boolean {
  const key = name.replace(/^the /, '').toUpperCase();
  return interiorRoomIds().some((id) => id.toUpperCase().includes(key.split(' ').pop() ?? key));
}

/**
 * Find every raised patch of civic ground, by asking rather than by knowing.
 *
 * Walks a grid over the civic side of the block and keeps the cells the ground
 * picker answers ABOVE the pavement. Cells are then clustered by adjacency, so
 * two separate flights come back as two patches without this function being
 * told how many there are or where.
 */
function raisedPatches(kerbY: number) {
  const STEP = 0.25, LIFT = 0.06;
  const cells: { x: number; z: number; y: number }[] = [];
  for (let x = -24; x <= 24; x += STEP) {
    for (let z = -110; z <= 4; z += STEP) {
      const g = courtGround(x, z);
      if (g != null && g > kerbY + LIFT) cells.push({ x, z, y: g });
    }
  }
  // cluster by adjacency — one pass, since a flight is a compact blob
  const patches: { x: number; z: number; y: number }[][] = [];
  for (const c of cells) {
    const hit = patches.find((p) =>
      p.some((q) => Math.abs(q.x - c.x) <= STEP * 1.5 && Math.abs(q.z - c.z) <= STEP * 1.5));
    if (hit) hit.push(c); else patches.push([c]);
  }
  // a flight is a landing, not a single tread: ignore specks
  return patches.filter((p) => p.length >= 16).map((p) => {
    const top = Math.max(...p.map((c) => c.y));
    const landing = p.filter((c) => c.y > top - 0.01);
    const cz = landing.reduce((a, c) => a + c.z, 0) / landing.length;
    const west = sideOf(landing[0].x) === 'west';
    // the doorway is the far edge of the landing FROM THE STREET, which is the
    // direction you were walking when you ran out of steps
    const doorX = west ? Math.min(...landing.map((c) => c.x)) : Math.max(...landing.map((c) => c.x));
    return { doorX, cz, top, side: sideOf(doorX), cells: landing.length };
  });
}

export function register(ctx: CtxBuild): void {
  const patches = raisedPatches(ctx.KERB_H);
  for (const p of patches) {
    const who = CIVIC[p.side];
    if (claimed(who.name)) continue;                    // a real room took this door
    // stand off the doors the same 0.75 m every declared door uses, so the
    // civic doors behave like every shopfront rather than like a special case
    const sx = p.doorX + (p.side === 'west' ? 0.75 : -0.75);
    // -Infinity, not 0: `performance.now()` is small for the first few seconds
    // of a page, so 0 reads as "pressed just now" and the door announced
    // itself locked before anyone had touched it.
    let tried = -Infinity;
    ctx.spot({
      x: sx, z: p.cz, r: 1.2,
      // Only live once you are actually UP the steps. Without this the prompt
      // reads through the flight from the pavement below, which would put a
      // locked-door message on a building you are nowhere near — the same
      // "fires from the wrong place" defect the diner prompt had on the bank.
      ok: () => ctx.player.gy() > p.top - 0.4,
      label: () => (performance.now() - tried < RESPONSE_MS
        ? `${who.name} is ${who.shut}`
        : `try the doors of ${who.name}`),
      act: () => { tried = performance.now(); },
    });
  }
}
