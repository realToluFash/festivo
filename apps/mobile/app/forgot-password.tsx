import { ApiError } from '@soirely/api-client';
import { formatCountdown, formatTimeOfDay, lockLiftsAt } from '@soirely/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, type TextInputInstance, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../src/api.ts';
import { closeReset } from '../src/closeReset.ts';
import { PrimaryButton, QuietButton } from '../src/components/Buttons.tsx';
import { focusChecked, keysStayDown } from '../src/components/Field.tsx';
import { dateLocale } from '../src/i18n/index.ts';
import { emailMessage, useFormChecks } from '../src/kit/formChecks.ts';
import { mailAppOpens, openMailApp } from '../src/mailApp.ts';
import { InsideField } from '../src/steps/InsideField.tsx';
import { Heading, Plain, Says } from '../src/steps/Lines.tsx';
import { RESEND_SECONDS } from '../src/steps/rules.ts';
import { NavBar, StepScreen } from '../src/steps/StepScreen.tsx';
import { useCountdown } from '../src/steps/useCountdown.ts';
import { tokens } from '../src/theme/tokens.ts';

/** The step that pushed this one, when it is not Sign in; `link`, a dead reset link, replaced itself with it. */
export type ForgotFrom = 'code' | 'recovery' | 'security' | 'link';

type Status =
  | { kind: 'asking' }
  | { kind: 'sending' }
  | { kind: 'sent'; email: string; again: boolean }
  | { kind: 'limited'; time: string }
  | { kind: 'failed' };

/** "Reset your password": an address in, and the same answer whether or not it has an account. */
export default function ForgotPassword() {
  const { t } = useTranslation();
  const { from, email: carried } = useLocalSearchParams<{ from?: ForgotFrom; email?: string }>();
  const [status, setStatus] = useState<Status>({ kind: 'asking' });
  const [mail, setMail] = useState(false);
  const { left: cooldown, restart: setCooldown } = useCountdown(0);
  // Uncontrolled: a `value` prop re-renders between keystrokes and drops characters.
  const typed = useRef(carried ?? '');
  // What the field remounts with after Check your email, as it was typed; at first, the address sign-in carried.
  const [kept, setKept] = useState(carried ?? '');
  const emailInput = useRef<TextInputInstance>(null);
  const checks = useFormChecks(
    ['email'] as const,
    (_field, value) => emailMessage(value, t),
    () => focusChecked(emailInput),
  );

  useEffect(() => {
    let live = true;
    void mailAppOpens().then((opens) => {
      if (live) setMail(opens);
    });

    return () => {
      live = false;
    };
  }, []);

  async function send(email: string, again: boolean): Promise<void> {
    setStatus({ kind: 'sending' });

    try {
      await api.forgotPassword(email);
      setStatus({ kind: 'sent', email, again });
      if (again) setCooldown(RESEND_SECONDS);
    } catch (error) {
      setStatus(refusalFrom(error));
    }
  }

  function submit(): void {
    if (status.kind === 'sending') return;

    const email = typed.current.trim();
    if (!checks.passes({ email })) return;

    setKept(typed.current);
    keysStayDown();
    void send(email, false);
  }

  const back = () =>
    from === 'link'
      ? closeReset()
      : router.canGoBack()
        ? router.back()
        : router.replace('/sign-in');

  if (status.kind === 'sent') {
    const sendAgain = () => void send(status.email, true);
    const againLabel =
      cooldown > 0
        ? t('recovery.sendAgainIn', { time: formatCountdown(cooldown) })
        : t('recovery.sendAgain');

    return (
      <StepScreen
        nav={<NavBar left="close" onLeft={back} testID="recovery" />}
        foot={
          mail ? (
            <>
              <PrimaryButton
                label={t('recovery.openMail')}
                onPress={openMailApp}
                testID="recovery.openMail"
              />
              <QuietButton
                label={againLabel}
                onPress={sendAgain}
                off={cooldown > 0}
                testID="recovery.sendAgain"
              />
            </>
          ) : (
            <PrimaryButton
              label={againLabel}
              onPress={sendAgain}
              off={cooldown > 0}
              testID="recovery.sendAgain"
            />
          )
        }
      >
        <Heading
          title={t('recovery.sentTitle')}
          intro={t('recovery.sentFor', { email: status.email })}
          answer={status}
        />
        <Plain top={tokens.spaceXl}>
          {status.again ? t('recovery.sentAgain') : t('recovery.spam')}
        </Plain>
      </StepScreen>
    );
  }

  const sending = status.kind === 'sending';

  return (
    <StepScreen
      nav={<NavBar left={from === 'link' ? 'close' : 'back'} onLeft={back} testID="recovery" />}
      foot={
        <PrimaryButton
          label={sending ? t('recovery.sending') : t('recovery.send')}
          onPress={submit}
          busy={sending}
          testID="recovery.send"
        />
      }
    >
      <Heading title={t('recovery.title')} intro={t('recovery.intro')} />
      {status.kind === 'limited' && (
        <Says words={t('recovery.limitedLine', { time: status.time })} quiet />
      )}
      {status.kind === 'failed' && <Says words={t('recovery.failedLine')} />}
      <View style={styles.first}>
        <InsideField
          ref={emailInput}
          label={t('recovery.email')}
          defaultValue={kept}
          onChangeText={(text) => {
            typed.current = text;
            checks.edited('email', text);
          }}
          onBlur={() => checks.left('email', typed.current)}
          state={checks.errors.email == null ? 'plain' : 'blank'}
          line={checks.errors.email}
          submitting={sending}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="username"
          returnKeyType="send"
          submitBehavior="submit"
          onSubmitEditing={submit}
          autoFocus={kept === ''}
          testID="recovery.email"
        />
        {checks.errors.email != null && <Says words={checks.errors.email} />}
      </View>
    </StepScreen>
  );
}

function refusalFrom(error: unknown): Status {
  if (error instanceof ApiError && error.is('too_many_attempts')) {
    const liftsAt = lockLiftsAt(Number(error.response?.headers.get('Retry-After')));

    if (liftsAt != null) return { kind: 'limited', time: formatTimeOfDay(liftsAt, dateLocale()) };
  }

  return { kind: 'failed' };
}

const styles = StyleSheet.create({
  first: { marginTop: tokens.space3xl },
});
