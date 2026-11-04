import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLayout } from '../layout/useLayout.ts';
import { tokens } from '../theme/tokens.ts';

/** The brand in the middle and the choices in thumb reach; beside each other on a landscape tablet. */
export function WelcomeFrame({
  top,
  brand,
  choices,
}: {
  top?: ReactNode;
  brand: ReactNode;
  choices: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const { kind } = useLayout();
  const { width } = useWindowDimensions();
  const side = width < 380 ? tokens.spaceXl : tokens.space3xl;
  const pad = {
    paddingTop: insets.top,
    paddingBottom: Math.max(insets.bottom, tokens.spaceLg),
    paddingLeft: Math.max(insets.left, side),
    paddingRight: Math.max(insets.right, side),
  };

  const body =
    kind === 'tabletLandscape' ? (
      <View style={styles.beside}>
        <View style={styles.half}>{brand}</View>
        <View style={[styles.half, styles.choicesBeside]}>{choices}</View>
      </View>
    ) : kind === 'tabletPortrait' ? (
      <View style={styles.middle}>
        {brand}
        <View style={styles.tabletChoices}>{choices}</View>
      </View>
    ) : (
      <>
        <View style={styles.middle}>{brand}</View>
        {choices}
      </>
    );

  // Scrolls only when it overflows, as at the largest text sizes or under the developer tools.
  return (
    <ScrollView style={styles.page} contentContainerStyle={[styles.fill, pad]}>
      <View style={styles.top}>{top}</View>
      {body}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: tokens.colorPage },
  fill: { flexGrow: 1 },
  top: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' },
  middle: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spaceXxl,
    paddingBottom: tokens.spaceLg,
  },
  tabletChoices: { width: 400, marginTop: tokens.space6xl },
  beside: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: tokens.space6xl },
  half: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: tokens.spaceXxl },
  choicesBeside: { alignItems: 'stretch', maxWidth: 400 },
});
