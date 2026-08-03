// Does the flagTop u/v swap explain the church flight's measured canvases EXACTLY?
//
// `flight()` in ct/civic.ts maps its approach coords (u = the axis it climbs,
// v = across it) to world differently per axis: for 'x' a box sits at
// (ox + dir*u, oz + v); for 'z' at (ox + v, oz + dir*u). `flagTop` derives the
// plazaTex canvas from the FIRST mapping unconditionally, so an axis-'z'
// flight asks for a canvas sized (u-extent x v-extent) against a face that is
// (v-extent x u-extent).
//
// This reproduces the arithmetic on paper and checks it against the canvases
// texdensity.mjs --all actually measured in the built bundle. If the "buggy"
// column reproduces the measurement, the diagnosis is the code and not a guess.
const WPM = 32, width = 4.6, n = 3, TREAD_C = 0.34;
const SET_C = 0;                       // arbitrary: only EXTENTS matter, not origin
const uTop = SET_C - 0.5, uNose = uTop - n * TREAD_C, uBack = SET_C;
const tread = (uTop - uNose) / n;

// measured, from `node scripts/texdensity.mjs --all`, owner civic, BoxGeometry/2
const measured = [
  { du: 1.52, canvas: [49, 147], ppm: [10.65, 96.71] },
  { du: 1.18, canvas: [38, 147], ppm: [8.26, 124.58] },
  { du: 0.84, canvas: [27, 147], ppm: [5.87, 175] },
];

console.log('k  du     BUGGY canvas  FIXED canvas  BUGGY ppm         FIXED ppm         vs measured');
let allMatch = true;
for (let k = 0; k < n; k++) {
  const u0 = uNose + k * tread, u1 = uBack;
  const du = Math.abs(u1 - u0), dv = width;

  // The +y face of Box(W = dv, H = h, D = du) measures dv along world x and du
  // along world z; a BoxGeometry top face runs u along +x and v along z.
  const faceU = dv, faceV = du;

  // what the code does today: x-range taken from u, z-range from v
  const bw = Math.max(8, Math.round(du * WPM));
  const bh = Math.max(8, Math.round(dv * WPM));
  const bppm = [bw / faceU, bh / faceV];

  // fixed: x-range from v, z-range from u
  const fw = Math.max(8, Math.round(dv * WPM));
  const fh = Math.max(8, Math.round(du * WPM));
  const fppm = [fw / faceU, fh / faceV];

  const m = measured[k];
  const ok = m && m.canvas[0] === bw && m.canvas[1] === bh
    && Math.abs(m.ppm[0] - bppm[0]) < 0.02 && Math.abs(m.ppm[1] - bppm[1]) < 0.02;
  if (!ok) allMatch = false;
  console.log(
    `${k}  ${du.toFixed(2)}   ${`${bw}x${bh}`.padEnd(13)}${`${fw}x${fh}`.padEnd(13)}`
    + `${`${bppm[0].toFixed(2)} x ${bppm[1].toFixed(2)}`.padEnd(18)}`
    + `${`${fppm[0].toFixed(2)} x ${fppm[1].toFixed(2)}`.padEnd(18)}`
    + (ok ? 'REPRODUCED' : 'DOES NOT MATCH'));
}

const aspect = (p) => Math.max(p[0], p[1]) / Math.min(p[0], p[1]);
console.log('\nworst aspect today :', Math.max(...measured.map((m) => aspect(m.ppm))).toFixed(1) + 'x');
console.log('worst aspect fixed :', '1.0x (both axes 32 px/m by construction)');
console.log(allMatch
  ? '\nAll three measured canvases reproduce from the swap. The diagnosis is the code.'
  : '\nThe swap does NOT explain the measurement — do not act on this.');
process.exit(allMatch ? 0 : 1);
