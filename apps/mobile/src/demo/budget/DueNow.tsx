import { router } from 'expo-router';
import { type RefObject, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '../../components/Buttons.tsx';
import { useSendingWords } from '../../components/ReadOut.tsx';
import type { ScreenReaderTarget } from '../../components/screenReaderFocus.ts';
import { Sheet } from '../../components/Sheet.tsx';
import { useShell } from '../../components/settingsShell.ts';
import {
  FocusedScreen,
  Line,
  RowList,
  RowShapes,
  ShapeMark,
  TextAction,
} from '../../components/Summary.tsx';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import {
  AS_OF,
  type BudgetModel,
  type DueNowSheet,
  type Ledger,
  type MarkForm,
  type Refusal,
  days,
  dueItemOf,
  dueNowLocked,
  dueNowSettled,
  eventsOf,
  isOwed,
  money,
} from './BudgetModel.ts';
import { COLLEAGUE, EVENT_NAME, GALA, REMINDER, TODAY } from './BudgetSample.ts';
import {
  AlertBox,
  InfoLine,
  MoneyRow,
  OverdueTag,
  PlanLine,
  Strip,
  UndoMark,
} from './BudgetParts.tsx';
import { MarkFields, SheetHead, useMarkForm } from './MarkPaid.tsx';
import { W, say } from './BudgetWords.ts';

type Opener = RefObject<ScreenReaderTarget | null>;

/** sc-1331's Due now: the reminder's payments as they are now, each paid in one tap, and no total. */
export function DueNow({
  sheet,
  form,
  ledger,
  link,
  locale,
  opener,
  onClose,
  onRetry,
  onPaid,
  onUndo,
  onDifferent,
  onCloseForm,
  onMark,
}: {
  sheet: DueNowSheet | null;
  form: MarkForm | null;
  ledger: Ledger;
  link: BudgetModel['link'];
  locale: string;
  opener: Opener;
  onClose: () => void;
  onRetry: () => void;
  onPaid: (id: string) => void;
  onUndo: (id: string) => void;
  onDifferent: (id: string) => void;
  onCloseForm: () => void;
  onMark: (pence: number, on: string) => void;
}) {
  const { layout } = useShell();
  const [last, setLast] = useState(sheet);
  if (sheet != null && sheet !== last) setLast(sheet);
  const shown = sheet ?? last;
  const marking = form?.from === 'dueNow' ? form : null;
  const sending = marking?.phase === 'sending';
  const hook = useMarkForm(
    marking?.id ?? REMINDER.payments[0] ?? 'bloom-balance',
    onMark,
    marking?.on,
  );
  useSendingWords(sending ? W.markingPaid : undefined);
  const list =
    shown == null ? null : (
      <DueList
        sheet={shown}
        ledger={ledger}
        link={link}
        locale={locale}
        on={{ onPaid, onUndo, onDifferent, onClose, onRetry }}
      />
    );

  if (layout === 'phone')
    return (
      <Sheet
        open={sheet != null}
        onClose={marking == null ? onClose : onCloseForm}
        scrimLabel={W.close}
        held={sending}
        opener={opener}
        headingTakesFocus
        testID="budget.dueNow"
      >
        <ScrollView
          contentContainerStyle={styles.sheet}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {marking == null ? (
            <>
              <SheetHead title={W.dueNow} onClose={onClose} />
              {list}
            </>
          ) : (
            <>
              <SheetHead title={W.markPaid} onClose={onCloseForm} off={sending} />
              <MarkFields form={marking} hook={hook} locale={locale} sending={sending} />
              <PrimaryButton
                label={sending ? W.markingPaid : W.markPaid}
                busy={sending}
                onPress={hook.submit}
                testID="budget.mark.send"
              />
            </>
          )}
        </ScrollView>
      </Sheet>
    );

  return (
    <FocusedScreen
      open={sheet != null}
      title={marking == null ? W.dueNow : W.markPaid}
      cancels={marking != null}
      waits={sending}
      verb={
        marking == null
          ? { label: W.close, on: true, onPress: onClose, testID: 'budget.dueNow.close' }
          : {
              label: W.markPaid,
              on: true,
              busy: sending,
              onPress: hook.submit,
              testID: 'budget.mark.send',
            }
      }
      onCancel={marking == null ? onClose : onCloseForm}
      opener={opener}
      testID="budget.dueNow"
    >
      {marking == null ? (
        list
      ) : (
        <MarkFields form={marking} hook={hook} locale={locale} sending={sending} />
      )}
    </FocusedScreen>
  );
}

type RowActions = {
  onPaid: (id: string) => void;
  onUndo: (id: string) => void;
  onDifferent: (id: string) => void;
};

function DueList({
  sheet,
  ledger,
  link,
  locale,
  on,
}: {
  sheet: DueNowSheet;
  ledger: Ledger;
  link: BudgetModel['link'];
  locale: string;
  on: RowActions & { onClose: () => void; onRetry: () => void };
}) {
  if (sheet.load === 'loading')
    return (
      <View style={styles.list}>
        <Line text={W.loadingPayments} />
        <RowShapes count={4} />
      </View>
    );

  if (sheet.load === 'failed')
    return (
      <View style={styles.list}>
        <AlertBox text={W.paymentsNotLoaded} />
        <TextAction label={W.tryAgain} onPress={on.onRetry} testID="budget.dueNow.retry" />
      </View>
    );

  if (sheet.notFound === true)
    return (
      <View style={styles.list}>
        <Text size={16} weight="medium" accessibilityRole="header" style={styles.doneTitle}>
          {W.notFound}
        </Text>
        <TextAction
          label={W.goToEvents}
          onPress={() => router.replace('/demo/events')}
          testID="budget.dueNow.events"
        />
      </View>
    );

  const settled = dueNowSettled(sheet, ledger);
  const events = eventsOf(sheet.ids);

  return (
    <View style={styles.list}>
      {settled && (
        <Text size={20} weight="bold" accessibilityRole="header" style={styles.doneTitle}>
          {W.nothingLeftHead}
        </Text>
      )}
      {sheet.fromReminder && (
        <Text size={15} weight="medium" style={styles.secondary}>
          {say.fromReminder(days.month(sheet.sent, locale), sheet.ids.length, events.length)}
        </Text>
      )}
      {link !== 'live' && <Strip words={say.paymentsAsOf(AS_OF.time, AS_OF.minutes)} />}
      {link === 'offline' && <InfoLine text={W.paidNeedsConnection} status />}
      {link === 'reconnecting' && <InfoLine text={W.reconnectingPayments} glyph="refresh" status />}
      {sheet.readOnly && <PlanLine text={W.readOnly} />}
      <RowList
        items={sheet.ids.map((id) => ({
          key: id,
          selected: sheet.marked.includes(id),
          row: (
            <DueRow
              id={id}
              sheet={sheet}
              ledger={ledger}
              locked={dueNowLocked(sheet, link)}
              locale={locale}
              on={on}
            />
          ),
        }))}
      />
      {settled &&
        events.map((event) => (
          <TextAction
            key={event}
            label={say.everythingDueOn(event)}
            onPress={
              event === EVENT_NAME ? on.onClose : () => router.push(`/demo/events/${GALA.id}`)
            }
            testID={`budget.dueNow.everything.${event === EVENT_NAME ? 'wedding' : 'gala'}`}
          />
        ))}
    </View>
  );
}

const REFUSAL_WORDS: Record<Refusal, string> = {
  paid: W.alreadyPaid(COLLEAGUE),
  cancelled: W.cancelled,
  currency: W.wrongCurrency,
  plan: W.planRefused,
};

function DueRow({
  id,
  sheet,
  ledger,
  locked,
  locale,
  on,
}: {
  id: string;
  sheet: DueNowSheet;
  ledger: Ledger;
  /** Read only, or without a connection: no Paid, no Paid a different amount, no Undo. */
  locked: boolean;
  locale: string;
  on: RowActions;
}) {
  const item = dueItemOf(id);
  const amount = money(item.amount, locale, item.currency);
  const due = days.short(item.due, locale);
  const overdue = !item.gone && item.due < TODAY;
  const base = overdue
    ? say.overdueSince(item.what, due, item.event)
    : say.dueOnEvent(item.what, due, item.event);

  if (sheet.marked.includes(id))
    return (
      <MoneyRow
        title={item.vendor}
        line={say.markedRow(money(ledger.paid[id]?.amount ?? item.amount, locale, item.currency))}
        lead={<ShapeMark kind="yes" side={22} ink={tokens.colorInkOnDark} />}
        lit
        action={
          locked ? undefined : (
            <TextAction
              label={W.undo}
              renderMark={(ink) => <UndoMark ink={ink} />}
              onPress={() => on.onUndo(id)}
              accessibilityLabel={`${W.undo}, ${item.vendor}`}
              testID={`budget.dueNow.undo.${id}`}
            />
          )
        }
      />
    );

  const paid = ledger.paid[id];
  const refusal = sheet.refused[id];
  const changed = item.gone
    ? W.noLongerOnSchedule
    : paid != null
      ? say.paidBy(paid.by, days.month(paid.on, locale))
      : ledger.cancelled.includes(id)
        ? W.cancelledWord
        : null;
  const owed = !item.gone && isOwed(ledger, id) && !locked && refusal == null;
  const last = sheet.lastAbout.includes(id);
  const line = [item.gone ? `${item.what} · ${item.event}` : base, changed]
    .filter(Boolean)
    .join(' · ');

  return (
    <View>
      <MoneyRow
        title={item.vendor}
        tag={last ? { node: <OverdueTag word={W.overdueLast} />, word: W.overdueLast } : undefined}
        line={line}
        value={amount}
      />
      {refusal != null && (
        <View style={styles.refusal}>
          <AlertBox text={REFUSAL_WORDS[refusal]} />
        </View>
      )}
      {owed && (
        <View style={styles.actions}>
          <TextAction
            label={W.paidOne}
            onPress={() => on.onPaid(id)}
            accessibilityLabel={`${W.paidOne}, ${item.vendor}, ${amount}`}
            testID={`budget.dueNow.paid.${id}`}
          />
          <TextAction
            label={W.paidDifferent}
            onPress={() => on.onDifferent(id)}
            accessibilityLabel={`${W.paidDifferent}, ${item.vendor}`}
            testID={`budget.dueNow.different.${id}`}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  secondary: { color: tokens.colorInkSecondary },
  sheet: {
    gap: tokens.spaceXl,
    paddingHorizontal: tokens.spaceXxl,
    paddingTop: 26,
    paddingBottom: 30,
  },
  list: { gap: tokens.spaceMd },
  refusal: { paddingBottom: tokens.spaceSm },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: tokens.spaceXl,
    paddingBottom: tokens.spaceXs,
  },
  doneTitle: { lineHeight: 20 * 1.25 },
});
