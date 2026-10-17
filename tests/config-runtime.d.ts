// Keep the owned Playwright config type-checkable without adding @types/node
// to the browser project's dependencies or changing its tsconfig.
declare module 'node:fs' {
  export function existsSync(path: string): boolean;
}

declare module 'node:process' {
  export const env: { readonly CI?: string };
}
