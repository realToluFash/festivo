import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { tokens } from '../theme/tokens.ts';
import { Text } from './Text.tsx';
import { useMarkSide } from './markSide.ts';

/** The two gates as a strip: where the person is, with each step a shape and a word, never colour alone. */
export function OnboardingSteps({
  at,
  confirmedBy,
}: {
  at: 'verifying' | 'verified' | 'details';
  /** A provider that confirmed the address, so there was no code to enter. */
  confirmedBy?: string | undefined;
}) {
  const markSide = useMarkSide(tokens.space3xl);
  const { t } = useTranslation();
  const emailDone = at !== 'verifying';
  const detailsNow = at === 'details';

  return (
    <View style={styles.steps}>
      <View style={styles.step}>
        <View
          style={[styles.mark, markSide, emailDone ? styles.done : styles.now]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Text
            size={tokens.typePill.size}
            weight="bold"
            mono
            style={styles.onMark}
            accessible={false}
          >
            {emailDone ? '✓' : '1'}
          </Text>
        </View>
        <Text
          size={tokens.typeButton.size}
          weight="semibold"
          style={emailDone ? styles.doneInk : undefined}
        >
          {confirmedBy != null
            ? t('verifyEmail.step1Google', { provider: confirmedBy })
            : emailDone
              ? t('verifyEmail.step1Done')
              : t('verifyEmail.step1')}
        </Text>
      </View>
      <View style={styles.step}>
        <View
          style={[styles.mark, markSide, detailsNow ? styles.now : styles.later]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Text
            size={tokens.typePill.size}
            weight="bold"
            mono
            style={detailsNow ? styles.onMark : styles.secondary}
            accessible={false}
          >
            2
          </Text>
        </View>
        <Text
          size={tokens.typeButton.size}
          weight="semibold"
          style={detailsNow ? undefined : styles.secondary}
        >
          {t('verifyEmail.step2')}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  steps: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spaceXl },
  step: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm },
  mark: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.radiusPill,
  },
  now: { backgroundColor: tokens.colorDark },
  done: { backgroundColor: tokens.colorAccent },
  later: {
    borderWidth: 1.5,
    borderColor: tokens.colorMarkEmpty,
    backgroundColor: tokens.colorCard,
  },
  onMark: { color: tokens.colorInkOnDark },
  doneInk: { color: tokens.colorAccentText },
  secondary: { color: tokens.colorInkSecondary },
});
