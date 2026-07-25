/// <reference types="vite/client" />

/** injected by the `ct-build-stamp` plugin in vite.config.ts */
declare module 'virtual:build-stamp' {
  /** short sha of HEAD when this bundle was served/built */
  export const SHA: string;
  /** was the worktree dirty at that moment */
  export const DIRTY: boolean;
  /** epoch ms of the build (or, on the dev server, of the serve) */
  export const AT: number;
}
