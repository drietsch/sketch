import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['test/unit/**/*.test.ts', 'test/golden/**/*.test.ts'],
          environment: 'node',
          setupFiles: ['./test/setup/deterministic.ts'],
          // The largest golden case (a 700x700 ellipse stamped with dots, where
          // each dot is itself a sketched ellipse) takes ~1.1s to generate and
          // several more to run through pretty-format. That is a real property
          // of the library, not a slow test.
          testTimeout: 60_000,
        },
      },
      {
        test: {
          name: 'backend',
          include: ['test/backend/**/*.test.ts'],
          environment: 'happy-dom',
          setupFiles: ['./test/setup/deterministic.ts'],
        },
      },
      {
        // Requires `pnpm build` first; excluded from the default run via
        // --project selection in CI so a missing dist/ is not a confusing failure.
        test: {
          name: 'dist',
          include: ['test/dist/**/*.test.ts'],
          environment: 'node',
          testTimeout: 300_000,
        },
      },
      {
        // Deliberately NO deterministic setup: these tests assert that the
        // library is reproducible on its own, against the real Math.random.
        test: {
          name: 'determinism',
          include: ['test/determinism/**/*.test.ts'],
          environment: 'node',
        },
      },
    ],
  },
});
