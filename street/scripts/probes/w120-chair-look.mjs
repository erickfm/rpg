// ITEM 289 — LOOK AT IT. Two frames from the bank's client chair, one facing
// the loan officer and one turned down-left onto the form, with the prompt in
// shot. FOR LOOKING, NEVER FOR PROVING (CLAUDE.md): the proof is
// w117/w69/w120-census; this is so a human can see that the thing the prompt
// names is the thing on the screen.
//
//   SHOT_URL=http://localhost:4193/ node scripts/probes/w120-chair-look.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';
import { waitPainted } from '../lib/painted.mjs';

const URL = aim('http://localhost:4193/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 560 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.seats !== undefined, { timeout: 30000 });
await reportWorld(p, URL);
await waitPainted(p);
await p.evaluate(() => window.__ct.clock(10, 0));

const seat = await p.evaluate(() => {
  const seats = window.__ct.seats();
  const k = seats.findIndex((s) => /client chair/i.test(s.label));
  if (k < 0) return null;
  window.__ct.sit(seats[k].pose);
  const q = window.__ct.pos();
  return { ok: !!window.__ct.seated(), x: q[0], z: q[2], yaw: seats[k].pose.yaw };
});
if (!seat?.ok) { console.log('REFUSING: could not sit in the client chair'); await b.close(); process.exit(3); }

const shot = async (deg, name) => {
  // warping to your OWN coordinates moves you 0 m, so this only turns the head
  await p.evaluate(([x, z, y]) => window.__ct.warp(x, z, y, undefined, -0.18),
    [seat.x, seat.z, seat.yaw + (deg * Math.PI) / 180]);
  await waitPainted(p, { frames: 6 });
  const t = await p.evaluate(() => {
    const d = document.getElementById('ct-prompt');
    return d && d.style.display !== 'none' ? (d.textContent ?? '').trim() : null;
  });
  await p.screenshot({ path: `shots/${name}.png` });
  console.log(`  ${String(deg).padStart(4)}°  shots/${name}.png   ${JSON.stringify(t)}`);
};
console.log('from the client chair (0° = the way the seat faces):');
await shot(0, 'w120-chair-officer');
await shot(-45, 'w120-chair-form');
await b.close();
