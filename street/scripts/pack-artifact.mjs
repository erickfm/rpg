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
//   node scripts/pack-artifact.mjs              build, then pack
//   node scripts/pack-artifact.mjs --no-build   pack whatever is in dist/
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const noBuild = process.argv.includes('--no-build');
if (!noBuild) {
  execFileSync('npx', ['vite', 'build'], { stdio: ['ignore', 'ignore', 'inherit'] });
} else if (!existsSync('dist/index.html')) {
  console.error('--no-build, but dist/ has no build in it. Drop the flag.');
  process.exit(2);
}

const html = readFileSync('dist/index.html', 'utf8');
const js = readdirSync('dist/assets').filter((f) => f.endsWith('.js'))[0];
const src = readFileSync(`dist/assets/${js}`, 'utf8');
const out = html.replace(/<script type="module"[^>]*><\/script>/,
  () => `<script type="module">\n${src}\n</script>`);
if (out.includes('<script type="module" crossorigin src=')) {
  console.error('the module tag was not replaced — dist/index.html changed shape');
  process.exit(1);
}
writeFileSync('dist/artifact.html', out);

// The stamp is baked at build time, so it is the honest answer to "which build
// is this?" — read it back out of what we just wrote rather than asking git,
// which would report the tree rather than the bundle.
// Minified, the stamp survives as a quoted-or-backticked hex sha immediately
// followed by its 13-digit epoch — distinctive enough to find without
// depending on the minifier keeping our identifier names.
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
console.log(`packed dist/artifact.html — ${bytes.toLocaleString()} bytes, build ${stamp[1]} ${when}`);
