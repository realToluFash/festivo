import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Cover } from '../../components/Cover.tsx';
import { EventMesh } from '../../components/EventMesh.tsx';
import { Glyph } from '../../components/Glyph.tsx';
import { Text } from '../../components/Text.tsx';
import { BellButton, Glass, OrgButton, TabCapsule } from '../../components/TodayCover.tsx';
import type { Tell } from '../../components/TodayParts.tsx';
import { Toast } from '../../components/Toast.tsx';
import { TodayShellProvider } from '../../components/todayShell.ts';
import { useLayout } from '../../layout/useLayout.ts';
import { tokens } from '../../theme/tokens.ts';
import { demoShell } from '../demoShell.ts';
import { OrgSwitcherProvider } from '../OrgSwitcher.tsx';
import { EVENTS } from '../today.ts';
import { openSearch } from './SearchHeader.tsx';
import { SEARCH_WORDS as W } from './searchRules.ts';

/** Search in glass, the bell's twin: drawn 40, tapped 48, left of the bell. */
export function GlassSearchButton() {
  return (
    <Pressable
      onPress={() => openSearch()}
      accessibilityRole="button"
      accessibilityLabel={W.search}
      hitSlop={tokens.spaceXxs}
      testID="demo.search.open"
    >
      <Glass style={styles.round}>
        <Glyph name="search" size={19} ink={tokens.colorInkOnDark} />
      </Glass>
    </Pressable>
  );
}

/** The top of Today's cover on a phone or an upright iPad, with Search beside the bell; `now` is the band over an event happening now. */
export function SearchOnCoverScreen({ now }: { now: boolean }) {
  const insets = useSafeAreaInsets();
  const phone = useLayout().kind === 'phone';
  const [told, setTold] = useState<string | null>(null);
  const tell = useCallback<Tell>((words) => setTold(words), []);
  const shell = useMemo(() => demoShell(tell, { search: openSearch }), [tell]);

  return (
    <OrgSwitcherProvider state={null} statusBar="light" tell={tell}>
      <TodayShellProvider value={shell}>
        <View style={styles.screen}>
          <View style={[styles.cover, phone ? styles.coverPhone : styles.coverTablet]}>
            {now ? (
              <EventMesh event={{ mesh: EVENTS.ireti.mesh, photo: null }} shade="day" />
            ) : (
              <Cover shade="foot" />
            )}
            <View style={[phone ? styles.topPhone : styles.topTablet, { marginTop: insets.top }]}>
              <OrgButton compact={now} />
              <View style={styles.grow} />
              <View style={styles.ends}>
                <GlassSearchButton />
                <BellButton />
              </View>
              <View style={phone ? styles.title : styles.capsuleAt} pointerEvents="box-none">
                {phone ? (
                  now && (
                    <Text
                      size={17}
                      weight="semibold"
                      accessibilityRole="header"
                      style={styles.white}
                    >
                      Today
                    </Text>
                  )
                ) : (
                  <TabCapsule onTab={(tab) => tell(`${tab} has its own design.`)} />
                )}
              </View>
            </View>
          </View>
          {told != null && (
            <View style={[styles.toast, { bottom: insets.bottom + tokens.spaceXl }]}>
              <Toast key={told} words={told} onClose={() => setTold(null)} />
            </View>
          )}
        </View>
      </TodayShellProvider>
    </OrgSwitcherProvider>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.colorCard },
  cover: { overflow: 'hidden' },
  coverPhone: { height: 260 },
  coverTablet: { height: 320 },
  round: { width: 40, justifyContent: 'center' },
  topPhone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceSm,
    paddingTop: tokens.spaceXxs,
    paddingHorizontal: tokens.spaceXl,
  },
  topTablet: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: tokens.spaceMd,
    paddingHorizontal: tokens.space3xl,
  },
  grow: { flex: 1, minWidth: 0 },
  ends: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm },
  title: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  capsuleAt: { position: 'absolute', left: 0, right: 0, top: 7, alignItems: 'center' },
  white: { color: tokens.colorInkOnDark },
  toast: { position: 'absolute', left: tokens.spaceXl, right: tokens.spaceXl },
});
