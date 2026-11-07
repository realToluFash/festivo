import { type Scheme, schemes, tokens } from '../../theme/tokens.ts';

export interface Glow {
  x: number;
  y: number;
  colour: string;
  fade: number;
}

/** One scheme as Personalisation draws it: its name, its Confetti, and the colours its card takes from the tokens. */
export interface SchemeLook {
  name: string;
  ground: { base: string; glows: readonly Glow[] };
  pieces: readonly [string, string, string, string];
  on: string;
  dark: boolean;
  /** The band that darkens the card behind its words, as strong as the boards measured for 4.5:1. */
  wash: { band: string; strength: number } | null;
  accent: string;
  accentText: string;
  page: string;
}

export const SCHEME_ORDER: readonly Scheme[] = [
  'violet',
  'cobalt',
  'garden',
  'citrus',
  'berry',
  'blacktie',
  'sorbet',
  'terracotta',
];

/** The Confetti table the boards drew each scheme with, which the developer moves into docs/design/tokens.mjs under sc-30441. */
const CONFETTI: Record<Scheme, Omit<SchemeLook, 'accent' | 'accentText' | 'page' | 'dark'>> = {
  violet: {
    name: 'Violet',
    ground: {
      base: '#5A3DF0',
      glows: [
        { x: 0, y: 0, colour: '#8B73FF', fade: 0.5 },
        { x: 1, y: 0.08, colour: '#F24FD0', fade: 0.44 },
        { x: 1, y: 1, colour: '#FF7A59', fade: 0.46 },
        { x: 0, y: 0.96, colour: '#3D8BFF', fade: 0.44 },
      ],
    },
    pieces: ['#FFC75F', 'rgba(255,255,255,0.92)', '#FF7A59', '#FF8AD8'],
    on: '#FFFFFF',
    wash: { band: '#281496', strength: 1 },
  },
  cobalt: {
    name: 'Cobalt',
    ground: {
      base: '#1F47D6',
      glows: [
        { x: 0, y: 0, colour: '#5FA8FF', fade: 0.5 },
        { x: 1, y: 0.1, colour: '#3B6BFF', fade: 0.44 },
        { x: 1, y: 1, colour: '#FFD43B', fade: 0.4 },
        { x: 0, y: 1, colour: '#F0533A', fade: 0.36 },
      ],
    },
    pieces: ['#FFD43B', 'rgba(255,255,255,0.92)', '#FF6A4D', '#7CC8FF'],
    on: '#FFFFFF',
    wash: { band: '#0A196E', strength: 1 },
  },
  garden: {
    name: 'Garden',
    ground: {
      base: '#1E6B4F',
      glows: [
        { x: 0, y: 0, colour: '#4E9C76', fade: 0.5 },
        { x: 1, y: 0.06, colour: '#2E8B66', fade: 0.44 },
        { x: 1, y: 1, colour: '#F4A7B9', fade: 0.42 },
        { x: 0, y: 1, colour: '#EAA23A', fade: 0.36 },
      ],
    },
    pieces: ['#F4A7B9', 'rgba(255,253,248,0.92)', '#FFD36B', '#C9B8FF'],
    on: '#FFFFFF',
    wash: { band: '#0A2D1E', strength: 1 },
  },
  citrus: {
    name: 'Citrus',
    ground: {
      base: '#D9480F',
      glows: [
        { x: 0, y: 0, colour: '#FFB020', fade: 0.5 },
        { x: 1, y: 0.1, colour: '#FF4F9A', fade: 0.42 },
        { x: 1, y: 1, colour: '#FFC46B', fade: 0.4 },
      ],
    },
    pieces: ['#FFE066', 'rgba(255,255,255,0.92)', '#FF8AC2', '#B8F05A'],
    on: '#FFFFFF',
    wash: { band: '#6E1E00', strength: 2.75 },
  },
  berry: {
    name: 'Berry',
    ground: {
      base: '#B5175A',
      glows: [
        { x: 0, y: 0, colour: '#7B3FB0', fade: 0.5 },
        { x: 1, y: 0.08, colour: '#E0457B', fade: 0.44 },
        { x: 1, y: 1, colour: '#FF9E7A', fade: 0.44 },
      ],
    },
    pieces: ['#FFC2A8', 'rgba(255,255,255,0.92)', '#FF8AC2', '#FFC75F'],
    on: '#FFFFFF',
    wash: { band: '#460828', strength: 1 },
  },
  blacktie: {
    name: 'Black tie',
    ground: {
      base: '#FBF6EC',
      glows: [
        { x: 0, y: 0, colour: '#F3E6C8', fade: 0.55 },
        { x: 1, y: 0.1, colour: '#EBDDBE', fade: 0.45 },
        { x: 1, y: 1, colour: '#E2CC9A', fade: 0.45 },
      ],
    },
    pieces: ['#C9A55A', '#141414', '#E2CC9A', '#A3203F'],
    on: '#141414',
    wash: null,
  },
  sorbet: {
    name: 'Sorbet',
    ground: {
      base: '#F4E6FF',
      glows: [
        { x: 0, y: 0, colour: '#D6C8FF', fade: 0.52 },
        { x: 1, y: 0.08, colour: '#FFD3B8', fade: 0.46 },
        { x: 1, y: 1, colour: '#B8F0DA', fade: 0.46 },
        { x: 0, y: 1, colour: '#FFEFA8', fade: 0.4 },
      ],
    },
    pieces: ['#5B2A86', '#FF9F7A', '#4FC79E', '#F2C744'],
    on: '#22152E',
    wash: null,
  },
  terracotta: {
    name: 'Terracotta',
    ground: {
      base: '#A3401D',
      glows: [
        { x: 0, y: 0, colour: '#D0643F', fade: 0.5 },
        { x: 1, y: 0.08, colour: '#C9787A', fade: 0.44 },
        { x: 1, y: 1, colour: '#E0A030', fade: 0.42 },
      ],
    },
    pieces: ['#F2C266', 'rgba(255,252,247,0.92)', '#C5D98A', '#F2B5A5'],
    on: '#FFFFFF',
    wash: { band: '#461608', strength: 1 },
  },
};

export function lookOf(scheme: Scheme): SchemeLook {
  const own = schemes[scheme];

  return {
    ...CONFETTI[scheme],
    dark: CONFETTI[scheme].wash == null,
    accent: own.colorAccent,
    accentText: own.colorAccentText,
    page: own.colorPage,
  };
}

/** The scheme's colours as dots: its accent, two of its pieces and its page. */
export function dotsOf(look: SchemeLook): { colours: readonly string[]; ring: string } {
  return {
    colours: [look.accent, look.pieces[0], look.pieces[2], look.page],
    ring: look.dark ? `${look.on}80` : 'rgba(255,255,255,0.9)',
  };
}

export function lineOf(look: SchemeLook): string {
  return look.dark ? look.on : 'rgba(255,255,255,0.96)';
}

/** The card's one step: white with the accent's words, or the accent with white words on a light ground. */
export function stepOf(look: SchemeLook): { fill: string; ink: string } {
  return look.dark
    ? { fill: look.accent, ink: tokens.colorInkOnDark }
    : { fill: tokens.colorCard, ink: look.accentText };
}

export function washStops(wash: NonNullable<SchemeLook['wash']>): readonly [number, number][] {
  return [
    [0, Math.min(1, 0.5 * wash.strength)],
    [0.55, Math.min(1, 0.3 * wash.strength)],
    [0.85, 0],
  ];
}

/** A glow's ellipse, as CSS sizes a radial gradient to the farthest corner: as shares of the box, so one SVG serves any size. */
export function reachOf(glow: Glow): { rx: number; ry: number } {
  return {
    rx: Math.SQRT2 * Math.max(glow.x, 1 - glow.x),
    ry: Math.SQRT2 * Math.max(glow.y, 1 - glow.y),
  };
}
