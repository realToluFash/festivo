import { useLocalSearchParams } from 'expo-router';
import { type RefObject, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type ViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton, QuietButton, SecondaryButton } from '../../components/Buttons.tsx';
import { readOut, useReadOut } from '../../components/ReadOut.tsx';
import { SETTLED_MS } from '../../components/Screen.tsx';
import { Sheet } from '../../components/Sheet.tsx';
import { Text } from '../../components/Text.tsx';
import { moveScreenReaderFocus } from '../../components/screenReaderFocus.ts';
import { useLayout } from '../../layout/useLayout.ts';
import { DemoOnly } from '../../steps/Lines.tsx';
import { tokens } from '../../theme/tokens.ts';
import { goBack } from '../DemoScreen.tsx';
import {
  CONTROLS,
  type Control,
  OFFLINE_LINE,
  type QueueState,
  SECTIONS,
  type SectionId,
  buildWords,
  cancelBuild,
  conflictLine,
  drawn,
  goOnline,
  move,
  onIt,
  pick,
  placeLine,
  queueStateOf,
  save,
  sectionOf,
  seed,
  select,
  startBuild,
  tagsFor,
  upNext,
} from './QueueModel.ts';
import { ControlButton, ControlGap, FlagLine, PlaceNumber, TagPill } from './QueueParts.tsx';

export function QueueRoute() {
  const params = useLocalSearchParams<{ state?: string }>();
  const state = queueStateOf(params.state);

  return <QueueLead key={state} start={state} />;
}

function tablesWord(n: number): string {
  return n === 1 ? '1 table' : `${n} tables`;
}

function sectionLine(id: SectionId, count: number): string {
  const on = sectionOf(id).on;
  return `${on.length > 0 ? on.join(', ') : 'Nobody on it'} · ${count > 0 ? tablesWord(count) : 'No tables'}`;
}

function QueueLead({ start }: { start: ReturnType<typeof queueStateOf> }) {
  const { kind } = useLayout();
  const insets = useSafeAreaInsets();
  const [s, setS] = useState<QueueState>(() => seed(start));
  const [said, setSaid] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(true);
  const controls = useRef(new Map<string, ViewInstance>());
  const sheetOpener = useRef<ViewInstance | null>(null);
  const phone = kind === 'phone';

  function apply(next: QueueState): void {
    setS(next);
    setSaid((n) => n + 1);
  }

  useEffect(() => {
    if (said === 0 || s.say === '') return;
    const unsay = readOut(s.say);
    const focus = s.focus;
    const later =
      focus == null
        ? undefined
        : setTimeout(
            () =>
              moveScreenReaderFocus(
                controls.current.get(`${focus.place}|${focus.control}`) ?? null,
              ),
            SETTLED_MS,
          );
    return () => {
      unsay();
      clearTimeout(later);
    };
  }, [said, s.say, s.focus]);

  const panel = <QueuePanel s={s} apply={apply} phone={phone} controls={controls} />;
  const sections = (
    <SectionList
      s={s}
      opener={sheetOpener}
      row={kind === 'tabletPortrait'}
      onPick={(id) => {
        apply(select(s, id));
        setSheetOpen(true);
      }}
    />
  );

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={[styles.body, phone && styles.bodyPhone]}>
        <Pressable
          onPress={goBack}
          accessibilityRole="button"
          style={styles.back}
          testID="queue.back"
        >
          <Text size={15} weight="semibold" style={styles.accent}>
            Back
          </Text>
        </Pressable>
        <Header s={s} />
        {kind === 'tabletLandscape' ? (
          <View style={styles.side}>
            <View style={styles.sideList}>{sections}</View>
            <View style={styles.sidePanel}>{panel}</View>
          </View>
        ) : phone ? (
          sections
        ) : (
          <>
            {sections}
            {panel}
          </>
        )}
        <DemoOnly title="Demo only: the board’s switches">
          <SecondaryButton
            label="Start again"
            onPress={() => setS(seed(start))}
            testID="queue.demo.reset"
          />
          <SecondaryButton
            label={s.online ? 'Go offline' : 'Back online'}
            onPress={() => setS(goOnline(s, !s.online))}
            testID="queue.demo.online"
          />
          <SecondaryButton
            label={
              s.rivalFirst
                ? 'Tobi Adeyemi changes it first · on'
                : 'Another lead changes the queue first'
            }
            onPress={() => setS({ ...s, rivalFirst: !s.rivalFirst })}
            testID="queue.demo.rival"
          />
          <SecondaryButton
            label={s.manage ? 'View without service.manage' : 'View with service.manage'}
            onPress={() => setS({ ...s, manage: !s.manage })}
            testID="queue.demo.manage"
          />
        </DemoOnly>
      </ScrollView>
      {phone && (
        <Sheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          scrimLabel="Close the section"
          opener={sheetOpener}
          testID="queue.sheet"
        >
          <View style={styles.sheet}>
            <Text size={22} weight="bold" accessibilityRole="header">
              {sectionOf(s.selected).name}
            </Text>
            <Text size={15} weight="medium" style={styles.secondary}>
              {sectionLine(s.selected, s.queues[s.selected].length)}
            </Text>
            {panel}
          </View>
        </Sheet>
      )}
    </View>
  );
}

function Header({ s }: { s: QueueState }) {
  return (
    <View style={styles.header}>
      <Text size={30} weight="bold" accessibilityRole="header">
        Service
      </Text>
      <Text size={15} weight="medium" style={styles.secondary}>
        Mains · Adaeze & Tunde’s wedding
      </Text>
      <View style={styles.status}>
        <View style={[styles.dot, !s.online && styles.dotOff]} />
        <Text size={14} weight="medium" style={styles.secondary}>
          {!s.online
            ? 'Offline · showing the room as of 20:41'
            : s.started
              ? 'Live · updated 20:41'
              : 'Not started yet'}
        </Text>
      </View>
    </View>
  );
}

function SectionList({
  s,
  opener,
  row,
  onPick,
}: {
  s: QueueState;
  opener: RefObject<ViewInstance | null>;
  row: boolean;
  onPick: (id: SectionId) => void;
}) {
  return (
    <View style={row ? styles.sectionRow : styles.sectionColumn}>
      {SECTIONS.map((sec) => {
        const on = sec.id === s.selected;
        return (
          <Pressable
            key={sec.id}
            ref={on ? opener : undefined}
            onPress={() => onPick(sec.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            style={[styles.sectionButton, row && styles.sectionChip, on && styles.sectionOn]}
            testID={`queue.section.${sec.id}`}
          >
            <Text size={16} weight={on ? 'bold' : 'semibold'}>
              {sec.name}
            </Text>
            <Text size={14} style={styles.secondary}>
              {sectionLine(sec.id, s.queues[sec.id].length)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function QueuePanel({
  s,
  apply,
  phone,
  controls,
}: {
  s: QueueState;
  apply: (next: QueueState) => void;
  phone: boolean;
  controls: RefObject<Map<string, ViewInstance>>;
}) {
  const id = s.selected;
  const sec = sectionOf(id);
  const q = s.queues[id];
  const build = s.build?.section === id ? s.build : null;
  const side = phone ? tokens.sizeHitPhonePrimary : tokens.sizeHit;
  const next = upNext(s, id);
  const notice =
    s.notice?.kind === 'offline'
      ? OFFLINE_LINE
      : s.notice?.kind === 'conflict' && s.notice.section === id
        ? conflictLine(s.notice.by)
        : null;

  return (
    <View style={styles.panel}>
      <Text size={13} weight="semibold" style={styles.kicker}>
        ON IT
      </Text>
      {onIt(s, id).map((person) => (
        <View key={person.name} style={styles.person}>
          <View
            style={styles.initials}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Text size={13} weight="bold" accessible={false}>
              {person.initials}
            </Text>
          </View>
          <View style={styles.grow}>
            <Text size={15} weight="semibold">
              {person.name}
            </Text>
            <Text size={14} style={styles.secondary}>
              {person.line}
            </Text>
          </View>
        </View>
      ))}
      {q.length === 0 ? (
        <Text size={15} style={styles.secondary}>
          No tables in {sec.name} yet. A table added to it joins the end of its queue.
        </Text>
      ) : !s.manage ? null : (
        <View style={styles.queue}>
          <View style={styles.queueHead}>
            <Text size={20} weight="bold" accessibilityRole="header" style={styles.grow}>
              Queue
            </Text>
            {build == null && q.length > 1 && (
              <QuietButton
                label="Build the queue"
                onPress={() => apply(startBuild(s, id))}
                testID="queue.build"
              />
            )}
          </View>
          <Text size={14} style={styles.secondary}>
            Each tray goes to the first table here with someone to serve. Owed plates go first,
            oldest first, and a tray already out carries on.
          </Text>
          {notice != null && (
            <View accessibilityRole="alert" style={styles.notice}>
              <Text size={15} weight="semibold">
                {notice}
              </Text>
            </View>
          )}
          {build == null ? (
            q.map((name, i) => {
              const p = s.places[name];
              if (p == null) return null;
              const tags = tagsFor(s, id, name);
              return (
                <View
                  key={name}
                  style={[styles.row, i > 0 && styles.rowSep]}
                  testID={`queue.row.${name}`}
                >
                  <PlaceNumber n={i + 1} next={name === next} />
                  <View
                    accessible
                    accessibilityLabel={`${i + 1} of ${q.length}. ${name}. ${placeLine(p)}${tags.length > 0 ? `. ${tags.map((t) => t.label).join('. ')}` : ''}${p.flag !== '' ? `. ${p.flag}` : ''}`}
                    style={styles.rowText}
                  >
                    <Text size={16} weight="semibold">
                      {name}
                    </Text>
                    {tags.length > 0 && (
                      <View style={styles.tags}>
                        {tags.map((t) => (
                          <TagPill key={t.kind} tag={t} />
                        ))}
                      </View>
                    )}
                    <Text size={14} style={styles.secondary}>
                      {placeLine(p)}
                    </Text>
                    {p.flag !== '' && <FlagLine flag={p.flag} />}
                  </View>
                  {q.length > 1 && (
                    <View style={[styles.controls, phone && styles.controlsPhone]}>
                      {CONTROLS.map((c: Control) =>
                        drawn(c, i, q.length) ? (
                          <ControlButton
                            key={c}
                            control={c}
                            place={name}
                            side={side}
                            ref={(v) => {
                              if (v != null) controls.current.set(`${name}|${c}`, v);
                              else controls.current.delete(`${name}|${c}`);
                            }}
                            onPress={() => apply(move(s, id, name, c))}
                            testID={`queue.${c}.${name}`}
                          />
                        ) : (
                          <ControlGap key={c} side={side} />
                        ),
                      )}
                    </View>
                  )}
                </View>
              );
            })
          ) : (
            <Build s={s} q={q} picked={build.picked} apply={apply} phone={phone} />
          )}
        </View>
      )}
    </View>
  );
}

function Build({
  s,
  q,
  picked,
  apply,
  phone,
}: {
  s: QueueState;
  q: readonly string[];
  picked: readonly string[];
  apply: (next: QueueState) => void;
  phone: boolean;
}) {
  const words = buildWords(q, picked);
  useReadOut(words.line);
  const saveButton = (
    <PrimaryButton
      label={words.saveLabel}
      off={!words.canSave}
      onPress={() => apply(save(s))}
      testID="queue.save"
    />
  );
  const cancel = (
    <QuietButton label="Cancel" onPress={() => apply(cancelBuild(s))} testID="queue.cancel" />
  );

  return (
    <View style={styles.build}>
      <Text size={15} weight="medium">
        {words.line}
      </Text>
      {q.map((name, i) => {
        const at = picked.indexOf(name);
        const p = s.places[name];
        return (
          <Pressable
            key={name}
            onPress={() => apply(pick(s, name))}
            accessibilityRole="button"
            accessibilityState={{ selected: at >= 0 }}
            accessibilityLabel={
              at >= 0 ? `${name}, number ${at + 1} in the new queue` : `${name}, not placed yet`
            }
            style={[styles.row, i > 0 && styles.rowSep]}
            testID={`queue.pick.${name}`}
          >
            <View style={[styles.pickDisc, at >= 0 ? styles.pickOn : styles.pickOff]}>
              {at >= 0 && (
                <Text size={16} weight="bold" accessible={false} style={styles.onAccent}>
                  {String(at + 1)}
                </Text>
              )}
            </View>
            <View style={styles.rowText}>
              <Text size={16} weight="semibold">
                {name}
              </Text>
              {p != null && (
                <Text size={14} style={styles.secondary}>
                  {placeLine(p)}
                </Text>
              )}
            </View>
          </Pressable>
        );
      })}
      {phone ? (
        <View style={styles.stack}>
          {saveButton}
          {cancel}
        </View>
      ) : (
        <View style={styles.pair}>
          {cancel}
          {saveButton}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: tokens.colorPage },
  body: { padding: tokens.spaceXl, gap: tokens.spaceLg },
  bodyPhone: { padding: tokens.spaceLg },
  back: { minHeight: tokens.sizeHit, justifyContent: 'center', alignSelf: 'flex-start' },
  accent: { color: tokens.colorAccentText },
  secondary: { color: tokens.colorInkSecondary },
  onAccent: { color: tokens.colorInkOnDark },
  kicker: { color: tokens.colorInkSecondary, letterSpacing: 0.6 },
  person: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceMd, minHeight: 48 },
  initials: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: tokens.colorInset,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: { gap: tokens.spaceXs },
  status: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: tokens.colorAccent },
  dotOff: { backgroundColor: tokens.colorInkSecondary },
  side: { flexDirection: 'row', gap: tokens.spaceLg, alignItems: 'flex-start' },
  sideList: { width: 320 },
  sidePanel: { flex: 1, minWidth: 0 },
  sectionColumn: { gap: tokens.spaceSm },
  sectionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spaceSm },
  sectionButton: {
    minHeight: tokens.sizeHit,
    padding: tokens.spaceMd,
    borderRadius: tokens.radiusCardPhone,
    backgroundColor: tokens.colorCard,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
    gap: 2,
  },
  sectionChip: { minWidth: 220 },
  sectionOn: {
    borderWidth: 2,
    borderColor: tokens.colorAccent,
    backgroundColor: tokens.colorAccentTint,
  },
  panel: {
    padding: tokens.spaceLg,
    borderRadius: tokens.radiusCardPhone,
    backgroundColor: tokens.colorCard,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
    gap: tokens.spaceSm,
  },
  sheet: { gap: tokens.spaceSm, paddingBottom: tokens.spaceLg },
  queue: { gap: tokens.spaceSm, marginTop: tokens.spaceMd },
  queueHead: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm },
  grow: { flex: 1 },
  notice: { padding: tokens.spaceMd, borderRadius: 12, backgroundColor: tokens.colorInset },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceMd,
    minHeight: 64,
    paddingVertical: 10,
  },
  rowSep: { borderTopWidth: 1, borderTopColor: tokens.colorBorder },
  rowText: { flex: 1, minWidth: 0, gap: 3 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  controls: { flexDirection: 'row', gap: 6 },
  controlsPhone: { flexDirection: 'column' },
  build: { gap: tokens.spaceSm },
  pickDisc: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickOn: { backgroundColor: tokens.colorAccent },
  pickOff: { borderWidth: 2, borderColor: tokens.colorControlBorder },
  stack: { gap: tokens.spaceXs, marginTop: tokens.spaceMd },
  pair: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: tokens.spaceMd,
    marginTop: tokens.spaceMd,
  },
});
