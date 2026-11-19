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

export type DomainsSaid = {
  kind: 'proved' | 'removed' | 'scheduled' | 'cancelled' | 'turnedOff';
  domain: string;
} | null;

/** `record` opens a domain's record; `keep` asks to limit a domain's accounts, the Owner's alone. */
export interface DomainsCard {
  says: string;
  line: string;
  record: string | null;
  keep: string | null;
  prove?: true;
}

/** Only our organisation's line under a proved domain (sc-563); anyone but the Owner reads that only an owner changes it. */
export function onlyLine(
  t: TFunction,
  domain: EmailDomain,
  page: Pick<EmailDomainsPage, 'plan' | 'ownerChanges'>,
  day: (at: string) => string,
): string {
  if (page.plan === 'left') return t('emailDomains.keptOnly');

  const line =
    domain.onlyOurs === 'scheduled' && domain.onlyOursFrom != null
      ? t('emailDomains.onlyStarts', { when: domain.onlyOursFrom })
      : domain.onlyOurs === 'on' && domain.onlyOursFromAt != null
        ? t('emailDomains.onlyOnSince', { day: day(domain.onlyOursFromAt) })
        : t('emailDomains.provedQuietLine', { domain: domain.domain });

  return page.ownerChanges
    ? line
    : `${line}${line.endsWith('.') ? '' : '.'} ${t('emailDomains.ownerOnly')}`;
}

function onlyCard(
  t: TFunction,
  domain: EmailDomain,
  owns: boolean,
  organisation: string,
): DomainsCard {
  if (domain.onlyOurs === 'scheduled')
    return {
      says: t('emailDomains.scheduledSays', { when: domain.onlyOursFrom }),
      line: owns
        ? t('emailDomains.scheduledLine', { domain: domain.domain })
        : t('emailDomains.scheduledOtherLine'),
      record: null,
      keep: null,
    };
  if (domain.onlyOurs === 'on')
    return {
      says: t('emailDomains.onSays', { domain: domain.domain, organisation }),
      line: t('emailDomains.onLine'),
      record: null,
      keep: null,
    };

  return {
    says: t('emailDomains.provedSays', { domain: domain.domain }),
    line: t('emailDomains.provedQuietLine', { domain: domain.domain }),
    record: null,
    keep: owns ? domain.domain : null,
  };
}

function askOf(t: TFunction, domain: EmailDomain): DomainsCard {
  return domain.status === 'missing'
    ? {
        says: t('emailDomains.missingSays', { domain: domain.domain }),
        line: t('emailDomains.missingCardLine', { domain: domain.domain, when: domain.putBackBy }),
        record: domain.domain,
        keep: null,
      }
    : {
        says: t('emailDomains.waitingSays', { domain: domain.domain }),
        line: t('emailDomains.waitingFoot', { when: domain.checksEnd }),
        record: domain.domain,
        keep: null,
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
      keep: null,
    };
  if (page.plan === 'left')
    return {
      says: t('emailDomains.leftSays'),
      line: t('emailDomains.leftLine', { organisation }),
      record: null,
      keep: null,
    };

  const find = (status: EmailDomain['status']) => page.domains.find((one) => one.status === status);
  const waiting = find('waiting');

  const owns = page.ownerChanges;

  if (said?.kind === 'removed')
    return {
      says: t('emailDomains.removedSays', { domain: said.domain }),
      line: t('emailDomains.removedLine'),
      record: waiting?.domain ?? null,
      keep: null,
    };
  if (said?.kind === 'cancelled')
    return {
      says: t('emailDomains.cancelledSays'),
      line: t('emailDomains.cancelledLine', { domain: said.domain }),
      record: null,
      keep: null,
    };
  if (said?.kind === 'turnedOff')
    return {
      says: t('emailDomains.offSays'),
      line: t('emailDomains.offLine', { domain: said.domain }),
      record: null,
      keep: null,
    };

  const saidOf = page.domains.find((one) => one.domain === said?.domain);

  if (said?.kind === 'scheduled' && saidOf != null) return onlyCard(t, saidOf, owns, organisation);
  if (said?.kind === 'proved' && saidOf != null)
    return {
      says: t('emailDomains.provedSays', { domain: saidOf.domain }),
      line: t('emailDomains.provedSaidLine', { when: saidOf.proved }),
      record: null,
      keep: owns && saidOf.onlyOurs === 'off' ? saidOf.domain : null,
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
      keep: null,
    };
  if (waiting != null) return askOf(t, waiting);
  if (proved != null) return onlyCard(t, proved, owns, organisation);

  return {
    says: t('emailDomains.noneSays', { organisation }),
    line: t('emailDomains.noneLine', { organisation }),
    record: null,
    keep: null,
    prove: true,
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
function soonestAsk(
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
        says: card.says ?? '',
        line: card.line,
      });
    }

  return asks.sort((one, other) => Date.parse(one.at) - Date.parse(other.at))[0] ?? null;
}

export type HubCard = HubAsk | { does: 'prove' | null; says: string; line: string | null };

/** The hub's card: the soonest ask, or else where the organisation stands, with Prove a domain while nothing is set up. */
export function hubCard(
  t: TFunction,
  exported: OrganisationExportPage,
  domains: EmailDomainsPage,
  organisation: string,
): HubCard {
  const ask = soonestAsk(t, exported, domains);

  if (ask != null) return ask;
  if (domains.plan === 'free')
    return { does: null, says: t('dataControl.lockedSays'), line: t('dataControl.lockedLine') };
  if (domains.plan === 'left')
    return {
      does: null,
      says: t('dataControl.leftSays', { organisation }),
      line: t('dataControl.leftLine'),
    };
  if (domains.domains.length === 0)
    return {
      does: 'prove',
      says: t('dataControl.newSays'),
      line: t('dataControl.newLine', { organisation }),
    };

  return { does: null, says: t('dataControl.nothingAsks'), line: null };
}
