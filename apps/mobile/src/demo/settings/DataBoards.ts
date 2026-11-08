import { AUDIT_STATES, type AuditState } from './AuditModel.ts';
import {
  dataHref,
  DOMAINS_STATES,
  type DomainsState,
  HUB_STATES,
  type HubState,
} from './DataModel.ts';

interface Board {
  title: string;
  what: string;
  href: string;
}

const HUB: Record<HubState, readonly [string, string]> = {
  hub: ['the hub', 'ireevents.com waits for its record; See the record'],
  quiet: ['nothing needs you', 'ire.events proved, no step'],
  new: ['nothing set up', 'Prove a domain'],
  locked: ['free, never on Enterprise', 'The rows locked; Contact Soirely'],
  downgraded: ['left Enterprise', 'Kept as they were, Sunday, Oct 18'],
  loading: ['loading', 'Loading Data and control…'],
  failed: ['failed', 'Could not load, Try again'],
};

const DOMAINS: Record<DomainsState, readonly [string, string]> = {
  domains: ['Email domains', 'ire.events proved, ireevents.com waiting'],
  ed_empty: ['no domains yet', 'Prove Ire Events’ email domain'],
  ed_add: ['Prove a domain', 'The field, the keys up'],
  ed_blank: ['Add with nothing', 'Enter a domain, like ire.events.'],
  ed_invalid: ['not a domain', '“ire events”: a dot and no spaces'],
  ed_public: ['a public domain', 'gmail.com refused'],
  ed_taken: ['proved elsewhere', 'lumenfeiras.pt refused'],
  ed_record: ['the record', 'TXT, Name and Value with Copy; Verify'],
  ed_checking: ['verifying', 'Verifying…, then not found'],
  ed_not_found: ['not found yet', 'DNS changes can take up to 48 hours'],
  ed_proved: ['proved', 'Both proved; Keep its accounts to Ire Events'],
  ed_failed: ['not proved', 'Checks stopped Monday, Oct 12'],
  ed_lapsing: ['record missing', 'Put it back by Saturday, Oct 31'],
  ed_remove: ['Remove ire.events?', 'Keep it or Remove'],
  ed_removed: ['removed', 'Only ireevents.com is left'],
  ed_locked: ['free plan', 'Available on Enterprise'],
  ed_downgraded: ['left Enterprise', 'ire.events kept, read only'],
  oo_off: ['Only our organisation · off', 'ire.events alone, the switch off'],
  oo_confirm: ['Only our organisation · the Ask', 'From Monday, Nov 2; Schedule it'],
  oo_scheduled: ['Only our organisation · scheduled', 'Starts Monday, Nov 2, with Cancel'],
  oo_cancelled: ['Only our organisation · cancelled', 'Nothing changes'],
  oo_on: ['Only our organisation · on', 'On since Saturday, Oct 3'],
  oo_turned_off: ['Only our organisation · turned off', 'At once, no Ask'],
  oo_not_owner: ['Only our organisation · an admin', 'Only an owner can change this.'],
  loading: ['loading', 'Loading Email domains…'],
  failed: ['failed', 'Could not load, Try again'],
};

const AUDIT: Record<AuditState, readonly [string, string]> = {
  list: ['Audit log', 'Entries by day, four menus'],
  filter_person: ['Person menu', 'Anyone, the members, Marta Silva · left'],
  filter_type: ['Type menu', 'All types and the six'],
  filter_event: ['Event menu', 'All events and the events'],
  dates: ['Dates', 'Oct 1 to Oct 19, 2026'],
  date_invalid: ['Dates the wrong way round', 'Apply off'],
  filtered: ['filtered', 'Sign-in and security, Clear filters'],
  empty_filter: ['no entry matches', 'Ana Souza and Events'],
  detail: ['an entry', 'Made Ireti at 40 live'],
  detail_gone: ['an entry, the event gone', 'No longer exists, no link'],
  detail_signin: ['an entry, sign-in rules', 'Network address and device'],
  detail_old: ['an entry, recorded before', 'An address, no device'],
  detail_system: ['an entry by System', 'No address, no device'],
  export: ['Export these entries (iPad)', 'CSV or JSON Lines'],
  export_small: ['export, up to 10,000 (iPad)', 'Downloading, as a toast'],
  export_preparing: ['export, prepared (iPad)', 'We’ll email a link'],
  export_too_many: ['export, too many (iPad)', 'More than 1,000,000 entries match'],
  locked: ['free plan', 'Available on Enterprise'],
  loading: ['loading', 'Loading the audit log…'],
  failed: ['failed', 'Could not load, Try again'],
};

const titled = (page: string, atRest: string, title: string) =>
  title === atRest ? page : `${page} · ${title}`;

/** The demo home's Data and control page: every state of enterprise-b-spec.md the app has, and §10's managed refusals. */
export const DATA_BOARDS: readonly Board[] = [
  ...HUB_STATES.map((state) => ({
    title: titled('Data and control', 'the hub', HUB[state][0]),
    what: HUB[state][1],
    href: dataHref('hub', { state: state === 'hub' ? null : state }),
  })),
  {
    title: 'Data and control · as an admin',
    what: 'Julien Moreau: the same card',
    href: dataHref('hub', { as: 'julien' }),
  },
  {
    title: 'Data and control · as a member',
    what: 'Ana Souza: Settings without it',
    href: dataHref('hub', { as: 'ana' }),
  },
  ...DOMAINS_STATES.map((state) => ({
    title: titled('Email domains', 'Email domains', DOMAINS[state][0]),
    what: DOMAINS[state][1],
    href: dataHref('emailDomains', { state: state === 'domains' ? null : state }),
  })),
  {
    title: 'Email domains · as an admin',
    what: 'No switch: Only an owner can change this.',
    href: dataHref('emailDomains', { as: 'julien' }),
  },
  ...AUDIT_STATES.map((state) => ({
    title: titled('Audit log', 'Audit log', AUDIT[state][0]),
    what: AUDIT[state][1],
    href: dataHref('auditLog', { state: state === 'list' ? null : state }),
  })),
  {
    title: 'Organisation · a domain on both lists',
    what: 'ire.events carries Proved in Company domain joining',
    href: '/demo/settings/organisation?state=domainBoth',
  },
  {
    title: 'Create an organisation · managed',
    what: 'Managed by Ire Events, in place of the first step',
    href: '/demo/today?create=managed',
  },
  {
    title: 'An invitation · managed',
    what: 'Join refused: the banner in place of the buttons',
    href: '/demo/today?switcher=managed',
  },
  {
    title: 'A request link · managed',
    what: 'Ask to join Lumen Feiras refused',
    href: '/demo/join?state=managed',
  },
  {
    title: 'Members · also a member elsewhere',
    what: 'Priya Shah: of 2 other organisations',
    href: '/demo/settings/members?state=alsoMember',
  },
];
