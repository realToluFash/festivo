import { ApiError, type CheckIn, type OrganisationEvent, realtimeTopic } from '@soirely/api-client';
import { REPLY_KEY, companionShown, replyDate } from '@soirely/domain';
import { type BarcodeScanningResult, CameraView, useCameraPermissions } from 'expo-camera';
import { CryptoDigestAlgorithm, digestStringAsync } from 'expo-crypto';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import { api } from '../api.ts';
import { followReadingAgain } from '../followTopic.ts';
import { currentLocale } from '../i18n/index.ts';
import { clockOf, countLine } from '../kit/checkIn.ts';
import {
  type ScanRead,
  type WaitingArrival,
  isCheckInCode,
  rescanned,
  scanned,
  sendWaiting,
  unwait,
  waitFor,
  withWaiting,
  zonedStamp,
} from '../kit/doorScan.ts';
import { keepList, keepWaiting, keptList, keptWaiting } from '../kit/doorStore.ts';
import { sidebarCardOf } from '../kit/eventTop.ts';
import { cardTags } from '../kit/eventsList.ts';
import { markOf } from '../kit/guestRows.ts';
import { useServerNow } from '../kit/serverNow.ts';
import type { LayoutKind } from '../layout/classify.ts';
import { useSignedIn } from '../signedIn.ts';
import { tokens } from '../theme/tokens.ts';
import { ArrivedButton } from './CheckInView.tsx';
import { usePhaseOf } from './Events.tsx';
import { Glass } from './Glass.tsx';
import { Glyph } from './Glyph.tsx';
import { GuestsCard } from './GuestsCard.tsx';
import { useReadOut } from './ReadOut.tsx';
import { DoorGlyph, MarkSlot } from './ReplyMark.tsx';
import { Pill } from './SettingsParts.tsx';
import { RowList, TextAction } from './Summary.tsx';
import { Text } from './Text.tsx';
import { useCoverStatusBar } from './Welcome.tsx';

/** The list is read again this often while the live channel is quiet, and while the device is offline. */
const READ_AGAIN_MS = 10_000;
const SIDE_PANEL = 420;
const UP_PANEL = 540;

/** What a scan brought up, kept by guest so an arrival recorded from it shows on it; `twice` when the guest had already arrived as the code was read. */
type Shown = { kind: 'guest'; guestId: string; twice: boolean } | { kind: 'notOnList' };

interface Person {
  id: string;
  name: string;
  companion: boolean;
  line: string;
  mark: 'arrived' | ReturnType<typeof markOf>;
  arrived: boolean;
}

/** The door's list on this device (sc-1301): kept for offline, read again and the waiting arrivals sent whenever the connection answers. */
function useDoorList(eventId: string, by: string | null) {
  const [list, setList] = useState<CheckIn | null>(null);
  const [restored, setRestored] = useState(false);
  const [offlineSince, setOfflineSince] = useState<Date | null>(null);
  const [waiting, setWaiting] = useState<WaitingArrival[]>([]);
  const waitingNow = useRef<WaitingArrival[]>([]);
  const live = useRef(true);

  const changeWaiting = useCallback(
    (change: (was: WaitingArrival[]) => WaitingArrival[]) => {
      const next = change(waitingNow.current);
      waitingNow.current = next;
      setWaiting(next);
      void keepWaiting(eventId, next);
    },
    [eventId],
  );

  const shown = useCallback(
    (checkIn: CheckIn) => {
      if (!live.current) return;
      setList(checkIn);
      setOfflineSince(null);
      void keepList(eventId, { checkIn, savedAt: new Date().toISOString() });
    },
    [eventId],
  );

  const lost = useCallback((error: unknown) => {
    if (!live.current || error instanceof ApiError) return;
    setOfflineSince((was) => was ?? new Date());
  }, []);

  const read = useCallback(async () => {
    try {
      let checkIn = await api.checkIn(eventId);
      const sending = waitingNow.current;
      if (sending.length > 0) {
        const sent = await sendWaiting(
          sending,
          (one) => api.arrive(eventId, one.guestId, one.at),
          (error) => error instanceof ApiError,
        );
        const done = new Set(
          sending.slice(0, sending.length - sent.left.length).map((one) => one.guestId),
        );
        changeWaiting((was) => was.filter((one) => !done.has(one.guestId)));
        if (sent.checkIn != null) checkIn = sent.checkIn;
        if (sent.left.length > 0) {
          lost(new Error('offline'));
          if (live.current) setList(checkIn);
          return;
        }
      }
      shown(checkIn);
    } catch (error) {
      lost(error);
    }
  }, [eventId, changeWaiting, lost, shown]);

  useEffect(() => {
    live.current = true;
    void Promise.all([keptList(eventId), keptWaiting(eventId)]).then(([kept, held]) => {
      if (!live.current) return;
      waitingNow.current = held;
      setWaiting(held);
      setList((was) => was ?? kept?.checkIn ?? null);
      setRestored(true);
      void read();
    });
    const stop = followReadingAgain(
      realtimeTopic('EventCheckIn', eventId),
      () => api.checkInSubscription(eventId),
      () => void read(),
      READ_AGAIN_MS,
    );

    return () => {
      live.current = false;
      stop();
    };
  }, [eventId, read]);

  /** Arrived: sent at once while online; offline, or when the send finds no connection, kept on the device with its time. */
  const arrive = async (personId: string): Promise<'recorded' | 'refused'> => {
    if (list == null) return 'refused';
    const keep = () =>
      changeWaiting((was) =>
        waitFor(was, { guestId: personId, at: zonedStamp(new Date(), list.timeZone), by }),
      );
    if (offlineSince != null) {
      keep();
      return 'recorded';
    }
    try {
      shown(await api.arrive(eventId, personId));
      return 'recorded';
    } catch (error) {
      if (error instanceof ApiError) return 'refused';
      lost(error);
      keep();
      return 'recorded';
    }
  };

  const undo = async (personId: string): Promise<'undone' | 'refused'> => {
    if (waitingNow.current.some((one) => one.guestId === personId)) {
      changeWaiting((was) => unwait(was, personId));
      return 'undone';
    }
    try {
      shown(await api.undoArrival(eventId, personId));
      return 'undone';
    } catch (error) {
      lost(error);
      return 'refused';
    }
  };

  return {
    checkIn: list == null ? null : withWaiting(list, waiting),
    restored,
    offlineSince,
    waiting: waiting.length,
    arrive,
    undo,
  };
}

function peopleOf(
  t: ReturnType<typeof useTranslation>['t'],
  read: Extract<ScanRead, { kind: 'guest' }>,
  timeZone: string,
  twice: boolean,
): Person[] {
  const arrivedLine = (arrival: { at: string; by: string | null }) =>
    arrival.by == null
      ? t('checkIn.arrivedAt', { time: clockOf(arrival.at) })
      : t('checkIn.arrivedAtBy', { time: clockOf(arrival.at), name: arrival.by });
  const { guest } = read;
  const word = t(REPLY_KEY[guest.reply]);
  const hostLine =
    guest.arrival != null
      ? twice
        ? arrivedLine(guest.arrival)
        : `${word} · ${arrivedLine(guest.arrival)}`
      : read.notComingSince != null
        ? t('guestList.replied', {
            reply: word,
            date: replyDate(read.notComingSince, timeZone, currentLocale()),
          })
        : word;
  const names = guest.companions.map((one) => one.fullName);

  return [
    {
      id: guest.id,
      name: guest.fullName,
      companion: false,
      line: hostLine,
      mark: guest.arrival != null ? 'arrived' : markOf(guest.reply),
      arrived: guest.arrival != null,
    },
    ...guest.companions.map((one, at) => ({
      id: one.id,
      name: companionShown(t, guest.fullName, names, at),
      companion: true,
      line:
        one.arrival != null
          ? t('checkIn.scan.companionLine', { line: arrivedLine(one.arrival) })
          : one.state === 'held'
            ? t('checkIn.scan.companionHeld')
            : t('checkIn.scan.companionLine', { line: t(REPLY_KEY[one.state]) }),
      mark: one.arrival != null ? ('arrived' as const) : markOf(one.state),
      arrived: one.arrival != null,
    })),
  ];
}

function saidOf(people: readonly Person[], twice: boolean, nothingNew: string): string {
  return people
    .map((one) => `${one.name}, ${one.line}`)
    .concat(twice ? [nothingNew] : [])
    .join('. ');
}

/** The not-on-list mark: a slash in a ring, as the demo draws it. */
function NotListedMark() {
  return (
    <View
      style={styles.disc}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
        <Circle cx={12} cy={12} r={9} stroke={tokens.colorInk} strokeWidth={2.3} />
        <Path
          d="m5.8 18.2 12.4-12.4"
          stroke={tokens.colorInk}
          strokeWidth={2.3}
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
}

function WarningMark() {
  return (
    <View
      style={[styles.bigDisc, styles.amberDisc]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
        <Path
          d="M12 3.5 2.8 19.5h18.4zM12 10v4.5M12 17.2v.01"
          stroke={tokens.colorAttentionText}
          strokeWidth={2.2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
}

/** A result: the door's own row, larger, companions under it with their own Arrived; or the one answer for a code not on the list. */
function Result({
  people,
  twice,
  undoable,
  big,
  onArrive,
  onUndo,
  onNext,
  onSearch,
}: {
  people: readonly Person[] | null;
  twice: boolean;
  undoable: ReadonlySet<string>;
  big: boolean;
  onArrive: (person: Person) => void;
  onUndo: (person: Person) => void;
  onNext: () => void;
  onSearch: () => void;
}) {
  const { t } = useTranslation();
  const buttonHeight = big ? tokens.sizeHitPhoneHero : 48;
  const next = (
    <Pill
      label={t('checkIn.scan.next')}
      kind="secondary"
      height={buttonHeight}
      onPress={onNext}
      testID="scan.next"
    />
  );

  if (people == null)
    return (
      <View style={styles.result} testID="scan.result.notOnList">
        <View style={styles.answer}>
          <NotListedMark />
          <Text
            size={17}
            weight="semibold"
            accessibilityRole="header"
            style={[styles.grow, styles.answerWords]}
          >
            {t('checkIn.scan.notOnList')}
          </Text>
        </View>
        <Pill
          label={t('checkIn.searchByName')}
          glyph="search"
          height={buttonHeight}
          onPress={onSearch}
          testID="scan.searchByName"
        />
        {next}
      </View>
    );

  const trailOf = (p: Person): ReactNode => {
    if (!p.arrived)
      return <ArrivedButton name={p.name} id={p.id} big={big} onPress={() => onArrive(p)} />;
    if (!undoable.has(p.id)) return null;
    return (
      <TextAction
        label={t('checkIn.undo')}
        plain
        onPress={() => onUndo(p)}
        accessibilityLabel={t('checkIn.undoFor', { name: p.name })}
        testID={`scan.undo.${p.id}`}
      />
    );
  };

  return (
    <View style={styles.result} testID="scan.result.guest">
      <RowList
        items={people.map((p) => ({
          key: p.id,
          inset: p.companion ? 80 : 40,
          row: p.companion ? (
            <View style={[styles.indent, styles.row]}>
              <MarkSlot kind={p.mark} side={22} />
              <View style={styles.grow}>
                <Text size={16} weight="semibold" style={styles.compName}>
                  {p.name}
                </Text>
                <Text size={14} weight="medium" style={[styles.secondary, styles.figures]}>
                  {p.line}
                </Text>
              </View>
              {trailOf(p)}
            </View>
          ) : (
            <View style={styles.row}>
              <View style={styles.hostLead}>
                <MarkSlot kind={p.mark} side={24} />
              </View>
              <View style={styles.grow}>
                <Text size={20} weight="bold" accessibilityRole="header" style={styles.name}>
                  {p.name}
                </Text>
                <Text size={15} weight="medium" style={[styles.secondary, styles.figures]}>
                  {p.line}
                </Text>
              </View>
              {trailOf(p)}
            </View>
          ),
        }))}
      />
      {twice && (
        <View style={styles.info}>
          <Glyph name="info" size={15} ink={tokens.colorInk} weight={2.1} />
          <Text size={15} weight="medium" style={[styles.grow, styles.body]}>
            {t('checkIn.scan.nothingNew')}
          </Text>
        </View>
      )}
      {next}
    </View>
  );
}

/** The camera refused, or no list on a device that has never had a connection: a heading, its line, and what can be done. */
function Closed({
  cameraOff,
  big,
  onSearch,
}: {
  cameraOff: boolean;
  big: boolean;
  onSearch: () => void;
}) {
  const { t } = useTranslation();
  const buttonHeight = big ? tokens.sizeHitPhoneHero : 48;

  return (
    <View style={styles.result} testID={cameraOff ? 'scan.result.cameraOff' : 'scan.result.noList'}>
      {cameraOff ? (
        <View
          style={styles.bigDisc}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Glyph name="camera" size={22} ink={tokens.colorInk} weight={2.2} />
        </View>
      ) : (
        <WarningMark />
      )}
      <Text size={20} weight="bold" accessibilityRole="header" style={styles.head}>
        {cameraOff ? t('checkIn.scan.cameraOffTitle') : t('checkIn.scan.noListTitle')}
      </Text>
      <Text size={15} weight="medium" style={[styles.secondary, styles.body]}>
        {cameraOff ? t('checkIn.scan.cameraOffBody') : t('checkIn.scan.noListBody')}
      </Text>
      {cameraOff && (
        <>
          <Pill
            label={t('checkIn.scan.openSettings')}
            height={buttonHeight}
            onPress={() => void Linking.openSettings()}
            testID="scan.openSettings"
          />
          <Pill
            label={t('checkIn.searchByName')}
            kind="secondary"
            glyph="search"
            height={buttonHeight}
            onPress={onSearch}
            testID="scan.searchByName"
          />
        </>
      )}
    </View>
  );
}

function OfflineStrip({ words }: { words: string }) {
  return (
    <View style={styles.strip} testID="scan.offline">
      <Glyph name="alert" size={17} ink={tokens.colorAttentionText} weight={2.3} />
      <Text size={14.5} weight="semibold" style={[styles.grow, styles.figures, styles.stripWords]}>
        {words}
      </Text>
    </View>
  );
}

function CountChip({ words }: { words: string }) {
  return (
    <View accessible accessibilityLabel={words} testID="scan.count">
      <Glass height={36} style={styles.chip}>
        <DoorGlyph side={16} ink={tokens.colorInkOnDark} />
        <Text size={15} weight="semibold" accessible={false} style={[styles.white, styles.figures]}>
          {words}
        </Text>
      </Glass>
    </View>
  );
}

function Viewfinder({ side }: { side: number }) {
  return (
    <View style={[styles.finder, { width: side, height: side }]} pointerEvents="none">
      {(['tl', 'tr', 'br', 'bl'] as const).map((at) => (
        <View key={at} style={[styles.corner, CORNER[at]]} />
      ))}
    </View>
  );
}

/** Scan a code (sc-1301): the camera under ‹ Check-in, the count, the viewfinder, and each result said as a polite status. */
export function ScannerView({
  eventId,
  kind,
  onBack,
  onSearch,
}: {
  eventId: string;
  kind: LayoutKind;
  onBack: () => void;
  /** Search by name: back on Check-in, in its search. */
  onSearch: () => void;
}) {
  const { t } = useTranslation();
  useCoverStatusBar('light', false);
  const insets = useSafeAreaInsets();
  const { account } = useSignedIn();
  const door = useDoorList(eventId, account?.name ?? null);
  const [permission, requestPermission] = useCameraPermissions();
  const [shownScan, setShownScan] = useState<Shown | null>(null);
  const [undoable, setUndoable] = useState<ReadonlySet<string>>(new Set());
  const [told, setTold] = useState<{ words: string; tap: number } | null>(null);
  const reading = useRef(false);
  const [event, setEvent] = useState<OrganisationEvent | null>(null);
  const now = useServerNow();
  const phase = usePhaseOf(event, now);
  const big = kind === 'phone';
  const tell = (words: string) => setTold((was) => ({ words, tap: (was?.tap ?? 0) + 1 }));
  useReadOut(told?.words ?? null, { answer: told?.tap });

  const asked = useRef(false);
  useEffect(() => {
    if (permission?.status !== 'undetermined' || asked.current) return;
    asked.current = true;
    void requestPermission();
  }, [permission, requestPermission]);

  useEffect(() => {
    if (kind !== 'tabletLandscape') return;
    let current = true;
    void api.event(eventId).then(
      (one) => current && setEvent(one),
      () => undefined,
    );

    return () => {
      current = false;
    };
  }, [eventId, kind]);

  const checkIn = door.checkIn;
  const cameraOff = permission?.status === 'denied';
  const noList = door.restored && checkIn == null && door.offlineSince != null;
  const cameraOpen = permission?.granted === true && checkIn != null;
  const nothingNew = t('checkIn.scan.nothingNew');

  const read =
    shownScan == null || checkIn == null
      ? null
      : shownScan.kind === 'notOnList'
        ? ({ kind: 'notOnList' } as const)
        : rescanned(checkIn, shownScan.guestId);
  const people =
    read?.kind === 'guest' && shownScan?.kind === 'guest'
      ? peopleOf(t, read, checkIn?.timeZone ?? 'UTC', shownScan.twice)
      : null;

  const onScanned = ({ data }: BarcodeScanningResult) => {
    if (reading.current || shownScan != null || checkIn == null) return;
    reading.current = true;
    const answer = (found: ScanRead) => {
      reading.current = false;
      setUndoable(new Set());
      if (found.kind === 'notOnList') {
        setShownScan({ kind: 'notOnList' });
        tell(t('checkIn.scan.notOnList'));
        return;
      }
      const twice = found.arrived != null;
      setShownScan({ kind: 'guest', guestId: found.guest.id, twice });
      tell(saidOf(peopleOf(t, found, checkIn.timeZone, twice), twice, nothingNew));
    };
    if (!isCheckInCode(data)) {
      answer({ kind: 'notOnList' });
      return;
    }
    void digestStringAsync(CryptoDigestAlgorithm.SHA256, data).then(
      (digest) => answer(scanned(checkIn, digest)),
      () => answer({ kind: 'notOnList' }),
    );
  };

  const arrive = (person: Person) => {
    void door.arrive(person.id).then((done) => {
      if (done === 'recorded') {
        setUndoable((was) => new Set(was).add(person.id));
        tell(t('checkIn.arrivedName', { name: person.name }));
      } else tell(t('checkIn.notRecorded'));
    });
  };
  const undo = (person: Person) => {
    void door.undo(person.id).then((done) => {
      if (done === 'undone') {
        setUndoable((was) => {
          const next = new Set(was);
          next.delete(person.id);
          return next;
        });
        tell(t('checkIn.undone'));
      } else tell(t('checkIn.notRecorded'));
    });
  };

  const offlineWords =
    door.offlineSince == null || checkIn == null
      ? null
      : door.waiting === 0
        ? t('checkIn.scan.offlineSince', {
            time: clockOf(zonedStamp(door.offlineSince, checkIn.timeZone)),
          })
        : t('checkIn.scan.offlineWaiting', {
            time: clockOf(zonedStamp(door.offlineSince, checkIn.timeZone)),
            count: door.waiting,
          });
  const countWords = checkIn == null ? null : countLine(t, checkIn.count);

  const panel =
    cameraOff || noList ? (
      <Closed cameraOff={cameraOff} big={big} onSearch={onSearch} />
    ) : shownScan == null || read == null ? null : (
      <Result
        key={shownScan.kind === 'guest' ? shownScan.guestId : 'notOnList'}
        people={people}
        twice={shownScan.kind === 'guest' && shownScan.twice}
        undoable={undoable}
        big={big}
        onArrive={arrive}
        onUndo={undo}
        onNext={() => setShownScan(null)}
        onSearch={onSearch}
      />
    );
  const strip = offlineWords == null ? null : <OfflineStrip words={offlineWords} />;
  const paused = panel != null;
  const camera =
    cameraOpen && !cameraOff ? (
      <>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={paused ? undefined : onScanned}
          testID="scan.camera"
        />
        {paused && <View style={styles.dim} pointerEvents="none" />}
      </>
    ) : null;
  const hint = (
    <Glass height={36} style={styles.hint}>
      <Text size={15} weight="semibold" accessible={false} style={styles.white}>
        {t('checkIn.scan.pointAtCode')}
      </Text>
    </Glass>
  );
  const top = (
    <View style={[styles.top, kind === 'tabletLandscape' && styles.topWide]}>
      <Pressable
        onPress={onBack}
        style={({ pressed }) => [styles.glassBack, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={t('frame.backTo', { place: t('checkIn.title') })}
        testID="scan.back"
      >
        <Glass height={44} style={styles.backGlass}>
          <Glyph name="back" size={18} ink={tokens.colorInkOnDark} weight={2.4} />
          <Text size={15} weight="semibold" accessible={false} style={styles.white}>
            {t('checkIn.title')}
          </Text>
        </Glass>
      </Pressable>
      <View style={styles.title} pointerEvents="none">
        <Text size={17} weight="bold" accessibilityRole="header" style={styles.white}>
          {t('checkIn.scan.title')}
        </Text>
      </View>
    </View>
  );

  if (kind === 'tabletLandscape') {
    const shownEvent = event == null ? null : sidebarCardOf(event, phase);
    return (
      <View style={styles.side} testID="scan.screen">
        <View
          style={[
            styles.camera,
            styles.grow,
            camera == null && styles.closed,
            { paddingTop: insets.top },
          ]}
        >
          {camera}
          {top}
          {cameraOpen && (
            <View style={styles.room} pointerEvents="none">
              <Viewfinder side={360} />
              {!paused && hint}
            </View>
          )}
        </View>
        <ScrollView
          style={styles.sidePanel}
          contentContainerStyle={[styles.sideBody, { paddingTop: insets.top + 22 }]}
        >
          {!noList && checkIn != null && (
            <GuestsCard
              kind={kind}
              event={shownEvent}
              tags={shownEvent == null ? [] : cardTags(shownEvent, now, t)}
              says={countWords ?? ''}
              arrived={
                checkIn.count.attended > 0 && checkIn.count.expected > 0
                  ? { attended: checkIn.count.attended, expected: checkIn.count.expected }
                  : null
              }
              line={t('checkIn.openedAt', { time: clockOf(checkIn.opensAt) })}
              step={null}
            />
          )}
          {strip}
          {panel ?? (
            <Text size={20} weight="bold" style={styles.head}>
              {t('checkIn.scan.pointAtCode')}
            </Text>
          )}
        </ScrollView>
      </View>
    );
  }

  const portrait = kind === 'tabletPortrait';
  return (
    <View
      style={[styles.camera, camera == null && styles.closed, { paddingTop: insets.top }]}
      testID="scan.screen"
    >
      {camera}
      {top}
      <View style={[styles.under, portrait && [styles.underWide, { top: insets.top + 10 }]]}>
        {countWords != null && !noList && <CountChip words={countWords} />}
        {strip}
      </View>
      {cameraOpen && (
        <View style={styles.room} pointerEvents="none">
          <Viewfinder side={portrait ? 340 : 248} />
          {!paused && hint}
        </View>
      )}
      {panel != null && (
        <View
          style={
            portrait
              ? [styles.float, { bottom: Math.max(insets.bottom, 36) }]
              : [styles.sheet, { paddingBottom: Math.max(insets.bottom, 34) }]
          }
        >
          {!portrait && <View style={styles.grip} />}
          {panel}
        </View>
      )}
    </View>
  );
}

const CORNER = {
  tl: { left: 0, top: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 18 },
  tr: { right: 0, top: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 18 },
  br: {
    right: 0,
    bottom: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 18,
  },
  bl: { left: 0, bottom: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 18 },
} as const;

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  white: { color: tokens.colorInkOnDark },
  secondary: { color: tokens.colorInkSecondary },
  figures: { fontVariant: ['tabular-nums'] },
  body: { lineHeight: 15 * 1.45 },
  head: { lineHeight: 25, letterSpacing: 20 * -0.01 },
  camera: { flex: 1, backgroundColor: tokens.colorDark },
  closed: { backgroundColor: tokens.colorDarkInset },
  side: { flex: 1, flexDirection: 'row', backgroundColor: tokens.colorDark },
  top: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spaceLg,
  },
  topWide: { height: 64, paddingHorizontal: tokens.spaceXxl },
  glassBack: { zIndex: 2 },
  backGlass: { gap: tokens.spaceXxs, paddingLeft: tokens.spaceMd, paddingRight: tokens.spaceXl },
  pressed: { opacity: tokens.opacityPressed },
  title: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  under: {
    gap: tokens.spaceMd,
    paddingTop: tokens.spaceXs,
    paddingHorizontal: tokens.spaceXxl,
    alignItems: 'flex-start',
  },
  underWide: { position: 'absolute', right: tokens.spaceXxl, alignItems: 'flex-end' },
  chip: { gap: 7, paddingLeft: tokens.spaceMd, paddingRight: 14 },
  hint: { paddingHorizontal: tokens.spaceLg },
  room: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18 },
  finder: { alignItems: 'center', justifyContent: 'center' },
  corner: { position: 'absolute', width: 42, height: 42, borderColor: tokens.colorInkOnDark },
  dim: { ...StyleSheet.absoluteFillObject, backgroundColor: tokens.colorInk, opacity: 0.38 },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    gap: tokens.spaceLg,
    paddingTop: 10,
    paddingHorizontal: tokens.spaceXxl,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    backgroundColor: tokens.colorCard,
  },
  grip: {
    width: 38,
    height: 5,
    borderRadius: 3,
    alignSelf: 'center',
    backgroundColor: tokens.colorBorder,
  },
  float: {
    position: 'absolute',
    alignSelf: 'center',
    width: UP_PANEL,
    paddingTop: 22,
    paddingBottom: tokens.spaceXxl,
    paddingHorizontal: tokens.spaceXxl,
    borderRadius: 28,
    backgroundColor: tokens.colorCard,
  },
  sidePanel: {
    width: SIDE_PANEL,
    flexGrow: 0,
    backgroundColor: tokens.colorCard,
    borderTopLeftRadius: 24,
  },
  sideBody: { gap: 18, paddingHorizontal: tokens.spaceXxl, paddingBottom: tokens.spaceXxl },
  result: { gap: 14 },
  answer: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  answerWords: { lineHeight: 17 * 1.4, paddingTop: 1 },
  disc: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorInset,
  },
  bigDisc: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorInset,
  },
  amberDisc: {
    backgroundColor: tokens.colorAttentionTint,
    borderWidth: 1.5,
    borderColor: tokens.colorAttentionBorder,
  },
  row: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  hostLead: { width: 28, alignItems: 'center', alignSelf: 'flex-start', paddingTop: 2 },
  name: { lineHeight: 25, letterSpacing: 20 * -0.01, marginBottom: 4 },
  compName: { lineHeight: 16 * 1.3, marginBottom: 3 },
  indent: { paddingLeft: 40 },
  info: { flexDirection: 'row', alignItems: 'flex-start', gap: 7 },
  strip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    paddingVertical: 12,
    paddingHorizontal: tokens.spaceLg,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: tokens.colorAttentionBorder,
    backgroundColor: tokens.colorAttentionTint,
  },
  stripWords: { lineHeight: 14.5 * 1.4, color: tokens.colorInk },
});
