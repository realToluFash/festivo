import {
  initials,
  ORGANISATION_FIELDS,
  ORGANISATION_NAME_MAXIMUM,
  type OrganisationDetails,
  type OrganisationField,
  organisationChanges,
  organisationProblem,
} from '@soirely/domain';
import { type TFunction } from 'i18next';
import { type Ref, type RefObject, useEffect, useRef, useState } from 'react';
import { StyleSheet, type TextInputInstance, View, type ViewInstance } from 'react-native';
import { useTranslation } from 'react-i18next';

import { checkAll, type FieldErrors } from '../kit/formChecks.ts';
import { type SaveOutcome } from '../kit/organisationSave.ts';
import { tokens } from '../theme/tokens.ts';
import { focusPicker } from './CountryPicker.tsx';
import { FailureLine } from './FailureLine.tsx';
import {
  Field,
  FieldError,
  focusChecked,
  focusRefused,
  keysStayDown,
  TextField,
} from './Field.tsx';
import { Glyph } from './Glyph.tsx';
import {
  type Choices,
  choiceName,
  type Picked,
  PickerList,
  usePickers,
} from './OrganisationPicker.tsx';
import { PickerEdge } from './PickerEdge.tsx';
import { useReadOut } from './ReadOut.tsx';
import { SETTLED_MS } from './Screen.tsx';
import { type ScreenReaderTarget, moveScreenReaderFocus } from './screenReaderFocus.ts';
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
  TextAction,
} from './Summary.tsx';
import { Text } from './Text.tsx';

const hidden = {
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
} as const;

/** What a save came to; the product's API answers it, and the demo's sample. */
export type DetailsOutcome =
  | Exclude<SaveOutcome, { kind: 'saved' }>
  | { kind: 'saved'; details: OrganisationDetails };

/** What the card says in place of the organisation, until the page is left. */
export type CardSaid = { kind: 'saved'; words: string } | { kind: 'transferred'; to: string };

/** What keeps a reader from changing the details: their role, or each sign-in rule that holds it back (sc-16265). */
export type HeldBack = { by: 'role'; role: string } | { by: 'rules'; rules: readonly string[] };

/** The organisation's card: its tile, name and contact, or what was just done in their place; Edit details for those who may. */
export function OrganisationCard({
  details,
  said,
  held,
  pane,
  stepRef,
  onEdit,
  onSecurity,
}: {
  details: OrganisationDetails;
  said: CardSaid | null;
  /** Null for a reader who may edit. */
  held: HeldBack | null;
  pane: boolean;
  stepRef: Ref<ViewInstance>;
  onEdit: () => void;
  onSecurity: () => void;
}) {
  const { t } = useTranslation();
  const words = cardWords(t, details, said);

  useReadOut(words.said ? `${words.says}. ${words.line}` : null, { quietAtMount: true });

  return (
    <SummaryCard
      height={196}
      step={
        held == null
          ? {
              label: t('orgGeneral.edit'),
              onPress: onEdit,
              testID: 'organisation.edit',
              ref: stepRef,
            }
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
          <CardTile name={details.name} side={pane ? 64 : 56} />
          <View style={styles.words}>
            <CardSays text={words.says} size={pane ? 26 : 22} heading />
            <OnCard text={words.line} />
          </View>
        </View>
      )}
      {held?.by === 'role' && (
        <LockRow words={t('orgGeneral.readOnly', { role: held.role })} testID="organisation.readOnly" />
      )}
      {held?.by === 'rules' &&
        held.rules.map((rule) => (
          <LockRow
            key={rule}
            words={t(
              rule === 'linking'
                ? 'orgGeneral.readOnlyUntilLinked'
                : 'orgGeneral.readOnlyUntilTwoFactor',
              { organisation: details.name },
            )}
            action={{
              label: t(rule === 'linking' ? 'signInRules.unlinkedLink' : 'signInRules.gateTurnOn'),
              onPress: onSecurity,
              testID: rule === 'linking' ? 'organisation.link' : 'organisation.turnOn',
            }}
            testID={`organisation.readOnly.${rule}`}
          />
        ))}
    </SummaryCard>
  );
}

function LockRow({
  words,
  action,
  testID,
}: {
  words: string;
  action?: { label: string; onPress: () => void; testID: string };
  testID: string;
}) {
  return (
    <View style={styles.readOnly} testID={testID}>
      <View style={styles.lock} {...hidden}>
        <Glyph name="lock" size={16} ink={tokens.colorInkOnDark} weight={2.2} />
      </View>
      <View style={styles.grow}>
        <OnCard text={words} />
        {action != null && (
          <TextAction
            label={action.label}
            onPress={action.onPress}
            testID={action.testID}
          />
        )}
      </View>
    </View>
  );
}

/** The organisation's tile as the Settings list draws it, white on Confetti: a rounded square, not a face. */
function CardTile({ name, side }: { name: string; side: number }) {
  return (
    <View
      style={[styles.tile, { width: side, height: side, borderRadius: Math.round(side * 0.286) }]}
      {...hidden}
    >
      <Text size={Math.round(side * 0.36)} weight="bold" accessible={false} style={styles.accent}>
        {initials(name)}
      </Text>
    </View>
  );
}

/** The card's sentence and its line: the organisation at rest, or what just happened until the page is left. */
export function cardWords(
  t: TFunction,
  details: OrganisationDetails,
  said: CardSaid | null,
): { says: string; line: string; said: boolean } {
  if (said == null) return { says: details.name, line: details.contactAddress, said: false };
  if (said.kind === 'saved')
    return { says: t('orgGeneral.savedSays'), line: said.words, said: true };

  return {
    says: t('ownership.transferredSays', { name: said.to }),
    line: t('ownership.transferredLine'),
    said: true,
  };
}

export function DetailRows({
  details,
  choices,
}: {
  details: OrganisationDetails;
  choices: Choices;
}) {
  const { t } = useTranslation();
  const rows: [Picked, string][] = [
    ['countryCode', t('orgGeneral.country')],
    ['currency', t('orgGeneral.currency')],
    ['timezone', t('orgGeneral.timezone')],
    ['locale', t('orgGeneral.language')],
  ];

  return (
    <Section title={t('orgGeneral.details')} foot={t('orgGeneral.defaultsNote')}>
      <RowList
        items={rows.map(([field, label]) => ({
          key: field,
          row: (
            <Row
              title={choiceName(choices, field, details[field], t('orgGeneral.currencyPlaceholder'))}
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

/** Where a demo state opens the screen; the product always opens it fresh. */
export interface DetailsOpening {
  picking: Picked | null;
  contactWrong: string | null;
  currencyBlank: boolean;
}

export const FRESH_DETAILS: DetailsOpening = {
  picking: null,
  contactWrong: null,
  currencyBlank: false,
};

/** Editing the details on a screen of their own; a picker's list opens in the same surface and comes back on a pick. */
export function DetailsScreen({
  saved,
  choices,
  open,
  opening = FRESH_DETAILS,
  opener,
  onSave,
  onClose,
  onSaved,
}: {
  saved: OrganisationDetails;
  choices: Choices;
  open: boolean;
  opening?: DetailsOpening;
  opener: RefObject<ScreenReaderTarget | null>;
  onSave: (values: OrganisationDetails) => Promise<DetailsOutcome>;
  onClose: () => void;
  onSaved: (details: OrganisationDetails, words: string) => void;
}) {
  const { t } = useTranslation();
  const pickers = usePickers();
  const [given, setGiven] = useState<Record<Typed, string>>(() => ({
    name: saved.name,
    contactAddress: opening.contactWrong ?? saved.contactAddress,
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
    ...(opening.contactWrong != null && { contactAddress: t('orgGeneral.contactInvalid') }),
    ...(opening.currencyBlank && { currency: t('orgGeneral.currencyBlank') }),
  }));
  const [pressed, setPressed] = useState(opening.contactWrong != null || opening.currencyBlank);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [discarding, setDiscarding] = useState(false);
  const [changes, setChanges] = useState(() => changeCount(saved, picked, given));
  const [refused, setRefused] = useState<{ field: Typed } | null>(null);
  const nameRef = useRef<TextInputInstance>(null);
  const contactRef = useRef<TextInputInstance>(null);
  const rowRefs = useRef<Partial<Record<Picked, ViewInstance | null>>>({});
  const cameBack = useRef<Picked | null>(null);

  useEffect(() => {
    if (!open || opening.contactWrong == null) return;
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

  useEffect(() => {
    if (refused != null) focusRefused(refused.field === 'name' ? nameRef : contactRef);
  }, [refused]);

  function problem(field: OrganisationField, value: string): string | null {
    const found = organisationProblem(field, value);

    return found == null ? null : t(`orgGeneral.${found}`);
  }

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
    if (errors[field] != null && problem(field, text) == null) setError(field, null);
  }

  function left(field: Typed): void {
    if (pressed) setError(field, problem(field, typed.current[field]));
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

  async function save(): Promise<void> {
    if (saving) return;
    const values = { ...picked, ...typed.current };
    const found = checkAll(ORGANISATION_FIELDS, problem, values);
    setPressed(true);
    setErrors(found.errors);
    if (found.first === 'name') focusChecked(nameRef);
    if (found.first === 'contactAddress') focusChecked(contactRef);
    if (found.first === 'currency') focusPicker({ current: rowRefs.current.currency ?? null });
    if (found.first != null) return;

    keysStayDown();
    setSaving(true);
    setFailed(null);

    const outcome = await onSave(values);

    setSaving(false);
    if (outcome.kind === 'saved') {
      onSaved(outcome.details, savedWords(t, outcome.details, saved));
      return;
    }
    if (outcome.kind === 'refused') {
      setErrors(outcome.errors);
      const first = ORGANISATION_FIELDS.find((field) => outcome.errors[field] != null);
      if (first === 'name' || first === 'contactAddress') setRefused({ field: first });
      return;
    }
    setFailed(
      outcome.kind === 'forbidden'
        ? t(outcome.byRule ? 'orgGeneral.refusedByRule' : 'orgGeneral.refused')
        : t('orgGeneral.failed'),
    );
  }

  const ask: AskProps | null = discarding
    ? {
        title: t('orgGeneral.discardTitle', { count: changes }),
        line: t('orgGeneral.discardLine', { organisation: saved.name }),
        keep: { label: t('orgGeneral.keepEditing'), testID: 'organisation.details.keep' },
        confirm: {
          label: t('orgGeneral.discard'),
          testID: 'organisation.details.discard',
          removes: true,
        },
        onKeep: () => setDiscarding(false),
        onConfirm: onClose,
      }
    : null;

  if (picking != null)
    return (
      <FocusedScreen
        open={open}
        title={pickers[picking].label}
        back={t('orgGeneral.editTitle')}
        verb={null}
        onCancel={() => backFrom(picking)}
        cancelTestID={`${pickers[picking].testID}.back`}
        opener={opener}
        fills
      >
        <PickerList
          choices={choices[picking]}
          search={pickers[picking].search}
          testID={pickers[picking].testID}
          value={picked[picking]}
          onChoose={(code) => backFrom(picking, code)}
        />
      </FocusedScreen>
    );

  const pickerRow = (field: Picked) => {
    const { label, testID } = pickers[field];
    const chosen = choiceName(choices, field, picked[field], t('orgGeneral.currencyPlaceholder'));
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
      title={t('orgGeneral.editTitle')}
      verb={{
        label: saving ? t('orgGeneral.saving') : t('orgGeneral.saveVerb'),
        on: changes > 0 && !saving,
        onPress: () => void save(),
        testID: 'organisation.details.save',
      }}
      onCancel={() => (changes > 0 ? setDiscarding(true) : onClose())}
      cancelTestID="organisation.details.cancel"
      opener={opener}
      ask={ask}
      testID="organisation.details"
    >
      {failed != null && <FailureLine words={failed} testID="organisation.details.failed" />}
      <Field label={t('orgGeneral.name')} error={errors.name}>
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
          accessibilityLabel={t('orgGeneral.name')}
          testID="organisation.name"
        />
      </Field>
      {pickerRow('countryCode')}
      <Field label={t('orgGeneral.contact')} error={errors.contactAddress}>
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
          accessibilityLabel={t('orgGeneral.contact')}
          testID="organisation.contact"
        />
      </Field>
      <View style={styles.group}>
        <SectionHead title={t('orgGeneral.defaults')} />
        <RowList
          items={(['currency', 'timezone'] as const).map((field) => ({
            key: field,
            row: pickerRow(field),
          }))}
        />
        <Line size={14} text={t('orgGeneral.defaultsNote')} />
      </View>
      <View style={styles.group}>
        <SectionHead title={t('orgGeneral.invitations')} />
        {pickerRow('locale')}
        <Line size={14} text={t('orgGeneral.languageHint')} />
      </View>
    </FocusedScreen>
  );
}

/** A new invitation language is named, since it changes what goes out from now on. */
function savedWords(t: TFunction, now: OrganisationDetails, before: OrganisationDetails): string {
  return now.locale === before.locale
    ? t('orgGeneral.saved', { name: now.name })
    : t('orgGeneral.savedLanguage', {
        language: t(`languageNamesInSentence.${now.locale}`, { defaultValue: now.locale }),
      });
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
