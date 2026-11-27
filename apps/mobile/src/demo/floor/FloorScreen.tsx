import { useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type ViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton, SecondaryButton } from '../../components/Buttons.tsx';
import { useReadOut } from '../../components/ReadOut.tsx';
import { Sheet, SheetActions } from '../../components/Sheet.tsx';
import { Text } from '../../components/Text.tsx';
import { useSystemBack } from '../../components/useSystemBack.ts';
import { useLayout } from '../../layout/useLayout.ts';
import { DemoOnly } from '../../steps/Lines.tsx';
import { tokens } from '../../theme/tokens.ts';
import { goBack } from '../DemoScreen.tsx';
import { wayBackOf } from '../station/wayInRoute.ts';
import { FlagLine, Glyph } from '../queue/QueueParts.tsx';
import {
  Chip,
  type CountKey,
  CountShape,
  PATHS,
  TabBar,
  type TabId,
  shared,
} from '../service/HowItsGoingParts.tsx';
import {
  EVENT,
  type Floor,
  type Guest,
  LEAD,
  type Place,
  REASONS,
  ROOM_COURSE,
  alertsLead,
  canSendBack,
  canSendBackOwed,
  choicesFor,
  choose,
  closeTable,
  coversLine,
  dismissNotSent,
  flaggedLine,
  flaggedOpen,
  floorSeed,
  floorStateOf,
  groupsOf,
  guestName,
  headerLine,
  heldLine,
  loseConnection,
  mayWrite,
  movedTo,
  namesShown,
  onItLine,
  openSendBack,
  openTable,
  owedLine,
  pickReason,
  reconnect,
  rowSaid,
  seatWord,
  sendBack,
  sendBackItems,
  servedElsewhere,
  servedLine,
  shownPlace,
  stripLine,
  trayLine,
  undo,
  wordOf,
  wordSaid,
  cancelSendBack,
} from './FloorModel.ts';

const SEND = ['M12 19V5', 'm6 11 6-6 6 6'];
const CHEVRON_RIGHT = ['m9 6 6 6-6 6'];
const CHEVRON_LEFT = ['m15 6-6 6 6 6'];
const CHECK = ['m5 12 5 5 9-10'];

const hidden = {
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
} as const;

/** ?from= for the way in it opened from (sc-98893): its ‹ names Overview or Your night. */
export function FloorRoute() {
  const params = useLocalSearchParams<{ state?: string; from?: string }>();
  const state = floorStateOf(params.state);

  return (
    <FloorDemo key={`${state}:${params.from ?? ''}`} start={state} back={wayBackOf(params.from)} />
  );
}

function FloorDemo({
  start,
  back,
}: {
  start: ReturnType<typeof floorStateOf>;
  back: string | null;
}) {
  const insets = useSafeAreaInsets();
  const kind = useLayout().kind;
  const phone = kind === 'phone';
  const wide = kind === 'tabletLandscape';
  const [f, setF] = useState<Floor>(() => floorSeed(start));
  const openerRef = useRef<ViewInstance | null>(null);
  const headingRef = useRef<ViewInstance | null>(null);
  const shown = shownPlace(f);
  const inFront = !wide && f.open != null;

  useReadOut(f.said === 0 ? null : f.heard, { answer: f.said });
  useSystemBack(inFront, () => setF(closeTable(f)));

  const tabs: TabId[] = f.manage ? ['next', 'floor', 'service'] : ['next', 'floor'];
  const pad = phone ? tokens.spaceXl : 28;

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <View style={styles.row}>
        {(wide || f.open == null) && (
          <ScrollView
            style={wide ? styles.listPane : shared.grow}
            contentContainerStyle={[styles.body, { paddingHorizontal: wide ? 20 : pad }]}
            testID="floor.list"
          >
            <FloorList f={f} setF={setF} wide={wide} phone={phone} start={start} back={back} />
          </ScrollView>
        )}
        {(wide || f.open != null) && shown != null && (
          <View style={shared.grow}>
            <ScrollView
              contentContainerStyle={[styles.body, styles.tableBody, { paddingHorizontal: pad }]}
              testID="floor.table"
            >
              <TableView
                f={f}
                p={shown}
                setF={setF}
                wide={wide}
                phone={phone}
                headingRef={headingRef}
                openerRef={openerRef}
              />
            </ScrollView>
            {f.undo != null && (
              <View style={[styles.undo, { left: pad, right: pad }]} testID="floor.undo">
                <View style={shared.grow}>
                  <Text size={15} weight="semibold" style={styles.onDark}>
                    {f.undo.line}
                  </Text>
                  <Text size={13} weight="medium" style={styles.onDarkSoft}>
                    {`Undo until ${f.undo.until}`}
                  </Text>
                  {f.undo.kept && (
                    <Text size={13} weight="semibold" style={styles.onDarkSoft}>
                      Waiting to send
                    </Text>
                  )}
                </View>
                <Pressable
                  onPress={() => setF(undo(f))}
                  accessibilityRole="button"
                  style={[styles.undoButton, phone && styles.phoneHit]}
                  testID="floor.undo.press"
                >
                  <Text size={15} weight="bold">
                    Undo
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        )}
      </View>
      <Sheet
        open={f.sheet != null}
        onClose={() => setF(cancelSendBack(f))}
        scrimLabel="Close without sending"
        opener={openerRef}
        testID="floor.sheet"
      >
        <SendBackSheet
          f={f}
          setF={setF}
          phone={phone}
          onSent={() => {
            openerRef.current = headingRef.current;
          }}
        />
      </Sheet>
      <TabBar
        tabs={tabs}
        current="floor"
        onPick={() => undefined}
        bottom={Math.max(insets.bottom, tokens.spaceSm)}
      />
    </View>
  );
}

function FloorStrip({ f }: { f: Floor }) {
  return (
    <View style={styles.strip}>
      {f.online ? (
        <View style={styles.dot} {...hidden} />
      ) : (
        <Glyph paths={PATHS.offline} ink={tokens.colorInk} side={16} />
      )}
      <Text size={14} weight={f.online ? 'medium' : 'semibold'} style={shared.grow}>
        {stripLine(f)}
      </Text>
    </View>
  );
}

function NotSent({ f, setF }: { f: Floor; setF: (f: Floor) => void }) {
  if (f.notSent.length === 0) return null;
  return (
    <View style={styles.notSent} accessibilityRole="alert" testID="floor.notSent">
      <View style={styles.line}>
        <Glyph paths={PATHS.sentBack} ink={tokens.colorInk} side={18} />
        <Text size={15} weight="bold" style={shared.grow}>
          Not sent · the floor changed while you were offline
        </Text>
      </View>
      {f.notSent.map((t) => (
        <Text key={t} size={15} weight="medium" style={styles.indent}>
          {t}
        </Text>
      ))}
      <View style={styles.indent}>
        <SecondaryButton
          label="Dismiss"
          onPress={() => setF(dismissNotSent(f))}
          testID="floor.notSent.dismiss"
        />
      </View>
    </View>
  );
}

const SHAPE_OF: Partial<Record<string, CountKey>> = {
  'To serve': 'toServe',
  'On a tray': 'onTray',
  Dishing: 'onTray',
  Checked: 'onTray',
  'On its way': 'onTray',
  'Waiting on the kitchen': 'kitchen',
  Served: 'served',
};

function Shape({ word }: { word: string }) {
  const count = SHAPE_OF[word];
  if (count != null) return <CountShape kind={count} />;
  if (word === 'Not here yet') return <View style={styles.notHere} {...hidden} />;
  if (word === 'Not fired yet') return <View style={styles.notFired} {...hidden} />;
  return null;
}

function WordLine({ word, said, size }: { word: string; said: string; size: number }) {
  return (
    <View style={shared.wrap}>
      <Shape word={word} />
      <Text size={size} weight="semibold" style={shared.grow}>
        {said}
      </Text>
    </View>
  );
}

function FloorList({
  f,
  setF,
  wide,
  phone,
  start,
  back,
}: {
  f: Floor;
  setF: (f: Floor) => void;
  wide: boolean;
  phone: boolean;
  start: ReturnType<typeof floorStateOf>;
  back: string | null;
}) {
  return (
    <>
      <Pressable
        onPress={goBack}
        accessibilityRole="button"
        accessibilityLabel={back ?? 'Back'}
        style={[styles.back, phone && styles.phoneHit]}
        testID="floor.back"
      >
        <Text size={15} weight="semibold" style={shared.accent}>
          {back == null ? 'Back' : `‹ ${back}`}
        </Text>
      </Pressable>
      <View style={styles.header}>
        <Text size={wide ? 28 : 30} weight="bold" accessibilityRole="header">
          Floor
        </Text>
        <Text size={15} weight="medium" style={shared.secondary}>
          {`${EVENT} · ${ROOM_COURSE}`}
        </Text>
        <FloorStrip f={f} />
      </View>
      {f.line !== '' && (
        <View style={styles.moved} testID="floor.moved">
          <Glyph paths={PATHS.person} ink={tokens.colorAccentText} side={18} />
          <Text size={15} weight="semibold" style={shared.grow}>
            {f.line}
          </Text>
        </View>
      )}
      <NotSent f={f} setF={setF} />
      {groupsOf(f).map((g) =>
        g.kind === 'none' ? (
          <View key="none" style={styles.none} testID="floor.none">
            <Glyph paths={PATHS.person} ink={tokens.colorInkSecondary} side={18} />
            <Text size={15} weight="medium" style={shared.grow}>
              {g.line}
            </Text>
          </View>
        ) : (
          <View key={g.title} style={styles.group} testID={`floor.group.${g.kind}`}>
            <Text size={17} weight="bold" accessibilityRole="header">
              {g.title}
            </Text>
            {g.places.map((p) => (
              <Row
                key={p.name}
                p={p}
                other={g.kind === 'other'}
                current={wide && f.selected === p.name}
                phone={phone}
                onPress={() => setF(openTable(f, p.name))}
              />
            ))}
          </View>
        ),
      )}
      <DemoOnly title="Demo only: what happens elsewhere in the room">
        <SecondaryButton
          label="Table 4’s tray is served, from another phone"
          onPress={() => setF(servedElsewhere(f))}
          testID="floor.demo.served"
        />
        <SecondaryButton
          label="The floor lead moves Bisi to Section D"
          onPress={() => setF(movedTo(f, 'D'))}
          testID="floor.demo.move"
        />
        <SecondaryButton
          label={f.online ? 'Lose the connection' : 'Connect again'}
          onPress={() => setF(f.online ? loseConnection(f) : reconnect(f))}
          testID="floor.demo.online"
        />
        <SecondaryButton
          label="Start again"
          onPress={() => setF(floorSeed(start))}
          testID="floor.demo.reset"
        />
      </DemoOnly>
    </>
  );
}

function Row({
  p,
  other,
  current,
  phone,
  onPress,
}: {
  p: Place;
  other: boolean;
  current: boolean;
  phone: boolean;
  onPress: () => void;
}) {
  const flagged = flaggedOpen(p).length;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={rowSaid(p, other)}
      accessibilityState={{ selected: current }}
      style={({ pressed }) => [
        styles.rowCard,
        phone && styles.rowPhone,
        current && styles.rowCurrent,
        pressed && styles.pressed,
      ]}
      testID={`floor.row.${p.name}`}
    >
      <View style={[shared.grow, styles.rowText]}>
        <View style={shared.wrap}>
          <Text size={17} weight="bold">
            {p.name}
          </Text>
          {other && (
            <Text size={14} weight="medium" style={shared.secondary}>
              {`Section ${p.section}`}
            </Text>
          )}
        </View>
        <WordLine word={wordOf(p)} said={wordSaid(p)} size={15} />
        <View style={styles.meta}>
          <Text size={14} weight="medium" style={shared.secondary}>
            {servedLine(p)}
          </Text>
          <Text size={14} weight="medium" style={shared.secondary}>
            {coversLine(p.covers)}
          </Text>
          {flagged > 0 && <FlagLine flag={flaggedLine(flagged)} />}
        </View>
      </View>
      <Glyph paths={CHEVRON_RIGHT} ink={tokens.colorInkTertiary} side={20} />
    </Pressable>
  );
}

function Part({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.part}>
      <Text size={15} weight="bold" style={shared.secondary} accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  );
}

function TableView({
  f,
  p,
  setF,
  wide,
  phone,
  headingRef,
  openerRef,
}: {
  f: Floor;
  p: Place;
  setF: (f: Floor) => void;
  wide: boolean;
  phone: boolean;
  headingRef: React.RefObject<ViewInstance | null>;
  openerRef: React.RefObject<ViewInstance | null>;
}) {
  const flagged = flaggedOpen(p);
  const names = namesShown(f, p);
  return (
    <>
      <View style={styles.header}>
        {!wide && (
          <Pressable
            onPress={() => setF(closeTable(f))}
            accessibilityRole="button"
            style={[styles.floorBack, phone && styles.phoneHit]}
            testID="floor.table.back"
          >
            <Glyph paths={CHEVRON_LEFT} ink={tokens.colorAccentText} side={22} />
            <Text size={16} weight="semibold" style={shared.accent}>
              Floor
            </Text>
          </Pressable>
        )}
        <View ref={headingRef}>
          <Text size={wide ? 28 : 30} weight="bold" accessibilityRole="header">
            {p.name}
          </Text>
        </View>
        <WordLine word={wordOf(p)} said={wordSaid(p)} size={16} />
        <Text size={15} weight="medium" style={shared.secondary}>
          {headerLine(p)}
        </Text>
        <FloorStrip f={f} />
      </View>
      <NotSent f={f} setF={setF} />
      {flagged.length > 0 && (
        <Part title="Flagged guests">
          {flagged.map((g) => (
            <View key={g.seat} style={styles.flagged} testID={`floor.flagged.${g.seat}`}>
              <View style={shared.wrap}>
                <Text size={16} weight="bold">
                  {guestName(f, p, g)}
                </Text>
                {names && g.name != null && (
                  <Text size={14} weight="medium" style={shared.secondary}>
                    {`Seat ${g.seat}`}
                  </Text>
                )}
              </View>
              {g.flags.map((fl) => (
                <FlagLine key={fl} flag={fl} />
              ))}
              {g.dish != null && (
                <Text size={14} weight="medium">
                  {g.dish}
                </Text>
              )}
              <WordLine word={seatWord(g)} said={seatWord(g)} size={14} />
            </View>
          ))}
        </Part>
      )}
      {p.trays.length > 0 && (
        <Part title="Trays">
          {p.trays.map((t) => (
            <View key={t.waiter} style={styles.tray}>
              <Text size={15} weight="semibold">
                {trayLine(t)}
              </Text>
              {t.paused && <Chip word="Paused" paths={PATHS.pause} tone="paused" />}
            </View>
          ))}
        </Part>
      )}
      <Part title="Seats">
        <View style={styles.seats}>
          {p.seats.map((g) => (
            <Seat key={g.seat} f={f} p={p} g={g} setF={setF} phone={phone} openerRef={openerRef} />
          ))}
        </View>
      </Part>
      <View style={styles.onIt}>
        <Text size={15} weight="semibold">
          {onItLine(f, p)}
        </Text>
      </View>
    </>
  );
}

function Seat({
  f,
  p,
  g,
  setF,
  phone,
  openerRef,
}: {
  f: Floor;
  p: Place;
  g: Guest;
  setF: (f: Floor) => void;
  phone: boolean;
  openerRef: React.RefObject<ViewInstance | null>;
}) {
  const can = mayWrite(f, p);
  const buttonsRef = useRef(new Map<string, ViewInstance | null>());
  const press = (key: string, owedAt: number | null) => {
    openerRef.current = buttonsRef.current.get(key) ?? null;
    setF(openSendBack(f, p.name, g.seat, owedAt));
  };
  const named = namesShown(f, p) && g.name != null;
  const h = g.held;
  return (
    <View style={styles.seat} testID={`floor.seat.${g.seat}`}>
      <View style={styles.badge} {...hidden}>
        <Text size={15} weight="bold" accessible={false}>
          {String(g.seat)}
        </Text>
      </View>
      <View style={[shared.grow, styles.seatText]}>
        <View style={shared.wrap}>
          <Text size={16} weight="bold">
            {guestName(f, p, g)}
          </Text>
          {named && (
            <Text size={14} weight="medium" style={shared.secondary}>
              {`Seat ${g.seat}`}
            </Text>
          )}
        </View>
        {g.flags.map((fl) => (
          <FlagLine key={fl} flag={fl} />
        ))}
        {g.dish != null && (
          <Text size={15} weight="medium">
            {g.dish}
          </Text>
        )}
        <WordLine word={seatWord(g)} said={seatWord(g)} size={14} />
        {h != null && (
          <View style={styles.held}>
            <Text size={14} weight="medium" style={shared.secondary}>
              {heldLine(h)}
            </Text>
            {!can && h.choice != null && (
              <Text size={14} weight="semibold">
                {h.choice}
              </Text>
            )}
            {can && (
              <View style={styles.choices}>
                {choicesFor(h).map((c) => {
                  const on = h.choice === c;
                  return (
                    <Pressable
                      key={c}
                      onPress={() => setF(choose(f, p.name, g.seat, c))}
                      accessibilityRole="togglebutton"
                      accessibilityState={{ checked: on }}
                      style={[styles.choice, phone && styles.phoneHit, on && styles.choiceOn]}
                      testID={`floor.choice.${g.seat}.${on ? 'on' : 'off'}`}
                    >
                      {on && <Glyph paths={CHECK} ink={tokens.colorAccentText} side={16} />}
                      <Text size={15} weight={on ? 'bold' : 'semibold'}>
                        {c}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
            {h.kept && <Chip word="Waiting to send" paths={SEND} tone="outline" />}
          </View>
        )}
        {canSendBack(f, p, g) && (
          <View style={styles.start}>
            <SecondaryButton
              label="Send back"
              ref={(v) => {
                buttonsRef.current.set('order', v);
              }}
              onPress={() => press('order', null)}
              testID={`floor.sendBack.${g.seat}`}
            />
          </View>
        )}
        {g.owed.map((o, i) => (
          <View key={`${String(o.id)}.${String(i)}`} style={styles.owed}>
            <Text size={14} weight="medium">
              {owedLine(p, o)}
            </Text>
            <View style={shared.wrap}>
              <Shape word={o.stage} />
              <Text size={14} weight="semibold">
                {o.stage}
              </Text>
              {o.kept && <Chip word="Waiting to send" paths={SEND} tone="outline" />}
            </View>
            {canSendBackOwed(f, p, o) && (
              <View style={styles.start}>
                <SecondaryButton
                  label="Send back"
                  ref={(v) => {
                    buttonsRef.current.set(String(i), v);
                  }}
                  onPress={() => press(String(i), i)}
                  testID={`floor.sendBack.${g.seat}.${String(i)}`}
                />
              </View>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

function SendBackSheet({
  f,
  setF,
  phone,
  onSent,
}: {
  f: Floor;
  setF: (f: Floor) => void;
  phone: boolean;
  onSent: () => void;
}) {
  const what = sendBackItems(f);
  const sh = f.sheet;
  if (what == null || sh == null) return null;
  const send = (
    <PrimaryButton
      label="Send back"
      off={sh.reason == null}
      paired={!phone}
      onPress={() => {
        onSent();
        setF(sendBack(f));
      }}
      testID="floor.sendBack.send"
    />
  );
  const cancel = (
    <SecondaryButton
      label="Cancel"
      stacked={phone}
      paired={!phone}
      onPress={() => setF(cancelSendBack(f))}
      testID="floor.sendBack.cancel"
    />
  );
  return (
    <View style={styles.sheet} testID="floor.sendBack.sheet">
      <View style={styles.header}>
        <Text size={22} weight="bold" accessibilityRole="header">
          {what.title}
        </Text>
        <Text size={15} weight="medium" style={shared.secondary}>
          {what.who}
        </Text>
      </View>
      <View accessibilityRole="radiogroup" style={styles.reasons}>
        {REASONS.map((r) => {
          const on = sh.reason === r;
          return (
            <Pressable
              key={r}
              onPress={() => setF(pickReason(f, r))}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              style={styles.reason}
              testID={`floor.reason.${r}`}
            >
              <View style={[styles.radio, on && styles.radioOn]} {...hidden} />
              <View style={[shared.grow, styles.reasonText]}>
                <Text size={16} weight="semibold">
                  {r}
                </Text>
                {alertsLead(r) && (
                  <Text size={14} weight="medium" style={shared.secondary}>
                    {`Also alerts the floor lead, ${LEAD}.`}
                  </Text>
                )}
              </View>
            </Pressable>
          );
        })}
      </View>
      <SheetActions>
        {phone ? (
          <>
            {send}
            {cancel}
          </>
        ) : (
          <>
            {cancel}
            {send}
          </>
        )}
      </SheetActions>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: tokens.colorInset },
  row: { flex: 1, flexDirection: 'row' },
  listPane: {
    width: 400,
    flexGrow: 0,
    borderRightWidth: 1,
    borderRightColor: tokens.colorBorder,
  },
  body: { paddingTop: tokens.spaceSm, gap: tokens.spaceXl, paddingBottom: 40 },
  tableBody: { paddingBottom: 140 },
  back: { minHeight: tokens.sizeHit, justifyContent: 'center', alignSelf: 'flex-start' },
  header: { gap: tokens.spaceXs },
  strip: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: tokens.colorAccent },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  indent: { paddingLeft: 28, alignItems: 'flex-start' },
  notSent: {
    gap: tokens.spaceMd,
    padding: tokens.spaceLg,
    borderRadius: tokens.radiusCardPhone,
    backgroundColor: tokens.colorCard,
    borderWidth: 1,
    borderColor: tokens.colorControlBorder,
  },
  moved: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: tokens.spaceLg,
    borderRadius: tokens.radiusRow,
    backgroundColor: tokens.colorAccentTint,
    borderWidth: 1,
    borderColor: tokens.colorAccentTintBorder,
  },
  none: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: tokens.spaceLg,
    borderRadius: tokens.radiusRow,
    backgroundColor: tokens.colorCard,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: tokens.colorControlBorder,
  },
  group: { gap: tokens.spaceSm },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceLg,
    minHeight: 76,
    paddingVertical: 14,
    paddingHorizontal: tokens.spaceXl,
    borderRadius: 16,
    backgroundColor: tokens.colorCard,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
  },
  rowPhone: { minHeight: 84, paddingHorizontal: tokens.spaceLg },
  rowCurrent: {
    backgroundColor: tokens.colorAccentTint,
    borderColor: tokens.colorAccent,
    borderLeftWidth: 4,
  },
  pressed: { opacity: tokens.opacityPressed },
  rowText: { gap: 5 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 14, rowGap: 2 },
  notHere: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: tokens.colorInkTertiary,
  },
  notFired: { width: 14, height: 14, borderRadius: 3, backgroundColor: tokens.colorTrack },
  part: { gap: tokens.spaceSm },
  flagged: {
    gap: 4,
    paddingVertical: tokens.spaceLg,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: tokens.colorBrokenTint,
  },
  tray: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: tokens.spaceMd,
    paddingVertical: tokens.spaceLg,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: tokens.colorCard,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
  },
  seats: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spaceMd },
  seat: {
    flexGrow: 1,
    flexBasis: 300,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spaceLg,
    padding: 14,
    borderRadius: tokens.radiusCardPhone,
    backgroundColor: tokens.colorCard,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
  },
  badge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: tokens.colorInset,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seatText: { gap: tokens.spaceXs },
  held: { gap: tokens.spaceSm, alignItems: 'flex-start' },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spaceSm },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceSm,
    minHeight: tokens.sizeHit,
    paddingHorizontal: tokens.spaceXl,
    borderRadius: 24,
    backgroundColor: tokens.colorCard,
    borderWidth: 1.5,
    borderColor: tokens.colorControlBorder,
  },
  choiceOn: { backgroundColor: tokens.colorAccentTint, borderColor: tokens.colorAccent },
  phoneHit: { minHeight: tokens.sizeHitPhonePrimary },
  start: { alignItems: 'flex-start' },
  owed: {
    gap: tokens.spaceXs,
    paddingLeft: tokens.spaceMd,
    borderLeftWidth: 2,
    borderLeftColor: tokens.colorControlBorder,
  },
  onIt: {
    paddingVertical: tokens.spaceLg,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: tokens.colorCard,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
  },
  floorBack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    minHeight: tokens.sizeHit,
    alignSelf: 'flex-start',
    marginLeft: -tokens.spaceSm,
  },
  undo: {
    position: 'absolute',
    bottom: tokens.spaceXl,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: tokens.spaceLg,
    padding: tokens.spaceLg,
    borderRadius: tokens.radiusCardPhone,
    backgroundColor: tokens.colorInk,
  },
  onDark: { color: tokens.colorCard },
  onDarkSoft: { color: tokens.colorTrack },
  undoButton: {
    minHeight: tokens.sizeHit,
    paddingHorizontal: 20,
    borderRadius: 24,
    backgroundColor: tokens.colorCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheet: { gap: tokens.spaceLg, paddingBottom: tokens.spaceLg },
  reasons: { gap: tokens.spaceSm },
  reason: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceLg,
    minHeight: 52,
    paddingVertical: tokens.spaceMd,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
    backgroundColor: tokens.colorCard,
  },
  reasonText: { gap: 2 },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: tokens.colorFieldBorder,
  },
  radioOn: { borderWidth: 6, borderColor: tokens.colorAccent },
});
