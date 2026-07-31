import { chromium } from 'playwright';
import { reportWorld } from '../scripts/lib/which-world.mjs';
const URL='http://localhost:4391/';
const b = await chromium.launch();
const p = await b.newPage({viewport:{width:1280,height:720}});
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await reportWorld(p, URL);
await p.waitForTimeout(2200);
await p.evaluate(()=>window.__ct.clock(13,0));
await p.waitForTimeout(1200);
// E's station: the FAR pavement at (-5.4, -79.5) looking east, pitched up
await p.evaluate(()=>window.__ct.warp(-5.4, -79.5, Math.PI/2, window.__ct.groundAt(-5.4,-79.5), 0.45));
await p.waitForTimeout(700);
await p.screenshot({path:'shots/N/church-far-pavement.png'});
// and the station E says is WRONG, for the contrast
await p.evaluate(()=>window.__ct.warp(5.4, -79.5, Math.PI/2, window.__ct.groundAt(5.4,-79.5), 0.85));
await p.waitForTimeout(700);
await p.screenshot({path:'shots/N/church-near-wall.png'});
console.log('shot both');
await b.close();
