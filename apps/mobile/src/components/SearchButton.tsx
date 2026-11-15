import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { SEARCH_HREF } from '../kit/searchLinks.ts';
import { useSignedIn } from '../signedIn.ts';
import { tokens } from '../theme/tokens.ts';
import { BellButton } from './BellButton.tsx';
import { RoundButton } from './SettingsParts.tsx';

/** The 44 Search a top gains on a phone and upright, opening Search over the organisation in use (sc-39534). */
export function SearchButton() {
  const { t } = useTranslation();
  const { organisation } = useSignedIn();

  if (organisation == null) return null;

  return (
    <RoundButton
      glyph="search"
      label={t('search.row')}
      onPress={() => router.push(SEARCH_HREF)}
      testID="frame.search"
    />
  );
}

/** Search, then the bell, as the end of Today's, Events', the Calendar's and Settings' tops. */
export function SearchAndBell() {
  return (
    <View style={styles.ends}>
      <SearchButton />
      <BellButton />
    </View>
  );
}

const styles = StyleSheet.create({
  ends: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm },
});
