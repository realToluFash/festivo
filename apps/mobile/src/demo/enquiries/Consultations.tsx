import { formattingLocale, timezoneLabel } from '@soirely/domain';
import { getLocales } from 'expo-localization';
import { router } from 'expo-router';
import { type ReactNode, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AskLayer } from '../../components/AskLayer.tsx';
import { PrimaryButton, QuietButton, SecondaryButton } from '../../components/Buttons.tsx';
import { ConfettiSwitch } from '../../components/ConfettiSwitch.tsx';
import { Field, FieldError, TextField } from '../../components/Field.tsx';
import { SheetBody, SheetLayer } from '../../components/FormLayers.tsx';
import { Glyph } from '../../components/Glyph.tsx';
import { MomentBox, PickerLayer, type Picking, pick } from '../../components/MomentPick.tsx';
import { useShell } from '../../components/settingsShell.ts';
import { Card, CardHead } from '../../components/SettingsParts.tsx';
import { Text } from '../../components/Text.tsx';
import { DemoOnly } from '../../steps/Lines.tsx';
import { tokens } from '../../theme/tokens.ts';
import { TaskPage } from '../settings/Frame.tsx';
import {
  CW,
  type Consultation,
  type ConsultationStart,
  type ConsultationState,
  type Draft,
  HOWS,
  type How,
  LENGTHS,
  type Panel,
  READER_ZONE,
  type Save,
  cancelledByLost,
  changeable,
  consultationOf,
  consultationStart,
  dayWords,
  draftOf,
  fixedLeaderWords,
  earliestFirst,
  leaderOf,
  mayEdit,
  problemsOf,
  skipWords,
  standingOf,
  timesWords,
} from './ConsultationsModel.ts';
import { NOW, PEOPLE } from './EnquiriesModel.ts';

const SAVE_MS = 700;
const ZONES = [READER_ZONE, 'Europe/Madrid', 'Europe/Paris', 'Africa/Lagos', 'America/New_York'];
const HOW_GLYPH: Record<How, 'pin' | 'device' | 'phone'> = {
  inPerson: 'pin',
  video: 'device',
  phone: 'phone',
};

function useLocale(): string {
  return formattingLocale('en', getLocales()[0]?.languageTag);
}

/** /demo/consultations (sc-31228): Consultations on an enquiry's page, its Book and Cancel, and where they show elsewhere. */
export function Consultations({ state }: { state: ConsultationState }) {
  const start = consultationStart(state);

  if (start.view === 'calendar') return <CalendarStrip start={start} />;
  if (start.view === 'notifications') return <EnquiriesCategory />;
  if (start.view === 'feed') return <WhatsInTheFeed />;

  return <EnquiryWithConsultations start={start} />;
}

function EnquiryWithConsultations({ start }: { start: ConsultationStart }) {
  const shell = useShell();
  const locale = useLocale();
  const [list, setList] = useState<Consultation[]>(start.list);
  const [panel, setPanel] = useState<Panel>(start.panel);
  const [save, setSave] = useState<Save>(start.save);
  const [lost, setLost] = useState(false);
  const failOnce = useRef(start.save === 'failed');
  const edits = mayEdit(start.enquiry, start.viewer) && !lost;
  const manages = start.viewer.role !== 'member';
  const assignee = Object.values(PEOPLE).find((one) => one.id === start.enquiry.assignedTo);
  const docked = shell.layout === 'landscape' && panel.kind === 'book';

  const finish = (after: () => void) => {
    setSave('saving');
    setTimeout(() => {
      if (failOnce.current) {
        failOnce.current = false;
        setSave('failed');

        return;
      }
      setSave('idle');
      after();
    }, SAVE_MS);
  };
  const open = (change: Consultation | null) => {
    setSave('idle');
    setPanel({
      kind: 'book',
      change,
      draft: draftOf(change, start.enquiry, start.viewer),
      touched: false,
      pressed: false,
    });
  };
  const book = (draft: Draft, change: Consultation | null) => {
    const made = consultationOf(draft, change?.id ?? `con-${Date.now()}`);

    if (made == null) return;
    finish(() => {
      setList((now) =>
        change == null ? [...now, made] : now.map((one) => (one.id === change.id ? made : one)),
      );
      setPanel({ kind: 'none' });
      shell.tell(change == null ? CW.booked : CW.changed);
    });
  };
  const close = () => setPanel({ kind: 'none' });
  const form =
    panel.kind === 'book' ? (
      <BookForm
        key={panel.change?.id ?? 'new'}
        panel={panel}
        start={start}
        save={save}
        onClose={close}
        onBook={book}
      />
    ) : null;

  return (
    <View style={styles.fill}>
      <View style={styles.split}>
        <View style={styles.fill}>
          <TaskPage
            back={{ label: 'Enquiries', onPress: () => router.back() }}
            title={start.enquiry.client}
            sub={lost ? 'Lost' : 'Open'}
          >
            {!mayEdit(start.enquiry, start.viewer) && (
              <View style={styles.readOnly}>
                <Glyph name="eye" size={18} ink={tokens.colorInk} weight={2.2} />
                <Text size={15} weight="medium" style={styles.grow}>
                  {assignee == null ? CW.readOnlyNobody : CW.readOnly(assignee.name)}
                </Text>
              </View>
            )}
            <Card>
              <CardHead
                title={CW.consultations}
                right={list.length > 0 ? <Count n={list.length} /> : undefined}
              />
              {list.length === 0 ? (
                <View style={styles.none}>
                  <Text size={16} weight="semibold">
                    {CW.none}
                  </Text>
                  <Text size={15} weight="medium" style={styles.secondary}>
                    {CW.noneLine}
                  </Text>
                </View>
              ) : (
                earliestFirst(list).map((one, index) => (
                  <ConsultationRow
                    key={one.id}
                    consultation={one}
                    list={list}
                    first={index === 0}
                    locale={locale}
                    edits={edits}
                    manages={manages}
                    onChange={() => open(one)}
                    onCancel={() => setPanel({ kind: 'cancel', consultation: one })}
                  />
                ))
              )}
              {edits && (
                <SecondaryButton
                  label={CW.book}
                  onPress={() => open(null)}
                  testID="consultations.book"
                />
              )}
            </Card>
            {edits && (
              <SecondaryButton
                label="Close as lost…"
                onPress={() => setPanel({ kind: 'closeLost' })}
                testID="consultations.closeLost"
              />
            )}
            <DemoOnly title={CW.demoPage}>{null}</DemoOnly>
          </TaskPage>
        </View>
        {docked && <View style={styles.dock}>{form}</View>}
      </View>
      {!docked && panel.kind === 'book' && (
        <SheetLayer onClose={close} label={CW.cancel}>
          {form}
        </SheetLayer>
      )}
      {panel.kind === 'cancel' && (
        <AskLayer
          title={CW.cancelTitle}
          line={CW.cancelLine(
            dayWords(panel.consultation, locale),
            timesWords(panel.consultation, locale),
          )}
          keep={{ label: CW.keepIt, off: save === 'saving', testID: 'consultations.keep' }}
          confirm={{
            label: CW.cancelIt,
            removes: true,
            busy: save === 'saving' ? CW.saving : undefined,
            busyWords: CW.saving,
            testID: 'consultations.cancelIt',
          }}
          failed={save === 'failed' ? CW.notCancelled : null}
          onKeep={close}
          onConfirm={() =>
            finish(() => {
              setList((now) =>
                now.map((one) =>
                  one.id === panel.consultation.id ? { ...one, cancelled: true } : one,
                ),
              );
              close();
              shell.tell(CW.cancelledSaid);
            })
          }
          testID="consultations.cancelAsk"
        />
      )}
      {panel.kind === 'closeLost' && (
        <AskLayer
          title="Close this enquiry as lost?"
          line={
            cancelledByLost(list) > 0
              ? `It moves to Lost. ${CW.closeLostCancels(cancelledByLost(list))}`
              : 'It moves to Lost.'
          }
          keep={{ label: 'Keep it open', testID: 'consultations.keepOpen' }}
          confirm={{ label: 'Close as lost', removes: true, testID: 'consultations.lostIt' }}
          onKeep={close}
          onConfirm={() => {
            setList((now) =>
              now.map((one) => (changeable(one) ? { ...one, cancelled: true } : one)),
            );
            setLost(true);
            close();
          }}
          testID="consultations.lostAsk"
        />
      )}
    </View>
  );
}

function Count({ n }: { n: number }) {
  return (
    <View style={styles.count}>
      <Text size={13} weight="semibold" style={styles.secondary}>
        {String(n)}
      </Text>
    </View>
  );
}

export function ConsultationRow({
  consultation,
  list,
  first,
  locale,
  edits,
  manages,
  onChange,
  onCancel,
  now = NOW,
  tell = null,
}: {
  consultation: Consultation;
  list: readonly Consultation[];
  first: boolean;
  locale: string;
  edits: boolean;
  manages: boolean;
  onChange: () => void;
  onCancel: () => void;
  now?: string;
  /** sc-37133's Tell {client}, which shows whether or not this viewer edits. */
  tell?: ReactNode;
}) {
  const standing = standingOf(consultation, list, now);
  const leader = leaderOf(consultation);
  const quiet = standing === 'cancelled';
  const goes = edits && changeable(consultation, now);

  return (
    <View style={[styles.row, !first && styles.rule]}>
      <View style={styles.rowTop}>
        <View style={styles.grow}>
          <Text size={16} weight="semibold" style={quiet && styles.secondary}>
            {dayWords(consultation, locale)}
          </Text>
          <Text size={16} weight="semibold" style={[styles.figures, quiet && styles.struck]}>
            {timesWords(consultation, locale)}
          </Text>
        </View>
        {standing !== 'booked' && <StandingTag standing={standing} />}
      </View>
      <View style={styles.inline}>
        <Glyph name={HOW_GLYPH[consultation.how]} size={17} ink={tokens.colorInk} weight={2.2} />
        <Text size={15} weight="medium" style={quiet && styles.secondary}>
          {CW.how[consultation.how]}
        </Text>
      </View>
      {consultation.where != null && (
        <Text size={15} weight="medium" style={styles.secondary}>
          {consultation.where}
        </Text>
      )}
      {consultation.link != null && (
        <Text size={15} weight="semibold" style={styles.accent}>
          {consultation.link.replace(/^https:\/\//u, '')}
        </Text>
      )}
      {leader != null ? (
        <Text size={15} weight="medium" style={styles.secondary}>
          {CW.ledBy(leader.name)}
        </Text>
      ) : (
        manages && (
          <View style={styles.inline}>
            <Glyph name="warn" size={17} ink={tokens.colorAttentionText} weight={2.4} />
            <Text size={15} weight="medium" style={[styles.grow, styles.attention]}>
              {`${CW.nobodyLeading} · ${CW.nobodyLine}`}
            </Text>
          </View>
        )
      )}
      {goes && (
        <View style={styles.acts}>
          <QuietButton
            label={CW.change}
            onPress={onChange}
            testID={`consultations.change.${consultation.id}`}
          />
          <SecondaryButton
            label={CW.cancelConsultation}
            onPress={onCancel}
            testID={`consultations.cancel.${consultation.id}`}
          />
        </View>
      )}
      {tell}
    </View>
  );
}

function StandingTag({ standing }: { standing: 'next' | 'held' | 'cancelled' }) {
  const next = standing === 'next';

  return (
    <View style={[styles.tag, next && styles.tagNext]}>
      {standing === 'next' ? (
        <View style={styles.dot} />
      ) : standing === 'held' ? (
        <Glyph name="tick" size={13} ink={tokens.colorInk} weight={3} />
      ) : (
        <Glyph name="x" size={13} ink={tokens.colorInk} weight={3} />
      )}
      <Text size={13} weight="semibold" style={next ? styles.accent : undefined}>
        {CW[standing]}
      </Text>
    </View>
  );
}

export function BookForm({
  panel,
  start,
  save,
  onClose,
  onBook,
  now = NOW,
}: {
  panel: Extract<Panel, { kind: 'book' }>;
  start: Pick<ConsultationStart, 'enquiry' | 'viewer'>;
  save: Save;
  onClose: () => void;
  onBook: (draft: Draft, change: Consultation | null) => void;
  now?: string;
}) {
  const locale = useLocale();
  const [draft, setDraft] = useState<Draft>(panel.draft);
  const [touched, setTouched] = useState(panel.touched);
  const [pressed, setPressed] = useState(panel.pressed);
  const [picking, setPicking] = useState<Picking | null>(null);
  const member = start.viewer.role === 'member';
  const problems = pressed ? problemsOf(draft, touched, now, !member) : {};
  const skip = skipWords(draft, locale);
  const change = panel.change;

  const set = (patch: Partial<Draft>, moves = false) => {
    setDraft((now) => ({ ...now, ...patch }));
    if (moves) setTouched(true);
  };
  const press = () => {
    setPressed(true);
    if (Object.keys(problemsOf(draft, touched, now, !member)).length === 0) onBook(draft, change);
  };
  const moment = (mode: 'date' | 'time') =>
    pick(
      {
        title: mode === 'date' ? CW.date : CW.startTime,
        mode,
        field: { date: draft.date, time: draft.time },
        take: (next) => set(next, true),
      },
      setPicking,
    );

  return (
    <View style={styles.fill}>
      <SheetBody
        title={change == null ? CW.bookTitle : CW.changeTitle}
        close={CW.cancel}
        onClose={onClose}
        closeTestID="consultations.form.close"
      >
        <Text size={15} weight="medium" style={styles.secondary}>
          {start.enquiry.client}
        </Text>
        {save === 'failed' && <FieldError message={change == null ? CW.notBooked : CW.notSaved} />}
        <View style={styles.pair}>
          <View style={styles.grow}>
            <Field label={CW.date} error={problems.date}>
              <MomentBox
                label={CW.date}
                mode="date"
                value={draft.date}
                locale={locale}
                wrong={problems.date != null}
                line={problems.date ?? null}
                onPress={() => moment('date')}
                testID="consultations.form.date"
              />
            </Field>
          </View>
          <View style={styles.grow}>
            <Field label={CW.startTime} error={problems.time}>
              <MomentBox
                label={CW.startTime}
                mode="time"
                value={draft.time}
                locale={locale}
                wrong={problems.time != null}
                line={problems.time ?? null}
                onPress={() => moment('time')}
                testID="consultations.form.time"
              />
            </Field>
          </View>
        </View>
        {skip != null && problems.time == null && (
          <View style={styles.skip}>
            <Glyph name="info" size={17} ink={tokens.colorInk} weight={2.2} />
            <Text size={15} weight="medium" style={styles.grow}>
              {skip}
            </Text>
          </View>
        )}
        <Field label={CW.length}>
          <Chips
            items={LENGTHS.map((one) => ({ key: String(one), title: CW.lengths[one] }))}
            on={String(draft.minutes)}
            onPick={(key) => set({ minutes: LENGTHS.find((one) => String(one) === key) ?? 60 })}
            testID="consultations.form.length"
          />
        </Field>
        <Field label={CW.timeZone}>
          <Chips
            items={ZONES.map((zone) => ({ key: zone, title: timezoneLabel(zone) }))}
            on={draft.timeZone}
            onPick={(timeZone) => set({ timeZone }, true)}
            testID="consultations.form.zone"
          />
        </Field>
        <Field label={CW.howLabel}>
          <Chips
            items={HOWS.map((how) => ({ key: how, title: CW.how[how], glyph: HOW_GLYPH[how] }))}
            on={draft.how}
            onPick={(how) => set({ how: HOWS.find((one) => one === how) ?? 'inPerson' })}
            testID="consultations.form.how"
          />
        </Field>
        {draft.how === 'inPerson' && (
          <Field
            label={CW.where}
            pill={CW.optional}
            error={problems.where}
            help={CW.count([...draft.where].length)}
          >
            <TextField
              accessibilityLabel={CW.where}
              value={draft.where}
              onChangeText={(where) => set({ where })}
              multiline
              wrong={problems.where != null}
              testID="consultations.form.where"
            />
          </Field>
        )}
        {draft.how === 'video' && (
          <Field label={CW.link} pill={CW.optional} error={problems.link} help={CW.linkHint}>
            <TextField
              accessibilityLabel={CW.link}
              value={draft.link}
              onChangeText={(link) => set({ link })}
              keyboardType="url"
              autoCapitalize="none"
              placeholder="https://"
              wrong={problems.link != null}
              testID="consultations.form.link"
            />
          </Field>
        )}
        {draft.how === 'phone' && (
          <Text size={15} weight="medium" style={styles.secondary}>
            {CW.phoneNothing}
          </Text>
        )}
        {member ? (
          <Field
            label={CW.ledByLabel}
            help={change == null ? CW.ledByMemberLine : CW.ledByKeptLine}
          >
            <Text size={16} weight="semibold">
              {fixedLeaderWords(draft, start.viewer)}
            </Text>
          </Field>
        ) : (
          <Field label={CW.ledByLabel} error={problems.ledBy}>
            <Chips
              items={Object.values(PEOPLE).map((one) => ({ key: one.id, title: one.name }))}
              on={draft.ledBy}
              onPick={(ledBy) => set({ ledBy })}
              testID="consultations.form.ledBy"
            />
          </Field>
        )}
        <PrimaryButton
          label={
            save === 'saving'
              ? change == null
                ? CW.booking
                : CW.saving
              : save === 'failed'
                ? CW.tryAgain
                : change == null
                  ? CW.bookIt
                  : CW.saveChanges
          }
          busy={save === 'saving'}
          onPress={press}
          testID="consultations.form.go"
        />
      </SheetBody>
      {picking != null && (
        <PickerLayer picking={picking} locale={locale} onClose={() => setPicking(null)} />
      )}
    </View>
  );
}

export function Chips<Key extends string>({
  items,
  on,
  onPick,
  testID,
}: {
  items: readonly { key: Key; title: string; glyph?: 'pin' | 'device' | 'phone' }[];
  on: Key | null;
  onPick: (key: Key) => void;
  testID: string;
}) {
  return (
    <View style={styles.chips} accessibilityRole="radiogroup">
      {items.map((one) => {
        const lit = one.key === on;

        return (
          <Pressable
            key={one.key}
            onPress={() => onPick(one.key)}
            style={[styles.chip, lit && styles.chipOn]}
            accessibilityRole="radio"
            accessibilityState={{ checked: lit }}
            testID={`${testID}.${one.key}`}
          >
            {lit && <Glyph name="tick" size={14} ink={tokens.colorAccentText} weight={2.8} />}
            {one.glyph != null && (
              <Glyph
                name={one.glyph}
                size={16}
                ink={lit ? tokens.colorAccentText : tokens.colorInk}
                weight={2.2}
              />
            )}
            <Text size={15} weight="semibold" style={lit ? styles.accent : undefined}>
              {one.title}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

interface Line {
  day: string;
  kind: 'event' | 'milestone' | 'consultation';
  time: string;
  title: string;
}

const WEEK: readonly Line[] = [
  { day: 'Thu, Nov 5', kind: 'event', time: '18:00', title: 'Adaeze & Tunde’s wedding' },
  { day: 'Sat, Nov 7', kind: 'milestone', time: '15:00', title: 'Adaeze & Tunde’s wedding ends' },
  { day: 'Fri, Nov 13', kind: 'event', time: '19:00', title: 'Ireti at 40' },
  {
    day: 'Sat, Nov 14',
    kind: 'event',
    time: '19:30 Europe/Madrid',
    title: 'Gala Fundación Lucía',
  },
  {
    day: 'Thu, Nov 19',
    kind: 'consultation',
    time: '14:30',
    title: CW.calendarLine('Lucía Fernández'),
  },
  {
    day: 'Tue, Nov 24',
    kind: 'consultation',
    time: '11:00',
    title: CW.calendarLine('Lucía Fernández'),
  },
];

const KIND_WORD = { event: 'Event', milestone: 'Milestone', consultation: CW.calendarWord };

function Page({ title, children }: { title: string; children: ReactNode }) {
  return (
    <TaskPage back={{ label: 'Back', onPress: () => router.back() }} title={title}>
      {children}
    </TaskPage>
  );
}

function CalendarStrip({ start }: { start: ConsultationStart }) {
  const [view, setView] = useState(start.calendar.view);
  const [show, setShow] = useState(start.calendar.show);
  const lines = WEEK.filter(
    (line) =>
      (show === 'all' || line.kind === 'event') &&
      !(start.calendar.free && line.kind === 'consultation'),
  );

  return (
    <Page title="Calendar">
      <Chips
        items={[
          { key: 'month', title: 'Month' },
          { key: 'agenda', title: 'Agenda' },
        ]}
        on={view}
        onPick={(key) => setView(key === 'agenda' ? 'agenda' : 'month')}
        testID="consultations.calendar.view"
      />
      <Chips
        items={[
          { key: 'all', title: 'Events and milestones' },
          { key: 'events', title: 'Events only' },
        ]}
        on={show}
        onPick={(key) => setShow(key === 'events' ? 'events' : 'all')}
        testID="consultations.calendar.show"
      />
      <Card gap={0}>
        {lines.map((line, index) => (
          <Pressable
            key={line.title + line.day}
            onPress={() =>
              line.kind === 'consultation'
                ? router.push('/demo/consultations?state=upcoming')
                : router.push('/demo/calendar')
            }
            style={[styles.calRow, index > 0 && styles.rule]}
            accessibilityRole="link"
            accessibilityLabel={`${line.day}, ${line.time}, ${line.title}, ${KIND_WORD[line.kind]}`}
            testID={`consultations.calendar.${index}`}
          >
            <Shape kind={line.kind} />
            <View style={styles.grow}>
              {view === 'agenda' && (
                <Text size={13} weight="semibold" style={styles.secondary}>
                  {line.day}
                </Text>
              )}
              <Text size={16} weight="semibold">
                {line.title}
              </Text>
              <Text size={14} weight="medium" style={[styles.secondary, styles.figures]}>
                {view === 'month' ? `${line.day} · ${line.time}` : line.time}
              </Text>
            </View>
            <View style={styles.tag}>
              <Shape kind={line.kind} small />
              <Text size={13} weight="semibold">
                {KIND_WORD[line.kind]}
              </Text>
            </View>
          </Pressable>
        ))}
      </Card>
      <DemoOnly
        title={
          start.calendar.free
            ? 'A Free organisation’s Calendar shows no consultations: the events and the milestone stay.'
            : 'Month and Agenda are the product’s Calendar, which a demo may not change: this list shows the line its third kind adds. A cancelled consultation is not on it.'
        }
      >
        {null}
      </DemoOnly>
    </Page>
  );
}

function Shape({ kind, small = false }: { kind: Line['kind']; small?: boolean }) {
  const side = small ? 13 : 18;

  if (kind === 'consultation')
    return <Glyph name="users" size={side} ink={tokens.colorAccentText} weight={2.4} />;

  return (
    <View
      style={[
        kind === 'event' ? styles.eventShape : styles.milestoneShape,
        { width: kind === 'event' ? 4 : side - 4, height: side - 2 },
      ]}
    />
  );
}

function EnquiriesCategory() {
  const [push, setPush] = useState(true);
  const [email, setEmail] = useState(true);

  return (
    <Page title="Notification settings">
      <Card>
        <CardHead title={CW.enquiriesCategory} line={CW.enquiriesNote} />
        <ConfettiSwitch on={push} label="Push" onChange={setPush} testID="consultations.push" />
        <ConfettiSwitch on={email} label="Email" onChange={setEmail} testID="consultations.email" />
        <View style={styles.copy}>
          <Text size={13} weight="semibold" style={styles.secondary}>
            What it sends, as [l10n] will word it
          </Text>
          <Text size={15} weight="medium">
            {CW.given('Folake Adeyemi', 'Lucía Fernández', 'Thursday, Nov 19, 14:30')}
          </Text>
          <Text size={15} weight="medium">
            {CW.moved('Folake Adeyemi', 'Lucía Fernández', 'Friday, Nov 20, 10:00')}
          </Text>
          <Text size={15} weight="medium">
            {CW.cancelledBy('Folake Adeyemi', 'Lucía Fernández', 'Thursday, Nov 19, 14:30')}
          </Text>
          <Text size={15} weight="medium">
            {CW.reminder('Lucía Fernández', '14:30')}
          </Text>
        </View>
      </Card>
      <DemoOnly title="The six categories on main are the product’s (Settings › Notifications); Enquiries joins them after Event changes, on for push and email.">
        {null}
      </DemoOnly>
    </Page>
  );
}

function WhatsInTheFeed() {
  const lines = [
    'Each event’s name and status word',
    'Its start and end, in its own time zone',
    'The venue line',
    'Milestone titles, with a link back to Soirely',
  ];

  return (
    <Page title="Subscribe in your calendar app">
      <Card>
        <CardHead title="What’s in it" />
        {[...lines, CW.feedLine].map((line) => (
          <View key={line} style={styles.inline}>
            <Glyph name="tick" size={16} ink={tokens.colorInk} weight={2.6} />
            <Text
              size={15}
              weight={line === CW.feedLine ? 'semibold' : 'medium'}
              style={styles.grow}
            >
              {line}
            </Text>
          </View>
        ))}
      </Card>
      <Card>
        <CardHead title="Never in it" />
        {['Guest names', CW.feedNever, 'Contact details', 'Dietary notes', 'Amounts of money'].map(
          (line) => (
            <View key={line} style={styles.inline}>
              <Glyph name="x" size={16} ink={tokens.colorInk} weight={2.4} />
              <Text
                size={15}
                weight={line === CW.feedNever ? 'semibold' : 'medium'}
                style={styles.grow}
              >
                {line}
              </Text>
            </View>
          ),
        )}
      </Card>
      <DemoOnly title="The sheet is the product’s CalendarSubscribe; the demo shows its list with the line this story adds.">
        {null}
      </DemoOnly>
    </Page>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  grow: { flex: 1, minWidth: 0 },
  split: { flex: 1, flexDirection: 'row' },
  dock: {
    width: 400,
    borderLeftWidth: 1,
    borderLeftColor: tokens.colorBorder,
    backgroundColor: tokens.colorCard,
  },
  secondary: { color: tokens.colorInkSecondary },
  accent: { color: tokens.colorAccentText },
  attention: { color: tokens.colorAttentionText },
  figures: { fontVariant: ['tabular-nums'] },
  struck: { color: tokens.colorInkSecondary, textDecorationLine: 'line-through' },
  readOnly: {
    flexDirection: 'row',
    gap: tokens.spaceSm,
    padding: tokens.spaceLg,
    borderRadius: tokens.radiusRow,
    backgroundColor: tokens.colorNeutralFill,
  },
  count: {
    paddingHorizontal: tokens.spaceSm,
    paddingVertical: 2,
    borderRadius: tokens.radiusPill,
    backgroundColor: tokens.colorNeutralFill,
  },
  none: { gap: 4 },
  row: { gap: 6, paddingVertical: tokens.spaceMd },
  rule: { borderTopWidth: 1, borderTopColor: tokens.colorBorder },
  rowTop: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceMd },
  inline: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm },
  acts: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: tokens.spaceMd },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: tokens.radiusPill,
    backgroundColor: tokens.colorNeutralFill,
  },
  tagNext: { backgroundColor: tokens.colorAccentTint },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: tokens.colorAccent },
  pair: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spaceMd },
  skip: {
    flexDirection: 'row',
    gap: tokens.spaceSm,
    padding: tokens.spaceMd,
    borderRadius: tokens.radiusRow,
    backgroundColor: tokens.colorAttentionTint,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spaceSm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: tokens.sizeHit,
    paddingHorizontal: tokens.spaceLg,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
    borderRadius: tokens.radiusPill,
    backgroundColor: tokens.colorCard,
  },
  chipOn: { borderColor: tokens.colorAccent, backgroundColor: tokens.colorAccentTint },
  calRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceMd,
    minHeight: tokens.sizeHit,
    paddingVertical: tokens.spaceMd,
  },
  eventShape: { borderRadius: 2, backgroundColor: tokens.colorInk },
  milestoneShape: { borderRadius: 3, borderWidth: 2, borderColor: tokens.colorInk },
  copy: {
    gap: 4,
    padding: tokens.spaceMd,
    borderRadius: tokens.radiusRow,
    backgroundColor: tokens.colorNeutralFill,
  },
});
