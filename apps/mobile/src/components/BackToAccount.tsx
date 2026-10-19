import { router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { tokens } from '../theme/tokens.ts';
import { Footnote, PrimaryButton } from './Buttons.tsx';
import { Text } from './Text.tsx';

// Pops back to the Account already under this screen, replacing its params, so its cards say what changed.
function backToAccount(verified: string | null): void {
  router.dismissTo(
    verified == null
      ? '/settings/account'
      : `/settings/account?verified=${encodeURIComponent(verified)}`,
  );
}

/** "← Back to Account" on a verify screen opened from Account (sc-2304), until the code is accepted: then its one button says it. */
export function BackToAccount() {
  const { t } = useTranslation();

  return (
    <Pressable
      style={styles.back}
      onPress={() => backToAccount(null)}
      accessibilityRole="link"
      accessibilityLabel={t('contacts.backToAccount')}
      testID="verify.backToAccount"
    >
      <Text
        size={tokens.typeButton.size}
        weight="semibold"
        style={styles.accent}
        accessibilityElementsHidden
        importantForAccessibility="no"
      >
        ←
      </Text>
      <Text size={tokens.typeButton.size} weight="semibold" style={styles.accent}>
        {t('contacts.backToAccount')}
      </Text>
    </Pressable>
  );
}

export function BackToAccountButton({ verified }: { verified: string }) {
  const { t } = useTranslation();

  return (
    <PrimaryButton
      label={t('contacts.backToAccount')}
      onPress={() => backToAccount(verified)}
      testID="verify.backToAccountButton"
    />
  );
}

/** A wrong address or number is removed in Account, by the row's own Remove: this link removes nothing. */
export function RemoveInAccount({ kind }: { kind: 'email' | 'phone' }) {
  const { t } = useTranslation();
  const email = kind === 'email';

  return (
    <Footnote
      question={email ? t('verifyEmail.wrongAddress') : t('verifyPhone.wrongNumber')}
      action={email ? t('contacts.removeInAccount') : t('contacts.removeInAccountPhone')}
      role="link"
      onPress={() => backToAccount(null)}
      testID="verify.removeInAccount"
    />
  );
}

const styles = StyleSheet.create({
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: tokens.spaceXs,
    minHeight: tokens.sizeHit,
  },
  accent: { color: tokens.colorAccentText },
});
