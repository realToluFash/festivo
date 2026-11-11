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
import { phonePillAlone, pillBesideTabs } from '../kit/frameBand.ts';
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
import { joinOrganisation, onMovedOn, switchOrganisation, useSignedIn } from '../signedIn.ts';
import { useSidebarEvents } from '../sidebarEvents.ts';
import { FrameSwitch, switchByTap, useFrameSwitch } from '../tappedSwitch.ts';
import { switcherFocusBack } from '../kit/focusBack.ts';
import { tokens } from '../theme/tokens.ts';
import { useTwoFactorStanding } from '../twoFactorStanding.ts';
import { BellButton } from './BellButton.tsx';
import { CreateWalkWindow, type WalkOpening, deviceNow } from './CreateWalkWindow.tsx';
import { HeaderPrimary, type HeaderPrimaryProps } from './Buttons.tsx';
import { Sheet } from './Sheet.tsx';
import type { GlyphName } from './Glyph.tsx';
import { Notice } from './Notice.tsx';
import {
  PHONE_TAB_BAR,
  type Tab,
  TABS,
  TabBar as PhoneTabs,
  TabBarFade,
  tabBarFoot,
  WhiteCapsule,
} from './TodayCover.tsx';
import { OrgPill as WhitePill } from './OrgPill.tsx';
import { usePillFit } from './usePillFit.tsx';
import {
  SidebarBack,
  SidebarColumn,
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
import { Title, useWholeWords } from './Title.tsx';
import { PAGE_TITLE, TOP_TITLE, pageTitle, topTitle } from './topTitle.ts';
import { TopPrimary } from './TopPrimary.tsx';
import { AccessPaused } from './AccessPaused.tsx';
import { TwoFactorOverdue } from './TwoFactorOverdue.tsx';
import { type EdgeSwipeHandlers, EdgeSwipeStrip } from './useEdgeSwipeBack.ts';
import { useSystemBack } from './useSystemBack.ts';
import { OfflineBand } from './OfflineBand.tsx';
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

const AREA_ICONS: Record<EventPlace | 'more', IconPaths> = {
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
  more: ['M5 12h.01M12 12h.01', 'M19 12h.01'],
};

/** Inside an event the navigation is the event's areas, in each layout's own form (sc-22103, #24878). */
export interface InsideEvent {
  area: EventPlace;
  onArea: (area: EventPlace) => void;
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
  primary,
  underTitle,
  besideTitle,
  besideBack,
  top,
  offline = null,
  children,
}: {
  current: Destination;
  /** The top as the screen's own demo draws it: `scrolls` with the page, which places `FrameTop` at the head of its scroll, or `stays` above it (sc-39471). */
  top?: 'scrolls' | 'stays' | undefined;
  /** What the screen loaded, once Soirely stops answering (sc-22586). */
  offline?: Stale | null;
  /** The screen's one primary, in the header band where [fd] puts it (sc-22103). */
  primary?: HeaderPrimaryProps | undefined;
  /** A line under the title, in the header band, as Events' summary. */
  underTitle?: ReactNode;
  /** At the end of the title's row, as Members' Refreshing… (sc-27046). */
  besideTitle?: ReactNode;
  /** At the end of the header's back row, where it has one, as an event page's Refreshing… (sc-27046). */
  besideBack?: ReactNode;
  /** Inside an event, its areas take the navigation's place. */
  inEvent?: InsideEvent | undefined;
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
}) {
  const { t } = useTranslation();
  const { kind } = useLayout();
  const insets = useSafeAreaInsets();
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
  const sidebar = framed && kind === 'tabletLandscape';
  const ownTop = framed && top != null && standIn == null;
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
  };

  return (
    <SwitcherOpenedBy.Provider value={choosing ? switcherFrom : null}>
      <View
        style={[styles.root, sidebar && [styles.chrome, { paddingTop: insets.top }]]}
        importantForAccessibility={inFront ? 'auto' : 'no-hide-descendants'}
      >
        {sidebar && (
          <FrameSidebar
            current={current}
            entries={entries}
            inEvent={inEvent != null}
            organisation={signedIn.organisation}
            waiting={count}
            onSwitch={switchFromPill}
            pill={pill}
          />
        )}
        <View
          style={[
            styles.column,
            sidebar && [styles.card, { marginBottom: Math.max(insets.bottom, tokens.spaceMd) }],
          ]}
        >
          {framed && !ownTop && <FrameHeader {...header} />}
          {ownTop && <FixedTop {...header} />}
          {ownTop && top === 'stays' && <ScreenTop {...header} stays />}
          <OfflineBand stale={standIn == null ? offline : null} inFront={inFront} />
          <View
            style={[
              styles.body,
              floatingTabs && {
                paddingBottom: tabBarFoot(insets.bottom) + PHONE_TAB_BAR + tokens.spaceMd,
              },
            ]}
          >
            {switched != null &&
              (created?.takesFocus === true ? (
                <View style={styles.created}>
                  <Notice
                    tone="done"
                    mark={tokens.marks.done.glyph}
                    body={switched}
                    wordsRef={createdWords}
                  />
                </View>
              ) : (
                <ReadOut style={styles.created} words={switched}>
                  <Notice tone="done" mark={tokens.marks.done.glyph} body={switched} />
                </ReadOut>
              ))}
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
                        organisation={signedIn.organisation}
                        answer={switchAnswer ?? lapsed}
                        headingRef={overdueHeading}
                      />
                    ) : (
                      <FrameSwitch.Provider value={switchAnswer}>
                        <ScrolledTop.Provider value={ownTop && top === 'scrolls' ? header : null}>
                          {children}
                        </ScrolledTop.Provider>
                      </FrameSwitch.Provider>
                    )}
                  </EdgeSwipeStrip.Provider>
                </HideBack.Provider>
              </StartOrganisation.Provider>
            </OpenSwitcher.Provider>
          </View>
          {floatingTabs && <FrameTabBar current={current} organisation={signedIn.organisation} />}
          {framed && kind === 'phone' && inEvent != null && (
            <TabBar entries={entries} inEvent={inEvent} />
          )}
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
  primary: HeaderPrimaryProps | undefined;
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

/** What stays put above a demo's top: upright, the pill, the tabs and the bell; on a phone, the status bar's white. */
function FixedTop({ kind, current, organisation, waiting, onSwitch, pill }: FrameHeaderProps) {
  const insets = useSafeAreaInsets();
  const tabs = useFrameTabs(current, organisation);
  const [rowWidth, setRowWidth] = useState(0);
  const [tabsWidth, setTabsWidth] = useState(0);
  const besideTabs = pillBesideTabs(rowWidth, tabsWidth);

  if (kind === 'phone') return <View style={{ height: insets.top }} />;
  if (kind !== 'tabletPortrait') return null;

  return (
    <View style={[styles.portraitTop, { paddingTop: insets.top + tokens.spaceMd }]}>
      <View
        style={styles.titleRow}
        onLayout={(event) => setRowWidth(event.nativeEvent.layout.width)}
      >
        {organisation != null && (
          <View style={[styles.shrink, besideTabs != null && { maxWidth: besideTabs.maxWidth }]}>
            <OrgPill
              organisation={organisation}
              waiting={waiting}
              onSwitch={onSwitch}
              room={besideTabs?.maxWidth}
              ref={pill}
            />
          </View>
        )}
        <View style={styles.fill} />
        <BellButton />
        <View style={styles.capsuleAt} pointerEvents="box-none">
          <View onLayout={(event) => setTabsWidth(event.nativeEvent.layout.width)}>
            <WhiteCapsule {...tabs} />
          </View>
        </View>
      </View>
    </View>
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
  const titleRow = (
    <View style={[styles.topRow, page && styles.pageRow, rowStyle]}>
      <View style={styles.fill}>
        <Title
          size={page ? PAGE_TITLE : TOP_TITLE}
          accessibilityRole="header"
          ref={read}
          style={page ? pageTitle : topTitle}
        >
          {title}
        </Title>
      </View>
      {besideTitle}
      {primary != null && <TopPrimary {...primary} wide={kind !== 'phone'} />}
      {kind === 'tabletLandscape' && <BellButton />}
    </View>
  );
  const under = underTitle != null && <View style={styles.underTop}>{underTitle}</View>;

  if (kind === 'phone')
    return (
      <View style={[stays && styles.staysPhone, style]}>
        <View style={[styles.titleRow, !page && styles.pillRow]}>
          {page ? (
            <View style={styles.fill}>{backView}</View>
          ) : (
            <>
              {organisation != null && (
                <View style={styles.shrink}>
                  <OrgPill
                    organisation={organisation}
                    waiting={waiting}
                    onSwitch={onSwitch}
                    ref={pill}
                  />
                </View>
              )}
              <View style={styles.fill} />
            </>
          )}
          <BellButton />
        </View>
        {titleRow}
        {under}
      </View>
    );

  return (
    <View
      style={[
        stays && (kind === 'tabletPortrait' ? styles.staysPortrait : styles.staysLandscape),
        style,
      ]}
    >
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
  primary,
  underTitle,
  besideTitle,
  besideBack,
}: FrameHeaderProps) {
  const insets = useSafeAreaInsets();
  const top = kind === 'tabletLandscape' ? undefined : { paddingTop: insets.top + tokens.spaceXxs };
  const { read } = useFocusOnAnswer<TextHandle>(switchAnswer, titleRef);
  const large = useAccessibilitySizes();
  const { width, height } = useLayout();
  const titleSize = frameTitleSize(kind !== 'phone', Math.min(width, height));
  const tabs = useFrameTabs(current, organisation);
  const [rowWidth, setRowWidth] = useState(0);
  const [tabsWidth, setTabsWidth] = useState(0);
  const besideTabs = pillBesideTabs(rowWidth, tabsWidth);

  if (kind === 'tabletLandscape') {
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
        {primary != null && <HeaderPrimary {...primary} round={false} />}
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
  const titleRow = (end: ReactNode) => (
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

  // Out of an event, the pill and the bell head the page with the tabs between them, and the primary sits by the title, as the demos draw it (sc-30410).
  if (kind === 'tabletPortrait' && !inEvent) {
    return (
      <View style={[styles.portraitHeader, top]}>
        <View
          style={styles.titleRow}
          onLayout={(event) => setRowWidth(event.nativeEvent.layout.width)}
        >
          {organisation != null && (
            <View style={[styles.shrink, besideTabs != null && { maxWidth: besideTabs.maxWidth }]}>
              <OrgPill
                organisation={organisation}
                waiting={waiting}
                onSwitch={onSwitch}
                room={besideTabs?.maxWidth}
                ref={pill}
              />
            </View>
          )}
          <View style={styles.fill} />
          <BellButton />
          <View style={styles.capsuleAt} pointerEvents="box-none">
            <View onLayout={(event) => setTabsWidth(event.nativeEvent.layout.width)}>
              <WhiteCapsule {...tabs} />
            </View>
          </View>
        </View>
        {backView}
        {titleRow(primary != null && <HeaderPrimary {...primary} round={false} />)}
      </View>
    );
  }

  if (kind === 'tabletPortrait') {
    return (
      <View style={[styles.portraitHeader, top]}>
        {organisation != null && primary == null && (
          <OrgPill organisation={organisation} waiting={waiting} onSwitch={onSwitch} ref={pill} />
        )}
        {primary != null && (
          <View style={styles.titleRow}>
            {pillView}
            <View style={styles.fill} />
            <HeaderPrimary {...primary} round={false} />
          </View>
        )}
        <Pills entries={entries} scrolls={inEvent} />
        {backView}
        {titleRow(<BellButton />)}
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
        {titleRow(primary != null && <HeaderPrimary {...primary} round />)}
      </View>
    );
  }

  return (
    <View style={[styles.phoneHeader, top]}>
      {pillAlone && organisation != null && (
        <OrgPill organisation={organisation} waiting={waiting} onSwitch={onSwitch} ref={pill} />
      )}
      {primary != null && (
        <View style={styles.titleRow}>
          {pillView}
          <View style={styles.fill} />
          <HeaderPrimary {...primary} round />
        </View>
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

function TabBar({ entries, inEvent }: { entries: readonly NavEntry[]; inEvent: InsideEvent }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const [more, setMore] = useState(false);
  const moreTab = useRef<ViewInstance>(null);
  const underMore = !(PHONE_EVENT_TABS as readonly EventPlace[]).includes(inEvent.area);
  const shown: readonly NavEntry[] = [
    ...entries.filter((entry) => (PHONE_EVENT_TABS as readonly string[]).includes(entry.key)),
    {
      key: 'more',
      label: t('eventNav.more'),
      icon: AREA_ICONS.more,
      on: underMore,
      onPress: () => setMore(true),
      testID: 'event.nav.more',
    },
  ];
  const words = useWholeWords(
    tokens.typeMeta.size,
    tokens.typeMeta.size * fontScale,
    shown.map((entry) => entry.label),
    { weight: 'bold' },
  );

  return (
    <View
      style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, tokens.spaceSm) }]}
      accessibilityRole="tablist"
    >
      {words.measure}
      {shown.map((entry, index) => (
        <Pressable
          key={entry.key}
          ref={entry.key === 'more' ? moreTab : undefined}
          style={styles.tab}
          onPress={entry.onPress}
          onLayout={index === 0 ? (event) => words.room(event.nativeEvent.layout.width) : undefined}
          accessibilityRole="tab"
          accessibilityState={{ selected: entry.on }}
          testID={entry.testID}
        >
          <View style={[styles.tabMark, entry.on && styles.tabMarkOn]} />
          <Icon paths={entry.icon} on={entry.on} size={tokens.space3xl} />
          <Text
            size={tokens.typeMeta.size}
            weight={entry.on ? 'bold' : 'medium'}
            style={[styles.centred, entry.on ? styles.ink : styles.secondaryInk]}
            maxFontSizeMultiplier={words.maxFontSizeMultiplier}
          >
            {entry.label}
          </Text>
        </Pressable>
      ))}
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
    </View>
  );
}

/** The header band's pills in tablet portrait; inside an event they scroll sideways, so no area's name is cut. */
function Pills({ entries, scrolls }: { entries: readonly NavEntry[]; scrolls: boolean }) {
  const pills = entries.map((entry) => (
    <Pressable
      key={entry.key}
      style={[styles.pill, entry.on && styles.pillOn]}
      onPress={entry.onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: entry.on }}
      testID={entry.testID}
    >
      <Icon paths={entry.icon} on={entry.on} size={tokens.sizeMark} />
      <Text
        size={tokens.typeBody.size}
        weight={entry.on ? 'semibold' : 'medium'}
        style={entry.on ? styles.ink : styles.secondaryInk}
      >
        {entry.label}
      </Text>
    </Pressable>
  ));

  return scrolls ? (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
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
  organisation,
  waiting,
  onSwitch,
  pill,
}: {
  current: Destination;
  entries: readonly NavEntry[];
  inEvent: boolean;
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
            label={t('todayScreen.tab.events')}
            heard={t('eventsScreen.backToEvents')}
            onPress={() => goTo('events')}
            testID="frame.side.back"
          />
        )}
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
  ref,
}: {
  organisation: Membership;
  waiting: number;
  onSwitch: (() => void) | undefined;
  sidebar?: boolean;
  /** The room beside an upright tablet's tabs, where the pill turns to its tile when its words would not fit whole. */
  room?: number | undefined;
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
      tileAlone={tileAlone}
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

function Icon({ paths, on, size }: { paths: IconPaths; on: boolean; size: number }) {
  const stroke = on ? tokens.colorInk : tokens.colorInkSecondary;

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
  centred: { textAlign: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm },
  portraitTop: { paddingHorizontal: tokens.space3xl, paddingBottom: tokens.spaceXxs },
  pillRow: { marginBottom: tokens.spaceSm },
  topRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: tokens.spaceMd },
  pageRow: { minHeight: 0, paddingTop: 14 },
  underTop: { marginTop: tokens.spaceHair },
  staysPhone: { paddingTop: tokens.spaceXxs, paddingHorizontal: tokens.spaceXxl },
  staysPortrait: { paddingTop: 26, paddingHorizontal: tokens.space5xl },
  staysLandscape: { paddingTop: 26, paddingHorizontal: 30 },
  phoneHeader: {
    gap: tokens.spaceLg,
    paddingHorizontal: tokens.spaceXxl,
    paddingBottom: tokens.spaceXl,
  },
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
  chrome: { flexDirection: 'row', backgroundColor: tokens.colorNeutralFill },
  card: {
    marginRight: tokens.spaceMd,
    borderRadius: tokens.space3xl,
    backgroundColor: tokens.colorCard,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
    overflow: 'hidden',
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
  tabBar: {
    flexDirection: 'row',
    paddingTop: tokens.spaceXs,
    paddingHorizontal: tokens.spaceSm,
    backgroundColor: tokens.colorCard,
    borderTopWidth: 1,
    borderTopColor: tokens.colorBorder,
  },
  tab: {
    flex: 1,
    minHeight: tokens.sizeHit,
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spaceXxs,
  },
  tabMark: {
    width: tokens.space4xl,
    height: 3,
    borderRadius: tokens.spaceHair,
    marginBottom: tokens.spaceHair,
  },
  tabMarkOn: { backgroundColor: tokens.colorInk },
  moreSheet: { gap: tokens.spaceLg, padding: tokens.space3xl },
  // The rows keep their own 12 pt padding, so their icons start on the title's line.
  moreList: { gap: tokens.spaceHair, marginHorizontal: -tokens.spaceLg },
  pillsInEvent: { flexDirection: 'row', gap: tokens.spaceHair },
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
  capsuleAt: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  created: { paddingTop: tokens.spaceLg, paddingHorizontal: tokens.spaceXl },
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
