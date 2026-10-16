import { ApiError } from '@soirely/api-client';
import { formatCountdown } from '@soirely/domain';
import { router } from 'expo-router';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../src/api.ts';
import { LanguageChoice } from '../src/components/LanguageChoice.tsx';
import { Notice } from '../src/components/Notice.tsx';
import { Screen } from '../src/components/Screen.tsx';
import { Text } from '../src/components/Text.tsx';
import { useLayout } from '../src/layout/useLayout.ts';
import { tokens } from '../src/theme/tokens.ts';
import { OnboardingSteps } from '../src/components/OnboardingSteps.tsx';

const CARD_WIDTH = 520;
const FORM_COLUMN_WIDTH = 600;
const CONTROL_TEXT_SIZE = 16;

type Status =
  | { kind: 'entering' }
  | { kind: 'verifying' }
  | { kind: 'wrong' }
  | { kind: 'expired' }
  | { kind: 'exhausted' }
  | { kind: 'failed' }
  | { kind: 'verified' };

export default function VerifyEmail() {
  const { kind } = useLayout();
  const [status, setStatus] = useState<Status>({ kind: 'entering' });
  const [cooldown, setCooldown] = useState(0);
  const [address, setAddress] = useState('');

  useEffect(() => {
    let live = true;

    api
      .me()
      .then(async (account) => {
        if (!live) return;

        setAddress(account.emailAddresses.find((one) => one.primary)?.address ?? '');

        if (account.verified) {
          setStatus({ kind: 'verified' });

          return;
        }

        // Started by whichever send came last, the registration email included.
        const seconds = await api.verificationCooldown();

        if (live) setCooldown(seconds);
      })
      .catch(() => {
        if (live) setAddress('');
      });

    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;

    const tick = setTimeout(() => setCooldown((left) => left - 1), 1000);

    return () => clearTimeout(tick);
  }, [cooldown]);

  async function verify(code: string): Promise<void> {
    setStatus({ kind: 'verifying' });

    try {
      await api.verifyEmail(code);
      setStatus({ kind: 'verified' });
    } catch (error) {
      setStatus(refusalFrom(error));
    }
  }

  async function resend(): Promise<void> {
    try {
      setCooldown(await api.resendVerification());
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

  async function signOut(): Promise<void> {
    await api.signOut();
    router.replace('/sign-in');
  }

  const body = (
    <Body
      status={status}
      address={address}
      cooldown={cooldown}
      onVerify={verify}
      onResend={() => void resend()}
      onSignOut={() => void signOut()}
    />
  );

  if (kind === 'tabletLandscape') {
    return (
      <Landscape status={status} address={address}>
        {body}
      </Landscape>
    );
  }

  if (kind === 'tabletPortrait') {
    return (
      <Portrait status={status} address={address}>
        {body}
      </Portrait>
    );
  }

  return (
    <Phone status={status} address={address}>
      {body}
    </Phone>
  );
}

function Phone({
  status,
  address,
  children,
}: {
  status: Status;
  address: string;
  children: ReactNode;
}) {
  const { t } = useTranslation();

  return (
    <Screen style={styles.page} contentStyle={styles.phoneContent}>
      <View style={styles.brandRow}>
        <Text size={tokens.typeTitleDialog.size} weight="bold">
          {t('app.name')}
        </Text>
      </View>
      <OnboardingSteps at={status.kind === 'verified' ? 'verified' : 'verifying'} />
      <Heading status={status} address={address} size={tokens.typeTitlePhone.size} />
      {/* Done, the way on sits at the foot; before that, the form sits under the heading. */}
      {status.kind === 'verified' && <View style={styles.spacer} />}
      {children}
      {status.kind !== 'verified' && <View style={styles.spacer} />}
      <LanguageChoice />
    </Screen>
  );
}

function Portrait({
  status,
  address,
  children,
}: {
  status: Status;
  address: string;
  children: ReactNode;
}) {
  const { t } = useTranslation();

  return (
    <Screen style={styles.page} contentStyle={styles.portraitContent}>
      <View style={styles.brandRow}>
        <Text size={tokens.typeTitleDialog.size} weight="bold">
          {t('app.name')}
        </Text>
      </View>
      <View style={styles.centred}>
        <View style={styles.card}>
          <OnboardingSteps at={status.kind === 'verified' ? 'verified' : 'verifying'} />
          <Heading status={status} address={address} size={tokens.typeTitlePage.size} />
          {children}
        </View>
        <View style={styles.tabletLanguage}>
          <LanguageChoice />
        </View>
      </View>
    </Screen>
  );
}

function Landscape({
  status,
  address,
  children,
}: {
  status: Status;
  address: string;
  children: ReactNode;
}) {
  const { t } = useTranslation();

  return (
    <Screen style={styles.page} contentStyle={styles.landscapeContent}>
      <View style={styles.landscapeLeft}>
        <View style={styles.brandRow}>
          <Text size={tokens.typeTitleDialog.size} weight="bold">
            {t('app.name')}
          </Text>
        </View>
        <View style={styles.landscapeSaying}>
          <OnboardingSteps at={status.kind === 'verified' ? 'verified' : 'verifying'} />
          <Heading status={status} address={address} size={tokens.typeTitlePage.size} />
        </View>
        <LanguageChoice />
      </View>
      <View style={styles.landscapeRight}>
        <View style={[styles.card, styles.cardFill]}>{children}</View>
      </View>
    </Screen>
  );
}

function Heading({ status, address, size }: { status: Status; address: string; size: number }) {
  const { t } = useTranslation();
  const done = status.kind === 'verified';

  return (
    <>
      {done && (
        <View style={styles.verifiedMark}>
          <Text size={tokens.typeTitlePage.size} weight="bold" style={styles.onAccent}>
            ✓
          </Text>
        </View>
      )}
      <View style={styles.heading}>
        <Text size={size} weight="bold" style={styles.title}>
          {done ? t('verifyEmail.doneTitle') : t('verifyEmail.title')}
        </Text>
        <Text size={tokens.typeBodyPhone.size} style={styles.secondary}>
          {done ? t('verifyEmail.doneBody', { address }) : t('verifyEmail.intro', { address })}
        </Text>
      </View>
    </>
  );
}

function Body({
  status,
  cooldown,
  onVerify,
  onResend,
  onSignOut,
}: {
  status: Status;
  address: string;
  cooldown: number;
  onVerify: (code: string) => void;
  onResend: () => void;
  onSignOut: () => void;
}) {
  const { t } = useTranslation();
  const typed = useRef('');

  if (status.kind === 'verified') {
    return (
      <View style={styles.form}>
        <Pressable
          style={styles.cta}
          onPress={() => router.replace('/')}
          accessibilityRole="button"
          testID="verifyEmail.continue"
        >
          <Text size={CONTROL_TEXT_SIZE} weight="semibold" style={styles.onAccent}>
            {t('verifyEmail.continue')}
          </Text>
        </Pressable>
      </View>
    );
  }

  const asking = ['entering', 'verifying', 'wrong', 'failed'].includes(status.kind);

  return (
    <View style={styles.form}>
      {status.kind === 'expired' && (
        <Notice
          tone="attention"
          mark="!"
          title={t('verifyEmail.expiredTitle')}
          body={t('verifyEmail.expiredBody')}
        />
      )}

      {status.kind === 'exhausted' && (
        <Notice
          tone="attention"
          mark="!"
          title={t('verifyEmail.exhaustedTitle')}
          body={t('verifyEmail.exhaustedBody')}
        />
      )}

      {status.kind === 'failed' && (
        <Notice
          tone="broken"
          mark={tokens.marks.broken.glyph}
          title={t('verifyEmail.failedTitle')}
          body={t('verifyEmail.failedBody')}
        />
      )}

      {(status.kind === 'expired' || status.kind === 'exhausted') && (
        <Pressable
          style={styles.cta}
          onPress={onResend}
          accessibilityRole="button"
          testID="verifyEmail.resend"
        >
          <Text size={CONTROL_TEXT_SIZE} weight="semibold" style={styles.onAccent}>
            {t('verifyEmail.resend')}
          </Text>
        </Pressable>
      )}

      {asking && (
        <>
          <View style={styles.field}>
            <Text size={tokens.typeButton.size} weight="semibold">
              {t('verifyEmail.codeLabel')}
            </Text>
            <TextInput
              style={[styles.code, status.kind === 'wrong' && styles.codeWrong]}
              editable={status.kind !== 'verifying'}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="sms-otp"
              autoCorrect={false}
              spellCheck={false}
              returnKeyType="done"
              onChangeText={(text) => {
                typed.current = text;
              }}
              onSubmitEditing={() => onVerify(typed.current.trim())}
              cursorColor={tokens.colorInk}
              selectionColor={tokens.colorInk}
              accessibilityLabel={t('verifyEmail.codeLabel')}
              testID="verifyEmail.code"
            />
            {status.kind === 'wrong' && (
              <View style={styles.fieldError}>
                <View style={styles.mark}>
                  <Text size={tokens.typePill.size} weight="bold" style={styles.brokenInk}>
                    {tokens.marks.broken.glyph}
                  </Text>
                </View>
                <Text size={tokens.typeBodyPhone.size} style={styles.brokenInk}>
                  {t('verifyEmail.wrong')}
                </Text>
              </View>
            )}
          </View>

          <Pressable
            style={[styles.cta, status.kind === 'verifying' && styles.ctaOff]}
            onPress={() => onVerify(typed.current.trim())}
            disabled={status.kind === 'verifying'}
            accessibilityRole="button"
            testID="verifyEmail.submit"
          >
            <Text
              size={CONTROL_TEXT_SIZE}
              weight="semibold"
              style={status.kind === 'verifying' ? styles.secondary : styles.onAccent}
            >
              {status.kind === 'verifying' ? t('verifyEmail.submitting') : t('verifyEmail.submit')}
            </Text>
          </Pressable>

          <View style={styles.resend}>
            <Pressable
              style={[styles.secondaryButton, cooldown > 0 && styles.secondaryButtonOff]}
              onPress={onResend}
              disabled={cooldown > 0}
              accessibilityRole="button"
              testID="verifyEmail.resend"
            >
              <Text
                size={tokens.typeButton.size}
                weight="semibold"
                style={cooldown > 0 ? styles.secondary : styles.secondaryInk}
              >
                {cooldown > 0
                  ? t('verifyEmail.resendIn', { time: formatCountdown(cooldown) })
                  : t('verifyEmail.resend')}
              </Text>
            </Pressable>
            <Text size={tokens.typeSmall.size} style={styles.secondary}>
              {t('verifyEmail.resendNote')}
            </Text>
          </View>
        </>
      )}

      <View style={styles.footnote}>
        <Text size={tokens.typeBodyPhone.size} style={styles.secondary}>
          {t('verifyEmail.wrongAddress')}
        </Text>
        <Pressable
          style={styles.footnoteAction}
          onPress={onSignOut}
          accessibilityRole="button"
          testID="verifyEmail.signOut"
        >
          <Text size={tokens.typeBodyPhone.size} weight="semibold" style={styles.accentInk}>
            {t('verifyEmail.signOut')}
          </Text>
        </Pressable>
        <Text size={tokens.typeBodyPhone.size} style={styles.secondary}>
          {t('verifyEmail.wrongAddressBody')}
        </Text>
      </View>
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
  page: { backgroundColor: tokens.colorPage },

  phoneContent: {
    flexGrow: 1,
    gap: tokens.spaceXl,
    paddingTop: tokens.spaceSm,
    paddingHorizontal: tokens.space3xl,
    paddingBottom: tokens.space5xl,
  },
  portraitContent: { flexGrow: 1, gap: tokens.space3xl, padding: tokens.space6xl },
  landscapeContent: {
    flexGrow: 1,
    flexDirection: 'row',
    gap: tokens.space5xl,
    padding: tokens.space6xl,
  },

  brandRow: { height: tokens.sizeHit, justifyContent: 'center' },
  heading: { gap: tokens.spaceXs },
  title: { letterSpacing: -0.5 },
  secondary: { color: tokens.colorInkSecondary },
  accentInk: { color: tokens.colorAccentText },
  brokenInk: { color: tokens.colorBrokenText },
  onAccent: { color: tokens.colorInkOnDark },
  doneInk: { color: tokens.colorAccentText },
  spacer: { flex: 1 },

  centred: { alignItems: 'center', gap: tokens.space3xl },
  tabletLanguage: { width: CARD_WIDTH, maxWidth: '100%' },
  landscapeLeft: { flex: 1, gap: tokens.space3xl },
  landscapeSaying: { flex: 1, justifyContent: 'center', gap: tokens.spaceXl, maxWidth: 460 },
  landscapeRight: { width: FORM_COLUMN_WIDTH, maxWidth: '50%' },

  card: {
    width: CARD_WIDTH,
    maxWidth: '100%',
    gap: tokens.spaceXl,
    padding: tokens.space4xl,
    backgroundColor: tokens.colorCard,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
    borderRadius: tokens.radiusCardPhone,
  },
  cardFill: { width: '100%' },

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
  secondaryButtonOff: {
    backgroundColor: tokens.colorInset,
    borderColor: tokens.colorBorder,
  },
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
