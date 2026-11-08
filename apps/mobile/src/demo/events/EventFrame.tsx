import { router } from 'expo-router';
import { type ReactNode, type Ref, useRef } from 'react';
import {
  Pressable,
  ScrollView,
  type ScrollViewInstance,
  StyleSheet,
  View,
  type ViewInstance,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Sheet } from '../../components/Sheet.tsx';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { Glyph, type GlyphName } from '../../components/Glyph.tsx';
import { PHONE_TAB_BAR, TabBar } from '../../components/TodayCover.tsx';
import {
  SidebarColumn,
  SidebarFoot,
  SidebarHead,
  SidebarPlace,
  SidebarPlaces,
} from '../../components/TodaySidebar.tsx';
import { TodayShellProvider } from '../../components/todayShell.ts';
import { demoShell } from '../demoShell.ts';
import { LineIcon } from '../settings/AccountCard.tsx';
import { Bell, Fade, Landscape } from '../settings/Frame.tsx';
import { EventThumb } from './EventCard.tsx';
import { type Shown, cardTags, rowLine } from './EventsModel.ts';
import { AREAS, type AreaKey, MORE_AREAS, PHONE_TABS } from './EventsSample.ts';
import { AREA_WORDS, COMING, W } from './EventsWords.ts';
import { useShell } from '../../components/settingsShell.ts';
import { Back } from '../../components/SettingsParts.tsx';
import { PageToast, Row, RowList } from '../../components/Summary.tsx';

export const AREA_GLYPH: Record<AreaKey, GlyphName> = {
  overview: 'overview',
  guests: 'users',
  menu: 'menu',
  seating: 'seating',
  messages: 'chat',
  schedule: 'clock',
  staff: 'user',
  people: 'people',
  budget: 'wallet',
  reports: 'reports',
};

const PHONE_BAR: readonly (readonly [string, GlyphName])[] = [
  ...PHONE_TABS.map((area) => [AREA_WORDS[area], AREA_GLYPH[area]] as const),
  [W.more, 'dots'],
];

/** People is built, as People A: it opens the People demo, with no event around it. */
export function toArea(area: AreaKey, onArea: (area: AreaKey) => void): void {
  if (area === 'people') router.push('/demo/people');
  else onArea(area);
}

export function backToEvents(): void {
  router.dismissTo('/demo/events');
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
  without,
  children,
}: {
  event: Shown;
  now: Date;
  area: AreaKey;
  onArea: (area: AreaKey) => void;
  more: boolean;
  onMore: (open: boolean) => void;
  overlay?: ReactNode;
  toast?: { words: string; onClose: () => void } | null;
  scrollRef?: Ref<ScrollViewInstance>;
  fill?: boolean;
  badge?: AreaBadge | null;
  onBell?: (() => void) | undefined;
  bellRef?: Ref<ViewInstance> | undefined;
  /** A page an area pushes in its own column: ‹ and the area it goes back to. */
  back?: { label: string; onPress: () => void } | null;
  /** On the phone, a way back other than Overview, as Seating's ‹ More. */
  phoneBack?: { label: string; onPress: () => void } | undefined;
  /** An area this viewer has no part in, as Budget for Can edit: gone from More, the pills and the sidebar. */
  without?: AreaKey | undefined;
  children: ReactNode;
}) {
  const shell = useShell();
  const insets = useSafeAreaInsets();
  const phone = shell.layout === 'phone';
  const foot = Math.max(insets.bottom - tokens.spaceXxs, tokens.spaceLg);
  const told = toast != null && (
    <PageToast
      words={toast.words}
      onClose={toast.onClose}
      bottom={
        phone
          ? foot + PHONE_TAB_BAR + tokens.spaceXl + tokens.spaceHair
          : Math.max(insets.bottom, tokens.spaceLg)
      }
    />
  );

  if (shell.layout === 'landscape')
    return (
      <Landscape
        column={null}
        sidebar={
          <EventSidebar
            event={event}
            now={now}
            area={area}
            onArea={onArea}
            badge={badge}
            without={without}
          />
        }
        overlay={
          <>
            {overlay}
            {told}
          </>
        }
      >
        {fill ? (
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
        )}
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
        <Back label={back.label} onPress={back.onPress} />
        <View style={styles.grow} />
        <Bell tell={shell.tell} onPress={onBell} ref={bellRef} />
      </View>
      {!phone && <AreaPills area={area} onArea={onArea} badge={badge} without={without} />}
      {fill ? (
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
      )}
      {phone && (
        <>
          <Fade />
          {badge == null ? (
            <TabBar
              tabs={PHONE_BAR}
              bottom={foot}
              at={at}
              onTab={(label) => {
                const chosen = PHONE_TABS.find((one) => AREA_WORDS[one] === label);
                if (chosen == null) onMore(true);
                else onArea(chosen);
              }}
            />
          ) : (
            <BadgedTabBar
              bottom={foot}
              at={at}
              badge={badge}
              onTab={(chosen) => (chosen == null ? onMore(true) : onArea(chosen))}
            />
          )}
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
                lead={<LineIcon name={AREA_GLYPH[one]} />}
                opens
                selected={one === area}
                onPress={() => {
                  onClose();
                  toArea(one, onArea);
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

/** The event's tab bar as TabBar draws it, with Messages' count on its tab and its name in words. */
function BadgedTabBar({
  bottom,
  at,
  badge,
  onTab,
}: {
  bottom: number;
  at: string;
  badge: AreaBadge;
  onTab: (area: AreaKey | null) => void;
}) {
  return (
    <View style={[styles.tabBar, { bottom }]} accessibilityRole="tablist">
      {PHONE_BAR.map(([label, glyph]) => {
        const on = label === at;
        const ink = on ? tokens.colorAccent : tokens.colorInkSecondary;
        const counted = label === AREA_WORDS.messages;

        return (
          <Pressable
            key={label}
            onPress={() => onTab(PHONE_TABS.find((one) => AREA_WORDS[one] === label) ?? null)}
            style={[styles.tab, on && styles.tabOn]}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={counted ? badge.name : label}
            testID={`tab-${label.toLowerCase()}`}
          >
            <Glyph name={glyph} size={22} ink={ink} />
            <Text
              size={12}
              weight={on ? 'semibold' : 'medium'}
              accessible={false}
              style={{ color: ink }}
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
  return (
    <View style={styles.pillsAt}>
      <ScrollView
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
              onPress={() => toArea(one, onArea)}
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
}: {
  event: Shown;
  now: Date;
  area: AreaKey;
  onArea: (area: AreaKey) => void;
  badge: AreaBadge | null;
  without: AreaKey | undefined;
}) {
  const shell = useShell();
  const tags = cardTags(event, now).map((tag) => tag.word);

  return (
    <TodayShellProvider value={{ ...demoShell(shell.tell), person: shell.looking }}>
      <SidebarColumn>
        <SidebarHead search={false} />
        <Pressable
          onPress={backToEvents}
          style={({ pressed }) => [styles.sideBack, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={`Back to ${W.events}`}
          testID="event.side.back"
        >
          <Glyph name="back" size={17} ink={tokens.colorInkSecondary} weight={2.4} />
          <Text size={14} weight="semibold" accessible={false} style={styles.secondary}>
            {W.events}
          </Text>
        </Pressable>
        <View
          style={styles.sideCard}
          accessible
          accessibilityLabel={`${event.name}. ${tags.join(', ')}`}
        >
          <EventThumb event={event} side={40} radius={12} />
          <View style={styles.grow}>
            <Text size={14} weight="bold" numberOfLines={2} accessible={false}>
              {event.name}
            </Text>
            <Text size={12.5} weight="medium" accessible={false} style={styles.secondary}>
              {tags.join(' · ')}
            </Text>
          </View>
        </View>
        <SidebarPlaces>
          {AREAS.filter((one) => one !== without).map((one) =>
            one === 'messages' && badge != null ? (
              <CountedPlace
                key={one}
                badge={badge}
                on={one === area}
                onPress={() => toArea(one, onArea)}
              />
            ) : (
              <SidebarPlace
                key={one}
                label={AREA_WORDS[one]}
                glyph={AREA_GLYPH[one]}
                on={one === area}
                onPress={() => toArea(one, onArea)}
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
      <Text
        size={30}
        weight="bold"
        accessibilityRole="header"
        style={[styles.title, styles.areaTitle, AREA_TITLE[layout]]}
      >
        {AREA_WORDS[area]}
      </Text>
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
    left: 18,
    right: 18,
    height: 64,
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
  pressed: { opacity: tokens.opacityPressed },
  title: { letterSpacing: -0.6 },
  top: { flexDirection: 'row', alignItems: 'center' },
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
    height: 52,
    alignItems: 'center',
    gap: tokens.spaceHair,
    paddingHorizontal: tokens.spaceXxs,
  },
  pill: {
    height: tokens.sizeHit,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceSm,
    paddingLeft: 14,
    paddingRight: tokens.spaceXl,
    borderRadius: 22,
  },
  pillOn: { backgroundColor: tokens.colorCard, ...tokens.elevationNative.raised.ios },
  sideBack: {
    minHeight: tokens.sizeHit,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceXs,
    paddingHorizontal: tokens.spaceMd,
  },
  sideCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceMd,
    padding: tokens.spaceMd,
    borderRadius: tokens.spaceXl,
    backgroundColor: tokens.colorCard,
  },
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
  coming: {
    gap: tokens.spaceXxs,
    paddingVertical: 18,
    paddingHorizontal: tokens.spaceXxl,
    borderRadius: tokens.radiusCardLarge,
    backgroundColor: tokens.colorInset,
  },
});
