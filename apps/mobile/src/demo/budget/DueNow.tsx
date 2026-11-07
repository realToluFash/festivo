import { type RefObject, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '../../components/Buttons.tsx';
import { useSendingWords } from '../../components/ReadOut.tsx';
import type { ScreenReaderTarget } from '../../components/screenReaderFocus.ts';
import { Sheet } from '../../components/Sheet.tsx';
import { useShell } from '../../components/settingsShell.ts';
import { FocusedScreen, RowList, ShapeMark, TextAction } from '../../components/Summary.tsx';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import {
  type DueNowSheet,
  type Ledger,
  type MarkForm,
  days,
  isOverdue,
  isOwed,
  money,
  paymentOf,
} from './BudgetModel.ts';
import { EVENT_NAME, REMINDER, VENDORS } from './BudgetSample.ts';
import { MoneyRow, PlanLine, UndoMark } from './BudgetParts.tsx';
import { MarkFields, SheetHead, useMarkForm } from './MarkPaid.tsx';
import { W, say } from './BudgetWords.ts';

type Opener = RefObject<ScreenReaderTarget | null>;

/** sc-1331's Due now: the reminder's payments as they are now, each paid in one tap, and no total. */
export function DueNow({
  sheet,
  form,
  ledger,
  locale,
  opener,
  onClose,
  onPaid,
  onUndo,
  onDifferent,
  onCloseForm,
  onMark,
}: {
  sheet: DueNowSheet | null;
  form: MarkForm | null;
  ledger: Ledger;
  locale: string;
  opener: Opener;
  onClose: () => void;
  onPaid: (id: string) => void;
  onUndo: (id: string) => void;
  onDifferent: (id: string) => void;
  onCloseForm: () => void;
  onMark: (pence: number) => void;
}) {
  const { layout } = useShell();
  const [last, setLast] = useState(sheet);
  if (sheet != null && sheet !== last) setLast(sheet);
  const shown = sheet ?? last;
  const marking = form?.from === 'dueNow' ? form : null;
  const sending = marking?.phase === 'sending';
  const hook = useMarkForm(marking?.id ?? REMINDER.payments[0] ?? 'bloom-balance', onMark);
  useSendingWords(sending ? W.markingPaid : undefined);
  const list =
    shown == null ? null : (
      <DueList
        sheet={shown}
        ledger={ledger}
        locale={locale}
        on={{ onPaid, onUndo, onDifferent, onClose }}
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

function DueList({
  sheet,
  ledger,
  locale,
  on,
}: {
  sheet: DueNowSheet;
  ledger: Ledger;
  locale: string;
  on: {
    onPaid: (id: string) => void;
    onUndo: (id: string) => void;
    onDifferent: (id: string) => void;
    onClose: () => void;
  };
}) {
  if (sheet.done)
    return (
      <View style={styles.done}>
        <Text size={20} weight="bold" style={styles.doneTitle}>
          {W.nothingLeft}
        </Text>
        <TextAction
          label={say.everythingDueOn(EVENT_NAME)}
          onPress={on.onClose}
          testID="budget.dueNow.everything"
        />
      </View>
    );

  return (
    <View style={styles.list}>
      <Text size={15} weight="medium" style={styles.secondary}>
        {say.fromReminder(days.month(REMINDER.sent, locale), REMINDER.payments.length)}
      </Text>
      {sheet.readOnly && <PlanLine text={W.readOnly} />}
      <RowList
        items={REMINDER.payments.map((id) => ({
          key: id,
          selected: sheet.marked.includes(id),
          row: <DueRow id={id} sheet={sheet} ledger={ledger} locale={locale} on={on} />,
        }))}
      />
    </View>
  );
}

function DueRow({
  id,
  sheet,
  ledger,
  locale,
  on,
}: {
  id: string;
  sheet: DueNowSheet;
  ledger: Ledger;
  locale: string;
  on: {
    onPaid: (id: string) => void;
    onUndo: (id: string) => void;
    onDifferent: (id: string) => void;
  };
}) {
  const payment = paymentOf(id);
  const vendor = VENDORS[payment.vendor].name;
  const amount = money(payment.amount, locale);
  const due = days.short(payment.due, locale);
  const base = isOverdue(payment)
    ? say.overdueSince(payment.what, due, EVENT_NAME)
    : say.dueOnEvent(payment.what, due, EVENT_NAME);

  if (sheet.marked.includes(id))
    return (
      <MoneyRow
        title={vendor}
        line={say.markedRow(money(ledger.paid[id]?.amount ?? payment.amount, locale))}
        lead={<ShapeMark kind="yes" side={22} ink={tokens.colorInkOnDark} />}
        lit
        action={
          sheet.readOnly ? undefined : (
            <TextAction
              label={W.undo}
              renderMark={(ink) => <UndoMark ink={ink} />}
              onPress={() => on.onUndo(id)}
              accessibilityLabel={`${W.undo}, ${vendor}`}
              testID={`budget.dueNow.undo.${id}`}
            />
          )
        }
      />
    );

  const paid = ledger.paid[id];
  const refused = sheet.refused.includes(id);
  const changed = refused
    ? W.cancelled
    : paid != null
      ? say.paidBy(paid.by, days.month(paid.on, locale))
      : ledger.cancelled.includes(id)
        ? W.cancelledWord
        : null;
  const owed = isOwed(ledger, id) && !sheet.readOnly;

  return (
    <View>
      <MoneyRow
        title={vendor}
        line={changed == null ? base : `${base} · ${changed}`}
        value={amount}
      />
      {owed && (
        <View style={styles.actions}>
          <TextAction
            label={W.paidOne}
            onPress={() => on.onPaid(id)}
            accessibilityLabel={`${W.paidOne}, ${vendor}, ${amount}`}
            testID={`budget.dueNow.paid.${id}`}
          />
          <TextAction
            label={W.paidDifferent}
            onPress={() => on.onDifferent(id)}
            accessibilityLabel={`${W.paidDifferent}, ${vendor}`}
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
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: tokens.spaceXl,
    paddingBottom: tokens.spaceXs,
  },
  done: { gap: tokens.spaceSm },
  doneTitle: { lineHeight: 20 * 1.25 },
});
