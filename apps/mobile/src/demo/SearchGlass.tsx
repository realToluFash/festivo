import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet } from 'react-native';

import { Glass } from '../components/Glass.tsx';
import { Glyph } from '../components/Glyph.tsx';
import { useTodayShell } from '../components/todayShell.ts';
import { tokens } from '../theme/tokens.ts';

/** Search in glass, the bell's twin, as the product's band draws it: one copy for the band demos, since a demo cannot export TodayCover's. */
export function SearchGlass() {
  const { t } = useTranslation();
  const { open } = useTodayShell();

  return (
    <Pressable
      onPress={() => open({ to: 'search' })}
      accessibilityRole="button"
      accessibilityLabel={t('search.row')}
      hitSlop={tokens.spaceXxs}
    >
      <Glass style={styles.round}>
        <Glyph name="search" size={19} ink={tokens.colorInkOnDark} />
      </Glass>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  round: { width: 40, justifyContent: 'center' },
});
