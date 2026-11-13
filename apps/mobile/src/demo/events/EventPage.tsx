import { formattingLocale } from '@soirely/domain';
import { getLocales } from 'expo-localization';
import { type Href, router } from 'expo-router';
import {
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import { Pressable, StyleSheet, View, type ViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { ScreenReaderTarget } from '../../components/screenReaderFocus.ts';
import { tokens } from '../../theme/tokens.ts';
import { LineIcon } from '../../components/AccountCard.tsx';
import { AlertLine } from '../../components/AlertLine.tsx';
import { SwitchTrack } from '../../components/ConfettiSwitch.tsx';
import { Text } from '../../components/Text.tsx';
import { EventCard } from '../../components/EventCard.tsx';
import { EventThumb } from '../../components/EventThumb.tsx';
import { AcPill, CHANGED, EditScreen } from './EventEdits.tsx';
import {
  JustForYou,
  Manage,
  OverviewColumns,
  PartsSection,
  type RefFor,
} from '../../components/EventOverview.tsx';
import { AreaPage, EventFrame, type EventToast } from './EventFrame.tsx';
import {
  INVITATION_HREF,
  MAKE_LIVE_EVENT,
  MAKE_LIVE_HOST,
  liveToastOf,
  makeLiveStart,
  makeLiveStateOf,
  reachOf,
} from './MakeLive.ts';
import { MakeLiveAsk, useMakeLive } from './MakeLiveAsk.tsx';
import { EventNeedsYou } from './EventNeedsYou.tsx';
import { needsStateOf, readerOf } from './NeedsYouModel.ts';
import {
  type DeleteStart,
  DeleteScreen,
  DuplicateScreen,
  type LifeAsk,
  LifecycleAsk,
  RefusedAsk,
} from './EventLifecycle.tsx';
import { invitedOf, refusalOf, refusedStartOf, usableManage } from './DeleteRefusal.ts';
import {
  type CardStep,
  type EditPart,
  type EventDemoState,
  type ManageKey,
  type Shown,
  clockOf,
  datesRow,
  datesOf,
  editOf,
  hostsRow,
  instantOf,
  manageOf,
  needsName,
  scheduleLocked,
  shownEvent,
} from './EventsModel.ts';
import { seedFinalNumbers } from './FinalNumbers.ts';
import {
  type AreaKey,
  type SampleEvent,
  TYPE_WORDS,
  currencyWords,
  sampleEvent,
} from './EventsSample.ts';
import { LIVE, W } from './EventsWords.ts';
import { NOTE_WORDS, WIDE_NOTE } from './ArrivalNote.ts';
import { NoteInset } from './NoteInset.tsx';
import {
  WRITE_MS,
  type WriteSwitch,
  pressWrite,
  writeLines,
  writeSettled,
  writeSwitchOf,
  writeWord,
} from './GuestsCanWrite.ts';
import { datesSaveSays, replyByInTell, replyByRow, replyBySaved } from './ReplyBy.ts';
import { replyByOf } from '../guests/GuestsSample.ts';
import { useShell } from '../../components/settingsShell.ts';
import { LoadingBlock, Row, Section, TextAction } from '../../components/Summary.tsx';
import { type MessagesState, startOf } from '../messages/MessagesModel.ts';
import { reduceReach } from '../messages/Reach.ts';
import { TellGuests } from '../messages/MessagesOverlays.tsx';
import { LONG_FINISHED, PLACE, SAMPLE_EVENT_ID, TELL } from '../messages/MessagesSample.ts';
import { tellChange } from '../messages/TellChange.ts';
import { MessagesScreen, badgeFor } from '../messages/MessagesScreen.tsx';
import { W as MW, say as sayMessages } from '../messages/MessagesWords.ts';
import type { SeatingState } from '../seating/SeatingModel.ts';
import { SeatingScreen } from '../seating/SeatingScreen.tsx';
import { GuestNumbers } from '../guests/GuestNumbers.tsx';
import { PeopleCard } from '../people/PeopleCard.tsx';
import type { CardState } from '../people/PeopleCardModel.ts';
import {
  type FilterKey,
  type ListFilter,
  GUESTS_ON,
  type GuestsState,
  OVERVIEW_STATES,
  areaStart,
  clockOf as guestsClock,
  invitedOn,
  isIn,
  peopleOn,
} from '../guests/GuestsModel.ts';
import { resetLooked, seedLook, takeLook } from '../guests/ChangedSince.ts';
import { GuestsScreen } from '../guests/GuestsScreen.tsx';
import { GuestToast } from '../guests/GuestsParts.tsx';
import { PHONE_TAB_BAR } from '../../components/TodayCover.tsx';
import { GUESTS as TALKS, type GuestKey } from '../messages/MessagesSample.ts';
import type { BudgetState } from '../budget/BudgetModel.ts';
import { BudgetScreen } from '../budget/BudgetScreen.tsx';

type Mute = 'ok' | 'notLoaded' | 'notSaved';

/** Tell guests opens once the edit's own screen has gone, since iOS shows one window at a time. */
const TELL_AFTER_MS = 800;

const ASKS: Partial<Record<EventDemoState, LifeAsk>> = {
  pause: 'pause',
  callOff: 'callOff',
  endNow: 'endNow',
  deleteDraft: 'deleteDraft',
};

function startEvent(
  id: string | undefined,
  state: EventDemoState | null,
  messages: MessagesState | null,
): SampleEvent {
  const event = sampleEvent(id) ?? sampleEvent('evt-wed-4');
  if (event == null) throw new Error('The sample has the wedding.');
  seedFinalNumbers(state);
  if (makeLiveStateOf(state) != null) {
    const hosted = event.id === MAKE_LIVE_EVENT ? { ...event, hosts: [MAKE_LIVE_HOST] } : event;
    return makeLiveStart(state).live ? { ...hosted, status: 'live' } : hosted;
  }
  if (messages === 'tell' || messages === 'untold') return { ...event, startsAt: TELL.startsAt };
  if (messages === 'tellPlace') return { ...event, venue: PLACE };
  if (messages === 'closedDraft') return { ...event, status: 'draft' };
  if (messages === 'closedEnded') return { ...event, ...LONG_FINISHED, status: 'ended' };
  if (state === 'datesReplyBySaved')
    return {
      ...event,
      startsAt: instantOf(CHANGED.start.date, CHANGED.start.time, event.timeZone),
      endsAt: instantOf(CHANGED.end.date, CHANGED.end.time, event.timeZone),
    };

  if (state === 'noteNoVenue') return { ...event, venue: null };
  if (state === 'noteWide') return { ...event, arrivalNote: WIDE_NOTE };

  return state === 'photo' ? { ...event, photo: true } : event;
}

function deleteStart(state: EventDemoState | null): DeleteStart | null {
  if (state === 'deleteDraftGuests') return 'delete';
  if (state === 'deleteRace' || state === 'deleteRaceRead') return 'deleteTyped';
  return state === 'delete' || state === 'deleteMismatch' || state === 'deleteTyped' ? state : null;
}

/** An event's page in A: the cover card with its one step, then flat rows; each part edits on its own screen. */
export function EventScreen({
  id,
  state,
  area,
  messages = null,
  seating = null,
  guests = null,
  budget = null,
  people = null,
  guestsFrom: figureOpens = null,
  without,
}: {
  id: string | undefined;
  state: EventDemoState | null;
  area: AreaKey | null;
  messages?: MessagesState | null;
  seating?: SeatingState | null;
  /** With Guests' own states, Guests opens on one, or Overview on its counts. */
  guests?: GuestsState | null;
  budget?: BudgetState | null;
  /** The People card's state on Overview (sc-29914); none is the populated card. */
  people?: CardState | null;
  /** A figure on Events opens the event's Guests with its choice in the filter menu (sc-3786). */
  guestsFrom?: FilterKey | null;
  without?: AreaKey | undefined;
}) {
  const shell = useShell();
  const locale = formattingLocale('en', getLocales()[0]?.languageTag);
  const now = useMemo(
    () => (guests == null ? clockOf(state) : guestsClock(guests)),
    [state, guests],
  );
  const [event, setEvent] = useState(() => startEvent(id, state, messages));
  const insets = useSafeAreaInsets();
  const reach = useMemo(() => reachOf(state, event.id), [state, event.id]);
  const live = useMakeLive(state, reach, () => setEvent((now) => ({ ...now, status: 'live' })));
  const [at, setAt] = useState<AreaKey>(() => {
    if (guests != null && !isIn(OVERVIEW_STATES, guests)) seedLook(areaStart(guests).looked, now);
    else if (messages === 'bell') resetLooked();

    return figureOpens != null
      ? 'guests'
      : guests != null
        ? isIn(OVERVIEW_STATES, guests)
          ? 'overview'
          : 'guests'
        : area == null || area === 'people' || messages === 'tell' || messages === 'tellPlace'
          ? 'overview'
          : area;
  });
  const [guestsFrom, setGuestsFrom] = useState<ListFilter | null>(figureOpens);
  const [sinceFrom, setSinceFrom] = useState<string | null>(null);
  const [m, dispatch] = useReducer(reduceReach, null, () => {
    const begun = startOf(messages, shell.layout !== 'phone');
    if (state !== 'datesReplyBySaved') return begun;
    const change = tellChange(sampleEvent(id) ?? event, event, locale);

    return reduceReach(begun, { type: 'offerTell', change });
  });
  const [messagesSeen, setMessagesSeen] = useState(messages != null || at === 'messages');
  if (at === 'messages' && !messagesSeen) setMessagesSeen(true);
  const messagesHere = event.id === SAMPLE_EVENT_ID;
  const [toldEvent, setToldEvent] = useState(() => sampleEvent(id) ?? event);
  const [more, setMore] = useState(state === 'more');
  const [edit, setEdit] = useState<EditPart | null>(editOf(state));
  const [round, setRound] = useState(0);
  const [part, setPart] = useState<EditPart>(editOf(state) ?? 'dates');
  const [ask, setAsk] = useState<LifeAsk | null>(state == null ? null : (ASKS[state] ?? null));
  const [deleting, setDeleting] = useState(deleteStart(state) != null);
  const refusedStart = refusedStartOf(state);
  const canChange = refusedStart?.canChange ?? true;
  const [pressed, setPressed] = useState(false);
  const refusal = refusalOf(
    event,
    now,
    invitedOf(state, refusedStart, invitedOn(event.id), pressed),
    canChange,
  );
  const [refused, setRefused] = useState(refusedStart != null && !refusedStart.race);
  const [duplicating, setDuplicating] = useState(state === 'duplicate');
  const [muted, setMuted] = useState(state === 'muted');
  const [mute, setMute] = useState<Mute>(
    state === 'muteNotLoaded' ? 'notLoaded' : state === 'muteNotSaved' ? 'notSaved' : 'ok',
  );
  const [write, setWrite] = useState(() => writeSwitchOf(state));
  const [writePressed, setWritePressed] = useState(0);
  useEffect(() => {
    if (writePressed === 0) return undefined;
    const later = setTimeout(() => setWrite((now) => writeSettled(now, true)), WRITE_MS);

    return () => clearTimeout(later);
  }, [writePressed]);
  const [replyBy, setReplyBy] = useState<string | null>(() =>
    state === 'replyBySaved'
      ? '2026-11-03'
      : state === 'replyByRemoved'
        ? null
        : state === 'datesReplyBySaved'
          ? '2026-11-03'
          : replyByOf(event.id),
  );
  const [told, setTold] = useState<string | null>(() =>
    state === 'saved'
      ? W.saved
      : state === 'replyBySaved' || state === 'replyByRemoved'
        ? replyBySaved(replyBy, event.timeZone, locale, now)
        : null,
  );
  const [tellMoved, setTellMoved] = useState<string | null>(() =>
    state === 'datesReplyBySaved' && replyBy != null
      ? replyByInTell(replyBy, event.timeZone, locale, now)
      : null,
  );
  const refs = useRef<Partial<Record<string, ViewInstance | null>>>({});
  const from = useRef(refusedStart == null ? 'card' : 'delete');
  const opener = useMemo<RefObject<ScreenReaderTarget | null>>(
    () => ({
      get current() {
        return refs.current[from.current] ?? null;
      },
    }),
    [],
  );
  const shown = shownEvent(event, now);
  const first = round === 0 ? state : null;
  const refFor = (key: string) => (node: ViewInstance | null) => {
    refs.current[key] = node;
  };
  const cardStep = useCallback((node: ViewInstance | null) => {
    refs.current.card = node;
  }, []);
  const openEdit = (which: EditPart) => {
    from.current = which;
    setPart(which);
    setRound((count) => count + 1);
    setEdit(which);
  };
  const saved = (next: SampleEvent, movedReplyBy?: string) => {
    const moved = movedReplyBy ?? null;
    const change =
      part === 'dates' || part === 'venue' ? tellChange(toldEvent, next, locale) : null;
    const tellOpens = messagesHere && change != null && change.lines.length > 0;
    const says = datesSaveSays(moved, tellOpens);

    setEvent(next);
    setEdit(null);
    if (moved != null) setReplyBy(moved);
    setTellMoved(
      says.inTell && moved != null ? replyByInTell(moved, next.timeZone, locale, now) : null,
    );
    if (says.toast === 'moved') setTold(replyBySaved(moved, next.timeZone, locale, now));
    if (says.toast === 'saved') setTold(W.saved);
    if (tellOpens) setTimeout(() => dispatch({ type: 'offerTell', change }), TELL_AFTER_MS);
  };
  const savedReplyBy = (date: string | null) => {
    setReplyBy(date);
    setEdit(null);
    setTold(replyBySaved(date, event.timeZone, locale, now));
  };
  const deleteIt = () => {
    setAsk(null);
    setDeleting(false);
    router.dismissTo(`/demo/events?deleted=${event.id}` as Href);
  };
  const pressDelete = () => {
    const answer = refusalOf(
      event,
      now,
      invitedOf(state, refusedStart, invitedOn(event.id), true),
      canChange,
    );

    if (answer == null) deleteIt();
    else {
      setPressed(true);
      setDeleting(false);
      setRefused(true);
    }
  };
  const onStep = (step: Extract<CardStep, { kind: 'button' }>) => {
    from.current = 'card';
    if (step.action === 'makeLive') live.open();
    else if (step.action === 'changeDates') openEdit('dates');
    else if (step.action === 'resume') setEvent({ ...event, status: 'live' });
    else setDuplicating(true);
  };
  const onManage = (key: ManageKey) => {
    from.current = key;
    if (key === 'duplicate') setDuplicating(true);
    else if (key === 'pause') setAsk('pause');
    else if (key === 'callOff') setAsk('callOff');
    else if (key === 'endNow') setAsk('endNow');
    else if (refusal != null) setRefused(true);
    else if (needsName(event, peopleOn(event.id))) setDeleting(true);
    else setAsk('deleteDraft');
  };
  const onAsked = (which: LifeAsk) => {
    setAsk(null);
    if (which === 'pause') setEvent({ ...event, status: 'paused' });
    else if (which === 'deleteDraft') deleteIt();
    else setEvent({ ...event, status: 'ended', concludedAt: now.toISOString() });
  };
  const toggleMute = () => {
    setMute('ok');
    setMuted(!muted);
  };

  const card = (
    <EventCard
      event={shown}
      now={now}
      locale={locale}
      wide={shell.layout !== 'phone'}
      takes={() => true}
      onStep={onStep}
      stepRef={cardStep}
      testID="event.card"
    />
  );
  const details = (
    <Details
      shown={shown}
      replyBy={replyBy}
      now={now}
      locale={locale}
      refFor={refFor}
      onEdit={openEdit}
      onMaps={() => shell.tell(W.mapsHandOff)}
    />
  );
  const needsYou = (
    <EventNeedsYou
      timeline={datesOf(shown, now)}
      permissions={readerOf(needsStateOf(state))}
      state={needsStateOf(state)}
      now={now}
      timeZone={event.timeZone}
      locale={locale}
    />
  );
  const nameCover = <NameAndCover shown={shown} refFor={refFor} onEdit={openEdit} />;
  const openGuests = (filter: FilterKey) => {
    setGuestsFrom(filter);
    setAt('guests');
  };
  /** sc-4331: the bell's item counts from the last look, then marks it read. */
  const openChanged = () => {
    setSinceFrom(takeLook(now));
    setGuestsFrom('changed');
    setAt('guests');
  };
  const numbers = (
    <GuestNumbers
      state={guests != null && isIn(OVERVIEW_STATES, guests) ? guests : 'overview'}
      onOpen={openGuests}
    />
  );
  const peopleCard = <PeopleCard state={people} />;
  const guestsPage = (
    <GuestsPage
      write={write}
      onWrite={() => {
        if (write.saving || !write.canChange) return;
        setWrite(pressWrite);
        setWritePressed((count) => count + 1);
      }}
    />
  );
  const forYou = (
    <JustForYou
      words={FOR_YOU}
      mute={
        mute === 'notLoaded'
          ? { kind: 'notLoaded' }
          : { kind: 'shown', muted, notSaved: mute === 'notSaved', busy: false }
      }
      onToggle={toggleMute}
      onRetry={() => setMute('ok')}
      onSettings={() => shell.openSection('notifications')}
      testIDs={{ row: 'event.mute', retry: 'event.mute.retry', settings: 'event.notifications' }}
    />
  );
  const manage = (
    <Manage
      title={W.manage}
      items={usableManage(manageOf(shown, now), canChange).map((key) => ({
        key,
        ...MANAGE[key],
        testID: `event.manage.${key}`,
      }))}
      refFor={refFor}
      onManage={onManage}
    />
  );
  const tellHere = (words: string) => {
    if (at === 'messages') dispatch({ type: 'told', words });
    else setTold(words);
  };
  const tellSent = () => {
    dispatch({ type: 'tellSent' });
    setToldEvent(event);
    tellHere(sayMessages.queued(TELL.count));
  };
  const tell = messagesHere && (
    <TellGuests
      open={m.telling}
      lines={m.change.lines}
      address={m.change.address === true}
      phone={shell.layout === 'phone'}
      opener={opener}
      onSend={tellSent}
      onNotNow={() => dispatch({ type: 'notNow' })}
      onSeeWho={() => tellHere(sayMessages.ownDesign(MW.seeWho))}
      before={tellMoved}
    />
  );

  const makeLive = (
    <MakeLiveAsk
      live={live.s}
      reach={reach}
      name={event.name}
      opener={opener}
      onKeep={live.keep}
      onConfirm={live.confirm}
      onSend={live.send}
    />
  );
  const liveSaid = liveToastOf(live.s, reach);
  const liveToast: EventToast | null =
    liveSaid == null
      ? null
      : {
          words: liveSaid,
          onClose: live.closeToast,
          action:
            live.s.toast === 'queued'
              ? {
                  label: LIVE.messages,
                  onPress: () => {
                    live.closeToast();
                    router.push(INVITATION_HREF as Href);
                  },
                }
              : null,
        };

  if (state === 'loading')
    return (
      <EventFrame
        event={shown}
        now={now}
        area={at}
        onArea={setAt}
        more={more}
        onMore={setMore}
        without={without}
        loading
      >
        <LoadingBlock words={W.loadingEvent} />
      </EventFrame>
    );

  if (at === 'seating' && messagesHere)
    return (
      <SeatingScreen
        state={seating}
        event={shown}
        now={now}
        more={more}
        onMore={setMore}
        onArea={setAt}
      />
    );

  const writeToThem = () => {
    dispatch({ type: 'newMessage' });
    dispatch({ type: 'chooseTo', to: 'notReplied' });
    setAt('messages');
  };
  const theirConversation = (guest: string) => {
    const talk = Object.keys(TALKS).find((key) => key === guest) as GuestKey | undefined;
    dispatch({
      type: 'open',
      open: talk == null ? { kind: 'many', key: 'parking' } : { kind: 'guest', key: talk },
    });
    setAt('messages');
  };

  if (at === 'guests' && (guests != null || GUESTS_ON.includes(event.id)))
    return (
      <>
        <GuestsScreen
          key={guestsFrom ?? ''}
          state={guests != null && !isIn(OVERVIEW_STATES, guests) ? guests : null}
          event={shown}
          now={now}
          more={more}
          onMore={setMore}
          onArea={setAt}
          badge={messagesHere && messagesSeen ? badgeFor(m) : null}
          filterFrom={guestsFrom}
          sinceFrom={sinceFrom}
          onWrite={writeToThem}
          onConversation={theirConversation}
          onMakeLive={live.open}
        />
        {makeLive}
        {liveToast != null && (
          <GuestToast
            words={liveToast.words}
            action={liveToast.action ?? null}
            onClose={liveToast.onClose}
            bottom={
              shell.layout === 'phone'
                ? Math.max(insets.bottom - tokens.spaceXxs, tokens.spaceLg) +
                  PHONE_TAB_BAR +
                  tokens.spaceXl
                : Math.max(insets.bottom, tokens.spaceLg)
            }
          />
        )}
      </>
    );

  if (at === 'budget' && messagesHere)
    return (
      <BudgetScreen
        state={budget}
        event={shown}
        now={now}
        locale={locale}
        more={more}
        onMore={setMore}
        onArea={setAt}
      />
    );

  if (at === 'messages' && messagesHere)
    return (
      <MessagesScreen
        m={m}
        dispatch={dispatch}
        event={shown}
        now={now}
        more={more}
        onMore={setMore}
        onArea={setAt}
        onChanged={openChanged}
        start={{
          fix: messages === 'fix',
          push: messages === 'bell',
          keys:
            messages === 'write' ||
            messages === 'cancelled' ||
            messages === 'scheduledEdit' ||
            messages === 'typedBraces',
        }}
        extra={tell}
      />
    );

  let page: ReactNode;
  if (at !== 'overview' && at !== 'people')
    page = <AreaPage area={at} event={shown} locale={locale} />;
  else
    page = (
      <OverviewColumns
        landscape={shell.layout === 'landscape'}
        card={card}
        left={
          <>
            {details}
            {needsYou}
            {nameCover}
          </>
        }
        right={
          <>
            {numbers}
            {peopleCard}
            {guestsPage}
            {forYou}
            {manage}
          </>
        }
        stacked={
          <>
            {numbers}
            {peopleCard}
            {details}
            {needsYou}
            {nameCover}
            {guestsPage}
            {forYou}
            {manage}
          </>
        }
      />
    );

  return (
    <EventFrame
      event={shown}
      now={now}
      area={at}
      onArea={setAt}
      more={more}
      onMore={setMore}
      badge={messagesHere && messagesSeen ? badgeFor(m) : null}
      without={without}
      toast={liveToast ?? (told == null ? null : { words: told, onClose: () => setTold(null) })}
      overlay={
        <>
          {tell}
          {round > 0 || edit != null ? (
            <EditScreen
              key={`${part}:${round}`}
              part={part}
              open={edit === part}
              event={event}
              start={first}
              locale={locale}
              opener={opener}
              onClose={() => setEdit(null)}
              onSaved={saved}
              replyBy={replyBy}
              now={now}
              onReplyBy={savedReplyBy}
            />
          ) : null}
          {makeLive}
          <LifecycleAsk
            ask={ask}
            name={event.name}
            opener={opener}
            onKeep={() => setAsk(null)}
            onConfirm={onAsked}
          />
          {refusal != null && (
            <RefusedAsk
              open={refused}
              refusal={refusal}
              name={event.name}
              opener={opener}
              onKeep={() => setRefused(false)}
              onVerb={(verb) => {
                setRefused(false);
                setAsk(verb);
              }}
            />
          )}
          <DeleteScreen
            open={deleting}
            event={event}
            people={peopleOn(event.id)}
            start={deleteStart(state)}
            opener={opener}
            onClose={() => setDeleting(false)}
            onDeleted={pressDelete}
          />
          <DuplicateScreen
            open={duplicating}
            event={event}
            locale={locale}
            opener={opener}
            onClose={() => setDuplicating(false)}
            onCreated={() => {
              setDuplicating(false);
              setTold(W.created);
            }}
          />
        </>
      }
    >
      {page}
    </EventFrame>
  );
}

function Details({
  shown,
  replyBy,
  now,
  locale,
  refFor,
  onEdit,
  onMaps,
}: {
  shown: Shown;
  replyBy: string | null;
  now: Date;
  locale: string;
  refFor: RefFor;
  onEdit: (part: EditPart) => void;
  onMaps: () => void;
}) {
  const dates = datesRow(shown, locale);
  const hosts = hostsRow(shown, locale);
  const locked = scheduleLocked(shown);
  const reply = replyByRow(replyBy, shown.timeZone, locale, now);

  return (
    <PartsSection
      title={W.details}
      rowIDs="event.row"
      refFor={refFor}
      onEdit={onEdit}
      rows={[
        { part: 'dates', ...dates, opens: !locked },
        { part: 'replyBy', ...reply, opens: !locked },
        {
          part: 'venue',
          title: shown.venue?.name ?? W.venueToBeConfirmed,
          line: shown.venue?.address ? `${W.venue} · ${shown.venue.address}` : W.venue,
          opens: shown.venue != null || shown.arrivalNote == null,
          after:
            shown.arrivalNote == null && !shown.venue?.address ? undefined : (
              <>
                {shown.arrivalNote != null && <NoteInset note={shown.arrivalNote} />}
                {shown.venue == null ? (
                  <TextAction
                    label={NOTE_WORDS.addVenue}
                    onPress={() => onEdit('venue')}
                    testID="event.addVenue"
                  />
                ) : shown.venue.address ? (
                  <TextAction
                    label={W.openInMaps}
                    glyph="globe"
                    onPress={onMaps}
                    testID="event.maps"
                  />
                ) : null}
              </>
            ),
        },
        { part: 'hosts', ...hosts, opens: true },
        { part: 'type', title: TYPE_WORDS[shown.type], line: W.type, opens: true },
        { part: 'currency', title: currencyWords(shown.currency), line: W.currency, opens: true },
      ]}
    />
  );
}

function NameAndCover({
  shown,
  refFor,
  onEdit,
}: {
  shown: Shown;
  refFor: RefFor;
  onEdit: (part: EditPart) => void;
}) {
  return (
    <PartsSection
      title={W.nameAndCover}
      rowIDs="event.row"
      refFor={refFor}
      onEdit={onEdit}
      rows={[
        { part: 'name', title: shown.name, line: W.eventName, opens: true },
        {
          part: 'cover',
          title: shown.photo ? W.yourPhoto : W.defaultCover,
          line: shown.photo ? `${W.cover} · ${W.showingMiddle}` : W.cover,
          lead: <EventThumb event={shown} side={28} radius={8} />,
          opens: true,
        },
      ]}
    />
  );
}

/** sc-1439's page is not built: dashed, in Ink 2, with nothing to press; sc-3978's switch under it saves at once, as Mute does. */
function GuestsPage({ write, onWrite }: { write: WriteSwitch; onWrite: () => void }) {
  const lines = writeLines(write);
  const fixed = write.saving || !write.canChange;

  return (
    <Section title={W.guestsPage}>
      <View style={styles.dashed} testID="event.guestsPage">
        <Row
          title={W.previewGuestsPage}
          line={W.previewLine}
          lead={<LineIcon name="eye" />}
          pad={tokens.spaceXxs}
        />
        <View style={styles.pillAt}>
          <AcPill words={W.previewPill} />
        </View>
      </View>
      <Pressable
        onPress={fixed ? undefined : onWrite}
        disabled={fixed}
        style={({ pressed }) => [styles.writeRow, pressed && styles.pressed]}
        accessibilityRole="switch"
        accessibilityLabel={`${W.guestsCanWrite}. ${W.guestsCanWriteLine}`}
        accessibilityState={{ checked: write.on, busy: write.saving, disabled: fixed }}
        testID="event.guestsCanWrite"
      >
        <Row
          title={W.guestsCanWrite}
          line={W.guestsCanWriteLine}
          lead={<LineIcon name="chat" />}
          off={write.saving}
          trail={
            <View style={styles.switchAt}>
              <SwitchTrack on={write.on} />
              <Text
                size={13.5}
                weight="semibold"
                accessible={false}
                style={[styles.switchWord, write.on ? styles.wordOn : styles.wordOff]}
              >
                {writeWord(write)}
              </Text>
            </View>
          }
        />
      </Pressable>
      {lines.note != null && (
        <Text size={14} weight="medium" style={styles.writeNote}>
          {lines.note}
        </Text>
      )}
      {lines.alert != null && (
        <View style={styles.writeAlert}>
          <AlertLine text={lines.alert} />
        </View>
      )}
    </Section>
  );
}

const FOR_YOU = {
  title: W.justForYou,
  mute: W.mute,
  note: W.muteNote,
  notLoaded: W.muteNotLoaded,
  tryAgain: W.tryAgain,
  notSaved: W.muteNotSaved,
  settings: W.notificationSettings,
};

const MANAGE: Record<ManageKey, { label: string; line: string; removes: boolean }> = {
  duplicate: { label: W.duplicate, line: W.duplicateLine, removes: false },
  pause: { label: W.pause, line: W.pauseLine, removes: false },
  callOff: { label: W.callOffOpen, line: W.callOffLine, removes: true },
  endNow: { label: W.endNowOpen, line: W.endLine, removes: true },
  delete: { label: W.deleteOpen, line: W.deleteLine, removes: true },
};

const styles = StyleSheet.create({
  dashed: {
    gap: tokens.spaceXs,
    paddingVertical: tokens.spaceLg,
    paddingHorizontal: 14,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: tokens.colorControlBorder,
    borderRadius: 18,
  },
  pillAt: { paddingLeft: 40, alignItems: 'flex-start' },
  writeRow: { marginTop: tokens.spaceSm },
  pressed: { opacity: tokens.opacityPressed },
  switchAt: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm },
  switchWord: { minWidth: 26 },
  wordOn: { color: tokens.colorAccentText },
  wordOff: { color: tokens.colorInkSecondary },
  writeNote: { paddingLeft: 40, color: tokens.colorInkSecondary, lineHeight: 14 * 1.45 },
  writeAlert: { paddingLeft: 40, paddingTop: tokens.spaceXxs },
});
