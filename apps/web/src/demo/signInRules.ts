import type { Load } from './members.ts';
import type { Mark } from '../components/SignInRulesParts.tsx';
import type { Choice } from '../components/SettingsParts.tsx';
import { HELD_STEPS, type HeldStep } from './security.ts';
import { type DemoLink, type Viewer, VIEWERS, settingsPath } from './settings.ts';

export const ORGANISATION = 'Ire Events';
export const MANAGERS_ARE = 'Managers are owners and admins.';
export const EMAIL_NOTE = 'Everyone affected gets an email saying what changed and why.';
export const SAVE_FAILED = 'The rules were not saved. Nothing changed. Try again in a moment.';

export type Role = 'Owner' | 'Admin' | 'Member';
type Area = 'members' | 'billing' | 'security';

/** The three roles, from what the viewer holds: an Admin has everything but billing. */
export function roleOf(viewer: Pick<Viewer, 'owns' | 'manages'>): Role {
  return viewer.owns ? 'Owner' : viewer.manages ? 'Admin' : 'Member';
}

const AREAS: Record<Role, readonly Area[]> = {
  Owner: ['members', 'billing', 'security'],
  Admin: ['members', 'security'],
  Member: [],
};

export type RuleName =
  | 'providerOnly'
  | 'inactivityTimeoutDays'
  | 'administratorsNeedTwoFactor'
  | 'everyoneNeedsTwoFactor';

export interface Rules {
  providerOnly: boolean;
  inactivityTimeoutDays: number | null;
  administratorsNeedTwoFactor: boolean;
  everyoneNeedsTwoFactor: boolean;
}

export interface Change {
  rule: RuleName;
  now: boolean | number | null;
  was: boolean | number | null;
  /** Wall clock where the reader is; the sample has no zone of its own. */
  at: string;
  by: string;
}

/** What GET sign-in-rules gives, with the account's linked way and signInRulesSeen. */
export interface RulesPage extends Rules {
  twoFactorDeadline: string;
  inactivityLimit: { organisation: string; days: number } | null;
  ownTwoFactor: boolean;
  linked: 'Google' | 'Apple' | null;
  passwordOnly: readonly string[];
  /** Under two-factor for everyone, who still has none: only a manager is told (sc-609). */
  withoutTwoFactor: readonly string[];
  seen: string | null;
  changes: readonly Change[];
}

export type RuleKey = 'method' | 'limit' | 'twoFactor';

export const MARK_WORD: Record<Mark, string> = {
  met: 'Met.',
  needs: 'Needs you.',
  notApplicable: 'Doesn’t apply.',
};

export interface RuleRow {
  key: RuleKey;
  mark: Mark;
  title: string;
  line: string;
  more?: string;
  ask: { consequence: string; step: HeldStep } | null;
}

function days(count: number): string {
  return count === 1 ? '1 day' : `${count} days`;
}

function listOf(words: readonly string[], last: 'and' | 'or' = 'and'): string {
  if (words.length < 2) return words.join('');

  return `${words.slice(0, -1).join(', ')} ${last} ${words.at(-1)}`;
}

export function dayIn(at: string, locale: string, thisYear: number, weekday = false): string {
  const day = new Date(`${at.slice(0, 10)}T12:00Z`);

  return new Intl.DateTimeFormat(locale, {
    ...(weekday ? { weekday: 'long' as const } : {}),
    month: 'short',
    day: 'numeric',
    ...(day.getUTCFullYear() === thisYear ? {} : { year: 'numeric' as const }),
    timeZone: 'UTC',
  }).format(day);
}

function method(page: RulesPage): RuleRow {
  if (!page.providerOnly)
    return {
      key: 'method',
      mark: 'met',
      title: 'Sign in any way',
      line: 'Password, Google and Apple all work.',
      ask: null,
    };
  if (page.linked != null)
    return {
      key: 'method',
      mark: 'met',
      title: 'Google or Apple only',
      line: `You have ${page.linked} linked.`,
      ask: null,
    };

  return {
    key: 'method',
    mark: 'needs',
    title: 'Google or Apple only',
    line: 'Your password still signs you in. Link one to change things again.',
    ask: {
      consequence: `Until you link one, you can read but not change anything in ${ORGANISATION}.`,
      step: HELD_STEPS.link,
    },
  };
}

function limit(page: RulesPage): RuleRow {
  const own = page.inactivityTimeoutDays;
  const shortest = page.inactivityLimit;
  const elsewhere =
    shortest != null &&
    shortest.organisation !== ORGANISATION &&
    (own == null || shortest.days < own)
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

function twoFactor(page: RulesPage, role: Role, locale: string, thisYear: number): RuleRow {
  const on = page.ownTwoFactor;
  const row = (mark: Mark, title: string, line: string, consequence?: string): RuleRow => ({
    key: 'twoFactor',
    mark,
    title,
    line,
    ask: consequence == null ? null : { consequence, step: HELD_STEPS.turnOn },
  });

  if (page.everyoneNeedsTwoFactor) {
    const by = dayIn(page.twoFactorDeadline, locale, thisYear, true);
    const without = page.withoutTwoFactor.length;
    const more =
      without === 0
        ? {}
        : {
            more:
              without === 1
                ? `1 person doesn’t have two-factor yet. They see a banner until their deadline, then can’t open anything in ${ORGANISATION} until they turn it on.`
                : `${without} people don’t have two-factor yet. Each sees a banner until their deadline, then can’t open anything in ${ORGANISATION} until they turn it on.`,
          };

    return on
      ? { ...row('met', 'Two-factor for everyone', 'Yours is on.'), ...more }
      : row(
          'needs',
          'Two-factor for everyone',
          `Not on yet. Turn it on by ${by}.`,
          `Turn it on by ${by}, or you can’t open ${ORGANISATION} after that.`,
        );
  }
  if (page.administratorsNeedTwoFactor) {
    if (role === 'Member')
      return row(
        'notApplicable',
        'Two-factor for managers',
        `Doesn’t apply to your role, ${role}.`,
      );

    return on
      ? row('met', 'Two-factor for managers', 'Yours is on.')
      : row(
          'needs',
          'Two-factor for managers',
          `Not on yet. Changes to ${listOf(AREAS[role])} wait until it is.`,
          `Until it’s on, changes to ${listOf(AREAS[role], 'or')} wait. Your events keep working.`,
        );
  }

  return row(
    'met',
    'Two-factor not required',
    on ? 'Yours is on anyway.' : 'You can turn it on in Security.',
  );
}

export function whereYouStand(
  page: RulesPage,
  role: Role,
  locale: string,
  thisYear: number,
): RuleRow[] {
  return [method(page), limit(page), twoFactor(page, role, locale, thisYear)];
}

export function standFoot(page: Rules): string | undefined {
  return page.administratorsNeedTwoFactor && !page.everyoneNeedsTwoFactor
    ? MANAGERS_ARE
    : undefined;
}

export type Hold = 'member' | 'linked' | 'twoFactor' | null;

export function holdOf(page: RulesPage, role: Role): Hold {
  if (role === 'Member') return 'member';
  if (page.providerOnly && page.linked == null) return 'linked';
  if (page.administratorsNeedTwoFactor && !page.ownTwoFactor) return 'twoFactor';

  return null;
}

export function changedFoot(hold: Hold): string | undefined {
  switch (hold) {
    case 'member':
      return `Questions? Ask an owner or admin of ${ORGANISATION}.`;
    case 'linked':
      return 'Until you link Google or Apple, you can see these rules but not change them.';
    case 'twoFactor':
      return 'Until you turn on two-factor, you can see these rules but not change them.';
    case null:
      return undefined;
  }
}

export interface RulesCard {
  says: string;
  line: string;
  step: HeldStep | null;
}

export function rulesCard(rules: readonly RuleRow[], role: Role, hold: Hold): RulesCard {
  const asks = rules.flatMap(({ ask }) => (ask == null ? [] : [ask]));
  const [first] = asks;

  if (first == null)
    return {
      says: `You meet ${ORGANISATION}’ rules`,
      line:
        hold == null
          ? `As ${role === 'Owner' ? 'an owner' : 'an admin'}, you can change them below.`
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

function wasWords(change: Change): string {
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
  key: string;
  title: string;
  line: string;
  isNew: boolean;
}

/** Newest first; a change after the last one the viewer saw is New. */
export function changeRows(
  changes: readonly Change[],
  seen: string | null,
  locale: string,
  thisYear: number,
): ChangeRow[] {
  return [...changes]
    .sort((a, b) => b.at.localeCompare(a.at))
    .map((change) => ({
      key: `${change.at}:${change.rule}`,
      title: changeTitle(change),
      line: [dayIn(change.at, locale, thisYear), wasWords(change), change.by].join(' · '),
      isNew: seen == null || change.at > seen,
    }));
}

export const EDIT_TITLES: Record<RuleKey, string> = {
  method: 'How people sign in',
  limit: 'How long a sign-in lasts unused',
  twoFactor: 'Two-factor',
};

const METHOD = { any: 'Any method', provider: 'Google or Apple only' } as const;
const LIMITS: readonly { name: string; days: number | null }[] = [
  { name: '7 days', days: 7 },
  { name: '30 days', days: 30 },
  { name: 'No limit', days: null },
];
const TWO_FACTOR = {
  none: 'Not required',
  managers: 'For managers',
  everyone: 'For everyone',
} as const;

export const LIMIT_INTRO =
  'After this long without using Soirely, people are asked to sign in again.';

export function inForce(key: RuleKey, rules: Rules): string {
  switch (key) {
    case 'method':
      return rules.providerOnly ? METHOD.provider : METHOD.any;
    case 'limit':
      return LIMITS.find((one) => one.days === rules.inactivityTimeoutDays)?.name ?? 'No limit';
    case 'twoFactor':
      return rules.everyoneNeedsTwoFactor
        ? TWO_FACTOR.everyone
        : rules.administratorsNeedTwoFactor
          ? TWO_FACTOR.managers
          : TWO_FACTOR.none;
  }
}

export function choicesOf(key: RuleKey, rules: Rules): Choice[] {
  const now = inForce(key, rules);
  const choice = (name: string, line: string | null = null): Choice => ({
    name,
    line,
    now: name === now,
  });

  switch (key) {
    case 'method':
      return [
        choice(METHOD.any, 'Email and password, Google or Apple. Each person chooses.'),
        choice(METHOD.provider, `Passwords stop working for signing in to ${ORGANISATION}.`),
      ];
    case 'limit':
      return LIMITS.map((one) => choice(one.name));
    case 'twoFactor':
      return [
        choice(TWO_FACTOR.none, 'People choose for themselves.'),
        choice(
          TWO_FACTOR.managers,
          'Owners and admins need it to change members, billing or security.',
        ),
        choice(
          TWO_FACTOR.everyone,
          `Everyone in ${ORGANISATION} needs it, whichever way they sign in.`,
        ),
      ];
  }
}

/** The rules as they would be with this choice. Two-factor for everyone covers managers, so it leaves theirs as it was. */
export function applied(key: RuleKey, picked: string, rules: Rules): Rules {
  switch (key) {
    case 'method':
      return { ...rules, providerOnly: picked === METHOD.provider };
    case 'limit':
      return {
        ...rules,
        inactivityTimeoutDays: LIMITS.find((one) => one.name === picked)?.days ?? null,
      };
    case 'twoFactor':
      return picked === TWO_FACTOR.everyone
        ? { ...rules, everyoneNeedsTwoFactor: true }
        : {
            ...rules,
            administratorsNeedTwoFactor: picked === TWO_FACTOR.managers,
            everyoneNeedsTwoFactor: false,
          };
  }
}

const RULE_ORDER: readonly RuleName[] = [
  'providerOnly',
  'inactivityTimeoutDays',
  'administratorsNeedTwoFactor',
  'everyoneNeedsTwoFactor',
];

export function changesBetween(before: Rules, after: Rules, at: string, by: string): Change[] {
  return RULE_ORDER.filter((rule) => before[rule] !== after[rule]).map((rule) => ({
    rule,
    now: after[rule],
    was: before[rule],
    at,
    by,
  }));
}

export type Refusal = 'provider' | 'twoFactor';

export const REFUSALS: Record<Refusal, { title: string; line: string; step: HeldStep }> = {
  provider: {
    title: 'Link Google or Apple for yourself first',
    line: 'Then you can require it here.',
    step: HELD_STEPS.link,
  },
  twoFactor: {
    title: 'Turn on two-factor for yourself first',
    line: 'Then you can require it here.',
    step: HELD_STEPS.turnOn,
  },
};

/** A rule the viewer does not meet yet cannot be required, so nobody locks themselves out. */
export function refusalOf(key: RuleKey, picked: string, page: RulesPage): Refusal | null {
  if (picked === inForce(key, page)) return null;
  if (key === 'method' && picked === METHOD.provider && page.linked == null) return 'provider';
  if (key === 'twoFactor' && picked !== TWO_FACTOR.none && !page.ownTwoFactor) return 'twoFactor';

  return null;
}

export function effectsOf(before: Rules, after: Rules, passwordOnly: readonly string[]): string[] {
  const said: string[] = [];

  if (after.providerOnly !== before.providerOnly) {
    if (after.providerOnly) {
      said.push(
        'Everyone signs in with Google or Apple. Anyone with one linked who signed in with a password is asked to sign in again with it.',
      );
      if (passwordOnly.length > 0)
        said.push(
          `${listOf(passwordOnly)} can read but not change anything until they link Google or Apple. Their password still signs them in.`,
        );
    } else said.push('People can sign in with their password again.');
  }
  if (after.inactivityTimeoutDays !== before.inactivityTimeoutDays)
    said.push(
      after.inactivityTimeoutDays == null
        ? 'Sign-ins last until people sign out.'
        : `Anyone who has not used Soirely for ${days(after.inactivityTimeoutDays)} is asked to sign in again, from their next visit.`,
    );
  if (after.administratorsNeedTwoFactor !== before.administratorsNeedTwoFactor)
    said.push(
      after.administratorsNeedTwoFactor
        ? 'Owners and admins need two-factor to change members, billing or security. Until they turn it on, only those changes wait; their events keep working.'
        : 'Owners and admins can change members, billing or security without two-factor.',
    );
  if (after.everyoneNeedsTwoFactor !== before.everyoneNeedsTwoFactor)
    said.push(
      after.everyoneNeedsTwoFactor
        ? 'Everyone needs two-factor. Anyone without it is emailed and has 7 days to turn it on.'
        : 'Two-factor is no longer required of everyone.',
    );

  return said.length > 0 ? said : ['Nothing changes. These are the rules in force.'];
}

export function staysLine(key: RuleKey, page: RulesPage): string {
  const row = whereYouStand(page, 'Owner', 'en', 0).find((one) => one.key === key);

  return `${row?.title ?? EDIT_TITLES[key]} stays the rule.`;
}

export interface Edit {
  key: RuleKey;
  picked: string;
  ask: boolean;
  saving?: boolean;
  failed?: boolean;
}

const CHANGES: readonly Change[] = [
  {
    rule: 'administratorsNeedTwoFactor',
    now: true,
    was: false,
    at: '2026-10-28T15:12',
    by: 'Folake Adeyemi',
  },
  {
    rule: 'inactivityTimeoutDays',
    now: 30,
    was: null,
    at: '2026-09-01T10:05',
    by: 'Folake Adeyemi',
  },
];

const EVERYONE: Change = {
  rule: 'everyoneNeedsTwoFactor',
  now: true,
  was: false,
  at: '2026-11-04T09:40',
  by: 'Folake Adeyemi',
};

const GOOGLE_ONLY: Change = {
  rule: 'providerOnly',
  now: true,
  was: false,
  at: '2026-11-02T11:20',
  by: 'Folake Adeyemi',
};

const RULES: RulesPage = {
  providerOnly: false,
  inactivityTimeoutDays: 30,
  administratorsNeedTwoFactor: true,
  everyoneNeedsTwoFactor: false,
  twoFactorDeadline: '2026-11-11',
  inactivityLimit: { organisation: 'Lumen Studio', days: 7 },
  ownTwoFactor: true,
  linked: 'Google',
  passwordOnly: ['Priya Shah', 'Ana Souza'],
  withoutTwoFactor: [],
  seen: '2026-10-28T15:12',
  changes: CHANGES,
};

const ONLY_HERE = { organisation: ORGANISATION, days: 30 };
const NO_CHANGES: Partial<RulesPage> = {
  inactivityTimeoutDays: null,
  administratorsNeedTwoFactor: false,
  changes: [],
  seen: null,
};

export const SIGN_IN_RULES_STATES = [
  'twoFactorDue',
  'notYours',
  'everyone',
  'googleOnly',
  'newChange',
  'noChanges',
  'loading',
  'failed',
  'method',
  'methodGoogle',
  'methodRefused',
  'limit',
  'limitPicked',
  'limitDiscard',
  'limitSaved',
  'twoFactor',
  'twoFactorEveryone',
  'twoFactorRefused',
  'everyoneWithout',
  'limitSaving',
  'limitSaveFailed',
] as const;

export interface SignInRulesStart {
  load: Load;
  page: RulesPage;
  edit: Edit | null;
}

/** `now` is the reader's wall clock, for a change saved today. */
export function signInRulesStart(state: string, by: string, now: string): SignInRulesStart {
  const start = (page: Partial<RulesPage> = {}, edit: Edit | null = null): SignInRulesStart => ({
    load: 'loaded',
    page: { ...RULES, ...page },
    edit,
  });
  const edit = (key: RuleKey, picked: string, ask = false): Edit => ({ key, picked, ask });

  switch (state) {
    case 'twoFactorDue':
      return start({ ownTwoFactor: false });
    case 'notYours':
      return start({ ownTwoFactor: false, linked: null, inactivityLimit: ONLY_HERE });
    case 'everyone':
      return start({
        everyoneNeedsTwoFactor: true,
        ownTwoFactor: false,
        changes: [EVERYONE, ...CHANGES],
      });
    case 'googleOnly':
      return start({
        providerOnly: true,
        ownTwoFactor: false,
        linked: null,
        inactivityLimit: ONLY_HERE,
        changes: [GOOGLE_ONLY, ...CHANGES],
      });
    case 'newChange':
      return start({ seen: '2026-09-01T10:05' });
    case 'noChanges':
      return start(NO_CHANGES);
    case 'loading':
    case 'failed':
      return { ...start(), load: state };
    case 'method':
      return start({}, edit('method', METHOD.any));
    case 'methodGoogle':
      return start({}, edit('method', METHOD.provider));
    case 'methodRefused':
      return start({ linked: null }, edit('method', METHOD.provider));
    case 'limit':
      return start({}, edit('limit', '30 days'));
    case 'limitPicked':
      return start({}, edit('limit', '7 days'));
    case 'limitSaving':
      return start({}, { ...edit('limit', '7 days'), saving: true });
    case 'limitSaveFailed':
      return start({}, { ...edit('limit', '7 days'), failed: true });
    case 'everyoneWithout':
      return start({
        everyoneNeedsTwoFactor: true,
        withoutTwoFactor: ['Priya Shah', 'Ana Souza', 'Tunde Bakare'],
        changes: [EVERYONE, ...CHANGES],
      });
    case 'limitDiscard':
      return start({}, edit('limit', '7 days', true));
    case 'limitSaved':
      return start({
        inactivityTimeoutDays: 7,
        seen: now,
        changes: [
          ...changesBetween(RULES, { ...RULES, inactivityTimeoutDays: 7 }, now, by),
          ...CHANGES,
        ],
      });
    case 'twoFactor':
      return start({}, edit('twoFactor', TWO_FACTOR.managers));
    case 'twoFactorEveryone':
      return start({}, edit('twoFactor', TWO_FACTOR.everyone));
    case 'twoFactorRefused':
      return start({ ...NO_CHANGES, ownTwoFactor: false }, edit('twoFactor', TWO_FACTOR.managers));
    default:
      return start();
  }
}

function rules(state: string | undefined, name: string, viewer: Viewer = VIEWERS.folake): DemoLink {
  return { to: settingsPath('signInRules', viewer, state), name };
}

/** The states the boards draw, each opened from the demo's home as someone in the role it is drawn for. */
export const SIGN_IN_RULES_PAGES: readonly { name: string; states: readonly DemoLink[] }[] = [
  {
    name: 'Sign-in rules',
    states: [
      rules(undefined, 'Every rule met, an owner'),
      rules(undefined, 'Every rule met, an admin', VIEWERS.julien),
      rules(undefined, 'Every rule met, a member reads them', VIEWERS.ana),
      rules('twoFactorDue', 'Two-factor due, an admin', VIEWERS.julien),
      rules('notYours', 'Two-factor for managers does not apply, a member', VIEWERS.ana),
      rules('everyone', 'Two-factor for everyone, an admin', VIEWERS.julien),
      rules('everyoneWithout', 'Two-factor for everyone, 3 people without it, an owner'),
      rules('googleOnly', 'Google or Apple only, a member', VIEWERS.ana),
      rules('newChange', 'A change not seen yet, an admin', VIEWERS.julien),
      rules('noChanges', 'No changes yet, an admin', VIEWERS.julien),
      rules('loading', 'Loading'),
      rules('failed', 'Failed'),
    ],
  },
  {
    name: 'Changing a rule',
    states: [
      rules('method', 'How people sign in, just opened'),
      rules('methodGoogle', 'Google or Apple only picked'),
      rules('methodRefused', 'Google or Apple only, none linked yourself'),
      rules('limit', 'How long a sign-in lasts, just opened'),
      rules('limitPicked', '7 days picked'),
      rules('limitDiscard', 'Cancel after a change'),
      rules('limitSaving', 'Saving…'),
      rules('limitSaveFailed', 'Not saved, Save again'),
      rules('limitSaved', 'Saved, the change at the top'),
      rules('twoFactor', 'Two-factor, just opened'),
      rules('twoFactorEveryone', 'For everyone picked'),
      rules('twoFactorRefused', 'For managers, yours off'),
    ],
  },
];
