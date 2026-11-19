import type { EmailDomain, EmailDomainsPage, OrganisationExportPage } from '@soirely/api-client';
import type { TFunction } from 'i18next';

import { cardStateOf } from './exportAllData.ts';

/** Proved and missing domains are still proved, so removing one asks first. */
export function isProved(domain: Pick<EmailDomain, 'status'>): boolean {
  return domain.status === 'proved' || domain.status === 'missing';
}

export function domainLine(t: TFunction, domain: EmailDomain): string {
  switch (domain.status) {
    case 'proved':
      return t('emailDomains.provedLine', { when: domain.proved });
    case 'waiting':
      return t('emailDomains.waitingLine', { when: domain.checksEnd });
    case 'failed':
      return t('emailDomains.failedLine', { when: domain.checksEnd });
    case 'missing':
      return t('emailDomains.missingLine', { when: domain.putBackBy });
  }
}

/** The record's own last line: where its row says it stands, as a sentence. */
export function recordFoot(t: TFunction, domain: EmailDomain): string {
  switch (domain.status) {
    case 'waiting':
      return t('emailDomains.waitingFoot', { when: domain.checksEnd });
    case 'missing':
      return t('emailDomains.missingFoot', { when: domain.putBackBy });
    default:
      return domainLine(t, domain);
  }
}

export type DomainsSaid = { kind: 'proved' | 'removed'; domain: string } | null;

export interface DomainsCard {
  says: string | null;
  line: string;
  record: string | null;
}

function askOf(t: TFunction, domain: EmailDomain): { says: string; line: string; record: string } {
  return domain.status === 'missing'
    ? {
        says: t('emailDomains.missingSays', { domain: domain.domain }),
        line: t('emailDomains.missingCardLine', { domain: domain.domain, when: domain.putBackBy }),
        record: domain.domain,
      }
    : {
        says: t('emailDomains.waitingSays', { domain: domain.domain }),
        line: t('emailDomains.waitingFoot', { when: domain.checksEnd }),
        record: domain.domain,
      };
}

/** What was just done, or else the domain most at risk: a lapsing proof before a failed or a waiting one. */
export function domainsCard(
  t: TFunction,
  page: EmailDomainsPage,
  said: DomainsSaid,
  organisation: string,
): DomainsCard {
  if (page.plan === 'free')
    return {
      says: t('emailDomains.lockedSays'),
      line: t('emailDomains.lockedLine', { organisation }),
      record: null,
    };
  if (page.plan === 'left')
    return { says: null, line: t('emailDomains.leftLine', { organisation }), record: null };

  const find = (status: EmailDomain['status']) => page.domains.find((one) => one.status === status);
  const waiting = find('waiting');

  if (said?.kind === 'removed')
    return {
      says: t('emailDomains.removedSays', { domain: said.domain }),
      line: t('emailDomains.removedLine'),
      record: waiting?.domain ?? null,
    };

  const justProved =
    said?.kind === 'proved' ? page.domains.find((one) => one.domain === said.domain) : undefined;

  if (justProved != null)
    return {
      says: t('emailDomains.provedSays', { domain: justProved.domain }),
      line: t('emailDomains.provedSaidLine', { when: justProved.proved }),
      record: null,
    };

  const missing = find('missing');
  const failed = find('failed');
  const proved = find('proved');

  if (missing != null) return askOf(t, missing);
  if (failed != null)
    return {
      says: t('emailDomains.failedSays', { domain: failed.domain }),
      line: t('emailDomains.failedCardLine', { when: failed.checksEnd }),
      record: failed.domain,
    };
  if (waiting != null) return askOf(t, waiting);
  if (proved != null)
    return {
      says: t('emailDomains.provedSays', { domain: proved.domain }),
      line: t('emailDomains.provedQuietLine', { domain: proved.domain }),
      record: null,
    };

  return {
    says: t('emailDomains.noneSays', { organisation }),
    line: t('emailDomains.noneLine'),
    record: null,
  };
}

/** The hub's row for Email domains: each domain and where it stands, or why there are none. */
export function domainsRow(
  t: TFunction,
  page: EmailDomainsPage,
): { line: string; locked: boolean } {
  if (page.plan === 'free') return { line: t('dataControl.domainsLocked'), locked: true };
  if (page.domains.length === 0) return { line: t('dataControl.domainsNone'), locked: false };

  const key =
    page.plan === 'left'
      ? () => 'dataControl.domainKept'
      : (domain: EmailDomain) =>
          ({
            proved: 'dataControl.domainProved',
            waiting: 'dataControl.domainWaiting',
            failed: 'dataControl.domainFailed',
            missing: 'dataControl.domainMissing',
          })[domain.status];

  return {
    line: page.domains.map((domain) => t(key(domain), { domain: domain.domain })).join(' · '),
    locked: false,
  };
}

export type HubAsk =
  | { at: string; does: 'download'; says: string; line: string }
  | { at: string; does: 'record'; domain: string; says: string; line: string };

/** What asks something of the reader now, the soonest first: their ready export, a waiting record before its checks stop, a missing one before it lapses. */
export function soonestAsk(
  t: TFunction,
  exported: OrganisationExportPage,
  domains: EmailDomainsPage,
): HubAsk | null {
  const asks: HubAsk[] = [];
  const ready = exported.export;

  if (cardStateOf(exported) === 'ready' && ready?.expiresAt != null)
    asks.push({
      at: ready.expiresAt,
      does: 'download',
      says: t('exportAllData.readySays'),
      line: t('dataControl.cardReadyLine', { when: ready.expires }),
    });

  if (domains.plan === 'enterprise')
    for (const domain of domains.domains) {
      const at =
        domain.status === 'waiting'
          ? domain.checksEndAt
          : domain.status === 'missing'
            ? domain.putBackByAt
            : null;
      if (at == null) continue;
      const card = askOf(t, domain);
      asks.push({
        at,
        does: 'record',
        domain: domain.domain,
        says: card.says,
        line: card.line,
      });
    }

  return asks.sort((one, other) => Date.parse(one.at) - Date.parse(other.at))[0] ?? null;
}
