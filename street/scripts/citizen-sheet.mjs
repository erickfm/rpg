// The contact sheet for notes/CITIZEN-STYLE.md.
//
// A dozen people across the whole range of the atlas, painted through
// __ct.person(look) and laid out with their Look printed underneath, so an agent
// who needs a person can SEE what this world's people look like instead of
// reading adjectives and then drawing a plane.
//
// Regenerate after any change to ct/citizens.ts:
//   SHOT_URL=http://localhost:4187/ node scripts/citizen-sheet.mjs
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { writeFileSync } from 'node:fs';

// Deliberately spread: every `fit`, every `cut`, both builds, the full skin
// range, slow to fast, and one grimy. Nobody here is anybody else recoloured.
const CAST = [
  { label: 'plain · short · build 0', look: { jacket: '#37505e', pants: '#2b2f36', skin: '#8d5a34', hair: '#1c1410', fit: 'plain', cut: 'short', build: 0, stride: 3 } },
  { label: 'coat · crop · broad', look: { jacket: '#3a4a63', pants: '#2b2f36', skin: '#6b4226', hair: '#141014', fit: 'coat', cut: 'crop', build: 1, stride: 4 } },
  { label: 'cap · tied · slight', look: { jacket: '#7a3a34', pants: '#3f4650', skin: '#e6bb92', hair: '#8c5a2e', fit: 'cap', accent: '#8a3a2e', cut: 'tied', build: -1, stride: 5 } },
  { label: 'dress · long', look: { jacket: '#3f5a46', pants: '#3f5a46', skin: '#c9946a', hair: '#241a10', fit: 'dress', cut: 'long', build: 0, stride: 2 } },
  { label: 'hoodie · hood up', look: { jacket: '#5c5266', pants: '#2b2f36', skin: '#4a2c1a', hair: '#141014', fit: 'hoodie', cut: 'short', build: 1, stride: 3 } },
  { label: 'plain · bald · older', look: { jacket: '#6a5a3a', pants: '#23262c', skin: '#f0c8a0', hair: '#b8b2a6', fit: 'plain', cut: 'bald', build: -1, stride: 4 } },
  { label: 'coat · long · dark skin', look: { jacket: '#2f3a44', pants: '#23262c', skin: '#3b2416', hair: '#100c0a', fit: 'coat', cut: 'long', build: 0, stride: 3 } },
  { label: 'cap · crop · pale', look: { jacket: '#4a6a55', pants: '#39404a', skin: '#f6d8b8', hair: '#c9a24a', fit: 'cap', accent: '#2f4a6a', cut: 'crop', build: 0, stride: 4 } },
  { label: 'grime 1 · unwashed', look: { jacket: '#6b6250', pants: '#3a3630', skin: '#a8794e', hair: '#4a3a28', fit: 'coat', cut: 'long', build: 1, stride: 2, grime: 1 } },
  { label: 'dress · tied · slight', look: { jacket: '#7a5a6a', pants: '#7a5a6a', skin: '#d8a878', hair: '#2a1c14', fit: 'dress', cut: 'tied', build: -1, stride: 3 } },
  { label: 'hoodie · slight', look: { jacket: '#3a4a3a', pants: '#2b2f36', skin: '#c08a58', hair: '#1c1410', fit: 'hoodie', cut: 'crop', build: -1, stride: 5 } },
  { label: 'plain · long · broad', look: { jacket: '#5a4a63', pants: '#2b2f36', skin: '#6e4a2e', hair: '#181210', fit: 'plain', cut: 'long', build: 1, stride: 3 } },
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
await page.goto(aim('http://localhost:4177/'), { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct?.person !== undefined, { timeout: 10000 });
await reportWorld(page, aim('http://localhost:4177/'));   // GOTCHAS 26: prove it, do not just name it
await page.waitForTimeout(300);

const sheet = await page.evaluate(async (CAST) => {
  const FW = 32, FH = 64, Z = 3;
  const COLS = 4;
  const cellW = FW * 5 * Z, cellH = FH * Z;
  const PAD = 12, LBL = 30;
  const rows = Math.ceil(CAST.length / COLS);
  const cv = document.createElement('canvas');
  cv.width = PAD + COLS * (cellW + PAD);
  cv.height = 34 + rows * (cellH + LBL + PAD);
  const g = cv.getContext('2d');
  g.imageSmoothingEnabled = false;
  let missing = 0;
  g.fillStyle = '#4c5158'; g.fillRect(0, 0, cv.width, cv.height);
  g.fillStyle = '#e8e4d8'; g.font = 'bold 15px monospace'; g.textBaseline = 'top';
  g.fillText('CROSSTOWN ’97 — the people ct/citizens.ts makes. 5 painted views each: front, 3/4, profile, 3/4 back, back.', PAD, 9);
  for (let i = 0; i < CAST.length; i++) {
    // CHECK THE URL BEFORE LOADING IT. If the affordance has been renamed or
    // returns nothing, `img.src = ''` never fires onload and the whole evaluate
    // hangs until Playwright kills it with a raw stack trace — which is how the
    // node-side "empty sheet" guard turned out to be unreachable when I watched
    // it fail on purpose.
    const url = window.__ct.person?.(CAST[i].look);
    if (!url || url.length < 200) { missing++; continue; }
    const img = new Image();
    await new Promise((r) => { img.onload = r; img.onerror = r; img.src = url; });
    const cx = PAD + (i % COLS) * (cellW + PAD);
    const cy = 34 + Math.floor(i / COLS) * (cellH + LBL + PAD);
    // a checker behind, so alphaTest holes read as holes
    for (let a = 0; a < cellW; a += 10) for (let b = 0; b < cellH; b += 10) {
      g.fillStyle = ((a + b) / 10) % 2 ? '#565c64' : '#5e646c';
      g.fillRect(cx + a, cy + b, Math.min(10, cellW - a), Math.min(10, cellH - b));
    }
    // the top row of the sheet is frame 0, the STANDING pose
    g.drawImage(img, 0, 0, FW * 5, FH, cx, cy, cellW, cellH);
    g.fillStyle = '#e8e4d8'; g.font = '12px monospace';
    g.fillText(CAST[i].label, cx, cy + cellH + 5);
    const L = CAST[i].look;
    g.fillStyle = '#b8c0c8'; g.font = '10px monospace';
    g.fillText(`skin ${L.skin} hair ${L.hair} stride ${L.stride}${L.grime ? ' grime ' + L.grime : ''}`, cx, cy + cellH + 19);
  }
  return { png: cv.toDataURL(), missing };
}, CAST);

// A BLANK SHEET IS A FAILURE, NOT A FILE. This paints through __ct.person, and
// if that returned nothing — renamed affordance, atlas throwing — the old code
// wrote a grey rectangle and reported success. Watched fail on purpose by
// pointing it at a world without the affordance.
const { png, missing } = sheet;
if (missing) {
  console.error(`FAILED — __ct.person painted nothing for ${missing} of ${CAST.length} looks. ` +
    'The affordance is missing or returning empty; no sheet written.');
  await browser.close();
  process.exit(1);
}
writeFileSync('shots/citizen-range.png', Buffer.from(png.split(',')[1], 'base64'));
console.log(`shots/citizen-range.png — ${CAST.length} people, standing pose, all five painted views each`);
await browser.close();
