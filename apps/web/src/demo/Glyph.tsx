import type { SVGProps } from 'react';

type Shape =
  | { d: string }
  | { cx: number; cy: number; r: number }
  | { x: number; y: number; w: number; h: number; rx: number };

const CALENDAR: readonly Shape[] = [
  { d: 'M8 2v4' },
  { d: 'M16 2v4' },
  { x: 3, y: 4, w: 18, h: 18, rx: 2 },
  { d: 'M3 10h18' },
];

const GLYPHS = {
  today: [
    { cx: 12, cy: 12, r: 4 },
    {
      d: 'M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41',
    },
  ],
  events: [...CALENDAR, { d: 'm9 16 2 2 4-4' }],
  calendar: CALENDAR,
  settings: [
    {
      d: 'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z',
    },
    { cx: 12, cy: 12, r: 3 },
  ],
  bell: [
    { d: 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9' },
    { d: 'M10.3 21a1.94 1.94 0 0 0 3.4 0' },
  ],
  updown: [{ d: 'm7 15 5 5 5-5' }, { d: 'm7 9 5-5 5 5' }],
  arrow: [{ d: 'M5 12h14' }, { d: 'm12 5 7 7-7 7' }],
  chevron: [{ d: 'm9 18 6-6-6-6' }],
  clock: [{ cx: 12, cy: 12, r: 10 }, { d: 'M12 6v6l4 2' }],
  tick: [{ d: 'M20 6 9 17l-5-5' }],
  plus: [{ d: 'M12 5v14' }, { d: 'M5 12h14' }],
  search: [{ cx: 11, cy: 11, r: 8 }, { d: 'm21 21-4.3-4.3' }],
  shield: [
    {
      d: 'M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z',
    },
  ],
  users: [
    { d: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2' },
    { cx: 9, cy: 7, r: 4 },
    { d: 'M22 21v-2a4 4 0 0 0-3-3.87' },
    { d: 'M16 3.13a4 4 0 0 1 0 7.75' },
  ],
  key: [
    { d: 'm15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4' },
    { d: 'm21 2-9.6 9.6' },
    { cx: 7.5, cy: 15.5, r: 5.5 },
  ],
  lock: [{ x: 3, y: 11, w: 18, h: 11, rx: 2 }, { d: 'M7 11V7a5 5 0 0 1 10 0v4' }],
  back: [{ d: 'm15 18-6-6 6-6' }],
  chevdown: [{ d: 'm6 9 6 6 6-6' }],
  chevup: [{ d: 'm18 15-6-6-6 6' }],
  alert: [{ cx: 12, cy: 12, r: 10 }, { d: 'M12 8v4' }, { d: 'M12 16h.01' }],
  copy: [
    { x: 8, y: 8, w: 14, h: 14, rx: 2 },
    { d: 'M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2' },
  ],
} satisfies Record<string, readonly Shape[]>;

export type GlyphName = keyof typeof GLYPHS;

/** Today's line icons, the app's own; always beside words that say the same, so hidden from screen readers. */
export function Glyph({
  name,
  size = 18,
  weight = 2,
  className,
}: {
  name: GlyphName;
  size?: number;
  weight?: number;
  className?: string;
}) {
  const line: SVGProps<SVGSVGElement> = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: weight,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  };

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      {...line}
    >
      {GLYPHS[name].map((shape, index) =>
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
