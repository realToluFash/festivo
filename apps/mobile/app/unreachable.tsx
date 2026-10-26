import { ApiUnreachableError } from '@soirely/api-client';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../src/api.ts';
import { AuthFrame } from '../src/components/AuthFrame.tsx';
import { PrimaryButton } from '../src/components/Buttons.tsx';
import { Notice } from '../src/components/Notice.tsx';
import { tokens } from '../src/theme/tokens.ts';
import { holdsSession } from '../src/tokens.ts';
import { carryOn } from '../src/unreachable.ts';

/** No sign-in heading or form: a password cannot be checked offline, and a held session is kept. */
export default function Unreachable() {
  const { t } = useTranslation();
  const { link } = useLocalSearchParams<{ link?: string }>();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    let live = true;

    void holdsSession().then((held) => {
      if (live) setSignedIn(held);
    });

    return () => {
      live = false;
    };
  }, []);

  // Only whether Soirely answers: the screen it carries on to asks everything else, as on a first answer.
  async function retry(): Promise<void> {
    setRetrying(true);

    try {
      await api.health();
    } catch (error) {
      if (error instanceof ApiUnreachableError) {
        setRetrying(false);
        return;
      }
    }

    router.replace(carryOn(link));
  }

  if (signedIn == null) return <AuthFrame>{null}</AuthFrame>;

  return (
    <AuthFrame>
      <View style={styles.state}>
        <Notice
          tone="quiet"
          heading
          mark={tokens.marks.info.glyph}
          title={t('session.unreachableTitle')}
          body={t(signedIn ? 'session.unreachableBody' : 'session.unreachableBodySignedOut')}
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
