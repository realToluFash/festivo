import { companyDomainProblem, normaliseDomain } from '@soirely/domain';

import {
  CHECK_DAYS,
  CLOCK,
  ONLY_DAYS,
  ORG,
  PROVED_DOMAIN,
  PUT_BACK_DAYS,
  WAITING_DOMAIN,
  dayOf,
  plusDays,
  when,
} from './dataControl.ts';
import { isPublicDomain } from './general.ts';
import type { Viewer } from './settings.ts';

export type DomainStatus = 'proved' | 'waiting' | 'failed' | 'missing';
export type Only = 'off' | 'scheduled' | 'on';

/** `at` is when it was proved, added, or first found missing; `onAt` when Only our organisation starts or started. */
export interface Domain {
  name: string;
  status: DomainStatus;
  at: string;
  only: Only;
  onAt: string | null;
  /** A missing record's domain is still proved: when, for when it is put back. */
  provedAt?: string;
}

export type Plan = 'enterprise' | 'free' | 'left';
export type SaidKind = 'proved' | 'removed' | 'scheduled' | 'cancelled' | 'turnedOff';

export interface DomainsView {
  plan: Plan;
  domains: readonly Domain[];
  said: { kind: SaidKind; domain: string } | null;
}

export const DOMAIN_WORDS = {
  title: 'Email domains',
  block: 'Domains',
  prove: 'Prove a domain',
  foot: 'Proving a domain lets nobody join. Company domain joining is its own list, in General.',
  none: 'No domains yet.',
  proved: 'Proved',
  waiting: 'Waiting for the record',
  failed: 'Not proved',
  missing: 'Record missing',
  kept: 'Kept',
  only: 'Only our organisation',
  ownerOnly: 'Only an owner can change this.',
  keptOnly: 'Kept as it was. It comes back on with Enterprise.',
  seeRecord: 'See the record',
  remove: 'Remove',
  removeAsk: 'Remove…',
  keep: 'Keep it',
  cancel: 'Cancel',
  close: 'Close',
  verify: 'Verify',
  verifying: 'Verifying…',
  copy: 'Copy',
  copied: 'Copied.',
  notFound: 'We could not find the record yet. DNS changes can take up to 48 hours.',
  type: 'Type',
  name: 'Name',
  value: 'Value',
  add: 'Add',
  field: 'Domain',
  help: 'Like ire.events. A subdomain needs adding on its own.',
  blank: 'Enter a domain, like ire.events.',
  shape: 'Enter a domain with a dot and no spaces, like ire.events.',
  publicDomain: 'You cannot use a public email domain.',
  taken:
    'Another organisation has already proved this domain. Contact Soirely support if it is yours.',
  listed: (domain: string) => `${domain} is already on the list.`,
  removed: (domain: string) => `${domain} removed.`,
  keepAccounts: `Keep its accounts to ${ORG}`,
  schedule: 'Schedule it',
  loading: 'Loading Email domains…',
  failedLoad: 'We could not load Email domains.',
} as const;

export const RECORD = {
  type: 'TXT',
  value: 'k7q2m9x4c8rt5bn3wd6jp1hz0ys5gfa',
  name: (domain: string) => `_soirely-verify.${domain}`,
} as const;

/** Domains another organisation has proved on Enterprise, as the sample has them. */
const TAKEN: ReadonlySet<string> = new Set(['lumenfeiras.pt']);

/** What the form says before it sends: nothing typed, or not a hostname with a dot. */
export function domainFault(typed: string): string | null {
  const problem = companyDomainProblem(typed);

  if (problem == null) return null;

  return problem === 'blank' ? DOMAIN_WORDS.blank : DOMAIN_WORDS.shape;
}

export function domainRefusal(typed: string, listed: readonly Domain[]): string | null {
  const domain = normaliseDomain(typed);

  if (listed.some((one) => one.name === domain)) return DOMAIN_WORDS.listed(domain);
  if (isPublicDomain(domain)) return DOMAIN_WORDS.publicDomain;
  if (TAKEN.has(domain)) return DOMAIN_WORDS.taken;

  return null;
}

export function checksEnd(domain: Pick<Domain, 'at'>): string {
  return plusDays(domain.at, CHECK_DAYS);
}

export function putBackBy(domain: Pick<Domain, 'at'>): string {
  return plusDays(domain.at, PUT_BACK_DAYS);
}

export function domainLine(domain: Domain, locale: string): string {
  switch (domain.status) {
    case 'proved':
      return `Proved ${when(domain.at, locale)}`;
    case 'waiting':
      return `We check every hour until ${when(checksEnd(domain), locale)}`;
    case 'failed':
      return `We stopped checking on ${when(checksEnd(domain), locale)}. Verify still works.`;
    case 'missing':
      return `Put it back by ${when(putBackBy(domain), locale)}`;
  }
}

/** The record's own last line: the hourly check, or where its row says it stands. */
export function recordFoot(domain: Domain, locale: string): string {
  const line = domainLine(domain, locale);

  return line.endsWith('.') ? line : `${line}.`;
}

export function onlyLine(
  domain: Domain,
  viewer: Pick<Viewer, 'owns'>,
  plan: Plan,
  locale: string,
): string {
  if (plan === 'left') return DOMAIN_WORDS.keptOnly;

  const line =
    domain.only === 'scheduled' && domain.onAt != null
      ? `Starts ${when(domain.onAt, locale)}`
      : domain.only === 'on' && domain.onAt != null
        ? `On since ${dayOf(domain.onAt, locale)}`
        : `People at ${domain.name} can still be members of other organisations.`;

  if (viewer.owns) return line;

  return `${line}${line.endsWith('.') ? '' : '.'} ${DOMAIN_WORDS.ownerOnly}`;
}

/** Proved and missing domains are proved, so Only our organisation sits under them. */
export function isProved(domain: Pick<Domain, 'status'>): boolean {
  return domain.status === 'proved' || domain.status === 'missing';
}

export type CardStep =
  | { does: 'contact' }
  | { does: 'prove' }
  | { does: 'record'; domain: string }
  | { does: 'keep'; domain: string };

export interface DomainsCard {
  says: string;
  line: string;
  step: CardStep | null;
}

function onlyCard(domain: Domain, viewer: Pick<Viewer, 'owns'>, locale: string): DomainsCard {
  if (domain.only === 'scheduled' && domain.onAt != null)
    return {
      says: `Only our organisation starts on ${when(domain.onAt, locale)}`,
      line: viewer.owns
        ? `Everyone at ${domain.name} was emailed. You can cancel until then.`
        : 'Only an owner can cancel it.',
      step: null,
    };
  if (domain.only === 'on')
    return {
      says: `Accounts at ${domain.name} belong to ${ORG}`,
      line: 'They can still be given access to another organisation’s event.',
      step: null,
    };

  return {
    says: `${domain.name} is proved`,
    line: `People at ${domain.name} can still be members of other organisations.`,
    step: viewer.owns ? { does: 'keep', domain: domain.name } : null,
  };
}

function saidCard(
  view: DomainsView,
  said: NonNullable<DomainsView['said']>,
  viewer: Pick<Viewer, 'owns'>,
  locale: string,
): DomainsCard | null {
  const domain = view.domains.find((one) => one.name === said.domain);
  const waiting = view.domains.find((one) => one.status === 'waiting');

  switch (said.kind) {
    case 'removed':
      return {
        says: `${said.domain} was removed`,
        line: 'It is no longer proved.',
        step: waiting == null ? null : { does: 'record', domain: waiting.name },
      };
    case 'proved':
      return domain == null
        ? null
        : {
            says: `${domain.name} is proved`,
            line: `Proved ${when(domain.at, locale)}.`,
            step:
              viewer.owns && domain.only === 'off' ? { does: 'keep', domain: domain.name } : null,
          };
    case 'scheduled':
      return domain == null ? null : onlyCard(domain, viewer, locale);
    case 'cancelled':
      return {
        says: 'Only our organisation was cancelled',
        line: `Nothing changes for the accounts at ${said.domain}.`,
        step: null,
      };
    case 'turnedOff':
      return {
        says: 'Only our organisation is off',
        line: `Accounts at ${said.domain} can be members of other organisations again.`,
        step: null,
      };
  }
}

/** The card: what was just done, or else the domain most at risk, a lapsing proof before a failed or waiting one. */
export function domainsCard(
  view: DomainsView,
  viewer: Pick<Viewer, 'owns'>,
  locale: string,
): DomainsCard {
  if (view.plan === 'free')
    return {
      says: 'Available on Enterprise',
      line: `Prove that ${ORG} owns its domain, then keep the accounts at it to ${ORG}.`,
      step: { does: 'contact' },
    };
  if (view.plan === 'left')
    return {
      says: `Switched off on ${dayOf(CLOCK.left, locale)}`,
      line: `${ORG} left Enterprise. Its domains are kept as they were, and come back on with Enterprise.`,
      step: { does: 'contact' },
    };

  const said = view.said == null ? null : saidCard(view, view.said, viewer, locale);
  if (said != null) return said;

  const find = (status: DomainStatus) => view.domains.find((one) => one.status === status);
  const missing = find('missing');
  const failed = find('failed');
  const waiting = find('waiting');
  const proved = find('proved');

  if (missing != null)
    return {
      says: `The record for ${missing.name} is missing`,
      line: `Put it back by ${when(putBackBy(missing), locale)}, or ${missing.name} stops being proved and Only our organisation stops with it.`,
      step: { does: 'record', domain: missing.name },
    };
  if (failed != null)
    return {
      says: `${failed.name} was not proved`,
      line: `We stopped checking on ${when(checksEnd(failed), locale)}. Add the record, then Verify.`,
      step: { does: 'record', domain: failed.name },
    };
  if (waiting != null)
    return {
      says: `${waiting.name} is waiting for its record`,
      line: `We check every hour until ${when(checksEnd(waiting), locale)}.`,
      step: { does: 'record', domain: waiting.name },
    };
  if (proved != null) return onlyCard(proved, viewer, locale);

  return {
    says: `Prove ${ORG}’ email domain`,
    line: `Add a DNS record where your domain is managed. Once it is proved, you can keep the accounts at it to ${ORG}.`,
    step: { does: 'prove' },
  };
}

export function confirmWords(domain: string, locale: string): { title: string; lines: string[] } {
  const starts = plusDays(CLOCK.now, ONLY_DAYS);

  return {
    title: `Keep ${domain} accounts to ${ORG}?`,
    lines: [
      `From ${when(starts, locale)}, ${ONLY_DAYS} days from now, an account whose main email address is at ${domain} can only be a member of ${ORG}.`,
      `Everyone at ${domain} is emailed now. Access to a single event still works. You can cancel until then.`,
    ],
  };
}

export function removeWords(domain: string): { title: string; line: string } {
  return {
    title: `Remove ${domain}?`,
    line: 'It stops being proved, and Only our organisation stops for it. Company domain joining keeps its own list.',
  };
}

export function scheduled(view: DomainsView, domain: string): DomainsView {
  return {
    ...view,
    domains: view.domains.map((one) =>
      one.name === domain
        ? { ...one, only: 'scheduled', onAt: plusDays(CLOCK.now, ONLY_DAYS) }
        : one,
    ),
    said: { kind: 'scheduled', domain },
  };
}

export function onlyOff(view: DomainsView, domain: string, kind: SaidKind): DomainsView {
  return {
    ...view,
    domains: view.domains.map((one) =>
      one.name === domain ? { ...one, only: 'off', onAt: null } : one,
    ),
    said: { kind, domain },
  };
}

/** A found record proves a waiting or failed domain now; a missing one is proved again as it was. */
export function verified(view: DomainsView, domain: string): DomainsView {
  return {
    ...view,
    domains: view.domains.map((one) =>
      one.name !== domain
        ? one
        : one.status === 'missing'
          ? { ...one, status: 'proved', at: one.provedAt ?? CLOCK.now }
          : { ...one, status: 'proved', at: CLOCK.now, only: 'off', onAt: null },
    ),
    said: { kind: 'proved', domain },
  };
}

export function added(view: DomainsView, typed: string): DomainsView {
  const name = normaliseDomain(typed);

  return {
    ...view,
    domains: [...view.domains, { name, status: 'waiting', at: CLOCK.now, only: 'off', onAt: null }],
    said: null,
  };
}

export function removed(view: DomainsView, domain: string, proved: boolean): DomainsView {
  return {
    ...view,
    domains: view.domains.filter((one) => one.name !== domain),
    said: proved ? { kind: 'removed', domain } : null,
  };
}

const IRE: Domain = {
  name: PROVED_DOMAIN,
  status: 'proved',
  at: CLOCK.proved,
  only: 'off',
  onAt: null,
};
const IRE_COM: Domain = {
  name: WAITING_DOMAIN,
  status: 'waiting',
  at: CLOCK.added,
  only: 'off',
  onAt: null,
};

export interface DomainsStart {
  load: 'loaded' | 'loading' | 'failed';
  view: DomainsView;
  record: string | null;
  check: 'idle' | 'checking' | 'notFound';
  adding: { typed: string; pressed: boolean } | null;
  removing: string | null;
  confirming: string | null;
}

export const DOMAIN_STATES = [
  'domains',
  'ed_empty',
  'ed_add',
  'ed_blank',
  'ed_invalid',
  'ed_public',
  'ed_taken',
  'ed_record',
  'ed_checking',
  'ed_not_found',
  'ed_proved',
  'ed_failed',
  'ed_lapsing',
  'ed_remove',
  'ed_removed',
  'ed_locked',
  'ed_downgraded',
  'oo_off',
  'oo_confirm',
  'oo_scheduled',
  'oo_cancelled',
  'oo_on',
  'oo_turned_off',
  'oo_not_owner',
  'loading',
  'failed',
] as const;

export function domainsStart(state: string): DomainsStart {
  const enterprise = (domains: readonly Domain[], said: DomainsView['said'] = null) => ({
    plan: 'enterprise' as const,
    domains,
    said,
  });
  const base: DomainsStart = {
    load: 'loaded',
    view: enterprise([IRE, IRE_COM]),
    record: null,
    check: 'idle',
    adding: null,
    removing: null,
    confirming: null,
  };
  const empty = { ...base, view: enterprise([]) };
  const adding = (typed: string) => ({ ...empty, adding: { typed, pressed: typed !== '' } });
  const alone = { ...base, view: enterprise([IRE]) };
  const startsAt = plusDays(CLOCK.now, ONLY_DAYS);
  const soon = {
    ...base,
    view: enterprise([{ ...IRE, only: 'scheduled' as const, onAt: startsAt }]),
  };

  switch (state) {
    case 'ed_empty':
      return empty;
    case 'ed_add':
      return adding('');
    case 'ed_blank':
      return { ...empty, adding: { typed: '', pressed: true } };
    case 'ed_invalid':
      return adding('ire events');
    case 'ed_public':
      return adding('gmail.com');
    case 'ed_taken':
      return adding('lumenfeiras.pt');
    case 'ed_record':
      return { ...base, record: WAITING_DOMAIN };
    case 'ed_checking':
      return { ...base, record: WAITING_DOMAIN, check: 'checking' };
    case 'ed_not_found':
      return { ...base, record: WAITING_DOMAIN, check: 'notFound' };
    case 'ed_proved':
      return { ...base, view: verified(base.view, WAITING_DOMAIN) };
    case 'ed_failed':
      return {
        ...base,
        view: enterprise([IRE, { ...IRE_COM, status: 'failed', at: CLOCK.failedAdded }]),
      };
    case 'ed_lapsing':
      return {
        ...base,
        view: enterprise([
          { ...IRE, status: 'missing', at: CLOCK.missing, provedAt: CLOCK.proved },
          IRE_COM,
        ]),
      };
    case 'ed_remove':
      return { ...base, removing: PROVED_DOMAIN };
    case 'ed_removed':
      return { ...base, view: removed(base.view, PROVED_DOMAIN, true) };
    case 'ed_locked':
      return { ...base, view: { plan: 'free', domains: [], said: null } };
    case 'ed_downgraded':
      return { ...base, view: { plan: 'left', domains: [IRE], said: null } };
    case 'oo_off':
      return alone;
    case 'oo_confirm':
      return { ...alone, confirming: PROVED_DOMAIN };
    case 'oo_scheduled':
    case 'oo_not_owner':
      return soon;
    case 'oo_cancelled':
      return { ...soon, view: onlyOff(soon.view, PROVED_DOMAIN, 'cancelled') };
    case 'oo_on':
      return {
        ...base,
        view: enterprise([{ ...IRE, only: 'on', onAt: plusDays(CLOCK.onSwitched, ONLY_DAYS) }]),
      };
    case 'oo_turned_off':
      return { ...alone, view: onlyOff(alone.view, PROVED_DOMAIN, 'turnedOff') };
    case 'loading':
    case 'failed':
      return { ...base, load: state };
    default:
      return base;
  }
}
