import {
  companyDomainProblem,
  domainOf,
  normaliseDomain,
  type OrganisationDetails,
  type OrganisationField,
  organisationProblem,
} from '@soirely/domain';

import { SAMPLE } from '../samples.ts';
import { clockTime } from './NotificationsModel.ts';
import { DETAILS_WORDS, DOMAIN_WORDS, OWNERSHIP_WORDS } from './OrganisationWords.ts';
import { MEMBERS } from './sample.ts';

/** The starting states a link can open: /demo/settings/organisation?state=delete. */
export const ORGANISATION_STATES = [
  'contactError',
  'saved',
  'cardsLoading',
  'onlyOwner',
  'removeDomain',
  'delete',
  'transfer',
  'currency',
  'language',
] as const;

export type OrganisationState = (typeof ORGANISATION_STATES)[number];

export function organisationStateOf(name: string | undefined): OrganisationState | null {
  return ORGANISATION_STATES.find((state) => state === name) ?? null;
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

export function detailProblem(field: OrganisationField, value: string): string | null {
  const problem = organisationProblem(field, value);

  return problem == null ? null : DETAILS_WORDS[problem];
}

export const LANGUAGE_IN_SENTENCE: Record<string, string> = {
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  pt: 'Portuguese',
};

export function savedWords(locale: string, savedLocale: string): string {
  return locale === savedLocale
    ? DETAILS_WORDS.saved
    : DETAILS_WORDS.savedLanguage(LANGUAGE_IN_SENTENCE[locale] ?? locale);
}

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

export function domainProblem(typed: string): string | null {
  const problem = companyDomainProblem(typed);

  if (problem == null) return null;

  return problem === 'blank' ? DOMAIN_WORDS.blank(YOUR_DOMAIN) : DOMAIN_WORDS.shape(YOUR_DOMAIN);
}

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
).map((member) => ({ name: member.name, role: member.role ?? '' }));

export type TransferField = 'owner' | 'password';

export function transferProblems(
  owner: string | null,
  password: string,
): Partial<Record<TransferField, string>> {
  return {
    ...(owner == null && { owner: OWNERSHIP_WORDS.ownerBlank }),
    ...(password === '' && { password: OWNERSHIP_WORDS.passwordBlank }),
  };
}

export function passwordRefused(password: string): string | null {
  return password === SAMPLE.password ? null : OWNERSHIP_WORDS.passwordWrong;
}

export const DELETE_COUNTS = { events: 4, guests: 512, members: 8 } as const;
export const RESTORE_DAYS = 30;

const NOUNS = {
  events: ['event', 'events'],
  guests: ['guest', 'guests'],
  members: ['member', 'members'],
} as const;

export function countsLine(
  locale: string,
  counts: Record<keyof typeof NOUNS, number> = DELETE_COUNTS,
): string {
  const plural = new Intl.PluralRules(locale);
  const number = new Intl.NumberFormat(locale);
  const each = (kind: keyof typeof NOUNS) => {
    const count = counts[kind];
    const [one, other] = NOUNS[kind];

    return `${number.format(count)} ${plural.select(count) === 'one' ? one : other}`;
  };

  return `${each('events')}, ${each('guests')} and ${each('members')} are deleted with it.`;
}

/** Thirty days on, in Lagos and the reader's clock, named WAT as the server names a zone: Friday, Dec 4 at 10:15 AM WAT. */
export function restoreDeadline(now: Date, locale: string): string {
  const zone = SAMPLE_DETAILS.timezone;
  const at = new Date(now.getTime() + RESTORE_DAYS * 24 * 60 * 60 * 1000);
  const day = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    timeZone: zone,
  });
  const time = clockTime(locale, { timeZone: zone });

  return `${day.format(at)} at ${time.format(at)} WAT`;
}

export function deleteBody(now: Date, locale: string): string {
  return `${countsLine(locale)} ${OWNERSHIP_WORDS.deleteWindow(restoreDeadline(now, locale))}`;
}

const LINK_KEYS = ['7f3k9q', 'm2w8xd', 'q9h4tz', 'c6r1vb', 'x3n7pk'] as const;

export function requestLink(made: number): string {
  return `https://soirely.app/join/r/${LINK_KEYS[made % LINK_KEYS.length]}`;
}
