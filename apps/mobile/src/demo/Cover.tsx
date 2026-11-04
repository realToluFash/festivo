import { Hidden, Mesh, type Glow, type Piece, type Shade } from '../components/Cover.tsx';
import { tokens } from '../theme/tokens.ts';
import type { EventKey } from './today.ts';

/** The Settings card's pieces, by share of a Confetti card: they keep to its right side, clear of the words. */
export const CARD_PIECES: readonly Piece[] = [
  [0.67, 0.05, 'half', 22, -18, 'sun'],
  [0.83, 0.11, 'bar', 26, 24, 'white'],
  [0.96, 0.2, 'half', 14, 200, 'rose'],
  [0.81, 0.73, 'half', 20, 32, 'rose'],
  [0.92, 0.84, 'bar', 24, -40, 'sun'],
  [0.58, 0.9, 'bar', 16, 62, 'white'],
];

/** Each event's cover until a host adds a photo: its own colour, as a mesh. */
const EVENT_MESH: Record<EventKey, { base: string; glows: readonly Glow[] }> = {
  wed: {
    base: tokens.optionRose,
    glows: [
      { id: 'a', x: '15%', y: '20%', r: '60%', colour: tokens.colorInkOnDark, opacity: 0.34 },
      { id: 'b', x: '85%', y: '10%', r: '55%', colour: tokens.optionPurple, opacity: 0.45 },
      { id: 'c', x: '70%', y: '95%', r: '60%', colour: tokens.optionAmber, opacity: 0.9 },
    ],
  },
  ireti: {
    base: tokens.optionTeal,
    glows: [
      { id: 'a', x: '20%', y: '15%', r: '60%', colour: tokens.optionGreen, opacity: 0.9 },
      { id: 'b', x: '90%', y: '30%', r: '55%', colour: tokens.colorInkOnDark, opacity: 0.24 },
      { id: 'c', x: '40%', y: '100%', r: '60%', colour: tokens.optionBlue, opacity: 0.45 },
    ],
  },
  party: {
    base: tokens.colorAccent,
    glows: [
      { id: 'a', x: '20%', y: '20%', r: '60%', colour: tokens.optionPurple, opacity: 0.8 },
      { id: 'b', x: '85%', y: '15%', r: '55%', colour: tokens.optionBlue, opacity: 0.8 },
      { id: 'c', x: '60%', y: '100%', r: '60%', colour: tokens.optionRose, opacity: 0.8 },
    ],
  },
  draft: {
    base: tokens.optionAmber,
    glows: [
      { id: 'a', x: '30%', y: '20%', r: '60%', colour: tokens.colorInkOnDark, opacity: 0.4 },
      { id: 'b', x: '80%', y: '80%', r: '60%', colour: tokens.optionRose, opacity: 0.6 },
    ],
  },
};

/** An event's own cover, drawn in its colour. */
export function EventMesh({ event, shade = 'none' }: { event: EventKey; shade?: Shade }) {
  const { base, glows } = EVENT_MESH[event];

  return (
    <Hidden>
      <Mesh base={base} glows={glows} shade={shade} />
    </Hidden>
  );
}

/** The colour that stands for an event on a dot, a bar or a progress line. */
export function eventColour(event: EventKey): string {
  return EVENT_MESH[event].base;
}
