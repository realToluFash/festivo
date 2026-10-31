import { type Ref, useState } from 'react';
import { StyleSheet, View, type ViewInstance } from 'react-native';
import { useTranslation } from 'react-i18next';

import { takeLinkedNotice } from '../providerSignIn.ts';
import { tokens } from '../theme/tokens.ts';
import { QuietButton } from './Buttons.tsx';
import { Notice } from './Notice.tsx';

/** Shown once, on whatever screen the first sign-in that linked a provider lands on. */
export function LinkedNotice({
  wordsRef,
  onDismissed,
}: {
  /** Its words, for focus to land on when a notice above it closes. */
  wordsRef?: Ref<ViewInstance> | undefined;
  /** Dismiss was tapped, so focus goes to the item after it (sc-11173). */
  onDismissed?: () => void;
} = {}) {
  const { t } = useTranslation();
  const [provider, setProvider] = useState(takeLinkedNotice);

  if (provider == null) return null;

  return (
    <View style={styles.linked}>
      <Notice
        tone="done"
        mark={tokens.marks.done.glyph}
        body={t('oauth.linked', { provider })}
        wordsRef={wordsRef}
      />
      <QuietButton
        label={t('oauth.dismiss')}
        onPress={() => {
          setProvider(null);
          onDismissed?.();
        }}
        testID="oauth.dismiss"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  linked: { gap: tokens.spaceXs },
});
