import { useLocalSearchParams } from 'expo-router';
import { Platform, StyleSheet } from 'react-native';

import { QuietButton } from '../../src/components/Buttons.tsx';
import { Text } from '../../src/components/Text.tsx';
import { config } from '../../src/config.ts';
import { DemoScreen, goBack, NavBar } from '../../src/demo/DemoScreen.tsx';
import { legalDoc, linkNote } from '../../src/demo/legalLinks.ts';
import { currentLocale } from '../../src/i18n/index.ts';
import { DemoOnly } from '../../src/steps/Lines.tsx';
import { tokens } from '../../src/theme/tokens.ts';

/** Where Terms or Privacy would take the person: the system's in-app browser, which the demo can only name (sc-29938). */
export default function LegalLink() {
  const { doc } = useLocalSearchParams<{ doc?: string }>();
  const note = linkNote(legalDoc(doc), currentLocale(), config.environment, Platform.OS);

  return (
    <DemoScreen nav={<NavBar left="close" onLeft={goBack} />}>
      <DemoOnly title={note.title}>
        <Text size={tokens.typeBodyPhone.size} style={styles.ink}>
          {note.address}
        </Text>
        <Text size={tokens.typeBodyPhone.size} style={styles.ink}>
          {note.browser}
        </Text>
        <QuietButton label="Come back" onPress={goBack} testID="demo.legal.back" />
      </DemoOnly>
    </DemoScreen>
  );
}

const styles = StyleSheet.create({
  ink: { color: tokens.colorInk },
});
