import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage();
await p.goto(process.env.SHOT_URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
console.log(await p.evaluate(async () => {
  const s = window.__ct.scene(), f = s.userData.rainAt;
  const wet = []; for (let h = 0; h < 96; h++) if (f(h)) wet.push(h);
  const over24 = wet.filter(h => h >= 24);
  const lines = [`rainAt() wet hours 0..95: ${wet.join(', ')}`,
    `of those, >= 24: ${over24.join(', ')}`,
    `for each, does rainAt(h % 24) agree?`];
  for (const h of over24) lines.push(`   h=${h}  rainAt(${h})=${f(h)}   rainAt(${h % 24})=${f(h % 24)}  ${f(h % 24) ? 'agrees' : '<-- DISAGREES: %24 would test a DRY hour'}`);
  // and measure it live for the first disagreeing one
  const bad = over24.find(h => !f(h % 24));
  if (bad === undefined) { lines.push('no disagreement in 0..95'); return lines.join('\n'); }
  window.__ct.warp(-6, -40, 0, 0.14, 0);
  const settle = async () => { let r = 0; for (let i = 0; i < 60; i++) { await new Promise(t => setTimeout(t, 250)); const n = s.userData.rainLevel; if (i > 6 && Math.abs(n - r) < 0.002) return n; r = n; } return r; };
  window.__ct.clock(bad % 24, 30); const dry = await settle();
  window.__ct.clock(bad, 30);      const rainy = await settle();
  lines.push(`\nLIVE, outdoors:  clock(${bad} % 24 = ${bad % 24}) -> rainLevel ${dry.toFixed(4)}`);
  lines.push(`                 clock(${bad})            -> rainLevel ${rainy.toFixed(4)}`);
  return lines.join('\n');
}));
await b.close();
