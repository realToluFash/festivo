import {
  ORGANISATION_FIELDS,
  ORGANISATION_NAME_MAXIMUM,
  type OrganisationDetails,
  type OrganisationField,
  organisationChanges,
} from '@soirely/domain';
import { type Ref, type RefObject, useEffect, useRef, useState } from 'react';
import { StyleSheet, type TextInputInstance, View, type ViewInstance } from 'react-native';

import { focusPicker } from '../../components/CountryPicker.tsx';
import {
  Field,
  FieldError,
  focusChecked,
  keysStayDown,
  TextField,
} from '../../components/Field.tsx';
import { useReadOut } from '../../components/ReadOut.tsx';
import { SETTLED_MS } from '../../components/Screen.tsx';
import {
  type ScreenReaderTarget,
  moveScreenReaderFocus,
} from '../../components/screenReaderFocus.ts';
import { Text } from '../../components/Text.tsx';
import { checkAll, type FieldErrors } from '../../kit/formChecks.ts';
import { tokens } from '../../theme/tokens.ts';
import { Glyph } from '../../components/Glyph.tsx';
import { PickerEdge } from '../PickerEdge.tsx';
import {
  type CardSaid,
  cardWords,
  detailProblem,
  MALFORMED_CONTACT,
  type Picked,
  savedWords,
  SEND_MS,
} from './OrganisationModel.ts';
import { choiceName, PICKERS, PickerList } from './OrganisationPicker.tsx';
import { DETAILS_WORDS as W } from './OrganisationWords.ts';
import { discardTitle } from './RolesSample.ts';
import {
  type AskProps,
  CardSays,
  FocusedScreen,
  Line,
  OnCard,
  Row,
  RowList,
  Section,
  SectionHead,
  SummaryCard,
} from './Summary.tsx';

const hidden = {
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
} as const;

/** The organisation's card: its tile, name and contact, or what was just done in their place; Edit details for those who may. */
export function OrganisationCard({
  details,
  said,
  role,
  manages,
  pane,
  stepRef,
  onEdit,
}: {
  details: OrganisationDetails;
  said: CardSaid | null;
  role: string;
  manages: boolean;
  pane: boolean;
  stepRef: Ref<ViewInstance>;
  onEdit: () => void;
}) {
  const words = cardWords(details, said);

  useReadOut(words.said ? `${words.says}. ${words.line}` : null, { quietAtMount: true });

  return (
    <SummaryCard
      height={196}
      step={
        manages
          ? { label: W.edit, onPress: onEdit, testID: 'organisation.edit', ref: stepRef }
          : null
      }
      testID="organisation.card"
    >
      {words.said ? (
        <>
          <CardSays text={words.says} size={pane ? 26 : 24} heading />
          <OnCard text={words.line} />
        </>
      ) : (
        <View style={styles.who}>
          <CardTile side={pane ? 64 : 56} />
          <View style={styles.words}>
            <CardSays text={words.says} size={pane ? 26 : 22} heading />
            <OnCard text={words.line} />
          </View>
        </View>
      )}
      {!manages && (
        <View style={styles.readOnly}>
          <View style={styles.lock} {...hidden}>
            <Glyph name="lock" size={16} ink={tokens.colorInkOnDark} weight={2.2} />
          </View>
          <View style={styles.grow}>
            <OnCard text={W.readOnly(role)} />
          </View>
        </View>
      )}
    </SummaryCard>
  );
}

/** The organisation's tile as the Settings list draws it, white on Confetti: a rounded square, not a face. */
function CardTile({ side }: { side: number }) {
  return (
    <View
      style={[styles.tile, { width: side, height: side, borderRadius: Math.round(side * 0.286) }]}
      {...hidden}
    >
      <Text size={Math.round(side * 0.36)} weight="bold" accessible={false} style={styles.accent}>
        IE
      </Text>
    </View>
  );
}

export function DetailRows({ details }: { details: OrganisationDetails }) {
  const rows: [Picked, string][] = [
    ['countryCode', W.country],
    ['currency', W.currency],
    ['timezone', W.timezone],
    ['locale', W.language],
  ];

  return (
    <Section title={W.details} foot={W.defaultsNote}>
      <RowList
        items={rows.map(([field, label]) => ({
          key: field,
          row: (
            <Row
              title={choiceName(field, details[field])}
              line={label}
              weight="medium"
              testID={`organisation.detail.${field}`}
            />
          ),
        }))}
      />
    </Section>
  );
}

type Typed = 'name' | 'contactAddress';

export interface DetailsOpening {
  picking: Picked | null;
  contactWrong: boolean;
  currencyBlank: boolean;
}

export const FRESH_DETAILS: DetailsOpening = {
  picking: null,
  contactWrong: false,
  currencyBlank: false,
};

/** Editing the details on a screen of their own; a picker's list opens in the same surface and comes back on a pick. */
export function DetailsScreen({
  saved,
  open,
  opening,
  opener,
  onClose,
  onSaved,
}: {
  saved: OrganisationDetails;
  open: boolean;
  opening: DetailsOpening;
  opener: RefObject<ScreenReaderTarget | null>;
  onClose: () => void;
  onSaved: (details: OrganisationDetails, words: string) => void;
}) {
  const [given, setGiven] = useState<Record<Typed, string>>(() => ({
    name: saved.name,
    contactAddress: opening.contactWrong ? MALFORMED_CONTACT : saved.contactAddress,
  }));
  const typed = useRef({ ...given });
  const [picked, setPicked] = useState<Record<Picked, string>>({
    countryCode: saved.countryCode,
    currency: saved.currency,
    timezone: saved.timezone,
    locale: saved.locale,
  });
  const [picking, setPicking] = useState<Picked | null>(opening.picking);
  const [errors, setErrors] = useState<FieldErrors<OrganisationField>>(() => ({
    ...(opening.contactWrong && { contactAddress: W.contactInvalid }),
    ...(opening.currencyBlank && { currency: W.currencyBlank }),
  }));
  const [pressed, setPressed] = useState(opening.contactWrong || opening.currencyBlank);
  const [saving, setSaving] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [changes, setChanges] = useState(() => changeCount(saved, picked, given));
  const nameRef = useRef<TextInputInstance>(null);
  const contactRef = useRef<TextInputInstance>(null);
  const rowRefs = useRef<Partial<Record<Picked, ViewInstance | null>>>({});
  const cameBack = useRef<Picked | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  useEffect(() => {
    if (!open || !opening.contactWrong) return;
    const focus = setTimeout(() => focusChecked(contactRef), SETTLED_MS);

    return () => clearTimeout(focus);
  }, [open, opening.contactWrong]);

  useEffect(() => {
    if (!open || !opening.currencyBlank) return;
    const focus = setTimeout(
      () => moveScreenReaderFocus(rowRefs.current.currency ?? null),
      SETTLED_MS,
    );

    return () => clearTimeout(focus);
  }, [open, opening.currencyBlank]);

  useEffect(() => {
    const field = cameBack.current;
    if (picking != null || field == null) return;
    cameBack.current = null;
    const focus = setTimeout(
      () => moveScreenReaderFocus(rowRefs.current[field] ?? null),
      SETTLED_MS,
    );

    return () => clearTimeout(focus);
  }, [picking]);

  function setError(field: OrganisationField, message: string | null): void {
    setErrors((previous) => {
      const next = { ...previous };
      if (message == null) delete next[field];
      else next[field] = message;

      return next;
    });
  }

  function edited(field: Typed, text: string): void {
    typed.current[field] = text;
    setChanges(changeCount(saved, picked, typed.current));
    if (errors[field] != null && detailProblem(field, text) == null) setError(field, null);
  }

  function left(field: Typed): void {
    if (pressed) setError(field, detailProblem(field, typed.current[field]));
  }

  function backFrom(field: Picked, code?: string): void {
    cameBack.current = field;
    setPicking(null);
    if (code == null) return;
    const next = { ...picked, [field]: code };
    setPicked(next);
    setChanges(changeCount(saved, next, typed.current));
    setError(field, null);
  }

  function save(): void {
    if (saving) return;
    const values = { ...picked, ...typed.current };
    const found = checkAll(ORGANISATION_FIELDS, detailProblem, values);
    setPressed(true);
    setErrors(found.errors);
    if (found.first === 'name') focusChecked(nameRef);
    if (found.first === 'contactAddress') focusChecked(contactRef);
    if (found.first === 'currency') focusPicker({ current: rowRefs.current.currency ?? null });
    if (found.first != null) return;

    keysStayDown();
    setSaving(true);
    timer.current = setTimeout(() => {
      setSaving(false);
      onSaved(
        { ...saved, ...organisationChanges(saved, values) },
        savedWords(values.locale, saved.locale),
      );
    }, SEND_MS);
  }

  const ask: AskProps | null = discarding
    ? {
        title: discardTitle(changes),
        line: W.discardLine,
        keep: { label: W.keepEditing, testID: 'organisation.details.keep' },
        confirm: { label: W.discard, testID: 'organisation.details.discard', removes: true },
        onKeep: () => setDiscarding(false),
        onConfirm: onClose,
      }
    : null;

  if (picking != null)
    return (
      <FocusedScreen
        open={open}
        title={PICKERS[picking].label}
        back={W.editTitle}
        verb={null}
        onCancel={() => backFrom(picking)}
        cancelTestID={`${PICKERS[picking].testID}.back`}
        opener={opener}
        fills
      >
        <PickerList
          field={picking}
          value={picked[picking]}
          onChoose={(code) => backFrom(picking, code)}
        />
      </FocusedScreen>
    );

  const pickerRow = (field: Picked) => {
    const { label, testID } = PICKERS[field];
    const chosen = choiceName(field, picked[field]);
    const error = errors[field];

    return (
      <View>
        <PickerEdge wrong={error != null} flat>
          <Row
            ref={(row) => {
              rowRefs.current[field] = row;
            }}
            title={chosen}
            line={label}
            opens
            invalid={error != null}
            onPress={() => {
              setGiven({ ...typed.current });
              setPicking(field);
            }}
            accessibilityLabel={`${label}, ${chosen}`}
            testID={testID}
          />
        </PickerEdge>
        {error != null && <FieldError message={error} />}
      </View>
    );
  };

  return (
    <FocusedScreen
      open={open}
      title={W.editTitle}
      verb={{
        label: saving ? W.saving : W.save,
        on: changes > 0 && !saving,
        onPress: save,
        testID: 'organisation.details.save',
      }}
      onCancel={() => (changes > 0 ? setDiscarding(true) : onClose())}
      cancelTestID="organisation.details.cancel"
      opener={opener}
      ask={ask}
      testID="organisation.details"
    >
      <Field label={W.name} error={errors.name}>
        <TextField
          ref={nameRef}
          defaultValue={given.name}
          onChangeText={(text) => edited('name', text)}
          onBlur={() => left('name')}
          wrong={errors.name != null}
          submitting={saving}
          autoCapitalize="words"
          autoCorrect={false}
          spellCheck={false}
          maxLength={ORGANISATION_NAME_MAXIMUM}
          returnKeyType="next"
          onSubmitEditing={() => contactRef.current?.focus()}
          submitBehavior="submit"
          accessibilityLabel={W.name}
          testID="organisation.name"
        />
      </Field>
      {pickerRow('countryCode')}
      <Field label={W.contact} error={errors.contactAddress}>
        <TextField
          ref={contactRef}
          defaultValue={given.contactAddress}
          onChangeText={(text) => edited('contactAddress', text)}
          onBlur={() => left('contactAddress')}
          wrong={errors.contactAddress != null}
          submitting={saving}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          autoCorrect={false}
          spellCheck={false}
          returnKeyType="done"
          accessibilityLabel={W.contact}
          testID="organisation.contact"
        />
      </Field>
      <View style={styles.group}>
        <SectionHead title={W.defaults} />
        <RowList
          items={(['currency', 'timezone'] as const).map((field) => ({
            key: field,
            row: pickerRow(field),
          }))}
        />
        <Line size={14} text={W.defaultsNote} />
      </View>
      <View style={styles.group}>
        <SectionHead title={W.invitations} />
        {pickerRow('locale')}
        <Line size={14} text={W.languageHint} />
      </View>
    </FocusedScreen>
  );
}

function changeCount(
  saved: OrganisationDetails,
  picked: Record<Picked, string>,
  typed: Record<Typed, string>,
): number {
  return Object.keys(organisationChanges(saved, { ...picked, ...typed })).length;
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  words: { flex: 1, minWidth: 0, gap: 2 },
  who: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  tile: { alignItems: 'center', justifyContent: 'center', backgroundColor: tokens.colorCard },
  accent: { color: tokens.colorAccentText },
  readOnly: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spaceSm,
    marginTop: 'auto',
  },
  lock: { marginTop: 1 },
  group: { gap: tokens.spaceHair, paddingTop: tokens.spaceXs },
});
