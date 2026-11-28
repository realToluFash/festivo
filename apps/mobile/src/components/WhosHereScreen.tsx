import { ApiError, type WhosHere, type WhosHereRow, realtimeTopic } from '@soirely/api-client';
import { countryChoices, formatPhone } from '@soirely/domain';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { type ReactNode, type Ref, type RefObject, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  type TextInputInstance,
  View,
  type ViewInstance,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '../api.ts';
import { followReadingAgain } from '../followTopic.ts';
import { currentLocale, dateLocale } from '../i18n/index.ts';
import { clockAt } from '../kit/myNight.ts';
import {
  type DoorDraft,
  type DoorProblems,
  blankDoor,
  clockedInWords,
  coverCandidates,
  doorLabel,
  doorProblems,
  dueBy,
  firstProblem,
  jobLine,
  leavesEmpty,
  movedWords,
  newlyIn,
  numberProblem,
  rowLine,
  shiftLine,
} from '../kit/whosHere.ts';
import { useLayout } from '../layout/useLayout.ts';
import { tokens } from '../theme/tokens.ts';
import { PrimaryButton, QuietButton, SecondaryButton } from './Buttons.tsx';
import { CountryPicker } from './CountryPicker.tsx';
import { Field, focusChecked, TextField } from './Field.tsx';
import { Notice } from './Notice.tsx';
import { readOut } from './ReadOut.tsx';
import { SETTLED_MS } from './Screen.tsx';
import { Sheet, SheetActions, SheetScrollView } from './Sheet.tsx';
import { Skeleton } from './Skeleton.tsx';
import { PageToast } from './Summary.tsx';
import { Text } from './Text.tsx';
import { moveScreenReaderFocus } from './screenReaderFocus.ts';
import { Chip, CloseX, MarkLine, PersonRow, StationTile } from './whosHere/WhosHereParts.tsx';

/** Under the AC's ten seconds from a clock-in, while no line to the hub is open. */
const READ_AGAIN_MS = 5_000;
/** Under the 60 seconds from the event's scheduled end, which nothing publishes (sc-3918). */
const READ_WHILE_LIVE_MS = 30_000;

type Seen =
  | { kind: 'loading' }
  | { kind: 'unreachable' }
  | { kind: 'notFound' }
  | { kind: 'shown'; read: WhosHere };

interface DoorSheet {
  kind: 'door';
  draft: DoorDraft;
  tried: boolean;
  busy: boolean;
  failed: boolean;
  refused: boolean;
  refusedFields: { [K in keyof DoorProblems]?: string | undefined };
}

interface MobileSheet {
  kind: 'mobile';
  id: string;
  name: string;
  country: string;
  number: string;
  tried: boolean;
  busy: boolean;
  refusal: string | null;
  failed: boolean;
}

type Open =
  | DoorSheet
  | {
      kind: 'cover';
      absent: string;
      chosen: string | null;
      tried: boolean;
      busy: boolean;
      failed: boolean;
    }
  | { kind: 'noLink'; id: string; name: string }
  | { kind: 'hasLink'; id: string; name: string; phone: string; url: string; again: boolean }
  | MobileSheet;

type Refs = RefObject<Map<string, ViewInstance>>;

const countryName = (code: string): string =>
  countryChoices(currentLocale()).find((one) => one.code === code)?.name ?? code;

/** An event's Who's here (sc-3918), as /demo/whos-here draws it: who has not clocked in yet, who is here, and the floor lead's ways to cover a station and add someone at the door. */
export function WhosHereScreen({
  eventId,
  eventName: named = '',
  onBack,
}: {
  eventId: string;
  /** The name the screen that opened this one holds, shown until the event's own read answers. */
  eventName?: string;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { kind } = useLayout();
  const locale = dateLocale();
  const phone = kind === 'phone';
  const wide = kind === 'tabletLandscape';
  const [seen, setSeen] = useState<Seen>({ kind: 'loading' });
  const [eventName, setEventName] = useState(named);
  const [readsStaff, setReadsStaff] = useState(false);
  const [stale, setStale] = useState(false);
  const [lastAt, setLastAt] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  const [sheet, setSheet] = useState<Open | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [endedHere, setEndedHere] = useState(false);
  const [concluded, setConcluded] = useState(false);
  const latest = useRef<WhosHere | null>(null);
  const ticket = useRef(0);
  const refs = useRef(new Map<string, ViewInstance>());
  const opener = useRef<ViewInstance | null>(null);
  const backTo = useRef<string>('door');

  function shown(next: WhosHere): void {
    const arrived = newlyIn(latest.current, next).map((row) => clockedInWords(t, row, locale));
    latest.current = next;
    setSeen({ kind: 'shown', read: next });
    setStale(false);
    setLastAt(next.now);
    if (arrived.length > 0) setToast(arrived.join(' '));
  }

  function read(): void {
    const mine = ++ticket.current;
    api.whosHere(eventId).then(
      (next) => {
        if (mine === ticket.current) shown(next);
      },
      (error: unknown) => {
        if (mine !== ticket.current) return;
        if (error instanceof ApiError && error.is('event_concluded')) setConcluded(true);
        else if (latest.current != null) setStale(true);
        else if (error instanceof ApiError && (error.status === 403 || error.status === 404))
          setSeen({ kind: 'notFound' });
        else setSeen({ kind: 'unreachable' });
      },
    );
  }

  const reader = useRef(read);
  useEffect(() => {
    reader.current = read;
  });

  useEffect(() => {
    let current = true;
    api.event(eventId).then(
      (event) => {
        if (!current) return;
        setEventName(event.name);
        setReadsStaff(event.permissions.includes('staff.read'));
      },
      () => undefined,
    );
    reader.current();

    const stop = followReadingAgain(
      realtimeTopic('EventWhosHere', eventId),
      () => api.whosHereSubscription(eventId),
      () => reader.current(),
      READ_AGAIN_MS,
      READ_WHILE_LIVE_MS,
    );

    return () => {
      current = false;
      stop();
    };
  }, [eventId, round]);

  const leave = useRef(onBack);
  useEffect(() => {
    leave.current = onBack;
  });

  useEffect(() => {
    if (concluded && sheet == null) leave.current();
  }, [concluded, sheet]);

  useEffect(() => {
    if (toast != null && toast !== '') return readOut(toast);
    return undefined;
  }, [toast]);

  const data = seen.kind === 'shown' ? seen.read : null;
  const lead = data?.viewer.station ?? null;
  const ended = (data?.ended ?? false) || endedHere;
  const refusedOpen = sheet?.kind === 'door' && sheet.refused;
  const showsDoor = data != null && data.viewer.canAddWalkOn && (!ended || refusedOpen);
  const empty = data?.rosterSize === 0;

  function open(next: Open, from: string): void {
    backTo.current = from;
    opener.current = refs.current.get(from) ?? null;
    setSheet(next);
  }

  function close(): void {
    const from = backTo.current;
    const id = /^mobile\|(.+)$/u.exec(from)?.[1];
    setSheet(null);
    setTimeout(
      () =>
        moveScreenReaderFocus(
          (id == null ? undefined : refs.current.get(`call|${id}`)) ??
            refs.current.get(from) ??
            null,
        ),
      SETTLED_MS,
    );
  }

  const door = showsDoor ? (
    <PrimaryButton
      label={t('whosHere.door')}
      onPress={() => {
        if (data == null) return;
        open(
          {
            kind: 'door',
            draft: blankDoor(data.countryCode ?? ''),
            tried: false,
            busy: false,
            failed: false,
            refused: false,
            refusedFields: {},
          },
          'door',
        );
      }}
      ref={(v) => keep(refs, 'door', v)}
      testID="whosHere.door"
    />
  ) : null;

  let body: ReactNode;
  if (seen.kind === 'loading')
    body = <Skeleton shape="rows" rowHeight={64} rows={6} words={t('whosHere.loading')} />;
  else if (seen.kind === 'unreachable')
    body = (
      <View style={styles.block} testID="whosHere.unreachable">
        <Notice
          tone="broken"
          mark="!"
          title={t('whosHere.unreachableTitle')}
          body={t('whosHere.unreachable')}
          announce
        />
        <SecondaryButton
          label={t('whosHere.tryAgain')}
          onPress={() => {
            setSeen({ kind: 'loading' });
            setRound((n) => n + 1);
          }}
          testID="whosHere.unreachable.retry"
        />
      </View>
    );
  else if (seen.kind === 'notFound')
    body = (
      <View style={styles.block} testID="whosHere.notFound">
        <Text size={20} weight="bold" accessibilityRole="header">
          {t('whosHere.notFound')}
        </Text>
        <SecondaryButton
          label={t('whosHere.backToEvents')}
          onPress={() => router.replace('/events')}
          link
          testID="whosHere.notFound.back"
        />
      </View>
    );
  else if (empty)
    body = (
      <View style={styles.block} testID="whosHere.empty">
        <Text size={17} weight="semibold" accessibilityRole="header">
          {t('whosHere.empty')}
        </Text>
        {door}
      </View>
    );
  else
    body = (
      <Lists
        read={seen.read}
        phone={phone}
        wide={wide}
        refs={refs}
        readsStaff={readsStaff}
        eventId={eventId}
        onCover={(row) =>
          open(
            {
              kind: 'cover',
              absent: row.id,
              chosen: null,
              tried: false,
              busy: false,
              failed: false,
            },
            `cover|${row.id}`,
          )
        }
        onAddMobile={(row) =>
          open(
            {
              kind: 'mobile',
              id: row.id,
              name: row.name,
              country: seen.read.countryCode ?? '',
              number: '',
              tried: false,
              busy: false,
              refusal: null,
              failed: false,
            },
            `mobile|${row.id}`,
          )
        }
      >
        {!lead && !phone && (
          <View style={styles.stations} testID="whosHere.stations">
            <Text size={17} weight="bold" accessibilityRole="header">
              {t('whosHere.stations')}
            </Text>
            {seen.read.stations.map((one) => (
              <StationTile key={one.id} station={one.name} people={one.people} />
            ))}
          </View>
        )}
      </Lists>
    );

  const busy =
    (sheet?.kind === 'door' || sheet?.kind === 'mobile' || sheet?.kind === 'cover') && sheet.busy;

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={[
          styles.body,
          phone && styles.bodyPhone,
          { paddingBottom: insets.bottom + tokens.space6xl * 2 },
        ]}
        testID="whosHere.page"
      >
        <QuietButton label={t('whosHere.back')} onPress={onBack} testID="whosHere.back" />
        <View style={[styles.head, wide && styles.headWide]}>
          <View style={styles.grow}>
            {eventName !== '' && (
              <Text size={14} weight="semibold" style={styles.secondary}>
                {eventName}
              </Text>
            )}
            <Text size={phone ? 28 : 30} weight="bold" accessibilityRole="header">
              {t('whosHere.title')}
            </Text>
            {lead != null && <StationPill name={lead.name} testID="whosHere.leadStation" />}
            {lastAt != null && (
              <View style={styles.live}>
                <View style={stale ? styles.ringOff : styles.dot} />
                <Text size={14} weight="medium" style={styles.secondary}>
                  {stale
                    ? t('whosHere.stale', { time: clockAt(lastAt, locale) })
                    : t('whosHere.live', { time: clockAt(lastAt, locale) })}
                </Text>
              </View>
            )}
          </View>
          {door != null && !empty && <View style={!wide && styles.doorFull}>{door}</View>}
        </View>
        {body}
      </ScrollView>
      <Sheet
        open={sheet != null && data != null}
        onClose={close}
        scrimLabel={t('whosHere.close')}
        held={busy}
        opener={opener}
        docked
        testID="whosHere.sheet"
      >
        {sheet != null && data != null && (
          <SheetBody
            open={sheet}
            read={data}
            eventId={eventId}
            phone={phone}
            set={setSheet}
            close={close}
            shown={shown}
            reread={() => reader.current()}
            onRefused={() => {
              setEndedHere(true);
              reader.current();
            }}
            onConcluded={() => {
              setConcluded(true);
              setSheet(null);
            }}
            onMoved={(words) => setToast(words)}
            onAddMobile={(id, name) =>
              setSheet({
                kind: 'mobile',
                id,
                name,
                country: data.countryCode ?? '',
                number: '',
                tried: false,
                busy: false,
                refusal: null,
                failed: false,
              })
            }
          />
        )}
      </Sheet>
      {toast != null && toast !== '' && (
        <PageToast
          words={toast}
          onClose={() => setToast(null)}
          bottom={insets.bottom + tokens.spaceXl}
        />
      )}
    </View>
  );
}

function keep(refs: Refs, key: string, v: ViewInstance | null): void {
  if (v == null) refs.current.delete(key);
  else refs.current.set(key, v);
}

function StationPill({ name, testID }: { name: string; testID?: string }) {
  return (
    <View style={styles.pill} testID={testID}>
      <Text size={14} weight="semibold">
        {name}
      </Text>
    </View>
  );
}

function Lists({
  read,
  phone,
  wide,
  refs,
  readsStaff,
  eventId,
  onCover,
  onAddMobile,
  children,
}: {
  read: WhosHere;
  phone: boolean;
  wide: boolean;
  refs: Refs;
  readsStaff: boolean;
  eventId: string;
  onCover: (row: WhosHereRow) => void;
  onAddMobile: (row: WhosHereRow) => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const locale = dateLocale();
  const lines = (row: WhosHereRow) =>
    [rowLine(row), shiftLine(t, row, locale)].filter((one) => one !== '');

  const lists = (
    <View style={styles.lists}>
      <Section
        title={t('whosHere.notHere', { count: read.notHere.length })}
        testID="whosHere.notHere"
      >
        {read.notHere.length === 0 ? (
          <Text size={15} style={styles.secondary}>
            {t('whosHere.notHereEmpty', { time: dueBy(read.now, locale) })}
          </Text>
        ) : (
          read.notHere.map((row, i) => (
            <PersonRow
              key={row.id}
              name={row.name}
              lines={lines(row)}
              first={i === 0}
              phone={phone}
              amber={row.coveredBy == null && row.nobodyHere}
              mark={
                row.coveredBy != null ? (
                  <MarkLine
                    kind="yes"
                    ink={tokens.colorAccent}
                    words={t('whosHere.coveredBy', { name: row.coveredBy })}
                  />
                ) : row.nobodyHere && row.station != null ? (
                  <MarkLine
                    kind="notyet"
                    ink={tokens.colorAttention}
                    words={t('whosHere.nobodyHereOn', { station: row.station.name })}
                    dashed
                  />
                ) : (
                  <MarkLine
                    kind="notyet"
                    ink={tokens.colorAttention}
                    words={t('whosHere.markNotHere')}
                  />
                )
              }
              actions={
                <>
                  {read.viewer.canCover && row.station != null && (
                    <SecondaryButton
                      label={t('whosHere.cover', { station: row.station.name })}
                      onPress={() => onCover(row)}
                      tall={phone}
                      ref={(v) => keep(refs, `cover|${row.id}`, v)}
                      testID={`whosHere.cover.${row.id}`}
                    />
                  )}
                  {row.phone != null ? (
                    <SecondaryButton
                      label={t('whosHere.call')}
                      accessibilityLabel={t('whosHere.callLabel', { name: row.name })}
                      onPress={() => void Linking.openURL(`tel:${row.phone}`)}
                      stacked={phone}
                      link
                      ref={(v) => keep(refs, `call|${row.id}`, v)}
                      testID={`whosHere.call.${row.id}`}
                    />
                  ) : (
                    <View style={styles.noNumber}>
                      <Text size={14} weight="medium" style={styles.secondary}>
                        {t('whosHere.noNumber')}
                      </Text>
                      {row.canAddMobile && (
                        <SecondaryButton
                          label={t('whosHere.addMobile')}
                          onPress={() => onAddMobile(row)}
                          stacked={phone}
                          ref={(v) => keep(refs, `mobile|${row.id}`, v)}
                          testID={`whosHere.addMobile.${row.id}`}
                        />
                      )}
                    </View>
                  )}
                </>
              }
              testID={`whosHere.notHere.${row.id}`}
            />
          ))
        )}
      </Section>
      {read.didntClockIn.length > 0 && (
        <Section
          title={t('whosHere.didnt', { count: read.didntClockIn.length })}
          testID="whosHere.didnt"
        >
          {read.didntClockIn.map((row, i) => (
            <PersonRow
              key={row.id}
              name={row.name}
              lines={lines(row)}
              first={i === 0}
              phone={phone}
              mark={
                <MarkLine
                  kind="ended"
                  ink={tokens.colorInkSecondary}
                  words={t('whosHere.markDidnt')}
                />
              }
              testID={`whosHere.didnt.${row.id}`}
            />
          ))}
          {readsStaff && (
            <SecondaryButton
              label={t('whosHere.hoursWorked')}
              onPress={() =>
                router.push({ pathname: '/events/[id]/hours', params: { id: eventId } })
              }
              link
              testID="whosHere.hoursWorked"
            />
          )}
        </Section>
      )}
      <Section title={t('whosHere.here', { count: read.here.length })} testID="whosHere.here">
        {read.here.length === 0 ? (
          <Text size={15} style={styles.secondary}>
            {t('whosHere.hereEmpty')}
          </Text>
        ) : (
          read.here.map((row, i) => (
            <PersonRow
              key={row.id}
              name={row.name}
              lines={[
                ...lines(row),
                ...(row.movedFrom == null
                  ? []
                  : [
                      t('whosHere.movedFrom', {
                        station: row.movedFrom.station,
                        time: clockAt(row.movedFrom.at, locale),
                      }),
                    ]),
              ]}
              first={i === 0}
              phone={phone}
              mark={
                <MarkLine
                  kind="yes"
                  ink={tokens.colorAccent}
                  words={t('whosHere.clockedInAt', {
                    time: row.clockedInAt == null ? '' : clockAt(row.clockedInAt, locale),
                  })}
                />
              }
              testID={`whosHere.here.${row.id}`}
            />
          ))
        )}
      </Section>
    </View>
  );

  return (
    <View style={wide ? styles.side : styles.column}>
      <View style={wide ? styles.sideMain : undefined}>{lists}</View>
      {children != null && children !== false && (
        <View style={wide ? styles.sidePanel : undefined}>{children}</View>
      )}
    </View>
  );
}

function Section({
  title,
  testID,
  children,
}: {
  title: string;
  testID: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.section} testID={testID}>
      <Text size={17} weight="bold" accessibilityRole="header">
        {title}
      </Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

interface SheetProps {
  open: Open;
  read: WhosHere;
  eventId: string;
  phone: boolean;
  set: (next: Open | null) => void;
  close: () => void;
  shown: (next: WhosHere) => void;
  reread: () => void;
  onRefused: () => void;
  onConcluded: () => void;
  onMoved: (words: string) => void;
  onAddMobile: (id: string, name: string) => void;
}

function SheetBody(props: SheetProps) {
  const { t } = useTranslation();
  const { open, read, close } = props;
  const absent =
    open.kind === 'cover' ? read.notHere.find((row) => row.id === open.absent) : undefined;
  const title =
    open.kind === 'door' || open.kind === 'noLink'
      ? t('whosHere.door')
      : open.kind === 'cover'
        ? t('whosHere.cover', { station: absent?.station?.name ?? '' })
        : open.kind === 'mobile'
          ? t('whosHere.addMobile')
          : t('whosHere.hasLink', { name: open.name });

  return (
    <SheetScrollView style={styles.sheetScroll} contentContainerStyle={styles.sheet}>
      {read.viewer.station != null && <StationPill name={read.viewer.station.name} />}
      <View style={styles.sheetHead}>
        <Text size={22} weight="bold" accessibilityRole="header" style={styles.grow}>
          {title}
        </Text>
        <CloseX onPress={close} testID="whosHere.sheet.close" />
      </View>
      {open.kind === 'door' && <DoorForm {...props} open={open} />}
      {open.kind === 'cover' && absent != null && (
        <CoverForm {...props} open={open} absent={absent} />
      )}
      {open.kind === 'mobile' && <MobileForm {...props} open={open} />}
      {open.kind === 'noLink' && (
        <View style={styles.form}>
          <MarkLine
            kind="yes"
            ink={tokens.colorAccent}
            words={t('whosHere.added', { name: open.name })}
          />
          <View style={styles.amberNote} testID="whosHere.noLink">
            <MarkLine
              kind="notyet"
              ink={tokens.colorAttention}
              words={t('whosHere.noLink', { name: open.name })}
            />
            <SecondaryButton
              label={t('whosHere.addMobile')}
              onPress={() => props.onAddMobile(open.id, open.name)}
              testID="whosHere.noLink.addMobile"
            />
          </View>
          <SheetActions>
            <PrimaryButton label={t('whosHere.done')} onPress={close} testID="whosHere.done" />
          </SheetActions>
        </View>
      )}
      {open.kind === 'hasLink' && (
        <View style={styles.form}>
          <Text size={16}>{t('whosHere.copied', { number: open.phone })}</Text>
          <SecondaryButton
            label={t('whosHere.copyAgain')}
            onPress={() => {
              void Clipboard.setStringAsync(open.url);
              props.set({ ...open, again: true });
              readOut(t('whosHere.copiedAgain'));
            }}
            testID="whosHere.copyAgain"
          />
          {open.again && (
            <MarkLine kind="yes" ink={tokens.colorAccent} words={t('whosHere.copiedAgain')} />
          )}
          <SheetActions>
            <PrimaryButton label={t('whosHere.done')} onPress={close} testID="whosHere.done" />
          </SheetActions>
        </View>
      )}
    </SheetScrollView>
  );
}

const NO_PROBLEMS: DoorProblems = { name: null, number: null, job: null, station: null };

function DoorForm({
  open,
  read,
  eventId,
  phone,
  set,
  close,
  reread,
  onRefused,
}: SheetProps & { open: DoorSheet }) {
  const { t } = useTranslation();
  const locale = dateLocale();
  const nameField = useRef<TextInputInstance>(null);
  const numberField = useRef<TextInputInstance>(null);
  const firstJob = useRef<ViewInstance>(null);
  const firstStation = useRef<ViewInstance>(null);
  const closeRef = useRef<ViewInstance>(null);
  const fixed = read.viewer.station;
  const { draft, refused } = open;

  useEffect(() => {
    if (!refused) return undefined;
    const timer = setTimeout(() => moveScreenReaderFocus(closeRef.current), SETTLED_MS);
    return () => clearTimeout(timer);
  }, [refused]);

  const problems = doorProblems(t, draft, countryName(draft.country), fixed != null);
  const local = open.tried ? problems : NO_PROBLEMS;
  const shownProblems: DoorProblems = {
    name: local.name ?? open.refusedFields.name ?? null,
    number: local.number ?? open.refusedFields.number ?? null,
    job: local.job ?? open.refusedFields.job ?? null,
    station: local.station ?? open.refusedFields.station ?? null,
  };
  const chosenJob = read.jobs.find((job) => job.id === draft.job) ?? null;
  const edit = (patch: Partial<DoorDraft>) =>
    set({ ...open, draft: { ...draft, ...patch }, failed: false, refusedFields: {} });

  function add(): void {
    if (open.busy) return;
    const first = firstProblem(problems);
    if (first != null) {
      set({ ...open, tried: true });
      if (first === 'name') focusChecked(nameField);
      else if (first === 'number') focusChecked(numberField);
      else moveScreenReaderFocus((first === 'job' ? firstJob : firstStation).current);
      return;
    }
    const pressed: DoorSheet = {
      ...open,
      tried: true,
      busy: true,
      failed: false,
      refusedFields: {},
    };
    set(pressed);
    const fullName = draft.name.trim();
    api
      .addWalkOn(eventId, {
        fullName,
        mobile:
          draft.number.trim() === '' ? null : { countryCode: draft.country, number: draft.number },
        job: draft.job ?? '',
        station: fixed != null ? null : draft.station,
      })
      .then(
        (added) => {
          reread();
          if (added.url == null || added.phone == null) {
            set({ kind: 'noLink', id: added.staff.id, name: added.staff.name });
            return;
          }
          void Clipboard.setStringAsync(added.url);
          set({
            kind: 'hasLink',
            id: added.staff.id,
            name: added.staff.name,
            phone: formatPhone(added.phone),
            url: added.url,
            again: false,
          });
        },
        (error: unknown) => {
          if (error instanceof ApiError && error.is('event_concluded')) {
            onRefused();
            set({ ...pressed, busy: false, refused: true });
            return;
          }
          if (error instanceof ApiError && error.is('validation_failed')) {
            const named = error.fieldErrors();
            set({
              ...pressed,
              busy: false,
              refusedFields: {
                name: named.fullName,
                number: named.mobile ?? named['mobile.number'],
                job: named.job,
                station: named.station,
              },
            });
            return;
          }
          set({ ...pressed, busy: false, failed: true });
        },
      );
  }

  return (
    <View style={styles.form}>
      <Field label={t('whosHere.name')} error={shownProblems.name}>
        <TextField
          ref={nameField}
          value={draft.name}
          onChangeText={(name) => edit({ name })}
          wrong={shownProblems.name != null}
          autoCapitalize="words"
          autoComplete="off"
          accessibilityLabel={t('whosHere.name')}
          testID="whosHere.door.name"
        />
      </Field>
      <Field label={t('whosHere.country')}>
        <CountryPicker
          label={t('whosHere.country')}
          value={draft.country}
          onChange={(country) => edit({ country })}
          disabled={open.busy}
          withCallingCode
          testID="whosHere.door.country"
        />
      </Field>
      <Field
        label={t('whosHere.mobile')}
        pill={t('whosHere.optional')}
        error={shownProblems.number}
      >
        <TextField
          ref={numberField}
          value={draft.number}
          onChangeText={(number) => edit({ number })}
          wrong={shownProblems.number != null}
          accessibilityLabel={t('whosHere.mobile')}
          keyboardType="phone-pad"
          autoComplete="off"
          testID="whosHere.door.number"
        />
      </Field>
      <View style={styles.group}>
        <Text size={15} weight="semibold">
          {t('whosHere.job')}
        </Text>
        <View style={styles.chips}>
          {read.jobs.map((job, i) => (
            <Chip
              key={job.id}
              label={job.name}
              on={draft.job === job.id}
              hint={refused ? undefined : jobLine(t, job, locale)}
              onPress={() => edit({ job: draft.job === job.id ? null : job.id })}
              ref={i === 0 ? firstJob : undefined}
              testID={`whosHere.door.job.${job.id}`}
            />
          ))}
        </View>
        {shownProblems.job != null && <Wrong words={shownProblems.job} />}
        {chosenJob != null && !refused && (
          <Text size={14} style={styles.secondary} testID="whosHere.door.jobLine">
            {jobLine(t, chosenJob, locale)}
          </Text>
        )}
      </View>
      <View style={styles.group}>
        <Text size={15} weight="semibold">
          {t('whosHere.where')}
        </Text>
        {fixed != null ? (
          <Text size={15}>{fixed.name}</Text>
        ) : (
          <View style={styles.chips}>
            {read.doorStations.map((station, i) => (
              <Chip
                key={station.id}
                label={station.name}
                on={draft.station === station.id}
                onPress={() => edit({ station: draft.station === station.id ? null : station.id })}
                ref={i === 0 ? firstStation : undefined}
                testID={`whosHere.door.station.${station.id}`}
              />
            ))}
          </View>
        )}
        {shownProblems.station != null && <Wrong words={shownProblems.station} />}
      </View>
      {open.failed && !refused && (
        <Notice
          tone="broken"
          mark="!"
          body={t('whosHere.failed', { name: draft.name.trim() })}
          announce
        />
      )}
      {refused ? (
        <View style={styles.form}>
          <Notice tone="attention" mark="!" body={t('whosHere.refused')} announce interrupts />
          <SheetActions>
            <PrimaryButton
              label={t('whosHere.close')}
              onPress={close}
              ref={closeRef}
              testID="whosHere.door.close"
            />
          </SheetActions>
        </View>
      ) : (
        <SheetActions>
          <PrimaryButton
            label={doorLabel(t, draft, open.busy)}
            busy={open.busy}
            onPress={add}
            paired={!phone}
            testID="whosHere.door.add"
          />
        </SheetActions>
      )}
    </View>
  );
}

function Wrong({ words }: { words: string }) {
  return (
    <Text size={14} weight="semibold" style={styles.broken} accessibilityRole="alert">
      {words}
    </Text>
  );
}

function MobileForm({
  open,
  eventId,
  set,
  reread,
  onConcluded,
}: SheetProps & { open: MobileSheet }) {
  const { t } = useTranslation();
  const numberField = useRef<TextInputInstance>(null);
  const problem = numberProblem(t, open.number, open.country, countryName(open.country), true);
  const said = open.refusal ?? (open.tried ? problem : null);

  function send(): void {
    if (open.busy) return;
    if (problem != null) {
      set({ ...open, tried: true, refusal: null, failed: false });
      focusChecked(numberField);
      return;
    }
    const pressed: MobileSheet = { ...open, tried: true, busy: true, refusal: null, failed: false };
    set(pressed);
    api
      .addWhosHereMobile(eventId, open.id, { countryCode: open.country, number: open.number })
      .then(
        (added) => {
          reread();
          void Clipboard.setStringAsync(added.url);
          set({
            kind: 'hasLink',
            id: open.id,
            name: open.name,
            phone: formatPhone(added.phone),
            url: added.url,
            again: false,
          });
        },
        (error: unknown) => {
          if (error instanceof ApiError && error.is('event_concluded')) {
            onConcluded();
            return;
          }
          const named =
            error instanceof ApiError && error.is('validation_failed') ? error.fieldErrors() : {};
          const refusal = named.mobile ?? named['mobile.number'] ?? null;
          set({ ...pressed, busy: false, refusal, failed: refusal == null });
          if (refusal != null) focusChecked(numberField);
        },
      );
  }

  return (
    <View style={styles.form}>
      <Text size={15} style={styles.secondary}>
        {t('whosHere.forOnly', { name: open.name })}
      </Text>
      <Field label={t('whosHere.country')}>
        <CountryPicker
          label={t('whosHere.country')}
          value={open.country}
          onChange={(country) => set({ ...open, country, refusal: null })}
          disabled={open.busy}
          withCallingCode
          testID="whosHere.mobile.country"
        />
      </Field>
      <Field label={t('whosHere.mobile')} error={said}>
        <TextField
          ref={numberField}
          value={open.number}
          onChangeText={(number) => set({ ...open, number, refusal: null, failed: false })}
          wrong={said != null}
          accessibilityLabel={t('whosHere.mobile')}
          keyboardType="phone-pad"
          autoComplete="off"
          autoFocus
          testID="whosHere.mobile.number"
        />
      </Field>
      {open.failed && <Notice tone="broken" mark="!" body={t('whosHere.notChanged')} announce />}
      <SheetActions>
        <PrimaryButton
          label={t('whosHere.copyLink')}
          busy={open.busy}
          onPress={send}
          testID="whosHere.mobile.send"
        />
      </SheetActions>
    </View>
  );
}

function CoverForm({
  open,
  absent,
  read,
  eventId,
  phone,
  set,
  close,
  shown,
  reread,
  onConcluded,
  onMoved,
}: SheetProps & {
  open: Extract<Open, { kind: 'cover' }>;
  absent: WhosHereRow;
}) {
  const { t } = useTranslation();
  const locale = dateLocale();
  const firstRef = useRef<ViewInstance>(null);
  const station = absent.station;
  if (station == null) return null;
  const people = coverCandidates(read, station.id, locale);
  const chosen = people.find((row) => row.id === open.chosen) ?? null;

  function move(): void {
    if (open.busy || station == null) return;
    if (chosen == null) {
      set({ ...open, tried: true });
      moveScreenReaderFocus(firstRef.current);
      return;
    }
    const from = chosen.station?.name ?? null;
    set({ ...open, busy: true, failed: false });
    api.coverStation(eventId, absent.id, chosen.id).then(
      (next) => {
        shown(next);
        close();
        onMoved(movedWords(t, next, chosen.id, from, locale));
      },
      (error: unknown) => {
        if (error instanceof ApiError && error.is('event_concluded')) {
          onConcluded();
          return;
        }
        set({ ...open, busy: false, failed: true });
        reread();
      },
    );
  }

  return (
    <View style={styles.form}>
      <Text size={15} style={styles.secondary}>
        {t('whosHere.coverLine', {
          name: absent.name,
          job: absent.job ?? '',
          shift: shiftLine(t, absent, locale),
        })}
      </Text>
      {people.length === 0 ? (
        <>
          <Text size={16}>
            {read.here.length === 0
              ? t('whosHere.hereEmpty')
              : t('whosHere.allOnIt', { station: station.name })}
          </Text>
          <SheetActions>
            <SecondaryButton
              label={t('whosHere.close')}
              onPress={close}
              stacked={phone}
              testID="whosHere.cover.close"
            />
          </SheetActions>
        </>
      ) : (
        <>
          <View style={styles.choices} accessibilityRole="radiogroup">
            {people.map((row, i) => {
              const line =
                row.station == null ? null : t('whosHere.onStation', { station: row.station.name });
              const warn = leavesEmpty(read, row)
                ? t('whosHere.leaves', { station: row.station?.name ?? '' })
                : null;
              const label =
                line == null
                  ? row.name
                  : warn == null
                    ? t('whosHere.choiceLabel', { name: row.name, line })
                    : t('whosHere.choiceLabelWarn', { name: row.name, line, warn });
              return (
                <ChoiceRow
                  key={row.id}
                  name={row.name}
                  line={line}
                  warn={warn}
                  label={label}
                  on={chosen?.id === row.id}
                  onPress={() =>
                    set({
                      ...open,
                      chosen: row.id,
                      tried: false,
                      failed: open.failed && row.id === open.chosen,
                    })
                  }
                  ref={i === 0 ? firstRef : undefined}
                  testID={`whosHere.cover.who.${row.id}`}
                />
              );
            })}
          </View>
          {open.tried && chosen == null && (
            <Wrong words={t('whosHere.choose', { station: station.name })} />
          )}
          {open.failed && chosen != null && (
            <Notice
              tone="broken"
              mark="!"
              body={t('whosHere.coverFailed', { name: chosen.name })}
              announce
            />
          )}
          <SheetActions>
            <PrimaryButton
              label={
                chosen == null
                  ? t('whosHere.moveTo', { station: station.name })
                  : t('whosHere.moveNamed', { name: chosen.name, station: station.name })
              }
              busy={open.busy}
              onPress={move}
              testID="whosHere.cover.move"
            />
          </SheetActions>
        </>
      )}
    </View>
  );
}

function ChoiceRow({
  name,
  line,
  warn,
  label,
  on,
  onPress,
  ref,
  testID,
}: {
  name: string;
  line: string | null;
  warn: string | null;
  label: string;
  on: boolean;
  onPress: () => void;
  ref?: Ref<ViewInstance> | undefined;
  testID: string;
}) {
  return (
    <Pressable
      ref={ref}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: on }}
      accessibilityLabel={label}
      style={[styles.choice, on && styles.choiceOn]}
      testID={testID}
    >
      <View style={styles.grow}>
        <Text size={16} weight="semibold">
          {name}
        </Text>
        {line != null && (
          <Text size={14} style={styles.secondary}>
            {line}
          </Text>
        )}
        {warn != null && <MarkLine kind="notyet" ink={tokens.colorAttention} words={warn} dashed />}
      </View>
      <View style={[styles.radio, on && styles.radioOn]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: tokens.colorPage },
  body: { padding: tokens.spaceXl, gap: tokens.spaceLg },
  bodyPhone: { padding: tokens.spaceLg },
  grow: { flex: 1, minWidth: 0 },
  secondary: { color: tokens.colorInkSecondary },
  broken: { color: tokens.colorBrokenText },
  head: { gap: tokens.spaceMd },
  headWide: { flexDirection: 'row', alignItems: 'flex-start' },
  doorFull: { alignSelf: 'stretch' },
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: tokens.spaceMd,
    paddingVertical: tokens.spaceXxs,
    marginTop: tokens.spaceXs,
    borderRadius: tokens.radiusPill,
    backgroundColor: tokens.colorInset,
    borderWidth: 1,
    borderColor: tokens.colorInsetBorder,
  },
  live: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceSm,
    marginTop: tokens.spaceXs,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: tokens.colorAccent },
  ringOff: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: tokens.colorInkSecondary,
  },
  block: { gap: tokens.spaceMd },
  column: { gap: tokens.spaceLg },
  side: { flexDirection: 'row', gap: tokens.spaceLg, alignItems: 'flex-start' },
  sideMain: { flex: 1, minWidth: 0 },
  sidePanel: { width: 340 },
  lists: { gap: tokens.spaceLg },
  section: { gap: tokens.spaceSm },
  card: {
    paddingHorizontal: tokens.spaceLg,
    paddingVertical: tokens.spaceXs,
    borderRadius: tokens.radiusCardPhone,
    backgroundColor: tokens.colorCard,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
    gap: tokens.spaceXs,
  },
  noNumber: { gap: tokens.spaceXs, alignItems: 'flex-end' },
  stations: { gap: tokens.spaceSm },
  sheetScroll: { flexShrink: 1 },
  sheet: { gap: tokens.spaceMd, padding: tokens.spaceXl },
  sheetHead: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm },
  form: { gap: tokens.spaceMd },
  group: { gap: tokens.spaceXs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spaceXs },
  amberNote: {
    gap: tokens.spaceSm,
    padding: tokens.spaceMd,
    borderRadius: tokens.radiusRow,
    backgroundColor: tokens.colorAttentionTint,
    borderWidth: 1,
    borderColor: tokens.colorAttentionBorder,
  },
  choices: { gap: tokens.spaceXs },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceMd,
    padding: tokens.spaceMd,
    minHeight: tokens.sizeHit + 8,
    borderRadius: tokens.radiusRow,
    borderWidth: 1,
    borderColor: tokens.colorFieldBorder,
  },
  choiceOn: {
    borderWidth: 2,
    borderColor: tokens.colorAccent,
    backgroundColor: tokens.colorAccentTint,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: tokens.colorControlBorder,
  },
  radioOn: { borderWidth: 7, borderColor: tokens.colorAccent },
});
