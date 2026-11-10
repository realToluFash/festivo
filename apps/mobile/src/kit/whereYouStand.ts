import type { SignInRuleChange } from '@soirely/api-client';
import { listFormat } from '@soirely/domain';
import { type TFunction } from 'i18next';

/** The areas the two-factor rule for managers holds back, as Permission::isAdministrative has them. */
export type Area = 'members' | 'billing' | 'security';

const AREA_OF: Record<string, Area> = {
  members: 'members',
  billing: 'billing',
  organisation: 'security',
};

export function managedAreas(permissions: readonly string[]): Area[] {
  const areas = new Set<Area>();
  for (const permission of permissions) {
    const area = AREA_OF[permission.split('.')[0] ?? ''];
    if (area != null) areas.add(area);
  }

  return (['members', 'billing', 'security'] as const).filter((area) => areas.has(area));
}

/** What the page shows of the rules: the API's page, with a shorter limit elsewhere already found. */
export interface StandRules {
  providerOnly: boolean;
  inactivityTimeoutDays: number | null;
  administratorsNeedTwoFactor: boolean;
  everyoneNeedsTwoFactor: boolean;
  twoFactorDeadline: string | null;
  elsewhere: { organisation: string; days: number } | null;
  ownTwoFactor: boolean;
}

/** Who is reading, from the session and the account's linked ways. */
export interface StandViewer {
  organisation: string;
  role: string;
  manages: readonly Area[];
  setsRules: boolean;
  linked: string | null;
}

export type Mark = 'met' | 'needs' | 'notApplicable';
export type RuleKey = 'method' | 'limit' | 'twoFactor';

export interface RuleRow {
  key: RuleKey;
  mark: Mark;
  title: string;
  line: string;
  ask: { consequence: string; step: string; opens: 'link' | 'twoFactor' } | null;
}

/** A day as the locale writes it in the reader's zone, the year only outside this one; a bare date is that calendar day. */
export function dayIn(
  at: string,
  locale: string,
  now: Date,
  { weekday = false, timeZone }: { weekday?: boolean; timeZone?: string } = {},
): string {
  const bare = /^\d{4}-\d{2}-\d{2}$/.test(at);
  const day = new Date(bare ? `${at}T12:00Z` : at);
  const zone = bare ? 'UTC' : timeZone;
  const year = (date: Date) =>
    new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: zone }).format(date);

  return new Intl.DateTimeFormat(locale, {
    ...(weekday ? { weekday: 'long' as const } : {}),
    month: 'short',
    day: 'numeric',
    ...(year(day) === year(now) ? {} : { year: 'numeric' as const }),
    timeZone: zone,
  }).format(day);
}

function method(t: TFunction, rules: StandRules, viewer: StandViewer): RuleRow {
  if (!rules.providerOnly)
    return {
      key: 'method',
      mark: 'met',
      title: t('signInRules.stand.anyWayTitle'),
      line: t('signInRules.stand.anyWayLine'),
      ask: null,
    };
  if (viewer.linked != null)
    return {
      key: 'method',
      mark: 'met',
      title: t('signInRules.stand.providerOnlyTitle'),
      line: t('signInRules.stand.linkedLine', { provider: viewer.linked }),
      ask: null,
    };

  return {
    key: 'method',
    mark: 'needs',
    title: t('signInRules.stand.providerOnlyTitle'),
    line: t('signInRules.stand.unlinkedLine'),
    ask: {
      consequence: t('signInRules.stand.unlinkedAsk', { organisation: viewer.organisation }),
      step: t('signInRules.stand.linkStep'),
      opens: 'link',
    },
  };
}

function limit(t: TFunction, rules: StandRules): RuleRow {
  const own = rules.inactivityTimeoutDays;
  const elsewhere =
    rules.elsewhere != null && (own == null || rules.elsewhere.days < own) ? rules.elsewhere : null;
  const title =
    own == null
      ? t('signInRules.stand.noLimitTitle')
      : t('signInRules.stand.limitTitle', { count: own });
  const line =
    elsewhere != null
      ? t(own == null ? 'signInRules.stand.elsewhereLine' : 'signInRules.stand.shorterLine', {
          count: elsewhere.days,
          organisation: elsewhere.organisation,
        })
      : own == null
        ? t('signInRules.stand.noLimitLine')
        : t('signInRules.stand.limitLine', { count: own });

  return { key: 'limit', mark: 'met', title, line, ask: null };
}

function twoFactor(
  t: TFunction,
  rules: StandRules,
  viewer: StandViewer,
  locale: string,
  now: Date,
): RuleRow {
  const on = rules.ownTwoFactor;
  const row = (mark: Mark, title: string, line: string, consequence?: string): RuleRow => ({
    key: 'twoFactor',
    mark,
    title,
    line,
    ask:
      consequence == null
        ? null
        : { consequence, step: t('signInRules.stand.turnOnStep'), opens: 'twoFactor' },
  });

  if (rules.everyoneNeedsTwoFactor) {
    const title = t('signInRules.stand.everyoneTitle');
    if (on) return row('met', title, t('signInRules.stand.yoursOn'));
    const by =
      rules.twoFactorDeadline == null
        ? ''
        : dayIn(rules.twoFactorDeadline, locale, now, { weekday: true });

    return row(
      'needs',
      title,
      t('signInRules.stand.everyoneNotOn', { day: by }),
      t('signInRules.stand.everyoneAsk', { day: by, organisation: viewer.organisation }),
    );
  }
  if (rules.administratorsNeedTwoFactor) {
    const title = t('signInRules.stand.managersTitle');
    if (viewer.manages.length === 0)
      return row('notApplicable', title, t('signInRules.stand.notYourRole', { role: viewer.role }));
    if (on) return row('met', title, t('signInRules.stand.yoursOn'));

    return row(
      'needs',
      title,
      t('signInRules.stand.managersNotOn', {
        areas: listFormat(locale, { type: 'conjunction' }).format(
          viewer.manages.map((area) => t(`signInRules.stand.area.${area}`)),
        ),
      }),
      t('signInRules.stand.managersAsk'),
    );
  }

  return row(
    'met',
    t('signInRules.stand.notRequiredTitle'),
    t(on ? 'signInRules.stand.onAnyway' : 'signInRules.stand.canTurnOn'),
  );
}

/** Each rule, with a mark and a line about the reader: how they sign in, how long, and two-factor. */
export function whereYouStand(
  t: TFunction,
  rules: StandRules,
  viewer: StandViewer,
  locale: string,
  now: Date,
): RuleRow[] {
  return [method(t, rules, viewer), limit(t, rules), twoFactor(t, rules, viewer, locale, now)];
}

export function ruleLabel(t: TFunction, rule: RuleRow): string {
  return t('signInRules.stand.ruleLabel', {
    mark: t(`signInRules.stand.mark.${rule.mark}`),
    title: rule.title,
    line: rule.line,
  });
}

/** Only while managers is the two-factor rule in force. */
export function standFoot(t: TFunction, rules: StandRules): string | undefined {
  return rules.administratorsNeedTwoFactor && !rules.everyoneNeedsTwoFactor
    ? t('signInRules.stand.managersAre')
    : undefined;
}

export interface RulesCard {
  says: string;
  line: string;
  step: { label: string; opens: 'link' | 'twoFactor' } | null;
}

/** The card: that the reader meets the rules, or how many need them and what the first costs. */
export function rulesCard(t: TFunction, rules: readonly RuleRow[], viewer: StandViewer): RulesCard {
  const asks = rules.flatMap(({ ask }) => (ask == null ? [] : [ask]));
  const [first] = asks;

  if (first == null)
    return {
      says: t('signInRules.stand.meetSays', { organisation: viewer.organisation }),
      line: t(viewer.setsRules ? 'signInRules.stand.meetLineSets' : 'signInRules.readIntro'),
      step: null,
    };

  return {
    says: t('signInRules.stand.needSays', { count: asks.length }),
    line: first.consequence,
    step: { label: first.step, opens: first.opens },
  };
}

export type Change = Pick<SignInRuleChange, 'rule' | 'now' | 'was' | 'at'> & {
  by: { name: string };
};

function onOff(t: TFunction, value: Change['now']): string {
  return t(value === true ? 'signInRules.stand.on' : 'signInRules.stand.off');
}

export function changeTitle(t: TFunction, change: Change): string {
  switch (change.rule) {
    case 'providerOnly':
      return t(
        change.now === true
          ? 'signInRules.stand.changedToProviderOnly'
          : 'signInRules.stand.changedToAnyWay',
      );
    case 'inactivityTimeoutDays':
      return typeof change.now === 'number'
        ? t('signInRules.stand.changedToLimit', { count: change.now })
        : t('signInRules.stand.changedToNoLimit');
    case 'administratorsNeedTwoFactor':
      return t('signInRules.stand.changedManagers', { value: onOff(t, change.now) });
    case 'everyoneNeedsTwoFactor':
      return t('signInRules.stand.changedEveryone', { value: onOff(t, change.now) });
  }
}

export function wasWords(t: TFunction, change: Change): string {
  switch (change.rule) {
    case 'providerOnly':
      return t(
        change.was === true ? 'signInRules.stand.wasProviderOnly' : 'signInRules.stand.wasAnyWay',
      );
    case 'inactivityTimeoutDays':
      return typeof change.was === 'number'
        ? t('signInRules.stand.wasLimit', { count: change.was })
        : t('signInRules.stand.wasNoLimit');
    default:
      return t('signInRules.stand.was', { value: onOff(t, change.was) });
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
  t: TFunction,
  changes: readonly Change[],
  seen: string | null,
  locale: string,
  now: Date,
): ChangeRow[] {
  return [...changes]
    .sort((a, b) => b.at.localeCompare(a.at))
    .map((change) => {
      const words = {
        day: dayIn(change.at, locale, now),
        was: wasWords(t, change),
        name: change.by.name,
      };
      const isNew = seen == null || change.at > seen;
      const title = changeTitle(t, change);

      return {
        at: change.at,
        title,
        line: t('signInRules.stand.changeLine', words),
        isNew,
        label: t(isNew ? 'signInRules.stand.changeLabelNew' : 'signInRules.stand.changeLabel', {
          title,
          ...words,
        }),
      };
    });
}
