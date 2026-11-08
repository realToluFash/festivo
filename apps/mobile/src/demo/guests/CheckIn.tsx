import { type Href, router } from 'expo-router';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, type TextInputInstance, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { focusChecked } from '../../components/Field.tsx';
import { useReadOut } from '../../components/ReadOut.tsx';
import { Sheet } from '../../components/Sheet.tsx';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { AlertLine } from '../events/EventEdits.tsx';
import { EventFrame } from '../events/EventFrame.tsx';
import { SearchField } from '../events/EventsList.tsx';
import { shownEvent } from '../events/EventsModel.ts';
import { sampleEvent } from '../events/EventsSample.ts';
import { useShell } from '../../components/settingsShell.ts';
import { Back, Pill } from '../../components/SettingsParts.tsx';
import { Row, RowList, TextAction } from '../../components/Summary.tsx';
import { GuestField, SheetBody, SheetLayer } from './GuestEdit.tsx';
import {
  type DoorPerson,
  type DoorState,
  type GuestsCardWords,
  clockOf,
  counted,
  doorPeople,
  doorShown,
  nameProblem,
} from './GuestsModel.ts';
import { Amber, Choices, GuestToast, GuestsCard, type Layout } from './GuestsParts.tsx';
import { ARRIVALS, COLLEAGUE, KOFI_WALKIN, READER, WEDDING } from './GuestsSample.ts';
import { REPLY_WORD, W, say } from './GuestsWords.ts';
import { DoorGlyph, MarkSlot } from './ReplyMark.tsx';

type Phase = 'open' | 'before' | 'ended';

const NOW_AT = '18:41';
const WALK_IN_AT = '18:43';

function phaseOf(state: DoorState | null): Phase {
  if (state === 'beforeOpen') return 'before';
  return state === 'ended' ? 'ended' : 'open';
}

function startPeople(state: DoorState | null): DoorPerson[] {
  if (state === 'doorEmpty') return [];
  const people = doorPeople();
  const arrive = (key: string, at: string, by: string) =>
    people.forEach((p, index) => {
      if (p.key === key) people[index] = { ...p, arrivedAt: at, by };
    });
  if (state === 'doorArrived') arrive('folasade', NOW_AT, READER);
  if (state === 'ended') {
    arrive('amaka', '18:55', COLLEAGUE);
    arrive('folasade', '18:41', READER);
  }
  if (state === 'notRecorded')
    people.forEach((p, index) => {
      if (p.key === 'amaka') people[index] = { ...p, failed: true };
    });
  if (state === 'walkInAdded') return withWalkIn(people, KOFI_WALKIN);
  return people;
}

function withWalkIn(people: readonly DoorPerson[], name: string): DoorPerson[] {
  const walkIn: DoorPerson = {
    key: `walkin-${name}`,
    name,
    kind: 'walkin',
    companion: false,
    arrivedAt: WALK_IN_AT,
    by: READER,
    failed: false,
  };
  const at = people.findIndex((p) => !p.companion && p.name.localeCompare(name) > 0);
  return at < 0 ? [...people, walkIn] : [...people.slice(0, at), walkIn, ...people.slice(at)];
}

function startTyped(state: DoorState | null): string {
  if (state === 'doorSearch' || state === 'doorArrived' || state === 'doorUndone')
    return 'okon fola';
  if (
    state === 'doorNoMatch' ||
    state === 'walkIn' ||
    state === 'walkInBlank' ||
    state === 'walkInAdded'
  )
    return KOFI_WALKIN;
  return state === 'walkInDuplicate' ? 'Kwame Mensa' : '';
}

function startCount(state: DoorState | null): { arrived: number; expected: number } {
  if (state === 'ended') return ARRIVALS.ended;
  if (state === 'doorEmpty') return { arrived: 0, expected: 0 };
  if (state === 'doorArrived' || state === 'walkInAdded') return { arrived: 42, expected: 99 };
  return ARRIVALS.onTheDay;
}

function cardOf(
  phase: Phase,
  count: { arrived: number; expected: number },
  empty: boolean,
): GuestsCardWords {
  if (phase === 'before')
    return {
      tags: [{ word: 'Live', mark: 'live' }, { word: 'Today, 18:00' }],
      says: say.opensAt('16:00'),
      count: null,
      line: W.searchWorksNow,
      step: null,
    };
  if (phase === 'ended')
    return {
      tags: [{ word: 'Finished', mark: 'finished' }],
      says: '',
      count,
      line: W.ended,
      step: null,
    };
  return {
    tags: [{ word: 'Happening now', mark: 'now' }, { word: 'Day 1 of 3' }],
    says: '',
    count,
    line: empty ? W.doorOpened : W.doorOpenedLine,
    step: null,
  };
}

function leave(): void {
  if (router.canGoBack()) router.back();
  else router.replace('/demo/guests?state=onTheDay' as Href);
}

function ArrivedButton({
  name,
  big,
  onPress,
}: {
  name: string;
  big: boolean;
  onPress: () => void;
}) {
  const height = big ? 52 : tokens.sizeHit;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.arrived,
        { minHeight: height, borderRadius: height / 2 },
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${W.arrivedButton}, ${name}`}
      testID={`door.arrive.${name}`}
    >
      <DoorGlyph side={18} ink={tokens.colorAccentText} />
      <Text size={16} weight="semibold" accessible={false} style={styles.accent}>
        {W.arrivedButton}
      </Text>
    </Pressable>
  );
}

/** Check-in (sc-1454), opened from Guests on the day: its card, Search by name, everyone A to Z with Arrived. */
export function CheckInScreen({ state }: { state: DoorState | null }) {
  const shell = useShell();
  const layout: Layout = shell.layout;
  const insets = useSafeAreaInsets();
  const now = useMemo(() => clockOf(state), [state]);
  const event = useMemo(() => {
    const base = sampleEvent(WEDDING);
    if (base == null) throw new Error('The sample has the wedding.');
    return shownEvent(base, now);
  }, [now]);
  const phase = phaseOf(state);
  const [people, setPeople] = useState(() => startPeople(state));
  const [count, setCount] = useState(() => startCount(state));
  const [typed, setTyped] = useState(() => startTyped(state));
  const [searched, setSearched] = useState(() => startTyped(state));
  const [toast, setToast] = useState<string | null>(
    state === 'doorArrived'
      ? say.arrivedName('Chief Mrs Folasade Okonkwo-Williams')
      : state === 'doorUndone'
        ? W.arrivalUndone
        : state === 'walkInAdded'
          ? say.arrivedName(KOFI_WALKIN)
          : null,
  );
  const [walkIn, setWalkIn] = useState<string | null>(
    state === 'walkIn'
      ? KOFI_WALKIN
      : state === 'walkInBlank'
        ? ''
        : state === 'walkInDuplicate'
          ? 'Kwame Mensah'
          : null,
  );
  const [more, setMore] = useState(false);
  const opener = useRef(null);

  useEffect(() => {
    if (typed === searched) return;
    const wait = setTimeout(() => setSearched(typed), 300);
    return () => clearTimeout(wait);
  }, [typed, searched]);

  const shown = doorShown(people, searched);
  const looking = searched.trim() !== '';
  const big = layout === 'phone';
  const open = phase === 'open';

  const arrive = (key: string) => {
    const p = people.find((one) => one.key === key);
    if (p == null) return;
    setPeople(
      people.map((one) =>
        one.key === key ? { ...one, arrivedAt: NOW_AT, by: READER, failed: false } : one,
      ),
    );
    setCount({ arrived: count.arrived + 1, expected: count.expected + (counted(p.kind) ? 0 : 1) });
    setToast(say.arrivedName(p.name));
  };
  const undo = (key: string) => {
    const p = people.find((one) => one.key === key);
    if (p == null) return;
    setPeople(
      p.kind === 'walkin'
        ? people.filter((one) => one.key !== key)
        : people.map((one) => (one.key === key ? { ...one, arrivedAt: null, by: null } : one)),
    );
    setCount({ arrived: count.arrived - 1, expected: count.expected - (counted(p.kind) ? 0 : 1) });
    setToast(W.arrivalUndone);
  };
  const addWalkIn = (name: string) => {
    setPeople(withWalkIn(people, name));
    setCount({ arrived: count.arrived + 1, expected: count.expected + 1 });
    setWalkIn(null);
    setTyped(name);
    setSearched(name);
    setToast(say.arrivedName(name));
  };

  const rows = (
    <RowList
      items={shown.map((p) => {
        const word = REPLY_WORD[p.kind];
        const line =
          p.arrivedAt != null ? `${word} · ${say.arrivedAt(p.arrivedAt, p.by ?? '')}` : word;
        const trail =
          p.arrivedAt != null ? (
            open ? (
              <TextAction
                label={W.undoArrival}
                plain
                onPress={() => undo(p.key)}
                accessibilityLabel={`${W.undoArrival}, ${p.name}`}
                testID={`door.undo.${p.key}`}
              />
            ) : null
          ) : open ? (
            <ArrivedButton name={p.name} big={big} onPress={() => arrive(p.key)} />
          ) : null;
        const row = (
          <Row
            title={p.name}
            line={line}
            lead={
              <MarkSlot
                kind={p.arrivedAt != null ? (p.kind === 'walkin' ? 'walkin' : 'arrived') : p.kind}
              />
            }
            trail={trail}
            pad={10}
            accessibilityLabel={`${p.name}. ${line}`}
            testID={`door.row.${p.key}`}
          />
        );
        return {
          key: p.key,
          inset: p.companion ? 80 : 40,
          row: (
            <View style={p.companion && styles.indent}>
              {row}
              {p.failed && (
                <View style={styles.failedAt}>
                  <AlertLine text={W.notRecorded} small />
                </View>
              )}
            </View>
          ),
        };
      })}
    />
  );

  const noOne = looking && shown.length === 0 && phase !== 'ended';
  const body = (
    <>
      {!looking || layout !== 'phone' ? (
        <GuestsCard
          event={event}
          words={cardOf(phase, count, state === 'doorEmpty')}
          layout={layout}
          onStep={() => undefined}
          stepLabel={null}
        />
      ) : null}
      <SearchField
        typed={typed}
        off={false}
        width={null}
        onTyped={(text) => {
          setTyped(text);
          if (text === '') setSearched('');
        }}
        onSearch={() => setSearched(typed)}
        onClear={() => {
          setTyped('');
          setSearched('');
        }}
        label={W.searchByName}
        testID="door.search"
      />
      {looking && shown.length > 0 && <Matches count={shown.length} />}
      {state === 'doorEmpty' && !looking && people.length === 0 ? (
        <View style={styles.tight}>
          <Text size={18} weight="bold" accessibilityRole="header">
            {W.nobodyYet}
          </Text>
          <Text size={15} weight="medium" style={[styles.secondary, styles.lines]}>
            {W.nobodyYetLine}
          </Text>
        </View>
      ) : null}
      {noOne ? (
        <View style={styles.noOne}>
          <NoOne typed={searched} />
          {open && (
            <Pill label={W.addWalkIn} onPress={() => setWalkIn(searched)} testID="door.walkIn" />
          )}
        </View>
      ) : (
        rows
      )}
    </>
  );

  const form =
    walkIn == null ? null : (
      <WalkInForm
        key={walkIn}
        start={walkIn}
        blank={state === 'walkInBlank'}
        onArrive={(name) => {
          const p = people.find((one) => one.name.toLowerCase() === name.toLowerCase());
          if (p != null) arrive(p.key);
          setWalkIn(null);
        }}
        onAdd={addWalkIn}
        people={people}
      />
    );
  const told =
    toast == null ? null : (
      <GuestToast
        words={toast}
        onClose={() => setToast(null)}
        bottom={
          layout === 'phone' ? Math.max(insets.bottom, 34) : Math.max(insets.bottom, tokens.spaceLg)
        }
      />
    );

  if (layout === 'phone')
    return (
      <View style={[styles.page, { paddingTop: insets.top }]}>
        <View style={styles.nav}>
          <Back label={W.guests} onPress={leave} />
          <View style={styles.navTitle} pointerEvents="none">
            <Text size={17} weight="bold" accessibilityRole="header">
              {W.checkIn}
            </Text>
          </View>
        </View>
        <ScrollView
          style={styles.grow}
          contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 120 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {body}
        </ScrollView>
        <Sheet
          open={walkIn != null}
          onClose={() => setWalkIn(null)}
          opener={opener}
          scrimLabel={W.close}
          testID="door.walkIn.sheet"
        >
          <SheetBody title={W.addWalkIn} close={W.close} onClose={() => setWalkIn(null)}>
            {form}
          </SheetBody>
        </Sheet>
        {told}
      </View>
    );

  const toGuests = () => leave();
  const title = (
    <Text
      size={layout === 'landscape' ? 26 : 30}
      weight="bold"
      accessibilityRole="header"
      style={styles.title}
    >
      {W.checkIn}
    </Text>
  );

  if (layout === 'landscape')
    return (
      <EventFrame
        event={event}
        now={now}
        area="guests"
        onArea={toGuests}
        more={more}
        onMore={setMore}
        fill
        overlay={told}
      >
        <View style={styles.panes}>
          <ScrollView
            style={[styles.doorPane, walkIn != null && styles.doorPaneNarrow]}
            contentContainerStyle={styles.paneBody}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {title}
            {body}
          </ScrollView>
          {walkIn != null && (
            <ScrollView
              style={styles.grow}
              contentContainerStyle={styles.sideBody}
              keyboardShouldPersistTaps="handled"
            >
              <SideHead onClose={() => setWalkIn(null)} />
              {form}
            </ScrollView>
          )}
        </View>
      </EventFrame>
    );

  return (
    <EventFrame
      event={event}
      now={now}
      area="guests"
      onArea={toGuests}
      more={more}
      onMore={setMore}
      back={{ label: W.guests, onPress: leave }}
      overlay={
        <>
          {walkIn != null && (
            <SheetLayer onClose={() => setWalkIn(null)} label={W.close}>
              <SheetBody title={W.addWalkIn} close={W.close} onClose={() => setWalkIn(null)}>
                {form}
              </SheetBody>
            </SheetLayer>
          )}
          {told}
        </>
      }
    >
      {title}
      {body}
    </EventFrame>
  );
}

function SideHead({ onClose }: { onClose: () => void }): ReactNode {
  return (
    <View style={styles.sideHead}>
      <Text size={22} weight="bold" accessibilityRole="header" style={styles.grow}>
        {W.addWalkIn}
      </Text>
      <TextAction label={W.close} onPress={onClose} testID="door.walkIn.close" />
    </View>
  );
}

function Matches({ count }: { count: number }) {
  useReadOut(say.matches(count));

  return (
    <Text size={14.5} weight="semibold" style={[styles.secondary, styles.figures]}>
      {say.matches(count)}
    </Text>
  );
}

function NoOne({ typed }: { typed: string }) {
  useReadOut(say.noOne(typed));

  return (
    <Text size={16} weight="semibold" style={styles.lines}>
      {say.noOne(typed)}
    </Text>
  );
}

/** Add walk-in: one field, the typed name in it; a name already on the list offers to mark them arrived. */
function WalkInForm({
  start,
  blank,
  people,
  onArrive,
  onAdd,
}: {
  start: string;
  blank: boolean;
  people: readonly DoorPerson[];
  onArrive: (name: string) => void;
  onAdd: (name: string) => void;
}) {
  const [name, setName] = useState(start);
  const [checked, setChecked] = useState(blank);
  const [same, setSame] = useState<string | null>(
    people.find((p) => p.name.toLowerCase() === start.trim().toLowerCase())?.name ?? null,
  );
  const field = useRef<TextInputInstance>(null);
  const add = () => {
    setChecked(true);
    if (nameProblem(name) != null) return focusChecked(field);
    const listed = people.find((p) => p.name.toLowerCase() === name.trim().toLowerCase());
    if (listed != null && same == null) {
      setSame(listed.name);
      return;
    }
    onAdd(name.trim());
  };

  return (
    <View style={styles.form}>
      <GuestField
        label={W.fullName}
        value={name}
        onChange={(text) => {
          setName(text);
          setSame(null);
        }}
        error={checked ? nameProblem(name) : null}
        autoFocus
        fieldRef={field}
        testID="door.walkIn.name"
      />
      {same != null ? (
        <Amber title={say.sameName(same)} testID="door.walkIn.same">
          <Choices
            first={{
              label: W.markThemArrived,
              onPress: () => onArrive(same),
              testID: 'door.walkIn.arrive',
            }}
            second={{
              label: W.addSomeoneNew,
              onPress: () => onAdd(name.trim()),
              testID: 'door.walkIn.new',
            }}
          />
        </Amber>
      ) : (
        <Pill label={W.addAndArrive} onPress={add} testID="door.walkIn.add" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  page: { flex: 1, backgroundColor: tokens.colorCard },
  secondary: { color: tokens.colorInkSecondary },
  accent: { color: tokens.colorAccentText },
  figures: { fontVariant: ['tabular-nums'] },
  pressed: { opacity: tokens.opacityPressed },
  lines: { lineHeight: 15 * 1.45 },
  tight: { gap: 6 },
  indent: { paddingLeft: 40 },
  nav: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spaceSm,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colorBorder,
  },
  navTitle: {
    position: 'absolute',
    left: 120,
    right: 120,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { gap: 14, paddingTop: 16, paddingHorizontal: tokens.spaceXxl },
  title: { letterSpacing: -0.6 },
  arrived: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    backgroundColor: tokens.colorAccentTint,
  },
  failedAt: { paddingLeft: 40, paddingBottom: tokens.spaceSm },
  noOne: { gap: 14 },
  panes: { flex: 1, flexDirection: 'row' },
  doorPane: { flex: 1, borderRightWidth: 1, borderRightColor: tokens.colorBorder },
  doorPaneNarrow: { flex: 0, width: 520 },
  paneBody: { gap: 14, paddingTop: 22, paddingHorizontal: 20, paddingBottom: tokens.space6xl * 2 },
  sideBody: { gap: 14, paddingTop: 22, paddingHorizontal: 32 },
  sideHead: { minHeight: tokens.sizeHit, flexDirection: 'row', alignItems: 'center' },
  form: { gap: 14 },
});
