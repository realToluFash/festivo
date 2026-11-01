import { type Membership } from '@soirely/api-client';
import { type NewOrganisationField, deviceRegion } from '@soirely/domain';
import { getCalendars, getLocales } from 'expo-localization';
import { type RefObject, useEffect, useRef, useState } from 'react';
import {
  type LayoutRectangle,
  Platform,
  ScrollView,
  type ScrollViewInstance,
  StyleSheet,
  type TextInputInstance,
  View,
  type ViewInstance,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import { dateLocale } from '../i18n/index.ts';
import { useFormChecks } from '../kit/formChecks.ts';
import {
  fieldKeptInSight,
  offsetIntoView,
  offsetToFocus,
  titleScrollsWhileTyping,
} from '../kit/keyboard.ts';
import {
  NEW_ORGANISATION_FIELDS,
  createOrganisation,
  dropsKeysAfter,
  limitNotice,
  newOrganisationMessage,
} from '../kit/organisationCreate.ts';
import { useLayout } from '../layout/useLayout.ts';
import { tokens } from '../theme/tokens.ts';
import { PrimaryButton, SecondaryButton } from './Buttons.tsx';
import { CountryPicker, focusPicker } from './CountryPicker.tsx';
import { Field, focusChecked, focusRefused, TextField } from './Field.tsx';
import { type SettledLift, settledLift, useKeysUp } from './keyboardWatch.ts';
import { Notice } from './Notice.tsx';
import { ReadOut } from './ReadOut.tsx';
import { SETTLED_MS } from './Screen.tsx';
import { Sheet } from './Sheet.tsx';
import { Text } from './Text.tsx';

/** `OrgSwitcher-*` states `create` to `create_limited` (sc-390): a dialog on a tablet, a sheet on a phone. */
export function CreateOrganisation({
  open,
  email,
  opener,
  onCreated,
  onCancel,
}: {
  open: boolean;
  email: string;
  opener: RefObject<ViewInstance | null>;
  onCreated: (created: Membership) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const { kind, width, height } = useLayout();
  const phone = kind === 'phone';
  // The `create_keyboard` drawing is for Android phones; the iPhone keeps its row (sc-9442).
  const drawn = Platform.OS === 'android' && phone;
  const keysUp = useKeysUp();
  const typing = phone && keysUp;
  const turned = { os: Platform.OS, phone, width, height, keysUp };
  const [sending, setSending] = useState(false);

  return (
    <Sheet
      open={open}
      onClose={onCancel}
      scrimLabel={t('createOrganisation.cancel')}
      held={sending}
      opener={opener}
    >
      {open && (
        <Form
          email={email}
          drawn={drawn}
          keysUp={keysUp}
          typing={typing}
          inSight={fieldKeptInSight(turned)}
          titleScrolls={titleScrollsWhileTyping(turned)}
          onCreated={onCreated}
          onCancel={onCancel}
          onSending={setSending}
        />
      )}
    </Sheet>
  );
}

/** Keeps the name field, and its notices while they fit, in the body's sight as the body shrinks or they grow, again each time the keys move. For a while after each `answer`, the notice answering it comes wholly into sight instead, as far as it needs and no further, as it comes before the field (sc-25897). */
function useFocusInSight(keysUp: boolean, inSight: boolean, answer: number) {
  const body = useRef<ScrollViewInstance>(null);
  const bodyHeight = useRef<number | null>(null);
  const offset = useRef(0);
  const group = useRef<LayoutRectangle | null>(null);
  const field = useRef<LayoutRectangle | null>(null);
  const notice = useRef<LayoutRectangle | null>(null);
  const answering = useRef(false);
  const lift = useRef<SettledLift | null>(null);

  function bringNotice(): void {
    if (bodyHeight.current == null || group.current == null || notice.current == null) return;
    const to = offsetIntoView({
      contentY: group.current.y + notice.current.y,
      height: notice.current.height,
      offset: offset.current,
      shown: bodyHeight.current,
      margin: tokens.spaceLg,
    });
    if (to != null) body.current?.scrollTo({ y: to, animated: true });
  }

  function liftField(): void {
    if (bodyHeight.current == null) return;
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
  }

  useEffect(() => {
    const settled = settledLift(() => {
      if (answering.current) bringNotice();
      else if (inSight) liftField();
    });
    lift.current = settled;
    settled.lift();

    return () => {
      settled.cancel();
      lift.current = null;
    };
  }, [keysUp, inSight]);

  useEffect(() => {
    if (answer === 0) return;

    answering.current = true;
    lift.current?.lift();
    // A notice that mounts as the content around it shrinks can stop the first scroll short (sc-9382).
    const settled = setTimeout(() => lift.current?.lift(), SETTLED_MS);
    const done = setTimeout(() => {
      answering.current = false;
    }, 2 * SETTLED_MS);

    return () => {
      clearTimeout(settled);
      clearTimeout(done);
      answering.current = false;
    };
  }, [answer]);

  return {
    body,
    onBodyLayout: (height: number) => {
      bodyHeight.current = height;
      lift.current?.lift();
    },
    onBodyScroll: (y: number) => {
      offset.current = y;
    },
    onGroupLayout: (layout: LayoutRectangle) => {
      group.current = layout;
      lift.current?.lift();
    },
    onFieldLayout: (layout: LayoutRectangle) => {
      field.current = layout;
      lift.current?.lift();
    },
    onNoticeLayout: (layout: LayoutRectangle) => {
      notice.current = layout;
      lift.current?.lift();
    },
  };
}

function Form({
  email,
  drawn,
  keysUp,
  typing,
  inSight,
  titleScrolls,
  onCreated,
  onCancel,
  onSending,
}: {
  email: string;
  /** The buttons stack, Create organisation on top (`create_keyboard`). */
  drawn: boolean;
  keysUp: boolean;
  typing: boolean;
  inSight: boolean;
  /** An iPhone on its side has no room above the keys for a fixed title as well as the field. */
  titleScrolls: boolean;
  onCreated: (created: Membership) => void;
  onCancel: () => void;
  onSending: (sending: boolean) => void;
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
  const [limited, setLimited] = useState<ReturnType<typeof limitNotice> | null>(null);
  const [failed, setFailed] = useState(false);
  const [answer, setAnswer] = useState(0);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    onSending(saving);

    return () => onSending(false);
  }, [saving, onSending]);
  const nameInput = useRef<TextInputInstance>(null);
  const countryPicker = useRef<ViewInstance>(null);
  const countryField = useRef<ViewInstance>(null);
  const checks = useFormChecks(
    NEW_ORGANISATION_FIELDS,
    (field, value) => newOrganisationMessage(field, value, t),
    (field) =>
      field === 'name' ? focusChecked(nameInput) : focusPicker(countryPicker, countryField),
  );
  const errors = { ...refused, ...checks.errors };
  const { body, onBodyLayout, onBodyScroll, onGroupLayout, onFieldLayout, onNoticeLayout } =
    useFocusInSight(keysUp, inSight, answer);

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
    if (dropsKeysAfter(outcome.kind, Platform.OS)) nameInput.current?.blur();
    if (outcome.kind === 'limited') setLimited(limitNotice(outcome.until, locale, t));
    if (outcome.kind === 'failed') setFailed(true);
    if (outcome.kind === 'limited' || outcome.kind === 'failed') setAnswer((sent) => sent + 1);
    if (outcome.kind === 'refused') {
      setRefused(outcome.errors);
      if (outcome.errors.name != null) focusRefused(nameInput);
      else focusPicker(countryPicker);
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
      off={saving}
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
  const notCreated = t('createOrganisation.failed');
  const fields = (
    <>
      <View style={styles.group} onLayout={(event) => onGroupLayout(event.nativeEvent.layout)}>
        {(limited != null || failed) && (
          <View onLayout={(event) => onNoticeLayout(event.nativeEvent.layout)}>
            {limited != null && (
              <ReadOut
                words={[limited.title, limited.body].filter((line) => line != null).join(' ')}
                interrupts
                accessibilityRole="alert"
              >
                <Notice
                  tone="attention"
                  mark="!"
                  title={limited.title}
                  {...(limited.body == null ? {} : { body: limited.body })}
                />
              </ReadOut>
            )}
            {failed && (
              <ReadOut words={notCreated} interrupts accessibilityRole="alert">
                <Notice tone="broken" mark={tokens.marks.broken.glyph} body={notCreated} />
              </ReadOut>
            )}
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
              submitBehavior="submit"
              wrong={errors.name != null}
              submitting={saving}
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
      <Field ref={countryField} label={t('createOrganisation.country')} error={errors.countryCode}>
        <CountryPicker
          label={t('createOrganisation.country')}
          value={values.countryCode}
          onChange={(code) => change('countryCode', code)}
          disabled={saving}
          pickerRef={countryPicker}
          testID="createOrganisation.country"
        />
      </Field>

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
      {!titleScrolls && (
        <View style={[styles.heading, typing && styles.headingTyping]}>{title}</View>
      )}
      <ScrollView
        ref={body}
        style={styles.body}
        contentContainerStyle={[styles.form, titleScrolls && styles.formTitled]}
        keyboardShouldPersistTaps="handled"
        onLayout={(event) => onBodyLayout(event.nativeEvent.layout.height)}
        onScroll={(event) => onBodyScroll(event.nativeEvent.contentOffset.y)}
        scrollEventThrottle={16}
        testID="createOrganisation"
      >
        {titleScrolls && title}
        {intro}
        {fields}
      </ScrollView>
      <View style={[styles.footer, typing && styles.footerTyping]}>{buttons}</View>
    </>
  );
}

const styles = StyleSheet.create({
  heading: { paddingHorizontal: tokens.space3xl, paddingTop: tokens.space3xl },
  headingTyping: { paddingTop: tokens.spaceLg },
  body: { flexShrink: 1 },
  form: {
    gap: tokens.spaceXl,
    paddingHorizontal: tokens.space3xl,
    paddingTop: tokens.spaceXs,
    paddingBottom: tokens.spaceXl,
  },
  formTitled: { paddingTop: tokens.spaceLg },
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
