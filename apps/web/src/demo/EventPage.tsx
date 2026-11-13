import { DemoBell } from './DemoBell.tsx';
import { calledOff, eventPhase, formatEventRange, hostsLine } from '@soirely/domain';
import { type ComponentType, type ReactNode, useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router';

import {
  type Area,
  type CardDoes,
  type EventStateName,
  type Manage,
  type Part,
  type SampleEvent,
  AREAS,
  COMING,
  CURRENCIES,
  EVENT_WORDS as W,
  TYPE_WORDS,
  areaOf,
  clockOf,
  eventStateOf,
  keepChange,
  forget,
  lineOf,
  localDay,
  manageOf,
  needsName,
  partOf,
  resetSample,
  sampleEvent,
  shownOf,
  stateFits,
} from './events.ts';
import { EndNowAsk, ThankYouCard } from './ThankYou.tsx';
import { eventWhile } from './messagesScheduled.ts';
import { TY_WORDS, cardOf, cardShown, endFieldOf, type EndField } from './thankYou.ts';
import { type DuplicateStart, DeleteByName, DuplicateDialog, RefusedAsk } from './EventDialogs.tsx';
import {
  AT_READ,
  type Refusal,
  type RefusedVerb,
  invitedOf,
  refusalOf,
  refusedStartOf,
  usableManage,
} from './deleteRefusal.ts';
import {
  type PartProps,
  CoverPart,
  CurrencyPart,
  DatesPart,
  HostsPart,
  NamePart,
  TypePart,
  VenuePart,
} from './EventEdits.tsx';
import { ReplyByPart } from './EventReplyBy.tsx';
import { withNote } from './arrivalNote.ts';
import './arrivalNote.css';
import {
  REPLY_BY_WORDS,
  datesSaveSays,
  replyByAfterStart,
  replyBySays,
  rowDay,
} from './replyBy.ts';
import { EventNeedsYou } from './EventNeedsYou.tsx';
import { type NeedsState, readerOf } from './needsYou.ts';
import { EventCard, EventsShell, NotBuilt, Thumb } from './EventParts.tsx';
import { EventSidebar } from './EventSidebar.tsx';
import { AllDates } from './EventDates.tsx';
import {
  KITCHEN_EVENT,
  KW,
  cardMilestone,
  kitchenAt,
  seedFromEvent,
  timelineOf,
} from './kitchen.ts';
import { MW, menuAt } from './menuServed.ts';
import { Glyph } from '../components/Glyph.tsx';
import { BUDGET_EVENT } from './budget.ts';
import { BudgetEntry } from './BudgetRoutes.tsx';
import {
  type NumbersState,
  guestsAt,
  hasGuests,
  invitedOn,
  numbersStateOf,
  peopleOn,
  replyByOf,
} from './guests.ts';
import { GuestNumbers } from './GuestsParts.tsx';
import {
  type Told,
  NEW_PLACE,
  ROSEWOOD,
  SAMPLE_EVENT,
  STARTS_LATER,
  TELL,
  keepInbox,
  keptInbox,
  messagesStateOf,
  resetInbox,
  toldOf,
  waitingLine,
} from './messages.ts';
import { MessagesPage } from './Messages.tsx';
import { DOOR_EVENT_ID } from './doorCode.ts';
import { repliesOpen } from './replyClose.ts';
import { noOrgStateOf } from './noOrg.ts';
import { NoOrgEvent } from './NoOrgEvent.tsx';
import { TellDialog } from './MessagesTell.tsx';
import { Ask, Head, RowWords } from '../components/SettingsParts.tsx';
import { Crumb, Lead, ManageItem, ManageList, PartRow } from '../components/EventPageParts.tsx';
import { JustForYou } from '../components/JustForYou.tsx';
import { GuestsCanWrite } from './GuestsCanWrite.tsx';
import type { Tell } from '../components/SettingsParts.tsx';
import { useSwitcherStart } from './switcher.ts';
import { useLeaveAsk } from './useLeaveAsk.ts';
import { MakeLiveAsk } from './EventMakeLive.tsx';
import type { Told as ShellTold } from './ActionToast.tsx';
import {
  type MakeLiveState,
  type Offer,
  type Phase,
  ASK,
  INVITED_AT,
  LW,
  isMakeLive,
  lw,
  maySend,
  offerOf,
  phaseOf,
  seededEvent,
} from './makeLive.ts';

const LOCALE = 'en-US';

interface Arrival {
  open?: Part;
  told?: string;
}

type Asking = 'pause' | 'callOff' | 'endNow' | 'deleteDraft' | 'delete' | 'refused' | 'duplicate';

const PARTS: Record<Exclude<Part, 'replyBy'>, ComponentType<PartProps>> = {
  dates: DatesPart,
  venue: VenuePart,
  hosts: HostsPart,
  type: TypePart,
  currency: CurrencyPart,
  name: NamePart,
  cover: CoverPart,
};

/** Reply by as each state opens it: the sample's, or what was just saved (sc-3780). */
function replyByStart(state: EventStateName | null, id: string): string | null {
  if (state === 'replyBySaved') return '2026-11-03';
  if (state === 'replyByRemoved') return null;

  return replyByOf(id);
}

function needsStateOf(state: EventStateName | null): NeedsState | null {
  return state != null && state.startsWith('needsYou') ? (state as NeedsState) : null;
}

function askingOf(state: EventStateName | null): Asking | null {
  switch (state) {
    case 'endNowThankYou':
    case 'endNowLong':
    case 'endNowOver':
    case 'endNowEnding':
    case 'endNowNotEnded':
      return 'endNow';
    case 'pause':
    case 'callOff':
    case 'endNow':
    case 'deleteDraft':
    case 'duplicate':
      return state;
    case 'duplicateTicked':
    case 'duplicateNoGuests':
    case 'duplicateNoManage':
    case 'duplicateCreating':
    case 'duplicateNotCreated':
    case 'duplicateOverPlan':
    case 'duplicateOverPlanAsk':
    case 'duplicateOverCeiling':
    case 'duplicateNoStart':
      return 'duplicate';
    case 'delete':
    case 'deleteDraftGuests':
    case 'deleteMismatch':
    case 'deleteTyped':
    case 'deleteRace':
    case 'deleteRaceRead':
      return 'delete';
    case 'deleteRefused':
    case 'deleteRefusedStarted':
    case 'deleteRefusedRead':
    case 'deleteRefusedStartedRead':
    case 'deleteRefusedPaused':
      return 'refused';
    default:
      return null;
  }
}

/** An event at a desk in A · Summary first (Events-A-Desk, page 29): its own sidebar, the card, Details and the rest in two columns, each part edited in place. */
export function EventPage({
  dates = false,
  messages = false,
}: {
  dates?: boolean;
  messages?: boolean;
}) {
  const { id } = useParams();
  const [params] = useSearchParams();
  const raw = params.get('state');
  useSwitcherStart();
  const noOrg = noOrgStateOf(raw);

  if (noOrg != null && id === DOOR_EVENT_ID) return <NoOrgEvent key={noOrg} state={noOrg} />;

  return (
    <EventAt
      key={`${id ?? ''}|${raw ?? ''}|${messages}`}
      id={id}
      raw={raw}
      dates={dates}
      messages={messages}
    />
  );
}

function EventAt({
  id,
  raw,
  dates,
  messages,
}: {
  id: string | undefined;
  raw: string | null;
  dates: boolean;
  messages: boolean;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const [arrival] = useState<Arrival>(() => (location.state as Arrival | null) ?? {});
  const [first] = useState(() => {
    if (raw != null) resetSample();
    if (raw != null && messages) resetInbox();
    seedFromEvent(raw);

    const event = sampleEvent(id);
    const named = messages ? null : eventStateOf(raw);
    const state = event != null && named != null && stateFits(named, event) ? named : null;

    const shown =
      event == null || state == null
        ? event
        : state === 'photo'
          ? { ...event, photo: true }
          : state === 'noteNoVenue' || state === 'noteWide' || state === 'noteMarkup'
            ? withNote(event, state)
            : isMakeLive(state)
              ? seededEvent(event, state)
              : event;

    return { event: shown, state };
  });

  useEffect(() => {
    if (location.state == null) return;

    void navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
  }, [location, navigate]);

  if (first.event == null) return <Navigate to="/demo/events" replace />;

  const said = messages ? messagesStateOf(raw) : null;

  const telling = said === 'tell' || said === 'tellPlace';

  if (messages && first.event.id === SAMPLE_EVENT && !telling)
    return <MessagesPage event={eventWhile(said, first.event)} state={said} now={clockOf(null)} />;

  return (
    <EventView
      initial={
        said === 'tell'
          ? { ...first.event, startsAt: TELL.movedTo }
          : said === 'tellPlace'
            ? { ...first.event, venue: ROSEWOOD }
            : first.event
      }
      state={first.state}
      numbers={messages ? null : numbersStateOf(raw)}
      arrival={arrival}
      dates={dates}
      fixedArea={messages && !telling ? 'messages' : null}
      telling={said === 'tell' ? [STARTS_LATER] : said === 'tellPlace' ? [NEW_PLACE] : null}
    />
  );
}

function EventView({
  initial,
  state,
  numbers,
  arrival,
  dates,
  fixedArea = null,
  telling: tellingFirst = null,
}: {
  initial: SampleEvent;
  state: EventStateName | null;
  numbers: NumbersState | null;
  arrival: Arrival;
  dates: boolean;
  fixedArea?: Area | null;
  telling?: readonly Told[] | null;
}) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const now = clockOf(state);
  const area = fixedArea ?? areaOf(params.get('area'));
  const [telling, setTelling] = useState<readonly Told[] | null>(tellingFirst);
  const [event, setEvent] = useState(initial);
  const [replyBy, setReplyBy] = useState(() => replyByStart(state, initial.id));
  const [tellMoved, setTellMoved] = useState<string | null>(null);
  const [part, setPart] = useState<Part | null>(partOf(state) ?? arrival.open ?? null);
  const [dirty, setDirty] = useState(false);
  const [leaving, setLeaving] = useState<{ to: Part | null } | null>(null);
  const [asking, setAsking] = useState<Asking | null>(askingOf(state));
  const [ending, setEnding] = useState(0);
  const refusedStart = refusedStartOf(state);
  const canChange = refusedStart?.canChange ?? true;
  const [pressed, setPressed] = useState(false);
  const [turned, setTurned] = useState(false);
  const refusal = refusalOf(
    event,
    now,
    invitedOf(state, refusedStart, invitedOn(event.id), pressed),
    canChange,
  );
  const [card, setCard] = useState(() => cardOf(state));
  const [muted, setMuted] = useState(state === 'muted');
  const [muteLoaded, setMuteLoaded] = useState(state !== 'muteNotLoaded');
  const [muteFailed, setMuteFailed] = useState(state === 'muteNotSaved');
  const away = useLeaveAsk(dirty);
  const live = isMakeLive(state) ? state : null;
  const [making, setMaking] = useState<Phase | null>(() => phaseOf(live));
  const [sent, setSent] = useState(live === 'makeLiveOfferSent');

  if (area === 'people') return <Navigate to="/demo/people" replace />;
  if (area === 'budget' && initial.id === BUDGET_EVENT) return <BudgetEntry event={initial} />;
  if (area === 'guests' && hasGuests(initial.id))
    return <Navigate to={guestsAt(initial.id)} replace />;
  if (area === 'messages' && fixedArea == null)
    return <Navigate to={`/demo/events/${initial.id}/messages`} replace />;
  if (area === 'seating') return <Navigate to={`/demo/events/${initial.id}/seating`} replace />;

  function kept(next: SampleEvent): void {
    keepChange(next);
    setEvent(next);
  }

  function open(next: Part): void {
    const to = next === part ? null : next;

    if (part != null && dirty) setLeaving({ to });
    else {
      setPart(to);
      setDirty(false);
    }
  }

  return (
    <EventsShell
      told={
        arrival.told ??
        (state === 'replyBySaved' || state === 'replyByRemoved'
          ? replyBySays(replyBy, now, event.timeZone).toast
          : liveToldOf(event, live))
      }
      renderSide={(tell, covered) => (
        <EventSidebar
          event={event}
          area={area}
          now={now}
          tell={tell}
          inert={covered}
          waiting={event.id === SAMPLE_EVENT ? waitingLine(keptInbox()) : null}
          {...(canChange && maySend(live) ? {} : { reader: AT_READ })}
        />
      )}
    >
      {(tell, show) => (
        <div className="desk-page ev-page">
          <div className="ev-wide">
            <Crumb to="/demo/events" back={W.back} name={event.name}>
              <DemoBell tell={tell} />
            </Crumb>
            {dates ? (
              <AllDates event={event} now={now} />
            ) : area === 'overview' ? (
              <>
                <EventCard
                  event={event}
                  now={now}
                  level={1}
                  milestone={cardMilestone(event, now)}
                  onStep={(does: CardDoes) => {
                    if (does === 'makeLive') setMaking(ASK);
                    else if (does === 'changeDates') {
                      if (part !== 'dates') open('dates');
                    } else if (does === 'resume') {
                      kept({ ...event, status: 'live' });
                      tell(W.resumed(event.name));
                    } else setAsking('duplicate');
                  }}
                />
                {sent && <p className="ml-demo-only">{LW.demoMessages}</p>}
                <div className="ev-columns">
                  <div className="ev-left">
                    {shownOf(event, now) === 'finished' && cardShown(card) && (
                      <ThankYouCard event={event} card={card} onCard={setCard} onSaid={tell} />
                    )}
                    <Details
                      event={event}
                      now={now}
                      part={part}
                      state={state}
                      onOpen={open}
                      onDirty={setDirty}
                      onClose={() => {
                        setPart(null);
                        setDirty(false);
                      }}
                      onSave={(next) => {
                        const changes =
                          event.id === SAMPLE_EVENT && event.status === 'live'
                            ? toldOf(event, next)
                            : [];

                        const moved = replyByAfterStart(replyBy, next.startsAt, next.timeZone);

                        const says = datesSaveSays(moved, changes.length > 0);
                        const said = replyBySays(moved, now, next.timeZone);

                        kept(next);
                        setPart(null);
                        setDirty(false);
                        if (moved != null) setReplyBy(moved);
                        if (changes.length > 0) {
                          setTellMoved(says.inTell ? said.line : null);
                          setTelling(changes);
                        }
                        if (says.toast === 'moved') tell(said.toast);
                        if (says.toast === 'saved') tell(W.saved);
                      }}
                      onLatest={kept}
                      replyBy={replyBy}
                      onReplyBy={(next) => {
                        setReplyBy(next);
                        setPart(null);
                        setDirty(false);
                        tell(replyBySays(next, now, event.timeZone).toast);
                      }}
                      needs={
                        <EventNeedsYou
                          timeline={timelineOf(event, now)}
                          permissions={readerOf(needsStateOf(state))}
                          state={needsStateOf(state)}
                          now={now}
                          timeZone={event.timeZone}
                        />
                      }
                    />
                  </div>
                  <div className="ev-right">
                    {hasGuests(event.id) && <GuestNumbers eventId={event.id} state={numbers} />}
                    <GuestsPage state={state} />
                    <JustForYou
                      muted={muted}
                      loaded={muteLoaded}
                      failed={muteFailed}
                      settings="/demo/settings/notifications"
                      onRetry={() => setMuteLoaded(true)}
                      onChange={(next) => {
                        if (muteFailed) setMuteFailed(false);
                        setMuted(next);
                      }}
                    />
                    <ManageBlock
                      manage={usableManage(manageOf(event, now), canChange)}
                      onPick={(one) => {
                        if (one !== 'delete') setAsking(one);
                        else if (refusal != null) setAsking('refused');
                        else
                          setAsking(
                            needsName(event, peopleOn(event.id)) ? 'delete' : 'deleteDraft',
                          );
                      }}
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
                <AreaPage
                  event={event}
                  now={now}
                  name={AREAS.find((one) => one.area === area)?.name ?? ''}
                  line={COMING[area]}
                />
                {area === 'menu' && event.id === KITCHEN_EVENT && (
                  <>
                    <Link className="desk-text" to={menuAt(event.id)}>
                      {MW.title}
                      <Glyph name="chevron" size={16} weight={2.4} />
                    </Link>
                    <Link className="desk-text" to={kitchenAt(event.id)}>
                      {KW.title}
                      <Glyph name="chevron" size={16} weight={2.4} />
                    </Link>
                  </>
                )}
              </>
            )}
          </div>
          {leaving != null && (
            <Ask
              title={W.discardTitle}
              line={W.discardLine}
              keep={W.keepEditing}
              go={W.discard}
              onKeep={() => setLeaving(null)}
              onGo={() => {
                setPart(leaving.to);
                setDirty(false);
                setLeaving(null);
              }}
            />
          )}
          {away.blocked && (
            <Ask
              title={W.discardTitle}
              line={W.discardLine}
              keep={W.keepEditing}
              go={W.discard}
              onKeep={away.stay}
              onGo={() => {
                setPart(null);
                setDirty(false);
                away.go();
              }}
            />
          )}
          <Asks
            asking={asking}
            event={event}
            now={now}
            state={state}
            endStart={endFieldOf(ending === 0 ? state : null)}
            refusal={refusal}
            turned={turned}
            onKeep={() => {
              if (asking === 'endNow') setEnding((count) => count + 1);
              setAsking(null);
              setTurned(false);
            }}
            onVerb={(verb) => {
              setTurned(false);
              setAsking(verb);
            }}
            onDone={(next, words) => {
              setAsking(null);
              kept(next);
              if (words != null) tell(words);
            }}
            onEnded={(line) => {
              setEnding((count) => count + 1);
              setAsking(null);
              kept({ ...event, status: 'ended', concludedAt: now.toISOString() });
              setCard(cardOf(null, line));
              if (line !== '') tell(TY_WORDS.done);
            }}
            onDelete={() => {
              const answer = refusalOf(
                event,
                now,
                invitedOf(state, refusedStart, invitedOn(event.id), true),
                canChange,
              );

              if (answer != null) {
                setPressed(true);
                setTurned(true);
                return;
              }
              away.release();
              forget(event.id);
              void navigate('/demo/events', { state: { told: W.deleted(event.name) } });
            }}
            onCreated={(words) => {
              away.release();
              tell(words);
            }}
          />
          {making != null && (
            <MakeLiveAsk
              event={event}
              phase={making}
              offer={maySend(live) ? offerOf(event, live) : null}
              onLive={(host) =>
                kept({ ...event, status: 'live', hosts: host == null ? event.hosts : [host] })
              }
              onClose={() => setMaking(null)}
              onMadeLive={() => {
                setMaking(null);
                tell(LW.madeLive);
              }}
              onSent={(offer) => {
                setMaking(null);
                setSent(true);
                show(sentTold(offer));
              }}
              onChangeDates={() => {
                setMaking(null);
                if (part !== 'dates') open('dates');
              }}
            />
          )}
          {telling != null && (
            <TellDialog
              tell={tell}
              changes={telling}
              before={tellMoved}
              onNotNow={() => {
                const was = keptInbox();

                setTelling(null);
                keepInbox({
                  ...was,
                  untold: [
                    ...was.untold.filter((one) => !telling.some((now) => now.item === one.item)),
                    ...telling,
                  ],
                });
              }}
              onSent={() => setTelling(null)}
            />
          )}
        </div>
      )}
    </EventsShell>
  );
}

function sentTold(offer: Offer): ShellTold {
  return { words: lw.many('queued', offer.reached), action: { word: LW.messages, to: INVITED_AT } };
}

/** What a Make live state's page says as it opens: the toast after Send them, or ✓ Live. */
function liveToldOf(event: SampleEvent, state: MakeLiveState | null): ShellTold | string | null {
  if (state === 'madeLive') return LW.madeLive;
  if (state !== 'makeLiveOfferSent') return null;

  const offer = offerOf(event, state);

  return offer == null ? null : sentTold(offer);
}

function Asks({
  asking,
  event,
  now,
  state,
  endStart,
  refusal,
  turned,
  onKeep,
  onVerb,
  onDone,
  onEnded,
  onDelete,
  onCreated,
}: {
  asking: Asking | null;
  event: SampleEvent;
  now: Date;
  state: EventStateName | null;
  endStart: EndField;
  refusal: Refusal | null;
  turned: boolean;
  onKeep: () => void;
  onVerb: (verb: RefusedVerb) => void;
  onDone: (next: SampleEvent, words: string | null) => void;
  onEnded: (line: string) => void;
  onDelete: () => void;
  onCreated: Tell;
}) {
  switch (asking) {
    case 'pause':
      return (
        <Ask
          title={W.pauseTitle(event.name)}
          line={W.pauseLine}
          keep={W.keepItLive}
          go={W.pause}
          red={false}
          onKeep={onKeep}
          onGo={() => onDone({ ...event, status: 'paused' }, W.paused(event.name))}
        />
      );
    case 'callOff':
      return (
        <Ask
          title={W.callOffTitle(event.name)}
          line={W.callOffLine}
          keep={W.keepItOn}
          go={W.callOff}
          onKeep={onKeep}
          onGo={() => onDone({ ...event, status: 'ended', concludedAt: now.toISOString() }, null)}
        />
      );
    case 'endNow':
      return <EndNowAsk event={event} start={endStart} onKeep={onKeep} onEnded={onEnded} />;
    case 'deleteDraft':
      return (
        <Ask
          title={W.deleteTitle(event.name)}
          line={W.draftBody}
          keep={W.keepIt}
          go={W.delete}
          onKeep={onKeep}
          onGo={onDelete}
        />
      );
    case 'delete':
      return (
        <DeleteByName
          event={event}
          people={peopleOn(event.id)}
          typed={
            state === 'deleteTyped' || state === 'deleteRace' || state === 'deleteRaceRead'
              ? event.name
              : state === 'deleteMismatch'
                ? 'Adaeze and Tunde'
                : ''
          }
          mismatch={state === 'deleteMismatch'}
          refused={turned ? refusal : null}
          onKeep={onKeep}
          onDelete={onDelete}
          onVerb={onVerb}
        />
      );
    case 'refused':
      return (
        refusal != null && (
          <RefusedAsk event={event} refusal={refusal} onKeep={onKeep} onVerb={onVerb} />
        )
      );
    case 'duplicate':
      return (
        <DuplicateDialog
          event={event}
          begin={duplicateStartOf(state)}
          cleared={state === 'duplicateNoStart'}
          onDismiss={onKeep}
          onCreated={onCreated}
        />
      );
    default:
      return null;
  }
}

function duplicateStartOf(state: EventStateName | null): DuplicateStart {
  switch (state) {
    case 'duplicateTicked':
      return 'ticked';
    case 'duplicateNoManage':
      return 'noManage';
    case 'duplicateCreating':
      return 'creating';
    case 'duplicateNotCreated':
      return 'notCreated';
    case 'duplicateOverPlan':
      return 'overPlan';
    case 'duplicateOverPlanAsk':
      return 'overPlanAsk';
    case 'duplicateOverCeiling':
      return 'overCeiling';
    default:
      return 'form';
  }
}

function dayCount(event: SampleEvent): number {
  const first = Date.parse(`${localDay(event.startsAt, event.timeZone)}T00:00:00Z`);
  const last = Date.parse(`${localDay(event.endsAt, event.timeZone)}T00:00:00Z`);

  return Math.round((last - first) / 86_400_000) + 1;
}

function mapsLink(event: SampleEvent): string | null {
  const venue = event.venue;

  if (venue?.address == null) return null;

  const query = [venue.name, venue.address].join(', ');

  return `https://www.openstreetmap.org/search?query=${encodeURIComponent(query)}`;
}

function Details({
  event,
  now,
  part,
  state,
  onOpen,
  onDirty,
  onClose,
  onSave,
  onLatest,
  replyBy,
  onReplyBy,
  needs,
}: {
  event: SampleEvent;
  now: Date;
  part: Part | null;
  state: EventStateName | null;
  onOpen: (part: Part) => void;
  onDirty: (dirty: boolean) => void;
  onClose: () => void;
  onSave: (next: SampleEvent) => void;
  onLatest: (latest: SampleEvent) => void;
  replyBy: string | null;
  onReplyBy: (next: string | null) => void;
  needs: ReactNode;
}) {
  const locked = eventPhase(event, now) === 'finished';
  const days = dayCount(event);
  const maps = mapsLink(event);
  const editing = (one: Part) => {
    if (part !== one) return null;
    if (one === 'replyBy')
      return (
        <ReplyByPart
          event={event}
          state={partOf(state) === one ? (state as PartProps['state']) : null}
          replyBy={replyBy}
          now={now}
          onDirty={onDirty}
          onClose={onClose}
          onSave={onReplyBy}
        />
      );

    const Editor = PARTS[one];

    return (
      <Editor
        event={event}
        state={partOf(state) === one ? (state as PartProps['state']) : null}
        onDirty={onDirty}
        onClose={onClose}
        onSave={onSave}
        onLatest={onLatest}
        replyBy={replyBy}
      />
    );
  };
  const row = (
    one: Part,
    lead: ReactNode,
    title: string,
    line: string,
    after?: ReactNode,
    plain = false,
  ) => (
    <PartRow
      key={one}
      lead={lead}
      title={title}
      line={line}
      open={part === one}
      locked={((one === 'dates' || one === 'replyBy') && locked) || plain}
      after={after}
      onOpen={() => onOpen(one)}
    >
      {editing(one)}
    </PartRow>
  );

  return (
    <>
      <section className="desk-block" aria-labelledby="ev-details">
        <Head title={<span id="ev-details">{W.details}</span>} />
        <ul className="desk-rows ev-details">
          {row(
            'dates',
            <Lead name="calendar" />,
            formatEventRange(event.startsAt, event.endsAt, event.timeZone, LOCALE),
            locked
              ? `${W.dates} · ${calledOff(event) ? W.scheduleCalledOff : W.scheduleLocked}`
              : [W.dates, ...(days > 1 ? [W.dayCount(days)] : []), event.timeZone].join(' · '),
          )}
          {row(
            'replyBy',
            <Lead name="clock" />,
            replyBy == null ? REPLY_BY_WORDS.rowNone : rowDay(replyBy),
            replyBy == null
              ? REPLY_BY_WORDS.replyBy
              : `${REPLY_BY_WORDS.replyBy} · ${
                  repliesOpen(now, replyBy, event.timeZone)
                    ? REPLY_BY_WORDS.rowCloses(event.timeZone)
                    : REPLY_BY_WORDS.rowClosed
                }`,
          )}
          {row(
            'venue',
            <Lead name="pin" />,
            event.venue?.name ?? W.venueToBeConfirmed,
            event.venue?.address == null ? W.venue : `${W.venue} · ${event.venue.address}`,
            maps == null && event.arrivalNote == null ? undefined : (
              <>
                {event.arrivalNote != null && <p className="ev-note">{event.arrivalNote}</p>}
                {maps != null && (
                  <a
                    className="desk-text ev-maps"
                    href={maps}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Glyph name="globe" size={17} weight={2.3} />
                    {W.openInMaps}
                  </a>
                )}
                {event.venue == null && (
                  <button type="button" className="desk-text" onClick={() => onOpen('venue')}>
                    {W.addVenue}
                  </button>
                )}
              </>
            ),
            event.venue == null && event.arrivalNote != null,
          )}
          {row(
            'hosts',
            <Lead name="users" />,
            event.hosts.length === 0 ? W.noHosts : hostsLine(event.hosts, LOCALE),
            event.hosts.length === 0 ? `${W.hostedBy} · ${W.noHostsLine}` : W.hostedBy,
          )}
          {row('type', <Lead name="events" />, TYPE_WORDS[event.type], W.type)}
          {row(
            'currency',
            <Lead name="wallet" />,
            `${event.currency} · ${CURRENCIES[event.currency]}`,
            W.currency,
          )}
        </ul>
      </section>
      {needs}
      <section className="desk-block" aria-labelledby="ev-name-cover">
        <Head title={<span id="ev-name-cover">{W.nameAndCover}</span>} />
        <ul className="desk-rows ev-details">
          {row('name', <Lead name="pen" />, event.name, W.eventName)}
          {row(
            'cover',
            <span className="ev-lead">
              <Thumb event={event} size={28} />
            </span>,
            event.photo ? W.yourPhoto : W.defaultCover,
            event.photo ? W.coverMiddle : W.cover,
          )}
        </ul>
      </section>
    </>
  );
}

function GuestsPage({ state }: { state: EventStateName | null }) {
  return (
    <section className="desk-block" aria-labelledby="ev-guests-page">
      <Head title={<span id="ev-guests-page">{W.guestsPage}</span>} />
      <div className="ev-dashed">
        <div className="desk-row ev-detail is-coming">
          <Lead name="eye" />
          <RowWords title={W.preview} lines={[W.previewLine]} />
        </div>
        <div className="ev-dashed-pill">
          <NotBuilt words={W.notBuilt('sc-1439')} />
        </div>
      </div>
      <GuestsCanWrite state={state} />
    </section>
  );
}

const MANAGE_WORDS: Record<Manage, readonly [string, string, boolean]> = {
  duplicate: [W.duplicate, W.duplicateLine, false],
  pause: [W.pause, W.pauseLine, false],
  callOff: [W.callOffOpen, W.callOffLine, true],
  endNow: [W.endNowOpen, W.endLine, true],
  delete: [W.deleteOpen, W.deleteLine, true],
};

function ManageBlock({
  manage,
  onPick,
}: {
  manage: readonly Manage[];
  onPick: (one: Manage) => void;
}) {
  return (
    <ManageList title={W.manage}>
      {manage.map((one) => {
        const [label, line, red] = MANAGE_WORDS[one];

        return (
          <ManageItem key={one} line={line} red={red}>
            {({ className, describedBy }) => (
              <button
                type="button"
                className={className}
                aria-describedby={describedBy}
                onClick={() => onPick(one)}
              >
                {label}
              </button>
            )}
          </ManageItem>
        );
      })}
    </ManageList>
  );
}

/** An area main has not built: its name, the event, and that it is coming. */
function AreaPage({
  event,
  now,
  name,
  line,
}: {
  event: SampleEvent;
  now: Date;
  name: string;
  line: string;
}) {
  return (
    <>
      <h1 className="ev-area-title" tabIndex={-1}>
        {name}
      </h1>
      <div className="ev-strip">
        <Thumb event={event} size={40} />
        <RowWords title={event.name} lines={[lineOf(event, now)]} />
      </div>
      <div className="ev-coming">
        <h2>{name}</h2>
        <p className="desk-line">{line}</p>
      </div>
    </>
  );
}
