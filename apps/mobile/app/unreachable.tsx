import { ApiUnreachableError, awaiting } from '@soirely/api-client';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../src/api.ts';
import { AuthFrame } from '../src/components/AuthFrame.tsx';
import { PrimaryButton } from '../src/components/Buttons.tsx';
import { Notice } from '../src/components/Notice.tsx';
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
    <AuthFrame>
      <View style={styles.state}>
        <Notice
          tone="quiet"
          heading
          mark={tokens.marks.info.glyph}
          title={t('session.unreachableTitle')}
          body={t('session.unreachableBody')}
        />
        <PrimaryButton
          label={retrying ? t('session.retrying') : t('status.retry')}
          onPress={() => void retry()}
          busy={retrying}
          testID="unreachable.retry"
        />
      </View>
    </AuthFrame>
  );
}

const styles = StyleSheet.create({
  state: { gap: tokens.spaceXl },
});
