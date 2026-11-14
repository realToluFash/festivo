import {
  ApiError,
  ApiUnreachableError,
  type Guest,
  type GuestDetails,
  type TaggedGuest,
} from '@soirely/api-client';
import {
  GUEST_NAME_MAXIMUM,
  MOST_COMPANIONS,
  type Problem,
  type Problems,
  firstProblem,
  newGuestOf,
  problemsOf,
  violationProblems,
} from '@soirely/domain';
import { type RefObject, useRef, useState } from 'react';
import { StyleSheet, View, type TextInputInstance, type ViewInstance } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import { phoneProblemMessage } from '../phoneProblem.ts';
import type { ScreenReaderTarget } from './screenReaderFocus.ts';
import { tokens } from '../theme/tokens.ts';
import { AlertLine } from './AlertLine.tsx';
import { Field, TextField, focusRefused } from './Field.tsx';
import { LanguageField, languageOver } from './GuestLanguage.tsx';
import { PhoneEntry } from './PhoneEntry.tsx';
import { FocusedScreen } from './SummaryOverlays.tsx';
import { TextAction } from './SummaryRows.tsx';
import { Text } from './Text.tsx';
import { type Values, editOf, typedOf, valuesOf } from './guestValues.ts';

export type GuestFormMode = { kind: 'add' } | { kind: 'edit'; tagged: TaggedGuest };

type Ask = 'duplicate' | 'discard' | null;

type Refusal = 'offline' | 'notSaved' | null;

/** Add guest and Edit (sc-1468, sc-3773) with sc-3790's Language: refused before sending, a duplicate asked about, a colleague's change held at the top, and offline refused with nothing typed lost. Group and Needs are not on it (sc-5519). */
export function GuestForm({
  open,
  mode,
  eventId,
  startCountry,
  opener,
  onClose,
  onSaved,
}: {
  open: boolean;
  mode: GuestFormMode;
  eventId: string;
  startCountry: string;
  opener: RefObject<ScreenReaderTarget | null>;
  onClose: () => void;
  onSaved: (saved: { guest: Guest; tagged: TaggedGuest | null }) => void;
}) {
  const { t } = useTranslation();
  const editing = mode.kind === 'edit' ? mode.tagged : null;
  const [first] = useState(() => valuesOf(editing?.guest ?? null, startCountry));
  const [values, setValues] = useState(first);
  const [tag, setTag] = useState(editing?.tag ?? null);
  const [problems, setProblems] = useState<Problems>({});
  const [ask, setAsk] = useState<Ask>(null);
  const [refusal, setRefusal] = useState<Refusal>(null);
  const [theirs, setTheirs] = useState<GuestDetails | null>(null);
  const [sending, setSending] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const nameField = useRef<TextInputInstance>(null);
  const emailField = useRef<TextInputInstance>(null);
  const numberField = useRef<TextInputInstance>(null);
  const picker = useRef<ViewInstance>(null);
  const companionFields = useRef(new Map<number, TextInputInstance>());
  const changed = JSON.stringify(values) !== JSON.stringify(first);
  const chose = editing?.guest.chosenLanguage ?? null;
  const count = values.companions.length;

  function set(next: Partial<Values>) {
    setValues((was) => ({ ...was, ...next }));
    setProblems({});
    setRefusal(null);
  }

  function focus(key: string) {
    if (key === 'fullName') focusRefused(nameField);
    else if (key === 'email') focusRefused(emailField);
    else if (key === 'mobile') focusRefused(numberField);
    else {
      const at = Number(key.slice('companion-'.length));
      const field = companionFields.current.get(at);
      if (field != null) focusRefused({ current: field });
    }
  }

  function words(key: string): string | undefined {
    const problem: Problem | undefined = problems[key];

    if (problem == null) return undefined;
    if (typeof problem === 'object') return problem.refused;
    if (problem === 'blank') return t('guestList.blankName');
    if (problem === 'tooLong') return t('guestList.nameTooLong', { most: GUEST_NAME_MAXIMUM });
    if (problem === 'emailShape') return t('forms.emailShape');

    return (
      phoneProblemMessage(
        problem === 'phoneTooShort'
          ? 'tooShort'
          : problem === 'phoneTooLong'
            ? 'tooLong'
            : 'noCountry',
        values.country,
        t,
      ) ?? undefined
    );
  }

  async function save(allowDuplicate = false, over: string | null = tag) {
    const typed = typedOf(values);
    const found = problemsOf(typed);
    const at = firstProblem(found, count);

    if (at != null) {
      setProblems(found);
      focus(at);
      return;
    }
    setAsk(null);
    setRefusal(null);
    setSending(true);
    try {
      if (editing == null) {
        const guest = await api.addGuest(eventId, newGuestOf(typed, allowDuplicate));
        onSaved({ guest, tagged: null });
      } else {
        const tagged = await api.updateGuest(
          eventId,
          editing.guest.id,
          editOf(values, allowDuplicate),
          over ?? editing.tag,
        );
        onSaved({ guest: tagged.guest, tagged });
      }
    } catch (error) {
      if (error instanceof ApiUnreachableError) setRefusal('offline');
      else if (error instanceof ApiError && error.code === 'guest_already_listed')
        setAsk('duplicate');
      else if (error instanceof ApiError && error.status === 412 && editing != null) {
        try {
          const fresh = await api.guest(eventId, editing.guest.id);
          setTheirs(fresh.guest);
          setTag(fresh.tag);
        } catch {
          setRefusal('notSaved');
        }
      } else if (error instanceof ApiError && error.code === 'validation_failed') {
        const refused = violationProblems(error.problem.violations ?? [], typed);
        const first = firstProblem(refused, count);
        setProblems(refused);
        if (first != null) focus(first);
      } else setRefusal('notSaved');
    } finally {
      setSending(false);
    }
  }

  const cancel = () => (changed ? setAsk('discard') : onClose());
  const adding = editing == null;

  return (
    <FocusedScreen
      open={open}
      title={adding ? t('guestList.addGuest') : t('guestList.editGuest')}
      verb={{
        label: adding ? t('guestList.addGuest') : t('guestList.save'),
        on: !sending,
        onPress: () => void save(),
        testID: 'guest.form.save',
      }}
      waits={sending}
      onCancel={cancel}
      cancelTestID="guest.form.cancel"
      opener={opener}
      ask={
        ask === 'discard'
          ? {
              title: t('guestList.discardTitle'),
              line: t('guestList.discardLine', { name: first.fullName || values.fullName }),
              keep: { label: t('guestList.keepEditing'), testID: 'guest.form.keepEditing' },
              confirm: {
                label: t('guestList.discard'),
                removes: true,
                testID: 'guest.form.discard',
              },
              onKeep: () => setAsk(null),
              onConfirm: onClose,
            }
          : ask === 'duplicate'
            ? {
                title: t('guestList.duplicate', { name: values.fullName.trim() }),
                line: t('guestList.duplicateLine'),
                keep: { label: t('guestList.changeName'), testID: 'guest.form.changeName' },
                confirm: {
                  label: adding ? t('guestList.addAnyway') : t('guestList.saveAnyway'),
                  testID: 'guest.form.anyway',
                },
                onKeep: () => {
                  setAsk(null);
                  focus('fullName');
                },
                onConfirm: () => void save(true),
              }
            : null
      }
      over={
        choosing
          ? languageOver(
              t('language.label'),
              t('guestList.cancel'),
              t('guestList.languageNotSet'),
              values.language,
              (code) => {
                set({ language: code });
                setChoosing(false);
              },
              () => setChoosing(false),
            )
          : null
      }
      testID="guest.form"
    >
      {refusal === 'offline' && (
        <View style={styles.refusal} testID="guest.form.offline">
          <AlertLine text={t('guestList.offlineRefused')} />
          <Text size={15} weight="medium" style={styles.secondary}>
            {t('guestList.offlineRefusedLine')}
          </Text>
        </View>
      )}
      {refusal === 'notSaved' && (
        <AlertLine text={adding ? t('guestList.notAdded') : t('guestList.notSaved')} />
      )}
      {theirs != null && (
        <View style={styles.conflict} testID="guest.form.conflict">
          <AlertLine text={t('guestList.conflict')} />
          <Text size={15} weight="medium" style={styles.secondary}>
            {t('guestList.conflictLine')}
          </Text>
          <View style={styles.choices}>
            <TextAction
              label={t('guestList.useTheirs')}
              onPress={() => {
                setValues(valuesOf(theirs, startCountry));
                setTheirs(null);
              }}
              testID="guest.form.useTheirs"
            />
            <TextAction
              label={t('guestList.keepMine')}
              onPress={() => {
                setTheirs(null);
                void save(false, tag);
              }}
              testID="guest.form.keepMine"
            />
          </View>
        </View>
      )}
      <Field label={t('account.fullName')} error={words('fullName')}>
        <TextField
          ref={nameField}
          accessibilityLabel={t('account.fullName')}
          value={values.fullName}
          onChangeText={(fullName) => set({ fullName })}
          wrong={problems.fullName != null}
          submitting={sending}
          autoComplete="name"
          textContentType="name"
          testID="guest.form.fullName"
        />
      </Field>
      <Field
        label={t('guestList.emailAddress')}
        pill={t('eventForm.optional')}
        error={words('email')}
      >
        <TextField
          ref={emailField}
          accessibilityLabel={t('guestList.emailAddress')}
          value={values.email}
          onChangeText={(email) => set({ email })}
          wrong={problems.email != null}
          submitting={sending}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          testID="guest.form.email"
        />
      </Field>
      <PhoneEntry
        label={t('guestList.mobileNumber')}
        pill={t('eventForm.optional')}
        help={adding ? '' : t('guestList.keepsLink')}
        country={values.country}
        error={words('mobile')}
        errorOn={problems.mobile === 'noCountry' ? 'country' : 'number'}
        submitting={sending}
        ref={numberField}
        pickerRef={picker}
        onCountry={(country) => set({ country })}
        onNumber={(number) => set({ number })}
        onSubmit={() => void save()}
        testID="guest.form.mobile"
      />
      <LanguageField value={values.language} chose={chose} onOpen={() => setChoosing(true)} />
      <View style={styles.companions}>
        <View style={styles.legend}>
          <Text size={15} weight="bold" accessibilityRole="header">
            {t('guestList.companionsTitle')}
          </Text>
          <Text size={14.5} weight="medium" style={[styles.secondary, styles.figures]}>
            {count === 0
              ? t('guestList.noneYet', { most: MOST_COMPANIONS })
              : t('guestList.ofMost', { n: count, most: MOST_COMPANIONS })}
          </Text>
        </View>
        {values.companions.map((one, at) => {
          const host = values.fullName.trim();

          return (
            <Field
              key={one.id ?? `new-${at}`}
              label={t('guestList.companionName', { nth: at + 1, total: count })}
              error={words(`companion-${at}`)}
            >
              <View style={styles.companion}>
                <TextField
                  ref={(node) => {
                    if (node == null) companionFields.current.delete(at);
                    else companionFields.current.set(at, node);
                  }}
                  style={styles.grow}
                  accessibilityLabel={t('guestList.companionName', { nth: at + 1, total: count })}
                  value={one.name}
                  placeholder={
                    host === ''
                      ? ''
                      : at === 0
                        ? t('guestList.guestOf', { host })
                        : t('guestList.guestOfNth', { host, nth: at + 1 })
                  }
                  onChangeText={(name) =>
                    set({
                      companions: values.companions.map((was, here) =>
                        here === at ? { ...was, name } : was,
                      ),
                    })
                  }
                  wrong={problems[`companion-${at}`] != null}
                  submitting={sending}
                  testID={`guest.form.companion.${at}`}
                />
                <TextAction
                  label={t('guestList.remove')}
                  onPress={() =>
                    set({ companions: values.companions.filter((_, here) => here !== at) })
                  }
                  testID={`guest.form.companion.${at}.remove`}
                />
              </View>
            </Field>
          );
        })}
        {count < MOST_COMPANIONS ? (
          <TextAction
            label={t('guestList.addCompanion')}
            glyph="plus"
            onPress={() => set({ companions: [...values.companions, { id: null, name: '' }] })}
            testID="guest.form.addCompanion"
          />
        ) : (
          <Text size={14.5} weight="medium" style={styles.secondary}>
            {t('guestList.mostCompanions', { most: MOST_COMPANIONS })}
          </Text>
        )}
      </View>
    </FocusedScreen>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  secondary: { color: tokens.colorInkSecondary },
  figures: { fontVariant: ['tabular-nums'] },
  refusal: { gap: tokens.spaceXs },
  conflict: {
    gap: tokens.spaceSm,
    padding: tokens.spaceLg,
    borderRadius: tokens.radiusInset,
    borderWidth: 1,
    borderColor: tokens.colorAttentionBorder,
    backgroundColor: tokens.colorAttentionTint,
  },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spaceLg },
  companions: { gap: 8 },
  legend: { gap: 4 },
  companion: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
