// "the neighbor is out looking into my apt way too often" — QUANTIFIED.
// I filed this CANNOT VERIFY before because the predicate was not reachable
// from outside. It is a pure function of the absolute hour (apartment.ts:2174),
// so it can be computed exactly rather than sampled by standing about.
const HERMIT_GAP = 6;
const raw = (hAbs) => { const h = ((hAbs % 24) + 24) % 24;
  const chance = h >= 12 && h < 18 ? 0.16 : h >= 8 && h < 22 ? 0.06 : 0.015;
  return ((((hAbs + 7) * 2654435761) >>> 0) % 1000) < chance * 1000; };
const isIn = (hAbs) => { if (!raw(hAbs)) return false;
  for (let k = 1; k <= HERMIT_GAP; k++) if (raw(hAbs - k)) return false;
  return true; };
const DAYS = 3650, H = DAYS * 24;
let out = 0, rawOut = 0; const byHour = new Array(24).fill(0), gaps = []; let last = null;
for (let h = 0; h < H; h++) {
  if (raw(h)) rawOut++;
  if (isIn(h)) { out++; byHour[((h % 24) + 24) % 24]++; if (last !== null) gaps.push(h - last); last = h; }
}
const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
const srt = [...gaps].sort((a, b) => a - b);
console.log(`\nover ${DAYS} days (${H} hours), computed from the schedule itself:`);
console.log(`  hours he is OUT            ${out}  (${(100 * out / H).toFixed(2)}% of all hours)`);
console.log(`  appearances per day        ${(out / DAYS).toFixed(3)}  — about one every ${(24 * DAYS / out).toFixed(1)} hours`);
console.log(`  gap between appearances    min ${srt[0]}h  median ${srt[srt.length >> 1]}h  mean ${mean.toFixed(1)}h  max ${srt[srt.length - 1]}h`);
console.log(`  the ${HERMIT_GAP}-hour lockout holds: ${srt[0] > HERMIT_GAP ? 'YES' : '** NO — a gap of ' + srt[0] + 'h'}`);
console.log(`  before the lockout he would be out ${rawOut} hours (${(100 * rawOut / H).toFixed(2)}%) — the lockout removes ${(100 * (rawOut - out) / rawOut).toFixed(0)}%`);
console.log(`\n  by hour of day (he favours afternoons, 12-18):`);
let line = '   ';
for (let h = 0; h < 24; h++) line += `${String(h).padStart(3)}`;
console.log(line); line = '   ';
for (let h = 0; h < 24; h++) line += `${String(byHour[h]).padStart(3)}`;
console.log(line);
console.log(`\n  FOR CONTRAST, the 0.7 hourly chance C replaced: he would be out`);
console.log(`  about 70% of hours before any lockout — roughly ${(0.7 * 24).toFixed(0)} hours a day.`);
