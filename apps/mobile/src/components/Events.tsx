import type { OrganisationEvent } from '@soirely/api-client';
import {
  type EventPhase,
  calledOff,
  formatEventDate,
  formatEventRange,
  shownPhase,
} from '@soirely/domain';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { dateLocale } from '../i18n/index.ts';
import { PHASE_WORD } from '../kit/makeLive.ts';
import { useLoadedAt, useServerNow } from '../kit/serverNow.ts';
import { type LayoutKind } from '../layout/useLayout.ts';
import { tokens } from '../theme/tokens.ts';
import { PrimaryButton, SecondaryButton } from './Buttons.tsx';
import { DeleteEventSection } from './DeleteEvent.tsx';
import { EventCover } from './EventCover.tsx';
import { MuteEventCard } from './MuteEventCard.tsx';
import { EndRow } from './EndEvent.tsx';
import { DraftRow } from './MakeLive.tsx';
import { PauseButton, PausedRow } from './PauseEvent.tsx';
import { Notice } from './Notice.tsx';
import { readOut } from './ReadOut.tsx';
import { StepMark } from './StepMark.tsx';
import { Text } from './Text.tsx';
import { ComingUp } from './Timeline.tsx';
import { cardFrame } from './cardFrame.ts';

/** The phase the page shows: the server's, flipped by the corrected clock at the start and the end (sc-3585). */
function useShownPhase(event: OrganisationEvent, now: Date): EventPhase {
  return shownPhase(event, useLoadedAt(event), now);
}

/** A word and a shape, never colour alone (WCAG 2.2 §1.4.1); the pill grows with its word. */
export function EventState({ phase }: { phase: EventPhase }) {
  const { t } = useTranslation();
  const live = phase === 'live';

  return (
    <View style={[styles.state, live && styles.stateLive]} testID={`events.phase.${phase}`}>
      <PhaseShape phase={phase} />
      <Text
        size={tokens.typeSmall.size}
        weight="semibold"
        style={live ? styles.stateWordLive : styles.stateWord}
      >
        {t(PHASE_WORD[phase])}
      </Text>
    </View>
  );
}

/** Draft an empty circle, Live a green dot, Happening now a half-filled circle, Paused two bars, Finished a tick. */
function PhaseShape({ phase }: { phase: EventPhase }) {
  const hidden = { accessibilityElementsHidden: true, importantForAccessibility: 'no' } as const;

  switch (phase) {
    case 'draft':
      return <View style={styles.ring} {...hidden} />;
    case 'live':
      return <View style={styles.dot} {...hidden} />;
    case 'happening_now':
      return (
        <View style={[styles.ring, styles.ringNow]} {...hidden}>
          <View style={styles.halfNow} />
        </View>
      );
    case 'paused':
      return (
        <View style={styles.bars} {...hidden}>
          <View style={styles.bar} />
          <View style={styles.bar} />
        </View>
      );
    case 'finished':
      return (
        <Text
          size={tokens.typeSmall.size}
          weight="bold"
          style={styles.stateWord}
          {...hidden}
          accessible={false}
        >
          ✓
        </Text>
      );
  }
}

function EventType({ event, size }: { event: OrganisationEvent; size: number }) {
  const { t } = useTranslation();

  return (
    <Text size={size} muted>
      {t(`eventTypes.${event.type}`)}
    </Text>
  );
}

const FIRST_RUN_STEPS = [
  'eventsScreen.firstRunStepName',
  'eventsScreen.firstRunStepDefaults',
  'eventsScreen.firstRunStepOpen',
] as const;

export function NoEvents({
  kind,
  onCreate,
}: {
  kind: LayoutKind;
  /** Absent for a role without Create events, which reads where events will come from. */
  onCreate?: (() => void) | undefined;
}) {
  const { t } = useTranslation();

  return (
    <View style={[cardFrame(kind), styles.across]} testID="events.firstRun">
      <Text size={tokens.typeRowTitle.size} weight="semibold" accessibilityRole="header">
        {t('eventsScreen.firstRunTitle')}
      </Text>
      <View role="list" style={styles.stack}>
        {FIRST_RUN_STEPS.map((step, index) => (
          <View key={step} role="listitem" style={styles.firstRunStep}>
            <StepMark step={index + 1} state="later" />
            <Text size={tokens.typeBody.size} style={styles.stepText}>
              {t(step)}
            </Text>
          </View>
        ))}
      </View>
      {onCreate == null ? (
        <Notice
          tone="quiet"
          mark={tokens.marks.info.glyph}
          body={t('eventsScreen.firstRunAskOwner')}
        />
      ) : (
        <PrimaryButton
          label={t('eventsScreen.firstRunCreate')}
          onPress={onCreate}
          testID="events.none.new"
        />
      )}
    </View>
  );
}

export function EventsFailed({ onRetry, testID }: { onRetry: () => void; testID: string }) {
  const { t } = useTranslation();

  return (
    <View style={styles.stack} accessibilityRole="alert">
      <Notice
        tone="broken"
        mark={tokens.marks.broken.glyph}
        body={t('eventsScreen.failedLoad')}
        announce
      />
      <SecondaryButton label={t('eventsScreen.retry')} onPress={onRetry} testID={testID} />
    </View>
  );
}

/** The event's areas go under its times, each added by the story that builds it: none yet (sc-1454 adds Check-in). A Draft's row says what it blocks. */
export function EventPage({
  kind,
  event,
  manages,
  onChange,
  onEdit,
  onDuplicate,
  onDeleted,
}: {
  kind: LayoutKind;
  event: OrganisationEvent;
  manages: boolean;
  onChange: (event: OrganisationEvent) => void;
  /** Absent for a role without events.manage (sc-3595). */
  onEdit?: (() => void) | undefined;
  /** Absent for a role without events.create (sc-22145). */
  onDuplicate?: (() => void) | undefined;
  /** Absent for a role without events.create (sc-3592). */
  onDeleted?: ((event: OrganisationEvent) => void) | undefined;
}) {
  const { t } = useTranslation();
  const now = useServerNow();
  const phase = useShownPhase(event, now);
  const said = useRef({ id: event.id, phase });

  // A change of phase on an open page is said politely, never on arrival (WCAG 2.2 §4.1.3).
  useEffect(() => {
    if (said.current.id === event.id && said.current.phase !== phase) {
      readOut(t(PHASE_WORD[phase]));
    }
    said.current = { id: event.id, phase };
  }, [event.id, phase, t]);

  return (
    <View style={styles.cards}>
      <View style={cardFrame(kind)} testID="events.page">
        <EventCover cover={event.cover} type={event.type} testID="events.page.cover" />
        <View style={styles.pageHead}>
          <Text size={tokens.typeTitlePhone.size} weight="bold" accessibilityRole="header">
            {event.name}
          </Text>
          <EventState phase={phase} />
        </View>
        {calledOff(event) && event.concludedAt != null && (
          <Notice
            tone="quiet"
            mark={tokens.marks.info.glyph}
            body={t('eventEnd.calledOffNotice', {
              date: formatEventDate(event.concludedAt, event.timeZone, dateLocale()),
            })}
          />
        )}
        <DraftRow kind={kind} event={event} manages={manages} now={now} onChange={onChange} />
        <PausedRow event={event} phase={phase} manages={manages} onChange={onChange} />
        <View style={styles.lifecycle}>
          <PauseButton
            kind={kind}
            event={event}
            phase={phase}
            manages={manages}
            onChange={onChange}
          />
          <EndRow
            kind={kind}
            event={event}
            phase={phase}
            manages={manages}
            now={now}
            onChange={onChange}
          />
        </View>
        <EventType event={event} size={tokens.typeBody.size} />
        <Text size={tokens.typeBody.size}>
          {t('eventsScreen.when', {
            range: formatEventRange(event.startsAt, event.endsAt, event.timeZone, dateLocale()),
            timeZone: event.timeZone,
          })}
        </Text>
        {(onEdit != null || onDuplicate != null) && (
          <View style={styles.pageActions}>
            {onEdit != null && (
              <SecondaryButton
                label={t('eventEdit.open')}
                onPress={onEdit}
                testID="events.page.edit"
              />
            )}
            {onDuplicate != null && (
              <SecondaryButton
                label={t('eventDuplicate.open')}
                onPress={onDuplicate}
                testID="events.page.duplicate"
              />
            )}
          </View>
        )}
        <MuteEventCard kind={kind} eventId={event.id} />
        {onDeleted != null && (
          <DeleteEventSection kind={kind} event={event} onDeleted={onDeleted} />
        )}
      </View>
      <ComingUp
        kind={kind}
        event={event}
        now={now}
        onAllDates={() => router.push(`/events/${encodeURIComponent(event.id)}/dates`)}
      />
    </View>
  );
}

/** The same for an event in another organisation and one that does not exist, so it says nothing of which. */
export function EventNotFound({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();

  return (
    <View style={styles.stack} testID="events.notFound">
      <Notice
        tone="quiet"
        mark={tokens.marks.info.glyph}
        title={t('eventsScreen.notFound')}
        heading
      />
      <SecondaryButton
        label={t('eventsScreen.backToEvents')}
        onPress={onBack}
        testID="events.backToEvents"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: tokens.spaceMd },
  across: { maxWidth: '100%' },
  firstRunStep: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm },
  stepText: { flex: 1 },
  cards: { gap: tokens.spaceLg },
  pageHead: { gap: tokens.spaceXs },
  pageActions: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spaceSm },
  stateWord: { color: tokens.colorInkSecondary },
  stateLive: {
    borderColor: tokens.colorAccentTintBorder,
    backgroundColor: tokens.colorAccentTint,
  },
  stateWordLive: { color: tokens.colorAccentText },
  state: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceXs,
    paddingHorizontal: tokens.spaceSm,
    paddingVertical: tokens.spaceXxs,
    borderRadius: tokens.radiusField,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: tokens.radiusPill,
    backgroundColor: tokens.colorAccent,
  },
  ring: {
    width: 10,
    height: 10,
    borderRadius: tokens.radiusPill,
    borderWidth: 1.5,
    borderColor: tokens.colorMarkEmpty,
    overflow: 'hidden',
  },
  ringNow: { borderColor: tokens.colorAttention },
  halfNow: { width: '50%', height: '100%', backgroundColor: tokens.colorAttention },
  lifecycle: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: tokens.spaceMd },
  bars: { flexDirection: 'row', gap: 2 },
  bar: { width: 3, height: 10, borderRadius: 1, backgroundColor: tokens.colorAttention },
});
