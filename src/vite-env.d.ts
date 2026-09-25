/// <reference types="vite/client" />

// Vite handles CSS imports as side effects; TypeScript 6 requires an explicit
// declaration for them.
declare module '*.css' {
  const css: string;
  export default css;
}
