import { useLocalSearchParams } from 'expo-router';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View, type ViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton, QuietButton, SecondaryButton } from '../../components/Buttons.tsx';
import { Field, TextField } from '../../components/Field.tsx';
import { Glyph } from '../../components/Glyph.tsx';
import { MomentBox, PickerLayer, type Picking, pick } from '../../components/MomentPick.tsx';
import { Notice } from '../../components/Notice.tsx';
import { readOut } from '../../components/ReadOut.tsx';
import { Sheet, SheetActions } from '../../components/Sheet.tsx';
import { ShapeMark } from '../../components/StatusMark.tsx';
import { Skeleton } from '../../components/Skeleton.tsx';
import { PageToast } from '../../components/Summary.tsx';
import { Text } from '../../components/Text.tsx';
import { useLayout } from '../../layout/useLayout.ts';
import { DemoOnly } from '../../steps/Lines.tsx';
import { tokens } from '../../theme/tokens.ts';
import { goBack } from '../DemoScreen.tsx';
import {
  type TimesDraft,
  clock,
  draftOf,
  hoursWords,
  scheduledMinutes,
  timesProblem,
  workedOf,
} from './clock.ts';
import {
  CORRECTED_AT,
  EVENT,
  type HoursRow,
  type HoursState,
  HW,
  LIVE_NOW,
  PROBLEM_WORDS,
  YOU,
  clockedWords,
  corrected,
  hoursStart,
  hoursStateOf,
  liveNote,
  liveOf,
  liveWords,
  markWords,
  stillOnOf,
  summaryLines,
  summaryOf,
  trailWords,
} from './staffHoursModel.ts';

const LOCALE = 'en-GB';
const SAVE_MS = 700;
const RETRY_MS = 1200;

type Phase = 'loading' | 'failed' | 'ready';

export function StaffHoursRoute() {
  const params = useLocalSearchParams<{ state?: string }>();
  const state = hoursStateOf(params.state);

  return <StaffHours key={state} state={state} />;
}

function StaffHours({ state }: { state: HoursState }) {
  const [start] = useState(() => hoursStart(state));
  const [rows, setRows] = useState(start.rows);
  const [phase, setPhase] = useState<Phase>(
    state === 'loading' ? 'loading' : state === 'failed' ? 'failed' : 'ready',
  );
  const [open, setOpen] = useState(start.open);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [answer, setAnswer] = useState(0);
  const opener = useRef<ViewInstance | null>(null);
  const insets = useSafeAreaInsets();
  const { kind } = useLayout();
  const phone = kind === 'phone';
  const { live, manage } = start;
  const editing = open == null ? null : rows.find((one) => one.id === open.id);

  useEffect(() => {
    if (phase !== 'loading' || state === 'loading') return undefined;
    const timer = setTimeout(() => setPhase('ready'), RETRY_MS);
    return () => clearTimeout(timer);
  }, [phase, state]);

  function save(): void {
    if (open == null || editing == null) return;
    const stillOn = stillOnOf(editing, live);
    if (timesProblem(open.draft, stillOn) != null) {
      setOpen({ ...open, pressed: true });
      return;
    }
    setSaving(true);
    setTimeout(() => {
      setRows(
        rows.map((one) =>
          one.id === open.id
            ? corrected(one, open.draft, YOU, live ? LIVE_NOW : CORRECTED_AT)
            : one,
        ),
      );
      setSaving(false);
      setOpen(null);
      setToast(HW.saved(editing.name));
      readOut(HW.saved(editing.name));
    }, SAVE_MS);
  }

  let body;
  if (phase === 'loading')
    body = <Skeleton shape="rows" rowHeight={64} rows={6} words={HW.loading} />;
  else if (phase === 'failed')
    body = (
      <View style={styles.failed} testID="hours.failed">
        <Notice tone="broken" mark="!" body={HW.failed} answer={answer} />
        <SecondaryButton
          label={HW.tryAgain}
          onPress={() => {
            setAnswer((n) => n + 1);
            setPhase('loading');
          }}
          testID="hours.retry"
        />
      </View>
    );
  else if (rows.length === 0)
    body = (
      <View style={styles.empty} testID="hours.empty">
        <Text size={17} weight="semibold" accessibilityRole="header">
          {HW.empty}
        </Text>
        <Text size={15} style={styles.secondary}>
          {HW.emptyLine}
        </Text>
      </View>
    );
  else
    body = (
      <>
        <SummaryCard rows={rows} live={live} />
        {!manage && (
          <View style={styles.lock} testID="hours.readOnly">
            <Glyph name="lock" size={16} ink={tokens.colorInkSecondary} />
            <Text size={15} weight="medium" style={[styles.secondary, styles.shrink]}>
              {HW.readOnly}
            </Text>
          </View>
        )}
        <View style={styles.list} accessibilityRole="list">
          {rows.map((one) => (
            <HoursRowView
              key={one.id}
              one={one}
              live={live}
              phone={phone}
              manage={manage}
              onCorrect={(ref) => {
                opener.current = ref;
                setOpen({
                  id: one.id,
                  draft: draftOf(one, one, stillOnOf(one, live)),
                  pressed: false,
                });
              }}
            />
          ))}
        </View>
      </>
    );

  return (
    <View style={styles.page}>
      <ScrollView
        contentContainerStyle={[
          phone ? styles.bodyPhone : styles.bodyTablet,
          {
            paddingTop: insets.top + tokens.spaceSm,
            paddingBottom: insets.bottom + tokens.space3xl,
          },
        ]}
        testID={`hours.${state}`}
      >
        <View style={styles.column}>
          <QuietButton label="Back" onPress={goBack} testID="hours.back" />
          <Text size={tokens.typeTitlePhone.size} weight="bold" accessibilityRole="header">
            {HW.heading(EVENT)}
          </Text>
          {body}
          <DemoOnly title="Demo only: the board’s switches">
            <SecondaryButton
              label="The hours fail to load"
              onPress={() => setPhase('failed')}
              testID="hours.demo.fails"
            />
            <SecondaryButton
              label="Start again"
              onPress={() => {
                setRows(hoursStart(state).rows);
                setOpen(hoursStart(state).open);
                setPhase(state === 'loading' ? 'loading' : state === 'failed' ? 'failed' : 'ready');
              }}
              testID="hours.demo.reset"
            />
          </DemoOnly>
        </View>
      </ScrollView>
      <Sheet
        open={open != null}
        onClose={() => setOpen(null)}
        scrimLabel={HW.cancel}
        held={saving}
        opener={opener}
        docked
        testID="hours.correct"
      >
        {open != null && editing != null && (
          <CorrectForm
            one={editing}
            draft={open.draft}
            pressed={open.pressed}
            stillOn={stillOnOf(editing, live)}
            saving={saving}
            phone={phone}
            onDraft={(draft) => setOpen({ ...open, draft })}
            onSave={save}
            onCancel={() => setOpen(null)}
          />
        )}
      </Sheet>
      {toast != null && (
        <PageToast
          words={toast}
          onClose={() => setToast(null)}
          bottom={insets.bottom + tokens.spaceXl}
        />
      )}
    </View>
  );
}

function SummaryCard({ rows, live }: { rows: readonly HoursRow[]; live: boolean }) {
  if (live) {
    const on = rows.filter((one) => liveOf(one) === 'in').length;

    return (
      <View style={styles.card} testID="hours.summary">
        <Text size={14} weight="semibold" style={styles.secondary}>
          {HW.liveAt(clock(LIVE_NOW))}
        </Text>
        <Text size={20} weight="bold">
          {HW.liveSummary(on, rows.length)}
        </Text>
      </View>
    );
  }
  const lines = summaryLines(summaryOf(rows));

  return (
    <View style={styles.card} testID="hours.summary">
      <Text size={14} weight="semibold" style={styles.secondary}>
        {HW.worked}
      </Text>
      <Text size={20} weight="bold">
        {lines.head}
      </Text>
      {lines.rest != null && (
        <Text size={15} weight="medium" style={styles.secondary}>
          {lines.rest}
        </Text>
      )}
    </View>
  );
}

function MarkLine({ one, live }: { one: HoursRow; live: boolean }) {
  if (live) {
    const state = liveOf(one);

    return (
      <View style={styles.mark}>
        <ShapeMark
          kind={state === 'in' ? 'yes' : state === 'out' ? 'ended' : 'notyet'}
          side={14}
          ink={state === 'in' ? tokens.colorAccent : tokens.colorInkSecondary}
        />
        <Text size={14} weight="semibold" style={styles.shrink}>
          {state === 'in' ? HW.clockedIn : state === 'notYet' ? HW.notYet : HW.clockOut}
        </Text>
      </View>
    );
  }
  const words = markWords(one);
  if (words == null) return null;
  const notOut = one.clockIn != null;

  return (
    <View style={styles.mark}>
      <ShapeMark
        kind={notOut ? 'notyet' : 'ended'}
        side={14}
        ink={notOut ? tokens.colorAttention : tokens.colorInkSecondary}
      />
      <Text size={14} weight="semibold" style={[styles.shrink, notOut && styles.attention]}>
        {words}
      </Text>
    </View>
  );
}

function HoursRowView({
  one,
  live,
  phone,
  manage,
  onCorrect,
}: {
  one: HoursRow;
  live: boolean;
  phone: boolean;
  manage: boolean;
  onCorrect: (ref: ViewInstance | null) => void;
}) {
  const ref = useRef<ViewInstance | null>(null);
  const worked = workedOf(one, one);
  const scheduled = HW.range(one.start, one.end);
  const clocked = live ? liveWords(one) : clockedWords(one);
  const hours = live ? null : hoursWords(worked.minutes);
  const note = live && liveOf(one) === 'notYet' ? liveNote(one) : null;

  const facts = (
    <View style={phone ? styles.factsPhone : styles.factsTablet}>
      <Fact label={HW.scheduled} words={`${scheduled} · ${hoursWords(scheduledMinutes(one))}`} />
      <Fact label={HW.clocked} words={clocked} />
      {hours != null && <Fact label={HW.hours} words={hours} strong />}
    </View>
  );

  return (
    <View style={styles.row} accessibilityRole="none" testID={`hours.row.${one.id}`}>
      <View style={phone ? undefined : styles.rowTablet}>
        <View style={phone ? undefined : styles.who}>
          <Text size={17} weight="semibold">
            {one.name}
          </Text>
          {one.removed === true && (
            <View style={styles.mark} testID={`hours.removed.${one.id}`}>
              <Glyph name="user" size={14} ink={tokens.colorInkSecondary} />
              <Text size={14} weight="semibold" style={[styles.secondary, styles.shrink]}>
                {HW.removed}
              </Text>
            </View>
          )}
          <Text size={15} style={styles.secondary}>
            {one.job}
          </Text>
        </View>
        {facts}
      </View>
      {trailWords(one).map((line) => (
        <Text key={line} size={14} style={styles.secondary}>
          {line}
        </Text>
      ))}
      <MarkLine one={one} live={live} />
      {note != null && (
        <Text size={14} style={styles.secondary}>
          {note}
        </Text>
      )}
      {manage && (
        <View style={styles.correct}>
          <SecondaryButton
            ref={ref}
            label={HW.correct}
            onPress={() => onCorrect(ref.current)}
            accessibilityLabel={`${HW.correct}, ${one.name}`}
            testID={`hours.correct.${one.id}`}
          />
        </View>
      )}
    </View>
  );
}

function Fact({
  label,
  words,
  strong = false,
}: {
  label: string;
  words: string;
  strong?: boolean;
}) {
  return (
    <View style={styles.fact}>
      <Text size={13} weight="semibold" style={styles.secondary}>
        {label}
      </Text>
      <Text size={15} weight={strong ? 'bold' : 'medium'}>
        {words}
      </Text>
    </View>
  );
}

function CorrectForm({
  one,
  draft,
  pressed,
  stillOn,
  saving,
  phone,
  onDraft,
  onSave,
  onCancel,
}: {
  one: HoursRow;
  draft: TimesDraft;
  pressed: boolean;
  stillOn: boolean;
  saving: boolean;
  phone: boolean;
  onDraft: (draft: TimesDraft) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const [picking, setPicking] = useState<Picking | null>(null);
  const problem = pressed ? timesProblem(draft, stillOn) : null;
  const inLine = problem?.field === 'in' ? PROBLEM_WORDS[problem.problem ?? 'inBlank'] : null;
  const outLine = problem?.field === 'out' ? PROBLEM_WORDS[problem.problem ?? 'outBlank'] : null;
  const inBeside = one.clockIn == null ? HW.notRecorded : HW.recorded(clock(one.clockIn));
  const outBeside =
    one.clockOut != null
      ? HW.recorded(clock(one.clockOut))
      : stillOn
        ? HW.notRecorded
        : HW.notRecordedOut(clock(one.end));

  function dateBox(side: 'in' | 'out') {
    const field =
      side === 'in'
        ? { date: draft.inDate, time: draft.inTime }
        : { date: draft.outDate, time: draft.outTime };

    return (
      <MomentBox
        label={`${side === 'in' ? HW.clockIn : HW.clockOut}, ${HW.date}`}
        mode="date"
        value={field.date}
        locale={LOCALE}
        height={48}
        onPress={() =>
          pick(
            {
              title: HW.date,
              mode: 'date',
              field,
              take: (next) =>
                onDraft(
                  side === 'in'
                    ? { ...draft, inDate: next.date }
                    : { ...draft, outDate: next.date },
                ),
            },
            setPicking,
          )
        }
        testID={`hours.f.${side}Date`}
      />
    );
  }

  const go = (
    <PrimaryButton
      label={saving ? HW.saving : HW.save}
      busy={saving}
      onPress={onSave}
      paired={!phone}
      testID="hours.f.save"
    />
  );
  const cancel = (
    <QuietButton
      label={HW.cancel}
      onPress={onCancel}
      off={saving}
      inset={!phone}
      testID="hours.f.cancel"
    />
  );

  return (
    <View style={styles.form}>
      <Text size={tokens.typeTitleSection.size} weight="bold" accessibilityRole="header">
        {HW.correctTitle(one.name)}
      </Text>
      <Text size={15} style={styles.secondary}>
        {HW.correctSub(one.job, one.start, one.end)}
      </Text>
      <TimeGroup
        title={HW.clockIn}
        beside={inBeside}
        dateBox={dateBox('in')}
        time={draft.inTime}
        line={inLine}
        onTime={(inTime) => onDraft({ ...draft, inTime })}
        testID="hours.f.in"
      />
      <TimeGroup
        title={HW.clockOut}
        beside={outBeside}
        dateBox={dateBox('out')}
        time={draft.outTime}
        line={outLine}
        onTime={(outTime) => onDraft({ ...draft, outTime })}
        testID="hours.f.out"
      />
      <SheetActions>
        {phone ? (
          <>
            {go}
            {cancel}
          </>
        ) : (
          <>
            {cancel}
            {go}
          </>
        )}
      </SheetActions>
      {picking != null && (
        <PickerLayer picking={picking} locale={LOCALE} onClose={() => setPicking(null)} />
      )}
    </View>
  );
}

function TimeGroup({
  title,
  beside,
  dateBox,
  time,
  line,
  onTime,
  testID,
}: {
  title: string;
  beside: string;
  dateBox: ReactNode;
  time: string;
  line: string | null;
  onTime: (time: string) => void;
  testID: string;
}) {
  return (
    <View style={styles.group} testID={testID}>
      <View style={styles.groupHead}>
        <Text size={15} weight="bold" style={styles.shrink}>
          {title}
        </Text>
        <Text size={14} weight="medium" style={styles.secondary}>
          {beside}
        </Text>
      </View>
      <View style={styles.pair}>
        <View style={styles.half}>{dateBox}</View>
        <View style={styles.half}>
          <Field label={HW.time} help={HW.timeHelp} error={line}>
            <TextField
              value={time}
              onChangeText={onTime}
              wrong={line != null}
              keyboardType="numbers-and-punctuation"
              accessibilityLabel={HW.time}
              testID={`${testID}Time`}
            />
          </Field>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: tokens.colorPage },
  bodyPhone: { paddingHorizontal: tokens.spaceLg },
  bodyTablet: { paddingHorizontal: tokens.spaceXl, alignItems: 'center' },
  column: { width: '100%', maxWidth: 1040, gap: tokens.spaceLg },
  card: {
    gap: tokens.spaceXs,
    padding: tokens.spaceXl,
    borderRadius: tokens.radiusCardPhone,
    backgroundColor: tokens.colorCard,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
  },
  list: { gap: tokens.spaceSm },
  row: {
    gap: tokens.spaceSm,
    padding: tokens.spaceLg,
    borderRadius: tokens.radiusCardPhone,
    backgroundColor: tokens.colorCard,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
  },
  rowTablet: { flexDirection: 'row', gap: tokens.spaceLg, alignItems: 'flex-start' },
  who: { width: 200 },
  factsPhone: { gap: tokens.spaceSm, paddingTop: tokens.spaceSm },
  factsTablet: { flex: 1, flexDirection: 'row', gap: tokens.spaceLg },
  fact: { flex: 1, gap: tokens.spaceXxs },
  mark: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm },
  correct: { alignSelf: 'flex-start' },
  lock: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceSm },
  failed: { gap: tokens.spaceMd, alignItems: 'flex-start' },
  empty: {
    gap: tokens.spaceXxs,
    paddingVertical: 18,
    paddingHorizontal: tokens.spaceXxl,
    borderRadius: tokens.radiusCardLarge,
    backgroundColor: tokens.colorInset,
  },
  form: { flexShrink: 1, gap: tokens.spaceLg, padding: tokens.space3xl },
  group: { gap: tokens.spaceSm },
  groupHead: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: tokens.spaceSm,
  },
  pair: { flexDirection: 'row', gap: tokens.spaceMd, alignItems: 'flex-start' },
  half: { flex: 1 },
  secondary: { color: tokens.colorInkSecondary },
  attention: { color: tokens.colorAttentionText },
  shrink: { flexShrink: 1 },
});
