// A DEAD SERVER IS NOT A FAILED CHECK.
//
// Every check here opens with `page.goto(URL)`. When the preview is not up,
// Playwright throws ERR_CONNECTION_REFUSED, node prints a stack, and the
// process exits 1 — which is the code for "this check ran and the world is
// wrong". It is not. Nothing was measured.
//
// That cost me three separate wrong readings in one session: twice I read
// `exit 1` off a dead preview as a real regression and went looking for the
// fault, and once I re-read a STALE screenshot from a run that had died,
// concluding the camera was inside a wall when the position was fine. My
// preview dropped six times that session, so this is not a rare state.
//
// GOTCHAS 32 already says what the answer is: exit 3 means the check never
// ran. This makes goto obey it, with the fix printed rather than a stack.
export async function goto(page, url) {
  try {
    await page.goto(url, { waitUntil: 'networkidle' });
  } catch (e) {
    if (!/ERR_CONNECTION_REFUSED|ERR_CONNECTION_RESET|ECONNREFUSED/.test(String(e.message))) throw e;
    console.error(`\n  THE CHECK NEVER RAN — nothing is serving ${url}.`);
    console.error('  This is NOT a finding about the world; nothing was measured.');
    console.error('  Fix: start the preview, then re-run.');
    console.error('    cd street && npx vite preview --port 4279 --strictPort &\n');
    process.exit(3);   // GOTCHAS 32
  }
}
