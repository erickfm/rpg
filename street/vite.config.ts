import { defineConfig } from 'vite';

// Kept deliberately thin. `base` is NOT set here — the Pages workflow passes
// --base=./ so assets resolve under /rpg/, and the local build + pack-artifact
// keep absolute paths.
export default defineConfig({
  server: {
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
