import { Pressable, StyleSheet, View } from 'react-native';

import { Glyph } from '../../components/Glyph.tsx';
import { rowSide, settingsRowStyles } from '../../components/SettingsHome.tsx';
import { Tile, TYPE } from '../../components/SettingsParts.tsx';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';

/** The design demo's row, in development and QA builds only, in English as the demo is. */
export function SettingsDemoRow({ dense, onDemo }: { dense: boolean; onDemo: () => void }) {
  return (
    <View style={settingsRowStyles.group}>
      <Pressable
        onPress={onDemo}
        style={({ pressed }) => [
          settingsRowStyles.row,
          dense && settingsRowStyles.rowDense,
          pressed && settingsRowStyles.rowPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel="Design demo, in development and QA builds. The designs, working on sample data"
        testID="settings.designDemo"
      >
        <Tile of="demo" side={rowSide(dense)} />
        <View style={settingsRowStyles.rowWords}>
          <View style={own.demoTitle}>
            <Text size={dense ? 15.5 : TYPE.row} weight="semibold" accessible={false}>
              Design demo
            </Text>
            <View style={own.tag}>
              <Text
                size={12}
                weight="semibold"
                accessible={false}
                style={settingsRowStyles.secondary}
              >
                Dev and QA
              </Text>
            </View>
          </View>
          <Text
            size={dense ? 13 : TYPE.small}
            weight="medium"
            accessible={false}
            style={settingsRowStyles.secondary}
          >
            The designs, working on sample data
          </Text>
        </View>
        <Glyph name="chevron" size={18} ink={tokens.colorInkTertiary} weight={2.2} />
      </Pressable>
    </View>
  );
}

const own = StyleSheet.create({
  demoTitle: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: tokens.spaceSm },
  tag: {
    minHeight: 22,
    justifyContent: 'center',
    paddingHorizontal: tokens.spaceSm,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
    backgroundColor: tokens.colorCard,
  },
});
