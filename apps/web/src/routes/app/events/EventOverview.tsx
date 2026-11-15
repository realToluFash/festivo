import { type OrganisationEvent, type TaggedEvent } from '@soirely/api-client';
import {
  type EventPhase,
  changedWords,
  currencyLabel,
  formatEventRange,
  hostsLine,
  positionPart,
  rememberTabHolding,
  shownPhase,
  stepAwaitsMilestones,
  takesCardStep,
  wallDay,
} from '@soirely/domain';
import { Fragment, type ReactNode, type RefObject, useEffect, useRef, useState } from 'react';
import { type TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router';

import {
  Crumb,
  Lead,
  ManageItem,
  ManageList,
  PartRow,
} from '../../../components/EventPageParts.tsx';
import { type ButtonStep, EventCard } from '../../../components/EventCard.tsx';
import { Glyph } from '../../../components/Glyph.tsx';
import { ArrivalNotice } from '../../../components/PageArrival.tsx';
import { Ask, Head } from '../../../components/SettingsParts.tsx';
import { Toast } from '../../../components/Toast.tsx';
import { listEventOf, shownEvent } from '../../../eventsList.ts';
import { currentLocale, dateLocale } from '../../../i18n/index.ts';
import { useLoadedAt, useServerNow } from '../../../serverNow.ts';
import { canOn } from '../../../session.ts';
import { DeleteEvent } from './DeleteEvent.tsx';
import { DuplicateDialog, DuplicateEvent } from './DuplicateEvent.tsx';
import { guestsCopied, wasDuplicated } from './duplicated.ts';
import { EndButton } from './EndEvent.tsx';
import { EventCoverImage } from './EventCoverImage.tsx';
import {
  type Part,
  type PartProps,
  CoverPart,
  CurrencyPart,
  DatesPart,
  HostsPart,
  NamePart,
  TypePart,
  VenuePart,
} from './EventPartEdits.tsx';
import { useMakeLive } from './MakeLive.tsx';
import { ReplyByPart } from './ReplyByPart.tsx';
import { closesAtClock, repliesClosed } from '../../../replyBy.ts';
import { arrivingPart } from './openInPlace.ts';
import { PHASE_WORD } from './eventWords.ts';
import { typeLabel } from './eventTypes.ts';
import { GuestNumbers } from './GuestNumbers.tsx';
import { MuteEvent } from './MuteEvent.tsx';
import { OutcomeLine } from './OutcomeLine.tsx';
import { PauseButton, useResume } from './PauseEvent.tsx';
import { ComingUp, useTimeline } from './Timeline.tsx';
import { useLeaveGuard } from './useLeaveGuard.tsx';

import '../../../components/SettingsParts.css';
import '../../../components/eventPage.css';

/** The crumb an event's page starts with at a desk: Events, then where you are. */
export function EventCrumb({ name, children }: { name: string | null; children?: ReactNode }) {
  const { t } = useTranslation();

  return (
    <Crumb to="/app/events" back={t('events.title')} name={name}>
      {children}
    </Crumb>
  );
}

function dayCount(event: OrganisationEvent): number {
  const first = Date.parse(`${wallDay(event.startsAt, event.timeZone)}T00:00:00Z`);
  const last = Date.parse(`${wallDay(event.endsAt, event.timeZone)}T00:00:00Z`);

  return Math.round((last - first) / 86_400_000) + 1;
}

/** Open in maps where the venue has its coordinates (sc-3589). */
function mapsLink(event: OrganisationEvent): string | null {
  const address = event.venue?.address ?? null;
  const latitude = address?.latitude ?? null;
  const longitude = address?.longitude ?? null;

  return latitude == null || longitude == null
    ? null
    : `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=17/${latitude}/${longitude}`;
}

/** WCAG 2.2 §4.1.3: a phase the clock changes on an open page is said politely; one the server sends is not. */
export function PhaseChange({ phase }: { phase: EventPhase }) {
  const { t } = useTranslation();
  const [opened] = useState(phase);

  return (
    <p className="visually-hidden" aria-live="polite">
      {phase === opened ? '' : t(PHASE_WORD[phase])}
    </p>
  );
}

/** The page's first area, as Events-A-Desk draws it (sc-30413): the cover card and its one step, then Details and Name and cover, each part edited in place, beside Just for you and Manage. */
export function Overview({
  event,
  tag,
  heading,
  onChange,
}: {
  event: OrganisationEvent;
  tag: string;
  heading: RefObject<HTMLHeadingElement | null>;
  onChange: (event: OrganisationEvent, tag: string) => void;
}) {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [coverRefused] = useState(() => coverRefusal(location.state));
  const coverLine = useRef<HTMLParagraphElement>(null);
  const [ended, setEnded] = useState(false);
  const [paused, setPaused] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [leaving, setLeaving] = useState<{ to: Part | null } | null>(null);
  const [toast, setToast] = useState<string | null>(() =>
    wasDuplicated(location.state) ? createdLine(guestsCopied(location.state), t) : null,
  );
  const [shown, setShown] = useState(0);
  const now = useServerNow();
  const loadedAt = useLoadedAt(event);
  const phase = shownPhase(event, loadedAt, now);
  const manages = canOn(event, 'events.manage');
  const creates = canOn(event, 'events.create');
  const opens = (one: Part | null): Part | null =>
    one == null || !manages || (one === 'dates' && phase === 'finished') ? null : one;
  const [part, setPart] = useState<Part | null>(() => opens(arrivingPart(location.state)));
  const [arrivals, setArrivals] = useState(part === 'dates' ? 1 : 0);
  const [arrival, setArrival] = useState(location.key);
  const guard = useLeaveGuard({ dirty, busy: false, body: t('eventEdit.leaveBody') });
  const [madeLive, setMadeLive] = useState(false);
  const [resumed, setResumed] = useState(false);
  const [copying, setCopying] = useState(false);
  const stepButton = useRef<HTMLButtonElement>(null);
  const askEnd = useRef<(() => void) | null>(null);
  const makeLive = useMakeLive({
    event,
    tag,
    heading,
    opener: stepButton,
    onChange,
    onMadeLive: () => setMadeLive(true),
  });
  const resume = useResume({ event, heading, onChange, onResumed: () => setResumed(true) });
  const comingUpHeading = useRef<HTMLHeadingElement>(null);
  const timeline = useTimeline(event, comingUpHeading, now);
  const milestones = timeline.load.kind === 'loaded' ? timeline.load.timeline.milestones : null;
  const card = shownEvent(listEventOf({ ...event, milestones: milestones ?? [] }), phase);

  useEffect(() => rememberTabHolding(event.organisationId, phase), [event.organisationId, phase]);

  useEffect(() => {
    if (
      arrivingPart(location.state) == null &&
      coverRefusal(location.state) == null &&
      !wasDuplicated(location.state)
    )
      return;

    void navigate(
      { pathname: location.pathname, search: location.search, hash: location.hash },
      { replace: true, state: null },
    );
  }, [location, navigate]);

  function open(next: Part, arriving = false): void {
    const to = next === part ? null : next;

    setArrivals((count) => (arriving ? count + 1 : 0));
    if (part != null && dirty) setLeaving({ to });
    else {
      setPart(to);
      setDirty(false);
    }
  }

  function close(): void {
    setPart(null);
    setDirty(false);
  }

  // Change dates followed while the page is already open, from Make live's refusal.
  if (location.key !== arrival) {
    const arriving = opens(arrivingPart(location.state));

    setArrival(location.key);
    if (arriving != null && arriving !== part) open(arriving, true);
    else if (arriving === 'dates') setArrivals((count) => count + 1);
  }

  const onStep = (step: ButtonStep) => {
    if (step.action === 'makeLive') makeLive.start();
    else if (step.action === 'changeDates') {
      if (part !== 'dates') open('dates');
    } else if (step.action === 'resume') resume.resume();
    else setCopying(true);
  };

  const saved = (next: TaggedEvent, said = t('eventEdit.saved')) => {
    onChange(next.event, next.tag);
    close();
    setToast(said);
  };

  const parts: PartProps = {
    event,
    tag,
    onDirty: setDirty,
    onClose: close,
    onSaved: saved,
    onLatest: (latest) => {
      onChange(latest.event, latest.tag);
      setShown((n) => n + 1);
    },
  };

  return (
    <div className="event-overview">
      <EventCard
        event={card}
        now={now}
        locale={dateLocale()}
        level={1}
        nameRef={heading}
        stepRef={stepButton}
        held={milestones == null && stepAwaitsMilestones(phase)}
        sending={resume.state === 'pending' ? t('eventPause.resuming') : null}
        takes={(action) => takesCardStep(event, action)}
        onStep={onStep}
      />
      <PhaseChange key={loadedAt.getTime()} phase={phase} />
      {resume.state === 'failed' && (
        <p className="desk-error" role="alert">
          <Glyph name="alert" size={15} weight={2.2} />
          {t('eventPause.resumeFailed')}
        </p>
      )}
      {resume.changed && (
        <div className="desk-error" role="alert">
          {changedWords(event).map((line) => (
            <p key={line}>{t(line)}</p>
          ))}
        </div>
      )}
      {madeLive && <OutcomeLine words={t('eventLive.madeLive')} />}
      {resumed && <OutcomeLine words={t('eventPause.resumed', { name: event.name })} />}
      {ended && <OutcomeLine words={t(PHASE_WORD.finished)} />}
      {paused && <OutcomeLine words={t('eventPause.paused', { name: event.name })} />}
      {coverRefused != null && (
        <ArrivalNotice
          role="alert"
          line={t('eventCover.createdWithout', { reason: coverRefused })}
          lineRef={coverLine}
          focusable={false}
          retry={t('eventEdit.open')}
          onRetry={() => open('cover')}
        />
      )}
      <div className="ev-columns">
        <div className="ev-left">
          <Details
            event={event}
            phase={phase}
            manages={manages}
            now={now}
            part={part}
            arrivals={arrivals}
            parts={parts}
            shown={shown}
            onCover={(next) => saved({ event: next, tag })}
            onOpen={open}
            comingUp={<ComingUp event={event} timeline={timeline} heading={comingUpHeading} />}
          />
        </div>
        <div className="ev-right">
          {canOn(event, 'guests.read') && <GuestNumbers event={event} />}
          <MuteEvent eventId={event.id} />
          {(creates || manages) && (
            <ManageList title={t('eventPage.manage')}>
              {creates && (
                <ManageItem line={t('eventDuplicate.body')}>
                  {(look) => <DuplicateEvent event={event} look={look} />}
                </ManageItem>
              )}
              {manages && (
                <>
                  <PauseButton
                    event={event}
                    phase={phase}
                    heading={heading}
                    inManage
                    onChange={onChange}
                    onPaused={() => setPaused(true)}
                  />
                  <EndButton
                    event={event}
                    phase={phase}
                    now={now}
                    heading={heading}
                    inManage
                    askRef={askEnd}
                    onChange={onChange}
                    onEnded={() => setEnded(true)}
                  />
                </>
              )}
              {creates && (
                <ManageItem red line={t('eventDelete.note')}>
                  {(look) => (
                    <DeleteEvent
                      event={event}
                      phase={phase}
                      now={now}
                      look={look}
                      onVerb={() => askEnd.current?.()}
                    />
                  )}
                </ManageItem>
              )}
            </ManageList>
          )}
        </div>
      </div>
      {leaving != null && (
        <Ask
          title={t('eventPage.discardTitle')}
          line={t('eventPage.discardLine')}
          keep={t('eventEdit.keepEditing')}
          go={t('eventPage.discard')}
          onKeep={() => setLeaving(null)}
          onGo={() => {
            setPart(leaving.to);
            setDirty(false);
            setLeaving(null);
          }}
        />
      )}
      {makeLive.dialogs}
      {copying && (
        <DuplicateDialog
          event={event}
          onClose={() => {
            setCopying(false);
            window.setTimeout(() => (stepButton.current ?? heading.current)?.focus(), 0);
          }}
        />
      )}
      {guard.dialog}
      {toast != null && <Toast key={toast} words={toast} onClose={() => setToast(null)} />}
    </div>
  );
}

function Details({
  event,
  phase,
  manages,
  now,
  part,
  arrivals,
  parts,
  shown,
  onCover,
  onOpen,
  comingUp,
}: {
  event: OrganisationEvent;
  phase: ReturnType<typeof shownPhase>;
  manages: boolean;
  now: Date;
  part: Part | null;
  arrivals: number;
  parts: PartProps;
  shown: number;
  onCover: (event: OrganisationEvent) => void;
  onOpen: (part: Part) => void;
  comingUp: ReactNode;
}) {
  const { t } = useTranslation();
  const locale = dateLocale();
  const finished = phase === 'finished';
  const days = dayCount(event);
  const maps = mapsLink(event);
  const venue = event.venue;
  const address = venue?.address?.formatted ?? null;
  const note = event.arrivalNote;
  const replyBy = event.replyBy ?? null;
  const cover = event.cover;

  const editor = (one: Part): ReactNode => {
    switch (one) {
      case 'name':
        return <NamePart {...parts} />;
      case 'dates':
        return <DatesPart {...parts} now={now} focusStart={arrivals} />;
      case 'replyBy':
        return <ReplyByPart {...parts} now={now} />;
      case 'venue':
        return <VenuePart {...parts} over={finished} />;
      case 'hosts':
        return <HostsPart {...parts} />;
      case 'type':
        return <TypePart {...parts} />;
      case 'currency':
        return <CurrencyPart {...parts} />;
      case 'cover':
        return (
          <CoverPart
            event={event}
            onDirty={parts.onDirty}
            onClose={parts.onClose}
            onCover={onCover}
          />
        );
    }
  };

  // The latest version, once asked for, opens the part again from what was saved.
  const editing = (one: Part): ReactNode =>
    part === one ? <Fragment key={shown}>{editor(one)}</Fragment> : null;

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
      locked={!manages || ((one === 'dates' || one === 'replyBy') && finished) || plain}
      after={after}
      onOpen={() => onOpen(one)}
    >
      {editing(one)}
    </PartRow>
  );

  return (
    <>
      <section className="desk-block" aria-labelledby="ev-details">
        <Head title={<span id="ev-details">{t('eventPage.details')}</span>} />
        <ul className="desk-rows ev-details">
          {row(
            'dates',
            <Lead name="calendar" />,
            formatEventRange(event.startsAt, event.endsAt, event.timeZone, locale),
            finished
              ? `${t('eventPage.dates')} · ${t('eventEdit.scheduleLocked')}`
              : [
                  t('eventPage.dates'),
                  ...(days > 1 ? [t('eventPage.dayCount', { count: days })] : []),
                  event.timeZone,
                ].join(' · '),
          )}
          {row(
            'replyBy',
            <Lead name="clock" />,
            replyBy == null ? t('eventReplyBy.rowNone') : replyByDay(replyBy, locale),
            replyBy == null
              ? t('eventReplyBy.replyBy')
              : `${t('eventReplyBy.replyBy')} · ${
                  repliesClosed(event, now)
                    ? t('eventReplyBy.rowClosed')
                    : t('eventReplyBy.rowCloses', {
                        time: closesAtClock(locale),
                        zone: event.timeZone,
                      })
                }`,
          )}
          {row(
            'venue',
            <Lead name="pin" />,
            venue?.name ?? address ?? t('eventPage.venueToBeConfirmed'),
            venue?.name != null && address != null
              ? `${t('eventPage.venue')} · ${address}`
              : t('eventPage.venue'),
            maps == null && note == null ? undefined : (
              <>
                {note != null && <p className="ev-note">{note}</p>}
                {maps != null && (
                  <a
                    className="desk-text ev-maps"
                    href={maps}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Glyph name="globe" size={17} weight={2.3} />
                    {t('eventPage.openInMaps')}
                  </a>
                )}
                {venue == null && manages && (
                  <button type="button" className="desk-text" onClick={() => onOpen('venue')}>
                    {t('eventPage.addVenue')}
                  </button>
                )}
              </>
            ),
            venue == null && note != null,
          )}
          {row(
            'hosts',
            <Lead name="users" />,
            event.hosts.length === 0 ? t('eventPage.noHosts') : hostsLine(event.hosts, locale),
            event.hosts.length === 0
              ? `${t('eventHosts.heading')} · ${t('eventPage.noHostsLine')}`
              : t('eventHosts.heading'),
          )}
          {row('type', <Lead name="events" />, typeLabel(event.type, t), t('eventForm.type'))}
          {row(
            'currency',
            <Lead name="wallet" />,
            `${event.currency} · ${currencyLabel(event.currency, currentLocale())}`,
            t('eventForm.currency'),
          )}
        </ul>
      </section>
      {comingUp}
      <section className="desk-block" aria-labelledby="ev-name-cover">
        <Head title={<span id="ev-name-cover">{t('eventPage.nameAndCover')}</span>} />
        <ul className="desk-rows ev-details">
          {row('name', <Lead name="pen" />, event.name, t('eventForm.name'))}
          {row(
            'cover',
            <span className="ev-lead" aria-hidden="true">
              <EventCoverImage
                photo={cover}
                type={event.type}
                sizes="28px"
                className="ev-cover-thumb"
              />
            </span>,
            cover == null ? t('eventPage.defaultCover') : t('eventPage.yourPhoto'),
            cover == null
              ? t('eventCover.heading')
              : `${t('eventCover.heading')} · ${t(`eventCover.showing_${positionPart(cover.position)}`)}`,
          )}
        </ul>
      </section>
    </>
  );
}

/** "Wed, Nov 4, 2026": the row's title, a calendar day with no zone to move it. */
function replyByDay(day: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${day}T12:00:00Z`));
}

/** Set by New event when the event was created and its staged cover was refused or failed to save. */
function coverRefusal(state: unknown): string | null {
  const refused =
    typeof state === 'object' && state != null && 'coverRefused' in state
      ? state.coverRefused
      : null;

  return typeof refused === 'string' ? refused : null;
}

/** The copy's toast, with how many guests came when the guest list did (sc-3656). */
function createdLine(guests: number | null, t: TFunction): string {
  const created = t('eventDuplicate.created');

  return guests == null
    ? created
    : `${created} ${t('eventDuplicate.guestsCopied', { count: guests })}`;
}
