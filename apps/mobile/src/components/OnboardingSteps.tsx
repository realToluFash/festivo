import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { tokens } from '../theme/tokens.ts';
import { StepMark } from './StepMark.tsx';
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
    <View style={styles.steps}>
      <View style={styles.step}>
        <StepMark step={1} state={emailDone ? 'done' : 'now'} />
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
        <StepMark step={2} state={detailsNow ? 'now' : 'later'} />
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
  doneInk: { color: tokens.colorAccentText },
  secondary: { color: tokens.colorInkSecondary },
});
