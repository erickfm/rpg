// Does the packed artifact actually RUN, standalone?
//
// pack-artifact.mjs verifies the build stamp is present and refuses to ship an
// unstamped bundle. Nothing verified the thing OPENS. Those are different
// questions: the artifact is a single self-contained file opened from file://,
// with no dev server, no module graph and a strict origin — so it can pack
// perfectly and still be a black rectangle for the person you sent it to, and
// the only detector has been the user opening it.
//
// Two things are checked, because the first one alone lies:
//
//   1. __ct initialises — the world was constructed
//   2. the canvas is DRAWING — mean luminance in a central box
//
// The second exists because I nearly filed the artifact as broken on a black
// screenshot taken before the first frame. __ct was up, 3383 meshes existed,
// and the picture was black purely because nothing had rendered yet. A check
// that samples too early says "broken" about a world that is fine, which is the
// same class of wrong as saying "fine" about a world that is broken.
//
//   node scripts/check-artifact.mjs            # dist/artifact.html
//   node scripts/check-artifact.mjs --pack     # build+pack a scratch copy first
//   node scripts/check-artifact.mjs --selftest # prove it can fail
//
// ── WHY `--pack` EXISTS (item 293) ──────────────────────────────────────────
//
// This check catches a packed artifact that does not open — and it was wired
// only into `npm run artifact`, which nobody runs except when publishing. So
// pack-artifact.mjs shipped a page built from ONE of the build's four chunks,
// 20 kB instead of 1.2 MB, and the only thing that would have said so was a
// script nothing called. It is registered in `npm run checks` now, and a
// registered row cannot depend on somebody having packed by hand first.
//
// It packs into `dist/artifact-build/` rather than `dist/`, DELIBERATELY: the
// suite's preview is serving `dist/`, and `vite build` empties its outDir
// before writing it. Packing into dist/ mid-suite would blank the world every
// other check is measuring (BUILDER-BRIEF §10's BUILD RACE) — a scratch outDir
// touches nothing anyone is reading.
import { chromium } from 'playwright';
import { resolve } from 'node:path';
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const SELFTEST = process.argv.includes('--selftest');
const PACK = process.argv.includes('--pack');
const SCRATCH = 'dist/artifact-build';

let FILE = resolve('dist/artifact.html');
if (PACK) {
  const rc = spawnSync('node', ['scripts/pack-artifact.mjs', '--out-dir', SCRATCH],
    { encoding: 'utf8' });
  if (rc.status !== 0) {
    // The packer refusing IS this check failing. It only refuses on a build it
    // cannot make self-contained, which is the defect this row exists for.
    console.log(`${rc.stdout ?? ''}${rc.stderr ?? ''}`.trimEnd());
    console.error('\nartifact: IT DID NOT PACK — see above. Nothing was opened.');
    process.exit(1);
  }
  process.stdout.write(rc.stdout ?? '');
  FILE = resolve(`${SCRATCH}/artifact.html`);
}
if (!existsSync(FILE)) {
  console.error(`no ${FILE} — run: node scripts/pack-artifact.mjs`);
  process.exit(2);
}

// --selftest breaks the artifact ITSELF rather than the running scene.
//
// Two mutations were tried on the scene first and BOTH failed, for the same
// reason and it is worth recording. Hiding every mesh made the frame BRIGHTER
// (99.7 -> 150.3) because the sky is scene.background, not a mesh. Blacking the
// background then did nothing, because the frame loop rewrites it from the sky
// curve every frame — the same thing that defeats clearing userData.selfLit.
//
// A mutation the world repairs is not a mutation. So this corrupts a COPY of
// the file on disk, which is the real subject: an artifact that packs and does
// not open. Deleted on exit, and it never touches dist/artifact.html.
if (SELFTEST) {
  const broken = resolve('dist/artifact-selftest.html');
  const html = readFileSync(FILE, 'utf8');
  const i = html.indexOf('<script');
  const j = html.indexOf('>', i) + 1;
  writeFileSync(broken, html.slice(0, j) + "throw new Error('selftest: deliberately broken artifact');" + html.slice(j));
  process.on('exit', () => { try { unlinkSync(broken); } catch { /* best effort */ } });
  FILE = broken;
  console.log('selftest: wrote a deliberately broken copy — this MUST now fail');
}

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 800, height: 500 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
await p.goto('file://' + FILE, { waitUntil: 'load' });

let alive = true;
try { await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 }); }
catch { alive = false; }

if (SELFTEST && alive) {
  // Hide everything AND black the sky.
  //
  // Hiding meshes alone made the frame BRIGHTER — 99.7 to 150.3 — because the
  // sky is the scene background, not a mesh, so removing the city just showed
  // more sky. The first version of this selftest therefore "failed" while the
  // check was working correctly, which is worth keeping in the file: a mutation
  // that does not produce the failure you are testing for proves nothing about
  // the detector.
  await p.evaluate(() => {
    const s = window.__ct.scene();
    s.traverse((o) => { if (o.isMesh) o.visible = false; });
    if (s.background?.setHex) s.background.setHex(0x000000);
    if (s.fog?.color?.setHex) s.fog.color.setHex(0x000000);
  });
}

let lum = -1, meshes = 0;
if (alive) {
  await p.evaluate(() => window.__ct.clock?.(13, 0));
  await p.waitForTimeout(2500);            // let it draw before judging the picture
  meshes = await p.evaluate(() => { let n = 0; window.__ct.scene().traverse((o) => { if (o.isMesh) n++; }); return n; });
  lum = await p.evaluate(() => {
    const cv = document.querySelector('canvas');
    const g = cv.getContext('webgl2') || cv.getContext('webgl');
    const px = new Uint8Array(4 * 200 * 100);
    g.readPixels(300, 200, 200, 100, g.RGBA, g.UNSIGNED_BYTE, px);
    let s = 0; for (let i = 0; i < px.length; i += 4) s += (px[i] + px[i + 1] + px[i + 2]) / 3;
    return +(s / (px.length / 4)).toFixed(1);
  });
}
await b.close();

const drawing = lum > 8;
const ok = alive && drawing && !errs.length;
console.log(alive ? `artifact: __ct initialised, ${meshes} meshes, mean luminance ${lum}`
                  : 'artifact: __ct NEVER APPEARED — it does not open');
if (errs.length) console.log('  page errors:\n    ' + errs.slice(0, 4).join('\n    '));

if (SELFTEST) {
  if (!ok) { console.log('SELFTEST PASSED — an artifact drawing nothing was caught'); process.exit(0); }
  console.error('SELFTEST FAILED — every mesh was hidden and this still called it fine.');
  process.exit(2);
}
if (ok) { console.log('  it opens standalone and draws'); process.exit(0); }
console.error(drawing ? '' : '  THE CANVAS IS BLACK. It packs and it does not show the world.');
process.exit(1);
