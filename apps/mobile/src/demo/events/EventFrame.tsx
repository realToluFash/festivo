import { router } from 'expo-router';
import {
  type ReactNode,
  type Ref,
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  type LayoutChangeEvent,
  Pressable,
  ScrollView,
  type ScrollViewInstance,
  StyleSheet,
  View,
  type ViewInstance,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Sheet } from '../../components/Sheet.tsx';
import { Text, TitleCap } from '../../components/Text.tsx';
import { MeasuredWords, PageTitleDrawn, useTitleCap } from '../../components/Title.tsx';
import { PAGE_TITLE } from '../../components/topTitle.ts';
import { tokens } from '../../theme/tokens.ts';
import { useAccessibilitySizes } from '../../layout/useLayout.ts';
import { Glyph, type GlyphName } from '../../components/Glyph.tsx';
import { PHONE_TAB_BAR, TabBarFade } from '../../components/TodayCover.tsx';
import { tabBarSides } from '../../components/bodyEdges.ts';
import { wordsIn } from '../../layout/textSize.ts';
import { eventBarLabelSize, eventBarStart } from './eventBarSize.ts';
import { statusFits } from '../../layout/titleFit.ts';
import {
  SidebarBack,
  SidebarColumn,
  SidebarEventCard,
  SidebarFoot,
  SidebarHead,
  SidebarPlace,
  SidebarPlaces,
} from '../../components/TodaySidebar.tsx';
import { TodayShellProvider } from '../../components/todayShell.ts';
import { AREA_GLYPH } from '../../components/areaGlyph.ts';
import { demoShell } from '../demoShell.ts';
import { Bell, Landscape } from '../settings/Frame.tsx';
import { EventThumb } from '../../components/EventThumb.tsx';
import { type Shown, rowLine } from './EventsModel.ts';
import { AREAS, type AreaKey, MORE_AREAS, PHONE_TABS } from './EventsSample.ts';
import { AREA_WORDS, COMING, W } from './EventsWords.ts';
import { SecondaryButton } from '../../components/Buttons.tsx';
import { RUN_EVENT, RW as RUN_WORDS } from '../runView/runViewModel.ts';
import { NW, nightWayIn } from '../night/nightModel.ts';
import { useShell } from '../../components/settingsShell.ts';
import { Back } from '../../components/SettingsParts.tsx';
import { PageToast, Row, RowList } from '../../components/Summary.tsx';
import { ActionToast } from './ActionToast.tsx';

const PHONE_BAR: readonly (readonly [string, GlyphName])[] = [
  ...PHONE_TABS.map((area) => [AREA_WORDS[area], AREA_GLYPH[area]] as const),
  [W.more, 'dots'],
];

export function backToEvents(): void {
  router.dismissTo('/demo/events');
}

export interface EventToast {
  words: string;
  onClose: () => void;
  action?: { label: string; onPress: () => void; testID?: string } | null;
}

/** On its side the frame draws no top of its own, so the area's title row ends with the bell, at the pane's top right (sc-68052). */
const PaneBellAt = createContext<{ bell: ReactNode } | null>(null);

export function useBellInPane(): boolean {
  return useContext(PaneBellAt) != null;
}

/** The event's bell where an area's title row ends, on an iPad on its side; elsewhere the frame's own top has it. */
export function PaneBell() {
  return useContext(PaneBellAt)?.bell ?? null;
}

/** A title the pane's bell ends, the title wrapping to its left at the largest sizes, in a row as tall as the bell's target. */
export function BellRow({ children }: { children: ReactNode }) {
  if (!useBellInPane()) return children;
  return (
    <View style={styles.bellRow}>
      <View style={styles.besideBell}>{children}</View>
      <PaneBell />
    </View>
  );
}

/** Messages' count, on its tab, its pill and its place in the sidebar, named in words (sc-3976). */
export interface AreaBadge {
  count: number;
  name: string;
  words: string;
}

/** An event in its frame: its own tab bar on the phone, the area pills upright, its own sidebar on its side; `fill` hands an area the room to lay out itself. */
export function EventFrame({
  event,
  now,
  area,
  onArea,
  more,
  onMore,
  overlay,
  toast,
  scrollRef,
  fill = false,
  badge = null,
  onBell,
  bellRef,
  back: pushed,
  phoneBack,
  besideBack,
  without,
  loading = false,
  children,
}: {
  event: Shown;
  now: Date;
  area: AreaKey;
  onArea: (area: AreaKey) => void;
  more: boolean;
  onMore: (open: boolean) => void;
  overlay?: ReactNode;
  /** With an action, the house toast that carries one. */
  toast?: EventToast | null;
  scrollRef?: Ref<ScrollViewInstance>;
  fill?: boolean;
  badge?: AreaBadge | null;
  onBell?: (() => void) | undefined;
  bellRef?: Ref<ViewInstance> | undefined;
  /** A page an area pushes in its own column: ‹ and the area it goes back to. */
  back?: { label: string; onPress: () => void } | null;
  /** On the phone, a way back other than Overview, as Seating's ‹ Guests. */
  phoneBack?: { label: string; onPress: () => void } | undefined;
  /** On the phone, a status beside Back, as Guests' Refreshing…; told whether it had room there (sc-71821). */
  besideBack?: BesideBackStatus | undefined;
  /** An area this viewer has no part in, as Budget for Can edit: gone from More, the pills and the sidebar. */
  without?: AreaKey | undefined;
  /** While the event loads its top is already the loaded page's; only its card in the sidebar waits. */
  loading?: boolean;
  children: ReactNode;
}) {
  const shell = useShell();
  const insets = useSafeAreaInsets();
  const large = useAccessibilitySizes();
  const phone = shell.layout === 'phone';
  const titleCap = useTitleCap(`${shell.layout}|${area}`, PAGE_TITLE);
  // As the product's frame: an area is capped only once its body's title says the size it drew at (sc-67338, sc-67659).
  const capped = (node: ReactNode) => (
    <PageTitleDrawn.Provider value={titleCap.onDrawn}>
      <TitleCap.Provider value={titleCap.drawn ? titleCap.cap : null}>{node}</TitleCap.Provider>
    </PageTitleDrawn.Provider>
  );
  const foot = Math.max(insets.bottom - tokens.spaceXxs, tokens.spaceLg);
  const toastBottom = phone
    ? foot + PHONE_TAB_BAR + tokens.spaceXl + tokens.spaceHair
    : Math.max(insets.bottom, tokens.spaceLg);
  const told =
    toast == null ? null : toast.action == null ? (
      <PageToast words={toast.words} onClose={toast.onClose} bottom={toastBottom} />
    ) : (
      <ActionToast
        words={toast.words}
        action={toast.action}
        onClose={toast.onClose}
        bottom={toastBottom}
      />
    );

  if (shell.layout === 'landscape')
    return (
      <Landscape
        column={null}
        sidebar={
          // As the product's sidebar in an event: nothing in it outgrows the area's title at the accessibility sizes (sc-68052, sc-67659).
          <TitleCap.Provider value={large ? titleCap.cap : null}>
            <EventSidebar
              event={event}
              now={now}
              area={area}
              onArea={onArea}
              badge={badge}
              without={without}
              loading={loading}
            />
          </TitleCap.Provider>
        }
        overlay={
          <>
            {overlay}
            {told}
          </>
        }
      >
        <PaneBellAt.Provider
          value={{ bell: <Bell tell={shell.tell} onPress={onBell} ref={bellRef} /> }}
        >
          {capped(
            fill ? (
              <View style={styles.grow}>{children}</View>
            ) : (
              <ScrollView
                ref={scrollRef}
                style={styles.grow}
                contentContainerStyle={styles.pane}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {children}
              </ScrollView>
            ),
          )}
        </PaneBellAt.Provider>
      </Landscape>
    );

  const back =
    pushed ??
    (phone && phoneBack != null
      ? phoneBack
      : phone && area !== 'overview'
        ? { label: W.overview, onPress: () => onArea('overview') }
        : { label: W.backToEvents, onPress: backToEvents });
  const at = PHONE_TABS.includes(area) ? AREA_WORDS[area] : W.more;

  return (
    <View style={styles.page}>
      <View
        style={[
          styles.top,
          phone
            ? { paddingTop: insets.top + tokens.spaceXxs, paddingHorizontal: tokens.spaceXxl }
            : { paddingTop: insets.top + tokens.spaceMd, paddingHorizontal: tokens.space5xl },
        ]}
      >
        <BackSlot beside={phone ? besideBack : undefined} capped={capped}>
          <Back label={back.label} onPress={back.onPress} />
        </BackSlot>
        <Bell tell={shell.tell} onPress={onBell} ref={bellRef} />
      </View>
      {!phone && <AreaPills area={area} onArea={onArea} badge={badge} without={without} />}
      {capped(
        fill ? (
          <View style={styles.grow}>{children}</View>
        ) : (
          <ScrollView
            ref={scrollRef}
            style={styles.grow}
            contentContainerStyle={[
              styles.blocks,
              phone
                ? {
                    paddingHorizontal: tokens.spaceXxl,
                    paddingBottom: foot + PHONE_TAB_BAR + tokens.space6xl * 2,
                  }
                : {
                    paddingTop: tokens.space3xl,
                    paddingHorizontal: tokens.space5xl,
                    paddingBottom: insets.bottom + tokens.space6xl * 2,
                  },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        ),
      )}
      {phone && (
        <>
          <TabBarFade />
          <EventBar
            bottom={foot}
            at={at}
            badge={badge}
            onTab={(chosen) => (chosen == null ? onMore(true) : onArea(chosen))}
          />
          <MoreSheet
            open={more}
            onClose={() => onMore(false)}
            area={area}
            onArea={onArea}
            without={without}
          />
        </>
      )}
      {overlay}
      {told}
    </View>
  );
}

export interface BesideBackStatus {
  node: ReactNode;
  onPlaced: (beside: boolean) => void;
}

/** Back, and beside it a status only where the pill stays whole with it, as on main where it fits; else the area draws the status under its heading (sc-71821). The drawn status is out of the row's flow, as the app's GivingWay draws it, so a pill that grows after the status is placed is never squeezed into reading as room for both (sc-74113). */
function BackSlot({
  beside,
  capped,
  children,
}: {
  beside: BesideBackStatus | undefined;
  capped: (node: ReactNode) => ReactNode;
  children: ReactNode;
}) {
  const [slot, setSlot] = useState(0);
  const [back, setBack] = useState(0);
  const [status, setStatus] = useState(0);
  const fits =
    beside != null && statusFits({ room: slot, lead: back, ends: [], status, gap: tokens.spaceMd });
  const placed = beside?.onPlaced;

  useEffect(() => {
    placed?.(fits);
  }, [fits, placed]);

  const widthOf = (set: (width: number) => void) => (event: LayoutChangeEvent) =>
    set(Math.ceil(event.nativeEvent.layout.width));

  if (beside == null)
    return (
      <>
        {capped(children)}
        <View style={styles.grow} />
      </>
    );

  return (
    <View style={styles.backSlot} onLayout={widthOf(setSlot)}>
      <View style={styles.backWhole} onLayout={widthOf(setBack)}>
        {capped(children)}
      </View>
      <View
        style={styles.measure}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <View style={styles.offBell} onLayout={widthOf(setStatus)}>
          {capped(beside.node)}
        </View>
      </View>
      {fits && <View style={[styles.offBell, styles.atEnd]}>{capped(beside.node)}</View>}
    </View>
  );
}

function MoreSheet({
  open,
  onClose,
  area,
  onArea,
  without,
}: {
  open: boolean;
  onClose: () => void;
  area: AreaKey;
  onArea: (area: AreaKey) => void;
  without: AreaKey | undefined;
}) {
  const opener = useRef<ViewInstance>(null);
  const insets = useSafeAreaInsets();

  return (
    <Sheet
      open={open}
      onClose={onClose}
      opener={opener}
      scrimLabel={W.closeMore}
      testID="event.more"
    >
      <View style={[styles.more, { paddingBottom: Math.max(MORE_FOOT - insets.bottom, 0) }]}>
        <View style={styles.moreHead}>
          <Text
            size={22}
            weight="bold"
            accessibilityRole="header"
            style={[styles.grow, styles.moreTitle]}
          >
            {W.more}
          </Text>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [styles.close, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={W.closeMore}
            testID="event.more.close"
          >
            <Glyph name="x" size={18} ink={tokens.colorInk} weight={2.4} />
          </Pressable>
        </View>
        <RowList
          items={MORE_AREAS.filter((one) => one !== without).map((one) => ({
            key: one,
            inset: 40,
            selected: one === area,
            row: (
              <Row
                title={AREA_WORDS[one]}
                lead={<MoreGlyph name={AREA_GLYPH[one]} on={one === area} />}
                opens
                selected={one === area}
                onPress={() => {
                  onClose();
                  onArea(one);
                }}
                testID={`event.more.${one}`}
              />
            ),
          }))}
        />
      </View>
    </Sheet>
  );
}

/** A More row's glyph, 20 pt, in its name's colour: accent on the chosen area, as in the sidebar. */
function MoreGlyph({ name, on }: { name: GlyphName; on: boolean }) {
  return (
    <View style={styles.moreGlyph}>
      <Glyph
        name={name}
        size={20}
        ink={on ? tokens.colorAccentText : tokens.colorInkSecondary}
        weight={2}
      />
    </View>
  );
}

/** The event's tab bar, its five labels at one size, stepped down to 10 where that keeps every word whole, and Messages' count on its tab (sc-71148). */
function EventBar({
  bottom,
  at,
  badge,
  onTab,
}: {
  bottom: number;
  at: string;
  badge: AreaBadge | null;
  onTab: (area: AreaKey | null) => void;
}) {
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const [measured, setMeasured] = useState<Readonly<Record<string, number>>>({});
  const [slot, setSlot] = useState(0);
  const start = eventBarStart(fontScale);
  const words = wordsIn(PHONE_BAR.map(([label]) => label));
  const widths = words.map((word) => measured[`${start}|${word}`]);
  const widest = widths.every((width) => width != null) ? Math.max(...widths.map(Number)) : 0;
  const size = eventBarLabelSize(fontScale, widest, slot);

  return (
    <View style={[styles.tabBar, tabBarSides(insets), { bottom }]} accessibilityRole="tablist">
      <MeasuredWords
        words={words}
        size={start}
        weight="semibold"
        allowFontScaling={false}
        onWidth={(word, width) => {
          const key = `${start}|${word}`;
          setMeasured((now) => (now[key] === width ? now : { ...now, [key]: width }));
        }}
      />
      {PHONE_BAR.map(([label, glyph], index) => {
        const on = label === at;
        const ink = on ? tokens.colorAccent : tokens.colorInkSecondary;
        const counted = badge != null && label === AREA_WORDS.messages;

        return (
          <Pressable
            key={label}
            onPress={() => onTab(PHONE_TABS.find((one) => AREA_WORDS[one] === label) ?? null)}
            style={[styles.tab, on && styles.tabOn]}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={counted ? badge.name : label}
            testID={`tab-${label.toLowerCase()}`}
            onLayout={
              index === 0
                ? (event) => {
                    const width = event.nativeEvent.layout.width;
                    setSlot((now) => (now === width ? now : width));
                  }
                : undefined
            }
          >
            <Glyph name={glyph} size={22} ink={ink} />
            <Text
              size={size}
              weight={on ? 'semibold' : 'medium'}
              allowFontScaling={false}
              accessible={false}
              style={[styles.tabLabel, { color: ink }]}
            >
              {label}
            </Text>
            {counted && (
              <View
                style={styles.badge}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              >
                <Text size={12} weight="bold" accessible={false} style={styles.badgeFigure}>
                  {badge.count}
                </Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

function AreaPills({
  area,
  onArea,
  badge,
  without,
}: {
  area: AreaKey;
  onArea: (area: AreaKey) => void;
  badge: AreaBadge | null;
  without: AreaKey | undefined;
}) {
  const strip = useRef<ScrollViewInstance>(null);
  const starts = useRef<Partial<Record<AreaKey, number>>>({});
  const reveal = (one: AreaKey) => {
    const x = starts.current[one];
    if (x != null)
      strip.current?.scrollTo({ x: Math.max(0, x - tokens.space3xl), animated: false });
  };
  // The chosen area's pill is kept in view, so Budget is never cut to "Bud" at the iPad's edge.
  useEffect(() => reveal(area), [area]);

  return (
    <View style={styles.pillsAt}>
      <ScrollView
        ref={strip}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.pillsBar}
        contentContainerStyle={styles.pills}
        accessibilityRole="tablist"
      >
        {AREAS.filter((one) => one !== without).map((one) => {
          const on = one === area;
          const ink = on ? tokens.colorAccentText : tokens.colorInkSecondary;
          const counted = one === 'messages' && badge != null;

          return (
            <Pressable
              key={one}
              onPress={() => onArea(one)}
              onLayout={(event: LayoutChangeEvent) => {
                starts.current[one] = event.nativeEvent.layout.x;
                if (on) reveal(one);
              }}
              style={[styles.pill, on && styles.pillOn]}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={counted ? badge.name : AREA_WORDS[one]}
              testID={`event.area.${one}`}
            >
              <Glyph name={AREA_GLYPH[one]} size={18} ink={ink} />
              <Text size={15} weight="semibold" accessible={false} style={{ color: ink }}>
                {AREA_WORDS[one]}
              </Text>
              {counted && (
                <Text
                  size={15}
                  weight="medium"
                  accessible={false}
                  style={[styles.secondary, styles.figures]}
                >
                  {`· ${badge.words}`}
                </Text>
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

/** The event's own sidebar in the shell's place: back to Events, the event as a card, its ten areas, then Settings and you. */
function EventSidebar({
  event,
  now,
  area,
  onArea,
  badge,
  without,
  loading,
}: {
  event: Shown;
  now: Date;
  area: AreaKey;
  onArea: (area: AreaKey) => void;
  badge: AreaBadge | null;
  without: AreaKey | undefined;
  loading: boolean;
}) {
  const shell = useShell();
  return (
    <TodayShellProvider value={{ ...demoShell(shell.tell), person: shell.looking }}>
      <SidebarColumn>
        <SidebarHead search={false} />
        <SidebarBack
          label={W.events}
          heard={`Back to ${W.events}`}
          onPress={backToEvents}
          testID="event.side.back"
        />
        <SidebarEventCard event={loading ? null : event} now={now} />
        <SidebarPlaces>
          {AREAS.filter((one) => one !== without).map((one) =>
            one === 'messages' && badge != null ? (
              <CountedPlace key={one} badge={badge} on={one === area} onPress={() => onArea(one)} />
            ) : (
              <SidebarPlace
                key={one}
                label={AREA_WORDS[one]}
                glyph={AREA_GLYPH[one]}
                on={one === area}
                onPress={() => onArea(one)}
                testID={`event.side.${one}`}
              />
            ),
          )}
        </SidebarPlaces>
        <View style={styles.grow} />
        <SidebarFoot
          onTab={shell.onTab}
          at={null}
          onPerson={() => shell.openSection('account')}
          person={shell.looking}
        />
      </SidebarColumn>
    </TodayShellProvider>
  );
}

/** Messages in the sidebar as SidebarPlace draws a place, with its count in words under it. */
function CountedPlace({
  badge,
  on,
  onPress,
}: {
  badge: AreaBadge;
  on: boolean;
  onPress: () => void;
}) {
  const ink = on ? tokens.colorInk : tokens.colorInkSecondary;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.place, on && styles.placeOn, pressed && styles.pressed]}
      accessibilityRole="tab"
      accessibilityState={{ selected: on }}
      accessibilityLabel={badge.name}
      testID="event.side.messages"
    >
      <Glyph name={AREA_GLYPH.messages} ink={ink} />
      <View style={styles.grow}>
        <Text
          size={14.5}
          weight={on ? 'semibold' : 'medium'}
          accessible={false}
          style={{ color: ink }}
        >
          {AREA_WORDS.messages}
        </Text>
        <Text
          size={12.5}
          weight="medium"
          accessible={false}
          style={[styles.secondary, styles.figures]}
        >
          {badge.words}
        </Text>
      </View>
    </Pressable>
  );
}

/** An area that is coming: its title, the event, and a Surface card that says so. */
export function AreaPage({
  area,
  event,
  locale,
}: {
  area: Exclude<AreaKey, 'overview' | 'people'>;
  event: Shown;
  locale: string;
}) {
  const { layout } = useShell();
  return (
    <>
      <BellRow>
        <Text
          size={30}
          weight="bold"
          accessibilityRole="header"
          style={[styles.title, styles.areaTitle, AREA_TITLE[layout]]}
        >
          {AREA_WORDS[area]}
        </Text>
      </BellRow>
      <View style={styles.strip}>
        <EventThumb event={event} side={40} radius={12} />
        <View style={[styles.grow, styles.stripWords]}>
          <Text size={16} weight="semibold" style={styles.stripName}>
            {event.name}
          </Text>
          <Text size={14} weight="medium" style={[styles.secondary, styles.stripLine]}>
            {rowLine(event, locale, false)}
          </Text>
        </View>
      </View>
      <View style={styles.coming} testID={`event.coming.${area}`}>
        <Text size={17} weight="semibold" style={styles.comingTitle}>
          {AREA_WORDS[area]}
        </Text>
        <Text size={15} weight="medium" style={[styles.secondary, styles.comingLine]}>
          {COMING[area]}
        </Text>
        {area === 'schedule' && event.id === RUN_EVENT && (
          <View style={styles.comingAct}>
            {nightWayIn(event) && (
              <SecondaryButton
                label={NW.title}
                link
                onPress={() => router.push('/demo/night')}
                testID="event.schedule.night"
              />
            )}
            <SecondaryButton
              label={RUN_WORDS.openRun}
              link
              onPress={() => router.push('/demo/run-view')}
              testID="event.schedule.run"
            />
          </View>
        )}
      </View>
    </>
  );
}

const MORE_FOOT = 116;

const AREA_TITLE = {
  phone: { paddingTop: 14, marginBottom: -tokens.spaceHair },
  portrait: { marginBottom: tokens.spaceXl },
  landscape: {},
};

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  figures: { fontVariant: ['tabular-nums'] },
  tabBar: {
    position: 'absolute',
    height: PHONE_TAB_BAR,
    padding: 5,
    borderRadius: tokens.space5xl,
    backgroundColor: tokens.colorCard,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
    flexDirection: 'row',
    gap: tokens.spaceHair,
    ...tokens.elevationNative.raised.ios,
    elevation: tokens.elevationNative.raised.android.elevation,
  },
  tab: {
    flex: 1,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  tabOn: { backgroundColor: tokens.colorAccentTint },
  tabLabel: { textAlign: 'center' },
  badge: {
    position: 'absolute',
    left: '50%',
    top: tokens.spaceXxs,
    marginLeft: 3,
    minWidth: 20,
    minHeight: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: tokens.spaceXs,
    borderRadius: tokens.spaceMd,
    borderWidth: 2,
    borderColor: tokens.colorCard,
    backgroundColor: tokens.colorAccent,
  },
  badgeFigure: { color: tokens.colorInkOnDark, fontVariant: ['tabular-nums'] },
  place: {
    minHeight: tokens.sizeHit,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceLg,
    paddingHorizontal: tokens.spaceLg,
    paddingVertical: tokens.spaceXxs,
    borderRadius: tokens.radiusRow,
  },
  placeOn: {
    backgroundColor: tokens.colorCard,
    ...tokens.elevationNative.card.ios,
    elevation: tokens.elevationNative.card.android.elevation,
  },
  page: { flex: 1, backgroundColor: tokens.colorCard },
  secondary: { color: tokens.colorInkSecondary },
  moreGlyph: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: tokens.opacityPressed },
  title: { letterSpacing: -0.6 },
  top: { flexDirection: 'row', alignItems: 'center' },
  backSlot: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spaceMd,
  },
  offBell: { paddingRight: tokens.spaceMd },
  atEnd: { position: 'absolute', top: 0, right: 0, bottom: 0, justifyContent: 'center' },
  backWhole: { flexShrink: 1, minWidth: 0 },
  measure: { position: 'absolute', opacity: 0 },
  bellRow: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceLg },
  besideBell: { flex: 1, minWidth: 0, minHeight: tokens.sizeHit, justifyContent: 'center' },
  blocks: { gap: 18 },
  pane: { paddingTop: 26, paddingHorizontal: 30, paddingBottom: tokens.space6xl * 2, gap: 18 },
  more: { gap: tokens.spaceXl, paddingHorizontal: tokens.spaceXxl, paddingTop: 31 },
  moreTitle: { letterSpacing: 22 * -0.015, lineHeight: 22 * 1.2 },
  moreHead: { minHeight: tokens.sizeHit, flexDirection: 'row', alignItems: 'center' },
  close: {
    width: tokens.sizeHit,
    height: tokens.sizeHit,
    borderRadius: tokens.sizeHit / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorInset,
  },
  pillsAt: { paddingHorizontal: tokens.space5xl, paddingTop: tokens.spaceSm },
  pillsBar: { flexGrow: 0, borderRadius: 26, backgroundColor: tokens.colorInset },
  pills: {
    minHeight: 52,
    alignItems: 'center',
    gap: tokens.spaceHair,
    paddingHorizontal: tokens.spaceXxs,
  },
  pill: {
    minHeight: tokens.sizeHit,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceSm,
    paddingLeft: 14,
    paddingRight: tokens.spaceXl,
    borderRadius: 22,
  },
  pillOn: { backgroundColor: tokens.colorCard, ...tokens.elevationNative.raised.ios },
  areaTitle: { lineHeight: 30 * 1.12 },
  strip: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceLg,
    paddingVertical: tokens.spaceXxs,
  },
  stripWords: { gap: 3 },
  stripName: { lineHeight: 16 * 1.3 },
  stripLine: { lineHeight: 14 * 1.4 },
  comingTitle: { lineHeight: 17 * 1.3 },
  comingLine: { lineHeight: 15 * 1.45 },
  comingAct: { paddingTop: tokens.spaceMd, alignItems: 'flex-start', gap: tokens.spaceSm },
  coming: {
    gap: tokens.spaceXxs,
    paddingVertical: 18,
    paddingHorizontal: tokens.spaceXxl,
    borderRadius: tokens.radiusCardLarge,
    backgroundColor: tokens.colorInset,
  },
});
