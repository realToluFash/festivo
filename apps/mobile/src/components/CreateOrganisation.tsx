import { type Membership } from '@soirely/api-client';
import { type NewOrganisationField, deviceRegion } from '@soirely/domain';
import { getCalendars, getLocales } from 'expo-localization';
import { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  type TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import { dateLocale } from '../i18n/index.ts';
import { useFormChecks } from '../kit/formChecks.ts';
import {
  NEW_ORGANISATION_FIELDS,
  createOrganisation,
  limitMessage,
  newOrganisationMessage,
} from '../kit/organisationCreate.ts';
import { useLayout } from '../layout/useLayout.ts';
import { tokens } from '../theme/tokens.ts';
import { PrimaryButton, SecondaryButton } from './Buttons.tsx';
import { CountryPicker, focusPicker } from './CountryPicker.tsx';
import { Field, TextField } from './Field.tsx';
import { Notice } from './Notice.tsx';
import { Text } from './Text.tsx';

/** `OrgSwitcher-*` states `create` to `create_limited` (sc-390): a dialog on a tablet, a sheet on a phone. */
export function CreateOrganisation({
  open,
  email,
  onCreated,
  onCancel,
}: {
  open: boolean;
  email: string;
  onCreated: (created: Membership) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const { kind } = useLayout();
  const insets = useSafeAreaInsets();
  const phone = kind === 'phone';
  // iOS needs the inset to clear the status bar; Android keeps main's 0 until sc-4527 checks it.
  const top = Platform.OS === 'ios' ? insets.top : 0;

  return (
    <Modal
      visible={open}
      transparent
      animationType={phone ? 'slide' : 'fade'}
      onRequestClose={onCancel}
    >
      {/* Padding on both platforms: a modal is its own window, so neither resizes for the keyboard. */}
      <KeyboardAvoidingView style={styles.fill} behavior="padding">
        <View
          style={[
            styles.scrim,
            phone ? styles.scrimPhone : styles.scrimTablet,
            { paddingTop: phone ? top : Math.max(tokens.spaceXxl, top) },
          ]}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onCancel}
            accessibilityRole="button"
            accessibilityLabel={t('createOrganisation.cancel')}
          />
          <View
            style={[
              styles.frame,
              phone ? styles.framePhone : styles.frameTablet,
              phone && { paddingBottom: insets.bottom },
            ]}
            accessibilityViewIsModal
          >
            {open && <Form email={email} onCreated={onCreated} onCancel={onCancel} />}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Form({
  email,
  onCreated,
  onCancel,
}: {
  email: string;
  onCreated: (created: Membership) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const locale = dateLocale();
  const [values, setValues] = useState<Record<NewOrganisationField, string>>(() => ({
    name: '',
    countryCode:
      deviceRegion(
        getLocales()[0]?.regionCode ?? null,
        getLocales().map((tag) => tag.languageTag),
      ) ?? '',
  }));
  const [refused, setRefused] = useState<Partial<Record<NewOrganisationField, string | undefined>>>(
    {},
  );
  const [limited, setLimited] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const nameInput = useRef<TextInput>(null);
  const countryPicker = useRef<View>(null);
  const focus = (field: NewOrganisationField) =>
    field === 'name' ? nameInput.current?.focus() : focusPicker(countryPicker);
  const checks = useFormChecks(
    NEW_ORGANISATION_FIELDS,
    (field, value) => newOrganisationMessage(field, value, t),
    focus,
  );
  const errors = { ...refused, ...checks.errors };

  function change(field: NewOrganisationField, value: string): void {
    setValues((previous) => ({ ...previous, [field]: value }));
    setRefused((previous) => ({ ...previous, [field]: undefined }));
    checks.edited(field, value);
  }

  async function create(): Promise<void> {
    if (saving) return;

    setRefused({});
    if (!checks.passes(values)) return;

    setSaving(true);
    setFailed(false);
    setLimited(null);

    const outcome = await createOrganisation(
      (organisation) => api.createOrganisation(organisation),
      values,
      getCalendars()[0]?.timeZone ?? 'UTC',
    );

    if (outcome.kind === 'created') {
      onCreated(outcome.organisation);
      return;
    }

    setSaving(false);
    if (outcome.kind === 'limited') setLimited(limitMessage(outcome.until, locale, t));
    if (outcome.kind === 'failed') setFailed(true);
    if (outcome.kind === 'refused') {
      setRefused(outcome.errors);
      focus(outcome.errors.name != null ? 'name' : 'countryCode');
    }
  }

  return (
    <ScrollView
      contentContainerStyle={styles.form}
      keyboardShouldPersistTaps="handled"
      testID="createOrganisation"
    >
      <View style={styles.heading}>
        <Text size={tokens.typeTitleDialog.size} weight="bold" accessibilityRole="header">
          {t('createOrganisation.title')}
        </Text>
        <Text size={tokens.typeBodyPhone.size} muted>
          {t('createOrganisation.intro')}
        </Text>
      </View>

      {limited != null && (
        <View accessibilityLiveRegion="assertive" accessibilityRole="alert">
          <Notice tone="attention" mark="!" body={limited} />
        </View>
      )}
      {failed && (
        <View accessibilityLiveRegion="assertive" accessibilityRole="alert">
          <Notice
            tone="broken"
            mark={tokens.marks.broken.glyph}
            body={t('createOrganisation.failed')}
          />
        </View>
      )}

      <Field
        label={t('createOrganisation.name')}
        error={errors.name}
        help={t('createOrganisation.nameHelp')}
      >
        <TextField
          ref={nameInput}
          value={values.name}
          onChangeText={(value) => change('name', value)}
          onBlur={() => checks.left('name', values.name)}
          onSubmitEditing={() => void create()}
          wrong={errors.name != null}
          editable={!saving}
          autoFocus
          autoComplete="organization"
          textContentType="organizationName"
          autoCorrect={false}
          spellCheck={false}
          returnKeyType="done"
          accessibilityLabel={t('createOrganisation.name')}
          testID="createOrganisation.name"
        />
      </Field>
      <View ref={countryPicker}>
        <Field label={t('createOrganisation.country')} error={errors.countryCode}>
          <CountryPicker
            label={t('createOrganisation.country')}
            value={values.countryCode}
            onChange={(code) => change('countryCode', code)}
            disabled={saving}
            testID="createOrganisation.country"
          />
        </Field>
      </View>

      <Notice
        tone="quiet"
        mark={tokens.marks.info.glyph}
        body={t('createOrganisation.defaults', { email })}
      />

      <View style={styles.actions}>
        <SecondaryButton
          label={t('createOrganisation.cancel')}
          onPress={onCancel}
          testID="createOrganisation.cancel"
        />
        <PrimaryButton
          label={saving ? t('createOrganisation.creating') : t('createOrganisation.create')}
          onPress={() => void create()}
          busy={saving}
          testID="createOrganisation.create"
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  scrim: { flex: 1, backgroundColor: tokens.scrimDialog },
  scrimPhone: { justifyContent: 'flex-end' },
  scrimTablet: { justifyContent: 'center', padding: tokens.spaceXxl },
  frame: {
    flexShrink: 1,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
    backgroundColor: tokens.colorCard,
  },
  framePhone: {
    borderBottomWidth: 0,
    borderTopLeftRadius: tokens.radiusCardPhone,
    borderTopRightRadius: tokens.radiusCardPhone,
  },
  frameTablet: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 480,
    borderRadius: tokens.radiusCardPhone,
  },
  form: { gap: tokens.spaceXl, padding: tokens.space3xl },
  heading: { gap: tokens.spaceXs },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: tokens.spaceMd,
  },
});
