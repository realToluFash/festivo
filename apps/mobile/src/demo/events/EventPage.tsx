import { formattingLocale, takesCardStep } from '@soirely/domain';
import { getLocales } from 'expo-localization';
import { type Href, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
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

import type { ScreenReaderTarget } from '../../components/screenReaderFocus.ts';
import { dateLocale } from '../../i18n/index.ts';
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
import {
  AreaPage,
  BellRow,
  EventBellAt,
  EventFrame,
  type EventToast,
  backToEvents,
} from './EventFrame.tsx';
import { useEventBell } from './EventBell.tsx';
import { INVITATION_HREF, liveToastOf, makeLiveStateOf, reachOf, seededEvent } from './MakeLive.ts';
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
import { duplicateStateOf } from './Duplicate.ts';
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
import { comingUpShows, seedRunOfShow, stepless } from './LiveOneDay.ts';
import { ComingUpPart, KeepsHeight } from './LiveOneDayParts.tsx';
import {
  type AreaKey,
  DINER,
  type SampleEvent,
  TYPE_WORDS,
  currencyWords,
  sampleEvent,
} from './EventsSample.ts';
import { LIVE, W, say } from './EventsWords.ts';
import { EventNotice } from '../../components/EventNotice.tsx';
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
import { TY_WORDS, cardOf, cardShown, endFieldOf, isEndState, opened } from './ThankYou.ts';
import { EndNowAsk, ThankYouCard, ThankYouScreen } from './ThankYouParts.tsx';
import { replyByOf } from '../guests/GuestsSample.ts';
import { useShell } from '../../components/settingsShell.ts';
import { LoadingBlock, Row, Section, TextAction } from '../../components/Summary.tsx';
import { type MessagesState, startOf } from '../messages/MessagesModel.ts';
import { reduceReach } from '../messages/Reach.ts';
import { TellGuests } from '../messages/MessagesOverlays.tsx';
import { Untold } from '../messages/MessagesList.tsx';
import { LONG_FINISHED, PLACE, SAMPLE_EVENT_ID, TELL } from '../messages/MessagesSample.ts';
import { tellChange } from '../messages/TellChange.ts';
import {
  type TellRun,
  dayStillToCome,
  eventBehind,
  fieldEvents,
  isTellKind,
  pressSend,
  sendingWords,
  sheetOf,
} from '../messages/TellKinds.ts';
import { MessagesScreen, badgeFor } from '../messages/MessagesScreen.tsx';
import { W as MW } from '../messages/MessagesWords.ts';
import type { SeatingState } from '../seating/SeatingModel.ts';
import { SeatingScreen } from '../seating/SeatingScreen.tsx';
import { GuestNumbers } from '../guests/GuestNumbers.tsx';
import { PeopleCard } from '../people/PeopleCard.tsx';
import type { CardState } from '../people/PeopleCardModel.ts';
import { type PeopleParams, PeopleSection } from '../people/People.tsx';
import { PeopleInEvent } from '../people/PeopleFrame.tsx';
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
  overviewCountsOf,
  peopleOn,
} from '../guests/GuestsModel.ts';
import { lastLooked, markLooked, resetLooked, seedLook, takeLook } from '../guests/ChangedSince.ts';
import { GuestsScreen } from '../guests/GuestsScreen.tsx';
import { DemoOnly } from '../../steps/Lines.tsx';
import { Choices } from '../focusedHeader/FocusedHeaderScreen.tsx';
import { RefreshingWords } from '../guests/RefreshingWords.tsx';
import {
  BACK_HREF,
  BACK_KEY,
  type Opened,
  type Opener,
  backScreenOf,
  bellOpens,
  openersFor,
  openerWords,
  wayBack,
} from './opener.ts';
import { GUESTS as TALKS, type GuestKey } from '../messages/MessagesSample.ts';
import type { BudgetState } from '../budget/BudgetModel.ts';
import { BudgetScreen } from '../budget/BudgetScreen.tsx';
import type { BriefingState } from '../briefing/briefingModel.ts';
import { StaffRoster } from '../staffLink/StaffRoster.tsx';
import type { RosterState } from '../staffLink/StaffRosterModel.ts';
import { type OriginState, draftFromEnquiry } from '../enquiries/EnquiryToEventModel.ts';
import { FromEnquiryLine } from '../enquiries/FromEnquiryParts.tsx';
import { EventsFailed } from '../../components/Events.tsx';
import { SwitchedNotice } from '../../components/SwitchedNotice.tsx';
import { type TonightRow, TonightRows } from '../station/TonightRows.tsx';
import { isBellState } from '../messages/BellStates.ts';

type Mute = 'ok' | 'notLoaded' | 'notSaved';

/** Tell guests opens once the edit's own screen has gone, since iOS shows one window at a time. */
const TELL_AFTER_MS = 800;

const ASKS: Partial<Record<EventDemoState, LifeAsk>> = {
  pause: 'pause',
  callOff: 'callOff',
  endNow: 'endNow',
  deleteDraft: 'deleteDraft',
};

const HOST = ['events.read', 'events.create', 'events.manage'];
const VIEWER = ['events.read'];

/** Where sc-4330's states open: Messages for its list and rows, Overview under every sheet and its banner. */
const TELL_IN_MESSAGES: readonly string[] = [
  'untoldMerged',
  'untoldDismissed',
  'changeRow',
  'changeSent',
  'changeMerged',
  'changeDone',
];

function startEvent(
  id: string | undefined,
  state: EventDemoState | null,
  messages: MessagesState | null,
  now: Date,
): SampleEvent {
  const event = sampleEvent(id) ?? sampleEvent('evt-wed-4');
  if (event == null) throw new Error('The sample has the wedding.');
  seedFinalNumbers(state);
  seedRunOfShow(state);
  if (isTellKind(messages))
    return eventBehind(messages, fieldEvents(messages, event)?.now ?? event, now);
  const live = makeLiveStateOf(state);
  if (live != null) return seededEvent(event, live);
  if (messages === 'tell' || messages === 'untold') return { ...event, startsAt: TELL.startsAt };
  if (messages === 'tellPlace') return { ...event, venue: PLACE };
  if (messages === 'closedDraft' || messages === 'noManageDraft')
    return { ...event, status: 'draft' };
  if (messages === 'closedEnded' || messages === 'noManageEnded')
    return { ...event, ...LONG_FINISHED, status: 'ended' };
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
  staff = null,
  briefing = null,
  people = null,
  peopleParams,
  guestsFrom: figureOpens = null,
  without,
  origin = null,
  linked = false,
  failed = null,
  opened: openedOver,
  clock,
  night,
  station,
}: {
  id: string | undefined;
  state: EventDemoState | null;
  area: AreaKey | null;
  messages?: MessagesState | null;
  seating?: SeatingState | null;
  /** With Guests' own states, Guests opens on one, or Overview on its counts. */
  guests?: GuestsState | null;
  budget?: BudgetState | null;
  /** The Staff area's roster state (sc-77903). */
  staff?: RosterState | null;
  /** sc-3917: the briefing above the roster, on a tablet. */
  briefing?: BriefingState | null;
  /** The People card's state on Overview (sc-29914); none is the populated card. */
  people?: CardState | null;
  /** People's own query, when People opens in this frame from its own page (sc-67665). */
  peopleParams?: PeopleParams | undefined;
  /** A figure on Events opens the event's Guests with its choice in the filter menu (sc-3786); the bell's Guest replies item over another event opens Changed since you looked (sc-84453). */
  guestsFrom?: ListFilter | null;
  without?: AreaKey | undefined;
  origin?: OriginState | null;
  /** Opened from its link (sc-80863): a move into the event's organisation is said at the head of Overview, until the person leaves it. */
  linked?: boolean;
  /** The event did not load, and Try again reads it again (sc-80863). */
  failed?: (() => void) | null;
  /** What the event was opened over, and the board's Spanish and Refreshing… (sc-83008). */
  opened?: Opened | undefined;
  /** The moment the frame reads as now, when what it holds runs on its own sample's clock (sc-72). */
  clock?: Date | undefined;
  /** Your night, for a member of the organisation with a shift (sc-3915). */
  night?: TonightRow | undefined;
  /** Kitchen station, under Your night or in its place, on the event's day (sc-95382). */
  station?: TonightRow | undefined;
}) {
  const shell = useShell();
  const top = useBehind(openedOver);
  const locale = formattingLocale('en', getLocales()[0]?.languageTag);
  const now = useMemo(
    () => clock ?? (guests == null ? clockOf(state) : guestsClock(guests)),
    [clock, state, guests],
  );
  const [event, setEvent] = useState(() =>
    origin == null
      ? startEvent(id, state, messages, now)
      : draftFromEnquiry(startEvent(id, state, messages, now)),
  );
  const reach = useMemo(() => reachOf(state, event), [state, event]);
  const live = useMakeLive(state, reach, (host) =>
    setEvent((now) => ({ ...now, hosts: host == null ? now.hosts : [host], status: 'live' })),
  );
  const [at, setAt] = useState<AreaKey>(() => {
    if (guests != null && !isIn(OVERVIEW_STATES, guests)) seedLook(areaStart(guests).looked, now);
    else if (isBellState(messages)) resetLooked();

    return figureOpens != null
      ? 'guests'
      : guests != null
        ? isIn(OVERVIEW_STATES, guests)
          ? 'overview'
          : 'guests'
        : area == null ||
            messages === 'tell' ||
            messages === 'tellPlace' ||
            (isTellKind(messages) && !TELL_IN_MESSAGES.includes(messages))
          ? 'overview'
          : area;
  });
  const [peopleAt, setPeopleAt] = useState<PeopleParams>(peopleParams ?? {});
  const [guestsFrom, setGuestsFrom] = useState<ListFilter | null>(figureOpens);
  const [sinceFrom, setSinceFrom] = useState<string | null>(() =>
    figureOpens === 'changed' ? lastLooked() : null,
  );
  useEffect(() => {
    if (figureOpens === 'changed') markLooked(now);
  }, [figureOpens, now]);
  const [m, dispatch] = useReducer(reduceReach, null, () => {
    const begun = startOf(messages, shell.layout !== 'phone');
    if (isTellKind(messages)) {
      const fields = fieldEvents(messages, sampleEvent(id) ?? event);
      const lines = fields == null ? null : tellChange(fields.told, fields.now, locale);

      return { ...begun, change: sheetOf(messages, lines) };
    }
    if (state !== 'datesReplyBySaved') return begun;
    const change = tellChange(sampleEvent(id) ?? event, event, locale);

    return reduceReach(begun, { type: 'offerTell', change });
  });
  const onTellRun = useCallback((run: TellRun) => dispatch({ type: 'tellRun', run }), []);
  const [messagesSeen, setMessagesSeen] = useState(messages != null || at === 'messages');
  if (at === 'messages' && !messagesSeen) setMessagesSeen(true);
  const messagesHere = event.id === SAMPLE_EVENT_ID;
  const [toldEvent, setToldEvent] = useState(() => {
    const sample = sampleEvent(id) ?? event;

    return (isTellKind(messages) ? fieldEvents(messages, sample)?.told : null) ?? sample;
  });
  const [more, setMore] = useState(state === 'more');
  const [leftOverview, setLeftOverview] = useState(false);
  const [edit, setEdit] = useState<EditPart | null>(editOf(state));
  const [round, setRound] = useState(0);
  const [part, setPart] = useState<EditPart>(editOf(state) ?? 'dates');
  const [ask, setAsk] = useState<LifeAsk | null>(
    state == null ? null : isEndState(state) ? 'endNow' : (ASKS[state] ?? null),
  );
  const [ending, setEnding] = useState(0);
  const [thanks, setThanks] = useState(() => cardOf(state));
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
  const [duplicating, setDuplicating] = useState(duplicateStateOf(state) != null);
  const [copies, setCopies] = useState(0);
  const duplicate = () => {
    setCopies((count) => count + 1);
    setDuplicating(true);
  };
  const [noPhoto, setNoPhoto] = useState(state === 'createdNoPhoto');
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
    messages === 'changeSending'
      ? sendingWords(m.change)
      : messages === 'allTold'
        ? MW.allTold
        : state === 'saved'
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
  const tellOf = (kind: 'tellPause' | 'tellCallOff' | 'tellEndNow' | 'tellResume') => {
    if (!messagesHere) return;
    const change = sheetOf(kind, null);

    setTimeout(() => dispatch({ type: 'offerTell', change }), TELL_AFTER_MS);
  };
  const onStep = (step: Extract<CardStep, { kind: 'button' }>) => {
    from.current = 'card';
    if (step.action === 'makeLive') live.open(event.hosts.length === 0);
    else if (step.action === 'changeDates') openEdit('dates');
    else if (step.action === 'resume') {
      setEvent({ ...event, status: 'live' });
      if (!(m.untold && m.change.what.includes(MW.pausedItem))) tellOf('tellResume');
    } else duplicate();
  };
  const onManage = (key: ManageKey) => {
    from.current = key;
    if (key === 'duplicate') duplicate();
    else if (key === 'pause') setAsk('pause');
    else if (key === 'callOff') setAsk('callOff');
    else if (key === 'endNow') {
      setEnding((count) => count + 1);
      setAsk('endNow');
    } else if (refusal != null) setRefused(true);
    else if (needsName(event, peopleOn(event.id))) setDeleting(true);
    else setAsk('deleteDraft');
  };
  const onAsked = (which: LifeAsk) => {
    setAsk(null);
    if (which === 'pause') {
      setEvent({ ...event, status: 'paused' });
      tellOf('tellPause');
    } else if (which === 'deleteDraft') deleteIt();
    else {
      setEvent({ ...event, status: 'ended', concludedAt: now.toISOString() });
      tellOf('tellCallOff');
    }
  };
  const toggleMute = () => {
    setMute('ok');
    setMuted(!muted);
  };

  const member = { permissions: thanks.canEnd ? HOST : VIEWER };
  const creates = takesCardStep(member, 'duplicate');
  const manages = takesCardStep(member, 'resume');
  const ended = shown.status === 'ended';
  const drawCard = (one: Shown, height?: number, unseen = false) => (
    <EventCard
      event={one}
      now={now}
      locale={dateLocale()}
      wide={shell.layout !== 'phone'}
      {...(height != null && { height })}
      takes={(action) => takesCardStep(member, action)}
      onStep={onStep}
      stepRef={unseen ? undefined : cardStep}
      testID={unseen ? 'event.card.unseen' : 'event.card'}
    />
  );
  const card = stepless(shown.phase, shown.milestones ?? [], now, ended) ? (
    <KeepsHeight footed={drawCard({ ...shown, phase: 'finished' }, undefined, true)}>
      {(height) => drawCard({ ...shown, milestones: null }, height)}
    </KeepsHeight>
  ) : (
    drawCard(shown)
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
      last={origin === 'from-enquiry' ? <FromEnquiryLine /> : null}
    />
  );
  const comingUp = event.id === DINER.id && (
    <ComingUpPart
      shows={comingUpShows(event, shown.phase, shown.milestones ?? [], now, ended, locale)}
      timeZone={event.timeZone}
      now={now}
      onAllDates={() => shell.tell(say.ownDesign(W.allDates))}
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
  const thankYou = shown.phase === 'finished' && !shown.calledOff && cardShown(thanks) && (
    <ThankYouCard
      event={shown}
      card={thanks}
      locale={locale}
      refFor={refFor}
      onOpen={() => {
        from.current = 'thankYou';
        setThanks(opened(thanks));
      }}
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
  const bell = useEventBell({
    eventId: event.id,
    startOpen: openedOver?.bell === true,
    onHere: (key) => {
      if (bellOpens(key) === 'guests') openChanged();
      else setAt('overview');
    },
  });
  const tonight = <TonightRows night={night} station={station} />;
  const numbers = (
    <GuestNumbers
      state={guests != null && isIn(OVERVIEW_STATES, guests) ? guests : 'overview'}
      counts={overviewCountsOf(event.id, shown.phase)}
      onOpen={openGuests}
    />
  );
  const peopleCard = (
    <PeopleCard
      state={people}
      onOpen={(params) => {
        setPeopleAt(params);
        setAt('people');
      }}
    />
  );
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
  const offered = usableManage(manageOf(shown, now), canChange).filter((key) =>
    key === 'duplicate' ? creates : manages,
  );
  const manage =
    offered.length === 0 ? null : (
      <Manage
        title={W.manage}
        items={offered.map((key) => ({ key, ...MANAGE[key], testID: `event.manage.${key}` }))}
        refFor={refFor}
        onManage={onManage}
      />
    );
  const tellHere = (words: string) => {
    if (at === 'messages') dispatch({ type: 'told', words });
    else setTold(words);
  };
  const tellSent = () => {
    const pressed = pressSend(m.tell);
    if (pressed.kind === 'run') {
      dispatch({ type: 'tellRun', run: pressed.run });
      return;
    }
    dispatch({ type: pressed.told === 'sent' ? 'tellSent' : 'tellAllTold' });
    setToldEvent(event);
    tellHere(pressed.told === 'sent' ? sendingWords(m.change) : MW.allTold);
  };
  const tell = messagesHere && (
    <TellGuests
      open={m.telling}
      change={m.change}
      run={m.tell}
      phone={shell.layout === 'phone'}
      opener={opener}
      onSend={tellSent}
      onNotNow={() => dispatch({ type: 'notNow' })}
      onRun={onTellRun}
      before={tellMoved}
    />
  );
  const banner = messagesHere && m.untold && m.change.what.length > 0 && (
    <Untold
      what={m.change.what}
      onTell={() => dispatch({ type: 'telling', open: true })}
      onDismiss={() => {
        dispatch({ type: 'dismissUntold' });
        setTold(MW.dismissed);
      }}
    />
  );

  const makeLive = (
    <MakeLiveAsk
      live={live.s}
      reach={reach}
      name={event.name}
      hosts={event.hosts}
      opener={opener}
      onKeep={live.keep}
      onConfirm={live.confirm}
      onTyped={live.typed}
      onSend={live.send}
      onChangeDates={() => {
        live.keep();
        openEdit('dates');
      }}
    />
  );
  const liveSaid = liveToastOf(live.s, reach);
  const photoNotice = noPhoto && (
    <EventNotice
      tone="broken"
      words={say.createdWithout(W.coverRefused)}
      actions={
        <TextAction
          label={W.upload}
          glyph="camera"
          onPress={() => {
            setNoPhoto(false);
            openEdit('cover');
          }}
          testID="event.createdNoPhoto.cover"
        />
      }
    />
  );
  const demoNote = live.s.toast === 'queued' && (
    <DemoOnly title={LIVE.demoMessages}>{null}</DemoOnly>
  );
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
                  testID: 'event.toast.messages',
                  onPress: () => {
                    live.closeToast();
                    router.push(INVITATION_HREF as Href);
                  },
                }
              : null,
        };

  if (linked && at !== 'overview' && !leftOverview) setLeftOverview(true);
  // Every area's frame opens the page's bell, the areas drawn by their own screen included (sc-84453).
  const lend = (node: ReactNode) => (
    <EventBellAt.Provider value={bell}>{node}</EventBellAt.Provider>
  );

  if (state === 'loading' || failed != null)
    return lend(
      <EventFrame
        event={shown}
        now={now}
        area={at}
        onArea={setAt}
        more={more}
        onMore={setMore}
        without={without}
        behind={top.behind}
        loading
      >
        <BellRow>{null}</BellRow>
        {failed == null ? (
          <LoadingBlock words={W.loadingEvent} />
        ) : (
          <EventsFailed words={W.failedLoadEvent} onRetry={failed} testID="event.link.retry" />
        )}
      </EventFrame>,
    );

  if (at === 'people')
    return lend(
      <PeopleInEvent.Provider
        value={{
          event: shown,
          now,
          onArea: setAt,
          more,
          onMore: setMore,
          badge: messagesHere && messagesSeen ? badgeFor(m) : null,
          without,
        }}
      >
        <PeopleSection params={peopleAt} />
      </PeopleInEvent.Provider>,
    );

  if (at === 'seating' && messagesHere)
    return lend(
      <SeatingScreen
        state={seating}
        event={shown}
        now={now}
        more={more}
        onMore={setMore}
        onArea={setAt}
      />,
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
    return lend(
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
        behind={top.behind}
        onWrite={writeToThem}
        onConversation={theirConversation}
        onMakeLive={() => shell.tell(say.ownDesign(W.makeLive))}
      />,
    );

  if (at === 'budget' && messagesHere)
    return lend(
      <BudgetScreen
        state={budget}
        event={shown}
        now={now}
        locale={locale}
        more={more}
        onMore={setMore}
        onArea={setAt}
      />,
    );

  if (at === 'messages' && messagesHere)
    return lend(
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
          bell: isBellState(messages) ? messages : 'bell',
          keys:
            messages === 'write' ||
            messages === 'cancelled' ||
            messages === 'scheduledEdit' ||
            messages === 'typedBraces',
        }}
        extra={tell}
      />,
    );

  let page: ReactNode;
  if (at === 'staff' && messagesHere)
    page = (
      <AreaPage area={at} event={shown} locale={dateLocale()}>
        <StaffRoster state={staff ?? 'populated'} briefing={briefing} />
      </AreaPage>
    );
  else if (at !== 'overview') page = <AreaPage area={at} event={shown} locale={dateLocale()} />;
  else
    page = (
      <OverviewColumns
        landscape={shell.layout === 'landscape'}
        card={
          <BellRow>
            {top.ownLine}
            {linked && !leftOverview ? (
              <View style={styles.headed}>
                <SwitchedNotice />
                {card}
              </View>
            ) : (
              card
            )}
          </BellRow>
        }
        left={
          <>
            {photoNotice}
            {banner}
            {demoNote}
            {thankYou}
            {details}
            {needsYou}
            {comingUp}
            {nameCover}
          </>
        }
        right={
          <>
            {tonight}
            {numbers}
            {peopleCard}
            {guestsPage}
            {forYou}
            {manage}
          </>
        }
        stacked={
          <>
            {photoNotice}
            {banner}
            {demoNote}
            {thankYou}
            {tonight}
            {numbers}
            {peopleCard}
            {details}
            {needsYou}
            {comingUp}
            {nameCover}
            {guestsPage}
            {forYou}
            {manage}
            {top.picker}
          </>
        }
      />
    );

  return lend(
    <EventFrame
      event={shown}
      now={now}
      area={at}
      onArea={setAt}
      more={more}
      onMore={setMore}
      badge={messagesHere && messagesSeen ? badgeFor(m) : null}
      without={without}
      behind={top.behind}
      besideBack={at === 'overview' ? top.besideBack : undefined}
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
          <ThankYouScreen
            card={thanks}
            locale={locale}
            opener={opener}
            onCard={setThanks}
            onSaid={setTold}
          />
          <EndNowAsk
            key={`end:${ending}`}
            open={ask === 'endNow'}
            name={event.name}
            start={endFieldOf(ending === 0 ? state : null)}
            locale={locale}
            opener={opener}
            onKeep={() => setAsk(null)}
            onEnded={(line) => {
              setAsk(null);
              setEvent({ ...event, status: 'ended', concludedAt: now.toISOString() });
              setThanks(cardOf(null, line));
              if (line !== '') setTold(TY_WORDS.done);
              if (dayStillToCome(event, now)) tellOf('tellEndNow');
            }}
          />
          <LifecycleAsk
            ask={ask === 'endNow' ? null : ask}
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
            key={`copy:${copies}`}
            open={duplicating}
            event={event}
            locale={locale}
            start={copies === 0 ? duplicateStateOf(state) : null}
            opener={opener}
            onClose={() => setDuplicating(false)}
            onCreated={(copy) => {
              setDuplicating(false);
              setEvent(copy);
            }}
          />
        </>
      }
    >
      {page}
    </EventFrame>,
  );
}

/** ‹ names the screen the event was opened over and goes back to it; nothing in the app behind it reads Events and opens Events, as today. Refreshing… sits beside ‹ where ‹ stays whole with it, else on its own line above the event's card, ‹ whole (sc-83008, as sc-71821 on Guests). */
function useBehind(opened: Opened | undefined) {
  const shell = useShell();
  const { i18n } = useTranslation();
  const [spanish, setSpanish] = useState(opened?.spanish ?? false);
  const words = useMemo(() => i18n.getFixedT(spanish ? 'es' : 'en'), [i18n, spanish]);
  const [over, setOver] = useState<Opener>(opened?.opener ?? 'events');
  const [refreshing, setRefreshing] = useState(opened?.refreshing ?? false);
  const [beside, setBeside] = useState(false);
  const upright = shell.layout !== 'landscape';
  const screen = backScreenOf(over, shell.layout);
  const leave = () => {
    const way = wayBack(screen, over, opened);
    if (way === 'events') backToEvents();
    else if (way === 'back' && router.canGoBack()) router.back();
    else router.dismissTo((way === 'back' ? BACK_HREF[screen] : way) as Href);
  };
  const node = refreshing ? (
    <RefreshingWords words={words('eventsScreen.refreshing')} testID="event.refreshing" />
  ) : null;

  return {
    behind: upright ? { label: words(BACK_KEY[screen]), onPress: leave } : undefined,
    besideBack: upright && node != null ? { node, onPlaced: setBeside } : undefined,
    ownLine: upright && node != null && !beside ? <View style={styles.ownLine}>{node}</View> : null,
    picker: upright ? (
      <DemoOnly title="Demo only: what the event was opened over. ‹ reads that screen's name and goes back to it; a link from outside, a notification that started the app and the event after signing in have nothing behind them and read Events. Refreshing… sits beside ‹ while ‹ stays whole with it, else on its own line above the event's card. Spanish draws the top row in Spanish. On an iPad, another event's page from the bell reads Event and goes back to that event at its Guests, filtered to Coming; deleted meanwhile, that page reads This event is not available. The bell on this page opens over it: a notification for another event opens that event over this page (its Guest replies at Guests, Changed since you looked, where ‹ also reads Event and goes back to this page), one for this event opens here. Nothing is sent.">
        <Choices
          heading="Opened over"
          options={openersFor(shell.layout).map((key) => ({
            key,
            label: openerWords(key, shell.layout),
          }))}
          chosen={over}
          onChoose={setOver}
          id="opener"
          prefix="event.behind"
        />
        <Choices
          heading="Refreshing…"
          options={ON_OFF}
          chosen={refreshing ? 'on' : 'off'}
          onChoose={(key) => setRefreshing(key === 'on')}
          id="refreshing"
          prefix="event.behind"
        />
        <Choices
          heading="Language"
          options={LANGUAGES}
          chosen={spanish ? 'es' : 'en'}
          onChoose={(key) => setSpanish(key === 'es')}
          id="language"
          prefix="event.behind"
        />
      </DemoOnly>
    ) : null,
  };
}

const LANGUAGES = [
  { key: 'en', label: 'English' },
  { key: 'es', label: 'Spanish' },
] as const;

const ON_OFF = [
  { key: 'off', label: 'Off' },
  { key: 'on', label: 'On' },
] as const;

function Details({
  shown,
  replyBy,
  now,
  locale,
  refFor,
  onEdit,
  onMaps,
  last,
}: {
  shown: Shown;
  replyBy: string | null;
  now: Date;
  locale: string;
  refFor: RefFor;
  onEdit: (part: EditPart) => void;
  onMaps: () => void;
  last?: ReactNode;
}) {
  const dates = datesRow(shown, dateLocale());
  const hosts = hostsRow(shown, dateLocale());
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
        {
          part: 'currency',
          title: currencyWords(shown.currency),
          line: W.currency,
          opens: true,
          after: last,
        },
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
  headed: { gap: 18 },
  ownLine: { marginBottom: tokens.spaceMd },
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
