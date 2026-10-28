import {
  comingUp,
  type EventTimeline,
  formatEventMoment,
  type MarkedMilestone,
  markedMilestones,
  type MilestoneOwner,
  namesZone,
  serverClock,
} from '@soirely/domain';
import { type EventStatus, type OrganisationEvent } from '@soirely/api-client';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import { dateLocale } from '../i18n/index.ts';
import { type LayoutKind } from '../layout/useLayout.ts';
import { tokens } from '../theme/tokens.ts';
import { QuietButton, SecondaryButton } from './Buttons.tsx';
import { Notice } from './Notice.tsx';
import { Text } from './Text.tsx';
import { cardFrame } from './cardFrame.ts';
import { distanceWords } from '../kit/distanceWords.ts';

type Load =
  { kind: 'loading' } | { kind: 'failed' } | { kind: 'loaded'; timeline: EventTimeline; at: Date };

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

const OWNER_SHAPE: Record<MilestoneOwner, string> = { event: '▦', you: '●', automatic: '→' };

const HIDDEN = { accessibilityElementsHidden: true, importantForAccessibility: 'no' } as const;

/** Read again when the event's status moves, so a Call off or End now shows its dates without a reload; judged by a clock no older than the read, so a date it stamped is never still ahead. */
function useTimeline(
  eventId: string,
  now: Date,
  status?: EventStatus,
): { load: Load; now: Date; retried: boolean; retry: () => void } {
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;

    api.eventTimeline(eventId).then(
      (timeline) => live && setLoad({ kind: 'loaded', timeline, at: serverClock.now() }),
      () => live && setLoad({ kind: 'failed' }),
    );

    return () => {
      live = false;
    };
  }, [eventId, status, attempt]);

  return {
    load,
    now: load.kind === 'loaded' && load.at > now ? load.at : now,
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

/** The event page's panel: the next four, or why there are none, in rows held at one height. */
export function ComingUp({
  kind,
  event,
  now: tick,
  onAllDates,
}: {
  kind: LayoutKind;
  event: OrganisationEvent;
  now: Date;
  onAllDates: () => void;
}) {
  const { t } = useTranslation();
  const { load, now, retried, retry } = useTimeline(event.id, tick, event.status);
  const shown =
    load.kind === 'loaded' ? comingUp(load.timeline.milestones, now, event.status === 'ended') : [];

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
      <View style={kind === 'phone' ? styles.rowsPhone : styles.rows}>
        {load.kind === 'loading' && <DatesLoading testID="timeline.comingUp.loading" />}
        {load.kind === 'failed' && (
          <DatesFailed announced={retried} onRetry={retry} testID="timeline.comingUp.retry" />
        )}
        {load.kind === 'loaded' && shown.length === 0 && (
          <View style={styles.inset} testID="timeline.finished">
            <Text size={tokens.typeBodyPhone.size} muted {...HIDDEN}>
              {tokens.marks.done.glyph}
            </Text>
            <Text size={tokens.typeBodyPhone.size} muted style={styles.insetWords}>
              {t('timeline.finished')}
            </Text>
          </View>
        )}
        {load.kind === 'loaded' &&
          shown.map((marked, index) => (
            <MilestoneRow
              key={index}
              marked={marked}
              timeZone={load.timeline.timeZone}
              now={now}
              distance
              first={index === 0}
            />
          ))}
      </View>
    </View>
  );
}

/** Every milestone, earliest first, under the line naming the event's zone. */
export function AllDates({
  kind,
  eventId,
  now: tick,
}: {
  kind: LayoutKind;
  eventId: string;
  now: Date;
}) {
  const { t } = useTranslation();
  const { load, now, retried, retry } = useTimeline(eventId, tick);

  return (
    <View style={cardFrame(kind)} testID="timeline.allDates.page">
      {load.kind === 'loading' && <DatesLoading testID="timeline.allDates.loading" />}
      {load.kind === 'failed' && (
        <DatesFailed announced={retried} onRetry={retry} testID="timeline.allDates.retry" />
      )}
      {load.kind === 'loaded' && (
        <>
          <Text size={tokens.typeBodyPhone.size} muted>
            {t('timeline.intro', { timeZone: load.timeline.timeZone })}
          </Text>
          <View>
            {markedMilestones(load.timeline.milestones, now).map((marked, index) => (
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
        </>
      )}
    </View>
  );
}

function DatesLoading({ testID }: { testID: string }) {
  const { t } = useTranslation();

  return (
    <View style={styles.inset} testID={testID}>
      <ActivityIndicator color={tokens.colorAccent} {...HIDDEN} />
      <Text size={tokens.typeBodyPhone.size} muted style={styles.insetWords}>
        {t('timeline.loading')}
      </Text>
    </View>
  );
}

/** Said aloud only when a retry fails: on arrival the page's own heading comes first. */
function DatesFailed({
  announced,
  onRetry,
  testID,
}: {
  announced: boolean;
  onRetry: () => void;
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
      <SecondaryButton label={t('timeline.retry')} onPress={onRetry} testID={testID} />
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
  const moment = formatEventMoment(milestone.at, timeZone, dateLocale());
  const when =
    distance && namesZone(timeZone, readerZone())
      ? t('timeline.momentInZone', { moment, timeZone })
      : moment;

  return (
    <View style={[styles.row, !first && styles.rowDivider]} testID="timeline.row">
      <Text size={tokens.typeSmall.size} muted style={passed && styles.passed}>
        {distance ? `${when} · ${distanceWords(t, milestone.at, timeZone, now)}` : when}
      </Text>
      <Text size={tokens.typeRowTitle.size} weight="semibold" style={passed && styles.passed}>
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
        <Text size={tokens.typeSmall.size} muted style={passed && styles.passed}>
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
        <Text size={tokens.typeSmall.size} style={PILL[tone].ink} {...HIDDEN}>
          {shape}
        </Text>
      )}
      <Text size={tokens.typeSmall.size} weight="semibold" style={PILL[tone].ink}>
        {word}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spaceSm,
  },
  // While the dates fail there is no All dates button, but its box stays, so the head keeps its height.
  linkHeld: { minHeight: tokens.sizeHit, justifyContent: 'center', opacity: 0 },
  // Held at the height of the event's own two milestones, so the panels below do not move between states.
  rows: { minHeight: 140 },
  rowsPhone: { minHeight: 178 },
  row: { gap: tokens.spaceXxs, paddingVertical: tokens.spaceMd },
  rowDivider: { borderTopWidth: 1, borderTopColor: tokens.colorInsetBorder },
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
