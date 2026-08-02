// Is a face ONE tone with features on it, or several tones?
//
// The head is 10 texels across. Rim shading that works on a 14-wide torso reads
// as skin discolouration at that width, because a face is the one surface people
// read finely. So this measures the head row by row: how many distinct colours
// run across the face, and how far the extremes sit from the base skin tone.
//
// Alpha overlays are the reason this has to be checked on EVERY tone and not
// just the one in the report: the same rgba over a dark skin lifts it much
// further in relative terms than over a pale one.
//
// Usage: SHOT_URL=http://localhost:4187/ node scripts/faces.mjs
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { writeFileSync } from 'node:fs';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
await page.goto(aim('http://localhost:4177/'), { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 10000 });
await reportWorld(page, aim('http://localhost:4177/'));   // GOTCHAS 26: prove it, do not just name it
await page.waitForTimeout(400);

const out = await page.evaluate(async () => {
  const FW = 32, FH = 64, Z = 10;
  const urls = window.__ct.atlases();
  const rows = [];
  // one contact sheet: every citizen down the page, the five painted views
  // across it, cropped to the head and blown up
  const HEAD_Y = 3, HEAD_H = 20, HEAD_X = 8, HEAD_W = 16;
  const cv = document.createElement('canvas');
  cv.width = 20 + 5 * (HEAD_W * Z + 14);
  cv.height = 22 + urls.length * (HEAD_H * Z + 22);
  const g = cv.getContext('2d', { willReadFrequently: true });
  g.imageSmoothingEnabled = false;
  g.fillStyle = '#5a6068'; g.fillRect(0, 0, cv.width, cv.height);
  g.font = '12px monospace'; g.textBaseline = 'top';

  for (let p = 0; p < urls.length; p++) {
    const img = new Image();
    await new Promise((r) => { img.onload = r; img.src = urls[p]; });
    // read the pixels once, off a 1:1 copy
    const raw = document.createElement('canvas');
    raw.width = img.width; raw.height = img.height;
    const rg = raw.getContext('2d', { willReadFrequently: true });
    rg.drawImage(img, 0, 0);

    const rowY = 22 + p * (HEAD_H * Z + 22);
    for (let view = 0; view < 5; view++) {
      const x = 20 + view * (HEAD_W * Z + 14);
      g.drawImage(img, view * FW + HEAD_X, HEAD_Y, HEAD_W, HEAD_H,
        x, rowY, HEAD_W * Z, HEAD_H * Z);
      g.fillStyle = '#e8e4d8';
      g.fillText(`p${p} v${view}`, x, rowY + HEAD_H * Z + 4);
    }
    // ── the measurement: the eye row and the cheek row of the FRONT view ──
    // the head occupies x = cx-5 … cx+4 with cx = FW/2, i.e. 11 … 20
    const scan = (yRow) => {
      const d = rg.getImageData(11, yRow, 10, 1).data;
      const px = [];
      for (let i = 0; i < 10; i++) {
        const a = d[i * 4 + 3];
        px.push(a < 128 ? null : `${d[i * 4]},${d[i * 4 + 1]},${d[i * 4 + 2]}`);
      }
      return px;
    };
    const cheek = scan(18);           // below the eyes, above the mouth
    const brow = scan(11);            // forehead
    const tally = (px) => {
      const seen = new Map();
      for (const c of px) if (c) seen.set(c, (seen.get(c) ?? 0) + 1);
      return [...seen.entries()].sort((a, b) => b[1] - a[1]);
    };
    const t = tally(cheek);
    const base = t[0];
    const devOf = (c) => {
      const a = base[0].split(',').map(Number), b = c.split(',').map(Number);
      return Math.max(...a.map((v, i) => Math.abs(v - b[i])));
    };
    // A texel over the head is either SKIN (the base tone or its rim) or
    // something drawn ON TOP of it — a hood side, a cap brim. Those are meant
    // to cover the head's edge, so counting them as banding is wrong: the
    // hoodie's jacket colour sits 76 levels off its skin and would fail a check
    // that cannot tell the two apart. Classify by distance from the base tone.
    const skin = t.filter(([c]) => devOf(c) <= 40);
    const covered = t.filter(([c]) => devOf(c) > 40);
    rows.push({
      p, tones: skin.length, widest: base[1],
      spread: skin.length > 1 ? Math.max(...skin.slice(1).map(([c]) => devOf(c))) : 0,
      cheek: t.map(([c, n]) => `${n}x(${c})`).join(' '),
      coveredTexels: covered.reduce((n, [, k]) => n + k, 0),
      browTones: tally(brow).filter(([c]) => devOf(c) <= 40).length,
    });
  }
  return { png: cv.toDataURL(), rows };
});

writeFileSync('shots/faces.png', Buffer.from(out.png.split(',')[1], 'base64'));
console.log('faces -> shots/faces.png  (every citizen, all five painted views, head only)\n');
// A CHECK THAT CAN RETURN ZERO MUST PROVE IT CAN RETURN NON-ZERO. Every
// assertion here is inside this loop, over what __ct.atlases() returned. An
// empty return runs it zero times, leaves `fails` at 0 and exits green having
// inspected no faces at all — the vacuous pass. Six citizens at HEAD.
if (!out.rows.length) {
  console.error('\nINCONCLUSIVE — __ct.atlases() returned no citizens, so not one face was ' +
    'inspected. Every check below is inside that loop, so a pass would mean nothing.');
  await browser.close();
  process.exit(2);
}

let fails = 0;
for (const r of out.rows) {
  // ONE base tone across most of the face, and any rim within a few levels of
  // it. 3 tones is fine when two of them are single-texel rims; what must not
  // happen is a face made of wide areas.
  const bare = 10 - r.coveredTexels;
  const ok = r.widest >= bare - 2 && r.spread <= 22;
  if (!ok) fails++;
  console.log(`  ${ok ? 'OK  ' : 'FAIL'} p${r.p}: ${r.tones} skin tone(s) on the cheek row, ` +
    `base runs ${r.widest}/${bare} bare texels, rim sits ${r.spread} levels off base` +
    (r.coveredTexels ? `, ${r.coveredTexels} covered by hood/cap` : ''));
  console.log(`         ${r.cheek}`);
}
console.log(fails ? `\n${fails} face(s) still banded` : '\nevery face reads as one tone with a rim');
await browser.close();
// SAME GUARD, SAME REASON. Every assertion here is inside a loop over
// __ct.atlases(); an empty return runs the loop zero times, leaves `fails` at 0
// and exits green having inspected no faces at all. Six citizens at HEAD.
process.exitCode = fails ? 1 : 0;
