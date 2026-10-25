import { PASSWORD_MINIMUM_LENGTH } from '@soirely/domain';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { tokens } from '../theme/tokens.ts';
import { Text } from './Text.tsx';

/** The length rule, said before submit and marked as it is met, wherever a password is chosen. */
export function PasswordRule({ met, testID }: { met: boolean; testID: string }) {
  const { t } = useTranslation();
  const lengthMet = met;

  return (
    <View style={styles.ruleInset}>
      <Text size={tokens.typeLabel.size} weight="semibold" style={styles.ruleHeading}>
        {t('register.ruleHeading')}
      </Text>
      <View style={styles.rule} testID={lengthMet ? `${testID}.ruleMet` : `${testID}.ruleNotYet`}>
        <View
          style={[styles.ruleMark, lengthMet && styles.ruleMarkMet]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {lengthMet && (
            <Text
              size={tokens.typeMeta.size}
              weight="bold"
              style={styles.onAccent}
              accessible={false}
            >
              ✓
            </Text>
          )}
        </View>
        <Text size={tokens.typeBodyPhone.size} style={styles.ruleText}>
          {t('register.ruleLength', { count: PASSWORD_MINIMUM_LENGTH })}
        </Text>
        <Text
          size={tokens.typeSmall.size}
          weight="semibold"
          style={lengthMet ? styles.accentText : styles.secondary}
        >
          {lengthMet ? t('register.ruleMet') : t('register.ruleNotYet')}
        </Text>
      </View>
      <Text size={tokens.typeSmall.size} style={styles.secondary}>
        {t('register.ruleNote')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  ruleInset: {
    gap: tokens.spaceSm,
    paddingVertical: tokens.spaceLg,
    paddingHorizontal: tokens.spaceLg,
    borderRadius: tokens.radiusInset,
    borderWidth: 1,
    borderColor: tokens.colorInsetBorder,
    backgroundColor: tokens.colorInset,
  },
  ruleHeading: {
    color: tokens.colorInkSecondary,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  rule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceMd,
    minHeight: tokens.space3xl,
  },
  ruleMark: {
    width: tokens.sizeMark,
    height: tokens.sizeMark,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.sizeMark / 2,
    borderWidth: 1.5,
    borderColor: tokens.colorMarkEmpty,
    backgroundColor: tokens.colorCard,
  },
  ruleMarkMet: { borderColor: tokens.colorAccent, backgroundColor: tokens.colorAccent },
  ruleText: { flex: 1 },
  onAccent: { color: tokens.colorInkOnDark },
  accentText: { color: tokens.colorAccentText },
  secondary: { color: tokens.colorInkSecondary },
});
