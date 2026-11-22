import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton, SecondaryButton } from '../../components/Buttons.tsx';
import { useReadOut } from '../../components/ReadOut.tsx';
import { Text } from '../../components/Text.tsx';
import { useLayout } from '../../layout/useLayout.ts';
import { DemoOnly } from '../../steps/Lines.tsx';
import { tokens } from '../../theme/tokens.ts';
import { goBack } from '../DemoScreen.tsx';
import { FlagLine, Glyph } from '../queue/QueueParts.tsx';
import {
  Chip,
  Initials,
  PATHS,
  Strip,
  TabBar,
  type TabId,
  shared,
} from '../service/HowItsGoingParts.tsx';
import {
  RUN_OUT,
  type Guest,
  type HeldRow,
  type RunOutState,
  type RunOutStateName,
  SECTION,
  type StopLine,
  WAITER,
  bringAfter,
  chooseHeld,
  currentStop,
  floorSeats,
  goBackFor,
  guestOf,
  heldRows,
  leadChooses,
  markNotOn,
  moveOn,
  onTray,
  plural,
  runOutStateOf,
  seed,
  stationOf,
  stopLines,
  takeOff,
  takeToTable,
  toggleLine,
  trayCheck,
  trayGone,
  trayLine,
  trayTitle,
} from './runOutTrayModel.ts';

export function RunOutTrayRoute() {
  const params = useLocalSearchParams<{ state?: string }>();
  const state = runOutStateOf(params.state);

  return <RunOutTray key={state} start={state} />;
}

interface Z {
  phone: boolean;
  side: number;
}

type SetS = (next: RunOutState) => void;

function RunOutTray({ start }: { start: RunOutStateName }) {
  const { kind } = useLayout();
  const insets = useSafeAreaInsets();
  const [s, setS] = useState<RunOutState>(() => seed(start));
  const phone = kind === 'phone';
  const z: Z = { phone, side: phone ? tokens.sizeHitPhonePrimary : tokens.sizeHit };

  useReadOut(s.say === '' ? null : s.say, { answer: s.orders });

  const tab: TabId = s.screen === 'floor' ? 'floor' : 'next';
  const pick = (t: TabId) => setS({ ...s, screen: t === 'floor' ? 'floor' : 'next' });
  const offline = s.online ? '' : s.refused;
  const demo = <Switches s={s} setS={setS} start={start} />;

  if (kind === 'tabletLandscape') {
    return (
      <View style={[styles.page, styles.row, { paddingTop: insets.top }]}>
        <View style={styles.left}>
          <ScrollView contentContainerStyle={styles.body}>
            <Head title={tab === 'floor' ? 'Floor' : 'Next'} s={s} z={z} refused={offline} />
            {tab === 'floor' ? <Floor s={s} /> : <Next s={s} setS={setS} z={z} open={false} />}
          </ScrollView>
          <TabBar tabs={['next', 'floor']} current={tab} onPick={pick} bottom={insets.bottom} />
        </View>
        <ScrollView style={styles.right} contentContainerStyle={styles.body}>
          <TrayPane s={s} setS={setS} z={z} />
          {demo}
        </ScrollView>
      </View>
    );
  }

  if (s.screen === 'tray') {
    return (
      <View style={[styles.page, { paddingTop: insets.top }]}>
        <ScrollView contentContainerStyle={[styles.body, phone && styles.bodyPhone]}>
          <Pressable
            onPress={() => setS({ ...s, screen: 'next' })}
            accessibilityRole="button"
            style={[styles.back, { minHeight: z.side }]}
            testID="runOut.toNext"
          >
            <Text size={15} weight="semibold" style={shared.accent}>
              Next
            </Text>
          </Pressable>
          <Strip online={s.online} refused={offline} />
          <TrayPane s={s} setS={setS} z={z} />
          {demo}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={[styles.body, phone && styles.bodyPhone]}>
        <Head title={tab === 'floor' ? 'Floor' : 'Next'} s={s} z={z} refused={offline} />
        {tab === 'floor' ? <Floor s={s} /> : <Next s={s} setS={setS} z={z} open />}
        {demo}
      </ScrollView>
      <TabBar tabs={['next', 'floor']} current={tab} onPick={pick} bottom={insets.bottom} />
    </View>
  );
}

function Head({ title, s, z, refused }: { title: string; s: RunOutState; z: Z; refused: string }) {
  return (
    <View style={styles.head}>
      <Pressable
        onPress={goBack}
        accessibilityRole="button"
        style={[styles.back, { minHeight: z.side }]}
        testID="runOut.back"
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
      <Strip online={s.online} refused={refused} />
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

function Next({ s, setS, z, open }: { s: RunOutState; setS: SetS; z: Z; open: boolean }) {
  const held = heldRows(s);
  const t = s.tray;
  return (
    <View style={styles.list}>
      {s.landed.map((w) => (
        <View key={w} style={[shared.card, styles.landed]}>
          <Glyph paths={PATHS.check} ink={tokens.colorAccentText} side={18} />
          <Text size={16} weight="semibold" style={shared.grow}>
            {w}
          </Text>
        </View>
      ))}
      {t != null && !trayGone(s) && (
        <Pressable
          onPress={open ? () => setS({ ...s, screen: 'tray' }) : undefined}
          disabled={!open}
          accessibilityRole={open ? 'button' : undefined}
          style={({ pressed }) => [shared.card, styles.trayCard, pressed && styles.pressed]}
          testID="runOut.trayCard"
        >
          <Text size={12} weight="bold" style={styles.kicker}>
            TRAY IN HAND
          </Text>
          <Text size={20} weight="bold">
            {trayTitle(s)}
          </Text>
          <Text size={15} style={shared.secondary}>
            {trayLine(s)}
          </Text>
        </Pressable>
      )}
      {held.length > 0 && (
        <View style={styles.section}>
          <View style={styles.heldHead}>
            <Glyph paths={PATHS.clock} ink={tokens.colorInk} side={18} circle />
            <Text size={19} weight="bold" accessibilityRole="header">
              {`Held · ${held.length}`}
            </Text>
          </View>
          <Text size={14} style={shared.secondary}>
            On no tray until they have a choice
          </Text>
          {held.map((r) => (
            <Held key={r.guest.id} r={r} s={s} setS={setS} z={z} />
          ))}
        </View>
      )}
    </View>
  );
}

function Held({ r, s, setS, z }: { r: HeldRow; s: RunOutState; setS: SetS; z: Z }) {
  const owed = s.orders.find((o) => o.guest === r.guest.id)?.follow ?? [];
  return (
    <View style={shared.card}>
      <Text size={17} weight="semibold">
        {r.guest.name}
      </Text>
      <Text size={14} style={shared.secondary}>
        {r.where}
      </Text>
      <Flags g={r.guest} />
      <View style={styles.waitLine}>
        <Glyph paths={PATHS.clock} ink={tokens.colorAttentionText} side={15} circle />
        <Text size={15} weight="semibold" style={styles.attention}>
          {r.line}
        </Text>
      </View>
      {owed.length > 0 && (
        <Text size={14} style={shared.secondary}>
          {owed.map((i) => `${i} to follow`).join(' · ')}
        </Text>
      )}
      {r.canChoose && (
        <View style={styles.segments} accessibilityRole="radiogroup">
          {(
            [
              ['now', 'What’s ready, now'],
              ['wait', 'Wait for all'],
            ] as const
          ).map(([v, label]) => {
            const on = r.choice === v;
            return (
              <Pressable
                key={v}
                onPress={() => setS(chooseHeld(s, r.guest.id, v))}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                accessibilityLabel={`${label}, ${r.guest.name}`}
                style={[styles.segment, { minHeight: z.side }, on && styles.segmentOn]}
                testID={`runOut.held.${r.guest.id}.${v}`}
              >
                <Text size={15} weight={on ? 'bold' : 'semibold'} style={!on && shared.secondary}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
      {r.result !== '' && (
        <Text size={14} style={shared.secondary}>
          {r.result}
        </Text>
      )}
    </View>
  );
}

function Floor({ s }: { s: RunOutState }) {
  const seats = floorSeats(s);
  const table = s.tray?.table ?? 9;
  return (
    <View style={styles.list}>
      <Text size={19} weight="bold" accessibilityRole="header">
        {`Table ${table}`}
      </Text>
      {seats.map((x) => (
        <View key={x.guest.id} style={[shared.card, styles.seat]}>
          <View
            style={styles.seatNo}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Text size={16} weight="bold" accessible={false}>
              {String(x.guest.seat)}
            </Text>
          </View>
          <View style={[shared.grow, styles.seatText]}>
            <Text size={17} weight="semibold">
              {`Seat ${x.guest.seat} · ${x.guest.name}`}
            </Text>
            <Flags g={x.guest} />
            <Text size={14} style={shared.secondary}>
              {`${x.plate} · ${x.stage}`}
            </Text>
            {x.waiting && (
              <View style={styles.waitLine}>
                <Glyph paths={PATHS.clock} ink={tokens.colorAttentionText} side={15} circle />
                <Text size={15} weight="semibold" style={styles.attention}>
                  {`${RUN_OUT} has run out · waiting for the floor lead`}
                </Text>
              </View>
            )}
            {x.now !== '' && <Chip word={x.now} paths={PATHS.check} tone="accent" />}
          </View>
        </View>
      ))}
    </View>
  );
}

function TrayPane({ s, setS, z }: { s: RunOutState; setS: SetS; z: Z }) {
  const t = s.tray;
  if (t == null) return null;
  if (trayGone(s)) {
    return (
      <View style={styles.list}>
        <Text size={28} weight="bold" accessibilityRole="header">
          {`Table ${t.table} is on its way`}
        </Text>
        <Text size={15} style={shared.secondary}>
          What is owed goes first on your next tray here.
        </Text>
      </View>
    );
  }
  const inline = s.online && s.refused !== '' ? s.refused : '';
  return (
    <View style={styles.list}>
      <Text size={13} weight="bold" style={styles.kicker}>
        {trayLine(s).toUpperCase()}
      </Text>
      {t.check ? <Check s={s} setS={setS} z={z} /> : <Stop s={s} setS={setS} z={z} />}
      {inline !== '' && (
        <View accessibilityRole="alert" style={styles.refused}>
          <Glyph paths={PATHS.ban} ink={tokens.colorBrokenText} side={18} circle />
          <Text size={15} weight="semibold" style={[shared.grow, styles.broken]}>
            {inline}
          </Text>
        </View>
      )}
    </View>
  );
}

function Stop({ s, setS, z }: { s: RunOutState; setS: SetS; z: Z }) {
  const st = currentStop(s);
  const t = s.tray;
  if (st == null || t == null) return null;
  const lines = stopLines(s);
  const next = t.stops[t.at + 1];
  return (
    <>
      <Text size={28} weight="bold" accessibilityRole="header">
        {st.name}
      </Text>
      <View style={styles.person}>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Initials name={st.who} />
        </View>
        <Text size={15} style={shared.secondary}>
          {`${st.who} dishes here`}
        </Text>
      </View>
      <View style={styles.lines}>
        {lines.map((l) => (
          <StopRow key={`${l.guest.id}.${l.item}`} l={l} s={s} setS={setS} z={z} />
        ))}
      </View>
      <PrimaryButton
        label={next == null ? 'Check the tray' : `Next stop: ${stationOf(next).to}`}
        onPress={() => setS(moveOn(s))}
        testID="runOut.moveOn"
      />
    </>
  );
}

const LOOK_WORD = { on: 'On', notOn: 'Not on', runOut: 'Run out', bringAfter: 'Bring after' };

function StopRow({ l, s, setS, z }: { l: StopLine; s: RunOutState; setS: SetS; z: Z }) {
  const who = `Seat ${l.guest.seat} · ${l.guest.name}`;
  const runOut = l.look === 'runOut';
  const fresh = l.instead != null && l.look === 'on';
  const press =
    l.item === RUN_OUT
      ? runOut
        ? () => setS(markNotOn(s, l.guest.id))
        : undefined
      : l.look === 'bringAfter'
        ? undefined
        : () => setS(toggleLine(s, l.guest.id, l.item));
  return (
    <View style={[shared.card, styles.line]}>
      <Pressable
        onPress={press}
        disabled={press == null}
        accessibilityRole="button"
        accessibilityState={{ selected: l.look === 'on', disabled: press == null }}
        accessibilityLabel={`${l.item}, ${who}, ${LOOK_WORD[l.look]}${runOut ? '. Mark Not on' : ''}`}
        style={({ pressed }) => [
          styles.lineTap,
          { minHeight: Math.max(64, z.side) },
          pressed && styles.pressed,
        ]}
        testID={`runOut.line.${l.guest.id}.${l.item}`}
      >
        <View style={shared.grow}>
          <Text size={17} weight="semibold">
            {l.item}
          </Text>
          <Text size={14} style={shared.secondary}>
            {who}
          </Text>
          <Flags g={l.guest} />
          {fresh && (
            <Chip word={`New · instead of ${l.instead ?? ''}`} paths={PATHS.given} tone="accent" />
          )}
        </View>
        {runOut ? (
          <Chip word="Run out" paths={PATHS.ban} tone="broken" circle />
        ) : (
          <View style={styles.mark}>
            <View style={[styles.box, l.look === 'on' ? styles.boxOn : styles.boxOff]}>
              {l.look === 'on' && <Glyph paths={PATHS.check} ink={tokens.colorCard} side={18} />}
            </View>
            <Text size={14} weight="semibold" style={l.look === 'on' ? shared.accent : undefined}>
              {LOOK_WORD[l.look]}
            </Text>
          </View>
        )}
      </Pressable>
      {l.look === 'bringAfter' && (
        <Text size={14} style={shared.secondary}>
          {l.instead == null
            ? `Owed. ${l.guest.name} gets whatever the floor lead chooses, first on your next tray.`
            : `Owed: ${l.item} instead of ${l.instead}, first on your next tray.`}
        </Text>
      )}
      {l.canResolve && <Resolve g={l.guest} s={s} setS={setS} z={z} />}
    </View>
  );
}

function Resolve({ g, s, setS, z }: { g: Guest; s: RunOutState; setS: SetS; z: Z }) {
  return (
    <View style={styles.resolve}>
      <SecondaryButton
        label="Bring after"
        paired={z.phone}
        onPress={() => setS(bringAfter(markNotOn(s, g.id), g.id))}
        accessibilityLabel={`Bring ${RUN_OUT} after, Seat ${g.seat}`}
        testID={`runOut.bringAfter.${g.id}`}
      />
      <SecondaryButton
        label="Take off the tray"
        paired={z.phone}
        onPress={() => setS(takeOff(s, g.id))}
        accessibilityLabel={`Take Seat ${g.seat} off the tray`}
        testID={`runOut.takeOff.${g.id}`}
      />
    </View>
  );
}

function Check({ s, setS, z }: { s: RunOutState; setS: SetS; z: Z }) {
  const c = trayCheck(s);
  const t = s.tray;
  if (t == null) return null;
  const firstMissing = c.missing[0];
  return (
    <>
      <Text size={28} weight="bold" accessibilityRole="header">
        Check the tray
      </Text>
      <Text size={15} style={shared.secondary}>
        {`Look at every plate before it leaves for Table ${t.table}.`}
      </Text>
      {c.runOut.length > 0 && (
        <View style={styles.list}>
          <Text size={17} weight="bold" accessibilityRole="header">
            {`${RUN_OUT} has run out`}
          </Text>
          {c.runOut.map((r) => (
            <View key={r.guest.id} style={shared.card}>
              <Text size={16} weight="semibold">
                {`${r.item} · Seat ${r.guest.seat}, ${r.guest.name}`}
              </Text>
              <Chip word="Run out" paths={PATHS.ban} tone="broken" circle />
              <Resolve g={r.guest} s={s} setS={setS} z={z} />
            </View>
          ))}
        </View>
      )}
      {c.missing.length > 0 && (
        <View style={styles.list}>
          <Text size={17} weight="bold" accessibilityRole="header">
            Not on the tray
          </Text>
          {c.missing.map((r) => (
            <Text key={`${r.guest.id}.${r.item}`} size={15}>
              {`${r.item} · Seat ${r.guest.seat}, ${r.guest.name} · at ${r.station.to}, ${r.station.who}`}
            </Text>
          ))}
          {firstMissing != null && (
            <PrimaryButton
              label={`Go back to ${firstMissing.station.to}`}
              onPress={() => setS(goBackFor(s))}
              testID="runOut.goBack"
            />
          )}
        </View>
      )}
      {c.passes && (
        <View style={styles.list}>
          <Text size={17} weight="bold" accessibilityRole="header">
            {`All ${plural(onTray(s).length, 'plate', 'plates')} ready`}
          </Text>
          {c.ok.map((r) => (
            <View key={r.guest.id} style={[styles.okRow, shared.sep]}>
              <Text size={16} weight="semibold">
                {`Seat ${r.guest.seat} · ${r.guest.name}`}
              </Text>
              <Text size={14} style={shared.secondary}>
                {r.sub}
              </Text>
            </View>
          ))}
          <PrimaryButton
            label={`Take to Table ${t.table}`}
            onPress={() => setS(takeToTable(s))}
            testID="runOut.take"
          />
        </View>
      )}
    </>
  );
}

function Switches({ s, setS, start }: { s: RunOutState; setS: SetS; start: RunOutStateName }) {
  const g = guestOf(s.seatFour);
  const four = `Seat ${g.seat}`;
  return (
    <DemoOnly title="Board only: the floor lead, elsewhere in the room">
      <SecondaryButton
        label={`The floor lead serves Beef to ${four}`}
        onPress={() => setS(leadChooses(s, g.id, 'Beef'))}
        testID="runOut.demo.beef"
      />
      <SecondaryButton
        label={`The floor lead serves without ${RUN_OUT} to ${four}`}
        onPress={() => setS(leadChooses(s, g.id, null))}
        testID="runOut.demo.without"
      />
      <SecondaryButton
        label={s.online ? 'Lose the connection' : 'Come back online'}
        onPress={() => setS({ ...s, online: !s.online, refused: '', note: '' })}
        testID="runOut.demo.online"
      />
      <SecondaryButton
        label="Start this state again"
        onPress={() => setS(seed(start))}
        testID="runOut.demo.reset"
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
  left: {
    width: 440,
    borderRightWidth: 1,
    borderRightColor: tokens.colorBorder,
  },
  right: { flex: 1 },
  body: { padding: tokens.space3xl, gap: tokens.spaceXl, paddingBottom: tokens.space6xl },
  bodyPhone: { paddingHorizontal: tokens.spaceXl },
  back: { alignSelf: 'flex-start', justifyContent: 'center' },
  head: { gap: tokens.spaceXs },
  list: { gap: tokens.spaceLg },
  section: { gap: tokens.spaceSm },
  heldHead: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm },
  kicker: { color: tokens.colorInkSecondary, letterSpacing: 0.6 },
  trayCard: { borderWidth: 2, borderColor: tokens.colorAccent },
  landed: { flexDirection: 'row', alignItems: 'center', backgroundColor: tokens.colorAccentTint },
  pressed: { opacity: tokens.opacityPressed },
  waitLine: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceXs },
  attention: { flex: 1, minWidth: 0, color: tokens.colorAttentionText },
  broken: { color: tokens.colorBrokenText },
  segments: {
    flexDirection: 'row',
    padding: tokens.spaceHair,
    borderRadius: tokens.radiusInset,
    backgroundColor: tokens.colorInset,
    gap: tokens.spaceHair,
  },
  segment: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: tokens.spaceSm,
    borderRadius: tokens.radiusInset - 2,
  },
  segmentOn: { backgroundColor: tokens.colorCard },
  seat: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceLg },
  seatText: { gap: tokens.spaceXxs },
  seatNo: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorInset,
  },
  person: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm },
  lines: { gap: tokens.spaceSm },
  line: { gap: tokens.spaceSm },
  lineTap: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceLg },
  mark: { alignItems: 'center', gap: tokens.spaceXxs, minWidth: 56 },
  box: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: { backgroundColor: tokens.colorAccent },
  boxOff: {
    backgroundColor: tokens.colorCard,
    borderWidth: 2,
    borderColor: tokens.colorControlBorder,
  },
  resolve: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spaceSm },
  okRow: { paddingTop: tokens.spaceSm, gap: tokens.spaceXxs },
  refused: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceSm,
    padding: tokens.spaceLg,
    borderRadius: tokens.radiusInset,
    backgroundColor: tokens.colorBrokenTint,
  },
});
