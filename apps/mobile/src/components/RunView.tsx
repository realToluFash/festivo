import {
  ApiError,
  type OrganisationEvent,
  type Schedule,
  type ScheduleItem,
  realtimeTopic,
} from '@soirely/api-client';
import {
  type RunFigure,
  type RunRow,
  type RunTrackShown,
  type RunWords,
  asksNextStep,
  collisionWords,
  figureSaid,
  figureWords,
  formatWallClock,
  nextWords,
  runItemOf,
  runShown,
  timeSlot,
  wallOfZoned,
  zonedAt,
} from '@soirely/domain';
import type { TFunction } from 'i18next';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import { followReadingAgain } from '../followTopic.ts';
import { dateLocale } from '../i18n/index.ts';
import { useServerNow } from '../kit/serverNow.ts';
import type { LayoutKind } from '../layout/classify.ts';
import { tokens } from '../theme/tokens.ts';
import { PrimaryButton, SecondaryButton } from './Buttons.tsx';
import { useReadOut } from './ReadOut.tsx';
import { Text } from './Text.tsx';

/** Read again this often while the hub is not delivering, so a mark reaches every viewer within 10 seconds (sc-1404). */
const READ_AGAIN_MS = 10_000;

type RunItem = ScheduleItem & { planned: string };
type TrackView = RunTrackShown<RunItem>;
type Load = { kind: 'loading' } | { kind: 'failed' } | { kind: 'loaded'; schedule: Schedule };

const PATHS = {
  tick: ['M20 6 9 17l-5-5'],
  clock: ['M12 7v5l3 2'],
  arrow: ['M5 12h14', 'm13 6 6 6-6 6'],
  lock: ['M5 11h14v10H5z', 'M8 11V7a4 4 0 0 1 8 0v4'],
  warn: [
    'M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
    'M12 9v4',
    'M12 17h.01',
  ],
} as const;

function said(t: TFunction, [key, values]: RunWords): string {
  return values == null ? t(key) : t(key, values);
}

function dayName(day: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date(`${day}T12:00:00Z`));
}

/** The run view (sc-1404), as its demo draws it: a table per track on a tablet; on a phone, Now, Next and Then for one track at a time. */
export function RunView({
  eventId,
  kind,
  onEvent,
}: {
  eventId: string;
  kind: LayoutKind;
  onEvent: (event: OrganisationEvent) => void;
}) {
  const { t } = useTranslation();
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [event, setEvent] = useState<OrganisationEvent | null>(null);

  useEffect(() => {
    let current = true;
    const read = () =>
      void api.schedule(eventId).then(
        (schedule) => current && setLoad({ kind: 'loaded', schedule }),
        () => current && setLoad((was) => (was.kind === 'loaded' ? was : { kind: 'failed' })),
      );

    read();
    void api.event(eventId).then(
      (one) => {
        if (!current) return;
        setEvent(one);
        onEvent(one);
      },
      () => undefined,
    );
    const stop = followReadingAgain(
      realtimeTopic('EventSchedule', eventId),
      () => api.scheduleSubscription(eventId),
      read,
      READ_AGAIN_MS,
    );

    return () => {
      current = false;
      stop();
    };
  }, [eventId, onEvent]);

  if (load.kind === 'loading')
    return (
      <Text size={15} style={styles.secondary} testID="run.loading">
        {t('runView.loading')}
      </Text>
    );
  if (load.kind === 'failed')
    return (
      <Text size={15} style={styles.secondary} accessibilityRole="alert" testID="run.failed">
        {t('runView.failed')}
      </Text>
    );

  return (
    <Loaded
      eventId={eventId}
      schedule={load.schedule}
      manage={event?.permissions.includes('run_of_show.manage') ?? false}
      reader={event != null && !event.permissions.includes('run_of_show.manage')}
      kind={kind}
      onSchedule={(schedule) => setLoad({ kind: 'loaded', schedule })}
    />
  );
}

function Loaded({
  eventId,
  schedule,
  manage,
  reader,
  kind,
  onSchedule,
}: {
  eventId: string;
  schedule: Schedule;
  manage: boolean;
  /** Known to read and not manage, so the lock line says why there is nothing to press; unset until the event has loaded. */
  reader: boolean;
  kind: LayoutKind;
  onSchedule: (schedule: Schedule) => void;
}) {
  const { t } = useTranslation();
  const locale = dateLocale();
  const now = zonedAt(useServerNow(), schedule.timeZone);
  const views = runShown(
    schedule.items.map(runItemOf),
    now,
    schedule.timeZone,
    t('runView.main'),
    (day) => dayName(day, locale),
  );
  const [trackKey, setTrackKey] = useState(views[0]?.key ?? '');
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const phone = kind === 'phone';

  useReadOut(
    views.map((view) => said(t, figureSaid(said(t, view.name), view.track.figure))).join('. '),
    {
      quietAtMount: true,
    },
  );

  const mark = (item: RunItem, how: 'start' | 'finish') => {
    setBusy(item.id);
    setFailed(null);
    api.markScheduleItem(eventId, item.id, how).then(
      (next) => {
        setBusy(null);
        onSchedule(next);
      },
      (error: unknown) => {
        setBusy(null);
        if (error instanceof ApiError && error.status === 409) {
          setFailed(error.problem.title);
          api.schedule(eventId).then(onSchedule, () => undefined);
        } else {
          setFailed(t('runView.markFailed'));
        }
      },
    );
  };
  const act = { manage, busy, onMark: mark };

  return (
    <View style={styles.body}>
      <View style={styles.head}>
        <Text size={15} style={[styles.secondary, styles.grow]}>
          {t('runView.sub')}
        </Text>
        <View style={styles.clock}>
          <Glyph paths={PATHS.clock} ink={tokens.colorInk} side={16} circle />
          <Text size={14} weight="semibold" style={styles.num}>
            {t('runView.clock', timeSlot(now, locale))}
          </Text>
        </View>
      </View>
      {reader && (
        <View style={styles.lock}>
          <Glyph paths={PATHS.lock} ink={tokens.colorInkSecondary} side={16} />
          <Text size={14} style={[styles.secondary, styles.grow]}>
            {t('runView.lock')}
          </Text>
        </View>
      )}
      {failed != null && (
        <Text size={15} weight="semibold" style={styles.attention} accessibilityRole="alert">
          {failed}
        </Text>
      )}
      {views.length === 0 && (
        <Text size={15} style={styles.secondary}>
          {t('runView.empty')}
        </Text>
      )}
      {phone ? (
        <PhoneTrack views={views} trackKey={trackKey} onTrack={setTrackKey} act={act} />
      ) : (
        views.map((view) => (
          <TabletTrack key={view.key} view={view} narrow={kind === 'tabletPortrait'} act={act} />
        ))
      )}
    </View>
  );
}

interface ActProps {
  manage: boolean;
  busy: string | null;
  onMark: (item: RunItem, how: 'start' | 'finish') => void;
}

function Glyph({
  paths,
  ink,
  side = 18,
  circle = false,
}: {
  paths: readonly string[];
  ink: string;
  side?: number;
  circle?: boolean;
}) {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg
        width={side}
        height={side}
        viewBox="0 0 24 24"
        fill="none"
        stroke={ink}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {circle && <Circle cx={12} cy={12} r={9} />}
        {paths.map((d) => (
          <Path key={d} d={d} />
        ))}
      </Svg>
    </View>
  );
}

function FigureMark({ figure }: { figure: RunFigure }) {
  const { t } = useTranslation();
  const look =
    figure.kind === 'behind'
      ? styles.figureBehind
      : figure.kind === 'last'
        ? styles.figureLast
        : styles.figureOn;
  const ink =
    figure.kind === 'behind'
      ? tokens.colorAttentionText
      : figure.kind === 'last'
        ? tokens.colorAccentText
        : tokens.colorInkOnDark;

  return (
    <View style={[styles.figure, look]}>
      <Glyph
        paths={
          figure.kind === 'behind' ? PATHS.clock : figure.kind === 'last' ? PATHS.arrow : PATHS.tick
        }
        ink={ink}
        side={14}
        circle={figure.kind === 'behind'}
      />
      <Text size={14} weight="semibold" style={[styles.num, { color: ink }]}>
        {said(t, figureWords(figure))}
      </Text>
    </View>
  );
}

function TrackTop({ view }: { view: TrackView }) {
  const { t } = useTranslation();
  const locale = dateLocale();
  const name = said(t, view.name);

  return (
    <>
      <View
        style={styles.trackTop}
        accessible
        accessibilityLabel={said(t, figureSaid(name, view.track.figure))}
      >
        <Text size={20} weight="bold" accessibilityRole="header" style={styles.grow}>
          {name}
        </Text>
        {view.track.figure.kind !== 'done' && <FigureMark figure={view.track.figure} />}
      </View>
      {view.track.collisions.map(({ before, fixed }) => (
        <View key={`${before.id}|${fixed.id}`} style={styles.collision}>
          <Glyph paths={PATHS.warn} ink={tokens.colorAttentionText} side={16} />
          <Text size={14} weight="semibold" style={[styles.grow, styles.attention]}>
            {said(t, collisionWords(before, fixed, locale))}
          </Text>
        </View>
      ))}
    </>
  );
}

function TabletTrack({ view, narrow, act }: { view: TrackView; narrow: boolean; act: ActProps }) {
  const { t } = useTranslation();
  const locale = dateLocale();
  const columns = [
    t('runView.starts'),
    t('runView.lasts'),
    t('runView.item'),
    t('runView.owner'),
  ] as const;

  return (
    <View style={styles.card}>
      <TrackTop view={view} />
      <View
        style={styles.tableHead}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {columns.map((column, index) => (
          <Text
            key={column}
            accessible={false}
            size={12}
            weight="semibold"
            style={[
              styles.secondary,
              COLUMN[index] ?? styles.grow,
              narrow && index === 3 && styles.ownerNarrow,
            ]}
          >
            {column}
          </Text>
        ))}
        {act.manage && <View style={styles.actCol} />}
      </View>
      {view.track.rows.map((row) => (
        <TableRow key={row.item.id} row={row} narrow={narrow} act={act} />
      ))}
      <Text size={14} style={[styles.secondary, styles.nextLine]}>
        {said(t, nextWords(view.track, locale))}
        {asksNextStep(view.track, act.manage) && ` ${t('runView.nextStep')}`}
      </Text>
    </View>
  );
}

function lastsOf(item: RunItem, t: TFunction): string {
  return item.lengthMinutes == null
    ? t('runView.noLength')
    : t('runView.minutes', { count: item.lengthMinutes });
}

function TableRow({ row, narrow, act }: { row: RunRow<RunItem>; narrow: boolean; act: ActProps }) {
  const { t } = useTranslation();
  const { item, phase } = row;

  return (
    <View style={[styles.row, phase === 'now' && styles.rowNow]}>
      <View style={styles.startsCol} accessible accessibilityLabel={startsSaid(row, t)}>
        <Text
          size={16}
          weight="semibold"
          style={[styles.num, phase === 'done' && styles.secondary]}
        >
          {formatWallClock(wallOfZoned(item.planned), dateLocale())}
        </Text>
        <Second row={row} size={13} />
      </View>
      <Text
        size={14}
        style={[styles.lastsCol, item.lengthMinutes == null ? styles.none : styles.num]}
      >
        {lastsOf(item, t)}
      </Text>
      <View style={styles.grow}>
        <ItemLine row={row} />
        {row.startedBefore != null && (
          <Text size={13} style={styles.secondary}>
            {t('runView.startedBefore', { title: row.startedBefore.title })}
          </Text>
        )}
      </View>
      <Text
        size={14}
        style={[
          styles.ownerCol,
          narrow && styles.ownerNarrow,
          item.ownerName == null && styles.none,
        ]}
      >
        {item.ownerName ?? t('runView.noOwner')}
      </Text>
      {act.manage && (
        <View style={styles.actCol}>
          <Act row={row} act={act} />
        </View>
      )}
    </View>
  );
}

function secondOf(row: RunRow<RunItem>): { kind: 'expected' | 'started'; time: string } | null {
  if (row.phase !== 'waiting' && row.item.startedAt != null)
    return { kind: 'started', time: row.item.startedAt };

  return row.expected == null ? null : { kind: 'expected', time: row.expected };
}

function startsSaid(row: RunRow<RunItem>, t: TFunction): string {
  const locale = dateLocale();
  const planned = formatWallClock(wallOfZoned(row.item.planned), locale);
  const second = secondOf(row);

  if (second == null) return t('runView.saidPlanned', { planned });

  const slot = { planned, ...timeSlot(second.time, locale) };

  return second.kind === 'expected'
    ? t('runView.saidPlannedAbout', slot)
    : t('runView.saidPlannedStarted', slot);
}

function Second({ row, size }: { row: RunRow<RunItem>; size: 12 | 13 }) {
  const { t } = useTranslation();
  const second = secondOf(row);

  if (second == null) return null;

  const slot = timeSlot(second.time, dateLocale());

  return (
    <Text
      size={size}
      numberOfLines={1}
      weight="semibold"
      style={[styles.num, second.kind === 'expected' ? styles.attention : styles.secondary]}
    >
      {second.kind === 'expected' ? t('runView.about', slot) : t('runView.started', slot)}
    </Text>
  );
}

function ItemLine({ row }: { row: RunRow<RunItem> }) {
  const { t } = useTranslation();
  const { item, phase } = row;

  return (
    <View style={styles.itemLine}>
      <Text size={16} weight="semibold" style={phase === 'done' && styles.secondary}>
        {item.title}
      </Text>
      {phase !== 'waiting' && (
        <View style={[styles.tag, phase === 'now' && styles.tagNow]}>
          <Glyph
            paths={phase === 'done' ? PATHS.tick : PATHS.arrow}
            ink={phase === 'done' ? tokens.colorInkSecondary : tokens.colorAccentText}
            side={12}
          />
          <Text
            size={12}
            weight="semibold"
            style={phase === 'done' ? styles.secondary : styles.accentText}
          >
            {phase === 'done' ? t('runView.done') : t('runView.now')}
          </Text>
        </View>
      )}
      {item.fixedTime && (
        <View style={[styles.tag, styles.tagFixed]}>
          <Glyph paths={PATHS.lock} ink={tokens.colorInkSecondary} side={12} />
          <Text size={12} weight="semibold" style={styles.secondary}>
            {t('runView.fixed')}
          </Text>
        </View>
      )}
    </View>
  );
}

function Act({ row, act }: { row: RunRow<RunItem>; act: ActProps }) {
  const { t } = useTranslation();
  const { item, phase } = row;

  if (!act.manage) return null;
  if (phase === 'waiting')
    return (
      <SecondaryButton
        label={t('runView.start')}
        accessibilityLabel={t('runView.startNamed', { title: item.title })}
        off={act.busy === item.id}
        onPress={() => act.onMark(item, 'start')}
        testID={`run.start.${item.id}`}
      />
    );
  if (phase === 'now')
    return (
      <PrimaryButton
        label={t('runView.finish')}
        accessibilityLabel={t('runView.finishNamed', { title: item.title })}
        busy={act.busy === item.id}
        onPress={() => act.onMark(item, 'finish')}
        testID={`run.finish.${item.id}`}
      />
    );

  return null;
}

function PhoneTrack({
  views,
  trackKey,
  onTrack,
  act,
}: {
  views: readonly TrackView[];
  trackKey: string;
  onTrack: (key: string) => void;
  act: ActProps;
}) {
  const { t } = useTranslation();
  const locale = dateLocale();
  const view = views.find((one) => one.key === trackKey) ?? views[0];

  if (view == null) return null;

  const { track } = view;
  const nowRows = track.rows.filter((row) => row.phase === 'now');
  const nextRow =
    track.next == null ? null : (track.rows.find((row) => row.item === track.next?.item) ?? null);
  const then = track.rows.filter((row) => row.phase === 'waiting' && row !== nextRow);
  const upper = (key: string) => t(key).toLocaleUpperCase(locale);

  return (
    <>
      {views.length > 1 && (
        <View style={styles.segments} accessibilityRole="tablist">
          {views.map((one) => (
            <Pressable
              key={one.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: one.key === view.key }}
              onPress={() => onTrack(one.key)}
              style={[styles.segment, one.key === view.key && styles.segmentOn]}
              testID={`run.track.${one.key}`}
            >
              <Text
                size={15}
                weight="semibold"
                style={one.key === view.key ? styles.accentText : styles.secondary}
              >
                {said(t, one.name)}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
      <View style={styles.card}>
        <TrackTop view={view} />
      </View>
      <View style={styles.card}>
        <Text size={13} weight="semibold" style={styles.secondary}>
          {upper('runView.now')}
        </Text>
        {nowRows.length === 0 ? (
          <Text size={18} weight="semibold" style={styles.secondary}>
            {track.figure.kind === 'done' ? t('runView.allDone') : t('runView.nothingNow')}
          </Text>
        ) : (
          nowRows.map((nowRow, index) => (
            <View key={nowRow.item.id} style={[styles.nowItem, index > 0 && styles.nowAlso]}>
              <ItemLine row={nowRow} />
              <Text size={14} style={styles.secondary}>
                {t('runView.nowLine', {
                  started: formatWallClock(
                    wallOfZoned(nowRow.item.startedAt ?? nowRow.item.planned),
                    locale,
                  ),
                  planned: formatWallClock(wallOfZoned(nowRow.item.planned), locale),
                  lasts: lastsOf(nowRow.item, t),
                })}
              </Text>
              {nowRow.startedBefore != null && (
                <Text size={14} style={styles.secondary}>
                  {t('runView.startedBefore', { title: nowRow.startedBefore.title })}
                </Text>
              )}
              <Text
                size={14}
                style={nowRow.item.ownerName == null ? styles.none : styles.secondary}
              >
                {nowRow.item.ownerName ?? t('runView.noOwner')}
              </Text>
              <Act row={nowRow} act={act} />
            </View>
          ))
        )}
      </View>
      {nextRow != null && track.next != null && (
        <View style={styles.card}>
          <Text size={13} weight="semibold" style={styles.secondary}>
            {upper('runView.next')}
          </Text>
          <ItemLine row={nextRow} />
          <View style={styles.itemLine} accessible accessibilityLabel={startsSaid(nextRow, t)}>
            <Text size={16} weight="semibold" style={styles.num}>
              {formatWallClock(wallOfZoned(nextRow.item.planned), locale)}
            </Text>
            {nextRow.expected != null && (
              <Text size={16} weight="semibold" style={[styles.num, styles.attention]}>
                {t('runView.arrowAbout', timeSlot(nextRow.expected, locale))}
              </Text>
            )}
          </View>
          <Text size={14} style={styles.secondary}>
            {t('runView.lastsAndOwner', {
              lasts: lastsOf(nextRow.item, t),
              owner: nextRow.item.ownerName ?? t('runView.noOwner'),
            })}
          </Text>
          <Act row={nextRow} act={act} />
        </View>
      )}
      {track.figure.kind !== 'done' && (
        <View style={styles.card}>
          <Text size={13} weight="semibold" style={styles.secondary}>
            {upper('runView.then')}
          </Text>
          {then.length === 0 ? (
            <Text size={15} style={styles.secondary}>
              {t('runView.nothingAfter')}
            </Text>
          ) : (
            then.map((row) => (
              <View key={row.item.id} style={styles.thenRow}>
                <View style={styles.thenTime} accessible accessibilityLabel={startsSaid(row, t)}>
                  <Text size={15} weight="semibold" style={styles.num}>
                    {formatWallClock(wallOfZoned(row.item.planned), locale)}
                  </Text>
                  <Second row={row} size={12} />
                </View>
                <View style={styles.grow}>
                  <ItemLine row={row} />
                  <Text
                    size={13}
                    style={row.item.lengthMinutes == null ? styles.none : styles.secondary}
                  >
                    {lastsOf(row.item, t)}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  body: { gap: tokens.spaceLg },
  accentText: { color: tokens.colorAccentText },
  secondary: { color: tokens.colorInkSecondary },
  attention: { color: tokens.colorAttentionText },
  none: { color: tokens.colorInkSecondary, fontStyle: 'italic' },
  num: { fontVariant: ['tabular-nums'] },
  grow: { flex: 1, minWidth: 0 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceMd },
  clock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceXs,
    paddingHorizontal: tokens.spaceMd,
    minHeight: tokens.sizePill,
    borderRadius: tokens.radiusPill,
    backgroundColor: tokens.colorInset,
  },
  card: {
    gap: tokens.spaceMd,
    padding: tokens.spaceLg,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
    borderRadius: tokens.radiusCardPhone,
    backgroundColor: tokens.colorCard,
  },
  trackTop: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: tokens.spaceMd },
  figure: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceXs,
    minHeight: tokens.sizePill,
    paddingHorizontal: tokens.spaceMd,
    borderRadius: tokens.radiusPill,
    borderWidth: 1.5,
  },
  figureOn: { backgroundColor: tokens.colorAccent, borderColor: tokens.colorAccent },
  figureBehind: {
    backgroundColor: tokens.colorAttentionTint,
    borderColor: tokens.colorAttentionBorder,
  },
  figureLast: {
    backgroundColor: tokens.colorAccentTint,
    borderColor: tokens.colorAccentTintBorder,
  },
  collision: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spaceSm,
    padding: tokens.spaceMd,
    borderWidth: 1,
    borderColor: tokens.colorAttentionBorder,
    borderRadius: tokens.radiusInset,
    backgroundColor: tokens.colorAttentionTint,
  },
  tableHead: {
    flexDirection: 'row',
    gap: tokens.spaceMd,
    paddingBottom: tokens.spaceXs,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colorBorder,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spaceMd,
    paddingVertical: tokens.spaceSm,
    paddingHorizontal: tokens.spaceXs,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colorBorder,
  },
  rowNow: { backgroundColor: tokens.colorAccentTint, borderRadius: tokens.radiusSmall },
  startsCol: { width: 144 },
  lastsCol: { width: 104 },
  ownerCol: { width: 150 },
  ownerNarrow: { width: 112 },
  actCol: { width: 104, alignItems: 'flex-end' },
  itemLine: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: tokens.spaceSm },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceXxs,
    paddingHorizontal: tokens.spaceSm,
    paddingVertical: tokens.spaceHair,
    borderRadius: tokens.radiusPill,
  },
  tagNow: {
    borderWidth: 1,
    borderColor: tokens.colorAccentTintBorder,
    backgroundColor: tokens.colorCard,
  },
  tagFixed: {
    borderWidth: 1,
    borderColor: tokens.colorInsetBorder,
    backgroundColor: tokens.colorInset,
  },
  segments: {
    flexDirection: 'row',
    gap: tokens.spaceHair,
    padding: tokens.spaceHair,
    borderRadius: tokens.radiusPill,
    backgroundColor: tokens.colorInset,
  },
  segment: {
    flex: 1,
    minHeight: tokens.sizeHit,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.radiusPill,
  },
  segmentOn: { backgroundColor: tokens.colorCard },
  thenRow: {
    flexDirection: 'row',
    gap: tokens.spaceMd,
    paddingVertical: tokens.spaceSm,
    borderTopWidth: 1,
    borderTopColor: tokens.colorBorder,
  },
  thenTime: { width: 112 },
  nowItem: { gap: tokens.spaceMd },
  nowAlso: {
    paddingTop: tokens.spaceMd,
    borderTopWidth: 1,
    borderTopColor: tokens.colorBorder,
  },
  nextLine: { paddingTop: tokens.spaceSm },
  lock: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm },
});

const COLUMN = [styles.startsCol, styles.lastsCol, styles.grow, styles.ownerCol];
