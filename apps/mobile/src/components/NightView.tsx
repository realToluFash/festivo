import {
  type OrganisationEvent,
  type QueuedPress,
  type Schedule,
  type ScheduleItemPress,
  pressedAtOf,
  realtimeTopic,
  withPresses,
} from '@soirely/api-client';
import {
  nightDayOf,
  nightTracks,
  nightView,
  roleHolds,
  serverClock,
  timeSlot,
  todayTrackParam,
  zonedAt,
} from '@soirely/domain';
import { randomUUID } from 'expo-crypto';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  Modal,
  Pressable,
  StyleSheet,
  View,
  type ViewInstance,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import { followReadingAgain } from '../followTopic.ts';
import { dateLocale } from '../i18n/index.ts';
import {
  type NightLost,
  type NightShownItem,
  endNowFor,
  isUnreachable,
  lostWords,
  minutesOld,
  nightItemsOf,
  pressSaid,
  subWords,
  trackLabel,
} from '../kit/night.ts';
import { nightPressQueue, storedPresses } from '../kit/nightPresses.ts';
import { runOfShowCardOf } from '../kit/runOfShowCard.ts';
import {
  isFromCard,
  leftNight,
  putUpRunOfShowCard,
  rememberEventDayPush,
} from '../runOfShowCards.ts';
import { useSignedIn } from '../signedIn.ts';
import { useServerNow } from '../kit/serverNow.ts';
import type { LayoutKind } from '../layout/classify.ts';
import { tokens } from '../theme/tokens.ts';
import { useModalOpen } from '../updateRequired.ts';
import { usePhaseOf } from './Events.tsx';
import {
  type NightActs,
  ChosenPanel,
  LostAlert,
  NightCards,
  NightHead,
  NightSkeleton,
  NightStrip,
  NothingToday,
  TrackMenu,
  ViewOnly,
  nightStyles,
} from './NightCards.tsx';
import { useReadOut } from './ReadOut.tsx';
import { SETTLED_MS, Screen } from './Screen.tsx';
import { bodyEdges } from './bodyEdges.ts';
import { moveScreenReaderFocus } from './screenReaderFocus.ts';
import { Text } from './Text.tsx';

const READ_AGAIN_MS = 10_000;
const SEND_AGAIN_MS = 10_000;

type Load = { kind: 'loading' } | { kind: 'failed' } | { kind: 'loaded'; schedule: Schedule };

/** The night as whoever runs it presses it through (sc-3895): Now, Next and Later for one track, every press kept on the device until the API has it. */
export function useNight(eventId: string) {
  const [queue] = useState(() => nightPressQueue(storedPresses(eventId)));
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [event, setEvent] = useState<OrganisationEvent | null>(null);
  const [waiting, setWaiting] = useState<QueuedPress[]>([]);
  const [online, setOnline] = useState(true);
  const [freshAt, setFreshAt] = useState(() => serverClock.now());
  const [lost, setLost] = useState<NightLost | null>(null);
  const [sent, setSent] = useState(0);
  const sending = useRef(false);
  const again = useRef(false);
  const waitingCount = useRef(0);
  const held = useRef(false);
  const live = useRef(true);

  useEffect(() => {
    waitingCount.current = waiting.length;
  }, [waiting]);

  const reached = useCallback(() => {
    setOnline(true);
    setFreshAt(serverClock.now());
  }, []);

  const read = useCallback(() => {
    void api.schedule(eventId).then(
      (schedule) => {
        if (!live.current) return;
        setLoad({ kind: 'loaded', schedule });
        reached();
      },
      (error: unknown) => {
        if (!live.current) return;
        if (isUnreachable(error)) setOnline(false);
        setLoad((was) => (was.kind === 'loaded' ? was : { kind: 'failed' }));
      },
    );
  }, [eventId, reached]);

  const flush = useCallback(async () => {
    if (sending.current) {
      again.current = true;
      return;
    }
    sending.current = true;
    try {
      do {
        again.current = false;
        const before = (await queue.load()).length;
        const result = await queue.send((press) =>
          api.pressScheduleItem(press.eventId, press.itemId, press.kind, {
            key: press.key,
            pressedAt: press.pressedAt,
            ...(press.fromCard === true ? { fromCard: true } : {}),
          }),
        );
        const left = await queue.load();

        if (!live.current) return;
        setWaiting(left);
        if (result.schedule != null) {
          const schedule = result.schedule;

          setLoad({ kind: 'loaded', schedule });
        }
        const last = result.lost.at(-1);

        if (last != null) {
          setLost({ title: last.press.title, by: last.by, said: last.said });
          read();
        }
        if (result.left.length > 0) {
          held.current = true;
          setOnline(false);
        } else if (before > 0) {
          reached();
          if (held.current) setSent((n) => n + 1);
          held.current = false;
        }
      } while (again.current);
    } finally {
      sending.current = false;
    }
  }, [queue, read, reached]);

  const tryNow = useCallback(() => {
    read();
    void flush();
  }, [read, flush]);

  useEffect(() => {
    live.current = true;
    read();
    void api.event(eventId).then(
      (one) => live.current && setEvent(one),
      () => undefined,
    );
    void api.notificationSettings().then(
      (settings) => {
        const eventDay = settings.find((one) => one.category === 'event_day');
        if (eventDay != null) void rememberEventDayPush(eventDay.push.on);
      },
      () => undefined,
    );
    void queue.load().then((kept) => {
      if (!live.current) return;
      setWaiting(kept);
      if (kept.length > 0) void flush();
    });
    const stop = followReadingAgain(
      realtimeTopic('EventSchedule', eventId),
      () => api.scheduleSubscription(eventId),
      read,
      READ_AGAIN_MS,
    );
    const timer = setInterval(() => {
      if (waitingCount.current > 0) void flush();
    }, SEND_AGAIN_MS);
    const foreground = AppState.addEventListener('change', (state) => {
      if (state === 'active') tryNow();
    });

    return () => {
      live.current = false;
      leftNight();
      stop();
      clearInterval(timer);
      foreground.remove();
    };
  }, [eventId, queue, read, flush, tryNow]);

  const press = useCallback(
    async (kind: ScheduleItemPress, item: NightShownItem): Promise<QueuedPress> => {
      const pressed: QueuedPress = {
        key: randomUUID(),
        pressedAt: pressedAtOf(serverClock.now()),
        eventId,
        itemId: item.id,
        kind,
        title: item.title,
        ...(isFromCard(eventId) ? { fromCard: true } : {}),
      };
      const kept = await queue.keep(pressed);

      if (live.current) {
        setWaiting(kept);
        setLost(null);
      }
      void flush();

      return pressed;
    },
    [eventId, queue, flush],
  );

  return {
    load,
    event,
    waiting,
    online,
    freshAt,
    lost,
    sent,
    press,
    tryNow,
    dismiss: () => setLost(null),
  };
}

export function NightView({
  eventId,
  kind,
  top,
  contentStyle,
  onEvent,
  onEndNow,
  track,
}: {
  eventId: string;
  kind: LayoutKind;
  /** Above the night, at the top of what scrolls: a tablet's Back. */
  top: ReactNode;
  contentStyle: ViewStyle;
  onEvent: (event: OrganisationEvent) => void;
  onEndNow: () => void;
  /** The track shown first, as Today's Open run of show names it (sc-29875). */
  track?: string | undefined;
}) {
  const { t } = useTranslation();
  const night = useNight(eventId);
  const { event } = night;

  useEffect(() => {
    if (event != null) onEvent(event);
  }, [event, onEvent]);

  if (night.load.kind === 'failed')
    return (
      <Screen edges={bodyEdges(kind)} contentStyle={contentStyle}>
        {top}
        <Text size={15} style={styles.secondary} accessibilityRole="alert" testID="night.failed">
          {t('runView.failed')}
        </Text>
      </Screen>
    );

  return (
    <Shown
      night={night}
      schedule={night.load.kind === 'loaded' ? night.load.schedule : null}
      kind={kind}
      top={top}
      contentStyle={contentStyle}
      onEndNow={onEndNow}
      track={track}
    />
  );
}

function Shown({
  night,
  schedule,
  kind,
  top,
  contentStyle,
  onEndNow,
  track: first,
}: {
  night: ReturnType<typeof useNight>;
  schedule: Schedule | null;
  kind: LayoutKind;
  top: ReactNode;
  contentStyle: ViewStyle;
  onEndNow: () => void;
  track?: string | undefined;
}) {
  const { t } = useTranslation();
  const locale = dateLocale();
  const insets = useSafeAreaInsets();
  const serverNow = useServerNow();
  const { event } = night;
  const phase = usePhaseOf(event, serverNow);
  const shown = schedule == null ? null : withPresses(schedule, night.waiting);
  const timeZone = shown?.timeZone ?? event?.timeZone ?? 'UTC';
  const now = zonedAt(serverNow, timeZone);
  const items = shown == null ? [] : nightItemsOf(shown);
  const tracks = nightTracks(items, now);
  const today = nightDayOf(now);
  const [trackKey, setTrackKey] = useState<string | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [said, setSaid] = useState<{ words: string; count: number } | null>(null);
  const [back, setBack] = useState<{ id: string } | null>(null);
  const rows = useRef(new Map<string, ViewInstance>());
  const track =
    tracks.find((one) => one.key === trackKey) ??
    tracks.find((one) => todayTrackParam(one) === first) ??
    tracks[0] ??
    null;
  const view = track == null ? null : nightView(track, now, timeZone);
  const label = track == null ? '' : trackLabel(track, today, locale, t);
  const chosenRow = view?.later.find((row) => row.item.id === chosen) ?? null;
  const sheetShown = useModalOpen(kind !== 'tabletLandscape' && chosenRow != null);
  const manage = event != null && roleHolds(event, 'run_of_show.manage');
  const endNow = event != null && endNowFor(items, now, event, phase === 'happening_now');
  const phone = kind === 'phone';

  useEffect(() => {
    if (back == null) return undefined;
    const later = setTimeout(
      () => moveScreenReaderFocus(rows.current.get(back.id) ?? null),
      SETTLED_MS,
    );

    return () => clearTimeout(later);
  }, [back]);

  const recipient = useSignedIn().account?.id ?? null;
  const carded = useRef(new Set<string>());
  const pressedOn = useRef(schedule);

  useEffect(() => {
    pressedOn.current = schedule;
  }, [schedule]);

  // Each press puts up its track's card here, and each send rewrites it with what is still waiting (sc-66580).
  useEffect(() => {
    const base = pressedOn.current;
    if (base == null || event == null || recipient == null) return;
    const cardShown = withPresses(base, night.waiting);
    const cardNow = zonedAt(serverClock.now(), cardShown.timeZone);
    const cardTracks = nightTracks(nightItemsOf(cardShown), cardNow);

    for (const key of carded.current) {
      const one = cardTracks.find((each) => each.key === key);
      if (one == null) continue;
      const words = runOfShowCardOf(
        event.name,
        trackLabel(one, nightDayOf(cardNow), locale, t),
        one,
        nightView(one, cardNow, cardShown.timeZone),
        cardNow,
        night.waiting.length,
        locale,
        t,
      );

      void putUpRunOfShowCard(
        { eventId: event.id, day: one.day, place: one.place, recipient },
        words,
      ).catch(() => undefined);
    }
  }, [night.waiting, event, recipient, locale, t]);

  const sentCount = useRef(night.sent);

  useEffect(() => {
    if (night.sent === sentCount.current) return;
    sentCount.current = night.sent;
    setSaid((was) => ({ words: t('night.sent'), count: (was?.count ?? 0) + 1 }));
  }, [night.sent, t]);

  useReadOut(said?.words ?? null, { quietAtMount: true, answer: said?.count });

  const close = () => {
    if (chosen != null) setBack({ id: chosen });
    setChosen(null);
    setMoving(false);
  };
  const act = (how: ScheduleItemPress, item: NightShownItem) => {
    if (shown == null || track == null) return;
    carded.current.add(track.key);
    if (how === 'skip' && item.id === chosen) setBack({ id: item.id });
    setChosen(null);
    setMoving(false);
    void night.press(how, item).then((pressed) => {
      const words = pressSaid(pressed, withPresses(shown, [pressed]), track.key, now, t);

      setSaid((was) => ({ words, count: (was?.count ?? 0) + 1 }));
    });
  };
  const acts: NightActs = {
    done: (item) => act('done', item),
    skip: (item) => act('skip', item),
    start: (item) => act('start', item),
    choose: (item) => {
      setChosen(item.id);
      setMoving(false);
    },
    row: (itemId, node) => {
      if (node == null) rows.current.delete(itemId);
      else rows.current.set(itemId, node);
    },
  };
  const panel =
    chosenRow != null && view != null ? (
      <ChosenPanel
        row={chosenRow}
        view={view}
        locale={locale}
        manage={manage}
        moving={moving}
        onMove={setMoving}
        onClose={close}
        acts={acts}
      />
    ) : null;

  return (
    <View style={styles.split}>
      <Screen edges={bodyEdges(kind)} style={styles.grow} contentStyle={contentStyle}>
        {top}
        <NightHead
          subtitle={
            event == null
              ? null
              : t('night.eventAt', { name: event.name, ...timeSlot(now, locale) })
          }
          view={view}
          label={label}
          sub={view == null ? '' : subWords(view, locale, t)}
          many={tracks.length > 1}
          menuOpen={menuOpen}
          onMenu={() => setMenuOpen(!menuOpen)}
        />
        {menuOpen && view != null && track != null && tracks.length > 1 && (
          <TrackMenu
            tracks={tracks.map((one) => ({
              key: one.key,
              label: trackLabel(one, today, locale, t),
            }))}
            current={track.key}
            onChoose={(key) => {
              setTrackKey(key);
              setMenuOpen(false);
              close();
            }}
          />
        )}
        {shown != null && (
          <NightStrip
            online={night.online}
            age={minutesOld(night.freshAt, serverNow)}
            waiting={night.waiting.length}
            onTry={night.tryNow}
          />
        )}
        {shown != null && event != null && !manage && <ViewOnly />}
        {night.lost != null && (
          <LostAlert
            title={night.lost.title}
            words={lostWords(night.lost, timeZone, locale, t)}
            onDismiss={night.dismiss}
          />
        )}
        {shown == null ? (
          <NightSkeleton layout={kind} />
        ) : view == null ? (
          <NothingToday />
        ) : (
          <NightCards
            view={view}
            label={label}
            layout={kind}
            locale={locale}
            manage={manage}
            endNow={endNow}
            chosen={chosen}
            acts={acts}
            onEndNow={onEndNow}
          />
        )}
      </Screen>
      {kind === 'tabletLandscape' && panel != null && (
        <View style={[nightStyles.docked, { paddingBottom: insets.bottom }]}>{panel}</View>
      )}
      {kind !== 'tabletLandscape' && (
        <Modal
          transparent
          visible={sheetShown}
          animationType={phone ? 'slide' : 'fade'}
          statusBarTranslucent
          navigationBarTranslucent
          supportedOrientations={['landscape', 'portrait']}
          onRequestClose={close}
        >
          <View
            style={[nightStyles.scrim, phone ? nightStyles.scrimPhone : nightStyles.scrimDialog]}
            accessibilityViewIsModal
            onAccessibilityEscape={close}
          >
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={close}
              accessibilityElementsHidden
              importantForAccessibility="no"
            />
            {panel != null && (
              <View
                style={[
                  phone ? nightStyles.sheet : nightStyles.dialog,
                  phone && { paddingBottom: insets.bottom + tokens.spaceXl },
                ]}
              >
                {panel}
              </View>
            )}
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  split: { flex: 1, flexDirection: 'row' },
  grow: { flex: 1, minWidth: 0 },
  secondary: { color: tokens.colorInkSecondary },
});
