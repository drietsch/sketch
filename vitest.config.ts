import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        // The sketch engine: seeded Math.random, because a few engine tests
        // exercise its documented Math.random fallback for seed 0.
        test: {
          name: 'unit',
          include: ['test/unit/sketch/**/*.test.ts', 'test/golden/digest.test.ts'],
          environment: 'node',
          setupFiles: ['./test/setup/deterministic.ts'],
          // The largest golden case (a 700x700 ellipse stamped with dots, where
          // each dot is itself a sketched ellipse) takes ~1.1s to generate.
          testTimeout: 60_000,
        },
      },
      {
        // The library: Math.random throws, so any unseeded randomness fails
        // loudly instead of silently breaking the determinism contract.
        test: {
          name: 'lib',
          include: ['test/unit/**/*.test.ts', 'test/golden/scenes.test.ts'],
          exclude: ['test/unit/sketch/**'],
          environment: 'node',
          setupFiles: ['./test/setup/no-math-random.ts'],
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
