import { chromium } from 'playwright';
const b = await chromium.launch(); const p = await b.newPage();
await p.goto(process.env.SHOT_URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.seats !== undefined, { timeout: 30000 });
console.log(await p.evaluate(() => window.__ct.seats()
  .filter(s => s.label === 'sit at the table')
  .map(s => `${s.pose.x.toFixed(2)}, ${s.pose.z.toFixed(2)}  yaw ${s.pose.yaw.toFixed(2)}  approach ${s.at.x.toFixed(2)}, ${s.at.z.toFixed(2)}`)
  .join('\n')));
await b.close();
