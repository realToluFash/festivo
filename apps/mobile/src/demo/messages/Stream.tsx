import { type ReactNode, type Ref, useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View, type ViewInstance } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { Glyph, type GlyphName } from '../../components/Glyph.tsx';
import { ReadOut } from '../../components/ReadOut.tsx';
import { Text } from '../../components/Text.tsx';
import { useReducedMotion } from '../../reducedMotion.ts';
import { tokens } from '../../theme/tokens.ts';
import { TextAction, TurningMark } from '../../components/Summary.tsx';
import {
  DeliveryMark,
  MessageGlyph,
  type MarkName,
  TokenWords,
  WhereMark,
} from './MessageMarks.tsx';
import { type MarkKey, REACH, type ReachPart, type Where } from './MessagesSample.ts';
import { W, say } from './MessagesWords.ts';

const INK2 = tokens.colorInkSecondary;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export interface Bit {
  word: string;
  mark?: MarkKey;
  where?: Where;
  clip?: boolean;
}

/** Under a bubble: where it is, who and when, and its state as a mark and a word. */
export function MetaLine({ bits, end = false }: { bits: readonly Bit[]; end?: boolean }) {
  return (
    <View
      style={[styles.meta, end && styles.end]}
      accessible
      accessibilityLabel={bits.map((bit) => bit.word).join(', ')}
    >
      {bits.map((bit, index) => (
        <View key={`${bit.word}.${index}`} style={styles.bit}>
          {index > 0 && (
            <Text size={13} weight="medium" accessible={false} style={styles.secondary}>
              ·
            </Text>
          )}
          {bit.where != null && <WhereMark where={bit.where} ink={INK2} />}
          {bit.mark != null && <DeliveryMark mark={bit.mark} side={13} />}
          {bit.clip === true && <MessageGlyph name="clip" size={13} ink={INK2} />}
          <Text
            size={13}
            weight="medium"
            accessible={false}
            style={[styles.secondary, styles.figures]}
          >
            {bit.word}
          </Text>
        </View>
      ))}
    </View>
  );
}

export function DayRule({ text }: { text: string }) {
  return (
    <View style={styles.day}>
      <View style={styles.rule} />
      <Text size={12.5} weight="semibold" style={styles.secondary}>
        {text}
      </Text>
      <View style={styles.rule} />
    </View>
  );
}

export function GuestBubble({
  text,
  where,
  when,
  more = [],
}: {
  text: string;
  where: Where;
  when: string;
  more?: readonly Bit[];
}) {
  const word =
    where === 'page' ? W.onTheirPage : { email: 'Email', sms: 'SMS', wa: 'WhatsApp' }[where];

  return (
    <View style={styles.left}>
      <View style={styles.guestAt}>
        <View style={styles.guest}>
          <Text size={15.5} weight="medium" style={styles.guestWords}>
            {text}
          </Text>
        </View>
      </View>
      <MetaLine bits={[{ word, where }, { word: when }, ...more]} />
    </View>
  );
}

/** The hosts' words at the right: Violet, or dashed in Tint until it goes; it settles from 0.96 as it is sent. */
export function HostBubble({
  subject,
  text,
  bits,
  dashed = false,
  faded = false,
  greyed = false,
  settles = false,
}: {
  subject?: string | undefined;
  text: string;
  bits: readonly Bit[];
  dashed?: boolean;
  faded?: boolean;
  greyed?: boolean;
  settles?: boolean;
}) {
  const reduced = useReducedMotion();
  const [scale] = useState(() => new Animated.Value(settles && !reduced ? 0.96 : 1));
  const ink = greyed ? INK2 : dashed ? tokens.colorInk : tokens.colorInkOnDark;

  useEffect(() => {
    if (!settles || reduced) return;
    Animated.timing(scale, {
      toValue: 1,
      duration: tokens.motionBase,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [settles, reduced, scale]);

  return (
    <View style={styles.right}>
      <Animated.View style={[styles.hostAt, { transform: [{ scale }] }]}>
        <View
          style={[
            styles.host,
            dashed && styles.dashed,
            greyed && styles.greyed,
            faded && styles.faded,
          ]}
        >
          {subject != null && subject !== '' && (
            <Text size={15.5} weight="bold" style={[styles.subject, { color: ink }]}>
              {subject}
            </Text>
          )}
          <TokenWords text={text} size={15} ink={ink} lineHeight={15 * 1.45} />
        </View>
      </Animated.View>
      {bits.length > 0 && <MetaLine bits={bits} end />}
    </View>
  );
}

/** Something sent to many, in a guest's conversation: one outlined line, then where it went and what happened. */
export function Stub({
  title,
  mark,
  bits,
}: {
  title: string;
  mark: 'mail' | 'group';
  bits: readonly Bit[];
}) {
  return (
    <View style={styles.right}>
      <View style={styles.stub}>
        {mark === 'mail' ? (
          <Glyph name="mail" size={16} ink={INK2} />
        ) : (
          <MessageGlyph name="group" size={16} ink={INK2} />
        )}
        <View style={styles.grow}>
          <Text size={14} weight="semibold" style={styles.stubTitle}>
            {title}
          </Text>
          <MetaLine bits={bits} />
        </View>
      </View>
    </View>
  );
}

/** One of Soirely's own fixed messages, outlined and never Violet, so it never reads as the hosts' words. */
export function SoirelyCard({
  title,
  mark,
  lines,
  bits,
}: {
  title?: string;
  mark?: MarkName;
  lines: readonly string[];
  bits: readonly Bit[];
}) {
  return (
    <View style={styles.right}>
      <View style={[styles.hostAt, styles.soirely]}>
        <View style={styles.markTop}>
          {mark == null ? (
            <Glyph name="mail" size={16} ink={INK2} />
          ) : (
            <MessageGlyph name={mark} size={16} ink={INK2} />
          )}
        </View>
        <View style={[styles.grow, styles.soirelyWords]}>
          {title != null && title !== '' && (
            <Text size={15} weight="semibold" style={styles.soirelyTitle}>
              {title}
            </Text>
          )}
          {lines.map((line) => (
            <Text key={line} size={14} weight="medium" style={[styles.secondary, styles.body14]}>
              {line}
            </Text>
          ))}
        </View>
      </View>
      <MetaLine bits={bits} end />
    </View>
  );
}

export function SystemLine({
  text,
  glyph,
  mark,
}: {
  text: string;
  glyph?: GlyphName;
  mark?: MarkName;
}) {
  return (
    <View style={styles.system}>
      <View style={styles.markTop}>
        {mark != null ? (
          <MessageGlyph name={mark} size={15} ink={INK2} weight={2.1} />
        ) : (
          <Glyph name={glyph ?? 'info'} size={15} ink={INK2} weight={2.1} />
        )}
      </View>
      <Text size={13.5} weight="medium" style={[styles.grow, styles.secondary, styles.body135]}>
        {text}
      </Text>
    </View>
  );
}

/** A line on Surface in the stream: Cancelled, or the message queued. */
export function StatusLine({ text }: { text: string }) {
  return (
    <View style={styles.status}>
      <View style={styles.markTop}>
        <Glyph name="info" size={15} ink={INK2} weight={2.2} />
      </View>
      <Text size={14} weight="medium" style={[styles.grow, styles.body14]}>
        {text}
      </Text>
    </View>
  );
}

const BAR: Record<MarkKey, string> = {
  delivered: tokens.marks.done.fill,
  sent: tokens.marks.done.fill,
  sending: tokens.colorAttention,
  bounced: tokens.colorBroken,
  notsent: tokens.colorBroken,
  unconfirmed: tokens.colorInkTertiary,
  optout: tokens.colorMarkEmpty,
  none: tokens.colorControlBorder,
};

/** Mailchimp's report: one bar in parts, read as its words, with the legend under it in words and marks. */
export function ReachBar({
  parts = REACH,
  height = 10,
  label,
}: {
  parts?: readonly ReachPart[];
  height?: number;
  label: string;
}) {
  return (
    <View
      style={[styles.bar, { height, borderRadius: height / 2 }]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
    >
      {parts.map((part) => (
        <View
          key={part.word}
          style={[styles.part, { flex: part.count, backgroundColor: BAR[part.mark] }]}
        />
      ))}
    </View>
  );
}

export function Legend({ parts = REACH }: { parts?: readonly ReachPart[] }) {
  return (
    <View style={styles.legend}>
      {parts.map((part) => (
        <View
          key={part.word}
          style={styles.legendItem}
          accessible
          accessibilityLabel={`${part.count} ${part.word}`}
        >
          <DeliveryMark mark={part.mark} side={14} />
          <Text size={13.5} weight="semibold" accessible={false} style={styles.figures}>
            {part.count}
          </Text>
          <Text size={13.5} weight="medium" accessible={false} style={styles.secondary}>
            {part.word}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Under a sent message: the bar, how many it reached and saw it on their page, and Who it reached. */
export function Receipt({
  reached,
  of,
  seen,
  onWho,
}: {
  reached: number;
  of: number;
  seen: number;
  onWho?: (() => void) | undefined;
}) {
  const words = `${say.reached(reached, of)} · ${say.seenBy(seen)}`;
  const parts: readonly ReachPart[] =
    of - reached === 11
      ? REACH
      : [
          { mark: 'delivered', word: 'Reached', count: reached },
          { mark: 'none', word: 'Can’t be told', count: of - reached },
        ];

  return (
    <View style={styles.right}>
      <View style={styles.receipt}>
        <ReachBar parts={parts} height={8} label={say.reached(reached, of)} />
      </View>
      <Text size={14} weight="semibold" style={[styles.figures, styles.rightText]}>
        {words}
      </Text>
      {onWho != null && (
        <TextAction label={W.whoItReached} after="chevron" onPress={onWho} testID="messages.who" />
      )}
    </View>
  );
}

/** Ten seconds on the message: a ring that sweeps (it steps with Reduce Motion), the second, and Cancel. */
export function CountdownLine({
  seconds,
  onCancel,
  cancelRef,
}: {
  seconds: number;
  onCancel: () => void;
  cancelRef?: Ref<ViewInstance> | undefined;
}) {
  const reduced = useReducedMotion();
  const [left] = useState(() => new Animated.Value(seconds / 10));
  const round = 2 * Math.PI * 12;

  useEffect(() => {
    if (reduced) {
      left.setValue(seconds / 10);
      return;
    }
    const run = Animated.timing(left, {
      toValue: Math.max(seconds - 1, 0) / 10,
      duration: 1000,
      easing: Easing.linear,
      useNativeDriver: false,
    });
    run.start();

    return () => run.stop();
  }, [seconds, reduced, left]);

  return (
    <View style={styles.countdown}>
      <View
        style={styles.ring}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Svg width={28} height={28} viewBox="0 0 28 28">
          <Circle
            cx={14}
            cy={14}
            r={12}
            stroke={tokens.colorInsetBorder}
            strokeWidth={4}
            fill="none"
          />
          <AnimatedCircle
            cx={14}
            cy={14}
            r={12}
            stroke={tokens.colorAccent}
            strokeWidth={4}
            fill="none"
            strokeDasharray={`${round} ${round}`}
            strokeDashoffset={left.interpolate({ inputRange: [0, 1], outputRange: [round, 0] })}
            transform="rotate(-90 14 14)"
          />
        </Svg>
        <View style={styles.ringFigure}>
          <Text
            size={12.5}
            weight="bold"
            accessible={false}
            style={[styles.accent, styles.figures]}
          >
            {seconds}
          </Text>
        </View>
      </View>
      <Text size={14.5} weight="semibold" style={styles.figures}>
        {say.sendingIn(seconds)}
      </Text>
      <TextAction
        ref={cancelRef}
        label={W.cancel}
        renderMark={(ink) => <MessageGlyph name="undo" size={17} ink={ink} weight={2.3} />}
        onPress={onCancel}
        testID="messages.countdown.cancel"
      />
    </View>
  );
}

export function SendingLine({ soFar, of }: { soFar: number; of: number }) {
  return (
    <View style={styles.sending}>
      <TurningMark side={18} />
      <Text size={14} weight="semibold" style={styles.figures}>
        {`${W.sending} · ${say.soFar(soFar, of)}`}
      </Text>
    </View>
  );
}

export function FailedLine({
  onRetry,
  retryRef,
}: {
  onRetry: () => void;
  retryRef?: Ref<ViewInstance> | undefined;
}) {
  return (
    <View style={styles.right}>
      <ReadOut words={W.failed} interrupts accessibilityRole="alert" style={styles.failed}>
        <View style={styles.markTop}>
          <Glyph name="alert" size={15} ink={tokens.colorBroken} weight={2.2} />
        </View>
        <Text size={14} weight="medium" style={[styles.broken, styles.body14, styles.rightText]}>
          {W.failed}
        </Text>
      </ReadOut>
      <TextAction
        ref={retryRef}
        label={W.tryAgain}
        glyph="refresh"
        onPress={onRetry}
        testID="messages.retry"
      />
    </View>
  );
}

export function StreamParts({ children }: { children: ReactNode }) {
  return <View style={styles.stream}>{children}</View>;
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  secondary: { color: INK2 },
  accent: { color: tokens.colorAccentText },
  broken: { color: tokens.colorBroken },
  figures: { fontVariant: ['tabular-nums'] },
  pressed: { opacity: tokens.opacityPressed },
  end: { justifyContent: 'flex-end' },
  stream: { gap: 14 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 5, rowGap: 2 },
  bit: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  day: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceMd },
  rule: { flex: 1, height: 1, backgroundColor: tokens.colorBorder },
  left: { alignItems: 'flex-start', gap: 5 },
  right: { alignItems: 'flex-end', gap: 5 },
  guestAt: { maxWidth: '82%' },
  guest: {
    maxWidth: 480,
    paddingVertical: tokens.spaceMd,
    paddingHorizontal: 14,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomRightRadius: 20,
    borderBottomLeftRadius: tokens.spaceXs,
    backgroundColor: tokens.colorInsetBorder,
  },
  guestWords: { lineHeight: 15.5 * 1.45 },
  hostAt: { maxWidth: '86%' },
  host: {
    maxWidth: 500,
    paddingVertical: 11,
    paddingHorizontal: 14,
    gap: tokens.spaceXxs,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: tokens.spaceXs,
    backgroundColor: tokens.colorAccent,
  },
  dashed: {
    backgroundColor: tokens.colorAccentTint,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: tokens.colorAccent,
  },
  faded: { opacity: 0.6 },
  greyed: { backgroundColor: tokens.colorInset },
  subject: { lineHeight: 15.5 * 1.35 },
  stub: {
    maxWidth: '86%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spaceSm,
    paddingVertical: tokens.spaceSm,
    paddingHorizontal: tokens.spaceLg,
    borderRadius: tokens.spaceXl,
    borderWidth: 1.5,
    borderColor: tokens.colorBorder,
  },
  stubTitle: { lineHeight: 14 * 1.35 },
  soirely: {
    flexDirection: 'row',
    gap: tokens.spaceMd,
    paddingVertical: tokens.spaceLg,
    paddingHorizontal: tokens.spaceXl,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: tokens.colorBorder,
    backgroundColor: tokens.colorCard,
  },
  soirelyWords: { gap: 3 },
  soirelyTitle: { lineHeight: 15 * 1.35 },
  markTop: { paddingTop: tokens.spaceHair },
  body14: { lineHeight: 14 * 1.45 },
  body135: { lineHeight: 13.5 * 1.45 },
  system: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spaceSm,
    paddingVertical: tokens.spaceHair,
  },
  status: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spaceSm,
    paddingVertical: tokens.spaceMd,
    paddingHorizontal: tokens.spaceLg,
    borderRadius: 14,
    backgroundColor: tokens.colorInset,
  },
  bar: {
    flexDirection: 'row',
    gap: tokens.spaceHair,
    overflow: 'hidden',
    backgroundColor: tokens.colorInsetBorder,
  },
  part: { minWidth: 4 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: tokens.spaceXs },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceXs },
  receipt: { width: '86%', maxWidth: 500 },
  rightText: { textAlign: 'right' },
  countdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: tokens.spaceMd,
  },
  ring: { width: 28, height: 28 },
  ringFigure: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  action: {
    minHeight: tokens.sizeHit,
    minWidth: tokens.sizeHit,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  sending: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: tokens.spaceSm,
  },
  failed: { maxWidth: '86%', flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceXs },
});
