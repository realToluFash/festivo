import { formattingLocale } from '@soirely/domain';
import { getLocales } from 'expo-localization';
import { type Href, router } from 'expo-router';
import { type ReactNode, type RefObject, useMemo, useReducer, useRef, useState } from 'react';
import { StyleSheet, View, type ViewInstance } from 'react-native';

import type { ScreenReaderTarget } from '../../components/screenReaderFocus.ts';
import { tokens } from '../../theme/tokens.ts';
import { LineIcon } from '../../components/AccountCard.tsx';
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
import { AreaPage, EventFrame } from './EventFrame.tsx';
import { EventNeedsYou } from './EventNeedsYou.tsx';
import { needsStateOf, readerOf } from './NeedsYouModel.ts';
import {
  type DeleteStart,
  DeleteScreen,
  DuplicateScreen,
  type LifeAsk,
  LifecycleAsk,
} from './EventLifecycle.tsx';
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
import { W, say } from './EventsWords.ts';
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
  GUESTS_ON,
  type GuestsState,
  OVERVIEW_STATES,
  clockOf as guestsClock,
  isIn,
} from '../guests/GuestsModel.ts';
import { GuestsScreen } from '../guests/GuestsScreen.tsx';
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

  return state === 'photo' ? { ...event, photo: true } : event;
}

function deleteStart(state: EventDemoState | null): DeleteStart | null {
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
  without?: AreaKey | undefined;
}) {
  const shell = useShell();
  const locale = formattingLocale('en', getLocales()[0]?.languageTag);
  const now = useMemo(
    () => (guests == null ? clockOf(state) : guestsClock(guests)),
    [state, guests],
  );
  const [event, setEvent] = useState(() => startEvent(id, state, messages));
  const [at, setAt] = useState<AreaKey>(
    guests != null
      ? isIn(OVERVIEW_STATES, guests)
        ? 'overview'
        : 'guests'
      : area == null || area === 'people' || messages === 'tell' || messages === 'tellPlace'
        ? 'overview'
        : area,
  );
  const [guestsFrom, setGuestsFrom] = useState<FilterKey | null>(null);
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
  const [duplicating, setDuplicating] = useState(state === 'duplicate');
  const [muted, setMuted] = useState(state === 'muted');
  const [mute, setMute] = useState<Mute>(
    state === 'muteNotLoaded' ? 'notLoaded' : state === 'muteNotSaved' ? 'notSaved' : 'ok',
  );
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
  const from = useRef('card');
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
  const onStep = (step: Extract<CardStep, { kind: 'button' }>) => {
    from.current = 'card';
    if (step.action === 'makeLive') shell.tell(say.ownDesign(W.makeLive));
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
    else if (needsName(event)) setDeleting(true);
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
  const numbers = (
    <GuestNumbers
      state={guests != null && isIn(OVERVIEW_STATES, guests) ? guests : 'overview'}
      onOpen={openGuests}
    />
  );
  const peopleCard = <PeopleCard state={people} />;
  const guestsPage = <GuestsPage />;
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
      items={manageOf(shown, now).map((key) => ({
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
        onWrite={writeToThem}
        onConversation={theirConversation}
        onMakeLive={() => shell.tell(say.ownDesign(W.makeLive))}
      />
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
      toast={told == null ? null : { words: told, onClose: () => setTold(null) }}
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
          <LifecycleAsk
            ask={ask}
            name={event.name}
            opener={opener}
            onKeep={() => setAsk(null)}
            onConfirm={onAsked}
          />
          <DeleteScreen
            open={deleting}
            event={event}
            start={deleteStart(state)}
            opener={opener}
            onClose={() => setDeleting(false)}
            onDeleted={deleteIt}
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
          line: shown.venue == null ? W.venue : `${W.venue} · ${shown.venue.address}`,
          opens: true,
          after:
            shown.venue == null ? undefined : (
              <TextAction label={W.openInMaps} glyph="globe" onPress={onMaps} testID="event.maps" />
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

/** sc-1439's page is not built: dashed, in Ink 2, with nothing to press. */
function GuestsPage() {
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
});
