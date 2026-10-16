import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { takeLinkedNotice } from '../googleSignIn.ts';
import { tokens } from '../theme/tokens.ts';
import { QuietButton } from './Buttons.tsx';
import { Notice } from './Notice.tsx';

/** Shown once, on whatever screen the first sign-in that linked Google lands on. */
export function LinkedNotice() {
  const { t } = useTranslation();
  const [shown, setShown] = useState(takeLinkedNotice);

  if (!shown) return null;

  return (
    <View style={styles.linked}>
      <Notice
        tone="done"
        mark={tokens.marks.done.glyph}
        body={t('oauth.linked', { provider: 'Google' })}
      />
      <QuietButton
        label={t('oauth.dismiss')}
        onPress={() => setShown(false)}
        testID="oauth.dismiss"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  linked: { gap: tokens.spaceXs },
});
