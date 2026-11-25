import { type Href, router } from 'expo-router';
import { useMemo, useState } from 'react';
import { I18nextProvider, useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '../../components/Text.tsx';
import type { Tab } from '../../components/TodayCover.tsx';
import type { Tell } from '../../components/TodayParts.tsx';
import { Toast } from '../../components/Toast.tsx';
import { TOP_TITLE, topTitle } from '../../components/topTitle.ts';
import { titleSize } from '../../layout/textSize.ts';
import { useLayout } from '../../layout/useLayout.ts';
import { DemoOnly } from '../../steps/Lines.tsx';
import { tokens } from '../../theme/tokens.ts';
import { NavBar } from '../DemoScreen.tsx';
import { OrgSwitcherProvider } from '../OrgSwitcher.tsx';
import {
  FILTER_LANGUAGES,
  FILTER_SIZES,
  type FilterLanguage,
  type FilterSize,
  filterScale,
} from '../filterSize/filterSizeRules.ts';
import { Choices } from '../focusedHeader/FocusedHeaderScreen.tsx';
import {
  TODAY_INVITES,
  TODAY_ORGS,
  type TodayInvite,
  type TodayOrg,
  orgName,
} from '../todaySize/todaySizeRules.ts';
import { TopPillRow } from './TopSizePill.tsx';
import { TopUprightRow } from './TopSizeUpright.tsx';
import { TOP_SCREENS, type TopScreen } from './topSizeRules.ts';

export interface TopSizeStart {
  size: FilterSize;
  language: FilterLanguage;
  screen: TopScreen;
  org: TodayOrg;
  invite: TodayInvite;
}

/** sc-92464: the phone's top over Settings, Events and the Calendar at a stand-in text size, the pill's words whole; sc-92728: the upright iPad's, beside the tabs. */
export function TopSizeScreen({ start }: { start: TopSizeStart }) {
  const { i18n } = useTranslation();
  const { fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [size, setSize] = useState(start.size);
  const [language, setLanguage] = useState(start.language);
  const [screen, setScreen] = useState(start.screen);
  const [org, setOrg] = useState(start.org);
  const [invite, setInvite] = useState(start.invite);
  const [told, setTold] = useState<string | null>(null);
  const tell = useMemo<Tell>(() => (said) => setTold(said), []);
  const place = useMemo(() => ({ id: 'org-qa', name: orgName(org), role: 'Owner' }), [org]);
  const words = useMemo(
    () => i18n.cloneInstance({ lng: language, initAsync: false }),
    [i18n, language],
  );
  const scale = filterScale(size, fontScale);

  return (
    <OrgSwitcherProvider state={null} place={place} tell={tell}>
      <View style={styles.screen}>
        <ScrollView
          contentContainerStyle={{ paddingTop: insets.top, paddingBottom: insets.bottom + 40 }}
        >
          <NavBar />
          <I18nextProvider i18n={words}>
            <Top
              scale={scale}
              screen={screen}
              waiting={invite === 'one' ? 1 : 0}
              tell={tell}
              onTab={(tab) => {
                if (tab === 'Today')
                  router.replace(
                    `/demo/today-size?size=${size}&lang=${language}&org=${org}&invite=${invite}` as Href,
                  );
                else setScreen(SCREEN_OF_TAB[tab]);
              }}
            />
          </I18nextProvider>
          <View style={styles.choices}>
            <DemoOnly title="Stand-ins for the device’s text size, its language, the screen, the organisation’s name and its waiting invitations. The pill and the title draw at the size chosen, and on the upright iPad the tabs too. From AX1 the pill is bare, as on main, and its name wraps only between words with no line limit: where its widest word is too wide for the pill’s line, the name steps down until that word fits, never under its default size, and every line is one size; it never steps further only to take fewer lines. The invitation line steps alone by the same rule and never draws larger than the name. Where the widest word is too wide even at its default size, the pill is its tile, with its ring while an invitation waits. Below AX1 the pill is main’s. On the upright iPad the tabs take their size first, centred, and the pill keeps 8 clear of them; its name has the room they leave, less its caret and ends, and it is its tile where the tabs are under their own size or leave it under 120. From AX1 the tabs, Search and the bell keep to the top while the pill grows down, and the title starts under the pill. Only the top is drawn: the page under the title is main’s. On the upright iPad only Settings’ top is the board: Events and the Calendar draw there under Settings’ spacing, and their tops are not part of it. One tap opens Where are you working?. Nothing is sent and no string is added.">
              <Choices
                heading="Text size"
                options={FILTER_SIZES}
                chosen={size}
                onChoose={setSize}
                id="size"
                prefix="demo.topSize"
              />
              <Choices
                heading="Language"
                options={FILTER_LANGUAGES}
                chosen={language}
                onChoose={setLanguage}
                id="language"
                prefix="demo.topSize"
              />
              <Choices
                heading="Screen"
                options={TOP_SCREENS}
                chosen={screen}
                onChoose={setScreen}
                id="screen"
                prefix="demo.topSize"
              />
              <Choices
                heading="Organisation"
                options={TODAY_ORGS}
                chosen={org}
                onChoose={setOrg}
                id="org"
                prefix="demo.topSize"
              />
              <Choices
                heading="Invitations"
                options={TODAY_INVITES}
                chosen={invite}
                onChoose={setInvite}
                id="invite"
                prefix="demo.topSize"
              />
            </DemoOnly>
          </View>
        </ScrollView>
        {told != null && (
          <View style={[styles.toast, { bottom: insets.bottom + tokens.spaceXl }]}>
            <Toast key={told} words={told} onClose={() => setTold(null)} />
          </View>
        )}
      </View>
    </OrgSwitcherProvider>
  );
}

const SCREEN_OF_TAB: Readonly<Record<Exclude<Tab, 'Today'>, TopScreen>> = {
  Events: 'events',
  Calendar: 'calendar',
  Settings: 'settings',
};

const TAB_OF_SCREEN: Readonly<Record<TopScreen, Tab>> = {
  settings: 'Settings',
  events: 'Events',
  calendar: 'Calendar',
};

function Top({
  scale,
  screen,
  waiting,
  tell,
  onTab,
}: {
  scale: number;
  screen: TopScreen;
  waiting: number;
  tell: Tell;
  onTab: (tab: Tab) => void;
}) {
  const { t } = useTranslation();
  const { kind } = useLayout();
  const title = titleSize(TOP_TITLE, scale);
  const upright = kind === 'tabletPortrait';

  return (
    <View style={upright ? styles.uprightTop : styles.top}>
      {upright ? (
        <TopUprightRow
          scale={scale}
          waiting={waiting}
          at={TAB_OF_SCREEN[screen]}
          onTab={onTab}
          tell={tell}
        />
      ) : (
        <TopPillRow scale={scale} waiting={waiting} tell={tell} />
      )}
      <View style={upright ? styles.uprightTitle : styles.titleRow}>
        <Text
          key={title}
          size={title}
          weight="bold"
          allowFontScaling={false}
          accessibilityRole="header"
          style={[topTitle, { lineHeight: Math.ceil(title * tokens.typeTitleFrame.lineHeight) }]}
          testID="demo.topSize.title"
        >
          {t(`todayScreen.tab.${screen}`)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.colorPage },
  top: { paddingHorizontal: tokens.spaceXxl, paddingBottom: tokens.spaceXl },
  titleRow: { minHeight: 48, justifyContent: 'center' },
  uprightTop: { paddingHorizontal: tokens.space3xl, paddingTop: tokens.spaceMd },
  // Settings' upright page: its title 32 in from the sides, 30 under the row (`SettingsHome`).
  uprightTitle: {
    paddingTop: 30,
    paddingBottom: 22,
    paddingHorizontal: tokens.space5xl - tokens.space3xl + tokens.spaceHair,
  },
  choices: { paddingHorizontal: tokens.spaceXl, paddingTop: tokens.spaceLg },
  toast: { position: 'absolute', left: tokens.spaceXl, right: tokens.spaceXl },
});
