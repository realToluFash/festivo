type Rgb = readonly [number, number, number];

function rgbOf(hex: string): Rgb {
  const value = Number.parseInt(hex.replace('#', '').slice(0, 6), 16);

  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function hexOf([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((channel) => Math.round(channel).toString(16).padStart(2, '0')).join('')}`;
}

function mixed(under: Rgb, over: Rgb, alpha: number): Rgb {
  return [0, 1, 2].map(
    (i) => (under[i] ?? 0) * (1 - alpha) + (over[i] ?? 0) * alpha,
  ) as unknown as Rgb;
}

function luminance(rgb: Rgb): number {
  const [r = 0, g = 0, b = 0] = rgb.map((channel) => {
    const c = channel / 255;

    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string | Rgb, b: string | Rgb): number {
  const [la, lb] = [a, b].map((one) => luminance(typeof one === 'string' ? rgbOf(one) : one));
  const light = Math.max(la ?? 0, lb ?? 0);
  const dark = Math.min(la ?? 0, lb ?? 0);

  return (light + 0.05) / (dark + 0.05);
}

const WHITE: Rgb = [255, 255, 255];
const WHITE_GLOW = 0.4;
const LEAST = 4.5;

export interface Scrim {
  ink: string;
  top: number;
  middle: number;
  foot: number;
}

/** A deeper shade of the colour, as little of it as keeps white at 4.5:1 over the cover's lightest point: its white glow, or any photo's white. */
export function scrimFor(base: string, photo: boolean, ink: string): Scrim {
  const colour = rgbOf(
    photo ? ink : hexOf(rgbOf(base).map((channel) => channel * 0.42) as unknown as Rgb),
  );
  const lightest = photo ? WHITE : mixed(rgbOf(base), WHITE, WHITE_GLOW);
  let middle = 0.2;

  while (middle < 0.95 && contrast(WHITE, mixed(lightest, colour, middle)) < LEAST) middle += 0.02;

  return {
    ink: hexOf(colour),
    top: Math.min(0.95, middle + 0.06),
    middle,
    foot: Math.min(0.95, middle + 0.16),
  };
}

export function scrimContrast(base: string, photo: boolean, ink: string): number {
  const scrim = scrimFor(base, photo, ink);
  const lightest = photo ? WHITE : mixed(rgbOf(base), WHITE, WHITE_GLOW);

  return contrast(WHITE, mixed(lightest, rgbOf(scrim.ink), scrim.middle));
}
