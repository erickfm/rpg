// One-shot: does disabling code splitting give a single self-contained chunk?
import { build } from 'vite';
await build({
  configFile: 'vite.config.ts',
  logLevel: 'warn',
  build: { outDir: 'dist-try', rolldownOptions: { output: { inlineDynamicImports: true } } },
});
