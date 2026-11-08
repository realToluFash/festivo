import {
  countryChoices,
  currencyLabel,
  deviceCountry,
  formatTimeOfDay,
  newOrganisationProblem,
  timezoneLabel,
} from '@soirely/domain';

import { SAMPLE } from './rules.ts';
import type { DemoLink } from './settings.ts';

export const CREATE_STATES = [
  'name',
  'typing',
  'name-blank',
  'name-long',
  'name-refused',
  'back-name',
  'country',
  'country-list',
  'country-search',
  'country-nomatch',
  'country-picked',
  'country-none',
  'back-country',
  'ready',
  'creating',
  'limited',
  'failed',
  'discard',
  'created',
  'managed',
] as const;

export type CreateState = (typeof CREATE_STATES)[number];
export type Step = 1 | 2 | 3;
export type Answer = 'limited' | 'failed';
/** Where focus lands as a state opens: `option` is the pick's row, in the device's group unless `inList`. */
export type Landing = 'field' | 'question' | 'option' | 'search' | 'create' | 'dialog';

export interface Country {
  code: string;
  name: string;
  /** As `currencyLabel` names it, or null for a country with none. */
  currency: string | null;
}

export interface Walk {
  step: Step;
  name: string;
  device: string | null;
  country: string | null;
  query: string;
  nameRefused: string | null;
  countryRefused: boolean;
  answer: Answer | null;
  creating: boolean;
  asking: boolean;
  landing: Landing;
  inList: boolean;
  /** An account its home organisation manages (sc-563): the refusal in the first step's place. */
  managed: boolean;
}

export const NEW_ORG = { id: 'org-lumen-feiras-pt', name: 'Lumen Feiras' } as const;
export const LONG_NAME =
  'Lumen Feiras, Congressos e Celebrações de Lisboa, do Porto e do Algarve para Empresas, Famílias, Escolas e Associações';
export const DEVICE_LANGUAGES = ['pt-PT'] as const;
export const NO_COUNTRY_LANGUAGES: readonly string[] = [];
export const DEVICE_ZONE = 'Europe/Lisbon';
export const LIMIT_LIFTS = new Date(2026, 10, 3, 10, 41);
export const NAME_SHRINKS_FROM = 40;

// What Regions::currencyOf gave on the API on 7 Nov 2026; Antarctica has none.
const CURRENCIES: Readonly<Record<string, string | null>> = {
  AF: 'AFN',
  AX: 'EUR',
  AL: 'ALL',
  DZ: 'DZD',
  AS: 'USD',
  AD: 'EUR',
  AQ: null,
  BW: 'BWP',
  BV: 'NOK',
  BR: 'BRL',
  IO: 'USD',
  VG: 'USD',
  CG: 'XAF',
  GI: 'GIP',
  PE: 'PEN',
  PH: 'PHP',
  PN: 'NZD',
  PL: 'PLN',
  PT: 'EUR',
  PR: 'USD',
  QA: 'QAR',
  RE: 'EUR',
  RO: 'RON',
  SG: 'SGD',
};

export const CREATE_WORDS = {
  title: 'Create an organisation',
  questions: { 1: 'What’s it called?', 2: 'Where is it based?', 3: 'Ready to create it?' },
  name: 'Organisation name',
  nameHelp: 'Your team and guests see this name. You can rename it later.',
  chooseCountry: 'Choose a country.',
  search: 'Search countries',
  clear: 'Clear search',
  country: 'Country',
  currency: 'Currency',
  timezone: 'Time zone',
  contact: 'Contact address',
  fromDevice: 'From this device',
  allCountries: 'All countries',
  noCurrency: 'None yet',
  yourRole: 'Your role · Owner',
  intro: 'You will be its owner. Your other organisations stay as they are.',
  limitedTitle: 'Too many new organisations for now.',
  failed: 'Creating the organisation did not work. Nothing was created. Try again in a moment.',
  cancel: 'Cancel',
  close: 'Close',
  back: 'Back',
  continue: 'Continue',
  create: 'Create organisation',
  creating: 'Creating…',
  discardTitle: 'Discard this organisation?',
  discardBody: 'Nothing is created, and what you entered is not kept.',
  discard: 'Discard',
  keepEditing: 'Keep editing',
  stepOf: (step: Step) => `Step ${step} of 3`,
  noMatch: (text: string) => `No country matches “${text}”.`,
  defaults: (email: string) =>
    `The currency follows the country, the time zone comes from this device, and the contact address is your primary email, ${email}. You can change them in Settings > General.`,
  limitedBody: (time: string) => `Try again at ${time}.`,
};

export const NO_ORG_WORDS = {
  title: 'You are not in an organisation',
  body: 'Events, teams and plans all belong to an organisation, and you are not part of one right now. Your account is still yours, and nothing in it has gone.',
  wayOn: (email: string) => `Ask whoever runs yours to invite ${email} again.`,
  startTitle: 'Start your own',
  startBody: 'Set up a new organisation and you become its owner.',
  start: 'Start organisation',
  signedInAs: (email: string) => `Signed in as ${email}.`,
  account: 'Your account',
  signOut: 'Sign out',
  language: 'English',
};

export function isCreateState(name: string | null): name is CreateState {
  return CREATE_STATES.some((state) => state === name);
}

export function sampleCountries(locale = 'en'): readonly Country[] {
  return countryChoices(locale)
    .filter(({ code }) => Object.hasOwn(CURRENCIES, code))
    .map(({ code, name }) => {
      const currency = CURRENCIES[code] ?? null;

      return { code, name, currency: currency == null ? null : currencyLabel(currency, locale) };
    });
}

export function currencyWords(country: Country): string {
  return country.currency ?? CREATE_WORDS.noCurrency;
}

export function optionLabel(country: Country): string {
  return `${country.name}, ${currencyWords(country)}`;
}

export function zoneWords(): string {
  return timezoneLabel(DEVICE_ZONE);
}

/** main's ListPicker: a case-insensitive "includes" on the name. */
export function narrowed(
  countries: readonly Country[],
  query: string,
  locale = 'en',
): readonly Country[] {
  const needle = query.trim().toLocaleLowerCase(locale);

  return needle === ''
    ? countries
    : countries.filter((country) => country.name.toLocaleLowerCase(locale).includes(needle));
}

export function nameRefusal(name: string): string | null {
  const problem = newOrganisationProblem('name', name);

  if (problem == null) return null;
  if (problem.kind === 'nameLong')
    return `That name is ${new Intl.NumberFormat('en').format(problem.length)} characters. Use 100 or fewer.`;

  return "Enter the organisation's name.";
}

export function countryRefusal(country: string | null): string | null {
  return newOrganisationProblem('countryCode', country ?? '') == null
    ? null
    : CREATE_WORDS.chooseCountry;
}

/** Cancel asks first once a name is typed or the country is not the device's. */
export function entered(walk: Walk): boolean {
  return walk.name.trim() !== '' || walk.country !== walk.device;
}

export function shrinks(name: string): boolean {
  return Array.from(name.trim()).length >= NAME_SHRINKS_FROM;
}

export function limitedLine(locale: string): string {
  return CREATE_WORDS.limitedBody(formatTimeOfDay(LIMIT_LIFTS, locale));
}

export function cardLine(walk: Walk, countries: readonly Country[]): string {
  const country = countries.find((one) => one.code === walk.country);
  const facts =
    country == null
      ? []
      : [
          `${CREATE_WORDS.country}, ${country.name}.`,
          `${CREATE_WORDS.currency}, ${currencyWords(country)}.`,
          `${CREATE_WORDS.timezone}, ${zoneWords()}.`,
          `${CREATE_WORDS.contact}, ${SAMPLE.email}.`,
        ];

  return [`${walk.name.trim()}.`, `${CREATE_WORDS.yourRole}.`, ...facts].join(' ');
}

export function pickLine(country: Country): string {
  return `${CREATE_WORDS.currency}, ${currencyWords(country)}. ${CREATE_WORDS.timezone}, ${CREATE_WORDS.fromDevice.toLocaleLowerCase('en')}, ${zoneWords()}.`;
}

export function freshWalk(none = false): Walk {
  const device = deviceCountry(none ? NO_COUNTRY_LANGUAGES : DEVICE_LANGUAGES);

  return {
    step: 1,
    name: '',
    device,
    country: device,
    query: '',
    nameRefused: null,
    countryRefused: false,
    answer: null,
    creating: false,
    asking: false,
    landing: 'field',
    inList: false,
    managed: false,
  };
}

/** The walk a `?create=` state opens on; `created` is the landing, so no walk. */
export function walkOf(state: CreateState): Walk | null {
  const named = { ...freshWalk(), name: NEW_ORG.name };

  switch (state) {
    case 'name':
      return freshWalk();
    case 'typing':
      return named;
    case 'name-blank':
      return { ...freshWalk(), nameRefused: nameRefusal('') };
    case 'name-long':
      return { ...named, name: LONG_NAME, nameRefused: nameRefusal(LONG_NAME) };
    case 'name-refused':
      return { ...named, nameRefused: nameRefusal('') };
    case 'back-name':
      return { ...named, landing: 'question' };
    case 'country':
      return { ...named, step: 2, landing: 'option' };
    case 'country-list':
      return { ...named, step: 2, landing: 'option', inList: true };
    case 'country-search':
      return { ...named, step: 2, query: 'bra', landing: 'search' };
    case 'country-nomatch':
      return { ...named, step: 2, query: 'zzz', landing: 'search' };
    case 'country-picked':
      return { ...named, step: 2, query: 'bra', country: 'BR', landing: 'option', inList: true };
    case 'country-none':
      return {
        ...freshWalk(true),
        name: NEW_ORG.name,
        step: 2,
        countryRefused: true,
        landing: 'search',
      };
    case 'back-country':
      return { ...named, step: 2, country: 'BR', landing: 'question', inList: true };
    case 'ready':
      return { ...named, step: 3, landing: 'question' };
    case 'creating':
      return { ...named, step: 3, creating: true, landing: 'dialog' };
    case 'limited':
      return { ...named, step: 3, answer: 'limited', landing: 'create' };
    case 'failed':
      return { ...named, step: 3, answer: 'failed', landing: 'create' };
    case 'discard':
      return { ...named, asking: true };
    case 'created':
      return null;
    case 'managed':
      return { ...freshWalk(), managed: true, landing: 'dialog' };
  }
}

/** Continue checks only its own step; null means it may go on. */
export function stepRefused(walk: Walk): Pick<Walk, 'nameRefused' | 'countryRefused'> | null {
  if (walk.step === 1) {
    const refused = nameRefusal(walk.name);

    return refused == null ? null : { nameRefused: refused, countryRefused: false };
  }
  if (walk.step === 2 && countryRefusal(walk.country) != null)
    return { nameRefused: null, countryRefused: true };

  return null;
}

/** What pressing Create organisation answers in the demo: too many for now holds until 10:41. */
export function answerOf(walk: Walk): Answer | null {
  return walk.answer === 'limited' ? 'limited' : null;
}

function createLink(state: CreateState, name: string, none = false): DemoLink {
  return { to: `/demo/${none ? 'today?orgs=none&' : 'events?'}create=${state}`, name };
}

export const CREATE_PAGES: readonly { name: string; states: readonly DemoLink[] }[] = [
  {
    name: 'Step 1 · the name',
    states: [
      createLink('name', 'Nothing typed'),
      createLink('typing', 'Typing, “Lumen Feiras”'),
      createLink('name-blank', 'Continue with nothing'),
      createLink('name-long', 'Over 100, the 118-character name'),
      createLink('name-refused', 'A name the server refused'),
      createLink('back-name', 'Back from step 2, the name kept'),
    ],
  },
  {
    name: 'Step 2 · the country',
    states: [
      createLink('country', 'The device’s Portugal'),
      createLink('country-list', 'The list at Portugal'),
      createLink('country-search', 'Searching, “bra”'),
      createLink('country-nomatch', 'Searching, “zzz”, nothing matches'),
      createLink('country-picked', 'Brazil picked from the search'),
      createLink('country-none', 'No device country, Continue pressed'),
      createLink('back-country', 'Back from step 3, Brazil kept'),
    ],
  },
  {
    name: 'Step 3 · ready',
    states: [
      createLink('ready', 'Ready, with Portugal'),
      createLink('creating', 'Creating…'),
      createLink('limited', 'Too many for now'),
      createLink('failed', 'Did not work'),
    ],
  },
  {
    name: 'Cancel and the landing',
    states: [
      createLink('discard', 'Discard this organisation?, over step 1'),
      createLink('created', 'Created: Lumen Feiras’ Events'),
      createLink('managed', 'Managed by Ire Events: refused, Close'),
    ],
  },
  {
    name: 'From no organisation',
    states: [
      { to: '/demo/today?orgs=none', name: 'You are not in an organisation' },
      createLink('typing', 'The walk over it, typing', true),
      createLink('created', 'Created: Lumen Feiras’ Today, the notice focused', true),
    ],
  },
];
