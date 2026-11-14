import { confetti, type Scheme, schemes, tokens } from '../theme/tokens.ts';

export interface Glow {
  x: number;
  y: number;
  colour: string;
  fade: number;
}

/** One scheme as Personalisation draws it: its Confetti, and the colours its card takes from the tokens. */
export interface SchemeLook {
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

export function schemeOf(name: unknown): Scheme | null {
  return SCHEME_ORDER.find((scheme) => scheme === name) ?? null;
}

export function schemeNameKey(scheme: Scheme): `personalisation.scheme.${Scheme}` {
  return `personalisation.scheme.${scheme}`;
}

export function lookOf(scheme: Scheme): SchemeLook {
  const own = schemes[scheme];
  const { ground, pieces, on, wash } = confetti[scheme];

  return {
    ground,
    pieces,
    on,
    wash,
    dark: wash == null,
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
