import type { ReactNode, Ref } from 'react';
import { StyleSheet, View, type ViewInstance } from 'react-native';

import { useShell } from '../../components/settingsShell.ts';
import { CardSays, GlassTag, OnCard, SummaryCard } from '../../components/Summary.tsx';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { CardBackdrop } from '../../components/EventCard.tsx';
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
  state: CeilingState;
  notPriced: number;
  range: string;
  says: string | null;
  step: { label: string; onPress: () => void; ref?: Ref<ViewInstance> } | null;
}) {
  const { layout } = useShell();

  return (
    <Card event={event} step={says == null ? null : step} testID="budget.card">
      <View style={styles.tags}>
        <GlassTag
          word={say.state(state)}
          shape={<CeilingMark state={state} side={13} ink={tokens.colorInkOnDark} />}
        />
        {notPriced > 0 && (
          <GlassTag
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
        <GlassTag word={count} />
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
}: {
  event: Shown;
  note: string;
  share: string;
  line: string;
}) {
  return (
    <Card event={event} height={180} testID="budget.payer.card">
      <View style={styles.tags}>
        <GlassTag word={note} />
      </View>
      <OnCard text={W.theirShare} />
      <Figure text={share} size={28} />
      <OnCard text={line} />
    </Card>
  );
}

const styles = StyleSheet.create({
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spaceSm },
  figure: { color: tokens.colorInkOnDark, fontVariant: ['tabular-nums'] },
});
