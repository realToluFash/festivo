import { type Membership } from '@soirely/api-client';
import { type NewOrganisationField, deviceRegion } from '@soirely/domain';
import { getCalendars, getLocales } from 'expo-localization';
import { useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  type LayoutRectangle,
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
import { offsetToFocus } from '../kit/keyboard.ts';
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
import { type SettledLift, keyboardTopNow, settledLift } from './keyboardWatch.ts';
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
  // The `create_keyboard` drawing is for Android phones; the iPhone keeps its row (sc-9442).
  const drawn = Platform.OS === 'android' && phone;
  const keysUp = useKeysUp();
  const typing = phone && keysUp;

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
            { paddingTop: phone ? insets.top : Math.max(tokens.spaceXxl, insets.top) },
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
              phone && { paddingBottom: typing ? 0 : insets.bottom },
            ]}
            accessibilityViewIsModal
          >
            {drawn && <View style={styles.grabber} />}
            {open && (
              <Form
                email={email}
                drawn={drawn}
                keysUp={keysUp}
                typing={typing}
                onCreated={onCreated}
                onCancel={onCancel}
              />
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** Whether the keyboard is up, changing when the avoiding view starts to move. */
function useKeysUp(): boolean {
  const [up, setUp] = useState(() => keyboardTopNow(0) != null);

  useEffect(() => {
    // iOS's avoiding view pads on the Will events and Android's on the Did ones.
    const ios = Platform.OS === 'ios';
    const shown = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', () =>
      setUp(true),
    );
    const hidden = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () =>
      setUp(false),
    );

    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);

  return up;
}

/** Keeps the name field, and its notices while they fit, in the body's sight as the body shrinks or they grow. */
function useFocusInSight(keysUp: boolean) {
  const body = useRef<ScrollView>(null);
  const bodyHeight = useRef<number | null>(null);
  const group = useRef<LayoutRectangle | null>(null);
  const field = useRef<LayoutRectangle | null>(null);
  const lift = useRef<SettledLift | null>(null);

  useEffect(() => {
    const settled = settledLift(() => {
      if (!keysUp || bodyHeight.current == null) return;
      if (group.current == null || field.current == null) return;
      body.current?.scrollTo({
        y: offsetToFocus(
          {
            contentY: group.current.y,
            height: group.current.height,
            scrollTop: 0,
            keyboardTop: bodyHeight.current,
            margin: tokens.spaceLg,
          },
          { contentY: group.current.y + field.current.y, height: field.current.height },
        ),
        animated: true,
      });
    });
    lift.current = settled;
    settled.lift();

    return () => {
      settled.cancel();
      lift.current = null;
    };
  }, [keysUp]);

  return {
    body,
    onBodyLayout: (height: number) => {
      bodyHeight.current = height;
      lift.current?.lift();
    },
    onGroupLayout: (layout: LayoutRectangle) => {
      group.current = layout;
      lift.current?.lift();
    },
    onFieldLayout: (layout: LayoutRectangle) => {
      field.current = layout;
      lift.current?.lift();
    },
  };
}

function Form({
  email,
  drawn,
  keysUp,
  typing,
  onCreated,
  onCancel,
}: {
  email: string;
  /** The buttons stack, Create organisation on top (`create_keyboard`). */
  drawn: boolean;
  keysUp: boolean;
  typing: boolean;
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
  const { body, onBodyLayout, onGroupLayout, onFieldLayout } = useFocusInSight(keysUp);

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

  const createButton = (
    <PrimaryButton
      label={saving ? t('createOrganisation.creating') : t('createOrganisation.create')}
      onPress={() => void create()}
      busy={saving}
      testID="createOrganisation.create"
    />
  );
  const cancelButton = (
    <SecondaryButton
      label={t('createOrganisation.cancel')}
      onPress={onCancel}
      stacked={drawn}
      testID="createOrganisation.cancel"
    />
  );

  const title = (
    <Text size={tokens.typeTitleDialog.size} weight="bold" accessibilityRole="header">
      {t('createOrganisation.title')}
    </Text>
  );
  const intro = (
    <Text size={tokens.typeBodyPhone.size} muted>
      {t('createOrganisation.intro')}
    </Text>
  );
  const fields = (
    <>
      <View style={styles.group} onLayout={(event) => onGroupLayout(event.nativeEvent.layout)}>
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

        <View onLayout={(event) => onFieldLayout(event.nativeEvent.layout)}>
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
        </View>
      </View>
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
    </>
  );
  const buttons = drawn ? (
    <View style={styles.stacked}>
      {createButton}
      {cancelButton}
    </View>
  ) : (
    <View style={styles.actions}>
      {cancelButton}
      {createButton}
    </View>
  );

  return (
    <>
      <View style={[styles.heading, typing && styles.headingTyping]}>{title}</View>
      <ScrollView
        ref={body}
        style={styles.body}
        contentContainerStyle={styles.form}
        keyboardShouldPersistTaps="handled"
        onLayout={(event) => onBodyLayout(event.nativeEvent.layout.height)}
        testID="createOrganisation"
      >
        {intro}
        {fields}
      </ScrollView>
      <View style={[styles.footer, typing && styles.footerTyping]}>{buttons}</View>
    </>
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
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 5,
    marginTop: tokens.spaceSm,
    borderRadius: 3,
    backgroundColor: tokens.colorBorder,
  },
  heading: { paddingHorizontal: tokens.space3xl, paddingTop: tokens.space3xl },
  headingTyping: { paddingTop: tokens.spaceLg },
  body: { flexShrink: 1 },
  form: {
    gap: tokens.spaceXl,
    paddingHorizontal: tokens.space3xl,
    paddingTop: tokens.spaceXs,
    paddingBottom: tokens.spaceXl,
  },
  group: { gap: tokens.spaceXl },
  footer: { paddingHorizontal: tokens.space3xl, paddingBottom: tokens.space3xl },
  footerTyping: {
    paddingTop: tokens.spaceLg,
    paddingBottom: tokens.spaceLg,
    borderTopWidth: 1,
    borderTopColor: tokens.colorBorder,
  },
  stacked: { gap: tokens.spaceSm },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: tokens.spaceMd,
  },
});
