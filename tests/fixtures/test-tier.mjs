// Fast runs (`pnpm test`, PR CI) exercise production flows once with a controlled Codex adapter and skip
// exhaustive cases. `pnpm test:providers` and `pnpm test:full` set SHIQU_TEST_TIER=full for every provider
// and the heavy cases. Provider adapter contract tests always cover every provider.
export const fullTier=process.env.SHIQU_TEST_TIER==='full';
const fastProvider='codex';
// Providers for a production-flow test matrix: all of them in the full tier, one in fast runs.
export function flowProviders(names){return fullTier?names:names.includes(fastProvider)?[fastProvider]:names.slice(0,1);}
// Options for a single production-flow test inside a provider loop that also holds adapter tests.
export function flowProvider(name,names=['codex','gemini']){return flowProviders(names).includes(name)?{}:{skip:'provider matrix: run pnpm test:providers'};}
// Options for exhaustive or long-running cases kept out of fast runs.
export const heavy=fullTier?{}:{skip:'heavy case: run pnpm test:providers'};
// Options for checks of the shipped book contents (editions, glyphs, chapters). The books change only when
// added or replaced by hand, so run `pnpm test:books` then; loader and integrity logic stays in fast runs.
export const books=fullTier||process.env.SHIQU_TEST_BOOKS==='1'?{}:{skip:'shipped book contents: run pnpm test:books'};
