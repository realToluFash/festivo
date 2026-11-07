import { type ReactNode, type Ref, useEffect, useState } from 'react';
import {
  Animated,
  type LayoutChangeEvent,
  StyleSheet,
  View,
  type ViewInstance,
} from 'react-native';

import { useShell } from '../../components/settingsShell.ts';
import {
  Line,
  RowList,
  RowShapes,
  Section,
  ShapeMark,
  TextAction,
} from '../../components/Summary.tsx';
import { useReducedMotion } from '../../reducedMotion.ts';
import { tokens } from '../../theme/tokens.ts';
import type { Shown } from '../events/EventsModel.ts';
import {
  AS_OF,
  type BudgetModel,
  type Ledger,
  amountOf,
  canMark,
  categoriesIn,
  LIVE_CHANGE,
  categoryState,
  ceilingState,
  days,
  isOverdue,
  money,
  nextDay,
  nextPayment,
  owed,
  payersOf,
  paymentOf,
  perHeadOf,
  planOf,
  totalsOf,
  whole,
} from './BudgetModel.ts';
import {
  CEILINGS,
  GUESTS,
  HEADS_IF_ALL_COME,
  LINES,
  type Line as CostLine,
  PAYERS,
  PAYMENTS,
  TODAY,
  VENDORS,
} from './BudgetSample.ts';
import { BudgetCard, FirstCard } from './BudgetCard.tsx';
import {
  Amount,
  CapsHead,
  CeilingMark,
  InfoLine,
  LiveLine,
  LiveMark,
  MarkWord,
  MoneyRow,
  OverdueTag,
  PageTitle,
  PlanLine,
  RingMark,
  StateTag,
  Strip,
  UndoMark,
} from './BudgetParts.tsx';
import { W, say } from './BudgetWords.ts';

const WASH_MS = 1600;

export interface HomeActions {
  onStep: (id: string) => void;
  onRow: (id: string) => void;
  rowRef: (id: string) => (node: ViewInstance | null) => void;
  onEverything: () => void;
  onUndo: (id: string, vendor: string) => void;
  onPayers: () => void;
  onOwnDesign: (what: string) => void;
  stepRef?: Ref<ViewInstance>;
  ceilingAt?: (y: number) => void;
}

/** The card's one thing: an overdue payment, else the soonest due, in words (budget-a-spec.md §5). */
export function cardSays(ledger: Ledger, locale: string): { id: string; words: string } | null {
  const next = nextPayment(ledger);
  if (next == null) return null;
  const vendor = VENDORS[next.vendor].name;
  const amount = whole(next.amount, locale);
  const date = days.short(next.due, locale);
  if (isOverdue(next)) return { id: next.id, words: say.overdue(vendor, next.what, amount, date) };
  if (next.due === nextDay(TODAY))
    return { id: next.id, words: say.dueTomorrow(vendor, next.what, amount, date) };
  return { id: next.id, words: say.dueOn(vendor, next.what, amount, date) };
}

/** A changed figure washes Tint for 1.6 s; with Reduce motion it changes at once (sc-85, sc-93). */
function Wash({ on, onDone, children }: { on: boolean; onDone: () => void; children: ReactNode }) {
  const reduced = useReducedMotion();
  const [fade] = useState(() => new Animated.Value(on && !reduced ? 1 : 0));

  useEffect(() => {
    if (!on) return undefined;
    if (reduced) {
      onDone();
      return undefined;
    }
    const run = Animated.timing(fade, {
      toValue: 0,
      delay: WASH_MS,
      duration: tokens.motionBase,
      useNativeDriver: true,
    });
    run.start(({ finished }) => {
      if (finished) onDone();
    });
    return () => run.stop();
  }, [on, reduced, fade, onDone]);

  return (
    <View>
      <Animated.View pointerEvents="none" style={[styles.wash, { opacity: fade }]} />
      {children}
    </View>
  );
}

function PerHead({
  m,
  locale,
  onWashed,
}: {
  m: BudgetModel;
  locale: string;
  onWashed: () => void;
}) {
  const head = perHeadOf(totalsOf(m.lines));
  const wash = m.wash;

  return (
    <Wash on={wash} onDone={onWashed}>
      <RowList
        items={[
          {
            key: 'settled',
            row: (
              <MoneyRow
                title={W.perHeadSettled}
                line={say.coming(GUESTS.coming)}
                value={money(head.settled, locale)}
                quiet
              />
            ),
          },
          {
            key: 'ifAll',
            row: (
              <MoneyRow
                title={W.perHeadIfAll}
                line={say.coming(HEADS_IF_ALL_COME)}
                value={money(head.ifAll, locale)}
                quiet
              />
            ),
          },
        ]}
      />
    </Wash>
  );
}

function DueNext({
  m,
  locale,
  count,
  link,
  actions,
}: {
  m: BudgetModel;
  locale: string;
  count: number;
  link: boolean;
  actions: HomeActions;
}) {
  const due = owed(m.ledger);
  const shown = PAYMENTS.filter(
    (payment) => due.includes(payment) || m.marked.includes(payment.id),
  ).slice(0, count);
  const everything = due.length;

  return (
    <Section
      title={W.dueNext}
      right={
        link && everything > 0 ? (
          <TextAction
            label={say.everythingDue(everything)}
            after="chevron"
            onPress={actions.onEverything}
            ref={actions.rowRef('everything')}
            testID="budget.everythingDue"
          />
        ) : undefined
      }
    >
      {shown.length === 0 ? (
        <Line text={W.nothingDue} />
      ) : (
        <RowList
          items={shown.map((payment) => {
            const vendor = VENDORS[payment.vendor].name;
            const marked = m.marked.includes(payment.id);
            const paid = m.ledger.paid[payment.id];
            return {
              key: payment.id,
              selected: marked,
              row: marked ? (
                <MoneyRow
                  title={vendor}
                  line={say.markedPaid(
                    money(paid?.amount ?? payment.amount, locale),
                    days.long(paid?.on ?? TODAY, locale),
                  )}
                  lead={<ShapeMark kind="yes" side={22} ink={tokens.colorInkOnDark} />}
                  lit
                  action={
                    canMark(m) ? (
                      <TextAction
                        label={W.undo}
                        renderMark={(ink) => <UndoMark ink={ink} />}
                        onPress={() => actions.onUndo(payment.id, vendor)}
                        accessibilityLabel={`${W.undo}, ${vendor}`}
                        testID={`budget.undo.${payment.id}`}
                      />
                    ) : undefined
                  }
                  testID={`budget.due.${payment.id}`}
                />
              ) : (
                <MoneyRow
                  ref={actions.rowRef(payment.id)}
                  title={vendor}
                  tag={
                    isOverdue(payment)
                      ? { node: <OverdueTag word={W.overdue} />, word: W.overdue }
                      : undefined
                  }
                  line={say.dueLine(payment.what, days.short(payment.due, locale))}
                  value={money(payment.amount, locale)}
                  opens={canMark(m)}
                  hint={canMark(m) ? W.markPaid : undefined}
                  onPress={canMark(m) ? () => actions.onRow(payment.id) : undefined}
                  testID={`budget.due.${payment.id}`}
                />
              ),
            };
          })}
        />
      )}
    </Section>
  );
}

function Ceiling({
  m,
  locale,
  onWashed,
  onLayout,
}: {
  m: BudgetModel;
  locale: string;
  onWashed: () => void;
  onLayout?: (event: LayoutChangeEvent) => void;
}) {
  const totals = totalsOf(m.lines);
  const limit = CEILINGS.whole;
  const state = ceilingState(limit, totals.settled, totals.ifAll);
  const sentence =
    state === 'over'
      ? say.over(whole(totals.settled, locale), whole(limit, locale))
      : state === 'overIf'
        ? say.overIf(
            whole(totals.settled, locale),
            whole(totals.ifAll, locale),
            whole(limit, locale),
          )
        : say.within(whole(totals.ifAll, locale), whole(limit, locale));

  return (
    <View onLayout={onLayout}>
      <Section title={W.ceiling}>
        <Wash on={m.wash} onDone={onWashed}>
          <MoneyRow
            title={say.ceilingRow(money(limit, locale))}
            line={sentence}
            lead={
              <CeilingMark
                state={state}
                side={22}
                ink={state === 'within' ? tokens.colorInkSecondary : tokens.colorAttentionText}
              />
            }
            tag={{ node: null, word: say.state(state) }}
            trail={<StateTag state={state} />}
            testID="budget.ceiling"
          />
        </Wash>
      </Section>
    </View>
  );
}

function AgainstPlan({
  m,
  locale,
  onWashed,
}: {
  m: BudgetModel;
  locale: string;
  onWashed: () => void;
}) {
  const totals = totalsOf(m.lines);
  const plan = planOf(m.ledger, totals);
  const rows: [string, string, string | undefined][] = [
    [
      W.planned,
      money(plan.planned, locale),
      totals.notPriced > 0 ? say.notPriced(totals.notPriced) : undefined,
    ],
    [W.committed, money(plan.committed, locale), W.whatQuoted],
    [W.paid, money(plan.paid, locale), say.paymentsMarked(plan.paidCount)],
    [W.stillToPay, money(plan.stillToPay, locale), say.paymentsScheduled(plan.scheduledCount)],
  ];

  return (
    <Section title={W.againstPlan}>
      <RowList
        items={rows.map(([title, value, line]) => ({
          key: title,
          row: (
            <Wash on={m.wash && title === W.planned} onDone={onWashed}>
              <MoneyRow
                title={title}
                line={line}
                value={value}
                quiet
                testID={`budget.plan.${title}`}
              />
            </Wash>
          ),
        }))}
      />
    </Section>
  );
}

function WhoIsPaying({
  m,
  locale,
  onPayers,
}: {
  m: BudgetModel;
  locale: string;
  onPayers: () => void;
}) {
  const payers = payersOf(m.lines);
  const line =
    m.payers === 'none'
      ? W.noPayersYet
      : m.payers === 'noCosts'
        ? say.payers(PAYERS.length)
        : say.payersLine(PAYERS.length, whole(payers.noPayer, locale));

  return (
    <Section title={W.whoIsPaying}>
      <MoneyRow
        title={W.whoIsPaying}
        line={line}
        opens
        onPress={onPayers}
        testID="budget.whoIsPaying"
      />
    </Section>
  );
}

function costLine(line: CostLine, locale: string): string {
  const amount = amountOf(line);
  if (amount.kind === 'notPriced') return W.noPriceYet;
  const rate =
    line.basis === 'fixed' || line.rate == null
      ? null
      : say.rate(money(line.rate, locale), line.basis);
  if (amount.kind === 'nothingYet') return say.nothingYetLine(rate ?? '', line.source);
  if (rate == null) return W.aFixedAmount;
  return say.quantity(rate, line.settled, line.source);
}

function Costs({
  m,
  locale,
  onWashed,
  onOwnDesign,
}: {
  m: BudgetModel;
  locale: string;
  onWashed: () => void;
  onOwnDesign: (what: string) => void;
}) {
  return (
    <Section title={W.costs}>
      {categoriesIn(m.lines).map((category) => {
        const state = categoryState(category, m.lines);
        return (
          <View key={category}>
            <CapsHead
              title={category}
              right={state == null ? undefined : <StateTag state={state} />}
            />
            <RowList
              items={m.lines
                .filter((line) => line.category === category)
                .map((line) => {
                  const amount = amountOf(line);
                  const trail =
                    amount.kind === 'notPriced' ? (
                      <MarkWord
                        mark={<RingMark dashed ink={tokens.colorInkSecondary} />}
                        word={W.notPriced}
                      />
                    ) : amount.kind === 'nothingYet' ? (
                      <MarkWord
                        mark={<RingMark ink={tokens.colorInkSecondary} />}
                        word={W.notCounted}
                      />
                    ) : (
                      <Amount text={money(amount.settled, locale)} />
                    );
                  const value =
                    amount.kind === 'priced'
                      ? money(amount.settled, locale)
                      : amount.kind === 'notPriced'
                        ? W.notPriced
                        : W.notCounted;
                  return {
                    key: line.key,
                    row: (
                      <Wash on={m.wash && line.key === LIVE_CHANGE.line} onDone={onWashed}>
                        <MoneyRow
                          title={line.name}
                          line={costLine(line, locale)}
                          value={value}
                          trail={trail}
                          opens
                          onPress={() => onOwnDesign(line.name)}
                          testID={`budget.cost.${line.key}`}
                        />
                      </Wash>
                    ),
                  };
                })}
            />
          </View>
        );
      })}
    </Section>
  );
}

/** sc-93's Budget in A: the title, the card, then flat rows in the spec's reading order. */
export function BudgetHome({
  m,
  event,
  locale,
  actions,
  onWashed,
}: {
  m: BudgetModel;
  event: Shown;
  locale: string;
  actions: HomeActions;
  onWashed: () => void;
}) {
  const { layout } = useShell();
  const phone = layout === 'phone';
  const title = (
    <PageTitle
      title={W.budget}
      line={phone ? event.name : undefined}
      right={m.showLive && m.link === 'live' ? <LiveMark word={W.live} /> : undefined}
    />
  );
  const live = m.liveLine ? <LiveLine words={liveWords(m.lines, locale)} /> : null;

  if (m.figures === 'never')
    return (
      <>
        {title}
        <Line text={W.neverLoaded} size={16} />
      </>
    );

  if (m.figures === 'loading')
    return (
      <>
        {title}
        <View style={styles.sunk} />
        <Line text={W.loading} />
        <RowShapes count={4} />
      </>
    );

  if (!m.costs)
    return (
      <>
        {title}
        <FirstCard event={event} />
        <WhoIsPaying m={m} locale={locale} onPayers={actions.onPayers} />
      </>
    );

  const totals = totalsOf(m.lines);
  const next = canMark(m) ? cardSays(m.ledger, locale) : null;
  const card = (
    <BudgetCard
      event={event}
      state={ceilingState(CEILINGS.whole, totals.settled, totals.ifAll)}
      notPriced={totals.notPriced}
      range={say.range(whole(totals.settled, locale), whole(totals.ifAll, locale))}
      says={next?.words ?? null}
      step={
        next == null
          ? null
          : {
              label: W.markPaid,
              onPress: () => actions.onStep(next.id),
              ...(actions.stepRef == null ? {} : { ref: actions.stepRef }),
            }
      }
    />
  );
  const notices = (
    <>
      {m.link !== 'live' && <Strip words={say.asOf(AS_OF.time, AS_OF.minutes)} />}
      {m.link === 'reconnecting' && <InfoLine text={W.reconnecting} glyph="refresh" />}
    </>
  );
  const after = (
    <>
      {m.link === 'offline' && <InfoLine text={W.markingNeedsConnection} />}
      {m.vendors === 'readOnly' && (
        <PlanLine
          text={W.readOnly}
          action={
            <TextAction
              label={W.seePlans}
              onPress={() => actions.onOwnDesign(W.seePlans)}
              testID="budget.seePlans"
            />
          }
        />
      )}
    </>
  );
  const ceilingAt = (event: LayoutChangeEvent) => actions.ceilingAt?.(event.nativeEvent.layout.y);

  if (phone)
    return (
      <>
        {title}
        {live}
        {notices}
        {card}
        {after}
        <PerHead m={m} locale={locale} onWashed={onWashed} />
        <DueNext m={m} locale={locale} count={3} link={m.vendors === 'on'} actions={actions} />
        <Ceiling m={m} locale={locale} onWashed={onWashed} onLayout={ceilingAt} />
        <AgainstPlan m={m} locale={locale} onWashed={onWashed} />
        <WhoIsPaying m={m} locale={locale} onPayers={actions.onPayers} />
        <Costs m={m} locale={locale} onWashed={onWashed} onOwnDesign={actions.onOwnDesign} />
      </>
    );

  const side = layout === 'landscape';
  return (
    <>
      {title}
      {live}
      {notices}
      {card}
      {after}
      <View style={[styles.columns, { gap: side ? tokens.space5xl : tokens.space3xl }]}>
        <View style={[styles.right, { width: side ? 340 : 306 }]}>
          <PerHead m={m} locale={locale} onWashed={onWashed} />
          <Ceiling m={m} locale={locale} onWashed={onWashed} />
          <DueNext m={m} locale={locale} count={2} link={false} actions={actions} />
          <AgainstPlan m={m} locale={locale} onWashed={onWashed} />
          <WhoIsPaying m={m} locale={locale} onPayers={actions.onPayers} />
        </View>
        <View style={styles.left}>
          <Costs m={m} locale={locale} onWashed={onWashed} onOwnDesign={actions.onOwnDesign} />
        </View>
      </View>
    </>
  );
}

/** sc-85's live line, what changed and by how much, as the colleague's rate arrives. */
export function liveWords(lines: readonly CostLine[], locale: string): string {
  const line = LINES.find((one) => one.key === LIVE_CHANGE.line);
  const before = totalsOf(LINES).settled;
  const after = totalsOf(lines).settled;
  const rate = say.rate(money(LIVE_CHANGE.to, locale), 'perHead');
  return say.rateChanged(
    line?.name ?? '',
    rate,
    money(Math.abs(after - before), locale),
    after >= before,
  );
}

export function paymentVendor(id: string): string {
  return VENDORS[paymentOf(id).vendor].name;
}

const styles = StyleSheet.create({
  wash: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: -10,
    right: -10,
    borderRadius: tokens.radiusRow,
    backgroundColor: tokens.colorAccentTint,
  },
  sunk: { height: 200, borderRadius: 26, backgroundColor: tokens.colorNeutralFill },
  columns: { flexDirection: 'row-reverse', alignItems: 'flex-start' },
  right: { gap: 18 },
  left: { flex: 1, minWidth: 0, gap: 18 },
});
