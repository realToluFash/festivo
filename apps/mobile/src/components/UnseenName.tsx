import { Platform, StyleSheet, View } from 'react-native';

import { Text } from './Text.tsx';

/** Words that name a field on Android through accessibilityLabelledBy and are never shown. Mount them whenever the field is, changing only their words: TalkBack finds the view a field is labelled by when it builds the field's node, so words mounted with a refusal can be missed (sc-31323). They stay in the accessibility tree, as a view left out of it names nothing, and sit in a box of no size, which TalkBack never lands on. */
export function UnseenName({ nativeID, children }: { nativeID: string; children: string }) {
  if (Platform.OS !== 'android') return null;

  return (
    <View pointerEvents="none" style={styles.box}>
      <Text nativeID={nativeID} accessible={false} pointerEvents="none">
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { position: 'absolute', width: 0, height: 0, overflow: 'hidden', opacity: 0 },
});
