import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton, QuietButton, SecondaryButton } from '../../components/Buttons.tsx';
import { Field, TextField } from '../../components/Field.tsx';
import { ReadOut, useReadOut } from '../../components/ReadOut.tsx';
import { Text } from '../../components/Text.tsx';
import { useLayout } from '../../layout/useLayout.ts';
import { DemoOnly } from '../../steps/Lines.tsx';
import { tokens } from '../../theme/tokens.ts';
import { goBack } from '../DemoScreen.tsx';
import { Glyph } from '../queue/QueueParts.tsx';
import { PATHS, TabBar, type TabId, TextAction, shared } from '../service/HowItsGoingParts.tsx';
import {
  DECLINE_BLANK,
  LEAD,
  LEAD_FIRST,
  NOTHING_TO_SERVE,
  NOT_SENT_HEADING,
  type NextState,
  type Request,
  SECTION,
  type TrayStateName,
  WAITER,
  chooseHeld,
  dish,
  doneRequest,
  goNext,
  goOffline,
  guestOf,
  heldAt,
  keepRequest,
  nextTray,
  noTablesLine,
  readyLine,
  reasonFor,
  reconnect,
  seed,
  sendDecline,
  setPerTrip,
  startDecline,
  startTray,
  stripLine,
  takeRequest,
  trayStateOf,
  undo,
  waitingOnKitchen,
} from './nextTrayModel.ts';
import { Kicker, type SetS, TrayInHand, Waiting, Who, type Z } from './TrayInHand.tsx';

export function NextTrayRoute() {
  const params = useLocalSearchParams<{ state?: string }>();
  const state = trayStateOf(params.state);

  return <NextTray key={state} start={state} />;
}

function NextTray({ start }: { start: TrayStateName }) {
  const { kind } = useLayout();
  const insets = useSafeAreaInsets();
  const [s, setS] = useState<NextState>(() => seed(start));
  const [tab, setTab] = useState<TabId>('next');
  const phone = kind === 'phone';
  const z: Z = { phone, side: phone ? tokens.sizeHitPhonePrimary : tokens.sizeHit };
  useReadOut(s.say === '' ? null : s.say, { answer: s });

  const head = <Head s={s} setS={setS} z={z} />;
  const demo = <Switches s={s} setS={setS} start={start} />;
  const tabs = (
    <TabBar tabs={['next', 'floor']} current={tab} onPick={setTab} bottom={insets.bottom} />
  );
  const floor = <FloorNote />;

  if (kind === 'tabletLandscape') {
    const inHand = s.tray != null || s.afterTray != null;
    return (
      <View style={[styles.page, styles.row, { paddingTop: insets.top }]}>
        <View style={styles.left}>
          <ScrollView contentContainerStyle={styles.body}>
            {head}
            {tab === 'floor' ? floor : <List s={s} setS={setS} z={z} withTray={false} />}
          </ScrollView>
          {tabs}
        </View>
        <ScrollView style={styles.right} contentContainerStyle={styles.body}>
          {inHand ? (
            <>
              <TrayInHand s={s} setS={setS} z={z} />
              <AfterTray s={s} setS={setS} z={z} />
            </>
          ) : (
            <Text size={15} style={shared.secondary}>
              No tray in hand. Start one from Next.
            </Text>
          )}
          {demo}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={[styles.body, phone && styles.bodyPhone]}>
        {head}
        {tab === 'floor' ? floor : <List s={s} setS={setS} z={z} withTray />}
        {demo}
      </ScrollView>
      {tabs}
    </View>
  );
}

function Head({ s, setS, z }: { s: NextState; setS: SetS; z: Z }) {
  return (
    <View style={styles.head}>
      <Pressable
        onPress={goBack}
        accessibilityRole="button"
        style={[styles.back, { minHeight: z.side }]}
        testID="nextTray.back"
      >
        <Text size={15} weight="semibold" style={shared.accent}>
          Back
        </Text>
      </Pressable>
      <Text size={30} weight="bold" accessibilityRole="header">
        Next
      </Text>
      <Text size={15} style={shared.secondary}>
        {s.onSection ? `${WAITER} · ${SECTION}` : WAITER}
      </Text>
      <ReadOut words={stripLine(s)} style={styles.strip} accessibilityRole="text">
        {s.online ? (
          <View style={styles.dot} />
        ) : (
          <Glyph paths={PATHS.offline} ink={tokens.colorInk} side={16} />
        )}
        <Text
          size={14}
          weight={s.online ? 'medium' : 'semibold'}
          style={[shared.grow, s.online ? shared.secondary : styles.ink]}
        >
          {stripLine(s)}
        </Text>
      </ReadOut>
      {s.refused !== '' && (
        <View accessibilityRole="alert" style={styles.notice} testID="nextTray.refused">
          <Glyph paths={PATHS.offline} ink={tokens.colorInk} side={18} />
          <Text size={15} weight="semibold" style={shared.grow}>
            {s.refused}
          </Text>
        </View>
      )}
      {s.notSent.length > 0 && (
        <View accessibilityRole="alert" style={styles.notSent} testID="nextTray.notSent">
          <Text size={16} weight="bold">
            {NOT_SENT_HEADING}
          </Text>
          {s.notSent.map((line) => (
            <Text key={line} size={16}>
              {line}
            </Text>
          ))}
          <QuietButton
            label="Got it"
            onPress={() => setS({ ...s, notSent: [] })}
            testID="nextTray.notSent.ok"
          />
        </View>
      )}
      {s.undo != null && (
        <View style={styles.undo}>
          <Text size={15} style={shared.grow}>
            {s.undo.what}
          </Text>
          <TextAction
            label="Undo"
            paths={PATHS.sentBack}
            onPress={() => setS(undo(s))}
            accessibilityLabel={`Undo ${s.undo.what}`}
            testID="nextTray.undo"
          />
        </View>
      )}
    </View>
  );
}

function List({ s, setS, z, withTray }: { s: NextState; setS: SetS; z: Z; withTray: boolean }) {
  const offer = nextTray(s);
  const held = waitingOnKitchen(s);
  const nothing = s.onSection && s.tray == null && s.afterTray == null && offer == null;
  return (
    <View style={styles.list}>
      {!s.onSection && (
        <Text size={17} weight="semibold" testID="nextTray.noTables">
          {noTablesLine(LEAD)}
        </Text>
      )}
      {withTray && <TrayInHand s={s} setS={setS} z={z} />}
      {withTray && <AfterTray s={s} setS={setS} z={z} />}
      {s.requests.map((r) => (
        <RequestCard key={r.id} r={r} s={s} setS={setS} />
      ))}
      {offer != null && <Offer s={s} setS={setS} z={z} />}
      {nothing && s.requests.length === 0 && (
        <Text size={17} weight="semibold" testID="nextTray.nothing">
          {NOTHING_TO_SERVE}
        </Text>
      )}
      {held.length > 0 && (
        <View style={styles.section}>
          <View style={styles.rowCenter}>
            <Glyph paths={PATHS.hourglass} ink={tokens.colorInk} side={18} />
            <Text size={19} weight="bold" accessibilityRole="header">
              Waiting on the kitchen
            </Text>
          </View>
          {held.map((p) => {
            const g = guestOf(p.guest);
            return (
              <View key={p.id} style={shared.card}>
                <Kicker>{`${g.table.toUpperCase()} · SEAT ${g.seat}`}</Kicker>
                <Text size={17} weight="semibold">
                  {g.name}
                </Text>
                <Text size={15}>{`Waiting for ${(p.held?.items ?? []).join(', ')}`}</Text>
                {readyLine(p) !== '' && (
                  <Text size={14} style={shared.secondary}>
                    {readyLine(p)}
                  </Text>
                )}
                {p.held?.choice === 'wait' && (
                  <Text size={14} style={shared.secondary}>
                    Wait for all
                  </Text>
                )}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

function Offer({ s, setS, z }: { s: NextState; setS: SetS; z: Z }) {
  const offer = nextTray(s);
  if (offer == null) return null;
  const n = s.perTrip;
  return (
    <View style={[shared.card, styles.offer]} testID="nextTray.offer">
      <View style={styles.stepper}>
        <View
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel="Plates per trip"
          accessibilityValue={{ min: 1, max: 8, now: n, text: String(n) }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(e) =>
            setS(setPerTrip(s, e.nativeEvent.actionName === 'increment' ? n + 1 : n - 1))
          }
          style={styles.stepLabel}
        >
          <Text size={15} weight="semibold">
            Plates per trip
          </Text>
          <Waiting on={s.waiting.includes('perTrip')} />
        </View>
        <Step side={z.side} plus={false} off={n <= 1} onPress={() => setS(setPerTrip(s, n - 1))} />
        <Text size={20} weight="bold" style={styles.stepNumber} accessible={false}>
          {String(n)}
        </Text>
        <Step side={z.side} plus off={n >= 8} onPress={() => setS(setPerTrip(s, n + 1))} />
      </View>
      <Kicker>NEXT TRAY</Kicker>
      <Text size={28} weight="bold" accessibilityRole="header">
        {offer.table}
      </Text>
      <Text size={15} style={shared.secondary}>
        {offer.plates.length === 1 ? '1 plate' : `${offer.plates.length} plates`}
      </Text>
      {offer.plates.map((p) => (
        <View key={p.id} style={styles.offerPlate}>
          <Who plate={p}>
            <Text size={14} style={shared.secondary}>
              {dish(p)}
            </Text>
          </Who>
        </View>
      ))}
      {s.tray == null && (
        <PrimaryButton
          label="Start the tray"
          onPress={() => setS(startTray(s))}
          testID="nextTray.start"
        />
      )}
    </View>
  );
}

function Step({
  side,
  plus,
  off,
  onPress,
}: {
  side: number;
  plus: boolean;
  off: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={off ? undefined : onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityState={{ disabled: off }}
      accessibilityLabel={plus ? 'More plates per trip' : 'Fewer plates per trip'}
      style={({ pressed }) => [
        styles.step,
        { width: side, height: side },
        off && styles.stepOff,
        pressed && styles.pressed,
      ]}
      testID={`nextTray.perTrip.${plus ? 'plus' : 'minus'}`}
    >
      <Glyph
        paths={plus ? ['M12 5v14', 'M5 12h14'] : ['M5 12h14']}
        ink={off ? tokens.colorInkTertiary : tokens.colorInk}
        side={20}
      />
    </Pressable>
  );
}

function AfterTray({ s, setS, z }: { s: NextState; setS: SetS; z: Z }) {
  const table = s.afterTray;
  if (table == null) return null;
  const held = heldAt(s, table);
  return (
    <View style={[shared.card, styles.offer]} testID="nextTray.afterTray">
      <Kicker>{`${table.toUpperCase()} · HELD`}</Kicker>
      <Text size={22} weight="bold" accessibilityRole="header">
        {`Still waiting at ${table}`}
      </Text>
      {held.map((p) => {
        const g = guestOf(p.guest);
        const h = p.held;
        if (h == null) return null;
        return (
          <View key={p.id} style={styles.offerPlate}>
            <Who plate={p}>
              <Text size={15}>{`Waiting for ${h.items.join(', ')}`}</Text>
              {readyLine(p) !== '' && (
                <Text size={14} style={shared.secondary}>
                  {readyLine(p)}
                </Text>
              )}
            </Who>
            <View style={styles.choices}>
              {h.anyReady && (
                <SecondaryButton
                  label="What’s ready, now"
                  paired={z.phone}
                  onPress={() => setS(chooseHeld(s, p.id, 'now'))}
                  accessibilityLabel={`What’s ready, now, ${g.name}`}
                  testID={`nextTray.held.${p.id}.now`}
                />
              )}
              <SecondaryButton
                label="Wait for all"
                paired={z.phone}
                onPress={() => setS(chooseHeld(s, p.id, 'wait'))}
                accessibilityLabel={`Wait for all, ${g.name}`}
                testID={`nextTray.held.${p.id}.wait`}
              />
            </View>
            <Waiting on={s.waiting.includes(p.id)} />
          </View>
        );
      })}
      <PrimaryButton label="Next tray" onPress={() => setS(goNext(s))} testID="nextTray.next" />
    </View>
  );
}

function RequestCard({ r, s, setS }: { r: Request; s: NextState; setS: SetS }) {
  const where = r.seat == null ? r.table : `${r.table} · seat ${r.seat}`;
  return (
    <View style={shared.card} testID={`nextTray.request.${r.id}`}>
      <View style={styles.rowCenter}>
        <Glyph paths={PATHS.request} ink={tokens.colorInk} side={16} />
        <Kicker>{`REQUEST · ${where.toUpperCase()}`}</Kicker>
      </View>
      <Text size={17} weight="semibold">
        {r.words}
      </Text>
      <Text size={14} style={shared.secondary}>
        {r.mine ? `Yours · opened ${r.opened}` : `Nobody has it yet · opened ${r.opened}`}
      </Text>
      {r.declining ? (
        <View style={styles.section}>
          <Field label="Why it can’t be done" error={r.reasonWrong ? DECLINE_BLANK : null}>
            <TextField
              accessibilityLabel="Why it can’t be done"
              value={r.reason}
              onChangeText={(v) => setS(reasonFor(s, r.id, v))}
              wrong={r.reasonWrong}
              testID={`nextTray.reason.${r.id}`}
            />
          </Field>
          <View style={styles.choices}>
            <QuietButton
              label="Keep it"
              onPress={() => setS(keepRequest(s, r.id))}
              testID={`nextTray.keepRequest.${r.id}`}
            />
            <PrimaryButton
              label="Decline request"
              onPress={() => setS(sendDecline(s, r.id))}
              testID={`nextTray.declineSend.${r.id}`}
            />
          </View>
        </View>
      ) : (
        <View style={styles.choices}>
          <PrimaryButton
            label={r.mine ? 'Done' : 'I’ll do it'}
            paired
            onPress={() => setS(r.mine ? doneRequest(s, r.id) : takeRequest(s, r.id))}
            testID={`nextTray.request.${r.id}.${r.mine ? 'done' : 'take'}`}
          />
          <SecondaryButton
            label="Decline"
            paired
            onPress={() => setS(startDecline(s, r.id))}
            testID={`nextTray.request.${r.id}.decline`}
          />
        </View>
      )}
    </View>
  );
}

function FloorNote() {
  return (
    <DemoOnly title="Board only: Floor is sc-4021’s, in its own demo">
      <SecondaryButton
        label="Open Floor’s demo"
        onPress={() => router.push('/demo/floor')}
        testID="nextTray.demo.floor"
      />
    </DemoOnly>
  );
}

function Switches({ s, setS, start }: { s: NextState; setS: SetS; start: TrayStateName }) {
  return (
    <DemoOnly title="Board only: the connection, and the room around this phone">
      <SecondaryButton
        label={s.online ? 'Lose the connection' : 'Come back online'}
        onPress={() => setS(s.online ? goOffline(s) : reconnect(s))}
        testID="nextTray.demo.online"
      />
      {s.leadTookOff != null && (
        <Text size={14} style={shared.secondary}>
          {`Meanwhile, ${LEAD_FIRST} took ${guestOf(s.leadTookOff.split('.')[0] ?? '').name} off this tray on Floor.`}
        </Text>
      )}
      <SecondaryButton
        label="Start this state again"
        onPress={() => setS(seed(start))}
        testID="nextTray.demo.reset"
      />
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
  strip: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: tokens.colorAccent },
  ink: { color: tokens.colorInk },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceSm,
    padding: tokens.spaceLg,
    borderRadius: tokens.radiusInset,
    backgroundColor: tokens.colorInset,
  },
  notSent: {
    gap: tokens.spaceSm,
    padding: tokens.spaceLg,
    borderRadius: tokens.radiusInset,
    borderWidth: 2,
    borderColor: tokens.colorAttention,
    backgroundColor: tokens.colorAttentionWash,
  },
  undo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: tokens.spaceSm,
    padding: tokens.spaceMd,
    borderRadius: tokens.radiusInset,
    backgroundColor: tokens.colorInset,
  },
  list: { gap: tokens.spaceLg },
  section: { gap: tokens.spaceSm },
  rowCenter: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm },
  offer: { gap: tokens.spaceSm },
  offerPlate: {
    gap: tokens.spaceSm,
    paddingTop: tokens.spaceSm,
    borderTopWidth: 1,
    borderTopColor: tokens.colorBorder,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: tokens.spaceSm,
    paddingBottom: tokens.spaceSm,
  },
  stepLabel: { flex: 1, minWidth: 120 },
  stepNumber: { minWidth: 28, textAlign: 'center' },
  step: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.radiusInset,
    borderWidth: 1,
    borderColor: tokens.colorControlBorder,
    backgroundColor: tokens.colorCard,
  },
  stepOff: { borderStyle: 'dashed', backgroundColor: tokens.colorInset },
  pressed: { opacity: tokens.opacityPressed },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spaceSm },
});
