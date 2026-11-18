import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { GlyphName } from '../../components/Glyph.tsx';
import { PortraitTop as ProductPortraitTop } from '../../components/ListTop.tsx';
import { LIST_EDGES, LIST_GAP } from '../../components/listFrame.ts';
import { sideInsets } from '../../components/bodyEdges.ts';
import { useShell } from '../../components/settingsShell.ts';
import {
  PHONE_TAB_BAR,
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
import { W } from './EnquiriesWords.ts';

export type Place = Tab | 'Enquiries';

/** Enquiries beside Events, for an Enterprise organisation only: a fifth place in the bar, the capsule and the sidebar (sc-31226 leaves where to the designer). */
export const PLACES: readonly (readonly [Place, GlyphName])[] = [
  ['Today', 'today'],
  ['Events', 'events'],
  ['Enquiries', 'chat'],
  ['Calendar', 'calendar'],
  ['Settings', 'settings'],
];

export function backToEnquiries(): void {
  router.dismissTo('/demo/enquiries');
}

function useGo(): (place: Place) => void {
  const shell = useShell();

  return (place) => (place === 'Enquiries' ? backToEnquiries() : shell.onTab(place));
}

function useSay(): (place: Place, glyph: GlyphName) => string {
  const { t } = useTranslation();

  return (place, glyph) => (place === 'Enquiries' ? W.enquiries : t(`todayScreen.tab.${glyph}`));
}

function EnquiriesSidebar() {
  const shell = useShell();
  const go = useGo();
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
          {PLACES.filter(([place]) => place !== 'Settings').map(([place, glyph]) => (
            <SidebarPlace
              key={place}
              label={say(place, glyph)}
              glyph={glyph}
              on={place === 'Enquiries'}
              onPress={() => go(place)}
              testID={`enquiries.place.${place}`}
            />
          ))}
        </SidebarPlaces>
        <SidebarEvents events={SIDEBAR_EVENTS} />
        <SidebarFoot onTab={(tab) => go(tab)} at={null} />
      </SidebarColumn>
    </TodayShellProvider>
  );
}

function EnquiriesPortraitTop() {
  const shell = useShell();
  const go = useGo();
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
      tabLabels={PLACES.map(([place, glyph]) => say(place, glyph))}
      renderTabs={(labelSize) => (
        <WhiteCapsule tabs={PLACES} at="Enquiries" onTab={go} say={say} labelSize={labelSize} />
      )}
    />
  );
}

/** The list in its frame: the bar on the phone, the capsule upright, the sidebar on its side, as Events' list has them. */
export function EnquiriesFrame({ band, children }: { band: ReactNode; children: ReactNode }) {
  const shell = useShell();
  const insets = useSafeAreaInsets();
  const go = useGo();
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
          <TabBar tabs={PLACES} bottom={foot} onTab={go} at="Enquiries" say={say} />
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
