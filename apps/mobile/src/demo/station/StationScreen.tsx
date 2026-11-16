import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type ViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { QuietButton, SecondaryButton } from '../../components/Buttons.tsx';
import { readOut } from '../../components/ReadOut.tsx';
import { Sheet } from '../../components/Sheet.tsx';
import { Text } from '../../components/Text.tsx';
import { useLayout } from '../../layout/useLayout.ts';
import { DemoOnly } from '../../steps/Lines.tsx';
import { tokens } from '../../theme/tokens.ts';
import { goBack } from '../DemoScreen.tsx';
import { Glyph } from '../queue/QueueParts.tsx';
import { OFFLINE_GLYPH } from '../team/TeamParts.tsx';
import {
  EMPTY,
  EVENT,
  REFUSED,
  type StationState,
  type StationStateName,
  type Tray,
  canUndo,
  choose,
  dismissNotSent,
  faced,
  flaggedCount,
  giveTray,
  goOnline,
  headingTrays,
  hereTrays,
  hm,
  isKept,
  leftToDish,
  markPreparing,
  markReady,
  movedTo,
  nameOf,
  notSentLine,
  openPick,
  pauseTray,
  pick,
  plural,
  seed,
  stateLine,
  stationStateOf,
  strip,
  takeToTable,
  trayCounts,
  undo,
  wait,
  waiterMarks,
  walkHere,
} from './stationModel.ts';
import {
  Chip,
  FlagLine,
  FlaggedCount,
  GLYPH,
  Segments,
  StationList,
  Times,
} from './StationParts.tsx';

export function StationRoute() {
  const params = useLocalSearchParams<{ state?: string }>();
  const state = stationStateOf(params.state);

  return <KitchenStation key={state} start={state} />;
}

interface Sizes {
  phone: boolean;
  side: number;
  table: number;
  line: number;
  item: number;
}

function KitchenStation({ start }: { start: StationStateName }) {
  const { kind } = useLayout();
  const insets = useSafeAreaInsets();
  const [s, setS] = useState<StationState>(() => seed(start));
  const opener = useRef<ViewInstance | null>(null);
  const phone = kind === 'phone';
  const z: Sizes = {
    phone,
    side: phone ? tokens.sizeHitPhonePrimary : tokens.sizeHit,
    table: phone ? 28 : 34,
    line: phone ? 17 : 19,
    item: phone ? 20 : 24,
  };

  useEffect(() => (s.say === '' ? undefined : readOut(s.say)), [s.say]);
  useEffect(() => (s.moved === '' ? undefined : readOut(s.moved)), [s.moved]);

  if (s.access !== 'pass') return <Refused s={s} insets={insets.top} />;

  const page = (children: React.ReactNode) => (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={[styles.body, phone && styles.bodyPhone]}>
        <Pressable
          onPress={goBack}
          accessibilityRole="button"
          style={styles.back}
          testID="station.back"
        >
          <Text size={15} weight="semibold" style={styles.accent}>
            Back
          </Text>
        </Pressable>
        {children}
        <Switches s={s} setS={setS} start={start} />
      </ScrollView>
    </View>
  );

  if (s.station == null) {
    return page(
      <View style={styles.landing} testID="station.landing">
        <Text size={z.table} weight="bold" accessibilityRole="header">
          Pick a kitchen station
        </Text>
        <Text size={16} style={styles.secondary}>
          {`${s.you} · you’re on no kitchen station tonight. Open one to see the trays that need it.`}
        </Text>
        <Strip s={s} />
        <StationList current={null} you={s.you} side={z.side} onPick={(id) => setS(pick(s, id))} />
      </View>,
    );
  }

  const tray = <Facing s={s} z={z} />;
  const left = <Left s={s} setS={setS} z={z} strip={kind === 'tabletPortrait'} />;
  const heading = <Heading s={s} z={z} />;

  return (
    <>
      {page(
        <>
          <Header s={s} z={z} opener={opener} onOpen={() => setS(openPick(s, true))} />
          {s.moved !== '' && (
            <View style={styles.moved} testID="station.moved">
              <Glyph paths={GLYPH.info} ink={tokens.colorAccentText} side={18} circle />
              <Text size={16} weight="semibold">
                {s.moved}
              </Text>
            </View>
          )}
          {s.notSent.length > 0 && (
            <View style={styles.notSent} accessibilityRole="alert" testID="station.notSent">
              <Text size={16} weight="bold">
                Not sent · the floor changed while you were offline
              </Text>
              {s.notSent.map((r) => (
                <Text key={r.item} size={16}>
                  {notSentLine(s, r)}
                </Text>
              ))}
              <QuietButton
                label="Got it"
                onPress={() => setS(dismissNotSent(s))}
                testID="station.notSent.ok"
              />
            </View>
          )}
          {kind === 'tabletLandscape' ? (
            <View style={styles.columns}>
              <View style={styles.main}>{tray}</View>
              <View style={styles.aside}>
                {left}
                {heading}
              </View>
            </View>
          ) : kind === 'tabletPortrait' ? (
            <View style={styles.stack}>
              {left}
              {tray}
              {heading}
            </View>
          ) : (
            <View style={styles.stack}>
              {tray}
              {left}
              {heading}
            </View>
          )}
        </>,
      )}
      <Sheet
        open={s.picking}
        onClose={() => setS(openPick(s, false))}
        scrimLabel="Close Kitchen stations"
        opener={opener}
        docked
        testID="station.sheet"
      >
        <View style={styles.sheet}>
          <Text size={22} weight="bold" accessibilityRole="header">
            Kitchen stations
          </Text>
          <Text size={15} style={styles.secondary}>
            {`${EVENT} · in the walking order`}
          </Text>
          <StationList
            current={s.station}
            you={s.you}
            side={z.side}
            onPick={(id) => setS(pick(s, id))}
          />
          <QuietButton
            label="Close"
            onPress={() => setS(openPick(s, false))}
            testID="station.sheet.close"
          />
        </View>
      </Sheet>
    </>
  );
}

function Strip({ s }: { s: StationState }) {
  return (
    <View style={styles.strip} accessibilityRole="text" testID="station.strip">
      {s.online ? (
        <View style={styles.dot} />
      ) : (
        <Glyph paths={OFFLINE_GLYPH} ink={tokens.colorInkSecondary} side={15} />
      )}
      <Text size={14} weight="medium" style={styles.secondary}>
        {strip(s)}
      </Text>
    </View>
  );
}

function Header({
  s,
  z,
  opener,
  onOpen,
}: {
  s: StationState;
  z: Sizes;
  opener: React.RefObject<ViewInstance | null>;
  onOpen: () => void;
}) {
  const name = nameOf(s.station ?? 'pass');
  return (
    <View style={styles.header}>
      <Pressable
        ref={opener}
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={`Kitchen station · ${name}. Pick another station`}
        style={[styles.title, { minHeight: z.side }]}
        testID="station.title"
      >
        <Text
          size={z.phone ? 26 : 30}
          weight="bold"
          accessibilityRole="header"
          style={styles.titleWords}
        >
          {`Kitchen station · ${name}`}
        </Text>
        <Glyph paths={GLYPH.chevron} ink={tokens.colorInk} side={22} />
      </Pressable>
      <Text size={15} weight="medium" style={styles.secondary}>
        {`${s.you} · ${s.fired ?? 'No course fired'} · ${EVENT}`}
      </Text>
      <Strip s={s} />
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
  children: React.ReactNode;
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

function trayReading(s: StationState, tray: Tray): string {
  const rows = faced(s, tray);
  const flagged = rows
    .filter((r) => r.flags.length > 0)
    .map((r) => `${r.seat}, ${r.flags.join(', ')}, dish first, clean tools`);
  const plates = rows.map((r) =>
    [r.seat, r.items.length === 0 ? 'nothing from here' : r.items.join(', '), r.variant, r.course]
      .filter((x) => x !== '')
      .join(', '),
  );
  return [
    `${tray.label}, ${tray.waiter}, ${plural(tray.plates.length, 'plate', 'plates')}`,
    flagged.length > 0 ? `Flagged: ${flagged.join('; ')}` : '',
    `From your left: ${plates.join('; ')}`,
  ]
    .filter((x) => x !== '')
    .join('. ');
}

function Facing({ s, z }: { s: StationState; z: Sizes }) {
  const trays = hereTrays(s);
  return (
    <Section title="As you face it" count={trays.length > 1 ? `${trays.length} trays here` : ''}>
      {s.fired == null ? (
        <Empty words={EMPTY.noCourse} />
      ) : trays.length === 0 ? (
        <Empty words={EMPTY.noTray} />
      ) : (
        trays.map((t) => <TrayHere key={t.id} s={s} tray={t} z={z} />)
      )}
    </Section>
  );
}

function TrayHere({ s, tray, z }: { s: StationState; tray: Tray; z: Sizes }) {
  const rows = faced(s, tray);
  const flagged = flaggedCount(tray);
  return (
    <View
      style={styles.tray}
      accessible
      accessibilityLabel={trayReading(s, tray)}
      testID={`station.here.${tray.id}`}
    >
      <View style={styles.trayHead}>
        <View style={styles.grow}>
          <Text size={z.table} weight="bold">
            {tray.label}
          </Text>
          <Text size={z.line} weight="medium" style={styles.secondary}>
            {`${tray.waiter} · ${plural(tray.plates.length, 'plate', 'plates')} · your left at the top`}
          </Text>
        </View>
        {flagged > 0 && <FlaggedCount n={flagged} />}
      </View>
      {rows.map((r, i) => (
        <View key={r.seat} style={[styles.plate, i > 0 && styles.sep]}>
          <View style={styles.pos}>
            <Text size={15} weight="bold">
              {String(r.pos)}
            </Text>
          </View>
          <View style={styles.grow}>
            <Text size={z.line} weight="semibold">
              {[r.seat, r.variant, r.course].filter((x) => x !== '').join(' · ')}
            </Text>
            {r.items.length === 0 ? (
              <Text size={z.line} style={styles.secondary}>
                Nothing from here
              </Text>
            ) : (
              r.items.map((it) => {
                const prep = r.preparing.includes(it);
                return (
                  <View key={it} style={styles.itemLine}>
                    <Text size={z.item} weight="bold" style={styles.grow}>
                      {it}
                    </Text>
                    {r.mark === 'on' && <Chip status="on" big={!z.phone} />}
                    {r.mark === 'off' && <Chip status="off" big={!z.phone} />}
                    {prep && r.mark === 'none' && <Chip status="preparing" big={!z.phone} />}
                  </View>
                );
              })
            )}
            {r.flags.length > 0 && <FlagLine flags={r.flags} size={z.line} />}
          </View>
        </View>
      ))}
    </View>
  );
}

function Left({
  s,
  setS,
  z,
  strip: compact,
}: {
  s: StationState;
  setS: (s: StationState) => void;
  z: Sizes;
  strip: boolean;
}) {
  const lines = leftToDish(s);
  const st = s.station ?? 'pass';
  return (
    <Section title="Left to dish">
      {s.fired == null ? (
        <Empty words={EMPTY.noCourse} />
      ) : lines.length === 0 ? (
        <Empty words={EMPTY.noItem(st)} />
      ) : (
        <View style={compact ? styles.leftStrip : styles.leftList}>
          {lines.map((l) => {
            const state = s.items[l.item];
            const prep = state?.kind === 'preparing';
            const sl = stateLine(s, l.item);
            const chooserOpen = s.choosing === l.item || prep;
            const words = [sl.word === 'Ready' ? '' : sl.line, sl.waiting].filter((x) => x !== '');
            const u = s.undo[l.item];
            return (
              <View
                key={l.item}
                style={[styles.itemCard, compact && styles.itemCardStrip]}
                testID={`station.left.${l.item}`}
              >
                <View style={styles.itemHead}>
                  <View style={styles.grow}>
                    <Text size={z.line + 1} weight="bold">
                      {l.label}
                    </Text>
                    <Text size={z.line} weight="semibold" style={styles.tabular}>
                      {`${l.n} to dish`}
                    </Text>
                  </View>
                  <Chip
                    status={
                      sl.word === 'Ready' ? 'ready' : sl.word === 'Held up' ? 'heldUp' : 'preparing'
                    }
                    big
                  />
                </View>
                {words.length > 0 && (
                  <Text
                    size={z.line - 2 < 15 ? 15 : z.line - 2}
                    weight="semibold"
                    style={sl.word === 'Held up' ? styles.broken : styles.attention}
                  >
                    {words.join(' · ')}
                  </Text>
                )}
                {isKept(s, l.item) && <Chip status="kept" />}
                <Segments
                  item={l.item}
                  preparing={prep || s.choosing === l.item}
                  side={z.side}
                  onReady={() => setS(prep ? markReady(s, l.item) : choose(s, null))}
                  onPreparing={() => setS(choose(s, l.item))}
                />
                {chooserOpen && (
                  <Times
                    item={l.item}
                    chosen={prep ? state.eta : undefined}
                    side={z.side}
                    onPick={(eta) => setS(markPreparing(s, l.item, eta))}
                  />
                )}
                {u != null && canUndo(s, l.item) && (
                  <View style={styles.undo}>
                    <Text size={14} style={[styles.secondary, styles.grow]}>
                      {`Marked ${stateLine(s, l.item).word === 'Ready' ? 'Ready' : 'Preparing'} at ${hm(u.at)}`}
                    </Text>
                    <QuietButton
                      label="Undo"
                      onPress={() => setS(undo(s, l.item))}
                      testID={`station.undo.${l.item}`}
                    />
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}
    </Section>
  );
}

function Heading({ s, z }: { s: StationState; z: Sizes }) {
  const trays = headingTrays(s);
  const st = s.station ?? 'pass';
  return (
    <Section
      title="Heading here"
      count={trays.length > 0 ? plural(trays.length, 'tray', 'trays') : ''}
    >
      {s.fired == null ? (
        <Empty words={EMPTY.noCourse} />
      ) : trays.length === 0 ? (
        <Empty words={EMPTY.noHeading} />
      ) : (
        <View style={styles.card}>
          {trays.map((t, i) => {
            const counts = trayCounts(t, st);
            const flagged = flaggedCount(t);
            return (
              <View
                key={t.id}
                style={[styles.headRow, i > 0 && styles.sep]}
                accessible
                accessibilityLabel={`${t.label}, ${t.waiter}${t.paused ? ', paused' : ''}, ${counts.map((c) => `${c.item} ${c.n}`).join(', ')}${flagged > 0 ? `, ${flagged} flagged` : ''}`}
                testID={`station.heading.${t.id}`}
              >
                <View style={styles.headTop}>
                  <Text size={z.line + 3} weight="bold" style={styles.grow}>
                    {`${t.label} · ${t.waiter}`}
                  </Text>
                  {t.paused && <Chip status="paused" />}
                </View>
                <View style={styles.counts}>
                  {counts.map((c) => (
                    <Text key={c.item} size={z.line} weight="semibold">
                      {`${c.item} · ${c.n}`}
                    </Text>
                  ))}
                  {flagged > 0 && <FlaggedCount n={flagged} />}
                </View>
              </View>
            );
          })}
        </View>
      )}
    </Section>
  );
}

function Refused({ s, insets }: { s: StationState; insets: number }) {
  const r = s.access === 'floor' ? REFUSED.floor : REFUSED.none;
  return (
    <View style={[styles.page, { paddingTop: insets }]}>
      <View style={styles.body}>
        <Pressable
          onPress={goBack}
          accessibilityRole="button"
          style={styles.back}
          testID="station.back"
        >
          <Text size={15} weight="semibold" style={styles.accent}>
            Back
          </Text>
        </Pressable>
        <View style={styles.refused} testID={`station.refused.${s.access}`}>
          <Text size={22} weight="bold" accessibilityRole="header">
            {r.title}
          </Text>
          <Text size={16} style={styles.secondary}>
            {r.line}
          </Text>
          <QuietButton label="Back to the event" onPress={goBack} testID="station.refused.back" />
        </View>
        <DemoOnly title="Demo only">
          <Text size={14} style={styles.secondary}>
            {s.access === 'floor'
              ? 'sc-4002’s 403 for Can work the floor: no station is drawn.'
              : 'Without service.work the API refuses with a 403 and nothing here is drawn.'}
          </Text>
        </DemoOnly>
      </View>
    </View>
  );
}

function Switches({
  s,
  setS,
  start,
}: {
  s: StationState;
  setS: (s: StationState) => void;
  start: StationStateName;
}) {
  const t9 = s.trays.find((t) => t.label === 'Table 9');
  const t12 = s.trays.find((t) => t.label === 'Table 12');
  return (
    <DemoOnly title="Demo only: the board’s switches">
      <SecondaryButton
        label="Start again"
        onPress={() => setS(seed(start))}
        testID="station.demo.reset"
      />
      <SecondaryButton
        label="The waiter marks the next plate On"
        onPress={() => setS(waiterMarks(s, 'on'))}
        testID="station.demo.on"
      />
      <SecondaryButton
        label="The waiter marks the next plate Not on"
        onPress={() => setS(waiterMarks(s, 'off'))}
        testID="station.demo.off"
      />
      <SecondaryButton
        label="The next tray walks here"
        onPress={() => setS(walkHere(s))}
        testID="station.demo.walk"
      />
      <SecondaryButton
        label="The top tray goes to its table"
        onPress={() => setS(takeToTable(s))}
        testID="station.demo.take"
      />
      <SecondaryButton
        label="Let a minute pass"
        onPress={() => setS(wait(s, 1))}
        testID="station.demo.wait"
      />
      <SecondaryButton
        label={s.online ? 'Lose the connection' : 'Come back online'}
        onPress={() => setS(goOnline(s, !s.online))}
        testID="station.demo.online"
      />
      <SecondaryButton
        label={
          s.rival == null
            ? 'Kemi Adebayo marks Plantain first'
            : 'Kemi Adebayo marks Plantain first · on'
        }
        onPress={() =>
          setS({
            ...s,
            rival:
              s.rival == null
                ? {
                    item: 'Plantain',
                    by: 'Kemi Adebayo',
                    to: { kind: 'preparing', since: s.now, eta: 15, etaFrom: s.now },
                  }
                : null,
          })
        }
        testID="station.demo.rival"
      />
      {t9 != null && (
        <SecondaryButton
          label={
            t9.waiter === 'Chidi Okafor'
              ? 'The lead gives Table 9 to Funmi Bakare'
              : 'Table 9 is Funmi Bakare’s'
          }
          onPress={() => setS(giveTray(s, 'Table 9', 'Funmi Bakare'))}
          testID="station.demo.give"
        />
      )}
      {t12 != null && (
        <SecondaryButton
          label={t12.paused ? 'Yinka carries on with Table 12' : 'Yinka pauses Table 12'}
          onPress={() => setS(pauseTray(s, 'Table 12', !t12.paused))}
          testID="station.demo.pause"
        />
      )}
      <SecondaryButton
        label="Team moves you to the Grill"
        onPress={() => setS(movedTo(s, 'grill'))}
        testID="station.demo.moved"
      />
    </DemoOnly>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: tokens.colorPage },
  body: { padding: tokens.space3xl, gap: tokens.spaceXl, paddingBottom: 96 },
  bodyPhone: { padding: tokens.spaceXl, paddingBottom: 96 },
  back: { minHeight: tokens.sizeHit, justifyContent: 'center', alignSelf: 'flex-start' },
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
  headRow: { paddingVertical: tokens.spaceLg, gap: tokens.spaceXs },
  headTop: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm },
  counts: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: tokens.spaceLg },
  sheet: { gap: tokens.spaceMd, paddingBottom: tokens.spaceLg },
  refused: {
    padding: tokens.space3xl,
    gap: tokens.spaceSm,
    borderRadius: tokens.radiusCardPhone,
    backgroundColor: tokens.colorCard,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
  },
});
