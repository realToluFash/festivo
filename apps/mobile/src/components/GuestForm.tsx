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
  NO_NEEDS,
  type NeedsField,
  type NeedsProblems,
  type NeedsTyped,
  type Problem,
  type Problems,
  firstProblem,
  needsFailingCount,
  needsProblemsOf,
  needsViolations,
  problemsByWho,
  problemsOf,
  sameGroup,
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
import {
  type CountedGroup,
  GroupField,
  type PickProblem,
  GroupPicker,
  pickName,
  returnPick,
  shownProblem,
} from './GuestGroup.tsx';
import { NeedsSection, useNeedsRefs } from './GuestNeeds.tsx';
import { readOut } from './ReadOut.tsx';
import { moveScreenReaderFocus } from './screenReaderFocus.ts';
import { useShellLayout } from './settingsShell.ts';
import { FocusedScreen } from './SummaryOverlays.tsx';
import { TextAction } from './SummaryRows.tsx';
import { Text } from './Text.tsx';
import { type Values, addOf, editOf, typedOf, valuesOf } from './guestValues.ts';

export type GuestFormMode = { kind: 'add' } | { kind: 'edit'; tagged: TaggedGuest };

type Ask = 'duplicate' | 'discard' | null;

type Refusal = 'offline' | 'notSaved' | null;

/** Group's refusal on Save in the API's words, said as taken once the list read again has a group of the name made. */
type GroupRefusal = { made: string | null; line: string } | null;

/** Add guest and Edit (sc-1468, sc-3773) with sc-3790's Language and sc-5519's Group and Needs: refused before sending, a duplicate asked about, a colleague's change held at the top, and offline refused with nothing typed lost. */
export function GuestForm({
  open,
  mode,
  eventId,
  startCountry,
  groups,
  onGroupsStale,
  opener,
  onClose,
  onSaved,
}: {
  open: boolean;
  mode: GuestFormMode;
  eventId: string;
  startCountry: string;
  /** The event's groups with their people, as the list last read them. */
  groups: readonly CountedGroup[];
  /** Reads the list again, so the picker lists a group a colleague made meanwhile. */
  onGroupsStale: () => void;
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
  const [picking, setPicking] = useState(false);
  const [typedGroup, setTypedGroup] = useState('');
  const [returned, setReturned] = useState<PickProblem | null>(null);
  const [groupRefusal, setGroupRefusal] = useState<GroupRefusal>(null);
  const [needsProblems, setNeedsProblems] = useState<Record<string, NeedsProblems>>({});
  const [tried, setTried] = useState(false);
  const [opened, setOpened] = useState<ReadonlySet<string>>(new Set());
  const groupField = useRef<ViewInstance>(null);
  const needsRefs = useNeedsRefs();
  const wide = useShellLayout() === 'landscape';
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

  const needsOf = (who: string): NeedsTyped =>
    who === 'guest'
      ? values.needs
      : (values.companions[Number(who.slice(1))]?.needs ?? values.needs);

  /** After the first Save, a message clears once its field is valid; nothing new is said until the field is left. */
  function setNeeds(who: string, needs: NeedsTyped) {
    if (who === 'guest') setValues((was) => ({ ...was, needs }));
    else {
      const at = Number(who.slice(1));
      setValues((was) => ({
        ...was,
        companions: was.companions.map((one, here) => (here === at ? { ...one, needs } : one)),
      }));
    }
    setRefusal(null);
    if (!tried) return;
    const now = needsProblemsOf(needs);
    setNeedsProblems((was) => ({
      ...was,
      [who]: Object.fromEntries(
        Object.entries(was[who] ?? {}).filter(([field]) => now[field as NeedsField] != null),
      ),
    }));
  }

  function checkNeeds(who: string, field: NeedsField) {
    if (!tried) return;
    const problem = needsProblemsOf(needsOf(who))[field];
    setNeedsProblems((was) => ({ ...was, [who]: { ...was[who], [field]: problem } }));
  }

  function toggle(who: string) {
    setOpened((was) => {
      const after = new Set(was);
      if (after.has(who)) after.delete(who);
      else after.add(who);
      return after;
    });
  }

  function closePicker() {
    setPicking(false);
    setTypedGroup('');
    setReturned(null);
    setTimeout(() => moveScreenReaderFocus(groupField.current), 300);
  }

  function pickGroup(group: Values['group']) {
    set({ group });
    setGroupRefusal(null);
    closePicker();
  }

  /** The form's order: name, contacts, the guest's needs, then each companion's name and needs. */
  function firstFailing(found: Problems, needs: Record<string, NeedsProblems>): string | null {
    const needsAt = (who: string) => {
      const field = (['otherAllergy', 'otherDiet', 'otherAccess', 'note'] as const).find(
        (one) => needs[who]?.[one] != null,
      );
      return field == null ? null : `needs:${who}:${field}`;
    };
    const order = [
      ...['fullName', 'email', 'mobile'].map((key) => (found[key] == null ? null : key)),
      needsAt('guest'),
      ...values.companions.flatMap((_, at) => [
        found[`companion-${at}`] == null ? null : `companion-${at}`,
        needsAt(`c${at}`),
      ]),
    ];

    return order.find((key) => key != null) ?? null;
  }

  function refuse(found: Problems, needs: Record<string, NeedsProblems>) {
    setProblems(found);
    setNeedsProblems(needs);
    setOpened((was) => new Set([...was, ...Object.keys(needs)]));
    const count = Object.keys(found).length + needsFailingCount(needs);
    if (count > 0) readOut(t('guestNeeds.toFix', { count }));
    const at = firstFailing(found, needs);
    if (at == null) return;
    if (!at.startsWith('needs:')) {
      focus(at);
      return;
    }
    const [, who, field] = at.split(':') as [string, string, NeedsField];
    setTimeout(() => focusRefused(needsRefs(who)[field]), 300);
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
    const needs = problemsByWho([values.needs, ...values.companions.map((one) => one.needs)]);
    setTried(true);

    if (firstProblem(found, count) != null || Object.keys(needs).length > 0) {
      refuse(found, needs);
      return;
    }
    setNeedsProblems({});
    setAsk(null);
    setRefusal(null);
    setSending(true);
    try {
      if (editing == null) {
        const guest = await api.addGuest(eventId, addOf(values, allowDuplicate));
        onSaved({ guest, tagged: null });
      } else {
        const tagged = await api.updateGuest(
          eventId,
          editing.guest.id,
          editOf(values, allowDuplicate, editing.guest.group),
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
        const violations = error.problem.violations ?? [];
        const group = violations.find((one) => one.propertyPath.startsWith('group.'));
        if (group != null) {
          const pick = values.group;
          setGroupRefusal({
            made: pick != null && 'name' in pick ? pick.name : null,
            line: group.message,
          });
          onGroupsStale();
        }
        const refused = violationProblems(violations, typed);
        const needs = needsViolations(violations, needsOf);
        if (firstProblem(refused, count) != null || Object.keys(needs).length > 0)
          refuse(refused, needs);
        else if (group != null) setTimeout(() => moveScreenReaderFocus(groupField.current), 300);
      } else setRefusal('notSaved');
    } finally {
      setSending(false);
    }
  }

  const clash = groupRefusal?.made == null ? null : sameGroup(groups, groupRefusal.made);
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
        picking
          ? {
              layer: (
                <GroupPicker
                  guestName={values.fullName.trim() === '' ? null : values.fullName.trim()}
                  groups={groups}
                  pick={values.group}
                  typed={typedGroup}
                  problem={shownProblem(groups, typedGroup, returned)}
                  onTyped={(text) => {
                    setTypedGroup(text);
                    setReturned(null);
                  }}
                  onReturn={() => {
                    const result = returnPick(groups, typedGroup);
                    if ('problem' in result) setReturned(result.problem);
                    else pickGroup(result.pick);
                  }}
                  onPick={pickGroup}
                  onClose={closePicker}
                />
              ),
              onClose: closePicker,
            }
          : choosing
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
      <GroupField
        value={pickName(groups, values.group)}
        isNew={values.group != null && 'name' in values.group}
        error={
          groupRefusal == null
            ? undefined
            : clash == null
              ? groupRefusal.line
              : t('guestGroups.taken', { name: clash.name })
        }
        onOpen={() => setPicking(true)}
        fieldRef={groupField}
      />
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
      <NeedsSection
        title={t('guestNeeds.needs')}
        needs={values.needs}
        onChange={(next) => setNeeds('guest', next)}
        open={opened.has('guest')}
        onToggle={() => toggle('guest')}
        problems={needsProblems.guest ?? {}}
        fields={needsRefs('guest')}
        wide={wide}
        submitting={sending}
        onBlur={(field) => checkNeeds('guest', field)}
        testID="guest.form.needs"
      />
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
            <View key={one.id ?? `new-${at}`} style={styles.companionBlock}>
              <Field
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
                    onPress={() => {
                      set({ companions: values.companions.filter((_, here) => here !== at) });
                      setNeedsProblems({});
                      setOpened((was) => new Set([...was].filter((who) => !who.startsWith('c'))));
                    }}
                    testID={`guest.form.companion.${at}.remove`}
                  />
                </View>
              </Field>
              <NeedsSection
                title={t('guestNeeds.theirNeeds')}
                needs={one.needs}
                onChange={(next) => setNeeds(`c${at}`, next)}
                open={opened.has(`c${at}`)}
                onToggle={() => toggle(`c${at}`)}
                problems={needsProblems[`c${at}`] ?? {}}
                fields={needsRefs(`c${at}`)}
                wide={wide}
                submitting={sending}
                onBlur={(field) => checkNeeds(`c${at}`, field)}
                testID={`guest.form.companion.${at}.needs`}
              />
            </View>
          );
        })}
        {count < MOST_COMPANIONS ? (
          <TextAction
            label={t('guestList.addCompanion')}
            glyph="plus"
            onPress={() =>
              set({ companions: [...values.companions, { id: null, name: '', needs: NO_NEEDS }] })
            }
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
  companionBlock: { gap: 10 },
});
