import { ApiError } from '@soirely/api-client';
import { formatTimeOfDay } from '@soirely/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { type ReactNode, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../src/api.ts';
import { LanguageChoice } from '../src/components/LanguageChoice.tsx';
import { ProviderSignIn } from '../src/components/ProviderSignIn.tsx';
import { Screen } from '../src/components/Screen.tsx';
import { Text } from '../src/components/Text.tsx';
import { currentLocale } from '../src/i18n/index.ts';
import { useLayout } from '../src/layout/useLayout.ts';
import { tokens } from '../src/theme/tokens.ts';

/**
 * Sign in, drawn from `SignIn-*.dc.html` and NOT yet wired to the API.
 *
 * The form posts to `/api/auth/login`, which hands back an access token for
 * memory and a refresh token for the Keychain — see `src/tokens.ts`. Both
 * failures the endpoint distinguishes are shown as the design draws them, and
 * a wrong address and a wrong password are deliberately one message.
 *
 * Three layouts, and they are different arrangements rather than one rescaled:
 * the phone puts the form on the page under the brand; tablet portrait centres
 * a card; tablet landscape splits the window, saying what this is on the left
 * and asking for it on the right.
 */
/** Two widths the artboards set, and the token scale has no name for. */
const CARD_WIDTH = 520;
const FORM_COLUMN_WIDTH = 600;

/**
 * The size of anything typed or pressed here. It is the smallest size iOS
 * will not zoom into on focus, and a form that zooms when the keyboard appears
 * has lost its layout.
 */
const CONTROL_TEXT_SIZE = 16;

type Status =
  | { kind: 'ready' }
  | { kind: 'signingIn' }
  | { kind: 'refused' }
  | { kind: 'rateLimited'; retryAt: string }
  | { kind: 'providerFailed'; provider: string }
  | { kind: 'failed' }
  | { kind: 'sessionEnded' };

export default function SignIn() {
  const { kind } = useLayout();
  const { signedOut } = useLocalSearchParams<{ signedOut?: string }>();
  const [status, setStatus] = useState<Status>(
    signedOut == null ? { kind: 'ready' } : { kind: 'sessionEnded' },
  );

  async function signIn(email: string, password: string): Promise<void> {
    setStatus({ kind: 'signingIn' });

    try {
      await api.signIn(email, password);
      router.replace('/');
    } catch (error) {
      setStatus(refusalFrom(error));
    }
  }

  const form = <Credentials status={status} onSubmit={signIn} />;

  if (kind === 'tabletLandscape') {
    return <Landscape>{form}</Landscape>;
  }

  if (kind === 'tabletPortrait') {
    return <Portrait>{form}</Portrait>;
  }

  return <Phone>{form}</Phone>;
}

/** One column, the brand above it, the language at the bottom of the reach. */
function Phone({ children }: { children: ReactNode }) {
  const { t } = useTranslation();

  return (
    <Screen style={styles.page} contentStyle={styles.phoneContent}>
      <View style={styles.brandRow}>
        <Text size={tokens.typeTitleDialog.size} weight="bold" style={styles.brand}>
          {t('app.name')}
        </Text>
      </View>
      <Text size={tokens.typeTitlePhone.size} weight="bold" style={styles.title}>
        {t('signIn.title')}
      </Text>
      {children}
      <View style={styles.spacer} />
      <LanguageChoice />
    </Screen>
  );
}

/** A card in the middle of the window, with the language under it. */
function Portrait({ children }: { children: ReactNode }) {
  const { t } = useTranslation();

  return (
    <Screen style={styles.page} contentStyle={styles.portraitContent}>
      <View style={styles.brandRow}>
        <Text size={tokens.typeTitleDialog.size} weight="bold" style={styles.brand}>
          {t('app.name')}
        </Text>
      </View>
      <View style={styles.centred}>
        <View style={styles.card}>
          <Text size={tokens.typeTitlePage.size} weight="bold" style={styles.title}>
            {t('signIn.title')}
          </Text>
          {children}
        </View>
        <View style={styles.tabletLanguage}>
          <LanguageChoice />
        </View>
      </View>
    </Screen>
  );
}

/**
 * The structure portrait cannot have: what this is stays on the left while the
 * form is worked on the right, so neither has to move for the other.
 */
function Landscape({ children }: { children: ReactNode }) {
  const { t } = useTranslation();

  return (
    <Screen style={styles.page} contentStyle={styles.landscapeContent}>
      <View style={styles.landscapeLeft}>
        <View style={styles.brandRow}>
          <Text size={tokens.typeTitleDialog.size} weight="bold" style={styles.brand}>
            {t('app.name')}
          </Text>
        </View>
        <View style={styles.landscapeSaying}>
          <Text size={tokens.typeTitlePage.size} weight="bold" style={styles.title}>
            {t('signIn.title')}
          </Text>
          <Text size={tokens.typeBodyPhone.size} style={styles.secondary}>
            {t('signIn.landscapeIntro')}
          </Text>
        </View>
        <LanguageChoice />
      </View>
      <View style={styles.landscapeRight}>
        <View style={[styles.card, styles.cardFill]}>{children}</View>
      </View>
    </Screen>
  );
}

function Credentials({
  status,
  onSubmit,
}: {
  status: Status;
  onSubmit: (email: string, password: string) => void;
}) {
  const { t } = useTranslation();
  const [revealed, setRevealed] = useState(false);
  const [email, setEmail] = useState('');
  const [secret, setSecret] = useState('');
  const password = useRef<TextInput>(null);

  const submit = (): void => {
    onSubmit(email.trim(), secret);
  };

  const busy = status.kind === 'signingIn';
  const locked = status.kind === 'rateLimited';

  return (
    <View style={styles.form}>
      {status.kind === 'sessionEnded' && (
        <Notice
          tone="quiet"
          mark={tokens.marks.info.glyph}
          title={t('signIn.endedTitle')}
          body={t('signIn.endedBody')}
        />
      )}

      {status.kind === 'failed' && (
        <Notice
          tone="broken"
          mark={tokens.marks.broken.glyph}
          title={t('signIn.failedTitle')}
          body={t('signIn.failedBody')}
        />
      )}

      {status.kind === 'rateLimited' && (
        <Notice
          tone="attention"
          mark="!"
          title={t('signIn.lockedTitle')}
          body={t('signIn.lockedBody', { time: status.retryAt })}
        />
      )}

      {status.kind === 'providerFailed' && (
        <Notice
          tone="broken"
          mark={tokens.marks.broken.glyph}
          title={t('signIn.providerFailedTitle', { provider: status.provider })}
          body={t('signIn.providerFailedBody', { provider: status.provider })}
        />
      )}

      <View style={styles.field}>
        <Text size={tokens.typeButton.size} weight="semibold">
          {t('signIn.email')}
        </Text>
        <TextInput
          style={styles.input}
          editable={!busy}
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          value={email}
          onChangeText={setEmail}
          returnKeyType="next"
          onSubmitEditing={() => password.current?.focus()}
          placeholderTextColor={tokens.colorInkTertiary}
          cursorColor={tokens.colorInk}
          selectionColor={tokens.colorInk}
          accessibilityLabel={t('signIn.email')}
        />
      </View>

      <View style={styles.field}>
        <Text size={tokens.typeButton.size} weight="semibold">
          {t('signIn.password')}
        </Text>
        <View style={styles.revealWrap}>
          <TextInput
            ref={password}
            style={[
              styles.input,
              styles.inputWithReveal,
              status.kind === 'refused' && styles.inputWrong,
            ]}
            editable={!busy}
            secureTextEntry={!revealed}
            autoComplete="current-password"
            textContentType="password"
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            value={secret}
            onChangeText={setSecret}
            returnKeyType="go"
            onSubmitEditing={submit}
            placeholderTextColor={tokens.colorInkTertiary}
            cursorColor={tokens.colorInk}
            selectionColor={tokens.colorInk}
            accessibilityLabel={t('signIn.password')}
          />
          <Pressable
            style={styles.reveal}
            onPress={() => setRevealed((shown) => !shown)}
            accessibilityRole="button"
            accessibilityState={{ selected: revealed }}
          >
            <Text size={tokens.typeButton.size} weight="semibold" style={styles.accentText}>
              {revealed ? t('signIn.conceal') : t('signIn.reveal')}
            </Text>
          </Pressable>
        </View>

        {status.kind === 'refused' && (
          <View style={styles.fieldError}>
            <View style={[styles.mark, styles.markSmall, styles.markBroken]}>
              <Text size={tokens.typePill.size} weight="bold" style={styles.brokenText}>
                ✕
              </Text>
            </View>
            <Text size={tokens.typeBodyPhone.size} style={styles.brokenText}>
              {t('signIn.refused')}
            </Text>
          </View>
        )}
      </View>

      <Pressable
        style={[styles.cta, (busy || locked) && styles.ctaOff]}
        onPress={submit}
        disabled={busy || locked}
        accessibilityRole="button"
        accessibilityState={{ disabled: busy || locked }}
      >
        <Text
          size={CONTROL_TEXT_SIZE}
          weight="semibold"
          style={busy || locked ? styles.ctaOffText : styles.ctaText}
        >
          {locked
            ? t('signIn.lockedUntil', { time: status.retryAt })
            : busy
              ? t('signIn.submitting')
              : t('signIn.submit')}
        </Text>
      </Pressable>

      <ProviderSignIn />
    </View>
  );
}

/** A shape and a word, never a colour on its own. */
/**
 * Which refusal this was, in the two cases the API distinguishes. Anything
 * else is one message rather than a guess at the cause.
 */
function refusalFrom(error: unknown): Status {
  if (!(error instanceof ApiError)) return { kind: 'failed' };

  if (error.is('invalid_credentials')) return { kind: 'refused' };

  if (error.is('too_many_attempts')) {
    const seconds = Number(error.response?.headers.get('Retry-After'));

    if (Number.isFinite(seconds) && seconds > 0) {
      return {
        kind: 'rateLimited',
        retryAt: formatTimeOfDay(new Date(Date.now() + seconds * 1000), currentLocale()),
      };
    }
  }

  return { kind: 'failed' };
}

function Notice({
  tone,
  mark,
  title,
  body,
}: {
  tone: 'quiet' | 'attention' | 'broken';
  mark: string;
  title: string;
  body: string;
}) {
  const surface = {
    quiet: styles.noticeQuiet,
    attention: styles.noticeAttention,
    broken: styles.noticeBroken,
  }[tone];

  const ring = {
    quiet: styles.markInfo,
    attention: styles.markAttention,
    broken: styles.markBroken,
  }[tone];

  const ink = {
    quiet: styles.infoText,
    attention: styles.attentionText,
    broken: styles.brokenText,
  }[tone];

  return (
    <View style={[styles.notice, surface]}>
      <View style={[styles.mark, ring]}>
        <Text size={tokens.typePill.size} weight="bold" style={ink}>
          {mark}
        </Text>
      </View>
      <View style={styles.noticeBody}>
        <Text
          size={tokens.typeRowTitle.size}
          weight="bold"
          style={tone === 'quiet' ? undefined : ink}
        >
          {title}
        </Text>
        <Text size={tokens.typeBodyPhone.size}>{body}</Text>
      </View>
    </View>
  );
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
  portraitContent: {
    flexGrow: 1,
    gap: tokens.space3xl,
    padding: tokens.space6xl,
  },
  landscapeContent: {
    flexGrow: 1,
    flexDirection: 'row',
    gap: tokens.space5xl,
    padding: tokens.space6xl,
  },

  brandRow: { height: tokens.sizeHit, justifyContent: 'center' },
  brand: { letterSpacing: -0.4 },
  title: { letterSpacing: -0.5 },
  secondary: { color: tokens.colorInkSecondary },
  spacer: { flex: 1 },

  centred: { alignItems: 'center', gap: tokens.space3xl },
  tabletLanguage: { width: CARD_WIDTH, maxWidth: '100%' },

  landscapeLeft: { flex: 1, gap: tokens.space3xl },
  landscapeSaying: { flex: 1, justifyContent: 'center', gap: tokens.spaceLg, maxWidth: 460 },
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

  input: {
    height: tokens.sizeHitPhonePrimary,
    paddingHorizontal: tokens.spaceLg,
    borderWidth: 1,
    borderColor: tokens.colorControlBorder,
    borderRadius: tokens.radiusField,
    backgroundColor: tokens.colorCard,
    color: tokens.colorInk,
    fontSize: CONTROL_TEXT_SIZE,
  },
  inputWithReveal: { paddingRight: 72 },
  inputWrong: { borderColor: tokens.colorBroken },

  revealWrap: { position: 'relative' },
  reveal: {
    position: 'absolute',
    top: 0,
    right: tokens.spaceHair,
    bottom: 0,
    justifyContent: 'center',
    paddingHorizontal: tokens.spaceLg,
  },
  accentText: { color: tokens.colorAccentText },

  cta: {
    height: tokens.sizeHitPhonePrimary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: tokens.spaceXxl,
    borderRadius: tokens.sizeHitPhonePrimary / 2,
    backgroundColor: tokens.colorAccent,
  },
  ctaOff: { backgroundColor: tokens.colorBorder },
  ctaText: { color: tokens.colorInkOnDark },
  ctaOffText: { color: tokens.colorInkSecondary },

  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spaceMd,
    padding: tokens.spaceLg,
    borderRadius: tokens.radiusInset,
    borderWidth: 1,
  },
  noticeQuiet: { backgroundColor: tokens.colorCard, borderColor: tokens.colorBorder },
  noticeAttention: {
    backgroundColor: tokens.colorAttentionTint,
    borderColor: tokens.colorAttentionBorder,
  },
  noticeBroken: { backgroundColor: tokens.colorBrokenTint, borderColor: tokens.colorBroken },
  noticeBody: { flex: 1, gap: tokens.spaceHair },

  mark: {
    width: tokens.sizePill,
    height: tokens.sizePill,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.sizePill / 2,
    borderWidth: 1.5,
  },
  markSmall: { width: tokens.sizeMark, height: tokens.sizeMark, borderRadius: tokens.sizeMark / 2 },
  markInfo: { borderColor: tokens.marks.info.ring },
  markAttention: { borderColor: tokens.colorAttentionText },
  markBroken: { borderColor: tokens.marks.broken.ring, backgroundColor: tokens.marks.broken.fill },

  infoText: { color: tokens.marks.info.ink },
  attentionText: { color: tokens.colorAttentionText },
  brokenText: { color: tokens.colorBrokenText },

  fieldError: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceSm },
});
