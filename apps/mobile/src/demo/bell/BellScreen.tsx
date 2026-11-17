import { type ReactNode, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, type FlatListInstance, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackButton } from '../../components/AppFrame.tsx';
import { Bell } from '../../components/BellButton.tsx';
import { PrimaryButton, QuietButton } from '../../components/Buttons.tsx';
import { OrgPill } from '../../components/OrgPill.tsx';
import { PageToast } from '../../components/Summary.tsx';
import { Text } from '../../components/Text.tsx';
import { Title } from '../../components/Title.tsx';
import {
  PhoneTabBar,
  TabBarFade,
  phoneTabBarClearance,
  tabBarFoot,
} from '../../components/TodayCover.tsx';
import { useLayout, useWindowFrame } from '../../layout/useLayout.ts';
import { frameTitleSize } from '../../layout/textSize.ts';
import { DemoOnly } from '../../steps/Lines.tsx';
import { tokens } from '../../theme/tokens.ts';
import { goBack } from '../DemoScreen.tsx';
import { SAMPLE } from '../samples.ts';
import {
  type BellStart,
  fixedAboveOnSide,
  listRoom,
  listSides,
  topScrolls,
  topSides,
} from './bellRules.ts';

interface Item {
  id: string;
  title: string;
  lines: readonly string[];
  event: string | null;
  when: string;
  read: boolean;
  muted: boolean;
}

const ITEMS: readonly Item[] = [
  {
    id: 'reply',
    title: 'Ada Obi replied: coming, with 1 guest',
    lines: ['Dietary: vegetarian'],
    event: 'Adeyemi wedding',
    when: 'at 09:40',
    read: false,
    muted: false,
  },
  {
    id: 'change',
    title: 'Ana Souza changed the event',
    lines: ['Starts at 19:30, was 19:00', 'Venue: The Glasshouse, Ikoyi'],
    event: 'Adeyemi wedding',
    when: 'at 08:15',
    read: false,
    muted: false,
  },
  {
    id: 'replies',
    title: '2 replies waiting',
    lines: ['Tunde Bello and Kemi Ade replied to Final numbers.'],
    event: 'Lagos launch dinner',
    when: 'Mon 16 Nov',
    read: true,
    muted: true,
  },
  {
    id: 'day',
    title: 'Event day tomorrow',
    lines: ['Doors at 18:00. Seating is final.'],
    event: 'Lagos launch dinner',
    when: 'Sun 15 Nov',
    read: true,
    muted: false,
  },
  {
    id: 'money',
    title: 'A payment came in',
    lines: ['Deposit from Bello & Co'],
    event: null,
    when: 'Fri 13 Nov',
    read: true,
    muted: false,
  },
  {
    id: 'security',
    title: 'A new sign-in to your account',
    lines: ['iPhone, Lagos'],
    event: null,
    when: 'Thu 12 Nov',
    read: true,
    muted: false,
  },
];

/** sc-62023: the bell's Notifications on sample items, its top staying above the list upright as on main, and on a phone on its side scrolling away with the list, which runs on under the tab bar as Events' does (sc-39471). */
export function BellScreen({ start }: { start: BellStart }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { kind, width, height } = useLayout();
  const frame = useWindowFrame();
  const onSide = topScrolls({ width, height });
  const [items, setItems] = useState(ITEMS);
  const [asking, setAsking] = useState(start.ask);
  const [told, setTold] = useState<string | null>(null);
  const [fixedAbove, setFixedAbove] = useState(0);
  const [headHeight, setHeadHeight] = useState<number | null>(null);
  const list = useRef<FlatListInstance>(null);
  const scrolledOnce = useRef(false);
  const unread = items.filter((item) => !item.read).length;
  const foot = tabBarFoot(insets.bottom);
  const clearance = phoneTabBarClearance(insets.bottom);
  const room = listRoom(frame.height, onSide ? fixedAboveOnSide(insets) : fixedAbove, clearance);

  useEffect(() => {
    if (start.at !== 'scrolled' || headHeight == null || scrolledOnce.current) return;
    scrolledOnce.current = true;
    list.current?.scrollToOffset({ offset: headHeight, animated: false });
  }, [start.at, headHeight]);

  if (kind !== 'phone')
    return (
      <View style={[styles.page, styles.tablet, { paddingTop: insets.top + tokens.spaceXl }]}>
        <BackButton label={t('notifications.back')} onPress={goBack} testID="demo.bell.back" />
        <DemoOnly title="On a tablet Notifications stays as on main: sc-62023 changes only a phone on its side. Open this demo on a phone.">
          {null}
        </DemoOnly>
      </View>
    );

  const top = (
    <View style={[styles.top, topSides(onSide, insets)]}>
      <View style={styles.pillRow}>
        <OrgPill
          id="demo-org"
          name={SAMPLE.organisation}
          waiting={null}
          label={SAMPLE.organisation}
          onPress={() => setTold('The pill opens the switcher, as on main.')}
          testID="demo.bell.pill"
        />
      </View>
      <BackButton label={t('notifications.back')} onPress={goBack} testID="demo.bell.back" />
      <View style={styles.titleRow}>
        <View style={styles.fill}>
          <Title size={frameTitleSize(false, Math.min(width, height))} accessibilityRole="header">
            {t('notifications.heading')}
          </Title>
        </View>
        <Bell
          unread={unread}
          onPress={() => list.current?.scrollToOffset({ offset: 0 })}
          testID="demo.bell.bell"
        />
      </View>
    </View>
  );

  const head = (
    <View onLayout={(event) => setHeadHeight(event.nativeEvent.layout.height)}>
      {onSide && <View style={styles.topInList}>{top}</View>}
      <View style={styles.part}>
        <View style={styles.markRow}>
          <QuietButton
            label={t('notifications.markAllRead')}
            onPress={() => {
              setItems((now) => now.map((item) => ({ ...item, read: true })));
              setTold(t('notifications.allRead'));
            }}
            off={unread === 0}
            testID="demo.bell.markAllRead"
          />
        </View>
      </View>
      {asking && (
        <View style={[styles.card, styles.cardTop]}>
          <View style={styles.cardPart}>
            <View style={styles.ask} testID="demo.bell.pushAsk">
              <Text size={tokens.typeRowTitle.size} weight="bold" accessibilityRole="header">
                {t('notifications.pushAsk.title')}
              </Text>
              <Text size={tokens.typeBodyPhone.size}>{t('notifications.pushAsk.reason')}</Text>
              <View style={styles.askActions}>
                <PrimaryButton
                  label={t('notifications.pushAsk.turnOn')}
                  onPress={() => setAsking(false)}
                  testID="demo.bell.pushAsk.turnOn"
                />
                <QuietButton
                  label={t('notifications.pushAsk.notNow')}
                  onPress={() => setAsking(false)}
                  testID="demo.bell.pushAsk.notNow"
                />
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.page}>
      {onSide ? (
        <View
          style={[styles.statusStrip, { height: fixedAboveOnSide(insets) }]}
          pointerEvents="none"
        />
      ) : (
        <View
          style={{ paddingTop: insets.top + tokens.spaceXxs }}
          onLayout={(event) => setFixedAbove(event.nativeEvent.layout.height)}
        >
          {top}
        </View>
      )}
      <FlatList
        ref={list}
        style={[styles.fill, !onSide && { marginBottom: clearance + tokens.spaceMd }]}
        data={items}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={head}
        renderItem={({ item, index }) => (
          <Row
            item={item}
            opensCard={index === 0 && !asking}
            onOpen={() => {
              setItems((now) =>
                now.map((one) => (one.id === item.id ? { ...one, read: true } : one)),
              );
              setTold(`${item.title}: opens its page, as on main.`);
            }}
            onMore={() => setTold('More opens Mute this event in its sheet, as on main.')}
          />
        )}
        ListFooterComponent={
          <Foot
            onSettings={() => setTold('Notification settings opens, as on main.')}
            demo={
              <DemoOnly
                title={`On ${onSide ? 'its side' : 'an upright phone'}, the list has ${Math.round(room.list)} of ${Math.round(frame.height)}: at least ${room.least} on its side. A notification up to ${Math.round(room.clear)} tall stops whole above the tab bar's fade.`}
              >
                <QuietButton
                  label={asking ? 'Hide the push ask' : 'Show the push ask'}
                  onPress={() => setAsking((now) => !now)}
                  testID="demo.bell.toggleAsk"
                />
              </DemoOnly>
            }
          />
        }
        contentContainerStyle={[
          styles.feed,
          listSides(insets),
          onSide
            ? { paddingTop: fixedAboveOnSide(insets), paddingBottom: clearance + tokens.space3xl }
            : styles.feedUpright,
        ]}
        showsVerticalScrollIndicator={false}
        testID="demo.bell.list"
      />
      <TabBarFade />
      <PhoneTabBar
        bottom={foot}
        onTab={() => setTold('The tabs leave Notifications, as on main.')}
      />
      {told != null && (
        <PageToast words={told} onClose={() => setTold(null)} bottom={clearance + tokens.spaceLg} />
      )}
    </View>
  );
}

/** One notification as the product's feed draws it (sc-3980), its share of the one card. */
function Row({
  item,
  opensCard,
  onOpen,
  onMore,
}: {
  item: Item;
  opensCard: boolean;
  onOpen: () => void;
  onMore: () => void;
}) {
  const { t } = useTranslation();

  return (
    <View style={[styles.card, opensCard && styles.cardTop]}>
      <View style={styles.row}>
        <View style={styles.itemRow}>
          <Pressable
            style={[styles.item, styles.fill]}
            onPress={onOpen}
            accessibilityRole="button"
            testID={`demo.bell.item.${item.id}`}
          >
            <Text size={tokens.typeBodyPhone.size} weight={item.read ? 'regular' : 'bold'}>
              {item.title}
            </Text>
            {item.lines.map((line) => (
              <Text key={line} size={tokens.typeBodyPhone.size}>
                {line}
              </Text>
            ))}
            <Text size={tokens.typeSmall.size} muted>
              {item.event == null
                ? item.when
                : t('notifications.whereWhen', { event: item.event, when: item.when })}
            </Text>
            {(!item.read || item.muted) && (
              <View style={styles.marks}>
                {!item.read && (
                  <View style={styles.mark}>
                    <View style={styles.dot} />
                    <Text size={tokens.typeSmall.size} weight="semibold" style={styles.accent}>
                      {t('notifications.unread')}
                    </Text>
                  </View>
                )}
                {item.muted && (
                  <Text size={tokens.typeSmall.size} muted>
                    {t('notifications.muted')}
                  </Text>
                )}
              </View>
            )}
          </Pressable>
          {item.event != null && (
            <Pressable
              style={styles.moreButton}
              onPress={onMore}
              accessibilityRole="button"
              accessibilityLabel={t('notifications.more', { title: item.title, event: item.event })}
              testID={`demo.bell.item.${item.id}.more`}
            >
              <Text size={tokens.typeRowTitle.size} weight="bold">
                ⋯
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

function Foot({ onSettings, demo }: { onSettings: () => void; demo: ReactNode }) {
  const { t } = useTranslation();

  return (
    <View style={styles.footGap}>
      <View style={[styles.card, styles.cardFoot]}>
        <Pressable
          style={styles.settings}
          onPress={onSettings}
          accessibilityRole="link"
          testID="demo.bell.settings"
        >
          <Text size={tokens.typeButton.size} weight="semibold" style={styles.accent}>
            {t('notifications.settings')}
          </Text>
        </Pressable>
      </View>
      {demo}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: tokens.colorCard },
  tablet: { gap: tokens.spaceXl, paddingHorizontal: tokens.space5xl },
  fill: { flex: 1 },
  statusStrip: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1,
    backgroundColor: tokens.colorCard,
  },
  top: { gap: tokens.spaceLg, paddingBottom: tokens.spaceXl },
  topInList: { paddingTop: tokens.spaceXxs },
  pillRow: { flexDirection: 'row' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm },
  feed: { paddingBottom: tokens.space3xl },
  feedUpright: { paddingTop: tokens.spaceXl },
  part: { gap: tokens.spaceLg, paddingVertical: tokens.spaceSm },
  markRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  card: {
    overflow: 'hidden',
    backgroundColor: tokens.colorCard,
    borderColor: tokens.colorBorder,
    borderLeftWidth: 1,
    borderRightWidth: 1,
  },
  cardTop: {
    paddingTop: tokens.spaceXxs,
    borderTopWidth: 1,
    borderTopLeftRadius: tokens.radiusCardPhone,
    borderTopRightRadius: tokens.radiusCardPhone,
  },
  cardFoot: {
    borderBottomWidth: 1,
    borderBottomLeftRadius: tokens.radiusCardPhone,
    borderBottomRightRadius: tokens.radiusCardPhone,
  },
  cardPart: {
    paddingTop: tokens.spaceSm,
    paddingBottom: tokens.spaceLg,
    paddingHorizontal: tokens.spaceXl,
  },
  ask: {
    gap: tokens.spaceSm,
    padding: tokens.spaceLg,
    borderRadius: tokens.radiusInset,
    backgroundColor: tokens.colorInset,
    borderWidth: 1,
    borderColor: tokens.colorInsetBorder,
  },
  askActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: tokens.spaceLg },
  row: { borderTopWidth: 1, borderTopColor: tokens.colorInsetBorder },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start' },
  item: {
    gap: tokens.spaceXxs,
    minHeight: tokens.sizeHit,
    paddingVertical: tokens.spaceLg,
    paddingHorizontal: tokens.spaceXl,
  },
  moreButton: {
    marginTop: tokens.spaceSm,
    marginRight: tokens.spaceSm,
    minWidth: tokens.sizeHit,
    minHeight: tokens.sizeHit,
    alignItems: 'center',
    justifyContent: 'center',
  },
  marks: { flexDirection: 'row', gap: tokens.spaceLg },
  mark: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceXxs },
  dot: {
    width: tokens.spaceSm,
    height: tokens.spaceSm,
    borderRadius: tokens.spaceSm / 2,
    backgroundColor: tokens.colorAccent,
  },
  accent: { color: tokens.colorAccentText },
  footGap: { gap: tokens.space3xl },
  settings: {
    minHeight: tokens.sizeHit,
    justifyContent: 'center',
    paddingHorizontal: tokens.spaceXl,
    borderTopWidth: 1,
    borderTopColor: tokens.colorInsetBorder,
  },
});
