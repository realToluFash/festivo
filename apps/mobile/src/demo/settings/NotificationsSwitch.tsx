import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { Glyph } from '../Glyph.tsx';

const TRACK_W = 51;
const TRACK_H = 31;
const KNOB = 27;
const KNOB_GAP = 2;

/** B's switch with its On or Off word, so a state is never colour alone: under it on the phone, beside it on a tablet. */
export function ConfettiSwitch({
  on,
  label,
  hint,
  locked = false,
  busy = false,
  stacked = false,
  width,
  onChange,
  testID,
}: {
  on: boolean;
  label: string;
  hint?: string | undefined;
  /** In force and unchangeable: it ignores a tap and a screen reader hears it unavailable, but its word stays at full strength. */
  locked?: boolean;
  busy?: boolean;
  stacked?: boolean;
  /** The cell's own width, wide enough for the longer word, so a flip never moves its row. */
  width?: number | undefined;
  onChange: (next: boolean) => void;
  testID: string;
}) {
  const off = locked || busy;

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ checked: on, disabled: off, busy }}
      disabled={off}
      onPress={() => onChange(!on)}
      style={[stacked ? styles.stacked : styles.beside, width != null && { width }]}
      testID={testID}
    >
      <View style={[styles.track, on && styles.trackOn]}>
        <View style={[styles.knob, on && styles.knobOn]} />
      </View>
      <View style={styles.word}>
        <Text
          size={13.5}
          weight="semibold"
          accessible={false}
          style={on ? styles.inkOn : styles.inkOff}
        >
          {on ? 'On' : 'Off'}
        </Text>
        {locked && <Glyph name="lock" size={13} ink={tokens.colorInkSecondary} weight={2.4} />}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stacked: {
    minHeight: tokens.sizeHit,
    alignItems: 'center',
    gap: 5,
  },
  beside: {
    minHeight: tokens.sizeHit,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spaceSm,
  },
  track: {
    width: TRACK_W,
    height: TRACK_H,
    borderRadius: TRACK_H / 2,
    backgroundColor: tokens.colorTrack,
  },
  trackOn: { backgroundColor: tokens.colorAccent },
  knob: {
    position: 'absolute',
    top: KNOB_GAP,
    left: KNOB_GAP,
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
    backgroundColor: tokens.colorCard,
    ...tokens.elevationNative.card.ios,
    elevation: tokens.elevationNative.card.android.elevation,
  },
  knobOn: { left: TRACK_W - KNOB - KNOB_GAP },
  word: {
    minWidth: 26,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  inkOn: { color: tokens.colorAccentText },
  inkOff: { color: tokens.colorInkSecondary },
});
