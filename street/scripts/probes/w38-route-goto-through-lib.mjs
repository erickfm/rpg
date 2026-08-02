// w38 — ITEM 76. Route the 12 fast-tier checks' bare `page.goto` through the
// shared `goto` in scripts/lib/reachable.mjs, which already exits 3 on a
// refused connection (GOTCHAS 32) instead of letting node turn an uncaught
// throw into exit 1.
//
// A CODEMOD RATHER THAN 13 HAND EDITS, on purpose: the change is character-for-
// character identical in every file, and the failure mode of doing it by hand
// is a typo in exactly one of them — which would then be the one check still
// reporting a dead port as a broken world, and the hardest to notice.
//
// It rewrites nothing it does not recognise: a file with no matching goto, or
// one already importing reachable.mjs, is reported and left alone.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const FILES = ['lot-frontage', 'mirror-walk', 'I-apron-grain', 'people-walk',
  'floaters-walk', 'jump-walk', 'gaps', 'feet-check', 'side-night',
  'A-eye-height-holds', 'K-seat-lets-you-up', 'O-jail-door-agree'];

const GOTO = /await (\w+)\.goto\((.+?), \{ waitUntil: 'networkidle' \}\);/g;
const IMPORT = "import { goto } from './lib/reachable.mjs';";

let totalSites = 0;
for (const name of FILES) {
  const path = join(import.meta.dirname, `../${name}.mjs`);
  const src = readFileSync(path, 'utf8');

  const sites = [...src.matchAll(GOTO)];
  if (!sites.length) { console.log(`  SKIP  ${name} — no bare goto matched`); continue; }
  if (src.includes('lib/reachable.mjs')) { console.log(`  SKIP  ${name} — already routed`); continue; }

  let out = src.replace(GOTO, 'await goto($1, $2);');

  // Insert the import after the which-world import every one of these shares,
  // so the import block keeps its existing shape.
  const anchor = out.match(/^import \{ reportWorld \}.*$/m);
  if (!anchor) { console.log(`  SKIP  ${name} — no reportWorld import to anchor to`); continue; }
  out = out.replace(anchor[0], `${anchor[0]}\n${IMPORT}`);

  writeFileSync(path, out);
  totalSites += sites.length;
  console.log(`  ok    ${name} — ${sites.length} call site(s) routed`);
}
console.log(`\n${totalSites} call sites routed through lib/reachable.mjs goto`);
