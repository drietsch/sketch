import { isValidId } from './ids.js';

/** The triggers a reaction may name. Figma's vocabulary; only clicks are understood so far. */
export const REACTION_TRIGGERS = ['ON_CLICK'] as const;

/** Fields of a `WidgetAction` that change something. A reaction with none of them is a mistake. */
const ACTION_FIELDS = ['checked', 'open', 'value', 'focus'] as const;

function validateValue(value: unknown, what: string): string | undefined {
  if (typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value))) return undefined;
  if (Array.isArray(value) && value.every((v) => typeof v === 'string')) return undefined;
  return `${what} must be a string, a finite number, or an array of strings`;
}

/**
 * Structural validation of a node's `reactions`. Targets are not resolved
 * here: a reaction may name a node added after it, so the compiler is what
 * reports an unknown target.
 */
export function validateReactions(reactions: unknown, what: string): string | undefined {
  if (reactions === undefined) return undefined;
  if (!Array.isArray(reactions)) return `${what} must be an array of reactions`;
  for (const [i, r] of reactions.entries()) {
    const at = `${what}[${i}]`;
    if (typeof r !== 'object' || r === null || Array.isArray(r)) return `${at} must be a reaction object`;
    const reaction = r as Record<string, unknown>;
    if (!REACTION_TRIGGERS.includes(reaction.trigger as (typeof REACTION_TRIGGERS)[number])) {
      return `${at}.trigger must be one of ${REACTION_TRIGGERS.map((t) => JSON.stringify(t)).join(', ')}`;
    }
    const action = reaction.action;
    if (typeof action !== 'object' || action === null || Array.isArray(action)) {
      return `${at}.action must be an action object`;
    }
    const fields = action as Record<string, unknown>;
    if (fields.target !== undefined && !isValidId(fields.target)) {
      return `${at}.action.target ${JSON.stringify(fields.target)} is not a valid id`;
    }
    for (const key of ['checked', 'open', 'focus'] as const) {
      if (fields[key] !== undefined && typeof fields[key] !== 'boolean') return `${at}.action.${key} must be a boolean`;
    }
    if (fields.value !== undefined) {
      const problem = validateValue(fields.value, `${at}.action.value`);
      if (problem) return problem;
    }
    if (!ACTION_FIELDS.some((key) => fields[key] !== undefined)) {
      return `${at}.action changes nothing: set one of ${ACTION_FIELDS.join(', ')}`;
    }
  }
  return undefined;
}
