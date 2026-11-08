import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { type RefObject, useEffect, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  type TextInputInstance,
  View,
  type ViewInstance,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '../../components/Buttons.tsx';
import { Field, focusChecked, TextField } from '../../components/Field.tsx';
import { Glyph } from '../../components/Glyph.tsx';
import { useSendingWords } from '../../components/ReadOut.tsx';
import {
  type ScreenReaderTarget,
  moveScreenReaderFocus,
} from '../../components/screenReaderFocus.ts';
import { Sheet } from '../../components/Sheet.tsx';
import { useShell } from '../../components/settingsShell.ts';
import { FocusedScreen, TextAction } from '../../components/Summary.tsx';
import { type TextHandle, Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import {
  type MarkForm,
  checkAmount,
  currencySymbol,
  dateTooLate,
  days,
  money,
  paymentOf,
  referenceTooLong,
  typedAmount,
} from './BudgetModel.ts';
import { COLLEAGUE, EVENT_NAME, TODAY, VENDORS } from './BudgetSample.ts';
import { AlertBox, MoneyRow } from './BudgetParts.tsx';
import { MomentBox } from '../events/EventsPick.tsx';
import { W, say } from './BudgetWords.ts';

type Opener = RefObject<ScreenReaderTarget | null>;

export interface MarkInput {
  amount: string;
  reference: string;
  amountError: string | null;
  referenceError: string | null;
  on: string;
  dateError: string | null;
}

/** sc-88's form, its checks before anything is sent: an amount above 0 at the currency's decimals, a reference of 100 at most. */
export function useMarkForm(
  id: string,
  onMark: (pence: number, on: string) => void,
  startOn: string = TODAY,
) {
  const scheduled = paymentOf(id).amount;
  const fresh = (): MarkInput => ({
    amount: typedAmount(scheduled),
    reference: '',
    amountError: null,
    referenceError: null,
    on: startOn,
    dateError: null,
  });
  const [input, setInput] = useState<MarkInput>(fresh);
  const [forId, setForId] = useState(id);
  if (forId !== id) {
    setForId(id);
    setInput(fresh());
  }
  const amountRef = useRef<TextInputInstance>(null);
  const referenceRef = useRef<TextInputInstance>(null);

  const submit = () => {
    const amount = checkAmount(input.amount);
    const long = referenceTooLong(input.reference);
    const late = dateTooLate(input.on);
    setInput((now) => ({
      ...now,
      amountError: amount.ok ? null : W.amountWrong,
      referenceError: long ? W.referenceLong : null,
      dateError: late ? W.dateLate : null,
    }));
    if (!amount.ok) focusChecked(amountRef);
    else if (long) focusChecked(referenceRef);
    else if (!late) onMark(amount.pence, input.on);
  };

  return { input, setInput, amountRef, referenceRef, submit, scheduled };
}

type FormHook = ReturnType<typeof useMarkForm>;

export function MarkFields({
  form,
  hook,
  locale,
  headRef,
  sending,
}: {
  form: MarkForm;
  hook: FormHook;
  locale: string;
  headRef?: RefObject<TextHandle | null>;
  sending: boolean;
}) {
  const payment = paymentOf(form.id);
  const { input, setInput, scheduled, amountRef, referenceRef, submit } = hook;
  const typed = checkAmount(input.amount);
  const diff = typed.ok ? typed.pence - scheduled : 0;

  return (
    <View style={styles.fields}>
      <Text ref={headRef} size={15} weight="medium" style={[styles.secondary, styles.lineHeight]}>
        {say.paymentFor(VENDORS[payment.vendor].name, payment.what, EVENT_NAME)}
      </Text>
      <MoneyRow
        title={W.scheduled}
        line={say.due(days.short(payment.due, locale))}
        value={money(payment.amount, locale)}
      />
      {form.phase === 'refused' ? (
        <AlertBox text={form.refusal === 'paid' ? W.alreadyPaid(COLLEAGUE) : W.cancelled} />
      ) : (
        <>
          <Field label={W.amountPaid} error={input.amountError}>
            <View>
              <TextField
                ref={amountRef}
                value={input.amount}
                onChangeText={(amount) =>
                  setInput((now) => ({ ...now, amount, amountError: null }))
                }
                keyboardType="decimal-pad"
                wrong={input.amountError != null}
                submitting={sending}
                style={styles.prefixed}
                accessibilityLabel={W.amountPaid}
                testID="budget.mark.amount"
              />
              <View style={styles.prefix} pointerEvents="none">
                <Text size={16} weight="medium" accessible={false} style={styles.secondary}>
                  {currencySymbol(locale)}
                </Text>
              </View>
            </View>
          </Field>
          {diff !== 0 && (
            <Text size={14} weight="semibold" style={styles.lineHeight}>
              {diff > 0 ? say.more(money(diff, locale)) : say.less(money(-diff, locale))}
            </Text>
          )}
          <Field label={W.datePaid} error={input.dateError}>
            <DatePaid
              on={input.on}
              locale={locale}
              onPick={(on) => setInput((now) => ({ ...now, on, dateError: null }))}
            />
          </Field>
          <Field label={W.reference} error={input.referenceError}>
            <TextField
              ref={referenceRef}
              value={input.reference}
              onChangeText={(reference) =>
                setInput((now) => ({ ...now, reference, referenceError: null }))
              }
              wrong={input.referenceError != null}
              submitting={sending}
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={submit}
              accessibilityLabel={W.reference}
              testID="budget.mark.reference"
            />
          </Field>
        </>
      )}
    </View>
  );
}

function asDate(day: string): Date {
  return new Date(`${day}T12:00:00Z`);
}

/** Today by default; the device's own calendar, earlier allowed and never later (sc-93, Decided 7 Nov). */
function DatePaid({
  on,
  locale,
  onPick,
}: {
  on: string;
  locale: string;
  onPick: (day: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const latest = asDate(TODAY);
  const take = (picked: Date) => onPick(picked.toISOString().slice(0, 10));
  const press = () => {
    if (Platform.OS !== 'android') {
      setOpen(!open);
      return;
    }
    DateTimePickerAndroid.open({
      value: asDate(on),
      mode: 'date',
      maximumDate: latest,
      timeZoneName: 'UTC',
      onChange: (event, picked) => {
        if (event.type === 'set' && picked != null) take(picked);
      },
    });
  };

  return (
    <View style={styles.date}>
      <MomentBox
        label={W.datePaid}
        mode="date"
        value={on}
        locale={locale}
        height={48}
        onPress={press}
        testID="budget.mark.date"
      />
      {open && (
        <>
          <DateTimePicker
            value={asDate(on)}
            mode="date"
            display="inline"
            maximumDate={latest}
            timeZoneName="UTC"
            locale={locale}
            onChange={(_event, picked) => picked != null && take(picked)}
          />
          <TextAction label={W.done} onPress={() => setOpen(false)} testID="budget.mark.dateDone" />
        </>
      )}
    </View>
  );
}

/** Mark paid as each layout draws it: a sheet on the iPhone, a centred 540 upright, a panel docked on the right on its side. */
export function MarkPaid({
  form,
  locale,
  opener,
  onClose,
  onMark,
}: {
  form: MarkForm | null;
  locale: string;
  opener: Opener;
  onClose: () => void;
  onMark: (pence: number, on: string) => void;
}) {
  const { layout } = useShell();
  const shown = form?.from === 'card' ? form : null;
  const [lastId, setLastId] = useState(shown?.id ?? null);
  if (shown != null && shown.id !== lastId) setLastId(shown.id);

  if (layout === 'landscape')
    return shown == null ? null : (
      <Docked key={shown.id} form={shown} locale={locale} onClose={onClose} onMark={onMark} />
    );

  return (
    <OpenForm
      key={lastId ?? 'none'}
      form={shown}
      locale={locale}
      opener={opener}
      onClose={onClose}
      onMark={onMark}
    />
  );
}

function OpenForm({
  form,
  locale,
  opener,
  onClose,
  onMark,
}: {
  form: MarkForm | null;
  locale: string;
  opener: Opener;
  onClose: () => void;
  onMark: (pence: number, on: string) => void;
}) {
  const { layout } = useShell();
  const [last, setLast] = useState<MarkForm | null>(form);
  if (form != null && form !== last) setLast(form);
  const showing = form ?? last;
  const hook = useMarkForm(showing?.id ?? 'bloom-balance', onMark, showing?.on);
  const sending = form?.phase === 'sending';
  const refused = showing?.phase === 'refused';
  useSendingWords(sending ? W.markingPaid : undefined);

  if (layout === 'phone')
    return (
      <Sheet
        open={form != null}
        onClose={sending ? () => undefined : onClose}
        scrimLabel={W.close}
        held={sending}
        opener={opener}
        headingTakesFocus
        testID="budget.mark"
      >
        <ScrollView
          contentContainerStyle={styles.sheet}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <SheetHead title={W.markPaid} onClose={onClose} off={sending} />
          {showing != null && (
            <MarkFields form={showing} hook={hook} locale={locale} sending={sending} />
          )}
          {refused ? (
            <TextAction label={W.close} onPress={onClose} testID="budget.mark.close" />
          ) : (
            <PrimaryButton
              label={sending ? W.markingPaid : W.markPaid}
              busy={sending}
              onPress={hook.submit}
              testID="budget.mark.send"
            />
          )}
        </ScrollView>
      </Sheet>
    );

  return (
    <FocusedScreen
      open={form != null}
      title={W.markPaid}
      cancels={!refused}
      waits={sending}
      verb={
        refused
          ? { label: W.close, on: true, onPress: onClose, testID: 'budget.mark.close' }
          : {
              label: W.markPaid,
              on: true,
              busy: sending,
              onPress: hook.submit,
              testID: 'budget.mark.send',
            }
      }
      onCancel={onClose}
      opener={opener}
      testID="budget.mark"
    >
      {showing != null && (
        <MarkFields form={showing} hook={hook} locale={locale} sending={sending} />
      )}
    </FocusedScreen>
  );
}

export function SheetHead({
  title,
  onClose,
  off = false,
  headRef,
}: {
  title: string;
  onClose: () => void;
  off?: boolean;
  headRef?: RefObject<TextHandle | null>;
}) {
  return (
    <View style={styles.head}>
      <Text
        ref={headRef}
        size={22}
        weight="bold"
        accessibilityRole="header"
        style={[styles.grow, styles.headTitle]}
      >
        {title}
      </Text>
      <Pressable
        onPress={off ? undefined : onClose}
        disabled={off}
        style={({ pressed }) => [styles.close, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={W.close}
        accessibilityState={{ disabled: off }}
        testID="budget.sheet.close"
      >
        <Glyph name="x" size={18} ink={tokens.colorInk} weight={2.4} />
      </Pressable>
    </View>
  );
}

/** On its side: docked on the right with no scrim, the list beside it still readable (sc-93). */
function Docked({
  form,
  locale,
  onClose,
  onMark,
}: {
  form: MarkForm;
  locale: string;
  onClose: () => void;
  onMark: (pence: number, on: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const hook = useMarkForm(form.id, onMark, form.on);
  const head = useRef<TextHandle>(null);
  const sending = form.phase === 'sending';
  const refused = form.phase === 'refused';
  useSendingWords(sending ? W.markingPaid : undefined);
  useEffect(() => {
    const timer = setTimeout(() => moveScreenReaderFocus(head.current), 300);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View
      style={[styles.docked, { top: insets.top + tokens.spaceXl }]}
      accessibilityViewIsModal={false}
      onAccessibilityEscape={sending ? undefined : onClose}
      testID="budget.mark"
    >
      <View style={styles.nav}>
        {refused ? (
          <View style={styles.navSide} />
        ) : (
          <NavButton label={W.cancel} off={sending} onPress={onClose} testID="budget.mark.cancel" />
        )}
        <Text ref={head} size={17} weight="bold" accessibilityRole="header" style={styles.navTitle}>
          {W.markPaid}
        </Text>
        <NavButton
          label={refused ? W.close : W.markPaid}
          strong
          busy={sending}
          onPress={refused ? onClose : hook.submit}
          testID={refused ? 'budget.mark.close' : 'budget.mark.send'}
        />
      </View>
      <ScrollView
        contentContainerStyle={styles.dockedBody}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <MarkFields form={form} hook={hook} locale={locale} sending={sending} />
      </ScrollView>
    </View>
  );
}

function NavButton({
  label,
  onPress,
  strong = false,
  busy = false,
  off = false,
  testID,
  ref,
}: {
  label: string;
  onPress: () => void;
  strong?: boolean;
  busy?: boolean;
  off?: boolean;
  testID: string;
  ref?: RefObject<ViewInstance | null>;
}) {
  const ink = busy
    ? tokens.colorInkSecondary
    : off
      ? tokens.colorInkTertiary
      : tokens.colorAccentText;

  return (
    <Pressable
      ref={ref}
      onPress={busy || off ? undefined : onPress}
      disabled={off}
      style={({ pressed }) => [styles.navSide, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityState={{ disabled: off, busy }}
      accessibilityLabel={label}
      testID={testID}
    >
      <Text
        size={17}
        weight={strong ? 'semibold' : 'medium'}
        accessible={false}
        style={{ color: ink }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  secondary: { color: tokens.colorInkSecondary },
  pressed: { opacity: tokens.opacityPressed },
  lineHeight: { lineHeight: 15 * 1.45 },
  fields: { gap: 14 },
  date: { gap: tokens.spaceSm },
  prefixed: { paddingLeft: 34 },
  prefix: {
    position: 'absolute',
    left: 14,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  sheet: {
    gap: tokens.spaceXl,
    paddingHorizontal: tokens.spaceXxl,
    paddingTop: 26,
    paddingBottom: 30,
  },
  head: {
    minHeight: tokens.sizeHit,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceLg,
  },
  headTitle: { letterSpacing: 22 * -0.015, lineHeight: 22 * 1.2 },
  close: {
    width: tokens.sizeHit,
    height: tokens.sizeHit,
    borderRadius: tokens.sizeHit / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorInset,
  },
  docked: {
    position: 'absolute',
    right: tokens.spaceMd,
    bottom: tokens.spaceMd,
    width: 400,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: tokens.colorCard,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
    ...tokens.elevationNative.popover.ios,
    elevation: tokens.elevationNative.popover.android.elevation,
  },
  nav: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spaceXs,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colorBorder,
  },
  navSide: {
    minWidth: tokens.sizeHit,
    minHeight: tokens.sizeHit,
    paddingHorizontal: tokens.spaceMd,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: { flex: 1, textAlign: 'center' },
  dockedBody: { padding: tokens.spaceXxl, paddingBottom: tokens.space6xl },
});
