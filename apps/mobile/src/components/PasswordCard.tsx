import { ApiError, type LinkedProvider } from '@soirely/api-client';
import { cleanCode, codeProblem, formatCountdown, meetsPasswordLength } from '@soirely/domain';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, type TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import { currentLocale } from '../i18n/index.ts';
import { type LayoutKind } from '../layout/useLayout.ts';
import { useFormChecks } from '../kit/formChecks.ts';
import { retryAfter } from '../kit/code.ts';
import {
  type PasswordRefusal,
  passwordRefusal,
  setCodeRefusal as setCodeRefusalFrom,
} from '../kit/passwordChange.ts';
import { tokens } from '../theme/tokens.ts';
import { currentSessionId } from '../tokens.ts';
import { PrimaryButton, QuietButton, SecondaryButton } from './Buttons.tsx';
import { cardFrame } from './cardFrame.ts';
import { CodeField, Field } from './Field.tsx';
import { Notice } from './Notice.tsx';
import { PasswordField } from './PasswordField.tsx';
import { PasswordRule } from './PasswordRule.tsx';
import { useAboveKeyboard } from './Screen.tsx';
import { Text } from './Text.tsx';

const PROVIDER_NAMES: Record<string, string> = { google: 'Google', apple: 'Apple' };

type Stage =
  | { kind: 'atRest'; signedOut: number | null; added: string | null }
  | { kind: 'changing' }
  | { kind: 'setting' };

/** Settings > Security, the first card, in the app: change the password (sc-116), or add one (sc-391). */
export function PasswordCard({
  email,
  hasPassword,
  providers,
  kind,
  onAdded,
  setting = false,
  onSetting,
  onChanged,
}: {
  email: string;
  hasPassword: boolean;
  providers: readonly LinkedProvider[];
  kind: LayoutKind;
  onAdded: () => Promise<void>;
  /** Opened from elsewhere too: the ways-to-sign-in card offers Set a password for the last way in. */
  setting?: boolean;
  onSetting?: (on: boolean) => void;
  /** A change signs out every other device, so a list of them is now out of date. */
  onChanged?: () => void;
}) {
  const { t } = useTranslation();
  const [stage, setStage] = useState<Stage>({ kind: 'atRest', signedOut: null, added: null });
  const open = (next: Stage) => {
    setStage(next);
    onSetting?.(next.kind === 'setting');
  };
  const frame = cardFrame(kind);
  const first = providers[0]?.provider;
  const provider = first == null ? '' : (PROVIDER_NAMES[first] ?? first);

  if (!hasPassword) {
    return (
      <View style={frame}>
        {stage.kind === 'setting' || setting ? (
          <Setting
            email={email}
            onAdded={async () => {
              await onAdded();
              open({ kind: 'atRest', signedOut: null, added: provider });
            }}
            onCancel={() => open({ kind: 'atRest', signedOut: null, added: null })}
          />
        ) : (
          <>
            <Title text={t('passwordCard.title')} />
            <Text size={tokens.typeBodyPhone.size} style={styles.secondary}>
              {t('passwordCard.setRest', { provider })}
            </Text>
            <SecondaryButton
              label={t('passwordCard.set')}
              onPress={() => open({ kind: 'setting' })}
              testID="password.set"
            />
          </>
        )}
      </View>
    );
  }

  return (
    <View style={frame}>
      {stage.kind !== 'changing' ? (
        <>
          <Title text={t('passwordCard.title')} />
          {stage.kind === 'atRest' && (stage.signedOut != null || stage.added != null) && (
            <Notice
              tone="done"
              mark={tokens.marks.done.glyph}
              body={
                stage.added != null
                  ? t('passwordCard.added', { provider: stage.added })
                  : t('passwordCard.done', { count: stage.signedOut ?? 0 })
              }
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
          onChanged={(signedOut) => {
            setStage({ kind: 'atRest', signedOut, added: null });
            onChanged?.();
          }}
          onCancel={() => setStage({ kind: 'atRest', signedOut: null, added: null })}
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

/** The code from the email first, then the password: the provider session alone may not add one. */
function Setting({
  email,
  onAdded,
  onCancel,
}: {
  email: string;
  onAdded: () => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [step, setStep] = useState<'code' | 'password'>('code');
  const stepUp = useRef('');
  const [codeRefusal, setCodeRefusal] = useState<string | null>(null);
  const [paused, setPaused] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lengthMet, setLengthMet] = useState(false);
  const [passwordRefusal, setPasswordRefusal] = useState<string | null>(null);
  const code = useRef('');
  const password = useRef('');
  const codeInput = useRef<TextInput>(null);
  const passwordInput = useRef<TextInput>(null);
  const aboveKeyboard = useAboveKeyboard();
  const codeChecks = useFormChecks(
    ['code'] as const,
    (_field, value) => {
      const problem = codeProblem(value);
      if (problem == null) return null;

      return problem === 'blank' ? t('passwordCard.setCodeBlank') : t('passwordCard.setCodeShort');
    },
    () => codeInput.current?.focus(),
  );
  const passwordChecks = useFormChecks(
    ['password'] as const,
    (_field, value) => (value === '' ? t('passwordCard.setNewBlank') : null),
    () => passwordInput.current?.focus(),
  );

  async function send(): Promise<void> {
    setFailed(false);

    try {
      setCooldown(await api.startSettingPassword());
    } catch (error) {
      const seconds = retryAfter(error);
      if (seconds == null) setFailed(true);
      else setCooldown(seconds);
    }
  }

  // Sent once, when the step opens; Send a new code sends again.
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    void send();
  });

  useEffect(() => {
    if (cooldown <= 0) return;
    const tick = setTimeout(() => setCooldown((left) => left - 1), 1000);

    return () => clearTimeout(tick);
  }, [cooldown]);

  async function passCode(): Promise<void> {
    if (busy || !codeChecks.passes({ code: code.current })) return;
    setBusy(true);

    try {
      stepUp.current = await api.passPasswordCode(cleanCode(code.current));
      setStep('password');
    } catch (error) {
      const refused = setCodeRefusalFrom(error, t, currentLocale());
      setCodeRefusal(refused.refusal);
      setPaused(refused.paused);
    } finally {
      setBusy(false);
    }
  }

  async function save(): Promise<void> {
    if (busy || !passwordChecks.passes({ password: password.current })) return;

    // The rule is stated before submit, so a short password is never sent.
    if (!meetsPasswordLength(password.current)) {
      passwordInput.current?.focus();
      return;
    }

    setBusy(true);

    try {
      await api.setPassword(password.current, stepUp.current);
      await onAdded();
    } catch (error) {
      setBusy(false);

      if (error instanceof ApiError && error.is('verification_code_expired')) {
        setCodeRefusal(t('passwordCard.setCodeExpired'));
        setStep('code');
        return;
      }

      const violation =
        error instanceof ApiError
          ? error.problem.violations?.find((v) => v.propertyPath === 'newPassword')
          : undefined;
      setPasswordRefusal(
        violation?.code === 'password_breached'
          ? t('register.breached')
          : (violation?.message ?? t('passwordCard.failedBody')),
      );
    }
  }

  if (step === 'password') {
    const error = passwordChecks.errors.password ?? passwordRefusal;

    return (
      <>
        <Title text={t('passwordCard.setNewTitle')} />
        <View ref={aboveKeyboard} style={styles.group}>
          <Field label={t('passwordCard.setNewLabel')} error={error}>
            <PasswordField
              ref={passwordInput}
              wrong={error != null}
              submitting={busy}
              editable={!busy}
              autoComplete="new-password"
              textContentType="newPassword"
              onChangeText={(text) => {
                password.current = text;
                setLengthMet(meetsPasswordLength(text));
                setPasswordRefusal(null);
                passwordChecks.edited('password', text);
              }}
              onBlur={() => passwordChecks.left('password', password.current)}
              returnKeyType="done"
              onSubmitEditing={() => void save()}
              accessibilityLabel={t('passwordCard.setNewLabel')}
              testID="password.setNew"
            />
          </Field>
          <PasswordRule met={lengthMet} testID="password.set" />
          <Text size={tokens.typeBodyPhone.size} style={styles.secondary}>
            {t('passwordCard.setEmailed', { email })}
          </Text>
          <PrimaryButton
            label={busy ? t('passwordCard.saving') : t('passwordCard.setSave')}
            onPress={() => void save()}
            busy={busy}
            testID="password.setSave"
          />
        </View>
        <QuietButton
          label={t('passwordCard.cancel')}
          onPress={onCancel}
          testID="password.setCancel"
        />
      </>
    );
  }

  const codeError = codeChecks.errors.code ?? codeRefusal;

  return (
    <>
      <Title text={t('passwordCard.setCodeTitle')} />
      {paused != null && (
        <Notice tone="attention" mark="!" title={t('passwordCard.pausedTitle')} body={paused} />
      )}
      {failed && (
        <Notice
          tone="broken"
          mark={tokens.marks.broken.glyph}
          title={t('passwordCard.failedTitle')}
          body={t('passwordCard.setSendFailed')}
        />
      )}
      <Text size={tokens.typeBodyPhone.size} style={styles.secondary}>
        {t('passwordCard.setCodeIntro', { email })}
      </Text>
      <View ref={aboveKeyboard} style={styles.group}>
        <Field label={t('passwordCard.setCodeLabel')} error={codeError}>
          <CodeField
            ref={codeInput}
            wrong={codeError != null}
            editable={!busy}
            onChangeText={(text) => {
              code.current = text;
              setCodeRefusal(null);
              codeChecks.edited('code', text);
            }}
            onBlur={() => codeChecks.left('code', code.current)}
            returnKeyType="done"
            onSubmitEditing={() => void passCode()}
            accessibilityLabel={t('passwordCard.setCodeLabel')}
            testID="password.setCode"
          />
        </Field>
        <Text size={tokens.typeBodyPhone.size} style={styles.secondary}>
          {t('passwordCard.setCodeNote')}
        </Text>
        <PrimaryButton
          label={t('passwordCard.continue')}
          onPress={() => void passCode()}
          busy={busy}
          testID="password.setContinue"
        />
      </View>
      <SecondaryButton
        label={
          cooldown > 0
            ? t('passwordCard.resendIn', { time: formatCountdown(cooldown) })
            : t('passwordCard.resend')
        }
        onPress={() => void send()}
        off={cooldown > 0}
        testID="password.setResend"
      />
      <QuietButton
        label={t('passwordCard.cancel')}
        onPress={onCancel}
        testID="password.setCancelCode"
      />
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
  group: { gap: tokens.spaceLg },
  secondary: { color: tokens.colorInkSecondary },
});
