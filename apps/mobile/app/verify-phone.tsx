import { type Account, ApiError } from '@soirely/api-client';
import { formatCountdown, formatPhone } from '@soirely/domain';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../src/api.ts';
import { AuthFrame, authTitleSize } from '../src/components/AuthFrame.tsx';
import { Notice } from '../src/components/Notice.tsx';
import { OnboardingSteps } from '../src/components/OnboardingSteps.tsx';
import { Text } from '../src/components/Text.tsx';
import { useLayout } from '../src/layout/useLayout.ts';
import { tokens } from '../src/theme/tokens.ts';

const CONTROL_TEXT_SIZE = 16;

type Status =
  | { kind: 'entering' }
  | { kind: 'verifying' }
  | { kind: 'wrong' }
  | { kind: 'expired' }
  | { kind: 'exhausted' }
  | { kind: 'failed' }
  | { kind: 'verified' };

export default function VerifyPhone() {
  const { t } = useTranslation();
  const titleSize = authTitleSize(useLayout().kind);
  const { from } = useLocalSearchParams<{ from?: string }>();
  const onboarding = from === 'onboarding';
  const [account, setAccount] = useState<Account | 'none' | null>(null);
  const [status, setStatus] = useState<Status>({ kind: 'entering' });
  const [cooldown, setCooldown] = useState(0);
  const [codeError, setCodeError] = useState<string | null>(null);
  const typed = useRef('');

  useEffect(() => {
    let live = true;

    api
      .me()
      .then((me) => {
        if (live) setAccount(me);
      })
      .catch(() => {
        if (live) setAccount('none');
      });

    api
      .phoneCooldown()
      .then((seconds) => {
        if (live) setCooldown(seconds);
      })
      .catch(() => {});

    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;

    const tick = setTimeout(() => setCooldown((left) => left - 1), 1000);

    return () => clearTimeout(tick);
  }, [cooldown]);

  if (account === 'none') return <Redirect href="/sign-in" />;
  if (account == null) return null;

  const phone = account.phoneNumbers.find((candidate) => candidate.primary);
  if (phone == null) return <Redirect href={onboarding ? '/phone?from=onboarding' : '/phone'} />;

  const number = formatPhone(phone.number);
  const verified = status.kind === 'verified' || phone.verified;

  async function verify(): Promise<void> {
    const code = typed.current.trim();

    // Checked before sending: present, and six digits.
    if (code === '') return setCodeError(t('verifyPhone.codeBlank'));
    if (!/^\d{6}$/u.test(code)) return setCodeError(t('verifyPhone.codeShort'));

    setCodeError(null);
    setStatus({ kind: 'verifying' });

    try {
      await api.verifyPhone(code);
      setStatus({ kind: 'verified' });
    } catch (error) {
      setStatus(refusalFrom(error));
    }
  }

  async function resend(): Promise<void> {
    try {
      setCooldown(await api.resendPhoneCode());
      setStatus({ kind: 'entering' });
    } catch (error) {
      const seconds =
        error instanceof ApiError ? Number(error.response?.headers.get('Retry-After')) : Number.NaN;

      if (Number.isFinite(seconds) && seconds > 0) {
        setCooldown(seconds);
        setStatus({ kind: 'entering' });

        return;
      }

      setStatus({ kind: 'failed' });
    }
  }

  // Saving the details with no number removes the phone, so the gate rests on the email again.
  async function withoutPhone(name: string): Promise<void> {
    try {
      await api.completeProfile({ name });
      router.replace('/');
    } catch {
      setStatus({ kind: 'failed' });
    }
  }

  const asking = ['entering', 'verifying', 'wrong', 'failed'].includes(status.kind);
  const fieldError = codeError ?? (status.kind === 'wrong' ? t('verifyPhone.wrong') : null);
  const changeHref = onboarding ? '/phone?from=onboarding' : '/phone';

  return (
    <AuthFrame
      saying={
        <>
          {onboarding && <OnboardingSteps at="details" />}
          {verified && (
            <View style={styles.verifiedMark}>
              <Text size={tokens.typeTitlePage.size} weight="bold" style={styles.onAccent}>
                ✓
              </Text>
            </View>
          )}
          <View style={styles.heading}>
            <Text size={titleSize} weight="bold" style={styles.title} accessibilityRole="header">
              {verified ? t('verifyPhone.doneTitle') : t('verifyPhone.title')}
            </Text>
            <Text size={tokens.typeBodyPhone.size} style={styles.secondary}>
              {verified
                ? t('verifyPhone.doneBody', { number })
                : t('verifyPhone.intro', { number })}
            </Text>
          </View>
        </>
      }
    >
      {verified ? (
        <Pressable
          style={styles.cta}
          onPress={() => router.replace('/')}
          accessibilityRole="button"
          testID="verifyPhone.continue"
        >
          <Text size={CONTROL_TEXT_SIZE} weight="semibold" style={styles.onAccent}>
            {t('verifyPhone.continue')}
          </Text>
        </Pressable>
      ) : (
        <View style={styles.form}>
          {status.kind === 'expired' && (
            <Notice
              tone="attention"
              mark="!"
              title={t('verifyPhone.expiredTitle')}
              body={t('verifyPhone.expiredBody')}
            />
          )}

          {status.kind === 'exhausted' && (
            <Notice
              tone="attention"
              mark="!"
              title={t('verifyPhone.exhaustedTitle')}
              body={t('verifyPhone.exhaustedBody')}
            />
          )}

          {status.kind === 'failed' && (
            <Notice
              tone="broken"
              mark={tokens.marks.broken.glyph}
              title={t('verifyPhone.failedTitle')}
              body={t('verifyPhone.failedBody')}
            />
          )}

          {(status.kind === 'expired' || status.kind === 'exhausted') && (
            <Pressable
              style={styles.cta}
              onPress={() => void resend()}
              accessibilityRole="button"
              testID="verifyPhone.resend"
            >
              <Text size={CONTROL_TEXT_SIZE} weight="semibold" style={styles.onAccent}>
                {t('verifyPhone.resend')}
              </Text>
            </Pressable>
          )}

          {asking && (
            <>
              <View style={styles.field}>
                <Text size={tokens.typeButton.size} weight="semibold">
                  {t('verifyPhone.codeLabel')}
                </Text>
                <TextInput
                  style={[styles.code, fieldError != null && styles.codeWrong]}
                  editable={status.kind !== 'verifying'}
                  keyboardType="number-pad"
                  textContentType="oneTimeCode"
                  autoComplete="sms-otp"
                  autoCorrect={false}
                  spellCheck={false}
                  maxLength={6}
                  returnKeyType="done"
                  onChangeText={(text) => {
                    typed.current = text;
                    setCodeError(null);
                  }}
                  onSubmitEditing={() => void verify()}
                  cursorColor={tokens.colorInk}
                  selectionColor={tokens.colorInk}
                  accessibilityLabel={t('verifyPhone.codeLabel')}
                  testID="verifyPhone.code"
                />
                {fieldError != null && (
                  <View style={styles.fieldError}>
                    <View style={styles.mark}>
                      <Text size={tokens.typePill.size} weight="bold" style={styles.brokenInk}>
                        {tokens.marks.broken.glyph}
                      </Text>
                    </View>
                    <Text size={tokens.typeBodyPhone.size} style={[styles.brokenInk, styles.grow]}>
                      {fieldError}
                    </Text>
                  </View>
                )}
              </View>

              <Pressable
                style={[styles.cta, status.kind === 'verifying' && styles.ctaOff]}
                onPress={() => void verify()}
                disabled={status.kind === 'verifying'}
                accessibilityRole="button"
                testID="verifyPhone.submit"
              >
                <Text
                  size={CONTROL_TEXT_SIZE}
                  weight="semibold"
                  style={status.kind === 'verifying' ? styles.secondary : styles.onAccent}
                >
                  {status.kind === 'verifying'
                    ? t('verifyPhone.submitting')
                    : t('verifyPhone.submit')}
                </Text>
              </Pressable>

              <View style={styles.resend}>
                <Pressable
                  style={[styles.secondaryButton, cooldown > 0 && styles.secondaryButtonOff]}
                  onPress={() => void resend()}
                  disabled={cooldown > 0}
                  accessibilityRole="button"
                  testID="verifyPhone.resendSoon"
                >
                  <Text
                    size={tokens.typeButton.size}
                    weight="semibold"
                    style={cooldown > 0 ? styles.secondary : styles.secondaryInk}
                  >
                    {cooldown > 0
                      ? t('verifyPhone.resendIn', { time: formatCountdown(cooldown) })
                      : t('verifyPhone.resend')}
                  </Text>
                </Pressable>
                <Text size={tokens.typeSmall.size} style={styles.secondary}>
                  {t('verifyPhone.resendNote')}
                </Text>
              </View>
            </>
          )}

          <Footnote
            question={t('verifyPhone.wrongNumber')}
            action={t('verifyPhone.changeIt')}
            onPress={() => router.push(changeHref)}
            testID="verifyPhone.change"
          />

          {onboarding && (
            <Footnote
              question={t('verifyPhone.cantGetTexts')}
              action={t('verifyPhone.carryOnWithout')}
              onPress={() => void withoutPhone(account.name)}
              testID="verifyPhone.carryOn"
            />
          )}
        </View>
      )}
    </AuthFrame>
  );
}

function Footnote({
  question,
  action,
  onPress,
  testID,
}: {
  question: string;
  action: string;
  onPress: () => void;
  testID: string;
}) {
  return (
    <View style={styles.footnote}>
      <Text size={tokens.typeBodyPhone.size} style={styles.secondary}>
        {question}
      </Text>
      <Pressable
        style={styles.footnoteAction}
        onPress={onPress}
        accessibilityRole="button"
        testID={testID}
      >
        <Text size={tokens.typeBodyPhone.size} weight="semibold" style={styles.accentInk}>
          {action}
        </Text>
      </Pressable>
    </View>
  );
}

function refusalFrom(error: unknown): Status {
  if (!(error instanceof ApiError)) return { kind: 'failed' };

  if (error.is('verification_code_expired')) return { kind: 'expired' };
  if (error.is('verification_code_exhausted')) return { kind: 'exhausted' };
  if (error.is('verification_code_invalid')) return { kind: 'wrong' };

  return { kind: 'failed' };
}

const styles = StyleSheet.create({
  heading: { gap: tokens.spaceXs },
  title: { letterSpacing: -0.5 },
  secondary: { color: tokens.colorInkSecondary },
  accentInk: { color: tokens.colorAccentText },
  brokenInk: { color: tokens.colorBrokenText },
  onAccent: { color: tokens.colorInkOnDark },
  grow: { flex: 1 },

  form: { gap: tokens.spaceXl },
  field: { gap: tokens.spaceXs },

  code: {
    height: tokens.sizeHitPhoneHero,
    paddingHorizontal: tokens.spaceLg,
    borderWidth: 1,
    borderColor: tokens.colorControlBorder,
    borderRadius: tokens.radiusInset,
    backgroundColor: tokens.colorCard,
    color: tokens.colorInk,
    fontSize: tokens.typeTitleDialog.size,
    fontWeight: '700',
    letterSpacing: 8,
    textAlign: 'center',
  },
  codeWrong: { borderColor: tokens.colorBroken },

  cta: {
    height: tokens.sizeHitPhonePrimary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: tokens.spaceXxl,
    borderRadius: tokens.sizeHitPhonePrimary / 2,
    backgroundColor: tokens.colorAccent,
  },
  ctaOff: { backgroundColor: tokens.colorBorder },

  resend: { alignItems: 'flex-start', gap: tokens.spaceXs },
  secondaryButton: {
    height: tokens.sizeHit,
    justifyContent: 'center',
    paddingHorizontal: tokens.spaceXl,
    borderRadius: tokens.sizeHit / 2,
    borderWidth: 1,
    borderColor: tokens.colorControlBorder,
    backgroundColor: tokens.colorCard,
  },
  secondaryButtonOff: { backgroundColor: tokens.colorInset, borderColor: tokens.colorBorder },
  secondaryInk: { color: tokens.colorInk },

  verifiedMark: {
    width: tokens.sizeHitPhoneHero,
    height: tokens.sizeHitPhoneHero,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.sizeHitPhoneHero / 2,
    backgroundColor: tokens.colorAccent,
  },

  mark: {
    width: tokens.sizeMark,
    height: tokens.sizeMark,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.sizeMark / 2,
    borderWidth: 1.5,
    borderColor: tokens.marks.broken.ring,
    backgroundColor: tokens.marks.broken.fill,
  },
  fieldError: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceSm },

  footnote: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: tokens.spaceXs,
    paddingTop: tokens.spaceLg,
    borderTopWidth: 1,
    borderTopColor: tokens.colorInsetBorder,
  },
  footnoteAction: { minHeight: tokens.sizeHit, justifyContent: 'center' },
});
