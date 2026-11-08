import { instantWords, LEFT_ENTERPRISE_AT, type ReaderZone, runAfter } from './dataSettings.ts';
import { SAMPLE } from './rules.ts';
import { type DemoLink, VIEWERS, type Viewer } from './settings.ts';

export type DataControlPage =
  'hub' | 'emailDomains' | 'auditLog' | 'export' | 'deleteGuestData' | 'guestRequest';

const SUB_PATHS: Record<DataControlPage, string> = {
  hub: '',
  emailDomains: '/email-domains',
  auditLog: '/audit-log',
  export: '/export',
  deleteGuestData: '/delete-guest-data',
  guestRequest: '/guest-request',
};

export const DATA_CONTROL_ROOT = '/demo/settings/data-and-control';

export function dataControlPath(
  page: DataControlPage,
  viewer: Pick<Viewer, 'key'>,
  state?: string,
): string {
  const query = new URLSearchParams();
  if (viewer.key !== 'folake') query.set('as', viewer.key);
  if (state != null) query.set('state', state);
  const search = query.toString();

  return `${DATA_CONTROL_ROOT}${SUB_PATHS[page]}${search === '' ? '' : `?${search}`}`;
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export function plusDays(at: string, days: number): string {
  return new Date(new Date(at).getTime() + days * DAY_MS).toISOString();
}

/** The sample's one now, and every instant derived from it (enterprise-b-spec §2). */
export const CLOCK = {
  now: '2026-10-19T10:12:00+01:00',
  proved: '2026-10-06T11:02:00+01:00',
  added: '2026-10-16T16:45:00+01:00',
  onSwitched: '2026-09-19T11:05:00+01:00',
  failedAdded: '2026-10-05T09:30:00+01:00',
  missing: '2026-10-17T14:20:00+01:00',
  asked: '2026-10-19T09:30:00+01:00',
  ready: '2026-10-19T09:52:00+01:00',
  used: '2026-10-19T10:05:00+01:00',
  expired: '2026-10-20T11:00:00+01:00',
  notice: '2026-10-17T14:20:00+01:00',
  left: LEFT_ENTERPRISE_AT,
} as const;

export const CHECK_DAYS = 7;
export const ONLY_DAYS = 14;
export const PUT_BACK_DAYS = 14;

export const RUN_AT = runAfter(CLOCK.notice);
export const LINK_UNTIL = plusDays(CLOCK.ready, 1);
export const NEXT_EXPORT = plusDays(CLOCK.asked, 1);
export const ORG = SAMPLE.organisation;
export const ASKER = VIEWERS.folake;

/** The reader's own zone (sc-868): Julien, an admin, reads in London, as #1544's admin does. */
export function zoneFor(viewer: Pick<Viewer, 'key'>): ReaderZone {
  return viewer.key === VIEWERS.julien.key ? 'Europe/London' : 'Africa/Lagos';
}

export function when(at: string, locale: string, zone: ReaderZone): string {
  return instantWords(at, zone, locale);
}

export function dayOf(at: string, locale: string, zone: ReaderZone, year = false): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    ...(year ? { year: 'numeric' } : {}),
    timeZone: zone ?? 'UTC',
  }).format(new Date(at));
}

export const SHARED_WORDS = {
  back: 'Data and control',
  contact: 'Contact Soirely about Enterprise',
  contactTold: 'Contacting Soirely has its own design.',
  enterprise: 'Enterprise',
  failedLine: 'Check your connection and try again.',
  tryAgain: 'Try again',
  ready: 'Ready',
} as const;

export const HUB_WORDS = {
  title: 'Data and control',
  control: 'Control',
  data: 'Data',
  emailDomains: 'Email domains',
  auditLog: 'Audit log',
  export: 'Export all data',
  deleteGuestData: 'Delete guest data after an event',
  guestRequest: 'A guest’s request',
  loading: 'Loading Data and control…',
  failed: 'We could not load Data and control.',
  download: 'Download',
  seeRecord: 'See the record',
  prove: 'Prove a domain',
  checkRun: (count: number) => `Check the ${count} events`,
  downloaded: 'Downloaded',
} as const;

export type HubPlan = 'enterprise' | 'free' | 'left';
export type HubSetup = 'live' | 'quiet' | 'new';
export type Exported = 'ready' | 'used' | 'none';

export interface HubView {
  plan: HubPlan;
  setup: HubSetup;
  exported: Exported;
}

export type HubStep = 'download' | 'seeRecord' | 'prove' | 'contact' | 'checkRun';

export interface HubCard {
  says: string;
  line: string;
  step: HubStep | null;
}

export const HUB_STATES = ['hub', 'quiet', 'new', 'locked', 'downgraded', 'loading', 'failed'];

export function hubStart(state: string): { load: 'loaded' | 'loading' | 'failed'; view: HubView } {
  const live: HubView = { plan: 'enterprise', setup: 'live', exported: 'ready' };

  switch (state) {
    case 'quiet':
      return { load: 'loaded', view: { ...live, setup: 'quiet', exported: 'none' } };
    case 'new':
      return { load: 'loaded', view: { ...live, setup: 'new', exported: 'none' } };
    case 'locked':
      return { load: 'loaded', view: { plan: 'free', setup: 'new', exported: 'none' } };
    case 'downgraded':
      return { load: 'loaded', view: { ...live, plan: 'left', exported: 'none' } };
    case 'loading':
    case 'failed':
      return { load: state, view: live };
    default:
      return { load: 'loaded', view: live };
  }
}

export const RUN_COUNT = 2;
export const WAITING_DOMAIN = 'ireevents.com';
export const PROVED_DOMAIN = 'ire.events';

interface Ask {
  at: string;
  mayAct: (viewer: Pick<Viewer, 'key' | 'manages'>) => boolean;
  card: (locale: string, zone: ReaderZone) => HubCard;
}

/** What asks something of somebody now, each at the instant it stops waiting. */
export function asksOf(view: HubView): Ask[] {
  if (view.plan !== 'enterprise' || view.setup !== 'live') return [];

  const download: Ask = {
    at: LINK_UNTIL,
    mayAct: (viewer) => viewer.key === ASKER.key,
    card: (locale, zone) => ({
      says: 'Your export is ready',
      line: `It downloads once, until ${when(LINK_UNTIL, locale, zone)}, and only for you, signed in.`,
      step: 'download',
    }),
  };
  const record: Ask = {
    at: plusDays(CLOCK.added, CHECK_DAYS),
    mayAct: (viewer) => viewer.manages,
    card: (locale, zone) => ({
      says: `${WAITING_DOMAIN} is waiting for its record`,
      line: `We check every hour until ${when(plusDays(CLOCK.added, CHECK_DAYS), locale, zone)}.`,
      step: 'seeRecord',
    }),
  };
  const run: Ask = {
    at: RUN_AT,
    mayAct: (viewer) => viewer.manages,
    card: (locale, zone) => ({
      says: `Next run · ${when(RUN_AT, locale, zone)}`,
      line: `${RUN_COUNT} events are in the next run.`,
      step: 'checkRun',
    }),
  };

  return [...(view.exported === 'ready' ? [download] : []), record, run];
}

export function soonestAsk(
  asks: readonly Ask[],
  viewer: Pick<Viewer, 'key' | 'manages'>,
): Ask | null {
  return (
    asks
      .filter((ask) => ask.mayAct(viewer))
      .sort((one, other) => Date.parse(one.at) - Date.parse(other.at))[0] ?? null
  );
}

/** The hub's card: the soonest instant that asks something of the person looking, on the web. */
export function hubCard(
  view: HubView,
  viewer: Pick<Viewer, 'key' | 'manages'>,
  locale: string,
): HubCard {
  if (view.plan === 'free')
    return {
      says: 'Three of these come with Enterprise',
      line: 'Email domains, the audit log and deleting guest data after an event. Export all data and a guest’s request are on every plan.',
      step: 'contact',
    };
  if (view.plan === 'left')
    return {
      says: `${ORG} left Enterprise on ${dayOf(CLOCK.left, locale, zoneFor(viewer))}`,
      line: 'Email domains, the audit log and deleting guest data are switched off and kept as they were. They come back on with Enterprise.',
      step: 'contact',
    };
  if (view.setup === 'new')
    return {
      says: 'Nothing is set up yet',
      line: `Start by proving ${ORG}’ email domain.`,
      step: 'prove',
    };

  const ask = soonestAsk(asksOf(view), viewer);

  return (
    ask?.card(locale, zoneFor(viewer)) ?? {
      says: 'Nothing needs you',
      line: `${PROVED_DOMAIN} is proved. Deleting guest data is off.`,
      step: null,
    }
  );
}

export interface HubRow {
  page: Exclude<DataControlPage, 'hub'>;
  title: string;
  line: string;
  tag: 'ready' | 'locked' | null;
  state: string | undefined;
}

const LOCKABLE: ReadonlySet<HubRow['page']> = new Set([
  'emailDomains',
  'auditLog',
  'deleteGuestData',
]);

function exportRow(view: HubView, viewer: Pick<Viewer, 'key' | 'owns'>, locale: string) {
  const asker = viewer.key === ASKER.key;

  if (view.exported === 'ready')
    return {
      line: asker
        ? `Ready until ${when(LINK_UNTIL, locale, zoneFor(viewer))}`
        : `Ready · asked by ${ASKER.name}`,
      tag: 'ready' as const,
      state: asker ? 'ex_ready' : 'ex_ready_other',
    };
  if (view.exported === 'used')
    return { line: HUB_WORDS.downloaded, tag: null, state: asker ? 'ex_used' : 'not_owner' };

  return {
    line: `Everything ${ORG} holds, in one archive`,
    tag: null,
    state: viewer.owns ? 'ex_idle' : 'not_owner',
  };
}

/** Each row's line, and the state its page opens in, so the page goes on from the hub. */
export function hubRows(
  view: HubView,
  viewer: Pick<Viewer, 'key' | 'owns'>,
  locale: string,
): { control: HubRow[]; data: HubRow[] } {
  const locked = view.plan !== 'enterprise';
  const left = view.plan === 'left';
  const quiet = view.setup !== 'live';
  const row = (
    page: HubRow['page'],
    line: string,
    state: string | undefined,
    tag: HubRow['tag'] = null,
  ): HubRow => ({
    page,
    title: HUB_WORDS[page],
    line,
    state,
    tag: locked && LOCKABLE.has(page) ? 'locked' : tag,
  });
  const exported = exportRow(view, viewer, locale);
  const domains = left
    ? row('emailDomains', `${PROVED_DOMAIN} kept as it was`, 'ed_downgraded')
    : locked
      ? row('emailDomains', `Prove your domain and keep its accounts to ${ORG}`, 'ed_locked')
      : view.setup === 'new'
        ? row('emailDomains', 'No domains yet', 'ed_empty')
        : view.setup === 'quiet'
          ? row('emailDomains', `${PROVED_DOMAIN} proved`, 'oo_off')
          : row(
              'emailDomains',
              `${PROVED_DOMAIN} proved · ${WAITING_DOMAIN} waiting for the record`,
              undefined,
            );
  const guestData = left
    ? row('deleteGuestData', '90 days and 1 held event, kept as they were', 'rt_downgraded')
    : locked
      ? row('deleteGuestData', 'Erase guests’ details on time after each event', 'rt_locked')
      : quiet
        ? row('deleteGuestData', 'Off', 'rt_off')
        : row(
            'deleteGuestData',
            `After 90 days · next run ${when(RUN_AT, locale, zoneFor(viewer))}, ${RUN_COUNT} events`,
            'rt_held',
          );

  return {
    control: [
      domains,
      row('auditLog', 'Who did what, for 365 days', locked ? 'locked' : undefined),
    ],
    data: [
      row('export', exported.line, exported.state, exported.tag),
      guestData,
      row('guestRequest', 'Export or erase everything held on one guest', undefined),
    ],
  };
}

/** Which person a state is drawn for: some imply Julien, an admin, whoever the link names. */
export function dataControlViewerKey(
  page: DataControlPage,
  as: string | null,
  state: string,
): string | null {
  if (page === 'emailDomains' && state === 'oo_not_owner') return VIEWERS.julien.key;
  if (page === 'export' && (state === 'ex_ready_other' || state === 'not_owner'))
    return VIEWERS.julien.key;
  if (page === 'deleteGuestData' && state === 'not_owner') return VIEWERS.julien.key;

  return as;
}

export type PageLinks = readonly { name: string; states: readonly DemoLink[] }[];

export function linkTo(
  page: DataControlPage,
  state: string | undefined,
  name: string,
  viewer: Viewer = VIEWERS.folake,
): DemoLink {
  return { to: dataControlPath(page, viewer, state), name };
}
