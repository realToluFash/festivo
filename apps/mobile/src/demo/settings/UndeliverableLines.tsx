import { StyleSheet, View, type ViewInstance } from 'react-native';

import { LEAD_INSET } from '../../components/AccountCard.tsx';
import { GlyphMark } from '../../components/StatusMark.tsx';
import { TextAction } from '../../components/Summary.tsx';
import { Text } from '../../components/Text.tsx';
import type { Contact } from '../../kit/accountPage.ts';
import { tokens } from '../../theme/tokens.ts';
import { UNDELIVERABLE_WORDS as W } from './Undeliverable.ts';

/** Closing Email addresses, one line per address Soirely stopped sending to, each with Change email. */
export function UndeliverableLines({
  rows,
  onChange,
  onAction,
}: {
  rows: readonly Contact[];
  onChange: (row: Contact) => void;
  onAction: (id: string, action: ViewInstance | null) => void;
}) {
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
              {W.line(row.shown)}
            </Text>
            <TextAction
              ref={(action) => onAction(row.id, action)}
              label={W.change}
              accessibilityLabel={W.changeFor(row.shown)}
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
