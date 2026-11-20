import { LOCALES } from '@soirely/domain';
import { type ReactNode, useContext, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type ViewInstance,
  useWindowDimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import Svg, { Circle, Path } from 'react-native-svg';

import { OnCover } from '../../components/Cover.tsx';
import { Sheet } from '../../components/Sheet.tsx';
import { Text, TitleCap } from '../../components/Text.tsx';
import { MeasuredWords, Title } from '../../components/Title.tsx';
import { currentLocale } from '../../i18n/index.ts';
import { titleSize, wordsIn } from '../../layout/textSize.ts';
import { tokens } from '../../theme/tokens.ts';
import { doneGap, doneUnder, languageStart, lineInList } from './languageSheetModel.ts';

interface SheetWords {
  title: string;
  line: string;
  done: string;
  nameOf: (code: string) => string;
}

/** The signed-out screens' language button and its sheet, as LanguageChoice draws them, with sc-77159's head. The demo keeps the choice to itself: nothing is saved and the app's language stays as it was. */
export function DemoLanguageChoice({ state }: { state?: string | undefined }) {
  const start = useMemo(() => languageStart(state), [state]);
  const onCover = useContext(OnCover);
  const { i18n } = useTranslation();
  const [locale, setLocale] = useState(start.locale ?? currentLocale());
  const [open, setOpen] = useState(start.open);
  const opener = useRef<ViewInstance>(null);
  const t = useMemo(() => i18n.getFixedT(locale), [i18n, locale]);
  const words: SheetWords = {
    title: t('language.label'),
    line: t('language.follows'),
    done: t('countryPicker.close'),
    nameOf: (code) => t(`languageNames.${code}`),
  };
  const currentName = LOCALES.find((one) => one.code === locale)?.nativeName ?? locale;
  const close = () => setOpen(false);

  return (
    <>
      <Pressable
        ref={opener}
        style={[styles.button, onCover && styles.glass]}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={words.title}
        accessibilityValue={{ text: currentName }}
        testID="language.open"
      >
        <Globe ink={onCover ? tokens.colorInkOnDark : tokens.colorInk} />
        <Text
          size={tokens.typeButton.size}
          weight="medium"
          style={onCover ? styles.onCover : styles.ink}
        >
          {currentName}
        </Text>
        <Chevron ink={onCover ? tokens.colorInkOnDark : tokens.colorInkSecondary} />
      </Pressable>

      <Sheet
        open={open}
        onClose={close}
        scrimLabel={words.done}
        opener={opener}
        headingTakesFocus
        testID="language.sheet"
      >
        <LanguageSheetBody
          words={words}
          current={locale}
          forceUnder={start.doneUnder}
          onClose={close}
          onChoose={(code) => {
            close();
            setLocale(code);
          }}
        />
      </Sheet>
    </>
  );
}

function LanguageSheetBody({
  words,
  current,
  forceUnder,
  onClose,
  onChoose,
}: {
  words: SheetWords;
  current: string;
  forceUnder: boolean;
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
  words: SheetWords;
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

function Globe({ ink }: { ink: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" accessible={false}>
      <Circle cx={12} cy={12} r={9} stroke={ink} strokeWidth={1.75} />
      <Path
        d="M3 12h18M12 3c2.5 2.6 3.75 5.6 3.75 9S14.5 18.4 12 21c-2.5-2.6-3.75-5.6-3.75-9S9.5 5.6 12 3Z"
        stroke={ink}
        strokeWidth={1.75}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function Chevron({ ink }: { ink: string }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" accessible={false}>
      <Path
        d="m6 9 6 6 6-6"
        stroke={ink}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
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
  button: {
    minHeight: tokens.sizeHit,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceXs,
    paddingHorizontal: tokens.spaceLg,
    borderWidth: 1,
    borderColor: tokens.colorControlBorder,
    borderRadius: tokens.radiusPill,
    backgroundColor: tokens.colorCard,
  },
  glass: { borderColor: tokens.scrimDialog, backgroundColor: tokens.scrimDialog },
  ink: { color: tokens.colorInk },
  onCover: { color: tokens.colorInkOnDark },
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
