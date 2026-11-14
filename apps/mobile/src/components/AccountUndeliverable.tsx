import { StyleSheet, View, type ViewInstance } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { Contact } from '../kit/accountPage.ts';
import { tokens } from '../theme/tokens.ts';
import { LEAD_INSET } from './AccountCard.tsx';
import { GlyphMark } from './StatusMark.tsx';
import { TextAction } from './Summary.tsx';
import { Text } from './Text.tsx';

/** Closing Email addresses: one line per address Soirely stopped sending to (sc-44949), each with Change email. */
export function UndeliverableLines({
  rows,
  onChange,
  onAction,
}: {
  rows: readonly Contact[];
  onChange: (row: Contact) => void;
  onAction: (id: string, action: ViewInstance | null) => void;
}) {
  const { t } = useTranslation();

  if (rows.length === 0) return null;

  return (
    <View style={styles.lines} testID="account.undeliverable">
      {rows.map((row) => (
        <View key={row.id} style={styles.line}>
          <View style={styles.lead}>
            <GlyphMark mark={tokens.marks.broken} />
          </View>
          <View style={styles.words}>
            <Text size={15} weight="semibold" testID={`account.${row.id}.undeliverable`}>
              {t('account.undeliverable', { address: row.shown })}
            </Text>
            <TextAction
              ref={(action) => onAction(row.id, action)}
              label={t('account.changeEmail')}
              accessibilityLabel={t('account.changeEmailFor', { address: row.shown })}
              onPress={() => onChange(row)}
              testID={`account.${row.id}.change`}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  lines: { paddingTop: tokens.spaceLg, gap: tokens.spaceHair },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: LEAD_INSET - 28 },
  lead: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  words: { flex: 1, minWidth: 0, paddingTop: 3 },
});
