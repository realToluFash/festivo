import type { OrganisationEvent } from '@soirely/api-client';
import { type Choice, changedWords, takesThankYou } from '@soirely/domain';
import { router } from 'expo-router';
import type { TFunction } from 'i18next';
import {
  type ReactNode,
  type Ref,
  type RefObject,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { AccessibilityInfo, Keyboard, StyleSheet, View, type ViewInstance } from 'react-native';
import { useTranslation } from 'react-i18next';

import { dateLocale } from '../i18n/index.ts';
import { openInMaps } from '../mapsApp.ts';
import { SECTION_HREF } from '../kit/appNav.ts';
import type { EditPart } from '../kit/eventNav.ts';
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
import { replyByRow } from '../kit/replyBy.ts';
import { type SavedRowFocus, savedRowFocus } from '../kit/savedRowFocus.ts';
import { useServerNow } from '../kit/serverNow.ts';
import type { LayoutKind } from '../layout/useLayout.ts';
import { tokens } from '../theme/tokens.ts';
import { AlertLine } from './AlertLine.tsx';
import { ArrivalNoteInset } from './ArrivalNoteInset.tsx';
import { useDeleteEvent } from './DeleteEvent.tsx';
import { EventCard } from './EventCard.tsx';
import { EventGuestNumbers } from './EventGuestNumbers.tsx';
import { EventPeopleCard } from './EventPeopleCard.tsx';
import { EventThumb } from './EventThumb.tsx';
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
import { ThankYouCard, ThankYouScreen } from './ThankYou.tsx';
import { BellRow } from './BellButton.tsx';
import { SwitchedNotice } from './SwitchedNotice.tsx';
import { readOut } from './ReadOut.tsx';
import { SETTLED_MS, bringIntoView, keepInsideEnd, restOverToast, whenLanded } from './intoView.ts';
import { ScreenScroll, type ScreenScrollView } from './Screen.tsx';
import { useKeysUp } from './keyboardWatch.ts';
import { type ScreenReaderTarget, moveScreenReaderFocus } from './screenReaderFocus.ts';
import type { TextHandle } from './Text.tsx';
import { RowList, TextAction } from './Summary.tsx';
import { EventNeeds } from './EventNeeds.tsx';
import { ComingUp, useTimeline } from './Timeline.tsx';
import { useStationRowItem } from './StationWayIn.tsx';
import { useYourNightItem } from './YourNight.tsx';

/** An event's Overview as the design demo draws it (sc-30413): its card, then Details, Coming up, Name and cover, Just for you and Manage. */
export function EventPage({
  kind,
  event,
  nameRef,
  manages,
  takes,
  onChange,
  onEdit,
  partRef,
  closedOnto = null,
  toast = null,
  toastClosed = null,
  onDuplicate,
  onDeleted,
  onGuests,
  onPeople,
  tell,
  opensEndNow = false,
  onEndNowOpened,
  notice,
  moved = null,
}: {
  kind: LayoutKind;
  event: OrganisationEvent;
  /** Guests, on the choice a count on the Guests card opens (sc-3786). */
  onGuests: (choice: Choice) => void;
  /** The event's People, from the People card (sc-68607). */
  onPeople: () => void;
  /** The card's name, where it is the page's only title. */
  nameRef?: Ref<TextHandle> | undefined;
  manages: boolean;
  /** Whether the viewer's role can take the card's step. */
  takes: (action: StepAction) => boolean;
  onChange: (event: OrganisationEvent) => void;
  /** Absent for a role without events.manage (sc-3595): opens the part's own edit over the page (sc-48600), focus going back to `opener` when it closes. */
  onEdit?: ((part: EditPart, opener: RefObject<ScreenReaderTarget | null>) => void) | undefined;
  /** Each part's row, which its edit returns focus to. */
  partRef: (part: EditPart) => RefObject<ViewInstance | null>;
  /** A new one each time an edit closes, naming where its focus goes back to. */
  closedOnto?: Closed | null;
  /** The toast over the page's foot, where its top shows in the window and the close by Save it says. */
  toast?: { top: number; over: Closed | null } | null;
  /** A new one each time × closes a saved toast, naming the Save it said. */
  toastClosed?: { of: Closed } | null;
  /** Absent for a role without events.create (sc-22145); opens Duplicate over the page, focus going back to `opener`. */
  onDuplicate?: ((opener: RefObject<ScreenReaderTarget | null>) => void) | undefined;
  /** Absent for a role without events.create (sc-3592). */
  onDeleted?: ((event: OrganisationEvent) => void) | undefined;
  /** Says a toast at the foot of the page. */
  tell?: ((words: string) => void) | undefined;
  /** Arrived from the night's End now: End now's confirmation opens over the page, where it is offered (sc-3895). */
  opensEndNow?: boolean;
  onEndNowOpened?: () => void;
  /** A notice about the event as it was saved, first under its card. */
  notice?: ReactNode;
  /** Now working in, at the head of the body, once the event's link has moved the account into its organisation (sc-80863). */
  moved?: { words: string } | null;
}) {
  const { t } = useTranslation();
  const locale = dateLocale();
  const now = useServerNow();
  const phase = useShownPhase(event, now);
  const said = useRef({ id: event.id, phase });
  const timeline = useTimeline(event.id, now, event);
  const night = useYourNightItem(event.id);
  const station = useStationRowItem(event);
  const milestones = timeline.load.kind === 'loaded' ? timeline.load.timeline.milestones : null;
  const shown = shownEvent(listEventOf({ ...event, milestones }), phase);
  const cardOpener = useRef<ViewInstance>(null);
  const pauseOpener = useRef<ViewInstance>(null);
  const endOpener = useRef<ViewInstance>(null);
  const deleteOpener = useRef<ViewInstance>(null);
  const duplicateOpener = useRef<ViewInstance>(null);
  const thankYouOpener = useRef<ViewInstance>(null);
  const [thanking, setThanking] = useState(false);
  const makeLive = useMakeLive({
    event,
    onChange,
    onEdit: onEdit == null ? undefined : (part) => onEdit(part, cardOpener),
    onLive: tell,
    opener: cardOpener,
  });
  const resume = useResume(event, onChange);
  const { askPause, askEnd, asks } = useManageAsks({
    event,
    onChange,
    openers: { pause: pauseOpener, end: endOpener },
    onThanked: () => tell?.(t('thankYou.done')),
  });
  const deletion = useDeleteEvent({
    event,
    phase,
    now,
    manages,
    onDeleted: onDeleted ?? (() => undefined),
    onVerb: askEnd,
    opener: deleteOpener,
  });
  const mute = useEventMute(event.id);
  const toastRoom = useOpenerInSight(closedOnto, toast, toastClosed);

  // A change of phase on an open page is said politely, never on arrival (WCAG 2.2 §4.1.3).
  useEffect(() => {
    if (said.current.id === event.id && said.current.phase !== phase) {
      readOut(t(PHASE_WORD[phase]));
    }
    said.current = { id: event.id, phase };
  }, [event.id, phase, t]);

  const edit = onEdit == null ? null : (part: EventPart) => onEdit(part, partRef(part));
  const rowRef: RefFor = (part) => partRef(part as EditPart);
  const onStep = (step: Extract<CardStep, { kind: 'button' }>) => {
    if (step.action === 'makeLive') makeLive.start();
    else if (step.action === 'changeDates') onEdit?.('dates', cardOpener);
    else if (step.action === 'resume') resume.resume();
    else onDuplicate?.(cardOpener);
  };
  const refFor: RefFor = (key) =>
    key === 'pause'
      ? pauseOpener
      : key === 'callOff' || key === 'endNow'
        ? endOpener
        : key === 'delete'
          ? deleteOpener
          : key === 'duplicate'
            ? duplicateOpener
            : undefined;
  const onManage = (key: ManageKey) => {
    if (key === 'duplicate') onDuplicate?.(duplicateOpener);
    else if (key === 'pause') askPause();
    else if (key === 'callOff' || key === 'endNow') askEnd(key);
    else deletion.open();
  };
  const offered = manageOf(event, phase, now).filter((key) =>
    key === 'duplicate' ? onDuplicate != null : key === 'delete' ? onDeleted != null : manages,
  );
  const endsNow = opensEndNow && offered.includes('endNow');
  const askedEnd = useRef(false);

  useEffect(() => {
    if (!endsNow || askedEnd.current) return;
    askedEnd.current = true;
    askEnd('endNow');
    onEndNowOpened?.();
  }, [endsNow, askEnd, onEndNowOpened]);

  const resumeSays =
    resume.state === 'failed'
      ? t('eventPause.resumeFailed')
      : resume.changed
        ? changedWords(event)
            .map((line) => t(line))
            .join(' ')
        : null;

  const eventCard = (
    <View style={styles.card}>
      <EventCard
        event={shown}
        now={now}
        locale={locale}
        wide={kind !== 'phone'}
        takes={takes}
        onStep={onStep}
        stepRef={cardOpener}
        nameRef={nameRef}
        sending={resume.state === 'pending' ? t('eventPause.resuming') : null}
        phaseTestID="events.phase"
        testID="events.card"
      />
      {resumeSays != null && <AlertLine text={resumeSays} />}
    </View>
  );
  const card =
    moved == null ? (
      eventCard
    ) : (
      <View style={styles.headed}>
        <SwitchedNotice said={moved} />
        {eventCard}
      </View>
    );
  const details = (
    <PartsSection
      title={t('eventPage.details')}
      rowIDs="events.details"
      refFor={rowRef}
      onEdit={(part) => edit?.(part)}
      rows={[
        {
          part: 'dates',
          ...datesRow(event, phase, locale, t),
          opens: edit != null && !scheduleLocked(phase),
        },
        {
          part: 'replyBy',
          ...replyByRow(event, locale, now, t),
          opens: edit != null && !scheduleLocked(phase),
        },
        {
          part: 'venue',
          ...venueRow(event.venue, t),
          opens: edit != null && (event.venue != null || event.arrivalNote == null),
          after:
            event.arrivalNote == null && event.venue?.address == null ? undefined : (
              <>
                {event.arrivalNote != null && <ArrivalNoteInset note={event.arrivalNote} />}
                {event.venue == null && edit != null && (
                  <TextAction
                    label={t('eventPage.addVenue')}
                    onPress={() => edit('venue')}
                    testID="events.addVenue"
                  />
                )}
                {event.venue?.address != null && (
                  <TextAction
                    label={t('eventPage.openInMaps')}
                    glyph="globe"
                    onPress={() => openInMaps(event.venue)}
                    testID="events.maps"
                  />
                )}
              </>
            ),
        },
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
      timeline={timeline}
      onAllDates={() => router.push(`/events/${encodeURIComponent(event.id)}/dates`)}
    />
  );
  const needsYou = <EventNeeds event={event} timeline={timeline} />;
  const nameCover = (
    <PartsSection
      title={t('eventPage.nameAndCover')}
      rowIDs="events.details"
      refFor={rowRef}
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
  const thankYou = takesThankYou(event, phase) && (
    <ThankYouCard
      event={event}
      manages={manages}
      opener={thankYouOpener}
      onOpen={() => setThanking(true)}
    />
  );
  const tonight = [night, station].filter((item) => item != null);
  const yourNight = tonight.length === 0 ? null : <RowList items={tonight} />;
  const numbers = <EventGuestNumbers event={event} onOpen={onGuests} />;
  const people = <EventPeopleCard event={event} onOpen={onPeople} />;
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
    <View
      style={[styles.page, toastRoom.room > 0 && { paddingBottom: toastRoom.room }]}
      onLayout={toastRoom.onLayout}
      testID="events.page"
    >
      <OverviewColumns
        landscape={kind === 'tabletLandscape'}
        card={<BellRow>{card}</BellRow>}
        left={
          <>
            {notice}
            {thankYou}
            {details}
            {needsYou}
            {comingUp}
            {nameCover}
          </>
        }
        right={
          <>
            {yourNight}
            {numbers}
            {people}
            {forYou}
            {manage}
          </>
        }
        stacked={
          <>
            {notice}
            {thankYou}
            {yourNight}
            {numbers}
            {people}
            {details}
            {needsYou}
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
      {manages && takesThankYou(event, phase) && (
        <ThankYouScreen
          event={event}
          open={thanking}
          opener={thankYouOpener}
          onClose={() => setThanking(false)}
          onChange={onChange}
          onSaid={(words) => tell?.(words)}
        />
      )}
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

/** The latest focus goes back to a saved row, however its rest went. */
const SAVED_FOCUS_LATEST_MS = SETTLED_MS * 3;

interface Closed {
  opener: RefObject<ScreenReaderTarget | null>;
  saved?: boolean;
}

/** How long the saved toast's top holds still, with the keys down, before the row rests above it: a Save made with the keys up lays the toast out over them first, and it moves down only as the window grows back (sc-86228). */
const TOAST_STILL_MS = 150;

/** Brings the row an edit closes onto into sight before focus goes back to it, and after Save rests it 12pt above the saved toast; focus must not move before the edit's window has gone, or TalkBack puts it on the header's back button (sc-48600, sc-86228). */
function useOpenerInSight(
  closed: Closed | null,
  toast: { top: number; over: Closed | null } | null,
  toastClosed: { of: Closed } | null,
): { room: number; onLayout: () => void } {
  const scroll = useContext(ScreenScroll);
  const keysUp = useKeysUp();
  const seen = useRef(closed);
  const [room, setRoom] = useState(0);
  const roomNow = useRef(0);
  const laidOut = useRef<(() => void) | null>(null);
  const roomGoing = useRef(false);
  const roomGone = useRef<(() => void) | null>(null);
  const closedSeen = useRef(toastClosed);
  const over = toast != null && closed?.saved === true && toast.over === closed ? toast.top : null;
  const overNow = useRef(over);
  const shows = toast != null;
  const focus = useRef<{ of: Closed; timing: SavedRowFocus } | null>(null);

  useEffect(() => {
    overNow.current = over;
  }, [over]);

  /** Brings `row` wholly into sight by the least scroll, then calls `then`. */
  const bringInto = useRef<(row: Closed, then: () => void) => void>(() => {});
  /** Rests `row` 12pt above the toast's `top`, giving the foot the room it needs, then says whether it could be measured. */
  const restAbove = useRef<(row: Closed, top: number, then: (rested: boolean) => void) => void>(
    () => {},
  );

  useEffect(() => {
    bringInto.current = (row, then) =>
      bringIntoView(scroll, row.opener.current, false, {}, (found) =>
        found == null || scroll == null ? then() : landedOr(scroll, found.to, then),
      );
    restAbove.current = (row, top, then) =>
      restOverToast(scroll, row.opener.current, top, roomNow.current, (rest) => {
        if (rest == null || scroll == null) return then(false);
        const go = () => {
          if (rest.to != null) scroll.ref.current?.scrollTo({ y: rest.to, animated: false });
          landedOr(scroll, rest.to, () => then(true));
        };
        const wanted = rest.room < 1 ? 0 : Math.ceil(rest.room);
        if (wanted === roomNow.current) return go();
        roomNow.current = wanted;
        laidOut.current = go;
        setRoom(wanted);
      });
  }, [scroll]);

  useEffect(() => {
    if (closed?.saved !== true) return;
    const timing = savedRowFocus({
      settledMs: SETTLED_MS,
      latestMs: SAVED_FOCUS_LATEST_MS,
      move: () => moveScreenReaderFocus(closed.opener.current),
      bringIntoSight: (rested) => {
        void AccessibilityInfo.isScreenReaderEnabled().then((on) => {
          if (!on) return rested();
          const top = overNow.current;
          const restedBefore = seen.current === closed;
          seen.current = closed;
          if (restedBefore || top == null || Keyboard.isVisible())
            return bringInto.current(closed, rested);
          restAbove.current(closed, top, (measured) =>
            measured ? rested() : bringInto.current(closed, rested),
          );
        });
      },
    });
    focus.current = { of: closed, timing };

    return () => {
      timing.stop();
      if (focus.current?.timing === timing) focus.current = null;
    };
  }, [closed, scroll]);

  const toastShown = over != null;
  useEffect(() => {
    if (toastShown && closed != null && focus.current?.of === closed)
      focus.current.timing.toastLaidOut();
  }, [closed, toastShown]);

  useEffect(() => {
    if (closed == null || closed === seen.current || closed.saved === true) return;
    seen.current = closed;

    let gone = false;
    void AccessibilityInfo.isScreenReaderEnabled().then((on) => {
      if (on && !gone) bringIntoView(scroll, closed.opener.current, false);
    });

    return () => {
      gone = true;
    };
  }, [closed, scroll]);

  useEffect(() => {
    if (over == null || closed == null || closed === seen.current || keysUp) return;

    const still = setTimeout(() => {
      if (closed === seen.current) return;
      seen.current = closed;
      const current = () => seen.current === closed;
      const rested = () => {
        if (current() && focus.current?.of === closed) focus.current.timing.rested();
      };
      void AccessibilityInfo.isScreenReaderEnabled().then((on) => {
        if (!on || !current()) return;
        restAbove.current(closed, over, (measured) => {
          if (!current()) return;
          if (measured) rested();
          else bringInto.current(closed, rested);
        });
      });
    }, TOAST_STILL_MS);

    return () => clearTimeout(still);
  }, [closed, over, keysUp]);

  useEffect(() => {
    if (shows || roomNow.current === 0) return;
    roomNow.current = 0;
    roomGoing.current = true;
    laidOut.current = () =>
      keepInsideEnd(scroll, (to) => {
        const gone = () => {
          roomGoing.current = false;
          const then = roomGone.current;
          roomGone.current = null;
          then?.();
        };
        if (to == null || scroll == null) gone();
        else landedOr(scroll, to, gone);
      });
    setRoom(0);
  }, [shows, scroll]);

  useEffect(() => {
    if (toastClosed == null || toastClosed === closedSeen.current) return;
    closedSeen.current = toastClosed;

    let gone = false;
    let settle: ReturnType<typeof setTimeout> | undefined;
    const row = toastClosed.of;
    const back = () => {
      if (gone) return;
      bringInto.current(row, () => {
        // TalkBack puts its own focus on the header as × goes, and a move asked before that is lost.
        if (!gone) settle = setTimeout(() => moveScreenReaderFocus(row.opener.current), SETTLED_MS);
      });
    };
    void AccessibilityInfo.isScreenReaderEnabled().then((on) => {
      if (!on || gone) return;
      if (roomGoing.current) roomGone.current = back;
      else back();
    });

    return () => {
      gone = true;
      clearTimeout(settle);
    };
  }, [toastClosed]);

  return {
    room,
    onLayout: () => {
      const then = laidOut.current;
      laidOut.current = null;
      then?.();
    },
  };
}

/** Calls `then` once, as the scroll lands on `to` or after SETTLED_MS, whichever comes first, so a scroll that stops short still lets focus go. */
function landedOr(scroll: ScreenScrollView, to: number | null, then: () => void): void {
  let done = false;
  let stop = () => {};
  const once = () => {
    if (done) return;
    done = true;
    clearTimeout(late);
    stop();
    then();
  };
  const late = setTimeout(once, SETTLED_MS);
  stop = whenLanded(scroll, to, once);
}

const styles = StyleSheet.create({
  page: { gap: 18 },
  headed: { gap: 18 },
  card: { gap: tokens.spaceSm },
  manage: { gap: tokens.spaceSm },
});
