import type { OrganisationEvent } from '@soirely/api-client';
import { type EventPhase, PHASE_LOOK, formatEventRange, shownPhase } from '@soirely/domain';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { dateLocale } from '../i18n/index.ts';
import type { EditAt } from '../kit/eventNav.ts';
import { PHASE_WORD } from '../kit/makeLive.ts';
import { useLoadedAt } from '../kit/serverNow.ts';
import { type LayoutKind } from '../layout/useLayout.ts';
import { tokens } from '../theme/tokens.ts';
import { PrimaryButton, SecondaryButton } from './Buttons.tsx';
import { DraftRow } from './MakeLive.tsx';
import { PausedRow } from './PauseEvent.tsx';
import { Notice } from './Notice.tsx';
import { Placeholder } from './Placeholder.tsx';
import { StatusChip } from './StatusChip.tsx';
import { StepMark } from './StepMark.tsx';
import { Text } from './Text.tsx';
import { cardFrame } from './cardFrame.ts';
import { rereadOrganisations } from '../signedIn.ts';

/** The phase the page shows: the server's, flipped by the corrected clock at the start and the end (sc-3585). */
export function useShownPhase(event: OrganisationEvent, now: Date): EventPhase {
  return shownPhase(event, useLoadedAt(event), now);
}

const NO_EVENT = {};

/** The same, for a screen whose event may not have loaded yet. */
export function usePhaseOf(event: OrganisationEvent | null, now: Date): EventPhase | null {
  const loadedAt = useLoadedAt(event ?? NO_EVENT);

  return event == null ? null : shownPhase(event, loadedAt, now);
}

export function EventState({ phase }: { phase: EventPhase }) {
  const { t } = useTranslation();

  return (
    <StatusChip
      look={PHASE_LOOK[phase]}
      word={t(PHASE_WORD[phase])}
      testID={`events.phase.${phase}`}
    />
  );
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
  createLabel,
  onCreate,
}: {
  kind: LayoutKind;
  createLabel?: string;
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
          label={createLabel ?? t('eventsScreen.firstRunCreate')}
          onPress={onCreate}
          testID="events.none.new"
        />
      )}
    </View>
  );
}

export function EventsFailed({
  words,
  onRetry,
  testID,
}: {
  words?: string;
  onRetry: () => void;
  testID: string;
}) {
  const { t } = useTranslation();

  return (
    <View style={styles.stack} accessibilityRole="alert">
      <Notice
        tone="broken"
        mark={tokens.marks.broken.glyph}
        body={words ?? t('eventsScreen.failedLoad')}
        announce
      />
      <PrimaryButton
        label={t('eventsScreen.retry')}
        onPress={() => {
          void rereadOrganisations();
          onRetry();
        }}
        testID={testID}
      />
    </View>
  );
}

/** Above every area: the name, the phase, the dates, the venue, and the phase's one primary (sc-22103). */
export function EventTop({
  kind,
  event,
  phase,
  manages,
  now,
  onChange,
  onEdit,
  onDuplicate,
}: {
  kind: LayoutKind;
  event: OrganisationEvent;
  phase: EventPhase;
  manages: boolean;
  now: Date;
  onChange?: ((event: OrganisationEvent) => void) | undefined;
  onEdit?: ((at?: EditAt) => void) | undefined;
  onDuplicate?: (() => void) | undefined;
}) {
  const { t } = useTranslation();
  const endPassed = phase === 'draft' && now.getTime() >= Date.parse(event.endsAt);

  return (
    <View style={[cardFrame(kind), styles.top]} testID="events.top">
      <View style={styles.pageHead}>
        <Text size={tokens.typeTitlePhone.size} weight="bold" accessibilityRole="header">
          {event.name}
        </Text>
        <EventState phase={phase} />
      </View>
      <EventType event={event} size={tokens.typeBody.size} />
      <Text size={tokens.typeBody.size}>
        {t('eventsScreen.when', {
          range: formatEventRange(event.startsAt, event.endsAt, event.timeZone, dateLocale()),
          timeZone: event.timeZone,
        })}
      </Text>
      <Text size={tokens.typeBody.size} muted>
        {venuePlace(event) ?? t('eventPage.venueToBeConfirmed')}
      </Text>
      <Placeholder label={t('eventPage.invited')} />
      {onChange != null && (
        <>
          <DraftRow
            kind={kind}
            event={event}
            manages={manages}
            now={now}
            onChange={onChange}
            onEdit={onEdit}
          />
          {endPassed && onEdit != null && (
            <PrimaryButton
              label={t('eventLive.changeDates')}
              onPress={() => onEdit('starts')}
              testID="events.changeDates"
            />
          )}
          <PausedRow event={event} phase={phase} manages={manages} onChange={onChange} />
        </>
      )}
      {phase === 'finished' && onDuplicate != null && (
        <PrimaryButton
          label={t('eventDuplicate.open')}
          onPress={onDuplicate}
          testID="events.page.duplicate"
        />
      )}
    </View>
  );
}

function venuePlace(event: OrganisationEvent): string | null {
  return event.venue?.name ?? event.venue?.address?.formatted ?? null;
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
  pageHead: { gap: tokens.spaceXs },
  top: { gap: tokens.spaceSm },
});
