import { deviceCountry, newOrganisationRefusal } from '@soirely/domain';
import type { TFunction } from 'i18next';

import {
  type Currencies,
  type Walk,
  type WalkAnswer,
  freshWalk as productWalk,
} from '../components/createWalk.ts';
import type { DemoLink } from './settings.ts';

export type { Walk };

/** sc-563's managed account is the demo's alone: the API does not refuse it yet. */
export type DemoWalk = Walk & { managed?: boolean };

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

export const NEW_ORG = { id: 'org-lumen-feiras-pt', name: 'Lumen Feiras' } as const;
export const LONG_NAME =
  'Lumen Feiras, Congressos e Celebrações de Lisboa, do Porto e do Algarve para Empresas, Famílias, Escolas e Associações';
export const DEVICE_LANGUAGES = ['pt-PT'] as const;
export const NO_COUNTRY_LANGUAGES: readonly string[] = [];
export const DEVICE_ZONE = 'Europe/Lisbon';
export const LIMIT_LIFTS = new Date(2026, 10, 3, 10, 41);

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

export const NO_ORG_WORDS = {
  title: 'You are not in an organisation',
  body: 'Events, teams and plans all belong to an organisation, and you are not part of one right now. Your account is still yours, and nothing in it has gone.',
  wayOn: (email: string) => `Ask whoever runs yours to invite ${email} again.`,
  signedInAs: (email: string) => `Signed in as ${email}.`,
  account: 'Your account',
  signOut: 'Sign out',
  language: 'English',
};

export function isCreateState(name: string | null): name is CreateState {
  return CREATE_STATES.some((state) => state === name);
}

/** The countries the demo draws, each with the currency the API gave it. */
export const SAMPLE_CURRENCIES: Currencies = new Map(Object.entries(CURRENCIES));

export function freshWalk(none = false): Walk {
  return productWalk({
    country: deviceCountry(none ? NO_COUNTRY_LANGUAGES : DEVICE_LANGUAGES),
    zone: DEVICE_ZONE,
  });
}

/** The walk a `?create=` state opens on; `created` is the landing, so no walk. */
export function walkOf(state: CreateState, t: TFunction): DemoWalk | null {
  const named = { ...freshWalk(), name: NEW_ORG.name };

  switch (state) {
    case 'name':
      return freshWalk();
    case 'typing':
      return named;
    case 'name-blank':
      return { ...freshWalk(), nameRefused: newOrganisationRefusal('name', '', t) };
    case 'name-long':
      return {
        ...named,
        name: LONG_NAME,
        nameRefused: newOrganisationRefusal('name', LONG_NAME, t),
      };
    case 'name-refused':
      return { ...named, nameRefused: newOrganisationRefusal('name', '', t) };
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
        countryRefused: t('forms.countryBlank'),
        landing: 'search',
      };
    case 'back-country':
      return { ...named, step: 2, country: 'BR', landing: 'question', inList: true };
    case 'ready':
      return { ...named, step: 3, landing: 'question' };
    case 'creating':
      return { ...named, step: 3, creating: true, landing: 'dialog' };
    case 'limited':
      return { ...named, step: 3, answer: 'limited', lifts: LIMIT_LIFTS, landing: 'create' };
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

const CREATING_MS = 1200;

/** What pressing Create organisation answers in the demo, after a moment: too many for now holds until 10:41, and anything else creates Lumen Feiras. */
export function sampleSend(walk: Walk): Promise<WalkAnswer<typeof NEW_ORG>> {
  const answer: WalkAnswer<typeof NEW_ORG> =
    walk.answer === 'limited'
      ? { kind: 'limited', until: LIMIT_LIFTS }
      : { kind: 'created', made: NEW_ORG };

  return new Promise((resolve) => window.setTimeout(() => resolve(answer), CREATING_MS));
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
