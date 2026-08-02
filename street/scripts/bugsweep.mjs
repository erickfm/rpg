// Diligent graphical-bug sweep: walk the whole world, many angles.
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + String(e.message)));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
await page.goto(aim('http://localhost:4177/'), { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 10000 });
await reportWorld(page, aim('http://localhost:4177/'));   // GOTCHAS 26: prove it, do not just name it
await page.waitForTimeout(700);

const shots = [];
// `args`, when given, is passed through to page.evaluate. Playwright
// stringifies `fn` and re-injects it into the browser, so a closure over an
// outer Node variable comes back empty there — every station computed below
// from the room/site registries goes through `args` for exactly that reason.
// The original 48 stations don't need it: they only ever close over literals.
const shot = async (name, fn, wait = 320, args) => {
  await page.evaluate(fn, args);
  await page.waitForTimeout(wait);
  const p = `shots/bug-${name}.png`;
  await page.screenshot({ path: p });
  shots.push(p);
};

// Camera yaw that makes the player FACE from one point toward another.
// GOTCHAS §33: a mesh at rotation.y=t faces (sin t, cos t); the player/camera
// at yaw t faces (sin t, -cos t) instead. Solving forward=(dx,dz) for t gives
// atan2(dx, -dz) — the camera convention, not the mesh one.
const faceTo = (from, to) => Math.atan2(to.x - from.x, -(to.z - from.z));

// Confirm a warp actually landed near where it was aimed, and say so if not.
// fp.ts's own `unstick()` will, after ~0.45s of finding no way out of a
// collider, give up and revert the WHOLE move to the last legal position —
// found live, on the jail site: a giant collider swallows most of its yard,
// so warping there put the camera back at the car lot (the previous shot's
// spot) instead, and the screenshot came out labelled bug-jail-overview.png
// while showing the lot. A file that photographs the wrong thing under the
// right name is worse than a missing one — GOTCHAS §20, "an unread screenshot
// is not an observation" — so every dynamically-aimed station checks its own
// landing and the sweep says so in its error output rather than staying quiet.
//
// AND IT MUST CHECK THE FLOOR, NOT ONLY THE MAP REFERENCE. This function
// compared x and z only, and that is exactly how the apartment went a whole
// release photographing the OUTSIDE of its own building while reporting
// success: the three `bug-apt301-*` stations landed on the right x and z —
// three storeys below the flat — and passed. A station can be dead right on
// the map and in the wrong world vertically. `__ct.pos()` returns
// `[x, y, z, gy]`, so the floor the storey picker settled on is `p[3]`, and
// `y` here is the floor the station ASKED for.
const verifyLanded = async (name, x, z, tol = 3.0, y = null) => {
  const p = await page.evaluate(() => window.__ct.pos());
  const d = Math.hypot(p[0] - x, p[2] - z);
  if (d > tol) {
    errors.push(`STATION MISS: ${name} aimed at (${x.toFixed(1)}, ${z.toFixed(1)}) but the ` +
      `player is at (${p[0].toFixed(1)}, ${p[2].toFixed(1)}), ${d.toFixed(1)} m away — the ` +
      `shot almost certainly captured the WRONG place, likely because the target is inside ` +
      `a collider the player could not be placed in (fp.ts unstick() reverts on a ~0.45s timeout)`);
  }
  // 0.6 m is ct/apartment.ts's own "no stepping up half a storey" limit, so
  // anything past it is a DIFFERENT floor rather than a step or a kerb.
  if (y !== null && Math.abs(p[3] - y) > 0.6) {
    errors.push(`STATION MISS: ${name} aimed at floor y=${y.toFixed(2)} but the player ` +
      `settled on y=${p[3].toFixed(2)} — right x/z, WRONG STOREY, so the shot is of ` +
      `whatever is at that map reference on another floor (this is how apt301 was ` +
      `photographed from the street for a whole release)`);
  }
};

// daytime, clear (find a non-rainy hour = noon-ish; 12 → hash check)
await page.evaluate(() => window.__ct.clock(13, 0));

// ── walk the main street, both directions ───────────────────────────────
await shot('street-spawn', () => window.__ct.warp(0, 8, Math.PI, 0, 0));          // looking down the street from spawn
await shot('street-north', () => window.__ct.warp(-1, -20, 0, 0, 0.02));          // looking back north
await shot('street-mid-w', () => window.__ct.warp(2, -25, -Math.PI/2, 0, 0));     // west facades
await shot('street-mid-e', () => window.__ct.warp(-2, -25, Math.PI/2, 0, 0));     // east facades
await shot('street-mid-w2', () => window.__ct.warp(2, -55, -Math.PI/2, 0, 0));
await shot('street-mid-e2', () => window.__ct.warp(-2, -55, Math.PI/2, 0, 0));
await shot('street-far-w', () => window.__ct.warp(2, -80, -Math.PI/2, 0, 0));
await shot('street-far-e', () => window.__ct.warp(-2, -80, Math.PI/2, 0, 0));
await shot('street-down', () => window.__ct.warp(-1, -10, Math.PI, 0, 0));        // down the length
await shot('street-updown', () => window.__ct.warp(-1, -70, 0, 0, 0));            // up the length

// ── trees & sidewalk grid (walkability/fitting) ─────────────────────────
await shot('tree-w1', () => window.__ct.warp(4.5, -18, -Math.PI/2, 0, 0.1));
await shot('tree-e1', () => window.__ct.warp(-4.5, -30, Math.PI/2, 0, 0.1));
await shot('tree-look-up', () => window.__ct.warp(5.2, -18, -Math.PI/2, 0, 0.5));
await shot('tree-look-down', () => window.__ct.warp(5.2, -18, -Math.PI/2, 0, -0.6)); // pit grid
await shot('walk-grid-w', () => window.__ct.warp(4.8, -40, Math.PI, 0, -0.7));    // sidewalk slabs down
await shot('walk-grid-e', () => window.__ct.warp(-4.8, -40, Math.PI, 0, -0.7));

// ── the pickup ──────────────────────────────────────────────────────────
await shot('pickup-side', () => window.__ct.warp(-0.6, -34, -Math.PI/2, 0, 0));
await shot('pickup-rear', () => window.__ct.warp(-1.6, -37.6, Math.atan2(-2.3,-3.6), 0, 0));
await shot('pickup-bed', () => window.__ct.warp(-1.8, -36.8, Math.atan2(-2.1,-2.8), 0, -0.25));
await shot('pickup-front', () => window.__ct.warp(-1.6, -30, Math.atan2(-1,-4), 0, 0));

// ── the alley ───────────────────────────────────────────────────────────
await shot('alley-in', () => window.__ct.warp(-9.5, -40.2, Math.atan2(-3,0.5), 0, 0.1));
await shot('alley-dumpster', () => window.__ct.warp(-9.0, -40.2, Math.atan2(-2.2,-2.0), 0, 0));
await shot('alley-cat', () => window.__ct.warp(-9.2, -41.5, Math.atan2(-1.3,1.2), 0, -0.2));
await shot('alley-graffiti', () => window.__ct.warp(-9.5, -38, Math.atan2(-2,0.3), 0, 0.15));
await shot('alley-up', () => window.__ct.warp(-10, -40, -Math.PI/2, 0, 0.6));     // sky gaps?

// ── the corner / side street ────────────────────────────────────────────
await shot('corner-approach', () => window.__ct.warp(-1, -85, Math.PI+0.15, 0, 0));
await shot('corner-road', () => window.__ct.warp(-1, -93, Math.PI, 0, -0.5));     // road seam
await shot('corner-east', () => window.__ct.warp(1.5, -101, Math.PI/2, 0, 0));
await shot('corner-north', () => window.__ct.warp(3, -99, 0.2, 0, 0));            // north shops
await shot('corner-south', () => window.__ct.warp(3, -99, Math.PI-0.2, 0, 0));    // south shops
await shot('corner-far-east', () => window.__ct.warp(20, -99, Math.PI/2, 0, 0));  // fog end
await shot('corner-bodega', () => window.__ct.warp(4.5, -102.5, Math.atan2(4.2,5.5), 0, 0));

// ── bodega interior ─────────────────────────────────────────────────────
await shot('bodega-in', () => window.__ct.warp(241.3, -17, Math.PI/2, 0, 0));
await shot('bodega-counter', () => window.__ct.warp(244.5, -14.5, Math.atan2(-2.3,3.5), 0, 0));
await shot('bodega-shelves', () => window.__ct.warp(241.3, -17, -Math.PI/2, 0, 0));

// ── the whitmore entrance ───────────────────────────────────────────────
await shot('whitmore', () => window.__ct.warp(4.6, -42.6, Math.atan2(2.3,1.4), 0.14, 0));
await shot('whitmore-door', () => window.__ct.warp(3.2, -44, Math.atan2(4,0), 0.14, 0.1));

// ── apartment lobby + stairs + hermit floor + room ──────────────────────
await shot('lobby', () => window.__ct.warp(201.2, -18.5, Math.PI, 0, 0));
await shot('stairs-up', () => window.__ct.warp(200.6, -10.5, Math.PI, 0.6, 0.35));
await shot('stairs-down', () => { window.__ct.warp(200.6, -14, 0, 5.4, -0.4); });
await shot('hall3', () => { window.__ct.hermit(true); window.__ct.warp(200.6, -18.2, Math.PI*0.9, 5.4, 0); });
await shot('hermit', () => window.__ct.warp(201.0, -16.0, Math.atan2(1.3,0.1), 5.4, 0));
await shot('room301', () => window.__ct.warp(199.6, -16.5, Math.atan2(-2.5,1.2), 5.4, 0));

// ── people (citizen billboards up close) ────────────────────────────────
await shot('citizen', () => window.__ct.warp(-1, -22, Math.PI, 0, 0));

// ── all 12 rooms and all 3 sites, DERIVED from the world's own registries ──
//
// The sweep used to hand-type warp coordinates for one interior (the bodega)
// and zero sites, out of 12 rooms and 3 sites that actually exist. Interiors
// moved +80 m in x once when int-bank.ts landed (GOTCHAS, "interiors moved
// +80m..."); any station written as a literal number rots the same way again
// the next time a room is inserted or removed. So this block asks the world
// where things are — `window.__ct.roomDims()` and `window.__ct.sites()` — and
// computes stations from that, instead of citing coordinates here.
//
// Per room: an ENTRY station just inside the door facing in, a FAR station in
// whichever corner is farthest from the door looking back at it, and a WIDE
// station from room centre facing sideways (perpendicular to the door-to-
// centre line) to catch furniture run along a side wall — the counter, the
// pews, the stacks, the cells, whatever it is, without this script needing to
// know per-room what that furniture is.
const roomDims = await page.evaluate(() => window.__ct.roomDims());

// ── HOW MANY ROOMS SHOULD THERE BE? ASK THE DISK, NOT A TYPED NUMBER ─────
//
// This guard used to read `roomDims.length < 12`, and by the time anyone
// looked there were THIRTEEN rooms — the apartment had joined the registry, so
// the count sailed past the threshold and the guard stopped biting. A typed
// threshold only ever fails downwards; the moment the world grows past it, it
// is a check that cannot fail (BUILDER-BRIEF §7).
//
// So the expectation is derived from an INDEPENDENT source of truth: writing
// `ct/int-<name>.ts` is what puts a belt room in the world (ct/interior.ts,
// "there is no line to add in crosstown.ts and therefore no line to forget"),
// so the files on disk ARE the roster. Verified: the twelve file stems are
// exactly the twelve ids `__ct.rooms()` publishes.
//
// Two directions, because they catch different failures:
//   · a room whose file exists but which never registered  -> it failed to build
//   · a room registered under an id no file declares       -> the roster rotted
// Rooms in `roomDims()` that are NOT in `rooms()` are DECLARED extras (apt301
// comes from ct/apartment.ts, not from an int-*.ts) — they are photographed
// like any other but are not part of the belt roster.
const { readdirSync } = await import('node:fs');
const beltFiles = readdirSync(new URL('../src/proto/ct/', import.meta.url))
  .filter((f) => /^int-.+\.ts$/.test(f)).map((f) => f.replace(/^int-|\.ts$/g, ''));
const beltIds = await page.evaluate(() => window.__ct.rooms());
const dimIds = new Set(roomDims.map((r) => r.id));
const missingFromWorld = beltFiles.filter((f) => !beltIds.includes(f));
const missingFromDisk = beltIds.filter((id) => !beltFiles.includes(id));
const noDims = beltIds.filter((id) => !dimIds.has(id));
if (missingFromWorld.length) {
  errors.push(`COVERAGE: ct/int-${missingFromWorld.join('.ts, ct/int-')}.ts ${missingFromWorld.length === 1 ? 'exists' : 'exist'} on disk but ` +
    `${missingFromWorld.length === 1 ? 'that room' : 'those rooms'} never registered — a room failed to build`);
}
if (missingFromDisk.length) {
  errors.push(`COVERAGE: the world publishes room(s) ${missingFromDisk.join(', ')} with no ct/int-*.ts to declare them — the roster rotted`);
}
if (noDims.length) {
  errors.push(`COVERAGE: room(s) ${noDims.join(', ')} are registered but answered no roomDims() — nothing can be photographed there`);
}
console.log(`rooms: ${beltFiles.length} int-*.ts on disk, ${beltIds.length} registered, ` +
  `${roomDims.length} with dimensions (${roomDims.length - beltIds.length} declared elsewhere)`);
for (const r of roomDims) {
  const center = { x: r.cx, z: r.cz };
  const doorWorld = { x: r.cx + r.door.x, z: r.cz + r.door.z };
  const toCenter = { x: center.x - doorWorld.x, z: center.z - doorWorld.z };
  const len = Math.hypot(toCenter.x, toCenter.z) || 1;
  const inward = { x: toCenter.x / len, z: toCenter.z / len };
  const perp = { x: -inward.z, z: inward.x };

  const entryPos = { x: doorWorld.x + inward.x * 1.1, z: doorWorld.z + inward.z * 1.1 };
  const entryYaw = Math.atan2(inward.x, -inward.z);
  // `a.gy` is the room's OWN floor height, not a literal 0. Zero is right for
  // the whole belt and wrong for anything off it: it put the camera at street
  // level under a flat three storeys up, and `verifyLanded` waved it through
  // because it compared x and z only. The room knows; nobody else should have
  // to remember (ct/interior.ts, `RoomDims.y`).
  await shot(`${r.id}-entry`, (a) => window.__ct.warp(a.x, a.z, a.yaw, a.gy, 0), 500,
    { x: entryPos.x, z: entryPos.z, yaw: entryYaw, gy: r.y });
  await verifyLanded(`${r.id}-entry`, entryPos.x, entryPos.z, 3.0, r.y);

  const corners = [
    { x: r.cx - r.w / 2 + 0.9, z: r.cz - r.d / 2 + 0.9 },
    { x: r.cx + r.w / 2 - 0.9, z: r.cz - r.d / 2 + 0.9 },
    { x: r.cx - r.w / 2 + 0.9, z: r.cz + r.d / 2 - 0.9 },
    { x: r.cx + r.w / 2 - 0.9, z: r.cz + r.d / 2 - 0.9 },
  ];
  let far = corners[0], bestD = -1;
  for (const c of corners) {
    const dd = (c.x - doorWorld.x) ** 2 + (c.z - doorWorld.z) ** 2;
    if (dd > bestD) { bestD = dd; far = c; }
  }
  const farYaw = faceTo(far, doorWorld);
  await shot(`${r.id}-far`, (a) => window.__ct.warp(a.x, a.z, a.yaw, a.gy, 0), 400,
    { x: far.x, z: far.z, yaw: farYaw, gy: r.y });
  await verifyLanded(`${r.id}-far`, far.x, far.z, 3.0, r.y);

  const wideYaw = Math.atan2(perp.x, -perp.z);
  await shot(`${r.id}-wide`, (a) => window.__ct.warp(a.x, a.z, a.yaw, a.gy, 0), 400,
    { x: center.x, z: center.z, yaw: wideYaw, gy: r.y });
  await verifyLanded(`${r.id}-wide`, center.x, center.z, 3.0, r.y);
}

// Sites are open-air lots (park, lot, jail yard), published as a world AABB
// rather than a room. Two stations along whichever axis is longer — one near
// each end, each looking at the other — plus a CROSS station from the centre
// looking across the short axis, the same shape as the room stations above.
//
// Naming: 'jail' is both a room (the cells, from roomDims) AND a site (the
// yard outside it, from sites) — same id, two different things. Room views
// are named entry/far/wide; sites use overview/back/cross so the two id
// spaces can never collide on a filename. They did once, silently, the first
// time this ran: the site's jail-far and jail-wide overwrote the room's.
const sites = await page.evaluate(() => window.__ct.sites());
const siteIds = Object.keys(sites);
if (siteIds.length < 3) {
  errors.push(`COVERAGE: only ${siteIds.length} of 3 expected sites answered sites() — a site failed to publish or the count regressed`);
}
for (const id of siteIds) {
  const st = sites[id];
  const cx = (st.minX + st.maxX) / 2, cz = (st.minZ + st.maxZ) / 2;
  const dx = st.maxX - st.minX, dz = st.maxZ - st.minZ;
  const longX = dx >= dz;
  const near = longX ? { x: st.minX + dx * 0.18, z: cz } : { x: cx, z: st.minZ + dz * 0.18 };
  const far = longX ? { x: st.maxX - dx * 0.18, z: cz } : { x: cx, z: st.maxZ - dz * 0.18 };
  const nearYaw = faceTo(near, far);
  const farYaw = faceTo(far, near);
  const sidePoint = longX ? { x: cx, z: st.minZ + dz * 0.15 } : { x: st.minX + dx * 0.15, z: cz };
  const wideYaw = faceTo({ x: cx, z: cz }, sidePoint);

  await shot(`${id}-overview`, (a) => window.__ct.warp(a.x, a.z, a.yaw, a.gy, 0), 500,
    { x: near.x, z: near.z, yaw: nearYaw, gy: st.y });
  await verifyLanded(`${id}-overview`, near.x, near.z);
  await shot(`${id}-back`, (a) => window.__ct.warp(a.x, a.z, a.yaw, a.gy, 0), 400,
    { x: far.x, z: far.z, yaw: farYaw, gy: st.y });
  await verifyLanded(`${id}-back`, far.x, far.z);
  await shot(`${id}-cross`, (a) => window.__ct.warp(a.x, a.z, a.yaw, a.gy, 0), 400,
    { x: cx, z: cz, yaw: wideYaw, gy: st.y });
  await verifyLanded(`${id}-cross`, cx, cz);
}

// ── night + rain ────────────────────────────────────────────────────────
await shot('night-street', () => { window.__ct.clock(23, 0); window.__ct.warp(-1, -30, Math.PI, 0, 0.05); });
await shot('night-corner', () => { window.__ct.clock(23, 30); window.__ct.warp(-1, -90, Math.PI, 0, 0); });
const rainy = await page.evaluate(() => { for (let h=0;h<300;h++){ if(((Math.imul(h,2246822519)>>>0)%100)<22) return h; } return -1; });
await page.evaluate((h) => window.__ct.clock(h, 30), rainy);
await shot('rain', () => window.__ct.warp(-1.4, -20, Math.PI, 0, 0.1), 2500);
await shot('rain-indoor', () => window.__ct.warp(241.3, -17, Math.PI/2, 0, 0), 900); // must be dry

await browser.close();
console.log('bugsweep done. rainy hour', rainy, '\nshots:', shots.length);
if (errors.length) { console.error('CONSOLE/PAGE ISSUES:\n' + errors.join('\n')); }
else console.log('no console/page errors');

// ── AND SAY SO IN THE EXIT CODE, OR NOTHING UPSTREAM CAN TELL ────────────
//
// This script printed `STATION MISS` and exited 0. Anything that runs it as a
// registered check — or any builder who trusts `$?` — scored a green on a
// sweep that had just photographed the wrong place. Same family as
// `scripts/health.mjs`, which prints `WORLD BROKEN` and also exits 0 (queue
// item 61); it is worth fixing here because it is what let the apt301 defect
// survive a whole release of green sweeps.
//
// It gates on THE SWEEP'S OWN FINDINGS, not on `errors.length`. That array
// also collects every browser `warning` (line 9), and the world emits several
// benign ones on every load — THREE's Clock deprecation, Canvas2D's
// getImageData hint, the WebGL ReadPixels stall. Failing on those would make
// this red always, which is just as useless as never. So: the assertions this
// file makes itself, and nothing else.
const findings = errors.filter((e) => /^(STATION MISS|COVERAGE):/.test(e));
if (findings.length) {
  console.error(`\nFAIL: ${findings.length} sweep finding(s) — see STATION MISS / COVERAGE above`);
  process.exitCode = 1;
} else {
  console.log('sweep findings: none (0 STATION MISS, 0 COVERAGE)');
}
