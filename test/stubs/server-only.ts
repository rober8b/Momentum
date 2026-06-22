// Stub for the 'server-only' magic import. Next.js's bundler no-ops this
// package at build time; vitest doesn't know about it, so we alias it here
// (see vitest.config.ts) to a real, empty module instead.
export {};
