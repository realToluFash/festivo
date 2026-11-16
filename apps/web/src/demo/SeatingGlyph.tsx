import { Glyph, type GlyphName } from '../components/Glyph.tsx';

type Shape =
  | { d: string }
  | { cx: number; cy: number; r: number }
  | { x: number; y: number; w: number; h: number; rx: number };

/** Seating's own line icons, drawn as the product's are (24 grid, round caps), kept in the demo until the product takes them. */
const SEATING_GLYPHS = {
  round: [
    { cx: 12, cy: 12, r: 5 },
    { cx: 12, cy: 3.5, r: 1.5 },
    { cx: 12, cy: 20.5, r: 1.5 },
    { cx: 3.5, cy: 12, r: 1.5 },
    { cx: 20.5, cy: 12, r: 1.5 },
  ],
  rect: [
    { x: 4, y: 9, w: 16, h: 6, rx: 1.5 },
    { cx: 8, cy: 5, r: 1.5 },
    { cx: 16, cy: 5, r: 1.5 },
    { cx: 8, cy: 19, r: 1.5 },
    { cx: 16, cy: 19, r: 1.5 },
  ],
  head: [
    { x: 3, y: 7, w: 18, h: 5, rx: 1.5 },
    { cx: 7, cy: 17, r: 1.5 },
    { cx: 12, cy: 17, r: 1.5 },
    { cx: 17, cy: 17, r: 1.5 },
  ],
  cocktail: [
    { cx: 12, cy: 12, r: 3.5 },
    { x: 10, y: 2.5, w: 4, h: 4, rx: 1 },
    { x: 10, y: 17.5, w: 4, h: 4, rx: 1 },
    { x: 2.5, y: 10, w: 4, h: 4, rx: 1 },
    { x: 17.5, y: 10, w: 4, h: 4, rx: 1 },
  ],
  row: [
    { cx: 4.5, cy: 12, r: 2 },
    { cx: 9.5, cy: 12, r: 2 },
    { cx: 14.5, cy: 12, r: 2 },
    { cx: 19.5, cy: 12, r: 2 },
  ],
  seat1: [{ cx: 12, cy: 12, r: 4 }],
  minus: [{ d: 'M5 12h14' }],
  fit: [
    { d: 'M4 9V5a1 1 0 0 1 1-1h4' },
    { d: 'M15 4h4a1 1 0 0 1 1 1v4' },
    { d: 'M20 15v4a1 1 0 0 1-1 1h-4' },
    { d: 'M9 20H5a1 1 0 0 1-1-1v-4' },
  ],
  print: [{ d: 'M6 9V3h12v6' }, { x: 3, y: 9, w: 18, h: 8, rx: 2 }, { d: 'M6 14h12v7H6z' }],
  download: [{ d: 'M12 4v11' }, { d: 'M7 10l5 5 5-5' }, { d: 'M5 20h14' }],
  map: [{ d: 'M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z' }, { d: 'M9 4v14' }, { d: 'M15 6v14' }],
  cards: [
    { x: 3, y: 3, w: 8, h: 8, rx: 2 },
    { x: 13, y: 3, w: 8, h: 8, rx: 2 },
    { x: 3, y: 13, w: 8, h: 8, rx: 2 },
    { x: 13, y: 13, w: 8, h: 8, rx: 2 },
  ],
  list: [
    { d: 'M8 6h13' },
    { d: 'M8 12h13' },
    { d: 'M8 18h13' },
    { cx: 3.5, cy: 6, r: 1 },
    { cx: 3.5, cy: 12, r: 1 },
    { cx: 3.5, cy: 18, r: 1 },
  ],
  cloudOff: [
    { d: 'M3 3l18 18' },
    { d: 'M8.5 6.3A6 6 0 0 1 17.6 10H18a4 4 0 0 1 2.4 7.2' },
    { d: 'M16 18H7a5 5 0 0 1-1.6-9.7' },
  ],
} satisfies Record<string, readonly Shape[]>;

export type SeatGlyphName = keyof typeof SEATING_GLYPHS;
export type IconName = GlyphName | SeatGlyphName;

function own(name: IconName): name is SeatGlyphName {
  return name in SEATING_GLYPHS;
}

/** The product's Glyph, or one of Seating's own beside it; always next to words that say the same, so hidden from screen readers. */
export function Icon({
  name,
  size = 18,
  weight = 2,
}: {
  name: IconName;
  size?: number;
  weight?: number;
}) {
  if (!own(name)) return <Glyph name={name} size={size} weight={weight} />;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth={weight}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {(SEATING_GLYPHS[name] as readonly Shape[]).map((shape, index) =>
        'd' in shape ? (
          <path key={index} d={shape.d} />
        ) : 'cx' in shape ? (
          <circle key={index} cx={shape.cx} cy={shape.cy} r={shape.r} />
        ) : (
          <rect
            key={index}
            x={shape.x}
            y={shape.y}
            width={shape.w}
            height={shape.h}
            rx={shape.rx}
          />
        ),
      )}
    </svg>
  );
}
