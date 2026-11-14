import {
  COVER_MIDDLE,
  EVENT_NAME_MAXIMUM,
  EVENT_TYPES,
  HOSTS_MAXIMUM,
  HOST_NAME_MAXIMUM,
  type EventDraft,
  type EventType,
  endMovedLine,
  eventNameLength,
  hostProblems,
  hostsSent,
  keepsLastHost,
  startMoved,
  formatWallDay,
} from '@soirely/domain';
import { type Ref, type RefObject, useEffect, useId, useRef, useState } from 'react';

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
  REPLY_BY_WORDS,
  datesAsk,
  haventCountOf,
  haventRepliedOf,
  replyByAfterStart,
} from './replyBy.ts';
import { NotBuilt } from './EventParts.tsx';
import {
  Alert,
  Broken,
  DateTime,
  EditText as Text,
  Opened,
  Quiet,
  Radios,
} from '../components/EventPageParts.tsx';
import { type CoverStart, type CoverUploaded, CoverEdit } from '../components/CoverEdit.tsx';
import { Glyph } from '../components/Glyph.tsx';
import { Ask, RowWords, TextAction } from '../components/SettingsParts.tsx';

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
  const [refused, setRefused] = useState(state === 'changedElsewhere' || state === 'showLatest');
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
      asking={state === 'discard' ? 'discard' : state === 'showLatest' ? 'latest' : null}
      refused={refused}
      onLatest={() => {
        const latest = latestOf(event);
        setStart(wallOf(latest.startsAt, latest.timeZone));
        setEnd(wallOf(latest.endsAt, latest.timeZone));
        setZone(latest.timeZone);
        setRefused(false);
        setSaid(null);
        onLatest(latest);
      }}
      onCancel={onClose}
      onSave={() => {
        setTried(true);
        if (startsAt == null || endsAt == null || backwards) return;
        if (refused) return;
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

const ZONE_CHOICES = ZONES.map((one) => [one, one] as const);

export function Select({
  refTo,
  label,
  value,
  placeholder,
  choices,
  error,
  help,
  off = false,
  onChange,
}: {
  refTo?: RefObject<HTMLDivElement | null> | undefined;
  label: string;
  value: string;
  placeholder?: string;
  choices: readonly (readonly [string, string])[];
  error?: string | undefined;
  help?: string;
  off?: boolean;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const told = [error == null ? null : `${id}-error`, help == null ? null : `${id}-help`]
    .filter(Boolean)
    .join(' ');

  return (
    <div ref={refTo} className="desk-field">
      <label htmlFor={id} className="desk-label">
        {label}
      </label>
      <div className={error == null ? 'desk-box ev-select' : 'desk-box ev-select is-wrong'}>
        <select
          id={id}
          value={value}
          disabled={off}
          aria-invalid={error != null}
          aria-describedby={told === '' ? undefined : told}
          className={value === '' ? 'is-empty' : undefined}
          onChange={(change) => onChange(change.target.value)}
        >
          {placeholder != null && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {choices.map(([one, words]) => (
            <option key={one} value={one}>
              {words}
            </option>
          ))}
        </select>
        <Glyph name="chevdown" size={18} weight={2.3} />
      </div>
      {error != null && (
        <p id={`${id}-error`} className="desk-error">
          <Glyph name="alert" size={15} weight={2.2} />
          {error}
        </p>
      )}
      {help != null && (
        <p id={`${id}-help`} className="desk-help">
          {help}
        </p>
      )}
    </div>
  );
}

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

/** Venue name and Address with the sample's suggestions from 3 characters, shared by the Venue part and New event; a venue in another zone offers it. */
export function VenueFields({
  name,
  onName,
  address,
  onAddress,
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
}: {
  name: string;
  onName: (name: string) => void;
  address: string;
  onAddress: (address: string) => void;
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
}) {
  const id = useId();
  const own = useRef<HTMLInputElement>(null);
  const field = addressRef ?? own;
  const [listOpen, setListOpen] = useState(listing);
  const [active, setActive] = useState(-1);
  const [offer, setOffer] = useState<string | null>(offering);
  const [zoneSaid, setZoneSaid] = useState<string | null>(null);
  const shown = down || !listOpen || off ? [] : suggestionsFor(address);
  const told = [addressError == null ? null : `${id}-error`, `${id}-help`]
    .filter(Boolean)
    .join(' ');

  useEffect(() => {
    if (focus) field.current?.focus();
  }, [focus, field]);

  function choose(one: SampleVenue): void {
    onPicked?.(one);
    onAddress(one.address);
    if (name.trim() === '') onName(one.name);
    setListOpen(false);
    setActive(-1);
    setOffer(one.timeZone === zone ? null : one.timeZone);
  }

  return (
    <>
      <Text
        label={W.venueName}
        optional
        value={name}
        error={nameError}
        {...(nameRef == null ? {} : { inputRef: nameRef })}
        input={{ readOnly: off }}
        onChange={onName}
      />
      <div className="desk-field ev-combo">
        <label htmlFor={id} className="desk-label">
          {W.address}
          <span className="ev-optional">{` · ${W.optional}`}</span>
        </label>
        <div className={addressError == null ? 'desk-box' : 'desk-box is-wrong'}>
          <input
            ref={field}
            id={id}
            type="text"
            role="combobox"
            value={address}
            readOnly={off}
            aria-invalid={addressError != null}
            spellCheck={false}
            autoComplete="off"
            aria-autocomplete="list"
            aria-expanded={shown.length > 0}
            aria-controls={shown.length > 0 ? `${id}-list` : undefined}
            aria-activedescendant={active >= 0 ? `${id}-option-${active}` : undefined}
            aria-describedby={told}
            onChange={(change) => {
              onAddress(change.target.value);
              onPicked?.(null);
              setListOpen(true);
              setActive(-1);
            }}
            onKeyDown={(key) => {
              if (shown.length === 0) return;
              if (key.key === 'ArrowDown' || key.key === 'ArrowUp') {
                key.preventDefault();
                const step = key.key === 'ArrowDown' ? 1 : -1;
                setActive((at) => (at + step + shown.length) % shown.length);
              } else if (key.key === 'Enter' && active >= 0) {
                key.preventDefault();
                const one = shown[active];
                if (one != null) choose(one);
              } else if (key.key === 'Escape') {
                key.preventDefault();
                setListOpen(false);
              }
            }}
          />
        </div>
        {addressError != null && (
          <p id={`${id}-error`} className="desk-error">
            <Glyph name="alert" size={15} weight={2.2} />
            {addressError}
          </p>
        )}
        {down ? (
          <Alert>{W.lookupDown}</Alert>
        ) : shown.length > 0 ? (
          <p id={`${id}-help`} className="desk-help" role="status">
            {W.suggestions(shown.length)}
          </p>
        ) : (
          <p id={`${id}-help`} className="desk-help">
            {W.addressHint}
          </p>
        )}
        {shown.length > 0 && (
          <ul
            id={`${id}-list`}
            className="desk-rows ev-options"
            role="listbox"
            aria-label={W.address}
          >
            {shown.map((one, index) => (
              <li
                key={one.name}
                id={`${id}-option-${index}`}
                role="option"
                aria-selected={index === active}
                className={index === active ? 'desk-row ev-option is-active' : 'desk-row ev-option'}
                onPointerDown={(pointer) => pointer.preventDefault()}
                onClick={() => choose(one)}
                onKeyDown={(key) => {
                  if (key.key === 'Enter') choose(one);
                }}
              >
                <Glyph name="pin" size={20} />
                <RowWords title={one.name} lines={[one.line]} />
              </li>
            ))}
          </ul>
        )}
      </div>
      {offer != null && (
        <Quiet
          action={
            <div className="ev-pair">
              <TextAction
                label={W.takeZone(offer)}
                onClick={() => {
                  onZone(offer);
                  setOffer(null);
                  setZoneSaid(W.zoneSet(offer));
                }}
              />
              <TextAction label={W.keepZone(zone)} onClick={() => setOffer(null)} />
            </div>
          }
        >
          {W.zoneOffer(offer)}
        </Quiet>
      )}
      {zoneSaid != null && (
        <p className="ev-said" role="status">
          {zoneSaid}
        </p>
      )}
    </>
  );
}

/** Venue: its name and address, suggestions from 3 characters, and the zone it is in when that differs. */
export function VenuePart({ event, state, onDirty, onClose, onSave }: PartProps) {
  const id = useId();
  const typing = state === 'venueSuggestions' || state === 'venueDown';
  const [name, setName] = useState(
    typing ? '' : state === 'venueZone' ? 'Eko Hotel' : (event.venue?.name ?? ''),
  );
  const [address, setAddress] = useState(
    state === 'venueSuggestions'
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
  const noteBox = useRef<HTMLTextAreaElement>(null);
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
  const [forbidden, setForbidden] = useState(false);
  const changed =
    name !== (event.venue?.name ?? '') ||
    address !== (event.venue?.address ?? '') ||
    note !== (event.arrivalNote ?? '') ||
    zone !== event.timeZone;

  useDirty(changed, onDirty);
  useEffect(() => {
    if (state === 'venueNote' || refusedNote) noteBox.current?.focus();
  }, [state, refusedNote]);

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
          noteBox.current?.focus();
          return;
        }
        if (state === 'venueNoteForbidden') {
          setForbidden(true);
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
        listing={state === 'venueSuggestions'}
        offering={state === 'venueZone' ? 'Africa/Lagos' : null}
        focus={typing}
        onPicked={setPicked}
      />
      <div className="desk-field">
        <label htmlFor={`${id}-note`} className="desk-label">
          {NOTE_WORDS.label}
          <span className="ev-optional">{` · ${W.optional}`}</span>
        </label>
        <div
          className={noteError == null ? 'desk-box ev-note-box' : 'desk-box ev-note-box is-wrong'}
        >
          <textarea
            ref={noteBox}
            id={`${id}-note`}
            rows={4}
            value={note}
            aria-invalid={noteError != null}
            aria-describedby={
              noteError == null ? `${id}-note-help` : `${id}-note-error ${id}-note-help`
            }
            onChange={(change) => {
              setNote(change.target.value);
              setForbidden(false);
              if (!noteTooLong(change.target.value)) setNoteError(null);
            }}
          />
        </div>
        {noteError != null && (
          <p id={`${id}-note-error`} className="desk-error">
            <Glyph name="alert" size={15} weight={2.2} />
            {noteError}
          </p>
        )}
        <p id={`${id}-note-help`} className="desk-help">
          {NOTE_WORDS.hint}
        </p>
      </div>
      {forbidden && <Alert>{NOTE_WORDS.forbidden}</Alert>}
      <p className="visually-hidden" role="status">
        {said}
      </p>
      <OnceSaved />
    </Opened>
  );
}

/** Hosted by's list, shared by its part and New event: the explainer, Host 1 on down, then Add a host. */
export function HostFields({
  typed,
  onTyped,
  errors,
  keep = false,
  off = false,
  fieldsRef,
  focusAtRef,
  onSaid,
}: {
  typed: readonly string[];
  onTyped: (typed: string[]) => void;
  errors: readonly (string | null)[];
  keep?: boolean;
  off?: boolean;
  fieldsRef: RefObject<(HTMLInputElement | null)[]>;
  focusAtRef: RefObject<number | null>;
  onSaid: (said: string) => void;
}) {
  function move(index: number, by: -1 | 1): void {
    const next = [...typed];
    const [one] = next.splice(index, 1);
    next.splice(index + by, 0, one ?? '');
    onTyped(next);
    onSaid(W.hostMoved(one ?? '', index + by + 1, next.length));
  }

  return (
    <>
      <p className="desk-line">{W.hostsExplainer}</p>
      <ol className="ev-hosts">
        {typed.map((name, index) => {
          const error = errors[index] ?? null;
          const only = typed.length === 1;
          const called = name.trim() || W.host(index + 1);

          return (
            <li key={index} className="ev-host">
              <div className="ev-host-head">
                <label htmlFor={`host-${index}`} className="desk-label">
                  {W.host(index + 1)}
                </label>
                {!(only && keep) && !off && (
                  <button
                    type="button"
                    className="desk-text"
                    aria-label={W.removeNamed(called)}
                    onClick={() => {
                      onTyped(only ? [''] : typed.filter((_, at) => at !== index));
                      onSaid(W.hostRemoved(called));
                      focusAtRef.current = Math.max(0, index - 1);
                    }}
                  >
                    {W.remove}
                  </button>
                )}
              </div>
              <div className="ev-host-line">
                <div className={error == null ? 'desk-box' : 'desk-box is-wrong'}>
                  <input
                    ref={(input) => {
                      fieldsRef.current[index] = input;
                    }}
                    id={`host-${index}`}
                    type="text"
                    value={name}
                    spellCheck={false}
                    readOnly={off}
                    aria-invalid={error != null}
                    aria-describedby={error == null ? undefined : `host-${index}-error`}
                    onChange={(change) =>
                      onTyped(typed.map((one, at) => (at === index ? change.target.value : one)))
                    }
                  />
                </div>
                {!only && !off && (
                  <>
                    <button
                      type="button"
                      className="ev-round"
                      aria-label={W.moveUp(called)}
                      aria-disabled={index === 0}
                      onClick={() => index > 0 && move(index, -1)}
                    >
                      <Glyph name="chevup" size={18} weight={2.4} />
                    </button>
                    <button
                      type="button"
                      className="ev-round"
                      aria-label={W.moveDown(called)}
                      aria-disabled={index === typed.length - 1}
                      onClick={() => index < typed.length - 1 && move(index, 1)}
                    >
                      <Glyph name="chevdown" size={18} weight={2.4} />
                    </button>
                  </>
                )}
              </div>
              {error != null && (
                <p id={`host-${index}-error`} className="desk-error">
                  <Glyph name="alert" size={15} weight={2.2} />
                  {error}
                </p>
              )}
            </li>
          );
        })}
      </ol>
      {typed.length === 1 && keep && <p className="desk-note">{W.lastHost}</p>}
      {typed.length >= HOSTS_MAXIMUM ? (
        <p className="desk-note">{W.mostHosts(HOSTS_MAXIMUM)}</p>
      ) : (
        !off && (
          <TextAction
            label={W.addHost}
            before="plus"
            onClick={() => {
              onTyped([...typed, '']);
              focusAtRef.current = typed.length;
            }}
          />
        )
      )}
    </>
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
  const [said, setSaid] = useState<string | null>(null);
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
        focusAtRef={focusAt}
        onSaid={setSaid}
      />
      <p className="desk-unseen" role="status">
        {said}
      </p>
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
export function CurrencyPart({ event, state, onDirty, onClose, onSave }: PartProps) {
  const refusing = state === 'currencyRefused';
  const [picked, setPicked] = useState<Currency>(refusing ? 'EUR' : event.currency);
  const [refused, setRefused] = useState(refusing);
  const changed = picked !== event.currency;

  useDirty(changed, onDirty);

  return (
    <Opened
      label={W.currency}
      changed={changed}
      onCancel={onClose}
      onSave={() => {
        if (refusing) setRefused(true);
        else onSave({ ...event, currency: picked });
      }}
    >
      {refused && <Broken>{W.currencyInUse}</Broken>}
      <Radios legend={W.currency} choices={CURRENCY_CHOICES} picked={picked} onPick={setPicked} />
    </Opened>
  );
}

/** Event name: up to 120 characters, never blank. */
export function NamePart({ event, state, onDirty, onClose, onSave }: PartProps) {
  const [name, setName] = useState(state === 'nameBlank' ? '' : event.name);
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
    </Opened>
  );
}

/** The cover as it will show: the photo, or Soirely's cover in the event's own colours. */
export function CoverPreview({
  photo,
  mesh,
  className = '',
}: {
  photo: boolean;
  mesh: string;
  className?: string;
}) {
  return (
    <div
      className={`ev-preview ${className} ${photo ? 'is-photo' : `today-cover is-${mesh}`}`}
      aria-hidden="true"
    >
      <span className="ev-scrim" />
      {photo ? (
        <Glyph name="photo" size={56} weight={1.6} />
      ) : (
        [1, 2, 3, 4, 5, 6].map((piece) => <span key={piece} className={`desk-piece p${piece}`} />)
      )}
    </div>
  );
}

/** With no photo yet: what the cover is, Upload (gone while held), and what is accepted. */
export function CoverUpload({
  refusal = null,
  off = false,
  buttonRef,
  onUpload,
}: {
  refusal?: string | null;
  off?: boolean;
  buttonRef?: Ref<HTMLButtonElement>;
  onUpload: () => void;
}) {
  return (
    <>
      {refusal != null ? <Broken>{refusal}</Broken> : <p className="desk-line">{W.coverLine}</p>}
      {!off && (
        <button ref={buttonRef} type="button" className="ev-upload" onClick={onUpload}>
          <Glyph name="photo" size={19} weight={2.2} />
          {W.upload}
        </button>
      )}
      <p className="desk-help">{W.accepted}</p>
    </>
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
