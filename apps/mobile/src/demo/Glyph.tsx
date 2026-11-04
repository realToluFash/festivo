import Svg, { Circle, Path, Rect } from 'react-native-svg';

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
  today: [{ x: 4, y: 3, w: 16, h: 18, rx: 3 }, { d: 'M4 9h16' }, { cx: 12, cy: 15, r: 1.6 }],
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
  back: [{ d: 'm15 18-6-6 6-6' }],
  down: [{ d: 'm6 9 6 6 6-6' }],
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
    {
      d: 'M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z',
    },
    { cx: 16.5, cy: 7.5, r: 0.6 },
  ],
  lock: [{ x: 3, y: 11, w: 18, h: 11, rx: 2 }, { d: 'M7 11V7a5 5 0 0 1 10 0v4' }],
  sparkle: [
    {
      d: 'M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z',
    },
    { d: 'M20 3v4' },
    { d: 'M22 5h-4' },
  ],
  signOut: [
    { d: 'm16 17 5-5-5-5' },
    { d: 'M21 12H9' },
    { d: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4' },
  ],
  x: [{ d: 'M18 6 6 18' }, { d: 'm6 6 12 12' }],
  info: [{ cx: 12, cy: 12, r: 10 }, { d: 'M12 16v-4' }, { d: 'M12 8h.01' }],
  alert: [{ cx: 12, cy: 12, r: 10 }, { d: 'M12 8v4' }, { d: 'M12 16h.01' }],
  copy: [
    { x: 8, y: 8, w: 14, h: 14, rx: 2 },
    { d: 'M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2' },
  ],
  mail: [{ x: 2, y: 4, w: 20, h: 16, rx: 2 }, { d: 'm22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7' }],
  phone: [
    {
      d: 'M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384',
    },
  ],
  device: [{ x: 5, y: 2, w: 14, h: 20, rx: 2 }, { d: 'M12 18h.01' }],
  tablet: [{ x: 4, y: 2, w: 16, h: 20, rx: 2 }, { d: 'M12 18h.01' }],
  laptop: [
    {
      d: 'M18 5a2 2 0 0 1 2 2v8.526a2 2 0 0 0 .212.897l1.068 2.127a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45l1.068-2.127A2 2 0 0 0 4 15.526V7a2 2 0 0 1 2-2z',
    },
    { d: 'M20.054 15.987H3.946' },
  ],
  eye: [
    {
      d: 'M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0',
    },
    { cx: 12, cy: 12, r: 3 },
  ],
  link: [
    { d: 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71' },
    { d: 'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71' },
  ],
  globe: [
    { cx: 12, cy: 12, r: 10 },
    { d: 'M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20' },
    { d: 'M2 12h20' },
  ],
  refresh: [
    { d: 'M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8' },
    { d: 'M21 3v5h-5' },
    { d: 'M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16' },
    { d: 'M8 16H3v5' },
  ],
} satisfies Record<string, readonly Shape[]>;

export type GlyphName = keyof typeof GLYPHS;

/** The demo's line icons, as the boards draw them; always beside words that say the same, so hidden from screen readers. */
export function Glyph({
  name,
  size = 18,
  ink,
  weight = 2,
}: {
  name: GlyphName;
  size?: number;
  ink: string;
  weight?: number;
}) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={ink}
      strokeWidth={weight}
      strokeLinecap="round"
      strokeLinejoin="round"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {GLYPHS[name].map((shape, index) =>
        'd' in shape ? (
          <Path key={index} d={shape.d} />
        ) : 'cx' in shape ? (
          <Circle key={index} cx={shape.cx} cy={shape.cy} r={shape.r} />
        ) : (
          <Rect
            key={index}
            x={shape.x}
            y={shape.y}
            width={shape.w}
            height={shape.h}
            rx={shape.rx}
          />
        ),
      )}
    </Svg>
  );
}
