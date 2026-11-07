import { type Membership, primaryEmailAddress } from '@soirely/api-client';
import {
  EVENT_AREAS,
  type EventArea,
  MORE_EVENT_AREAS,
  PHONE_EVENT_TABS,
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
  StyleSheet,
  useWindowDimensions,
  View,
  type ViewInstance,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import { usePushTaps } from '../appPush.ts';
import { type WaitingInvitations, useWaitingInvitations } from '../invitations.ts';
import { type DomainOffer, useDomainOffer } from '../joinOffers.ts';
import {
  DESTINATION_HREF,
  type Destination,
  HOME_TAPPED,
  SECTION_HREF,
  destinations,
} from '../kit/appNav.ts';
import { backRowHiding } from '../kit/backRow.ts';
import { phonePillAlone } from '../kit/frameBand.ts';
import { EDGE_SWIPE_WIDTH, headerDrawsBack, stackSwipes } from '../kit/systemBack.ts';
import { leaveThen } from '../leaveHeld.ts';
import { backLabelSize, frameTitleSize } from '../layout/textSize.ts';
import {
  type LayoutKind,
  useAccessibilitySizes,
  useLayout,
  useNameLines,
} from '../layout/useLayout.ts';
import { joinOrganisation, onMovedOn, switchOrganisation, useSignedIn } from '../signedIn.ts';
import { FrameSwitch, switchByTap, useFrameSwitch } from '../tappedSwitch.ts';
import { switcherFocusBack } from '../kit/focusBack.ts';
import { tokens } from '../theme/tokens.ts';
import { useTwoFactorStanding } from '../twoFactorStanding.ts';
import { BellButton } from './BellButton.tsx';
import { CreateOrganisation } from './CreateOrganisation.tsx';
import {
  HeaderPrimary,
  type HeaderPrimaryProps,
  PrimaryButton,
  SecondaryButton,
} from './Buttons.tsx';
import { Sheet } from './Sheet.tsx';
import { InvitationRows } from './InvitationRows.tsx';
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
import { OrgTile } from './OrgTile.tsx';
import {
  SidebarBack,
  SidebarColumn,
  SidebarFoot,
  SidebarHead,
  SidebarPlace,
  SidebarPlaces,
} from './TodaySidebar.tsx';
import { type TodayShell, TodayShellProvider } from './todayShell.ts';
import { AREA_GLYPH } from './areaGlyph.ts';
import { ReadOut, useReadOut } from './ReadOut.tsx';
import { type StepClosed, stepClosed, useFocusBackToOpener, useFocusOnAnswer } from './Screen.tsx';
import type { ScreenReaderTarget } from './screenReaderFocus.ts';
import { type TextHandle, Text } from './Text.tsx';
import { Title, useWholeWords } from './Title.tsx';
import { AccessPaused } from './AccessPaused.tsx';
import { TwoFactorOverdue } from './TwoFactorOverdue.tsx';
import { type EdgeSwipeHandlers, EdgeSwipeStrip } from './useEdgeSwipeBack.ts';
import { useSystemBack } from './useSystemBack.ts';
import { OfflineBand } from './OfflineBand.tsx';
import { type Stale } from '../offline.ts';

type Opening = (opener: RefObject<ViewInstance | null>) => void;

const OpenSwitcher = createContext<Opening | undefined>(undefined);

/** Opens the frame's organisation switcher; undefined while there is no organisation and no invitation. */
export function useOpenSwitcher(): Opening | undefined {
  return useContext(OpenSwitcher);
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

const ICONS: Record<Destination, IconPaths> = {
  home: ['M3 10.5 12 3l9 7.5', 'M5 9.5V21h14V9.5M10 21v-6h4v6'],
  events: [
    'M2 9a3 3 0 0 0 0 6v3a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-3a3 3 0 0 0 0-6V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z',
    'M13 5v2M13 17v2M13 11v2',
  ],
  calendar: [
    'M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
    'M3 10h18M8 2v4M16 2v4',
  ],
  settings: [
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
  ],
};

const AREA_ICONS: Record<EventArea | 'more', IconPaths> = {
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
  budget: [
    'M21 12V7H5a2 2 0 0 1 0-4h14v4',
    'M3 5v14a2 2 0 0 0 2 2h16v-5M18 12a2 2 0 0 0 0 4h4v-4z',
  ],
  reports: ['M3 3v18h18', 'M8 17v-5M13 17V8M18 17v-9'],
  more: ['M5 12h.01M12 12h.01', 'M19 12h.01'],
};

/** Inside an event the navigation is the event's areas, in each layout's own form (sc-22103, #24878). */
export interface InsideEvent {
  area: EventArea;
  onArea: (area: EventArea) => void;
}

interface NavEntry {
  key: string;
  label: string;
  icon: IconPaths;
  on: boolean;
  onPress: () => void;
  testID: string;
}

function areaEntry(t: (key: string) => string, inside: InsideEvent, area: EventArea): NavEntry {
  return {
    key: area,
    label: t(`eventNav.${area}`),
    icon: AREA_ICONS[area],
    on: area === inside.area,
    onPress: () => inside.onArea(area),
    testID: `event.nav.${area}`,
  };
}

function destinationEntry(
  t: (key: string) => string,
  current: Destination,
  destination: Destination,
): NavEntry {
  return {
    key: destination,
    label: t(`frame.${destination}`),
    icon: ICONS[destination],
    on: destination === current,
    onPress: () => goTo(destination),
    testID: `frame.${destination}`,
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
  offline = null,
  children,
}: {
  current: Destination;
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
  back?: { label: string; onPress: () => void; systemBack?: boolean; off?: boolean } | undefined;
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
  const [creatingFrom, setCreatingFrom] = useState<RefObject<ViewInstance | null> | null>(null);
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
  const entries =
    inEvent == null
      ? destinations(signedIn.organisation).map((d) => destinationEntry(t, current, d))
      : EVENT_AREAS.map((area) => areaEntry(t, inEvent, area));
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
  // It opens with one organisation too, because it ends with "Create an organisation" (sc-390).
  const openSwitcher =
    signedIn.organisation != null || waiting.invitations.length > 0 || offer.organisation != null
      ? (opener: RefObject<ViewInstance | null>) => {
          setSwitcherOpenedOnOverdue(overdueOn);
          setCreated(null);
          setSwitcherFrom(opener);
          setToSheet(false);
          setChoosing(true);
        }
      : undefined;
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
    setCreatingFrom(opener);
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

  return (
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
        {framed && (
          <FrameHeader
            current={current}
            kind={kind}
            entries={entries}
            inEvent={inEvent != null}
            title={title}
            titleRef={frameTitle}
            switchAnswer={bodyTakesSwitch || standIn != null ? undefined : switchAnswer}
            back={headerDrawsBack(kind, back, backInBody)}
            backHidden={backHidden}
            organisation={signedIn.organisation}
            waiting={count}
            onSwitch={switchFromPill}
            pill={pill}
            pillAlone={phonePillAlone(current === 'home', primary != null, standIn != null)}
            primary={standIn == null ? primary : undefined}
            underTitle={standIn == null ? underTitle : undefined}
            besideTitle={standIn == null ? besideTitle : undefined}
            besideBack={standIn == null || besideBack === undefined ? besideBack : null}
          />
        )}
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
                    <FrameSwitch.Provider value={switchAnswer}>{children}</FrameSwitch.Provider>
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
      <Switcher
        open={choosing}
        organisations={signedIn.organisations}
        current={signedIn.pausedIn != null ? null : signedIn.organisation}
        waiting={waiting}
        offer={offer}
        email={email}
        opener={switcherOpener}
        onClose={() => setChoosing(false)}
        onCreate={() => {
          setToSheet(true);
          setChoosing(false);
          startOrganisation(switcherFrom ?? pill);
        }}
      />
      <CreateOrganisation
        open={creating}
        email={email}
        opener={creatingFrom ?? pill}
        onCancel={() => setCreating(false)}
        onCreated={(organisation) => {
          // In no organisation, what opened the sheet goes with it, so the sheet hands focus to the notice (sc-11173).
          const fromNone = signedIn.organisation == null;
          if (fromNone) setCreatingFrom(createdWords);
          setCreating(false);
          joinOrganisation(organisation);
          switchOrganisation(organisation.id);
          setCreated({ name: organisation.name, takesFocus: fromNone });
        }}
      />
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
}: {
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
  back: { label: string; onPress: () => void; off?: boolean } | undefined;
  backHidden: boolean;
  organisation: Membership | null;
  waiting: number;
  onSwitch: (() => void) | undefined;
  pill: Ref<ViewInstance>;
}) {
  const insets = useSafeAreaInsets();
  const top = kind === 'tabletLandscape' ? undefined : { paddingTop: insets.top + tokens.spaceXxs };
  const { read } = useFocusOnAnswer<TextHandle>(switchAnswer, titleRef);
  const large = useAccessibilitySizes();
  const { width, height } = useLayout();
  const titleSize = frameTitleSize(kind !== 'phone', Math.min(width, height));
  const tabs = useFrameTabs(current, organisation);

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
  const backView = back != null && !backHidden && (
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
      <View style={[styles.header, styles.portraitHeader, top]}>
        <View style={styles.titleRow}>
          {pillView}
          <View style={styles.fill} />
          <BellButton />
          <View style={styles.capsuleAt} pointerEvents="box-none">
            <WhiteCapsule {...tabs} />
          </View>
        </View>
        {backView}
        {titleRow(primary != null && <HeaderPrimary {...primary} round={false} />)}
      </View>
    );
  }

  if (kind === 'tabletPortrait') {
    return (
      <View style={[styles.header, styles.portraitHeader, top]}>
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
      <View style={[styles.header, styles.phoneHeader, top]}>
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
    <View style={[styles.header, styles.phoneHeader, top]}>
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
      <Svg width={tokens.sizeMark} height={tokens.sizeMark} viewBox="0 0 24 24" fill="none">
        <Path
          d="m15 18-6-6 6-6"
          {...STROKE}
          stroke={off ? tokens.colorInkSecondary : tokens.colorInk}
        />
      </Svg>
      <Text
        size={tokens.typeBodyPhone.size}
        weight="semibold"
        muted={off}
        maxFontSizeMultiplier={backLabelSize(fontScale) / tokens.typeBodyPhone.size}
      >
        {label}
      </Text>
    </Pressable>
  );

  if (beside === undefined) return button;

  return (
    <View style={besideRow.row}>
      {button}
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
  const underMore = !(PHONE_EVENT_TABS as readonly EventArea[]).includes(inEvent.area);
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
            {MORE_EVENT_AREAS.map((area) => {
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
  const tabs = useFrameTabs(current, organisation);
  const name = account?.name ?? '';
  const role = organisation == null ? null : roleName(t, organisation.role);
  const person = useMemo(() => ({ name, role }), [name, role]);
  const shell = useMemo<TodayShell>(
    () => ({
      organisation: organisation?.name ?? '',
      person,
      unread: 0,
      search: false,
      open: (opens) => {
        if (opens.to === 'account') router.navigate(SECTION_HREF.account);
        if (opens.to === 'organisation') onSwitch?.();
      },
    }),
    [organisation?.name, person, onSwitch],
  );
  const places = inEvent
    ? entries.map((entry) => (
        <SidebarPlace
          key={entry.key}
          label={entry.label}
          glyph={AREA_GLYPH[entry.key as EventArea]}
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
        <View style={styles.fill} />
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
  ref,
}: {
  organisation: Membership;
  waiting: number;
  onSwitch: (() => void) | undefined;
  sidebar?: boolean;
  ref: Ref<ViewInstance>;
}) {
  const { t } = useTranslation();
  const large = useAccessibilitySizes();
  const lines = useNameLines();
  const role = roleName(t, organisation.role);
  const label =
    onSwitch == null
      ? t('switcher.label', { name: organisation.name, role })
      : waiting > 0
        ? t('switcher.labelSwitchWaiting', { name: organisation.name, role, count: waiting })
        : t('switcher.labelSwitch', { name: organisation.name, role });
  const pill = (
    <WhitePill
      ref={ref}
      id={organisation.id}
      name={organisation.name}
      waiting={waiting > 0 ? t('invitations.count', { count: waiting }) : null}
      label={label}
      onPress={onSwitch}
      bare={large}
      wrap={large}
      lines={lines}
      sidebar={sidebar}
      testID="frame.organisation"
    />
  );

  return sidebar ? pill : <View style={styles.whitePill}>{pill}</View>;
}

function Switcher({
  open,
  organisations,
  current,
  waiting,
  offer,
  email,
  opener,
  onClose,
  onCreate,
}: {
  open: boolean;
  organisations: readonly Membership[];
  current: Membership | null;
  waiting: WaitingInvitations;
  offer: DomainOffer;
  email: string;
  /** Where screen reader focus goes back to once the switcher has gone. */
  opener: RefObject<ScreenReaderTarget | null>;
  onClose: () => void;
  onCreate: () => void;
}) {
  const { t } = useTranslation();
  const large = useAccessibilitySizes();
  const lines = useNameLines();
  const invitationsHeading = useRef<TextHandle>(null);
  const remembered = useRef<TextHandle>(null);
  const [offerClosed, setOfferClosed] = useState<StepClosed | undefined>(undefined);
  const afterOffer = useMemo<RefObject<ScreenReaderTarget | null>>(
    () => ({
      get current() {
        return invitationsHeading.current ?? remembered.current;
      },
    }),
    [],
  );
  useFocusBackToOpener(offerClosed, afterOffer);

  return (
    <Sheet open={open} onClose={onClose} scrimLabel={t('switcher.close')} opener={opener}>
      <ScrollView contentContainerStyle={styles.sheet}>
        <Title
          size={tokens.typeTitleDialog.size}
          accessibilityRole="header"
          testID="switcher.heading"
        >
          {t('switcher.heading')}
        </Title>
        {organisations.map((organisation) => {
          const isCurrent = organisation.id === current?.id;

          return (
            <Pressable
              key={organisation.id}
              style={[styles.option, isCurrent && styles.optionOn]}
              onPress={() => {
                onClose();
                if (!isCurrent) switchOrganisation(organisation.id);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: isCurrent }}
              testID={`switcher.${organisation.id}`}
            >
              {!large && <OrgTile name={organisation.name} />}
              <View style={[styles.fill, styles.shrink]}>
                <Text
                  size={tokens.typeBodyPhone.size}
                  weight={isCurrent ? 'semibold' : 'medium'}
                  numberOfLines={lines}
                >
                  {organisation.name}
                </Text>
                <Text size={tokens.typeBody.size} muted numberOfLines={large ? 0 : 1}>
                  {t('switcher.yourRole', { role: roleName(t, organisation.role) })}
                </Text>
                {isCurrent && large && <Current />}
              </View>
              {isCurrent && !large && <Current />}
            </Pressable>
          );
        })}
        {offer.organisation != null && (
          <OfferCard
            offer={offer}
            email={email}
            onDismissed={() => setOfferClosed(stepClosed('afterOffer'))}
          />
        )}
        {waiting.invitations.length > 0 && (
          <View style={styles.invitations}>
            <Text
              ref={invitationsHeading}
              size={tokens.typeLabel.size}
              weight="semibold"
              muted
              accessibilityRole="header"
            >
              {t('invitations.heading')}
            </Text>
            <InvitationRows
              waiting={waiting}
              after={{
                open: (id) => {
                  onClose();
                  switchOrganisation(id);
                },
              }}
            />
          </View>
        )}
        <Text ref={remembered} size={tokens.typeBody.size} muted>
          {t('switcher.remembered')}
        </Text>
        {current != null && (
          <Pressable
            style={[styles.option, styles.create]}
            onPress={onCreate}
            accessibilityRole="button"
            testID="switcher.create"
          >
            <View style={[styles.tile, styles.createTile]}>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path d="M12 5v14M5 12h14" {...STROKE} stroke={tokens.colorAccentText} />
              </Svg>
            </View>
            <Text size={tokens.typeBodyPhone.size} weight="semibold" style={styles.accent}>
              {t('createOrganisation.row')}
            </Text>
          </Pressable>
        )}
      </ScrollView>
    </Sheet>
  );
}

function Current() {
  const { t } = useTranslation();

  return (
    <Text size={tokens.typeBody.size} weight="semibold" style={styles.accent}>
      {t('switcher.current')}
    </Text>
  );
}

/** An organisation at the domain of the primary address: Ask to join, or Not now for good. */
function OfferCard({
  offer,
  email,
  onDismissed,
}: {
  offer: DomainOffer;
  email: string;
  /** Not now was tapped, so focus goes to the item after the card (sc-11173). */
  onDismissed: () => void;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  // Ask to join's answer takes its buttons' place, so it takes focus in place of being read out (sc-11173).
  const [askedByTap, setAskedByTap] = useState<object | undefined>(undefined);
  const { read: askedWords } = useFocusOnAnswer(offer.asked ? askedByTap : undefined);
  const unavailable = t('domainJoining.unavailable');
  useReadOut(failed ? unavailable : null);
  const waiting = t('domainJoining.waiting');
  const asked = t('domainJoining.switcherAsked', { email });
  useReadOut(offer.asked && askedByTap == null ? `${waiting}\n${asked}` : null, {
    quietAtMount: true,
  });

  async function ask(): Promise<void> {
    setBusy(true);
    setFailed(false);
    setAskedByTap({});

    try {
      await offer.ask();
    } catch {
      setAskedByTap(undefined);
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.offer}>
      <Text size={tokens.typeRowTitle.size} weight="semibold" accessibilityRole="header">
        {t('domainJoining.usesSoirely', { organisation: offer.organisation?.name ?? '' })}
      </Text>
      <Text size={tokens.typeBody.size} muted>
        {t('domainJoining.switcherBody', { domain: offer.domain ?? '' })}
      </Text>
      {offer.asked ? (
        <View style={styles.offerAsked}>
          <View style={styles.offerRing} />
          <View ref={askedWords} style={styles.offerAskedWords} accessible>
            <Text size={tokens.typeBody.size} weight="semibold">
              {waiting}
            </Text>
            <Text size={tokens.typeBody.size}>{`· ${asked}`}</Text>
          </View>
        </View>
      ) : (
        <>
          {failed && (
            <Text size={tokens.typeBody.size} style={styles.broken} accessibilityRole="alert">
              {unavailable}
            </Text>
          )}
          <View style={styles.offerButtons}>
            <PrimaryButton
              label={t('domainJoining.ask')}
              busy={busy}
              onPress={() => void ask()}
              testID="switcher.offer.ask"
            />
            <SecondaryButton
              label={t('domainJoining.notNow')}
              off={busy}
              onPress={() => {
                void offer.dismiss();
                onDismissed();
              }}
              testID="switcher.offer.notNow"
            />
          </View>
        </>
      )}
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
  accent: { color: tokens.colorAccentText },
  centred: { textAlign: 'center' },
  broken: { color: tokens.colorBrokenText },
  offer: {
    gap: tokens.spaceSm,
    padding: tokens.spaceXl,
    borderRadius: tokens.radiusInset,
    borderWidth: 1,
    borderColor: tokens.colorInsetBorder,
    backgroundColor: tokens.colorInset,
  },
  offerButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spaceSm },
  offerAsked: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm },
  offerAskedWords: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    flexShrink: 1,
    minWidth: 0,
    columnGap: tokens.spaceXxs,
  },
  offerRing: {
    width: tokens.spaceMd,
    height: tokens.spaceMd,
    borderRadius: tokens.spaceMd / 2,
    borderWidth: 2,
    borderColor: tokens.colorAttention,
  },
  header: {
    backgroundColor: tokens.colorHeader,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colorHeaderBorder,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm },
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
  tile: {
    width: tokens.space5xl,
    height: tokens.space5xl,
    borderRadius: tokens.radiusSmall,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorAccentTint,
  },
  sheet: {
    gap: tokens.spaceLg,
    padding: tokens.spaceXxl,
  },
  invitations: { gap: tokens.spaceSm },
  option: {
    minHeight: tokens.sizeListRow,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceLg,
    padding: tokens.spaceMd,
    borderRadius: tokens.radiusRow,
  },
  optionOn: { backgroundColor: tokens.colorRowSelected },
  create: { borderTopWidth: 1, borderTopColor: tokens.colorInsetBorder, borderRadius: 0 },
  createTile: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: tokens.colorAccentTintBorder,
    backgroundColor: tokens.colorCard,
  },
  created: { paddingTop: tokens.spaceLg, paddingHorizontal: tokens.spaceXl },
});
