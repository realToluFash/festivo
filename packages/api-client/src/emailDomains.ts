/** Data and control › Email domains, as the API answers it (sc-560): each domain an organisation proves by DNS. */

export type EmailDomainStatus = 'waiting' | 'proved' | 'failed' | 'missing';

/** `left`: the organisation had Enterprise, and its domains are kept as they were, read only (sc-581). */
export type EmailDomainsPlan = 'enterprise' | 'free' | 'left';

export interface EmailDomain {
  domain: string;
  status: EmailDomainStatus;
  record: { type: 'TXT'; name: string; value: string };
  /** Each instant twice: as it is, and written in the reader's own zone by the API (sc-868). */
  addedAt: string;
  added: string;
  provedAt: string | null;
  proved: string | null;
  checksEndAt: string;
  checksEnd: string;
  putBackByAt: string | null;
  putBackBy: string | null;
}

export interface EmailDomainsPage {
  plan: EmailDomainsPlan;
  domains: EmailDomain[];
}

const STATUSES: readonly EmailDomainStatus[] = ['waiting', 'proved', 'failed', 'missing'];
const PLANS: readonly EmailDomainsPlan[] = ['enterprise', 'free', 'left'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value != null && !Array.isArray(value);
}

const text = (value: unknown): value is string | null =>
  value === null || typeof value === 'string';

function asEmailDomain(raw: unknown): EmailDomain | null {
  if (!isRecord(raw) || !isRecord(raw.record)) return null;
  const status = STATUSES.find((one) => one === raw.status);
  const record = raw.record;

  if (
    status == null ||
    typeof raw.domain !== 'string' ||
    record.type !== 'TXT' ||
    typeof record.name !== 'string' ||
    typeof record.value !== 'string' ||
    typeof raw.addedAt !== 'string' ||
    typeof raw.added !== 'string' ||
    typeof raw.checksEndAt !== 'string' ||
    typeof raw.checksEnd !== 'string' ||
    !text(raw.provedAt) ||
    !text(raw.proved) ||
    !text(raw.putBackByAt) ||
    !text(raw.putBackBy)
  )
    return null;

  return {
    domain: raw.domain,
    status,
    record: { type: 'TXT', name: record.name, value: record.value },
    addedAt: raw.addedAt,
    added: raw.added,
    provedAt: raw.provedAt,
    proved: raw.proved,
    checksEndAt: raw.checksEndAt,
    checksEnd: raw.checksEnd,
    putBackByAt: raw.putBackByAt,
    putBackBy: raw.putBackBy,
  };
}

export function asEmailDomainsPage(raw: unknown): EmailDomainsPage | null {
  if (!isRecord(raw) || !Array.isArray(raw.domains)) return null;
  const plan = PLANS.find((one) => one === raw.plan);
  const domains = raw.domains.map(asEmailDomain);

  if (plan == null || domains.some((one) => one == null)) return null;

  return { plan, domains: domains.filter((one): one is EmailDomain => one != null) };
}
