/** 32-bit FNV-1a over the UTF-16 code units of a string. */
export function fnv1a32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// Unit separator: cannot occur in ids, and makes ('a', 'bc') and ('ab', 'c')
// hash differently.
const SEP = String.fromCharCode(31);

/**
 * Derives an engine seed from the document seed and a stable key.
 *
 * Every source of randomness in the library (sketch jitter per node and part,
 * cursor paths, typing cadence) gets its own stream from this function, so
 * changing one node or step never re-randomises another.
 *
 * The result is always odd and in [1, 2^31): the engine's PRNG treats 0 as
 * "use Math.random", and its Park-Miller step preserves the seed's trailing
 * zero bits, so power-of-two seeds produce degenerate streams. An odd seed
 * avoids both.
 */
export function deriveSeed(docSeed: number, ...keys: (string | number)[]): number {
  let h = fnv1a32(keys.join(SEP));
  h = (h ^ Math.imul(docSeed >>> 0, 0x9e3779b1)) >>> 0;
  // Two rounds of xorshift-multiply so neighbouring document seeds diverge in
  // every bit, not just the low ones.
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  h ^= h >>> 16;
  return (h & 0x7ffffffe) | 1;
}

const ID_PATTERN = /^[A-Za-z0-9_][A-Za-z0-9_.:-]*$/;

export function isValidId(id: unknown): id is string {
  return typeof id === 'string' && ID_PATTERN.test(id);
}

export function assertValidId(id: unknown): asserts id is string {
  if (!isValidId(id)) {
    throw new Error(`Invalid node id ${JSON.stringify(id)}: use letters, digits, "_", ".", ":" or "-"`);
  }
}

/** Generates `${type.toLowerCase()}-${n}` ids (`rectangle-1`, `frame-2`), skipping any the caller says are taken. */
export class IdCounter {
  private readonly counts = new Map<string, number>();

  next(type: string, taken: (id: string) => boolean): string {
    const prefix = type.toLowerCase();
    let n = this.counts.get(prefix) ?? 0;
    let id: string;
    do {
      n += 1;
      id = `${prefix}-${n}`;
    } while (taken(id));
    this.counts.set(prefix, n);
    return id;
  }
}
