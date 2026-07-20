// Headless smoke test for CITY 98: boots the game in Chromium, drives the
// real flows — eating, working, driving, sleeping — and fails on any page
// error. Usage: npm run build && npx vite preview --port 4175 &  then
//   node scripts/smoke.mjs [screenshotDir]
import { chromium } from 'playwright';

const URL = process.env.SMOKE_URL ?? 'http://localhost:4175/';
const shotDir = process.argv[2] ?? null;

const browser = await chromium.launch();
const errors = [];
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
await page.addInitScript(() => localStorage.removeItem('city98-save'));
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(2200);

const hud = async () =>
  (await page.evaluate(() =>
    `${document.getElementById('hud-clock')?.textContent} ${document.getElementById('hud-cash')?.textContent}`
  )) ?? '';
const dlg = async () =>
  (await page.evaluate(() => document.querySelector('.win')?.textContent ?? '')).replace(/\s+/g, ' ');
const ev = (fn, arg) => page.evaluate(fn, arg);

// title screen: three save slots, all empty on a fresh boot
{
  const menu = await ev(() => document.getElementById('title-menu')?.textContent ?? '');
  if (!menu.includes('Slot 1') || !menu.includes('Slot 3')) errors.push(`save slots missing on title: ${menu}`);
}

await ev(() => window.__city.startGame());
await ev(() => window.__city.dismissLock());
let h = await hud();
if (!h.includes('Monday · Day 1')) errors.push(`boot HUD wrong: ${h}`);
if (!h.includes('$140')) errors.push(`boot cash wrong: ${h}`);
if (shotDir) await page.screenshot({ path: `${shotDir}/c98-spawn.png` });

// --- minimap + full city map ---
if (!(await page.$('#minimap-canvas'))) errors.push('minimap missing at spawn');
await ev(() => window.__city.toggleMap());
await page.waitForTimeout(150);
if (!(await ev(() => window.__city.mapOpen()))) errors.push('city map did not open');
if (shotDir) await page.screenshot({ path: `${shotDir}/c98-map.png` });
await ev(() => window.__city.toggleMap());
await page.waitForTimeout(100);
if (await ev(() => window.__city.mapOpen())) errors.push('city map did not close');

// waypoint routing: set one, confirm the nav chip, then walk onto it to arrive
await ev(() => window.__city.teleport(-6, -10, 0));
if (!(await ev(() => window.__city.route('Datacorp')))) errors.push('route to Datacorp failed');
if ((await ev(() => window.__city.waypoint())) !== 'Datacorp') errors.push('waypoint not set');
await page.waitForTimeout(150);
if (await ev(() => document.getElementById('nav').hidden)) errors.push('nav chip hidden with a waypoint set');
await ev(() => window.__city.teleport(0, -50, 0)); // Datacorp front
await page.waitForTimeout(200);
if ((await ev(() => window.__city.waypoint())) !== null) errors.push('waypoint did not clear on arrival');

// --- diner: walk in, eat the special at the counter ---
await ev(() => window.__city.teleport(12, -28.6, Math.PI));
await page.waitForTimeout(150);
await ev(() => window.__city.interact()); // through the door
await page.waitForTimeout(200);
if ((await ev(() => window.__city.mode())) !== 'diner') errors.push('did not enter the diner');
if (shotDir) {
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${shotDir}/c98-diner.png` });
}
await ev(() => window.__city.teleport(1000, -2.6));
await ev(() => window.__city.interact());
await page.waitForTimeout(250);
let d = await dlg();
if (!d.includes('Sunrise Diner')) errors.push(`diner dialog missing: ${d}`);
await page.keyboard.press('3'); // Big Slam Special $11
await page.waitForTimeout(200);
h = await hud();
if (!h.includes('$129')) errors.push(`meal not charged (want $129): ${h}`);
await page.keyboard.press('Escape');
await ev(() => window.__city.teleport(1000, 4.8));
await ev(() => window.__city.interact()); // leave
await page.waitForTimeout(150);
if ((await ev(() => window.__city.mode())) !== 'outside') errors.push('did not exit the diner');

// --- video store: walk in, clock in at the register ---
await ev(() => window.__city.setMinute(10 * 60));
await ev(() => window.__city.teleport(-14, -27.6, Math.PI));
await ev(() => window.__city.interact());
await page.waitForTimeout(200);
if ((await ev(() => window.__city.mode())) !== 'video') errors.push('did not enter Video Palace');
await ev(() => window.__city.teleport(995.4, 296.8));
await ev(() => window.__city.interact());
await page.waitForTimeout(250);
d = await dlg();
if (!d.includes('Video Palace')) errors.push(`video dialog missing: ${d}`);
await page.keyboard.press('1');
await page.waitForTimeout(250);
h = await hud();
if (!h.includes('$173')) errors.push(`shift not paid (want $173): ${h}`);
await ev(() => window.__city.teleport(1000, 305.3));
await ev(() => window.__city.interact());
await page.waitForTimeout(150);

// --- arcade: drop a couple of quarters ---
await ev(() => window.__city.teleport(-12, 27.6, 0));
await ev(() => window.__city.interact());
await page.waitForTimeout(200);
if ((await ev(() => window.__city.mode())) !== 'arcade') errors.push('did not enter the arcade');
if (shotDir) {
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${shotDir}/c98-arcade.png` });
}
await ev(() => window.__city.teleport(996.8, 596.6));
await ev(() => window.__city.interact());
await page.waitForTimeout(250);
d = await dlg();
if (!d.includes('Neon Dragon')) errors.push(`arcade dialog missing: ${d}`);
await page.keyboard.press('1'); // Play Gutter Racer
await page.waitForTimeout(400);
// the canvas minigame should now be up
if (!(await page.$('#arcade-canvas'))) errors.push('arcade minigame canvas did not open');
// let it run a beat to accrue distance, then force a crash and collect
await page.waitForTimeout(500);
await ev(() => window.__arcade.crash());
await page.waitForTimeout(150);
await ev(() => window.__arcade.finish());
await page.waitForTimeout(200);
if (await page.$('#arcade-canvas')) errors.push('arcade minigame did not close');
h = await hud();
// paid $2 to play (171-2=169), possibly won some back
if (!/\$1[0-9][0-9]/.test(h)) errors.push(`arcade cash unexpected: ${h}`);
// second cabinet: Dragon's Tail (Snake) — still standing at the machine
await ev(() => window.__city.interact());
await page.waitForTimeout(200);
await page.keyboard.press('2'); // Play Dragon's Tail
await page.waitForTimeout(400);
if (!(await page.$('#snake-canvas'))) errors.push('snake minigame did not open');
if (shotDir) { await page.waitForTimeout(300); await page.screenshot({ path: `${shotDir}/c98-snake.png` }); }
await ev(() => window.__snake.die());
await page.waitForTimeout(150);
await ev(() => window.__snake.finish());
await page.waitForTimeout(200);
if (await page.$('#snake-canvas')) errors.push('snake minigame did not close');
// high scores: seed one, confirm it records, and open the hall of fame
await ev(() => window.__city.addScore('snake', 30));
if ((await ev(() => window.__city.topScore('snake'))) !== 30) errors.push('snake high score not recorded');
await ev(() => window.__city.interact()); // reopen the Neon Dragon
await page.waitForTimeout(200);
await page.keyboard.press('3'); // High Scores
await page.waitForTimeout(200);
d = await dlg();
if (!d.includes('High Scores')) errors.push(`high score board missing: ${d}`);
if (shotDir) await page.screenshot({ path: `${shotDir}/c98-scores.png` });
await page.keyboard.press('Escape');
await ev(() => window.__city.teleport(1000, 604.8));
await ev(() => window.__city.interact());
await page.waitForTimeout(150);

// --- drive the hatchback ---
await ev(() => window.__city.teleport(-31, 6));
await ev(() => window.__city.interact());
await page.waitForTimeout(150);
const driving = await ev(() => window.__city.isDriving());
if (!driving) errors.push('did not enter the car');
const before = await ev(() => window.__city.carPos());
await page.keyboard.down('w');
await page.waitForTimeout(2400);
await page.keyboard.up('w');
const after = await ev(() => window.__city.carPos());
const dist = Math.hypot(after[0] - before[0], after[1] - before[1]);
if (dist < 5) errors.push(`car barely moved (${dist.toFixed(1)} units)`);
if (shotDir) await page.screenshot({ path: `${shotDir}/c98-driving.png` });
await ev(() => window.__city.interact()); // park
if (await ev(() => window.__city.isDriving())) errors.push('did not exit the car');

// --- home: walk in, sleep in the actual bed ---
await ev(() => window.__city.teleport(-48.4, 0, -Math.PI / 2));
await ev(() => window.__city.interact());
await page.waitForTimeout(200);
if ((await ev(() => window.__city.mode())) !== 'home') errors.push('did not enter the apartment');
await ev(() => window.__city.teleport(997.4, 898.4));
await ev(() => window.__city.interact());
await page.waitForTimeout(250);
d = await dlg();
if (!d.includes('Maple Court')) errors.push(`home dialog missing: ${d}`);
await page.keyboard.press('1');
await page.waitForTimeout(250);
h = await hud();
if (!h.includes('Day 2')) errors.push(`sleep did not end the day: ${h}`);
await ev(() => window.__city.teleport(1000, 903.3));
await ev(() => window.__city.interact());
await page.waitForTimeout(150);
if ((await ev(() => window.__city.mode())) !== 'outside') errors.push('did not exit the apartment');

// --- Datacorp lobby: in the door, up the elevator ---
await ev(() => window.__city.setMinute(9 * 60));
await ev(() => window.__city.teleport(0, -48.4, 0));
await ev(() => window.__city.interact());
await page.waitForTimeout(200);
if ((await ev(() => window.__city.mode())) !== 'office') errors.push('did not enter the Datacorp lobby');
await ev(() => window.__city.teleport(1000, 1196.4));
await ev(() => window.__city.interact());
await page.waitForTimeout(250);
d = await dlg();
if (!d.includes('Datacorp')) errors.push(`office dialog missing: ${d}`);
await page.keyboard.press('Escape');
await ev(() => window.__city.teleport(1000, 1204.8));
await ev(() => window.__city.interact());
await page.waitForTimeout(150);

// --- Big Ray's: buy the sedan, drive away faster ---
await ev(() => window.__city.setCash(900));
await ev(() => window.__city.teleport(66, 22, Math.PI / 2));
await ev(() => window.__city.interact());
await page.waitForTimeout(250);
d = await dlg();
if (!d.includes("Big Ray")) errors.push(`dealer dialog missing: ${d}`);
await page.keyboard.press('2'); // Regalia LX ($800 after trade)
await page.waitForTimeout(250);
const carNow = await ev(() => window.__city.getState().car);
if (carNow !== 'sedan') errors.push(`car purchase failed (car=${carNow})`);
await page.keyboard.press('Escape');

// --- Gas-N-Go: buy the umbrella ---
await ev(() => window.__city.setCash(60));
await ev(() => window.__city.teleport(50.4, -14, Math.PI / 2)); // gas shop door (faces w)
await ev(() => window.__city.interact());
await page.waitForTimeout(250);
d = await dlg();
if (!d.includes('Gas-N-Go')) errors.push(`gas shop missing: ${d}`);
await page.keyboard.press('4'); // umbrella (after 3 food items)
await page.waitForTimeout(200);
if (!(await ev(() => window.__city.getState().goods.includes('up_umbrella')))) errors.push('umbrella not bought');
await page.keyboard.press('Escape');

// --- ATM: deposit, and interest accrues overnight ---
await ev(() => window.__city.setCash(200));
await ev(() => window.__city.teleport(-19.3, -30, -Math.PI / 2));
await ev(() => window.__city.interact());
await page.waitForTimeout(250);
d = await dlg();
if (!d.includes('First Federal')) errors.push(`ATM panel missing: ${d}`);
await page.keyboard.press('3'); // deposit everything
await page.waitForTimeout(200);
const savings = await ev(() => window.__city.getState().savings);
if (savings < 200) errors.push(`deposit failed (savings=${savings})`);
await page.keyboard.press('Escape');

// --- CITY HERALD: read the day's paper at the newsbox ---
await ev(() => window.__city.setDay(14)); // a holiday + Y2K day for a rich edition
await ev(() => window.__city.teleport(-15, -28.4, 0));
await ev(() => window.__city.interact());
await page.waitForTimeout(250);
d = await dlg();
if (!d.includes('CITY HERALD')) errors.push(`newspaper missing: ${d}`);
if (!d.includes('Y2K')) errors.push(`newspaper Y2K watch missing on Day 14: ${d}`);
if (shotDir) await page.screenshot({ path: `${shotDir}/c98-news.png` });
await page.keyboard.press('Escape');

// --- record store: buy a stereo + a record ---
await ev(() => window.__city.setCash(300));
await ev(() => window.__city.teleport(12, 27.6, 0)); // Spin City Records door (records faces s)
await ev(() => window.__city.interact());
await page.waitForTimeout(250);
d = await dlg();
if (!d.includes('Spin City')) errors.push(`records shop missing: ${d}`);
// buy the Component Stereo (find it in the list — it's after the 4 records)
await page.keyboard.press('5'); // 5th option = first upgrade (Component Stereo)
await page.waitForTimeout(200);
await page.keyboard.press('1'); // confirm buy
await page.waitForTimeout(200);
let goods = await ev(() => window.__city.getState().goods);
if (!goods.includes('up_stereo')) errors.push(`stereo not bought (goods=${goods})`);
await page.keyboard.press('1'); // buy first record
await page.waitForTimeout(150);
await page.keyboard.press('1');
await page.waitForTimeout(200);
goods = await ev(() => window.__city.getState().goods);
if (goods.length < 2) errors.push(`record not bought (goods=${goods})`);
await page.keyboard.press('Escape');

// --- mirror: change your shirt color ---
{
  await ev(() => window.__city.teleport(-48.4, 0, -Math.PI / 2));
  await ev(() => window.__city.interact());
  await page.waitForTimeout(200);
  if ((await ev(() => window.__city.mode())) !== 'home') errors.push('did not enter apartment for mirror');
  if (shotDir) { await page.waitForTimeout(200); }
  await ev(() => window.__city.teleport(996.0, 898.8)); // mirror station in home room
  await ev(() => window.__city.interact());
  await page.waitForTimeout(250);
  d = await dlg();
  if (!d.includes('Mirror')) errors.push(`mirror panel missing: ${d}`);
  const before = await ev(() => window.__city.getState().look.shirt);
  await page.keyboard.press('1'); // next shirt
  await page.waitForTimeout(200);
  const after = await ev(() => window.__city.getState().look.shirt);
  if (after === before) errors.push('shirt color did not change');
  if (shotDir) await page.screenshot({ path: `${shotDir}/c98-mirror.png` });
  await page.keyboard.press('Escape');
  await ev(() => window.__city.leaveRoom());
  await page.waitForTimeout(100);
}

// --- home stereo: enter apartment, play a record ---
await ev(() => window.__city.teleport(-48.4, 0, -Math.PI / 2));
await ev(() => window.__city.interact());
await page.waitForTimeout(200);
if ((await ev(() => window.__city.mode())) !== 'home') errors.push('did not enter apartment for stereo');
await ev(() => window.__city.teleport(1000.4, 897.6)); // stereo station in home room
await ev(() => window.__city.interact());
await page.waitForTimeout(250);
d = await dlg();
if (!d.includes('Component Stereo')) errors.push(`stereo panel missing: ${d}`);
await page.keyboard.press('1'); // spin a record
await page.waitForTimeout(200);

// --- home TV: turn it on, flip a channel ---
await ev(() => window.__city.teleport(1002.4, 899.2)); // TV station in home room
await ev(() => window.__city.interact());
await page.waitForTimeout(250);
d = await dlg();
if (!d.includes('Ch 1')) errors.push(`TV panel missing: ${d}`);
if (shotDir) await page.screenshot({ path: `${shotDir}/c98-tv.png` });
await page.keyboard.press('1'); // flip the channel
await page.waitForTimeout(150);
d = await dlg();
if (!d.includes('Ch 2')) errors.push(`TV did not change channel: ${d}`);
await page.keyboard.press('Escape');

await ev(() => window.__city.leaveRoom());
await page.waitForTimeout(100);

// --- payphone gig: accept a run, complete it for pay ---
await ev(() => window.__city.setMinute(12 * 60));
await ev(() => window.__city.setCash(0));
await ev(() => window.__city.teleport(-8.3, 52, 0));
await ev(() => window.__city.interact());
await page.waitForTimeout(250);
d = await dlg();
if (!d.includes('Odd Jobs')) errors.push(`payphone board missing: ${d}`);
await page.keyboard.press('1'); // pick first gig
await page.waitForTimeout(200);
await page.keyboard.press('1'); // take it
await page.waitForTimeout(200);
if (!(await ev(() => window.__city.hasGig()))) errors.push('gig not accepted');
const gigDest = await ev(() => window.__city.getState().gig?.dest);
// teleport to that destination's door and complete it
const doorSpots = {
  video: [-14, -27.6], diner: [12, -28.6], dealer: [66, 22], donut: [58, 60],
  gasshop: [50.4, -14], arcade: [-12, 27.6],
};
const spot = doorSpots[gigDest] ?? [-14, -27.6];
await page.evaluate(([x, z]) => window.__city.teleport(x, z), spot);
await page.waitForTimeout(150);
await ev(() => window.__city.interact());
await page.waitForTimeout(200);
if (await ev(() => window.__city.hasGig())) errors.push('gig not completed on arrival');
const gigCash = await ev(() => window.__city.getState().cash);
if (gigCash <= 0) errors.push(`gig did not pay (cash=${gigCash})`);
// if arriving opened a room, step back out
await ev(() => window.__city.leaveRoom());
await page.waitForTimeout(100);

// --- story: fetch stage auto-advances after a real action ---
{
  // begin the thread + grant the record via state, then do a real apply (sit on the bench)
  await ev(() => { const s = window.__city.getState(); s.storyStage = 1; s.goods = [...s.goods, 'rec_static']; });
  await ev(() => window.__city.teleport(4, 58, 0)); // park bench
  await ev(() => window.__city.interact());
  await page.waitForTimeout(200);
  await page.keyboard.press('1'); // sit a while -> apply -> checkStory
  await page.waitForTimeout(250);
  const stage = await ev(() => window.__city.getState().storyStage);
  if (stage < 2) errors.push(`story fetch stage did not auto-advance (stage=${stage})`);
  await page.keyboard.press('Escape');
}

// --- named citizens: walk up and befriend one ---
{
  await ev(() => window.__city.setMinute(12 * 60));
  const pos = await ev(() => window.__city.citizenPos());
  if (!pos) errors.push('no named citizens found');
  else {
    await page.evaluate(([x, z]) => window.__city.teleport(x + 1.2, z), pos);
    await page.waitForTimeout(150);
    const near = await ev(() => window.__city.nearestCitizen());
    if (!near) errors.push('citizen not in talk range');
    await ev(() => window.__city.interact());
    await page.waitForTimeout(250);
    d = await dlg();
    if (!d.includes('Chat a while')) errors.push(`citizen dialog missing: ${d}`);
    const id = near?.id;
    await page.keyboard.press('1'); // chat -> befriend
    await page.waitForTimeout(200);
    const friends = await ev(() => window.__city.getState().friends);
    if (!id || (friends[id] ?? 0) < 1) errors.push(`friendship not recorded (${JSON.stringify(friends)})`);

    // personal favors: befriend, satisfy BOTH tiers' conditions, collect them one talk at a time
    if (id) {
      await page.keyboard.press('Escape');
      await ev(cid => {
        const s = window.__city.getState();
        s.friends = { ...s.friends, [cid]: 3 };
        s.savings = 3000; s.car = 'sedan'; s.home = 'loft';
        s.goods = [...new Set([...s.goods, 'up_umbrella', 'rec_neon', 'rec_gravel', 'rec_midnight', 'rec_static'])];
      }, id);
      await ev(() => window.__city.interact()); // Tier 1 completes immediately
      await page.waitForTimeout(200);
      if (!(await ev(cid => window.__city.getState().favors.includes(cid), id))) {
        errors.push(`Tier 1 favor not completed for ${id}`);
      }
      await ev(() => window.__city.interact()); // Tier 2 (unlocked) completes on the next talk
      await page.waitForTimeout(200);
      if (!(await ev(cid => window.__city.getState().favors.includes(cid + '2'), id))) {
        errors.push(`Tier 2 favor not completed for ${id}`);
      }
      await page.keyboard.press('Escape');
      // undo the mutations so later tests (real-estate/loft) see a fresh studio again
      await ev(() => { const s = window.__city.getState(); s.home = 'studio'; s.car = 'beater'; });
    }
  }
}

// --- pedestrians: they exist and they talk ---
const pedCount = await ev(() => window.__city.pedCount());
if (pedCount < 10) errors.push(`too few pedestrians: ${pedCount}`);
const pedPos = await ev(() => window.__city.nearestPedPos());
if (pedPos) {
  await ev(() => {
    const p = window.__city.nearestPedPos();
    window.__city.teleport(p[0] + 1, p[1]);
  });
  await page.waitForTimeout(120);
  await ev(() => window.__city.interact());
  await page.waitForTimeout(250);
  d = await dlg();
  if (!d.includes('"')) errors.push(`ped talk dialog missing: ${d}`);
  await page.keyboard.press('Escape');
}

// --- screenshots at dusk + night, downtown ---
if (shotDir) {
  await ev(() => window.__city.setMinute(19 * 60 + 20));
  await ev(() => window.__city.teleport(-2, -34, Math.PI * 0.9));
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${shotDir}/c98-dusk.png` });
  await ev(() => window.__city.setMinute(22 * 60));
  await ev(() => window.__city.teleport(-4, -30, Math.PI * 1.05));
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${shotDir}/c98-night.png` });
}

// --- weather is deterministic and reaches wet days ---
{
  const skies = new Set();
  for (let d = 1; d <= 40; d++) {
    await ev(day => window.__city.setDay(day), d);
    skies.add(await ev(() => window.__city.weatherSky()));
  }
  if (skies.size < 2) errors.push(`weather never varies: ${[...skies].join(',')}`);
  if (![...skies].some(s => s === 'rain' || s === 'storm')) errors.push('no wet days in 40');
}

// --- seasons + holidays: the calendar drives the world ---
await ev(() => window.__city.setDay(1));
if ((await ev(() => window.__city.season())) !== 'autumn') errors.push('Day 1 should be autumn');
await ev(() => window.__city.setDay(8));
if ((await ev(() => window.__city.season())) !== 'winter') errors.push('Day 8 should be winter');
await ev(() => window.__city.setDay(15));
if ((await ev(() => window.__city.season())) !== 'spring') errors.push('Day 15 should be spring');
await ev(() => window.__city.setDay(14));
if (!/Y2K/.test((await ev(() => window.__city.holiday())) ?? '')) errors.push('Day 14 should be the Y2K holiday');
if (await ev(() => document.getElementById('hud-season').textContent.length === 0)) errors.push('season HUD chip empty');
// Y2K fireworks fire on New Year's Eve night, not by day
await ev(() => window.__city.setDay(14));
await ev(() => window.__city.setMinute(22 * 60));
if (!(await ev(() => window.__city.fireworks()))) errors.push('Y2K night should have fireworks');
await ev(() => window.__city.setMinute(12 * 60));
if (await ev(() => window.__city.fireworks())) errors.push('daytime should have no fireworks');
// decorations follow the season; a banner hangs on holidays only
await ev(() => window.__city.setDay(1));
if ((await ev(() => window.__city.decorTheme())) !== 'autumn') errors.push('Day 1 decor should be autumn');
if ((await ev(() => window.__city.decorBanner())) !== null) errors.push('Day 1 should have no banner');
await ev(() => window.__city.setDay(14));
if ((await ev(() => window.__city.decorTheme())) !== 'winter') errors.push('Day 14 decor should be winter');
if ((await ev(() => window.__city.decorBanner())) !== "NEW YEAR'S EVE") errors.push('Day 14 should hang the NYE banner');
if (shotDir) {
  await ev(() => window.__city.setDay(14));
  await ev(() => window.__city.setMinute(13 * 60));
  await ev(() => window.__city.teleport(0, 22, 0));
  await ev(() => window.__city.pitch(0.06));
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${shotDir}/c98-decor.png` });
  await ev(() => window.__city.pitch(0));
}
if (shotDir) {
  await ev(() => window.__city.setMinute(22 * 60));
  await ev(() => window.__city.teleport(-2, -34, Math.PI * 0.92));
  await ev(() => window.__city.pitch(0.5));
  await page.waitForTimeout(1800);
  await page.screenshot({ path: `${shotDir}/c98-fireworks.png` });
  await ev(() => window.__city.pitch(0));
}

// --- real estate: buy the Skyline Loft at the ATM, then live in it ---
await ev(() => window.__city.setCash(4000));
await ev(() => window.__city.teleport(-19.3, -30, -Math.PI / 2));
await ev(() => window.__city.interact());
await page.waitForTimeout(200);
// loft is option 7 (deposit x3, withdraw x3, then loft), close is 8
await page.keyboard.press('7');
await page.waitForTimeout(200);
d = await dlg();
if (!d.includes('Real Estate')) errors.push(`loft offer missing: ${d}`);
await page.keyboard.press('1'); // buy
await page.waitForTimeout(200);
if ((await ev(() => window.__city.getState().home)) !== 'loft') errors.push('loft not purchased');
await page.keyboard.press('Escape');
// enter home door -> should now load the loft room
await ev(() => window.__city.teleport(-48.4, 0, -Math.PI / 2));
await ev(() => window.__city.interact());
await page.waitForTimeout(250);
if ((await ev(() => window.__city.mode())) !== 'loft') errors.push('home door did not open the loft');
if (shotDir) { await page.waitForTimeout(200); await page.screenshot({ path: `${shotDir}/c98-loft.png` }); }
await ev(() => window.__city.leaveRoom());
await page.waitForTimeout(100);

// --- life goals: completing one pays out and ticks the counter ---
{
  await ev(() => { const s = window.__city.getState(); s.savings = 5000; });
  const before = await ev(() => window.__city.getState().doneGoals.length);
  // trigger an apply so checkAspirations runs (open + close the ATM does an apply-free path; use a bench rest)
  await ev(() => window.__city.setCash(20));
  await ev(() => window.__city.teleport(4, 58, 0)); // park bench interactable
  await ev(() => window.__city.interact());
  await page.waitForTimeout(200);
  await page.keyboard.press('1'); // sit a while -> apply -> checkAspirations
  await page.waitForTimeout(250);
  const done = await ev(() => window.__city.getState().doneGoals);
  if (!done.includes('nest')) errors.push(`goal not completed on payout (done=${done})`);
  await page.keyboard.press('Escape');
}

// --- pause menu: resume / life-so-far / quit ---
{
  await ev(() => window.__city.pause());
  await page.waitForTimeout(150);
  let pm = await ev(() => document.getElementById('lock-overlay')?.textContent ?? '');
  if (!pm.includes('Life so far') || !pm.includes('quit to title')) errors.push(`pause menu missing: ${pm}`);
  // open the "Life so far" stats view
  await ev(() => {
    const btns = [...document.querySelectorAll('#pause-menu .win-btn')];
    btns.find(b => b.textContent.includes('Life so far'))?.click();
  });
  await page.waitForTimeout(150);
  pm = await ev(() => document.getElementById('lock-overlay')?.textContent ?? '');
  if (!pm.includes('Days in the city')) errors.push(`pause stats missing: ${pm}`);
  if (shotDir) await page.screenshot({ path: `${shotDir}/c98-pause.png` });
  await ev(() => window.__city.resume());
  await page.waitForTimeout(80);
}

// --- ending: the epilogue appears the moment you've made it ---
{
  await ev(() => {
    const s = window.__city.getState();
    s.look = { ...s.look, name: 'ADA' };
    s.day = 16; s.home = 'loft'; s.car = 'sedan'; s.savings = 6200;
    s.goods = [...new Set([...s.goods, 'rec_neon', 'rec_gravel', 'rec_midnight'])];
    s.friends = { gloria: 3, dale: 3 }; s.favors = ['rosa', 'gloria'];
    s.wonAt = s.day;
  });
  await page.waitForTimeout(350); // a frame or two -> maybeShowEpilogue
  if (!(await page.$('#epilogue-overlay'))) errors.push('epilogue did not appear on winning');
  const epi = await ev(() => document.getElementById('epilogue-overlay')?.textContent ?? '');
  if (!epi.includes('YOU MADE IT')) errors.push(`epilogue content missing: ${epi.slice(0, 60)}`);
  if (!epi.includes('Skyline Loft')) errors.push('epilogue did not reflect the loft');
  if (shotDir) await page.screenshot({ path: `${shotDir}/c98-epilogue.png` });
  await ev(() => document.getElementById('epi-keep')?.click());
  await page.waitForTimeout(100);
  if (await page.$('#epilogue-overlay')) errors.push('epilogue did not close on "keep living"');
}

await browser.close();
console.log(errors.length ? `FAIL\n${errors.join('\n')}` : 'SMOKE OK');
process.exit(errors.length ? 1 : 0);
