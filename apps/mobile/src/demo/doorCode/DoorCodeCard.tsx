import type { Ref } from 'react';
import { StyleSheet, View, type ViewInstance } from 'react-native';

import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import {
  CardSays,
  GlassTag,
  type MarkKind,
  OnCard,
  SummaryCard,
  TextAction,
} from '../settings/Summary.tsx';
import {
  cardLine,
  cardStep,
  type CodeStatus,
  codeStatus,
  type DoorCode,
  underCard,
} from './DoorCodeModel.ts';
import { cardTop, joinCodeSaid, W } from './DoorCodeWords.ts';

const TAGS: Record<Exclude<CodeStatus, 'working'>, { word: string; mark: MarkKind }> = {
  full: { word: W.full, mark: 'ended' },
  stopped: { word: W.stopped, mark: 'paused' },
  ranOut: { word: W.ranOut, mark: 'ended' },
};

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

/** A code on People: what it gives, the code read in its groups, how far it has gone, one step; a tag only when it is not working. */
export function DoorCodeCard({
  code,
  locale,
  onHold,
  onMakeNew,
  onStop,
  stepRef,
}: {
  code: DoorCode;
  locale: string;
  onHold: () => void;
  onMakeNew: () => void;
  onStop: () => void;
  stepRef?: Ref<ViewInstance>;
}) {
  const status = codeStatus(code);
  const tag = status === 'working' ? null : TAGS[status];
  const holds = cardStep(status) === 'hold';
  const under = underCard(status);

  return (
    <>
      <SummaryCard
        height={200}
        gap={10}
        step={{
          label: holds ? W.hold : W.makeNew,
          onPress: holds ? onHold : onMakeNew,
          ...(stepRef == null ? {} : { ref: stepRef }),
          testID: `door.step.${code.id}`,
        }}
        testID={`door.card.${code.id}`}
      >
        <OnCard text={cardTop(code.role, code.job)} />
        <View style={styles.codeRow}>
          <Text
            size={30}
            weight="bold"
            accessibilityLabel={joinCodeSaid(code.code)}
            style={styles.code}
          >
            {code.code}
          </Text>
          {tag != null && <GlassTag word={tag.word} mark={tag.mark} />}
        </View>
        <OnCard text={cardLine(code, locale)} />
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
