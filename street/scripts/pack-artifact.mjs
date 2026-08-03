// Inline the built JS into a single self-contained HTML for the artifact.
//
// This BUILDS FIRST unless you pass --no-build. It did not, and that made the
// artifact quietly destructible: `vite build` wipes dist/ and does not re-pack,
// so any later build deletes artifact.html, and any build between packing and
// publishing leaves you holding a file that no longer matches the tree. Both
// happened. Since the whole point of the artifact is being able to say which
// build somebody is looking at, "the pack step is a separate thing you have to
// remember" was the wrong shape.
//
//   node scripts/pack-artifact.mjs                 build, then pack
//   node scripts/pack-artifact.mjs --no-build      pack whatever is in dist/
//   node scripts/pack-artifact.mjs --out-dir DIR   build and pack in DIR, not dist/
//
// ── IT PACKED ONE CHUNK OUT OF FOUR AND SAID `packed` (item 293) ────────────
//
// The ordinary build is CODE-SPLIT: an entry plus three chunks — `hud`, `slots`
// (both reached by `import('./hud')` / `import('./slots')` at ct/blackjack.ts,
// ct/library-pc.ts, ct/slots.ts) and `three.core`, which three's own package
// splits out. This script inlined `readdirSync('dist/assets').filter(.js)[0]`,
// and `readdirSync` returns them SORTED, so `[0]` was `hud-*.js` — 19 kB of the
// 1,185 kB the page needs. The other three stayed as separate files that do not
// exist beside a single-file artifact, and the three `<link rel=modulepreload>`
// tags pointing at them were copied through untouched. Measured on the packed
// file: `__ct NEVER APPEARED`, three CORS-blocked `file:///assets/...` fetches,
// black canvas. It shipped a 20 kB page in place of a 1.2 MB one.
//
// BOTH GUARDS BELOW PASSED ON IT, and that is the part worth keeping. They were
// CEILINGS — "the module tag is no longer there", "a stamp is present somewhere"
// — and a ceiling cannot tell you what is MISSING. The stamp guard passed for a
// nastier reason still: the stamp is painted by `ct/hud.ts`, so it lives in the
// one chunk that got inlined. Two guards, both green, on a page that could not
// boot.
//
// So the fix is in two halves and needs both:
//
//   1. BUILD IT AS ONE CHUNK. `codeSplitting: false` for this build only —
//      `npm run build` and the Pages workflow keep their split output, which is
//      correct for a page served over HTTP with a real asset directory.
//   2. ACCOUNT FOR EVERY BYTE THE BUILD EMITTED. Not "did something get
//      replaced" but "is every file in assets/ inside the page now, and does the
//      page still name anything it cannot reach". That is a FLOOR: it fails on
//      what is absent, so a build that splits again — a new dynamic import, a
//      vite default that changes, someone running --no-build over an ordinary
//      `npm run build` — stops the pack dead instead of shipping a fifth of a
//      world.
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';

const argv = process.argv.slice(2);
const noBuild = argv.includes('--no-build');
const oi = argv.indexOf('--out-dir');
const outDir = oi >= 0 ? argv[oi + 1] : 'dist';
if (oi >= 0 && !outDir) { console.error('--out-dir needs a directory'); process.exit(2); }

if (!noBuild) {
  // Vite's JS API rather than `npx vite build`, because this build is not the
  // ordinary one and has to say so: `codeSplitting: false` is the whole reason
  // the packed page can be a single file. `configFile` is passed explicitly so
  // vite.config.ts still applies — the build stamp plugin AND the shared-checkout
  // guard both live in it, and a build that skipped the config would skip both.
  const { build } = await import('vite');
  await build({
    configFile: 'vite.config.ts',
    logLevel: 'warn',
    build: { outDir, rolldownOptions: { output: { codeSplitting: false } } },
  });
} else if (!existsSync(join(outDir, 'index.html'))) {
  console.error(`--no-build, but ${outDir}/ has no build in it. Drop the flag.`);
  process.exit(2);
}

const html = readFileSync(join(outDir, 'index.html'), 'utf8');

// THE ENTRY IS WHATEVER THE PAGE SAYS IT IS. Never readdir, never a hand-picked
// name: the hash changes every build, and the directory listing is sorted by
// name, which is the bug this file is named after.
const tag = html.match(/<script type="module"[^>]*\ssrc="([^"]+)"[^>]*><\/script>/);
if (!tag) {
  console.error(`${outDir}/index.html has no module script tag — the build changed shape.`);
  process.exit(1);
}
const entry = tag[1].replace(/^\//, '');

// EVERY asset the page names, not only the script: a `<link rel=modulepreload>`
// or a stylesheet left pointing at ./assets/ is a file the artifact does not
// carry, and on file:// it is a CORS error rather than a 404.
const named = [...html.matchAll(/(?:src|href)="([^"]*\bassets\/[^"]+)"/g)]
  .map((m) => m[1].replace(/^\//, ''))
  .filter((f) => f !== entry);

// EVERY file the build EMITTED, which is the other half of the floor. The page
// naming only one asset is not proof the build produced only one — a chunk can
// be reached by a dynamic `import()` inside the entry and never appear in the
// HTML at all, which is exactly how `slots` and `hud` are loaded.
const assetsDir = join(outDir, 'assets');
const emitted = existsSync(assetsDir) ? readdirSync(assetsDir).filter((f) => f !== basename(entry)) : [];

if (named.length || emitted.length) {
  console.error('THIS BUILD IS SPLIT ACROSS SEVERAL FILES AND CANNOT BE ONE PAGE.\n');
  console.error(`  entry, inlined:  ${entry}  (${statSync(join(outDir, entry)).size.toLocaleString()} bytes)`);
  for (const f of named) console.error(`  page also names:  ${f}   ← would 404 / CORS-fail beside a single file`);
  for (const f of emitted) {
    const s = statSync(join(assetsDir, f)).size;
    console.error(`  build also emitted: assets/${f}  (${s.toLocaleString()} bytes)   ← nothing would load it`);
  }
  console.error('\n  A packed artifact is ONE file opened from file://. Anything it does not');
  console.error('  contain, it cannot fetch. Packing this would ship a page that opens black.');
  console.error(noBuild
    ? '\n  Fix: drop --no-build. This script builds with codeSplitting:false; an\n       ordinary `npm run build` is split on purpose and cannot be packed.\n'
    : '\n  Fix: something re-enabled code splitting for this build. See the header.\n');
  process.exit(1);
}

const src = readFileSync(join(outDir, entry), 'utf8');
const out = html.replace(/<script type="module"[^>]*><\/script>/,
  () => `<script type="module">\n${src}\n</script>`);
if (out.includes('<script type="module" crossorigin src=')) {
  console.error('the module tag was not replaced — dist/index.html changed shape');
  process.exit(1);
}
// FLOOR, not ceiling: the entry's bytes are IN the page, and the page no longer
// points at anything outside itself. The old guard asked only whether the tag
// had stopped being there, which a page that inlined the wrong 19 kB also
// satisfies.
if (!out.includes(src)) {
  console.error('the entry chunk is not in the packed page — the replacement dropped it');
  process.exit(1);
}
if (/(?:src|href)="[^"]*\bassets\//.test(out)) {
  console.error('the packed page still points at ./assets/ — it is not self-contained');
  process.exit(1);
}
writeFileSync(join(outDir, 'artifact.html'), out);

// The stamp is baked at build time, so it is the honest answer to "which build
// is this?" — read it back out of what we just wrote rather than asking git,
// which would report the tree rather than the bundle.
// Minified, the stamp survives as a quoted-or-backticked hex sha immediately
// followed by its 13-digit epoch — distinctive enough to find without
// depending on the minifier keeping our identifier names.
//
// NOTE it is NOT evidence that the right thing was packed: the stamp is painted
// by ct/hud.ts, and in the split build that was the one chunk that DID get
// inlined, so this guard was green throughout item 293. The floors above are
// what make the claim; this one only says which build you are holding.
const stamp = out.match(/[`'"]([0-9a-f]{7,12})[`'"]\s*,\s*[\w$]+\s*=\s*(\d{13})/);
if (!stamp) {
  console.error('packed, but the build stamp is not in the bundle — publishing this');
  console.error('would hand over an artifact that cannot say which build it is.');
  process.exit(1);
}
const when = new Date(+stamp[2]).toTimeString().slice(0, 5);
// BYTES, not `out.length`. A JS string's length is UTF-16 code units, and this
// bundle carries enough non-ASCII (em dashes, accents, box-drawing) that the two
// differ: 1,115,475 vs 1,115,685 on the first build that was measured both ways
// — a 210-byte undercount reported under the label "bytes". Harmless until
// somebody compares the printed number against `ls -la` or a published upload to
// decide whether the artifact they are holding is the one that was packed, which
// is exactly what the size is for. Derived from the same string that was just
// written, so it cannot drift from the file.
const bytes = Buffer.byteLength(out, 'utf8');
console.log(`packed ${outDir}/artifact.html — ${bytes.toLocaleString()} bytes, build ${stamp[1]} ${when}`);
console.log(`  inlined ${entry} whole (${Buffer.byteLength(src, 'utf8').toLocaleString()} bytes); nothing else was emitted`);
