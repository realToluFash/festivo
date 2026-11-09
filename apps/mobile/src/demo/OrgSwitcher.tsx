import { formattingLocale, type InvitationOutcome } from '@soirely/domain';
import { getLocales } from 'expo-localization';
import { router, useIsFocused, usePathname } from 'expo-router';
import {
  createContext,
  Fragment,
  type ReactNode,
  type RefObject,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  Animated,
  Easing,
  type LayoutChangeEvent,
  Modal,
  Pressable,
  ScrollView,
  type ScrollViewInstance,
  StyleSheet,
  type TextInputInstance,
  useWindowDimensions,
  View,
  type ViewInstance,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OrgMark as ProductOrgMark } from '../components/OrgMark.tsx';
import {
  OPENER,
  OpenerWords as ProductOpenerWords,
  OrgPill as ProductOrgPill,
} from '../components/OrgPill.tsx';
import { TextField } from '../components/Field.tsx';
import { Glyph } from '../components/Glyph.tsx';
import { Initials } from '../components/Initials.tsx';
import { Notice } from '../components/Notice.tsx';
import { useReadOut, useSendingWords } from '../components/ReadOut.tsx';
import { SETTLED_MS } from '../components/Screen.tsx';
import { moveScreenReaderFocus } from '../components/screenReaderFocus.ts';
import { useFocusBack, useWindowTurn } from '../components/Sheet.tsx';
import { Text, type TextHandle } from '../components/Text.tsx';
import { Glass } from '../components/TodayCover.tsx';
import type { Tell } from '../components/TodayParts.tsx';
import type { OpenerAt } from '../components/todayShell.ts';
import { TURNS_WITH_THE_APP } from '../layout/orientations.ts';
import { useAccessibilitySizes, useLayout } from '../layout/useLayout.ts';
import { glide } from '../motion.ts';
import { useReducedMotion } from '../reducedMotion.ts';
import { tokens } from '../theme/tokens.ts';
import { useModalOpen } from '../updateRequired.ts';
import {
  type CreateState,
  SAMPLE_FOUNDED,
  type Walk,
  foundedPlace,
  freshWalk,
  walkFor,
} from './createOrg/CreateWalk.ts';
import { CreateWalkWindow, type WalkOpening, deviceNow } from './createOrg/CreateWalkWindow.tsx';
import { DraftTile } from './createOrg/WalkParts.tsx';
import { ManagedBanner } from './Managed.tsx';
import {
  CELL_GAP,
  type DropFrame,
  type Invite,
  type Offer,
  type Place,
  REFUSED,
  SW,
  type Session,
  type SwitcherState,
  type Tile,
  VIEWER,
  answer,
  ask,
  cellWidth,
  columnsFor,
  currentPlace,
  expand,
  founded,
  frameFor,
  noneMatch,
  notNow,
  openerLabel,
  pick,
  placeOf,
  rowsOf,
  scrollToShow,
  searchable,
  sending,
  sessionFor,
  settled,
  tileKey,
  tilesOf,
  untilIn,
  waitingOf,
  withoutPlaces,
} from './OrgSwitcherModel.ts';
import { Pill, TYPE } from '../components/SettingsParts.tsx';
import { TurningMark } from '../components/SummaryRows.tsx';
import { type Switched, SwitchedProvider } from '../components/SwitchedNotice.tsx';

const store = {
  session: sessionFor('populated'),
  listeners: new Set<() => void>(),
};

function subscribe(listener: () => void) {
  store.listeners.add(listener);

  return () => {
    store.listeners.delete(listener);
  };
}

function setSession(next: Session) {
  store.session = next;
  store.listeners.forEach((listener) => listener());
}

function useSession(): Session {
  return useSyncExternalStore(subscribe, () => store.session);
}

export type OpenerRef = RefObject<ViewInstance | null>;

interface Switcher {
  register: (opener: OpenerRef, primary: boolean) => () => void;
  show: (opener: OpenerRef) => void;
  openedBy: OpenerRef | null;
  startWalk: (opener: OpenerRef) => void;
  registerStart: (opener: OpenerRef) => () => void;
}

const SwitcherContext = createContext<Switcher | null>(null);

function useSwitcher(): Switcher {
  const switcher = useContext(SwitcherContext);
  if (switcher == null) throw new Error('An organisation switcher is drawn inside a demo route.');

  return switcher;
}

const OPEN_AFTER_MS = SETTLED_MS;
const TODAY = '/demo/today';

/** Created from another page: Today says it once it is there. */
const landing: { words: string | null } = { words: null };
const arrival = { id: '', at: 0 };
const ARRIVE_MS = 300;
const ARRIVING_MS = SETTLED_MS * 4;

/** One drop-down per route, opened from whichever opener was tapped; with ?switcher= it opens on load in that state. */
export function OrgSwitcherProvider({
  state,
  create = null,
  none = false,
  statusBar = 'dark',
  tell,
  children,
}: {
  state: SwitcherState | null;
  /** ?create=: the walk opens on load in that state; `created` lands in the new organisation. */
  create?: CreateState | null;
  /** ?orgs=none: Folake in no organisation. */
  none?: boolean;
  statusBar?: 'light' | 'dark';
  tell: Tell;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const phone = useLayout().kind === 'phone';
  const { width, height } = useWindowDimensions();
  const { bottom } = useSafeAreaInsets();
  const [frame, setFrame] = useState<DropFrame | null>(null);
  const [openedBy, setOpenedBy] = useState<OpenerRef | null>(null);
  const [visit, setVisit] = useState(0);
  const [switched, setSwitched] = useState<Switched | null>(() => {
    if (landing.words != null) return { words: landing.words, focus: true };
    if (create === 'created') return { words: SW.switched(SAMPLE_FOUNDED.name), focus: true };

    return null;
  });
  const [walking, setWalking] = useState<WalkOpening | null>(null);
  const [walkOpen, setWalkOpen] = useState(false);
  const starter = useRef<OpenerRef | null>(null);
  const openers = useRef(new Map<OpenerRef, boolean>());
  const slots = useRef(0);
  const back = useRef<ViewInstance | null>(null);
  const opening = useRef<OpenerRef | null>(null);
  const autoOpened = useRef(false);

  useLayoutEffect(() => {
    if (state == null && create == null && !none) return;
    const base = sessionFor(state ?? 'one');
    const start = none ? withoutPlaces(base) : base;
    if (create === 'created') arrive(SAMPLE_FOUNDED.id);
    setSession(create === 'created' ? founded(start, SAMPLE_FOUNDED) : start);
  }, [state, create, none]);

  useEffect(() => {
    landing.words = null;
  }, []);

  const show = useCallback(
    (opener: OpenerRef, auto = false) => {
      const view = opener.current;
      if (view == null) return;

      view.measureInWindow((x, y, w, h) => {
        if (opening.current !== opener) {
          if (!auto) setSession(settled(store.session));
          setVisit((count) => count + 1);
        }
        opening.current = opener;
        back.current = view;
        setFrame(
          frameFor({
            opener: { x, y, width: w, height: h },
            window: { width, height },
            insets: { bottom },
            phone,
          }),
        );
        setOpenedBy(opener);
      });
    },
    [width, height, bottom, phone],
  );

  useEffect(() => {
    if (state == null || autoOpened.current || (create != null && create !== 'created')) return;
    const wait = setTimeout(() => {
      autoOpened.current = true;
      const first = [...openers.current].find(([ref, primary]) => primary && ref.current != null);
      if (first != null) show(first[0], true);
    }, OPEN_AFTER_MS);

    return () => clearTimeout(wait);
  }, [state, show, create]);

  useEffect(() => {
    if (openedBy == null) return;
    const wait = setTimeout(() => show(openedBy), SETTLED_MS);

    return () => clearTimeout(wait);
    // The opener moves when the window turns, so the drop-down follows it there.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height]);

  const close = useCallback(() => {
    opening.current = null;
    setOpenedBy(null);
  }, []);
  const register = useCallback((opener: OpenerRef, primary: boolean) => {
    openers.current.set(opener, primary);

    return () => {
      openers.current.delete(opener);
    };
  }, []);
  const slot = useCallback(() => {
    slots.current += 1;

    return () => {
      slots.current -= 1;
    };
  }, []);
  const onPick = useCallback(
    (id: string) => {
      const next = pick(store.session, id);
      setSession(next);
      close();

      const words = SW.switched(currentPlace(next).name);
      if (slots.current > 0) setSwitched({ words });
      else tell(words);
    },
    [tell, close],
  );
  const openWalk = useCallback((opener: OpenerRef | null, walk: Walk, from: CreateState | null) => {
    setWalking((last) => ({ visit: (last?.visit ?? 0) + 1, walk, state: from, opener }));
    setWalkOpen(true);
  }, []);
  const onCreate = useCallback(() => {
    const opener = opening.current;
    close();
    openWalk(opener, freshWalk(deviceNow()), null);
  }, [close, openWalk]);
  const startWalk = useCallback(
    (opener: OpenerRef) => openWalk(opener, freshWalk(deviceNow()), null),
    [openWalk],
  );
  const registerStart = useCallback((opener: OpenerRef) => {
    starter.current = opener;

    return () => {
      if (starter.current === opener) starter.current = null;
    };
  }, []);
  const onCancelWalk = useCallback(() => setWalkOpen(false), []);
  const onCreated = useCallback(
    (walk: Walk) => {
      const place = foundedPlace(walk);
      const fromNoOrganisation = placeOf(store.session) == null;
      setSession(founded(store.session, place));
      arrive(place.id);
      setWalkOpen(false);

      const words = SW.switched(place.name);
      if (pathname !== TODAY) {
        landing.words = words;
        setTimeout(() => router.replace(TODAY), SETTLED_MS);
      } else if (slots.current > 0 || fromNoOrganisation) setSwitched({ words, focus: true });
      else tell(words);
    },
    [pathname, tell],
  );

  useEffect(() => {
    if (create == null || create === 'created') return;
    const wait = setTimeout(() => {
      const first = [...openers.current].find(([ref, primary]) => primary && ref.current != null);
      const walk = walkFor(create, t, phone);
      if (walk != null) openWalk(none ? starter.current : (first?.[0] ?? null), walk, create);
    }, OPEN_AFTER_MS);

    return () => clearTimeout(wait);
    // Once, as the route opens: a turn of the window keeps the walk as it is.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [create, none]);

  const switcher = useMemo<Switcher>(
    () => ({ register, show, openedBy, startWalk, registerStart }),
    [register, show, openedBy, startWalk, registerStart],
  );

  return (
    <SwitcherContext.Provider value={switcher}>
      <SwitchedProvider slot={slot} switched={switched}>
        {children}
      </SwitchedProvider>
      {frame != null && (
        <DropDown
          key={visit}
          frame={frame}
          open={openedBy != null}
          back={back}
          onClose={close}
          onPick={onPick}
          onCreate={onCreate}
        />
      )}
      {walking != null && (
        <CreateWalkWindow
          key={`walk${walking.visit}`}
          opening={walking}
          open={walkOpen}
          email={VIEWER.email}
          statusBar={statusBar}
          onCancel={onCancelWalk}
          onCreated={onCreated}
        />
      )}
    </SwitcherContext.Provider>
  );
}

export interface OrgOpener {
  place: Place;
  waiting: number;
  expanded: boolean;
  label: string;
  onPress: () => void;
}

/** What an opener draws and does; the one drawn first and in view is what ?switcher= opens from. */
export function useOrgOpener(ref: OpenerRef, primary = true): OrgOpener {
  const { register, show, openedBy } = useSwitcher();
  const session = useSession();
  const place = currentPlace(session);
  const waiting = waitingOf(session);

  useEffect(() => register(ref, primary), [register, ref, primary]);

  return {
    place,
    waiting,
    expanded: openedBy === ref,
    label: openerLabel(place, waiting),
    onPress: () => show(ref),
  };
}

/** The no-organisation screen's Start organisation: it opens the walk, and ?create= opens it from there. */
export function useStartWalk(opener: OpenerRef): () => void {
  const { startWalk, registerStart } = useSwitcher();

  useEffect(() => registerStart(opener), [registerStart, opener]);

  return () => startWalk(opener);
}

/** The organisation being worked in, or null for someone in none. */
export function useCurrentPlace(): Place | null {
  return placeOf(useSession());
}

/** The product's tile, with the walk's crossfade over it while a new organisation arrives. */
export function OrgMark(props: { id: string; name: string; side: number; glass?: boolean }) {
  return (
    <ProductOrgMark {...props}>
      <Arrival
        key={props.id}
        id={props.id}
        name={props.name}
        side={props.side}
        big={props.side >= 40}
      />
    </ProductOrgMark>
  );
}

function arrive(id: string) {
  arrival.id = id;
  arrival.at = Date.now();
}

/** Once the walk has closed, the new organisation's tile crossfades from the draft to its colour; not motion, so Reduce Motion keeps it. */
function Arrival({
  id,
  name,
  side,
  big,
}: {
  id: string;
  name: string;
  side: number;
  big: boolean;
}) {
  const [draft] = useState(() =>
    arrival.id === id && Date.now() - arrival.at < ARRIVING_MS ? new Animated.Value(1) : null,
  );

  useEffect(() => {
    if (draft == null) return;
    const wait = setTimeout(
      () => glide(draft, 0, ARRIVE_MS).start(),
      Math.max(0, arrival.at + SETTLED_MS - Date.now()),
    );

    return () => clearTimeout(wait);
  }, [draft]);

  if (draft == null) return null;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: draft }]} pointerEvents="none">
      <DraftTile
        name={name}
        side={side}
        radius={Math.round(side / 3)}
        initials={big ? Math.floor(side * 0.42) : 12}
      />
    </Animated.View>
  );
}

/** The product's opener words, for the demo's session. */
export function OpenerWords({
  opener,
  ...rest
}: {
  opener: OrgOpener;
  onDark?: boolean;
  grow?: boolean;
  wrap?: boolean;
}) {
  return (
    <ProductOpenerWords
      name={opener.place.name}
      waiting={opener.waiting > 0 ? SW.count(opener.waiting) : null}
      {...rest}
    />
  );
}

/** Today's openers: glass on the cover and the band, and the sidebar's head. */
export function DemoOrgOpener({ at }: { at: OpenerAt }) {
  const ref = useRef<ViewInstance>(null);
  const org = useOrgOpener(ref, at !== 'band');
  const phone = useLayout().kind === 'phone';
  const shared = {
    ref,
    onPress: org.onPress,
    accessibilityRole: 'button',
    accessibilityLabel: org.label,
    accessibilityState: { expanded: org.expanded },
  } as const;

  if (at === 'sidebar')
    return (
      <ProductOrgPill
        ref={ref}
        sidebar
        id={org.place.id}
        name={org.place.name}
        mark={<OrgMark id={org.place.id} name={org.place.name} side={28} />}
        waiting={org.waiting > 0 ? SW.count(org.waiting) : null}
        label={org.label}
        expanded={org.expanded}
        onPress={org.onPress}
        testID="org.switch"
      />
    );

  if (at === 'band')
    return (
      <Pressable {...shared} hitSlop={tokens.spaceXxs} testID="org.switch.band">
        <Glass style={styles.bandOrg}>
          <OrgMark id={org.place.id} name={org.place.name} side={30} glass />
        </Glass>
      </Pressable>
    );

  const tall = org.waiting > 0 ? OPENER.waiting : 40;
  // Clear of the bell by the cover's side margin; the phone's row already sets a gap either side of its spacer.
  const clear = phone ? tokens.spaceXl - 2 * tokens.spaceSm : tokens.space3xl;

  return (
    <Pressable
      {...shared}
      hitSlop={tokens.spaceXxs}
      style={[styles.coverOrg, { marginRight: clear }]}
      testID="org.switch"
    >
      <Glass height={tall} style={[styles.coverGlass, { height: undefined, minHeight: tall }]}>
        <OrgMark id={org.place.id} name={org.place.name} side={28} glass />
        <OpenerWords opener={org} onDark wrap />
        <Glyph name="updown" size={14} ink={tokens.colorInkOnDark} />
      </Glass>
    </Pressable>
  );
}

const GROW_FROM = 0.92;
const LEAVE = Easing.bezier(0.4, 0, 1, 1);
const CARET = 16;

interface Sizes {
  fixed: boolean;
  question: number;
  name: number;
  line: number;
  note: number;
  title: number;
  body: number;
  tile: number;
  badge: number;
}

const GRID: Sizes = {
  fixed: false,
  question: 18,
  name: 15,
  line: 13,
  note: 13,
  title: 16,
  body: 13.5,
  tile: 48,
  badge: 20,
};
const ROWS: Sizes = { ...GRID, tile: 56, badge: 26 };
const DRAWN_LARGE: Sizes = {
  fixed: true,
  question: 36,
  name: 30,
  line: 26,
  note: 26,
  title: 32,
  body: 27,
  tile: 56,
  badge: 26,
};

function DropDown({
  frame,
  open,
  back,
  onClose,
  onPick,
  onCreate,
}: {
  frame: DropFrame;
  open: boolean;
  back: RefObject<ViewInstance | null>;
  onClose: () => void;
  onPick: (id: string) => void;
  onCreate: () => void;
}) {
  const session = useSession();
  const here = useIsFocused();
  const reduced = useReducedMotion();
  const accessibilitySizes = useAccessibilitySizes();
  const [present, setPresent] = useState(open);
  if (open && !present) setPresent(true);
  const { shown, gone } = useWindowTurn(useModalOpen(present && here));
  const [fade] = useState(() => new Animated.Value(0));
  const [grow] = useState(() => new Animated.Value(GROW_FROM));
  const heading = useRef<TextHandle>(null);
  const field = useRef<TextInputInstance>(null);
  const scroller = useRef<ScrollViewInstance>(null);
  const seen = useRef({ offset: 0, viewport: 0 });
  const shownFor = useRef<string | null>(null);
  const [typed, setTyped] = useState(session.query);
  const [cleared, setCleared] = useState(0);
  const [under, setUnder] = useState(false);
  const [answered, setAnswered] = useState<object | undefined>(undefined);
  const locale = useMemo(() => formattingLocale('en', getLocales()[0]?.languageTag), []);
  const sizes = session.large ? DRAWN_LARGE : accessibilitySizes ? ROWS : GRID;
  const large = sizes !== GRID;

  useFocusBack(open, back);

  useEffect(() => {
    if (open && !here) onClose();
  }, [open, here, onClose]);

  useEffect(() => {
    if (!open) return;
    fade.setValue(0);
    grow.setValue(reduced ? 1 : GROW_FROM);
    Animated.parallel([
      glide(fade, 1, tokens.motionBase),
      glide(grow, 1, reduced ? 0 : tokens.motionBase),
    ]).start();
    const typing = searchable(store.session) && store.session.query !== '';
    const focus = setTimeout(
      () => (typing ? field.current?.focus() : moveScreenReaderFocus(heading.current)),
      SETTLED_MS,
    );

    return () => clearTimeout(focus);
  }, [open, fade, grow, reduced]);

  useEffect(() => {
    if (open || !present) return;
    Animated.timing(fade, {
      toValue: 0,
      duration: tokens.motionFast,
      easing: LEAVE,
      useNativeDriver: true,
    }).start(() => setPresent(false));
  }, [open, present, fade]);

  useEffect(() => {
    if (cleared > 0) field.current?.focus();
  }, [cleared]);

  const query = searchable(session) ? typed : '';
  const tiles = tilesOf(session, query);
  const none = noneMatch(session, query);
  const count = tiles.length - 1;
  useReadOut(query.trim() === '' ? null : none ? SW.noMatch(query.trim()) : SW.matches(count), {
    afterTyping: typed,
    quietAtMount: true,
  });

  const across = large ? 1 : columnsFor(frame.width);
  const cell = large ? 0 : cellWidth(frame.width);
  const rows = rowsOf(tiles, across);

  const clear = () => {
    setTyped('');
    setCleared((times) => times + 1);
  };
  const reveal = (top: number, bottom: number) => {
    const to = scrollToShow({ top, bottom, ...seen.current });
    if (to != null) scroller.current?.scrollTo({ y: to, animated: !reduced });
  };
  const onExpand = (id: string) => setSession(expand(store.session, id));
  const onAnswer = (id: string, yes: boolean) => {
    setSession(sending(store.session, id, yes));
    setTimeout(() => {
      if (store.session.outcomes[id]?.kind !== 'busy') return;
      setAnswered({});
      setSession(answer(store.session, id, yes));
    }, SENDING_MS);
  };
  const onAsk = () => {
    setAnswered({});
    setSession(ask(store.session));
  };

  return (
    <Modal
      visible={shown}
      transparent
      animationType="none"
      supportedOrientations={TURNS_WITH_THE_APP}
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
      onDismiss={gone}
    >
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={SW.close}
        testID="switcher.close"
      />
      <Animated.View
        style={[
          styles.drop,
          {
            left: frame.left,
            top: frame.top,
            width: frame.width,
            maxHeight: frame.maxHeight,
            opacity: fade,
            transform: [{ scale: grow }],
            transformOrigin: [frame.originX, 0, 0],
          },
        ]}
        pointerEvents={open ? 'auto' : 'none'}
        accessibilityViewIsModal
        onAccessibilityEscape={onClose}
        testID="switcher"
      >
        <View style={styles.clip}>
          <View style={[styles.head, under && styles.headRuled]}>
            <Text
              ref={heading}
              size={sizes.question}
              weight="bold"
              accessibilityRole="header"
              maxFontSizeMultiplier={sizes.fixed ? 1 : undefined}
              style={[styles.question, { lineHeight: sizes.question * (large ? 1.2 : 1.25) }]}
            >
              {SW.asks}
            </Text>
            {searchable(session) && (
              <Search
                key={cleared}
                start={cleared > 0 ? '' : session.query}
                typed={typed}
                field={field}
                onTyped={setTyped}
                onClear={clear}
              />
            )}
          </View>
          <ScrollView
            ref={scroller}
            style={styles.scroll}
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets
            scrollEventThrottle={16}
            onLayout={(event) => {
              seen.current.viewport = event.nativeEvent.layout.height;
            }}
            onScroll={(event) => {
              const offset = event.nativeEvent.contentOffset.y;
              seen.current.offset = offset;
              setUnder(offset > 0);
            }}
          >
            {none && (
              <View style={styles.none}>
                <Text
                  size={15}
                  weight="medium"
                  maxFontSizeMultiplier={sizes.fixed ? 1 : undefined}
                  style={styles.noneWords}
                >
                  {SW.noMatch(query.trim())}
                </Text>
                <View style={styles.noneClear}>
                  <Pill
                    label={SW.clearSearch}
                    kind="quiet"
                    full={false}
                    height={tokens.sizeHit}
                    onPress={clear}
                    testID="switcher.search.clearAll"
                  />
                </View>
              </View>
            )}
            <View style={large && styles.list}>
              {rows.map((row, index) => {
                const column = row.findIndex(
                  (tile) =>
                    tile.kind !== 'place' &&
                    tile.kind !== 'create' &&
                    tileKey(tile) === session.expanded,
                );
                const opened = row[column];
                const hasCurrent = row.some((tile) => tile.kind === 'place' && tile.current);

                return (
                  <Fragment key={row.map(tileKey).join(':')}>
                    <View
                      style={[styles.row, !large && index > 0 && styles.rowGap]}
                      onLayout={(event: LayoutChangeEvent) => {
                        if (!hasCurrent || shownFor.current != null) return;
                        shownFor.current = session.current;
                        const { y, height } = event.nativeEvent.layout;
                        reveal(y, y + height);
                      }}
                    >
                      {row.map((tile) => (
                        <Cell
                          key={tileKey(tile)}
                          tile={tile}
                          width={large ? null : cell}
                          sizes={sizes}
                          open={tileKey(tile) === session.expanded}
                          onPress={() => {
                            if (tile.kind === 'create') onCreate();
                            else if (tile.kind === 'place' && tile.current) onClose();
                            else if (tile.kind === 'place') onPick(tile.place.id);
                            else if (tile.kind === 'joined') onPick(tile.invite.id);
                            else onExpand(tileKey(tile));
                          }}
                        />
                      ))}
                    </View>
                    {opened != null && opened.kind !== 'place' && opened.kind !== 'create' && (
                      <View
                        style={styles.panel}
                        onLayout={(event) => {
                          const id = tileKey(opened);
                          if (shownFor.current === id) return;
                          shownFor.current = id;
                          const { y, height } = event.nativeEvent.layout;
                          reveal(y, y + height);
                        }}
                        testID={`switcher.panel.${tileKey(opened)}`}
                      >
                        <View
                          style={[
                            styles.caret,
                            {
                              left: large
                                ? tokens.spaceLg + sizes.tile / 2 - CARET / 2
                                : column * (cell + CELL_GAP) + cell / 2 - CARET / 2,
                            },
                          ]}
                        />
                        {opened.kind === 'offer' ? (
                          <OfferPanel
                            offer={opened.offer}
                            sizes={sizes}
                            answered={answered}
                            onAsk={onAsk}
                            onNotNow={() => setSession(notNow(store.session))}
                          />
                        ) : (
                          <InvitationPanel
                            invite={opened.invite}
                            joined={opened.kind === 'joined'}
                            managed={session.managed === opened.invite.id}
                            onChange={() => {
                              onClose();
                              setTimeout(() => router.push('/demo/settings/account'), SETTLED_MS);
                            }}
                            outcome={opened.kind === 'invitation' ? opened.outcome : undefined}
                            sizes={sizes}
                            locale={locale}
                            answered={answered}
                            onAnswer={(yes) => onAnswer(opened.invite.id, yes)}
                            onOpen={() => onPick(opened.invite.id)}
                          />
                        )}
                      </View>
                    )}
                  </Fragment>
                );
              })}
            </View>
            <Text
              size={sizes.note}
              weight="medium"
              maxFontSizeMultiplier={sizes.fixed ? 1 : undefined}
              style={[styles.note, { lineHeight: sizes.note * 1.45 }]}
            >
              {SW.remembered}
            </Text>
          </ScrollView>
        </View>
      </Animated.View>
    </Modal>
  );
}

/** The switcher's search field; Members' person menu takes it too, in its own words (sc-31310). */
export function Search({
  start,
  typed,
  field,
  onTyped,
  onClear,
  words = { search: SW.search, clear: SW.clearSearch },
  testID = 'switcher.search',
}: {
  start: string;
  typed: string;
  field: RefObject<TextInputInstance | null>;
  onTyped: (typed: string) => void;
  onClear: () => void;
  words?: { search: string; clear: string };
  testID?: string;
}) {
  const [focused, setFocused] = useState(false);

  return (
    <View accessibilityRole="search" style={[styles.search, focused && styles.searchFocused]}>
      <Glyph name="search" size={18} ink={tokens.colorInkSecondary} weight={2.2} />
      <TextField
        ref={field}
        defaultValue={start}
        placeholder={words.search}
        placeholderTextColor={tokens.colorInkSecondary}
        onChangeText={onTyped}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        returnKeyType="search"
        autoCorrect={false}
        spellCheck={false}
        autoCapitalize="none"
        accessibilityLabel={words.search}
        style={styles.searchInput}
        testID={testID}
      />
      {typed !== '' && (
        <Pressable
          onPress={onClear}
          style={styles.clear}
          accessibilityRole="button"
          accessibilityLabel={words.clear}
          testID={`${testID}.clear`}
        >
          <View style={styles.clearDot}>
            <Glyph name="x" size={11} ink={tokens.colorInkOnDark} weight={3} />
          </View>
        </Pressable>
      )}
    </View>
  );
}

function cellLabel(tile: Tile): string {
  switch (tile.kind) {
    case 'place':
      return `${tile.place.name}, ${SW.yourRole(tile.place.role)}${tile.current ? `, ${SW.current}` : ''}`;
    case 'joined':
      return `${tile.invite.name}, ${SW.yourRole(tile.invite.role)}`;
    case 'invitation':
      return `${tile.invite.name}, ${SW.fromNobody(tile.invite.role)}`;
    case 'offer':
      return `${tile.offer.name}, ${SW.canAsk}`;
    case 'create':
      return SW.create;
  }
}

/** A tile's name stops at two lines with an ellipsis, in the grid and beside its mark alike; the label, the search and the opened panel keep it whole (sc-486, sc-13496). */
const NAME_LINES = 2;

function Cell({
  tile,
  width,
  sizes,
  open,
  onPress,
}: {
  tile: Tile;
  width: number | null;
  sizes: Sizes;
  open: boolean;
  onPress: () => void;
}) {
  const lit = tile.kind === 'place' && tile.current;
  const opens = tile.kind === 'invitation' || tile.kind === 'offer';
  const cap = sizes.fixed ? 1 : undefined;
  const beside = width == null;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        beside ? styles.entry : [styles.cell, { width }],
        lit ? styles.lit : (open || pressed) && styles.surf,
      ]}
      accessibilityRole="button"
      accessibilityLabel={cellLabel(tile)}
      accessibilityState={opens ? { expanded: open } : { selected: lit }}
      testID={`switcher.tile.${tileKey(tile)}`}
    >
      {({ pressed }) => (
        <>
          <TileFace
            tile={tile}
            sizes={sizes}
            open={open}
            ground={
              lit ? tokens.colorAccentTint : open || pressed ? tokens.colorInset : tokens.colorCard
            }
          />
          <View style={beside ? styles.entryWords : styles.cellWords}>
            <Text
              size={sizes.name}
              weight="semibold"
              numberOfLines={NAME_LINES}
              accessible={false}
              maxFontSizeMultiplier={cap}
              style={[
                beside ? styles.left : styles.centred,
                { lineHeight: sizes.name * (beside ? 1.25 : 1.3) },
                tile.kind === 'create' && styles.violet,
              ]}
            >
              {tile.kind === 'create'
                ? SW.create
                : tile.kind === 'place'
                  ? tile.place.name
                  : tile.kind === 'offer'
                    ? tile.offer.name
                    : tile.invite.name}
            </Text>
            {tile.kind !== 'create' && (
              <Text
                size={sizes.line}
                weight={tile.kind === 'invitation' ? 'semibold' : 'medium'}
                accessible={false}
                maxFontSizeMultiplier={cap}
                style={[
                  beside ? styles.left : styles.centred,
                  styles.line,
                  { lineHeight: sizes.line * 1.35 },
                  tile.kind === 'invitation' ? styles.invitationInk : styles.secondary,
                ]}
              >
                {tile.kind === 'place'
                  ? SW.yourRole(tile.place.role)
                  : tile.kind === 'joined'
                    ? SW.yourRole(tile.invite.role)
                    : tile.kind === 'invitation'
                      ? SW.fromNobody(tile.invite.role)
                      : SW.canAsk}
              </Text>
            )}
            {lit && (
              <Text
                size={sizes.line}
                weight="semibold"
                accessible={false}
                maxFontSizeMultiplier={cap}
                style={[
                  beside ? styles.left : styles.centred,
                  styles.line,
                  styles.violet,
                  { lineHeight: sizes.line * 1.35 },
                ]}
              >
                {SW.current}
              </Text>
            )}
          </View>
        </>
      )}
    </Pressable>
  );
}

function TileFace({
  tile,
  sizes,
  open,
  ground,
}: {
  tile: Tile;
  sizes: Sizes;
  open: boolean;
  ground: string;
}) {
  const side = sizes.tile;
  const radius = Math.round(side / 3);
  const badge = {
    width: sizes.badge + 4,
    height: sizes.badge + 4,
    borderRadius: (sizes.badge + 4) / 2,
    borderColor: ground,
  };

  if (tile.kind === 'create')
    return (
      <View
        style={[styles.tile, styles.create, { width: side, height: side, borderRadius: radius }]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Glyph
          name="plus"
          size={Math.round(side * 0.42)}
          ink={tokens.colorAccentText}
          weight={2.4}
        />
      </View>
    );

  if (tile.kind === 'place' || tile.kind === 'joined') {
    const { id, name } = tile.kind === 'place' ? tile.place : tile.invite;

    return (
      <View style={{ width: side, height: side }}>
        <OrgMark id={id} name={name} side={side} />
        {tile.kind === 'place' && tile.current && (
          <View
            style={[styles.badge, badge, styles.badgeCurrent]}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Glyph
              name="tick"
              size={Math.round(sizes.badge * 0.55)}
              ink={tokens.colorInkOnDark}
              weight={3.2}
            />
          </View>
        )}
      </View>
    );
  }

  const name = tile.kind === 'offer' ? tile.offer.name : tile.invite.name;

  return (
    <View style={{ width: side, height: side }}>
      <View
        style={[
          styles.tile,
          styles.dashed,
          { width: side, height: side, borderRadius: radius },
          open && styles.rimOpen,
        ]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Initials
          name={name}
          size={Math.floor(side * 0.42)}
          weight="bold"
          style={styles.secondary}
        />
      </View>
      <View
        style={[
          styles.badge,
          badge,
          tile.kind === 'offer' ? styles.badgeOffer : styles.badgeInvited,
        ]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {tile.kind === 'offer' ? (
          <Glyph
            name="plus"
            size={Math.round(sizes.badge * 0.6)}
            ink={tokens.colorInkSecondary}
            weight={2.6}
          />
        ) : (
          <View
            style={[
              styles.invitedRing,
              { width: sizes.badge / 2, height: sizes.badge / 2, borderRadius: sizes.badge / 4 },
            ]}
          />
        )}
      </View>
    </View>
  );
}

const SENDING_MS = 900;

/** The pressed answer while it is out: the Pill's `off` ground, the turning mark and what it is doing in Ink 2, as the Ask's busy confirm says it. */
function SendingPill({
  words,
  full,
  height,
  testID,
}: {
  words: string;
  full: boolean;
  height: number;
  testID: string;
}) {
  return (
    <Pressable
      disabled
      style={[
        styles.sending,
        full ? styles.sendingFull : styles.sendingFit,
        { height, borderRadius: height / 2 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={words}
      accessibilityState={{ disabled: true, busy: true }}
      testID={testID}
    >
      <TurningMark side={16} />
      <Text
        size={height >= tokens.sizeHitPhonePrimary ? 16 : TYPE.body}
        weight="semibold"
        numberOfLines={1}
        accessible={false}
        style={styles.secondary}
      >
        {words}
      </Text>
    </Pressable>
  );
}

function PanelButtons({ children }: { children: ReactNode }) {
  return <View style={styles.buttons}>{children}</View>;
}

function InvitationPanel({
  invite,
  joined,
  managed,
  onChange,
  outcome,
  sizes,
  locale,
  answered,
  onAnswer,
  onOpen,
}: {
  invite: Invite;
  joined: boolean;
  managed: boolean;
  onChange: () => void;
  outcome: InvitationOutcome | undefined;
  sizes: Sizes;
  locale: string;
  answered: object | undefined;
  onAnswer: (yes: boolean) => void;
  onOpen: () => void;
}) {
  const cap = sizes.fixed ? 1 : undefined;
  const full = sizes !== GRID;
  const height = full ? tokens.sizeHitPhoneHero : tokens.sizeHit;
  const busy = outcome?.kind === 'busy' ? outcome.answer : null;
  const refused =
    outcome?.kind === 'refused' && outcome.refusal !== 'invitation_not_yours'
      ? REFUSED[outcome.refusal]
      : null;

  useSendingWords(busy == null ? undefined : busy === 'accept' ? SW.joining : SW.declining);

  if (joined)
    return (
      <View style={styles.panelBody}>
        <Notice
          tone="done"
          mark={tokens.marks.done.glyph}
          body={SW.joined(invite.name, invite.role)}
          answer={answered}
          takesFocus
        />
        <View style={styles.buttonsUnder}>
          <Pill
            label={SW.open(invite.name)}
            height={full ? tokens.sizeHitPhoneHero : tokens.sizeHit}
            onPress={onOpen}
            testID={`switcher.invitation.${invite.id}.open`}
          />
        </View>
      </View>
    );

  return (
    <View style={styles.panelBody}>
      <Text
        size={sizes.title}
        weight="bold"
        maxFontSizeMultiplier={cap}
        style={{ lineHeight: sizes.title * 1.3 }}
      >
        {invite.name}
      </Text>
      <View style={styles.panelLines}>
        <Text
          size={sizes.body}
          weight="medium"
          maxFontSizeMultiplier={cap}
          style={[styles.secondary, { lineHeight: sizes.body * 1.4 }]}
        >
          {SW.from(invite.inviter, invite.role)}
        </Text>
        <Text
          size={sizes.body}
          weight="medium"
          maxFontSizeMultiplier={cap}
          style={[styles.secondary, styles.figures, { lineHeight: sizes.body * 1.4 }]}
        >
          {SW.until(untilIn(locale, invite.until))}
        </Text>
      </View>
      {managed ? (
        <View style={styles.answerUnder}>
          <ManagedBanner onChange={onChange} testID={`switcher.invitation.${invite.id}.managed`} />
        </View>
      ) : refused != null ? (
        <View style={styles.answerUnder}>
          <Notice
            tone={refused.attention ? 'attention' : 'quiet'}
            mark={refused.attention ? '!' : 'i'}
            title={refused.word}
            body={refused.body(invite)}
            answer={answered}
            takesFocus
          />
        </View>
      ) : outcome?.kind === 'declined' ? (
        <View style={styles.answerUnder}>
          <Notice
            tone="quiet"
            mark="–"
            body={SW.declined(invite.inviter)}
            answer={answered}
            takesFocus
          />
        </View>
      ) : (
        <View style={styles.answerUnder}>
          {outcome?.kind === 'failed' && (
            <View style={styles.failed}>
              <Notice
                tone="broken"
                mark={tokens.marks.broken.glyph}
                body={SW.failed}
                answer={answered}
              />
            </View>
          )}
          <PanelButtons>
            {busy === 'accept' ? (
              <SendingPill
                words={SW.joining}
                full={full}
                height={height}
                testID={`switcher.invitation.${invite.id}.accept`}
              />
            ) : (
              <Pill
                label={SW.accept}
                accessibilityLabel={SW.acceptLabel(invite.name)}
                kind={busy == null ? 'primary' : 'off'}
                full={full}
                height={height}
                onPress={() => onAnswer(true)}
                testID={`switcher.invitation.${invite.id}.accept`}
              />
            )}
            {busy === 'decline' ? (
              <SendingPill
                words={SW.declining}
                full={full}
                height={height}
                testID={`switcher.invitation.${invite.id}.decline`}
              />
            ) : (
              <Pill
                label={SW.decline}
                accessibilityLabel={SW.declineLabel(invite.name)}
                kind={busy == null ? 'secondary' : 'off'}
                full={full}
                height={height}
                onPress={() => onAnswer(false)}
                testID={`switcher.invitation.${invite.id}.decline`}
              />
            )}
          </PanelButtons>
          <Text
            size={sizes.line}
            weight="medium"
            maxFontSizeMultiplier={cap}
            style={[styles.secondary, styles.declineNote, { lineHeight: sizes.line * 1.4 }]}
          >
            {SW.declineNote(invite.inviter)}
          </Text>
        </View>
      )}
    </View>
  );
}

function OfferPanel({
  offer,
  sizes,
  answered,
  onAsk,
  onNotNow,
}: {
  offer: Offer;
  sizes: Sizes;
  answered: object | undefined;
  onAsk: () => void;
  onNotNow: () => void;
}) {
  const cap = sizes.fixed ? 1 : undefined;
  const full = sizes !== GRID;
  const refused = offer.status === 'unavailable';
  const asked = offer.status === 'asked';

  useReadOut(refused && answered != null ? SW.unavailable : null, { answer: answered });
  useReadOut(
    asked && answered != null ? `${SW.waiting}\n${SW.switcherAsked(VIEWER.email)}` : null,
    {
      answer: answered,
    },
  );

  return (
    <View style={styles.panelBody}>
      <Text
        size={sizes.title}
        weight="bold"
        maxFontSizeMultiplier={cap}
        style={{ lineHeight: sizes.title * 1.3 }}
      >
        {SW.usesSoirely(offer.name)}
      </Text>
      <Text
        size={sizes.body}
        weight="medium"
        maxFontSizeMultiplier={cap}
        style={[styles.secondary, styles.offerBody, { lineHeight: sizes.body * 1.45 }]}
      >
        {SW.switcherBody(offer.domain)}
      </Text>
      {asked ? (
        <View style={styles.asked}>
          <View style={styles.askedRing} />
          <View style={styles.grow} accessible>
            <Text
              size={sizes.body}
              weight="semibold"
              maxFontSizeMultiplier={cap}
              style={{ lineHeight: sizes.body * 1.45 }}
            >
              {SW.waiting}
            </Text>
            <Text
              size={sizes.body}
              weight="medium"
              maxFontSizeMultiplier={cap}
              style={[styles.secondary, { lineHeight: sizes.body * 1.45 }]}
            >
              {`· ${SW.switcherAsked(VIEWER.email)}`}
            </Text>
          </View>
        </View>
      ) : (
        <View style={styles.answerUnder}>
          {refused && (
            <Text
              size={sizes.body}
              weight="semibold"
              maxFontSizeMultiplier={cap}
              style={[styles.refused, { lineHeight: sizes.body * 1.45 }]}
            >
              {SW.unavailable}
            </Text>
          )}
          <PanelButtons>
            <Pill
              label={SW.ask}
              full={full}
              height={full ? tokens.sizeHitPhoneHero : tokens.sizeHit}
              onPress={onAsk}
              testID="switcher.offer.ask"
            />
            <Pill
              label={SW.notNow}
              kind="secondary"
              full={full}
              height={full ? tokens.sizeHitPhoneHero : tokens.sizeHit}
              onPress={onNotNow}
              testID="switcher.offer.notNow"
            />
          </PanelButtons>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  coverOrg: { flexShrink: 1 },
  coverGlass: {
    flexShrink: 1,
    gap: tokens.spaceSm,
    paddingVertical: tokens.spaceXs,
    paddingLeft: tokens.spaceSm,
    paddingRight: tokens.spacePillEnd,
  },
  bandOrg: { paddingHorizontal: 5 },
  drop: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: tokens.colorBorder,
    borderRadius: tokens.space3xl,
    backgroundColor: tokens.colorCard,
    ...tokens.elevationNative.dialog.ios,
    elevation: tokens.elevationNative.dialog.android.elevation,
  },
  clip: { flexShrink: 1, borderRadius: tokens.space3xl - 1, overflow: 'hidden' },
  head: {
    paddingTop: tokens.spaceXl,
    paddingHorizontal: tokens.spaceLg,
    paddingBottom: tokens.spaceLg,
    gap: tokens.spaceLg,
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
  },
  headRuled: { borderBottomColor: tokens.colorBorder },
  question: { textAlign: 'center', letterSpacing: -0.18 },
  scroll: { flexGrow: 0, flexShrink: 1 },
  body: { paddingHorizontal: tokens.spaceLg, paddingBottom: tokens.spaceLg },
  search: {
    height: tokens.sizeHit,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceSm,
    paddingLeft: tokens.spaceLg,
    borderRadius: tokens.spaceLg,
    backgroundColor: tokens.colorInset,
  },
  searchFocused: {
    borderWidth: 2,
    borderColor: tokens.colorAccent,
    paddingLeft: tokens.spaceLg - 2,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    minHeight: 40,
    paddingHorizontal: 0,
    paddingVertical: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
    fontSize: 15,
    fontWeight: '500',
  },
  clear: {
    width: tokens.sizeHit,
    height: tokens.sizeHit,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearDot: {
    width: tokens.spaceXxl,
    height: tokens.spaceXxl,
    borderRadius: tokens.spaceMd,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorInkSecondary,
  },
  none: {
    alignItems: 'center',
    gap: tokens.spaceXxs,
    paddingTop: tokens.spaceXxl,
    paddingHorizontal: tokens.spaceSm,
    paddingBottom: tokens.spaceSm,
  },
  noneWords: { textAlign: 'center', lineHeight: 15 * 1.4 },
  noneClear: { alignSelf: 'center' },
  list: { gap: tokens.spaceXxs },
  row: { flexDirection: 'row', alignItems: 'stretch', gap: CELL_GAP },
  rowGap: { marginTop: tokens.spaceSm },
  cell: {
    minHeight: tokens.sizeHit,
    alignItems: 'center',
    paddingVertical: tokens.spaceMd,
    paddingHorizontal: tokens.spaceXxs,
    borderRadius: tokens.spaceXl,
  },
  entry: {
    flex: 1,
    minHeight: tokens.sizeHit,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceXl,
    padding: tokens.spaceLg,
    borderRadius: tokens.spaceXl,
  },
  lit: { backgroundColor: tokens.colorAccentTint },
  surf: { backgroundColor: tokens.colorInset },
  cellWords: { alignSelf: 'stretch', marginTop: tokens.spaceSm },
  entryWords: { flex: 1, minWidth: 0, gap: tokens.spaceXxs },
  centred: { textAlign: 'center' },
  left: { textAlign: 'left' },
  line: { marginTop: tokens.spaceHair },
  violet: { color: tokens.colorAccentText },
  secondary: { color: tokens.colorInkSecondary },
  invitationInk: { color: tokens.colorPrimaryHover },
  figures: { fontVariant: ['tabular-nums'] },
  tile: { alignItems: 'center', justifyContent: 'center' },
  create: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: tokens.colorAccent,
    backgroundColor: tokens.colorAccentTint,
  },
  dashed: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: tokens.colorFieldBorder,
    backgroundColor: tokens.colorCard,
  },
  rimOpen: { borderStyle: 'solid', borderColor: tokens.colorAccent },
  badge: {
    position: 'absolute',
    right: -8,
    bottom: -8,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeCurrent: { backgroundColor: tokens.colorAccent },
  badgeInvited: { backgroundColor: tokens.colorAccentTint },
  badgeOffer: { backgroundColor: tokens.colorNeutralFill },
  invitedRing: { borderWidth: 2, borderColor: tokens.colorPrimaryHover },
  panel: {
    marginTop: tokens.spaceMd,
    paddingVertical: tokens.spacePillEnd,
    paddingHorizontal: tokens.spaceXl,
    borderRadius: tokens.spaceXl,
    backgroundColor: tokens.colorInset,
  },
  caret: {
    position: 'absolute',
    top: -7,
    width: CARET,
    height: CARET,
    borderRadius: 3,
    backgroundColor: tokens.colorInset,
    transform: [{ rotate: '45deg' }],
  },
  panelBody: { gap: 0 },
  panelLines: { marginTop: tokens.spaceMd, gap: tokens.spaceHair },
  answerUnder: { marginTop: tokens.spaceMd },
  failed: { marginBottom: tokens.spaceSm },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spaceMd },
  sending: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spaceSm,
    backgroundColor: tokens.colorNeutralFill,
  },
  sendingFull: { alignSelf: 'stretch', paddingHorizontal: tokens.spaceXxl },
  sendingFit: { alignSelf: 'flex-start', paddingHorizontal: 22 },
  buttonsUnder: { marginTop: tokens.spaceMd, alignItems: 'flex-start' },
  declineNote: { marginTop: tokens.spaceSm },
  offerBody: { marginTop: tokens.spaceMd },
  refused: { color: tokens.colorBroken, marginBottom: tokens.spaceSm },
  asked: {
    marginTop: tokens.spaceMd,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spaceSm,
  },
  askedRing: {
    width: tokens.spaceLg,
    height: tokens.spaceLg,
    marginTop: 4,
    borderRadius: tokens.spaceXs,
    borderWidth: 2,
    borderColor: tokens.colorInkSecondary,
  },
  note: { marginTop: tokens.spaceXl, textAlign: 'center', color: tokens.colorInkSecondary },
});
