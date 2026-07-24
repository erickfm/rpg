// Inline the built JS into a single self-contained HTML for the artifact.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
const html = readFileSync('dist/index.html', 'utf8');
const js = readdirSync('dist/assets').filter((f) => f.endsWith('.js'))[0];
const src = readFileSync(`dist/assets/${js}`, 'utf8');
const out = html.replace(/<script type="module"[^>]*><\/script>/,
  () => `<script type="module">\n${src}\n</script>`);
writeFileSync('dist/artifact.html', out);
console.log('packed', out.length, 'bytes');
