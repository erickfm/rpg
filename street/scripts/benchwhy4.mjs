// gy disproved and the reader is fine. The remaining difference: it failed on
// seat 1 of 57 -- the FIRST seat tested, 300 ms after __ct appears. Everything
// after it had seconds of world time. Test readiness directly.
import { chromium } from 'playwright';
const b = await chromium.launch();
for (const settle of [300, 800, 1500, 3000]) {
  const p = await b.newPage({ viewport: { width: 900, height: 600 } });
  await p.goto('http://localhost:4184/', { waitUntil: 'networkidle' });
  await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
  await p.waitForTimeout(settle);                       // seats-walk waits 300
  const r = await p.evaluate(async () => {
    const read = () => { const d=document.getElementById('ct-prompt');
      return d && d.style.display !== 'none' ? d.textContent : null; };
    const seat = window.__ct.spots().find(s => /sit on the bench/.test(s.label||'') );
    window.__ct.warp(-8.6, -19.43, 0, 0, 0);
    await new Promise(x=>requestAnimationFrame(x)); await new Promise(x=>requestAnimationFrame(x));
    await new Promise(x=>setTimeout(x,140));            // seats-walk waits 140
    return { nSpots: window.__ct.spots().length, seatFound: !!seat,
             seatOk: seat ? seat.ok : null, prompt: read() };
  });
  console.log(`settle ${String(settle).padStart(4)} ms → ${r.nSpots} spots · seat registered ${r.seatFound} · ok ${r.seatOk} · prompt: ${r.prompt ?? 'NULL'}`);
  await p.close();
}
await b.close();
