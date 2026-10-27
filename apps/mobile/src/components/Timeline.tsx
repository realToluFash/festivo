import {
  comingUp,
  type EventTimeline,
  formatEventMoment,
  type MarkedMilestone,
  markedMilestones,
  type MilestoneOwner,
  namesZone,
} from '@soirely/domain';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import { dateLocale } from '../i18n/index.ts';
import { type LayoutKind } from '../layout/useLayout.ts';
import { tokens } from '../theme/tokens.ts';
import { QuietButton, SecondaryButton } from './Buttons.tsx';
import { Notice } from './Notice.tsx';
import { Text } from './Text.tsx';
import { cardFrame } from './cardFrame.ts';
import { distanceWords } from '../kit/eventsHome.ts';

type Load = { kind: 'loading' } | { kind: 'failed' } | { kind: 'loaded'; timeline: EventTimeline };

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

function useTimeline(eventId: string): { load: Load; retried: boolean; retry: () => void } {
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;

    api.eventTimeline(eventId).then(
      (timeline) => live && setLoad({ kind: 'loaded', timeline }),
      () => live && setLoad({ kind: 'failed' }),
    );

    return () => {
      live = false;
    };
  }, [eventId, attempt]);

  return {
    load,
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
  eventId,
  now,
  onFullSchedule,
}: {
  kind: LayoutKind;
  eventId: string;
  now: Date;
  onFullSchedule: () => void;
}) {
  const { t } = useTranslation();
  const { load, retried, retry } = useTimeline(eventId);
  const shown = load.kind === 'loaded' ? comingUp(load.timeline.milestones, now) : [];

  return (
    <View style={cardFrame(kind)} testID="timeline.comingUp">
      <View style={styles.head}>
        <Text size={tokens.typeTitleSection.size} weight="bold" accessibilityRole="header">
          {t('timeline.comingUp')}
        </Text>
        {load.kind === 'loaded' && (
          <QuietButton
            label={t('timeline.fullSchedule')}
            onPress={onFullSchedule}
            testID="timeline.fullSchedule"
          />
        )}
      </View>
      <View style={kind === 'phone' ? styles.rowsPhone : styles.rows}>
        {load.kind === 'failed' && (
          <ScheduleFailed announced={retried} onRetry={retry} testID="timeline.comingUp.retry" />
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
export function FullSchedule({
  kind,
  eventId,
  now,
}: {
  kind: LayoutKind;
  eventId: string;
  now: Date;
}) {
  const { t } = useTranslation();
  const { load, retried, retry } = useTimeline(eventId);

  return (
    <View style={cardFrame(kind)} testID="timeline.fullSchedule.page">
      {load.kind === 'loading' && (
        <Text size={tokens.typeBodyPhone.size} muted>
          {t('timeline.loading')}
        </Text>
      )}
      {load.kind === 'failed' && (
        <ScheduleFailed announced={retried} onRetry={retry} testID="timeline.fullSchedule.retry" />
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

/** Said aloud only when a retry fails: on arrival the page's own heading comes first. */
function ScheduleFailed({
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
        {distance ? `${when} · ${distanceWords(milestone.at, timeZone, now, t)}` : when}
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
