import { StyleSheet, View } from 'react-native';

import type { MeshKey, ShownEvent } from '../kit/today.ts';
import { tokens } from '../theme/tokens.ts';
import { type Glow, Hidden, Mesh, type Shade } from './Cover.tsx';
import { EventCover } from './EventCover.tsx';

/** Each event's cover until a host adds a photo: its own colour, as a mesh. */
const EVENT_MESH: Record<MeshKey, { base: string; glows: readonly Glow[] }> = {
  rose: {
    base: tokens.optionRose,
    glows: [
      { id: 'a', x: '15%', y: '20%', r: '60%', colour: tokens.colorInkOnDark, opacity: 0.34 },
      { id: 'b', x: '85%', y: '10%', r: '55%', colour: tokens.optionPurple, opacity: 0.45 },
      { id: 'c', x: '70%', y: '95%', r: '60%', colour: tokens.optionAmber, opacity: 0.9 },
    ],
  },
  teal: {
    base: tokens.optionTeal,
    glows: [
      { id: 'a', x: '20%', y: '15%', r: '60%', colour: tokens.optionGreen, opacity: 0.9 },
      { id: 'b', x: '90%', y: '30%', r: '55%', colour: tokens.colorInkOnDark, opacity: 0.24 },
      { id: 'c', x: '40%', y: '100%', r: '60%', colour: tokens.optionBlue, opacity: 0.45 },
    ],
  },
  accent: {
    base: tokens.colorAccent,
    glows: [
      { id: 'a', x: '20%', y: '20%', r: '60%', colour: tokens.optionPurple, opacity: 0.8 },
      { id: 'b', x: '85%', y: '15%', r: '55%', colour: tokens.optionBlue, opacity: 0.8 },
      { id: 'c', x: '60%', y: '100%', r: '60%', colour: tokens.optionRose, opacity: 0.8 },
    ],
  },
  amber: {
    base: tokens.optionAmber,
    glows: [
      { id: 'a', x: '30%', y: '20%', r: '60%', colour: tokens.colorInkOnDark, opacity: 0.4 },
      { id: 'b', x: '80%', y: '80%', r: '60%', colour: tokens.optionRose, opacity: 0.6 },
    ],
  },
};

/** An event's own cover: its photo once a host adds one, else its colour as a mesh. */
export function EventMesh({
  event,
  shade = 'none',
}: {
  event: Pick<ShownEvent, 'mesh' | 'photo'>;
  shade?: Shade;
}) {
  const { base, glows } = EVENT_MESH[event.mesh];

  return (
    <Hidden>
      {event.photo == null ? (
        <Mesh base={base} glows={glows} shade={shade} />
      ) : (
        <>
          <EventCover cover={event.photo.cover} type={event.photo.type} radius={0} fill />
          {shade !== 'none' && (
            <View style={StyleSheet.absoluteFill}>
              <Mesh base="transparent" glows={[]} shade={shade} />
            </View>
          )}
        </>
      )}
    </Hidden>
  );
}

/** The colour that stands for an event on a dot, a bar or a progress line. */
export function eventColour(event: Pick<ShownEvent, 'mesh'>): string {
  return EVENT_MESH[event.mesh].base;
}
