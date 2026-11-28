import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SecondaryButton } from '../../components/Buttons.tsx';
import { useReadOut } from '../../components/ReadOut.tsx';
import { Text } from '../../components/Text.tsx';
import { useLayout } from '../../layout/useLayout.ts';
import { DemoOnly } from '../../steps/Lines.tsx';
import { tokens } from '../../theme/tokens.ts';
import { goBack } from '../DemoScreen.tsx';
import { FlagLine, Glyph } from '../queue/QueueParts.tsx';
import { Chip, PATHS, Strip, TabBar, type TabId, shared } from '../service/HowItsGoingParts.tsx';
import {
  ASKING_LINE,
  AVAILABLE_LINE,
  type Ask,
  type AskState,
  type AskStateName,
  type FloorSeat,
  type Guest,
  type HeldRow,
  NOT_BUILT,
  NO_ASKS,
  type NextItem,
  OFFLINE_ROOM,
  OPEN_INTRO,
  RUN_OUT,
  SECTION,
  type Seat,
  WAITER,
  answer,
  askOf,
  askStateOf,
  askTitle,
  asks,
  cancelChange,
  floorSeats,
  floorTables,
  guestOf,
  heldRows,
  leadAsks,
  leadChooses,
  markAvailable,
  nextItems,
  openChange,
  options,
  seed,
  setStage,
  where,
} from './askAtTableModel.ts';

export function AskAtTableRoute() {
  const params = useLocalSearchParams<{ state?: string }>();
  const state = askStateOf(params.state);

  return <AskAtTable key={state} start={state} />;
}

type Mode = 'phone' | 'portrait' | 'landscape';

interface Z {
  mode: Mode;
  side: number;
}

type SetS = (next: AskState) => void;

interface P {
  s: AskState;
  setS: SetS;
  z: Z;
}

function AskAtTable({ start }: { start: AskStateName }) {
  const { kind } = useLayout();
  const insets = useSafeAreaInsets();
  const [s, setS] = useState<AskState>(() => seed(start));
  const mode: Mode =
    kind === 'phone' ? 'phone' : kind === 'tabletPortrait' ? 'portrait' : 'landscape';
  const z: Z = { mode, side: mode === 'phone' ? tokens.sizeHitPhonePrimary : tokens.sizeHit };
  const p: P = { s, setS, z };

  useReadOut(s.say === '' ? null : s.say, { answer: s.seats });

  const tab: TabId = s.screen === 'floor' ? 'floor' : 'next';
  const pick = (t: TabId) =>
    setS({ ...s, screen: t === 'floor' ? 'floor' : 'next', changing: null, refused: '' });
  const title = tab === 'floor' ? 'Floor' : 'Next';
  const demo = <Switches p={p} start={start} />;

  if (mode === 'landscape') {
    return (
      <View style={[styles.page, styles.row, { paddingTop: insets.top }]}>
        <View style={styles.left}>
          <ScrollView contentContainerStyle={styles.body}>
            <Head title={title} p={p} />
            {tab === 'floor' ? <Tables p={p} /> : <Next p={p} />}
          </ScrollView>
          <TabBar tabs={['next', 'floor']} current={tab} onPick={pick} bottom={insets.bottom} />
        </View>
        <ScrollView style={styles.right} contentContainerStyle={styles.body}>
          {tab === 'floor' ? <TableSeats p={p} /> : <OpenPane p={p} />}
          {demo}
        </ScrollView>
      </View>
    );
  }

  if (s.screen === 'ask' && mode === 'phone') {
    return (
      <View style={[styles.page, { paddingTop: insets.top }]}>
        <ScrollView contentContainerStyle={[styles.body, styles.bodyPhone]}>
          <Pressable
            onPress={() => setS({ ...s, screen: 'next', open: null, refused: '' })}
            accessibilityRole="button"
            style={[styles.back, { minHeight: z.side }]}
            testID="ask.toNext"
          >
            <Text size={15} weight="semibold" style={shared.accent}>
              Next
            </Text>
          </Pressable>
          <Strip online={s.online} refused={s.online ? '' : s.refused} />
          <OpenPane p={p} />
          {demo}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={[styles.body, mode === 'phone' && styles.bodyPhone]}>
        <Head title={title} p={p} />
        {tab === 'floor' ? (
          <>
            <Tables p={p} />
            <TableSeats p={p} />
          </>
        ) : (
          <Next p={p} />
        )}
        {demo}
      </ScrollView>
      <TabBar tabs={['next', 'floor']} current={tab} onPick={pick} bottom={insets.bottom} />
    </View>
  );
}

function Head({ title, p }: { title: string; p: P }) {
  const { s, z } = p;
  return (
    <View style={styles.head}>
      <Pressable
        onPress={goBack}
        accessibilityRole="button"
        style={[styles.back, { minHeight: z.side }]}
        testID="ask.back"
      >
        <Text size={15} weight="semibold" style={shared.accent}>
          Back
        </Text>
      </Pressable>
      <Text size={30} weight="bold" accessibilityRole="header">
        {title}
      </Text>
      <Text size={15} style={shared.secondary}>
        {`${WAITER} · ${SECTION}`}
      </Text>
      <Strip online={s.online} refused={s.online ? '' : s.refused} />
    </View>
  );
}

function NotBuilt() {
  return (
    <View style={styles.pill}>
      <Text size={12} weight="semibold" style={shared.secondary}>
        {NOT_BUILT}
      </Text>
    </View>
  );
}

function Refused({ s }: { s: AskState }) {
  if (!s.online || s.refused === '') return null;
  return (
    <View accessibilityRole="alert" style={styles.refused}>
      <Glyph paths={PATHS.ban} ink={tokens.colorBrokenText} side={18} circle />
      <Text size={15} weight="semibold" style={[shared.grow, styles.broken]}>
        {s.refused}
      </Text>
    </View>
  );
}

function Flags({ g }: { g: Guest }) {
  return (
    <>
      {g.flags.map((f) => (
        <FlagLine key={f.words} flag={f.words} />
      ))}
    </>
  );
}

const TRAY_CHIP = {
  inHand: { word: 'In hand', paths: PATHS.tray, tone: 'accent' },
  given: { word: 'Given to you', paths: PATHS.given, tone: 'accent' },
  nextTray: { word: 'Next tray', paths: PATHS.given, tone: 'plain' },
} as const;

function Next({ p }: { p: P }) {
  const { s } = p;
  const items = nextItems(s);
  const none = asks(s).length === 0;
  const held = heldRows(s);
  return (
    <View style={styles.list}>
      {s.available && (
        <View style={[shared.card, styles.landed]} testID="ask.available">
          <Glyph paths={PATHS.check} ink={tokens.colorAccentText} side={18} />
          <Text size={16} weight="semibold" style={shared.grow}>
            {AVAILABLE_LINE}
          </Text>
        </View>
      )}
      {items.map((it) => (
        <View key={keyOf(it)} style={styles.list}>
          <NextCard it={it} p={p} />
          {none && it.kind === 'given' && (
            <Text size={15} style={shared.secondary} testID="ask.none">
              {NO_ASKS}
            </Text>
          )}
        </View>
      ))}
      {held.length > 0 && (
        <View style={styles.section}>
          <View style={styles.inline}>
            <Glyph paths={PATHS.clock} ink={tokens.colorInk} side={18} circle />
            <Text size={19} weight="bold" accessibilityRole="header">
              {`Held · ${held.length}`}
            </Text>
          </View>
          <Text size={14} style={shared.secondary}>
            On no tray until they have a choice
          </Text>
          {held.map((r) => (
            <Held key={r.guest.id} r={r} />
          ))}
        </View>
      )}
    </View>
  );
}

function keyOf(it: NextItem): string {
  if (it.kind === 'ask') return `ask.${it.ask.table}`;
  if (it.kind === 'request') return `request.${it.request.id}`;
  return it.kind;
}

function NextCard({ it, p }: { it: NextItem; p: P }) {
  if (it.kind === 'ask') return <AskCard a={it.ask} p={p} />;
  if (it.kind === 'request')
    return (
      <View style={shared.card} testID={`ask.request.${it.request.id}`}>
        <Chip word="Request" paths={PATHS.request} />
        <Text size={18} weight="bold">
          {`Table ${it.request.table} · ${it.request.words}`}
        </Text>
        <Text size={14} style={shared.secondary}>
          {`Opened ${it.request.opened}`}
        </Text>
      </View>
    );
  return (
    <View style={shared.card} testID={`ask.${it.kind}`}>
      <Chip {...TRAY_CHIP[it.kind]} />
      <Text size={it.kind === 'inHand' ? 26 : 20} weight="bold">
        {`Table ${it.tray.table} · ${it.tray.plates} plates`}
      </Text>
      <Text size={15}>{it.tray.line}</Text>
    </View>
  );
}

function AskHead({ a, current }: { a: Ask; current: boolean }) {
  return (
    <>
      <View style={styles.inline}>
        <Chip word="Ask at the table" paths={PATHS.request} tone="attention" />
        {current && <Chip word="Open" paths={PATHS.given} tone="accent" />}
        <NotBuilt />
      </View>
      <Text size={20} weight="bold">
        {askTitle(a)}
      </Text>
    </>
  );
}

function AskCard({ a, p }: { a: Ask; p: P }) {
  const { s, setS, z } = p;
  const open = s.open === a.table;
  const inPlace = z.mode === 'portrait' && open;
  const press = () => {
    if (z.mode === 'portrait')
      setS({ ...s, open: open ? null : a.table, refused: '', changing: null });
    else setS({ ...s, open: a.table, screen: z.mode === 'phone' ? 'ask' : 'next', refused: '' });
  };
  const current = z.mode === 'landscape' && open;
  const button = (
    <Pressable
      onPress={press}
      accessibilityRole="button"
      accessibilityLabel={askTitle(a)}
      accessibilityState={
        z.mode === 'portrait' ? { expanded: open } : current ? { selected: true } : {}
      }
      style={({ pressed }) => [
        inPlace ? styles.askHeadTap : [shared.card, current && styles.current],
        { minHeight: z.side },
        pressed && styles.pressed,
      ]}
      testID={`ask.card.${a.table}`}
    >
      <AskHead a={a} current={current} />
    </Pressable>
  );
  if (!inPlace) return button;
  return (
    <View style={[shared.card, styles.current]}>
      {button}
      <View style={[shared.sep, styles.inPlace]}>
        <AskBody a={a} p={p} heading />
      </View>
    </View>
  );
}

function OpenPane({ p }: { p: P }) {
  const a = askOf(p.s, p.s.open);
  if (a == null)
    return (
      <View style={styles.list}>
        <Refused s={p.s} />
        <Text size={15} style={shared.secondary}>
          {asks(p.s).length === 0 ? NO_ASKS : 'Open an ask on Next to record the guests’ answers.'}
        </Text>
      </View>
    );
  return <AskBody a={a} p={p} heading />;
}

function AskBody({ a, p, heading }: { a: Ask; p: P; heading: boolean }) {
  const two = p.z.mode === 'portrait';
  return (
    <View style={styles.list}>
      {heading && (
        <View style={styles.section}>
          <View style={styles.inline}>
            <Text size={28} weight="bold" accessibilityRole="header">
              {`Ask at table ${a.table}`}
            </Text>
            <NotBuilt />
          </View>
          <Text size={17} weight="semibold">
            {`${a.item} has run out`}
          </Text>
          <Text size={15} style={shared.secondary}>
            {OPEN_INTRO}
          </Text>
        </View>
      )}
      <Refused s={p.s} />
      <View style={two ? styles.two : styles.list}>
        {a.seats.map((x) => (
          <View key={x.guest} style={[shared.card, two && styles.half]}>
            <AskGuest x={x} p={p} />
          </View>
        ))}
      </View>
    </View>
  );
}

function AskGuest({ x, p }: { x: Seat; p: P }) {
  const g = guestOf(x.guest);
  return (
    <>
      <Text size={17} weight="semibold">
        {g.name}
      </Text>
      <Text size={14} style={shared.secondary}>
        {where(g)}
      </Text>
      <Flags g={g} />
      <Choices x={x} p={p} />
    </>
  );
}

function Choices({ x, p }: { x: Seat; p: P }) {
  const { s, setS, z } = p;
  const g = guestOf(x.guest);
  return (
    <View accessibilityRole="radiogroup" style={styles.choices}>
      {options(x).map((o) =>
        o.no != null ? (
          <View
            key={o.label}
            style={styles.noLine}
            accessible
            accessibilityLabel={`${o.label}. ${o.no.line}${o.no.note === '' ? '' : `. ${o.no.note}`}`}
            accessibilityState={{ disabled: true }}
            testID={`ask.no.${g.id}.${o.to}`}
          >
            <Glyph paths={PATHS.ban} ink={tokens.colorBrokenText} side={18} circle />
            <View style={[shared.grow, styles.noText]}>
              <Text size={15} weight="semibold" style={shared.secondary}>
                {o.label}
              </Text>
              <Text size={14} weight="bold" style={styles.broken}>
                {o.no.line}
              </Text>
              {o.no.note !== '' && (
                <Text size={14} style={shared.secondary}>
                  {o.no.note}
                </Text>
              )}
            </View>
          </View>
        ) : (
          <Pressable
            key={o.label}
            onPress={() => setS(answer(s, g.id, o.to))}
            accessibilityRole="radio"
            accessibilityState={{ checked: o.now }}
            accessibilityLabel={`${o.label}, ${g.name}`}
            style={({ pressed }) => [
              styles.choice,
              { minHeight: z.side },
              (o.now || pressed) && styles.choiceOn,
            ]}
            testID={`ask.choose.${g.id}.${o.to === '' ? 'without' : o.to}`}
          >
            <Text size={16} weight="semibold" style={shared.grow}>
              {o.label}
            </Text>
            {o.now && (
              <View style={styles.inline}>
                <Glyph paths={PATHS.check} ink={tokens.colorAccentText} side={16} />
                <Text size={14} weight="bold" style={shared.accent}>
                  Now
                </Text>
              </View>
            )}
          </Pressable>
        ),
      )}
    </View>
  );
}

function Held({ r }: { r: HeldRow }) {
  return (
    <View style={shared.card} testID={`ask.held.${r.guest.id}`}>
      <Text size={17} weight="semibold">
        {r.guest.name}
      </Text>
      <Text size={14} style={shared.secondary}>
        {where(r.guest)}
      </Text>
      <Flags g={r.guest} />
      <WaitLine asked={r.asked} words={r.line} />
    </View>
  );
}

function WaitLine({ asked, words }: { asked: boolean; words: string }) {
  return (
    <View style={styles.inline}>
      <Glyph
        paths={asked ? PATHS.request : PATHS.clock}
        ink={tokens.colorAttentionText}
        side={15}
        circle={!asked}
      />
      <Text size={15} weight="semibold" style={styles.attention}>
        {words}
      </Text>
    </View>
  );
}

function Tables({ p }: { p: P }) {
  const { s, setS, z } = p;
  return (
    <View style={styles.list} accessibilityRole="radiogroup">
      {floorTables(s).map((t) => {
        const on = s.table === t.table;
        return (
          <Pressable
            key={t.table}
            onPress={() => setS({ ...s, table: t.table, changing: null, refused: '' })}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            style={({ pressed }) => [
              shared.card,
              styles.tableRow,
              { minHeight: z.side },
              on && styles.current,
              pressed && styles.pressed,
            ]}
            testID={`ask.table.${t.table}`}
          >
            <View style={shared.grow}>
              <Text size={17} weight="semibold">
                {`Table ${t.table}`}
              </Text>
              <Text size={14} style={shared.secondary}>
                {t.line}
              </Text>
            </View>
            {on && <Chip word="Open" paths={PATHS.given} tone="accent" />}
          </Pressable>
        );
      })}
    </View>
  );
}

function TableSeats({ p }: { p: P }) {
  const { s, z } = p;
  const two = z.mode === 'portrait';
  return (
    <View style={styles.list}>
      <Text size={z.mode === 'landscape' ? 28 : 19} weight="bold" accessibilityRole="header">
        {`Table ${s.table}`}
      </Text>
      <Refused s={s} />
      <View style={two ? styles.two : styles.list}>
        {floorSeats(s, s.table).map((f) => (
          <SeatCard key={f.guest.id} f={f} p={p} two={two} />
        ))}
      </View>
    </View>
  );
}

function SeatCard({ f, p, two }: { f: FloorSeat; p: P; two: boolean }) {
  const { s, setS } = p;
  const x = f.seat;
  const g = f.guest;
  const changing = s.changing === g.id;
  return (
    <View style={[shared.card, styles.seat, two && styles.half]} testID={`ask.seat.${g.id}`}>
      <View
        style={styles.seatNo}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Text size={16} weight="bold" accessible={false}>
          {String(g.seat)}
        </Text>
      </View>
      <View style={[shared.grow, styles.seatText]}>
        <Text size={17} weight="semibold">
          {`Seat ${g.seat} · ${g.name}`}
        </Text>
        <Flags g={g} />
        <Text size={14} style={shared.secondary}>
          {f.plate}
        </Text>
        {x.asked && (
          <>
            <WaitLine asked words={ASKING_LINE} />
            <NotBuilt />
            <Choices x={x} p={p} />
          </>
        )}
        {!x.asked && f.now === '' && !s.available && x.plate.includes(RUN_OUT) && (
          <WaitLine asked={false} words={`${RUN_OUT} has run out · waiting for the floor lead`} />
        )}
        {f.now !== '' && <Chip word={f.now} paths={PATHS.check} tone="accent" />}
        {changing ? (
          <>
            <Choices x={x} p={p} />
            <SecondaryButton
              label="Cancel"
              onPress={() => setS(cancelChange(s))}
              accessibilityLabel={`Cancel, keep ${g.name}’s answer`}
              testID={`ask.cancel.${g.id}`}
            />
          </>
        ) : (
          f.change && (
            <SecondaryButton
              label="Change"
              onPress={() => setS(openChange(s, g.id))}
              accessibilityLabel={`Change ${g.name}’s answer`}
              testID={`ask.change.${g.id}`}
            />
          )
        )}
      </View>
    </View>
  );
}

function Switches({ p, start }: { p: P; start: AskStateName }) {
  const { s, setS } = p;
  const room = (next: AskState) => setS(s.online ? next : { ...s, note: OFFLINE_ROOM });
  return (
    <DemoOnly title="Board only: the floor lead and the kitchen, elsewhere in the room">
      <SecondaryButton
        label="The floor lead asks Emeka Obi at table 14"
        onPress={() => setS(leadAsks(s, 'eo'))}
        testID="ask.demo.askEmeka"
      />
      <SecondaryButton
        label="The floor lead chooses Beef for Yemi Alabi"
        onPress={() => setS(leadChooses(s, 'ya', 'Beef'))}
        testID="ask.demo.leadYemi"
      />
      <SecondaryButton
        label="The Grill starts dishing Tunde Bakare’s plate"
        onPress={() => room(setStage(s, 'tb', 'Dishing'))}
        testID="ask.demo.dishing"
      />
      <SecondaryButton
        label={`Mark ${RUN_OUT} available again`}
        onPress={() => setS(markAvailable(s))}
        testID="ask.demo.available"
      />
      <SecondaryButton
        label={s.online ? 'Lose the connection' : 'Come back online'}
        onPress={() => setS({ ...s, online: !s.online, refused: '', note: '' })}
        testID="ask.demo.online"
      />
      <SecondaryButton
        label="Start this state again"
        onPress={() => setS(seed(start))}
        testID="ask.demo.reset"
      />
      {s.note !== '' && (
        <Text size={14} style={shared.secondary}>
          {s.note}
        </Text>
      )}
    </DemoOnly>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: tokens.colorPage },
  row: { flexDirection: 'row' },
  left: { width: 440, borderRightWidth: 1, borderRightColor: tokens.colorBorder },
  right: { flex: 1 },
  body: { padding: tokens.space3xl, gap: tokens.spaceXl, paddingBottom: tokens.space6xl },
  bodyPhone: { paddingHorizontal: tokens.spaceXl },
  back: { alignSelf: 'flex-start', justifyContent: 'center' },
  head: { gap: tokens.spaceXs },
  list: { gap: tokens.spaceLg },
  section: { gap: tokens.spaceSm },
  inline: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: tokens.spaceXs },
  two: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spaceLg },
  half: { flexBasis: '45%', flexGrow: 1, minWidth: 0 },
  landed: { flexDirection: 'row', alignItems: 'center', backgroundColor: tokens.colorAccentTint },
  current: { borderWidth: 2, borderColor: tokens.colorAccent },
  askHeadTap: { gap: tokens.spaceSm, justifyContent: 'center' },
  inPlace: { paddingTop: tokens.spaceLg, marginTop: tokens.spaceXs },
  pressed: { opacity: tokens.opacityPressed },
  pill: {
    minHeight: 26,
    justifyContent: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: tokens.spaceSm,
    borderRadius: tokens.radiusPill,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: tokens.colorInkSecondary,
  },
  attention: { flexShrink: 1, color: tokens.colorAttentionText },
  broken: { color: tokens.colorBrokenText },
  refused: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceSm,
    padding: tokens.spaceLg,
    borderRadius: tokens.radiusInset,
    backgroundColor: tokens.colorBrokenTint,
  },
  choices: { gap: tokens.spaceSm },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceSm,
    paddingHorizontal: tokens.spaceLg,
    borderRadius: tokens.radiusInset,
    borderWidth: 1,
    borderColor: tokens.colorControlBorder,
    backgroundColor: tokens.colorCard,
  },
  choiceOn: {
    borderWidth: 2,
    borderColor: tokens.colorAccent,
    backgroundColor: tokens.colorAccentTint,
  },
  noLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceSm,
    padding: tokens.spaceMd,
    borderRadius: tokens.radiusInset,
    backgroundColor: tokens.colorBrokenTint,
  },
  noText: { gap: tokens.spaceHair },
  tableRow: { flexDirection: 'row', alignItems: 'center' },
  seat: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceLg },
  seatText: { gap: tokens.spaceXs },
  seatNo: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorInset,
  },
});
