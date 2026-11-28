import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, type ScrollViewInstance, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BellBody, BellMute, type BellRowData } from '../../components/BellParts.tsx';
import { PHONE_TITLE, PHONE_TITLE_LINE, PHONE_TITLE_TRACKING } from '../../components/bellTop.ts';
import { QuietButton } from '../../components/Buttons.tsx';
import { Back } from '../../components/SettingsParts.tsx';
import { PageToast } from '../../components/Summary.tsx';
import { TextAction } from '../../components/SummaryRows.tsx';
import { Text } from '../../components/Text.tsx';
import { useLayout, useWindowFrame } from '../../layout/useLayout.ts';
import { DemoOnly } from '../../steps/Lines.tsx';
import { tokens } from '../../theme/tokens.ts';
import { goBack } from '../DemoScreen.tsx';
import { openEvent } from '../events/openEvent.ts';
import { openedOver } from '../events/opener.ts';
import {
  type BellStart,
  TOP_ROW,
  firstItemTop,
  fixedAbove,
  frameSides,
  listRoom,
} from './bellRules.ts';

interface Item {
  id: string;
  category: string;
  title: string;
  lines: readonly string[];
  event: string | null;
  /** The sample event the row opens; the others only say what they open. */
  opens?: string;
  when: string;
  read: boolean;
  muted: boolean;
}

const ITEMS: readonly Item[] = [
  {
    id: 'reply',
    category: 'guest_replies',
    title: 'Ada Obi replied: coming, with 1 guest',
    lines: ['Dietary: vegetarian'],
    event: 'Adaeze & Tunde’s wedding',
    opens: 'evt-wed-4',
    when: 'at 09:40',
    read: false,
    muted: false,
  },
  {
    id: 'change',
    category: 'event_changes',
    title: 'Ana Souza changed the event',
    lines: ['Starts at 19:30, was 19:00', 'Venue: The Glasshouse, Ikoyi'],
    event: 'Adaeze & Tunde’s wedding',
    opens: 'evt-wed-4',
    when: 'at 08:15',
    read: false,
    muted: false,
  },
  {
    id: 'replies',
    category: 'messages',
    title: '2 replies waiting',
    lines: ['Tunde Bello and Kemi Ade replied to Final numbers.'],
    event: 'Lagos launch dinner',
    when: 'Mon 16 Nov',
    read: true,
    muted: true,
  },
  {
    id: 'day',
    category: 'event_day',
    title: 'Event day tomorrow',
    lines: ['Doors at 18:00. Seating is final.'],
    event: 'Lagos launch dinner',
    when: 'Sun 15 Nov',
    read: true,
    muted: false,
  },
  {
    id: 'money',
    category: 'money',
    title: 'A payment came in',
    lines: ['Deposit from Bello & Co'],
    event: null,
    when: 'Fri 13 Nov',
    read: true,
    muted: false,
  },
  {
    id: 'security',
    category: 'account_security',
    title: 'A new sign-in to your account',
    lines: ['iPhone, Lagos'],
    event: null,
    when: 'Thu 12 Nov',
    read: true,
    muted: false,
  },
];

/** sc-62023: the bell's Notifications on sample items in the B frame (sc-83081), upright and on its side alike: Back and Mark all read on one row that stays, the title scrolling with the list, and on its side the frame moved in past Android's bar or the Dynamic Island. */
export function BellScreen({ start }: { start: BellStart }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { kind } = useLayout();
  const frame = useWindowFrame();
  const onSide = frame.width > frame.height;
  const [items, setItems] = useState(ITEMS);
  const [asking, setAsking] = useState(start.ask && start.at === 'top');
  const [menu, setMenu] = useState<string | null>(null);
  const [mutedEvents, setMutedEvents] = useState<ReadonlySet<string>>(new Set());
  const [told, setTold] = useState<string | null>(null);
  const withoutAsk = useRef<number | null>(null);
  const page = useRef<ScrollViewInstance>(null);
  const scrolledOnce = useRef(false);
  const unread = items.filter((item) => !item.read).length;
  const sides = frameSides(insets);
  const room = listRoom(frame.height, fixedAbove(insets), insets.bottom);

  if (kind !== 'phone')
    return (
      <View style={[styles.screen, styles.tablet, { paddingTop: insets.top + tokens.spaceXl }]}>
        <Back label={t('notifications.back')} onPress={goBack} testID="demo.bell.back" />
        <DemoOnly title="On a tablet the bell opens its popover, as on main: sc-62023 changes only a phone on its side. Open this demo on a phone.">
          {null}
        </DemoOnly>
      </View>
    );

  const rows: BellRowData[] = items.map((item) => ({
    id: item.id,
    category: item.category,
    title: item.title,
    lines: item.lines,
    where:
      item.event == null
        ? item.when
        : t('notifications.whereWhen', { event: item.event, when: item.when }),
    unread: !item.read,
    muted: item.muted,
    more:
      item.event == null
        ? null
        : {
            label: t('notifications.more', { title: item.title, event: item.event }),
            mute: (
              <BellMute
                on={mutedEvents.has(item.event)}
                onChange={(next) =>
                  setMutedEvents((now) => {
                    const after = new Set(now);
                    if (item.event == null) return now;
                    if (next) after.add(item.event);
                    else after.delete(item.event);
                    return after;
                  })
                }
                testID={`demo.bell.item.${item.id}.mute`}
              />
            ),
          },
    goneShown: false,
    testID: `demo.bell.item.${item.id}`,
  }));

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]} testID="demo.bell.screen">
      <View style={[styles.bellTop, sides]}>
        <Back label={t('notifications.back')} onPress={goBack} testID="demo.bell.back" />
        <View style={styles.grow} />
        <TextAction
          label={t('notifications.markAllRead')}
          off={unread === 0}
          onPress={() => {
            setItems((now) => now.map((item) => ({ ...item, read: true })));
            setTold(t('notifications.allRead'));
          }}
          testID="demo.bell.markAllRead"
        />
      </View>
      <ScrollView
        ref={page}
        contentContainerStyle={[
          styles.bellPage,
          sides,
          { paddingBottom: insets.bottom + tokens.space6xl },
        ]}
        testID="demo.bell.list"
      >
        <Text size={PHONE_TITLE} weight="bold" accessibilityRole="header" style={styles.pageTitle}>
          {t('notifications.heading')}
        </Text>
        <View
          onLayout={(event) => {
            if (start.at !== 'scrolled' || scrolledOnce.current) return;
            const { y, height } = event.nativeEvent.layout;
            if (withoutAsk.current == null) {
              withoutAsk.current = height;
              if (start.ask) {
                setAsking(true);
                return;
              }
            }
            scrolledOnce.current = true;
            page.current?.scrollTo({
              y: firstItemTop({ y, height }, withoutAsk.current),
              animated: false,
            });
          }}
        >
          <BellBody
            ask={asking ? { onAnswer: () => setAsking(false) } : null}
            feed="loaded"
            rows={rows}
            menu={menu}
            onMenu={setMenu}
            onPick={(row) => {
              const item = items.find((one) => one.id === row.id);
              setItems((now) =>
                now.map((one) => (one.id === row.id ? { ...one, read: true } : one)),
              );
              if (item?.opens != null) openEvent(item.opens, openedOver('notifications'));
              else setTold(`${row.title}: opens its page, as on main.`);
            }}
            onTryAgain={() => {}}
            more={null}
            onSettings={() => setTold('Notification settings opens, as on main.')}
            testID="demo.bell"
          />
        </View>
        <View style={styles.foot}>
          <DemoOnly
            title={`${onSide ? 'On its side' : 'Upright'}, the list has ${Math.round(room.list)} of ${Math.round(frame.height)} under the row with Back and Mark all read, ${TOP_ROW} tall: at least ${room.least} on its side. No tab bar, as upright.`}
          >
            <QuietButton
              label={asking ? 'Hide the push ask' : 'Show the push ask'}
              onPress={() => setAsking((now) => !now)}
              testID="demo.bell.toggleAsk"
            />
          </DemoOnly>
        </View>
      </ScrollView>
      {told != null && (
        <PageToast
          words={told}
          onClose={() => setTold(null)}
          bottom={insets.bottom + tokens.spaceLg}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.colorCard },
  tablet: { gap: tokens.spaceXl, paddingHorizontal: tokens.spaceXxl },
  grow: { flex: 1 },
  bellTop: { minHeight: TOP_ROW, flexDirection: 'row', alignItems: 'center' },
  bellPage: { gap: tokens.spaceSm },
  pageTitle: {
    paddingTop: 14,
    paddingBottom: tokens.spaceXs,
    letterSpacing: PHONE_TITLE * PHONE_TITLE_TRACKING,
    lineHeight: PHONE_TITLE * PHONE_TITLE_LINE,
  },
  foot: { paddingTop: tokens.space3xl },
});
