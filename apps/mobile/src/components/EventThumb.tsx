import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import type { CardPhoto } from '../kit/eventsList.ts';
import type { MeshKey } from '../kit/today.ts';
import { tokens } from '../theme/tokens.ts';
import { EventMesh } from './EventMesh.tsx';
import { Glyph } from './Glyph.tsx';

export const hidden = {
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
} as const;

/** A gradient over the whole box: a wrapper fills it, since a percentage on an absolute Svg leaves out the padding. */
export function Fill({
  id,
  down,
  stops,
}: {
  id: string;
  down: boolean;
  stops: readonly { at: string; colour: string; opacity?: number }[];
}) {
  return (
    <View style={StyleSheet.absoluteFill} {...hidden}>
      <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2={down ? '0' : '1'} y2="1">
            {stops.map((stop) => (
              <Stop
                key={stop.at}
                offset={stop.at}
                stopColor={stop.colour}
                stopOpacity={stop.opacity ?? 1}
              />
            ))}
          </LinearGradient>
        </Defs>
        <Rect width="100" height="100" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

export function PhotoFill({ id }: { id: string }) {
  return (
    <Fill
      id={id}
      down={false}
      stops={[
        { at: '0', colour: tokens.colorInkTertiary },
        { at: '0.5', colour: tokens.colorInkSecondary },
        { at: '1', colour: tokens.colorDarkInset },
      ]}
    />
  );
}

/** An event's lead: its photo, or the colour its id gives it. */
export function EventThumb({
  event,
  side = 48,
  radius = 14,
}: {
  event: { id: string; mesh: MeshKey; photo: CardPhoto | null };
  side?: number;
  radius?: number;
}) {
  return (
    <View style={[styles.thumb, { width: side, height: side, borderRadius: radius }]} {...hidden}>
      {event.photo === 'standIn' ? (
        <>
          <PhotoFill id={`thumb-${event.id}-${side}`} />
          <Glyph
            name="photo"
            size={Math.round(side * 0.5)}
            ink={tokens.colorInkOnDark}
            weight={1.8}
          />
        </>
      ) : (
        <EventMesh event={{ mesh: event.mesh, photo: event.photo }} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  thumb: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
});
