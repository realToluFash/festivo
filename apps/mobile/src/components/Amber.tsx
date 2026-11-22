import type { ReactNode, Ref } from 'react';
import { StyleSheet, View, type ViewInstance } from 'react-native';

import { tokens } from '../theme/tokens.ts';
import { Glyph } from './Glyph.tsx';
import { useReadOut } from './ReadOut.tsx';
import { Pill } from './SettingsParts.tsx';
import { Text } from './Text.tsx';

type Choice = { label: string; onPress: () => void; testID: string };

/** The amber panel: duplicates, the 412, the plan limit, replacing a guest's own reply. Pass `readsTitle={false}` where the screen reader's focus is moved onto the panel instead. */
export function Amber({
  title,
  children,
  testID,
  ref,
  readsTitle = true,
}: {
  title: string | null;
  children?: ReactNode;
  testID?: string;
  ref?: Ref<ViewInstance>;
  readsTitle?: boolean;
}) {
  useReadOut(readsTitle ? title : null);

  return (
    <View ref={ref} style={styles.amber} accessibilityRole="alert" testID={testID}>
      {title != null && (
        <View style={styles.head}>
          <View style={styles.mark}>
            <Glyph name="alert" size={17} ink={tokens.colorAttentionText} weight={2.2} />
          </View>
          <Text size={15.5} weight="bold" accessibilityRole="header" style={styles.title}>
            {title}
          </Text>
        </View>
      )}
      {children}
    </View>
  );
}

export function AmberLine({ text, ink = false }: { text: string; ink?: boolean }) {
  return (
    <Text size={14} weight="medium" style={[ink ? null : styles.secondary, styles.lines]}>
      {text}
    </Text>
  );
}

export function AmberChoices({
  first,
  second,
  primary = false,
}: {
  first: Choice & { busy?: boolean };
  second: Choice;
  primary?: boolean;
}) {
  return (
    <View style={styles.choices}>
      <Pill
        label={first.label}
        kind={primary ? 'primary' : 'secondary'}
        height={tokens.sizeHit}
        full={false}
        busy={first.busy ?? false}
        onPress={first.onPress}
        testID={first.testID}
      />
      <Pill
        label={second.label}
        kind="secondary"
        height={tokens.sizeHit}
        full={false}
        onPress={second.onPress}
        testID={second.testID}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  amber: {
    gap: tokens.spaceSm,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: tokens.colorAttentionBorder,
    backgroundColor: tokens.colorAttentionTint,
  },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceSm },
  mark: { paddingTop: 2 },
  title: { flex: 1, minWidth: 0, lineHeight: 15.5 * 1.35 },
  secondary: { color: tokens.colorInkSecondary },
  lines: { lineHeight: 14 * 1.45 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
});
