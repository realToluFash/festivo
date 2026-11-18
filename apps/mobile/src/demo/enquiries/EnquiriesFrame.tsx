import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PortraitTop as ProductPortraitTop } from '../../components/ListTop.tsx';
import { LIST_EDGES, LIST_GAP } from '../../components/listFrame.ts';
import { sideInsets } from '../../components/bodyEdges.ts';
import { useShell } from '../../components/settingsShell.ts';
import {
  PHONE_TAB_BAR,
  TABS,
  type Tab,
  TabBar,
  TabBarFade,
  WhiteCapsule,
} from '../../components/TodayCover.tsx';
import {
  SidebarColumn,
  SidebarEvents,
  SidebarFoot,
  SidebarHead,
  SidebarPlace,
  SidebarPlaces,
} from '../../components/TodaySidebar.tsx';
import { TodayShellProvider } from '../../components/todayShell.ts';
import { tokens } from '../../theme/tokens.ts';
import { demoShell } from '../demoShell.ts';
import { openSearch, SearchButton } from '../search/SearchHeader.tsx';
import { Bell, Landscape, OrgPill } from '../settings/Frame.tsx';
import { SIDEBAR_EVENTS } from '../sideEvents.ts';

function useSay(): (tab: Tab, glyph: string) => string {
  const { t } = useTranslation();

  return (_tab, glyph) => t(`todayScreen.tab.${glyph}`);
}

function EnquiriesSidebar() {
  const shell = useShell();
  const say = useSay();

  return (
    <TodayShellProvider
      value={{
        ...demoShell(shell.tell, { search: () => openSearch(shell.looking.role) }),
        person: shell.looking,
      }}
    >
      <SidebarColumn>
        <SidebarHead />
        <SidebarPlaces>
          {TABS.filter(([tab]) => tab !== 'Settings').map(([tab, glyph]) => (
            <SidebarPlace
              key={tab}
              label={say(tab, glyph)}
              glyph={glyph}
              on={tab === 'Events'}
              onPress={() => shell.onTab(tab)}
              testID={`enquiries.place.${tab}`}
            />
          ))}
        </SidebarPlaces>
        <SidebarEvents events={SIDEBAR_EVENTS} />
        <SidebarFoot onTab={shell.onTab} at={null} />
      </SidebarColumn>
    </TodayShellProvider>
  );
}

function EnquiriesPortraitTop() {
  const shell = useShell();
  const say = useSay();

  return (
    <ProductPortraitTop
      renderPill={(room, givesWay) => <OrgPill room={room} givesWay={givesWay} />}
      bell={
        <View style={styles.ends}>
          <SearchButton role={shell.looking.role} />
          <Bell tell={shell.tell} />
        </View>
      }
      tabLabels={TABS.map(([tab, glyph]) => say(tab, glyph))}
      renderTabs={(labelSize) => (
        <WhiteCapsule tabs={TABS} at="Events" onTab={shell.onTab} say={say} labelSize={labelSize} />
      )}
    />
  );
}

/** Enquiries is pushed from Events, not a fifth tab (pm, sc-31226 #66918): the bar, capsule and sidebar keep four, with Events selected. */
export function EnquiriesFrame({ band, children }: { band: ReactNode; children: ReactNode }) {
  const shell = useShell();
  const insets = useSafeAreaInsets();
  const say = useSay();

  if (shell.layout === 'landscape')
    return (
      <Landscape column={null} sidebar={<EnquiriesSidebar />}>
        {band}
        <ScrollView
          style={styles.grow}
          contentContainerStyle={[styles.pane, LIST_EDGES.tabletLandscape]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </Landscape>
    );

  const phone = shell.layout === 'phone';
  const foot = Math.max(insets.bottom - tokens.spaceXxs, tokens.spaceLg);

  return (
    <View style={styles.page}>
      {phone ? <View style={{ height: insets.top }} /> : <EnquiriesPortraitTop />}
      {band}
      <View style={[styles.grow, phone && sideInsets('phone', insets)]}>
        <ScrollView
          style={styles.grow}
          contentContainerStyle={[
            styles.blocks,
            phone
              ? [LIST_EDGES.phone, { paddingBottom: foot + PHONE_TAB_BAR + tokens.space6xl * 2 }]
              : [LIST_EDGES.tabletPortrait, { paddingBottom: insets.bottom + tokens.space6xl * 2 }],
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </View>
      {phone && (
        <>
          <TabBarFade />
          <TabBar tabs={TABS} bottom={foot} onTab={shell.onTab} at="Events" say={say} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  page: { flex: 1, backgroundColor: tokens.colorCard },
  ends: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm },
  blocks: { gap: LIST_GAP },
  pane: { paddingBottom: tokens.space6xl * 2, gap: LIST_GAP },
});
