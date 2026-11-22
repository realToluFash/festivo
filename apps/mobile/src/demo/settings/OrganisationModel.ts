import { domainOf, normaliseDomain, type OrganisationDetails } from '@soirely/domain';

import type { Picked } from '../../components/OrganisationPicker.tsx';
import type { CardSaid } from '../../kit/organisationSave.ts';
import { writtenTime } from '../clock.ts';
import { SAMPLE } from '../samples.ts';
import { ASKING, type HandoverStart } from './MembersSample.ts';
import { DETAILS_WORDS, DOMAIN_WORDS } from './OrganisationWords.ts';
import { MEMBERS } from './sample.ts';

/** The starting states a link can open: /demo/settings/organisation?state=delete. */
export const ORGANISATION_STATES = [
  'edit',
  'contactError',
  'currencyBlank',
  'currency',
  'language',
  'saved',
  'addDomain',
  'removeDomain',
  'cardsLoading',
  'replaceLink',
  'linkOff',
  'transfer',
  'transferred',
  'onlyOwner',
  'leave',
  'leaveMenu',
  'leavePicked',
  'leaveSending',
  'leaveFailed',
  'leaveNoWork',
  'leaveOne',
  'leaveLoading',
  'leaveLoadFailed',
  'delete',
  'domainBoth',
] as const;

export type OrganisationState = (typeof ORGANISATION_STATES)[number];

export function organisationStateOf(name: string | undefined): OrganisationState | null {
  return ORGANISATION_STATES.find((state) => state === name) ?? null;
}

export interface OrganisationStart {
  role: string;
  said: CardSaid | null;
  screen: 'details' | 'addDomain' | 'transfer' | 'delete' | null;
  picking: Picked | null;
  contactWrong: boolean;
  /** Its currency never chosen (sc-909), Save refused with "Choose a currency.". */
  currencyBlank: boolean;
  ask: 'removeDomain' | 'replaceLink' | 'leave' | 'onlyOwner' | null;
  domainsLoading: boolean;
  link: 'on' | 'turnedOff' | 'failed';
  transferPicked: boolean;
  deleteMistyped: boolean;
  /** Joining's domains also proved in Email domains (sc-560), which carry the Proved tag. */
  proved: readonly string[];
  /** Leave's handover (sc-614): where its Ask opens, and whether the one leaving leads anything in this state's sample. */
  leaving: HandoverStart | null;
  leadsAny: boolean;
  /** The one leaving leads a single event: Leave's words for 1. */
  leadsOne: boolean;
}

/** Leave's states, as Ana Souza: the Ask with her two events, or today's when she leads none. */
export const LEAVE_STATES: readonly OrganisationState[] = [
  'leave',
  'leaveMenu',
  'leavePicked',
  'leaveSending',
  'leaveFailed',
  'leaveNoWork',
  'leaveOne',
  'leaveLoading',
  'leaveLoadFailed',
];

const JULIEN = 'julien@ire.events';

function leavingStart(state: OrganisationState): HandoverStart {
  switch (state) {
    case 'leaveMenu':
      return { ...ASKING, menu: true };
    case 'leavePicked':
      return { ...ASKING, taker: JULIEN };
    case 'leaveSending':
      return { ...ASKING, phase: 'sending' };
    case 'leaveFailed':
      return { ...ASKING, phase: 'failed' };
    case 'leaveLoading':
      return { ...ASKING, phase: 'checking' };
    case 'leaveLoadFailed':
      return { ...ASKING, phase: 'notLoaded' };
    default:
      return ASKING;
  }
}

export const TRANSFERRED_TO = 'Priya Shah';

const AT_REST: Omit<OrganisationStart, 'role'> = {
  said: null,
  screen: null,
  picking: null,
  contactWrong: false,
  currencyBlank: false,
  ask: null,
  domainsLoading: false,
  link: 'on',
  transferPicked: false,
  deleteMistyped: false,
  proved: [],
  leaving: null,
  leadsAny: true,
  leadsOne: false,
};

/** What a state link opens on; an owner's states open on the page at rest for a member, who has no way to them. */
export function organisationStart(
  state: OrganisationState | null,
  role: string,
): OrganisationStart {
  const page = { ...AT_REST, role };
  if (state === 'onlyOwner' || (state != null && LEAVE_STATES.includes(state)))
    return role === 'Owner'
      ? { ...page, ask: 'onlyOwner' }
      : {
          ...page,
          ask: 'leave',
          leaving: leavingStart(state),
          leadsAny: state !== 'leaveNoWork',
          leadsOne: state === 'leaveOne',
        };
  if (role !== 'Owner' || state == null) return page;

  switch (state) {
    case 'edit':
    case 'contactError':
    case 'currencyBlank':
    case 'currency':
    case 'language':
      return {
        ...page,
        screen: 'details',
        contactWrong: state === 'contactError',
        currencyBlank: state === 'currencyBlank',
        picking: state === 'currency' ? 'currency' : state === 'language' ? 'locale' : null,
      };
    case 'saved':
      return { ...page, said: { kind: 'saved', words: DETAILS_WORDS.saved } };
    case 'addDomain':
      return { ...page, screen: 'addDomain' };
    case 'removeDomain':
    case 'replaceLink':
      return { ...page, ask: state };
    case 'cardsLoading':
      return { ...page, domainsLoading: true, link: 'failed' };
    case 'linkOff':
      return { ...page, link: 'turnedOff' };
    case 'leave':
    case 'leaveMenu':
    case 'leavePicked':
    case 'leaveSending':
    case 'leaveFailed':
    case 'leaveNoWork':
    case 'leaveOne':
    case 'leaveLoading':
    case 'leaveLoadFailed':
      return page;
    case 'transfer':
      return { ...page, screen: 'transfer', transferPicked: true };
    case 'transferred':
      return { ...page, role: 'Admin', said: { kind: 'transferred', to: TRANSFERRED_TO } };
    case 'delete':
      return { ...page, screen: 'delete', deleteMistyped: true };
    case 'domainBoth':
      return { ...page, proved: [YOUR_DOMAIN] };
  }
}

export const SEND_MS = 500;
export const LOADING_MS = 8000;
export const RETRY_MS = 1500;

/** Ire Events' details, as the board drew them; the contact is at the demo's own domain. */
export const SAMPLE_DETAILS: OrganisationDetails = {
  name: SAMPLE.organisation,
  countryCode: 'NG',
  contactAddress: 'hello@ire.events',
  currency: 'NGN',
  timezone: 'Africa/Lagos',
  locale: 'en',
};

export const MALFORMED_CONTACT = 'hello@ireevents';

export const DOMAINS_MOST = 5;
export const YOUR_DOMAIN = domainOf(SAMPLE.email) ?? 'ire.events';

/** Free mail domains, refused as the API refuses them: nobody owns gmail.com. */
const PUBLIC_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'yahoo.com',
  'icloud.com',
  'me.com',
  'aol.com',
  'proton.me',
  'protonmail.com',
  'gmx.com',
  'mail.com',
  'yandex.com',
  'zoho.com',
]);

/** What the API refuses once it is sent: a full list, a domain listed already, a public one, one that is not yours. */
export function domainRefusal(typed: string, listed: readonly string[]): string | null {
  const domain = normaliseDomain(typed);

  if (listed.length >= DOMAINS_MOST) return DOMAIN_WORDS.full(DOMAINS_MOST);
  if (listed.includes(domain)) return DOMAIN_WORDS.listed(domain);
  if (PUBLIC_DOMAINS.has(domain)) return DOMAIN_WORDS.publicDomain;
  if (domain !== YOUR_DOMAIN) return DOMAIN_WORDS.notYours;

  return null;
}

export const CANDIDATES = MEMBERS.filter(
  (member) => member.status === 'active' && member.role != null && member.role !== 'Owner',
).map((member) => ({ name: member.name, initials: member.initials, role: member.role ?? '' }));

export const DELETE_COUNTS = { events: 4, guests: 512, members: 8 } as const;
export const RESTORE_DAYS = 30;

/** Thirty days on in Lagos, the day in the locale's order and the time as the API writes it, `H:i`: Friday, Dec 4 at 10:15 WAT. */
export function restoreDeadline(now: Date, locale: string): string {
  const zone = SAMPLE_DETAILS.timezone;
  const at = new Date(now.getTime() + RESTORE_DAYS * 24 * 60 * 60 * 1000);
  const day = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    timeZone: zone,
  });
  return `${day.format(at)} at ${writtenTime(at, locale, zone)} WAT`;
}

const LINK_KEYS = ['7f3k9q', 'm2w8xd', 'q9h4tz', 'c6r1vb', 'x3n7pk'] as const;

export function requestLink(made: number): string {
  return `https://soirely.app/join/r/${LINK_KEYS[made % LINK_KEYS.length]}`;
}
