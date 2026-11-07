import { defineConfig } from 'vitest/config';

/**
 * Vitest, not jest-expo, and that is a design constraint rather than a
 * preference.
 *
 * Everything worth testing in this app is a pure function over data or over
 * source text: how a window size classifies into a layout, whether the
 * catalogues agree, whether anything nests a Text inside a Text. None of that
 * needs React Native loaded, and insisting on a renderer would mean a second
 * test runner in the repository and a transform pipeline to maintain.
 *
 * The rule that follows: anything a test needs to reach must not import
 * `react-native`. Hence src/layout/classify.ts beside src/layout/useLayout.ts —
 * the judgement in one file, the hook that feeds it in another.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'plugins/**/*.test.ts'],
  },
});
