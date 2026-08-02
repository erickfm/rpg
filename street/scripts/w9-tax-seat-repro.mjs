// REPRO for QUEUE item 5f: "seats in the tax office are reversed" / "tax
// office waiting seats face the wall."
//
// Two separate questions, tested separately, because the diagnosis in the
// row (yaw:0 -> +z, into the wall) does NOT match a read of fp.ts: the
// camera's look vector is (sin(yaw), *, -cos(yaw)), so yaw 0 faces -z, not
// +z (confirmed at fp.ts:299-304 and :361-366, used identically whether
// seated or standing). The row (WAIT_Z = hd - 0.62) sits right against the
// FRONT wall (interior.ts:850-851 draws the front wall at local z = +hd,
// with the door in it) — so yaw 0 on this seat already faces -z, INTO the
// room, toward the desks. That is what the row's own comment says it wants
// ("A WAITING ROW ... facing the desks").
//
//   1. What does the PLAYER'S CAMERA face after sitting? (the yaw the seat
//      registers)
//   2. What does the CHAIR MESH itself look like — which way does its
//      backrest put the open (seat) side?
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';

const URL = process.env.SHOT_URL ?? 'http://localhost:4188/';
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1000, height: 640 } });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await reportWorld(page, URL);

// "sit and wait" is not unique to this room (other waiting areas share the
// label) -- disambiguate against the DOOR-derived interior pocket rather
// than guessing an x-range, by cross-checking against a spot this room DOES
// register uniquely: its own "sit down with the preparer" seat, which is
// necessarily in the same interior pocket.
const info = await page.evaluate(() => {
  const seats = window.__ct.seats ? window.__ct.seats() : [];
  const prep = seats.find((s) => s.label === 'sit down with the preparer');
  const wait = seats.filter((s) => s.label === 'sit and wait');
  // same pocket = within ~15 m of the preparer's seat, well inside one room
  // and well outside the distance to any other room's pocket
  const mine = prep ? wait.filter((s) => Math.hypot(s.pose.x - prep.pose.x, s.pose.z - prep.pose.z) < 15) : wait;
  return { prep: prep ? prep.pose : null, mine: mine.map((s) => ({ pose: s.pose, at: s.at, r: s.r })) };
});
console.log(`preparer seat at: ${JSON.stringify(info.prep)}`);
console.log(`found ${info.mine.length} "sit and wait" seats in the same pocket`);
console.log(JSON.stringify(info.mine, null, 2));
if (!info.mine.length) { console.log('FAIL: no seats found'); process.exit(1); }

const s = info.mine[0];
// sit on it directly, bypassing E-resolution (this test is about facing, not
// about whether E finds it — that is a different question)
await page.evaluate((pose) => window.__ct.warp(pose.x, pose.z, pose.yaw, pose.h + 0.4, 0), s.pose);
await page.waitForTimeout(150);
// force the actual seated state via the approach point + E, so this reads
// exactly what a player gets
await page.evaluate((at) => window.__ct.warp(at.x, at.z, 0, window.__ct.groundAt(at.x, at.z), 0), s.at);
await page.waitForTimeout(200);
const before = await page.evaluate(() => window.__ct.pos());
await page.keyboard.down('e'); await page.waitForTimeout(120); await page.keyboard.up('e');
await page.waitForTimeout(200);
const after = await page.evaluate(() => window.__ct.pos());
const seatedYaw = await page.evaluate(() => window.__ct.yaw ? window.__ct.yaw() : null);
console.log(`before sit: ${JSON.stringify(before)}`);
console.log(`after  sit: ${JSON.stringify(after)}  camera yaw = ${seatedYaw}`);

// direction the camera faces: (sin(yaw), -cos(yaw)) per fp.ts
const fx = Math.sin(seatedYaw), fz = -Math.cos(seatedYaw);
console.log(`camera look direction (world dx,dz) = (${fx.toFixed(3)}, ${fz.toFixed(3)})`);
console.log(fz < 0 ? '-> facing toward -z (INTO the room / toward the desks)'
                    : '-> facing toward +z (toward the FRONT wall)');

await b.close();
