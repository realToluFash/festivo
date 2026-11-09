import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import {
  type LayoutChangeEvent,
  type LayoutRectangle,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Cover, OnCover } from './Cover.tsx';
import type { Box } from '../kit/confettiClearance.ts';
import { saidOnWelcome } from '../kit/signInRules.ts';
import { useLayout } from '../layout/useLayout.ts';
import { tokens } from '../theme/tokens.ts';
import { Brand } from './Brand.tsx';
import { PrimaryButton, QuietButton } from './Buttons.tsx';
import { LanguageChoice } from './LanguageChoice.tsx';
import { ProviderButtons } from './ProviderSignIn.tsx';
import { useReadOut } from './ReadOut.tsx';
import { Text } from './Text.tsx';

const SHEET_RISE = tokens.radiusSheet;
const COVER_SHARE = 0.68;

/** Signed out: the brand on Soirely's cover, and the ways in on a sheet over its foot (sc-29076, sc-29078). */
export function Welcome({ devTools }: { devTools?: ReactNode }) {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{
    signedOut?: string;
    providerFailed?: string;
    rule?: string;
    organisation?: string;
    days?: string;
    email?: string;
  }>();
  const [providerFailed, setProviderFailed] = useState(params.providerFailed ?? null);
  const said = saidOnWelcome(params, providerFailed, t);
  const line = useLineSize();

  return (
    <WelcomeFrame
      top={<LanguageChoice />}
      brand={
        <>
          <WelcomeBrand />
          {said == null ? (
            <Text
              size={line}
              weight="bold"
              maxFontSizeMultiplier={1.25}
              style={[styles.onCover, coverLine(line)]}
            >
              {t('welcome.tagline')}
            </Text>
          ) : (
            <OnBrand title={said[0]} body={said[1]} size={line} />
          )}
        </>
      }
      choices={
        <View style={styles.choices}>
          <View style={styles.buttons}>
            <PrimaryButton
              label={t('welcome.withEmail')}
              onPress={() =>
                router.push({
                  pathname: '/sign-in',
                  params: params.email ? { email: params.email } : {},
                })
              }
              testID="welcome.email"
            />
            <ProviderButtons onFailed={setProviderFailed} />
          </View>
          <QuietButton
            label={t('signIn.createAccount')}
            onPress={() => router.push('/register')}
            testID="welcome.register"
          />
          {devTools}
        </View>
      }
    />
  );
}

/** The welcome's line, smaller under 380 wide and larger on a tablet. */
export function useLineSize() {
  const { kind } = useLayout();
  const { width } = useWindowDimensions();

  if (kind !== 'phone') return tokens.typeCoverLineTablet.size;

  return width < 380 ? tokens.typeCoverLineCompact.size : tokens.typeCoverLine.size;
}

/** The big lines on the cover, in Instrument Sans Bold: set close, and tracked in by 2% of their size. */
export function coverLine(size: number) {
  return {
    textAlign: 'center',
    lineHeight: Math.round(size * 1.1),
    letterSpacing: size * -0.02,
  } as const;
}

/** The brand on Soirely's cover and the choices on a sheet over its foot; the cover on the left half of a landscape tablet. */
export function WelcomeFrame({
  top,
  brand,
  choices,
}: {
  top?: ReactNode;
  brand: ReactNode;
  choices: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const { kind } = useLayout();
  const { width, height } = useWindowDimensions();
  const side = width < 380 ? tokens.spaceXl : tokens.space3xl;
  const tablet = kind !== 'phone';
  const left = Math.max(insets.left, side);
  const right = Math.max(insets.right, side);
  const foot = Math.max(insets.bottom, tokens.spaceLg);
  const words = useWordsBox();
  useCoverStatusBar(kind === 'tabletLandscape' ? 'dark' : 'light', kind === 'tabletPortrait');

  if (kind === 'tabletLandscape')
    return (
      <View style={[styles.cardPage, styles.row]}>
        <View
          style={[styles.cover, styles.coverHalf, { paddingTop: insets.top, paddingLeft: left }]}
        >
          <Cover scale={1.5} words={words.box} />
          <OnCover.Provider value>
            <View style={styles.brandBeside} onLayout={words.onArea}>
              <View style={styles.words} onLayout={words.onWords}>
                {brand}
              </View>
            </View>
          </OnCover.Provider>
        </View>
        <ScrollView
          style={styles.half}
          contentContainerStyle={[
            styles.fill,
            { paddingTop: insets.top, paddingRight: right, paddingBottom: foot },
          ]}
        >
          <View style={[styles.top, styles.topWide]}>{top}</View>
          <View style={styles.choicesMiddle}>
            <View style={styles.choicesWidth}>{choices}</View>
          </View>
        </ScrollView>
      </View>
    );

  // Scrolls only when it overflows, as at the largest text sizes or under the developer tools.
  return (
    <ScrollView style={styles.cardPage} contentContainerStyle={styles.fill}>
      <View
        style={[
          styles.cover,
          tablet ? { height: Math.round(height * COVER_SHARE) } : styles.coverPhone,
        ]}
      >
        <Cover scale={tablet ? 1.5 : side < tokens.space3xl ? 0.76 : 1} words={words.box} />
        <OnCover.Provider value>
          <View
            style={[styles.top, { marginTop: insets.top, paddingLeft: left, paddingRight: right }]}
          >
            {top}
          </View>
          <View
            style={[styles.brandOnCover, { paddingLeft: left, paddingRight: right }]}
            onLayout={words.onArea}
          >
            <View style={styles.words} onLayout={words.onWords}>
              {brand}
            </View>
          </View>
        </OnCover.Provider>
      </View>
      <View
        style={[
          styles.sheet,
          tablet
            ? styles.sheetTablet
            : { paddingLeft: left, paddingRight: right, paddingBottom: foot },
        ]}
      >
        {tablet ? <View style={styles.choicesWidth}>{choices}</View> : choices}
      </View>
    </ScrollView>
  );
}

/** The box the brand's words take on the cover, from the area that centres them and their own place in it. */
function useWordsBox() {
  const [area, setArea] = useState<LayoutRectangle | null>(null);
  const [own, setOwn] = useState<LayoutRectangle | null>(null);
  const box: Box | null =
    area == null || own == null
      ? null
      : { x: area.x + own.x, y: area.y + own.y, width: own.width, height: own.height };

  return {
    box,
    onArea: (event: LayoutChangeEvent) => setArea(event.nativeEvent.layout),
    onWords: (event: LayoutChangeEvent) => setOwn(event.nativeEvent.layout),
  };
}

/** React Native keeps the status bar of the screen mounted last, so the cover sets its own on focus; a tablet's steps open over the cover and keep it. */
export function useCoverStatusBar(style: 'light' | 'dark', keepUnderSheet: boolean) {
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle(style);

      return () => {
        if (!keepUnderSheet) setStatusBarStyle('dark');
      };
    }, [style, keepUnderSheet]),
  );
  useEffect(() => () => setStatusBarStyle('dark'), []);
}

export function WelcomeBrand() {
  const { kind } = useLayout();
  const { width } = useWindowDimensions();

  return (
    <Brand
      width={kind === 'phone' ? (width < 380 ? 92 : 112) : 140}
      lockup
      header
      ink={tokens.colorInkOnDark}
      testID="welcome.brand"
    />
  );
}

/** Why somebody is here, in the line's place and at its size: no box and no mark. */
export function OnBrand({ title, body, size }: { title: string; body: string; size: number }) {
  const { kind } = useLayout();
  useReadOut(`${title}. ${body}`);

  return (
    <View
      style={[styles.notice, kind === 'phone' ? styles.noticePhone : styles.noticeTablet]}
      testID="welcome.notice"
    >
      <Text
        size={size}
        weight="bold"
        maxFontSizeMultiplier={1.25}
        style={[styles.onCover, coverLine(size)]}
      >
        {title}
      </Text>
      <Text
        size={kind === 'phone' ? tokens.typeBodyGuest.size : tokens.typeCoverBodyTablet.size}
        style={[styles.onCover, styles.centre]}
      >
        {body}
      </Text>
    </View>
  );
}

/** The brand on the page rather than the cover, its choices under it, as a join link draws them. */
export function PageFrame({
  top,
  brand,
  choices,
}: {
  top?: ReactNode;
  brand: ReactNode;
  choices: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const { kind } = useLayout();
  const { width } = useWindowDimensions();
  const side = width < 380 ? tokens.spaceXl : tokens.space3xl;
  const pad = {
    paddingTop: insets.top,
    paddingBottom: Math.max(insets.bottom, tokens.spaceLg),
    paddingLeft: Math.max(insets.left, side),
    paddingRight: Math.max(insets.right, side),
  };

  const body =
    kind === 'tabletLandscape' ? (
      <View style={pageStyles.beside}>
        <View style={pageStyles.half}>{brand}</View>
        <View style={[pageStyles.half, pageStyles.choicesBeside]}>{choices}</View>
      </View>
    ) : kind === 'tabletPortrait' ? (
      <View style={pageStyles.middle}>
        {brand}
        <View style={pageStyles.tabletChoices}>{choices}</View>
      </View>
    ) : (
      <>
        <View style={pageStyles.middle}>{brand}</View>
        {choices}
      </>
    );

  return (
    <ScrollView style={pageStyles.page} contentContainerStyle={[styles.fill, pad]}>
      <View style={styles.top}>{top}</View>
      {body}
    </ScrollView>
  );
}

const pageStyles = StyleSheet.create({
  page: { flex: 1, backgroundColor: tokens.colorPage },
  middle: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spaceXxl,
    paddingBottom: tokens.spaceLg,
  },
  tabletChoices: { width: 400, marginTop: tokens.space6xl },
  beside: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: tokens.space6xl },
  half: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: tokens.spaceXxl },
  choicesBeside: { alignItems: 'stretch', maxWidth: 400 },
});

const styles = StyleSheet.create({
  cardPage: { flex: 1, backgroundColor: tokens.colorCard },
  fill: { flexGrow: 1 },
  row: { flexDirection: 'row' },
  top: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' },
  topWide: { minHeight: 60 },
  half: { flex: 1 },
  cover: { overflow: 'hidden', backgroundColor: tokens.colorAccent },
  coverPhone: { flexGrow: 1 },
  coverHalf: { flex: 1 },
  brandOnCover: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: SHEET_RISE + tokens.spaceXxl,
  },
  brandBeside: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  words: { alignItems: 'center', gap: tokens.spaceXxl },
  sheet: {
    marginTop: -SHEET_RISE,
    paddingTop: tokens.spaceXxl,
    borderTopLeftRadius: SHEET_RISE,
    borderTopRightRadius: SHEET_RISE,
    backgroundColor: tokens.colorCard,
  },
  sheetTablet: { flexGrow: 1, alignItems: 'center', paddingTop: tokens.space6xl },
  choicesMiddle: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  choicesWidth: { width: 400, maxWidth: '100%' },
  onCover: { color: tokens.colorInkOnDark },
  notice: { gap: tokens.spaceSm, alignItems: 'center' },
  noticePhone: { maxWidth: 330 },
  noticeTablet: { maxWidth: 480 },
  centre: { textAlign: 'center' },
  choices: { gap: tokens.spaceSm },
  buttons: { gap: tokens.spaceLg },
});
