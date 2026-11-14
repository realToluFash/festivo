import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { tokens } from '../theme/tokens.ts';

/** Where a guest stands, as the mark draws it; Not yet invited is sc-3788's. */
export type ReplyKind = 'coming' | 'maybe' | 'notcoming' | 'held' | 'noreply' | 'notyet';

export type MarkKind = ReplyKind | 'arrived' | 'walkin';

/** Coming takes its reply state's colour; Arrived and Walk-in the scheme's done mark, each beside its word. */
const COMING = tokens.replyStates.coming.dot;
const ARRIVED = tokens.marks.done;
const GREY = tokens.replyStates.notComing.dot;

const hidden = {
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
} as const;

function Tick({ side, ink }: { side: number; ink: string }) {
  return (
    <Svg width={side} height={side} viewBox="0 0 24 24">
      <Path
        d="M20 6 9 17l-5-5"
        fill="none"
        stroke={ink}
        strokeWidth={3.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function Query({ side, ink }: { side: number; ink: string }) {
  return (
    <Svg width={side} height={side} viewBox="0 0 24 24">
      <Path
        d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"
        fill="none"
        stroke={ink}
        strokeWidth={2.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={12} cy={17.2} r={1.5} fill={ink} />
    </Svg>
  );
}

export function DoorGlyph({ side, ink }: { side: number; ink: string }) {
  return (
    <Svg width={side} height={side} viewBox="0 0 24 24">
      <Rect
        x={6}
        y={3}
        width={12}
        height={18}
        rx={1.5}
        fill="none"
        stroke={ink}
        strokeWidth={2.2}
      />
      <Path d="M3 21h18" stroke={ink} strokeWidth={2.2} strokeLinecap="round" />
      <Circle cx={14.5} cy={12.5} r={1.4} fill={ink} />
    </Svg>
  );
}

/** A reply's mark, always beside its word (replyStates): on white, or drawn white on a Confetti cover. */
export function ReplyMark({
  kind,
  side = 22,
  cover = null,
}: {
  kind: MarkKind;
  side?: number;
  /** The cover's ink, for the mark drawn white on the card. */
  cover?: string | null;
}) {
  const round = { width: side, height: side, borderRadius: side / 2 };
  const white = tokens.colorInkOnDark;
  const on = cover != null;
  const ring = on ? white : GREY;

  switch (kind) {
    case 'coming':
      return (
        <View {...hidden} style={[styles.centred, round, { backgroundColor: on ? white : COMING }]}>
          <Tick side={Math.round(side * 0.66)} ink={on ? cover : white} />
        </View>
      );
    case 'maybe':
      return (
        <View
          {...hidden}
          style={[
            styles.centred,
            round,
            on
              ? { borderWidth: 2, borderColor: white }
              : {
                  backgroundColor: tokens.colorAttentionTint,
                  borderWidth: Math.max(2, Math.round(side * 0.12)),
                  borderColor: tokens.colorAttention,
                },
          ]}
        >
          <Query side={Math.round(side * 0.8)} ink={on ? white : tokens.colorAttentionText} />
        </View>
      );
    case 'notcoming':
      return (
        <View {...hidden} style={[styles.centred, round, { backgroundColor: on ? white : GREY }]}>
          <View
            style={[
              styles.bar,
              { width: Math.round(side * 0.5), backgroundColor: on ? cover : white },
            ]}
          />
        </View>
      );
    case 'held':
      return (
        <View
          {...hidden}
          style={[round, styles.clip, { borderWidth: on ? 1.5 : 1, borderColor: ring }]}
        >
          <View style={[styles.half, { backgroundColor: ring }]} />
        </View>
      );
    case 'noreply':
      return <View {...hidden} style={[round, { borderWidth: 1.5, borderColor: ring }]} />;
    case 'notyet':
      return (
        <View
          {...hidden}
          style={[round, { borderWidth: 1.5, borderStyle: 'dashed', borderColor: ring }]}
        />
      );
    case 'arrived':
    case 'walkin':
      return (
        <View
          {...hidden}
          style={[
            styles.centred,
            { width: side, height: side, borderRadius: Math.round(side * 0.28) },
            { backgroundColor: ARRIVED.fill },
          ]}
        >
          <DoorGlyph side={Math.round(side * 0.7)} ink={ARRIVED.ink} />
        </View>
      );
  }
}

/** The 28 slot a row leads with, the mark at 22 centred in it. */
export function MarkSlot({ kind, side = 22 }: { kind: MarkKind; side?: number }) {
  return (
    <View style={styles.slot}>
      <ReplyMark kind={kind} side={side} />
    </View>
  );
}

const styles = StyleSheet.create({
  centred: { alignItems: 'center', justifyContent: 'center' },
  clip: { overflow: 'hidden' },
  half: { position: 'absolute', left: 0, top: 0, bottom: 0, width: '50%' },
  bar: { height: 2.5, borderRadius: 2 },
  slot: { width: 28, alignItems: 'center' },
});
