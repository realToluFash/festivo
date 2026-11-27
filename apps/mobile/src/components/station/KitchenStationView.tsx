import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  type KeptServiceTap,
  type KitchenStationsRead,
  type ServiceFlags,
  type ServiceRead,
  keepServiceTap,
  keptServiceTap,
  realtimeTopic,
  sendServiceTaps,
} from '@soirely/api-client';
import {
  type Freshness,
  type ServiceFreshness,
  type ItemState,
  type ServicePhase,
  type TapRefusal,
  UNDO_MINUTES,
  createServiceFreshness,
  freshnessKey,
  serverClock,
} from '@soirely/domain';
import { randomUUID } from 'expo-crypto';
import type { TFunction } from 'i18next';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type ViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { api } from '../../api.ts';
import { followTopic } from '../../followTopic.ts';
import { dateLocale } from '../../i18n/index.ts';
import {
  type FacedPlate,
  type StationItemLine,
  type StationMark,
  type StationTray,
  type StationView,
  notSentLine,
  openingStation,
  readPick,
  refusedAccess,
  rememberPick,
  stationAsOf,
  stationView,
  topicMessage,
  undoCloses,
  undoOpen,
  undoPlan,
  undoWords,
  withoutRefused,
} from '../../kit/kitchenStation.ts';
import { useServerNow, useServerNowAt } from '../../kit/serverNow.ts';
import { storedServiceTaps } from '../../kit/serviceTaps.ts';
import type { LayoutKind } from '../../layout/classify.ts';
import { useSignedIn } from '../../signedIn.ts';
import { tokens } from '../../theme/tokens.ts';
import { Glyph } from '../NightCards.tsx';
import { readOut } from '../ReadOut.tsx';
import { Sheet } from '../Sheet.tsx';
import { Text } from '../Text.tsx';
import {
  Chip,
  type Eta,
  FlagLine,
  FlaggedCount,
  GLYPH,
  type ListedStation,
  Quiet,
  Segments,
  StationList,
  Times,
} from './StationParts.tsx';

const REFETCH_AFTER_MS = 150;

type Loaded =
  | { state: 'loading' }
  | { state: 'failed' }
  | { state: 'refused'; access: 'floor' | 'none' }
  | { state: 'ok'; list: KitchenStationsRead; reads: ServiceRead[] };

interface Mine {
  state: ItemState;
  readyIn: Eta;
  at: number;
}

interface Sizes {
  phone: boolean;
  side: number;
  table: number;
  line: number;
  item: number;
}

const slot = (courseId: string, key: string) => `${courseId}|${key}`;

/** The device's own marks drawn at once over the last read, until a read after they are sent replaces them. */
function withMine(reads: readonly ServiceRead[], mine: ReadonlyMap<string, Mine>): ServiceRead[] {
  if (mine.size === 0) return [...reads];

  return reads.map((read) => ({
    ...read,
    items: read.items.map((item) => {
      const own = mine.get(slot(read.course.id, item.key));
      if (own == null) return item;
      const at = new Date(own.at).toISOString();
      return {
        ...item,
        state: own.state,
        readyIn: own.state === 'preparing' ? own.readyIn : null,
        changedAt: at,
        preparingSince:
          own.state !== 'preparing' ? null : item.state === 'preparing' ? item.preparingSince : at,
      };
    }),
  }));
}

function flagWords(t: TFunction, flags: ServiceFlags): string[] {
  return [
    ...flags.allergens.map((code) => t(`guestNeeds.allergen.${code}`)),
    ...(flags.allergenOther == null || flags.allergenOther === '' ? [] : [flags.allergenOther]),
    ...flags.diet.map((code) => t(`guestNeeds.dietName.${code}`)),
    ...(flags.dietOther == null || flags.dietOther === '' ? [] : [flags.dietOther]),
  ];
}

export function KitchenStationView({
  eventId,
  kind,
  onBack,
  from = null,
}: {
  eventId: string;
  kind: LayoutKind;
  onBack: () => void;
  /** The way in it opened from (sc-95382): its ‹ names Overview or Your night. */
  from?: 'overview' | 'night' | null;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const now = useServerNow();
  const accountId = useSignedIn().account?.id;
  const [loaded, setLoaded] = useState<Loaded>({ state: 'loading' });
  const [picked, setPicked] = useState<string | null | undefined>(undefined);
  const [station, setStation] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [moved, setMoved] = useState('');
  const [freshness, setFreshness] = useState<Freshness | null>(null);
  const [kept, setKept] = useState<KeptServiceTap[]>([]);
  const [notSent, setNotSent] = useState<TapRefusal[]>([]);
  const [mine, setMine] = useState<ReadonlyMap<string, Mine>>(new Map());
  const [undoable, setUndoable] = useState<ReadonlyMap<string, StationMark>>(new Map());
  const undoNow = useServerNowAt(undoCloses(undoable.values()));
  const [choosing, setChoosing] = useState<string | null>(null);
  const opener = useRef<ViewInstance | null>(null);
  const freshRef = useRef<ServiceFreshness | null>(null);
  const yours = useRef<string | null | undefined>(undefined);
  const lastReads = useRef<readonly ServiceRead[]>([]);
  const hereBefore = useRef<Set<string> | null>(null);
  const phase = useRef<ServicePhase>('on');
  const store = useMemo(() => storedServiceTaps(eventId), [eventId]);
  const phone = kind === 'phone';
  const z: Sizes = {
    phone,
    side: phone ? tokens.sizeHitPhonePrimary : tokens.sizeHit,
    table: phone ? 28 : 34,
    line: phone ? 17 : 19,
    item: phone ? 20 : 24,
  };

  const read = useCallback(async (): Promise<ServicePhase> => {
    try {
      const list = await api.kitchenStations(eventId);
      const reads = await Promise.all(
        list.fired.map((course) => api.serviceRead(eventId, course.id)),
      );
      phase.current = reads.at(-1)?.phase ?? 'on';
      lastReads.current = reads;
      setLoaded({ state: 'ok', list, reads });
      setMine(new Map());
      return phase.current;
    } catch (error) {
      const access = refusedAccess(error);
      if (access != null) {
        setLoaded({ state: 'refused', access });
        return phase.current;
      }
      setLoaded((was) => (was.state === 'ok' ? was : { state: 'failed' }));
      throw error;
    }
  }, [eventId]);

  const send = useCallback(async () => {
    const sent = await sendServiceTaps(store, (tap) => api.sendServiceTap(tap));
    setKept(sent.left);
    if (sent.refused.length > 0) {
      setNotSent((was) => [...was, ...sent.refused.flatMap((one) => one.lines)]);
      setUndoable((was) =>
        withoutRefused(was, [...sent.refused, ...sent.dropped.map((tap) => ({ tap }))]),
      );
    }
    if (sent.refetch) await read().catch(() => undefined);
  }, [store, read]);

  useEffect(() => {
    if (accountId != null) void readPick(AsyncStorage, accountId, eventId).then(setPicked);
    void store.load().then(setKept);
  }, [accountId, eventId, store]);

  useEffect(() => {
    const fresh = createServiceFreshness({ read });
    freshRef.current = fresh;
    const unsubscribe = fresh.subscribe(setFreshness);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const soon = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void read().catch(() => undefined), REFETCH_AFTER_MS);
    };
    fresh.start();
    const live = followTopic(realtimeTopic('EventService', eventId), {
      subscribe: () => api.serviceSubscription(eventId),
      onData: (data) => {
        const message = topicMessage(data);
        if (message.kind === 'heartbeat') {
          fresh.message('heartbeat');
          return;
        }
        if (message.kind === 'phase') {
          fresh.message('phase', message.phase);
          return;
        }
        fresh.message('data');
        soon();
      },
      onGap: () => {
        soon();
        void send();
      },
    });

    return () => {
      clearTimeout(timer);
      live.stop();
      unsubscribe();
      fresh.stop();
      freshRef.current = null;
    };
  }, [eventId, read, send]);

  useEffect(() => {
    freshRef.current?.waiting(kept.length);
  }, [kept, freshness?.state]);

  useEffect(() => {
    if (loaded.state !== 'ok' || picked === undefined) return;
    const list = loaded.list;
    const was = yours.current;
    yours.current = list.yours;
    if (was === undefined) {
      setStation(openingStation(list, picked));
      return;
    }
    if (list.yours != null && list.yours !== was) {
      const name = list.stations.find((one) => one.id === list.yours)?.name ?? '';
      setStation(list.yours);
      setMoved(t('station.movedTo', { station: name }));
    }
  }, [loaded, picked, t]);

  const view: StationView | null = useMemo(
    () =>
      loaded.state !== 'ok' || station == null
        ? null
        : stationView(station, withMine(loaded.reads, mine), now, t),
    [loaded, station, mine, now, t],
  );

  useEffect(() => {
    if (view == null) return;
    const ids = new Set(view.here.map((one) => one.tray.id));
    const before = hereBefore.current;
    hereBefore.current = ids;
    if (before == null) return;
    const arrived = view.here.filter((one) => !before.has(one.tray.id));
    const cancel = arrived.map((one) =>
      readOut(t('station.arrived', { table: one.tray.table, count: one.tray.plates })),
    );
    return () => cancel.forEach((stop) => stop());
  }, [view, t]);

  useEffect(() => (moved === '' ? undefined : readOut(moved)), [moved]);

  const time = (at: Date | number | string) => stationAsOf(at, dateLocale());

  const pick = (id: string) => {
    setStation(id);
    setPicked(id);
    setListOpen(false);
    setChoosing(null);
    if (accountId != null)
      void rememberPick(AsyncStorage, accountId, eventId, id).catch(() => undefined);
    const name =
      loaded.state === 'ok' ? loaded.list.stations.find((one) => one.id === id)?.name : '';
    setMoved(t('station.picked', { station: name ?? '' }));
    hereBefore.current = null;
  };

  const markItem = async (line: StationItemLine, state: ItemState, readyIn: Eta) => {
    const key = slot(line.courseId, line.key);
    const at = serverClock.now().getTime();
    const tap = keptServiceTap(
      eventId,
      { kind: 'itemState', courseId: line.courseId, item: line.key, state, readyIn },
      { item: line.item.state },
      randomUUID(),
    );
    setChoosing(null);
    setMine((was) => new Map(was).set(key, { state, readyIn, at }));
    setUndoable((was) =>
      new Map(was).set(key, {
        courseId: line.courseId,
        key: line.key,
        was: line.item.state,
        to: state,
        tapKey: tap.key,
        at,
      }),
    );
    setKept(await keepServiceTap(store, tap));
    await send();
  };

  const undo = async (line: StationItemLine) => {
    const key = slot(line.courseId, line.key);
    const one = undoable.get(key);
    if (one == null) return;
    setUndoable((was) => {
      const next = new Map(was);
      next.delete(key);
      return next;
    });
    setMine((was) =>
      new Map(was).set(key, { state: one.was, readyIn: null, at: serverClock.now().getTime() }),
    );
    await send();
    let plan = undoPlan(one, await store.load(), lastReads.current);
    if (plan.kind === 'unknown') {
      await read().catch(() => undefined);
      plan = undoPlan(one, await store.load(), lastReads.current);
    }
    if (plan.kind === 'drop') {
      const left = (await store.load()).filter((tap) => tap.key !== plan.tapKey);
      await store.save(left);
      setKept(left);
      return;
    }
    if (plan.kind === 'send') {
      const tap = keptServiceTap(
        eventId,
        { kind: 'undo', subject: plan.subject },
        plan.expected,
        randomUUID(),
      );
      setKept(await keepServiceTap(store, tap));
      await send();
    }
  };

  const isKept = (line: StationItemLine) =>
    kept.some(
      (tap) =>
        tap.kind === 'itemState' &&
        tap.path.includes(encodeURIComponent(line.courseId)) &&
        tap.body.item === line.key,
    );

  const backLabel =
    from == null
      ? t('station.back')
      : from === 'overview'
        ? t('eventNav.overview')
        : t('myNight.title');

  const page = (children: ReactNode) => (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={[styles.body, phone && styles.bodyPhone]}>
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel={backLabel}
          style={[styles.back, { minHeight: z.side }]}
          testID="station.back"
        >
          {from == null ? (
            <Text size={15} weight="semibold" style={styles.accent}>
              {backLabel}
            </Text>
          ) : (
            <View style={styles.backTo}>
              <Text
                size={15}
                weight="semibold"
                style={styles.accent}
                importantForAccessibility="no"
              >
                ‹
              </Text>
              <Text size={15} weight="semibold" style={styles.accent}>
                {backLabel}
              </Text>
            </View>
          )}
        </Pressable>
        {children}
      </ScrollView>
    </View>
  );

  if (loaded.state === 'refused') {
    const r = loaded.access;
    return page(
      <View style={styles.refused} testID={`station.refused.${r}`}>
        <Text size={22} weight="bold" accessibilityRole="header">
          {t(`station.refused.${r}Title`)}
        </Text>
        <Text size={16} style={styles.secondary}>
          {t(`station.refused.${r}Line`)}
        </Text>
        <Quiet
          label={t('station.refused.back')}
          side={z.side}
          onPress={onBack}
          testID="station.refused.back"
        />
      </View>,
    );
  }

  if (loaded.state === 'failed') {
    return page(
      <View style={styles.refused} testID="station.failed">
        <Text size={16}>{t('station.failed')}</Text>
        <Quiet
          label={t('station.tryAgain')}
          side={z.side}
          onPress={() => void read().catch(() => undefined)}
          testID="station.tryAgain"
        />
      </View>,
    );
  }

  if (loaded.state === 'loading' || picked === undefined) return page(null);

  const list = loaded.list;
  const you = list.you;
  const listed: ListedStation[] = list.stations.map((one) => ({
    id: one.id,
    name: one.name,
    people:
      one.people.length === 0
        ? null
        : one.people
            .map((person) => (person.you ? t('station.you', { name: person.name }) : person.name))
            .join(', '),
  }));
  const strip = freshness == null ? null : <Strip freshness={freshness} time={time} />;
  const nameOf = (id: string | null) => list.stations.find((one) => one.id === id)?.name ?? '';

  if (station == null || view == null) {
    return page(
      <View style={styles.landing} testID="station.landing">
        <Text size={z.table} weight="bold" accessibilityRole="header">
          {t('station.pickTitle')}
        </Text>
        <Text size={16} style={styles.secondary}>
          {t('station.pickLine', { you })}
        </Text>
        {strip}
        <StationList current={null} stations={listed} side={z.side} onPick={pick} />
      </View>,
    );
  }

  const facing = <Facing view={view} z={z} time={time} />;
  const left = (
    <Left
      view={view}
      z={z}
      station={nameOf(station)}
      compact={kind === 'tabletPortrait'}
      choosing={choosing}
      onChoose={setChoosing}
      onMark={(line, state, readyIn) => void markItem(line, state, readyIn)}
      onUndo={(line) => void undo(line)}
      undoable={(line) => {
        const one = undoable.get(slot(line.courseId, line.key));
        return one != null && undoOpen(one, undoNow) ? one : null;
      }}
      isKept={isKept}
      time={time}
    />
  );
  const heading = <Heading view={view} z={z} />;

  return (
    <>
      {page(
        <>
          <View style={styles.header}>
            <Pressable
              ref={opener}
              onPress={() => setListOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={t('station.titleSaid', { station: nameOf(station) })}
              style={[styles.title, { minHeight: z.side }]}
              testID="station.title"
            >
              <Text
                size={phone ? 26 : 30}
                weight="bold"
                accessibilityRole="header"
                style={styles.titleWords}
              >
                {t('station.title', { station: nameOf(station) })}
              </Text>
              <Glyph paths={GLYPH.chevron} ink={tokens.colorInk} side={22} />
            </Pressable>
            <Text size={15} weight="medium" style={styles.secondary}>
              {t('station.headerLine', {
                you,
                course: view.latest ?? t('station.noCourseFired'),
                event: list.event,
              })}
            </Text>
            {strip}
          </View>
          {moved !== '' && (
            <View style={styles.moved} testID="station.moved">
              <Glyph paths={GLYPH.info} ink={tokens.colorAccentText} side={18} circle />
              <Text size={16} weight="semibold">
                {moved}
              </Text>
            </View>
          )}
          {notSent.length > 0 && (
            <View style={styles.notSent} accessibilityRole="alert" testID="station.notSent">
              <Text size={16} weight="bold">
                {t('service.notSent.heading')}
              </Text>
              {notSent.map((line, index) => (
                <Text key={index} size={16}>
                  {notSentLine(t, line, loaded.reads)}
                </Text>
              ))}
              <Quiet
                label={t('station.gotIt')}
                side={z.side}
                onPress={() => setNotSent([])}
                testID="station.notSent.ok"
              />
            </View>
          )}
          {kind === 'tabletLandscape' ? (
            <View style={styles.columns}>
              <View style={styles.main}>{facing}</View>
              <View style={styles.aside}>
                {left}
                {heading}
              </View>
            </View>
          ) : kind === 'tabletPortrait' ? (
            <View style={styles.stack}>
              {left}
              {facing}
              {heading}
            </View>
          ) : (
            <View style={styles.stack}>
              {facing}
              {left}
              {heading}
            </View>
          )}
        </>,
      )}
      <Sheet
        open={listOpen}
        onClose={() => setListOpen(false)}
        scrimLabel={t('station.closeList')}
        opener={opener}
        docked
        testID="station.sheet"
      >
        <View style={styles.sheet}>
          <Text size={22} weight="bold" accessibilityRole="header">
            {t('station.listTitle')}
          </Text>
          <Text size={15} style={styles.secondary}>
            {t('station.listLine', { event: list.event })}
          </Text>
          <StationList current={station} stations={listed} side={z.side} onPick={pick} />
          <Quiet
            label={t('station.close')}
            side={z.side}
            onPress={() => setListOpen(false)}
            testID="station.sheet.close"
          />
        </View>
      </Sheet>
    </>
  );
}

function Strip({ freshness, time }: { freshness: Freshness; time: (at: Date) => string }) {
  const { t } = useTranslation();
  const connected = freshness.state === 'connected';
  const words = t(freshnessKey(freshness), {
    time: freshness.state === 'notStarted' || freshness.asOf == null ? '' : time(freshness.asOf),
    count: freshness.state === 'noConnection' ? freshness.waiting : 0,
  });
  return (
    <View style={styles.strip} accessibilityRole="text" testID="station.strip">
      {connected ? (
        <View style={styles.dot} />
      ) : (
        <Glyph paths={GLYPH.offline} ink={tokens.colorInkSecondary} side={15} />
      )}
      <Text size={14} weight="medium" style={[styles.secondary, styles.shrink]}>
        {words}
      </Text>
    </View>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count?: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text size={19} weight="bold" accessibilityRole="header" style={styles.grow}>
          {title}
        </Text>
        {count != null && count !== '' && (
          <View style={styles.count}>
            <Text size={13} weight="semibold" style={styles.secondary}>
              {count}
            </Text>
          </View>
        )}
      </View>
      {children}
    </View>
  );
}

function Empty({ words }: { words: string }) {
  return (
    <View style={styles.empty}>
      <Text size={17} style={styles.secondary}>
        {words}
      </Text>
    </View>
  );
}

function itemName(t: TFunction, name: string | null, course: string | null): string {
  const item = name ?? t('station.chefsChoice');
  return course == null ? item : t('station.courseItem', { course, item });
}

function hereLine(t: TFunction, tray: StationTray, time: (at: string) => string): string {
  return tray.hereSince == null
    ? t('station.trayLine', { waiter: tray.waiter, count: tray.plates })
    : t('station.hereLine', {
        waiter: tray.waiter,
        count: tray.plates,
        time: time(tray.hereSince),
      });
}

function trayReading(
  t: TFunction,
  tray: StationTray,
  faced: readonly FacedPlate[],
  time: (at: string) => string,
): string {
  const seat = (plate: FacedPlate) => t('station.seat', { seat: plate.seat });
  const flagged = faced
    .filter((plate) => plate.flagged)
    .map((plate) =>
      t('station.saidFlaggedPlate', {
        seat: seat(plate),
        flags: flagWords(t, plate.flags).join(', '),
      }),
    );
  const plates = faced.map((plate) =>
    [
      seat(plate),
      plate.items.length === 0
        ? t('station.saidNothing')
        : plate.items.map((item) => itemName(t, item.name, item.course)).join(', '),
      plate.variant ?? '',
    ]
      .filter((words) => words !== '')
      .join(', '),
  );
  return [
    `${tray.table}, ${hereLine(t, tray, time).replaceAll(' · ', ', ')}`,
    flagged.length > 0 ? t('station.saidFlagged', { plates: flagged.join('; ') }) : '',
    t('station.saidFromLeft', { plates: plates.join('; ') }),
  ]
    .filter((words) => words !== '')
    .join('. ');
}

function Facing({ view, z, time }: { view: StationView; z: Sizes; time: (at: string) => string }) {
  const { t } = useTranslation();
  const trays = view.here;
  return (
    <Section
      title={t('station.asYouFace')}
      count={trays.length > 1 ? t('station.traysHere', { count: trays.length }) : ''}
    >
      {!view.fired ? (
        <Empty words={t('station.empty.noCourse')} />
      ) : trays.length === 0 ? (
        <Empty words={t('station.empty.noTray')} />
      ) : (
        trays.map((one, index) => {
          const first = index === 0 && trays.length > 1;
          return (
            <View
              key={one.tray.id}
              style={[styles.tray, first && styles.trayFirst]}
              accessible
              accessibilityLabel={`${first ? `${t('station.arrivedFirst')} ` : ''}${trayReading(t, one.tray, one.faced, time)}`}
              testID={`station.here.${one.tray.id}`}
            >
              <View style={styles.trayHead}>
                <View style={styles.grow}>
                  <Text size={z.table} weight="bold">
                    {one.tray.table}
                  </Text>
                  <Text size={z.line} weight="medium" style={styles.secondary}>
                    {hereLine(t, one.tray, time)}
                  </Text>
                </View>
                {one.tray.flagged > 0 && <FlaggedCount n={one.tray.flagged} />}
              </View>
              {one.faced.map((plate, at) => (
                <View key={plate.plateId} style={[styles.plate, at > 0 && styles.sep]}>
                  <View style={styles.pos}>
                    <Text size={15} weight="bold">
                      {String(plate.position)}
                    </Text>
                  </View>
                  <View style={styles.grow}>
                    <Text size={z.line} weight="semibold">
                      {[t('station.seat', { seat: plate.seat }), plate.variant ?? '']
                        .filter((words) => words !== '')
                        .join(' · ')}
                    </Text>
                    {plate.items.length === 0 ? (
                      <Text size={z.line} style={styles.secondary}>
                        {t('station.nothingFromHere')}
                      </Text>
                    ) : (
                      plate.items.map((item) => (
                        <View key={`${item.course ?? ''}|${item.key}`} style={styles.itemLine}>
                          <Text size={z.item} weight="bold" style={styles.grow}>
                            {itemName(t, item.name, item.course)}
                          </Text>
                          {item.mark === 'on' && <Chip status="on" big={!z.phone} />}
                          {item.mark === 'notOn' && <Chip status="off" big={!z.phone} />}
                          {item.preparing && item.mark == null && (
                            <Chip status="preparing" big={!z.phone} />
                          )}
                        </View>
                      ))
                    )}
                    {plate.flagged && <FlagLine flags={flagWords(t, plate.flags)} size={z.line} />}
                  </View>
                </View>
              ))}
            </View>
          );
        })
      )}
    </Section>
  );
}

function Left({
  view,
  z,
  station,
  compact,
  choosing,
  onChoose,
  onMark,
  onUndo,
  undoable,
  isKept,
  time,
}: {
  view: StationView;
  z: Sizes;
  station: string;
  compact: boolean;
  choosing: string | null;
  onChoose: (id: string | null) => void;
  onMark: (line: StationItemLine, state: ItemState, readyIn: Eta) => void;
  onUndo: (line: StationItemLine) => void;
  undoable: (line: StationItemLine) => StationMark | null;
  isKept: (line: StationItemLine) => boolean;
  time: (at: number) => string;
}) {
  const { t } = useTranslation();
  return (
    <Section title={t('station.leftToDish')}>
      {!view.fired ? (
        <Empty words={t('station.empty.noCourse')} />
      ) : view.left.length === 0 ? (
        <Empty words={t('station.empty.noItem', { station })} />
      ) : (
        <View style={styles.leftList}>
          {compact
            ? pairs(view.left).map((row) => (
                <View
                  key={row.map((line) => slot(line.courseId, line.key)).join('|')}
                  style={styles.leftStrip}
                >
                  {row.map(card)}
                  {row.length === 1 && <View style={styles.itemCardStrip} />}
                </View>
              ))
            : view.left.map(card)}
        </View>
      )}
    </Section>
  );

  function card(line: StationItemLine) {
    const id = slot(line.courseId, line.key);
    const name = itemName(t, line.name, line.course);
    const prep = line.item.state === 'preparing';
    const held = line.heldUp != null;
    const status = held ? 'heldUp' : prep ? 'preparing' : 'ready';
    const lineWords = [
      held
        ? t('station.heldUpFor', { count: line.heldUp ?? 0 })
        : prep && line.item.readyIn != null
          ? t('station.readyInLine', { count: line.item.readyIn })
          : '',
      prep && line.waiting > 0 ? t('station.waiting', { count: line.waiting }) : '',
    ].filter((words) => words !== '');
    const one = undoable(line);
    const chosen = prep ? ((line.item.readyIn ?? null) as Eta) : undefined;
    return (
      <View
        key={id}
        style={[styles.itemCard, compact && styles.itemCardStrip]}
        testID={`station.left.${line.key}`}
      >
        <View style={styles.itemHead}>
          <View style={styles.grow}>
            <Text size={z.line + 1} weight="bold">
              {name}
            </Text>
            <Text size={z.line} weight="semibold" style={styles.tabular}>
              {t('station.toDish', { count: line.toDish })}
            </Text>
          </View>
          <Chip status={status} big />
        </View>
        {lineWords.length > 0 && (
          <Text
            size={z.line - 2 < 15 ? 15 : z.line - 2}
            weight="semibold"
            style={held ? styles.broken : styles.attention}
          >
            {lineWords.join(' · ')}
          </Text>
        )}
        {isKept(line) && <Chip status="kept" />}
        <View style={styles.lineActions}>
          <View style={styles.segments}>
            <Segments
              item={name}
              id={line.key}
              preparing={prep || choosing === id}
              side={z.side}
              onReady={() => (prep ? onMark(line, 'ready', null) : onChoose(null))}
              onPreparing={() => onChoose(id)}
            />
          </View>
        </View>
        {(choosing === id || prep) && (
          <Times
            item={name}
            id={line.key}
            chosen={chosen}
            side={z.side}
            onPick={(eta) => onMark(line, 'preparing', eta)}
          />
        )}
        {one != null && (
          <View style={styles.undo}>
            <Text size={14} style={[styles.secondary, styles.grow]}>
              {t(undoWords(one), {
                time: time(one.at),
                count: UNDO_MINUTES,
              })}
            </Text>
            <Quiet
              label={t('station.undo')}
              side={z.side}
              onPress={() => onUndo(line)}
              testID={`station.undo.${line.key}`}
            />
          </View>
        )}
      </View>
    );
  }
}

function pairs<T>(all: readonly T[]): T[][] {
  const rows: T[][] = [];
  for (let at = 0; at < all.length; at += 2) rows.push(all.slice(at, at + 2));
  return rows;
}

function Heading({ view, z }: { view: StationView; z: Sizes }) {
  const { t } = useTranslation();
  const trays = view.heading;
  return (
    <Section
      title={t('station.headingHere')}
      count={trays.length > 0 ? t('station.trays', { count: trays.length }) : ''}
    >
      {!view.fired ? (
        <Empty words={t('station.empty.noCourse')} />
      ) : trays.length === 0 ? (
        <Empty words={t('station.empty.noHeading')} />
      ) : (
        <View style={styles.card}>
          {trays.map((tray, index) => {
            const counts = tray.needs.map((need) =>
              t('station.itemCount', {
                item: itemName(t, need.name, need.course),
                count: need.count,
              }),
            );
            return (
              <View
                key={tray.id}
                style={[styles.headRow, index > 0 && styles.sep]}
                accessible
                accessibilityLabel={[
                  tray.table,
                  tray.waiter,
                  ...counts,
                  tray.flagged > 0 ? t('station.flagged', { count: tray.flagged }) : '',
                ]
                  .filter((words) => words !== '')
                  .join(', ')}
                testID={`station.heading.${tray.id}`}
              >
                <View style={styles.headTop}>
                  <Text size={z.line + 3} weight="bold" style={styles.grow}>
                    {t('station.headingRow', { table: tray.table, waiter: tray.waiter })}
                  </Text>
                </View>
                <View style={styles.counts}>
                  {counts.map((words) => (
                    <Text key={words} size={z.line} weight="semibold">
                      {words}
                    </Text>
                  ))}
                  {tray.flagged > 0 && <FlaggedCount n={tray.flagged} />}
                </View>
              </View>
            );
          })}
        </View>
      )}
    </Section>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: tokens.colorPage },
  body: { padding: tokens.space3xl, gap: tokens.spaceXl, paddingBottom: 96 },
  bodyPhone: { padding: tokens.spaceXl, paddingBottom: 96 },
  back: { minHeight: tokens.sizeHit, justifyContent: 'center', alignSelf: 'flex-start' },
  backTo: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceXxs },
  accent: { color: tokens.colorAccentText },
  secondary: { color: tokens.colorInkSecondary },
  attention: { color: tokens.colorAttentionText },
  broken: { color: tokens.colorBrokenText },
  tabular: { fontVariant: ['tabular-nums'] },
  grow: { flex: 1, minWidth: 0 },
  header: { gap: tokens.spaceXs },
  title: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceSm,
    alignSelf: 'flex-start',
  },
  titleWords: { flexShrink: 1 },
  strip: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm, minHeight: 24 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: tokens.colorAccent },
  shrink: { flexShrink: 1 },
  landing: { gap: tokens.spaceMd },
  moved: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceSm,
    padding: tokens.spaceLg,
    borderRadius: tokens.radiusRow,
    backgroundColor: tokens.colorAccentTint,
  },
  notSent: {
    gap: tokens.spaceXs,
    padding: tokens.spaceXl,
    borderRadius: tokens.radiusCardPhone,
    backgroundColor: tokens.colorAttentionTint,
    borderWidth: 1,
    borderColor: tokens.colorAttentionBorder,
  },
  columns: { flexDirection: 'row', gap: tokens.space3xl, alignItems: 'flex-start' },
  main: { flex: 1, minWidth: 0 },
  aside: { width: 400, gap: tokens.space3xl },
  stack: { gap: tokens.space3xl },
  section: { gap: tokens.spaceSm },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceSm,
    minHeight: tokens.sizeHit,
  },
  count: {
    minHeight: 26,
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderRadius: tokens.radiusPill,
    backgroundColor: tokens.colorNeutralFill,
  },
  empty: {
    padding: tokens.spaceXl,
    borderRadius: tokens.radiusCardPhone,
    backgroundColor: tokens.colorInset,
    borderWidth: 1,
    borderColor: tokens.colorInsetBorder,
  },
  card: {
    paddingHorizontal: tokens.spaceXl,
    borderRadius: tokens.radiusCardPhone,
    backgroundColor: tokens.colorCard,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
  },
  tray: {
    padding: tokens.spaceXl,
    gap: tokens.spaceXs,
    marginBottom: tokens.spaceLg,
    borderRadius: tokens.radiusCardPhone,
    backgroundColor: tokens.colorCard,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
  },
  trayFirst: { borderWidth: 2, borderColor: tokens.colorAccent },
  trayHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spaceMd,
    paddingBottom: tokens.spaceSm,
  },
  plate: { flexDirection: 'row', gap: tokens.spaceLg, paddingVertical: tokens.spaceLg },
  sep: { borderTopWidth: 1, borderTopColor: tokens.colorBorder },
  pos: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorNeutralFill,
  },
  itemLine: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm, minHeight: 36 },
  leftList: { gap: tokens.spaceLg },
  leftStrip: { flexDirection: 'row', gap: tokens.spaceLg, alignItems: 'flex-start' },
  itemCard: {
    padding: tokens.spaceXl,
    gap: tokens.spaceSm,
    borderRadius: tokens.radiusCardPhone,
    backgroundColor: tokens.colorCard,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
  },
  itemCardStrip: { flex: 1, minWidth: 0 },
  itemHead: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceSm },
  undo: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm },
  lineActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: tokens.spaceSm,
  },
  segments: { flexGrow: 1, flexBasis: 200, minWidth: 0 },
  headRow: { paddingVertical: tokens.spaceLg, gap: tokens.spaceXs },
  headTop: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm },
  counts: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: tokens.spaceLg },
  sheet: { flexShrink: 1, gap: tokens.spaceMd, padding: tokens.space3xl },
  refused: {
    padding: tokens.space3xl,
    gap: tokens.spaceSm,
    borderRadius: tokens.radiusCardPhone,
    backgroundColor: tokens.colorCard,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
  },
});
