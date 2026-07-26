// Let node import this project's `.ts` modules by their extensionless names.
//
// Node 24 strips TypeScript types natively, so `import('../src/proto/ct/slots.ts')`
// works from a plain `.mjs` script with no build step — which is what lets
// `L-slots-rtp`, `L-slots-feel` and `L-slots-glass` assert against the REAL
// module instead of a transcription of its tables (GOTCHAS §44).
//
// What it cannot do is resolve `./ctx` to `./ctx.ts`. Every source file in this
// project writes its imports the bundler way, extensionless, because Vite
// resolves them; node's ESM resolver requires the extension and throws
// ERR_MODULE_NOT_FOUND. So a module that imports nothing can be read by node and
// a module that imports a sibling cannot — which is a cliff the three checks
// fell off the moment ct/slots.ts grew its first `import { BUILD } from './ctx'`.
//
// Registering this hook adds the extension back for RELATIVE specifiers only,
// and only when the bare form does not resolve. Nothing about the app changes;
// it exists solely so a node script can read a source file the way Vite does.
//
//     import { register } from 'node:module';
//     register('./lib/L-ts-imports.mjs', import.meta.url);
//     const S = await import('../src/proto/ct/slots.ts');
//
// Named for what it asserts nothing about — it is plumbing, not a check — and
// prefixed with its owner per GOTCHAS §24, because "ts-imports" is a subject
// somebody else will want too.

export async function resolve(specifier, context, next) {
  if (specifier.startsWith('.') && !/\.[cm]?[jt]sx?$/i.test(specifier)) {
    try {
      return await next(`${specifier}.ts`, context);
    } catch {
      // fall through to the real resolver, so its error is the one reported
    }
  }
  return next(specifier, context);
}
