import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { glide } from '../motion.ts';
import { tokens } from '../theme/tokens.ts';
import { Text } from './Text.tsx';

/** A save button's label, which cross-fades to Saved with its check once the save is confirmed. */
export function SaveLabel({
  words,
  saved,
  color,
}: {
  words: string;
  saved: boolean;
  color: string;
}) {
  const { t } = useTranslation();
  const [done] = useState(() => new Animated.Value(saved ? 1 : 0));
  const before = done.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });

  useEffect(() => {
    const run = glide(done, saved ? 1 : 0, tokens.motionBase);
    run.start();
    return () => run.stop();
  }, [done, saved]);

  return (
    <View>
      <Animated.View
        style={{ opacity: before }}
        accessibilityElementsHidden={saved}
        importantForAccessibility={saved ? 'no-hide-descendants' : 'auto'}
      >
        <Text size={tokens.typeButton.size} weight="semibold" style={{ color }}>
          {words}
        </Text>
      </Animated.View>
      <Animated.View
        style={[StyleSheet.absoluteFill, styles.centred, { opacity: done }]}
        accessibilityElementsHidden={!saved}
        importantForAccessibility={saved ? 'auto' : 'no-hide-descendants'}
      >
        <Text size={tokens.typeButton.size} weight="semibold" style={{ color }}>
          ✓ {t('saveLabel.saved')}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  centred: { alignItems: 'center', justifyContent: 'center' },
});
