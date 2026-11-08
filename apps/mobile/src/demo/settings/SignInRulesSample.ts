import type { SignInRuleChange } from '@soirely/api-client';

import type { Load } from './RolesSample.ts';
import { YOU } from './sample.ts';

export const TITLE = 'Sign-in rules';
const ORG = YOU.organisation;
const THIS_YEAR = 2026;

export const ASK_OWNER = `Questions? Ask an owner or admin of ${ORG}.`;
export const MANAGERS_ARE = 'Managers are owners and admins.';

export type Change = Pick<SignInRuleChange, 'rule' | 'now' | 'was'> & {
  /** Wall clock where the reader is; the sample has no zone of its own. */
  at: string;
  by: { name: string };
};

/** What SignInRulesPage gives the page, and where the reader stands. */
export interface RulesPage {
  providerOnly: boolean;
  inactivityTimeoutDays: number | null;
  administratorsNeedTwoFactor: boolean;
  everyoneNeedsTwoFactor: boolean;
  twoFactorDeadline: string;
  inactivityLimit: { organisation: string; days: number } | null;
  ownTwoFactor: boolean;
  changes: readonly Change[];
}

export type Area = 'members' | 'billing' | 'security';

/** Who is looking, from the session, the account's linked ways and signInRulesSeen. */
export interface RulesViewer {
  /** Their email, as Members keys a person. */
  id: string;
  role: string;
  manages: readonly Area[];
  /** organisation.manage: may change the rules, on the web. */
  setsRules: boolean;
  linked: 'Google' | 'Apple' | null;
  seen: string | null;
}

export type Mark = 'met' | 'needs' | 'notApplicable';
export type RuleKey = 'method' | 'limit' | 'twoFactor';

const MARK_WORD: Record<Mark, string> = {
  met: 'Met.',
  needs: 'Needs you.',
  notApplicable: 'Doesn’t apply.',
};

export interface RuleRow {
  key: RuleKey;
  mark: Mark;
  title: string;
  line: string;
  ask: { consequence: string; step: string } | null;
}

function days(count: number): string {
  return count === 1 ? '1 day' : `${count} days`;
}

function andList(words: readonly string[]): string {
  if (words.length < 2) return words.join('');

  return `${words.slice(0, -1).join(', ')} and ${words.at(-1)}`;
}

/** A day as the locale writes it, short month, with the year only outside this one. */
export function dayIn(at: string, locale: string, weekday = false): string {
  const day = new Date(`${at.slice(0, 10)}T12:00Z`);

  return new Intl.DateTimeFormat(locale, {
    ...(weekday ? { weekday: 'long' as const } : {}),
    month: 'short',
    day: 'numeric',
    ...(day.getUTCFullYear() === THIS_YEAR ? {} : { year: 'numeric' as const }),
    timeZone: 'UTC',
  }).format(day);
}

function method(page: RulesPage, viewer: RulesViewer): RuleRow {
  if (!page.providerOnly)
    return {
      key: 'method',
      mark: 'met',
      title: 'Sign in any way',
      line: 'Password, Google and Apple all work.',
      ask: null,
    };
  if (viewer.linked != null)
    return {
      key: 'method',
      mark: 'met',
      title: 'Google or Apple only',
      line: `You have ${viewer.linked} linked.`,
      ask: null,
    };

  return {
    key: 'method',
    mark: 'needs',
    title: 'Google or Apple only',
    line: 'Your password still signs you in. Link one to change things again.',
    ask: {
      consequence: `Until you link one, you can read but not change anything in ${ORG}.`,
      step: 'Link Google or Apple',
    },
  };
}

function limit(page: RulesPage): RuleRow {
  const own = page.inactivityTimeoutDays;
  const shortest = page.inactivityLimit;
  const elsewhere =
    shortest != null && shortest.organisation !== ORG && (own == null || shortest.days < own)
      ? shortest
      : null;
  const title = own == null ? 'No limit on sign-ins' : `Signed out after ${days(own)} unused`;
  const forYou =
    elsewhere == null ? '' : `For you, ${days(elsewhere.days)}: ${elsewhere.organisation}’s rule`;
  const line =
    own == null
      ? elsewhere == null
        ? 'You stay signed in until you sign out.'
        : `${forYou}.`
      : elsewhere == null
        ? `After ${days(own)} without Soirely, you sign in again.`
        : `${forYou} is shorter.`;

  return { key: 'limit', mark: 'met', title, line, ask: null };
}

const TURN_ON = 'Turn on two-factor';

function twoFactor(page: RulesPage, viewer: RulesViewer, locale: string): RuleRow {
  const on = page.ownTwoFactor;
  const row = (mark: Mark, title: string, line: string, consequence?: string): RuleRow => ({
    key: 'twoFactor',
    mark,
    title,
    line,
    ask: consequence == null ? null : { consequence, step: TURN_ON },
  });

  if (page.everyoneNeedsTwoFactor) {
    const by = dayIn(page.twoFactorDeadline, locale, true);

    return on
      ? row('met', 'Two-factor for everyone', 'Yours is on.')
      : row(
          'needs',
          'Two-factor for everyone',
          `Not on yet. Turn it on by ${by}.`,
          `Turn it on by ${by}, or you can’t open ${ORG} after that.`,
        );
  }
  if (page.administratorsNeedTwoFactor) {
    if (viewer.manages.length === 0)
      return row(
        'notApplicable',
        'Two-factor for managers',
        `Doesn’t apply to your role, ${viewer.role}.`,
      );

    return on
      ? row('met', 'Two-factor for managers', 'Yours is on.')
      : row(
          'needs',
          'Two-factor for managers',
          `Not on yet. Changes to ${andList(viewer.manages)} wait until it is.`,
          'Until it’s on, changes to members, billing or security wait. Your events keep working.',
        );
  }

  return row(
    'met',
    'Two-factor not required',
    on ? 'Yours is on anyway.' : 'You can turn it on in Security.',
  );
}

export function whereYouStand(page: RulesPage, viewer: RulesViewer, locale: string): RuleRow[] {
  return [method(page, viewer), limit(page), twoFactor(page, viewer, locale)];
}

export function ruleLabel(rule: RuleRow): string {
  return `${MARK_WORD[rule.mark]} ${rule.title}. ${rule.line}`;
}

/** Only while managers is the two-factor rule in force. */
export function standFoot(page: RulesPage): string | undefined {
  return page.administratorsNeedTwoFactor && !page.everyoneNeedsTwoFactor
    ? MANAGERS_ARE
    : undefined;
}

export interface RulesCard {
  says: string;
  line: string;
  step: string | null;
}

export function rulesCard(rules: readonly RuleRow[], viewer: RulesViewer): RulesCard {
  const asks = rules.flatMap(({ ask }) => (ask == null ? [] : [ask]));
  const [first] = asks;

  if (first == null)
    return {
      says: `You meet ${ORG}’ rules`,
      line: viewer.setsRules
        ? 'To change them, use Soirely on the web.'
        : 'Set by its owners and admins. Only they can change them.',
      step: null,
    };

  return {
    says: asks.length === 1 ? '1 rule needs you' : `${asks.length} rules need you`,
    line: first.consequence,
    step: first.step,
  };
}

function onOff(value: Change['now']): string {
  return value === true ? 'on' : 'off';
}

export function changeTitle(change: Change): string {
  switch (change.rule) {
    case 'providerOnly':
      return `How people sign in: ${change.now === true ? 'Google or Apple only' : 'any way'}`;
    case 'inactivityTimeoutDays':
      return `Signed out after: ${typeof change.now === 'number' ? `${days(change.now)} unused` : 'no limit'}`;
    case 'administratorsNeedTwoFactor':
      return `Two-factor for managers: ${onOff(change.now)}`;
    case 'everyoneNeedsTwoFactor':
      return `Two-factor for everyone: ${onOff(change.now)}`;
  }
}

export function wasWords(change: Change): string {
  switch (change.rule) {
    case 'providerOnly':
      return change.was === true ? 'was Google or Apple only' : 'was any way';
    case 'inactivityTimeoutDays':
      return typeof change.was === 'number' ? `was ${days(change.was)}` : 'was no limit';
    default:
      return `was ${onOff(change.was)}`;
  }
}

export interface ChangeRow {
  at: string;
  title: string;
  line: string;
  isNew: boolean;
  label: string;
}

/** Newest first; a change after the last one this device showed is New. */
export function changeRows(
  changes: readonly Change[],
  seen: string | null,
  locale: string,
): ChangeRow[] {
  return [...changes]
    .sort((a, b) => b.at.localeCompare(a.at))
    .map((change) => {
      const parts = [dayIn(change.at, locale), wasWords(change), change.by.name];
      const isNew = seen == null || change.at > seen;
      const title = changeTitle(change);

      return {
        at: change.at,
        title,
        line: parts.join(' · '),
        isNew,
        label: [title, ...(isNew ? ['New'] : []), ...parts].join('. '),
      };
    });
}

const BY = { name: YOU.name };

export const CHANGES: readonly Change[] = [
  { rule: 'administratorsNeedTwoFactor', now: true, was: false, at: '2026-10-28T15:12', by: BY },
  { rule: 'inactivityTimeoutDays', now: 30, was: null, at: '2026-09-01T10:05', by: BY },
];

const EVERYONE: Change = {
  rule: 'everyoneNeedsTwoFactor',
  now: true,
  was: false,
  at: '2026-11-04T09:40',
  by: BY,
};

const GOOGLE_ONLY: Change = {
  rule: 'providerOnly',
  now: true,
  was: false,
  at: '2026-11-02T11:20',
  by: BY,
};

const RULES: RulesPage = {
  providerOnly: false,
  inactivityTimeoutDays: 30,
  administratorsNeedTwoFactor: true,
  everyoneNeedsTwoFactor: false,
  twoFactorDeadline: '2026-11-11',
  inactivityLimit: { organisation: 'Lumen Studio', days: 7 },
  ownTwoFactor: true,
  changes: CHANGES,
};

const ONLY_HERE = { organisation: ORG, days: 30 };

const JULIEN: RulesViewer = {
  id: 'julien@ire.events',
  role: 'Admin',
  manages: ['members'],
  setsRules: true,
  linked: 'Google',
  seen: '2026-10-28T15:12',
};

const PRIYA: RulesViewer = {
  id: 'priya@ire.events',
  role: 'Member',
  manages: [],
  setsRules: false,
  linked: null,
  seen: '2026-10-28T15:12',
};

const ANA: RulesViewer = {
  id: 'ana.souza@ire.events',
  role: 'Member',
  manages: [],
  setsRules: false,
  linked: null,
  seen: '2026-10-28T15:12',
};

export const SIGN_IN_RULES_STATES = [
  'rules',
  'twoFactorDue',
  'notYours',
  'everyone',
  'googleOnly',
  'newChange',
  'noChanges',
  'loading',
  'failed',
] as const;

export type SignInRulesState = (typeof SIGN_IN_RULES_STATES)[number];

export function signInRulesStateOf(name: string | undefined): SignInRulesState {
  return SIGN_IN_RULES_STATES.find((state) => state === name) ?? 'rules';
}

export interface SignInRulesStart {
  load: Load;
  page: RulesPage;
  viewer: RulesViewer;
}

export function signInRulesStart(state: SignInRulesState): SignInRulesStart {
  const start = (
    page: Partial<RulesPage> = {},
    viewer: RulesViewer = JULIEN,
  ): SignInRulesStart => ({
    load: 'loaded',
    page: { ...RULES, ...page },
    viewer,
  });

  switch (state) {
    case 'twoFactorDue':
      return start({ ownTwoFactor: false });
    case 'notYours':
      return start({ ownTwoFactor: false, inactivityLimit: ONLY_HERE }, PRIYA);
    case 'everyone':
      return start({
        everyoneNeedsTwoFactor: true,
        ownTwoFactor: false,
        changes: [EVERYONE, ...CHANGES],
      });
    case 'googleOnly':
      return start(
        {
          providerOnly: true,
          ownTwoFactor: false,
          inactivityLimit: ONLY_HERE,
          changes: [GOOGLE_ONLY, ...CHANGES],
        },
        ANA,
      );
    case 'newChange':
      return start({}, { ...JULIEN, seen: '2026-09-01T10:05' });
    case 'noChanges':
      return start(
        { inactivityTimeoutDays: null, administratorsNeedTwoFactor: false, changes: [] },
        { ...JULIEN, seen: null },
      );
    case 'loading':
    case 'failed':
      return { ...start(), load: state };
    case 'rules':
      return start();
  }
}
