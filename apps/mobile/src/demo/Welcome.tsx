import { useFocusEffect } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { createContext, useCallback, useEffect, type ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLayout } from '../layout/useLayout.ts';
import { tokens } from '../theme/tokens.ts';
import { Cover } from './Cover.tsx';

/** True for what sits on the cover, which draws in white. */
export const OnCover = createContext(false);

const SHEET_RISE = 28;

/** The big lines on the cover, in Instrument Sans Bold: set close, and tracked in by 2% of their size. */
export function coverLine(size: number) {
  return {
    textAlign: 'center',
    lineHeight: Math.round(size * 1.1),
    letterSpacing: size * -0.02,
  } as const;
}

/** The brand in the middle and the choices in thumb reach; beside each other on a landscape tablet. */
export function WelcomeFrame({
  top,
  brand,
  choices,
  cover = false,
}: {
  top?: ReactNode;
  brand: ReactNode;
  choices: ReactNode;
  /** B's welcome: the brand on Soirely's cover, the choices on a sheet over its foot. */
  cover?: boolean;
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

  if (cover) return <CoverFrame top={top} brand={brand} choices={choices} side={side} />;

  if (kind === 'tabletLandscape')
    return (
      <View style={[styles.page, pad]}>
        <View style={styles.top}>{top}</View>
        <View style={styles.beside}>
          <View style={styles.half}>{brand}</View>
          <View style={[styles.half, styles.choicesBeside]}>{choices}</View>
        </View>
      </View>
    );

  if (kind === 'tabletPortrait')
    return (
      <View style={[styles.page, pad]}>
        <View style={styles.top}>{top}</View>
        <View style={styles.middle}>
          {brand}
          <View style={styles.tabletChoices}>{choices}</View>
        </View>
      </View>
    );

  return (
    <View style={[styles.page, pad]}>
      <View style={styles.top}>{top}</View>
      <View style={styles.middle}>{brand}</View>
      {choices}
    </View>
  );
}

function CoverFrame({
  top,
  brand,
  choices,
  side,
}: {
  top: ReactNode;
  brand: ReactNode;
  choices: ReactNode;
  side: number;
}) {
  const insets = useSafeAreaInsets();
  const { kind } = useLayout();
  const tablet = kind !== 'phone';
  const left = Math.max(insets.left, side);
  const right = Math.max(insets.right, side);
  const foot = Math.max(insets.bottom, tokens.spaceLg);
  useCoverStatusBar(kind === 'tabletLandscape' ? 'dark' : 'light', kind === 'tabletPortrait');

  if (kind === 'tabletLandscape')
    return (
      <View style={[styles.cardPage, styles.row]}>
        <View
          style={[styles.cover, styles.coverHalf, { paddingTop: insets.top, paddingLeft: left }]}
        >
          <Cover scale={1.5} />
          <OnCover.Provider value>
            <View style={styles.brandBeside}>{brand}</View>
          </OnCover.Provider>
        </View>
        <View
          style={[
            styles.half,
            { paddingTop: insets.top, paddingRight: right, paddingBottom: foot },
          ]}
        >
          <View style={[styles.top, styles.topWide]}>{top}</View>
          <View style={styles.choicesMiddle}>
            <View style={styles.choicesWidth}>{choices}</View>
          </View>
        </View>
      </View>
    );

  return (
    <View style={styles.cardPage}>
      <View style={[styles.cover, tablet ? styles.coverTablet : styles.coverPhone]}>
        <Cover scale={tablet ? 1.5 : confettiScale(side)} />
        <OnCover.Provider value>
          <View
            style={[styles.top, { marginTop: insets.top, paddingLeft: left, paddingRight: right }]}
          >
            {top}
          </View>
          <View style={[styles.brandOnCover, { paddingLeft: left, paddingRight: right }]}>
            {brand}
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
    </View>
  );
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

function confettiScale(side: number) {
  return side < tokens.space3xl ? 0.76 : 1;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: tokens.colorPage },
  cardPage: { flex: 1, backgroundColor: tokens.colorCard },
  row: { flexDirection: 'row' },
  top: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' },
  topWide: { minHeight: 60 },
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
  cover: { overflow: 'hidden', backgroundColor: tokens.colorAccent },
  coverPhone: { flex: 1 },
  coverTablet: { height: '68%' },
  coverHalf: { flex: 1 },
  brandOnCover: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spaceXxl,
    paddingBottom: SHEET_RISE + tokens.spaceXxl,
  },
  brandBeside: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: tokens.spaceXxl },
  sheet: {
    marginTop: -SHEET_RISE,
    paddingTop: tokens.spaceXxl,
    borderTopLeftRadius: SHEET_RISE,
    borderTopRightRadius: SHEET_RISE,
    backgroundColor: tokens.colorCard,
  },
  sheetTablet: { flex: 1, alignItems: 'center', paddingTop: tokens.space6xl },
  choicesMiddle: { flex: 1, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  choicesWidth: { width: 400 },
});
