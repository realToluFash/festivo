import { defaultScheme } from '../scheme.ts';
import { type DemoLink, VIEWERS, settingsPath } from './settings.ts';

export type SchemeKey =
  'violet' | 'cobalt' | 'garden' | 'citrus' | 'berry' | 'blacktie' | 'sorbet' | 'terracotta';

/** The swatches' reading order, which the arrow keys follow. */
export const SCHEME_ORDER: readonly SchemeKey[] = [
  'violet',
  'cobalt',
  'garden',
  'citrus',
  'berry',
  'blacktie',
  'sorbet',
  'terracotta',
];

export const OWN_SCHEME: SchemeKey = defaultScheme;

export const SAVE_MS = 500;
export const HOLD_MS = 8000;
export const LOADING_MS = 8000;
export const RETRY_MS = 1500;

export const PERSONALISATION_WORDS = {
  title: 'Personalisation',
  says: (name: string) => `You see Soirely in ${name}`,
  never: 'Soirely’s own colours, until you choose others.',
  chosen: 'Your choice. Violet is Soirely’s own.',
  saved: 'Saved. Every page is in your colours now.',
  choose: 'Choose colours',
  follow: 'Your colours follow you on every device you sign in on. Only you see them.',
  keeps: 'Event covers, emails, messages and guests’ pages keep their own colours.',
  dialog: 'Colours',
  lead: 'Pick the colours Soirely shows you.',
  inUse: 'In use now. Pick another to see it here.',
  notYet: (name: string) => `Not saved yet. Save puts ${name} on every page.`,
  failed: (picked: string, kept: string) => `${picked} was not saved. Your colours stay ${kept}.`,
  offline: (picked: string, kept: string) =>
    `${picked} was not saved because you are offline. Your colours stay ${kept}.`,
  save: 'Save',
  cancel: 'Cancel',
  saving: 'Saving…',
  tryAgain: 'Try again',
  current: 'Current',
  card: (name: string) => `Your colours: ${name}`,
  preview: (name: string) => `Preview: ${name}`,
  swatch: (name: string, current: boolean) => (current ? `${name}, current` : name),
  couldNotLoad: 'Your colours did not load.',
  check: 'Check your connection and try again.',
  loading: 'Loading…',
} as const;

/** A glow of the ground: where it sits in the card, its colour, and how far it reaches, as fractions. */
export interface Glow {
  x: number;
  y: number;
  colour: string;
  reach: number;
}

/** A scheme's Confetti, from the boards (sc-30441): not tokens yet, so the demo carries it. */
export interface SchemeArt {
  name: string;
  glows: readonly Glow[];
  base: string;
  /** The wash under the card's words, left to right; null where the words are dark. */
  band: { rgb: string; from: number; mid: number } | null;
  on: string;
  dark: boolean;
  pieces: readonly [string, string, string, string];
  accent: string;
  page: string;
}

const WHITE = '#FFFFFF';
const glow = (x: number, y: number, colour: string, reach: number): Glow => ({
  x: x / 100,
  y: y / 100,
  colour,
  reach: reach / 100,
});
const band = (rgb: string, from = 0.5, mid = 0.3) => ({ rgb, from, mid });

export const SCHEMES: Record<SchemeKey, SchemeArt> = {
  violet: {
    name: 'Violet',
    glows: [
      glow(0, 0, '#8B73FF', 50),
      glow(100, 8, '#F24FD0', 44),
      glow(100, 100, '#FF7A59', 46),
      glow(0, 96, '#3D8BFF', 44),
    ],
    base: '#5A3DF0',
    band: band('40,20,150'),
    on: WHITE,
    dark: false,
    pieces: ['#FFC75F', 'rgba(255,255,255,0.92)', '#FF7A59', '#FF8AD8'],
    accent: '#5A3DF0',
    page: '#FFFFFF',
  },
  cobalt: {
    name: 'Cobalt',
    glows: [
      glow(0, 0, '#5FA8FF', 50),
      glow(100, 10, '#3B6BFF', 44),
      glow(100, 100, '#FFD43B', 40),
      glow(0, 100, '#F0533A', 36),
    ],
    base: '#1F47D6',
    band: band('10,25,110'),
    on: WHITE,
    dark: false,
    pieces: ['#FFD43B', 'rgba(255,255,255,0.92)', '#FF6A4D', '#7CC8FF'],
    accent: '#1F47D6',
    page: '#FFFFFF',
  },
  garden: {
    name: 'Garden',
    glows: [
      glow(0, 0, '#4E9C76', 50),
      glow(100, 6, '#2E8B66', 44),
      glow(100, 100, '#F4A7B9', 42),
      glow(0, 100, '#EAA23A', 36),
    ],
    base: '#1E6B4F',
    band: band('10,45,30'),
    on: WHITE,
    dark: false,
    pieces: ['#F4A7B9', 'rgba(255,253,248,0.92)', '#FFD36B', '#C9B8FF'],
    accent: '#1E6B4F',
    page: '#FFFDF8',
  },
  citrus: {
    name: 'Citrus',
    glows: [glow(0, 0, '#FFB020', 50), glow(100, 10, '#FF4F9A', 42), glow(100, 100, '#FFC46B', 40)],
    base: '#D9480F',
    band: band('110,30,0', 1, 0.82),
    on: WHITE,
    dark: false,
    pieces: ['#FFE066', 'rgba(255,255,255,0.92)', '#FF8AC2', '#B8F05A'],
    accent: '#C2410C',
    page: '#FFFFFF',
  },
  berry: {
    name: 'Berry',
    glows: [glow(0, 0, '#7B3FB0', 50), glow(100, 8, '#E0457B', 44), glow(100, 100, '#FF9E7A', 44)],
    base: '#B5175A',
    band: band('70,8,40'),
    on: WHITE,
    dark: false,
    pieces: ['#FFC2A8', 'rgba(255,255,255,0.92)', '#FF8AC2', '#FFC75F'],
    accent: '#B5175A',
    page: '#FFFFFF',
  },
  blacktie: {
    name: 'Black tie',
    glows: [glow(0, 0, '#F3E6C8', 55), glow(100, 10, '#EBDDBE', 45), glow(100, 100, '#E2CC9A', 45)],
    base: '#FBF6EC',
    band: null,
    on: '#141414',
    dark: true,
    pieces: ['#C9A55A', '#141414', '#E2CC9A', '#A3203F'],
    accent: '#141414',
    page: '#FFFDF9',
  },
  sorbet: {
    name: 'Sorbet',
    glows: [
      glow(0, 0, '#D6C8FF', 52),
      glow(100, 8, '#FFD3B8', 46),
      glow(100, 100, '#B8F0DA', 46),
      glow(0, 100, '#FFEFA8', 40),
    ],
    base: '#F4E6FF',
    band: null,
    on: '#22152E',
    dark: true,
    pieces: ['#5B2A86', '#FF9F7A', '#4FC79E', '#F2C744'],
    accent: '#5B2A86',
    page: '#FFFBF7',
  },
  terracotta: {
    name: 'Terracotta',
    glows: [glow(0, 0, '#D0643F', 50), glow(100, 8, '#C9787A', 44), glow(100, 100, '#E0A030', 42)],
    base: '#A3401D',
    band: band('70,22,8'),
    on: WHITE,
    dark: false,
    pieces: ['#F2C266', 'rgba(255,252,247,0.92)', '#C5D98A', '#F2B5A5'],
    accent: '#A3401D',
    page: '#FFFCF7',
  },
};

/** A piece of Confetti: its centre's left, its top, its shape and length, its turn, and which of the scheme's four colours. */
export type Piece = readonly [number, number, 'half' | 'bar', number, number, 0 | 1 | 2 | 3];

export interface Art {
  width: number;
  height: number;
  pieces: readonly Piece[];
}

export const PAGE_ART: Art = {
  width: 666,
  height: 201,
  pieces: [
    [484, 16, 'half', 24, -18, 0],
    [574, 30, 'bar', 28, 24, 1],
    [640, 92, 'half', 16, 200, 2],
    [550, 118, 'half', 22, 32, 3],
    [620, 150, 'bar', 22, -40, 0],
    [454, 150, 'bar', 16, 62, 1],
  ],
};

export const PREVIEW_ART: Art = {
  width: 498,
  height: 96,
  pieces: [
    [384, 8, 'half', 22, -18, 0],
    [438, 16, 'bar', 26, 24, 1],
    [484, 30, 'half', 14, 200, 2],
  ],
};

export const SWATCH_ART: Art = {
  width: 158,
  height: 48,
  pieces: [
    [124, 8, 'half', 16, -18, 0],
    [96, 14, 'bar', 18, 24, 1],
    [142, 30, 'half', 12, 200, 2],
    [112, 26, 'half', 14, 32, 3],
    [68, 30, 'bar', 14, -40, 0],
  ],
};

export function nextScheme(key: SchemeKey, by: 1 | -1): SchemeKey {
  const at = SCHEME_ORDER.indexOf(key);

  return SCHEME_ORDER[(at + by + SCHEME_ORDER.length) % SCHEME_ORDER.length] ?? key;
}

export function keyStep(key: string): 1 | -1 | null {
  if (key === 'ArrowRight' || key === 'ArrowDown') return 1;

  return key === 'ArrowLeft' || key === 'ArrowUp' ? -1 : null;
}

export type Refusal = 'failed' | 'offline';

export function notSaved(refusal: Refusal, picked: SchemeKey, kept: SchemeKey): string {
  const words =
    refusal === 'offline' ? PERSONALISATION_WORDS.offline : PERSONALISATION_WORDS.failed;

  return words(SCHEMES[picked].name, SCHEMES[kept].name);
}

export function statusLine(picked: SchemeKey, current: SchemeKey): string {
  return picked === current
    ? PERSONALISATION_WORDS.inUse
    : PERSONALISATION_WORDS.notYet(SCHEMES[picked].name);
}

export const PERSONALISATION_STATES = [
  'never',
  'chosen',
  'colours',
  'picked',
  'saving',
  'saved',
  'saveFailed',
  'offline',
  'escaped',
  'loading',
  'failed',
] as const;

type PersonalisationState = (typeof PERSONALISATION_STATES)[number];

function stateOf(name: string): PersonalisationState | null {
  return PERSONALISATION_STATES.find((state) => state === name) ?? null;
}

export interface PersonalisationStart {
  load: 'loading' | 'failed' | 'loaded';
  /** The person's colours as the state opens them: null has never chosen; undefined keeps this visit's. */
  scheme: SchemeKey | null | undefined;
  pick: SchemeKey | null;
  saving: boolean;
  saved: boolean;
  unsaved: Refusal | null;
  keyed: boolean;
  step: boolean;
}

/** What a state link opens on; one the page does not know opens it as this visit left it. */
export function personalisationStart(state: string): PersonalisationStart {
  const REST: PersonalisationStart = {
    load: 'loaded',
    scheme: undefined,
    pick: null,
    saving: false,
    saved: false,
    unsaved: null,
    keyed: false,
    step: false,
  };
  const never = { ...REST, scheme: null };
  const picked = { ...never, pick: 'garden' as const };

  switch (stateOf(state)) {
    case null:
      return REST;
    case 'never':
      return never;
    case 'chosen':
      return { ...REST, scheme: 'garden' };
    case 'colours':
      return { ...never, pick: OWN_SCHEME, keyed: true };
    case 'picked':
      return { ...picked, keyed: true };
    case 'saving':
      return { ...picked, saving: true };
    case 'saved':
      return { ...REST, scheme: 'garden', saved: true, keyed: true, step: true };
    case 'saveFailed':
      return { ...picked, unsaved: 'failed' };
    case 'offline':
      return { ...picked, unsaved: 'offline' };
    case 'escaped':
      return { ...never, keyed: true, step: true };
    case 'loading':
      return { ...REST, scheme: 'garden', load: 'loading' };
    case 'failed':
      return { ...REST, scheme: 'garden', load: 'failed' };
  }
}

function personalisation(state: PersonalisationState, name: string): DemoLink {
  return { to: settingsPath('personalisation', VIEWERS.folake, state), name };
}

export const PERSONALISATION_PAGES: readonly { name: string; states: readonly DemoLink[] }[] = [
  {
    name: 'The page',
    states: [
      personalisation('never', 'Never chosen, in Violet'),
      personalisation('chosen', 'After a choice, in Garden'),
      personalisation('colours', 'Colours, opened'),
    ],
  },
  {
    name: 'Picking and saving',
    states: [
      personalisation('picked', 'Garden picked from the keyboard'),
      personalisation('saving', 'Saving'),
      personalisation('saved', 'Saved, every page in Garden'),
      personalisation('saveFailed', 'A save that failed'),
      personalisation('offline', 'Offline'),
      personalisation('escaped', 'Esc, focus back on Choose colours'),
    ],
  },
  {
    name: 'Loading',
    states: [personalisation('loading', 'Loading'), personalisation('failed', 'Did not load')],
  },
];
