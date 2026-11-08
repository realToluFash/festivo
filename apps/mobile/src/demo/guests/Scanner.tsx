import { formattingLocale } from '@soirely/domain';
import { getLocales } from 'expo-localization';
import { type Href, router } from 'expo-router';
import { type ReactNode, useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import { Glyph } from '../../components/Glyph.tsx';
import { useReadOut } from '../../components/ReadOut.tsx';
import { useTranslation } from 'react-i18next';

import { Pill } from '../../components/SettingsParts.tsx';
import { useShell } from '../../components/settingsShell.ts';
import { RowList, TextAction } from '../../components/Summary.tsx';
import { Text } from '../../components/Text.tsx';
import { Glass } from '../../components/TodayCover.tsx';
import { tokens } from '../../theme/tokens.ts';
import { DoorQr } from '../doorCode/DoorQr.tsx';
import { shownEvent } from '../events/EventsModel.ts';
import { sampleEvent } from '../events/EventsSample.ts';
import { useCoverStatusBar } from '../Welcome.tsx';
import { ArrivedButton } from './CheckIn.tsx';
import { clockOf, replyLine } from './GuestsModel.ts';
import { GuestsCard } from './GuestsParts.tsx';
import { ARRIVALS, GUESTS, READER, WEDDING, replyByOf } from './GuestsSample.ts';
import { REPLY_WORD, W, say } from './GuestsWords.ts';
import { DoorGlyph, MarkSlot } from './ReplyMark.tsx';
import {
  NOW_AT,
  OFFLINE_SINCE,
  type ScanResult,
  type ScanState,
  type Scanned,
  countAfter,
  isOffline,
  nextRead,
  readOf,
  resultOf,
} from './ScanModel.ts';

const SIDE_PANEL = 420;
const UP_PANEL = 540;
/** The held code the stand-in camera shows: a code holds nothing a camera could read out, so the drawn one is a pattern. */
const HELD = 'K7Q2-M9XR';

/** The code the state shows last read, so the next one read follows it; none read yet while scanning. */
function lastOf(state: ScanState | null): string | null | undefined {
  if (state === 'valid' || state === 'arrivedFromScan') return 'ines';
  if (state === 'validHeld') return 'folasade';
  if (state === 'alreadyArrived') return 'musa';
  if (state === 'notComingNow') return 'camille';
  if (state === 'notOnList' || state === 'offlineNotOnList') return null;
  return undefined;
}

function leave(): void {
  if (router.canGoBack()) router.back();
  else router.replace('/demo/guests/check-in?state=door' as Href);
}

function lineOf(p: Scanned, locale: string, twice: boolean): string {
  if (p.arrivedAt != null) {
    const at = say.arrivedAt(p.arrivedAt, p.by ?? '');
    if (p.companion) return say.companionOf(at);
    return twice ? at : `${REPLY_WORD[p.kind]} · ${at}`;
  }
  if (p.companion) return p.kind === 'held' ? W.companionHeld : say.companionOf(REPLY_WORD[p.kind]);
  const g = GUESTS.find((one) => one.key === p.key);
  return g == null ? REPLY_WORD[p.kind] : replyLine(g, locale, replyByOf(WEDDING));
}

function saidOf(result: ScanResult, locale: string): string {
  if (result.kind === 'notOnList') return W.notOnList;
  if (result.kind === 'noList') return `${W.noListTitle}. ${W.noListBody}`;
  if (result.kind === 'cameraOff') return `${W.cameraOffTitle}. ${W.cameraOffBody}`;
  const [host, ...rest] = result.people;
  if (host == null) return '';
  return [
    `${host.name}, ${lineOf(host, locale, result.twice)}`,
    ...rest.map((p) => `${p.name}, ${lineOf(p, locale, false)}`),
  ]
    .concat(result.twice ? [W.nothingNew] : [])
    .join('. ');
}

/** The not-on-list mark: a slash in a ring, drawn here (the product's icon set has none). */
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

/** The amber warning triangle the no-list state leads with (sc-1301, 21 Oct). */
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

/** The result: the door's own row, larger; companions under it with their own Arrived; then Scan the next code. */
function Result({
  result,
  locale,
  big,
  onArrive,
  onUndo,
  onNext,
}: {
  result: ScanResult;
  locale: string;
  big: boolean;
  onArrive: (key: string) => void;
  onUndo: (key: string) => void;
  onNext: () => void;
}) {
  const said = saidOf(result, locale);
  useReadOut(said);
  const buttonHeight = big ? tokens.sizeHitPhoneHero : 48;
  const next = (
    <Pill
      label={W.scanNext}
      kind="secondary"
      height={buttonHeight}
      onPress={onNext}
      testID="scan.next"
    />
  );

  if (result.kind === 'notOnList')
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
            {W.notOnList}
          </Text>
        </View>
        <Pill
          label={W.searchByName}
          glyph="search"
          height={buttonHeight}
          onPress={leave}
          testID="scan.searchByName"
        />
        {next}
      </View>
    );
  if (result.kind === 'noList' || result.kind === 'cameraOff') {
    const cameraOff = result.kind === 'cameraOff';
    return (
      <View style={styles.result} testID={`scan.result.${result.kind}`}>
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
          {cameraOff ? W.cameraOffTitle : W.noListTitle}
        </Text>
        <Text size={15} weight="medium" style={[styles.secondary, styles.body]}>
          {cameraOff ? W.cameraOffBody : W.noListBody}
        </Text>
        {cameraOff && (
          <>
            <Pill
              label={W.openSettings}
              height={buttonHeight}
              onPress={() => void Linking.openSettings()}
              testID="scan.openSettings"
            />
            <Pill
              label={W.searchByName}
              kind="secondary"
              glyph="search"
              height={buttonHeight}
              onPress={leave}
              testID="scan.searchByName"
            />
          </>
        )}
      </View>
    );
  }

  const [host, ...companions] = result.people;
  if (host == null) return null;
  const trailOf = (p: Scanned): ReactNode => {
    if (p.arrivedAt == null)
      return <ArrivedButton name={p.name} big={big} onPress={() => onArrive(p.key)} />;
    if (result.twice) return null;
    return (
      <TextAction
        label={W.undoArrival}
        plain
        onPress={() => onUndo(p.key)}
        accessibilityLabel={`${W.undoArrival}, ${p.name}`}
        testID={`scan.undo.${p.key}`}
      />
    );
  };
  const lead = (p: Scanned) => (
    <MarkSlot kind={p.arrivedAt != null ? 'arrived' : p.kind} side={p.companion ? 22 : 24} />
  );

  return (
    <View style={styles.result} testID="scan.result.guest">
      <RowList
        items={[
          {
            key: host.key,
            inset: 40,
            row: (
              <View style={styles.hostRow}>
                <View style={styles.hostLead}>{lead(host)}</View>
                <View style={styles.grow}>
                  <Text size={20} weight="bold" accessibilityRole="header" style={styles.name}>
                    {host.name}
                  </Text>
                  <Text size={15} weight="medium" style={[styles.secondary, styles.figures]}>
                    {lineOf(host, locale, result.twice)}
                  </Text>
                </View>
                {trailOf(host)}
              </View>
            ),
          },
          ...companions.map((p) => ({
            key: p.key,
            inset: 80,
            row: (
              <View style={[styles.indent, styles.compRow]}>
                {lead(p)}
                <View style={styles.grow}>
                  <Text size={16} weight="semibold" style={styles.compName}>
                    {p.name}
                  </Text>
                  <Text size={14} weight="medium" style={[styles.secondary, styles.figures]}>
                    {lineOf(p, locale, false)}
                  </Text>
                </View>
                {result.twice && p.arrivedAt != null ? null : trailOf(p)}
              </View>
            ),
          })),
        ]}
      />
      {result.twice && (
        <View style={styles.info}>
          <Glyph name="info" size={15} ink={tokens.colorInk} weight={2.1} />
          <Text size={15} weight="medium" style={[styles.grow, styles.body]}>
            {W.nothingNew}
          </Text>
        </View>
      )}
      {next}
    </View>
  );
}

function OfflineStrip({ waiting, width }: { waiting: number; width: number | null }) {
  return (
    <View style={[styles.strip, width == null ? null : { width }]} testID="scan.offline">
      <Glyph name="alert" size={17} ink={tokens.colorAttentionText} weight={2.3} />
      <Text size={14.5} weight="semibold" style={[styles.grow, styles.figures, styles.stripWords]}>
        {say.offlineSince(OFFLINE_SINCE, waiting)}
      </Text>
    </View>
  );
}

function CountChip({ arrived, expected }: { arrived: number; expected: number }) {
  return (
    <View accessible accessibilityLabel={say.arrivedSaid(arrived, expected)} testID="scan.count">
      <Glass height={36} style={styles.chip}>
        <DoorGlyph side={16} ink={tokens.colorInkOnDark} />
        <Text size={15} weight="semibold" accessible={false} style={[styles.white, styles.figures]}>
          {`${say.arrivedOf(arrived, expected)} ${W.arrived}`}
        </Text>
      </Glass>
    </View>
  );
}

/** The stand-in camera: the viewfinder with the guest's phone held up in it. Pressing it reads the next code, as a camera would. */
function Viewfinder({ side, onRead, open }: { side: number; onRead: () => void; open: boolean }) {
  const held = Math.round(side * 0.6);
  return (
    <Pressable
      onPress={open ? onRead : undefined}
      disabled={!open}
      accessibilityRole="button"
      accessibilityLabel={W.pointAtCode}
      style={[styles.finder, { width: side, height: side }]}
      testID="scan.viewfinder"
    >
      <View style={[styles.held, { width: held, height: Math.round(held * 1.55) }]}>
        <View style={styles.heldFace}>
          <DoorQr code={HELD} side={Math.round(held * 0.75)} said={false} />
        </View>
      </View>
      {(['tl', 'tr', 'br', 'bl'] as const).map((at) => (
        <View key={at} style={[styles.corner, CORNER[at]]} />
      ))}
    </Pressable>
  );
}

function Hint() {
  return (
    <Glass height={36} style={styles.hint}>
      <Text size={15} weight="semibold" accessible={false} style={styles.white}>
        {W.pointAtCode}
      </Text>
    </Glass>
  );
}

/** ‹ Check-in on the camera: the house's back, in glass and white. */
function GlassBack() {
  const { t } = useTranslation();

  return (
    <Pressable
      onPress={leave}
      style={({ pressed }) => [styles.glassBack, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={t('frame.backTo', { place: W.checkIn })}
      testID="scan.back"
    >
      <Glass height={44} style={styles.backGlass}>
        <Glyph name="back" size={18} ink={tokens.colorInkOnDark} weight={2.4} />
        <Text size={15} weight="semibold" accessible={false} style={styles.white}>
          {W.checkIn}
        </Text>
      </Glass>
    </Pressable>
  );
}

function CameraTop({ landscape }: { landscape: boolean }) {
  return (
    <View style={[styles.top, landscape && styles.topWide]}>
      <GlassBack />
      <View style={styles.title} pointerEvents="none">
        <Text size={17} weight="bold" accessibilityRole="header" style={styles.white}>
          {W.scanCode}
        </Text>
      </View>
    </View>
  );
}

/** Scan a code (sc-1301): the camera, the count, the viewfinder, and a result as the door's own row, larger. */
export function ScannerScreen({ state, waiting }: { state: ScanState | null; waiting: number }) {
  useCoverStatusBar('light', false);
  const { layout } = useShell();
  const insets = useSafeAreaInsets();
  const locale = formattingLocale('en', getLocales()[0]?.languageTag);
  const now = useMemo(() => clockOf('door'), []);
  const event = useMemo(() => {
    const base = sampleEvent(WEDDING);
    if (base == null) throw new Error('The sample has the wedding.');
    return shownEvent(base, now);
  }, [now]);
  const offline = isOffline(state);
  const [result, setResult] = useState<ScanResult | null>(() => resultOf(state));
  const [last, setLast] = useState<string | null | undefined>(() => lastOf(state));
  const [count, setCount] = useState<{ arrived: number; expected: number }>(() =>
    state === 'arrivedFromScan' ? { arrived: 42, expected: 98 } : ARRIVALS.onTheDay,
  );
  const [kept, setKept] = useState(waiting);
  const camera = state !== 'offlineNoList' && state !== 'cameraOff';
  const big = layout === 'phone';

  const change = (key: string, by: 1 | -1) => {
    if (result?.kind !== 'guest') return;
    const p = result.people.find((one) => one.key === key);
    if (p == null) return;
    setResult({
      ...result,
      people: result.people.map((one) =>
        one.key === key
          ? { ...one, arrivedAt: by === 1 ? NOW_AT : null, by: by === 1 ? READER : null }
          : one,
      ),
    });
    setCount(countAfter(count, p.kind, by));
    if (offline) setKept(Math.max(0, kept + by));
  };
  const onRead = () => {
    const key = nextRead(last);
    setLast(key);
    setResult(readOf(key));
  };
  const onNext = () => setResult(null);

  const panel =
    result == null ? null : (
      <Result
        key={`${result.kind}.${result.kind === 'guest' ? result.people[0]?.key : ''}`}
        result={result}
        locale={locale}
        big={big}
        onArrive={(key) => change(key, 1)}
        onUndo={(key) => change(key, -1)}
        onNext={onNext}
      />
    );
  const strip =
    offline && state !== 'offlineNoList' ? <OfflineStrip waiting={kept} width={null} /> : null;
  const showChip = state !== 'offlineNoList';

  if (layout === 'landscape')
    return (
      <View style={styles.side}>
        <View
          style={[
            styles.camera,
            styles.grow,
            camera ? null : styles.closed,
            { paddingTop: insets.top },
          ]}
        >
          <CameraTop landscape />
          {camera && (
            <View style={styles.room}>
              <Viewfinder side={360} onRead={onRead} open={result == null} />
              {result == null && <Hint />}
            </View>
          )}
          {result != null && camera && <View style={styles.dim} pointerEvents="none" />}
        </View>
        <ScrollView
          style={styles.sidePanel}
          contentContainerStyle={[styles.sideBody, { paddingTop: insets.top + 22 }]}
        >
          {state !== 'offlineNoList' && (
            <GuestsCard
              event={event}
              words={{
                tags: [{ word: 'Happening now', mark: 'now' }, { word: 'Day 1 of 3' }],
                says: '',
                count,
                line: W.doorOpenedLine,
                step: null,
              }}
              layout="landscape"
              onStep={() => undefined}
              stepLabel={null}
            />
          )}
          {strip}
          {panel ?? (
            <Text size={20} weight="bold" style={styles.head}>
              {W.pointAtCode}
            </Text>
          )}
        </ScrollView>
      </View>
    );

  const portrait = layout === 'portrait';
  return (
    <View
      style={[styles.camera, camera ? null : styles.closed, { paddingTop: insets.top }]}
      testID="scan.screen"
    >
      <CameraTop landscape={false} />
      <View style={[styles.under, portrait && [styles.underWide, { top: insets.top + 10 }]]}>
        {showChip && <CountChip {...count} />}
        {strip}
      </View>
      {camera && (
        <View style={styles.room}>
          <Viewfinder side={portrait ? 340 : 248} onRead={onRead} open={result == null} />
          {result == null && <Hint />}
        </View>
      )}
      {result != null && camera && <View style={styles.dim} pointerEvents="none" />}
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
  held: {
    padding: 7,
    borderRadius: 24,
    backgroundColor: tokens.colorDarkInset,
    transform: [{ rotate: '-7deg' }],
  },
  heldFace: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: tokens.colorCard,
  },
  dim: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: tokens.colorInk,
    opacity: 0.38,
  },
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
  hostRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  hostLead: { width: 28, alignItems: 'center', alignSelf: 'flex-start', paddingTop: 2 },
  name: { lineHeight: 25, letterSpacing: 20 * -0.01, marginBottom: 4 },
  compRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
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
