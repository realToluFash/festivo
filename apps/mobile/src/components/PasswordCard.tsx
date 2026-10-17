import { meetsPasswordLength } from '@soirely/domain';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, type TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import { currentLocale } from '../i18n/index.ts';
import { type LayoutKind } from '../layout/useLayout.ts';
import { useFormChecks } from '../kit/formChecks.ts';
import { type PasswordRefusal, passwordRefusal } from '../kit/passwordChange.ts';
import { tokens } from '../theme/tokens.ts';
import { currentSessionId } from '../tokens.ts';
import { PrimaryButton, QuietButton, SecondaryButton } from './Buttons.tsx';
import { Field } from './Field.tsx';
import { Notice } from './Notice.tsx';
import { PasswordField } from './PasswordField.tsx';
import { PasswordRule } from './PasswordRule.tsx';
import { useAboveKeyboard } from './Screen.tsx';
import { Text } from './Text.tsx';

const PROVIDER_NAMES: Record<string, string> = { google: 'Google', apple: 'Apple' };

type Stage = { kind: 'atRest'; signedOut: number | null } | { kind: 'changing' };

/** Settings > Security, the first card, in the app: change the password, knowing the current one (sc-116). */
export function PasswordCard({
  email,
  hasPassword,
  providers,
  kind,
}: {
  email: string;
  hasPassword: boolean;
  providers: readonly string[];
  kind: LayoutKind;
}) {
  const { t } = useTranslation();
  const [stage, setStage] = useState<Stage>({ kind: 'atRest', signedOut: null });
  const frame = [styles.card, kind === 'tabletLandscape' ? styles.cardWide : styles.cardNarrow];

  if (!hasPassword) {
    const provider = providers[0] ?? '';

    return (
      <View style={frame}>
        <Title text={t('passwordCard.title')} />
        <Text size={tokens.typeBodyPhone.size} style={styles.secondary}>
          {t('passwordCard.none', { provider: PROVIDER_NAMES[provider] ?? provider })}
        </Text>
      </View>
    );
  }

  return (
    <View style={frame}>
      {stage.kind === 'atRest' ? (
        <>
          <Title text={t('passwordCard.title')} />
          {stage.signedOut != null && (
            <Notice
              tone="done"
              mark={tokens.marks.done.glyph}
              body={t('passwordCard.done', { count: stage.signedOut })}
            />
          )}
          <Text size={tokens.typeBodyPhone.size} style={styles.secondary}>
            {t('passwordCard.intro')}
          </Text>
          <SecondaryButton
            label={t('passwordCard.change')}
            onPress={() => setStage({ kind: 'changing' })}
            testID="password.change"
          />
        </>
      ) : (
        <Changing
          email={email}
          onChanged={(signedOut) => setStage({ kind: 'atRest', signedOut })}
          onCancel={() => setStage({ kind: 'atRest', signedOut: null })}
        />
      )}
    </View>
  );
}

function Changing({
  email,
  onChanged,
  onCancel,
}: {
  email: string;
  onChanged: (signedOut: number) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const current = useRef('');
  const next = useRef('');
  const currentInput = useRef<TextInput>(null);
  const nextInput = useRef<TextInput>(null);
  const [lengthMet, setLengthMet] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refusal, setRefusal] = useState<PasswordRefusal | null>(null);
  const aboveKeyboard = useAboveKeyboard();
  const checks = useFormChecks(
    ['currentPassword', 'newPassword'] as const,
    (field, value) =>
      value !== ''
        ? null
        : field === 'currentPassword'
          ? t('passwordCard.currentBlank')
          : t('passwordCard.newBlank'),
    (field) => (field === 'currentPassword' ? currentInput : nextInput).current?.focus(),
  );

  async function submit(): Promise<void> {
    if (saving) return;
    if (!checks.passes({ currentPassword: current.current, newPassword: next.current })) return;

    // The rule is stated before submit, so a short password is never sent.
    if (!meetsPasswordLength(next.current)) {
      nextInput.current?.focus();
      return;
    }

    setSaving(true);
    setRefusal(null);

    try {
      const { signedOut } = await api.changePassword({
        currentPassword: current.current,
        newPassword: next.current,
        sessionId: currentSessionId(),
      });
      onChanged(signedOut);
    } catch (error) {
      setSaving(false);
      setRefusal(passwordRefusal(error, t, currentLocale()));
    }
  }

  const currentError =
    checks.errors.currentPassword ??
    (refusal?.field === 'currentPassword' ? refusal.message : null);
  const nextError =
    checks.errors.newPassword ?? (refusal?.field === 'newPassword' ? refusal.message : null);

  return (
    <>
      <Title text={t('passwordCard.formTitle')} />

      {refusal?.field === 'paused' && (
        <Notice
          tone="attention"
          mark="!"
          title={t('passwordCard.pausedTitle')}
          body={refusal.message}
        />
      )}
      {refusal?.field === 'failed' && (
        <Notice
          tone="broken"
          mark={tokens.marks.broken.glyph}
          title={t('passwordCard.failedTitle')}
          body={refusal.message}
        />
      )}

      <Field
        label={t('passwordCard.current')}
        labelAction={{
          label: t('passwordCard.forgot'),
          onPress: () => router.push('/forgot-password'),
          testID: 'password.forgot',
        }}
        error={currentError}
      >
        <PasswordField
          ref={currentInput}
          wrong={currentError != null}
          submitting={saving}
          editable={!saving}
          autoComplete="current-password"
          textContentType="password"
          onChangeText={(text) => {
            current.current = text;
            if (refusal?.field === 'currentPassword') setRefusal(null);
            checks.edited('currentPassword', text);
          }}
          onBlur={() => checks.left('currentPassword', current.current)}
          returnKeyType="next"
          onSubmitEditing={() => nextInput.current?.focus()}
          accessibilityLabel={t('passwordCard.current')}
          testID="password.current"
        />
      </Field>

      <View ref={aboveKeyboard} style={styles.group}>
        <Field label={t('passwordCard.new')} error={nextError}>
          <PasswordField
            ref={nextInput}
            wrong={nextError != null}
            submitting={saving}
            editable={!saving}
            autoComplete="new-password"
            textContentType="newPassword"
            onChangeText={(text) => {
              next.current = text;
              setLengthMet(meetsPasswordLength(text));
              if (refusal?.field === 'newPassword') setRefusal(null);
              checks.edited('newPassword', text);
            }}
            onBlur={() => checks.left('newPassword', next.current)}
            returnKeyType="done"
            onSubmitEditing={() => void submit()}
            accessibilityLabel={t('passwordCard.new')}
            testID="password.new"
          />
        </Field>

        <PasswordRule met={lengthMet} testID="password" />

        <Text size={tokens.typeBodyPhone.size} style={styles.secondary}>
          {t('passwordCard.signsOut')}
        </Text>
        <Text size={tokens.typeBodyPhone.size} style={styles.secondary}>
          {t('passwordCard.emailed', { email })}
        </Text>

        <PrimaryButton
          label={saving ? t('passwordCard.saving') : t('passwordCard.save')}
          onPress={() => void submit()}
          busy={saving}
          testID="password.save"
        />
      </View>
      <QuietButton label={t('passwordCard.cancel')} onPress={onCancel} testID="password.cancel" />
    </>
  );
}

function Title({ text }: { text: string }) {
  return (
    <Text size={tokens.typeTitleSection.size} weight="bold" accessibilityRole="header">
      {text}
    </Text>
  );
}

const styles = StyleSheet.create({
  // As Security-* draws the password card, the same frame as the two-factor card beside it.
  card: {
    gap: tokens.spaceLg,
    borderRadius: tokens.radiusCardPhone,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
    backgroundColor: tokens.colorCard,
  },
  cardNarrow: { padding: tokens.spaceXxl },
  cardWide: { padding: tokens.space3xl, maxWidth: 640 },
  group: { gap: tokens.spaceLg },
  secondary: { color: tokens.colorInkSecondary },
});
