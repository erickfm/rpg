// Item 240 — settle the jail's "1 dimmed material", IN PIXELS.
//
// Three workers have disagreed about a coordinate:
//   sixtyfour  found the jail dimming one material at (1006.37, 2.42, -5.60)
//   seventyone called item 210 "false in every clause" — it is the cell
//              DAYLIGHT SLOT window, it is MEANT to dim, and the real defect was
//              that NIGHT_STOPS bottomed out too high; it set the floor #6c6f76
//   eightytwo  re-found one dimmed material at the same coordinate, stable 2/2
//
// ⚠ AND THE COORDINATE THEY AGREED ON DOES NOT EXIST (item 295). The two
// quotations of -5.60 above are kept as the RECORD OF WHAT WAS CLAIMED — that is
// the point of this list — but the material is at **-9.40**: x and y agree to
// the centimetre and z is out by 3.8 m, one slot window along the same cell
// wall. Anywhere -5.60 was still being USED to aim something, it has been
// retired. GOTCHAS 92 carries the whole story, including the reason the argument
// ran three times.
//
// ⚠ THE ROW'S OWN WARNING IS THE REASON THIS PROBE EXISTS: a fragment shader is
// invisible to anything reading `material.color` from JS. Every measurement in
// that argument was a JS colour read. So this one asks the RENDERER: it
// screenshots the jail at noon and at 02:00 and compares PIXELS.
//
// It also reports what `roomDims()` now says the jail's clear height is, which
// is the second half of item 240.
//
// Usage: SHOT_URL=http://localhost:4740/ node scripts/probes/w118-item240-jail-pixels.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const URL = process.env.SHOT_URL;
if (!URL) { console.error('  NOT AIMED — pass SHOT_URL=http://localhost:<your port>/'); process.exit(2); }
mkdirSync('shots', { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1000, height: 640 } });
await page.goto(URL, { waitUntil: 'load', timeout: 30000 });
// GOTCHAS 78: `__ct` existing is not a picture — wait for a PAINTED frame.
await page.waitForFunction(() => {
  const q = window.__ct?.painted?.();
  return !!q && q.frames > 0 && q.triangles > 0;
}, { timeout: 30000 });

let fails = 0;
const check = (ok, msg) => { console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${msg}`); if (!ok) fails++; };

const jail = await page.evaluate(() => (window.__ct.roomDims() ?? []).find((r) => r.id === 'jail'));
console.log(`  jail roomDims: ${JSON.stringify(jail)}`);
check(typeof jail.h === 'number' && jail.h > 0,
  `roomDims() publishes the jail's clear HEIGHT — h=${jail.h} m`);

// every room must carry it, not just the one this item looked at
const rooms = await page.evaluate(() => window.__ct.roomDims() ?? []);
const noH = rooms.filter((r) => typeof r.h !== 'number' || !(r.h > 0));
check(noH.length === 0,
  `every room in the registry publishes a height (${rooms.length} rooms, ${noH.length} without: ${noH.map((r) => r.id).join(',') || 'none'})`);
console.log(`       heights: ${rooms.map((r) => `${r.id} ${r.h}`).join(', ')}`);

// ── stand in the jail and photograph it at noon and at 02:00 ──────────────
const shoot = async (hh, mm, tag) => {
  await page.evaluate(([x, z]) => window.__ct.warp(x, z, 0, 0, 0), [jail.cx, jail.cz]);
  await page.evaluate(([h, m]) => window.__ct.clock(h, m), [hh, mm]);
  await page.waitForTimeout(1100);
  const path = `shots/w118-jail-${tag}.png`;
  await page.screenshot({ path });
  // mean luminance of the frame, from the renderer's own canvas
  const lum = await page.evaluate(() => {
    const c = document.querySelector('canvas');
    const g = document.createElement('canvas');
    g.width = c.width; g.height = c.height;
    const cx2 = g.getContext('2d');
    cx2.drawImage(c, 0, 0);
    const d = cx2.getImageData(0, 0, g.width, g.height).data;
    let s = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) { s += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; n++; }
    return +(s / n).toFixed(2);
  });
  console.log(`  ${tag.padEnd(6)} mean luminance ${String(lum).padStart(7)}   ${path}`);
  return lum;
};

const noon = await shoot(13, 0, 'noon');
const night = await shoot(2, 0, 'night');


// ── POSITIVE CONTROL, and this probe is worthless without it ───────────────
// "The jail does not change between noon and 02:00" and "my clock/screenshot
// pipeline does not work" produce the SAME number. The street is known to have
// a day/night cycle, so photograph it the same way: if the street moves and the
// jail does not, the jail's flatness is a fact about the jail.
const shootAt = async (x, z, hh, mm, tag) => {
  await page.evaluate(([px, pz]) => window.__ct.warp(px, pz, 0, 0.14, 0), [x, z]);
  await page.evaluate(([h, m]) => window.__ct.clock(h, m), [hh, mm]);
  await page.waitForTimeout(1100);
  await page.screenshot({ path: `shots/w118-street-${tag}.png` });
  return page.evaluate(() => {
    const c = document.querySelector('canvas');
    const g = document.createElement('canvas');
    g.width = c.width; g.height = c.height;
    const cx2 = g.getContext('2d');
    cx2.drawImage(c, 0, 0);
    const d = cx2.getImageData(0, 0, g.width, g.height).data;
    let s = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) { s += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; n++; }
    return +(s / n).toFixed(2);
  });
};
const stNoon = await shootAt(0, -20, 13, 0, 'noon');
const stNight = await shootAt(0, -20, 2, 0, 'night');
const stPct = +(100 * (stNoon - stNight) / stNoon).toFixed(1);
console.log(`\n  CONTROL, the street at (0,-20): ${stNoon} -> ${stNight}  (${stPct}% darker at 02:00)`);
check(stPct > 5,
  `the clock and the screenshot pipeline demonstrably WORK — the street is ${stPct}% darker at 02:00`);

// THE JAIL MUST **NOT** VISIBLY DIM, and that is the design, not a bug.
// `ct/props.ts:977` skips the night grader for anything at |world x| > 100 —
// "interiors keep their own light" — and the jail sits at x 1000. So the
// correct pixel result is NO CHANGE, and the street control above is what makes
// that reading mean something instead of meaning the instrument is broken.
//
// My first cut asserted the opposite (`pct >= 0.5`, "the jail reacts to the
// clock") and failed a world that was right. That was me encoding an
// expectation instead of the design.
const drop = +(noon - night).toFixed(2);
const pct = +(100 * drop / noon).toFixed(1);
console.log(`\n  noon -> 02:00: ${noon} -> ${night}  (a fall of ${drop}, ${pct}%)`);
check(night > 12, `the jail at 02:00 is still readable, not black — mean luminance ${night}`);
check(Math.abs(pct) <= 1.0,
  `the jail keeps its own light, as interiors are meant to — ${pct}% change at 02:00 `
  + `against the street's ${stPct}% over the same two frames`);

console.log(fails ? `\n${fails} CHECK(S) FAILED` : '\nall jail pixel checks pass');
await browser.close();
process.exitCode = fails ? 1 : 0;
