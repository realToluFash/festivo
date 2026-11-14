import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type ViewInstance } from 'react-native';

import { Glyph } from '../../components/Glyph.tsx';
import { ReadOut } from '../../components/ReadOut.tsx';
import { moveScreenReaderFocus } from '../../components/screenReaderFocus.ts';
import { Pill } from '../../components/SettingsParts.tsx';
import { TextAction } from '../../components/Summary.tsx';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import {
  ASK_MS,
  type Ask,
  type Waits,
  type WaitsCheck,
  askAnswered,
  pressAsk,
} from './CheckWaits.ts';
import { DeliveryMark } from './MessageMarks.tsx';
import { type ChannelKey, W, WW, say } from './MessagesWords.ts';

/** sc-3963: under who can't be told, in place of the credits line, as noticeWaits does for one guest. */
export function WaitBlock({
  view,
  waits,
  onWithout,
  linesOnly = false,
}: {
  view: WaitsCheck;
  waits: Waits;
  onWithout: (drops: readonly ChannelKey[]) => void;
  linesOnly?: boolean;
}) {
  const [ask, setAsk] = useState<Ask>(waits.ask);
  const now = useRef<Ask>(waits.ask);
  const pressed = useRef(false);
  const sentRef = useRef<ViewInstance>(null);
  const answer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const asks = !linesOnly && !waits.canBill && ask !== 'sent';
  const sent = say.ownersAsked(waits.owners);

  const move = (next: Ask) => {
    now.current = next;
    setAsk(next);
  };
  const onAsk = () => {
    const next = pressAsk(now.current);
    if (!next.sends) return;
    pressed.current = true;
    move(next.ask);
    answer.current = setTimeout(() => move(askAnswered(now.current, true)), ASK_MS);
  };

  useEffect(
    () => () => {
      if (answer.current != null) clearTimeout(answer.current);
    },
    [],
  );
  useEffect(() => {
    if (ask !== 'sent' || !pressed.current) return undefined;
    const later = setTimeout(() => moveScreenReaderFocus(sentRef.current), 350);

    return () => clearTimeout(later);
  }, [ask]);

  return (
    <View style={styles.block} testID="messages.check.waits">
      {view.either && (
        <View style={styles.row}>
          <View style={styles.markTop}>
            <Glyph name="mail" size={15} ink={tokens.colorInkSecondary} weight={2} />
          </View>
          <Text size={13.5} weight="medium" style={[styles.grow, styles.line]}>
            {WW.either}
          </Text>
        </View>
      )}
      {view.waiting.map((one) => (
        <View key={one.key} style={styles.row} testID={`messages.check.waits.${one.key}`}>
          <View style={styles.markTop}>
            <DeliveryMark mark="sending" side={15} />
          </View>
          <Text size={13.5} weight="semibold" style={[styles.grow, styles.line, styles.figures]}>
            {say.waits(one.key, one.count)}
          </Text>
        </View>
      ))}
      {!linesOnly && (view.way != null || asks) && (
        <View style={styles.ways}>
          {view.way != null && (
            <Pill
              label={view.way.label}
              kind="secondary"
              height={tokens.sizeHit}
              full={false}
              onPress={() => {
                if (view.way != null) onWithout(view.way.drops);
              }}
              testID="messages.check.without"
            />
          )}
          {asks && (
            <TextAction label={WW.askOwner} onPress={onAsk} testID="messages.check.askOwner" />
          )}
        </View>
      )}
      {!linesOnly && waits.canBill && (
        <Text size={13.5} weight="medium" style={[styles.secondary, styles.line]}>
          {W.creditsNotInApp}
        </Text>
      )}
      {!waits.canBill && ask === 'sent' && (
        <View ref={sentRef} accessible accessibilityLabel={sent} testID="messages.check.askSent">
          <ReadOut words={sent} style={styles.row}>
            <View style={styles.markTop}>
              <Glyph name="tick" size={15} ink={tokens.colorAccentText} weight={2.8} />
            </View>
            <Text size={13.5} weight="medium" accessible={false} style={[styles.grow, styles.line]}>
              {sent}
            </Text>
          </ReadOut>
        </View>
      )}
      {!waits.canBill && ask === 'failed' && (
        <ReadOut
          words={WW.askFailed}
          interrupts
          accessibilityRole="alert"
          style={styles.row}
          testID="messages.check.askFailed"
        >
          <View style={styles.markTop}>
            <Glyph name="alert" size={15} ink={tokens.colorBroken} weight={2.3} />
          </View>
          <Text size={13.5} weight="semibold" style={[styles.grow, styles.line, styles.broken]}>
            {WW.askFailed}
          </Text>
        </ReadOut>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: tokens.spaceXs },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceXs },
  markTop: { paddingTop: 1 },
  grow: { flex: 1, minWidth: 0 },
  line: { lineHeight: 13.5 * 1.4 },
  secondary: { color: tokens.colorInkSecondary },
  broken: { color: tokens.colorBroken },
  figures: { fontVariant: ['tabular-nums'] },
  ways: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: 18,
    rowGap: tokens.spaceXs,
  },
});
