import { defineConfig, type Plugin } from 'vite';
import { execSync } from 'node:child_process';

// ── the build stamp ────────────────────────────────────────────────────────
//
// Feeds `virtual:build-stamp` to ct/hud.ts, which paints it in the corner.
//
// NOT a `define`. A define is evaluated once when vite loads its config, and
// the live world at :5177 is a dev server that is never restarted —
// scripts/live-integrate.sh `reset --hard`s the worktree under it every 15 s
// and lets HMR reload the page. A define would therefore show whatever sha was
// checked out when the server first booted, for the rest of the day, and lie
// to precisely the people this exists for. A virtual module can be invalidated,
// so it is re-read whenever the tree moves.
const STAMP = 'virtual:build-stamp';
const RESOLVED = '\0' + STAMP;

function buildStamp(): Plugin {
  const git = (cmd: string) => {
    try { return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); }
    catch { return ''; }   // a tarball with no .git still has to build
  };
  return {
    name: 'ct-build-stamp',
    resolveId: (id) => (id === STAMP ? RESOLVED : null),
    load(id) {
      if (id !== RESOLVED) return null;
      // In the live worktree HEAD is the throwaway `live` merge commit, which
      // is exactly right: it identifies the integration you are looking at,
      // and `git log` on it names every builder that went into it.
      const sha = git('git rev-parse --short HEAD') || 'nogit';
      const dirty = git('git status --porcelain') !== '';
      return `export const SHA = ${JSON.stringify(sha)};\n`
        + `export const DIRTY = ${dirty};\n`
        + `export const AT = ${Date.now()};\n`;
    },
    configureServer(server) {
      const stale = () => {
        const mod = server.moduleGraph.getModuleById(RESOLVED);
        if (mod) server.moduleGraph.invalidateModule(mod);
      };
      // Invalidate on every document request, NOT only on handleHotUpdate.
      // Hooking file changes alone looked right and was not: HEAD can move
      // without any watched file changing (a rebase that lands docs, an
      // amend, a merge that touches only notes/), and the stamp then keeps
      // reporting the previous sha. Measured — it reported a commit-old sha
      // until something under src/ happened to change. Every page load is the
      // cheap, honest trigger: one `git rev-parse` per reload.
      server.middlewares.use((req, _res, next) => {
        const url = (req.url ?? '').split('?')[0];
        if (url === '/' || url.endsWith('.html')) stale();
        next();
      });
    },
  };
}

// Kept deliberately thin. `base` is NOT set here — the Pages workflow passes
// --base=./ so assets resolve under /rpg/, and the local build + pack-artifact
// keep absolute paths.
export default defineConfig({
  plugins: [buildStamp()],
  server: {
    // Fail loudly on a taken port instead of walking up to the next free one.
    // Vite's default is to increment silently, which means a builder launched
    // with `--port 4182` can end up serving on 4188 — another builder's
    // assigned port. That has already cost real time: a session spent minutes
    // verifying a change against a world that belonged to a different
    // worktree, and the page looked completely plausible. START-HERE says
    // "never share one"; this makes it true rather than aspirational.
    strictPort: true,
    // A cloudflare quick-tunnel serves the dev server from a random
    // *.trycloudflare.com host; vite rejects unknown hosts without this.
    allowedHosts: true,
    // Over a tunnel the HMR socket must dial the public origin on 443, not
    // localhost:5177. Set TUNNEL=1 when running behind cloudflared.
    hmr: process.env.TUNNEL
      ? { protocol: 'wss', clientPort: 443 }
      : undefined,
  },
});
