import {
  countryChoices,
  currencyChoices,
  currencyLabel,
  languageChoices,
  ORGANISATION_FIELDS,
  type OrganisationField,
  timezoneLabel,
  withCurrent,
} from '@soirely/domain';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, type TextInputInstance, View } from 'react-native';

import { Field, focusChecked, keysStayDown, TextField } from '../../components/Field.tsx';
import { Notice } from '../../components/Notice.tsx';
import { Text } from '../../components/Text.tsx';
import { checkAll, type FieldErrors } from '../../kit/formChecks.ts';
import { tokens } from '../../theme/tokens.ts';
import { Glyph } from '../Glyph.tsx';
import {
  detailProblem,
  MALFORMED_CONTACT,
  type OrganisationState,
  SAMPLE_DETAILS,
  savedWords,
  SEND_MS,
} from './OrganisationModel.ts';
import { OrganisationPicker } from './OrganisationPicker.tsx';
import { DETAILS_WORDS as W, LANGUAGE_NAMES } from './OrganisationWords.ts';
import { Card, Pill, TYPE } from './parts.tsx';

const SHOWN_IN = 'en';

type Typed = 'name' | 'contactAddress';
type Picked = Exclude<OrganisationField, Typed>;

function useChoices() {
  return useMemo(
    () => ({
      countries: countryChoices(SHOWN_IN),
      currencies: currencyChoices(SAMPLE_DETAILS.currency, SHOWN_IN, W.currencyRetired),
      zones: withCurrent(Intl.supportedValuesOf('timeZone'), SAMPLE_DETAILS.timezone).map(
        (zone) => ({ code: zone, name: timezoneLabel(zone) }),
      ),
      languages: languageChoices((key) => LANGUAGE_NAMES[key] ?? key),
    }),
    [],
  );
}

/** The details card keeps no title, as built: the page's title already names it. */
export function DetailsCard({
  start,
  tablet,
}: {
  start: OrganisationState | null;
  tablet: boolean;
}) {
  const choices = useChoices();
  const startsWrong = start === 'contactError';
  const [startContact] = useState(startsWrong ? MALFORMED_CONTACT : SAMPLE_DETAILS.contactAddress);
  const typed = useRef<Record<Typed, string>>({
    name: SAMPLE_DETAILS.name,
    contactAddress: startContact,
  });
  const [picked, setPicked] = useState<Record<Picked, string>>({
    countryCode: SAMPLE_DETAILS.countryCode,
    currency: SAMPLE_DETAILS.currency,
    timezone: SAMPLE_DETAILS.timezone,
    locale: SAMPLE_DETAILS.locale,
  });
  const [errors, setErrors] = useState<FieldErrors<OrganisationField>>(() =>
    startsWrong ? { contactAddress: W.contactInvalid } : {},
  );
  const [pressed, setPressed] = useState(startsWrong);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<{ words: string; tap: object } | null>(() =>
    start === 'saved' ? { words: W.saved, tap: {} } : null,
  );
  const [savedLocale, setSavedLocale] = useState(SAMPLE_DETAILS.locale);
  const nameRef = useRef<TextInputInstance>(null);
  const contactRef = useRef<TextInputInstance>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

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
    if (errors[field] != null && detailProblem(field, text) == null) setError(field, null);
  }

  function left(field: Typed): void {
    if (pressed) setError(field, detailProblem(field, typed.current[field]));
  }

  function pick(field: Picked, code: string): void {
    setPicked((previous) => ({ ...previous, [field]: code }));
    setError(field, null);
  }

  function save(): void {
    if (saving) return;
    const found = checkAll(ORGANISATION_FIELDS, detailProblem, { ...picked, ...typed.current });
    setPressed(true);
    setErrors(found.errors);
    setSaved(null);
    if (found.first === 'name') focusChecked(nameRef);
    if (found.first === 'contactAddress') focusChecked(contactRef);
    if (found.first != null) return;

    keysStayDown();
    setSaving(true);
    const locale = picked.locale;
    timer.current = setTimeout(() => {
      setSaving(false);
      setSaved({ words: savedWords(locale, savedLocale), tap: {} });
      setSavedLocale(locale);
    }, SEND_MS);
  }

  return (
    <Card>
      {saved != null && (
        <Notice tone="done" mark={tokens.marks.done.glyph} body={saved.words} answer={saved.tap} />
      )}
      <Field label={W.name} error={errors.name}>
        <TextField
          ref={nameRef}
          defaultValue={SAMPLE_DETAILS.name}
          onChangeText={(text) => edited('name', text)}
          onBlur={() => left('name')}
          wrong={errors.name != null}
          submitting={saving}
          autoCapitalize="words"
          returnKeyType="next"
          onSubmitEditing={() => contactRef.current?.focus()}
          submitBehavior="submit"
          accessibilityLabel={W.name}
          testID="demo.organisation.name"
        />
      </Field>
      <Field label={W.country}>
        <OrganisationPicker
          label={W.country}
          searchLabel={W.searchCountry}
          choices={choices.countries}
          value={picked.countryCode}
          onChange={(code) => pick('countryCode', code)}
          tablet={tablet}
          testID="demo.organisation.country"
        />
      </Field>
      <Field label={W.contact} error={errors.contactAddress}>
        <TextField
          ref={contactRef}
          defaultValue={startContact}
          onChangeText={(text) => edited('contactAddress', text)}
          onBlur={() => left('contactAddress')}
          wrong={errors.contactAddress != null}
          submitting={saving}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="done"
          accessibilityLabel={W.contact}
          testID="demo.organisation.contact"
        />
      </Field>
      <Field label={W.currency} error={errors.currency}>
        <OrganisationPicker
          label={W.currency}
          searchLabel={W.searchCurrency}
          choices={choices.currencies}
          value={picked.currency}
          onChange={(code) => pick('currency', code)}
          startsOpen={start === 'currency'}
          tablet={tablet}
          testID="demo.organisation.currency"
        />
      </Field>
      <Field label={W.timezone}>
        <OrganisationPicker
          label={W.timezone}
          searchLabel={W.searchTimezone}
          choices={choices.zones}
          value={picked.timezone}
          onChange={(code) => pick('timezone', code)}
          tablet={tablet}
          testID="demo.organisation.timezone"
        />
      </Field>
      <Notice tone="quiet" mark={tokens.marks.info.glyph} body={W.defaultsNote} />
      <Field label={W.language} help={W.languageHint}>
        <OrganisationPicker
          label={W.language}
          searchLabel={W.searchLanguage}
          choices={choices.languages}
          value={picked.locale}
          onChange={(code) => pick('locale', code)}
          startsOpen={start === 'language'}
          tablet={tablet}
          testID="demo.organisation.language"
        />
      </Field>
      <Pill
        label={saving ? W.saving : W.save}
        onPress={save}
        full={!tablet}
        testID="demo.organisation.save"
      />
    </Card>
  );
}

/** Without the right to manage the organisation the controls are absent, not greyed: label over value, then why. */
export function DetailsReadOnly({ role }: { role: string }) {
  const choices = useChoices();
  const name = (list: readonly { code: string; name: string }[], code: string) =>
    list.find((choice) => choice.code === code)?.name ?? code;
  const rows: [string, string][] = [
    [W.name, SAMPLE_DETAILS.name],
    [W.country, name(choices.countries, SAMPLE_DETAILS.countryCode)],
    [W.contact, SAMPLE_DETAILS.contactAddress],
    [W.currency, currencyLabel(SAMPLE_DETAILS.currency, SHOWN_IN)],
    [W.timezone, timezoneLabel(SAMPLE_DETAILS.timezone)],
  ];

  return (
    <Card>
      <View style={styles.rows}>
        {rows.map(([label, value], index) => (
          <ReadOnlyRow key={label} label={label} value={value} first={index === 0} />
        ))}
      </View>
      <Notice tone="quiet" mark={tokens.marks.info.glyph} body={W.defaultsNote} />
      <View style={styles.rows}>
        <ReadOnlyRow
          label={W.language}
          value={name(choices.languages, SAMPLE_DETAILS.locale)}
          first
        />
      </View>
      <View style={styles.why}>
        <View style={styles.lock}>
          <Glyph name="lock" size={16} ink={tokens.colorInkSecondary} weight={2.2} />
        </View>
        <Text size={TYPE.line} weight="medium" muted style={styles.grow}>
          {W.readOnly(role)}
        </Text>
      </View>
    </Card>
  );
}

function ReadOnlyRow({ label, value, first }: { label: string; value: string; first: boolean }) {
  return (
    <View accessible style={[styles.row, !first && styles.divided]}>
      <Text size={TYPE.small} weight="semibold" muted>
        {label}
      </Text>
      <Text size={TYPE.row} weight="medium">
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  rows: { marginTop: -11, marginBottom: -tokens.spaceXxs },
  row: { paddingVertical: 11, gap: tokens.spaceHair },
  divided: { borderTopWidth: 1, borderTopColor: tokens.colorBorder },
  why: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceSm },
  lock: { marginTop: tokens.spaceHair },
});
