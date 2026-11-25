import type { UsageState } from './usageRules.ts';

export interface UsageBoard {
  title: string;
  what: string;
  href: string;
}

const at = (state: UsageState, title: string, what: string): UsageBoard => ({
  title,
  what,
  href: `/demo/usage-warning?state=${state}`,
});

/** sc-3931's bell item on a phone, its own screen, and on a tablet in either orientation, the popover under the bell. */
export const USAGE_WARNING_BOARDS: readonly UsageBoard[] = [
  at('eighty', 'Usage warning · 80%, unread', 'Assistant drafts in 3 lines, storage in 2'),
  at('read', 'Usage warning · 80%, read', 'The titles regular, no Unread mark'),
  at('all', 'Usage warning · 100%, unread', 'All its included assistant drafts and storage'),
  at('feed', 'Usage warning · feed', '100% above 80%, an event item between them'),
  at('live', 'Usage warning · live', 'Play the arrival: the badge counts up, focus stays'),
  at('opened', 'Usage warning · opened', 'Read, focus kept, nothing else opened, no link'),
  at('fr', 'Usage warning · French stand-in', 'About 30% longer, wrapping, never cut'),
  at('pt', 'Usage warning · Portuguese stand-in', 'About 30% longer, wrapping, never cut'),
];
