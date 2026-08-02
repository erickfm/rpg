import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 800, height: 500 } });
const errs = [];
p.on('pageerror', e => errs.push(String(e.message)));
// Had NO default at all — without SHOT_URL this called goto(undefined).
const URL = aim('http://localhost:4177/');
await p.goto(URL, { waitUntil: 'networkidle' });
// Before diagnosing whether the world initialises, check it is THIS world. A
// "WORLD BROKEN" verdict about somebody else's build is worse than no verdict,
// and the stamp is in the bundle, so it reads even when __ct never appears.
await reportWorld(p, URL);
let ok = true;
try { await p.waitForFunction(() => window.__ct !== undefined, { timeout: 12000 }); }
catch { ok = false; }
console.log(ok ? 'WORLD OK — __ct initialised' : 'WORLD BROKEN — __ct never appeared');
if (errs.length) console.log('errors:\n' + errs.slice(0,3).join('\n'));
await b.close();
