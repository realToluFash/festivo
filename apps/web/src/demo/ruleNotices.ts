export const RULE_NOTICES = ['due', 'unlinked', 'gate', 'changed'] as const;

export type RuleNotice = (typeof RULE_NOTICES)[number];

export const DEADLINE = 'Monday, Dec 1 at 09:00 WAT';

export const CHANGED_AT = '2026-11-20T10:00:00Z';

/** `?notice=gate,changed` names them; General's held states show the notice their hold is (sc-39471, #87355). */
export function noticesAsked(params: URLSearchParams): RuleNotice[] {
  const named = (params.get('notice') ?? '').split(',');
  const state = params.get('state');
  if (state === 'heldTwoFactor') named.push('gate');
  if (state === 'heldLinked') named.push('unlinked');

  return RULE_NOTICES.filter((notice) => named.includes(notice));
}
