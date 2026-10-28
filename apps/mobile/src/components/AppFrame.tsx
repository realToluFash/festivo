import { type Membership, primaryEmailAddress } from '@soirely/api-client';
import { roleName, waitingInvitations } from '@soirely/domain';
import { router } from 'expo-router';
import {
  type ReactNode,
  type Ref,
  type RefObject,
  createContext,
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
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import { type WaitingInvitations, useWaitingInvitations } from '../invitations.ts';
import { type DomainOffer, useDomainOffer } from '../joinOffers.ts';
import { DESTINATION_HREF, type Destination, destinations } from '../kit/appNav.ts';
import { leaveThen } from '../leaveHeld.ts';
import { TURNS_WITH_THE_APP } from '../layout/orientations.ts';
import { railWidth } from '../layout/textSize.ts';
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
import { CreateOrganisation } from './CreateOrganisation.tsx';
import { PrimaryButton, SecondaryButton } from './Buttons.tsx';
import { useFocusBack } from './Sheet.tsx';
import { InvitationRows } from './InvitationRows.tsx';
import { Initials } from './Initials.tsx';
import { Notice } from './Notice.tsx';
import { ReadOut, useReadOut } from './ReadOut.tsx';
import { type StepClosed, stepClosed, useFocusBackToOpener, useFocusOnAnswer } from './Screen.tsx';
import type { ScreenReaderTarget } from './screenReaderFocus.ts';
import { type TextHandle, Text } from './Text.tsx';
import { Title, useWholeWords } from './Title.tsx';
import { AccessPaused } from './AccessPaused.tsx';
import { TwoFactorOverdue } from './TwoFactorOverdue.tsx';

type Opening = (opener: RefObject<View | null>) => void;

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

/** While `hidden`, the phone header keeps its title and drops the back row (sc-3132). */
export function useHeaderWithoutBack(hidden: boolean): void {
  const hide = useContext(HideBack);

  useEffect(() => {
    hide?.(hidden);

    return () => hide?.(false);
  }, [hide, hidden]);
}

const ICONS: Record<Destination, readonly [string, string]> = {
  home: ['M3 10.5 12 3l9 7.5', 'M5 9.5V21h14V9.5M10 21v-6h4v6'],
  events: [
    'M2 9a3 3 0 0 0 0 6v3a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-3a3 3 0 0 0 0-6V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z',
    'M13 5v2M13 17v2M13 11v2',
  ],
  settings: [
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
  ],
};

/** The body keeps its place in the tree on every layout, so a rotation keeps what was typed. */
export function AppFrame({
  current,
  title,
  back,
  titleRef,
  aboutTheAccount = false,
  bodyTakesSwitch = false,
  children,
}: {
  current: Destination;
  title: string;
  /** The title on a phone, where it stands for the page's own heading. */
  titleRef?: RefObject<TextHandle | null> | undefined;
  /** Security and Account stay open past an organisation's two-factor deadline, to set it up (sc-609). */
  aboutTheAccount?: boolean;
  /** A heading in the body takes screen reader focus after a tapped switch of organisation, in place of the title (sc-11032). */
  bodyTakesSwitch?: boolean;
  /** On a phone, the page this one was opened from, as Security's "Settings". */
  back?: { label: string; onPress: () => void } | undefined;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const { kind } = useLayout();
  const [choosing, setChoosing] = useState(false);
  const [creating, setCreating] = useState(false);
  const pill = useRef<View>(null);
  const ownTitle = useRef<TextHandle>(null);
  const frameTitle = titleRef ?? ownTitle;
  // Create an organisation's sheet takes focus from the switcher, and hands it back itself (sc-8606).
  const [toSheet, setToSheet] = useState(false);
  const [switcherFrom, setSwitcherFrom] = useState<RefObject<View | null> | null>(null);
  const [creatingFrom, setCreatingFrom] = useState<RefObject<View | null> | null>(null);
  const [created, setCreated] = useState<{ name: string; takesFocus: boolean } | null>(null);
  const createdWords = useRef<View>(null);
  const switched = created == null ? null : t('switcher.switched', { name: created.name });
  const [backHidden, setBackHidden] = useState(false);
  const signedIn = useSignedIn();
  const waiting = useWaitingInvitations();
  const offer = useDomainOffer();
  const count = waitingInvitations(waiting.invitations, waiting.outcomes);
  // It opens with one organisation too, because it ends with "Create an organisation" (sc-390).
  const openSwitcher =
    signedIn.organisation != null || waiting.invitations.length > 0 || offer.organisation != null
      ? (opener: RefObject<View | null>) => {
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
  const startOrganisation = (opener: RefObject<View | null>) => {
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
    <View style={[styles.root, kind === 'tabletLandscape' && styles.row]}>
      {kind === 'tabletLandscape' && (
        <Rail
          current={current}
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
          title={title}
          titleRef={frameTitle}
          switchAnswer={bodyTakesSwitch || standIn != null ? undefined : switchAnswer}
          back={back}
          backHidden={backHidden}
          email={email}
          organisation={signedIn.organisation}
          waiting={count}
          onSwitch={switchFromPill}
          pill={pill}
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
              <HideBack.Provider value={setBackHidden}>
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
              </HideBack.Provider>
            </StartOrganisation.Provider>
          </OpenSwitcher.Provider>
        </View>
        {kind === 'phone' && <TabBar current={current} />}
      </View>
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
}: {
  kind: LayoutKind;
  current: Destination;
  title: string;
  titleRef: RefObject<TextHandle | null> | undefined;
  /** A tapped switch of organisation, which takes screen reader focus to the title. */
  switchAnswer: unknown;
  back: { label: string; onPress: () => void } | undefined;
  backHidden: boolean;
  email: string;
  organisation: Membership | null;
  waiting: number;
  onSwitch: (() => void) | undefined;
  pill: Ref<View>;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const top = { paddingTop: insets.top + (kind === 'tabletLandscape' ? 0 : tokens.spaceXxs) };
  const { read } = useFocusOnAnswer<TextHandle>(switchAnswer, titleRef);
  const large = useAccessibilitySizes();

  if (kind === 'tabletLandscape') {
    return (
      <View style={[styles.header, styles.landscapeHeader, large && styles.stacked, top]}>
        <Title size={tokens.typeTitlePhone.size} accessibilityRole="header" ref={read}>
          {title}
        </Title>
        {!large && <View style={styles.fill} />}
        <Text size={tokens.typeBody.size} muted>
          {email}
        </Text>
      </View>
    );
  }

  if (kind === 'tabletPortrait') {
    return (
      <View style={[styles.header, styles.portraitHeader, top]}>
        {organisation != null && (
          <OrgPill organisation={organisation} waiting={waiting} onSwitch={onSwitch} ref={pill} />
        )}
        <View style={styles.pills} accessibilityRole="tablist">
          {destinations(organisation).map((destination) => {
            const on = destination === current;

            return (
              <Pressable
                key={destination}
                style={[styles.pill, on && styles.pillOn]}
                onPress={() => goTo(destination)}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                testID={`frame.${destination}`}
              >
                <Icon destination={destination} on={on} size={tokens.sizeMark} />
                <Text
                  size={tokens.typeBody.size}
                  weight={on ? 'semibold' : 'medium'}
                  style={on ? styles.ink : styles.secondaryInk}
                >
                  {t(`frame.${destination}`)}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Title size={tokens.typeTitlePage.size} accessibilityRole="header" ref={read}>
          {title}
        </Title>
      </View>
    );
  }

  return (
    <View style={[styles.header, styles.phoneHeader, top]}>
      {current === 'home' && organisation != null && (
        <OrgPill organisation={organisation} waiting={waiting} onSwitch={onSwitch} ref={pill} />
      )}
      {back != null && !backHidden && (
        <BackButton label={back.label} onPress={back.onPress} testID="frame.back" />
      )}
      <Title
        size={back == null ? tokens.typeTitlePage.size : tokens.typeTitlePhone.size}
        accessibilityRole="header"
        ref={read}
      >
        {title}
      </Title>
    </View>
  );
}

export function BackButton({
  label,
  onPress,
  testID,
}: {
  label: string;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable style={styles.back} onPress={onPress} accessibilityRole="button" testID={testID}>
      <Svg width={tokens.sizeMark} height={tokens.sizeMark} viewBox="0 0 24 24" fill="none">
        <Path d="m15 18-6-6 6-6" {...STROKE} stroke={tokens.colorInk} />
      </Svg>
      <Text size={tokens.typeBodyPhone.size} weight="semibold">
        {label}
      </Text>
    </Pressable>
  );
}

function goTo(destination: Destination): void {
  leaveThen(() => router.navigate(DESTINATION_HREF[destination]));
}

function TabBar({ current }: { current: Destination }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { organisation } = useSignedIn();
  const { fontScale } = useWindowDimensions();
  const shown = destinations(organisation);
  const words = useWholeWords(
    tokens.typeMeta.size,
    tokens.typeMeta.size * fontScale,
    shown.map((destination) => t(`frame.${destination}`)),
    { weight: 'bold' },
  );

  return (
    <View
      style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, tokens.spaceSm) }]}
      accessibilityRole="tablist"
    >
      {words.measure}
      {shown.map((destination, index) => {
        const on = destination === current;

        return (
          <Pressable
            key={destination}
            style={styles.tab}
            onPress={() => goTo(destination)}
            onLayout={
              index === 0 ? (event) => words.room(event.nativeEvent.layout.width) : undefined
            }
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            testID={`frame.${destination}`}
          >
            <View style={[styles.tabMark, on && styles.tabMarkOn]} />
            <Icon destination={destination} on={on} size={tokens.space3xl} />
            <Text
              size={tokens.typeMeta.size}
              weight={on ? 'bold' : 'medium'}
              style={[styles.centred, on ? styles.ink : styles.secondaryInk]}
              maxFontSizeMultiplier={words.maxFontSizeMultiplier}
            >
              {t(`frame.${destination}`)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Rail({
  current,
  organisation,
  waiting,
  onSwitch,
  pill,
}: {
  current: Destination;
  organisation: Membership | null;
  waiting: number;
  onSwitch: (() => void) | undefined;
  pill: Ref<View>;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { account } = useSignedIn();
  const { fontScale } = useWindowDimensions();
  const large = useAccessibilitySizes();
  const lines = useNameLines();
  const item = (destination: Destination) => {
    const on = destination === current;

    return (
      <Pressable
        key={destination}
        style={[styles.railItem, on && styles.railItemOn]}
        onPress={() => goTo(destination)}
        accessibilityRole="tab"
        accessibilityState={{ selected: on }}
        testID={`frame.${destination}`}
      >
        <Icon destination={destination} on={on} size={tokens.sizeMark} />
        <Text
          size={tokens.typeBodyPhone.size}
          weight={on ? 'semibold' : 'medium'}
          style={on ? styles.ink : styles.secondaryInk}
        >
          {t(`frame.${destination}`)}
        </Text>
      </Pressable>
    );
  };

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
        <Title size={tokens.typeTitleDialog.size}>{t('app.name')}</Title>
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
      <View style={styles.railGroup}>
        {destinations(organisation)
          .filter((d) => d !== 'settings')
          .map(item)}
      </View>
      <View style={styles.fill} />
      <View style={[styles.railGroup, styles.railFoot]}>
        {item('settings')}
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
  ref: Ref<View>;
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
      {!large && <Tile name={organisation.name} />}
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

function Tile({ name }: { name: string }) {
  return (
    <View
      style={styles.tile}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Initials name={name} size={tokens.typeMeta.size} weight="bold" style={styles.accent} />
    </View>
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
  // Android's window runs behind the bars and the cutout, so the card keeps its margin from them, not from the edge.
  const fit =
    Platform.OS === 'android'
      ? {
          flex: 1,
          paddingTop: insets.top + tokens.spaceXxl,
          paddingBottom: insets.bottom + tokens.spaceXxl,
          paddingLeft: insets.left + tokens.spaceXxl,
          paddingRight: insets.right + tokens.spaceXxl,
        }
      : // Sized from the window: on an iPhone on its side the modal can keep its upright height (sc-10118).
        { width, height };

  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      supportedOrientations={TURNS_WITH_THE_APP}
      // Android's modal window stops at the system bars unless told otherwise, leaving them undimmed.
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
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
                  {!large && <Tile name={organisation.name} />}
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

const STROKE = { strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

function Icon({ destination, on, size }: { destination: Destination; on: boolean; size: number }) {
  const stroke = on ? tokens.colorInk : tokens.colorInkSecondary;

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d={ICONS[destination][0]} {...STROKE} stroke={stroke} />
      <Path d={ICONS[destination][1]} {...STROKE} stroke={stroke} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.colorPage },
  row: { flexDirection: 'row' },
  column: { flex: 1, minWidth: 0 },
  body: { flex: 1, minHeight: 0 },
  fill: { flex: 1 },
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
    height: tokens.sizeHit,
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
    padding: tokens.spaceXxl,
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
