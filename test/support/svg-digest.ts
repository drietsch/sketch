import { createHash } from 'node:crypto';

export interface SvgDigest {
  bytes: number;
  groups: number;
  paths: number;
  sha256: string;
}

/** A compact, reviewable fingerprint of an SVG string. */
export function digestSvg(svg: string): SvgDigest {
  return {
    bytes: svg.length,
    groups: (svg.match(/<g /g) ?? []).length,
    paths: (svg.match(/<path /g) ?? []).length,
    sha256: createHash('sha256').update(svg).digest('hex').slice(0, 16),
  };
}
