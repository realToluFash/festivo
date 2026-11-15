import type { OrganisationEvent } from '@soirely/api-client';
import { copyEndsLine } from '@soirely/domain';
import { router } from 'expo-router';
import { type RefObject, useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type ViewInstance } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import { dateLocale } from '../i18n/index.ts';
import {
  type DuplicateRun,
  OPENING_AFTER,
  type Starts,
  answeredRun,
  duplicateEvent,
  duplicateRunOf,
  pickedRun,
  startsAfter,
} from '../kit/eventDuplicate.ts';
import { tokens } from '../theme/tokens.ts';
import { AlertLine } from './AlertLine.tsx';
import { EventNotice } from './EventNotice.tsx';
import { MomentBox, type Picking, PickerLayer, pick } from './MomentPick.tsx';
import { SETTLED_MS } from './Screen.tsx';
import { type ScreenReaderTarget, moveScreenReaderFocus } from './screenReaderFocus.ts';
import { useShellLayout } from './settingsShell.ts';
import { FocusedScreen, SectionHead } from './Summary.tsx';
import { Text } from './Text.tsx';

type Opener = RefObject<ScreenReaderTarget | null>;
type Original = Pick<OrganisationEvent, 'name' | 'startsAt' | 'endsAt' | 'timeZone'>;

const COPIED = [
  'copiedName',
  'copiedType',
  'copiedVenue',
  'copiedCover',
  'copiedTimeZone',
  'copiedCurrency',
  'copiedLength',
] as const;

const NOT_COPIED = [
  'notCopiedHosts',
  'notCopiedGuests',
  'notCopiedReplies',
  'notCopiedHappened',
] as const;

/** The copy's start, a year on from the original's, as the screen opens. */
export function firstStarts(event: Pick<OrganisationEvent, 'startsAt'>): Starts {
  return startsAfter({ date: event.startsAt.slice(0, 10), time: event.startsAt.slice(11, 16) });
}

/** An event's page > Duplicate (sc-3593, sc-22145), over the page: the API's answer in the demo's screen. */
export function DuplicateEvent({
  open,
  event,
  opener,
  onClose,
}: {
  open: boolean;
  event: OrganisationEvent;
  opener: Opener;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [run, setRun] = useState(() => duplicateRunOf(firstStarts(event)));
  const [refusals, setRefusals] = useState(0);
  const [landing, setLanding] = useState<`/events/${string}` | null>(null);

  const closing = useRef(onClose);

  useEffect(() => {
    closing.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (landing == null) return undefined;
    const id = setTimeout(() => {
      closing.current();
      router.push(landing);
    }, OPENING_AFTER);

    return () => clearTimeout(id);
  }, [landing]);

  async function create(): Promise<void> {
    const { date, time } = run.starts;
    if (date !== '' && time !== '') setRun({ ...run, status: 'creating', error: null });
    const answer = await duplicateEvent(api, event.id, date, time, t);

    setRun((now) => answeredRun(now, answer));
    if (answer.kind === 'refused') setRefusals((count) => count + 1);
    if (answer.kind === 'created') setLanding(answer.href);
  }

  return (
    <DuplicateScreen
      open={open}
      event={event}
      locale={dateLocale()}
      run={run}
      refusals={refusals}
      opener={opener}
      onClose={onClose}
      onPick={(starts) => setRun((now) => pickedRun(now, starts))}
      onCreate={() => void create()}
      testID="eventDuplicate"
    />
  );
}

/** Duplicate makes a draft: what is copied and what is not, and the copy's start with its end worked out. */
export function DuplicateScreen({
  open,
  event,
  locale,
  run,
  refusals,
  opener,
  onClose,
  onPick,
  onCreate,
  testID,
}: {
  open: boolean;
  event: Original;
  locale: string;
  run: DuplicateRun;
  /** Counts each refused start, so each one moves focus to the half it names. */
  refusals: number;
  opener: Opener;
  onClose: () => void;
  onPick: (starts: Starts) => void;
  onCreate: () => void;
  testID: string;
}) {
  const { t } = useTranslation();
  const { starts, status, error } = run;
  const [picking, setPicking] = useState<Picking | null>(null);
  const date = useRef<ViewInstance>(null);
  const time = useRef<ViewInstance>(null);
  const busy = status === 'creating' || status === 'created';
  const gap = useShellLayout() === 'phone' ? tokens.spaceXl : tokens.spaceLg;
  const startsLabel = t('eventDuplicate.starts');
  const choose = (mode: 'date' | 'time') =>
    pick(
      {
        title: t('eventForm.timesIn', { zone: event.timeZone }),
        mode,
        field: starts,
        take: onPick,
      },
      setPicking,
    );

  useEffect(() => {
    if (refusals === 0 || !open) return undefined;
    const later = setTimeout(
      () => moveScreenReaderFocus((run.focus === 'time' ? time : date).current),
      SETTLED_MS,
    );

    return () => clearTimeout(later);
  }, [refusals, open, run.focus]);

  return (
    <FocusedScreen
      gap={gap}
      open={open}
      title={t('eventDuplicate.open')}
      verb={{
        label: t('eventDuplicate.create'),
        on: true,
        busy,
        onPress: () => {
          if (!busy) onCreate();
        },
        testID: `${testID}.create`,
      }}
      waits={busy}
      onCancel={onClose}
      cancelTestID={`${testID}.cancel`}
      opener={opener}
      toast={
        status === 'created' ? { words: t('eventDuplicate.created'), onClose: () => {} } : null
      }
      over={
        picking == null
          ? null
          : {
              layer: (
                <PickerLayer picking={picking} locale={locale} onClose={() => setPicking(null)} />
              ),
              onClose: () => setPicking(null),
            }
      }
      testID={testID}
    >
      {status === 'failed' && (
        <EventNotice tone="broken" words={t('eventDuplicate.notCreated')} interrupts />
      )}
      <Text size={22} weight="bold" accessibilityRole="header" style={styles.title}>
        {t('eventDuplicate.title', { event: event.name })}
      </Text>
      <Text size={15} weight="medium" style={[styles.secondary, styles.lines]}>
        {t('eventDuplicate.body')}
      </Text>
      <Listed
        title={t('eventDuplicate.copied')}
        items={COPIED.map((key) => t(`eventDuplicate.${key}`))}
      />
      <Listed
        title={t('eventDuplicate.notCopied')}
        items={NOT_COPIED.map((key) => t(`eventDuplicate.${key}`))}
      />
      <View style={styles.starts}>
        <Text size={14} weight="semibold" style={styles.label}>
          {startsLabel}
        </Text>
        <View style={styles.pair}>
          <MomentBox
            ref={date}
            label={`${startsLabel}, ${t('eventForm.date')}`}
            mode="date"
            value={starts.date}
            locale={locale}
            wrong={error != null && (starts.date === '' || run.focus === 'date')}
            onPress={() => choose('date')}
            testID={`${testID}.date`}
          />
          <MomentBox
            ref={time}
            label={`${startsLabel}, ${t('eventForm.time')}`}
            mode="time"
            value={starts.time}
            locale={locale}
            width={104}
            wrong={error != null && starts.time === ''}
            onPress={() => choose('time')}
            testID={`${testID}.time`}
          />
        </View>
        {error != null && <AlertLine text={error} />}
      </View>
      <Text size={14} weight="medium" style={[styles.secondary, styles.said]}>
        {copyEndsLine(starts.date, starts.time, event, locale, t)}
      </Text>
    </FocusedScreen>
  );
}

function Listed({ title, items }: { title: string; items: readonly string[] }) {
  return (
    <View>
      <SectionHead title={title} />
      {items.map((item) => (
        <Text key={item} size={15} weight="medium" style={styles.bullet}>
          {`• ${item}`}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  secondary: { color: tokens.colorInkSecondary },
  title: { letterSpacing: 22 * -0.015, lineHeight: 22 * 1.2 },
  bullet: { lineHeight: 15 * 1.45 },
  lines: { lineHeight: 15 * 1.45 },
  label: { lineHeight: 14 * 1.3 },
  said: { lineHeight: 14 * 1.45 },
  starts: { gap: 7 },
  pair: { flexDirection: 'row', gap: tokens.spaceSm },
});
