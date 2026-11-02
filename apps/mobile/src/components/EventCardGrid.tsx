import { type ReactNode, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { EVENT_CARD_GAP, eventCardWidth } from '../kit/eventsHome.ts';
import { type LayoutKind } from '../layout/useLayout.ts';

/** Events' row of cards, loading or loaded: it measures the room it has and hands each card its column's width (sc-22103). */
export function EventCardGrid({
  kind,
  children,
}: {
  kind: LayoutKind;
  children: (width: number) => ReactNode;
}) {
  const [room, setRoom] = useState<number | null>(null);

  return (
    <View
      style={[styles.grid, { gap: EVENT_CARD_GAP[kind] }]}
      onLayout={(layout) => setRoom(layout.nativeEvent.layout.width)}
    >
      {room != null && children(eventCardWidth(kind, room))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
});
