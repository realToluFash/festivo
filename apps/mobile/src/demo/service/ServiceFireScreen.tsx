import { useLocalSearchParams } from 'expo-router';
import { type RefObject, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type ViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  DestructiveButton,
  PrimaryButton,
  QuietButton,
  SecondaryButton,
} from '../../components/Buttons.tsx';
import { RadioMark } from '../../components/RadioMark.tsx';
import { useReadOut } from '../../components/ReadOut.tsx';
import { Sheet } from '../../components/Sheet.tsx';
import { Text } from '../../components/Text.tsx';
import { moveScreenReaderFocus } from '../../components/screenReaderFocus.ts';
import { useLayout } from '../../layout/useLayout.ts';
import { DemoOnly } from '../../steps/Lines.tsx';
import { tokens } from '../../theme/tokens.ts';
import { goBack } from '../DemoScreen.tsx';
import { Glyph } from '../queue/QueueParts.tsx';
import { PATHS, Strip, TabBar, type TabId, shared } from './HowItsGoingParts.tsx';
import {
  COURSES,
  ENDED_LINE,
  EVENT,
  type FireState,
  NOTHING_TICKED,
  NO_MENU_LINE,
  OFFLINE_LINE,
  RUN_COURSE,
  RUN_ITEM,
  SECTIONS,
  type Scope,
  THRESHOLD_MAX,
  THRESHOLD_MIN,
  askNext,
  choiceLine,
  closeConfirm,
  closeFire,
  confirm,
  confirmLine,
  confirmTitle,
  confirmWords,
  controls,
  courseName,
  courseOffer,
  courseWord,
  dismissPrompt,
  fireFrom,
  fireLabel,
  fireStateOf,
  firstTickable,
  isFired,
  notYet,
  notYetLine,
  openFire,
  pickCourse,
  pickScope,
  pressFire,
  promptLine,
  prompting,
  runStarts,
  scopeLine,
  scopeName,
  seed,
  serveAll,
  serviceLine,
  setOnline,
  startService,
  step,
  steppable,
  suggesting,
  suggestionLine,
  suggestionWhy,
  tableLine,
  threshold,
  toggle,
} from './ServiceFireModel.ts';

const FLAME = [
  'M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z',
];
const LOCK = ['M5 11h14v10H5z', 'M8 11V7a4 4 0 0 1 8 0v4'];
const INFO = ['M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20z', 'M12 16v-4', 'M12 8h.01'];

type View3 = 'going' | 'plan' | 'list';
const VIEW_WORDS: Record<View3, string> = { going: 'How it’s going', plan: 'Plan', list: 'List' };
const VIEW_OWNER: Record<View3, string> = {
  going: 'How it’s going is sc-34107’s (/demo/how-its-going).',
  plan: 'Plan is sc-4026’s (/demo/service-room).',
  list: 'List is sc-4026’s (/demo/service-room).',
};

export function ServiceFireRoute() {
  const params = useLocalSearchParams<{ state?: string }>();
  const state = fireStateOf(params.state);

  return <ServiceFire key={state} start={state} />;
}

type Focus = 'fire' | 'next' | 'end' | 'start' | null;
type Apply = (next: FireState, focus?: Focus) => void;

function ServiceFire({ start }: { start: ReturnType<typeof fireStateOf> }) {
  const insets = useSafeAreaInsets();
  const wide = useLayout().kind === 'tabletLandscape';
  const [s, setS] = useState<FireState>(() => seed(start));
  const [said, setSaid] = useState(0);
  const [tab, setTab] = useState<TabId>(() => (seed(start).manage ? 'service' : 'next'));
  const [view, setView] = useState<View3>('going');
  const fireRef = useRef<ViewInstance | null>(null);
  const nextRef = useRef<ViewInstance | null>(null);
  const endRef = useRef<ViewInstance | null>(null);
  const startRef = useRef<ViewInstance | null>(null);
  const focusTo = useRef<Focus>(null);

  useReadOut(said === 0 || s.say === '' ? null : s.say, { answer: said });

  useEffect(() => {
    const to = focusTo.current;
    if (to == null) return;
    focusTo.current = null;
    const target = { fire: fireRef, next: nextRef, end: endRef, start: startRef }[to];
    moveScreenReaderFocus(target.current);
  });

  const apply: Apply = (next, focus = null) => {
    focusTo.current = focus;
    setS(next);
    setSaid((n) => n + 1);
  };

  const tabs: TabId[] = s.manage ? ['next', 'floor', 'service', 'team'] : ['next', 'floor'];
  const shown = tabs.includes(tab) ? tab : (tabs[0] ?? 'next');
  const onService = shown === 'service';
  const prompt = prompting(s);
  const suggest = suggesting(s) && !(prompt && RUN_COURSE === s.current + 1);
  const later = notYetLine(s);

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.body}>
        <Pressable
          onPress={goBack}
          accessibilityRole="button"
          style={styles.back}
          testID="fire.back"
        >
          <Text size={15} weight="semibold" style={shared.accent}>
            Back
          </Text>
        </Pressable>
        {onService ? (
          <>
            <View style={styles.header}>
              <Text size={30} weight="bold" accessibilityRole="header">
                Service
              </Text>
              <Text size={15} weight="medium" style={shared.secondary}>
                {s.paused ? `${EVENT} · Paused` : EVENT}
              </Text>
              <Strip online={s.online} refused="" />
              <ServiceBar
                s={s}
                apply={apply}
                fireRef={fireRef}
                nextRef={nextRef}
                endRef={endRef}
                startRef={startRef}
                wide={wide}
              />
            </View>
            <View style={styles.views} accessibilityRole="tablist">
              {(['going', 'plan', 'list'] as const).map((v) => (
                <Pressable
                  key={v}
                  onPress={() => setView(v)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: view === v }}
                  style={[styles.view, view === v && styles.viewOn]}
                  testID={`fire.view.${v}`}
                >
                  <Text size={15} weight="semibold" style={view === v ? shared.accent : undefined}>
                    {VIEW_WORDS[v]}
                  </Text>
                </Pressable>
              ))}
            </View>
            {s.result.length > 0 && (
              <View style={[shared.card, styles.result]}>
                <Glyph paths={PATHS.check} ink={tokens.colorInk} side={18} />
                <View style={shared.grow}>
                  {s.result.map((line) => (
                    <Text key={line} size={15} weight="semibold">
                      {line}
                    </Text>
                  ))}
                </View>
              </View>
            )}
            {prompt && (
              <Cue
                title={promptLine()}
                why={`The run of show links ${RUN_ITEM} to ${courseWord(RUN_COURSE)}.`}
                pill
                later="Not now"
                go={`Fire ${courseWord(RUN_COURSE)} now`}
                onLater={() => apply(dismissPrompt(s), 'fire')}
                onGo={() => apply(fireFrom(s, RUN_COURSE, true))}
                id="prompt"
              />
            )}
            {suggest && (
              <Cue
                title={suggestionLine(s)}
                why={suggestionWhy(s)}
                pill={false}
                later="Not yet"
                go={`Fire ${courseWord(s.current + 1)} now`}
                onLater={() => apply(notYet(s), 'fire')}
                onGo={() => apply(fireFrom(s, s.current + 1, false))}
                id="suggest"
              />
            )}
            {later !== '' && !suggest && (
              <View style={styles.line}>
                <Glyph paths={INFO} ink={tokens.colorInkSecondary} side={16} />
                <Text size={14} weight="medium" style={[shared.secondary, shared.grow]}>
                  {later}
                </Text>
              </View>
            )}
            <View style={shared.card}>
              <Text size={20} weight="bold" accessibilityRole="header">
                {VIEW_WORDS[view]}
              </Text>
              <Text size={15} style={shared.secondary}>
                {`${VIEW_OWNER[view]} It reads a fire’s orders as it reads any other; nothing else on it changes.`}
              </Text>
            </View>
          </>
        ) : (
          <>
            <Text size={30} weight="bold" accessibilityRole="header">
              {shown === 'next' ? 'Next' : shown === 'floor' ? 'Floor' : 'Team'}
            </Text>
            <View style={shared.card}>
              <Text size={15} style={shared.secondary}>
                {!s.manage
                  ? 'Without service.manage the app has Next and Floor only (sc-34107), so none of sc-4009’s controls, suggestion or prompt is drawn. A fire reaches Next as new orders.'
                  : shown === 'next'
                    ? 'Next is the waiter’s own screen (sc-1361). A fire reaches it as new orders; no suggestion or prompt shows here.'
                    : shown === 'floor'
                      ? 'Floor is the waiter’s tables (sc-4021). No suggestion or prompt shows here.'
                      : 'Team moves people between sections and stations (sc-36034).'}
              </Text>
            </View>
          </>
        )}
        <DemoOnly title="Demo only: the board’s switches">
          <SecondaryButton
            label="Start again"
            onPress={() => apply(seed(start))}
            testID="fire.demo.reset"
          />
          <SecondaryButton
            label={s.online ? 'Go offline' : 'Back online'}
            onPress={() => apply(setOnline(s, !s.online))}
            testID="fire.demo.online"
          />
          <SecondaryButton
            label={s.manage ? 'View without service.manage' : 'View with service.manage'}
            onPress={() => {
              apply({ ...s, manage: !s.manage, fire: null, confirm: null });
              setTab(s.manage ? 'next' : 'service');
            }}
            testID="fire.demo.manage"
          />
          {s.phase === 'on' && (
            <>
              <SecondaryButton
                label={`Every table fired for ${courseWord(s.current)} is served`}
                onPress={() => apply(serveAll(s))}
                testID="fire.demo.served"
              />
              <SecondaryButton
                label="Speeches starts on the run of show"
                onPress={() => apply(runStarts({ ...s, promptDone: false }))}
                testID="fire.demo.run"
              />
              <SecondaryButton
                label="Five minutes pass"
                onPress={() => apply({ ...s, notYetUntil: null })}
                testID="fire.demo.later"
              />
            </>
          )}
        </DemoOnly>
      </ScrollView>
      <TabBar
        tabs={tabs}
        current={shown}
        onPick={setTab}
        bottom={Math.max(insets.bottom, tokens.spaceSm)}
      />
      <FireSheet s={s} apply={apply} opener={fireRef} wide={wide} />
      <ConfirmSheet s={s} apply={apply} opener={s.confirm === 'end' ? endRef : nextRef} />
    </View>
  );
}

function ServiceBar({
  s,
  apply,
  fireRef,
  nextRef,
  endRef,
  startRef,
  wide,
}: {
  s: FireState;
  apply: Apply;
  fireRef: RefObject<ViewInstance | null>;
  nextRef: RefObject<ViewInstance | null>;
  endRef: RefObject<ViewInstance | null>;
  startRef: RefObject<ViewInstance | null>;
  wide: boolean;
}) {
  const c = controls(s);
  const off = !s.online;
  const steps = steppable(s);
  const [open, setOpen] = useState(s.thresholdsOpen);
  const tried = () => apply({ ...s, offlineTried: true, say: OFFLINE_LINE });

  return (
    <View style={styles.bar}>
      <View style={styles.line}>
        <View style={[styles.phase, PHASE[s.phase]]} />
        <Text size={16} weight="semibold" style={[shared.grow, styles.number]}>
          {serviceLine(s)}
        </Text>
      </View>
      {c.noMenu && (
        <View style={styles.line}>
          <Glyph paths={INFO} ink={tokens.colorInkSecondary} side={16} />
          <Text size={15} weight="medium" style={[shared.secondary, shared.grow]}>
            {NO_MENU_LINE}
          </Text>
        </View>
      )}
      {(c.start || c.fire) && (
        <View style={[styles.controls, wide && styles.controlsWide]}>
          {c.start && (
            <PrimaryButton
              ref={startRef}
              label="Start service"
              off={off}
              onPress={() => apply(startService(s), off ? null : 'fire')}
              testID="fire.start"
            />
          )}
          {c.fire && (
            <PrimaryButton
              ref={fireRef}
              label={`Fire ${courseWord(s.current)}`}
              off={off}
              grow={!wide}
              onPress={() => (off ? tried() : apply(openFire(s)))}
              testID="fire.fire"
            />
          )}
          {c.next && (
            <SecondaryButton
              ref={nextRef}
              label="Next course"
              off={off}
              grow={!wide}
              onPress={() => apply(askNext(s))}
              testID="fire.next"
            />
          )}
          {c.end && (
            <SecondaryButton
              ref={endRef}
              label="End service…"
              off={off}
              grow={!wide}
              onPress={() => apply(askNext(s))}
              testID="fire.end"
            />
          )}
        </View>
      )}
      {s.phase === 'ended' && s.manage && (
        <Text size={14} style={shared.secondary}>
          {ENDED_LINE}
        </Text>
      )}
      {off && (c.start || c.fire) && (
        <View style={styles.line}>
          <Glyph paths={PATHS.offline} ink={tokens.colorInk} side={16} />
          <Text size={14} weight="semibold" style={shared.grow}>
            {OFFLINE_LINE}
          </Text>
        </View>
      )}
      {c.fire && steps.length > 0 && (
        <View style={styles.thresholds}>
          <View style={shared.wrap}>
            <QuietButton
              label={`When to suggest the next course ${open ? '▴' : '▾'}`}
              accessibilityLabel="When to suggest the next course"
              onPress={() => setOpen(!open)}
              testID="fire.thresholds"
            />
            <Pill words="AC, not yet built" />
          </View>
          {open &&
            steps.map((i) => {
              const v = threshold(s, i);
              return (
                <View key={i} style={styles.stepRow}>
                  <View style={shared.grow}>
                    <Text size={16} weight="semibold">
                      {courseName(i)}
                    </Text>
                    <Text size={13} style={shared.secondary}>
                      Suggested once this share of tables is served
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => apply(step(s, i, -1))}
                    accessibilityRole="button"
                    accessibilityLabel={`Lower ${courseWord(i)}’s threshold`}
                    accessibilityState={{ disabled: off || v <= THRESHOLD_MIN }}
                    style={[styles.step, (off || v <= THRESHOLD_MIN) && styles.stepOff]}
                    testID={`fire.step.${i}.down`}
                  >
                    <Text size={20} weight="semibold">
                      −
                    </Text>
                  </Pressable>
                  <Text
                    size={17}
                    weight="bold"
                    style={[styles.stepValue, styles.number]}
                    accessibilityLabel={`Suggest ${courseWord(i)} from ${v}%`}
                  >
                    {`${v}%`}
                  </Text>
                  <Pressable
                    onPress={() => apply(step(s, i, 1))}
                    accessibilityRole="button"
                    accessibilityLabel={`Raise ${courseWord(i)}’s threshold`}
                    accessibilityState={{ disabled: off || v >= THRESHOLD_MAX }}
                    style={[styles.step, (off || v >= THRESHOLD_MAX) && styles.stepOff]}
                    testID={`fire.step.${i}.up`}
                  >
                    <Text size={20} weight="semibold">
                      +
                    </Text>
                  </Pressable>
                </View>
              );
            })}
        </View>
      )}
    </View>
  );
}

function Pill({ words }: { words: string }) {
  return (
    <View style={styles.pill}>
      <Text size={12.5} weight="semibold" style={shared.secondary}>
        {words}
      </Text>
    </View>
  );
}

function Cue({
  title,
  why,
  pill,
  later,
  go,
  onLater,
  onGo,
  id,
}: {
  title: string;
  why: string;
  pill: boolean;
  later: string;
  go: string;
  onLater: () => void;
  onGo: () => void;
  id: string;
}) {
  return (
    <View style={styles.cue}>
      <View style={styles.line}>
        <Glyph paths={FLAME} ink={tokens.colorAccentText} side={20} />
        <Text size={17} weight="bold" accessibilityRole="header" style={shared.grow}>
          {title}
        </Text>
      </View>
      <Text size={14} style={shared.secondary}>
        {why}
      </Text>
      {pill && <Pill words="AC, not yet built" />}
      <View style={styles.cueActions}>
        <SecondaryButton label={later} link onPress={onLater} testID={`fire.${id}.later`} />
        <PrimaryButton label={go} onPress={onGo} testID={`fire.${id}.go`} />
      </View>
    </View>
  );
}

function FireSheet({
  s,
  apply,
  opener,
  wide,
}: {
  s: FireState;
  apply: Apply;
  opener: RefObject<ViewInstance | null>;
  wide: boolean;
}) {
  const f = s.fire;
  const firstRef = useRef<ViewInstance | null>(null);
  const [focusFirst, setFocusFirst] = useState(0);
  const scopes: Scope[] = ['all', ...SECTIONS, 'choose'];
  const first = firstTickable(s);

  useEffect(() => {
    if (focusFirst > 0) moveScreenReaderFocus(firstRef.current);
  }, [focusFirst]);

  return (
    <Sheet
      open={f != null}
      onClose={() => apply(closeFire(s), 'fire')}
      scrimLabel="Close the fire choice"
      opener={opener}
      docked={wide}
      testID="fire.sheet"
    >
      {f != null && (
        <View style={styles.sheet}>
          <Text size={22} weight="bold" accessibilityRole="header">
            {`Fire ${courseWord(f.course)}`}
          </Text>
          <Text size={14} weight="semibold">
            Course
          </Text>
          <View accessibilityRole="radiogroup" style={styles.options}>
            {COURSES.map((name, i) => (
              <Option
                key={name}
                on={f.course === i}
                name={name}
                line={courseOffer(s, i)}
                onPress={() => apply(pickCourse(s, i))}
                testID={`fire.course.${i}`}
              />
            ))}
          </View>
          <Text size={14} style={shared.secondary}>
            {choiceLine(s, f)}
          </Text>
          <Text size={14} weight="semibold">
            Tables
          </Text>
          <View accessibilityRole="radiogroup" style={styles.options}>
            {scopes.map((scope) => (
              <Option
                key={scope}
                on={f.scope === scope}
                name={scopeName(scope)}
                line={scopeLine(s, f.course, scope)}
                onPress={() => apply(pickScope(s, scope))}
                testID={`fire.scope.${scope}`}
              />
            ))}
          </View>
          {f.scope !== 'all' && f.scope !== 'choose' && (
            <Text size={14} style={shared.secondary}>
              A table in no section fires through All tables or Choose tables.
            </Text>
          )}
          {f.scope === 'choose' && (
            <View style={[styles.tables, f.error && styles.tablesError]}>
              {f.error && (
                <Text size={15} weight="semibold" style={styles.error}>
                  {NOTHING_TICKED}
                </Text>
              )}
              {[...SECTIONS.map((id) => `Section ${id}`), 'In no section'].map((group) => {
                const list = s.tables.filter((t) =>
                  group === 'In no section' ? t.section == null : `Section ${t.section}` === group,
                );
                return (
                  <View key={group} style={styles.group}>
                    <Text size={13} weight="semibold" style={shared.secondary}>
                      {group}
                    </Text>
                    {list.map((t) => {
                      const done = isFired(t, f.course);
                      const nobody = t.seated === 0 && !done;
                      const ticked = done || f.ticked.includes(t.name);
                      return (
                        <Pressable
                          key={t.name}
                          ref={t.name === first ? firstRef : undefined}
                          onPress={() => apply(toggle(s, t.name))}
                          accessibilityRole="checkbox"
                          accessibilityLabel={`${t.name}. ${tableLine(t, f.course)}`}
                          accessibilityState={{ checked: ticked, disabled: done || nobody }}
                          style={[
                            styles.table,
                            (done || nobody) && styles.tableLocked,
                            nobody && styles.tableNobody,
                          ]}
                          testID={`fire.table.${t.name}`}
                        >
                          <View
                            style={[styles.box, ticked && styles.boxOn, done && styles.boxLocked]}
                          >
                            {ticked && (
                              <Glyph paths={PATHS.check} ink={tokens.colorCard} side={14} />
                            )}
                          </View>
                          <View style={shared.grow}>
                            <Text size={16} weight="semibold">
                              {t.name}
                            </Text>
                            <View style={shared.wrap}>
                              {done && (
                                <Glyph paths={LOCK} ink={tokens.colorInkSecondary} side={13} />
                              )}
                              {nobody && <View style={styles.nobodyRing} />}
                              <Text size={13} style={shared.secondary}>
                                {tableLine(t, f.course)}
                              </Text>
                            </View>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                );
              })}
            </View>
          )}
          <View style={styles.sheetActions}>
            <PrimaryButton
              label={fireLabel(s, f)}
              off={!s.online}
              onPress={() => {
                const next = pressFire(s);
                if (next.fire?.error === true) {
                  apply(next);
                  setFocusFirst((n) => n + 1);
                } else apply(next, 'fire');
              }}
              testID="fire.go"
            />
            <SecondaryButton
              label="Don’t fire"
              link
              onPress={() => apply(closeFire(s), 'fire')}
              testID="fire.cancel"
            />
          </View>
        </View>
      )}
    </Sheet>
  );
}

function Option({
  on,
  name,
  line,
  onPress,
  testID,
}: {
  on: boolean;
  name: string;
  line: string;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityLabel={`${name}. ${line}`}
      accessibilityState={{ checked: on }}
      style={[styles.option, on && styles.optionOn]}
      testID={testID}
    >
      <RadioMark on={on} />
      <View style={shared.grow}>
        <Text size={16} weight="semibold">
          {name}
        </Text>
        <Text size={13} style={shared.secondary}>
          {line}
        </Text>
      </View>
    </Pressable>
  );
}

function ConfirmSheet({
  s,
  apply,
  opener,
}: {
  s: FireState;
  apply: Apply;
  opener: RefObject<ViewInstance | null>;
}) {
  const ending = s.confirm === 'end';
  const words = s.confirm == null ? null : confirmWords(s);
  return (
    <Sheet
      open={s.confirm != null}
      onClose={() => apply(closeConfirm(s), ending ? 'end' : 'next')}
      opener={opener}
      testID="fire.confirm"
    >
      {words != null && (
        <View style={styles.sheet}>
          <Text size={22} weight="bold" accessibilityRole="header">
            {confirmTitle(s)}
          </Text>
          <Text size={15} style={shared.secondary}>
            {confirmLine(s)}
          </Text>
          <Pill words="Words proposed for [en]" />
          <View style={styles.sheetActions}>
            {ending ? (
              <DestructiveButton
                label={words.go}
                onPress={() => apply(confirm(s))}
                testID="fire.confirm.go"
              />
            ) : (
              <PrimaryButton
                label={words.go}
                onPress={() => apply(confirm(s), 'fire')}
                testID="fire.confirm.go"
              />
            )}
            <SecondaryButton
              label={words.keep}
              link
              onPress={() => apply(closeConfirm(s), ending ? 'end' : 'next')}
              testID="fire.confirm.keep"
            />
          </View>
        </View>
      )}
    </Sheet>
  );
}

const PHASE = StyleSheet.create({
  notStarted: {
    borderWidth: 2,
    borderColor: tokens.colorInkSecondary,
    backgroundColor: 'transparent',
  },
  on: { backgroundColor: tokens.colorAccent },
  ended: { borderRadius: 2, backgroundColor: tokens.colorInkSecondary },
});

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: tokens.colorPage },
  body: { padding: tokens.spaceLg, gap: tokens.spaceMd, paddingBottom: tokens.spaceXl },
  back: { minHeight: tokens.sizeHit, justifyContent: 'center', alignSelf: 'flex-start' },
  header: { gap: tokens.spaceSm },
  bar: { gap: tokens.spaceSm, paddingTop: tokens.spaceXs },
  line: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm, minHeight: 24 },
  phase: { width: 12, height: 12, borderRadius: 6 },
  number: { fontVariant: ['tabular-nums'] },
  controls: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spaceSm },
  controlsWide: { justifyContent: 'flex-start' },
  thresholds: { gap: tokens.spaceSm },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceSm,
    padding: tokens.spaceMd,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
    backgroundColor: tokens.colorCard,
  },
  step: {
    width: tokens.sizeHitPhonePrimary,
    minHeight: tokens.sizeHitPhonePrimary,
    borderRadius: tokens.sizeHitPhonePrimary / 2,
    borderWidth: 1,
    borderColor: tokens.colorControlBorder,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorCard,
  },
  stepOff: { opacity: 0.45 },
  stepValue: { minWidth: 52, textAlign: 'center' },
  pill: {
    alignSelf: 'flex-start',
    minHeight: 24,
    justifyContent: 'center',
    paddingHorizontal: 9,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: tokens.colorInkTertiary,
  },
  views: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spaceXs },
  view: {
    minHeight: tokens.sizeHitPhonePrimary,
    paddingHorizontal: tokens.spaceLg,
    justifyContent: 'center',
    borderRadius: tokens.sizeHitPhonePrimary / 2,
    borderWidth: 1,
    borderColor: tokens.colorControlBorder,
    backgroundColor: tokens.colorCard,
  },
  viewOn: { borderColor: tokens.colorAccent, backgroundColor: tokens.colorAccentTint },
  result: { flexDirection: 'row', alignItems: 'flex-start' },
  cue: {
    gap: tokens.spaceSm,
    padding: tokens.spaceLg,
    borderRadius: tokens.radiusCardPhone,
    borderWidth: 1.5,
    borderColor: tokens.colorAccent,
    backgroundColor: tokens.colorAccentTint,
  },
  cueActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: tokens.spaceSm },
  sheet: { gap: tokens.spaceSm, paddingBottom: tokens.spaceLg },
  options: { gap: tokens.spaceXs },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceMd,
    minHeight: tokens.sizeHitPhonePrimary,
    paddingHorizontal: tokens.spaceMd,
    paddingVertical: tokens.spaceSm,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.colorControlBorder,
    backgroundColor: tokens.colorCard,
  },
  optionOn: { borderColor: tokens.colorAccent, backgroundColor: tokens.colorAccentTint },
  tables: { gap: tokens.spaceMd },
  tablesError: {
    padding: tokens.spaceMd,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: tokens.colorBroken,
  },
  error: { color: tokens.colorBrokenText },
  group: { gap: tokens.spaceXs },
  table: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceMd,
    minHeight: tokens.sizeHitPhonePrimary,
    paddingHorizontal: tokens.spaceMd,
    paddingVertical: tokens.spaceXs,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.colorControlBorder,
    backgroundColor: tokens.colorCard,
  },
  tableLocked: { backgroundColor: tokens.colorInset },
  tableNobody: { borderStyle: 'dashed' },
  box: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: tokens.colorFieldBorder,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorCard,
  },
  boxOn: { borderColor: tokens.colorAccent, backgroundColor: tokens.colorAccent },
  boxLocked: { borderColor: tokens.colorInkSecondary, backgroundColor: tokens.colorInkSecondary },
  nobodyRing: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: tokens.colorInkSecondary,
  },
  sheetActions: { gap: tokens.spaceSm, paddingTop: tokens.spaceSm },
});
