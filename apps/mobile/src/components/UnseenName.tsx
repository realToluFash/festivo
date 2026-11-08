import { Platform, StyleSheet } from 'react-native';

import { Text } from './Text.tsx';

/** Words that name a field on Android through accessibilityLabelledBy and are never shown. They stay in the accessibility tree, as TalkBack reads no name from a view outside it, and their opacity keeps TalkBack from landing on them (sc-31323). */
export function UnseenName({ nativeID, children }: { nativeID: string; children: string }) {
  if (Platform.OS !== 'android') return null;

  return (
    <Text nativeID={nativeID} accessible={false} style={styles.unseen}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  unseen: { position: 'absolute', opacity: 0 },
});
