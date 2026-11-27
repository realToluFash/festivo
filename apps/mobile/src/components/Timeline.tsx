import {
  comingUpPanel,
  formatEventClock,
  type EventTimeline,
  type MarkedMilestone,
  markedMilestones,
  type MilestoneOwner,
  namesZone,
  milestoneMoment,
  neverReached,
  serverClock,
  shownBeside,
} from '@soirely/domain';
import { type EventStatus, type OrganisationEvent } from '@soirely/api-client';
import { type RefObject, useEffect, useState } from 'react';
import { PixelRatio, Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import { dateLocale } from '../i18n/index.ts';
import { SMALL_LINE, TITLE_LINE, rowsFloor } from '../layout/textSize.ts';
import { type LayoutKind } from '../layout/useLayout.ts';
import { type ScreenOffline, useHandOffline, useOffline } from '../offline.ts';
import { afterFailedLoad } from '../offlineLoad.ts';
import { tokens } from '../theme/tokens.ts';
import { QuietButton, SecondaryButton } from './Buttons.tsx';
import { Notice } from './Notice.tsx';
import { moveScreenReaderFocus } from './screenReaderFocus.ts';
import { Text, type TextHandle } from './Text.tsx';
import { cardFrame } from './cardFrame.ts';
import { distanceWords } from '../kit/distanceWords.ts';
import { Arrived, Skeleton } from './Skeleton.tsx';
import { rereadOrganisations } from '../signedIn.ts';

type Load =
  | { kind: 'loading' }
  | { kind: 'failed' }
  | {
      kind: 'loaded';
      timeline: EventTimeline;
      status: EventStatus;
      event: OrganisationEvent;
      at: Date;
    };

const OWNER_WORD: Record<MilestoneOwner, string> = {
  event: 'timeline.owner_event',
  you: 'timeline.owner_you',
  automatic: 'timeline.owner_automatic',
};

const OWNER_KEY: Record<MilestoneOwner, string> = {
  event: 'timeline.key_event',
  you: 'timeline.key_you',
  automatic: 'timeline.key_automatic',
};

const FAILED: Load = { kind: 'failed' };

const OWNER_SHAPE: Record<MilestoneOwner, string> = { event: '▦', you: '●', automatic: '→' };

const HIDDEN = { accessibilityElementsHidden: true, importantForAccessibility: 'no' } as const;

/** How the dates sit with the screen's band, whose Try again reads them again either way (sc-27086, sc-98386): on All dates they are the screen's load, read through its watch, whose verdict says what a failed read leaves; on the Overview the band is the event's, so they read beside it and keep what they showed only while that band is up. */
export type Watched =
  | { watch: <T>(load: Promise<T>) => Promise<T>; refresh: number }
  | { underBand: boolean; refresh: number };

export interface TimelineRead {
  load: Load;
  now: Date;
  ended: boolean;
  retried: boolean;
  retry: () => void;
}

/** One read of the dates, told apart by what starts it; `kept` holds only while the read that never reached Soirely is the one out or last finished, so a read still out shows what it loaded whatever the band does. */
interface Read {
  eventId: string;
  event: OrganisationEvent | undefined;
  attempt: number;
  watch: (<T>(load: Promise<T>) => Promise<T>) | null;
  refresh: number;
}

function sameRead(a: Read, b: Read): boolean {
  return (
    a.eventId === b.eventId &&
    a.event === b.event &&
    a.attempt === b.attempt &&
    a.watch === b.watch &&
    a.refresh === b.refresh
  );
}

/** Read again whenever the page's event is replaced, so a save that moves a date (Reply by, the start) or a Call off shows its dates without a reload; judged by a clock no older than the read, so a date it stamped is never still ahead. */
export function useTimeline(
  eventId: string,
  now: Date,
  event?: OrganisationEvent,
  watched?: Watched,
): TimelineRead {
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [unreached, setUnreached] = useState<Read | null>(null);
  const [attempt, setAttempt] = useState(0);
  const watch = watched != null && 'watch' in watched ? watched.watch : null;
  const underBand = watched != null && 'underBand' in watched ? watched.underBand : true;
  const refresh = watched?.refresh ?? 0;

  useEffect(() => {
    let live = true;
    const read: Read = { eventId, event, attempt, watch, refresh };
    const answers = Promise.all([api.eventTimeline(eventId), event ?? api.event(eventId)]);

    (watch == null ? answers : watch(answers)).then(
      ([timeline, standing]) => {
        if (!live) return;
        setLoad({
          kind: 'loaded',
          timeline,
          status: standing.status,
          event: standing,
          at: serverClock.now(),
        });
      },
      (error: unknown) => {
        if (!live) return;
        const unreached = watch == null ? neverReached : undefined;
        setLoad((was) => afterFailedLoad(was, error, FAILED, unreached));
        setUnreached(watch == null && neverReached(error) ? read : null);
      },
    );

    return () => {
      live = false;
    };
  }, [eventId, event, attempt, watch, refresh]);

  const kept =
    unreached != null && sameRead(unreached, { eventId, event, attempt, watch, refresh });
  const shown = shownBeside(load, kept, underBand, FAILED);

  return {
    load: shown,
    now: shown.kind === 'loaded' && shown.at > now ? shown.at : now,
    ended: (event?.status ?? (shown.kind === 'loaded' ? shown.status : null)) === 'ended',
    retried: attempt > 0,
    retry: () => {
      setLoad({ kind: 'loading' });
      setAttempt((n) => n + 1);
    },
  };
}

function readerZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/** The event page's panel: the next four, or why there are none, in rows held at one height; while it is on with none, when it ends, as Today's live cover says it (sc-93858). The page reads the timeline, which its card needs too. */
export function ComingUp({
  kind,
  timeline,
  onAllDates,
}: {
  kind: LayoutKind;
  timeline: TimelineRead;
  onAllDates: () => void;
}) {
  const { t } = useTranslation();
  const { fontScale } = useWindowDimensions();
  const { load, now, ended, retried, retry } = timeline;
  const panel =
    load.kind === 'loaded'
      ? comingUpPanel(
          { ...load.event, status: ended ? 'ended' : load.status },
          load.timeline.milestones,
          now,
        )
      : null;

  return (
    <View style={cardFrame(kind)} testID="timeline.comingUp">
      <View style={styles.head}>
        <Text size={tokens.typeTitleSection.size} weight="bold" accessibilityRole="header">
          {t('timeline.comingUp')}
        </Text>
        {load.kind === 'failed' ? (
          <View style={styles.linkHeld} {...HIDDEN}>
            <Text size={tokens.typeButton.size} weight="semibold">
              {t('timeline.allDates')}
            </Text>
          </View>
        ) : (
          <QuietButton
            label={t('timeline.allDates')}
            onPress={onAllDates}
            testID="timeline.allDates"
          />
        )}
      </View>
      <View
        style={{
          minHeight: rowsFloor(fontScale, Platform.OS === 'android' ? PixelRatio.get() : null),
        }}
      >
        {load.kind === 'loading' && <DatesLoading testID="timeline.comingUp.loading" />}
        {load.kind === 'failed' && (
          <DatesFailed
            announced={retried}
            onRetry={retry}
            wide={kind === 'phone'}
            testID="timeline.comingUp.retry"
          />
        )}
        {load.kind === 'loaded' && panel?.kind === 'endsToday' && (
          <View style={styles.inset} testID="timeline.endsToday">
            <Text size={tokens.typeBodyPhone.size} muted style={styles.insetWords}>
              {t('todayScreen.endsToday', {
                time: formatEventClock(load.event.endsAt, load.event.timeZone, dateLocale()),
              })}
            </Text>
          </View>
        )}
        {load.kind === 'loaded' && panel?.kind === 'finished' && (
          <View style={styles.inset} testID="timeline.finished">
            <Text size={tokens.typeBodyPhone.size} muted {...HIDDEN}>
              {tokens.marks.done.glyph}
            </Text>
            <Text size={tokens.typeBodyPhone.size} muted style={styles.insetWords}>
              {t('timeline.finished')}
            </Text>
          </View>
        )}
        {load.kind === 'loaded' && panel?.kind === 'rows' && (
          <Arrived>
            {panel.rows.map((marked, index) => (
              <MilestoneRow
                key={index}
                marked={marked}
                timeZone={load.timeline.timeZone}
                now={now}
                distance
                first={index === 0}
              />
            ))}
          </Arrived>
        )}
      </View>
    </View>
  );
}

/** Every milestone, earliest first, under the line naming the event's zone; `onOffline` hands the screen its band and Refreshing…, `heading` takes focus once Try again answers (sc-27086). */
export function AllDates({
  kind,
  eventId,
  now: tick,
  heading,
  onOffline,
  onEvent,
}: {
  kind: LayoutKind;
  eventId: string;
  now: Date;
  heading: RefObject<TextHandle | null>;
  onOffline: (offline: ScreenOffline) => void;
  onEvent: (event: OrganisationEvent) => void;
}) {
  const { t } = useTranslation();
  const [refresh, setRefresh] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const { watch, stale, refreshing } = useOffline({
    loaded,
    reload: () => setRefresh((n) => n + 1),
    focusTitle: () => moveScreenReaderFocus(heading.current),
  });
  const { load, now, ended, retried, retry } = useTimeline(eventId, tick, undefined, {
    watch,
    refresh,
  });
  if (loaded !== (load.kind === 'loaded')) setLoaded(load.kind === 'loaded');
  const event = load.kind === 'loaded' ? load.event : null;

  useEffect(() => {
    if (event != null) onEvent(event);
  }, [event, onEvent]);

  useHandOffline(onOffline, { stale, refreshing });

  return (
    <View style={cardFrame(kind)} testID="timeline.allDates.page">
      {load.kind === 'loading' && <DatesLoading testID="timeline.allDates.loading" />}
      {load.kind === 'failed' && (
        <DatesFailed announced={retried} onRetry={retry} testID="timeline.allDates.retry" />
      )}
      {load.kind === 'loaded' && (
        <Arrived style={styles.allDates}>
          <Text size={tokens.typeBodyPhone.size} muted>
            {t('timeline.intro', { timeZone: load.timeline.timeZone })}
          </Text>
          <View>
            {markedMilestones(load.timeline.milestones, now, ended).map((marked, index) => (
              <MilestoneRow
                key={index}
                marked={marked}
                timeZone={load.timeline.timeZone}
                now={now}
                distance={false}
                first={index === 0}
              />
            ))}
          </View>
          <View style={styles.key}>
            {(['event', 'you', 'automatic'] as const).map((owner) => (
              <View key={owner} style={styles.keyEntry}>
                <OwnerPill owner={owner} />
                <Text size={tokens.typeSmall.size} muted>
                  {t(OWNER_KEY[owner])}
                </Text>
              </View>
            ))}
          </View>
        </Arrived>
      )}
    </View>
  );
}

export function DatesLoading({ testID }: { testID: string }) {
  const { t } = useTranslation();

  return (
    <View testID={testID}>
      <Skeleton words={t('timeline.loading')} shape="rows" rowHeight={56} rows={3} inCard />
    </View>
  );
}

/** Said aloud only when a retry fails: on arrival the page's own heading comes first. */
export function DatesFailed({
  announced,
  onRetry,
  wide = false,
  testID,
}: {
  announced: boolean;
  onRetry: () => void;
  wide?: boolean;
  testID: string;
}) {
  const { t } = useTranslation();

  return (
    <View style={styles.failed}>
      <Notice
        tone="broken"
        mark={tokens.marks.broken.glyph}
        body={t('timeline.failed')}
        announce={announced}
      />
      <SecondaryButton
        label={t('timeline.retry')}
        onPress={() => {
          void rereadOrganisations();
          onRetry();
        }}
        stacked={wide}
        testID={testID}
      />
    </View>
  );
}

function MilestoneRow({
  marked,
  timeZone,
  now,
  distance,
  first,
}: {
  marked: MarkedMilestone;
  timeZone: string;
  now: Date;
  distance: boolean;
  first: boolean;
}) {
  const { t } = useTranslation();
  const { milestone, standing, nextUp } = marked;
  const passed = standing === 'passed';
  const moment = milestoneMoment(milestone.at, timeZone, now, dateLocale());
  const when =
    distance && namesZone(timeZone, readerZone())
      ? t('timeline.momentInZone', { moment, timeZone })
      : moment;

  return (
    <View style={[styles.row, !first && styles.rowDivider]} testID="timeline.row">
      <Text size={tokens.typeSmall.size} muted style={[styles.smallLine, passed && styles.passed]}>
        {distance ? `${when} · ${distanceWords(t, milestone.at, timeZone, now)}` : when}
      </Text>
      <Text
        size={tokens.typeRowTitle.size}
        weight="semibold"
        style={[styles.titleLine, passed && styles.passed]}
      >
        {milestone.title}
      </Text>
      <View style={styles.marks}>
        <OwnerPill owner={milestone.owner} />
        {passed && (
          <Pill tone="quiet" shape={tokens.marks.done.glyph} word={t('timeline.passed')} />
        )}
        {standing === 'overdue' && <Pill tone="broken" shape="⚠" word={t('timeline.overdue')} />}
        {nextUp && <Pill tone="accent" shape={null} word={t('timeline.nextUp')} />}
      </View>
      {milestone.note != null && (
        <Text
          size={tokens.typeSmall.size}
          muted
          style={[styles.smallLine, passed && styles.passed]}
        >
          {milestone.note}
        </Text>
      )}
    </View>
  );
}

function OwnerPill({ owner }: { owner: MilestoneOwner }) {
  const { t } = useTranslation();

  return (
    <Pill
      tone={owner === 'you' ? 'attention' : 'quiet'}
      shape={OWNER_SHAPE[owner]}
      word={t(OWNER_WORD[owner])}
    />
  );
}

type PillTone = 'quiet' | 'accent' | 'attention' | 'broken';

function Pill({ tone, shape, word }: { tone: PillTone; shape: string | null; word: string }) {
  return (
    <View style={[styles.pill, PILL[tone].fill]}>
      {shape != null && (
        <Text size={tokens.typeSmall.size} style={[styles.smallLine, PILL[tone].ink]} {...HIDDEN}>
          {shape}
        </Text>
      )}
      <Text
        size={tokens.typeSmall.size}
        weight="semibold"
        style={[styles.smallLine, PILL[tone].ink]}
      >
        {word}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  allDates: { gap: tokens.spaceLg },
  head: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spaceSm,
  },
  // While the dates fail there is no All dates button, but its box stays, so the head keeps its height.
  linkHeld: { minHeight: tokens.sizeHit, justifyContent: 'center', opacity: 0 },
  row: { gap: tokens.spaceXxs, paddingVertical: tokens.spaceMd },
  rowDivider: { borderTopWidth: 1, borderTopColor: tokens.colorInsetBorder },
  // Set rather than left to the face, so rowsFloor is the height two rows take on every platform.
  smallLine: { lineHeight: SMALL_LINE },
  titleLine: { lineHeight: TITLE_LINE },
  passed: { color: tokens.colorInkTertiary },
  marks: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spaceXs },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceXxs,
    paddingHorizontal: tokens.spaceSm,
    paddingVertical: tokens.spaceXxs,
    borderRadius: tokens.radiusPill,
  },
  inset: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceSm,
    padding: tokens.spaceLg,
    borderRadius: tokens.radiusInset,
    backgroundColor: tokens.colorInset,
  },
  insetWords: { flex: 1 },
  failed: { gap: tokens.spaceMd },
  key: { gap: tokens.spaceSm },
  keyEntry: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: tokens.spaceSm },
});

const PILL = {
  quiet: StyleSheet.create({
    fill: { backgroundColor: tokens.colorInset },
    ink: { color: tokens.colorInkSecondary },
  }),
  accent: StyleSheet.create({
    fill: { backgroundColor: tokens.colorAccentTint },
    ink: { color: tokens.colorAccentText },
  }),
  attention: StyleSheet.create({
    fill: { backgroundColor: tokens.colorAttentionTint },
    ink: { color: tokens.colorAttentionText },
  }),
  broken: StyleSheet.create({
    fill: { backgroundColor: tokens.colorBrokenTint },
    ink: { color: tokens.colorBrokenText },
  }),
};
