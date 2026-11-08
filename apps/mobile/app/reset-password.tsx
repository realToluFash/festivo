import { ApiError, awaiting } from '@soirely/api-client';
import { PASSWORD_MINIMUM_LENGTH, meetsPasswordLength } from '@soirely/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, type TextInputInstance, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { followAccount } from '../src/accountLanguage.ts';
import { api } from '../src/api.ts';
import { closeReset } from '../src/closeReset.ts';
import { PrimaryButton } from '../src/components/Buttons.tsx';
import { focusChecked, keysStayDown } from '../src/components/Field.tsx';
import { sayOnLanding } from '../src/components/LandingToast.tsx';
import { Pending } from '../src/components/Pending.tsx';
import { SecondFactorStep } from '../src/components/SecondFactorStep.tsx';
import { ruleRefusal, signInRoute } from '../src/kit/signInRules.ts';
import { landingFor } from '../src/landing.ts';
import { FieldLine, InsideField } from '../src/steps/InsideField.tsx';
import { Heading, Plain, Says } from '../src/steps/Lines.tsx';
import { NavBar, StepScreen } from '../src/steps/StepScreen.tsx';
import { tokens } from '../src/theme/tokens.ts';

type Status =
  | { kind: 'checking' }
  | { kind: 'ready'; email: string; tapped?: boolean }
  | { kind: 'saving'; email: string }
  | { kind: 'failed'; email: string }
  | { kind: 'code'; email: string }
  | { kind: 'used'; tapped: boolean }
  | { kind: 'expired'; tapped: boolean }
  | { kind: 'invalid'; tapped: boolean };

/** "Set a new password", from the emailed link. */
export default function ResetPassword() {
  const { t } = useTranslation();
  const { token = '' } = useLocalSearchParams<{ token?: string }>();
  const [status, setStatus] = useState<Status>({ kind: 'checking' });
  const [lengthMet, setLengthMet] = useState(false);
  const [short, setShort] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const typed = useRef('');
  const passwordInput = useRef<TextInputInstance>(null);

  useEffect(() => {
    let live = true;

    api
      .checkResetLink(token)
      .then(({ email, twoFactor }) => {
        // With two-factor on the code comes first, and nothing changes until it passes.
        if (live) setStatus({ kind: twoFactor ? 'code' : 'ready', email });
      })
      .catch((error: unknown) => {
        if (live) setStatus({ kind: deadFrom(error) ?? 'invalid', tapped: false });
      });

    return () => {
      live = false;
    };
  }, [token]);

  async function submit(): Promise<void> {
    if (status.kind !== 'ready' && status.kind !== 'failed') return;
    // The rule is stated before submit, so a short password is never sent: the line under the field turns.
    if (!meetsPasswordLength(typed.current)) {
      setShort(true);
      focusChecked(passwordInput);
      return;
    }

    const email = status.email;
    keysStayDown();
    setStatus({ kind: 'saving', email });

    try {
      const { account } = await api.resetPassword(token, typed.current);
      await followAccount(account);
      sayOnLanding(t('recovery.changed'));
      router.replace(landingFor(awaiting(account)));
    } catch (error) {
      const dead = deadFrom(error);
      const refusal = error instanceof ApiError ? ruleRefusal(error.problem) : null;

      // The password is set, but signs in only where a password sign-in would (sc-69).
      if (refusal != null) {
        router.replace(signInRoute(refusal, false));
      } else if (dead != null) {
        setStatus({ kind: dead, tapped: true });
      } else if (error instanceof ApiError && error.is('validation_failed')) {
        const violation = error.problem.violations?.find((v) => v.propertyPath === 'password');
        setRefusal(
          violation?.code === 'password_breached'
            ? t('register.breached')
            : (violation?.message ?? null),
        );
        setStatus({ kind: 'ready', email });
      } else {
        setStatus({ kind: 'failed', email });
      }
    }
  }

  if (status.kind === 'checking') {
    return (
      <StepScreen>
        <Pending />
      </StepScreen>
    );
  }

  if (status.kind === 'used' || status.kind === 'expired' || status.kind === 'invalid') {
    return (
      <StepScreen
        nav={<NavBar left="close" onLeft={closeReset} testID="recovery" />}
        foot={
          <PrimaryButton
            label={t('recovery.sendNew')}
            onPress={() => router.replace('/forgot-password?from=link')}
            testID="recovery.sendNew"
          />
        }
      >
        <Heading
          title={t(`recovery.${status.kind}Title`)}
          intro={t(`recovery.${status.kind}Body`)}
          answer={status.tapped ? status : undefined}
        />
      </StepScreen>
    );
  }

  if (status.kind === 'code') {
    const email = status.email;

    return (
      <SecondFactorStep
        intro={t('recovery.codeIntro', { email })}
        recoveryIntro={t('recovery.codeRecoveryIntro')}
        submitLabel={t('recovery.continueToPassword')}
        pausedNote={t('recovery.nothingChanged')}
        failedTitle={t('recovery.failedTitle')}
        failedBody={t('recovery.failedBody')}
        onVerify={async (factor) => {
          try {
            await api.passResetCode(token, factor);
          } catch (error) {
            const dead = deadFrom(error);
            if (dead == null) throw error;
            setStatus({ kind: dead, tapped: true });
            return;
          }
          setStatus({ kind: 'ready', email, tapped: true });
        }}
        onExpired={() => setStatus({ kind: 'expired', tapped: false })}
      />
    );
  }

  const saving = status.kind === 'saving';
  const rule = t('register.ruleLength', { count: PASSWORD_MINIMUM_LENGTH });

  return (
    <StepScreen
      nav={<NavBar left="close" onLeft={closeReset} testID="recovery" />}
      foot={
        <PrimaryButton
          label={saving ? t('recovery.saving') : t('recovery.save')}
          onPress={() => void submit()}
          busy={saving}
          testID="recovery.save"
        />
      }
    >
      <Heading
        title={t('recovery.newTitle')}
        intro={t('recovery.newFor', { email: status.email })}
        answer={status.kind === 'ready' && status.tapped === true ? status : undefined}
      />
      {status.kind === 'failed' && (
        <Says words={`${t('recovery.failedTitle')}. ${t('recovery.failedBody')}`} />
      )}
      <View style={styles.first}>
        <InsideField
          ref={passwordInput}
          label={t('recovery.newPassword')}
          onChangeText={(text) => {
            typed.current = text;
            setLengthMet(meetsPasswordLength(text));
            setShort(false);
            setRefusal(null);
          }}
          password
          state={short || refusal != null ? 'blank' : 'plain'}
          line={refusal ?? rule}
          submitting={saving}
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="go"
          submitBehavior="submit"
          onSubmitEditing={() => void submit()}
          autoFocus
          testID="recovery.password"
        />
        {refusal != null ? (
          <Says words={refusal} />
        ) : (
          <FieldLine words={rule} tone={lengthMet ? 'met' : short ? 'wrong' : 'unmet'} />
        )}
      </View>
      <Plain top={tokens.spaceXl}>{t('recovery.signsOut')}</Plain>
    </StepScreen>
  );
}

function deadFrom(error: unknown): 'used' | 'expired' | 'invalid' | null {
  if (!(error instanceof ApiError)) return null;
  if (error.is('reset_link_used')) return 'used';
  if (error.is('reset_link_expired')) return 'expired';
  if (error.is('reset_link_invalid')) return 'invalid';

  return null;
}

const styles = StyleSheet.create({
  first: { marginTop: tokens.space3xl },
});
