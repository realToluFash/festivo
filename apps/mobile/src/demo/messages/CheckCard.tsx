import { type ReactNode, type Ref, useEffect, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View, type ViewInstance } from 'react-native';

import { Glyph } from '../../components/Glyph.tsx';
import { Text, type TextHandle } from '../../components/Text.tsx';
import { useReducedMotion } from '../../reducedMotion.ts';
import { tokens } from '../../theme/tokens.ts';
import { TextAction } from '../settings/Summary.tsx';
import { ChannelTick } from './Composers.tsx';
import { MessageGlyph } from './MessageMarks.tsx';
import { type Draft, checkOf } from './MessagesModel.ts';
import { RESEND, formatCount, BALANCE } from './MessagesSample.ts';
import { CHANNEL_WORD, type ChannelKey, W, say } from './MessagesWords.ts';

/** The one filled button in the check: 48 tall, growing with its words. */
export function BigButton({
  label,
  onPress,
  ref,
  testID,
}: {
  label: string;
  onPress: () => void;
  ref?: Ref<ViewInstance> | undefined;
  testID: string;
}) {
  return (
    <Pressable
      ref={ref}
      onPress={onPress}
      style={({ pressed }) => [styles.big, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
    >
      <Text size={16} weight="semibold" accessible={false} style={styles.onAccent}>
        {label}
      </Text>
    </Pressable>
  );
}

export function ChannelPill({ channel, count }: { channel: ChannelKey; count: number }) {
  return (
    <View style={styles.pill} accessible accessibilityLabel={`${CHANNEL_WORD[channel]} · ${count}`}>
      {channel === 'email' ? (
        <Glyph name="mail" size={15} ink={tokens.colorInk} weight={2.2} />
      ) : (
        <MessageGlyph name={channel} size={15} ink={tokens.colorInk} weight={2.2} />
      )}
      <Text size={13.5} weight="semibold" accessible={false} style={styles.figures}>
        {`${CHANNEL_WORD[channel]} · ${count}`}
      </Text>
    </View>
  );
}

/** The card rises 12 and fades in over 240 ms; with Reduce Motion it is simply there. */
function Rising({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  const [shown] = useState(() => new Animated.Value(reduced ? 1 : 0));

  useEffect(() => {
    if (reduced) return;
    Animated.timing(shown, {
      toValue: 1,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [reduced, shown]);

  return (
    <Animated.View
      style={[
        styles.card,
        {
          opacity: shown,
          transform: [
            { translateY: shown.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/** Check it before it goes: a card in the conversation, never a dialog over it. */
export function CheckCard({
  draft,
  headRef,
  goRef,
  onGo,
  onLater,
  onChange,
  onSeeAll,
}: {
  draft: Draft;
  headRef?: Ref<TextHandle>;
  goRef?: Ref<ViewInstance> | undefined;
  onGo: () => void;
  onLater: () => void;
  onChange: () => void;
  onSeeAll: () => void;
}) {
  const check = checkOf(draft);

  return (
    <Rising>
      <Text
        ref={headRef}
        size={18}
        weight="bold"
        accessibilityRole="header"
        style={styles.sentence}
      >
        {say.cannotUndo(check.count)}
      </Text>
      <Text size={14} weight="medium" style={[styles.secondary, styles.line]}>
        {W.toldHow}
      </Text>
      {check.told.length > 0 && (
        <View style={styles.pills}>
          {check.told.map((told) => (
            <ChannelPill key={told.key} channel={told.key} count={told.count} />
          ))}
        </View>
      )}
      {check.cantTell > 0 && (
        <View style={styles.cant}>
          <Text size={14} weight="semibold" style={styles.figures}>
            {say.cantTell(check.cantTell)}
          </Text>
          {check.names.map((name) => (
            <Text key={name} size={13.5} weight="medium" style={[styles.secondary, styles.small]}>
              {name}
            </Text>
          ))}
          {check.seeAll && (
            <TextAction
              label={say.seeAll(check.cantTell)}
              onPress={onSeeAll}
              testID="messages.check.seeAll"
            />
          )}
        </View>
      )}
      {check.credits > 0 && (
        <Text size={13.5} weight="medium" style={[styles.small, styles.figures]}>
          {say.credits(check.credits, check.after, check.whatsApp)}
        </Text>
      )}
      <View style={styles.actions}>
        <BigButton
          ref={goRef}
          label={say.sendTo(check.count)}
          onPress={onGo}
          testID="messages.check.go"
        />
        <TextAction label={W.later} onPress={onLater} testID="messages.check.later" />
        <TextAction label={W.changeIt} onPress={onChange} testID="messages.check.change" />
      </View>
    </Rising>
  );
}

/** Resend to those not reached: the message is on their page already, so only Soirely's notice goes again. */
export function ResendCheck({
  headRef,
  onGo,
  onChange,
  onSeeAll,
}: {
  headRef?: Ref<TextHandle>;
  onGo: () => void;
  onChange: () => void;
  onSeeAll: () => void;
}) {
  const [ticks, setTicks] = useState<Record<ChannelKey, boolean>>({
    email: true,
    sms: true,
    wa: false,
  });
  const credits = ticks.sms ? RESEND.credits : 0;

  return (
    <Rising>
      <Text
        ref={headRef}
        size={18}
        weight="bold"
        accessibilityRole="header"
        style={styles.sentence}
      >
        {say.cannotUndo(RESEND.count)}
      </Text>
      <Text size={14} weight="medium" style={[styles.secondary, styles.line]}>
        {W.alreadyOnPage}
      </Text>
      <View style={styles.pills}>
        {(['email', 'sms', 'wa'] as const).map((key) => (
          <ChannelTick
            key={key}
            channel={key}
            on={ticks[key]}
            onPress={() => setTicks((now) => ({ ...now, [key]: !now[key] }))}
            testID={`messages.resend.${key}`}
          />
        ))}
      </View>
      <Text size={14} weight="medium" style={styles.line}>
        {say.includesUnconfirmed(RESEND.unconfirmed)}
      </Text>
      <View style={styles.cant}>
        <Text size={14} weight="semibold" style={styles.figures}>
          {say.stillCantTell(RESEND.stillCant)}
        </Text>
        {RESEND.names.map((name) => (
          <Text key={name} size={13.5} weight="medium" style={[styles.secondary, styles.small]}>
            {name}
          </Text>
        ))}
        <TextAction
          label={say.seeAll(RESEND.stillCant)}
          onPress={onSeeAll}
          testID="messages.resend.seeAll"
        />
      </View>
      {credits > 0 && (
        <Text size={13.5} weight="medium" style={[styles.small, styles.figures]}>
          {say.credits(credits, formatCount(BALANCE - credits), false)}
        </Text>
      )}
      <View style={styles.actions}>
        <BigButton label={say.sendTo(RESEND.count)} onPress={onGo} testID="messages.resend.go" />
        <TextAction label={W.changeIt} onPress={onChange} testID="messages.resend.change" />
      </View>
    </Rising>
  );
}

const styles = StyleSheet.create({
  secondary: { color: tokens.colorInkSecondary },
  onAccent: { color: tokens.colorInkOnDark, textAlign: 'center' },
  figures: { fontVariant: ['tabular-nums'] },
  pressed: { opacity: tokens.opacityPressed },
  card: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'flex-end',
    gap: tokens.spaceMd,
    paddingVertical: tokens.spaceXl,
    paddingHorizontal: 18,
    borderRadius: tokens.space3xl,
    borderWidth: 2,
    borderColor: tokens.colorAccent,
    backgroundColor: tokens.colorCard,
    ...tokens.elevationNative.popover.ios,
    elevation: tokens.elevationNative.popover.android.elevation,
  },
  sentence: { lineHeight: 18 * 1.3 },
  line: { lineHeight: 14 * 1.45 },
  small: { lineHeight: 13.5 * 1.45 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spaceSm },
  pill: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceXs,
    paddingLeft: 9,
    paddingRight: tokens.spaceLg,
    borderRadius: tokens.spaceXl,
    backgroundColor: tokens.colorInset,
  },
  cant: { gap: 3 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 18 },
  big: {
    minHeight: tokens.sizeHitPhonePrimary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingVertical: tokens.spaceXs,
    borderRadius: tokens.space3xl,
    backgroundColor: tokens.colorAccent,
  },
});
