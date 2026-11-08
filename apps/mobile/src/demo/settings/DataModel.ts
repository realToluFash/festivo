import { companyDomainProblem, normaliseDomain } from '@soirely/domain';

import { DOMAIN_WORDS } from './OrganisationWords.ts';
import {
  AT,
  type DataSay,
  DERIVED,
  type Domain,
  IRE,
  IRE_EVENTS,
  NOW,
  plusDays,
  CHECK_DAYS,
  ONLY_DAYS,
  PROVED_IRE,
  WAITING_IRE_EVENTS,
} from './DataSample.ts';
import { DATA_WORDS as H, DOMAINS_WORDS as D } from './DataWords.ts';
import type { Load } from './RolesSample.ts';

export type DataPage = 'hub' | 'emailDomains' | 'auditLog';

/** `as=julien` is the Admin, `as=ana` the Member; anybody else looks as Folake, the Owner. */
export type DataViewer = 'folake' | 'julien' | 'ana';

export const DATA_PEOPLE: Record<DataViewer, { email: string; owns: boolean; manages: boolean }> = {
  folake: { email: 'folake@ire.events', owns: true, manages: true },
  julien: { email: 'julien@ire.events', owns: false, manages: true },
  ana: { email: 'ana.souza@ire.events', owns: false, manages: false },
};

export function dataViewerOf(as: string | undefined): DataViewer {
  return as === 'julien' || as === 'ana' ? as : 'folake';
}

const PATHS: Record<DataPage, string> = {
  hub: '/demo/settings/data-and-control',
  emailDomains: '/demo/settings/data-and-control/email-domains',
  auditLog: '/demo/settings/data-and-control/audit-log',
};

export function dataHref(
  page: DataPage,
  query: { state?: string | null; as?: DataViewer; from?: HubState | null } = {},
): string {
  const parts = [
    query.state == null ? '' : `state=${query.state}`,
    query.as == null || query.as === 'folake' ? '' : `as=${query.as}`,
    query.from == null || query.from === 'hub' ? '' : `from=${query.from}`,
  ].filter((part) => part !== '');

  return `${PATHS[page]}${parts.length === 0 ? '' : `?${parts.join('&')}`}`;
}

export type Plan = 'enterprise' | 'locked' | 'downgraded';

export interface Go {
  kind: 'record' | 'prove' | 'only' | 'contact' | 'export';
  domain?: string;
}

export interface CardWords {
  says: string;
  line: string;
  step: { label: string; go: Go } | null;
}

const CONTACT = { label: H.contact, go: { kind: 'contact' } } as const;

/** What asks something of the person looking: a record still to add or to put back, by its instant; a failed one after. */
export function controlAsks(domains: readonly Domain[], say: DataSay) {
  return domains.flatMap((domain) => {
    const step = { label: D.card.seeRecord, go: { kind: 'record', domain: domain.name } as Go };
    const at = domain.deadline ?? NOW;
    const ask = (says: string, line: string, when: number) => [
      { kind: domain.status, at: when, says, line, step },
    ];
    if (domain.status === 'waiting')
      return ask(D.card.waiting(domain.name), D.card.waitingLine(say.at(at)), Date.parse(at));
    if (domain.status === 'missing')
      return ask(
        D.card.missing(domain.name),
        D.card.missingLine(say.at(at), domain.name),
        Date.parse(at),
      );
    if (domain.status === 'failed')
      return ask(D.card.failed(domain.name), D.card.failedLine(say.at(at)), Infinity);

    return [];
  });
}

export function soonest<T extends { at: number }>(asks: readonly T[]): T | null {
  return asks.reduce<T | null>(
    (best, ask) => (best == null || ask.at < best.at ? ask : best),
    null,
  );
}

export const HUB_STATES = [
  'hub',
  'quiet',
  'new',
  'locked',
  'downgraded',
  'loading',
  'failed',
] as const;
export type HubState = (typeof HUB_STATES)[number];

export function hubStateOf(name: string | undefined): HubState {
  return HUB_STATES.find((state) => state === name) ?? 'hub';
}

export interface HubStart {
  load: Load;
  plan: Plan;
  domains: Domain[];
}

const KEPT_IRE: Domain = { ...PROVED_IRE, status: 'kept' };

export function hubStart(state: HubState): HubStart {
  const at = { load: 'loaded' as Load, plan: 'enterprise' as Plan };
  switch (state) {
    case 'quiet':
      return { ...at, domains: [PROVED_IRE] };
    case 'new':
      return { ...at, domains: [] };
    case 'locked':
      return { ...at, plan: 'locked', domains: [] };
    case 'downgraded':
      return { ...at, plan: 'downgraded', domains: [KEPT_IRE] };
    case 'loading':
    case 'failed':
      return { ...at, load: state, domains: [PROVED_IRE, WAITING_IRE_EVENTS] };
    case 'hub':
      return { ...at, domains: [PROVED_IRE, WAITING_IRE_EVENTS] };
  }
}

/** The hub's card in the app: the soonest instant among Control's items, or where Ire Events stands. */
export function hubCard(start: HubStart, say: DataSay): CardWords {
  if (start.plan === 'locked') return { says: H.locked, line: H.lockedLine, step: CONTACT };
  if (start.plan === 'downgraded')
    return { says: H.left(say.day(AT.leftEnterprise)), line: H.leftLine, step: CONTACT };
  if (start.domains.length === 0)
    return {
      says: H.nothingSet,
      line: H.nothingSetLine,
      step: { label: D.prove, go: { kind: 'prove' } },
    };
  const ask = soonest(controlAsks(start.domains, say));

  return ask == null
    ? { says: H.nothing, line: H.nothingLine, step: null }
    : { says: ask.says, line: ask.line, step: ask.step };
}

const STANDING: Record<Domain['status'], string> = {
  proved: 'proved',
  waiting: 'waiting for the record',
  failed: 'not proved',
  missing: 'record missing',
  kept: 'kept as it was',
};

export interface HubRow {
  key: 'emailDomains' | 'auditLog';
  title: string;
  line: string;
  locked: boolean;
  opens: string;
}

export function hubRows(start: HubStart, state: HubState): HubRow[] {
  const locked = start.plan !== 'enterprise';
  const domainsLine =
    start.plan === 'locked'
      ? H.rows.lockedDomains
      : start.domains.length === 0
        ? H.rows.noDomains
        : start.domains.map((domain) => `${domain.name} ${STANDING[domain.status]}`).join(' · ');
  const opens = HUB_OPENS[state];

  return [
    { key: 'emailDomains', title: H.rows.domains, line: domainsLine, locked, opens: opens.domains },
    { key: 'auditLog', title: H.rows.audit, line: H.rows.auditLine, locked, opens: opens.audit },
  ];
}

const HUB_OPENS: Record<HubState, { domains: DomainsState; audit: string; step: DomainsState }> = {
  hub: { domains: 'domains', audit: 'list', step: 'ed_record' },
  quiet: { domains: 'oo_off', audit: 'list', step: 'oo_off' },
  new: { domains: 'ed_empty', audit: 'list', step: 'ed_add' },
  locked: { domains: 'ed_locked', audit: 'locked', step: 'ed_locked' },
  downgraded: { domains: 'ed_downgraded', audit: 'locked', step: 'ed_downgraded' },
  loading: { domains: 'domains', audit: 'list', step: 'ed_record' },
  failed: { domains: 'domains', audit: 'list', step: 'ed_record' },
};

export function hubStepOpens(state: HubState): DomainsState {
  return HUB_OPENS[state].step;
}

export const DOMAINS_STATES = [
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
export type DomainsState = (typeof DOMAINS_STATES)[number];

export function domainsStateOf(name: string | undefined): DomainsState {
  return DOMAINS_STATES.find((state) => state === name) ?? 'domains';
}

/** A hub state to go back to: the one the link came from, or the one this page's sample belongs to. */
export function hubFor(state: string | undefined, from: string | undefined): HubState {
  if (from != null) return hubStateOf(from);
  if (state === 'ed_locked' || state === 'locked') return 'locked';
  if (state === 'ed_downgraded') return 'downgraded';
  if (state === 'oo_off') return 'quiet';
  if (state === 'ed_empty') return 'new';

  return 'hub';
}

export type Check = 'resting' | 'checking' | 'notFound';
export type Said =
  | { kind: 'proved'; domain: string; at: string }
  | { kind: 'removed' | 'cancelled' | 'turnedOff'; domain: string };

export interface ProveOpen {
  typed: string;
  problem: string | null;
}

export interface DomainsModel {
  load: Load;
  plan: Plan;
  domains: Domain[];
  said: Said | null;
  record: string | null;
  check: Check;
  prove: ProveOpen | null;
  ask: { kind: 'remove' | 'only'; domain: string } | null;
}

const FAILED_IRE_EVENTS: Domain = {
  ...WAITING_IRE_EVENTS,
  status: 'failed',
  deadline: DERIVED.stopped,
};
const MISSING_IRE: Domain = { ...PROVED_IRE, status: 'missing', deadline: DERIVED.putBackBy };

export const TAKEN = 'lumenfeiras.pt';
export const PUBLIC_SAMPLE = 'gmail.com';
export const INVALID_SAMPLE = 'ire events';

/** What a state link opens on; only the Owner has Only our organisation's Ask open, and anyone managing has Remove's. */
export function domainsStart(state: DomainsState, owns: boolean): DomainsModel {
  const base: DomainsModel = {
    load: 'loaded',
    plan: 'enterprise',
    domains: [PROVED_IRE, WAITING_IRE_EVENTS],
    said: null,
    record: null,
    check: 'resting',
    prove: null,
    ask: null,
  };
  const empty = { ...base, domains: [] };
  const alone = { ...base, domains: [PROVED_IRE] };
  const proving = (typed: string, problem: string | null) => ({
    ...empty,
    prove: { typed, problem },
  });
  const only = (domain: Domain) => ({ ...base, domains: [domain] });

  switch (state) {
    case 'domains':
      return base;
    case 'loading':
    case 'failed':
      return { ...base, load: state };
    case 'ed_empty':
      return empty;
    case 'ed_add':
      return proving('', null);
    case 'ed_blank':
      return proving('', domainFieldProblem(''));
    case 'ed_invalid':
      return proving(INVALID_SAMPLE, domainFieldProblem(INVALID_SAMPLE));
    case 'ed_public':
      return proving(PUBLIC_SAMPLE, domainRefusal(PUBLIC_SAMPLE, []));
    case 'ed_taken':
      return proving(TAKEN, domainRefusal(TAKEN, []));
    case 'ed_record':
      return { ...base, record: IRE_EVENTS };
    case 'ed_checking':
      return { ...base, record: IRE_EVENTS, check: 'checking' };
    case 'ed_not_found':
      return { ...base, record: IRE_EVENTS, check: 'notFound' };
    case 'ed_proved':
      return { ...base, ...provedNow(base, IRE_EVENTS) };
    case 'ed_failed':
      return { ...base, domains: [PROVED_IRE, FAILED_IRE_EVENTS] };
    case 'ed_lapsing':
      return { ...base, domains: [MISSING_IRE, WAITING_IRE_EVENTS] };
    case 'ed_remove':
      return { ...base, ask: { kind: 'remove', domain: IRE } };
    case 'ed_removed':
      return { ...base, domains: [WAITING_IRE_EVENTS], said: { kind: 'removed', domain: IRE } };
    case 'ed_locked':
      return { ...empty, plan: 'locked' };
    case 'ed_downgraded':
      return { ...base, plan: 'downgraded', domains: [{ ...PROVED_IRE, status: 'kept' }] };
    case 'oo_off':
      return alone;
    case 'oo_confirm':
      return { ...alone, ask: owns ? { kind: 'only', domain: IRE } : null };
    case 'oo_scheduled':
    case 'oo_not_owner':
      return only({ ...PROVED_IRE, only: 'scheduled', onlyAt: DERIVED.onlyStarts });
    case 'oo_cancelled':
      return { ...alone, said: { kind: 'cancelled', domain: IRE } };
    case 'oo_on':
      return only({ ...PROVED_IRE, only: 'on', onlyAt: DERIVED.onlySince });
    case 'oo_turned_off':
      return { ...alone, said: { kind: 'turnedOff', domain: IRE } };
  }
}

export function domainsOwns(state: DomainsState, viewer: DataViewer): boolean {
  return state !== 'oo_not_owner' && DATA_PEOPLE[viewer].owns;
}

/** Proving and removing are the plan's, so the page does nothing while it is locked or kept. */
export function domainsCard(model: DomainsModel, owns: boolean, say: DataSay): CardWords {
  const C = D.card;
  if (model.plan === 'locked') return { says: C.locked, line: C.lockedLine, step: CONTACT };
  if (model.plan === 'downgraded')
    return { says: C.off(say.day(AT.leftEnterprise)), line: C.offLine, step: CONTACT };
  const keep = (domain: string) =>
    owns ? { label: C.keep, go: { kind: 'only', domain } as Go } : null;
  const said = model.said;
  if (said?.kind === 'proved')
    return {
      says: C.proved(said.domain),
      line: C.provedLine(say.at(said.at)),
      step: keep(said.domain),
    };
  if (said?.kind === 'removed') {
    const next = soonest(controlAsks(model.domains, say));
    return { says: C.removed(said.domain), line: C.removedLine, step: next?.step ?? null };
  }
  if (said?.kind === 'cancelled')
    return { says: C.cancelled, line: C.cancelledLine(said.domain), step: null };
  if (said?.kind === 'turnedOff')
    return { says: C.turnedOff, line: C.turnedOffLine(said.domain), step: null };
  if (model.domains.length === 0)
    return { says: C.empty, line: C.emptyLine, step: { label: D.prove, go: { kind: 'prove' } } };
  const asks = controlAsks(model.domains, say);
  const ask =
    asks.find((one) => one.kind === 'missing') ??
    asks.find((one) => one.kind === 'failed') ??
    soonest(asks);
  if (ask != null) return { says: ask.says, line: ask.line, step: ask.step };
  const scheduled = model.domains.find((domain) => domain.only === 'scheduled');
  if (scheduled != null)
    return {
      says: C.scheduled(say.at(scheduled.onlyAt ?? '')),
      line: owns ? C.scheduledLine(scheduled.name) : C.scheduledAdmin,
      step: null,
    };
  const open = model.domains.find((domain) => isProved(domain) && domain.only === 'off');
  if (open != null)
    return { says: C.onlyProved(open.name), line: D.onlyOff(open.name), step: keep(open.name) };
  const on = model.domains.find((domain) => domain.only === 'on');

  return on == null
    ? { says: H.nothing, line: H.nothingLine, step: null }
    : { says: C.on(on.name), line: C.onLine, step: null };
}

export function isProved(domain: Domain): boolean {
  return domain.status === 'proved' || domain.status === 'missing' || domain.status === 'kept';
}

export type TagWord = { kind: 'yes' | 'waiting' | 'no' | 'kept'; word: string };

export interface DomainRow {
  name: string;
  tag: TagWord;
  line: string;
  action: 'remove' | 'record' | null;
  only: { line: string; control: 'switch' | 'cancel' | null; on: boolean } | null;
}

export function domainRows(model: DomainsModel, owns: boolean, say: DataSay): DomainRow[] {
  const kept = model.plan === 'downgraded';

  return model.domains.map((domain) => {
    const tag: TagWord = {
      proved: { kind: 'yes', word: D.proved },
      waiting: { kind: 'waiting', word: D.waiting },
      failed: { kind: 'no', word: D.notProved },
      missing: { kind: 'waiting', word: D.missing },
      kept: { kind: 'kept', word: D.kept },
    }[domain.status] as TagWord;
    const at = (iso: string | null) => say.at(iso ?? NOW);
    const line = {
      proved: D.provedOn(at(domain.provedAt)),
      kept: D.provedOn(at(domain.provedAt)),
      waiting: D.checksUntil(at(domain.deadline)),
      failed: D.stopped(at(domain.deadline)),
      missing: D.putBack(at(domain.deadline)),
    }[domain.status];

    return {
      name: domain.name,
      tag,
      line,
      action: kept ? null : domain.status === 'proved' ? 'remove' : 'record',
      only: isProved(domain) ? onlyRow(domain, owns, kept, say) : null,
    };
  });
}

function onlyRow(domain: Domain, owns: boolean, kept: boolean, say: DataSay): DomainRow['only'] {
  if (kept) return { line: D.onlyKept, control: null, on: domain.only === 'on' };
  const line = {
    off: D.onlyOff(domain.name),
    scheduled: D.onlyStarts(say.at(domain.onlyAt ?? NOW)),
    on: D.onlySince(say.day(domain.onlyAt ?? NOW)),
  }[domain.only];
  if (!owns)
    return {
      line: `${line.endsWith('.') ? line : `${line}.`} ${D.ownerOnly}`,
      control: null,
      on: domain.only === 'on',
    };

  return {
    line,
    control: domain.only === 'scheduled' ? 'cancel' : 'switch',
    on: domain.only === 'on',
  };
}

/** Before sending: blank, then the shape (a hostname with a dot), in the words Company domain joining uses. */
export function domainFieldProblem(typed: string): string | null {
  const problem = companyDomainProblem(typed);
  if (problem == null) return null;

  return problem === 'blank' ? DOMAIN_WORDS.blank(IRE) : DOMAIN_WORDS.shape(IRE);
}

const PUBLIC = new Set(['gmail.com', 'outlook.com', 'hotmail.com', 'yahoo.com', 'icloud.com']);
const PROVED_ELSEWHERE = new Set([TAKEN]);

export function domainRefusal(typed: string, listed: readonly string[]): string | null {
  const domain = normaliseDomain(typed);
  if (PUBLIC.has(domain)) return D.add.publicDomain;
  if (PROVED_ELSEWHERE.has(domain)) return D.add.taken;
  if (listed.includes(domain)) return DOMAIN_WORDS.listed(domain);

  return null;
}

export function withAdded(model: DomainsModel, typed: string): DomainsModel {
  const domain: Domain = {
    name: normaliseDomain(typed),
    status: 'waiting',
    provedAt: null,
    deadline: plusDays(NOW, CHECK_DAYS),
    only: 'off',
    onlyAt: null,
  };

  return {
    ...model,
    domains: [...model.domains, domain],
    said: null,
    prove: null,
    record: domain.name,
    check: 'resting',
  };
}

/** Verify answers: not found the first time on a record still to add, found after. */
export function verifyFinds(domain: Domain, tries: number): boolean {
  return domain.status === 'missing' || tries > 0;
}

function provedNow(model: DomainsModel, name: string): Pick<DomainsModel, 'domains' | 'said'> {
  const was = model.domains.find((domain) => domain.name === name);
  const at = was?.status === 'missing' ? (was.provedAt ?? NOW) : NOW;

  return {
    domains: model.domains.map((domain) =>
      domain.name === name ? { ...domain, status: 'proved', provedAt: at, deadline: null } : domain,
    ),
    said: { kind: 'proved', domain: name, at },
  };
}

export function withVerified(model: DomainsModel, name: string): DomainsModel {
  return { ...model, ...provedNow(model, name), record: null, check: 'resting' };
}

export function withRemoved(model: DomainsModel, name: string, asked: boolean): DomainsModel {
  return {
    ...model,
    domains: model.domains.filter((domain) => domain.name !== name),
    said: asked ? { kind: 'removed', domain: name } : model.said,
    record: null,
    ask: null,
    check: 'resting',
  };
}

export function withOnly(model: DomainsModel, name: string, next: Domain['only']): DomainsModel {
  const was = model.domains.find((domain) => domain.name === name)?.only;
  const said: Said | null =
    next !== 'off' ? null : { kind: was === 'scheduled' ? 'cancelled' : 'turnedOff', domain: name };

  return {
    ...model,
    domains: model.domains.map((domain) =>
      domain.name === name
        ? { ...domain, only: next, onlyAt: next === 'scheduled' ? plusDays(NOW, ONLY_DAYS) : null }
        : domain,
    ),
    said,
    ask: null,
  };
}
