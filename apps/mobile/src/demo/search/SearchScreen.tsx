import { type Href, router } from 'expo-router';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  type TextInputInstance,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EventThumb } from '../../components/EventThumb.tsx';
import { SearchField } from '../../components/EventsSearch.tsx';
import { Initials } from '../../components/Initials.tsx';
import { useKeyboardTop } from '../../components/keyboardWatch.ts';
import { useReadOut } from '../../components/ReadOut.tsx';
import { RowShapes, TextAction } from '../../components/Summary.tsx';
import { Tag } from '../../components/SummaryRows.tsx';
import { Text } from '../../components/Text.tsx';
import { Toast } from '../../components/Toast.tsx';
import { useLayout } from '../../layout/useLayout.ts';
import { tokens } from '../../theme/tokens.ts';
import { EVENTS } from '../events/EventsSample.ts';
import { openEvent } from '../events/openEvent.ts';
import {
  type Found,
  type Phase,
  SEARCH_WORDS as W,
  type SearchStart,
  type Standing,
  TYPING_PAUSE_MS,
  eventName,
  groupsFor,
  phaseOf,
  saidOf,
  stopsOf,
} from './searchRules.ts';

const PANEL_WIDTH = 600;
const PANEL_TOP = 64;
const ROW = 64;

function close(): void {
  if (router.canGoBack()) router.back();
  else router.replace('/demo');
}

/** Search (sc-39534, direction A): on a phone a screen of its own, the field on top and Cancel beside it; on a tablet a palette over the page. */
export function SearchScreen({ start }: { start: SearchStart }) {
  const { kind } = useLayout();
  const phone = kind === 'phone';
  const field = useRef<TextInputInstance>(null);
  const [typed, setTyped] = useState(start.term);
  const [term, setTerm] = useState(start.term);
  const [phase, setPhase] = useState<Phase>(start.phase);
  const [told, setTold] = useState<string | null>(null);
  const groups = useMemo(
    () => (phase === 'found' ? groupsFor(term, start.reach) : []),
    [phase, term, start.reach],
  );

  useEffect(() => {
    const wait = setTimeout(() => field.current?.focus(), 0);

    return () => clearTimeout(wait);
  }, []);

  useEffect(() => {
    if (typed === term) return undefined;

    const wait = setTimeout(() => {
      setTerm(typed);
      setPhase(phaseOf(typed));
    }, TYPING_PAUSE_MS);

    return () => clearTimeout(wait);
  }, [typed, term]);

  useReadOut(phase === 'loading' ? W.searching : phase === 'found' ? saidOf(term, groups) : null, {
    afterTyping: typed,
  });

  function go(row: Found): void {
    const known = (id: string) => EVENTS.some((one) => one.id === id);
    if (row.kind === 'event' && !known(row.id)) {
      setTold(W.ownDesign(row.name));
      return;
    }
    if (row.kind === 'guest' && !known(row.event)) {
      setTold(W.ownDesign(eventName(row.event)));
      return;
    }
    if (!phone) close();
    if (row.kind === 'event') openEvent(row.id);
    else
      router.push(
        (row.kind === 'guest' ? '/demo/guests?state=guest' : '/demo/settings/members') as Href,
      );
  }

  function showAll(): void {
    if (!phone) close();
    router.push('/demo/events' as Href);
  }

  function clear(): void {
    setTyped('');
    setTerm('');
    setPhase('idle');
    field.current?.focus();
  }

  const searchField = (
    <SearchField
      ref={field}
      typed={typed}
      off={false}
      width={null}
      label={W.placeholder(start.reach)}
      onTyped={setTyped}
      onSearch={() => {
        setTerm(typed);
        setPhase(phaseOf(typed));
      }}
      onClear={clear}
      testID="demo.search.field"
    />
  );
  const results = (
    <Results
      phase={phase}
      term={term}
      hint={W.idle(start.reach)}
      groups={groups}
      onShowAll={showAll}
      onRow={go}
      onClear={clear}
    />
  );
  const toast = told != null && (
    <View style={styles.toast}>
      <Toast key={told} words={told} onClose={() => setTold(null)} />
    </View>
  );

  return phone ? (
    <PhoneSearch field={searchField} toast={toast}>
      {results}
    </PhoneSearch>
  ) : (
    <Palette field={searchField} toast={toast}>
      {results}
    </Palette>
  );
}

function PhoneSearch({
  field,
  toast,
  children,
}: {
  field: ReactNode;
  toast: ReactNode;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.phone, { paddingTop: insets.top + tokens.spaceSm }]}>
      <View style={styles.top}>
        {field}
        <Pressable
          onPress={close}
          hitSlop={tokens.spaceXxs}
          style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={W.cancel}
          testID="demo.search.cancel"
        >
          <Text size={16} weight="semibold" style={styles.accent}>
            {W.cancel}
          </Text>
        </Pressable>
      </View>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + tokens.spaceXl }]}
      >
        {children}
      </ScrollView>
      {toast}
    </View>
  );
}

function Palette({
  field,
  toast,
  children,
}: {
  field: ReactNode;
  toast: ReactNode;
  children: ReactNode;
}) {
  const { width, height } = useWindowDimensions();
  const keys = useKeyboardTop();
  const panelWidth = Math.min(PANEL_WIDTH, width - 2 * tokens.spaceXl);
  const floor = (keys ?? height) - tokens.spaceXl;

  return (
    <View style={styles.fill}>
      <Pressable
        onPress={close}
        style={[StyleSheet.absoluteFill, styles.scrim]}
        accessibilityRole="button"
        accessibilityLabel={W.close}
        testID="demo.search.scrim"
      />
      <View
        style={[
          styles.panel,
          { width: panelWidth, left: (width - panelWidth) / 2, maxHeight: floor - PANEL_TOP },
        ]}
        accessibilityViewIsModal
        onAccessibilityEscape={close}
      >
        <View style={styles.panelTop}>{field}</View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
          {children}
        </ScrollView>
      </View>
      {toast}
    </View>
  );
}

function Results({
  phase,
  term,
  hint,
  groups,
  onShowAll,
  onRow,
  onClear,
}: {
  phase: Phase;
  term: string;
  hint: string | null;
  groups: ReturnType<typeof groupsFor>;
  onShowAll: () => void;
  onRow: (row: Found) => void;
  onClear: () => void;
}) {
  if (phase === 'idle') return hint == null ? null : <Said words={hint} />;
  if (phase === 'short') return <Said words={W.short} />;
  if (phase === 'loading') return <RowShapes count={3} words={W.searching} />;
  if (phase === 'offline')
    return (
      <View style={styles.said}>
        <Text size={16} weight="semibold">
          {W.offline}
        </Text>
      </View>
    );
  if (groups.length === 0)
    return (
      <View style={styles.said}>
        <Text size={16} weight="semibold">
          {W.nothing(term.trim())}
        </Text>
        <TextAction label={W.clear} onPress={onClear} testID="demo.search.clear" />
      </View>
    );

  const stops = stopsOf(groups);

  return groups.map((group) => {
    const shown = stops.filter((stop) => stop.group === group.key);

    return (
      <View key={group.key} style={styles.group}>
        <Text size={13} weight="semibold" accessibilityRole="header" style={styles.secondary}>
          {`${group.heading} ${group.rows.length}`}
        </Text>
        {shown.map((stop) =>
          stop.kind === 'more' ? (
            <TextAction
              key={`${group.key}-more`}
              label={W.showAll}
              onPress={onShowAll}
              testID={`demo.search.more.${group.key}`}
            />
          ) : (
            <SearchRow key={stop.row.id} row={stop.row} onPress={() => onRow(stop.row)} />
          ),
        )}
      </View>
    );
  });
}

function Said({ words }: { words: string }) {
  return (
    <View style={styles.said}>
      <Text size={15} style={styles.secondary}>
        {words}
      </Text>
    </View>
  );
}

const STANDING_MARKS: Record<Standing, 'waiting' | 'paused'> = {
  Invited: 'waiting',
  'Awaiting approval': 'waiting',
  Suspended: 'paused',
};

function SearchRow({ row, onPress }: { row: Found; onPress: () => void }) {
  const standing = row.kind === 'member' ? row.standing : null;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      accessibilityRole="button"
      accessibilityLabel={[row.name, row.line, standing].filter(Boolean).join(', ')}
      testID={`demo.search.row.${row.id}`}
    >
      {row.kind === 'event' ? (
        <EventThumb event={{ id: row.id, mesh: row.mesh, photo: null }} side={40} radius={10} />
      ) : (
        <View
          style={styles.face}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Initials name={row.name} size={14} weight="semibold" />
        </View>
      )}
      <View style={styles.words}>
        <Text size={16} weight="semibold" numberOfLines={1}>
          {row.name}
        </Text>
        <Text size={14} numberOfLines={1} style={styles.secondary}>
          {row.line}
        </Text>
      </View>
      {standing != null && <Tag kind={STANDING_MARKS[standing]} word={standing} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  phone: { flex: 1, backgroundColor: tokens.colorCard },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceSm,
    paddingHorizontal: tokens.spaceXl,
    paddingBottom: tokens.spaceSm,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colorBorder,
  },
  cancel: {
    minHeight: tokens.sizeHit,
    justifyContent: 'center',
    paddingHorizontal: tokens.spaceXs,
  },
  pressed: { opacity: 0.6 },
  accent: { color: tokens.colorAccentText },
  secondary: { color: tokens.colorInkSecondary },
  body: { paddingHorizontal: tokens.spaceXl, paddingTop: tokens.spaceSm },
  scrim: { backgroundColor: tokens.scrimDialog },
  panel: {
    position: 'absolute',
    top: PANEL_TOP,
    overflow: 'hidden',
    backgroundColor: tokens.colorCard,
    borderRadius: tokens.radiusCardLarge,
    shadowColor: tokens.colorInk,
    shadowOpacity: 0.2,
    shadowRadius: 25,
    shadowOffset: { width: 0, height: 20 },
    elevation: 12,
  },
  panelTop: {
    minHeight: 56,
    justifyContent: 'center',
    paddingHorizontal: tokens.spaceXl,
    paddingVertical: tokens.spaceSm,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colorBorder,
  },
  said: { gap: tokens.spaceXs, paddingVertical: tokens.spaceLg, alignItems: 'flex-start' },
  group: { paddingTop: tokens.spaceMd },
  row: {
    height: ROW,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceMd,
    marginHorizontal: -10,
    paddingHorizontal: 10,
    borderRadius: tokens.radiusRow,
  },
  rowPressed: { backgroundColor: tokens.colorNeutralFill },
  face: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorNeutralFill,
  },
  words: { flex: 1, minWidth: 0, gap: 2 },
  toast: { position: 'absolute', left: tokens.spaceXl, right: tokens.spaceXl, bottom: 40 },
});
