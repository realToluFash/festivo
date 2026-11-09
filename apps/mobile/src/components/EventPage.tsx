import type { OrganisationEvent } from '@soirely/api-client';
import { type Milestone, changedWords } from '@soirely/domain';
import { router } from 'expo-router';
import type { TFunction } from 'i18next';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type ViewInstance } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import { dateLocale } from '../i18n/index.ts';
import { SECTION_HREF } from '../kit/appNav.ts';
import type { EditAt } from '../kit/eventNav.ts';
import {
  type ManageKey,
  coverRow,
  currencyTitle,
  datesRow,
  hostsRow,
  manageOf,
  scheduleLocked,
  venueRow,
} from '../kit/eventOverview.ts';
import { type CardStep, type StepAction, listEventOf, shownEvent } from '../kit/eventsList.ts';
import { PHASE_WORD } from '../kit/makeLive.ts';
import { useServerNow } from '../kit/serverNow.ts';
import type { LayoutKind } from '../layout/useLayout.ts';
import { tokens } from '../theme/tokens.ts';
import { AlertLine } from './AlertLine.tsx';
import { useDeleteEvent } from './DeleteEvent.tsx';
import { EventCard, EventThumb } from './EventCard.tsx';
import { useManageAsks } from './EventManageAsks.tsx';
import {
  type EventPart,
  JustForYou,
  Manage,
  type ManageItem,
  OverviewColumns,
  PartsSection,
  type RefFor,
} from './EventOverview.tsx';
import { useShownPhase } from './Events.tsx';
import { useMakeLive } from './MakeLive.tsx';
import { useEventMute } from './MuteEventCard.tsx';
import { useResume } from './PauseEvent.tsx';
import { readOut } from './ReadOut.tsx';
import { ComingUp } from './Timeline.tsx';

const EDIT_AT: Record<EventPart, EditAt | undefined> = {
  dates: 'starts',
  replyBy: undefined,
  venue: 'venue',
  hosts: 'hosts',
  type: 'type',
  currency: 'currency',
  name: 'name',
  cover: undefined,
};

/** An event's Overview as the design demo draws it (sc-30413): its card, then Details, Coming up, Name and cover, Just for you and Manage. */
export function EventPage({
  kind,
  event,
  manages,
  takes,
  onChange,
  onEdit,
  onDuplicate,
  onDeleted,
}: {
  kind: LayoutKind;
  event: OrganisationEvent;
  manages: boolean;
  /** Whether the viewer's role can take the card's step. */
  takes: (action: StepAction) => boolean;
  onChange: (event: OrganisationEvent) => void;
  /** Absent for a role without events.manage (sc-3595); `at` is the field it opens with focus on. */
  onEdit?: ((at?: EditAt) => void) | undefined;
  /** Absent for a role without events.create (sc-22145). */
  onDuplicate?: (() => void) | undefined;
  /** Absent for a role without events.create (sc-3592). */
  onDeleted?: ((event: OrganisationEvent) => void) | undefined;
}) {
  const { t } = useTranslation();
  const locale = dateLocale();
  const now = useServerNow();
  const phase = useShownPhase(event, now);
  const said = useRef({ id: event.id, phase });
  const milestones = useMilestones(event.id, event.status);
  const shown = shownEvent(listEventOf({ ...event, milestones }), phase);
  const cardOpener = useRef<ViewInstance>(null);
  const pauseOpener = useRef<ViewInstance>(null);
  const endOpener = useRef<ViewInstance>(null);
  const deleteOpener = useRef<ViewInstance>(null);
  const makeLive = useMakeLive({ kind, event, onChange, onEdit, opener: cardOpener });
  const resume = useResume(event, onChange);
  const { askPause, askEnd, asks } = useManageAsks({
    event,
    onChange,
    openers: { pause: pauseOpener, end: endOpener },
  });
  const deletion = useDeleteEvent({
    kind,
    event,
    onDeleted: onDeleted ?? (() => undefined),
    opener: deleteOpener,
  });
  const mute = useEventMute(event.id);

  // A change of phase on an open page is said politely, never on arrival (WCAG 2.2 §4.1.3).
  useEffect(() => {
    if (said.current.id === event.id && said.current.phase !== phase) {
      readOut(t(PHASE_WORD[phase]));
    }
    said.current = { id: event.id, phase };
  }, [event.id, phase, t]);

  const edit = onEdit == null ? null : (part: EventPart) => onEdit(EDIT_AT[part]);
  const onStep = (step: Extract<CardStep, { kind: 'button' }>) => {
    if (step.action === 'makeLive') makeLive.start();
    else if (step.action === 'changeDates') onEdit?.('starts');
    else if (step.action === 'resume') resume.resume();
    else onDuplicate?.();
  };
  const refFor: RefFor = (key) =>
    key === 'pause'
      ? pauseOpener
      : key === 'callOff' || key === 'endNow'
        ? endOpener
        : key === 'delete'
          ? deleteOpener
          : undefined;
  const onManage = (key: ManageKey) => {
    if (key === 'duplicate') onDuplicate?.();
    else if (key === 'pause') askPause();
    else if (key === 'callOff' || key === 'endNow') askEnd(key);
    else deletion.open();
  };
  const offered = manageOf(event, phase, now).filter((key) =>
    key === 'duplicate' ? onDuplicate != null : key === 'delete' ? onDeleted != null : manages,
  );
  const resumeSays =
    resume.state === 'failed'
      ? t('eventPause.resumeFailed')
      : resume.changed
        ? changedWords(event)
            .map((line) => t(line))
            .join(' ')
        : null;

  const card = (
    <View style={styles.card}>
      <EventCard
        event={shown}
        now={now}
        locale={locale}
        wide={kind !== 'phone'}
        takes={takes}
        onStep={onStep}
        testID="events.card"
      />
      {resumeSays != null && <AlertLine text={resumeSays} />}
    </View>
  );
  const details = (
    <PartsSection
      title={t('eventPage.details')}
      rowIDs="events.details"
      onEdit={(part) => edit?.(part)}
      rows={[
        {
          part: 'dates',
          ...datesRow(event, phase, locale, t),
          opens: edit != null && !scheduleLocked(phase),
        },
        { part: 'venue', ...venueRow(event.venue, t), opens: edit != null },
        { part: 'hosts', ...hostsRow(event.hosts, locale, t), opens: edit != null },
        {
          part: 'type',
          title: t(`eventTypes.${event.type}`),
          line: t('eventPage.type'),
          opens: edit != null,
        },
        {
          part: 'currency',
          title: currencyTitle(event.currency, locale, t),
          line: t('eventPage.currency'),
          opens: edit != null,
        },
      ]}
    />
  );
  const comingUp = (
    <ComingUp
      kind={kind}
      event={event}
      now={now}
      onAllDates={() => router.push(`/events/${encodeURIComponent(event.id)}/dates`)}
    />
  );
  const nameCover = (
    <PartsSection
      title={t('eventPage.nameAndCover')}
      rowIDs="events.details"
      onEdit={(part) => edit?.(part)}
      rows={[
        { part: 'name', title: event.name, line: t('eventPage.eventName'), opens: edit != null },
        {
          part: 'cover',
          ...coverRow(event.cover, t),
          lead: <EventThumb event={shown} side={28} radius={8} />,
          opens: edit != null,
        },
      ]}
    />
  );
  const forYou = (
    <JustForYou
      words={{
        title: t('eventMute.heading'),
        mute: t('eventMute.switch'),
        note: t('eventMute.note'),
        notLoaded: t('eventMute.notLoaded'),
        tryAgain: t('eventMute.tryAgain'),
        notSaved: t('eventMute.notSaved'),
        settings: t('eventMute.settings'),
      }}
      mute={
        mute.mute.status === 'failed'
          ? { kind: 'notLoaded' }
          : {
              kind: 'shown',
              muted: mute.muted,
              notSaved: mute.loaded && mute.mute.status === 'loaded' && mute.mute.unsaved,
              busy: mute.busy,
            }
      }
      onToggle={() => mute.change(!mute.muted)}
      onRetry={mute.retry}
      onSettings={() => router.push(SECTION_HREF.notifications)}
      testIDs={{
        row: 'events.mute.switch',
        retry: 'events.mute.tryAgain',
        settings: 'events.mute.settings',
      }}
    />
  );
  const manage =
    offered.length === 0 ? null : (
      <View style={styles.manage}>
        <Manage
          title={t('eventPage.manage')}
          items={offered.map((key) => ({
            ...MANAGE_ITEM[key](t),
            off: key === 'delete' && deletion.opening,
          }))}
          refFor={refFor}
          onManage={onManage}
        />
        {deletion.openFailed != null && <AlertLine text={deletion.openFailed} />}
      </View>
    );

  return (
    <View style={styles.page} testID="events.page">
      <OverviewColumns
        landscape={kind === 'tabletLandscape'}
        card={card}
        left={
          <>
            {details}
            {comingUp}
            {nameCover}
          </>
        }
        right={
          <>
            {forYou}
            {manage}
          </>
        }
        stacked={
          <>
            {details}
            {comingUp}
            {nameCover}
            {forYou}
            {manage}
          </>
        }
      />
      {makeLive.sheet}
      {asks}
      {deletion.sheet}
    </View>
  );
}

const MANAGE_ITEM: Record<ManageKey, (t: TFunction) => ManageItem<ManageKey>> = {
  duplicate: (t) => ({
    key: 'duplicate',
    label: t('eventDuplicate.open'),
    line: t('eventDuplicate.body'),
    removes: false,
    testID: 'events.page.duplicate',
  }),
  pause: (t) => ({
    key: 'pause',
    label: t('eventPause.pause'),
    line: t('eventPage.pauseLine'),
    removes: false,
    testID: 'events.pause',
  }),
  callOff: (t) => ({
    key: 'callOff',
    label: t('eventEnd.callOffOpen'),
    line: t('eventPage.callOffLine'),
    removes: true,
    testID: 'events.end',
  }),
  endNow: (t) => ({
    key: 'endNow',
    label: t('eventEnd.endNowOpen'),
    line: t('eventPage.endLine'),
    removes: true,
    testID: 'events.end',
  }),
  delete: (t) => ({
    key: 'delete',
    label: t('eventDelete.open'),
    line: t('eventDelete.note'),
    removes: true,
    testID: 'events.delete',
  }),
};

/** The card's next step needs the event's dates, which the event's own read leaves out. */
function useMilestones(eventId: string, status: string): Milestone[] {
  const [held, setHeld] = useState<{ for: string; milestones: Milestone[] }>({
    for: eventId,
    milestones: [],
  });

  useEffect(() => {
    let live = true;
    api.eventTimeline(eventId).then(
      (timeline) => live && setHeld({ for: eventId, milestones: timeline.milestones }),
      () => undefined,
    );

    return () => {
      live = false;
    };
  }, [eventId, status]);

  return held.for === eventId ? held.milestones : [];
}

const styles = StyleSheet.create({
  page: { gap: 18 },
  card: { gap: tokens.spaceSm },
  manage: { gap: tokens.spaceSm },
});
