import { type Provider, ProviderCancelled } from '@soirely/api-client';
import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Svg, { Path } from 'react-native-svg';

import { PROVIDER_NAMES, signInWithProvider } from '../providerSignIn.ts';
import { nextAfterSignIn } from '../challenge.ts';
import { brand } from '../theme/brand.ts';
import { tokens } from '../theme/tokens.ts';
import { Text } from './Text.tsx';

const appleOnIos = Platform.OS === 'ios';
const APPLE_IOS_TEXT_SIZE = tokens.sizeHitPhonePrimary * brand.appleTitleToHeight;
const APPLE_IOS_LOGO_SCALE = brand.appleLogoHeight / 19;

export function ProviderSignIn({ onFailed }: { onFailed?: (provider: string) => void }) {
  const { t } = useTranslation();

  return (
    <View style={styles.group}>
      <OrRule label={t('signIn.or')} />
      <ProviderButtons onFailed={onFailed} />
    </View>
  );
}

/** Away from sign-in, a failure is said there; on it, the screen says it itself. */
function failedElsewhere(provider: string): void {
  router.replace(`/sign-in?providerFailed=${provider}`);
}

export function OrRule({ label }: { label: string }) {
  return (
    <View style={styles.or}>
      <View style={styles.rule} />
      <Text size={tokens.typeSmall.size} style={styles.orText}>
        {label}
      </Text>
      <View style={styles.rule} />
    </View>
  );
}

/** Built to each owner's published specification; the marks are copied, not redrawn. */
export function ProviderButtons({
  onFailed = failedElsewhere,
  only,
}: {
  onFailed?: ((provider: string) => void) | undefined;
  only?: readonly string[] | undefined;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  async function continueWith(provider: Provider): Promise<void> {
    setBusy(true);

    try {
      router.replace(await nextAfterSignIn(await signInWithProvider(provider)));
    } catch (error) {
      // Closing the provider is not a failure, so it says nothing; anything else says it did not work.
      if (!(error instanceof ProviderCancelled)) onFailed(PROVIDER_NAMES[provider]);
    } finally {
      setBusy(false);
    }
  }

  const shows = (provider: Provider): boolean =>
    only == null || only.length === 0 || only.includes(provider);

  return (
    <View style={styles.group}>
      {shows('google') && (
        <ProviderButton
          provider="google"
          label={t('signIn.withGoogle', { provider: 'Google' })}
          onPress={() => void continueWith('google')}
          busy={busy}
          testID="signIn.google"
        />
      )}
      {shows('apple') && (
        <ProviderButton
          provider="apple"
          label={t('signIn.withApple', { provider: 'Apple' })}
          onPress={() => void continueWith('apple')}
          busy={busy}
          testID="signIn.apple"
        />
      )}
    </View>
  );
}

/** Busy and off are one look, the whole button faded with its words kept: Google and Apple fix what it may say (sc-22601). */
export function ProviderButton({
  provider,
  label,
  onPress,
  busy = false,
  off = false,
  testID,
}: {
  provider: Provider;
  label: string;
  onPress: () => void;
  busy?: boolean;
  off?: boolean;
  testID: string;
}) {
  const inactive = busy || off;
  // Apple's words are drawn on every platform: iOS's own button reads in the device's language, not the app's.
  const appleIos = provider === 'apple' && appleOnIos;

  return (
    <Pressable
      style={[
        styles.button,
        provider === 'google' ? styles.google : styles.apple,
        appleIos && styles.appleIos,
        inactive && styles.inactive,
      ]}
      onPress={inactive ? undefined : onPress}
      // A disabled button lets a tap through to the scroll view under it, which drops the keys mid-request.
      // Pressable lets any non-null disabled overwrite accessibilityState.disabled, so busy leaves it unset.
      disabled={off || undefined}
      // Android names an unlabelled busy view "busy" alone, and keeps that name once it is idle.
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy }}
      testID={testID}
    >
      {provider === 'google' ? <GoogleMark /> : appleIos ? <AppleLogoIos /> : <AppleMark />}
      {provider === 'google' ? (
        <Text
          size={brand.googleTextSize}
          weight="medium"
          family="googleSans"
          style={styles.googleText}
        >
          {label}
        </Text>
      ) : (
        <Text
          size={appleIos ? APPLE_IOS_TEXT_SIZE : tokens.typeButton.size}
          weight="medium"
          family={appleIos ? 'system' : 'sans'}
          style={styles.appleText}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

function GoogleMark() {
  return (
    <Svg width={18} height={18} viewBox="0 0 48 48">
      <Path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <Path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <Path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <Path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </Svg>
  );
}

function AppleMark() {
  return (
    <Svg width={17} height={17} viewBox="0 0 24 24">
      <Path
        fill={brand.appleInk}
        d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"
      />
    </Svg>
  );
}

/** Apple Design Resources' "Left White Logo Medium", cropped at the sides only so the glyph keeps Apple's place above the centre. */
function AppleLogoIos() {
  return (
    <Svg
      width={15.46 * APPLE_IOS_LOGO_SCALE}
      height={44 * APPLE_IOS_LOGO_SCALE}
      viewBox="7.75 0 15.46 44"
    >
      <Path
        fill={brand.appleInk}
        d="M15.7099491,14.8846154 C16.5675461,14.8846154 17.642562,14.3048315 18.28274,13.5317864 C18.8625238,12.8312142 19.2852829,11.852829 19.2852829,10.8744437 C19.2852829,10.7415766 19.2732041,10.6087095 19.2490464,10.5 C18.2948188,10.5362365 17.1473299,11.140178 16.4588366,11.9494596 C15.9152893,12.56548 15.4200572,13.5317864 15.4200572,14.5222505 C15.4200572,14.6671964 15.4442149,14.8121424 15.4562937,14.8604577 C15.5166879,14.8725366 15.6133185,14.8846154 15.7099491,14.8846154 Z M12.6902416,29.5 C13.8618881,29.5 14.3812778,28.714876 15.8428163,28.714876 C17.3285124,28.714876 17.6546408,29.4758423 18.9591545,29.4758423 C20.2395105,29.4758423 21.0971074,28.292117 21.9063891,27.1325493 C22.8123013,25.8038779 23.1867451,24.4993643 23.2109027,24.4389701 C23.1263509,24.4148125 20.6743484,23.4122695 20.6743484,20.5979021 C20.6743484,18.1579784 22.6069612,17.0588048 22.7156707,16.974253 C21.4353147,15.1382708 19.490623,15.0899555 18.9591545,15.0899555 C17.5217737,15.0899555 16.3501271,15.9596313 15.6133185,15.9596313 C14.8161157,15.9596313 13.7652575,15.1382708 12.521138,15.1382708 C10.1536872,15.1382708 7.75,17.0950413 7.75,20.7911634 C7.75,23.0861411 8.64383344,25.513986 9.74300699,27.0842339 C10.6851558,28.4129053 11.5065162,29.5 12.6902416,29.5 Z"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  group: { gap: tokens.spaceXl },

  or: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceLg },
  rule: { flex: 1, height: 1, backgroundColor: tokens.colorBorder },
  orText: { color: tokens.colorInkSecondary },

  button: {
    minHeight: tokens.sizeHitPhonePrimary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spaceMd,
    paddingHorizontal: tokens.spaceXxl,
    paddingVertical: tokens.spaceSm,
    borderRadius: tokens.radiusPill,
    borderWidth: 1,
  },
  google: { backgroundColor: brand.googleSurface, borderColor: brand.googleBorder },
  googleText: { color: brand.googleInk, lineHeight: brand.googleLineHeight },
  apple: { backgroundColor: brand.appleSurface, borderColor: brand.appleSurface },
  appleText: { color: brand.appleInk },
  appleIos: { gap: brand.appleLogoGap, paddingVertical: 0, borderWidth: 0 },
  inactive: { opacity: brand.offOpacity },
});
