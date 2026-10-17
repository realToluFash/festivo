import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { takeLinkedNotice } from '../providerSignIn.ts';
import { tokens } from '../theme/tokens.ts';
import { QuietButton } from './Buttons.tsx';
import { Notice } from './Notice.tsx';

/** Shown once, on whatever screen the first sign-in that linked a provider lands on. */
export function LinkedNotice() {
  const { t } = useTranslation();
  const [provider, setProvider] = useState(takeLinkedNotice);

  if (provider == null) return null;

  return (
    <View style={styles.linked}>
      <Notice tone="done" mark={tokens.marks.done.glyph} body={t('oauth.linked', { provider })} />
      <QuietButton
        label={t('oauth.dismiss')}
        onPress={() => setProvider(null)}
        testID="oauth.dismiss"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  linked: { gap: tokens.spaceXs },
});
