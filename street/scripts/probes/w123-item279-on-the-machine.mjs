// Item 279 — can a check SEE that the ATM screen is painted onto the machine
// rather than over the camera? That is the contract the old assertion did not
// know about, so the replacement has to be able to state it. Read-only.
import { chromium } from 'playwright';
const URL = process.env.SHOT_URL ?? 'http://localhost:4194/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1100, height: 680 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.spots, null, { timeout: 30000 });

const read = () => p.evaluate(() => {
  const m = window.__atm?.surfaceMesh?.();
  const mat = m && (Array.isArray(m.material) ? m.material[0] : m.material);
  const img = mat?.map?.image;
  const wrap = document.getElementById('ct-atm');
  const cv = wrap?.querySelector('canvas');
  const r = cv?.getBoundingClientRect();
  return {
    panel: window.__hud?.panel() ?? null,
    padLive: window.__atm?.padLive?.() ?? null,
    mapKind: img ? (img.tagName ? img.tagName.toLowerCase() : typeof img) : null,
    mapSize: img ? `${img.width}x${img.height}` : null,
    domCanvasSize: r ? `${Math.round(r.width)}x${Math.round(r.height)}` : null,
    domCanvasOpacity: wrap ? getComputedStyle(wrap).opacity : null,
    // THE IDENTITY, which is the assertion worth having: makePanel's CanvasTexture
    // is a VIEW onto the panel's own canvas, so when the machine is wearing the
    // panel its map.image IS that DOM canvas element — no numbers to retype.
    mapIsPanelCanvas: !!img && !!cv && img === cv,
  };
});

await p.evaluate(() => window.__ct.warp(-6.0, 7.29, -Math.PI / 2, 0, 0));
await p.waitForTimeout(1200);
console.log('closed :', JSON.stringify(await read()));
await p.keyboard.down('e'); await p.waitForTimeout(120); await p.keyboard.up('e');
await p.waitForTimeout(900);
console.log('open   :', JSON.stringify(await read()));
await p.keyboard.press('Escape'); await p.waitForTimeout(800);
console.log('closed :', JSON.stringify(await read()));
await b.close();
