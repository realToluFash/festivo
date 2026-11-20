import { LOCALES } from '@soirely/domain';
import { type ReactNode, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { doneGap, doneUnder, lineInList } from '../layout/languageSheet.ts';
import { titleSize, wordsIn } from '../layout/textSize.ts';
import { tokens } from '../theme/tokens.ts';
import { Text, TitleCap } from './Text.tsx';
import { MeasuredWords, Title } from './Title.tsx';

export interface LanguageSheetWords {
  title: string;
  line: string;
  done: string;
  nameOf: (code: string) => string;
}

/** What the Language sheet holds, as sc-77159 draws it: the head, then the line and the four choices in a list, all capped at the size the title draws. */
export function LanguageSheetBody({
  words,
  current,
  forceUnder = false,
  onClose,
  onChoose,
}: {
  words: LanguageSheetWords;
  current: string;
  forceUnder?: boolean;
  onClose: () => void;
  onChoose: (code: string) => void;
}) {
  const [drawn, setDrawn] = useState<number | null>(null);
  const listed = lineInList(useWindowDimensions().fontScale);
  const line = (
    <Text size={tokens.typeBodyPhone.size} style={styles.secondary}>
      {words.line}
    </Text>
  );

  return (
    <TitleCap.Provider value={drawn}>
      <Head
        words={words}
        line={listed ? null : line}
        forceUnder={forceUnder}
        onClose={onClose}
        onDrawn={setDrawn}
      />
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        testID="language.list"
      >
        {listed && <View style={styles.listedLine}>{line}</View>}
        {LOCALES.map((locale) => {
          const chosen = locale.code === current;
          const inCurrent = words.nameOf(locale.code);

          return (
            <Pressable
              key={locale.code}
              style={[styles.option, chosen && styles.optionChosen]}
              onPress={() => onChoose(locale.code)}
              accessibilityRole="button"
              accessibilityState={{ selected: chosen }}
              accessibilityLabel={locale.nativeName}
              accessibilityLanguage={locale.code}
              testID={`language.${locale.code}`}
            >
              <View style={styles.optionWords}>
                <Text size={tokens.typeButton.size} weight="semibold" style={styles.ink}>
                  {locale.nativeName}
                </Text>
                {inCurrent !== locale.nativeName && (
                  <Text size={tokens.typeSmall.size} style={styles.secondary}>
                    {inCurrent}
                  </Text>
                )}
              </View>
              {chosen && <Tick />}
            </Pressable>
          );
        })}
      </ScrollView>
    </TitleCap.Provider>
  );
}

const TITLE = tokens.typeTitleDialog.size;

/** sc-77159, on sc-72136's rule: the title at a title's steps, each word whole; Done beside it where its longest word, the gap and Done fit the row, else on the row under it at its end. Read in that order: the title, then Done. */
function Head({
  words,
  line,
  forceUnder,
  onClose,
  onDrawn,
}: {
  words: LanguageSheetWords;
  line: ReactNode;
  forceUnder: boolean;
  onClose: () => void;
  onDrawn: (size: number) => void;
}) {
  const { fontScale } = useWindowDimensions();
  const start = titleSize(TITLE, fontScale);
  const titleWords = wordsIn([words.title]);
  const [measured, setMeasured] = useState<Readonly<Record<string, number>>>({});
  const [room, setRoom] = useState(0);
  const [done, setDone] = useState(0);
  const widths = titleWords.map((word) => measured[`${start}|${word}`]);
  const widest = widths.every((width) => width != null) ? Math.max(0, ...widths) : 0;
  const gap = doneGap(fontScale);
  const listed = lineInList(fontScale);
  const under = doneUnder({ room, widest, done, fontScale, forced: forceUnder });
  const titleRoom = room > 0 ? (under ? room : room - gap - done) : undefined;

  return (
    <View style={styles.heading}>
      <MeasuredWords
        words={titleWords}
        size={TITLE}
        weight="bold"
        maxFontSizeMultiplier={start / TITLE}
        onWidth={(word, width) => {
          const key = `${start}|${word}`;
          setMeasured((now) => (now[key] === width ? now : { ...now, [key]: width }));
        }}
      />
      <View
        style={[styles.head, under ? styles.headUnder : listed ? styles.beside : styles.besideMain]}
        onLayout={(event) => setRoom(event.nativeEvent.layout.width)}
        testID="language.head"
      >
        <View style={under ? null : styles.titles}>
          <Title size={TITLE} accessibilityRole="header" room={titleRoom} onDrawn={onDrawn}>
            {words.title}
          </Title>
          {!under && line}
        </View>
        <Pressable
          style={[styles.done, under && styles.doneUnder]}
          onPress={onClose}
          onLayout={(event) => setDone(event.nativeEvent.layout.width)}
          accessibilityRole="button"
          testID="language.done"
        >
          <Text size={tokens.typeButton.size} weight="semibold" style={styles.accent}>
            {words.done}
          </Text>
        </Pressable>
        {under && line}
      </View>
    </View>
  );
}

function Tick() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" accessible={false}>
      <Path
        d="m5 12.5 4.5 4.5L19 7.5"
        stroke={tokens.colorAccent}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  ink: { color: tokens.colorInk },
  secondary: { color: tokens.colorInkSecondary },
  accent: { color: tokens.colorAccentText },
  heading: {
    paddingHorizontal: tokens.space3xl,
    paddingTop: tokens.space3xl,
    paddingBottom: tokens.spaceLg,
  },
  head: { flexDirection: 'row', alignItems: 'flex-start' },
  besideMain: { gap: tokens.spaceLg },
  beside: { gap: tokens.spaceMd },
  headUnder: { flexDirection: 'column', alignItems: 'stretch', gap: tokens.spaceSm },
  titles: { flex: 1, minWidth: 0, gap: tokens.spaceXxs },
  done: { minHeight: tokens.sizeHit, justifyContent: 'center', flexShrink: 0 },
  doneUnder: { alignSelf: 'flex-end' },
  list: { flexGrow: 0 },
  listContent: { paddingHorizontal: tokens.spaceXl, paddingBottom: tokens.spaceXl },
  listedLine: { paddingHorizontal: tokens.spaceSm, paddingBottom: tokens.spaceLg },
  option: {
    minHeight: tokens.sizeHitPhonePrimary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceLg,
    paddingHorizontal: tokens.spaceLg,
    paddingVertical: tokens.spaceSm,
    borderRadius: tokens.radiusRow,
  },
  optionChosen: { backgroundColor: tokens.colorAccentTint },
  optionWords: { flex: 1, minWidth: 0, gap: tokens.spaceHair },
});
