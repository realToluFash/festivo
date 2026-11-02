import type { OrganisationEvent } from '@soirely/api-client';
import {
  type EventPhase,
  PHASE_LOOK,
  calledOff,
  formatEventDate,
  formatEventRange,
  shownPhase,
} from '@soirely/domain';
import { router } from 'expo-router';
import { type ReactNode, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { dateLocale } from '../i18n/index.ts';
import type { EditAt } from '../kit/eventNav.ts';
import { PHASE_WORD } from '../kit/makeLive.ts';
import { useLoadedAt, useServerNow } from '../kit/serverNow.ts';
import { type LayoutKind } from '../layout/useLayout.ts';
import { tokens } from '../theme/tokens.ts';
import { PrimaryButton, SecondaryButton } from './Buttons.tsx';
import { DeleteEventSection } from './DeleteEvent.tsx';
import { MuteEventCard } from './MuteEventCard.tsx';
import { EndRow } from './EndEvent.tsx';
import { DraftRow } from './MakeLive.tsx';
import { PauseButton, PausedRow } from './PauseEvent.tsx';
import { Notice } from './Notice.tsx';
import { Placeholder } from './Placeholder.tsx';
import { readOut } from './ReadOut.tsx';
import { StatusChip } from './StatusChip.tsx';
import { StepMark } from './StepMark.tsx';
import { Text } from './Text.tsx';
import { ComingUp } from './Timeline.tsx';
import { cardFrame } from './cardFrame.ts';

/** The phase the page shows: the server's, flipped by the corrected clock at the start and the end (sc-3585). */
function useShownPhase(event: OrganisationEvent, now: Date): EventPhase {
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
      <PrimaryButton label={t('eventsScreen.retry')} onPress={onRetry} testID={testID} />
    </View>
  );
}

const OVERVIEW_TILES = ['tileComing', 'tileMealPicks', 'tileSeated', 'tileBudgetUsed'] as const;

/** [fd]'s Event view (sc-22103): the Top, then Overview's tiles and cards in two columns on a tablet on its side, in one elsewhere (sc-25008). */
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
  /** Absent for a role without events.manage (sc-3595); `at` is the field it opens with focus on. */
  onEdit?: ((at?: EditAt) => void) | undefined;
  /** Absent for a role without events.create (sc-22145). */
  onDuplicate?: (() => void) | undefined;
  /** Absent for a role without events.create (sc-3592). */
  onDeleted?: ((event: OrganisationEvent) => void) | undefined;
}) {
  const { t } = useTranslation();
  const now = useServerNow();
  const phase = useShownPhase(event, now);
  const said = useRef({ id: event.id, phase });
  const landscape = kind === 'tabletLandscape';

  // A change of phase on an open page is said politely, never on arrival (WCAG 2.2 §4.1.3).
  useEffect(() => {
    if (said.current.id === event.id && said.current.phase !== phase) {
      readOut(t(PHASE_WORD[phase]));
    }
    said.current = { id: event.id, phase };
  }, [event.id, phase, t]);

  const manage = (
    <View style={[cardFrame(kind), styles.manage]}>
      <Text size={tokens.typeRowTitle.size} weight="semibold" accessibilityRole="header">
        {t('eventPage.manage')}
      </Text>
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
        {onDuplicate != null && phase !== 'finished' && (
          <SecondaryButton
            label={t('eventDuplicate.open')}
            onPress={onDuplicate}
            testID="events.page.duplicate"
          />
        )}
      </View>
      <MuteEventCard kind={kind} eventId={event.id} />
      {onDeleted != null && <DeleteEventSection kind={kind} event={event} onDeleted={onDeleted} />}
    </View>
  );
  const details = <Details kind={kind} event={event} onEdit={onEdit} />;
  const comingUp = (
    <ComingUp
      kind={kind}
      event={event}
      now={now}
      onAllDates={() => router.push(`/events/${encodeURIComponent(event.id)}/dates`)}
    />
  );
  const soon = (card: keyof typeof SOON_CARDS) => <SoonCard key={card} kind={kind} card={card} />;

  return (
    <View style={styles.cards} testID="events.page">
      <EventTop
        kind={kind}
        event={event}
        phase={phase}
        manages={manages}
        now={now}
        onChange={onChange}
        onEdit={onEdit}
        onDuplicate={onDuplicate}
      />
      <View style={styles.tiles}>
        {OVERVIEW_TILES.map((tile) => (
          <View key={tile} style={[styles.tile, kind === 'phone' && styles.tileHalf]}>
            <Placeholder label={t(`eventPage.${tile}`)} />
          </View>
        ))}
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
      {landscape ? (
        <View style={styles.columns}>
          <View style={[styles.cards, styles.main]}>
            {details}
            {soon('needsYou')}
            {comingUp}
            {soon('team')}
          </View>
          <View style={[styles.cards, styles.side]}>
            {soon('onTrack')}
            {soon('replies')}
            {manage}
          </View>
        </View>
      ) : (
        <View style={styles.cards}>
          {details}
          {soon('onTrack')}
          {soon('needsYou')}
          {soon('replies')}
          {comingUp}
          {soon('team')}
          {manage}
        </View>
      )}
    </View>
  );
}

const SOON_CARDS = {
  onTrack: 'eventPage.onTrack',
  replies: 'eventPage.replies',
  needsYou: 'eventPage.needsYou',
  team: 'eventPage.team',
} as const;

/** [fd]'s Overview card with nothing to show yet: its label, then Coming soon, and nothing to press (sc-25008). */
function SoonCard({ kind, card }: { kind: LayoutKind; card: keyof typeof SOON_CARDS }) {
  const { t } = useTranslation();
  const label = t(SOON_CARDS[card]);
  const soon = t('eventsScreen.comingSoon');

  return (
    <View
      style={cardFrame(kind)}
      accessible
      accessibilityLabel={`${label}, ${soon}`}
      testID={`events.page.${card}`}
    >
      <View style={styles.soonHead}>
        <Text size={tokens.typeRowTitle.size} weight="semibold">
          {label}
        </Text>
      </View>
      <Text
        size={kind === 'phone' ? tokens.typeBody.size : tokens.typeBodyPhone.size}
        weight="medium"
        muted
      >
        {soon}
      </Text>
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

/** Each row opens Edit details at its own field for somebody who manages events, and nothing for anybody else. */
function Details({
  kind,
  event,
  onEdit,
}: {
  kind: LayoutKind;
  event: OrganisationEvent;
  onEdit?: ((at?: EditAt) => void) | undefined;
}) {
  const { t } = useTranslation();
  const venue = event.venue;
  const address = venue?.address?.formatted ?? null;

  return (
    <View style={cardFrame(kind)} testID="events.details">
      <View style={styles.detailsHead}>
        <Text size={tokens.typeRowTitle.size} weight="semibold" accessibilityRole="header">
          {t('eventPage.details')}
        </Text>
        {onEdit != null && (
          <SecondaryButton
            label={t('eventEdit.open')}
            onPress={() => onEdit()}
            testID="events.page.edit"
          />
        )}
      </View>
      <DetailRow
        label={t('eventPage.dates')}
        onPress={onEdit && (() => onEdit('starts'))}
        testID="events.details.dates"
      >
        <Text size={tokens.typeBody.size}>
          {t('eventsScreen.when', {
            range: formatEventRange(event.startsAt, event.endsAt, event.timeZone, dateLocale()),
            timeZone: event.timeZone,
          })}
        </Text>
      </DetailRow>
      <DetailRow
        label={t('eventPage.venue')}
        onPress={onEdit && (() => onEdit('venue'))}
        testID="events.details.venue"
      >
        {venue == null ? (
          <Text size={tokens.typeBody.size}>{t('eventPage.venueToBeConfirmed')}</Text>
        ) : (
          <>
            {venue.name != null && (
              <Text size={tokens.typeBody.size} weight="semibold">
                {venue.name}
              </Text>
            )}
            {address != null && <Text size={tokens.typeBody.size}>{address}</Text>}
          </>
        )}
      </DetailRow>
      <DetailRow
        label={t('eventHosts.heading')}
        onPress={onEdit && (() => onEdit('hosts'))}
        testID="events.details.hosts"
      >
        <Text size={tokens.typeBody.size}>
          {event.hosts.length === 0 ? t('eventHosts.none') : event.hosts.join(', ')}
        </Text>
        {onEdit != null && (
          <Text size={tokens.typeSmall.size} muted>
            {t('eventHosts.add')}
          </Text>
        )}
      </DetailRow>
    </View>
  );
}

function DetailRow({
  label,
  onPress,
  testID,
  children,
}: {
  label: string;
  onPress: (() => void) | undefined;
  testID: string;
  children: ReactNode;
}) {
  const body = (
    <>
      <Text size={tokens.typeSmall.size} muted>
        {label}
      </Text>
      <View style={styles.detailValue}>{children}</View>
    </>
  );

  return onPress == null ? (
    <View style={styles.detailRow} testID={testID}>
      {body}
    </View>
  ) : (
    <Pressable
      style={styles.detailRow}
      onPress={onPress}
      accessibilityRole="button"
      testID={testID}
    >
      {body}
    </Pressable>
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
  top: { gap: tokens.spaceSm },
  lifecycle: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: tokens.spaceMd },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spaceSm },
  tile: {
    flexGrow: 1,
    flexBasis: 0,
    minWidth: 140,
    padding: tokens.spaceLg,
    borderRadius: tokens.radiusCardPhone,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
    backgroundColor: tokens.colorCard,
  },
  tileHalf: { flexBasis: '40%' },
  columns: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceLg },
  main: { flex: 2, minWidth: 0 },
  manage: { gap: tokens.spaceMd },
  side: { flex: 1, minWidth: 0 },
  soonHead: {
    paddingBottom: tokens.spaceMd,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colorInsetBorder,
  },
  detailsHead: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spaceSm,
  },
  detailRow: {
    gap: tokens.spaceHair,
    minHeight: tokens.sizeHit,
    paddingVertical: tokens.spaceSm,
    borderTopWidth: 1,
    borderTopColor: tokens.colorInsetBorder,
  },
  detailValue: { gap: tokens.spaceHair },
});
