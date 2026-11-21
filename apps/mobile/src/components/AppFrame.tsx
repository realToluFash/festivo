import {
  type ManagedAccount,
  type Membership,
  type OutsideEvent,
  primaryEmailAddress,
} from '@soirely/api-client';
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
  type LayoutChangeEvent,
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
import { type WaitingInvitations, useWaitingInvitations } from '../invitations.ts';
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
import { EVENT_PLACES, type EventPlace, MORE_PLACES, eventHref } from '../kit/eventNav.ts';
import { useServerNow } from '../kit/serverNow.ts';
import {
  OUTSIDE_TABS,
  outsideGroups,
  outsideHref,
  outsideMore,
  outsidePlaces,
  switcherOutside,
} from '../kit/outsideEvent.ts';
import { leaveThen } from '../leaveHeld.ts';
import { frameTitleSize } from '../layout/textSize.ts';
import { backScale } from '../layout/focusedHeader.ts';
import { statusFits } from '../layout/titleFit.ts';
import {
  type LayoutKind,
  useAccessibilitySizes,
  useLayout,
  useNameLines,
} from '../layout/useLayout.ts';
import { inModal } from '../kit/anchoredMenu.ts';
import { type DropFrame, frameFor, openerAfterTurn, switcherSession } from '../kit/orgSwitcher.ts';
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
import { BellButton, BellInPane } from './BellButton.tsx';
import { SearchAndBell } from './SearchButton.tsx';
import { SEARCH_HREF } from '../kit/searchLinks.ts';
import { CreateWalkWindow, type WalkOpening, deviceNow } from './CreateWalkWindow.tsx';
import { Sheet } from './Sheet.tsx';
import { Glyph, type GlyphName } from './Glyph.tsx';
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
import { ManagedBanner } from './ManagedBanner.tsx';
import { OrgDropDown } from './OrgDropDown.tsx';
import { AREA_GLYPH } from './areaGlyph.ts';
import { ReadOut } from './ReadOut.tsx';
import { Row, RowList, TextAction } from './SummaryRows.tsx';
import { OutsideEventsGroup, YourOrganisationsGroup } from './OutsideRows.tsx';
import { Back, useBackWord } from './SettingsParts.tsx';
import { SETTLED_MS, useFocusOnAnswer, useWindowOrigin } from './Screen.tsx';
import type { ScreenReaderTarget } from './screenReaderFocus.ts';
import { type TextHandle, Text, TitleCap } from './Text.tsx';
import { PageTitleDrawn, Title, useTitleCap } from './Title.tsx';
import { PAGE_TITLE, pageTitle } from './topTitle.ts';
import { TopPrimary, type TopPrimaryProps, usePrimaryLabel } from './TopPrimary.tsx';
import { ListTop, PortraitRow, PortraitTop } from './ListTop.tsx';
import { AccessPaused } from './AccessPaused.tsx';
import { TwoFactorOverdue } from './TwoFactorOverdue.tsx';
import { type EdgeSwipeHandlers, EdgeSwipeStrip } from './useEdgeSwipeBack.ts';
import { useSystemBack } from './useSystemBack.ts';
import { WayBackToNone, useWayBackToNone } from './wayBackToNone.ts';
import { OfflineBand } from './OfflineBand.tsx';
import { sideInsets } from './bodyEdges.ts';
import { LIST_EDGES, useSideFrame } from './listFrame.ts';
import { type Stale } from '../offline.ts';

type Opening = (opener: RefObject<ViewInstance | null>) => void;

const OpenSwitcher = createContext<Opening | undefined>(undefined);
const SwitcherOpenedBy = createContext<OpenerRef | null>(null);
const RegisterOpener = createContext<
  ((opener: OpenerRef, primary: boolean) => () => void) | undefined
>(undefined);

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
export function useFrameOrgOpener(ref: OpenerRef, primary = true): OrgOpening {
  const { t } = useTranslation();
  const { organisation } = useSignedIn();
  const { invitations, outcomes } = useWaitingInvitations();
  const open = useOpenSwitcher();
  const openedBy = useContext(SwitcherOpenedBy);
  const register = useContext(RegisterOpener);
  const count = waitingInvitations(invitations, outcomes);

  useEffect(() => register?.(ref, primary), [register, ref, primary]);

  return {
    id: organisation?.id ?? '',
    name: organisation?.name ?? '',
    waiting: count > 0 ? t('invitations.count', { count }) : null,
    label: useOpenerLabel(organisation, count, open != null),
    expanded: openedBy === ref,
    onPress: () => open?.(ref),
  };
}

interface OrganisationStart {
  open: Opening;
  /** sc-563: undefined until the API has said, and then the refusal a managed account reads instead. */
  managed: ManagedAccount | null | undefined;
}

const StartOrganisation = createContext<OrganisationStart | undefined>(undefined);

/** Opens the frame's Create an organisation sheet, as the switcher's last row does (sc-5932), unless the account is managed. */
export function useStartOrganisation(): OrganisationStart | undefined {
  return useContext(StartOrganisation);
}

const OpenJoined = createContext<((id: string) => void) | undefined>(undefined);

/** Open, once an invitation is accepted from no organisation: into it, with "Now working in …" focused, as its demo does (sc-75471). */
export function useOpenJoined(): ((id: string) => void) | undefined {
  return useContext(OpenJoined);
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

/** Inside an event the navigation is the event's areas, in each layout's own form (sc-22103, #24878). */
export interface InsideEvent {
  area: EventPlace;
  onArea: (area: EventPlace) => void;
  /** The event as the landscape sidebar's card on every page under it, its event null while it loads (sc-30413). */
  card: { event: Shown | null; now: Date };
  /** The landscape sidebar's ‹ when it goes somewhere other than Events, as a copy's ‹ Event up to its original. */
  up?: { label: string; onPress: () => void } | undefined;
  /** Held from outside an organisation (sc-71): its level's areas, no way back to Events, and in More the account's other events, a member's organisations (sc-68438), Your account and Sign out. */
  outside?: { id: string; role: OutsideEvent['role'] } | undefined;
  /** Nothing above the body: held from outside at a reading level, Overview's card heads the page, as the demo's `more-in` draws it (sc-71). */
  bare?: boolean | undefined;
}

interface NavEntry {
  key: string;
  label: string;
  glyph: GlyphName;
  on: boolean;
  onPress: () => void;
  testID: string;
  /** The entry a sheet it opens gives focus back to. */
  opener?: RefObject<ViewInstance | null>;
}

function areaEntry(t: (key: string) => string, inside: InsideEvent, area: EventPlace): NavEntry {
  return {
    key: area,
    label: t(`eventNav.${area}`),
    glyph: AREA_GLYPH[area],
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
  /** At the end of the header's back row, where it has one, as an event page's Refreshing… (sc-27046); or one that gives way to the pill, as Guests' (sc-71821). */
  besideBack?: BesideBackNode;
  /** Inside an event, its areas take the navigation's place. */
  inEvent?: InsideEvent | undefined;
  /** The body names the page itself (an event's Overview card, a member's own card in front of the list), so the frame draws no title (sc-30413, sc-37693). */
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
  const now = useServerNow();
  const [outsideMoreOpen, setOutsideMoreOpen] = useState(false);
  const moreOpener = useRef<ViewInstance>(null);
  const outsideHere = inEvent?.outside?.id;
  const heldGroups = outsideGroups(signedIn);
  // Upright on a tablet, held from outside, the capsule's More holds the account's groups, as the demo's Inside draws it (sc-68438).
  const uprightMore =
    kind === 'tabletPortrait' &&
    outsideHere != null &&
    (heldGroups.organisations || heldGroups.events);
  const entries =
    inEvent == null
      ? []
      : [
          ...(inEvent.outside == null ? EVENT_PLACES : outsidePlaces(inEvent.outside.role)).map(
            (area) => areaEntry(t, inEvent, area),
          ),
          ...(uprightMore
            ? [
                {
                  key: 'more',
                  label: t('eventNav.more'),
                  glyph: 'dots' as const,
                  on: false,
                  onPress: () => setOutsideMoreOpen(true),
                  testID: 'event.nav.more',
                  opener: moreOpener,
                },
              ]
            : []),
        ];
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
  const openers = useRef(new Map<OpenerRef, boolean>());
  const registerOpener = useCallback((opener: OpenerRef, primary: boolean) => {
    openers.current.set(opener, primary);

    return () => {
      openers.current.delete(opener);
    };
  }, []);
  // The opener moves when the window turns, or is drawn anew, as Today's sidebar head turned upright, so the drop-down follows it there.
  useEffect(() => {
    if (!choosing || switcherFrom == null) return;
    const wait = setTimeout(() => {
      const drawn = [...openers.current].filter(([, primary]) => primary).map(([opener]) => opener);
      const opener = openerAfterTurn(switcherFrom, [...drawn, pill]);
      if (opener !== switcherFrom) setSwitcherFrom(opener);
      dropFrom(opener, true);
    }, SETTLED_MS);

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
  const openJoined = useCallback(
    (id: string) => {
      const name = signedIn.organisations.find((known) => known.id === id)?.name;
      switchOrganisation(id, () => {
        if (name != null) setCreated({ name, takesFocus: true });
      });
    },
    [signedIn.organisations],
  );
  const startOrganisation = (opener: RefObject<ViewInstance | null>) => {
    setCreated(null);
    walkBack.current = opener;
    setWalking((last) => ({
      visit: (last?.visit ?? 0) + 1,
      walk: { ...freshWalk(deviceNow()), managed: offer.managed != null },
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
  // Opened from You are not in an organisation: no tab bar or sidebar, and its way back on top (sc-75471). An account holding an event from outside lands in that event instead, so it keeps today's frame.
  const openedFromNone =
    signedIn.organisation == null &&
    signedIn.pausedIn == null &&
    (signedIn.account?.outsideEvents.length ?? 0) === 0 &&
    inEvent == null &&
    standIn == null;
  const floatingTabs = framed && kind === 'phone' && inEvent == null && !openedFromNone;
  const eventTabs = framed && kind === 'phone' && inEvent != null;
  const sideCard = framed && kind === 'tabletLandscape';
  const sidebar = sideCard && !openedFromNone;
  const ownTop = framed && top != null && standIn == null;
  const underTabs =
    floatingTabs && listUnderTabs && standIn == null ? phoneTabBarClearance(insets.bottom) : 0;
  // A top that stays sits outside any Screen, so it and the body under it clear the side bars here, as a Screen does for Events (sc-52423).
  const sides = ownTop && top === 'stays' ? sideInsets(kind, insets) : null;
  // A phone's header sits outside the body's Screen, so its back, pill and bell clear the side bars here, where Events' do (sc-54891).
  const headerSides = kind === 'phone' ? sideInsets(kind, insets) : null;
  const switchedRead = created?.takesFocus !== true;
  // A body with its own top, as Today, draws it where its demo does, under its cover, while the frame says it once whatever the body shows (sc-44087, sc-46032).
  const inBody = !framed;
  // Today shows once its events have loaded, so the notice there takes focus as it shows, not as the walk closes (sc-46032).
  const focusInBody = inBody && !switchedRead;
  const switchedWords =
    switched == null ? null : (
      <Notice
        tone="done"
        mark={tokens.marks.done.glyph}
        body={switched}
        wordsRef={switchedRead || inBody ? undefined : createdWords}
        {...(focusInBody ? { answer: created, takesFocus: true, readMs: SETTLED_MS * 2 } : {})}
      />
    );
  const switchedStyle = ownTop ? styles.switchedUnderTitle : styles.created;
  const switchedNotice =
    switched == null ? null : inBody ? (
      switchedRead && <ReadOut words={switched} />
    ) : switchedRead ? (
      <ReadOut style={switchedStyle} words={switched}>
        {switchedWords}
      </ReadOut>
    ) : (
      <View style={switchedStyle}>{switchedWords}</View>
    );
  const bodySwitched =
    inBody && switched != null ? (
      <View style={kind === 'tabletLandscape' ? undefined : styles.switchedInBody}>
        {switchedWords}
      </View>
    ) : null;
  const titleCap = useTitleCap(`${kind}|${untitled}|${title}`, PAGE_TITLE);
  // A page the frame draws no title for is capped only by a title its body draws, as an event area's (sc-67338).
  const cap = framed && (titleCap.drawn || !untitled) ? titleCap.cap : null;
  const header: FrameHeaderProps = {
    current,
    kind,
    entries,
    inEvent: inEvent != null,
    bare: inEvent?.bare === true,
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
    cap,
    onTitleDrawn: titleCap.onDrawn,
  };

  return (
    <WayBackToNone.Provider value={openedFromNone ? backToNone : null}>
      <RegisterOpener.Provider value={registerOpener}>
        <SwitcherOpenedBy.Provider value={choosing ? switcherFrom : null}>
          <View
            style={[styles.root, sideCard && side.chrome]}
            importantForAccessibility={inFront ? 'auto' : 'no-hide-descendants'}
          >
            {sidebar && (
              <FrameSidebar
                current={current}
                entries={entries}
                inEvent={inEvent != null}
                card={inEvent?.card}
                up={inEvent?.up}
                outside={inEvent?.outside?.id ?? null}
                organisation={signedIn.organisation}
                waiting={count}
                onSwitch={switchFromPill}
                pill={pill}
                cap={titleCap.cap}
              />
            )}
            <View
              style={[styles.column, sideCard && side.card, sideCard && !sidebar && side.alone]}
            >
              {framed && !ownTop && (
                <View style={headerSides}>
                  <FrameHeader {...header} />
                </View>
              )}
              {ownTop && <FixedTop {...header} />}
              {ownTop && top === 'stays' && (
                <View style={sides}>
                  <ScreenTop {...header} stays />
                </View>
              )}
              <OfflineBand stale={standIn == null ? offline : null} inFront={inFront} />
              <View
                style={[
                  styles.body,
                  sides,
                  (eventTabs || (floatingTabs && underTabs === 0)) && {
                    paddingBottom: phoneTabBarClearance(insets.bottom) + tokens.spaceMd,
                  },
                ]}
              >
                <PageTitleDrawn.Provider value={titleCap.onDrawn}>
                  <TitleCap.Provider value={cap}>
                    {!ownTop && switchedNotice}
                    <OpenSwitcher.Provider value={openSwitcher}>
                      <StartOrganisation.Provider
                        value={{ open: startOrganisation, managed: offer.managed }}
                      >
                        <OpenJoined.Provider value={openJoined}>
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
                                  <ScrolledTop.Provider
                                    value={ownTop && top === 'scrolls' ? header : null}
                                  >
                                    <BodySwitched.Provider value={bodySwitched}>
                                      <UnderTabsProvider value={underTabs}>
                                        <BellInPane.Provider value={sidebar && untitled}>
                                          {children}
                                        </BellInPane.Provider>
                                      </UnderTabsProvider>
                                    </BodySwitched.Provider>
                                  </ScrolledTop.Provider>
                                </FrameSwitch.Provider>
                              )}
                            </EdgeSwipeStrip.Provider>
                          </HideBack.Provider>
                        </OpenJoined.Provider>
                      </StartOrganisation.Provider>
                    </OpenSwitcher.Provider>
                  </TitleCap.Provider>
                </PageTitleDrawn.Provider>
              </View>
              {floatingTabs && (
                <FrameTabBar current={current} organisation={signedIn.organisation} />
              )}
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
            {uprightMore && outsideHere != null && (
              <OutsideYouSheet
                here={outsideHere}
                open={outsideMoreOpen}
                opener={moreOpener}
                name={t('eventNav.more')}
                onClose={() => setOutsideMoreOpen(false)}
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
                managed={managedRefusal(waiting, () => {
                  closeSwitcher();
                  setTimeout(() => router.push('/settings/account'), SETTLED_MS);
                })}
                events={switcherOutside(signedIn, now)}
                onEvent={(eventId) => {
                  closeSwitcher();
                  router.push(eventHref(eventId));
                }}
                onClose={closeSwitcher}
                onPick={(id) => {
                  closeSwitcher();
                  if (id !== signedIn.organisation?.id || signedIn.pausedIn != null) {
                    const name = signedIn.organisations.find((known) => known.id === id)?.name;
                    switchOrganisation(id, () => {
                      if (name != null) setCreated({ name, takesFocus: false });
                    });
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
                managedBanner={
                  offer.managed == null ? undefined : (
                    <ManagedBanner
                      organisation={offer.managed.organisation.name}
                      message={offer.managed.message}
                      onChange={() => {
                        setCreating(false);
                        setTimeout(() => router.push('/settings/account'), SETTLED_MS);
                      }}
                      testID="createWalk.managed"
                    />
                  )
                }
                create={(walk) =>
                  createNewOrganisation(
                    (organisation) => api.createOrganisation(organisation),
                    walk,
                  )
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
      </RegisterOpener.Provider>
    </WayBackToNone.Provider>
  );
}

function backToNone(): void {
  router.navigate(DESTINATION_HREF.home);
}

interface FrameHeaderProps {
  current: Destination;
  kind: LayoutKind;
  /** On a phone, the pill on a row of its own (`phonePillAlone`). */
  pillAlone: boolean;
  primary: TopPrimaryProps | undefined;
  underTitle: ReactNode;
  besideTitle: ReactNode;
  besideBack: BesideBackNode;
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
  /** A page whose body names it (an event's Overview card, a member's own card in front of the list), so the frame draws no title. */
  untitled: boolean;
  /** No title, back or bell above the body; upright, the area pills alone. */
  bare: boolean;
  /** The size the title drew at, which nothing under it outgrows; null where nothing caps (sc-67338). */
  cap: number | null;
  onTitleDrawn: (size: number) => void;
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

  // The pill and the bell keep their own sizes; ScreenTop caps Back and what is under the title (sc-67338, sc-67471).
  return (
    <TitleCap.Provider value={null}>
      <ScreenTop {...top} style={style} rowStyle={rowStyle} />
    </TitleCap.Provider>
  );
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
  const fromNone = useWayBackToNone();

  if (kind === 'phone') return <View style={{ height: insets.top }} />;
  if (kind !== 'tabletPortrait') return null;
  if (fromNone != null) return <View style={{ height: insets.top + tokens.spaceXl }} />;

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
      bell={<SearchAndBell />}
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
  untitled,
  cap,
  onTitleDrawn,
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
        <FrameBack back={back} cap={cap} besideShown={shownBeside(besideBack)} />
      </BesideBack>
    );
  const under = (
    <TitleCap.Provider value={cap}>
      {underTitle}
      {switched}
    </TitleCap.Provider>
  );
  const staysStyle = stays && LIST_EDGES[kind];
  const fromNone = useWayBackToNone();
  const wayBack = fromNone != null && (
    <WayBackToNoneButton kind={kind} cap={cap} onPress={fromNone} />
  );
  const label = usePrimaryLabel({
    title,
    size: PAGE_TITLE,
    style: pageTitle,
    label: page ? primary?.label : undefined,
    gap: tokens.spaceMd,
    labelled: kind !== 'phone',
  });

  if (!page)
    return (
      <>
        {kind !== 'phone' && wayBack}
        <ListTop
          kind={kind}
          title={title}
          titleRef={read}
          onTitleDrawn={onTitleDrawn}
          pill={
            organisation != null ? (
              <OrgPill
                organisation={organisation}
                waiting={waiting}
                onSwitch={onSwitch}
                ref={pill}
              />
            ) : (
              wayBack
            )
          }
          bell={kind === 'tabletLandscape' ? <BellButton /> : <SearchAndBell />}
          beside={besideTitle}
          primary={primary}
          under={under}
          untitled={untitled}
          style={[staysStyle, style]}
          rowStyle={rowStyle}
        />
      </>
    );

  const titleRow = (
    <View style={[styles.topRow, styles.pageRow, rowStyle]}>
      <View style={styles.fill} onLayout={label.onSlot}>
        {label.measure}
        <Title
          size={PAGE_TITLE}
          accessibilityRole="header"
          ref={read}
          style={pageTitle}
          onDrawn={onTitleDrawn}
        >
          {title}
        </Title>
      </View>
      {besideTitle}
      {primary != null && <TopPrimary {...primary} wide={label.wide} />}
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
        {!untitled && titleRow}
        {under}
      </View>
    );

  return (
    <View style={[staysStyle, style]}>
      {kind === 'tabletPortrait' && backView}
      {!untitled && titleRow}
      {under}
    </View>
  );
}

function FrameHeader({
  current,
  kind,
  entries,
  inEvent,
  bare,
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
  cap,
  onTitleDrawn,
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
    // Inside an event the bell ends the area's name's row at every size, the name wrapping to its left (sc-68052).
    const stacks = large && !inEvent;

    return (
      <View style={[styles.landscapeHeader, stacks && styles.stacked, inEvent && styles.bellAtTop]}>
        <View style={[styles.titled, !stacks && styles.fill]}>
          <View style={[styles.titleRow, inEvent && styles.bellHigh]}>
            <View style={stacks ? styles.shrink : styles.fill}>
              <Title size={titleSize} accessibilityRole="header" ref={read} onDrawn={onTitleDrawn}>
                {title}
              </Title>
            </View>
            {besideTitle}
          </View>
          <TitleCap.Provider value={cap}>{underTitle}</TitleCap.Provider>
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
        <FrameBack back={back} cap={cap} besideShown={shownBeside(besideBack)} />
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
            <Title size={titleSize} accessibilityRole="header" ref={read} onDrawn={onTitleDrawn}>
              {title}
            </Title>
          </View>
          {besideTitle}
        </View>
        <TitleCap.Provider value={cap}>{underTitle}</TitleCap.Provider>
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
          bell={<SearchAndBell />}
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
        {!bare && (
          <View style={styles.titleRow}>
            <View style={styles.fill}>
              {back != null && !backHidden && (
                <BesideBack beside={besideBack}>
                  <FrameBack back={back} cap={cap} besideShown={shownBeside(besideBack)} />
                </BesideBack>
              )}
            </View>
            <BellButton />
          </View>
        )}
        <Pills entries={entries} scrolls />
        {!untitled && titleRow()}
      </View>
    );
  }

  if (bare) return <View style={{ paddingTop: insets.top + tokens.spaceLg }} />;

  // Inside an event, ‹ in its pill and the bell head the page; on Overview the event's card under them names it (sc-30413).
  if (inEvent && back != null) {
    return (
      <View style={[styles.phoneHeader, top, untitled && styles.flushFoot]}>
        <View style={styles.titleRow}>
          <View style={styles.fill}>
            {!backHidden && (
              <BesideBack beside={besideBack}>
                <FrameBack back={back} cap={cap} besideShown={shownBeside(besideBack)} />
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
          <SearchAndBell />
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

/** ‹ Join or start an organisation, where the pill and the tabs would be: on a phone in the pill's row, upright under the status bar's room, on its side at the head of the column (sc-75471). */
function WayBackToNoneButton({
  kind,
  cap,
  onPress,
}: {
  kind: LayoutKind;
  cap: number | null;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const back = (
    <FrameBack
      back={{ label: t('noOrganisation.wayBack'), onPress }}
      cap={cap}
      besideShown={false}
    />
  );

  if (kind === 'phone') return back;

  return (
    <View style={kind === 'tabletPortrait' ? styles.noneBackUpright : styles.noneBackSide}>
      {back}
    </View>
  );
}

/** The frame's Back pill over a page title draws no larger than the title, as on the signed-out screens (sc-67471). */
function FrameBack({
  back,
  cap,
  besideShown,
}: {
  back: NonNullable<FrameHeaderProps['back']>;
  cap: number | null;
  besideShown: boolean;
}) {
  return (
    <TitleCap.Provider value={cap}>
      <Back
        label={back.label}
        onPress={back.onPress}
        off={back.off}
        besideShown={besideShown}
        testID="frame.back"
      />
    </TitleCap.Provider>
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
  beside?: BesideBackNode;
  testID: string;
}) {
  const { fontScale } = useWindowDimensions();
  const scale = backScale(fontScale, useContext(TitleCap));
  const body = tokens.typeBodyPhone.size;
  const word = useBackWord(
    label,
    { full: body * scale, least: body, glyph: tokens.sizeMark, sides: 3 * tokens.spaceXs },
    shownBeside(beside),
  );
  const mark = (tokens.sizeMark / body) * word.size;
  const button = (
    <>
      {word.measure}
      <Pressable
        style={styles.back}
        onPress={onPress}
        onLayout={word.onLayout}
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
          size={word.size}
          weight="semibold"
          muted={off}
          allowFontScaling={false}
          numberOfLines={1}
        >
          {label}
        </Text>
      </Pressable>
    </>
  );

  return <BesideBack beside={beside}>{button}</BesideBack>;
}

/** A status beside Back that gives way to the pill: drawn there only where the pill stays whole beside it, and told where it went, so its screen draws it elsewhere when it does not fit (sc-71821). */
export interface GivesWay {
  status: ReactNode;
  onPlaced: (beside: boolean) => void;
}

type BesideBackNode = ReactNode | GivesWay;

function givesWay(beside: BesideBackNode): beside is GivesWay {
  return typeof beside === 'object' && beside != null && 'onPlaced' in beside;
}

/** Whether Back shares its row with something it makes room for; a status that gives way never shrinks its word (sc-68778, sc-71821). */
function shownBeside(beside: BesideBackNode): boolean {
  return beside != null && !givesWay(beside);
}

function BesideBack({ beside, children }: { beside: BesideBackNode; children: ReactNode }) {
  if (beside === undefined) return <>{children}</>;
  if (givesWay(beside)) return <GivingWay beside={beside}>{children}</GivingWay>;

  return (
    <View style={besideRow.row}>
      {children}
      {beside}
    </View>
  );
}

/** Back laid out as if the status were not there, the status measured hidden, and drawn beside the pill only in the room left; the bell is outside this row. It stays mounted while the status comes and goes, keeping the status's last width, so where it goes is known again the frame it returns (sc-71821). The drawn status is out of the row's flow: in it, a pill that grew after the status was placed was squeezed, and Back measured the squeezed width as room enough for both (sc-74113). */
function GivingWay({ beside, children }: { beside: GivesWay; children: ReactNode }) {
  const [slot, setSlot] = useState(0);
  const [back, setBack] = useState(0);
  const [status, setStatus] = useState(0);
  const fits = statusFits({ room: slot, lead: back, ends: [], status, gap: tokens.spaceMd });
  const { onPlaced } = beside;

  useEffect(() => onPlaced(fits), [fits, onPlaced]);

  const widthOf = (set: (width: number) => void) => (event: LayoutChangeEvent) =>
    set(Math.ceil(event.nativeEvent.layout.width));

  return (
    <View style={besideRow.row} onLayout={widthOf(setSlot)}>
      <View style={besideRow.back} onLayout={widthOf(setBack)}>
        {children}
      </View>
      <View
        style={besideRow.measure}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {beside.status != null && <View onLayout={widthOf(setStatus)}>{beside.status}</View>}
      </View>
      {fits && <View style={besideRow.end}>{beside.status}</View>}
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
  back: { flexShrink: 1, minWidth: 0 },
  measure: { position: 'absolute', opacity: 0 },
  end: { position: 'absolute', top: 0, right: 0, bottom: 0, justifyContent: 'center' },
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

const OUTSIDE_BAR: readonly (readonly [PhoneEventTab, GlyphName])[] = [
  ...(OUTSIDE_TABS as readonly PhoneEventTab[]).map(
    (area) => [area, AREA_GLYPH[area as EventPlace]] as const,
  ),
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
  const { outside } = inEvent;
  const tabs = outside == null ? PHONE_EVENT_BAR : OUTSIDE_BAR;
  const inMore = outside == null ? MORE_PLACES : outsideMore(outside.role);
  const at: PhoneEventTab = tabs.some(([tab]) => tab === inEvent.area)
    ? (inEvent.area as PhoneEventTab)
    : 'more';

  return (
    <>
      <TabBarFade />
      <PhoneTabs
        tabs={tabs}
        bottom={tabBarFoot(insets.bottom)}
        at={at}
        say={(tab) => t(`eventNav.${tab}`)}
        ids={PHONE_EVENT_IDS}
        refs={{ more: moreTab }}
        onTab={(tab) => (tab === 'more' ? setMore(true) : inEvent.onArea(tab))}
        stepsBelowDefault
      />
      <Sheet
        open={more}
        onClose={() => setMore(false)}
        scrimLabel={t('eventNav.closeMore')}
        opener={moreTab}
        testID="event.nav.moreSheet"
      >
        <View style={[styles.moreSheet, { paddingBottom: Math.max(MORE_FOOT - insets.bottom, 0) }]}>
          <View style={styles.moreHead}>
            <Text
              size={22}
              weight="bold"
              accessibilityRole="header"
              style={[styles.fill, styles.moreTitle]}
            >
              {t('eventNav.more')}
            </Text>
            <Pressable
              onPress={() => setMore(false)}
              style={({ pressed }) => [styles.moreClose, pressed && styles.closePressed]}
              accessibilityRole="button"
              accessibilityLabel={t('eventNav.closeMore')}
              testID="event.nav.moreSheet.close"
            >
              <Glyph name="x" size={18} ink={tokens.colorInk} weight={2.4} />
            </Pressable>
          </View>
          <View accessibilityRole="tablist">
            <RowList
              items={inMore.map((area) => {
                const on = area === inEvent.area;

                return {
                  key: area,
                  inset: 40,
                  selected: on,
                  row: (
                    <Row
                      title={t(`eventNav.${area}`)}
                      lead={<MoreGlyph name={AREA_GLYPH[area]} on={on} />}
                      opens
                      selected={on}
                      onPress={() => {
                        setMore(false);
                        inEvent.onArea(area);
                      }}
                      accessibilityRole="tab"
                      testID={`event.nav.more.${area}`}
                    />
                  ),
                };
              })}
            />
          </View>
          {outside != null && (
            <OutsideYou
              here={outside.id}
              onLeave={() => setMore(false)}
              idPrefix="event.nav.more"
            />
          )}
        </View>
      </Sheet>
    </>
  );
}

/** Held from outside an organisation (sc-71), the account's own two: Your account and Sign out, in the phone's More and behind the sidebar's person button. */
function OutsideYou({
  here,
  onLeave,
  idPrefix,
}: {
  here: string;
  onLeave: () => void;
  idPrefix: string;
}) {
  const { t } = useTranslation();
  const held = useSignedIn();
  const { account } = held;
  const groups = outsideGroups(held);

  return (
    <>
      {groups.organisations && (
        <YourOrganisationsGroup
          organisations={held.organisations}
          idPrefix={`${idPrefix}.organisations`}
          onOrganisation={(organisation) => {
            onLeave();
            if (organisation.id !== held.organisation?.id) switchByTap(organisation.id);
            goTo('home');
          }}
        />
      )}
      {groups.events && account != null && (
        <OutsideEventsGroup
          title={t('outsideEvent.yourEvents')}
          events={account.outsideEvents}
          here={here}
          idPrefix={`${idPrefix}.events`}
          onEvent={(event) => {
            onLeave();
            if (event.id !== here) router.replace(outsideHref(event.id, here));
          }}
        />
      )}
      <RowList
        items={[
          {
            key: 'account',
            inset: 40,
            row: (
              <Row
                title={t('settings.yourAccount')}
                line={account?.name}
                lead={<MoreGlyph name="user" on={false} />}
                opens
                onPress={() => {
                  onLeave();
                  router.navigate(SECTION_HREF.account);
                }}
                testID={`${idPrefix}.account`}
              />
            ),
          },
        ]}
      />
      <TextAction
        label={t('settings.signOut')}
        plain
        glyph="signOut"
        onPress={() => {
          onLeave();
          signOutHere();
        }}
        testID={`${idPrefix}.signOut`}
      />
    </>
  );
}

/** On its side, held from outside, the sidebar person button's sheet: the person's name over Your account and Sign out, as the demo's MoreSheet draws it there. */
function OutsideYouSheet({
  here,
  open,
  opener,
  name,
  onClose,
}: {
  here: string;
  open: boolean;
  opener: RefObject<ViewInstance | null>;
  name: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();

  return (
    <Sheet
      open={open}
      onClose={onClose}
      scrimLabel={t('eventNav.closeMore')}
      opener={opener}
      testID="frame.side.you"
    >
      <View style={styles.moreSheet}>
        <View style={styles.moreHead}>
          <Text
            size={22}
            weight="bold"
            accessibilityRole="header"
            style={[styles.fill, styles.moreTitle]}
          >
            {name}
          </Text>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [styles.moreClose, pressed && styles.closePressed]}
            accessibilityRole="button"
            accessibilityLabel={t('eventNav.closeMore')}
            testID="frame.side.you.close"
          >
            <Glyph name="x" size={18} ink={tokens.colorInk} weight={2.4} />
          </Pressable>
        </View>
        <OutsideYou here={here} onLeave={onClose} idPrefix="frame.side.you" />
      </View>
    </Sheet>
  );
}

/** A More row's glyph, 20 pt, in its name's colour, as the demo's MoreSheet draws it (sc-56935). */
function MoreGlyph({ name, on }: { name: GlyphName; on: boolean }) {
  return (
    <View style={styles.moreGlyph}>
      <Glyph
        name={name}
        size={tokens.sizeMark}
        ink={on ? tokens.colorAccentText : tokens.colorInkSecondary}
        weight={2}
      />
    </View>
  );
}

const MORE_FOOT = 116;

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
      ref={entry.opener}
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
      <Glyph
        name={entry.glyph}
        size={18}
        ink={entry.on ? tokens.colorAccentText : tokens.colorInkSecondary}
      />
      <Text size={15} weight="semibold" style={entry.on ? styles.accentInk : styles.secondaryInk}>
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
  outside,
  organisation,
  waiting,
  onSwitch,
  pill,
  cap,
}: {
  current: Destination;
  entries: readonly NavEntry[];
  inEvent: boolean;
  card: InsideEvent['card'] | undefined;
  up: InsideEvent['up'];
  /** The event held from outside, when it is one. */
  outside: string | null;
  organisation: Membership | null;
  waiting: number;
  onSwitch: (() => void) | undefined;
  pill: Ref<ViewInstance>;
  /** The size the area's name draws at in the pane, which nothing in an event's sidebar outgrows at the largest sizes (sc-68052). */
  cap: number;
}) {
  const { t } = useTranslation();
  const large = useAccessibilitySizes();
  const { account } = useSignedIn();
  const events = useSidebarEvents(account?.id, inEvent ? undefined : organisation?.id);
  const tabs = useFrameTabs(current, organisation);
  const [you, setYou] = useState(false);
  const youOpener = useRef<ViewInstance>(null);
  const name = account?.name ?? '';
  const role = organisation == null ? null : roleName(t, organisation.role);
  const person = useMemo(() => ({ name, role }), [name, role]);
  const shell = useMemo<TodayShell>(
    () => ({
      organisation: organisation?.name ?? '',
      person,
      unread: 0,
      creates: organisation != null && roleHolds(organisation, 'events.create'),
      search: organisation != null && !inEvent,
      open: (opens) => {
        if (opens.to === 'account') router.navigate(SECTION_HREF.account);
        if (opens.to === 'event') router.push(`/events/${opens.id}`);
        if (opens.to === 'search') router.push(SEARCH_HREF);
      },
      useOrgOpener: useFrameOrgOpener,
    }),
    [organisation, person, inEvent],
  );
  const places = inEvent
    ? entries.map((entry) => (
        <SidebarPlace
          key={entry.key}
          label={entry.label}
          glyph={entry.glyph}
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
      <TitleCap.Provider value={inEvent && large ? cap : null}>
        <SidebarColumn listing={!inEvent}>
          <SidebarHead>
            {organisation != null && outside == null && (
              <OrgPill
                organisation={organisation}
                waiting={waiting}
                onSwitch={onSwitch}
                sidebar
                ref={pill}
              />
            )}
          </SidebarHead>
          {inEvent && outside == null && (
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
            settings={outside == null}
            onPerson={outside != null ? () => setYou(true) : undefined}
            personRef={outside != null ? youOpener : undefined}
          />
        </SidebarColumn>
        {outside != null && (
          <OutsideYouSheet
            here={outside}
            open={you}
            opener={youOpener}
            name={name}
            onClose={() => setYou(false)}
          />
        )}
      </TitleCap.Provider>
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.colorPage },
  edgeSwipe: { position: 'absolute', top: 0, bottom: 0, left: 0, width: EDGE_SWIPE_WIDTH },
  column: { flex: 1, minWidth: 0 },
  body: { flex: 1, minHeight: 0 },
  fill: { flex: 1 },
  titled: { gap: tokens.spaceXxs, flexShrink: 1 },
  shrink: { flexShrink: 1, minWidth: 0 },
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
  bellAtTop: { alignItems: 'flex-start' },
  noneBackUpright: { flexDirection: 'row' },
  noneBackSide: { flexDirection: 'row', marginBottom: tokens.spaceXs },
  bellHigh: { minHeight: tokens.sizeHit },
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
    paddingLeft: 14,
    paddingRight: tokens.spaceXl,
    borderRadius: tokens.sizeHit / 2,
  },
  pillOn: { backgroundColor: tokens.colorCard, ...tokens.elevationNative.raised.ios },
  moreSheet: { gap: tokens.spaceXl, paddingHorizontal: tokens.spaceXxl, paddingTop: 31 },
  moreTitle: { letterSpacing: 22 * -0.015, lineHeight: 22 * 1.2 },
  moreHead: { minHeight: tokens.sizeHit, flexDirection: 'row', alignItems: 'center' },
  moreClose: {
    width: tokens.sizeHit,
    height: tokens.sizeHit,
    borderRadius: tokens.sizeHit / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorInset,
  },
  closePressed: { opacity: tokens.opacityPressed },
  moreGlyph: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
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
  whitePill: { flexDirection: 'row', flexShrink: 1, minWidth: 0 },
  created: { paddingTop: tokens.spaceLg, paddingHorizontal: tokens.spaceXl },
  switchedUnderTitle: { marginTop: 18 },
  switchedInBody: { alignSelf: 'stretch', marginBottom: tokens.spaceXl },
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

/** sc-563's banner for the invitation whose Join the API refused as managed. */
function managedRefusal(waiting: WaitingInvitations, onChange: () => void) {
  const outcome = Object.values(waiting.outcomes).find((one) => one.kind === 'managed');

  return outcome?.kind === 'managed' ? (
    <ManagedBanner
      organisation={outcome.organisation}
      message={outcome.message}
      onChange={onChange}
      takesFocus
      testID="switcher.invitation.managed"
    />
  ) : undefined;
}
