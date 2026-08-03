// w64: read the user's own frame numerically. Prints a coarse luminance map of
// a region so the "hard edge" can be located in pixels rather than described.
// usage: node w64-scanline.mjs <png> [x0 x1 y0 y1 stepx stepy]
import { execFileSync } from 'node:child_process';
const [png, x0 = 430, x1 = 730, y0 = 0, y1 = 796, sx = 20, sy = 40] =
  process.argv.slice(2).map((v, i) => (i === 0 ? v : +v));
const w = Math.round((x1 - x0) / sx), h = Math.round((y1 - y0) / sy);
const txt = execFileSync('convert', [png, '-crop', `${x1 - x0}x${y1 - y0}+${x0}+${y0}`, '+repage',
  '-resize', `${w}x${h}!`, '-colorspace', 'gray', '-depth', '8', 'txt:-']).toString();
const grid = Array.from({ length: h }, () => new Array(w).fill(0));
for (const line of txt.split('\n')) {
  const m = /^(\d+),(\d+):\s*\((\d+)/.exec(line);
  if (m) grid[+m[2]][+m[1]] = +m[3];
}
const ramp = ' .:-=+*#%@';
console.log(`${png}  x ${x0}..${x1}  y ${y0}..${y1}`);
console.log('     ' + Array.from({ length: w }, (_, i) => String(x0 + i * sx).padStart(4)).join(''));
grid.forEach((row, j) => {
  console.log(String(y0 + j * sy).padStart(4) + ' ' + row.map(v => String(v).padStart(4)).join('') +
    '   ' + row.map(v => ramp[Math.min(9, Math.floor(v / 12))]).join(''));
});
