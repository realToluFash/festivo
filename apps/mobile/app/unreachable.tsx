import { ApiUnreachableError, awaiting } from '@soirely/api-client';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../src/api.ts';
import { Notice } from '../src/components/Notice.tsx';
import { SignInFrame } from '../src/components/SignInFrame.tsx';
import { Text } from '../src/components/Text.tsx';
import { tokens } from '../src/theme/tokens.ts';
import { landingFor } from '../src/landing.ts';

/** No sign-in heading or form: the person is still signed in, and those would say otherwise. */
export default function Unreachable() {
  const { t } = useTranslation();
  const [retrying, setRetrying] = useState(false);

  async function retry(): Promise<void> {
    setRetrying(true);

    try {
      const account = await api.me();

      router.replace(landingFor(awaiting(account)));
    } catch (error) {
      if (error instanceof ApiUnreachableError) setRetrying(false);
      else router.replace('/sign-in');
    }
  }

  return (
    <SignInFrame>
      <View style={styles.state}>
        <Notice
          tone="quiet"
          heading
          mark={tokens.marks.info.glyph}
          title={t('session.unreachableTitle')}
          body={t('session.unreachableBody')}
        />
        <Pressable
          style={[styles.cta, retrying && styles.ctaBusy]}
          onPress={() => void retry()}
          disabled={retrying}
          accessibilityRole="button"
          accessibilityState={{ disabled: retrying, busy: retrying }}
          testID="unreachable.retry"
        >
          <Text size={16} weight="semibold" style={styles.ctaText}>
            {retrying ? t('session.retrying') : t('status.retry')}
          </Text>
        </Pressable>
      </View>
    </SignInFrame>
  );
}

const styles = StyleSheet.create({
  state: { gap: tokens.spaceXl },

  cta: {
    height: tokens.sizeHitPhonePrimary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: tokens.spaceXxl,
    borderRadius: tokens.sizeHitPhonePrimary / 2,
    backgroundColor: tokens.colorAccent,
  },
  ctaBusy: { backgroundColor: tokens.colorAccentHover },
  ctaText: { color: tokens.colorInkOnDark },
});
