import { type ReactNode, type Ref, useEffect, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View, type ViewInstance } from 'react-native';

import { Glyph } from '../../components/Glyph.tsx';
import { Text, type TextHandle } from '../../components/Text.tsx';
import { useReducedMotion } from '../../reducedMotion.ts';
import { tokens } from '../../theme/tokens.ts';
import { Pill } from '../../components/SettingsParts.tsx';
import { TextAction } from '../../components/Summary.tsx';
import { OWNER, type Waits, waitsCheckOf } from './CheckWaits.ts';
import { ChannelTick } from './Composers.tsx';
import { MessageGlyph } from './MessageMarks.tsx';
import { type Draft, checkOf, dayWords } from './MessagesModel.ts';
import { RESEND, formatCount, BALANCE, MOBILES } from './MessagesSample.ts';
import type { ResendView } from './Reach.ts';
import { quietLineOf } from './Sms.ts';
import { ChannelReach, InsteadLine } from './WhatsAppParts.tsx';
import { CHANNEL_WORD, type ChannelKey, W, say } from './MessagesWords.ts';
import { WaitBlock } from './WaitBlock.tsx';

/** The one filled button in the check: 48 tall, growing with its words. */
export function BigButton({
  label,
  onPress,
  why = null,
  ref,
  testID,
}: {
  label: string;
  onPress: () => void;
  why?: string | null | undefined;
  ref?: Ref<ViewInstance> | undefined;
  testID: string;
}) {
  const off = why != null;

  return (
    <Pressable
      ref={ref}
      onPress={off ? undefined : onPress}
      disabled={off}
      style={({ pressed }) => [styles.big, off && styles.bigOff, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={off ? `${label}, ${why}` : label}
      accessibilityState={{ disabled: off }}
      testID={testID}
    >
      <Text
        size={16}
        weight="semibold"
        accessible={false}
        style={off ? styles.offInk : styles.onAccent}
      >
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
  locale,
  headRef,
  goRef,
  onGo,
  onLater,
  onChange,
  onKeep,
  onChannel,
  onSeeAll,
  balance = BALANCE,
  waits,
  clock,
  onWithout,
}: {
  draft: Draft;
  locale: string;
  balance?: number;
  clock?: string | undefined;
  waits?: Waits | undefined;
  onWithout?: (drops: readonly ChannelKey[]) => void;
  headRef?: Ref<TextHandle>;
  goRef?: Ref<ViewInstance> | undefined;
  onGo: () => void;
  onLater: () => void;
  onChange: () => void;
  onKeep: () => void;
  onChannel: (key: ChannelKey) => void;
  onSeeAll: (count: number) => void;
}) {
  const waiting = draft.at == null ? waitsCheckOf(draft, balance, locale) : null;
  const check = waiting?.check ?? checkOf(draft);
  const at = draft.at;
  const quiet = at == null ? quietLineOf(MOBILES[draft.to], draft.channels, clock) : null;

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
        {at == null
          ? (waiting?.told ?? W.toldHow)
          : say.instead(dayWords(at.date, locale), at.time)}
      </Text>
      {at == null && (
        <View style={styles.pills}>
          {(['email', 'sms', 'wa'] as const).map((key) => (
            <ChannelTick
              key={key}
              channel={key}
              on={draft.channels[key]}
              onPress={() => onChannel(key)}
              testID={`messages.check.${key}`}
            />
          ))}
        </View>
      )}
      {check.told.length > 0 && (
        <View style={styles.pills}>
          {check.told.map((told) => (
            <ChannelPill key={told.key} channel={told.key} count={told.count} />
          ))}
        </View>
      )}
      {check.smsReach != null && <ChannelReach channel="sms" line={check.smsReach} />}
      {check.reach != null && <ChannelReach channel="wa" line={check.reach} />}
      {check.instead != null && <InsteadLine line={check.instead} />}
      {check.smsOff > 0 && (
        <Text size={14} weight="semibold" style={styles.line}>
          {say.smsOff(check.smsOff)}
        </Text>
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
              onPress={() => onSeeAll(check.cantTell)}
              testID="messages.check.seeAll"
            />
          )}
        </View>
      )}
      {waiting == null ? (
        <Text size={13.5} weight="medium" style={[styles.small, styles.figures]}>
          {check.credits > 0
            ? say.credits(check.credits, check.after, check.whatsApp)
            : W.emailFree}
        </Text>
      ) : (
        <WaitBlock
          view={waiting}
          waits={waits ?? OWNER}
          onWithout={(drops) => onWithout?.(drops)}
        />
      )}
      {quiet != null && (
        <View style={styles.quiet} testID="messages.check.quiet">
          <View style={styles.quietMark}>
            <Glyph name="clock" size={15} ink={tokens.colorInkSecondary} weight={2.2} />
          </View>
          <Text size={13.5} weight="semibold" style={[styles.small, styles.grow]}>
            {quiet}
          </Text>
        </View>
      )}
      <View style={styles.actions}>
        <BigButton
          ref={goRef}
          label={say.sendTo(check.count)}
          onPress={onGo}
          testID="messages.check.go"
        />
        {at == null ? (
          <>
            <TextAction label={W.later} onPress={onLater} testID="messages.check.later" />
            <TextAction label={W.changeIt} onPress={onChange} testID="messages.check.change" />
          </>
        ) : (
          <TextAction label={W.keepScheduled} onPress={onKeep} testID="messages.check.keep" />
        )}
      </View>
    </Rising>
  );
}

/** sc-3963's inline ask under a scheduled message: Keep it first and focused; Escape keeps it. */
export function CancelAsk({
  subject,
  keepRef,
  onKeep,
  onCancel,
}: {
  subject: string;
  keepRef?: Ref<ViewInstance> | undefined;
  onKeep: () => void;
  onCancel: () => void;
}) {
  return (
    <View style={styles.ask} collapsable={false} onAccessibilityEscape={onKeep}>
      <Text
        size={17}
        weight="bold"
        accessibilityRole="header"
        numberOfLines={1}
        style={styles.sentence}
      >
        {say.cancelAsk(subject)}
      </Text>
      <Text size={14} weight="medium" style={[styles.secondary, styles.line]}>
        {W.cancelLine}
      </Text>
      <View style={styles.askActions}>
        <TextAction ref={keepRef} label={W.keepIt} onPress={onKeep} testID="messages.ask.keep" />
        <Pill
          label={W.cancelMessage}
          kind="dangerQuiet"
          height={tokens.sizeHit}
          full={false}
          onPress={onCancel}
          testID="messages.ask.cancel"
        />
      </View>
    </View>
  );
}

/** Resend to those not reached: the message is on their page already, so only Soirely's notice goes again. */
export function ResendCheck({
  check,
  headRef,
  onGo,
  onChange,
  onSeeAll,
  onBack,
}: {
  check: ResendView;
  headRef?: Ref<TextHandle>;
  onGo: () => void;
  onChange: () => void;
  onSeeAll: () => void;
  onBack: () => void;
}) {
  const [ticks, setTicks] = useState<Record<ChannelKey, boolean>>({
    email: true,
    sms: true,
    wa: false,
  });
  const credits = ticks.sms ? RESEND.credits : 0;
  const stillCant = (
    <View style={styles.cant}>
      <Text size={14} weight="semibold" style={styles.figures}>
        {say.stillCantTell(check.still)}
      </Text>
      {check.names.map((name) => (
        <Text key={name} size={13.5} weight="medium" style={[styles.secondary, styles.small]}>
          {name}
        </Text>
      ))}
      {check.still > check.names.length && (
        <TextAction
          label={say.seeAll(check.still)}
          onPress={onSeeAll}
          testID="messages.resend.seeAll"
        />
      )}
    </View>
  );

  if (check.count === 0)
    return (
      <Rising>
        <Text
          ref={headRef}
          size={18}
          weight="bold"
          accessibilityRole="header"
          style={styles.sentence}
        >
          {say.noneCanBeTold(check.n)}
        </Text>
        <Text size={14} weight="medium" style={[styles.secondary, styles.line]}>
          {W.noneCanBeToldLine}
        </Text>
        {stillCant}
        <View style={styles.actions}>
          <TextAction label={W.backToWho} onPress={onBack} testID="messages.resend.back" />
        </View>
      </Rising>
    );

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
      {check.unconfirmed > 0 && (
        <Text size={14} weight="medium" style={styles.line}>
          {say.includesUnconfirmed(check.unconfirmed)}
        </Text>
      )}
      {check.still > 0 && stillCant}
      {credits > 0 && (
        <Text size={13.5} weight="medium" style={[styles.small, styles.figures]}>
          {say.credits(credits, formatCount(BALANCE - credits), false)}
        </Text>
      )}
      <View style={styles.actions}>
        <BigButton label={say.sendTo(check.count)} onPress={onGo} testID="messages.resend.go" />
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
  quiet: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceXs },
  quietMark: { paddingTop: 2 },
  grow: { flex: 1 },
  ask: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'flex-end',
    gap: tokens.spaceSm,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: tokens.colorBorder,
    backgroundColor: tokens.colorCard,
  },
  askActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'flex-end',
    columnGap: 18,
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 18 },
  bigOff: { backgroundColor: tokens.colorInsetBorder },
  offInk: { color: tokens.colorInkSecondary, textAlign: 'center' },
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
