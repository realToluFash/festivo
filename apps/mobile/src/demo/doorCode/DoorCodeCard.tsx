import { type Ref, useState } from 'react';
import { type LayoutRectangle, StyleSheet, View, type ViewInstance } from 'react-native';

import { Glyph } from '../../components/Glyph.tsx';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import {
  CardSays,
  GlassTag,
  type MarkKind,
  OnCard,
  SummaryCard,
  TextAction,
} from '../../components/Summary.tsx';
import {
  cardLine,
  cardStep,
  type CodeStatus,
  codeStatus,
  type DoorCode,
  type Moment,
  type Shift,
  shiftState,
  shiftWords,
  underCard,
} from './DoorCodeModel.ts';
import { cardTop, doorCodeSaid, W } from './DoorCodeWords.ts';

const TAGS: Record<Exclude<CodeStatus, 'working'>, { word: string; mark: MarkKind }> = {
  full: { word: W.full, mark: 'ended' },
  stopped: { word: W.stopped, mark: 'paused' },
  expired: { word: W.expired, mark: 'ended' },
};

const SHIFT_TAGS = {
  full: { word: W.shiftFull, shape: null },
  over: {
    word: W.shiftOver,
    shape: <Glyph name="clock" size={13} ink={tokens.colorInkOnDark} weight={2.4} />,
  },
} as const;

/** People's Confetti card with no code yet: what a code does, and the one step. */
export function NoCodeCard({
  onMake,
  stepRef,
}: {
  onMake: () => void;
  stepRef?: Ref<ViewInstance>;
}) {
  return (
    <SummaryCard
      height={176}
      gap={10}
      step={{
        label: W.makeFirst,
        onPress: onMake,
        testID: 'door.make.first',
        ...(stepRef == null ? {} : { ref: stepRef }),
      }}
      testID="door.card.none"
    >
      <CardSays text={W.noneSays} />
      <OnCard text={W.noneLine} />
    </SummaryCard>
  );
}

/** A code on People: what it gives and its shift, the code read in its groups, how far it has gone, one step; a tag only when it is not working. */
export function DoorCodeCard({
  code,
  shift,
  locale,
  now,
  onHold,
  onMakeNew,
  onStop,
  stepRef,
}: {
  code: DoorCode;
  shift: Shift | null;
  locale: string;
  /** The sample's moment: an end on another day names it, and a shift past its end is over. */
  now: Moment;
  onHold: () => void;
  onMakeNew: () => void;
  onStop: () => void;
  stepRef?: Ref<ViewInstance>;
}) {
  const status = codeStatus(code);
  const tag = status === 'working' ? null : TAGS[status];
  const holds = cardStep(status) === 'hold';
  const under = underCard(status);
  const [words, setWords] = useState<LayoutRectangle | null>(null);
  const shiftIs = shift == null ? null : shiftState(shift, now);
  const shiftTag = shiftIs == null || shiftIs === 'free' ? null : SHIFT_TAGS[shiftIs];

  return (
    <>
      <SummaryCard
        height={200}
        gap={10}
        words={words == null ? null : [words]}
        step={{
          label: holds ? W.show : W.makeNew,
          onPress: holds ? onHold : onMakeNew,
          ...(stepRef == null ? {} : { ref: stepRef }),
          testID: `door.step.${code.id}`,
        }}
        testID={`door.card.${code.id}`}
      >
        <View style={styles.words} onLayout={(event) => setWords(event.nativeEvent.layout)}>
          <OnCard text={cardTop(code.role, code.job)} />
          {shift != null && (
            <View style={styles.codeRow}>
              <OnCard text={shiftWords(shift, locale)} />
              {shiftTag != null && (
                <GlassTag
                  word={shiftTag.word}
                  mark={shiftTag.shape == null ? 'ended' : undefined}
                  shape={shiftTag.shape ?? undefined}
                  testID={`door.shiftTag.${code.id}`}
                />
              )}
            </View>
          )}
          <View style={styles.codeRow}>
            <Text
              size={30}
              weight="bold"
              accessibilityLabel={doorCodeSaid(code.code)}
              style={styles.code}
            >
              {code.code}
            </Text>
            {tag != null && <GlassTag word={tag.word} mark={tag.mark} />}
          </View>
          <OnCard text={cardLine(code, locale, now.date)} />
          {shiftTag != null && <OnCard text={W.notPutOn} />}
        </View>
      </SummaryCard>
      {under.length > 0 && (
        <View style={styles.under}>
          {under.includes('makeNew') && (
            <TextAction label={W.makeNew} onPress={onMakeNew} testID={`door.new.${code.id}`} />
          )}
          {under.includes('stop') && (
            <TextAction label={W.stop} removes onPress={onStop} testID={`door.stop.${code.id}`} />
          )}
        </View>
      )}
    </>
  );
}

export function AnotherCode({ onPress }: { onPress: () => void }) {
  return <TextAction label={W.another} glyph="plus" onPress={onPress} testID="door.another" />;
}

const styles = StyleSheet.create({
  words: { alignSelf: 'flex-start', gap: 10 },
  codeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: tokens.spaceLg,
    rowGap: tokens.spaceXs,
  },
  code: {
    color: tokens.colorInkOnDark,
    letterSpacing: 30 * 0.04,
    lineHeight: 30 * 1.15,
    fontVariant: ['tabular-nums'],
  },
  under: { flexDirection: 'row', flexWrap: 'wrap', columnGap: tokens.space3xl },
});
