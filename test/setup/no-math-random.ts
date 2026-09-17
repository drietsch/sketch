import { afterEach, beforeEach, vi } from 'vitest';

/**
 * The library must never reach Math.random: every jitter, path and delay is
 * drawn from a seeded stream. Throwing here turns a silent determinism leak
 * into a failing test with a stack trace pointing at the culprit.
 */
beforeEach(() => {
  vi.spyOn(Math, 'random').mockImplementation(() => {
    throw new Error('Math.random called: the library must only use seeded randomness');
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});
