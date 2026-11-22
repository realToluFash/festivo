import {
  COVER_MIDDLE,
  EVENT_NAME_MAXIMUM,
  EVENT_TYPES,
  HOST_NAME_MAXIMUM,
  type EventDraft,
  type EventType,
  type HostErrors,
  endMovedLine,
  eventNameLength,
  hostProblems,
  hostsSent,
  keepsLastHost,
  startMoved,
  formatWallDay,
  timezoneLabel,
} from '@soirely/domain';
import { type RefObject, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import {
  type Currency,
  type EditState,
  type SampleEvent,
  type SampleVenue,
  type Wall,
  CURRENCY_CHOICES,
  EVENT_WORDS as W,
  clockOf,
  PHOTO_DESCRIPTION,
  SIX_HOSTS,
  TYPE_WORDS,
  ZONES,
  instantOf,
  latestOf,
  suggestionsFor,
  wallOf,
} from './events.ts';
import { writtenTime } from './clock.ts';
import { ARRIVAL_NOTE, LONG_NOTE, NOTE_WORDS, noteTooLong, savedNote } from './arrivalNote.ts';
import './arrivalNote.css';
import {
  CREDIT_TYPED,
  type CreditLanguage,
  OSM_COPYRIGHT,
  OSM_CREDIT,
  STADIA_ATTRIBUTION,
  creditLanguageOf,
  isCreditState,
} from './addressCredit.ts';
import './addressCredit.css';
import {
  REPLY_BY_WORDS,
  datesAsk,
  haventCountOf,
  haventRepliedOf,
  replyByAfterStart,
} from './replyBy.ts';
import { NotBuilt } from './EventParts.tsx';
import { DemoSaveNotice } from './DemoSaveNotice.tsx';
import { saveAnswerOf, useDemoAnswer } from './saveAnswer.ts';
import { useSaveAnswer } from '../components/saveAnswer.ts';
import { SaveNotice } from '../components/SaveNotice.tsx';
import {
  Broken,
  DateTime,
  EditText as Text,
  Opened,
  Radios,
} from '../components/EventPageParts.tsx';
import { type CoverStart, type CoverUploaded, CoverEdit } from '../components/CoverEdit.tsx';
import { Select } from '../components/EventFormParts.tsx';
import { Glyph } from '../components/Glyph.tsx';
import { Ask } from '../components/SettingsParts.tsx';
import { focusStep, landOnNotice } from '../stepFocus.ts';
import {
  HostFields as ProductHostFields,
  VenueFieldsView,
} from '../routes/app/events/EventFormFields.tsx';

const LOCALE = 'en-US';

export interface PartProps {
  event: SampleEvent;
  state: EditState | null;
  onDirty: (dirty: boolean) => void;
  onClose: () => void;
  onSave: (next: SampleEvent) => void;
  onLatest: (latest: SampleEvent) => void;
  /** sc-3780: Dates says before saving when a new start moves the event's Reply by. */
  replyBy?: string | null;
}

function OnceSaved() {
  return (
    <div className="ev-once">
      <p className="ev-once-words">{W.onceSaved}</p>
      <NotBuilt words={W.tellGuests} />
    </div>
  );
}

function useDirty(changed: boolean, onDirty: (dirty: boolean) => void): void {
  useEffect(() => onDirty(changed), [changed, onDirty]);
}

function draftFrom(start: Wall, end: Wall, name: string): EventDraft {
  return {
    name,
    type: '',
    startDate: start.date,
    startTime: start.time,
    endDate: end.date,
    endTime: end.time,
  };
}

const MOVED = (key: string, values?: Record<string, string | number>) =>
  key === 'eventForm.endMoved' && values != null
    ? W.endMoved(`${String(values.day)}, ${String(values.time)}`)
    : key;

/** Dates: when it starts and ends in its zone; a new start carries the end with it. */
export function DatesPart({
  event,
  state,
  onDirty,
  onClose,
  onSave,
  onLatest,
  replyBy = null,
}: PartProps) {
  const moved = state !== 'dates';
  const startWall = wallOf(event.startsAt, event.timeZone);
  const endWall = wallOf(event.endsAt, event.timeZone);
  const [first] = useState(() => {
    if (!moved) return { start: startWall, end: endWall };
    if (state === 'datesError')
      return { start: startWall, end: { date: startWall.date, time: '15:00' } };

    const earlier = wallOf(
      new Date(Date.parse(event.startsAt) - 86_400_000).toISOString(),
      event.timeZone,
    );
    const carried = startMoved(
      draftFrom(startWall, endWall, event.name),
      { startDate: earlier.date, startTime: earlier.time },
      false,
      event.timeZone,
    );

    return {
      start: earlier,
      end: { date: carried.endDate, time: carried.endTime },
    };
  });
  const [start, setStart] = useState(first.start);
  const [end, setEnd] = useState(first.end);
  const [zone, setZone] = useState(event.timeZone);
  const [endChosen, setEndChosen] = useState(false);
  const [said, setSaid] = useState<string | null>(
    moved && state !== 'datesError' ? W.endMoved(movedDay(first.end)) : null,
  );
  const [tried, setTried] = useState(state === 'datesError');
  const elsewhere = useSaveAnswer(
    state === 'changedElsewhere' || state === 'showLatest' ? 'changedElsewhere' : null,
  );
  const id = useId();
  const startsAt = instantOf(start.date, start.time, zone);
  const endsAt = instantOf(end.date, end.time, zone);
  const backwards = startsAt != null && endsAt != null && endsAt < startsAt;
  const replyMoved = startsAt == null ? null : replyByAfterStart(replyBy, startsAt, zone);
  const ask = datesAsk({
    moved: replyMoved,
    was: replyBy,
    startsAt: startsAt ?? event.startsAt,
    now: clockOf(state),
    timeZone: zone,
    noReply: haventCountOf(event.id),
  });
  const [asking, setAsking] = useState(state === 'datesReplyByAsk');
  const changed =
    start.date !== startWall.date ||
    start.time !== startWall.time ||
    end.date !== endWall.date ||
    end.time !== endWall.time ||
    zone !== event.timeZone;

  useDirty(changed, onDirty);

  function moveStart(next: Wall): void {
    const before = draftFrom(start, end, event.name);
    const after = startMoved(
      before,
      { startDate: next.date, startTime: next.time },
      endChosen,
      zone,
    );

    setStart(next);
    setEnd({ date: after.endDate, time: after.endTime });
    setSaid(endMovedLine(before, after, LOCALE, MOVED));
  }

  return (
    <Opened
      label={W.dates}
      changed={changed}
      asking={state === 'discard' ? 'discard' : null}
      onCancel={onClose}
      onSave={() => {
        setTried(true);
        if (startsAt == null || endsAt == null || backwards) return;
        if (elsewhere.answer != null) return elsewhere.give('changedElsewhere');
        if (ask != null) return setAsking(true);
        onSave({ ...event, startsAt, endsAt, timeZone: zone });
      }}
    >
      <DateTime legend={W.starts} wall={start} onChange={moveStart} />
      {asking && ask != null && replyMoved != null && startsAt != null && endsAt != null && (
        <Ask
          title={
            ask === 'sooner'
              ? REPLY_BY_WORDS.soonerTitle(formatWallDay(replyMoved, LOCALE))
              : REPLY_BY_WORDS.nowTitle
          }
          line={haventRepliedOf(event.id)}
          keep={W.keepEditing}
          go={ask === 'sooner' ? REPLY_BY_WORDS.sooner : REPLY_BY_WORDS.now}
          red={false}
          onKeep={() => setAsking(false)}
          onGo={() => {
            setAsking(false);
            onSave({ ...event, startsAt, endsAt, timeZone: zone });
          }}
        >
          <p>{ask === 'sooner' ? REPLY_BY_WORDS.soonerLine : REPLY_BY_WORDS.nowLine}</p>
        </Ask>
      )}
      {replyMoved != null && replyBy != null && (
        <p className="ev-said" role="status">
          {REPLY_BY_WORDS.startMoves(
            formatWallDay(replyBy, LOCALE),
            formatWallDay(replyMoved, LOCALE),
          )}
        </p>
      )}
      <DateTime
        legend={W.ends}
        wall={end}
        wrong={tried && backwards}
        told={tried && backwards ? `${id}-wrong` : `${id}-hint`}
        onChange={(next) => {
          setEnd(next);
          setEndChosen(true);
          setSaid(null);
        }}
      />
      {tried && backwards ? (
        <p id={`${id}-wrong`} className="desk-error" role="alert">
          <Glyph name="alert" size={15} weight={2.2} />
          {W.endBeforeStart}
        </p>
      ) : said != null ? (
        <p id={`${id}-hint`} className="ev-said" role="status">
          {said}
        </p>
      ) : (
        <p id={`${id}-hint`} className="desk-help">
          {W.endsHint}
        </p>
      )}
      <ZoneSelect value={zone} onChange={setZone} />
      <OnceSaved />
      <SaveNotice
        answered={elsewhere}
        asking={state === 'showLatest'}
        onLatest={() => {
          const latest = latestOf(event);
          setStart(wallOf(latest.startsAt, latest.timeZone));
          setEnd(wallOf(latest.endsAt, latest.timeZone));
          setZone(latest.timeZone);
          setSaid(null);
          onLatest(latest);
        }}
      />
    </Opened>
  );
}

/** The event's time zone, and the line saying its times are in it. */
export function ZoneSelect({
  value,
  error,
  off = false,
  refTo,
  onChange,
}: {
  value: string;
  error?: string | undefined;
  off?: boolean;
  refTo?: RefObject<HTMLDivElement | null>;
  onChange: (zone: string) => void;
}) {
  return (
    <Select
      refTo={refTo}
      label={W.timeZone}
      value={value}
      choices={ZONE_CHOICES}
      error={error}
      help={W.timesIn(value)}
      off={off}
      onChange={onChange}
    />
  );
}

const ZONE_CHOICES = ZONES.map((one) => [one, timezoneLabel(one)] as const);

function movedDay(end: Wall): string {
  const noon = new Date(`${end.date}T12:00:00Z`);
  const day = new Intl.DateTimeFormat(LOCALE, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(noon);

  return `${day}, ${writtenTime(end.time, LOCALE)}`;
}

/** The product's Venue fields and arrival note over the sample's suggestions from 3 characters, shared by the Venue part and New event; a venue in another zone offers it. */
export function VenueFields({
  name,
  onName,
  address,
  onAddress,
  note,
  onNote,
  noteError = null,
  noteId,
  zone,
  onZone,
  down,
  listing = false,
  offering = null,
  focus = false,
  nameError = null,
  addressError = null,
  nameRef,
  addressRef,
  off = false,
  onPicked,
  credit = 'en',
}: {
  name: string;
  onName: (name: string) => void;
  address: string;
  onAddress: (address: string) => void;
  note: string;
  onNote: (note: string) => void;
  noteError?: string | null;
  /** Where focus lands when the note is refused. */
  noteId: string;
  zone: string;
  onZone: (zone: string) => void;
  down: boolean;
  listing?: boolean;
  offering?: string | null;
  focus?: boolean;
  nameError?: string | null;
  addressError?: string | null;
  nameRef?: RefObject<HTMLInputElement | null>;
  addressRef?: RefObject<HTMLInputElement | null>;
  off?: boolean;
  onPicked?: (venue: SampleVenue | null) => void;
  credit?: CreditLanguage;
}) {
  const made = useId();
  const own = useRef<HTMLInputElement>(null);
  const field = addressRef ?? own;
  const [listOpen, setListOpen] = useState(listing);
  const [offer, setOffer] = useState<string | null>(offering);
  const [zoneSet, setZoneSet] = useState<string | null>(null);
  const shown = down || !listOpen || off ? [] : suggestionsFor(address);
  const [holder, setHolder] = useState<HTMLDivElement | null>(null);
  const combo = holder?.querySelector<HTMLElement>('.ev-combo') ?? null;
  const creditRef = useRef<HTMLParagraphElement>(null);
  const closeUnlessOn = (keepOnField: boolean) => () =>
    window.setTimeout(() => {
      const now = document.activeElement;
      const onCredit = now != null && creditRef.current?.contains(now) === true;
      if (!onCredit && !(keepOnField && now === field.current)) setListOpen(false);
    });

  useEffect(() => {
    if (focus) field.current?.focus();
  }, [focus, field]);

  return (
    <div className="ev-venue" ref={setHolder}>
      <VenueFieldsView
        venue={{ name, address, addressId: null, note }}
        errors={{
          ...(nameError == null ? {} : { venueName: nameError }),
          ...(addressError == null ? {} : { venueAddress: addressError }),
          ...(noteError == null ? {} : { arrivalNote: noteError }),
        }}
        off={off}
        ids={{ name: `${made}-name`, address: `${made}-address`, note: noteId }}
        {...(nameRef == null ? {} : { nameRef })}
        addressRef={field}
        suggestions={shown.map((one) => ({
          id: one.name,
          text: one.name,
          secondaryText: one.line,
        }))}
        down={down}
        offer={offer == null ? null : { zone: offer, keep: zone }}
        zoneSet={zoneSet}
        onVenue={(change) => {
          if (change.name != null) onName(change.name);
          if (change.address != null) onAddress(change.address);
          if (change.note != null) onNote(change.note);
        }}
        onType={(typed) => {
          onAddress(typed);
          onPicked?.(null);
          setListOpen(true);
          setZoneSet(null);
        }}
        onDismiss={closeUnlessOn(false)}
        onPick={(chosen) => {
          const one = shown.find((venue) => venue.name === chosen.id);
          if (one == null) return;
          onPicked?.(one);
          onAddress(one.address);
          if (name.trim() === '') onName(one.name);
          setListOpen(false);
          setOffer(one.timeZone === zone ? null : one.timeZone);
        }}
        onUseZone={(chosen) => {
          onZone(chosen);
          setOffer(null);
          setZoneSet(chosen);
        }}
        onKeepZone={() => setOffer(null)}
      />
      {combo != null &&
        shown.length > 0 &&
        createPortal(
          <AddressCredit
            language={credit}
            creditRef={creditRef}
            onLeave={closeUnlessOn(true)}
            onEscape={() => {
              setListOpen(false);
              field.current?.focus();
            }}
          />,
          combo,
        )}
    </div>
  );
}

/** sc-80918: the line at the foot of the suggestions' surface, after the listbox and never one of its options; pressing a link keeps Address focused so the list stays. */
function AddressCredit({
  language,
  creditRef,
  onLeave,
  onEscape,
}: {
  language: CreditLanguage;
  creditRef: RefObject<HTMLParagraphElement | null>;
  onLeave: () => void;
  onEscape: () => void;
}) {
  const words = OSM_CREDIT[language];
  const link = (href: string, name: string) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onPointerDown={(pointer) => pointer.preventDefault()}
      onBlur={onLeave}
      onKeyDown={(key) => {
        if (key.key !== 'Escape') return;
        key.stopPropagation();
        onEscape();
      }}
    >
      {name}
    </a>
  );

  return (
    <p className="ev-osm" lang={language} ref={creditRef}>
      © {link(STADIA_ATTRIBUTION, words.stadia)} © {link(OSM_COPYRIGHT, words.osm)}
    </p>
  );
}

/** Venue: its name and address, suggestions from 3 characters, and the zone it is in when that differs. */
export function VenuePart({ event, state, onDirty, onClose, onSave }: PartProps) {
  const typing = state === 'venueSuggestions' || state === 'venueDown' || isCreditState(state);
  const [name, setName] = useState(
    typing ? '' : state === 'venueZone' ? 'Eko Hotel' : (event.venue?.name ?? ''),
  );
  const [address, setAddress] = useState(
    isCreditState(state)
      ? CREDIT_TYPED[state]
      : state === 'venueSuggestions'
        ? 'Eko Hot'
        : state === 'venueDown'
          ? '12 Rua'
          : state === 'venueZone'
            ? 'Adetokunbo Ademola Street, Victoria Island, Lagos'
            : (event.venue?.address ?? ''),
  );
  const [picked, setPicked] = useState<SampleVenue | null>(null);
  const [zone, setZone] = useState(event.timeZone);
  const down = state === 'venueDown';
  const noteId = useId();
  const refusedNote = state === 'venueNoteTooLong' || state === 'venueNoteRefused';
  const [note, setNote] = useState(
    refusedNote
      ? LONG_NOTE
      : state === 'venueNoteForbidden'
        ? `${ARRIVAL_NOTE}\nDoors close at 23:00.`
        : (event.arrivalNote ?? ''),
  );
  const [noteError, setNoteError] = useState<string | null>(
    refusedNote ? NOTE_WORDS.tooLong : null,
  );
  const [said, setSaid] = useState<string | null>(
    state === 'venueNoteTooLong' ? NOTE_WORDS.oneField : null,
  );
  const forbidden = useSaveAnswer();
  const changed =
    name !== (event.venue?.name ?? '') ||
    address !== (event.venue?.address ?? '') ||
    note !== (event.arrivalNote ?? '') ||
    zone !== event.timeZone;

  useDirty(changed, onDirty);
  useEffect(() => {
    if (state === 'venueNote' || refusedNote) document.getElementById(noteId)?.focus();
  }, [state, refusedNote, noteId]);

  return (
    <Opened
      label={W.venue}
      changed={changed}
      onCancel={onClose}
      onSave={() => {
        const city = picked?.city ?? address.split(',').at(-1)?.trim() ?? event.venue?.city ?? '';
        const title = name.trim() || address.trim();

        if (noteTooLong(note)) {
          setNoteError(NOTE_WORDS.tooLong);
          setSaid(NOTE_WORDS.oneField);
          document.getElementById(noteId)?.focus();
          return;
        }
        if (state === 'venueNoteForbidden') {
          forbidden.give('forbidden');
          return;
        }

        onSave({
          ...event,
          arrivalNote: savedNote(note),
          timeZone: zone,
          venue:
            title === ''
              ? null
              : { name: title, address: address.trim() === '' ? null : address.trim(), city },
        });
      }}
    >
      <VenueFields
        name={name}
        onName={setName}
        address={address}
        onAddress={setAddress}
        zone={zone}
        onZone={setZone}
        down={down}
        listing={state === 'venueSuggestions' || isCreditState(state)}
        credit={creditLanguageOf(state)}
        offering={state === 'venueZone' ? 'Africa/Lagos' : null}
        focus={typing}
        note={note}
        onNote={(typed) => {
          setNote(typed);
          forbidden.clear();
          if (!noteTooLong(typed)) setNoteError(null);
        }}
        noteError={noteError}
        noteId={noteId}
        onPicked={setPicked}
      />
      <p className="visually-hidden" role="status">
        {said}
      </p>
      <OnceSaved />
      <SaveNotice answered={forbidden} />
    </Opened>
  );
}

/** The product's Hosted by over the sample's names, shared by its part and New event; errors and focus go by position. */
export function HostFields({
  typed,
  onTyped,
  errors,
  keep = false,
  off = false,
  fieldsRef,
}: {
  typed: readonly string[];
  onTyped: (typed: string[]) => void;
  errors: readonly (string | null)[];
  keep?: boolean;
  off?: boolean;
  fieldsRef: RefObject<(HTMLInputElement | null)[]>;
}) {
  const id = useId();
  const [keys, setKeys] = useState<readonly number[]>([]);
  const aligned = keys.length === typed.length;
  const rows = typed.map((name, index) => ({
    key: aligned ? (keys[index] ?? index) : index,
    name,
  }));
  const inputId = (row: { key: number }) => `${id}-host-${row.key}`;
  const hostErrors: HostErrors = {};
  rows.forEach((row, index) => {
    const error = errors[index];
    if (error != null) hostErrors[row.key] = error;
  });

  useLayoutEffect(() => {
    fieldsRef.current = rows.map(
      (row) => document.getElementById(inputId(row)) as HTMLInputElement | null,
    );
  });

  return (
    <ProductHostFields
      rows={rows}
      errors={hostErrors}
      keep={keep}
      off={off}
      inputId={inputId}
      onRows={(next) => {
        setKeys(next.map((row) => row.key));
        onTyped(next.map((row) => row.name));
      }}
      onEdited={() => undefined}
    />
  );
}

/** Hosted by: the names guests read, in order; at most six, never the same twice, and a live event keeps one. */
export function HostsPart({ event, state, onDirty, onClose, onSave }: PartProps) {
  const [typed, setTyped] = useState<string[]>(() =>
    state === 'hostsDuplicate'
      ? [...event.hosts, event.hosts[0] ?? '']
      : state === 'hostsSix'
        ? SIX_HOSTS
        : event.hosts.length === 0
          ? ['']
          : [...event.hosts],
  );
  const [tried, setTried] = useState(state === 'hostsDuplicate');
  const fields = useRef<(HTMLInputElement | null)[]>([]);
  const focusAt = useRef<number | null>(
    state === 'hostsDuplicate' ? 2 : state === 'lastHost' ? 0 : null,
  );
  const problems = hostProblems(typed);
  const keep = keepsLastHost(event, typed.length);
  const changed =
    hostsSent(typed)
      .filter((one) => one !== '')
      .join('\n') !== event.hosts.join('\n');

  useDirty(changed, onDirty);
  useEffect(() => {
    if (focusAt.current == null) return;
    fields.current[focusAt.current]?.focus();
    focusAt.current = null;
  });

  function problemWords(index: number): string | null {
    const problem = problems[index];

    if (!tried || problem == null) return null;
    if (problem.problem === 'hostBlank') return W.hostBlank;
    if (problem.problem === 'hostTooLong') return W.hostTooLong(HOST_NAME_MAXIMUM, problem.length);

    return W.hostDuplicate(problem.name);
  }

  return (
    <Opened
      label={W.hostedBy}
      changed={changed}
      onCancel={onClose}
      onSave={() => {
        setTried(true);
        const sent = hostsSent(typed);
        const blankOnly = sent.length === 1 && sent[0] === '' && event.status === 'draft';
        const wrong = problems.findIndex((problem) => problem != null);

        if (blankOnly) return onSave({ ...event, hosts: [] });
        if (wrong >= 0) return fields.current[wrong]?.focus();
        onSave({ ...event, hosts: sent });
      }}
    >
      <HostFields
        typed={typed}
        onTyped={setTyped}
        errors={typed.map((_, index) => problemWords(index))}
        keep={keep}
        fieldsRef={fields}
      />
      <OnceSaved />
    </Opened>
  );
}

export function TypePart({ event, onDirty, onClose, onSave }: PartProps) {
  const [picked, setPicked] = useState<EventType>(event.type);
  const [q, setQ] = useState('');
  const shown = EVENT_TYPES.filter((type) =>
    TYPE_WORDS[type].toLowerCase().includes(q.trim().toLowerCase()),
  );
  const changed = picked !== event.type;

  useDirty(changed, onDirty);

  return (
    <Opened
      label={W.type}
      changed={changed}
      onCancel={onClose}
      onSave={() => onSave({ ...event, type: picked })}
    >
      <div className="ev-field is-small" role="search" aria-label={W.searchTypes}>
        <Glyph name="search" size={18} weight={2.2} />
        <input
          type="search"
          aria-label={W.searchTypes}
          placeholder={W.searchTypes}
          value={q}
          spellCheck={false}
          onChange={(change) => setQ(change.target.value)}
        />
      </div>
      <Radios
        legend={W.type}
        choices={shown.map((type) => [type, TYPE_WORDS[type]])}
        picked={picked}
        onPick={(type) => setPicked(type)}
      />
    </Opened>
  );
}

/** Currency: refused once amounts are recorded against the event. */
export function CurrencyPart({ event, state, onDirty, onClose, onSave, onLatest }: PartProps) {
  const refusing = state === 'currencyRefused';
  const answers = saveAnswerOf(state);
  const last = CURRENCY_CHOICES.at(-1)?.[0] ?? event.currency;
  const [picked, setPicked] = useState<Currency>(
    refusing ? 'EUR' : answers == null ? event.currency : last,
  );
  const [refused, setRefused] = useState(refusing ? 0 : null);
  const [pending, setPending] = useState(answers);
  const answered = useDemoAnswer();
  const notice = useRef<HTMLDivElement>(null);
  const changed = picked !== event.currency;

  useDirty(changed, onDirty);
  useLayoutEffect(() => {
    const landed = notice.current;

    if (refused == null || refused === 0 || landed == null) return;

    focusStep(landOnNotice(landed));
  }, [refused]);

  return (
    <Opened
      label={W.currency}
      changed={changed}
      onCancel={onClose}
      onSave={() => {
        if (refusing) setRefused((times) => (times ?? 0) + 1);
        else if (pending != null) answered.give(pending);
        else onSave({ ...event, currency: picked });
      }}
    >
      {refused != null && (
        <Broken key={refused} landing={refused === 0 ? undefined : notice}>
          {W.currencyInUse}
        </Broken>
      )}
      <Radios legend={W.currency} choices={CURRENCY_CHOICES} picked={picked} onPick={setPicked} />
      <DemoSaveNotice
        answered={answered}
        onLatest={() => {
          const latest = latestOf(event);

          setPicked(latest.currency);
          setPending(null);
          onLatest(latest);
        }}
      />
    </Opened>
  );
}

/** Event name: up to 120 characters, never blank. */
export function NamePart({ event, state, onDirty, onClose, onSave, onLatest }: PartProps) {
  const answers = saveAnswerOf(state);
  const [name, setName] = useState(
    state === 'nameBlank' ? '' : answers == null ? event.name : `${event.name}, the reception`,
  );
  const [pending, setPending] = useState(answers);
  const answered = useDemoAnswer();
  const [tried, setTried] = useState(state === 'nameBlank');
  const field = useRef<HTMLInputElement>(null);
  const length = eventNameLength(name);
  const error = !tried
    ? null
    : length === 0
      ? W.nameBlank
      : length > EVENT_NAME_MAXIMUM
        ? W.nameTooLong(EVENT_NAME_MAXIMUM)
        : null;
  const changed = name !== event.name;

  useDirty(changed, onDirty);
  useEffect(() => field.current?.focus(), []);

  return (
    <Opened
      label={W.eventName}
      changed={changed}
      onCancel={onClose}
      onSave={() => {
        setTried(true);
        if (length === 0 || length > EVENT_NAME_MAXIMUM) return field.current?.focus();
        if (pending != null) return answered.give(pending);
        onSave({ ...event, name: name.trim() });
      }}
    >
      <Text
        label={W.eventName}
        value={name}
        inputRef={field}
        error={error}
        help={error == null ? W.nameCount(length, EVENT_NAME_MAXIMUM) : null}
        onChange={setName}
      />
      <OnceSaved />
      <DemoSaveNotice
        answered={answered}
        onLatest={() => {
          const latest = latestOf(event);

          setName(latest.name);
          setPending(null);
          onLatest(latest);
        }}
      />
    </Opened>
  );
}

const UPLOAD_MS = 1500;
const STAND_IN: CoverUploaded = { key: 'demo', url: '' };

/** Cover: the product's edit on the sample event; a pick uploads after a moment and nothing is sent. */
export function CoverPart({ event, state, onDirty, onClose, onSave }: PartProps) {
  const timer = useRef<number | undefined>(undefined);
  const [start] = useState<CoverStart>(() =>
    state === 'coverUploading' || state === 'coverPhotoUploading'
      ? { uploading: new Promise<CoverUploaded>(() => undefined) }
      : state === 'coverRefused'
        ? { pickRefused: W.refusedDimensions }
        : state === 'coverChangeRefused'
          ? { pickRefused: W.refusedType }
          : state === 'coverSaveRefused'
            ? { chosen: STAND_IN, saveRefused: W.uploadFailed }
            : {},
  );

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <CoverEdit
      mesh={event.mesh}
      saved={
        event.photo ? { sizes: [], position: COVER_MIDDLE, description: PHOTO_DESCRIPTION } : null
      }
      standIn
      start={start}
      upload={() =>
        new Promise((done) => {
          window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => done(STAND_IN), UPLOAD_MS);
        })
      }
      discard={() => undefined}
      save={async (change) => {
        if (state === 'coverSaveRefused') throw new Error(W.uploadFailed);
        return { ...event, photo: change.upload != null || (event.photo && !change.removed) };
      }}
      onSaved={onSave}
      onDirty={onDirty}
      onClose={onClose}
    />
  );
}
