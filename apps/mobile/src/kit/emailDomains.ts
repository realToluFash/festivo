import { ApiError, type EmailDomain, type EmailDomainsPage } from '@soirely/api-client';
import { companyDomainProblem, listFormat } from '@soirely/domain';
import type { TFunction } from 'i18next';

export type TagWord = { kind: 'yes' | 'waiting' | 'no' | 'kept'; word: string };

export type DataGo =
  { kind: 'record'; domain: string } | { kind: 'prove' } | { kind: 'only'; domain: string };

export interface DataCard {
  /** Null where the demo's heading needs the day the organisation left Enterprise, which the API does not give. */
  says: string | null;
  line: string;
  step: { label: string; go: DataGo } | null;
}

export type DomainsSaid =
  | { kind: 'proved'; domain: string; at: string }
  | { kind: 'removed'; domain: string }
  | { kind: 'cancelled' | 'turnedOff'; domain: string };

interface DomainAsk {
  status: 'waiting' | 'missing' | 'failed';
  at: number;
  says: string;
  line: string;
  domain: string;
}

/** What asks something of the reader: a record still to add or to put back, by its instant; a failed one after. */
export function controlAsks(t: TFunction, domains: readonly EmailDomain[]): DomainAsk[] {
  return domains.flatMap((domain): DomainAsk[] => {
    const name = domain.domain;
    if (domain.status === 'waiting')
      return [
        {
          status: 'waiting',
          at: Date.parse(domain.checksEndAt),
          says: t('emailDomains.card.waiting', { domain: name }),
          line: t('emailDomains.card.waitingLine', { at: domain.checksEnd }),
          domain: name,
        },
      ];
    if (domain.status === 'missing')
      return [
        {
          status: 'missing',
          at: Date.parse(domain.putBackByAt ?? domain.checksEndAt),
          says: t('emailDomains.card.missing', { domain: name }),
          line: t('emailDomains.card.missingLine', { at: domain.putBackBy ?? '', domain: name }),
          domain: name,
        },
      ];
    if (domain.status === 'failed')
      return [
        {
          status: 'failed',
          at: Infinity,
          says: t('emailDomains.card.failed', { domain: name }),
          line: t('emailDomains.card.failedLine', { at: domain.checksEnd }),
          domain: name,
        },
      ];

    return [];
  });
}

function soonest<T extends { at: number }>(asks: readonly T[]): T | null {
  return asks.reduce<T | null>(
    (best, ask) => (best == null || ask.at < best.at ? ask : best),
    null,
  );
}

function seeRecord(t: TFunction, domain: string): DataCard['step'] {
  return { label: t('emailDomains.card.seeRecord'), go: { kind: 'record', domain } };
}

function nothing(t: TFunction, page: EmailDomainsPage, locale: string): DataCard {
  const proved = page.domains.filter(isProved).map((domain) => domain.domain);

  return {
    says: t('dataAndControl.nothing'),
    line: t('dataAndControl.nothingLine', {
      count: proved.length,
      domains: listFormat(locale, { type: 'conjunction' }).format(proved),
    }),
    step: null,
  };
}

/** The hub's card: the soonest instant among Control's items, or where the organisation stands. */
export function hubCard(
  t: TFunction,
  page: EmailDomainsPage,
  organisation: string,
  locale: string,
): DataCard {
  if (page.plan === 'free')
    return { says: t('dataAndControl.locked'), line: t('dataAndControl.lockedLine'), step: null };
  if (page.plan === 'left')
    return {
      says: t('dataAndControl.leftSays', { organisation }),
      line: t('dataAndControl.leftLine'),
      step: null,
    };
  if (page.domains.length === 0)
    return {
      says: t('dataAndControl.nothingSet'),
      line: t('dataAndControl.nothingSetLine', { organisation }),
      step: { label: t('emailDomains.prove'), go: { kind: 'prove' } },
    };
  const ask = soonest(controlAsks(t, page.domains));

  return ask == null
    ? nothing(t, page, locale)
    : { says: ask.says, line: ask.line, step: seeRecord(t, ask.domain) };
}

export function hubDomainsLine(t: TFunction, page: EmailDomainsPage, organisation: string): string {
  if (page.plan === 'free') return t('dataAndControl.rows.lockedDomains', { organisation });
  if (page.domains.length === 0) return t('dataAndControl.rows.noDomains');

  return page.domains
    .map((domain) =>
      t(`dataAndControl.standing.${standing(page, domain)}`, { domain: domain.domain }),
    )
    .join(' · ');
}

function standing(page: EmailDomainsPage, domain: EmailDomain): EmailDomain['status'] | 'kept' {
  return page.plan === 'left' && isProved(domain) ? 'kept' : domain.status;
}

/** Email domains' card: what was just done, then a missing record, a failed one, the soonest wait. */
export function domainsCard(
  t: TFunction,
  page: EmailDomainsPage,
  said: DomainsSaid | null,
  organisation: string,
  locale: string,
): DataCard {
  if (page.plan === 'free')
    return {
      says: t('emailDomains.card.locked'),
      line: t('emailDomains.card.lockedLine', { organisation }),
      step: null,
    };
  if (page.plan === 'left')
    return {
      says: t('emailDomains.card.off'),
      line: t('emailDomains.card.offLine', { organisation }),
      step: null,
    };
  const asks = controlAsks(t, page.domains);
  // Only our organisation is the Owner's alone (sc-563).
  const keep = (domain: string): DataCard['step'] =>
    page.ownerChanges
      ? {
          label: t('emailDomains.card.keep', { domain, organisation }),
          go: { kind: 'only', domain },
        }
      : null;
  if (said?.kind === 'proved')
    return {
      says: t('emailDomains.card.proved', { domain: said.domain }),
      line: t('emailDomains.card.provedLine', { at: said.at }),
      step: page.domains.some((one) => one.domain === said.domain && one.onlyOurs === 'off')
        ? keep(said.domain)
        : null,
    };
  if (said?.kind === 'cancelled')
    return {
      says: t('emailDomains.card.cancelled'),
      line: t('emailDomains.card.cancelledLine', { domain: said.domain }),
      step: null,
    };
  if (said?.kind === 'turnedOff')
    return {
      says: t('emailDomains.card.turnedOff'),
      line: t('emailDomains.card.turnedOffLine', { domain: said.domain }),
      step: null,
    };
  if (said?.kind === 'removed') {
    const next = soonest(asks);

    return {
      says: t('emailDomains.card.removed', { domain: said.domain }),
      line: t('emailDomains.card.removedLine'),
      step: next == null ? null : seeRecord(t, next.domain),
    };
  }
  if (page.domains.length === 0)
    return {
      says: t('emailDomains.card.empty', { organisation }),
      line: t('emailDomains.card.emptyLine', { organisation }),
      step: { label: t('emailDomains.prove'), go: { kind: 'prove' } },
    };
  const ask =
    asks.find((one) => one.status === 'missing') ??
    asks.find((one) => one.status === 'failed') ??
    soonest(asks);

  if (ask != null) return { says: ask.says, line: ask.line, step: seeRecord(t, ask.domain) };
  const scheduled = page.domains.find((domain) => domain.onlyOurs === 'scheduled');
  if (scheduled != null)
    return {
      says: t('emailDomains.card.scheduled', { at: scheduled.onlyOursFrom ?? '' }),
      line: page.ownerChanges
        ? t('emailDomains.card.scheduledLine', { domain: scheduled.domain })
        : t('emailDomains.card.scheduledAdmin'),
      step: null,
    };
  const open = page.domains.find((domain) => isProved(domain) && domain.onlyOurs === 'off');
  if (open != null)
    return {
      says: t('emailDomains.card.proved', { domain: open.domain }),
      line: t('emailDomains.onlyOff', { domain: open.domain }),
      step: keep(open.domain),
    };
  const on = page.domains.find((domain) => domain.onlyOurs === 'on');

  return on == null
    ? nothing(t, page, locale)
    : {
        says: t('emailDomains.card.on', { domain: on.domain, organisation }),
        line: t('emailDomains.card.onLine'),
        step: null,
      };
}

export function isProved(domain: EmailDomain): boolean {
  return domain.status === 'proved' || domain.status === 'missing';
}

export interface DomainRow {
  domain: string;
  tag: TagWord;
  line: string;
  /** A proved domain's Remove… asks first; any other opens its record, Remove at its foot. */
  action: 'remove' | 'record' | null;
  /** Under a proved domain (sc-563): the Owner's switch, or Cancel while scheduled; anyone else reads it. */
  only: { line: string; control: 'switch' | 'cancel' | null; on: boolean } | null;
}

function onlyRow(
  t: TFunction,
  page: EmailDomainsPage,
  domain: EmailDomain,
  day: (at: string) => string,
): DomainRow['only'] {
  const on = domain.onlyOurs === 'on';
  if (page.plan === 'left') return { line: t('emailDomains.onlyKept'), control: null, on };
  const line =
    domain.onlyOurs === 'scheduled'
      ? t('emailDomains.onlyStarts', { at: domain.onlyOursFrom ?? '' })
      : on && domain.onlyOursFromAt != null
        ? t('emailDomains.onlySince', { day: day(domain.onlyOursFromAt) })
        : t('emailDomains.onlyOff', { domain: domain.domain });

  return page.ownerChanges
    ? { line, control: domain.onlyOurs === 'scheduled' ? 'cancel' : 'switch', on }
    : {
        line: `${line.endsWith('.') ? line : `${line}.`} ${t('emailDomains.ownerOnly')}`,
        control: null,
        on,
      };
}

export function domainRows(
  t: TFunction,
  page: EmailDomainsPage,
  day: (at: string) => string,
): DomainRow[] {
  const kept = page.plan === 'left';

  return page.domains.map((domain) => {
    const shown = standing(page, domain);
    const tag: TagWord = {
      proved: { kind: 'yes', word: t('emailDomains.proved') },
      waiting: { kind: 'waiting', word: t('emailDomains.waiting') },
      failed: { kind: 'no', word: t('emailDomains.notProved') },
      missing: { kind: 'waiting', word: t('emailDomains.missing') },
      kept: { kind: 'kept', word: t('emailDomains.kept') },
    }[shown] as TagWord;
    const line = {
      proved: () => t('emailDomains.provedOn', { at: domain.proved ?? '' }),
      kept: () => t('emailDomains.provedOn', { at: domain.proved ?? '' }),
      waiting: () => t('emailDomains.checksUntil', { at: domain.checksEnd }),
      failed: () => t('emailDomains.stopped', { at: domain.checksEnd }),
      missing: () => t('emailDomains.putBack', { at: domain.putBackBy ?? '' }),
    }[shown]();

    return {
      domain: domain.domain,
      tag,
      line,
      action: kept ? null : domain.status === 'proved' ? 'remove' : 'record',
      only: isProved(domain) ? onlyRow(t, page, domain, day) : null,
    };
  });
}

export function recordFoot(t: TFunction, domain: EmailDomain): string {
  if (domain.status === 'failed') return t('emailDomains.stopped', { at: domain.checksEnd });
  if (domain.status === 'missing')
    return t('emailDomains.record.putBack', { at: domain.putBackBy ?? '' });

  return t('emailDomains.card.waitingLine', { at: domain.checksEnd });
}

/** A record still proved asks before it goes; one never proved goes at once. */
export function removeAsks(domain: EmailDomain): boolean {
  return isProved(domain);
}

/** Before sending: blank, then the shape, in the words Company domain joining uses. */
export function domainFieldProblem(t: TFunction, typed: string, example: string): string | null {
  const problem = companyDomainProblem(typed);
  if (problem == null) return null;

  return t(problem === 'blank' ? 'companyDomains.blank' : 'companyDomains.shape', { example });
}

/** The server's own words for a refused domain, to show under the field; null for any other failure. */
export function domainRefusal(error: unknown): string | null {
  if (!(error instanceof ApiError) || !error.is('validation_failed')) return null;

  return error.problem.violations?.find((one) => one.propertyPath === 'domain')?.message ?? null;
}

export type Verified =
  { kind: 'proved'; at: string } | { kind: 'notFound' } | { kind: 'refused'; words: string };

export function verifiedOf(
  found: boolean,
  page: EmailDomainsPage,
  name: string,
): Extract<Verified, { kind: 'proved' | 'notFound' }> {
  const proved = page.domains.find((domain) => domain.domain === name)?.proved;

  return found && proved != null ? { kind: 'proved', at: proved } : { kind: 'notFound' };
}
