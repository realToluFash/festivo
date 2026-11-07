import {
  type OrganisationDetails,
  type OrganisationField,
  ORGANISATION_FIELDS,
  companyDomainProblem,
  countryChoices,
  currencyChoices,
  domainOf,
  languageChoices,
  normaliseDomain,
  organisationChanges,
  organisationProblem,
  timezoneLabel,
  typedNameMatches,
  withCurrent,
} from '@soirely/domain';

import { DOMAIN, ORGANISATION as ORG, samplePeople } from './members.ts';
import { SAMPLE } from './rules.ts';
import { type DemoLink, VIEWERS, type Viewer, settingsPath } from './settings.ts';
import { type Role, roleOf } from './signInRules.ts';

export const DETAILS_WORDS = {
  details: 'Details',
  edit: 'Edit details',
  editTitle: 'Organisation details',
  name: 'Name',
  countryCode: 'Country',
  contactAddress: 'Contact address',
  currency: 'Currency',
  timezone: 'Time zone',
  locale: 'Language for invitations',
  defaults: 'Defaults for new events',
  invitations: 'Invitations',
  defaultsNote:
    'Currency and time zone: new events start with these. Events you already have keep theirs.',
  languageHint:
    'Invitation emails to people without a Soirely account are written in this language. People who already have an account get theirs in their own language.',
  save: 'Save',
  saving: 'Saving…',
  savedSays: 'Saved',
  saved: `Saved. Everyone in ${ORG} sees the new details on their next screen.`,
  savedLanguage: (language: string) =>
    `Saved. Invitation emails to people without a Soirely account go out in ${language} from now on. Invitations already sent are not sent again.`,
  discardLine: `${ORG} stays as it was.`,
  nameBlank: "Enter the organisation's name.",
  currencyBlank: 'Choose a currency.',
  contactBlank: 'Enter a contact email address.',
  contactInvalid: 'That does not look like an email address. Check it has an @ and a domain.',
  currencyRetired: (code: string) => `${code} (no longer in use)`,
  readOnly: (role: Role) =>
    `Your role, ${role}, can see these but not change them. Owners and admins can.`,
} as const;

export const DOMAIN_WORDS = {
  title: 'Company domain joining',
  lead: `People whose main email address is at a domain on this list can ask to join ${ORG} when they sign up. Somebody who can manage members answers each one.`,
  off: 'Off',
  offUntil: 'It is off until you add a domain.',
  working: 'People at it can ask to join',
  stopped: 'Stopped',
  stoppedBody: (domain: string) =>
    `Another organisation has proved ${domain} on Enterprise, so its listing is the only one that works. Remove ${domain} from this list.`,
  remove: 'Remove…',
  removeLabel: (domain: string) => `Remove ${domain}`,
  removeTitle: (domain: string) => `Remove ${domain}?`,
  removeBody: (domain: string) => `People at ${domain} can no longer ask to join this way.`,
  keep: 'Keep it',
  confirmRemove: 'Remove',
  add: 'Add domain',
  addTitle: 'Add a domain',
  addVerb: 'Add',
  field: 'Domain',
  help: (email: string, most: number) =>
    `Only a domain your own address is at. Yours is ${email}. Up to ${most} domains.`,
  full: (most: number) =>
    `That is ${most} domains, the most the list can hold. Remove one to add another.`,
  blank: (example: string) => `Enter a domain, like ${example}.`,
  shape: (example: string) => `Enter a domain with a dot and no spaces, like ${example}.`,
  listed: (domain: string) => `${domain} is already on the list.`,
  publicDomain: 'You cannot use a public email domain.',
  notYours: 'Add a domain your own address is at.',
  added: 'Added. People whose main email address is at it can now ask to join.',
  removed: (domain: string) => `${domain} removed.`,
} as const;

export const LINK_WORDS = {
  title: 'Requests to join',
  lead: `Anybody with this link can ask to join ${ORG}. Somebody who can manage members answers each request.`,
  linkLabel: 'Request link',
  copy: 'Copy link',
  help: 'Share it with the people you want to hear from. There is no list of organisations to find you in.',
  replace: 'Replace link…',
  replaceTitle: 'Replace the link?',
  replaceBody: 'This link stops working as soon as you replace it.',
  replaceConfirm: 'Replace link',
  keep: 'Keep it',
  on: 'The request link is on.',
  off: 'The request link is off. It will not work again: turning it on makes a new one.',
  replaced: 'The link is replaced. The old one no longer works.',
  copied: 'Link copied.',
  unreadable: 'The request link could not be loaded.',
} as const;

export const OWNERSHIP_WORDS = {
  title: 'Ownership and leaving',
  transfer: 'Transfer ownership',
  transferVerb: 'Transfer',
  transferNote: `Hand ${ORG} to another member. Asks for your password first.`,
  transferBody: `The new owner can change billing, members, roles and these settings, and can delete ${ORG}. You become an Admin.`,
  newOwner: 'New owner',
  ownerBlank: 'Choose who becomes the owner.',
  password: 'Your password',
  passwordBlank: 'Enter your password.',
  passwordWrong: 'That is not your password. Nothing was changed. Try again, or reset it by email.',
  passwordWhy: `So that nobody who picks up this device can give ${ORG} away.`,
  code: 'Code',
  codeHelp: 'From your authenticator app, or one of your recovery codes.',
  codeBlank: 'Enter a code from your app, or a recovery code.',
  codeWrong: 'That code did not work. Check your app and try again.',
  bothEmailed: (name: string) => `You and ${name} each get an email saying it happened.`,
  theNewOwner: 'the new owner',
  transferred: (name: string) => `${name} is now the owner`,
  transferredLine: 'You are an Admin. You both have an email saying so.',
  leave: `Leave ${ORG}`,
  leaveOpener: `Leave ${ORG}…`,
  leaveNote: `You lose access to its events. Everything you made stays with ${ORG}.`,
  leaveTitle: `Leave ${ORG}?`,
  leaveBody: `You lose access to ${ORG} as soon as you leave.`,
  stay: 'Stay',
  onlyOwnerTitle: 'You are the only owner',
  onlyOwnerBody: 'Make somebody else an owner, then you can leave.',
  deleteOpener: 'Delete organisation…',
  deleteNote: 'Deletes every event, guest and member record in it.',
  deleteTitle: `Delete ${ORG}`,
  deleteVerb: 'Delete',
  deleteWarningTitle: 'Everything in it goes',
  deleteWindow: (deadline: string) =>
    `This deletes it for everybody now. Soirely support can restore it until ${deadline}; after that it is gone for good.`,
  deleteCounting: 'Counting what it holds…',
  deleteUncounted:
    'We could not count what it holds. Deleting it still deletes every event, guest and member in it, for everybody, now. Soirely support can restore it for 30 days.',
  deleteType: `Type ${ORG} to confirm`,
  deleteMismatch: `Type ${ORG} exactly as shown to delete it.`,
  deleteMatches: 'That matches.',
  deleteExactly: 'Exactly as it is written, accents included.',
} as const;

export const TRY_AGAIN = 'Try again';
export const LOADING = 'Loading…';

export type Hold = 'twoFactor' | 'linking';

/** What keeps an admin's changes back, as the product's readOnlyUntil lines say it, and the one step that ends it. */
export const HOLDS: Record<Hold, { line: string; step: string }> = {
  twoFactor: {
    line: `${ORG} asks owners and admins to use two-factor. Until you turn it on, you can see these but not change them.`,
    step: 'Turn on two-factor',
  },
  linking: {
    line: `${ORG} signs in with Google or Apple only. Until you link one, you can see these but not change them.`,
    step: 'Link Google or Apple',
  },
};

export const GENERAL_STATES = [
  'edit',
  'contactError',
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
  'delete',
  'heldTwoFactor',
  'heldLinked',
  'domainStopped',
  'deleteUncounted',
] as const;

export type GeneralState = (typeof GENERAL_STATES)[number];

export function generalStateOf(name: string): GeneralState | null {
  return GENERAL_STATES.find((state) => state === name) ?? null;
}

export type Picked = Exclude<OrganisationField, 'name' | 'contactAddress'>;
export type Typed = 'name' | 'contactAddress';
export type CardSaid = { kind: 'saved'; words: string } | { kind: 'transferred'; to: string };

export interface Domain {
  name: string;
  stopped: boolean;
}

export interface GeneralStart {
  role: Role;
  hold: Hold | null;
  said: CardSaid | null;
  dialog: 'details' | 'addDomain' | 'transfer' | 'delete' | null;
  picking: Picked | null;
  contactWrong: boolean;
  ask: 'removeDomain' | 'replaceLink' | 'leave' | 'onlyOwner' | null;
  domains: Domain[];
  domainsLoading: boolean;
  link: 'on' | 'turnedOff' | 'failed';
  transferPicked: boolean;
  deleteMistyped: boolean;
  counted: boolean;
}

export const TRANSFERRED_TO = 'Priya Shah';
export const YOUR_DOMAIN = domainOf(SAMPLE.email) ?? DOMAIN;

const AT_REST: Omit<GeneralStart, 'role'> = {
  hold: null,
  said: null,
  dialog: null,
  picking: null,
  contactWrong: false,
  ask: null,
  domains: [{ name: YOUR_DOMAIN, stopped: false }],
  domainsLoading: false,
  link: 'on',
  transferPicked: false,
  deleteMistyped: false,
  counted: true,
};

/** What a state link opens on: one the viewer has no way to opens the page at rest, as the app's Organisation does. */
export function generalStart(
  state: string,
  viewer: Pick<Viewer, 'owns' | 'manages'>,
): GeneralStart {
  const role = roleOf(viewer);
  const page: GeneralStart = { ...AT_REST, role };
  const name = generalStateOf(state);
  const owner = role === 'Owner';

  if (name === 'onlyOwner') return owner ? { ...page, ask: 'onlyOwner' } : page;
  if (name === 'leave') return { ...page, ask: owner ? 'onlyOwner' : 'leave' };
  if (name === 'heldTwoFactor' || name === 'heldLinked')
    return role === 'Admin'
      ? { ...page, hold: name === 'heldTwoFactor' ? 'twoFactor' : 'linking' }
      : page;
  if (name == null || role === 'Member') return page;

  switch (name) {
    case 'edit':
    case 'contactError':
    case 'currency':
    case 'language':
      return {
        ...page,
        dialog: 'details',
        contactWrong: name === 'contactError',
        picking: name === 'currency' ? 'currency' : name === 'language' ? 'locale' : null,
      };
    case 'saved':
      return { ...page, said: { kind: 'saved', words: DETAILS_WORDS.saved } };
    case 'addDomain':
      return { ...page, dialog: 'addDomain' };
    case 'removeDomain':
    case 'replaceLink':
      return { ...page, ask: name };
    case 'cardsLoading':
      return { ...page, domainsLoading: true, link: 'failed' };
    case 'linkOff':
      return { ...page, link: 'turnedOff' };
    case 'domainStopped':
      return { ...page, domains: [{ name: YOUR_DOMAIN, stopped: true }] };
    case 'transfer':
      return owner ? { ...page, dialog: 'transfer', transferPicked: true } : page;
    case 'transferred':
      return owner
        ? { ...page, role: 'Admin', said: { kind: 'transferred', to: TRANSFERRED_TO } }
        : page;
    case 'delete':
    case 'deleteUncounted':
      return owner
        ? {
            ...page,
            dialog: 'delete',
            deleteMistyped: name === 'delete',
            counted: name === 'delete',
          }
        : page;
  }
}

export interface CardWords {
  says: string;
  line: string;
  said: boolean;
  lock: string | null;
  step: string | null;
}

export function cardWords(
  details: OrganisationDetails,
  said: CardSaid | null,
  role: Role,
  hold: Hold | null,
): CardWords {
  const lock =
    hold != null ? HOLDS[hold].line : role === 'Member' ? DETAILS_WORDS.readOnly(role) : null;
  const step = hold != null ? HOLDS[hold].step : role === 'Member' ? null : DETAILS_WORDS.edit;
  const words =
    said == null
      ? { says: details.name, line: details.contactAddress }
      : said.kind === 'saved'
        ? { says: DETAILS_WORDS.savedSays, line: said.words }
        : { says: OWNERSHIP_WORDS.transferred(said.to), line: OWNERSHIP_WORDS.transferredLine };

  return { ...words, said: said != null, lock, step };
}

export function changesThings(role: Role, hold: Hold | null): boolean {
  return role !== 'Member' && hold == null;
}

export type OwnershipStep = 'transfer' | 'leave' | 'delete';

export function ownershipSteps(role: Role): OwnershipStep[] {
  return role === 'Owner' ? ['transfer', 'leave', 'delete'] : ['leave'];
}

export const SEND_MS = 500;
export const LOADING_MS = 8000;
export const RETRY_MS = 1500;

export const SAMPLE_DETAILS: OrganisationDetails = {
  name: ORG,
  countryCode: 'NG',
  contactAddress: 'hello@ire.events',
  currency: 'NGN',
  timezone: 'Africa/Lagos',
  locale: 'en',
};

export const MALFORMED_CONTACT = 'hello@ireevents';

const SHOWN_IN = 'en';

export const LANGUAGE_NAMES: Record<string, string> = {
  'languageNames.en': 'English',
  'languageNames.es': 'Spanish',
  'languageNames.fr': 'French',
  'languageNames.pt': 'Portuguese',
};

const LANGUAGE_IN_SENTENCE: Record<string, string> = {
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  pt: 'Portuguese',
};

export interface Choice {
  code: string;
  name: string;
}

let made: Record<Picked, readonly Choice[]> | null = null;

export function choicesOf(field: Picked): readonly Choice[] {
  made ??= {
    countryCode: countryChoices(SHOWN_IN),
    currency: currencyChoices(SAMPLE_DETAILS.currency, SHOWN_IN, DETAILS_WORDS.currencyRetired),
    timezone: withCurrent(Intl.supportedValuesOf('timeZone'), SAMPLE_DETAILS.timezone).map(
      (zone) => ({ code: zone, name: timezoneLabel(zone) }),
    ),
    locale: languageChoices((key) => LANGUAGE_NAMES[key] ?? key),
  };

  return made[field];
}

export function choiceName(field: Picked, code: string): string {
  return choicesOf(field).find((choice) => choice.code === code)?.name ?? code;
}

export const PICKERS: Record<Picked, { search: string }> = {
  countryCode: { search: 'Search countries' },
  currency: { search: 'Search currencies' },
  timezone: { search: 'Search time zones' },
  locale: { search: 'Search languages' },
};

export function shownChoices(field: Picked, needle: string): readonly Choice[] {
  const wanted = needle.trim().toLocaleLowerCase(SHOWN_IN);

  return wanted === ''
    ? choicesOf(field)
    : choicesOf(field).filter((choice) => choice.name.toLocaleLowerCase(SHOWN_IN).includes(wanted));
}

export function detailProblem(field: OrganisationField, value: string): string | null {
  const problem = organisationProblem(field, value);

  return problem == null ? null : DETAILS_WORDS[problem];
}

export function detailProblems(
  values: OrganisationDetails,
): Partial<Record<OrganisationField, string>> {
  return Object.fromEntries(
    ORGANISATION_FIELDS.flatMap((field) => {
      const problem = detailProblem(field, values[field]);

      return problem == null ? [] : [[field, problem]];
    }),
  );
}

export function changeCount(saved: OrganisationDetails, values: OrganisationDetails): number {
  return Object.keys(organisationChanges(saved, values)).length;
}

export function savedWords(locale: string, savedLocale: string): string {
  return locale === savedLocale
    ? DETAILS_WORDS.saved
    : DETAILS_WORDS.savedLanguage(LANGUAGE_IN_SENTENCE[locale] ?? locale);
}

export function discardTitle(changes: number): string {
  return changes > 1 ? 'Discard your changes?' : 'Discard your change?';
}

export const DOMAINS_MOST = 5;

export function domainsFoot(listed: number): string {
  return listed >= DOMAINS_MOST
    ? `${DOMAIN_WORDS.lead} ${DOMAIN_WORDS.full(DOMAINS_MOST)}`
    : DOMAIN_WORDS.lead;
}

export function domainLine(domain: Domain, added: string | null): string {
  if (domain.stopped) return DOMAIN_WORDS.stoppedBody(domain.name);

  return domain.name === added ? DOMAIN_WORDS.added : DOMAIN_WORDS.working;
}

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
export function domainRefusal(typed: string, listed: readonly Domain[]): string | null {
  const domain = normaliseDomain(typed);

  if (listed.length >= DOMAINS_MOST) return DOMAIN_WORDS.full(DOMAINS_MOST);
  if (listed.some((one) => one.name === domain)) return DOMAIN_WORDS.listed(domain);
  if (PUBLIC_DOMAINS.has(domain)) return DOMAIN_WORDS.publicDomain;
  if (domain !== YOUR_DOMAIN) return DOMAIN_WORDS.notYours;

  return null;
}

const LINK_KEYS = ['7f3k9q', 'm2w8xd', 'q9h4tz', 'c6r1vb', 'x3n7pk'] as const;

export function requestLink(made: number): string {
  return `https://soirely.app/join/r/${LINK_KEYS[made % LINK_KEYS.length]}`;
}

/** sc-29859's three words for the sample's roles: Administrator is an Admin, every other role a Member. */
function threeRoles(role: string): Role {
  return role === 'Owner'
    ? 'Owner'
    : role === 'Admin' || role === 'Administrator'
      ? 'Admin'
      : 'Member';
}

export interface Candidate {
  name: string;
  role: Role;
}

export const CANDIDATES: readonly Candidate[] = samplePeople()
  .filter((person) => person.status === 'active' && person.role != null && person.role !== 'Owner')
  .map((person) => ({ name: person.name, role: threeRoles(person.role ?? '') }));

export type TransferField = 'owner' | 'password' | 'code';
export type TransferProblems = Partial<Record<TransferField, string>>;

export function transferProblems(
  owner: string | null,
  password: string,
  code: string,
): TransferProblems {
  return {
    ...(owner == null && { owner: OWNERSHIP_WORDS.ownerBlank }),
    ...(password === '' && { password: OWNERSHIP_WORDS.passwordBlank }),
    ...(code.trim() === '' && { code: OWNERSHIP_WORDS.codeBlank }),
  };
}

export function transferRefusal(password: string, code: string): TransferProblems {
  const typed = code.replaceAll(/\s/gu, '').toLowerCase();

  if (password !== SAMPLE.password) return { password: OWNERSHIP_WORDS.passwordWrong };
  if (typed !== SAMPLE.authenticator && typed !== SAMPLE.recovery)
    return { code: OWNERSHIP_WORDS.codeWrong };

  return {};
}

export const DELETE_COUNTS = { events: 4, guests: 512, members: 8 } as const;
export const RESTORE_DAYS = 30;
export const MISTYPED = 'Ire events';

const NOUNS = {
  events: ['event', 'events'],
  guests: ['guest', 'guests'],
  members: ['member', 'members'],
} as const;

export function countsLine(locale: string): string {
  const plural = new Intl.PluralRules(locale);
  const number = new Intl.NumberFormat(locale);
  const each = (kind: keyof typeof NOUNS) => {
    const count = DELETE_COUNTS[kind];
    const [one, other] = NOUNS[kind];

    return `${number.format(count)} ${plural.select(count) === 'one' ? one : other}`;
  };

  return `${each('events')}, ${each('guests')} and ${each('members')} are deleted with it.`;
}

/** Thirty days on, on the clock in Lagos, named WAT as the server names a zone: Friday, Dec 4 at 10:15 AM WAT. */
export function restoreDeadline(now: Date, locale: string): string {
  const timeZone = SAMPLE_DETAILS.timezone;
  const at = new Date(now.getTime() + RESTORE_DAYS * 24 * 60 * 60 * 1000);
  const day = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    timeZone,
  });
  const time = new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit', timeZone });

  return `${day.format(at)} at ${time.format(at)} WAT`;
}

export function deleteBody(now: Date, locale: string): string {
  return `${countsLine(locale)} ${OWNERSHIP_WORDS.deleteWindow(restoreDeadline(now, locale))}`;
}

export function nameMatches(typed: string): boolean {
  return typedNameMatches(typed, ORG);
}

function general(
  state: string | undefined,
  name: string,
  viewer: Viewer = VIEWERS.folake,
): DemoLink {
  return { to: settingsPath('general', viewer, state), name };
}

export const GENERAL_PAGES: readonly { name: string; states: readonly DemoLink[] }[] = [
  {
    name: 'The page',
    states: [
      general(undefined, 'Owner'),
      general(undefined, 'Admin, no transfer or delete', VIEWERS.julien),
      general(undefined, 'Member, read only', VIEWERS.ana),
      general('heldTwoFactor', 'Admin, held until two-factor', VIEWERS.julien),
      general('heldLinked', 'Admin, held until Google or Apple', VIEWERS.julien),
    ],
  },
  {
    name: 'Editing the details',
    states: [
      general('edit', 'Organisation details'),
      general('contactError', 'After Save, the contact address'),
      general('currency', 'The currency list'),
      general('language', 'The language list'),
      general('saved', 'Saved'),
    ],
  },
  {
    name: 'Joining',
    states: [
      general('addDomain', 'Add a domain'),
      general('removeDomain', 'Remove ire.events'),
      general('domainStopped', 'A domain stopped'),
      general('cardsLoading', 'Domains loading, the link not loaded'),
      general('replaceLink', 'Replace the link'),
      general('linkOff', 'The link turned off'),
    ],
  },
  {
    name: 'Ownership and leaving',
    states: [
      general('transfer', 'Transfer ownership'),
      general('transferred', 'Transferred'),
      general('onlyOwner', 'Leave, the only owner'),
      general('leave', 'Leave, a member', VIEWERS.ana),
      general('leave', 'Leave, an admin', VIEWERS.julien),
      general('delete', 'Delete, the name mistyped'),
      general('deleteUncounted', 'Delete, not counted'),
    ],
  },
];
