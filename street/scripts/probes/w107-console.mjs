// WHAT DID THE PAGE SAY BEFORE IT DIED. A world that never publishes `__ct`
// threw during build; this prints the console and the page errors so the throw
// is read rather than guessed at.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';

const URL = aim('http://localhost:4188/');
const b = await chromium.launch();
const p = await b.newPage();
p.on('console', (m) => console.log(`[${m.type()}] ${m.text()}`));
p.on('pageerror', (e) => console.log(`[pageerror] ${e.message}\n${e.stack}`));
await p.goto(URL, { waitUntil: 'load' });
await p.waitForTimeout(6000);
console.log('__ct present:', await p.evaluate(() => typeof window.__ct));
await b.close();
