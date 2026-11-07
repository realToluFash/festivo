import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { tokens } from '../theme/tokens.ts';
import { useReadOut } from './ReadOut.tsx';
import { Text } from './Text.tsx';
import { TextAction } from './TextAction.tsx';

/** In place of the card and the lists: what went wrong, what to do, and Try again. */
export function FailedBlock({
  title,
  line,
  onRetry,
  testID,
}: {
  title: string;
  line: string;
  onRetry: () => void;
  testID: string;
}) {
  const { t } = useTranslation();

  useReadOut(`${title} ${line}`);

  return (
    <View style={styles.failed}>
      <Text size={18} weight="bold" accessibilityRole="header">
        {title}
      </Text>
      <Text size={15} weight="medium" style={styles.secondary}>
        {line}
      </Text>
      <TextAction label={t('failedBlock.tryAgain')} onPress={onRetry} testID={testID} />
    </View>
  );
}

const styles = StyleSheet.create({
  secondary: { color: tokens.colorInkSecondary },
  failed: { gap: tokens.spaceSm, paddingTop: tokens.spaceXs },
});
