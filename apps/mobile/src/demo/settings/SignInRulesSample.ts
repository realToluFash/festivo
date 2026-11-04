import type { Load } from './RolesSample.ts';
import { YOU } from './sample.ts';

export const TITLE = `${YOU.organisation}’s sign-in rules`;
export const INTRO =
  'Set by the organisation’s owners. You can read them here; only they can change them.';

const VALUES = {
  anyMethod: 'Any method: email and password, Google or Apple',
  noLimit: 'Sign-ins last until you sign out',
  twoFactor: 'Two-factor required for people who can manage members, roles, billing or security',
  noTwoFactor: 'Two-factor not required',
  noEveryone: 'Two-factor not required of everyone',
} as const;

export function idleValue(days: number): string {
  return days === 1
    ? 'Sign-ins end after 1 day without use'
    : `Sign-ins end after ${days} days without use`;
}

export function limitApplies(days: number, organisation: string): string {
  const unit = days === 1 ? '1 day' : `${days} days`;

  return `For you, sign-ins end after ${unit} without use: ${organisation}’s rule, the shortest of your organisations.`;
}

export interface Change {
  /** Wall clock where the reader is; the sample has no zone of its own. */
  at: string;
  who: string;
  now: string;
  was: string;
}

const BY = `${YOU.name} · Owner`;

export const CHANGES: readonly Change[] = [
  { at: '2026-10-28T15:12', who: BY, now: VALUES.twoFactor, was: VALUES.noTwoFactor },
  { at: '2026-09-01T10:05', who: BY, now: idleValue(30), was: VALUES.noLimit },
];

export interface Rule {
  label: string;
  value: string;
}

export const IN_FORCE: readonly Rule[] = [
  { label: 'How people sign in', value: VALUES.anyMethod },
  { label: 'How long a sign-in lasts unused', value: idleValue(30) },
  { label: 'Two-factor', value: VALUES.twoFactor },
  { label: 'Two-factor for everyone', value: VALUES.noEveryone },
];

export const STARTING: readonly Rule[] = [
  { label: 'How people sign in', value: VALUES.anyMethod },
  { label: 'How long a sign-in lasts unused', value: VALUES.noLimit },
  { label: 'Two-factor', value: VALUES.noTwoFactor },
  { label: 'Two-factor for everyone', value: VALUES.noEveryone },
];

/** "Wednesday, Oct 28 at 3:12 PM · Folake Adeyemi · Owner", the clock as the locale keeps it. */
export function changeWhen(change: Change, locale: string, thisYear = 2026): string {
  const at = new Date(`${change.at}Z`);
  const year = at.getUTCFullYear() === thisYear ? {} : { year: 'numeric' as const };
  const day = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    ...year,
    timeZone: 'UTC',
  }).format(at);
  const time = new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
  }).format(at);

  return `${day} at ${time} · ${change.who}`;
}

export const SIGN_IN_RULES_STATES = ['rules', 'noChanges', 'loading', 'failed'] as const;

export type SignInRulesState = (typeof SIGN_IN_RULES_STATES)[number];

export function signInRulesStateOf(name: string | undefined): SignInRulesState {
  return SIGN_IN_RULES_STATES.find((state) => state === name) ?? 'rules';
}

export interface SignInRulesStart {
  load: Load;
  limit: { days: number; organisation: string } | null;
  changes: readonly Change[];
  rules: readonly Rule[];
}

export function signInRulesStart(state: SignInRulesState): SignInRulesStart {
  const whole: SignInRulesStart = {
    load: 'loaded',
    limit: { days: 7, organisation: 'Lumen Studio' },
    changes: CHANGES,
    rules: IN_FORCE,
  };

  if (state === 'noChanges') return { ...whole, limit: null, changes: [], rules: STARTING };
  if (state === 'loading' || state === 'failed') return { ...whole, load: state };

  return whole;
}

export const ASK_OWNER = `Questions? Ask an owner of ${YOU.organisation}.`;
