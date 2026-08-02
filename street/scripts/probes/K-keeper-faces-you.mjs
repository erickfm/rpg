// VERIFYING F's ROW "make sure the people in the buildings are in the right
// orientation" — the one with three prior readings that disagree.
//
// H: bodega 4 (dead away), library 2, casino/hotel/thrift 1, the rest 0.
// AUDITOR: bodega 3 (profile), church 4, diner 4, thrift 2, library 1 — and
//   said so itself: its finder took "the first atlas-framed figure in the
//   room", and a diner has customers in it, so its "diner keeper, dead away"
//   was a person sitting in a booth with their back to the door.
// B: bodega showing his BACK, from a station the game validates.
// E: withdrew its own instrument — it measured the QUAD NORMAL of a billboard,
//   which is not a facing at all.
//
// Every one of those is a different POPULATION or a different FRAME. The row's
// own conclusion says what would settle it: *"the keeper needs to be
// identifiable … rather than leaving it to whoever measures next to guess."*
//
// So this guesses at nothing:
//
//   THE STATION comes from the world. Where a customer stands is where the
//     room's own service `[E]` fires — `buy`, `till`, `check in`. Not a
//     coordinate from a note: B's station (441.50, 0.40) and keeper (442.35,
//     −0.70) are BOTH STALE, because the bodega has since moved to x 520 and
//     those numbers now point at the bank. Every hand-typed coordinate in this
//     project has gone stale at least once (GOTCHAS §20).
//   THE KEEPER is the person-sized billboard standing ON THE FLOOR nearest that
//     spot. A customer at a counter is looking at the person serving them; that
//     IS the definition, and it cannot pick up a diner booth four metres away.
//   THE VERDICT is a PICTURE from that station, because "facing away" is a
//     thing you see. A sector number decoded from a bearing is exactly what
//     three people have now disagreed about.
//
// Usage: SHOT_URL=http://localhost:4292/ node scripts/K-keeper-faces-you.mjs
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { mkdirSync } from 'node:fs';

const URL = process.env.SHOT_URL ?? 'http://localhost:4292/';
const OUT = 'shots/K-keeper';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(page, URL);
await page.evaluate(() => window.__ct.clock(13, 0));
await page.waitForTimeout(600);

// Service spots: the ones a CUSTOMER uses, which is the only kind of spot that
// tells you where a customer stands. A door does not — you can be at a door
// with your back to the whole room.
const SERVICE = /\b(buy|till|check in|check out|balance|borrow|order|pay)\b/i;

const rooms = await page.evaluate((re) => {
  const rx = new RegExp(re, 'i');
  const dims = window.__ct.roomDims();
  const spots = window.__ct.spots();
  return dims.map((r) => {
    // spots inside this room's footprint, in world coordinates
    const inRoom = spots.filter((s) =>
      Math.abs(s.x - r.cx) <= r.w / 2 + 1 && Math.abs(s.z - r.cz) <= r.d / 2 + 1);
    const svc = inRoom.filter((s) => rx.test(s.label));
    return { id: r.id, cx: r.cx, cz: r.cz, w: r.w, d: r.d, door: r.door,
      service: svc.map((s) => ({ x: s.x, z: s.z, label: s.label })) };
  });
}, SERVICE.source);

const found = [];
for (const r of rooms) {
  // stand where the world says a customer stands: at the service spot if the
  // room has one, otherwise two metres in from its own door along the inward
  // normal, which is the arriving customer's first step.
  const st = r.service.length
    ? { x: r.service[0].x, z: r.service[0].z, why: `service spot: ${r.service[0].label}` }
    : { x: r.cx + r.door.x + r.door.nx * 2.2, z: r.cz + r.door.z + r.door.nz * 2.2, why: 'two steps in from its own door' };

  await page.evaluate(([x, z]) => window.__ct.warp(x, z, 0, window.__ct.groundAt(x, z), 0), [st.x, st.z]);
  await page.waitForTimeout(450);

  // ── WHICH FIGURE IS THE KEEPER ─────────────────────────────────────────
  //
  // The row's own unanswered question, and the reason three people got three
  // answers. Shape cannot do it: a DOOR LEAF is a plane about 1 m wide and 2 m
  // tall, which is a person's proportions exactly — my first pass photographed
  // the pawn shop's open door and called it the keeper.
  //
  // So the test is BEHAVIOURAL, not geometric: **an atlas figure is a billboard
  // and turns to face you; a door does not.** Read every candidate's yaw from
  // one place, move, read it again. What turned is a person. This cannot be
  // fooled by proportions, cannot pick up a sign or a door, and needs nothing
  // tagged in anybody else's file.
  const sample = (x, z) => page.evaluate(([px, pz, gy, cx, cz, rw, rd]) => {
    window.__ct.warp(px, pz, 0, window.__ct.groundAt(px, pz) || gy, 0);
    const out = [];
    window.__ct.scene().traverse((o) => {
      if (!o.isMesh || !o.geometry || !o.geometry.parameters) return;
      if (!/Plane/.test(o.geometry.type)) return;
      const { width: gw, height: gh } = o.geometry.parameters;
      if (!(gh > 1.0 && gh < 2.3 && gw > 0.4 && gw < 1.5)) return;
      o.updateWorldMatrix(true, false);
      const P = o.getWorldPosition(new o.position.constructor());
      // the quads do not share one origin convention — some are centred on the
      // figure, some translated to the feet — so this is a BAND, not a base.
      // "That is the quad, not the figure" is the auditor's own lesson here.
      if (P.y < gy - 0.3 || P.y > gy + 2.4) return;
      // …with 0.4 m of margin, SET BY THE TWO CASES THAT BRACKET IT rather
      // than by taste: the thrift's keeper stands flush to the back wall at
      // 0.05 m OUTSIDE the declared inner depth and must be kept, and the
      // citizen on the pavement outside the tax office is 0.61 m out and must
      // not. A tolerance argued into place is what GOTCHAS §27 is about; this
      // one is measured, and both numbers are in the note.
      if (Math.abs(P.x - cx) > rw / 2 + 0.4 || Math.abs(P.z - cz) > rd / 2 + 0.4) return;
      out.push({ id: o.uuid, x: P.x, z: P.z, rot: o.rotation.y });
    });
    return out;
  }, [x, z, 0, r.cx, r.cz, r.w, r.d]);

  await sample(st.x, st.z);
  await page.waitForTimeout(420);                 // boards turn in the sim loop
  const a2 = await sample(st.x, st.z);
  const ox = r.cx + (st.x > r.cx ? -r.w / 3 : r.w / 3);
  const oz = r.cz + (st.z > r.cz ? -r.d / 3 : r.d / 3);
  await sample(ox, oz);
  await page.waitForTimeout(420);
  const b = await sample(ox, oz);
  const rotB = new Map(b.map((q) => [q.id, q.rot]));
  const turned = a2.filter((q) => {
    const r2 = rotB.get(q.id);
    if (r2 === undefined) return false;
    let dd = Math.abs(r2 - q.rot) % (Math.PI * 2);
    if (dd > Math.PI) dd = Math.PI * 2 - dd;
    return dd > 0.12;                              // it turned to look at me
  });
  const k = turned
    .map((q) => ({ ...q, d: Math.hypot(q.x - st.x, q.z - st.z) }))
    .sort((p1, p2) => p1.d - p2.d)[0] ?? null;

  if (!k) { found.push({ id: r.id, st, keeper: null }); console.log(`${r.id.padEnd(9)} NO BILLBOARD FIGURE in the room (${a2.length} person-sized planes, none of them turned)`); continue; }

  // look at them, from the station, at eye level
  const yaw = Math.atan2(k.x - st.x, -(k.z - st.z));
  const back = Math.max(1.4, Math.min(2.6, k.d));           // never nose to nose
  await page.evaluate(([kx, kz, y, dist, gy]) => {
    const sx = kx - Math.sin(y) * dist, sz = kz + Math.cos(y) * dist;
    window.__ct.warp(sx, sz, y, window.__ct.groundAt(sx, sz) || gy, -0.05);
  }, [k.x, k.z, yaw, back, 0]);
  await page.waitForTimeout(700);                            // boards turn in the sim loop
  // …and the prompt at that station, IF IT BELONGS TO THIS ROOM. My first pass
  // printed "FIRST FEDERAL — check balance" in all eleven rooms: the ATM's spot
  // declares `ok: () => true` unconditionally, so it is "live" everywhere in the
  // world and only proximity keeps it from being offered. `ok` is not "is this
  // being offered"; reading it as such makes every station look validated.
  const live = await page.evaluate(([cx, cz, w, d]) => window.__ct.spots()
    .filter((s) => s.ok && Math.abs(s.x - cx) <= w / 2 + 1 && Math.abs(s.z - cz) <= d / 2 + 1)
    .map((s) => s.label), [r.cx, r.cz, r.w, r.d]);
  await page.screenshot({ path: `${OUT}/${r.id}.png` });
  found.push({ id: r.id, st, keeper: { x: +k.x.toFixed(2), z: +k.z.toFixed(2), d: +k.d.toFixed(2) }, live: live.slice(0, 2) });
  console.log(`${r.id.padEnd(9)} keeper (${k.x.toFixed(2)}, ${k.z.toFixed(2)}) ${k.d.toFixed(2)} m`
    + ` · ${st.why}${live.length ? ` · prompt up: ${live[0]}` : ''}`);
}

console.log(`\n${found.filter((f) => f.keeper).length} of ${found.length} rooms photographed into ${OUT}/`);
console.log('THE VERDICT IS THE PICTURES. A sector number is what three people have disagreed about.');
await browser.close();
process.exit(found.filter((f) => f.keeper).length ? 0 : 3);
