import { useLocalSearchParams } from 'expo-router';
import { type ReactNode, type RefObject, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type ViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton, QuietButton, SecondaryButton } from '../../components/Buttons.tsx';
import { Field, TextField } from '../../components/Field.tsx';
import { useReadOut } from '../../components/ReadOut.tsx';
import {
  type ScreenReaderTarget,
  moveScreenReaderFocus,
} from '../../components/screenReaderFocus.ts';
import { Sheet } from '../../components/Sheet.tsx';
import { Text } from '../../components/Text.tsx';
import { useLayout } from '../../layout/useLayout.ts';
import { DemoOnly } from '../../steps/Lines.tsx';
import { tokens } from '../../theme/tokens.ts';
import { goBack } from '../DemoScreen.tsx';
import { FlagLine, Glyph } from '../queue/QueueParts.tsx';
import { plates } from './HowItsGoingModel.ts';
import { Chip, PATHS, Strip, TabBar, type TabId, shared } from './HowItsGoingParts.tsx';
import { AddRequest } from './RequestsForm.tsx';
import {
  ACTION_WORD,
  AS_OF,
  type Action,
  DECLINE_BLANK,
  type Demo,
  type GuestRequest,
  NOW,
  type Refusal,
  STAFFED,
  TRAYS,
  WORDS_MAX,
  closedLine,
  decline,
  done,
  kindLine,
  nextOrder,
  offered,
  openDecline,
  openFor,
  ownerLine,
  requestSeed,
  servingName,
  requestStateOf,
  take,
  table21,
} from './RequestsModel.ts';

export function RequestsRoute() {
  const params = useLocalSearchParams<{ state?: string }>();
  const state = requestStateOf(params.state);

  return <Requests key={state} start={state} />;
}

type Aim = { id: string; to: 'done' | 'decline' | 'reason' } | { id: 'heading' } | null;

const VIEW_TAB: Record<Demo['view'], TabId> = { floor: 'floor', next: 'next', alerts: 'service' };
const TAB_VIEW: Partial<Record<TabId, Demo['view']>> = {
  floor: 'floor',
  next: 'next',
  service: 'alerts',
};

function Requests({ start }: { start: ReturnType<typeof requestStateOf> }) {
  const insets = useSafeAreaInsets();
  const layout = useLayout().kind;
  const [d, setD] = useState<Demo>(() => requestSeed(start));
  const [said, setSaid] = useState(0);
  const [aim, setAim] = useState<Aim>(null);
  const opener = useRef<ViewInstance | null>(null);
  const heading = useRef<ViewInstance | null>(null);
  const targets = useRef(new Map<string, ScreenReaderTarget | null>());

  useReadOut(said === 0 || d.say === '' ? null : d.say, { answer: said });
  useEffect(() => {
    if (aim == null) return;
    const node = 'to' in aim ? targets.current.get(`${aim.id}.${aim.to}`) : heading.current;
    moveScreenReaderFocus(node ?? null);
  }, [aim]);

  const docked = layout === 'tabletLandscape' && d.view === 'floor' && d.form != null;
  const wasDocked = useRef(docked);
  useEffect(() => {
    if (wasDocked.current && !docked) moveScreenReaderFocus(opener.current);
    wasDocked.current = docked;
  }, [docked]);

  function apply(next: Demo, then: Aim = null): void {
    setD(next);
    setSaid((n) => n + 1);
    setAim(then);
  }

  function press(r: GuestRequest, a: Action): void {
    if (a === 'take') apply(take(d, r.id), { id: r.id, to: 'done' });
    else if (a === 'done') {
      const next = done(d, r.id);
      apply(next, next.list.find((q) => q.id === r.id)?.closed ? { id: 'heading' } : null);
    } else apply(openDecline(d, r.id), { id: r.id, to: 'reason' });
  }

  const wide = layout === 'tabletLandscape';
  const tabs: TabId[] = d.viewer.manage ? ['next', 'floor', 'service'] : ['next', 'floor'];
  const card = (r: GuestRequest) => (
    <RequestCard
      key={r.id}
      r={r}
      d={d}
      setD={setD}
      press={press}
      apply={apply}
      target={(to, node) => targets.current.set(`${r.id}.${to}`, node)}
    />
  );

  const floor = (
    <TableView
      d={d}
      wide={wide}
      card={card}
      heading={heading}
      opener={opener}
      onAdd={() =>
        setD({ ...d, form: d.form ?? { kind: null, who: 'table', dish: null, words: '' } })
      }
    />
  );

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <View style={styles.row}>
        <ScrollView style={shared.grow} contentContainerStyle={styles.body}>
          <Pressable
            onPress={goBack}
            accessibilityRole="button"
            style={styles.back}
            testID="requests.back"
          >
            <Text size={15} weight="semibold" style={shared.accent}>
              Back
            </Text>
          </Pressable>
          {d.view === 'floor' && floor}
          {d.view === 'next' && <NextView d={d} card={card} />}
          {d.view === 'alerts' && (
            <AlertsView d={d} onGo={() => setD({ ...d, view: 'floor', table: table21() })} />
          )}
          <DemoSwitches d={d} setD={setD} reset={() => apply(requestSeed(start))} />
        </ScrollView>
        {wide && d.view === 'floor' && d.form != null && (
          <View style={styles.docked} testID="requests.docked">
            <ScrollView contentContainerStyle={styles.dockedBody}>
              <AddRequest d={d} setD={setD} apply={apply} framed="docked" />
            </ScrollView>
          </View>
        )}
      </View>
      {!wide && (
        <Sheet
          open={d.view === 'floor' && d.form != null}
          onClose={() => setD({ ...d, form: null, tried: false, refused: '' })}
          scrimLabel="Close without adding"
          opener={opener}
          testID="requests.sheet"
        >
          <AddRequest
            d={d}
            setD={setD}
            apply={apply}
            framed={layout === 'phone' ? 'sheet' : 'dialog'}
          />
        </Sheet>
      )}
      <TabBar
        tabs={tabs}
        current={VIEW_TAB[d.view]}
        onPick={(t) => setD({ ...d, view: TAB_VIEW[t] ?? 'floor' })}
        bottom={Math.max(insets.bottom, tokens.spaceSm)}
      />
    </View>
  );
}

function TableView({
  d,
  wide,
  card,
  heading,
  opener,
  onAdd,
}: {
  d: Demo;
  wide: boolean;
  card: (r: GuestRequest) => ReactNode;
  heading: RefObject<ViewInstance | null>;
  opener: RefObject<ViewInstance | null>;
  onAdd: () => void;
}) {
  const here = d.list.filter((r) => r.table === d.table.name);
  const open = here
    .filter((r) => r.closed == null || d.notice[r.id] != null)
    .sort((a, b) => openFor(b) - openFor(a));
  const closed = here.filter((r) => r.closed != null);
  const flagged = d.table.seats.filter((s) => s.flags.length > 0);
  const openCount = here.filter((r) => r.closed == null).length;
  return (
    <>
      <View style={styles.header}>
        <Text size={30} weight="bold" accessibilityRole="header">
          {d.table.name}
        </Text>
        <Text size={15} weight="medium" style={shared.secondary}>
          {[`Section ${d.table.section}`, servingName(d.table.courses), d.viewer.name]
            .filter(Boolean)
            .join(' · ')}
        </Text>
        <Strip online={d.online} refused={d.refused} />
      </View>
      {wide && flagged.length > 0 && (
        <View style={shared.card} testID="requests.flagged">
          <Text size={20} weight="bold" accessibilityRole="header">
            Flagged guests
          </Text>
          {flagged.map((s) => (
            <View key={s.n} style={[styles.flagRow, s !== flagged[0] && shared.sep]}>
              <Text size={15} weight="semibold">
                {`Seat ${s.n}${s.name == null ? '' : ` · ${s.name}`}`}
              </Text>
              {s.flags.map((f) => (
                <FlagLine key={f.words} flag={f.words} />
              ))}
            </View>
          ))}
        </View>
      )}
      <View style={shared.card} testID="requests.section">
        <View style={styles.headRow}>
          <View ref={heading} accessible accessibilityRole="header">
            <Text size={20} weight="bold">
              Requests
            </Text>
          </View>
          <Chip
            word={`${openCount} open`}
            paths={openCount > 0 ? PATHS.request : PATHS.check}
            tone={openCount > 0 ? 'attention' : 'accent'}
          />
          <View style={shared.grow} />
          <SecondaryButton label="Add request" ref={opener} onPress={onAdd} testID="requests.add" />
        </View>
        {open.length === 0 && (
          <Text size={15} style={shared.secondary}>
            Nothing open at this table.
          </Text>
        )}
        {open.map(card)}
      </View>
      {closed.length > 0 && (
        <View style={shared.card}>
          <Text size={17} weight="bold" accessibilityRole="header">
            Closed at this table
          </Text>
          {closed.map((r, i) => (
            <View key={r.id} style={[styles.closed, i > 0 && shared.sep]}>
              <Glyph
                paths={r.closed?.outcome === 'Done' ? PATHS.check : ['M18 6 6 18', 'm6 6 12 12']}
                ink={tokens.colorInkSecondary}
                side={16}
              />
              <View style={shared.grow}>
                <Text size={15} weight="semibold">
                  {r.words}
                </Text>
                <Text size={14} style={shared.secondary}>
                  {closedLine(r)}
                </Text>
                {r.closed?.reason != null && (
                  <Text size={14} style={shared.secondary}>
                    {`Why it can’t be done: ${r.closed.reason}`}
                  </Text>
                )}
              </View>
            </View>
          ))}
        </View>
      )}
      <View style={shared.card}>
        <Text size={15} style={shared.secondary}>
          The table’s seats and plates follow here, as Floor draws them (sc-4021).
        </Text>
      </View>
    </>
  );
}

function RequestCard({
  r,
  d,
  setD,
  press,
  apply,
  target,
}: {
  r: GuestRequest;
  d: Demo;
  setD: (d: Demo) => void;
  press: (r: GuestRequest, a: Action) => void;
  apply: (d: Demo, aim?: Aim) => void;
  target: (to: 'done' | 'decline' | 'reason' | 'notice', node: ScreenReaderTarget | null) => void;
}) {
  const notice = d.notice[r.id];
  const seat = d.table.seats.find((s) => s.n === r.seat);
  if (r.closed != null && notice != null)
    return (
      <View accessibilityRole="alert" style={styles.warn} testID={`requests.first.${r.id}`}>
        <Glyph paths={WARN} ink={tokens.colorAttentionText} side={18} />
        <View style={shared.grow}>
          <Text size={16} weight="semibold">
            {notice}
          </Text>
          <Text size={14} style={shared.secondary}>
            {r.words}
          </Text>
        </View>
      </View>
    );
  return (
    <RequestCardView
      id={r.id}
      kind={kindLine(r)}
      words={r.words}
      plate={r.plate}
      flags={seat?.flags.map((f) => f.words) ?? []}
      owner={`${ownerLine(r, d.viewer)}${d.online ? '' : ` · as of ${AS_OF}`}`}
      notice={notice}
      declining={d.declining === r.id}
      reason={d.reason}
      reasonWrong={d.reasonWrong}
      buttons={offered(r, d)}
      onReason={(reason) =>
        setD({ ...d, reason, reasonWrong: d.reasonWrong && reason.trim() === '' })
      }
      onKeep={() => apply({ ...d, declining: null }, { id: r.id, to: 'decline' })}
      onSend={() => {
        const next = decline(d);
        apply(next, next.declining == null ? { id: 'heading' } : { id: r.id, to: 'reason' });
      }}
      onPress={(a) => press(r, a)}
      target={target}
      testPrefix="requests"
    />
  );
}

export function RequestCardView({
  id,
  kind,
  words,
  plate,
  flags,
  owner,
  notice,
  declining,
  reason,
  reasonWrong,
  buttons,
  onReason,
  onKeep,
  onSend,
  onPress,
  target,
  testPrefix,
}: {
  id: string;
  kind: string;
  words: string;
  plate: { now: string; next: string } | undefined;
  flags: readonly string[];
  owner: string;
  notice: string | undefined;
  declining: boolean;
  reason: string;
  reasonWrong: boolean;
  buttons: readonly Action[];
  onReason: (reason: string) => void;
  onKeep: () => void;
  onSend: () => void;
  onPress: (a: Action) => void;
  target: (to: 'done' | 'decline' | 'reason' | 'notice', node: ScreenReaderTarget | null) => void;
  testPrefix: string;
}) {
  return (
    <View style={styles.card} testID={`${testPrefix}.card.${id}`}>
      <Text size={13} weight="semibold" style={styles.kicker}>
        {kind}
      </Text>
      <Text size={18} weight="bold">
        {words}
      </Text>
      {plate != null && (
        <View style={styles.plate}>
          <Text size={14}>{`Now: ${plate.now}`}</Text>
          <Text size={14} weight="semibold">{`New: ${plate.next}`}</Text>
          {flags.map((f) => (
            <FlagLine key={f} flag={f} />
          ))}
        </View>
      )}
      <Text size={14} weight="medium" style={shared.secondary}>
        {owner}
      </Text>
      {notice != null && (
        <View accessibilityRole="alert" style={styles.warn} ref={(n) => target('notice', n)}>
          <Glyph paths={WARN} ink={tokens.colorAttentionText} side={18} />
          <Text size={15} weight="semibold" style={shared.grow}>
            {notice}
          </Text>
        </View>
      )}
      {declining ? (
        <View style={styles.decline}>
          <Field label="Why it can’t be done" error={reasonWrong ? DECLINE_BLANK : null}>
            <TextField
              accessibilityLabel="Why it can’t be done"
              ref={(n) => target('reason', n)}
              value={reason}
              onChangeText={onReason}
              maxLength={WORDS_MAX}
              wrong={reasonWrong}
              testID={`${testPrefix}.reason.${id}`}
            />
          </Field>
          <View style={styles.buttons}>
            <QuietButton label="Keep it" onPress={onKeep} testID={`${testPrefix}.keep.${id}`} />
            <PrimaryButton
              label="Decline request"
              onPress={onSend}
              testID={`${testPrefix}.declineSend.${id}`}
            />
          </View>
        </View>
      ) : (
        buttons.length > 0 && (
          <View style={styles.buttons}>
            {buttons.map((a, i) =>
              i === 0 && a !== 'decline' ? (
                <PrimaryButton
                  key={a}
                  label={ACTION_WORD[a]}
                  ref={(n) => target(a === 'done' ? 'done' : 'decline', n)}
                  onPress={() => onPress(a)}
                  testID={`${testPrefix}.${a}.${id}`}
                />
              ) : (
                <SecondaryButton
                  key={a}
                  label={ACTION_WORD[a]}
                  ref={(n) => {
                    if (a !== 'take') target(a, n);
                  }}
                  onPress={() => onPress(a)}
                  testID={`${testPrefix}.${a}.${id}`}
                />
              ),
            )}
          </View>
        )
      )}
    </View>
  );
}

const WARN = [
  'M12 9v4',
  'M12 17h.01',
  'M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
];

function NextView({ d, card }: { d: Demo; card: (r: GuestRequest) => ReactNode }) {
  const items = nextOrder(TRAYS, d.list, d.viewer, STAFFED);
  return (
    <>
      <View style={styles.header}>
        <Text size={30} weight="bold" accessibilityRole="header">
          Next
        </Text>
        <Text size={15} weight="medium" style={shared.secondary}>
          {`${d.viewer.name} · Section ${d.viewer.section}`}
        </Text>
        <Strip online={d.online} refused={d.refused} />
      </View>
      {items.map((it) => {
        if (it.kind === 'request')
          return (
            <View key={it.request.id} style={shared.card} testID={`next.request.${it.request.id}`}>
              <View style={shared.wrap}>
                <Chip word="Request" paths={PATHS.request} tone="attention" />
                <Text size={15} weight="semibold">
                  {it.request.section === d.viewer.section
                    ? it.request.table
                    : `${it.request.table} · Section ${it.request.section}`}
                </Text>
              </View>
              {card(it.request)}
            </View>
          );
        const chip =
          it.kind === 'inHand'
            ? { word: 'In hand', paths: PATHS.tray, tone: 'accent' as const }
            : it.kind === 'given'
              ? { word: 'Given to you', paths: PATHS.given, tone: 'accent' as const }
              : { word: 'Next tray', paths: PATHS.given, tone: 'plain' as const };
        return (
          <View key={it.kind} style={shared.card} testID={`next.${it.kind}`}>
            <Chip {...chip} />
            <Text size={it.kind === 'inHand' ? 26 : 20} weight="bold">
              {`${it.tray.table} · ${plates(it.tray.plates)}`}
            </Text>
            <Text size={15}>{it.tray.line}</Text>
          </View>
        );
      })}
    </>
  );
}

function AlertsView({ d, onGo }: { d: Demo; onGo: () => void }) {
  const water = d.list.find((r) => r.id === 'water');
  const open = water != null && water.closed == null;
  return (
    <>
      <View style={styles.header}>
        <Text size={30} weight="bold" accessibilityRole="header">
          Service
        </Text>
        <Text size={15} weight="medium" style={shared.secondary}>
          {[servingName(d.table.courses), d.viewer.name].filter(Boolean).join(' · ')}
        </Text>
        <Strip online={d.online} refused="" />
      </View>
      <View style={shared.card}>
        <Text size={20} weight="bold" accessibilityRole="header">
          Alerts
        </Text>
        <Text size={14} style={shared.secondary}>
          Newest first. Each leaves by itself once its cause clears.
        </Text>
        {open ? (
          <View style={styles.alert} testID="requests.alert">
            <View style={styles.alertHead}>
              <View style={styles.alertIcon}>
                <Glyph paths={PATHS.request} ink={tokens.colorInk} side={18} />
              </View>
              <View style={shared.grow}>
                <Text size={16} weight="semibold">
                  {`A request open ${openFor(water)} min`}
                </Text>
                <Text size={14} style={shared.secondary}>
                  {`${water.table} · “${water.words}”`}
                </Text>
              </View>
            </View>
            <SecondaryButton label="Go to table" onPress={onGo} testID="requests.goToTable" />
          </View>
        ) : (
          <Text size={15} style={shared.secondary}>
            Nothing needs you.
          </Text>
        )}
      </View>
    </>
  );
}

const PENDING: readonly { word: string; pending: Refusal | null }[] = [
  { word: 'Done goes through', pending: null },
  { word: 'Someone closed it first', pending: 'closedFirst' },
  { word: 'The order went Dishing', pending: 'stage' },
  { word: 'A flag was added', pending: 'flag' },
];

function DemoSwitches({ d, setD, reset }: { d: Demo; setD: (d: Demo) => void; reset: () => void }) {
  return (
    <DemoOnly title="Demo only: what the server answers next, the connection, and the person">
      {PENDING.map((p) => (
        <SecondaryButton
          key={p.word}
          label={`${p.word}${d.pending === p.pending ? ' · chosen' : ''}`}
          onPress={() => setD({ ...d, pending: p.pending })}
          testID={`requests.demo.pending.${p.pending ?? 'none'}`}
        />
      ))}
      <SecondaryButton
        label={d.online ? 'Lose the connection' : 'Connect again'}
        onPress={() => setD({ ...d, online: !d.online, refused: '' })}
        testID="requests.demo.online"
      />
      <SecondaryButton label="Start again" onPress={reset} testID="requests.demo.reset" />
      <Text size={13} style={shared.secondary}>
        {`It is ${NOW}. ${d.viewer.manage ? 'You are the floor lead (service.manage).' : 'You have service.work.'}`}
      </Text>
    </DemoOnly>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: tokens.colorPage },
  row: { flex: 1, flexDirection: 'row' },
  body: { padding: tokens.spaceLg, gap: tokens.spaceMd, paddingBottom: tokens.spaceXl },
  back: { minHeight: tokens.sizeHit, justifyContent: 'center', alignSelf: 'flex-start' },
  header: { gap: tokens.spaceXs },
  headRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: tokens.spaceSm },
  kicker: { color: tokens.colorInkSecondary, letterSpacing: 0.4 },
  card: {
    gap: tokens.spaceSm,
    padding: tokens.spaceLg,
    borderRadius: tokens.radiusRow,
    backgroundColor: tokens.colorInset,
  },
  plate: {
    gap: 4,
    padding: tokens.spaceMd,
    borderRadius: tokens.radiusSmall,
    backgroundColor: tokens.colorCard,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
  },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spaceSm, alignItems: 'center' },
  decline: { gap: tokens.spaceSm },
  warn: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: tokens.spaceMd,
    borderRadius: tokens.radiusRow,
    backgroundColor: tokens.colorAttentionTint,
  },
  closed: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 8 },
  flagRow: { gap: 4, paddingVertical: 8 },
  docked: {
    width: 520,
    borderLeftWidth: 1,
    borderLeftColor: tokens.colorBorder,
    backgroundColor: tokens.colorCard,
  },
  dockedBody: { padding: tokens.spaceXl, gap: tokens.spaceMd },
  alert: { gap: tokens.spaceSm, paddingVertical: tokens.spaceMd },
  alertHead: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceMd },
  alertIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: tokens.colorInset,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
