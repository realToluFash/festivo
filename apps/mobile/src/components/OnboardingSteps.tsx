import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { tokens } from '../theme/tokens.ts';
import { Text } from './Text.tsx';

/** The two gates as a strip: where the person is, with each step a shape and a word, never colour alone. */
export function OnboardingSteps({
  at,
  confirmedBy,
}: {
  at: 'verifying' | 'verified' | 'details';
  /** A provider that confirmed the address, so there was no code to enter. */
  confirmedBy?: string | undefined;
}) {
  const { t } = useTranslation();
  const emailDone = at !== 'verifying';
  const detailsNow = at === 'details';

  return (
    <View style={styles.steps} accessibilityLabel={t('verifyEmail.stepsLabel')}>
      <View style={styles.step}>
        <View style={[styles.mark, emailDone ? styles.done : styles.now]}>
          <Text size={tokens.typePill.size} weight="bold" style={styles.onMark}>
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
        <View style={[styles.mark, detailsNow ? styles.now : styles.later]}>
          <Text
            size={tokens.typePill.size}
            weight="bold"
            style={detailsNow ? styles.onMark : styles.secondary}
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
    width: tokens.space3xl,
    height: tokens.space3xl,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.space3xl / 2,
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
