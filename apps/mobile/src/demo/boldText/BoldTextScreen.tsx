import { type Href, router } from 'expo-router';
import { type ReactNode, useEffect } from 'react';
// eslint-disable-next-line no-restricted-syntax
import { Pressable, Text as PlainText, StyleSheet, View } from 'react-native';

import { Glyph } from '../../components/Glyph.tsx';
import { Text } from '../../components/Text.tsx';
import { brand } from '../../theme/brand.ts';
import { tokens } from '../../theme/tokens.ts';
import { DemoOnly, Heading } from '../../steps/Lines.tsx';
import { DemoScreen, NavBar } from '../DemoScreen.tsx';
import { BOLD_TEXT_SCREENS } from './BoldTextBoards.ts';
import { APPLE_ANDROID, MAP_ROWS, plainFace } from './BoldTextModel.ts';
import { BoldTextSwitch } from './BoldTextSwitch.tsx';
import { closeBoldTextBoard, openBoldTextBoard, useBoldText } from './boldTextStore.ts';

const APPLE = 'Continue with Apple';
const GOOGLE = 'Continue with Google';

/** The weight map as a specimen, and the screens QA checks: every text on them follows the switch. */
export function BoldTextScreen({ startOn }: { startOn: boolean }) {
  const on = useBoldText();

  useEffect(() => {
    openBoldTextBoard(startOn);

    return closeBoldTextBoard;
  }, [startOn]);

  return (
    <DemoScreen nav={<NavBar />}>
      <Heading
        title="Bold text"
        intro="With Bold text on, each weight the app asks for is drawn one step heavier, capped at Bold 700."
      />
      <View style={styles.switch}>
        <DemoOnly title="Stands in for the phone’s own setting, which the app reads. No string is added.">
          <BoldTextSwitch />
        </DemoOnly>
      </View>
      <View style={styles.card} testID={on ? 'demo.boldText.on' : 'demo.boldText.off'}>
        {MAP_ROWS.map((row) => (
          <Row key={row.asked} asked={String(row.asked)} off={row.off} on={row.on}>
            {[
              <Sample key="off" words={row.sample} size={row.size} face={plainFace(row.asked)} />,
              <Sample key="on" words={row.sample} size={row.size} face={plainFace(row.drawn)} />,
            ]}
          </Row>
        ))}
        <Row asked={`${APPLE}, iPhone`} off="System font Medium 500" on="System font Bold 700">
          {[
            <PlainText key="off" style={[styles.sample, styles.systemMedium]}>
              {APPLE}
            </PlainText>,
            <PlainText key="on" style={[styles.sample, styles.systemBold]}>
              {APPLE}
            </PlainText>,
          ]}
        </Row>
        <Row asked={`${APPLE}, Android`} off={APPLE_ANDROID.off} on={APPLE_ANDROID.on}>
          {[
            <Sample
              key="off"
              words={APPLE}
              size={tokens.typeButton.size}
              face={plainFace(APPLE_ANDROID.offWeight)}
            />,
            <Sample
              key="on"
              words={APPLE}
              size={tokens.typeButton.size}
              face={plainFace(APPLE_ANDROID.onWeight)}
            />,
          ]}
        </Row>
        <Row
          asked={GOOGLE}
          off="Google Sans Medium"
          on="Google Sans Medium, unchanged (outside the map)"
        >
          {[
            <Text key="off" size={brand.googleTextSize} weight="medium" family="googleSans">
              {GOOGLE}
            </Text>,
            <Text key="on" size={brand.googleTextSize} weight="medium" family="googleSans">
              {GOOGLE}
            </Text>,
          ]}
        </Row>
      </View>
      <View style={styles.screens}>
        {BOLD_TEXT_SCREENS.map((screen, index) => (
          <Pressable
            key={screen.title}
            onPress={() => router.push(screen.href as Href)}
            style={({ pressed }) => [
              styles.screen,
              index > 0 && styles.divided,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`${screen.title}. ${screen.what}`}
            testID={`demo.boldText.${screen.title}`}
          >
            <View style={styles.words}>
              <Text size={tokens.typeRowTitle.size} weight="semibold" accessible={false}>
                {screen.title}
              </Text>
              <Text size={tokens.typeSmall.size} style={styles.secondary} accessible={false}>
                {screen.what}
              </Text>
            </View>
            <Glyph name="chevron" size={18} ink={tokens.colorInkTertiary} weight={2.2} />
          </Pressable>
        ))}
      </View>
    </DemoScreen>
  );
}

function Row({
  asked,
  off,
  on,
  children,
}: {
  asked: string;
  off: string;
  on: string;
  children: readonly [ReactNode, ReactNode];
}) {
  return (
    <View style={styles.row}>
      <Text size={tokens.typeRowTitle.size} weight="bold">
        {asked}
      </Text>
      <View style={styles.columns}>
        <View style={styles.column}>
          <Text size={tokens.typeSmall.size} style={styles.secondary}>
            {`Bold text off · ${off}`}
          </Text>
          {children[0]}
        </View>
        <View style={styles.column}>
          <Text size={tokens.typeSmall.size} style={styles.secondary}>
            {`Bold text on · ${on}`}
          </Text>
          {children[1]}
        </View>
      </View>
    </View>
  );
}

/** Past the mapper on purpose: the specimen holds both columns' faces whichever way the switch is turned, and no weight can ask for a face the moved table has dropped. */
function Sample({ words, size, face }: { words: string; size: number; face: string }) {
  return (
    // eslint-disable-next-line no-restricted-syntax
    <PlainText style={[styles.sample, { fontSize: size, fontFamily: face }]}>{words}</PlainText>
  );
}

const styles = StyleSheet.create({
  switch: { marginTop: tokens.spaceLg },
  card: {
    marginTop: tokens.space3xl,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
    borderRadius: tokens.radiusInset,
    backgroundColor: tokens.colorCard,
    overflow: 'hidden',
  },
  row: {
    gap: tokens.spaceSm,
    padding: tokens.spaceXl,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colorInsetBorder,
  },
  columns: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spaceLg },
  column: { flexGrow: 1, flexBasis: 240, gap: tokens.spaceXs },
  sample: { color: tokens.colorInk },
  systemMedium: { fontSize: 16, fontWeight: '500' },
  systemBold: { fontSize: 16, fontWeight: '700' },
  secondary: { color: tokens.colorInkSecondary },
  screens: {
    marginTop: tokens.space3xl,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
    borderRadius: tokens.radiusInset,
    backgroundColor: tokens.colorCard,
    overflow: 'hidden',
  },
  screen: {
    minHeight: tokens.sizeListRow,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceLg,
    paddingHorizontal: tokens.spaceXl,
    paddingVertical: tokens.spaceMd,
  },
  divided: { borderTopWidth: 1, borderTopColor: tokens.colorInsetBorder },
  pressed: { backgroundColor: tokens.colorInset },
  words: { flex: 1, gap: 2 },
});
