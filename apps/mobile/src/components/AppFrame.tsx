import { type Membership, primaryEmailAddress } from '@soirely/api-client';
import {
  PHONE_EVENT_TABS,
  createNewOrganisation,
  roleHolds,
  roleName,
  waitingInvitations,
} from '@soirely/domain';
import { router, useFocusEffect, useNavigation } from 'expo-router';
import {
  type ReactNode,
  type Ref,
  type RefObject,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Pressable,
  ScrollView,
  type ScrollViewInstance,
  type StyleProp,
  StyleSheet,
  useWindowDimensions,
  View,
  type ViewInstance,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import { usePushTaps } from '../appPush.ts';
import { useWaitingInvitations } from '../invitations.ts';
import { useDomainOffer } from '../joinOffers.ts';
import {
  DESTINATION_HREF,
  type Destination,
  HOME_TAPPED,
  SECTION_HREF,
  destinations,
} from '../kit/appNav.ts';
import { backRowHiding } from '../kit/backRow.ts';
import { type Currencies, freshWalk } from '../kit/createWalk.ts';
import { phonePillAlone } from '../kit/frameBand.ts';
import { EDGE_SWIPE_WIDTH, headerDrawsBack, stackSwipes } from '../kit/systemBack.ts';
import { EVENT_PLACES, type EventPlace, MORE_PLACES } from '../kit/eventNav.ts';
import { leaveThen } from '../leaveHeld.ts';
import { frameTitleSize } from '../layout/textSize.ts';
import { backLeast, backScale } from '../layout/focusedHeader.ts';
import {
  type LayoutKind,
  useAccessibilitySizes,
  useLayout,
  useNameLines,
} from '../layout/useLayout.ts';
import { inModal } from '../kit/anchoredMenu.ts';
import { type DropFrame, frameFor, switcherSession } from '../kit/orgSwitcher.ts';
import {
  joinOrganisation,
  onMovedOn,
  signOutHere,
  switchOrganisation,
  useSignedIn,
} from '../signedIn.ts';
import { useSidebarEvents } from '../sidebarEvents.ts';
import { FrameSwitch, switchByTap, useFrameSwitch } from '../tappedSwitch.ts';
import { switcherFocusBack } from '../kit/focusBack.ts';
import { tokens } from '../theme/tokens.ts';
import { useTwoFactorStanding } from '../twoFactorStanding.ts';
import { BellButton } from './BellButton.tsx';
import { CreateWalkWindow, type WalkOpening, deviceNow } from './CreateWalkWindow.tsx';
import { Sheet } from './Sheet.tsx';
import type { GlyphName } from './Glyph.tsx';
import { Notice } from './Notice.tsx';
import {
  type Tab,
  TABS,
  TabBar as PhoneTabs,
  TabBarFade,
  tabBarFoot,
  phoneTabBarClearance,
  WhiteCapsule,
} from './TodayCover.tsx';
import { OrgPill as WhitePill } from './OrgPill.tsx';
import { usePillFit } from './usePillFit.tsx';
import { UnderTabsProvider } from './underTabs.ts';
import type { Shown } from '../kit/eventsList.ts';
import {
  SidebarBack,
  SidebarColumn,
  SidebarEventCard,
  SidebarEvents,
  SidebarFoot,
  SidebarHead,
  SidebarPlace,
  SidebarPlaces,
} from './TodaySidebar.tsx';
import {
  type OpenerRef,
  type OrgOpening,
  type TodayShell,
  TodayShellProvider,
} from './todayShell.ts';
import { OrgDropDown } from './OrgDropDown.tsx';
import { AREA_GLYPH } from './areaGlyph.ts';
import { ReadOut } from './ReadOut.tsx';
import { Back } from './SettingsParts.tsx';
import { SETTLED_MS, useFocusOnAnswer, useWindowOrigin } from './Screen.tsx';
import type { ScreenReaderTarget } from './screenReaderFocus.ts';
import { type TextHandle, Text, TitleCap } from './Text.tsx';
import { Title } from './Title.tsx';
import { PAGE_TITLE, pageTitle } from './topTitle.ts';
import { TopPrimary, type TopPrimaryProps } from './TopPrimary.tsx';
import { ListTop, PortraitRow, PortraitTop } from './ListTop.tsx';
import { AccessPaused } from './AccessPaused.tsx';
import { TwoFactorOverdue } from './TwoFactorOverdue.tsx';
import { type EdgeSwipeHandlers, EdgeSwipeStrip } from './useEdgeSwipeBack.ts';
import { useSystemBack } from './useSystemBack.ts';
import { OfflineBand } from './OfflineBand.tsx';
import { LIST_EDGES, useSideFrame } from './listFrame.ts';
import { type Stale } from '../offline.ts';

type Opening = (opener: RefObject<ViewInstance | null>) => void;

const OpenSwitcher = createContext<Opening | undefined>(undefined);
const SwitcherOpenedBy = createContext<OpenerRef | null>(null);

/** Opens the frame's organisation switcher; undefined while there is no organisation and no invitation. */
export function useOpenSwitcher(): Opening | undefined {
  return useContext(OpenSwitcher);
}

function useOpenerLabel(organisation: Membership | null, waiting: number, switches: boolean) {
  const { t } = useTranslation();
  if (organisation == null) return '';
  const name = organisation.name;
  const role = roleName(t, organisation.role);

  if (!switches) return t('switcher.label', { name, role });
  if (waiting > 0) return t('switcher.labelSwitchWaiting', { name, role, count: waiting });

  return t('switcher.labelSwitch', { name, role });
}

/** Today's openers in the signed-in app: the organisation being worked in, opening the frame's switcher. */
export function useFrameOrgOpener(ref: OpenerRef): OrgOpening {
  const { t } = useTranslation();
  const { organisation } = useSignedIn();
  const { invitations, outcomes } = useWaitingInvitations();
  const open = useOpenSwitcher();
  const openedBy = useContext(SwitcherOpenedBy);
  const count = waitingInvitations(invitations, outcomes);

  return {
    id: organisation?.id ?? '',
    name: organisation?.name ?? '',
    waiting: count > 0 ? t('invitations.count', { count }) : null,
    label: useOpenerLabel(organisation, count, open != null),
    expanded: openedBy === ref,
    onPress: () => open?.(ref),
  };
}

type OrganisationStart = Opening;

const StartOrganisation = createContext<OrganisationStart | undefined>(undefined);

/** Opens the frame's Create an organisation sheet, as the switcher's last row does (sc-5932). */
export function useStartOrganisation(): OrganisationStart | undefined {
  return useContext(StartOrganisation);
}

const HideBack = createContext<((hidden: boolean) => void) | undefined>(undefined);

/** While `hidden`, the phone header keeps its title and drops the back row (sc-3132); it comes back a moment after, as `backRowHiding` holds it. */
export function useHeaderWithoutBack(hidden: boolean): void {
  const hide = useContext(HideBack);

  useEffect(() => {
    hide?.(hidden);

    return () => hide?.(false);
  }, [hide, hidden]);
}

type IconPaths = readonly [string, string];

const AREA_ICONS: Record<EventPlace, IconPaths> = {
  overview: ['M3 3h7v7H3zM14 3h7v7h-7z', 'M14 14h7v7h-7zM3 14h7v7H3z'],
  guests: [
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    'M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  ],
  menu: [
    'M3 2v7a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V2M7 2v20',
    'M21 15V2a5 5 0 0 0-5 5v6a2 2 0 0 0 2 2h3v7',
  ],
  seating: ['M4 10h16v4H4z', 'M6 14v6M18 14v6M8 6h8'],
  messages: ['M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z', 'M8 9h8M8 13h5'],
  schedule: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 6v6l4 2'],
  staff: ['M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2', 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'],
  people: [
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    'M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  ],
  budget: [
    'M21 12V7H5a2 2 0 0 1 0-4h14v4',
    'M3 5v14a2 2 0 0 0 2 2h16v-5M18 12a2 2 0 0 0 0 4h4v-4z',
  ],
  reports: ['M3 3v18h18', 'M8 17v-5M13 17V8M18 17v-9'],
};

/** Inside an event the navigation is the event's areas, in each layout's own form (sc-22103, #24878). */
export interface InsideEvent {
  area: EventPlace;
  onArea: (area: EventPlace) => void;
  /** The event as the landscape sidebar's card on every page under it, its event null while it loads (sc-30413). */
  card: { event: Shown | null; now: Date };
  /** The landscape sidebar's ‹ when it goes somewhere other than Events, as a copy's ‹ Event up to its original. */
  up?: { label: string; onPress: () => void } | undefined;
}

interface NavEntry {
  key: string;
  label: string;
  icon: IconPaths;
  on: boolean;
  onPress: () => void;
  testID: string;
}

function areaEntry(t: (key: string) => string, inside: InsideEvent, area: EventPlace): NavEntry {
  return {
    key: area,
    label: t(`eventNav.${area}`),
    icon: AREA_ICONS[area],
    on: area === inside.area,
    onPress: () => inside.onArea(area),
    testID: `event.nav.${area}`,
  };
}

/** The body keeps its place in the tree on every layout, so a rotation keeps what was typed. */
export function AppFrame({
  current,
  title,
  back,
  backInBody = false,
  titleRef,
  aboutTheAccount = false,
  bodyTakesSwitch = false,
  ownChrome = false,
  inEvent,
  untitled = false,
  primary,
  underTitle,
  besideTitle,
  besideBack,
  top,
  listUnderTabs = false,
  offline = null,
  children,
}: {
  current: Destination;
  /** What the screen loaded, once Soirely stops answering (sc-22586). */
  offline?: Stale | null;
  /** A line under the title, in the header band, as Events' summary. */
  underTitle?: ReactNode;
  /** At the end of the title's row, as Members' Refreshing… (sc-27046). */
  besideTitle?: ReactNode;
  /** At the end of the header's back row, where it has one, as an event page's Refreshing… (sc-27046). */
  besideBack?: ReactNode;
  /** Inside an event, its areas take the navigation's place. */
  inEvent?: InsideEvent | undefined;
  /** Inside an event, the body names the page itself (an Overview's card, an area's heading upright), so the frame draws no title (sc-30413). */
  untitled?: boolean;
  title: string;
  /** The title on a phone, where it stands for the page's own heading. */
  titleRef?: RefObject<TextHandle | null> | undefined;
  /** Security and Account stay open past an organisation's two-factor deadline, to set it up (sc-609). */
  aboutTheAccount?: boolean;
  /** A heading in the body takes screen reader focus after a tapped switch of organisation, in place of the title (sc-11032). */
  bodyTakesSwitch?: boolean;
  /** The body draws its own header and tabs, as Today does (sc-29090); a stand-in still gets the frame's. */
  ownChrome?: boolean;
  /** The page this one was opened from, drawn in the header where `headerDrawsBack` says, as Security's "Settings"; with `systemBack`, Android's Back runs it too. */
  back?:
    | { label: string; onPress: () => void; systemBack?: boolean; off?: boolean; pill?: boolean }
    | undefined;
  /** On a tablet, the body draws this page's back, and is false while that back is off. */
  backInBody?: boolean;
  children: ReactNode;
} & (
  | { top?: undefined; primary?: undefined; listUnderTabs?: undefined }
  | {
      /** The top as the screen's own demo draws it: `scrolls` with the page, which places `FrameTop` at the head of its scroll, or `stays` above it (sc-39471). */
      top: 'scrolls' | 'stays';
      /** The screen's one primary, at the end of its top's title row; only a screen with its own top has one (sc-39471). */
      primary?: TopPrimaryProps | undefined;
      /** On a phone the list runs on under the tab bar and its fade, and ends clear of them (sc-39471). */
      listUnderTabs?: boolean;
    }
)) {
  const { t } = useTranslation();
  const { kind } = useLayout();
  const insets = useSafeAreaInsets();
  const side = useSideFrame();
  const navigation = useNavigation();
  useSystemBack(back?.systemBack === true, () => back?.onPress());
  // As the screen goes, by either Back, its header back is where TalkBack puts its focus, and says it with no name (sc-20554).
  const [inFront, setInFront] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setInFront(true);

      return () => setInFront(false);
    }, []),
  );
  const [choosing, setChoosing] = useState(false);
  const [creating, setCreating] = useState(false);
  const pill = useRef<ViewInstance>(null);
  const ownTitle = useRef<TextHandle>(null);
  const frameTitle = titleRef ?? ownTitle;
  // Create an organisation's sheet takes focus from the switcher, and hands it back itself (sc-8606).
  const [toSheet, setToSheet] = useState(false);
  const [switcherFrom, setSwitcherFrom] = useState<RefObject<ViewInstance | null> | null>(null);
  const [walking, setWalking] = useState<WalkOpening | null>(null);
  // Where focus goes back to as the walk closes: what opened it, or, once it created the first organisation, the notice saying so (sc-11173).
  const walkBack = useRef<RefObject<ViewInstance | null>>(pill);
  const walkOpener = useMemo<RefObject<ScreenReaderTarget | null>>(
    () => ({
      get current() {
        return walkBack.current.current;
      },
    }),
    [],
  );
  const currencies = useCountryCurrencies(creating);
  const [created, setCreated] = useState<{ name: string; takesFocus: boolean } | null>(null);
  const createdWords = useRef<ViewInstance>(null);
  const switched = created == null ? null : t('switcher.switched', { name: created.name });
  useEffect(
    () =>
      inFront ? onMovedOn((next) => setCreated({ name: next.name, takesFocus: false })) : undefined,
    [inFront],
  );
  const [backHidden, setBackHidden] = useState(false);
  const [edgeSwipe, setEdgeSwipe] = useState<EdgeSwipeHandlers | undefined>(undefined);
  const [backRow] = useState(() => backRowHiding(setBackHidden));
  useEffect(() => backRow.stop, [backRow]);
  const stackSwipe = stackSwipes(kind, back, backInBody, edgeSwipe != null);
  useEffect(() => navigation.setOptions({ gestureEnabled: stackSwipe }), [navigation, stackSwipe]);
  const signedIn = useSignedIn();
  usePushTaps(signedIn.account?.id);
  const entries = inEvent == null ? [] : EVENT_PLACES.map((area) => areaEntry(t, inEvent, area));
  const waiting = useWaitingInvitations();
  const offer = useDomainOffer();
  const count = waitingInvitations(waiting.invitations, waiting.outcomes);
  const overdue = useTwoFactorStanding(signedIn.organisation) === 'overdue';
  const standIn = aboutTheAccount
    ? null
    : signedIn.pausedIn != null
      ? 'paused'
      : overdue && signedIn.organisation != null
        ? 'overdue'
        : null;
  const overdueOn = standIn === 'overdue' ? signedIn.organisation?.id : undefined;
  const [switcherOpenedOnOverdue, setSwitcherOpenedOnOverdue] = useState<string | undefined>(
    undefined,
  );
  const overdueIn = useRef<string | undefined>(undefined);
  const overdueHeading = useRef<TextHandle>(null);
  const window = useWindowDimensions();
  const origin = useWindowOrigin();
  const [drop, setDrop] = useState<{ frame: DropFrame; visit: number } | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [answeredHere, setAnsweredHere] = useState<ReadonlySet<string>>(new Set());
  const [offerRefused, setOfferRefused] = useState(false);
  const dropFrom = useCallback(
    (opener: RefObject<ViewInstance | null>, again: boolean) => {
      const at = opener.current;
      const place = (x: number, y: number, width: number, height: number) =>
        setDrop((last) => ({
          frame: frameFor({
            opener: { x, y: inModal(y, origin), width, height },
            window,
            insets: { bottom: insets.bottom },
            phone: kind === 'phone',
          }),
          visit: (last?.visit ?? 0) + (again ? 0 : 1),
        }));
      if (at == null) place(0, insets.top + origin, window.width, 0);
      else at.measureInWindow(place);
    },
    [window, insets.bottom, insets.top, kind, origin],
  );
  // It opens with one organisation too, because it ends with "Create an organisation" (sc-390).
  const openSwitcher =
    signedIn.organisation != null || waiting.invitations.length > 0 || offer.organisation != null
      ? (opener: RefObject<ViewInstance | null>) => {
          setSwitcherOpenedOnOverdue(overdueOn);
          setCreated(null);
          setSwitcherFrom(opener);
          setToSheet(false);
          setExpanded(null);
          setAnsweredHere(new Set());
          dropFrom(opener, false);
          setChoosing(true);
        }
      : undefined;
  const closeSwitcher = useCallback(() => setChoosing(false), []);
  // The opener moves when the window turns, so the drop-down follows it there.
  useEffect(() => {
    if (!choosing || switcherFrom == null) return;
    const wait = setTimeout(() => dropFrom(switcherFrom, true), SETTLED_MS);

    return () => clearTimeout(wait);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [window.width, window.height]);
  const switchFromPill = openSwitcher && (() => openSwitcher(pill));
  // An opener a pick took away, as the paused screen's, falls back to the organisation's name, then the title (sc-11413).
  const switcherOpener = useMemo<RefObject<ScreenReaderTarget | null>>(
    () => ({
      get current() {
        if (toSheet) return null;
        if (switcherFocusBack(switcherOpenedOnOverdue, overdueIn.current) === 'overdueHeading') {
          return overdueHeading.current;
        }

        return switcherFrom?.current ?? pill.current ?? frameTitle.current;
      },
    }),
    [toSheet, switcherFrom, frameTitle, switcherOpenedOnOverdue],
  );
  const startOrganisation = (opener: RefObject<ViewInstance | null>) => {
    setCreated(null);
    walkBack.current = opener;
    setWalking((last) => ({
      visit: (last?.visit ?? 0) + 1,
      walk: freshWalk(deviceNow()),
      focus: 'name',
      toPick: false,
      opener: walkOpener,
    }));
    setCreating(true);
  };
  const email = signedIn.account == null ? '' : (primaryEmailAddress(signedIn.account) ?? '');
  // The deadline passing with the screen open replaces it under a new heading, which takes focus (sc-11173).
  const [standingSeen, setStandingSeen] = useState({ id: signedIn.organisation?.id, overdue });
  const [lapsed, setLapsed] = useState<object | undefined>(undefined);
  if (standingSeen.id !== signedIn.organisation?.id || standingSeen.overdue !== overdue) {
    setStandingSeen({ id: signedIn.organisation?.id, overdue });
    setLapsed(standingSeen.id === signedIn.organisation?.id && overdue ? {} : undefined);
  }
  const switchAnswer = useFrameSwitch();
  useEffect(() => {
    overdueIn.current = overdueOn;
  });
  const framed = !ownChrome || standIn != null;
  const floatingTabs = framed && kind === 'phone' && inEvent == null;
  const eventTabs = framed && kind === 'phone' && inEvent != null;
  const sidebar = framed && kind === 'tabletLandscape';
  const ownTop = framed && top != null && standIn == null;
  const underTabs =
    floatingTabs && listUnderTabs && standIn == null ? phoneTabBarClearance(insets.bottom) : 0;
  const switchedNotice =
    switched == null ? null : created?.takesFocus === true ? (
      <View style={ownTop ? styles.switchedUnderTitle : styles.created}>
        <Notice
          tone="done"
          mark={tokens.marks.done.glyph}
          body={switched}
          wordsRef={createdWords}
        />
      </View>
    ) : (
      <ReadOut style={ownTop ? styles.switchedUnderTitle : styles.created} words={switched}>
        <Notice tone="done" mark={tokens.marks.done.glyph} body={switched} />
      </ReadOut>
    );
  // A body with its own top, as Today, says it where its demo draws it, in its notices (sc-44087).
  const bodySwitched =
    !framed && switched != null && created?.takesFocus !== true ? (
      <ReadOut
        style={kind === 'tabletLandscape' ? undefined : styles.switchedInBody}
        words={switched}
      >
        <Notice tone="done" mark={tokens.marks.done.glyph} body={switched} />
      </ReadOut>
    ) : null;
  const header: FrameHeaderProps = {
    current,
    kind,
    entries,
    inEvent: inEvent != null,
    title,
    titleRef: frameTitle,
    switchAnswer: bodyTakesSwitch || standIn != null ? undefined : switchAnswer,
    back: headerDrawsBack(kind, back, backInBody),
    backHidden,
    organisation: signedIn.organisation,
    waiting: count,
    onSwitch: switchFromPill,
    pill,
    pillAlone: phonePillAlone(current === 'home', primary != null, standIn != null),
    primary: standIn == null ? primary : undefined,
    underTitle: standIn == null ? underTitle : undefined,
    besideTitle: standIn == null ? besideTitle : undefined,
    besideBack: standIn == null || besideBack === undefined ? besideBack : null,
    switched: ownTop ? switchedNotice : null,
    untitled,
  };

  return (
    <SwitcherOpenedBy.Provider value={choosing ? switcherFrom : null}>
      <View
        style={[styles.root, sidebar && side.chrome]}
        importantForAccessibility={inFront ? 'auto' : 'no-hide-descendants'}
      >
        {sidebar && (
          <FrameSidebar
            current={current}
            entries={entries}
            inEvent={inEvent != null}
            card={inEvent?.card}
            up={inEvent?.up}
            organisation={signedIn.organisation}
            waiting={count}
            onSwitch={switchFromPill}
            pill={pill}
          />
        )}
        <View style={[styles.column, sidebar && side.card]}>
          {framed && !ownTop && <FrameHeader {...header} />}
          {ownTop && <FixedTop {...header} />}
          {ownTop && top === 'stays' && <ScreenTop {...header} stays />}
          <OfflineBand stale={standIn == null ? offline : null} inFront={inFront} />
          <View
            style={[
              styles.body,
              (eventTabs || (floatingTabs && underTabs === 0)) && {
                paddingBottom: phoneTabBarClearance(insets.bottom) + tokens.spaceMd,
              },
            ]}
          >
            {!ownTop && bodySwitched == null && switchedNotice}
            <OpenSwitcher.Provider value={openSwitcher}>
              <StartOrganisation.Provider value={startOrganisation}>
                <HideBack.Provider value={backRow.hide}>
                  <EdgeSwipeStrip.Provider value={setEdgeSwipe}>
                    {standIn === 'paused' && signedIn.pausedIn != null ? (
                      <AccessPaused
                        paused={signedIn.pausedIn}
                        others={signedIn.organisations}
                        onSwitch={(next) => switchByTap(next.id)}
                        onChoose={(opener) => openSwitcher?.(opener)}
                      />
                    ) : standIn === 'overdue' && signedIn.organisation != null ? (
                      <TwoFactorOverdue
                        organisation={signedIn.organisation.name}
                        answer={switchAnswer ?? lapsed}
                        headingRef={overdueHeading}
                        onTurnOn={() => router.navigate(SECTION_HREF.security)}
                        onSignOut={signOutHere}
                      />
                    ) : (
                      <FrameSwitch.Provider value={switchAnswer}>
                        <ScrolledTop.Provider value={ownTop && top === 'scrolls' ? header : null}>
                          <BodySwitched.Provider value={bodySwitched}>
                            <UnderTabsProvider value={underTabs}>{children}</UnderTabsProvider>
                          </BodySwitched.Provider>
                        </ScrolledTop.Provider>
                      </FrameSwitch.Provider>
                    )}
                  </EdgeSwipeStrip.Provider>
                </HideBack.Provider>
              </StartOrganisation.Provider>
            </OpenSwitcher.Provider>
          </View>
          {floatingTabs && <FrameTabBar current={current} organisation={signedIn.organisation} />}
          {eventTabs && inEvent != null && <TabBar inEvent={inEvent} />}
        </View>
        {edgeSwipe != null && (
          <View
            style={styles.edgeSwipe}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            {...edgeSwipe}
          />
        )}
        {drop != null && (
          <OrgDropDown
            key={drop.visit}
            session={switcherSession({
              organisations: signedIn.organisations,
              current: signedIn.pausedIn != null ? null : signedIn.organisation,
              waiting,
              answeredHere,
              offer,
              offerRefused,
              expanded,
              role: (role) => roleName(t, role),
            })}
            frame={drop.frame}
            open={choosing}
            back={switcherOpener}
            email={email}
            onClose={closeSwitcher}
            onPick={(id) => {
              closeSwitcher();
              if (id !== signedIn.organisation?.id || signedIn.pausedIn != null) {
                switchOrganisation(id);
              }
            }}
            onCreate={() => {
              setToSheet(true);
              closeSwitcher();
              startOrganisation(switcherFrom ?? pill);
            }}
            onExpand={(id) => setExpanded((open) => (open === id ? null : id))}
            onAnswer={(invite, yes) => {
              const invitation = waiting.invitations.find((known) => known.id === invite.id);
              if (invitation == null) return;
              setAnsweredHere((answered) => new Set(answered).add(invite.id));
              void waiting.answer(invitation, yes ? 'accept' : 'decline');
            }}
            onAsk={() => {
              setOfferRefused(false);
              return offer.ask().catch(() => setOfferRefused(true));
            }}
            onNotNow={() => {
              setExpanded(null);
              void offer.dismiss();
            }}
          />
        )}
        {walking != null && (
          <CreateWalkWindow
            key={`walk${walking.visit}`}
            opening={walking}
            open={creating}
            email={email}
            statusBar="dark"
            currencies={currencies}
            create={(walk) =>
              createNewOrganisation((organisation) => api.createOrganisation(organisation), walk)
            }
            onCancel={() => setCreating(false)}
            onCreated={(organisation) => {
              // In no organisation, what opened the walk goes with it, so it hands focus to the notice (sc-11173).
              const fromNone = signedIn.organisation == null;
              if (fromNone) walkBack.current = createdWords;
              setCreating(false);
              joinOrganisation(organisation);
              switchOrganisation(organisation.id);
              setCreated({ name: organisation.name, takesFocus: fromNone });
            }}
          />
        )}
      </View>
    </SwitcherOpenedBy.Provider>
  );
}

interface FrameHeaderProps {
  current: Destination;
  kind: LayoutKind;
  /** On a phone, the pill on a row of its own (`phonePillAlone`). */
  pillAlone: boolean;
  primary: TopPrimaryProps | undefined;
  underTitle: ReactNode;
  besideTitle: ReactNode;
  besideBack: ReactNode;
  entries: readonly NavEntry[];
  inEvent: boolean;
  title: string;
  titleRef: RefObject<TextHandle | null> | undefined;
  /** A tapped switch of organisation, which takes screen reader focus to the title. */
  switchAnswer: unknown;
  back: { label: string; onPress: () => void; off?: boolean; pill?: boolean } | undefined;
  backHidden: boolean;
  organisation: Membership | null;
  waiting: number;
  onSwitch: (() => void) | undefined;
  pill: Ref<ViewInstance>;
  /** "Now working in …", under the title of a screen with its own top (sc-39471). */
  switched: ReactNode;
  /** Inside an event, a page whose body names it (an Overview's card, an area's own heading upright), so the frame draws no title. */
  untitled: boolean;
}

const ScrolledTop = createContext<FrameHeaderProps | null>(null);

/** The top of a screen whose top scrolls with it, placed at the head of that scroll; nothing on a screen whose frame draws its top (sc-39471). */
export function FrameTop({
  style,
  rowStyle,
}: {
  style?: StyleProp<ViewStyle>;
  /** The title's row, as Settings' column draws it shorter. */
  rowStyle?: StyleProp<ViewStyle>;
}) {
  const top = useContext(ScrolledTop);

  if (top == null) return null;

  return <ScreenTop {...top} style={style} rowStyle={rowStyle} />;
}

const BodySwitched = createContext<ReactNode>(null);

/** "Now working in …" in the notices of a body that draws its own top, as Today does, where its demo draws it (sc-44087). */
export function FrameBodySwitched() {
  return useContext(BodySwitched);
}

/** "Now working in …" for a heading in the body that stands in for the frame's top, as Members' in the Settings column on its side; nothing on a screen whose frame draws its top (sc-39471). */
export function FrameSwitched() {
  return useContext(ScrolledTop)?.switched ?? null;
}

/** What stays put above a demo's top: upright, the pill, the tabs and the bell; on a phone, the status bar's white. */
function FixedTop({ kind, current, organisation, waiting, onSwitch, pill }: FrameHeaderProps) {
  const insets = useSafeAreaInsets();
  const tabs = useFrameTabs(current, organisation);

  if (kind === 'phone') return <View style={{ height: insets.top }} />;
  if (kind !== 'tabletPortrait') return null;

  return (
    <PortraitTop
      renderPill={(room, givesWay) =>
        organisation != null && (
          <OrgPill
            organisation={organisation}
            waiting={waiting}
            onSwitch={onSwitch}
            room={room}
            givesWay={givesWay}
            ref={pill}
          />
        )
      }
      bell={<BellButton />}
      tabLabels={tabLabels(tabs)}
      renderTabs={(labelSize) => <WhiteCapsule {...tabs} labelSize={labelSize} />}
    />
  );
}

/** Events', the Calendar's and Settings' top as their demos draw it, on the page's white: a Settings page's Back and title, or the screen's title at 34 (sc-39471). */
function ScreenTop({
  kind,
  title,
  titleRef,
  switchAnswer,
  back,
  backHidden,
  organisation,
  waiting,
  onSwitch,
  pill,
  primary,
  underTitle,
  besideTitle,
  besideBack,
  switched,
  stays = false,
  style,
  rowStyle,
}: FrameHeaderProps & {
  stays?: boolean;
  style?: StyleProp<ViewStyle>;
  rowStyle?: StyleProp<ViewStyle>;
}) {
  const { read } = useFocusOnAnswer<TextHandle>(switchAnswer, titleRef);
  const page = back != null;
  const backView =
    back == null || backHidden ? null : (
      <BesideBack beside={besideBack}>
        <Back label={back.label} onPress={back.onPress} off={back.off} testID="frame.back" />
      </BesideBack>
    );
  const under = (
    <>
      {underTitle}
      {switched}
    </>
  );
  const staysStyle = stays && LIST_EDGES[kind];

  if (!page)
    return (
      <ListTop
        kind={kind}
        title={title}
        titleRef={read}
        pill={
          organisation != null && (
            <OrgPill organisation={organisation} waiting={waiting} onSwitch={onSwitch} ref={pill} />
          )
        }
        bell={<BellButton />}
        beside={besideTitle}
        primary={primary}
        under={under}
        style={[staysStyle, style]}
        rowStyle={rowStyle}
      />
    );

  const titleRow = (
    <View style={[styles.topRow, styles.pageRow, rowStyle]}>
      <View style={styles.fill}>
        <Title size={PAGE_TITLE} accessibilityRole="header" ref={read} style={pageTitle}>
          {title}
        </Title>
      </View>
      {besideTitle}
      {primary != null && <TopPrimary {...primary} wide={kind !== 'phone'} />}
      {kind === 'tabletLandscape' && <BellButton />}
    </View>
  );

  if (kind === 'phone')
    return (
      <View style={[staysStyle, style]}>
        <View style={styles.titleRow}>
          <View style={styles.fill}>{backView}</View>
          <BellButton />
        </View>
        {titleRow}
        {under}
      </View>
    );

  return (
    <View style={[staysStyle, style]}>
      {kind === 'tabletPortrait' && backView}
      {titleRow}
      {under}
    </View>
  );
}

function FrameHeader({
  current,
  kind,
  entries,
  inEvent,
  title,
  titleRef,
  switchAnswer,
  back,
  backHidden,
  organisation,
  waiting,
  onSwitch,
  pill,
  pillAlone,
  underTitle,
  besideTitle,
  besideBack,
  untitled,
}: FrameHeaderProps) {
  const insets = useSafeAreaInsets();
  const top = kind === 'tabletLandscape' ? undefined : { paddingTop: insets.top + tokens.spaceXxs };
  const { read } = useFocusOnAnswer<TextHandle>(switchAnswer, titleRef);
  const large = useAccessibilitySizes();
  const { width, height } = useLayout();
  const titleSize = frameTitleSize(kind !== 'phone', Math.min(width, height));
  const tabs = useFrameTabs(current, organisation);

  if (kind === 'tabletLandscape') {
    if (untitled) return null;

    return (
      <View style={[styles.landscapeHeader, large && styles.stacked]}>
        <View style={[styles.titled, !large && styles.fill]}>
          <View style={styles.titleRow}>
            <View style={large ? styles.shrink : styles.fill}>
              <Title size={titleSize} accessibilityRole="header" ref={read}>
                {title}
              </Title>
            </View>
            {besideTitle}
          </View>
          {underTitle}
        </View>
        <BellButton />
      </View>
    );
  }

  const pillView = organisation != null && (
    <View style={styles.shrink}>
      <OrgPill organisation={organisation} waiting={waiting} onSwitch={onSwitch} ref={pill} />
    </View>
  );
  const backView =
    back == null || backHidden ? null : back.pill === true ? (
      <BesideBack beside={besideBack}>
        <Back label={back.label} onPress={back.onPress} off={back.off} testID="frame.back" />
      </BesideBack>
    ) : (
      <BackButton
        label={back.label}
        onPress={back.onPress}
        off={back.off}
        beside={besideBack}
        testID="frame.back"
      />
    );
  const titleRow = (end?: ReactNode) => (
    <View style={styles.titleRow}>
      <View style={styles.fill}>
        <View style={styles.titleRow}>
          <View style={styles.fill}>
            <Title size={titleSize} accessibilityRole="header" ref={read}>
              {title}
            </Title>
          </View>
          {besideTitle}
        </View>
        {underTitle}
      </View>
      {end}
    </View>
  );

  // Out of an event, the pill and the bell head the page with the tabs between them, as the demos draw it (sc-30410).
  if (kind === 'tabletPortrait' && !inEvent) {
    return (
      <View style={[styles.portraitHeader, top]}>
        <PortraitRow
          renderPill={(room, givesWay) =>
            organisation != null && (
              <OrgPill
                organisation={organisation}
                waiting={waiting}
                onSwitch={onSwitch}
                room={room}
                givesWay={givesWay}
                ref={pill}
              />
            )
          }
          bell={<BellButton />}
          tabLabels={tabLabels(tabs)}
          renderTabs={(labelSize) => <WhiteCapsule {...tabs} labelSize={labelSize} />}
          tabsCentred
        />
        {backView}
        {titleRow()}
      </View>
    );
  }

  // Inside an event upright, the demo's EventFrame top in every phase and while loading: ‹ and the bell in one row, the area pills under it, no organisation pill (sc-30413).
  if (kind === 'tabletPortrait') {
    return (
      <View
        style={[
          styles.eventPortraitHeader,
          { paddingTop: insets.top + tokens.spaceMd },
          untitled && styles.flushFoot,
        ]}
      >
        <View style={styles.titleRow}>
          <View style={styles.fill}>
            {back != null && !backHidden && (
              <BesideBack beside={besideBack}>
                <Back
                  label={back.label}
                  onPress={back.onPress}
                  off={back.off}
                  testID="frame.back"
                />
              </BesideBack>
            )}
          </View>
          <BellButton />
        </View>
        <Pills entries={entries} scrolls />
        {!untitled && titleRow()}
      </View>
    );
  }

  // Inside an event, ‹ in its pill and the bell head the page; on Overview the event's card under them names it (sc-30413).
  if (inEvent && back != null) {
    return (
      <View style={[styles.phoneHeader, top, untitled && styles.flushFoot]}>
        <View style={styles.titleRow}>
          <View style={styles.fill}>
            {!backHidden && (
              <BesideBack beside={besideBack}>
                <Back
                  label={back.label}
                  onPress={back.onPress}
                  off={back.off}
                  testID="frame.back"
                />
              </BesideBack>
            )}
          </View>
          <BellButton />
        </View>
        {!untitled && titleRow()}
      </View>
    );
  }

  if (back == null) {
    return (
      <View style={[styles.phoneHeader, top]}>
        <View style={styles.titleRow}>
          {pillView}
          <View style={styles.fill} />
          <BellButton />
        </View>
        {titleRow()}
      </View>
    );
  }

  return (
    <View style={[styles.phoneHeader, top]}>
      {pillAlone && organisation != null && (
        <OrgPill organisation={organisation} waiting={waiting} onSwitch={onSwitch} ref={pill} />
      )}
      {backView}
      {titleRow(<BellButton />)}
    </View>
  );
}

export function BackButton({
  label,
  heard,
  onPress,
  off = false,
  beside,
  testID,
}: {
  label: string;
  heard?: string;
  onPress: () => void;
  off?: boolean | undefined;
  /** Null while the slot is empty, never undefined: the row stays, so Back is not remounted and keeps screen reader focus (sc-27046). */
  beside?: ReactNode;
  testID: string;
}) {
  const { fontScale } = useWindowDimensions();
  const scale = backScale(fontScale, useContext(TitleCap));
  const mark = tokens.sizeMark * scale;
  const button = (
    <Pressable
      style={styles.back}
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityLabel={heard}
      accessibilityState={{ disabled: off }}
      testID={testID}
    >
      <Svg width={mark} height={mark} viewBox="0 0 24 24" fill="none">
        <Path
          d="m15 18-6-6 6-6"
          {...STROKE}
          stroke={off ? tokens.colorInkSecondary : tokens.colorInk}
        />
      </Svg>
      <Text
        size={tokens.typeBodyPhone.size * scale}
        weight="semibold"
        muted={off}
        allowFontScaling={false}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={backLeast(scale)}
      >
        {label}
      </Text>
    </Pressable>
  );

  return <BesideBack beside={beside}>{button}</BesideBack>;
}

function BesideBack({ beside, children }: { beside: ReactNode; children: ReactNode }) {
  if (beside === undefined) return <>{children}</>;

  return (
    <View style={besideRow.row}>
      {children}
      {beside}
    </View>
  );
}

/** A heading or Back at the start, something small at the far end: Back beside Refreshing…, a title beside Refreshing… (sc-27046). */
export const besideRow = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spaceMd,
  },
});

function goTo(destination: Destination): void {
  const href = destination === 'home' ? HOME_TAPPED : DESTINATION_HREF[destination];
  leaveThen((discarding) => (discarding ? router.dismissTo(href) : router.navigate(href)));
}

const TAB_DESTINATION = {
  Today: 'home',
  Events: 'events',
  Calendar: 'calendar',
  Settings: 'settings',
} as const satisfies Record<Tab, Destination>;

const TAB_IDS: Record<Tab, string> = {
  Today: 'frame.home',
  Events: 'frame.events',
  Calendar: 'frame.calendar',
  Settings: 'frame.settings',
};

/** The frame's tabs, only those the role can open, each going where its destination does. */
function useFrameTabs(
  current: Destination,
  organisation: { permissions: readonly string[] } | null,
) {
  const { t } = useTranslation();
  const open = destinations(organisation);
  const tabs = TABS.filter(([tab]) => open.includes(TAB_DESTINATION[tab]));

  return {
    tabs,
    at: tabs.find(([tab]) => TAB_DESTINATION[tab] === current)?.[0] ?? 'Today',
    onTab: (tab: Tab) => goTo(TAB_DESTINATION[tab]),
    say: (_: Tab, glyph: GlyphName) => t(`todayScreen.tab.${glyph}`),
    ids: TAB_IDS,
  };
}

function tabLabels({ tabs, say }: ReturnType<typeof useFrameTabs>): string[] {
  return tabs.map(([tab, glyph]) => say(tab, glyph));
}

/** The phone's tab bar as the demos draw it, floating over the page's foot. */
function FrameTabBar({
  current,
  organisation,
}: {
  current: Destination;
  organisation: { permissions: readonly string[] } | null;
}) {
  const insets = useSafeAreaInsets();
  const tabs = useFrameTabs(current, organisation);

  return (
    <>
      <TabBarFade />
      <PhoneTabs {...tabs} bottom={tabBarFoot(insets.bottom)} />
    </>
  );
}

type PhoneEventTab = (typeof PHONE_EVENT_TABS)[number] | 'more';

const PHONE_EVENT_BAR: readonly (readonly [PhoneEventTab, GlyphName])[] = [
  ...PHONE_EVENT_TABS.map((area) => [area, AREA_GLYPH[area]] as const),
  ['more', 'dots'],
];

const PHONE_EVENT_IDS: Record<PhoneEventTab, string> = {
  overview: 'event.nav.overview',
  guests: 'event.nav.guests',
  menu: 'event.nav.menu',
  messages: 'event.nav.messages',
  more: 'event.nav.more',
};

/** Inside an event on a phone, the demos' floating bar: four areas and More, whose sheet holds the rest. */
function TabBar({ inEvent }: { inEvent: InsideEvent }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [more, setMore] = useState(false);
  const moreTab = useRef<ViewInstance>(null);
  const at: PhoneEventTab = (PHONE_EVENT_TABS as readonly EventPlace[]).includes(inEvent.area)
    ? (inEvent.area as PhoneEventTab)
    : 'more';

  return (
    <>
      <TabBarFade />
      <PhoneTabs
        tabs={PHONE_EVENT_BAR}
        bottom={tabBarFoot(insets.bottom)}
        at={at}
        say={(tab) => t(`eventNav.${tab}`)}
        ids={PHONE_EVENT_IDS}
        refs={{ more: moreTab }}
        onTab={(tab) => (tab === 'more' ? setMore(true) : inEvent.onArea(tab))}
      />
      <Sheet
        open={more}
        onClose={() => setMore(false)}
        scrimLabel={t('eventNav.closeMore')}
        opener={moreTab}
        testID="event.nav.moreSheet"
      >
        <View style={styles.moreSheet}>
          <Title size={tokens.typeTitleDialog.size} accessibilityRole="header">
            {t('eventNav.more')}
          </Title>
          <View accessibilityRole="tablist" style={styles.moreList}>
            {MORE_PLACES.map((area) => {
              const on = area === inEvent.area;

              return (
                <Pressable
                  key={area}
                  style={[styles.railItem, on && styles.railItemOn]}
                  onPress={() => {
                    setMore(false);
                    inEvent.onArea(area);
                  }}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                  testID={`event.nav.more.${area}`}
                >
                  <Icon paths={AREA_ICONS[area]} on={on} size={tokens.sizeMark} />
                  <Text
                    size={tokens.typeBodyPhone.size}
                    weight={on ? 'semibold' : 'medium'}
                    style={on ? styles.ink : styles.secondaryInk}
                  >
                    {t(`eventNav.${area}`)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </Sheet>
    </>
  );
}

/** The header band's pills in tablet portrait; inside an event they scroll sideways, so no area's name is cut. */
function Pills({ entries, scrolls }: { entries: readonly NavEntry[]; scrolls: boolean }) {
  const strip = useRef<ScrollViewInstance>(null);
  const starts = useRef<Record<string, number>>({});
  const chosen = entries.find((entry) => entry.on)?.key;
  const reveal = (key: string | undefined) => {
    const x = key == null ? undefined : starts.current[key];
    if (x != null)
      strip.current?.scrollTo({ x: Math.max(0, x - tokens.space3xl), animated: false });
  };
  // The chosen area's pill is kept in view, as the demo's AreaPills keeps it.
  useEffect(() => reveal(chosen), [chosen]);

  const pills = entries.map((entry) => (
    <Pressable
      key={entry.key}
      style={[styles.pill, entry.on && styles.pillOn]}
      onLayout={(event) => {
        starts.current[entry.key] = event.nativeEvent.layout.x;
        if (entry.on) reveal(entry.key);
      }}
      onPress={entry.onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: entry.on }}
      testID={entry.testID}
    >
      <Icon
        paths={entry.icon}
        on={entry.on}
        onInk={tokens.colorAccentText}
        size={tokens.sizeMark}
      />
      <Text
        size={tokens.typeBody.size}
        weight="semibold"
        style={entry.on ? styles.accentInk : styles.secondaryInk}
      >
        {entry.label}
      </Text>
    </Pressable>
  ));

  return scrolls ? (
    <ScrollView
      ref={strip}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.pillsBar}
      contentContainerStyle={styles.pillsInEvent}
      accessibilityRole="tablist"
    >
      {pills}
    </ScrollView>
  ) : (
    <View style={styles.pills} accessibilityRole="tablist">
      {pills}
    </View>
  );
}

/** iPad landscape's sidebar as the demos draw it: the organisation, the places or the event's areas, and Settings and the person at its foot. */
function FrameSidebar({
  current,
  entries,
  inEvent,
  card,
  up,
  organisation,
  waiting,
  onSwitch,
  pill,
}: {
  current: Destination;
  entries: readonly NavEntry[];
  inEvent: boolean;
  card: InsideEvent['card'] | undefined;
  up: InsideEvent['up'];
  organisation: Membership | null;
  waiting: number;
  onSwitch: (() => void) | undefined;
  pill: Ref<ViewInstance>;
}) {
  const { t } = useTranslation();
  const { account } = useSignedIn();
  const events = useSidebarEvents(account?.id, inEvent ? undefined : organisation?.id);
  const tabs = useFrameTabs(current, organisation);
  const name = account?.name ?? '';
  const role = organisation == null ? null : roleName(t, organisation.role);
  const person = useMemo(() => ({ name, role }), [name, role]);
  const shell = useMemo<TodayShell>(
    () => ({
      organisation: organisation?.name ?? '',
      person,
      unread: 0,
      creates: organisation != null && roleHolds(organisation, 'events.create'),
      search: false,
      open: (opens) => {
        if (opens.to === 'account') router.navigate(SECTION_HREF.account);
        if (opens.to === 'event') router.push(`/events/${opens.id}`);
      },
      useOrgOpener: useFrameOrgOpener,
    }),
    [organisation, person],
  );
  const places = inEvent
    ? entries.map((entry) => (
        <SidebarPlace
          key={entry.key}
          label={entry.label}
          glyph={AREA_GLYPH[entry.key as EventPlace]}
          on={entry.on}
          onPress={entry.onPress}
          testID={entry.testID}
        />
      ))
    : tabs.tabs
        .filter(([tab]) => tab !== 'Settings')
        .map(([tab, glyph]) => (
          <SidebarPlace
            key={tab}
            label={tabs.say(tab, glyph)}
            glyph={glyph}
            on={tab === tabs.at}
            onPress={() => tabs.onTab(tab)}
            testID={TAB_IDS[tab]}
          />
        ));

  return (
    <TodayShellProvider value={shell}>
      <SidebarColumn>
        <SidebarHead search={false} org={false} />
        {organisation != null && (
          <OrgPill
            organisation={organisation}
            waiting={waiting}
            onSwitch={onSwitch}
            sidebar
            ref={pill}
          />
        )}
        {inEvent && (
          <SidebarBack
            label={up?.label ?? t('todayScreen.tab.events')}
            heard={up?.label ?? t('eventsScreen.backToEvents')}
            onPress={up?.onPress ?? (() => goTo('events'))}
            testID="frame.side.back"
          />
        )}
        {inEvent && card != null && <SidebarEventCard event={card.event} now={card.now} />}
        <SidebarPlaces>{places}</SidebarPlaces>
        {inEvent ? <View style={styles.fill} /> : <SidebarEvents events={events} />}
        <SidebarFoot
          onTab={tabs.onTab}
          at={inEvent ? null : tabs.at}
          person={person}
          settingsID={TAB_IDS.Settings}
        />
      </SidebarColumn>
    </TodayShellProvider>
  );
}

function OrgPill({
  organisation,
  waiting,
  onSwitch,
  sidebar = false,
  room,
  givesWay = false,
  ref,
}: {
  organisation: Membership;
  waiting: number;
  onSwitch: (() => void) | undefined;
  sidebar?: boolean;
  /** The room beside an upright tablet's tabs, where the pill turns to its tile when its words would not fit whole. */
  room?: number | undefined;
  /** The tabs beside it took their room first, so it is its tile (sc-40401). */
  givesWay?: boolean;
  ref: Ref<ViewInstance>;
}) {
  const { t } = useTranslation();
  const large = useAccessibilitySizes();
  const lines = useNameLines();
  const label = useOpenerLabel(organisation, waiting, onSwitch != null);
  const expanded = useContext(SwitcherOpenedBy) === ref;
  const waitingWords = waiting > 0 ? t('invitations.count', { count: waiting }) : null;
  const { tileAlone, measure } = usePillFit(organisation.name, waitingWords, room, large);
  const pill = (
    <WhitePill
      ref={ref}
      id={organisation.id}
      name={organisation.name}
      waiting={waitingWords}
      label={label}
      expanded={expanded}
      onPress={onSwitch}
      bare={large}
      wrap={large}
      lines={lines}
      sidebar={sidebar}
      tileAlone={givesWay || tileAlone}
      testID="frame.organisation"
    />
  );

  if (sidebar) return pill;

  return (
    <View style={styles.whitePill}>
      {measure}
      {pill}
    </View>
  );
}

const STROKE = { strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

function Icon({
  paths,
  on,
  onInk = tokens.colorInk,
  size,
}: {
  paths: IconPaths;
  on: boolean;
  onInk?: string;
  size: number;
}) {
  const stroke = on ? onInk : tokens.colorInkSecondary;

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d={paths[0]} {...STROKE} stroke={stroke} />
      <Path d={paths[1]} {...STROKE} stroke={stroke} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.colorPage },
  edgeSwipe: { position: 'absolute', top: 0, bottom: 0, left: 0, width: EDGE_SWIPE_WIDTH },
  column: { flex: 1, minWidth: 0 },
  body: { flex: 1, minHeight: 0 },
  fill: { flex: 1 },
  titled: { gap: tokens.spaceXxs, flexShrink: 1 },
  shrink: { flexShrink: 1, minWidth: 0 },
  ink: { color: tokens.colorInk },
  secondaryInk: { color: tokens.colorInkSecondary },
  accentInk: { color: tokens.colorAccentText },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm },
  topRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: tokens.spaceMd },
  pageRow: { minHeight: 0, paddingTop: 14 },
  phoneHeader: {
    gap: tokens.spaceLg,
    paddingHorizontal: tokens.spaceXxl,
    paddingBottom: tokens.spaceXl,
  },
  flushFoot: { paddingBottom: 0 },
  portraitHeader: {
    gap: tokens.spaceXl,
    paddingHorizontal: tokens.space4xl,
    paddingBottom: tokens.spaceXl,
  },
  landscapeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceLg,
    paddingTop: 26,
    paddingHorizontal: 30,
    paddingBottom: tokens.spaceLg,
  },
  stacked: { flexDirection: 'column', alignItems: 'flex-start', gap: tokens.spaceXs },
  back: {
    alignSelf: 'flex-start',
    flexShrink: 1,
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceXs,
    minHeight: tokens.sizeHit,
    marginLeft: -tokens.spaceXs,
    paddingHorizontal: tokens.spaceXs,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spaceHair,
    marginHorizontal: -tokens.spaceXxs,
  },
  pill: {
    minHeight: tokens.sizeHit,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceSm,
    paddingLeft: tokens.spaceLg,
    paddingRight: tokens.spaceXl,
    borderRadius: tokens.sizeHit / 2,
  },
  pillOn: { backgroundColor: tokens.colorCard },
  moreSheet: { gap: tokens.spaceLg, padding: tokens.space3xl },
  // The rows keep their own 12 pt padding, so their icons start on the title's line.
  moreList: { gap: tokens.spaceHair, marginHorizontal: -tokens.spaceLg },
  pillsBar: { flexGrow: 0, borderRadius: 26, backgroundColor: tokens.colorInset },
  pillsInEvent: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceHair,
    paddingHorizontal: tokens.spaceXxs,
  },
  eventPortraitHeader: {
    gap: tokens.spaceSm,
    paddingHorizontal: tokens.space5xl,
    paddingBottom: tokens.spaceXl,
  },
  railItem: {
    minHeight: tokens.sizeHit,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceLg,
    paddingHorizontal: tokens.spaceLg,
    borderRadius: tokens.radiusRow,
  },
  railItemOn: { backgroundColor: tokens.colorNeutralFill },
  whitePill: { flexDirection: 'row', flexShrink: 1, minWidth: 0 },
  created: { paddingTop: tokens.spaceLg, paddingHorizontal: tokens.spaceXl },
  switchedUnderTitle: { marginTop: 18 },
  switchedInBody: { marginBottom: tokens.spaceXl },
});

let currenciesRead: Currencies | null = null;
let currenciesAsked: Promise<Currencies> | null = null;

/** The currency each country founds with, read once the walk first opens and kept: it changes only with the API. An answer that failed is asked again the next time the walk opens. */
function useCountryCurrencies(open: boolean): Currencies | null {
  const [currencies, setCurrencies] = useState(currenciesRead);

  useEffect(() => {
    if (!open || currenciesRead != null) return;
    currenciesAsked ??= api.countryCurrencies().then(
      (read) => {
        currenciesRead = read;
        return read;
      },
      (failure: unknown) => {
        currenciesAsked = null;
        throw failure;
      },
    );
    let live = true;
    currenciesAsked.then(
      (read) => {
        if (live) setCurrencies(read);
      },
      () => {},
    );

    return () => {
      live = false;
    };
  }, [open]);

  return currencies ?? currenciesRead;
}
