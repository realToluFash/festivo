import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type ViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, Path, Pattern, Rect, Text as SvgText } from 'react-native-svg';

import { PrimaryButton, SecondaryButton } from '../../components/Buttons.tsx';
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
import { ALERT_ICON, Chip, CountShape, Hatch, PATHS, TabBar, shared } from './HowItsGoingParts.tsx';
import { RequestCardView } from './RequestsScreen.tsx';
import {
  AS_OF,
  type Action,
  type Alert,
  COURSE,
  EVENT,
  KEY,
  LEAD,
  NO_MANAGE,
  type Request,
  type Room,
  type RoomTable,
  SECTIONS,
  type Seat,
  type SeatState,
  type Section,
  type SortKey,
  type View as RoomView,
  WAITER,
  type Word,
  alertsOf,
  ariaSort,
  closePanel,
  closedLine,
  closedRequests,
  decline,
  done,
  flaggedSaid,
  flaggedSeats,
  flaggedWord,
  goToTable,
  heldLine,
  kindLine,
  offered,
  onItLine,
  openDecline,
  openPanel,
  openRequests,
  owedLine,
  ownerLine,
  pressSort,
  requestsInOrder,
  roomSeed,
  roomStateOf,
  sectionBehind,
  sectionName,
  sectionTables,
  seatWho,
  sorted,
  stateWord,
  stripLine,
  tableLabel,
  tableOf,
  tablesWord,
  take,
  trayLine,
  waitWord,
  wordOf,
} from './ServiceRoomModel.ts';

export function ServiceRoomRoute() {
  const params = useLocalSearchParams<{ state?: string }>();
  const state = roomStateOf(params.state);

  return <ServiceRoom key={state} start={state} />;
}

const VIEW_WORDS: Record<RoomView, string> = {
  going: 'How it’s going',
  plan: 'Plan',
  list: 'List',
};

const WARN = [
  'M12 9v4',
  'M12 17h.01',
  'M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
];

const PENDING: readonly { p: Room['pending']; word: string }[] = [
  { p: null, word: 'Done goes through' },
  { p: 'closedFirst', word: 'Someone closed it first' },
  { p: 'plate_stage_invalid', word: 'The plate went Dishing' },
  { p: 'dish_not_for_guest', word: 'A flag rules the dish out' },
];

type Aim = string | null;

function ServiceRoom({ start }: { start: ReturnType<typeof roomStateOf> }) {
  const insets = useSafeAreaInsets();
  const wide = useLayout().kind === 'tabletLandscape';
  const [r, setR] = useState<Room>(() => roomSeed(start));
  const [said, setSaid] = useState(0);
  const [aim, setAim] = useState<Aim>(null);
  const targets = useRef(new Map<string, ScreenReaderTarget | null>());

  useReadOut(said === 0 || r.say === '' ? null : r.say, { answer: said });
  useEffect(() => {
    if (aim == null) return;
    moveScreenReaderFocus(targets.current.get(aim) ?? null);
  }, [aim]);

  function apply(next: Room, then: Aim = null): void {
    setR(next);
    setSaid((n) => n + 1);
    setAim(then);
  }

  const target = (key: string) => (node: ScreenReaderTarget | null) => {
    targets.current.set(key, node);
  };
  const open = tableOf(r, r.open);
  const toTable = (n: number) => apply(openPanel(r, n), 'panel');
  const panel = open != null && (
    <Panel
      r={r}
      t={open}
      apply={apply}
      target={target}
      onClose={() => apply(closePanel(r), `tile.${open.n}`)}
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
            testID="room.back"
          >
            <Text size={15} weight="semibold" style={shared.accent}>
              Back
            </Text>
          </Pressable>
          <View style={styles.header}>
            <Text size={30} weight="bold" accessibilityRole="header">
              Service
            </Text>
            <Text size={15} weight="medium" style={shared.secondary}>
              {r.started ? `${COURSE} · ${EVENT}` : EVENT}
            </Text>
            <RoomStrip r={r} />
          </View>
          <View style={styles.views} accessibilityRole="tablist">
            {(['going', 'plan', 'list'] as const).map((v) => (
              <Pressable
                key={v}
                onPress={() => apply({ ...r, view: v })}
                accessibilityRole="tab"
                accessibilityState={{ selected: r.view === v }}
                style={[styles.view, r.view === v && styles.viewOn]}
                testID={`room.view.${v}`}
              >
                <Text size={15} weight={r.view === v ? 'bold' : 'semibold'}>
                  {VIEW_WORDS[v]}
                </Text>
              </Pressable>
            ))}
          </View>
          {r.loading ? (
            <View
              accessible
              accessibilityLabel="Loading the room"
              style={styles.loading}
              testID="room.loading"
            >
              <View style={[styles.skeleton, { height: 88 }]} />
              <View style={[styles.skeleton, { height: 360 }]} />
            </View>
          ) : r.view === 'going' ? (
            <View style={shared.card}>
              <Text size={15} style={shared.secondary}>
                How it’s going is sc-34107’s, in its own demo (/demo/how-its-going).
              </Text>
            </View>
          ) : (
            <>
              {r.refused !== '' && (
                <View accessibilityRole="alert" style={styles.notice}>
                  <Glyph paths={PATHS.offline} ink={tokens.colorInk} side={18} />
                  <Text size={15} weight="semibold" style={shared.grow}>
                    {r.refused}
                  </Text>
                </View>
              )}
              {!r.started && <NotStarted />}
              <View style={wide ? styles.columns : styles.stack}>
                <View style={[shared.grow, styles.stack]}>
                  <Sections r={r} />
                  {r.view === 'plan' ? (
                    r.hasPlan ? (
                      <Plan r={r} onOpen={toTable} target={target} />
                    ) : (
                      <View style={shared.card}>
                        <Text size={20} weight="bold" accessibilityRole="header">
                          No floor plan for this venue
                        </Text>
                        <SecondaryButton
                          label="Show the list"
                          onPress={() => apply({ ...r, view: 'list' })}
                          testID="room.showList"
                        />
                      </View>
                    )
                  ) : (
                    <List r={r} apply={apply} onOpen={toTable} target={target} />
                  )}
                </View>
                {wide && (open == null ? r.manage && <Alerts r={r} apply={apply} /> : null)}
              </View>
              {!wide && open == null && r.manage && <Alerts r={r} apply={apply} />}
            </>
          )}
          <DemoOnly title="Demo only: the board’s switches">
            <SecondaryButton
              label="Start again"
              onPress={() => apply(roomSeed(start))}
              testID="room.demo.reset"
            />
            <SecondaryButton
              label={r.strip === 'offline' ? 'Back online' : 'Go offline'}
              onPress={() =>
                apply({ ...r, strip: r.strip === 'offline' ? 'connected' : 'offline', refused: '' })
              }
              testID="room.demo.online"
            />
            <SecondaryButton
              label={r.manage ? 'View without service.manage' : 'View with service.manage'}
              onPress={() => apply({ ...r, manage: !r.manage, viewer: r.manage ? WAITER : LEAD })}
              testID="room.demo.manage"
            />
            {PENDING.map((x) => (
              <SecondaryButton
                key={x.word}
                label={`${r.pending === x.p ? '✓ ' : ''}${x.word}`}
                onPress={() => apply({ ...r, pending: x.p })}
                testID={`room.demo.pending.${x.p ?? 'none'}`}
              />
            ))}
          </DemoOnly>
        </ScrollView>
        {wide && open != null && (
          <View style={styles.docked} testID="room.docked">
            <ScrollView contentContainerStyle={styles.dockedBody}>{panel}</ScrollView>
          </View>
        )}
      </View>
      {!wide && (
        <Sheet
          open={open != null}
          onClose={() => apply(closePanel(r))}
          scrimLabel="Close the table"
          opener={{ current: null }}
          testID="room.sheet"
        >
          {panel}
        </Sheet>
      )}
      <TabBar
        tabs={['next', 'floor', 'service']}
        current="service"
        onPick={() => undefined}
        bottom={Math.max(insets.bottom, tokens.spaceSm)}
      />
    </View>
  );
}

function RoomStrip({ r }: { r: Room }) {
  const words = stripLine(r.strip);
  return (
    <View style={styles.strip} accessible accessibilityLabel={words} testID="room.strip">
      {r.strip === 'connected' && <View style={styles.dot} />}
      {r.strip === 'offline' && <Glyph paths={PATHS.offline} ink={tokens.colorInk} side={16} />}
      {r.strip === 'refreshing' && <View style={styles.spinner} />}
      {(r.strip === 'unreachable' || r.strip === 'notStarted') && (
        <Glyph paths={WARN} ink={tokens.colorInk} side={16} />
      )}
      <Text
        size={14}
        weight={r.strip === 'connected' ? 'medium' : 'semibold'}
        style={r.strip === 'connected' ? shared.secondary : undefined}
      >
        {words}
      </Text>
    </View>
  );
}

function NotStarted() {
  const [note, setNote] = useState('');
  return (
    <View style={shared.card}>
      <Text size={20} weight="bold" accessibilityRole="header">
        Service hasn’t started
      </Text>
      <PrimaryButton
        label="Start service"
        onPress={() => setNote('Starting service and firing are sc-4009’s.')}
        testID="room.start"
      />
      {note !== '' && (
        <Text size={14} style={shared.secondary}>
          {note}
        </Text>
      )}
    </View>
  );
}

function Sections({ r }: { r: Room }) {
  return (
    <View style={styles.sections}>
      {SECTIONS.map((sec) => (
        <SectionCard key={sec.id} sec={sec} r={r} />
      ))}
    </View>
  );
}

function SectionCard({ sec, r }: { sec: Section; r: Room }) {
  const nobody = sec.people.length === 0;
  return (
    <View style={[shared.card, styles.section]} testID={`room.section.${sec.id}`}>
      <View
        style={[styles.tile, nobody && styles.tileNobody]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {nobody ? (
          <Glyph paths={PATHS.nobody} ink={tokens.colorInk} side={20} />
        ) : (
          <Text size={16} weight="bold" style={shared.accent} accessible={false}>
            {sec.id}
          </Text>
        )}
      </View>
      <View style={[shared.grow, styles.tight]}>
        <Text size={15} weight="bold">{`${sectionName(sec.id)} · ${onItLine(sec)}`}</Text>
        <Text size={13} style={shared.secondary}>
          {tablesWord(sectionTables(r.tables, sec.id).length)}
        </Text>
        {sectionBehind(r.tables, sec.id) && <Chip word="Behind" paths={PATHS.behind} />}
      </View>
    </View>
  );
}

const SHAPE_OF: Partial<Record<Word, 'served' | 'onTray' | 'kitchen' | 'toServe'>> = {
  served: 'served',
  tray: 'onTray',
  kitchen: 'kitchen',
  serve: 'toServe',
};

function Shape({ word }: { word: Word }) {
  const count = SHAPE_OF[word];
  if (count != null) return <CountShape kind={count} />;
  if (word === 'behind') return <Glyph paths={PATHS.behind} ink={tokens.colorInk} side={14} />;
  return (
    <View
      style={word === 'notHere' ? styles.notHere : styles.notFired}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}

function StateLine({ t }: { t: RoomTable }) {
  const w = wordOf(t);
  if (w === 'behind') return <Chip word={stateWord(t)} paths={PATHS.behind} />;
  return (
    <View style={shared.wrap}>
      <Shape word={w} />
      <Text size={13} weight="semibold">
        {stateWord(t)}
      </Text>
    </View>
  );
}

function Extras({ t }: { t: RoomTable }) {
  const f = flaggedSeats(t).length;
  return (
    <>
      {openRequests(t).length > 0 && (
        <View style={shared.wrap}>
          <Glyph paths={PATHS.request} ink={tokens.colorInk} side={14} />
          <Text size={13} weight="semibold">
            Request
          </Text>
        </View>
      )}
      {f > 0 && (
        <View style={shared.wrap} accessible accessibilityLabel={flaggedSaid(f)}>
          <Glyph paths={PATHS.flag} ink={tokens.colorBrokenText} side={14} />
          <Text size={13} weight="semibold" style={styles.broken}>
            {flaggedWord(f)}
          </Text>
        </View>
      )}
    </>
  );
}

function Plan({
  r,
  onOpen,
  target,
}: {
  r: Room;
  onOpen: (n: number) => void;
  target: (key: string) => (node: ScreenReaderTarget | null) => void;
}) {
  return (
    <View style={shared.card} testID="room.plan">
      <View style={styles.zones}>
        {SECTIONS.map((sec) => (
          <View key={sec.id} style={styles.zone}>
            <Text size={12} weight="semibold" style={styles.label}>
              {sectionName(sec.id).toUpperCase()}
            </Text>
            <View style={styles.tiles}>
              {sectionTables(r.tables, sec.id).map((t) => (
                <Pressable
                  key={t.n}
                  ref={target(`tile.${t.n}`) as (n: ViewInstance | null) => void}
                  onPress={() => onOpen(t.n)}
                  accessibilityRole="button"
                  accessibilityLabel={tableLabel(t)}
                  accessibilityState={{ expanded: r.open === t.n }}
                  style={[styles.tableTile, r.open === t.n && styles.tableTileOn]}
                  testID={`room.tile.${t.n}`}
                >
                  <View style={styles.tileHead}>
                    <Text size={15} weight="bold">{`Table ${t.n}`}</Text>
                    <Text size={13} style={shared.secondary}>
                      {t.covers}
                    </Text>
                  </View>
                  <StateLine t={t} />
                  <Extras t={t} />
                </Pressable>
              ))}
            </View>
          </View>
        ))}
      </View>
      <View style={[shared.sep, styles.key]}>
        <Text size={12} weight="semibold" style={styles.label}>
          KEY
        </Text>
        <View style={styles.keyList}>
          {KEY.map((k) => (
            <View key={k.word} style={shared.wrap}>
              <Shape word={k.word} />
              <Text size={13}>{k.label}</Text>
            </View>
          ))}
          <View style={shared.wrap}>
            <Glyph paths={PATHS.request} ink={tokens.colorInk} side={14} />
            <Text size={13}>Request</Text>
          </View>
          <View style={shared.wrap}>
            <Glyph paths={PATHS.flag} ink={tokens.colorBrokenText} side={14} />
            <Text size={13} style={styles.broken}>
              {'{n}'} flagged
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const SORT_SAID: Record<'ascending' | 'descending' | 'none', string> = {
  ascending: ', sorted ascending',
  descending: ', sorted descending',
  none: '',
};

function List({
  r,
  apply,
  onOpen,
  target,
}: {
  r: Room;
  apply: (next: Room) => void;
  onOpen: (n: number) => void;
  target: (key: string) => (node: ScreenReaderTarget | null) => void;
}) {
  const head = (key: SortKey, word: string, flex: number) => {
    const s = ariaSort(r.sort, key);
    return (
      <Pressable
        onPress={() => apply({ ...r, sort: pressSort(r.sort, key) })}
        accessibilityRole="button"
        accessibilityLabel={`${word}${SORT_SAID[s]}`}
        style={[styles.headCell, { flex }]}
        testID={`room.sort.${key}`}
      >
        <Text size={12} weight="bold" style={shared.accent}>
          {`${word}${s === 'none' ? '' : s === 'ascending' ? ' ↑' : ' ↓'}`}
        </Text>
      </Pressable>
    );
  };
  return (
    <View style={shared.card} testID="room.list">
      <View style={styles.listRow}>
        {head('table', 'Table', 1)}
        {head('section', 'Section', 1.1)}
        <Text size={12} weight="bold" style={[styles.cell, { flex: 0.7 }, shared.secondary]}>
          Covers
        </Text>
        <Text size={12} weight="bold" style={[styles.cell, { flex: 2 }, shared.secondary]}>
          State
        </Text>
        {head('wait', 'Wait', 1.1)}
        <Text size={12} weight="bold" style={[styles.cell, { flex: 1.6 }, shared.secondary]}>
          On it
        </Text>
      </View>
      {sorted(r.tables, r.sort).map((t) => {
        const sec = SECTIONS.find((s) => s.id === t.section);
        return (
          <Pressable
            key={t.n}
            ref={target(`tile.${t.n}`) as (n: ViewInstance | null) => void}
            onPress={() => onOpen(t.n)}
            accessibilityRole="button"
            accessibilityLabel={tableLabel(t)}
            style={[styles.listRow, shared.sep, r.open === t.n && styles.tableTileOn]}
            testID={`room.row.${t.n}`}
          >
            <Text
              size={14}
              weight="bold"
              style={[styles.cell, { flex: 1 }, shared.accent]}
            >{`Table ${t.n}`}</Text>
            <Text size={14} style={[styles.cell, { flex: 1.1 }]}>
              {sectionName(t.section)}
            </Text>
            <Text size={14} style={[styles.cell, { flex: 0.7 }]}>
              {t.covers}
            </Text>
            <View style={[styles.cell, styles.tight, { flex: 2 }]}>
              <StateLine t={t} />
              <Extras t={t} />
            </View>
            <Text size={14} style={[styles.cell, { flex: 1.1 }]}>
              {waitWord(t)}
            </Text>
            <Text size={14} style={[styles.cell, { flex: 1.6 }]}>
              {sec == null ? '' : onItLine(sec)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Alerts({ r, apply }: { r: Room; apply: (next: Room, then?: Aim) => void }) {
  const alerts = r.started ? alertsOf(r.tables) : [];
  return (
    <View style={[shared.card, styles.side]} testID="room.alerts">
      <Text size={20} weight="bold" accessibilityRole="header">
        Alerts
      </Text>
      {alerts.length === 0 ? (
        <Text size={15} style={shared.secondary}>
          Nothing needs you.
        </Text>
      ) : (
        alerts.map((a, i) => (
          <AlertRow
            key={a.id}
            a={a}
            first={i === 0}
            onGo={() => apply(goToTable(r, a.id), 'panel')}
          />
        ))
      )}
    </View>
  );
}

function AlertRow({ a, first, onGo }: { a: Alert; first: boolean; onGo: () => void }) {
  const icon = ALERT_ICON[a.kind === 'allergy' ? 'allergy' : a.kind];
  return (
    <View style={[styles.alert, !first && shared.sep]} testID={`room.alert.${a.id}`}>
      <View style={[styles.alertIcon, a.kind === 'allergy' && styles.alertBroken]}>
        <Glyph
          paths={icon.paths}
          ink={a.kind === 'allergy' ? tokens.colorBrokenText : tokens.colorInk}
          side={18}
        />
      </View>
      <View style={[shared.grow, styles.tight]}>
        <Text size={15} weight="bold">
          {a.title}
        </Text>
        <Text size={14} style={shared.secondary}>
          {a.sub}
        </Text>
        {a.flag !== '' && <FlagLine flag={a.flag} />}
        <View style={styles.alertButton}>
          <SecondaryButton label="Go to table" onPress={onGo} testID={`room.go.${a.id}`} />
        </View>
      </View>
    </View>
  );
}

const SEAT_SHAPE: Partial<Record<SeatState, Word>> = {
  'To serve': 'serve',
  Dishing: 'tray',
  Checked: 'tray',
  'On its way': 'tray',
  Served: 'served',
  'Waiting on the kitchen': 'kitchen',
  'Not here yet': 'notHere',
};

function Part({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.part}>
      <Text size={12} weight="semibold" style={styles.label} accessibilityRole="header">
        {title.toUpperCase()}
      </Text>
      {children}
    </View>
  );
}

function Panel({
  r,
  t,
  apply,
  target,
  onClose,
}: {
  r: Room;
  t: RoomTable;
  apply: (next: Room, then?: Aim) => void;
  target: (key: string) => (node: ScreenReaderTarget | null) => void;
  onClose: () => void;
}) {
  const flagged = flaggedSeats(t);
  const open = requestsInOrder(r, t);
  const closed = closedRequests(t);
  const sec = SECTIONS.find((s) => s.id === t.section);
  const offline = r.strip === 'offline';

  function press(q: Request, a: Action): void {
    if (a === 'take') apply(take(r, q.id));
    else if (a === 'done') {
      const next = done(r, q.id);
      apply(next, next.notice[q.id] != null ? `notice.${q.id}` : null);
    } else apply(openDecline(r, q.id), `reason.${q.id}`);
  }

  return (
    <View style={styles.panel} testID={`room.panel.${t.n}`}>
      <View style={styles.panelHead}>
        <View
          style={[shared.grow, styles.tight]}
          ref={target('panel') as (n: ViewInstance | null) => void}
          accessible
        >
          <Text size={24} weight="bold" accessibilityRole="header">{`Table ${t.n}`}</Text>
          <StateLine t={t} />
          <Text
            size={14}
            style={shared.secondary}
          >{`${t.covers} covers · ${sectionName(t.section)}`}</Text>
        </View>
        <SecondaryButton label="Close" onPress={onClose} testID="room.close" />
      </View>

      {flagged.length > 0 && (
        <Part title="Flagged guests">
          {flagged.map((s) => (
            <View key={s.n} style={styles.tight}>
              <Text size={15} weight="bold">
                {seatWho(s)}
              </Text>
              <FlagLine flag={s.flags.join(', ')} />
              <Text
                size={14}
                style={shared.secondary}
              >{`${s.dish ?? 'Nothing for this course'} · ${s.state}`}</Text>
              {s.owed.map((o) => (
                <Text key={o.reason} size={14} style={shared.secondary}>
                  {owedLine(o)}
                </Text>
              ))}
            </View>
          ))}
        </Part>
      )}

      <Part title={`Requests · ${open.length}`}>
        {!r.manage && (
          <Text size={14} style={shared.secondary}>
            {NO_MANAGE}
          </Text>
        )}
        {open.length === 0 && (
          <Text size={14} style={shared.secondary}>
            No open requests.
          </Text>
        )}
        {open.map((q) => (
          <RequestCardView
            key={q.id}
            id={q.id}
            kind={kindLine(q)}
            words={q.words}
            plate={q.plate}
            flags={t.seats.find((s) => s.n === q.seat)?.flags ?? []}
            owner={`${ownerLine(q, r.viewer)}${offline ? ` · as of ${AS_OF}` : ''}`}
            notice={r.notice[q.id]}
            declining={r.declining === q.id}
            reason={r.reason}
            reasonWrong={r.reasonWrong}
            buttons={offered(r, q)}
            onReason={(reason) => setReason(r, apply, reason)}
            onKeep={() => apply({ ...r, declining: null, reasonWrong: false })}
            onSend={() => {
              const next = decline(r);
              apply(next, next.reasonWrong ? `reason.${q.id}` : null);
            }}
            onPress={(a) => press(q, a)}
            target={(to, node) => targets(target, to, q.id, node)}
            testPrefix="room"
          />
        ))}
      </Part>

      {t.trays.length > 0 && (
        <Part title="Trays">
          {t.trays.map((tr) => (
            <View key={tr.waiter} style={shared.wrap}>
              <Text size={14}>{trayLine(tr)}</Text>
              {tr.paused && <Chip word="Paused" paths={PATHS.pause} tone="paused" />}
            </View>
          ))}
        </Part>
      )}

      <Part title="Seats">
        <SeatRing seats={t.seats} />
        {t.seats.map((s, i) => (
          <SeatRow key={s.n} s={s} first={i === 0} />
        ))}
      </Part>

      {closed.length > 0 && (
        <Part title="Closed at this table">
          {closed.map((q) => (
            <View key={q.id} style={styles.closed} testID={`room.closed.${q.id}`}>
              {r.notice[q.id] != null && (
                <View
                  accessibilityRole="alert"
                  style={styles.warn}
                  ref={target(`notice.${q.id}`) as (n: ViewInstance | null) => void}
                  accessible
                >
                  <Glyph paths={WARN} ink={tokens.colorAttentionText} side={18} />
                  <Text size={15} weight="semibold" style={shared.grow}>
                    {r.notice[q.id]}
                  </Text>
                </View>
              )}
              <Text size={13} weight="semibold" style={shared.secondary}>
                {kindLine(q)}
              </Text>
              <Text size={15} weight="semibold">
                {q.words}
              </Text>
              <Text size={14} style={shared.secondary}>
                {closedLine(q)}
              </Text>
              {q.closed?.reason != null && (
                <Text size={14} style={shared.secondary}>{`Why: ${q.closed.reason}`}</Text>
              )}
            </View>
          ))}
        </Part>
      )}

      <View style={[shared.sep, styles.onIt]}>
        <Text
          size={14}
        >{`On it · ${sectionName(t.section)} · ${sec == null ? '' : onItLine(sec)}`}</Text>
      </View>
    </View>
  );
}

function setReason(r: Room, apply: (next: Room) => void, reason: string): void {
  apply({ ...r, reason, reasonWrong: r.reasonWrong && reason.trim() === '' });
}

function targets(
  target: (key: string) => (node: ScreenReaderTarget | null) => void,
  to: string,
  id: string,
  node: ScreenReaderTarget | null,
): void {
  target(`${to}.${id}`)(node);
}

function SeatRing({ seats }: { seats: readonly Seat[] }) {
  const c = 110;
  return (
    <View
      style={styles.ring}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width={220} height={220}>
        <Defs>
          <Pattern
            id="roomHatch"
            width={4}
            height={4}
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <Rect width={4} height={4} fill={tokens.colorCard} />
            <Path d="M0 0v4" stroke={tokens.colorInkTertiary} strokeWidth={2} />
          </Pattern>
        </Defs>
        <Circle cx={c} cy={c} r={52} fill={tokens.colorInset} stroke={tokens.colorBorder} />
        {seats.map((s, i) => {
          const a = (i / seats.length) * Math.PI * 2 - Math.PI / 2;
          const x = c + Math.cos(a) * 86;
          const y = c + Math.sin(a) * 86;
          const w = SEAT_SHAPE[s.state];
          return (
            <Circle
              key={`seat${s.n}`}
              cx={x}
              cy={y}
              r={17}
              fill={
                w === 'served'
                  ? tokens.colorAccent
                  : w === 'tray'
                    ? tokens.colorAccentTintBorder
                    : w === 'kitchen'
                      ? 'url(#roomHatch)'
                      : tokens.colorCard
              }
              stroke={
                w === 'served'
                  ? tokens.colorAccent
                  : w === 'tray'
                    ? tokens.colorAccentTintBorder
                    : tokens.colorInkTertiary
              }
              strokeWidth={w === 'serve' ? 3 : 1.5}
              {...(w === 'notHere' ? { strokeDasharray: '4 3' } : {})}
            />
          );
        })}
        {seats.map((s, i) => {
          const a = (i / seats.length) * Math.PI * 2 - Math.PI / 2;
          return (
            <SvgText
              key={`n${s.n}`}
              x={c + Math.cos(a) * 86}
              y={c + Math.sin(a) * 86 + 5}
              fontSize={13}
              fontWeight="700"
              textAnchor="middle"
              fill={SEAT_SHAPE[s.state] === 'served' ? tokens.colorCard : tokens.colorInk}
            >
              {s.n}
            </SvgText>
          );
        })}
      </Svg>
    </View>
  );
}

function SeatRow({ s, first }: { s: Seat; first: boolean }) {
  const w = SEAT_SHAPE[s.state];
  return (
    <View style={[styles.seat, !first && shared.sep]} testID={`room.seat.${s.n}`}>
      <View style={styles.seatHead}>
        <Text size={15} weight="bold" style={shared.grow}>
          {s.name == null ? `Seat ${s.n}` : `Seat ${s.n} · ${s.name}`}
        </Text>
        <View style={shared.wrap}>
          {w != null && <Shape word={w} />}
          <Text size={13} weight="semibold">
            {s.state}
          </Text>
        </View>
      </View>
      {s.flags.length > 0 && <FlagLine flag={s.flags.join(', ')} />}
      {s.dish != null && (
        <Text size={14} style={shared.secondary}>
          {s.dish}
        </Text>
      )}
      {s.held != null && (
        <View style={shared.wrap}>
          <View style={styles.hatchSwatch}>
            <Hatch />
          </View>
          <Text size={14} style={shared.secondary}>{`${heldLine(s.held)} · ${s.held.choice}`}</Text>
        </View>
      )}
      {s.owed.map((o) => (
        <Text key={o.reason} size={14} weight="semibold" style={styles.owed}>
          {owedLine(o)}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: tokens.colorPage },
  row: { flex: 1, flexDirection: 'row' },
  body: { padding: tokens.spaceLg, gap: tokens.spaceMd, paddingBottom: tokens.spaceXl },
  back: { minHeight: tokens.sizeHit, justifyContent: 'center', alignSelf: 'flex-start' },
  header: { gap: tokens.spaceXs },
  strip: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm, minHeight: 24 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: tokens.colorAccent },
  spinner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: tokens.colorTrack,
    borderTopColor: tokens.colorAccent,
  },
  views: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    gap: 4,
    padding: 4,
    borderRadius: 26,
    backgroundColor: tokens.colorTrack,
  },
  view: {
    minHeight: tokens.sizeHit,
    paddingHorizontal: tokens.spaceLg,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewOn: { backgroundColor: tokens.colorCard },
  loading: { gap: tokens.spaceMd },
  skeleton: { borderRadius: 24, backgroundColor: tokens.colorInset },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: tokens.spaceMd,
    borderRadius: 12,
    backgroundColor: tokens.colorInset,
  },
  columns: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceMd },
  stack: { gap: tokens.spaceMd },
  side: { width: 320 },
  sections: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spaceSm },
  section: { flexDirection: 'row', flexGrow: 1, flexBasis: 170, padding: tokens.spaceMd },
  tile: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorAccentTint,
  },
  tileNobody: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: tokens.colorInkTertiary,
    backgroundColor: tokens.colorCard,
  },
  tight: { gap: 4 },
  zones: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spaceMd },
  zone: {
    flexGrow: 1,
    flexBasis: 260,
    gap: tokens.spaceSm,
    padding: tokens.spaceMd,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: tokens.colorControlBorder,
  },
  label: { color: tokens.colorInkSecondary, letterSpacing: 0.6 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spaceSm },
  tableTile: {
    minWidth: 120,
    flexGrow: 1,
    minHeight: tokens.sizeHit,
    gap: 4,
    padding: tokens.spaceSm,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: tokens.colorControlBorder,
    backgroundColor: tokens.colorCard,
  },
  tableTileOn: { borderColor: tokens.colorAccent, backgroundColor: tokens.colorAccentTint },
  tileHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 6,
  },
  key: { paddingTop: tokens.spaceMd, gap: tokens.spaceSm },
  keyList: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spaceMd },
  notHere: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: tokens.colorInkTertiary,
  },
  notFired: { width: 14, height: 14, borderRadius: 3, backgroundColor: tokens.colorTrack },
  broken: { color: tokens.colorBrokenText },
  listRow: { flexDirection: 'row', alignItems: 'flex-start', minHeight: tokens.sizeHit, gap: 6 },
  headCell: { minHeight: tokens.sizeHit, justifyContent: 'center' },
  cell: { paddingVertical: 12 },
  alert: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spaceMd,
    paddingVertical: 12,
  },
  alertIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorInset,
  },
  alertBroken: { backgroundColor: tokens.colorBrokenTint },
  alertButton: { alignSelf: 'flex-start', marginTop: 4 },
  docked: {
    width: 420,
    borderLeftWidth: 1,
    borderLeftColor: tokens.colorBorder,
    backgroundColor: tokens.colorCard,
  },
  dockedBody: { padding: tokens.spaceLg, paddingTop: tokens.spaceXl },
  panel: { gap: tokens.spaceLg },
  panelHead: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceMd },
  part: { gap: tokens.spaceSm },
  ring: { alignSelf: 'center' },
  seat: { gap: 4, paddingVertical: 10 },
  seatHead: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm },
  hatchSwatch: { width: 14, height: 14, borderRadius: 3, overflow: 'hidden' },
  owed: {
    paddingLeft: tokens.spaceMd,
    borderLeftWidth: 2,
    borderLeftColor: tokens.colorControlBorder,
  },
  closed: { gap: 4, padding: tokens.spaceMd, borderRadius: 16, backgroundColor: tokens.colorInset },
  warn: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: tokens.spaceMd,
    borderRadius: 12,
    backgroundColor: tokens.colorAttentionTint,
  },
  onIt: { paddingTop: tokens.spaceMd },
});
