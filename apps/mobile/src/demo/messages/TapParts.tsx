import { StyleSheet, View } from 'react-native';

import { tokens } from '../../theme/tokens.ts';
import { W } from './MessagesWords.ts';
import { DayRule, MetaLine, SoirelyCard, SystemLine } from './Stream.tsx';
import { type TapItem, lineWords } from './TapStates.ts';

export function tapParts(items: readonly TapItem[]) {
  return items.map((item, index) => {
    const key = `tap.${index}`;

    switch (item.kind) {
      case 'today':
        return <DayRule key={key} text={W.today} />;
      case 'line':
        return <SystemLine key={key} mark="wa" text={lineWords(item)} />;
      case 'message':
        return <SoirelyCard key={key} mark="wa" lines={item.lines} bits={[item.receipt]} />;
      default:
        return (
          <View key={key} style={styles.under} testID="messages.tap.notSent">
            <MetaLine bits={[{ word: item.word, mark: item.mark }]} />
          </View>
        );
    }
  });
}

const styles = StyleSheet.create({
  under: { paddingLeft: 15 + tokens.spaceSm },
});
