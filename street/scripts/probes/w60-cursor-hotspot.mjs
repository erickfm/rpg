// ITEM 133 — "the mouse cursor is a bit misaligned. like the stick part."
//
// Renders both cursors the way `cursorUrl` renders them (S = 2 into a 32 x 32
// PNG), blown up so a pixel is visible, with the DECLARED hotspot marked. Then
// says, in numbers, where the drawn tip and the drawn fingertip actually are.
//
// THE ART IS PARSED OUT OF ct/hud.ts, never retyped — a second hand-typed copy
// of the thing under test is how you prove a cursor that does not exist. The
// hotspots are parsed out of the same file for the same reason.
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const SRC = 'src/proto/ct/hud.ts';
const src = readFileSync(SRC, 'utf8');

function artOf(name) {
  const m = src.match(new RegExp(`const ${name} = \\[([\\s\\S]*?)\\];`));
  if (!m) throw new Error(`${name} not found in ${SRC}`);
  const rows = [...m[1].matchAll(/'([^']*)'/g)].map((r) => r[1]);
  const at = src.slice(0, m.index).split('\n').length;
  return { rows, line: at };
}
function hotOf(url) {
  // cursorAs(`url(${X_URL}) 9 0, pointer`)
  const m = src.match(new RegExp(`url\\(\\$\\{${url}\\}\\)\\s+(-?\\d+)\\s+(-?\\d+)`));
  if (!m) throw new Error(`hotspot for ${url} not found`);
  const at = src.slice(0, m.index).split('\n').length;
  return { x: +m[1], y: +m[2], line: at };
}
const S = +(src.match(/const S = (\d+), N = (\d+);/) ?? [, 2])[1];
const N = +(src.match(/const S = (\d+), N = (\d+);/) ?? [, , 16])[2];

const subjects = [
  { name: 'ARROW', art: artOf('ARROW_ART'), hot: hotOf('ARROW_URL'), want: 'the point' },
  { name: 'HAND', art: artOf('HAND_ART'), hot: hotOf('HAND_URL'), want: 'the fingertip' },
];

console.log(`rasteriser: S = ${S}, N = ${N}  ->  a ${N * S} x ${N * S} PNG`);
console.log('HOTSPOTS ARE IN THE PIXELS OF THAT PNG, so a source-grid coordinate');
console.log('must be doubled to be right. Checking whether each one was.\n');

for (const s of subjects) {
  console.log(`── ${s.name} (art at ${SRC}:${s.art.line}, hotspot at :${s.hot.line}) ──`);
  const rows = s.art.rows;
  if (rows.length !== N) console.log(`  *** art is ${rows.length} rows, not ${N} ***`);
  rows.forEach((r, i) => { if (r.length !== N) console.log(`  *** row ${i} is ${r.length} chars, not ${N}: "${r}" ***`); });

  // where is the topmost drawn pixel — the tip / the fingertip — in SOURCE cells
  let topRow = -1, topCells = [];
  for (let y = 0; y < rows.length && topRow < 0; y++) {
    const xs = [...rows[y]].map((c, x) => (c !== ' ' ? x : -1)).filter((x) => x >= 0);
    if (xs.length) { topRow = y; topCells = xs; }
  }
  const cLo = Math.min(...topCells), cHi = Math.max(...topCells);
  // that cell range, in the pixels of the rasterised PNG
  const pLo = cLo * S, pHi = cHi * S + (S - 1);
  console.log(`  topmost drawn row is source row ${topRow}, cells x ${cLo}…${cHi}`);
  console.log(`  which is PNG pixels x ${pLo}…${pHi}, y ${topRow * S}…${topRow * S + S - 1}`);
  console.log(`  declared hotspot: (${s.hot.x}, ${s.hot.y})  — "${s.want}"`);
  const inX = s.hot.x >= pLo && s.hot.x <= pHi;
  const inY = s.hot.y >= topRow * S && s.hot.y <= topRow * S + S - 1;
  console.log(`  lands on ${s.want}: ${inX && inY ? 'YES' : 'NO'}`
    + `${inX ? '' : `  (x is ${s.hot.x < pLo ? pLo - s.hot.x : s.hot.x - pHi} px outside)`}`
    + `${inY ? '' : '  (wrong row)'}`);
  // and the thing the factor-of-two would show up as
  if (!inX && s.hot.x * 2 >= pLo && s.hot.x * 2 <= pHi) console.log('  *** but 2x the declared x DOES land on it — the hotspot is in SOURCE cells ***');

  // OUTLINE CONTINUITY: every fill cell must have a drawn neighbour on all four
  // sides, or the white leaks out through a hole in the black.
  const at = (x, y) => rows[y]?.[x] ?? ' ';
  const leaks = [];
  for (let y = 0; y < rows.length; y++) for (let x = 0; x < N; x++) {
    if (at(x, y) !== '.') continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]])
      if (at(x + dx, y + dy) === ' ') leaks.push(`(${x},${y})→(${x + dx},${y + dy})`);
  }
  console.log(`  white fill leaking through the outline: ${leaks.length ? leaks.join(' ') : 'none'}`);

  // STRAY OUTLINE: a black cell with no fill anywhere around it.
  //
  // READ THE RESULT OF THIS ONE CAREFULLY — it has two legitimate answers. A
  // 1-cell-wide POINT of the shape has no fill beside it either, and both of
  // the arrow's points are exactly that: the apex at (0,0) and the bottom of
  // the left barb at (0,14). Tracing the outline as a closed polygon —
  //   (0,0) down the left edge to (0,14), up the barb's inner diagonal to
  //   (3,11), down the tail's left edge to (6,14), across the cap (7,15) (8,15),
  //   up the tail's right edge to (6,11), right along the head's underside to
  //   (9,10), and up the long diagonal back to (0,0)
  // — closes with no gaps and encloses every fill cell. So the arrow IS one
  // continuous shape, and neither flag below is a defect. This comment exists
  // because the flag reads like one, and acting on it would have DELETED THE
  // POINT OF THE ARROW.
  const strays = [];
  for (let y = 0; y < rows.length; y++) for (let x = 0; x < N; x++) {
    if (at(x, y) !== 'X') continue;
    let touchesFill = false;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++)
      if (at(x + dx, y + dy) === '.') touchesFill = true;
    if (!touchesFill) strays.push(`(${x},${y})`);
  }
  console.log(`  outline cells touching no fill at all: ${strays.length ? strays.join(' ') : 'none'}`
    + `${strays.length ? '   <- 1-cell POINTS of the shape, not spurs; see the note above' : ''}`);
  console.log('');
  s.strays = strays.map((t) => t.slice(1, -1).split(',').map(Number));
}

// draw them, big, with the hotspot marked
const html = `<body style="margin:0;background:#3b3b3b;font:12px monospace;color:#eee">
<div style="display:flex;gap:28px;padding:20px">${subjects.map((s) => `
  <div><div style="margin-bottom:6px">${s.name} — hotspot (${s.hot.x}, ${s.hot.y}) in PNG px</div>
  <canvas id="c${s.name}" width="${N * S * 14}" height="${N * S * 14}"
    style="image-rendering:pixelated;border:1px solid #666"></canvas></div>`).join('')}
</div><script>
const Z = 14, S = ${S}, N = ${N};
for (const s of ${JSON.stringify(subjects.map((s) => ({ name: s.name, rows: s.art.rows, hot: s.hot, strays: s.strays })))}) {
  const g = document.getElementById('c' + s.name).getContext('2d');
  // exactly what cursorUrl does, then scaled up by Z
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const ch = s.rows[y] ? s.rows[y][x] : ' '; if (!ch || ch === ' ') continue;
    g.fillStyle = ch === 'X' ? '#000' : '#fff';
    g.fillRect(x * S * Z, y * S * Z, S * Z, S * Z);
  }
  // faint grid on the PNG's own pixels, so the 2x is visible
  g.strokeStyle = 'rgba(255,0,0,0.18)';
  for (let i = 0; i <= N * S; i++) {
    g.beginPath(); g.moveTo(i * Z, 0); g.lineTo(i * Z, N * S * Z); g.stroke();
    g.beginPath(); g.moveTo(0, i * Z); g.lineTo(N * S * Z, i * Z); g.stroke();
  }
  // outline cells enclosing nothing — blue. The arrow's apex is a legitimate
  // one; anything else is a spur hanging off a shape that already closed.
  g.strokeStyle = '#2ec8ff'; g.lineWidth = 3;
  for (const [sx, sy] of (s.strays || []))
    g.strokeRect(sx * S * Z, sy * S * Z, S * Z, S * Z);
  // THE DECLARED HOTSPOT, one PNG pixel, in red
  g.fillStyle = 'rgba(255,40,40,0.95)';
  g.fillRect(s.hot.x * Z, s.hot.y * Z, Z, Z);
  g.strokeStyle = '#ff2828'; g.lineWidth = 2;
  g.strokeRect(s.hot.x * Z - 3, s.hot.y * Z - 3, Z + 6, Z + 6);
}
</script></body>`;
writeFileSync('/tmp/w60-cursor.html', html);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1080, height: 560 } });
await p.goto('file:///tmp/w60-cursor.html');
await p.waitForTimeout(300);
await p.screenshot({ path: 'shots/w60-cursor-hotspots.png' });
console.log('shots/w60-cursor-hotspots.png — red square is the declared hotspot, one PNG pixel');
await b.close();
