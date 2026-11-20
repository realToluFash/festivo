import { formatEventDate } from '@soirely/domain';
import { type RefObject, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ScrollView,
  type ScrollViewInstance,
  StyleSheet,
  type TextInputInstance,
  View,
  type ViewInstance,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CountryPicker } from '../../components/CountryPicker.tsx';
import { NoteBox, SelectBox, TypeChoices } from '../../components/EventEdits.tsx';
import { Field, TextField, focusChecked } from '../../components/Field.tsx';
import { Legend, SheetBody, SheetLayer } from '../../components/FormLayers.tsx';
import { useFocusedFieldInSight } from '../../components/focusedFieldInSight.ts';
import { type Picking, PickerLayer, pick } from '../../components/MomentPick.tsx';
import { Notice } from '../../components/Notice.tsx';
import {
  type ScreenReaderTarget,
  moveScreenReaderFocus,
} from '../../components/screenReaderFocus.ts';
import { Pill } from '../../components/SettingsParts.tsx';
import { FocusedScreen, TextAction } from '../../components/Summary.tsx';
import { tokens } from '../../theme/tokens.ts';
import { Choices, CurrencySearch, useEditGap } from '../events/EventEdits.tsx';
import { currencyRows } from '../events/EventsSample.ts';
import {
  BEST_WAYS,
  ENQUIRIES,
  type Enquiry,
  FOUND_VIA,
  PEOPLE,
  type Person,
  personOf,
} from './EnquiriesModel.ts';
import { W } from './EnquiriesWords.ts';
import { type NewStart, TODAY, blankFor, savedEnquiry, typedOf } from './EnquiryFormModel.ts';
import { Chips } from './EnquiryParts.tsx';
import {
  type EnquiryTyped,
  type FormField,
  NOTE_COUNTER_FROM,
  NOTE_MOST,
  type Refusals,
  type SameClient,
  counterWords,
  firstRefused,
  letters,
  refusalsOf,
  sameClient,
} from './EnquiryRules.ts';
import { nextMadeId } from './made.ts';

const SAVING_MS = 1200;

type Status = 'editing' | 'saving' | 'noConnection';
type ListOpen = 'type' | 'currency' | 'assigned';

/** New enquiry, or Edit enquiry filled from the page: Save checks every field before it sends. */
export function EnquiryForm({
  open,
  viewer,
  start,
  editing,
  locale,
  opener,
  onClose,
  onSaved,
  onOpenSame,
}: {
  open: boolean;
  viewer: Person;
  start: NewStart | null;
  editing: Enquiry | null;
  locale: string;
  opener: RefObject<ScreenReaderTarget | null>;
  onClose: () => void;
  onSaved: (enquiry: Enquiry) => void;
  onOpenSame: (id: string) => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const gap = useEditGap();
  const savedDate = editing?.date ?? null;
  const [typed, setTyped] = useState<EnquiryTyped>(
    () => start?.typed ?? (editing == null ? blankFor(viewer) : typedOf(editing)),
  );
  const [flagged, setFlagged] = useState<ReadonlySet<FormField>>(() =>
    start?.tried === true
      ? new Set(Object.keys(refusalsOf(start.typed, TODAY)) as FormField[])
      : new Set(),
  );
  const [status, setStatus] = useState<Status>(() =>
    start?.saving === true ? 'saving' : start?.offline === true ? 'noConnection' : 'editing',
  );
  const [offline, setOffline] = useState(start?.offline === true);
  const [left, setLeft] = useState(start?.left ?? { phone: false, email: false });
  const [list, setList] = useState<ListOpen | null>(null);
  const [picking, setPicking] = useState<Picking | null>(null);
  const [target, setTarget] = useState<{ field: FormField } | null>(() => {
    const first = start?.refused === 'contact' ? 'phone' : (start?.refused ?? null);
    if (first != null) return { field: first };

    return start?.keys === true ? { field: 'name' } : null;
  });
  const nameRef = useRef<TextInputInstance>(null);
  const numberRef = useRef<TextInputInstance>(null);
  const emailRef = useRef<TextInputInstance>(null);
  const mindRef = useRef<TextInputInstance>(null);
  const guestsRef = useRef<TextInputInstance>(null);
  const whereRef = useRef<TextInputInstance>(null);
  const amountRef = useRef<TextInputInstance>(null);
  const dateRef = useRef<ViewInstance>(null);
  const scroll = useRef<ScrollViewInstance>(null);
  const offset = useRef(0);
  useFocusedFieldInSight(scroll, offset);
  const saved = useRef(onSaved);
  useEffect(() => {
    saved.current = onSaved;
  }, [onSaved]);

  const busy = status === 'saving';
  const now = refusalsOf(typed, TODAY, savedDate);
  const shown: Refusals = Object.fromEntries(
    Object.entries(now).filter(([field]) => flagged.has(field as FormField)),
  );
  const same = (by: 'phone' | 'email') =>
    left[by] ? sameClient(ENQUIRIES, by, typed, viewer, editing?.id ?? null) : null;
  const manages = viewer.role !== 'member';

  useEffect(() => {
    if (target == null) return;
    const typedIn: Partial<Record<FormField, RefObject<TextInputInstance | null>>> = {
      name: nameRef,
      phone: numberRef,
      email: emailRef,
      mind: mindRef,
      guests: guestsRef,
      where: whereRef,
      budget: amountRef,
    };
    const input = typedIn[target.field];
    if (input != null) focusChecked(input);
    else if (target.field === 'date') moveScreenReaderFocus(dateRef.current);
  }, [target]);

  useEffect(() => {
    if (status !== 'saving' || start?.saving === true) return undefined;
    const later = setTimeout(() => {
      saved.current(savedEnquiry(typed, viewer, editing, nextMadeId()));
    }, SAVING_MS);

    return () => clearTimeout(later);
  }, [status, start, typed, viewer, editing]);

  const change = (next: Partial<EnquiryTyped>) => {
    if (busy) return;
    setTyped((was) => ({ ...was, ...next }));
  };
  const leave = (...fields: FormField[]) => {
    const refused = fields.filter((field) => now[field] != null);
    if (flagged.size === 0 || refused.length === 0) return;
    setFlagged((was) => new Set([...was, ...refused]));
  };
  const save = (online = !offline) => {
    if (busy) return;
    const found = refusalsOf(typed, TODAY, savedDate);
    const first = firstRefused(found);
    if (first != null) {
      setFlagged(new Set(Object.keys(found) as FormField[]));
      setTarget({ field: first });
      return;
    }
    setStatus(online ? 'saving' : 'noConnection');
  };
  const closeList = () => setList(null);
  const people = Object.values(PEOPLE);
  const nameOf = (person: Person) => (person.id === viewer.id ? W.you(person.name) : person.name);
  const assigned = personOf(typed.assignedTo);

  const over =
    picking != null
      ? {
          layer: <PickerLayer picking={picking} locale={locale} onClose={() => setPicking(null)} />,
          onClose: () => setPicking(null),
        }
      : list != null
        ? {
            layer: (
              <SheetLayer onClose={closeList} label={W.cancel}>
                <SheetBody
                  title={
                    list === 'type' ? W.eventType : list === 'currency' ? W.currency : W.assignedTo
                  }
                  close={W.cancel}
                  onClose={closeList}
                  closeTestID="enquiry.form.sheet.close"
                >
                  {list === 'type' ? (
                    <TypeChoices
                      type={typed.type}
                      onPick={(type) => {
                        change({ type: type === typed.type ? null : type });
                        closeList();
                      }}
                      testID="enquiry.form.type"
                    />
                  ) : list === 'currency' ? (
                    <CurrencySearch
                      code={typed.currency}
                      rows={currencyRows(typed.currency)}
                      onPick={(currency) => {
                        change({ currency });
                        closeList();
                      }}
                      testID="enquiry.form.currency"
                    />
                  ) : (
                    <Choices
                      items={people.map((person) => ({ key: person.id, title: nameOf(person) }))}
                      on={typed.assignedTo}
                      onPick={(assignedTo) => {
                        change({ assignedTo });
                        closeList();
                      }}
                      testID="enquiry.form.assigned"
                    />
                  )}
                </SheetBody>
              </SheetLayer>
            ),
            onClose: closeList,
          }
        : null;

  return (
    <FocusedScreen
      gap={gap}
      open={open}
      title={editing == null ? W.newEnquiry : W.editEnquiry}
      verb={null}
      waits={busy}
      onCancel={onClose}
      cancelTestID="enquiry.form.cancel"
      opener={opener}
      over={over}
      fills
      testID="enquiry.form"
    >
      <ScrollView
        ref={scroll}
        style={styles.fill}
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={16}
        onScroll={(event) => {
          offset.current = event.nativeEvent.contentOffset.y;
        }}
        showsVerticalScrollIndicator={false}
      >
        {status === 'noConnection' && (
          <Notice
            tone="attention"
            mark="!"
            body={W.noConnection}
            announce
            action={{
              label: W.tryAgain,
              onPress: () => {
                setOffline(false);
                save(true);
              },
              testID: 'enquiry.form.tryAgain',
            }}
          />
        )}
        <Field label={W.clientName} error={shown.name}>
          <TextField
            ref={nameRef}
            accessibilityLabel={W.clientName}
            value={typed.name}
            onChangeText={(name) => change({ name })}
            onBlur={() => leave('name')}
            wrong={shown.name != null}
            submitting={busy}
            autoCapitalize="words"
            autoComplete="name"
            testID="enquiry.form.name"
          />
        </Field>
        <Field label={W.phone} error={shown.phone}>
          <View style={styles.phone}>
            <View style={styles.country}>
              <CountryPicker
                label={t('verifyPhone.countryLabel')}
                value={typed.country}
                onChange={(country) => change({ country })}
                disabled={busy}
                withCallingCode
                testID="enquiry.form.phone.country"
              />
            </View>
            <TextField
              ref={numberRef}
              style={styles.number}
              accessibilityLabel={W.phone}
              {...(shown.contact == null || shown.phone != null
                ? {}
                : { accessibilityHint: shown.contact })}
              value={typed.number}
              onChangeText={(number) => change({ number })}
              onBlur={() => {
                setLeft((was) => ({ ...was, phone: true }));
                leave('phone', 'contact');
              }}
              wrong={shown.phone != null || shown.contact != null}
              submitting={busy}
              keyboardType="phone-pad"
              textContentType="telephoneNumber"
              autoComplete="tel"
              testID="enquiry.form.phone.number"
            />
          </View>
        </Field>
        <Same same={same('phone')} onOpen={onOpenSame} />
        <Field label={W.email} error={shown.email ?? shown.contact} help={W.contactHint}>
          <TextField
            ref={emailRef}
            accessibilityLabel={W.email}
            value={typed.email}
            onChangeText={(email) => change({ email })}
            onBlur={() => {
              setLeft((was) => ({ ...was, email: true }));
              leave('email', 'contact');
            }}
            wrong={shown.email != null || shown.contact != null}
            submitting={busy}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            testID="enquiry.form.email"
          />
        </Field>
        <Same same={same('email')} onOpen={onOpenSame} />
        {editing == null && (
          <Field
            label={W.mind}
            pill={W.optional}
            error={shown.mind}
            help={
              letters(typed.mind) >= NOTE_COUNTER_FROM
                ? [W.mindHint, counterWords(letters(typed.mind), NOTE_MOST)]
                : W.mindHint
            }
          >
            <NoteBox
              ref={mindRef}
              accessibilityLabel={W.mind}
              value={typed.mind}
              onChangeText={(mind) => change({ mind })}
              onBlur={() => leave('mind')}
              wrong={shown.mind != null}
              submitting={busy}
              testID="enquiry.form.mind"
            />
          </Field>
        )}
        <View style={styles.divider}>
          <Legend text={W.aboutEvent} line={W.aboutEventLine} />
        </View>
        <Field label={W.bestWay} pill={W.optional}>
          <Chips
            items={BEST_WAYS.map((key) => ({ key, title: W.bestWays[key] }))}
            on={typed.bestWay}
            onPick={(bestWay) => change({ bestWay })}
            off={busy}
            testID="enquiry.form.bestWay"
          />
        </Field>
        <Field label={W.eventType} pill={W.optional}>
          <SelectBox
            label={W.eventType}
            value={typed.type == null ? null : t(`eventTypes.${typed.type}`)}
            placeholder={W.chooseType}
            onPress={() => !busy && setList('type')}
            testID="enquiry.form.type"
          />
        </Field>
        <Field label={W.date} pill={W.optional} error={shown.date}>
          <SelectBox
            ref={dateRef}
            label={W.date}
            value={
              typed.date === '' ? null : formatEventDate(`${typed.date}T12:00:00Z`, 'UTC', locale)
            }
            placeholder={W.chooseDate}
            wrong={shown.date != null}
            onPress={() =>
              !busy &&
              pick(
                {
                  title: W.date,
                  mode: 'date',
                  field: { date: typed.date === '' ? TODAY : typed.date, time: '12:00' },
                  take: (next) => change({ date: next.date }),
                },
                setPicking,
              )
            }
            testID="enquiry.form.date"
          />
        </Field>
        {typed.date !== '' && (
          <View style={styles.clear}>
            <TextAction
              label={W.clearDate}
              onPress={() => change({ date: '' })}
              testID="enquiry.form.date.clear"
            />
          </View>
        )}
        <Field label={W.guests} pill={W.optional} error={shown.guests}>
          <TextField
            ref={guestsRef}
            accessibilityLabel={W.guests}
            value={typed.guests}
            onChangeText={(guests) => change({ guests })}
            onBlur={() => leave('guests')}
            wrong={shown.guests != null}
            submitting={busy}
            keyboardType="number-pad"
            style={styles.short}
            testID="enquiry.form.guests"
          />
        </Field>
        <Field label={W.where} pill={W.optional} error={shown.where} help={W.whereHint}>
          <TextField
            ref={whereRef}
            accessibilityLabel={W.where}
            value={typed.where}
            onChangeText={(where) => change({ where })}
            onBlur={() => leave('where')}
            wrong={shown.where != null}
            submitting={busy}
            testID="enquiry.form.where"
          />
        </Field>
        <Field label={W.budget} pill={W.optional} error={shown.budget}>
          <View style={styles.budget}>
            <TextField
              ref={amountRef}
              accessibilityLabel={W.budget}
              value={typed.amount}
              onChangeText={(amount) => change({ amount })}
              onBlur={() => leave('budget')}
              wrong={shown.budget != null}
              submitting={busy}
              keyboardType="decimal-pad"
              style={[styles.amount, styles.figures]}
              testID="enquiry.form.amount"
            />
            <View style={styles.currency}>
              <SelectBox
                label={W.currency}
                value={typed.currency}
                onPress={() => !busy && setList('currency')}
                testID="enquiry.form.currency"
              />
            </View>
          </View>
        </Field>
        <Field label={W.foundVia} pill={W.optional}>
          <Chips
            items={FOUND_VIA.map((key) => ({ key, title: W.foundVias[key] }))}
            on={typed.foundVia}
            onPick={(foundVia) => change({ foundVia })}
            off={busy}
            testID="enquiry.form.foundVia"
          />
        </Field>
        {manages && (
          <Field label={W.assignedTo}>
            <SelectBox
              label={W.assignedTo}
              value={assigned == null ? W.notAssigned : nameOf(assigned)}
              onPress={() => !busy && setList('assigned')}
              testID="enquiry.form.assigned"
            />
          </Field>
        )}
      </ScrollView>
      <View style={[styles.foot, { paddingBottom: Math.max(12, insets.bottom > 0 ? 12 : 34) }]}>
        <Pill
          label={busy ? W.saving : editing == null ? W.saveEnquiry : W.saveChanges}
          busy={busy}
          onPress={() => save()}
          testID="enquiry.form.save"
        />
      </View>
    </FocusedScreen>
  );
}

function Same({ same, onOpen }: { same: SameClient | null; onOpen: (id: string) => void }) {
  if (same == null) return null;

  return same.seen ? (
    <Notice
      tone="quiet"
      mark={tokens.marks.info.glyph}
      body={W.sameSeen(
        same.by,
        same.enquiry.client,
        personOf(same.enquiry.assignedTo)?.name ?? null,
      )}
      announce
      action={{
        label: W.openIt,
        onPress: () => onOpen(same.enquiry.id),
        testID: `enquiry.form.same.${same.by}.open`,
      }}
    />
  ) : (
    <Notice tone="quiet" mark={tokens.marks.info.glyph} body={W.sameHidden(same.by)} announce />
  );
}

const styles = StyleSheet.create({
  fill: { flexGrow: 1, flexShrink: 1 },
  figures: { fontVariant: ['tabular-nums'] },
  body: {
    gap: tokens.spaceXl,
    paddingTop: tokens.spaceXl,
    paddingHorizontal: tokens.spaceXxl,
    paddingBottom: tokens.space5xl,
  },
  phone: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spaceSm },
  country: { flexGrow: 1, flexBasis: 140 },
  number: { flexGrow: 2, flexBasis: 180 },
  divider: {
    paddingTop: tokens.spaceXl,
    borderTopWidth: 1,
    borderTopColor: tokens.colorBorder,
  },
  clear: { flexDirection: 'row', marginTop: -tokens.spaceLg },
  short: { maxWidth: 200 },
  budget: { flexDirection: 'row', gap: tokens.spaceSm },
  amount: { flexGrow: 1, flexShrink: 1, minWidth: 0 },
  currency: { width: 128 },
  foot: {
    gap: 8,
    paddingTop: 12,
    paddingHorizontal: tokens.spaceXxl,
    borderTopWidth: 1,
    borderTopColor: tokens.colorBorder,
    backgroundColor: tokens.colorCard,
  },
});
