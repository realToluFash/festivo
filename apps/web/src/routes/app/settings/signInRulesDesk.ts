import type {
  LinkedProvider,
  Membership,
  SignInRuleChange,
  SignInRulesChanges,
  SignInRulesPage,
} from '@soirely/api-client';
import { keptBackBy, listFormat, roleName } from '@soirely/domain';
import type { TFunction } from 'i18next';

import type { Mark } from '../../../components/SignInRulesParts.tsx';

export type RuleKey = 'method' | 'limit' | 'twoFactor';
export type Step = 'link' | 'turnOn';
export type Hold = 'member' | 'linked' | 'twoFactor' | null;
export type Refusal = 'provider' | 'twoFactor';

type Role = 'Owner' | 'Admin' | 'Member';
type Rules = Required<SignInRulesChanges>;

export const SECURITY = '/app/account/security';

/** The state a move to Security carries: two-factor's set-up opens on arrival, and a way to link lands at rest with none. */
export function securityOn(step: Step): { opens: 'turnOn' } | null {
  return step === 'turnOn' ? { opens: step } : null;
}

/** Whether a move to Security asked for two-factor's set-up, from the state securityOn gave it. */
export function opensSetUp(state: unknown): boolean {
  return typeof state === 'object' && state != null && 'opens' in state && state.opens === 'turnOn';
}

export interface RuleRow {
  key: RuleKey;
  mark: Mark;
  title: string;
  lines: string[];
  ask: { consequence: string; step: Step } | null;
}

export interface Reader {
  t: TFunction;
  organisation: Membership;
  providers: readonly LinkedProvider[];
  /** The browser's, for the days in What changed. */
  locale: string;
  /** The account's, for the two-factor deadline. */
  timezone: string | null;
  thisYear: number;
}

function roleOf(organisation: Membership): Role {
  return organisation.role.seededAs === 'owner'
    ? 'Owner'
    : organisation.role.seededAs === 'administrator'
      ? 'Admin'
      : 'Member';
}

/** Who may change the rules is the server's: what the role holds, then what keeps it back. */
export function holdOf(organisation: Membership, manages: boolean): Hold {
  if (manages) return null;
  const kept = keptBackBy(organisation, 'organisation.manage');

  return kept.includes('linking') ? 'linked' : kept.includes('twoFactor') ? 'twoFactor' : 'member';
}

export function dayOf(
  at: string,
  locale: string,
  thisYear: number,
  { weekday = false, timeZone }: { weekday?: boolean; timeZone?: string | undefined } = {},
): string {
  const day = new Date(at);
  const zoned = timeZone == null ? {} : { timeZone };
  const year = Number(new Intl.DateTimeFormat('en', { year: 'numeric', ...zoned }).format(day));

  return new Intl.DateTimeFormat(locale, {
    ...(weekday ? { weekday: 'long' as const } : {}),
    month: 'short',
    day: 'numeric',
    ...(year === thisYear ? {} : { year: 'numeric' as const }),
    ...zoned,
  }).format(day);
}

function linkedLine(t: TFunction, providers: readonly LinkedProvider[]): string[] {
  const google = providers.some(({ provider }) => provider === 'google');
  const apple = providers.some(({ provider }) => provider === 'apple');

  if (google && apple) return [t('signInRules.methodLinkedBoth')];
  if (google) return [t('signInRules.methodLinkedGoogle')];
  if (apple) return [t('signInRules.methodLinkedApple')];

  return [];
}

function method(page: SignInRulesPage, reader: Reader): RuleRow {
  const { t, organisation } = reader;

  if (!page.providerOnly)
    return {
      key: 'method',
      mark: 'met',
      title: t('signInRules.methodAnyTitle'),
      lines: [t('signInRules.methodAnyLine')],
      ask: null,
    };
  if (page.ownProvider)
    return {
      key: 'method',
      mark: 'met',
      title: t('signInRules.providerOnly'),
      lines: linkedLine(t, reader.providers),
      ask: null,
    };

  return {
    key: 'method',
    mark: 'needs',
    title: t('signInRules.providerOnly'),
    lines: [t('signInRules.methodUnlinkedLine')],
    ask: {
      consequence: t('signInRules.methodUnlinkedAsk', { organisation: organisation.name }),
      step: 'link',
    },
  };
}

function limit(page: SignInRulesPage, { t, organisation }: Reader): RuleRow {
  const own = page.inactivityTimeoutDays;
  const shortest = page.inactivityLimit;
  const elsewhere =
    shortest != null &&
    shortest.organisationId !== organisation.id &&
    (own == null || shortest.days < own)
      ? shortest
      : null;
  const title =
    own == null ? t('signInRules.limitNoneTitle') : t('signInRules.limitTitle', { count: own });
  const line =
    elsewhere != null
      ? t(own == null ? 'signInRules.limitElsewhere' : 'signInRules.limitElsewhereShorter', {
          count: elsewhere.days,
          organisation: elsewhere.organisation,
        })
      : own == null
        ? t('signInRules.limitNoneLine')
        : t('signInRules.limitLine', { count: own });

  return { key: 'limit', mark: 'met', title, lines: [line], ask: null };
}

function twoFactor(page: SignInRulesPage, hold: Hold, reader: Reader): RuleRow {
  const { t, organisation } = reader;
  const on = page.ownTwoFactor;
  const role = roleOf(organisation);
  const row = (mark: Mark, title: string, lines: string[], consequence?: string): RuleRow => ({
    key: 'twoFactor',
    mark,
    title,
    lines,
    ask: consequence == null ? null : { consequence, step: 'turnOn' },
  });

  if (page.everyoneNeedsTwoFactor) {
    const title = t('signInRules.everyoneTitle');
    const others = page.withoutTwoFactor ?? [];
    const count =
      hold == null && others.length > 0
        ? [
            t('signInRules.everyoneStillWithout', {
              count: others.length,
              organisation: organisation.name,
            }),
          ]
        : [];
    if (on) return row('met', title, [t('signInRules.yoursOn'), ...count]);
    const by =
      page.twoFactorDeadline == null
        ? ''
        : dayOf(page.twoFactorDeadline.at, reader.locale, reader.thisYear, {
            weekday: true,
            timeZone: reader.timezone ?? undefined,
          });

    return row(
      'needs',
      title,
      [t('signInRules.everyoneDueLine', { day: by }), ...count],
      t('signInRules.everyoneDueAsk', { day: by, organisation: organisation.name }),
    );
  }
  if (page.administratorsNeedTwoFactor) {
    const title = t('signInRules.managersTitle');

    if (role === 'Member')
      return row('notApplicable', title, [
        t('signInRules.managersNotYours', { role: roleName(t, organisation.role) }),
      ]);
    if (on) return row('met', title, [t('signInRules.yoursOn')]);

    return row(
      'needs',
      title,
      [t(role === 'Owner' ? 'signInRules.managersDueOwner' : 'signInRules.managersDueAdmin')],
      t(role === 'Owner' ? 'signInRules.managersAskOwner' : 'signInRules.managersAskAdmin'),
    );
  }

  return row('met', t('signInRules.notRequiredTitle'), [
    t(on ? 'signInRules.notRequiredOn' : 'signInRules.notRequiredOff'),
  ]);
}

export function whereYouStand(page: SignInRulesPage, hold: Hold, reader: Reader): RuleRow[] {
  return [method(page, reader), limit(page, reader), twoFactor(page, hold, reader)];
}

export function standFoot(t: TFunction, page: SignInRulesPage): string | null {
  return page.administratorsNeedTwoFactor && !page.everyoneNeedsTwoFactor
    ? t('signInRules.managersAre')
    : null;
}

export function changedFoot(t: TFunction, hold: Hold, organisation: string): string | null {
  switch (hold) {
    case 'member':
      return t('signInRules.askOwner', { organisation });
    case 'linked':
      return t('signInRules.footLinked');
    case 'twoFactor':
      return t('signInRules.footTwoFactor');
    case null:
      return null;
  }
}

export function stepLabel(t: TFunction, step: Step): string {
  return t(step === 'link' ? 'signInRules.unlinkedLink' : 'signInRules.needsOwnTurnOn');
}

export interface RulesCard {
  says: string;
  line: string;
  step: Step | null;
}

export function rulesCard(
  rows: readonly RuleRow[],
  hold: Hold,
  { t, organisation }: Reader,
): RulesCard {
  const asks = rows.flatMap(({ ask }) => (ask == null ? [] : [ask]));
  const [first] = asks;

  if (first == null)
    return {
      says: t('signInRules.cardMeets', { organisation: organisation.name }),
      line:
        hold != null
          ? t('signInRules.cardSetBy')
          : t(
              roleOf(organisation) === 'Owner'
                ? 'signInRules.cardAsOwner'
                : 'signInRules.cardAsAdmin',
            ),
      step: null,
    };

  return {
    says: t('signInRules.cardNeeds', { count: asks.length }),
    line: first.consequence,
    step: first.step,
  };
}

function onOff(t: TFunction, value: SignInRuleChange['now']): string {
  return t(value === true ? 'signInRules.on' : 'signInRules.off');
}

export function changeTitle(t: TFunction, change: SignInRuleChange): string {
  switch (change.rule) {
    case 'providerOnly':
      return t(
        change.now === true ? 'signInRules.changedMethodProvider' : 'signInRules.changedMethodAny',
      );
    case 'inactivityTimeoutDays':
      return typeof change.now === 'number'
        ? t('signInRules.changedLimit', { count: change.now })
        : t('signInRules.changedLimitNone');
    case 'administratorsNeedTwoFactor':
      return t('signInRules.changedManagers', { value: onOff(t, change.now) });
    case 'everyoneNeedsTwoFactor':
      return t('signInRules.changedEveryone', { value: onOff(t, change.now) });
  }
}

function wasWords(t: TFunction, change: SignInRuleChange): string {
  switch (change.rule) {
    case 'providerOnly':
      return t(change.was === true ? 'signInRules.wasProvider' : 'signInRules.wasAny');
    case 'inactivityTimeoutDays':
      return typeof change.was === 'number'
        ? t('signInRules.wasLimit', { count: change.was })
        : t('signInRules.wasNoLimit');
    default:
      return t('signInRules.was', { value: onOff(t, change.was) });
  }
}

export interface ChangeRow {
  key: string;
  title: string;
  line: string;
  isNew: boolean;
}

/** Newest first; a change after the last one this browser saw before the page opened is New. */
export function changeRows(
  changes: readonly SignInRuleChange[],
  seen: string | null,
  { t, locale, thisYear }: Reader,
): ChangeRow[] {
  const seenAt = seen == null ? null : Date.parse(seen);

  return [...changes]
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .map((change) => ({
      key: `${change.entry}:${change.rule}`,
      title: changeTitle(t, change),
      line: t('signInRules.changeLine', {
        day: dayOf(change.at, locale, thisYear),
        was: wasWords(t, change),
        who: change.by.name,
      }),
      isNew: seenAt == null || Date.parse(change.at) > seenAt,
    }));
}

export function rulesOf(page: SignInRulesPage): Rules {
  return {
    providerOnly: page.providerOnly,
    inactivityTimeoutDays: page.inactivityTimeoutDays,
    administratorsNeedTwoFactor: page.administratorsNeedTwoFactor,
    everyoneNeedsTwoFactor: page.everyoneNeedsTwoFactor,
  };
}

const METHOD = { any: 'any', provider: 'provider' } as const;
const NO_LIMIT = 'none';
const TWO_FACTOR = { none: 'none', managers: 'managers', everyone: 'everyone' } as const;

export function editTitle(t: TFunction, key: RuleKey): string {
  switch (key) {
    case 'method':
      return t('signInRules.methodTitle');
    case 'limit':
      return t('signInRules.idleTitle');
    case 'twoFactor':
      return t('signInRules.twoFactorShort');
  }
}

export function inForce(key: RuleKey, rules: Rules): string {
  switch (key) {
    case 'method':
      return rules.providerOnly ? METHOD.provider : METHOD.any;
    case 'limit':
      return rules.inactivityTimeoutDays == null ? NO_LIMIT : String(rules.inactivityTimeoutDays);
    case 'twoFactor':
      return rules.everyoneNeedsTwoFactor
        ? TWO_FACTOR.everyone
        : rules.administratorsNeedTwoFactor
          ? TWO_FACTOR.managers
          : TWO_FACTOR.none;
  }
}

export interface Choice {
  id: string;
  name: string;
  line: string | null;
  now: boolean;
}

export function choicesOf(
  t: TFunction,
  key: RuleKey,
  page: SignInRulesPage,
  organisation: string,
): Choice[] {
  const now = inForce(key, rulesOf(page));
  const choice = (id: string, name: string, line: string | null = null): Choice => ({
    id,
    name,
    line,
    now: id === now,
  });

  switch (key) {
    case 'method':
      return [
        choice(METHOD.any, t('signInRules.anyMethod'), t('signInRules.anyMethodMeans')),
        choice(
          METHOD.provider,
          t('signInRules.providerOnly'),
          t('signInRules.providerOnlyMeans', { organisation }),
        ),
      ];
    case 'limit':
      return [
        ...page.inactivityChoices.map((days) =>
          choice(String(days), t('signInRules.days', { count: days })),
        ),
        choice(NO_LIMIT, t('signInRules.noLimit')),
      ];
    case 'twoFactor':
      return [
        choice(TWO_FACTOR.none, t('signInRules.notRequired'), t('signInRules.choiceNoneLine')),
        choice(
          TWO_FACTOR.managers,
          t('signInRules.choiceManagers'),
          t('signInRules.choiceManagersLine'),
        ),
        choice(
          TWO_FACTOR.everyone,
          t('signInRules.choiceEveryone'),
          t('signInRules.choiceEveryoneLine', { organisation }),
        ),
      ];
  }
}

/** The rules as they would be with this pick. Two-factor for everyone covers managers, so it leaves theirs as it was. */
export function applied(key: RuleKey, picked: string, rules: Rules): Rules {
  switch (key) {
    case 'method':
      return { ...rules, providerOnly: picked === METHOD.provider };
    case 'limit':
      return { ...rules, inactivityTimeoutDays: picked === NO_LIMIT ? null : Number(picked) };
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

/** Only what the edit changes is sent. */
export function differences(saved: Rules, chosen: Rules): SignInRulesChanges {
  const changes: SignInRulesChanges = {};

  if (saved.providerOnly !== chosen.providerOnly) changes.providerOnly = chosen.providerOnly;
  if (saved.inactivityTimeoutDays !== chosen.inactivityTimeoutDays)
    changes.inactivityTimeoutDays = chosen.inactivityTimeoutDays;
  if (saved.administratorsNeedTwoFactor !== chosen.administratorsNeedTwoFactor)
    changes.administratorsNeedTwoFactor = chosen.administratorsNeedTwoFactor;
  if (saved.everyoneNeedsTwoFactor !== chosen.everyoneNeedsTwoFactor)
    changes.everyoneNeedsTwoFactor = chosen.everyoneNeedsTwoFactor;

  return changes;
}

/** A rule the viewer does not meet yet cannot be required, so nobody locks themselves out. */
export function refusalOf(key: RuleKey, picked: string, page: SignInRulesPage): Refusal | null {
  if (picked === inForce(key, rulesOf(page))) return null;
  if (key === 'method' && picked === METHOD.provider && !page.ownProvider) return 'provider';
  if (key === 'twoFactor' && picked !== TWO_FACTOR.none && !page.ownTwoFactor) return 'twoFactor';

  return null;
}

export const REFUSALS: Record<Refusal, { title: string; line: string; step: Step }> = {
  provider: {
    title: 'signInRules.needsOwnProviderTitle',
    line: 'signInRules.needsOwnProviderBody',
    step: 'link',
  },
  twoFactor: {
    title: 'signInRules.needsOwnTitle',
    line: 'signInRules.needsOwnBody',
    step: 'turnOn',
  },
};

/** What saving this pick does, in the product's lines, with the names of who it leaves short. */
export function effectsOf(
  t: TFunction,
  page: SignInRulesPage,
  after: Rules,
  language: string,
): string[] {
  const before = rulesOf(page);
  const names = (people: readonly { name: string }[]) =>
    listFormat(language, { type: 'conjunction' }).format(people.map(({ name }) => name));
  const said: string[] = [];

  if (after.providerOnly !== before.providerOnly) {
    if (after.providerOnly) {
      const stranded = page.passwordOnly ?? [];
      said.push(t('signInRules.effectProviderOnly'));
      if (stranded.length > 0)
        said.push(t('signInRules.effectStranded', { names: names(stranded) }));
    } else said.push(t('signInRules.effectAnyMethod'));
  }
  if (after.inactivityTimeoutDays !== before.inactivityTimeoutDays)
    said.push(
      after.inactivityTimeoutDays == null
        ? t('signInRules.effectNoLimit')
        : t('signInRules.effectIdle', { count: after.inactivityTimeoutDays }),
    );
  if (after.administratorsNeedTwoFactor !== before.administratorsNeedTwoFactor)
    said.push(
      t(
        after.administratorsNeedTwoFactor
          ? 'signInRules.effectTwoFactorOn'
          : 'signInRules.effectTwoFactorOff',
      ),
    );
  if (after.everyoneNeedsTwoFactor !== before.everyoneNeedsTwoFactor) {
    if (after.everyoneNeedsTwoFactor) {
      const without = page.withoutTwoFactor ?? [];
      said.push(t('signInRules.effectEveryoneOn'));
      if (without.length > 0)
        said.push(t('signInRules.effectWithout', { count: without.length, names: names(without) }));
    } else said.push(t('signInRules.effectEveryoneOff'));
  }

  return said.length > 0 ? said : [t('signInRules.effectNothing')];
}
