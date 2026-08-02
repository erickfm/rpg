// Verify the ledger's church-pillars row: "pillars of the church seem not
// fully thought out. they block the windows i thin[k]" — row claims the
// buttresses no longer clip the lancets, from a specific station. Walk it,
// don't read the source.
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { setClock } from './lib/clock.mjs';

const URL = process.env.SHOT_URL ?? 'http://localhost:4177/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1100, height: 720 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await reportWorld(p, URL);
await setClock(p, 13, 0);

// the row's own station: far pavement, looking east, pitched up
const yawEast = Math.PI / 2;
for (const pitch of [0.25, 0.4, 0.55]) {
  await p.evaluate(([x, z, yaw, pitch]) => window.__ct.warp(x, z, yaw, 0, pitch),
    [-5.4, -79.5, yawEast, pitch]);
  await p.waitForTimeout(300);
  await p.screenshot({ path: `shots/w3-church-front-pitch${pitch}.png` });
}

// a second, closer station across the street, for a tighter read on one bay
await p.evaluate(([x, z, yaw, pitch]) => window.__ct.warp(x, z, yaw, 0, pitch),
  [-2, -79.5, yawEast, 0.45]);
await p.waitForTimeout(300);
await p.screenshot({ path: 'shots/w3-church-front-close.png' });

console.log('shots saved: w3-church-front-pitch0.25.png / 0.4 / 0.55, w3-church-front-close.png');
await b.close();
