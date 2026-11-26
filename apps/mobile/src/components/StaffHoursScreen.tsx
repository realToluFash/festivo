import { ApiError, type HoursRow, type StaffHours } from '@soirely/api-client';
import { type ReactNode, type RefObject, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ScrollView,
  StyleSheet,
  type TextInputInstance,
  View,
  type ViewInstance,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '../api.ts';
import { dateLocale } from '../i18n/index.ts';
import { clockAt } from '../kit/myNight.ts';
import { hoursWords } from '../kit/shiftClock.ts';
import {
  type TimeProblem,
  type TimesDraft,
  clockedWords,
  draftOf,
  markWords,
  rangeWords,
  recordedHints,
  rowKey,
  rowOf,
  scheduledWords,
  summaryLines,
  timesProblem,
  trailWords,
  typedOf,
} from '../kit/staffHours.ts';
import { useLayout } from '../layout/useLayout.ts';
import { rereadOrganisations } from '../signedIn.ts';
import { tokens } from '../theme/tokens.ts';
import { PrimaryButton, QuietButton, SecondaryButton } from './Buttons.tsx';
import { Field, TextField } from './Field.tsx';
import { Glyph } from './Glyph.tsx';
import { MomentBox, PickerLayer, type Picking, pick } from './MomentPick.tsx';
import { Notice } from './Notice.tsx';
import { readOut } from './ReadOut.tsx';
import { Sheet, SheetActions } from './Sheet.tsx';
import { Skeleton } from './Skeleton.tsx';
import { ShapeMark } from './StatusMark.tsx';
import { PageToast } from './Summary.tsx';
import { Text } from './Text.tsx';

type Seen =
  { kind: 'loading' } | { kind: 'failed' } | { kind: 'shown'; event: string; hours: StaffHours };

type Open = {
  key: string;
  draft: TimesDraft;
  pressed: boolean;
  refused: { in?: string | undefined; out?: string | undefined };
};

const PROBLEM_KEYS: Record<TimeProblem, string> = {
  inBlank: 'staffHours.inBlank',
  outBlank: 'staffHours.outBlank',
  order: 'staffHours.order',
  long: 'staffHours.long',
};

/** An event's hours worked (sc-234), as /demo/staff-hours draws it: a row per person per shift, and Correct times for whoever manages staff. */
export function StaffHoursScreen({ eventId, onBack }: { eventId: string; onBack: () => void }) {
  const { t } = useTranslation();
  const [seen, setSeen] = useState<Seen>({ kind: 'loading' });
  const [round, setRound] = useState(0);
  const [answer, setAnswer] = useState(0);
  const [open, setOpen] = useState<Open | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const opener = useRef<ViewInstance | null>(null);
  const insets = useSafeAreaInsets();
  const { kind } = useLayout();
  const phone = kind === 'phone';
  const locale = dateLocale();

  useEffect(() => {
    let current = true;
    Promise.all([api.event(eventId), api.staffHours(eventId)]).then(
      ([event, hours]) => current && setSeen({ kind: 'shown', event: event.name, hours }),
      () => current && setSeen({ kind: 'failed' }),
    );

    return () => {
      current = false;
    };
  }, [eventId, round]);

  const hours = seen.kind === 'shown' ? seen.hours : null;
  const editing = open == null || hours == null ? undefined : rowOf(hours, open.key);

  function save(): void {
    if (open == null || editing == null || seen.kind !== 'shown') return;
    if (timesProblem(open.draft, editing.stillOn) != null) {
      setOpen({ ...open, pressed: true, refused: {} });
      return;
    }
    setSaving(true);
    api.correctStaffHours(eventId, editing.shiftId, editing.staffId, typedOf(open.draft)).then(
      (next) => {
        const words = t('staffHours.saved', { name: editing.name });
        setSeen({ ...seen, hours: next });
        setSaving(false);
        setOpen(null);
        setToast(words);
        readOut(words);
      },
      (error: unknown) => {
        setSaving(false);
        if (error instanceof ApiError && error.is('validation_failed')) {
          const named = error.fieldErrors();
          setOpen({
            ...open,
            pressed: false,
            refused: { in: named.clockedInAt, out: named.clockedOutAt },
          });
        }
      },
    );
  }

  let body;
  if (seen.kind === 'loading')
    body = <Skeleton shape="rows" rowHeight={64} rows={6} words={t('staffHours.loading')} />;
  else if (seen.kind === 'failed')
    body = (
      <View style={styles.failed} testID="hours.failed">
        <Notice tone="broken" mark="!" body={t('staffHours.failed')} answer={answer} />
        <SecondaryButton
          label={t('staffHours.tryAgain')}
          onPress={() => {
            void rereadOrganisations();
            setAnswer((n) => n + 1);
            setSeen({ kind: 'loading' });
            setRound((n) => n + 1);
          }}
          testID="hours.retry"
        />
      </View>
    );
  else if (seen.hours.rows.length === 0)
    body = (
      <View style={styles.empty} testID="hours.empty">
        <Text size={17} weight="semibold" accessibilityRole="header">
          {t('staffHours.empty')}
        </Text>
        <Text size={15} style={styles.secondary}>
          {t('staffHours.emptyLine')}
        </Text>
      </View>
    );
  else
    body = (
      <>
        <SummaryCard hours={seen.hours} />
        {!seen.hours.canCorrect && (
          <View style={styles.lock} testID="hours.readOnly">
            <Glyph name="lock" size={16} ink={tokens.colorInkSecondary} />
            <Text size={15} weight="medium" style={[styles.secondary, styles.shrink]}>
              {t('staffHours.readOnly')}
            </Text>
          </View>
        )}
        <View style={styles.list} accessibilityRole="list">
          {seen.hours.rows.map((one) => (
            <HoursRowView
              key={rowKey(one)}
              one={one}
              live={seen.hours.live}
              phone={phone}
              manage={seen.hours.canCorrect}
              onCorrect={(ref) => {
                opener.current = ref;
                setOpen({ key: rowKey(one), draft: draftOf(one), pressed: false, refused: {} });
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
        testID="hours.page"
      >
        <View style={styles.column}>
          <QuietButton label={t('staffHours.back')} onPress={onBack} testID="hours.back" />
          {seen.kind === 'shown' && (
            <Text size={tokens.typeTitlePhone.size} weight="bold" accessibilityRole="header">
              {t('staffHours.heading', { event: seen.event })}
            </Text>
          )}
          {body}
        </View>
      </ScrollView>
      <Sheet
        open={open != null && editing != null}
        onClose={() => setOpen(null)}
        scrimLabel={t('staffHours.cancel')}
        held={saving}
        opener={opener}
        docked
        testID="hours.correct"
      >
        {open != null && editing != null && (
          <CorrectForm
            one={editing}
            open={open}
            saving={saving}
            phone={phone}
            locale={locale}
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

function SummaryCard({ hours }: { hours: StaffHours }) {
  const { t } = useTranslation();

  if (hours.live)
    return (
      <View style={styles.card} testID="hours.summary">
        <Text size={14} weight="semibold" style={styles.secondary}>
          {t('staffHours.liveAt', { time: clockAt(hours.now, dateLocale()) })}
        </Text>
        <Text size={20} weight="bold">
          {t('staffHours.liveSummary', { on: hours.summary.clockedIn, all: hours.summary.total })}
        </Text>
      </View>
    );
  const lines = summaryLines(t, hours.summary);

  return (
    <View style={styles.card} testID="hours.summary">
      <Text size={14} weight="semibold" style={styles.secondary}>
        {t('staffHours.worked')}
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
  const { t } = useTranslation();

  if (live) {
    const on = one.live === 'in';
    const out = one.live === 'out';

    return (
      <View style={styles.mark}>
        <ShapeMark
          kind={on ? 'yes' : out ? 'ended' : 'notyet'}
          side={14}
          ink={on ? tokens.colorAccent : tokens.colorInkSecondary}
        />
        <Text size={14} weight="semibold" style={styles.shrink}>
          {on
            ? t('staffHours.clockedIn')
            : out
              ? t('staffHours.clockedOut')
              : t('staffHours.notYet')}
        </Text>
      </View>
    );
  }
  const words = markWords(t, one, dateLocale());
  if (words == null) return null;
  const notOut = one.mark === 'not_clocked_out';

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
  const { t } = useTranslation();
  const locale = dateLocale();
  const ref = useRef<ViewInstance | null>(null);
  const note =
    live && one.live === 'not_yet'
      ? t('staffHours.opensAt', { time: clockAt(one.opensAt, locale) })
      : null;

  return (
    <View style={styles.row} accessibilityRole="none" testID={`hours.row.${rowKey(one)}`}>
      <View style={phone ? undefined : styles.rowTablet}>
        <View style={phone ? undefined : styles.who}>
          <Text size={17} weight="semibold">
            {one.name}
          </Text>
          <Text size={15} style={styles.secondary}>
            {one.job}
          </Text>
        </View>
        <View style={phone ? styles.factsPhone : styles.factsTablet}>
          <Fact label={t('staffHours.scheduled')} words={scheduledWords(t, one, locale)} />
          <Fact label={t('staffHours.clocked')} words={clockedWords(t, one, live, locale)} />
          {!live && (
            <Fact label={t('staffHours.hours')} words={hoursWords(t, one.workedMinutes)} strong />
          )}
        </View>
      </View>
      {trailWords(t, one, locale).map((line) => (
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
            label={t('staffHours.correct')}
            onPress={() => onCorrect(ref.current)}
            accessibilityLabel={t('staffHours.correctLabel', { name: one.name })}
            testID={`hours.correct.${rowKey(one)}`}
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
  open,
  saving,
  phone,
  locale,
  onDraft,
  onSave,
  onCancel,
}: {
  one: HoursRow;
  open: Open;
  saving: boolean;
  phone: boolean;
  locale: string;
  onDraft: (draft: TimesDraft) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [first] = useState(open.draft);
  const [picking, setPicking] = useState<Picking | null>(null);
  const outField = useRef<TextInputInstance>(null);
  const { draft } = open;
  const problem = open.pressed ? timesProblem(draft, one.stillOn) : null;
  const words = (field: 'in' | 'out') =>
    problem?.field === field ? t(PROBLEM_KEYS[problem.problem]) : (open.refused[field] ?? null);
  const hints = recordedHints(t, one, locale);

  function dateBox(side: 'in' | 'out') {
    const field =
      side === 'in'
        ? { date: draft.inDate, time: draft.inTime }
        : { date: draft.outDate, time: draft.outTime };

    return (
      <MomentBox
        label={t('staffHours.dateLabel', {
          field: side === 'in' ? t('staffHours.clockIn') : t('staffHours.clockOut'),
        })}
        mode="date"
        value={field.date}
        locale={locale}
        height={48}
        onPress={() =>
          pick(
            {
              title: t('staffHours.date'),
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
      label={saving ? t('staffHours.saving') : t('staffHours.save')}
      busy={saving}
      onPress={onSave}
      paired={!phone}
      testID="hours.f.save"
    />
  );
  const cancel = (
    <QuietButton
      label={t('staffHours.cancel')}
      onPress={onCancel}
      off={saving}
      inset={!phone}
      testID="hours.f.cancel"
    />
  );

  return (
    <View style={styles.form}>
      <Text size={tokens.typeTitleSection.size} weight="bold" accessibilityRole="header">
        {t('staffHours.correctTitle', { name: one.name })}
      </Text>
      <Text size={15} style={styles.secondary}>
        {t('staffHours.correctSub', { job: one.job, range: rangeWords(t, one, locale) })}
      </Text>
      <TimeGroup
        title={t('staffHours.clockIn')}
        beside={hints.in}
        dateBox={dateBox('in')}
        first={first.inTime}
        line={words('in')}
        saving={saving}
        onTime={(inTime) => onDraft({ ...draft, inTime })}
        returnKeyType="next"
        onSubmit={() => outField.current?.focus()}
        testID="hours.f.in"
      />
      <TimeGroup
        title={t('staffHours.clockOut')}
        beside={hints.out}
        dateBox={dateBox('out')}
        first={first.outTime}
        line={words('out')}
        saving={saving}
        onTime={(outTime) => onDraft({ ...draft, outTime })}
        returnKeyType="done"
        onSubmit={onSave}
        fieldRef={outField}
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
        <PickerLayer picking={picking} locale={locale} onClose={() => setPicking(null)} />
      )}
    </View>
  );
}

function TimeGroup({
  title,
  beside,
  dateBox,
  first,
  line,
  saving,
  onTime,
  returnKeyType,
  onSubmit,
  fieldRef,
  testID,
}: {
  title: string;
  beside: string;
  dateBox: ReactNode;
  first: string;
  line: string | null;
  saving: boolean;
  onTime: (time: string) => void;
  returnKeyType: 'next' | 'done';
  onSubmit: () => void;
  fieldRef?: RefObject<TextInputInstance | null>;
  testID: string;
}) {
  const { t } = useTranslation();

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
          <Field label={t('staffHours.time')} help={t('staffHours.timeHelp')} error={line}>
            <TextField
              ref={fieldRef}
              defaultValue={first}
              onChangeText={onTime}
              wrong={line != null}
              submitting={saving}
              keyboardType="numbers-and-punctuation"
              autoCorrect={false}
              spellCheck={false}
              returnKeyType={returnKeyType}
              onSubmitEditing={onSubmit}
              accessibilityLabel={t('staffHours.time')}
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
