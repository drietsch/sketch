import type { Theme } from './types.js';

export const DEFAULT_THEME: Readonly<Theme> = Object.freeze({
  stroke: '#1f2430',
  text: '#1f2430',
  accent: '#2f6fed',
  muted: '#8a8f98',
  surface: '#ffffff',
  background: '#ffffff',
  strokeWeight: 1.2,
  roughness: 1,
  bowing: 1,
  radius: 6,
  fontSize: 14,
  textRoughness: 0.6,
  textPasses: 1,
  frameOvershoot: 8,
  frameBand: 8,
  frameBandOpacity: 0.5,
});

export function resolveTheme(theme?: Partial<Theme>): Theme {
  const out: Theme = { ...DEFAULT_THEME };
  if (theme) {
    for (const key of Object.keys(theme) as (keyof Theme)[]) {
      const value = theme[key];
      if (value !== undefined) {
        (out as Record<keyof Theme, string | number>)[key] = value;
      }
    }
  }
  return out;
}
