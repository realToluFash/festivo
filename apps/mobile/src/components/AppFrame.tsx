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
  Modal,
  Platform,
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
import { DESTINATION_HREF, type Destination, destinations } from '../kit/appNav.ts';
import { backRowHiding } from '../kit/backRow.ts';
import { EDGE_SWIPE_WIDTH, headerDrawsBack, stackSwipes } from '../kit/systemBack.ts';
import { leaveThen } from '../leaveHeld.ts';
import { TURNS_WITH_THE_APP } from '../layout/orientations.ts';
import { backLabelSize, railWidth } from '../layout/textSize.ts';
import {
  type LayoutKind,
  useAccessibilitySizes,
  useLayout,
  useNameLines,
} from '../layout/useLayout.ts';
import { joinOrganisation, switchOrganisation, useSignedIn } from '../signedIn.ts';
import { FrameSwitch, switchByTap, useFrameSwitch } from '../tappedSwitch.ts';
import { tokens } from '../theme/tokens.ts';
import { useTwoFactorStanding } from '../twoFactorStanding.ts';
import { useModalOpen } from '../updateRequired.ts';
import { BellButton } from './BellButton.tsx';
import { Brand } from './Brand.tsx';
import { CreateOrganisation } from './CreateOrganisation.tsx';
import {
  HeaderPrimary,
  type HeaderPrimaryProps,
  PrimaryButton,
  SecondaryButton,
} from './Buttons.tsx';
import { Sheet, useFocusBack, useWindowTurn } from './Sheet.tsx';
import { InvitationRows } from './InvitationRows.tsx';
import { Initials } from './Initials.tsx';
import { Notice } from './Notice.tsx';
import { OrgTile } from './OrgTile.tsx';
import { ReadOut, useReadOut } from './ReadOut.tsx';
import { type StepClosed, stepClosed, useFocusBackToOpener, useFocusOnAnswer } from './Screen.tsx';
import type { ScreenReaderTarget } from './screenReaderFocus.ts';
import { type TextHandle, Text } from './Text.tsx';
import { Title, useWholeWords } from './Title.tsx';
import { AccessPaused } from './AccessPaused.tsx';
import { TwoFactorOverdue } from './TwoFactorOverdue.tsx';
import { type EdgeSwipeHandlers, EdgeSwipeStrip } from './useEdgeSwipeBack.ts';
import { useSystemBack } from './useSystemBack.ts';

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
  inEvent,
  primary,
  underTitle,
  children,
}: {
  current: Destination;
  /** The screen's one primary, in the header band where [fd] puts it (sc-22103). */
  primary?: HeaderPrimaryProps | undefined;
  /** A line under the title, in the header band, as Events' summary. */
  underTitle?: ReactNode;
  /** Inside an event, its areas take the navigation's place. */
  inEvent?: InsideEvent | undefined;
  title: string;
  /** The title on a phone, where it stands for the page's own heading. */
  titleRef?: RefObject<TextHandle | null> | undefined;
  /** Security and Account stay open past an organisation's two-factor deadline, to set it up (sc-609). */
  aboutTheAccount?: boolean;
  /** A heading in the body takes screen reader focus after a tapped switch of organisation, in place of the title (sc-11032). */
  bodyTakesSwitch?: boolean;
  /** The page this one was opened from, drawn in the header where `headerDrawsBack` says, as Security's "Settings"; with `systemBack`, Android's Back runs it too. */
  back?: { label: string; onPress: () => void; systemBack?: boolean; off?: boolean } | undefined;
  /** On a tablet, the body draws this page's back, and is false while that back is off. */
  backInBody?: boolean;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const { kind } = useLayout();
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
  // It opens with one organisation too, because it ends with "Create an organisation" (sc-390).
  const openSwitcher =
    signedIn.organisation != null || waiting.invitations.length > 0 || offer.organisation != null
      ? (opener: RefObject<ViewInstance | null>) => {
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

        return switcherFrom?.current ?? pill.current ?? frameTitle.current;
      },
    }),
    [toSheet, switcherFrom, frameTitle],
  );
  const startOrganisation = (opener: RefObject<ViewInstance | null>) => {
    setCreated(null);
    setCreatingFrom(opener);
    setCreating(true);
  };
  const email = signedIn.account == null ? '' : (primaryEmailAddress(signedIn.account) ?? '');
  const overdue = useTwoFactorStanding(signedIn.organisation) === 'overdue';
  // The deadline passing with the screen open replaces it under a new heading, which takes focus (sc-11173).
  const [standingSeen, setStandingSeen] = useState({ id: signedIn.organisation?.id, overdue });
  const [lapsed, setLapsed] = useState<object | undefined>(undefined);
  if (standingSeen.id !== signedIn.organisation?.id || standingSeen.overdue !== overdue) {
    setStandingSeen({ id: signedIn.organisation?.id, overdue });
    setLapsed(standingSeen.id === signedIn.organisation?.id && overdue ? {} : undefined);
  }
  const switchAnswer = useFrameSwitch();
  const standIn = aboutTheAccount
    ? null
    : signedIn.pausedIn != null
      ? 'paused'
      : overdue && signedIn.organisation != null
        ? 'overdue'
        : null;

  return (
    <View
      style={[styles.root, kind === 'tabletLandscape' && styles.row]}
      importantForAccessibility={inFront ? 'auto' : 'no-hide-descendants'}
    >
      {kind === 'tabletLandscape' && (
        <Rail
          entries={entries}
          inEvent={inEvent != null}
          organisation={signedIn.organisation}
          waiting={count}
          onSwitch={switchFromPill}
          pill={pill}
        />
      )}
      <View style={styles.column}>
        <FrameHeader
          kind={kind}
          current={current}
          entries={entries}
          inEvent={inEvent != null}
          title={title}
          titleRef={frameTitle}
          switchAnswer={bodyTakesSwitch || standIn != null ? undefined : switchAnswer}
          back={headerDrawsBack(kind, back, backInBody)}
          backHidden={backHidden}
          email={email}
          organisation={signedIn.organisation}
          waiting={count}
          onSwitch={switchFromPill}
          pill={pill}
          primary={primary}
          underTitle={underTitle}
        />
        <View style={styles.body}>
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
                    />
                  ) : (
                    <FrameSwitch.Provider value={switchAnswer}>{children}</FrameSwitch.Provider>
                  )}
                </EdgeSwipeStrip.Provider>
              </HideBack.Provider>
            </StartOrganisation.Provider>
          </OpenSwitcher.Provider>
        </View>
        {kind === 'phone' && <TabBar entries={entries} inEvent={inEvent} />}
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
  kind,
  current,
  entries,
  inEvent,
  title,
  titleRef,
  switchAnswer,
  back,
  backHidden,
  email,
  organisation,
  waiting,
  onSwitch,
  pill,
  primary,
  underTitle,
}: {
  kind: LayoutKind;
  current: Destination;
  primary: HeaderPrimaryProps | undefined;
  underTitle: ReactNode;
  entries: readonly NavEntry[];
  inEvent: boolean;
  title: string;
  titleRef: RefObject<TextHandle | null> | undefined;
  /** A tapped switch of organisation, which takes screen reader focus to the title. */
  switchAnswer: unknown;
  back: { label: string; onPress: () => void; off?: boolean } | undefined;
  backHidden: boolean;
  email: string;
  organisation: Membership | null;
  waiting: number;
  onSwitch: (() => void) | undefined;
  pill: Ref<ViewInstance>;
}) {
  const insets = useSafeAreaInsets();
  const top = { paddingTop: insets.top + (kind === 'tabletLandscape' ? 0 : tokens.spaceXxs) };
  const { read } = useFocusOnAnswer<TextHandle>(switchAnswer, titleRef);
  const large = useAccessibilitySizes();

  if (kind === 'tabletLandscape') {
    return (
      <View style={[styles.header, styles.landscapeHeader, large && styles.stacked, top]}>
        <View style={styles.titled}>
          <Title size={tokens.typeTitlePhone.size} accessibilityRole="header" ref={read}>
            {title}
          </Title>
          {underTitle}
        </View>
        {!large && <View style={styles.fill} />}
        {primary != null && <HeaderPrimary {...primary} round={false} />}
        <Text size={tokens.typeBody.size} muted>
          {email}
        </Text>
        <BellButton />
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
            {organisation != null && (
              <OrgPill
                organisation={organisation}
                waiting={waiting}
                onSwitch={onSwitch}
                ref={pill}
              />
            )}
            <View style={styles.fill} />
            <HeaderPrimary {...primary} round={false} />
          </View>
        )}
        <Pills entries={entries} scrolls={inEvent} />
        {back != null && !backHidden && (
          <BackButton
            label={back.label}
            onPress={back.onPress}
            off={back.off}
            testID="frame.back"
          />
        )}
        <View style={styles.titleRow}>
          <View style={styles.fill}>
            <Title size={tokens.typeTitlePage.size} accessibilityRole="header" ref={read}>
              {title}
            </Title>
            {underTitle}
          </View>
          <BellButton />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.header, styles.phoneHeader, top]}>
      {current === 'home' && organisation != null && primary == null && (
        <OrgPill organisation={organisation} waiting={waiting} onSwitch={onSwitch} ref={pill} />
      )}
      {primary != null && (
        <View style={styles.titleRow}>
          {organisation != null && (
            <OrgPill organisation={organisation} waiting={waiting} onSwitch={onSwitch} ref={pill} />
          )}
          <View style={styles.fill} />
          <HeaderPrimary {...primary} round />
        </View>
      )}
      {back != null && !backHidden && (
        <BackButton label={back.label} onPress={back.onPress} off={back.off} testID="frame.back" />
      )}
      <View style={styles.titleRow}>
        <View style={styles.fill}>
          <Title
            size={back == null ? tokens.typeTitlePage.size : tokens.typeTitlePhone.size}
            accessibilityRole="header"
            ref={read}
          >
            {title}
          </Title>
          {underTitle}
        </View>
        <BellButton />
      </View>
    </View>
  );
}

export function BackButton({
  label,
  heard,
  onPress,
  off = false,
  testID,
}: {
  label: string;
  heard?: string;
  onPress: () => void;
  off?: boolean | undefined;
  testID: string;
}) {
  const { fontScale } = useWindowDimensions();

  return (
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
}

function goTo(destination: Destination): void {
  const href = DESTINATION_HREF[destination];
  leaveThen((discarding) => (discarding ? router.dismissTo(href) : router.navigate(href)));
}

function TabBar({
  entries,
  inEvent,
}: {
  entries: readonly NavEntry[];
  inEvent: InsideEvent | undefined;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const [more, setMore] = useState(false);
  const moreTab = useRef<ViewInstance>(null);
  const underMore =
    inEvent != null && !(PHONE_EVENT_TABS as readonly EventArea[]).includes(inEvent.area);
  const shown: readonly NavEntry[] =
    inEvent == null
      ? entries
      : [
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
      {inEvent != null && (
        <Sheet
          open={more}
          onClose={() => setMore(false)}
          scrimLabel={t('eventNav.closeMore')}
          opener={moreTab}
          testID="event.nav.moreSheet"
        >
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
        </Sheet>
      )}
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

function Rail({
  entries,
  inEvent,
  organisation,
  waiting,
  onSwitch,
  pill,
}: {
  entries: readonly NavEntry[];
  inEvent: boolean;
  organisation: Membership | null;
  waiting: number;
  onSwitch: (() => void) | undefined;
  pill: Ref<ViewInstance>;
}) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { account } = useSignedIn();
  const { fontScale } = useWindowDimensions();
  const large = useAccessibilitySizes();
  const lines = useNameLines();
  const item = (entry: NavEntry) => (
    <Pressable
      key={entry.key}
      style={[styles.railItem, entry.on && styles.railItemOn]}
      onPress={entry.onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: entry.on }}
      testID={entry.testID}
    >
      <Icon paths={entry.icon} on={entry.on} size={tokens.sizeMark} />
      <Text
        size={tokens.typeBodyPhone.size}
        weight={entry.on ? 'semibold' : 'medium'}
        style={entry.on ? styles.ink : styles.secondaryInk}
      >
        {entry.label}
      </Text>
    </Pressable>
  );
  const settings = entries.find((entry) => entry.key === 'settings');
  const group = entries.filter((entry) => entry.key !== 'settings').map(item);

  return (
    <View
      style={[
        styles.rail,
        {
          width: railWidth(fontScale),
          paddingTop: insets.top + tokens.spaceSm,
          paddingBottom: insets.bottom + tokens.space3xl,
          paddingLeft: insets.left + tokens.spaceMd,
        },
      ]}
    >
      <View style={styles.brand}>
        <Brand width={RAIL_BRAND_WIDTH} />
      </View>
      {organisation != null && (
        <OrgPill
          organisation={organisation}
          waiting={waiting}
          onSwitch={onSwitch}
          railed
          ref={pill}
        />
      )}
      {inEvent ? (
        <ScrollView style={styles.fill} contentContainerStyle={styles.railGroup}>
          {group}
        </ScrollView>
      ) : (
        <>
          <View style={styles.railGroup}>{group}</View>
          <View style={styles.fill} />
        </>
      )}
      <View style={[styles.railGroup, styles.railFoot]}>
        {settings != null && item(settings)}
        {account != null && (
          <View style={styles.person}>
            {!large && (
              <View
                style={styles.avatar}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              >
                <Initials name={account.name} size={tokens.typeMeta.size} weight="semibold" />
              </View>
            )}
            <View style={styles.shrink}>
              <Text size={tokens.typeBody.size} weight="semibold" numberOfLines={lines}>
                {account.name}
              </Text>
              {organisation != null && (
                <Text size={tokens.typeMeta.size} muted numberOfLines={large ? 0 : 1}>
                  {roleName(t, organisation.role)}
                </Text>
              )}
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

function OrgPill({
  organisation,
  waiting,
  onSwitch,
  railed = false,
  ref,
}: {
  organisation: Membership;
  waiting: number;
  onSwitch: (() => void) | undefined;
  railed?: boolean;
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

  return (
    <Pressable
      ref={ref}
      style={[
        styles.org,
        railed ? styles.orgRailed : styles.orgPill,
        (waiting > 0 || large) && styles.orgWaiting,
      ]}
      onPress={onSwitch}
      disabled={onSwitch == null}
      accessibilityRole={onSwitch == null ? 'text' : 'button'}
      accessibilityLabel={label}
      testID="frame.organisation"
    >
      {!large && <OrgTile name={organisation.name} />}
      <View style={styles.shrink}>
        <Text
          size={railed ? tokens.typeBody.size : tokens.typeBodyPhone.size}
          weight="semibold"
          numberOfLines={lines}
        >
          {organisation.name}
        </Text>
        {railed && (
          <Text size={tokens.typeMeta.size} muted numberOfLines={lines}>
            {t('frame.organisation')}
          </Text>
        )}
        {waiting > 0 && (
          <View style={styles.waiting}>
            <View style={styles.ring} />
            <Text size={tokens.typeMeta.size} weight="semibold">
              {t('invitations.count', { count: waiting })}
            </Text>
          </View>
        )}
      </View>
      {onSwitch != null && (
        <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
          <Path d="m6 9 6 6 6-6" {...STROKE} stroke={tokens.colorInkSecondary} />
        </Svg>
      )}
    </Pressable>
  );
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
  const { width, height } = useLayout();
  const large = useAccessibilitySizes();
  const lines = useNameLines();
  const insets = useSafeAreaInsets();
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
  useFocusBack(open, opener);
  // Create an organisation opens as this goes, and its sheet waits for this window to go (sc-23267).
  const { shown, gone } = useWindowTurn(useModalOpen(open));
  // The modal runs behind the bars, the cutout and the home indicator, so the card keeps its margin from them, not from the edge.
  const fit =
    Platform.OS === 'android'
      ? {
          flex: 1,
          paddingTop: insets.top + tokens.spaceXxl,
          paddingBottom: insets.bottom + tokens.spaceXxl,
          paddingLeft: insets.left + tokens.spaceXxl,
          paddingRight: insets.right + tokens.spaceXxl,
        }
      : {
          // Even on both sides, so a short card stays centred on the screen rather than in the safe area.
          paddingVertical: Math.max(insets.top, insets.bottom) + tokens.spaceXxl,
          paddingHorizontal: Math.max(insets.left, insets.right) + tokens.spaceXxl,
          // Sized from the window: on an iPhone on its side the modal can keep its upright height (sc-10118).
          width,
          height,
        };

  return (
    <Modal
      visible={shown}
      transparent
      animationType="fade"
      supportedOrientations={TURNS_WITH_THE_APP}
      // Android's modal window stops at the system bars unless told otherwise, leaving them undimmed.
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
      onDismiss={gone}
    >
      <View style={[styles.scrim, fit]} accessibilityViewIsModal onAccessibilityEscape={onClose}>
        {/* A sibling, not a parent: iOS reads a labelled button as one item and nothing inside it (sc-10712).
            VoiceOver closes the sheet from this Close or the two-finger escape on the scrim. */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('switcher.close')}
        />
        <View style={styles.sheetFrame}>
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
                    <Text size={tokens.typeBodyPhone.size} weight="semibold" numberOfLines={lines}>
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
        </View>
      </View>
    </Modal>
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

const RAIL_BRAND_WIDTH = 119;

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
  row: { flexDirection: 'row' },
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
    paddingHorizontal: tokens.space5xl,
    paddingBottom: tokens.spaceLg,
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
  rail: {
    gap: tokens.spaceXxl,
    paddingRight: tokens.spaceMd,
    backgroundColor: tokens.colorCard,
    borderRightWidth: 1,
    borderRightColor: tokens.colorBorder,
  },
  brand: { minHeight: tokens.sizeHit, justifyContent: 'center', paddingHorizontal: tokens.spaceMd },
  railGroup: { gap: tokens.spaceHair },
  moreList: { gap: tokens.spaceHair },
  pillsInEvent: { flexDirection: 'row', gap: tokens.spaceHair },
  railFoot: {
    paddingTop: tokens.spaceLg,
    borderTopWidth: 1,
    borderTopColor: tokens.colorInsetBorder,
  },
  railItem: {
    minHeight: tokens.sizeHit,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceLg,
    paddingHorizontal: tokens.spaceLg,
    borderRadius: tokens.radiusField,
  },
  railItemOn: { backgroundColor: tokens.colorNeutralFill },
  person: {
    minHeight: tokens.sizeHitPhoneHero,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceMd,
    paddingHorizontal: tokens.spaceSm,
  },
  avatar: {
    width: tokens.space5xl,
    height: tokens.space5xl,
    borderRadius: tokens.spaceXl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorNeutralFill,
  },
  org: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceMd,
    borderWidth: 1,
    borderColor: tokens.colorControlBorder,
    backgroundColor: tokens.colorCard,
  },
  orgPill: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    height: tokens.sizeHit,
    paddingLeft: tokens.spaceXs,
    paddingRight: 14,
    borderRadius: tokens.sizeHit / 2,
  },
  orgRailed: {
    minHeight: tokens.sizeHitPhoneHero,
    paddingLeft: tokens.spaceXs,
    paddingRight: tokens.spaceMd,
    borderRadius: tokens.radiusField,
  },
  tile: {
    width: tokens.space5xl,
    height: tokens.space5xl,
    borderRadius: tokens.radiusSmall,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorAccentTint,
  },
  scrim: {
    justifyContent: 'center',
    backgroundColor: tokens.scrimDialog,
  },
  sheetFrame: {
    flexShrink: 1,
    alignSelf: 'center',
    width: '100%',
    maxWidth: 480,
    borderRadius: tokens.radiusCardPhone,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
    backgroundColor: tokens.colorCard,
  },
  sheet: {
    gap: tokens.spaceLg,
    padding: tokens.spaceXxl,
  },
  invitations: { gap: tokens.spaceSm },
  orgWaiting: { height: undefined, minHeight: tokens.sizeHit, paddingVertical: tokens.spaceXxs },
  waiting: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceXs },
  ring: {
    width: tokens.spaceMd,
    height: tokens.spaceMd,
    borderRadius: tokens.spaceMd / 2,
    borderWidth: 2,
    borderColor: tokens.colorInkSecondary,
  },
  option: {
    minHeight: tokens.sizeHitPhoneHero,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceLg,
    padding: tokens.spaceMd,
    borderRadius: tokens.radiusField,
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
