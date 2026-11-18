import type { ReactNode, Ref } from 'react';
import { StyleSheet, View, type ViewInstance } from 'react-native';

import { useShell } from '../../components/settingsShell.ts';
import { CardSays, OnCard, SummaryCard } from '../../components/Summary.tsx';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { CardBackdrop } from '../../components/EventCard.tsx';
import { Glass } from '../../components/TodayCover.tsx';
import type { Shown } from '../events/EventsModel.ts';
import type { CeilingState } from './BudgetModel.ts';
import { CeilingMark, RingMark } from './BudgetParts.tsx';
import { W, say } from './BudgetWords.ts';

const FIGURE = { phone: 30, portrait: 32, landscape: 34 } as const;

function Figure({ text, size }: { text: string; size: number }) {
  return (
    <Text
      size={size}
      weight="bold"
      accessibilityRole="header"
      style={[styles.figure, { lineHeight: Math.round(size * 1.1), letterSpacing: size * -0.02 }]}
    >
      {text}
    </Text>
  );
}

/** The kit's glass tag, taller when its words wrap at the accessibility sizes rather than cut off at 28. */
function CardTag({ word, shape }: { word: string; shape?: ReactNode }) {
  return (
    <Glass height={28} grows style={styles.tag}>
      {shape}
      <Text size={13} weight="semibold" style={styles.tagWord}>
        {word}
      </Text>
    </Glass>
  );
}

function Card({
  event,
  height = 200,
  step,
  children,
  testID,
}: {
  event: Shown;
  height?: number;
  step?: { label: string; onPress: () => void; ref?: Ref<ViewInstance> } | null;
  children: ReactNode;
  testID: string;
}) {
  const { layout } = useShell();

  return (
    <SummaryCard
      size={layout === 'phone' ? 'page' : 'wide'}
      height={height}
      backdrop={<CardBackdrop event={event} />}
      step={step == null ? null : { ...step, testID: `${testID}.step` }}
      testID={testID}
    >
      {children}
    </SummaryCard>
  );
}

/** A's card: the ceiling's state and the count as glass tags, the range, its sentence, and the one thing that needs you. */
export function BudgetCard({
  event,
  state,
  notPriced,
  range,
  says,
  step,
}: {
  event: Shown;
  /** None while the event has no ceiling of its own (sc-90). */
  state: CeilingState | null;
  notPriced: number;
  range: string;
  says: string | null;
  step: { label: string; onPress: () => void; ref?: Ref<ViewInstance> } | null;
}) {
  const { layout } = useShell();

  return (
    <Card event={event} step={says == null ? null : step} testID="budget.card">
      <View style={styles.tags}>
        {state != null && (
          <CardTag
            word={say.state(state)}
            shape={<CeilingMark state={state} side={13} ink={tokens.colorInkOnDark} />}
          />
        )}
        {notPriced > 0 && (
          <CardTag
            word={say.notPriced(notPriced)}
            shape={<RingMark dashed side={13} ink={tokens.colorInkOnDark} />}
          />
        )}
      </View>
      <Figure text={range} size={FIGURE[layout]} />
      <OnCard text={W.rangeLine} />
      {says != null && <OnCard text={says} strong />}
    </Card>
  );
}

export function FirstCard({ event }: { event: Shown }) {
  return (
    <Card event={event} testID="budget.card">
      <CardSays text={W.noCostsYet} heading />
      <OnCard text={W.costsOnComputer} />
    </Card>
  );
}

/** Who is paying's own card (sc-91): what has a payer, out of the range, and what has none yet. */
export function PayersCard({
  event,
  count,
  has,
  line,
}: {
  event: Shown;
  count: string;
  has: string;
  line: string;
}) {
  return (
    <Card event={event} testID="budget.payers.card">
      <View style={styles.tags}>
        <CardTag word={count} />
      </View>
      <Figure text={has} size={28} />
      <OnCard text={line} />
    </Card>
  );
}

export function PayerCard({
  event,
  note,
  share,
  line,
  notPriced = 0,
}: {
  event: Shown;
  note: string;
  share: string;
  line: string;
  notPriced?: number;
}) {
  return (
    <Card event={event} height={180} testID="budget.payer.card">
      <View style={styles.tags}>
        <CardTag word={note} />
      </View>
      <OnCard text={W.theirShare} />
      <Figure text={share} size={28} />
      {notPriced > 0 && <OnCard text={say.notPriced(notPriced)} strong />}
      <OnCard text={line} />
    </Card>
  );
}

const styles = StyleSheet.create({
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spaceSm },
  tag: {
    alignSelf: 'flex-start',
    flexShrink: 1,
    gap: tokens.spaceXs,
    paddingLeft: 9,
    paddingRight: 11,
    paddingVertical: tokens.spaceXxs,
  },
  tagWord: { flexShrink: 1, color: tokens.colorInkOnDark },
  figure: { color: tokens.colorInkOnDark, fontVariant: ['tabular-nums'] },
});
