import { type Membership } from '@soirely/api-client';
import {
  ORGANISATION_FIELDS,
  ORGANISATION_NAME_MAXIMUM,
  type OrganisationDetails as Details,
  type OrganisationField,
  countryChoices,
  currencyLabel,
  languageChoices,
  organisationProblem,
  roleName,
  timezoneLabel,
  withCurrent,
} from '@soirely/domain';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, type TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { type TFunction } from 'i18next';

import { api } from '../api.ts';
import { currentLocale } from '../i18n/index.ts';
import { useFormChecks } from '../kit/formChecks.ts';
import {
  NO_REFUSAL,
  afterEdit,
  detailsOf,
  refusalOf,
  saveOrganisation,
} from '../kit/organisationSave.ts';
import { type LayoutKind } from '../layout/useLayout.ts';
import { replaceOrganisation } from '../signedIn.ts';
import { tokens } from '../theme/tokens.ts';
import { PrimaryButton } from './Buttons.tsx';
import { cardFrame } from './cardFrame.ts';
import { CountryPicker } from './CountryPicker.tsx';
import { Field, TextField } from './Field.tsx';
import { ListPicker } from './ListPicker.tsx';
import { Notice } from './Notice.tsx';
import { Text } from './Text.tsx';

type Status = 'editing' | 'saving' | 'saved' | 'failed';

export function EditableDetails({
  organisation,
  kind,
  onForbidden,
}: {
  organisation: Membership;
  kind: LayoutKind;
  /** The role lost `organisation.manage` while the page was open: nothing was saved. */
  onForbidden: () => void;
}) {
  const { t } = useTranslation();
  const locale = currentLocale();
  const [values, setValues] = useState<Details>(() => detailsOf(organisation));
  const [refusal, setRefusal] = useState(NO_REFUSAL);
  const [status, setStatus] = useState<Status>('editing');
  const [newLanguage, setNewLanguage] = useState<string | null>(null);
  const nameInput = useRef<TextInput>(null);
  const contactInput = useRef<TextInput>(null);
  const focus = (field: OrganisationField) =>
    (field === 'name' ? nameInput : contactInput).current?.focus();
  const checks = useFormChecks(
    ORGANISATION_FIELDS,
    (field, value) => {
      const problem = organisationProblem(field, value);

      return problem == null ? null : t(`orgGeneral.${problem}`);
    },
    focus,
  );

  useEffect(() => {
    if (refusal.focus != null) focus(refusal.focus.field);
  }, [refusal.focus]);

  const currencies = useMemo(
    () =>
      withCurrent(Intl.supportedValuesOf('currency'), organisation.currency).map((code) => ({
        code,
        name: currencyLabel(code, locale),
      })),
    [organisation.currency, locale],
  );
  const timezones = useMemo(
    () =>
      withCurrent(Intl.supportedValuesOf('timeZone'), organisation.timezone).map((zone) => ({
        code: zone,
        name: timezoneLabel(zone),
      })),
    [organisation.timezone],
  );

  const languages = useMemo(() => languageChoices(t), [t]);

  const busy = status === 'saving';
  const errors = { ...refusal.errors, ...checks.errors };

  function change(field: OrganisationField, value: string): void {
    setValues((previous) => ({ ...previous, [field]: value }));
    setRefusal((previous) => afterEdit(previous, field));
    checks.edited(field, value);
    if (status === 'saved' || status === 'failed') setStatus('editing');
  }

  async function save(): Promise<void> {
    if (busy || !checks.passes(values)) return;

    setStatus('saving');

    const outcome = await saveOrganisation(
      (id, changes) => api.updateOrganisation(id, changes),
      organisation,
      values,
    );

    if (outcome.kind === 'forbidden') {
      onForbidden();
      return;
    }

    if (outcome.kind === 'saved') {
      replaceOrganisation(outcome.organisation);
      setValues(detailsOf(outcome.organisation));
      setNewLanguage(
        outcome.organisation.locale === organisation.locale ? null : outcome.organisation.locale,
      );
    }
    if (outcome.kind === 'refused') setRefusal(refusalOf(outcome.errors));
    setStatus(outcome.kind === 'refused' ? 'editing' : outcome.kind);
  }

  return (
    <>
      {status === 'saved' && (
        <View accessibilityLiveRegion="polite">
          <Notice
            tone="done"
            mark={tokens.marks.done.glyph}
            body={
              newLanguage == null
                ? t('orgGeneral.saved', { name: organisation.name })
                : t('orgGeneral.savedLanguage', {
                    language: languageNameInSentence(t, newLanguage),
                  })
            }
          />
        </View>
      )}
      {status === 'failed' && (
        <View accessibilityLiveRegion="assertive" accessibilityRole="alert">
          <Notice tone="broken" mark={tokens.marks.broken.glyph} body={t('orgGeneral.failed')} />
        </View>
      )}

      <View style={cardFrame(kind)}>
        <Field label={t('orgGeneral.name')} error={errors.name}>
          <TextField
            ref={nameInput}
            value={values.name}
            onChangeText={(value) => change('name', value)}
            onBlur={() => checks.left('name', values.name)}
            onSubmitEditing={() => contactInput.current?.focus()}
            wrong={errors.name != null}
            editable={!busy}
            maxLength={ORGANISATION_NAME_MAXIMUM}
            autoComplete="organization"
            textContentType="organizationName"
            autoCorrect={false}
            returnKeyType="next"
            accessibilityLabel={t('orgGeneral.name')}
            testID="organisation.name"
          />
        </Field>
        <Field label={t('orgGeneral.country')} error={errors.countryCode}>
          <CountryPicker
            label={t('orgGeneral.country')}
            value={values.countryCode}
            onChange={(code) => change('countryCode', code)}
            disabled={busy}
            testID="organisation.country"
          />
        </Field>
        <Field label={t('orgGeneral.contact')} error={errors.contactAddress}>
          <TextField
            ref={contactInput}
            value={values.contactAddress}
            onChangeText={(value) => change('contactAddress', value)}
            onBlur={() => checks.left('contactAddress', values.contactAddress)}
            wrong={errors.contactAddress != null}
            editable={!busy}
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            accessibilityLabel={t('orgGeneral.contact')}
            testID="organisation.contact"
          />
        </Field>
        <Field label={t('orgGeneral.currency')} error={errors.currency}>
          <ListPicker
            label={t('orgGeneral.currency')}
            searchLabel={t('orgGeneral.searchCurrency')}
            choices={currencies}
            value={values.currency}
            onChange={(code) => change('currency', code)}
            disabled={busy}
            testID="organisation.currency"
          />
        </Field>
        <Field label={t('orgGeneral.timezone')} error={errors.timezone}>
          <ListPicker
            label={t('orgGeneral.timezone')}
            searchLabel={t('orgGeneral.searchTimezone')}
            choices={timezones}
            value={values.timezone}
            onChange={(zone) => change('timezone', zone)}
            disabled={busy}
            testID="organisation.timezone"
          />
        </Field>

        <Notice tone="quiet" mark={tokens.marks.info.glyph} body={t('orgGeneral.defaultsNote')} />

        <Field
          label={t('orgGeneral.language')}
          error={errors.locale}
          help={t('orgGeneral.languageHint')}
        >
          <ListPicker
            label={t('orgGeneral.language')}
            searchLabel={t('orgGeneral.searchLanguage')}
            choices={languages}
            value={values.locale}
            onChange={(code) => change('locale', code)}
            disabled={busy}
            testID="organisation.language"
          />
        </Field>

        <View style={kind === 'phone' ? undefined : styles.leading}>
          <PrimaryButton
            label={busy ? t('orgGeneral.saving') : t('orgGeneral.save')}
            onPress={() => void save()}
            busy={busy}
            testID="organisation.save"
          />
        </View>
      </View>
    </>
  );
}

/** The controls are absent, not disabled: a control that refuses reads as broken (sc-66). */
export function ReadOnlyDetails({
  organisation,
  kind,
}: {
  organisation: Membership;
  kind: LayoutKind;
}) {
  const { t } = useTranslation();
  const locale = currentLocale();
  const country =
    countryChoices(locale).find(({ code }) => code === organisation.countryCode)?.name ??
    organisation.countryCode;
  const rows: readonly [string, string][] = [
    [t('orgGeneral.name'), organisation.name],
    [t('orgGeneral.country'), country],
    [t('orgGeneral.contact'), organisation.contactAddress],
    [t('orgGeneral.currency'), currencyLabel(organisation.currency, locale)],
    [t('orgGeneral.timezone'), timezoneLabel(organisation.timezone)],
  ];

  return (
    <View style={cardFrame(kind)}>
      <View>
        {rows.map(([label, value]) => (
          <View key={label} style={styles.row}>
            <Text size={tokens.typeButton.size} weight="semibold" style={styles.secondary}>
              {label}
            </Text>
            <Text size={tokens.typeBodyPhone.size}>{value}</Text>
          </View>
        ))}
      </View>
      <Notice tone="quiet" mark={tokens.marks.info.glyph} body={t('orgGeneral.defaultsNote')} />
      <View style={styles.row}>
        <Text size={tokens.typeButton.size} weight="semibold" style={styles.secondary}>
          {t('orgGeneral.language')}
        </Text>
        <Text size={tokens.typeBodyPhone.size} testID="organisation.language.readOnly">
          {languageName(t, organisation.locale)}
        </Text>
      </View>
      <Text size={tokens.typeBodyPhone.size} style={styles.secondary}>
        {t('orgGeneral.readOnly', { role: roleName(t, organisation.role) })}
      </Text>
    </View>
  );
}

/** In the reader's language alone, as a row names it. */
function languageName(t: TFunction, code: string): string {
  return t(`languageNames.${code}`, { defaultValue: code });
}

/** Mid-sentence, where es, fr and pt write a language's name in lowercase. */
function languageNameInSentence(t: TFunction, code: string): string {
  return t(`languageNamesInSentence.${code}`, { defaultValue: code });
}

const styles = StyleSheet.create({
  leading: { alignSelf: 'flex-start' },
  row: {
    gap: tokens.spaceHair,
    paddingVertical: tokens.spaceLg,
    borderTopWidth: 1,
    borderTopColor: tokens.colorInsetBorder,
  },
  secondary: { color: tokens.colorInkSecondary },
});
