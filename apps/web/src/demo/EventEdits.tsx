import {
  COVER_DESCRIPTION_MAXIMUM,
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
  positionPart,
  startMoved,
  formatWallDay,
} from '@soirely/domain';
import { type ReactNode, useEffect, useId, useRef, useState } from 'react';

import {
  type Currency,
  type EditState,
  type SampleEvent,
  type SampleVenue,
  type Wall,
  CURRENCIES,
  EVENT_WORDS as W,
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
import { REPLY_BY_WORDS, replyByAfterStart } from './replyBy.ts';
import { Alert, Broken, NotBuilt, Quiet } from './EventParts.tsx';
import { Glyph } from '../components/Glyph.tsx';
import { Ask, RedAction, RowWords, TextAction } from '../components/SettingsParts.tsx';

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

/** An edit open in place at a desk: under a 2 px Violet rule, the part's fields, then Cancel and Save, Save in Ink 3 until something changes. */
export function Opened({
  label,
  changed,
  verb = W.save,
  asking: first = null,
  refused = false,
  onLatest,
  onCancel,
  onSave,
  children,
}: {
  label: string;
  changed: boolean;
  verb?: string;
  asking?: 'discard' | 'latest' | null;
  refused?: boolean;
  onLatest?: () => void;
  onCancel: () => void;
  onSave: () => void;
  children: ReactNode;
}) {
  const [asking, setAsking] = useState(first);
  const cancel = () => (changed ? setAsking('discard') : onCancel());
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = box.current;

    if (node == null || asking != null) return;

    const keys = (event: KeyboardEvent) => {
      const open = event.target instanceof HTMLElement && event.target.ariaExpanded === 'true';

      if (event.key !== 'Escape' || event.defaultPrevented || open) return;
      event.preventDefault();
      event.stopPropagation();
      if (changed) setAsking('discard');
      else onCancel();
    };

    node.addEventListener('keydown', keys);

    return () => node.removeEventListener('keydown', keys);
  }, [asking, changed, onCancel]);

  return (
    <div className="ev-opened" role="group" aria-label={label} ref={box}>
      {refused && (
        <Broken action={<TextAction label={W.showLatest} onClick={() => setAsking('latest')} />}>
          {W.changedElsewhere}
        </Broken>
      )}
      {children}
      <div className="ev-opened-actions">
        <TextAction label={W.cancel} onClick={cancel} />
        <button
          type="button"
          className={changed ? 'desk-text' : 'desk-text is-off'}
          aria-disabled={!changed}
          onClick={() => {
            if (changed) onSave();
          }}
        >
          {verb}
        </button>
      </div>
      {asking === 'discard' && (
        <Ask
          title={W.discardTitle}
          line={W.discardLine}
          keep={W.keepEditing}
          go={W.discard}
          onKeep={() => setAsking(null)}
          onGo={() => {
            setAsking(null);
            onCancel();
          }}
        />
      )}
      {asking === 'latest' && (
        <Ask
          title={W.showLatestTitle}
          line={W.showLatestBody}
          keep={W.keepEditing}
          go={W.showLatest}
          onKeep={() => setAsking(null)}
          onGo={() => {
            setAsking(null);
            onLatest?.();
          }}
        />
      )}
    </div>
  );
}

function OnceSaved() {
  return (
    <div className="ev-once">
      <p className="ev-once-words">{W.onceSaved}</p>
      <NotBuilt words={W.tellGuests} />
    </div>
  );
}

/** A date and a time in the event's zone, one label for the two, as main's EventFields types them. */
export function DateTime({
  legend,
  wall,
  wrong = false,
  told,
  onChange,
}: {
  legend: string;
  wall: Wall;
  wrong?: boolean;
  told?: string;
  onChange: (wall: Wall) => void;
}) {
  const id = useId();

  return (
    <fieldset className="ev-when">
      <legend className="desk-label">{legend}</legend>
      <div className="ev-when-pair">
        <label htmlFor={`${id}-date`} className="desk-unseen">
          {`${legend}, ${W.date}`}
        </label>
        <input
          id={`${id}-date`}
          type="date"
          className={wrong ? 'ev-input is-wrong' : 'ev-input'}
          value={wall.date}
          aria-invalid={wrong}
          aria-describedby={told}
          onChange={(event) => onChange({ ...wall, date: event.target.value })}
        />
        <label htmlFor={`${id}-time`} className="desk-unseen">
          {`${legend}, ${W.time}`}
        </label>
        <input
          id={`${id}-time`}
          type="time"
          className={wrong ? 'ev-input is-time is-wrong' : 'ev-input is-time'}
          value={wall.time}
          aria-invalid={wrong}
          aria-describedby={told}
          onChange={(event) => onChange({ ...wall, time: event.target.value })}
        />
      </div>
    </fieldset>
  );
}

function Text({
  label,
  optional = false,
  value,
  help,
  error,
  inputRef,
  maxLength,
  onChange,
  input,
}: {
  label: string;
  optional?: boolean;
  value: string;
  help?: string | null;
  error?: string | null;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  maxLength?: number;
  onChange: (value: string) => void;
  input?: Partial<React.InputHTMLAttributes<HTMLInputElement>>;
}) {
  const id = useId();
  const told = [help == null ? null : `${id}-help`, error == null ? null : `${id}-error`]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="desk-field">
      <label htmlFor={id} className="desk-label">
        {label}
        {optional && <span className="ev-optional">{` · ${W.optional}`}</span>}
      </label>
      <div className={error == null ? 'desk-box' : 'desk-box is-wrong'}>
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={value}
          maxLength={maxLength}
          spellCheck={false}
          aria-invalid={error != null}
          aria-describedby={told === '' ? undefined : told}
          onChange={(event) => onChange(event.target.value)}
          {...input}
        />
      </div>
      {help != null && (
        <p id={`${id}-help`} className="desk-help">
          {help}
        </p>
      )}
      {error != null && (
        <p id={`${id}-error`} className="desk-error">
          <Glyph name="alert" size={15} weight={2.2} />
          {error}
        </p>
      )}
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
        onSave({ ...event, startsAt, endsAt, timeZone: zone });
      }}
    >
      <DateTime legend={W.starts} wall={start} onChange={moveStart} />
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
      <div className="desk-field">
        <label htmlFor={`${id}-zone`} className="desk-label">
          {W.timeZone}
        </label>
        <div className="desk-box ev-select">
          <select
            id={`${id}-zone`}
            value={zone}
            aria-describedby={`${id}-zone-help`}
            onChange={(change) => setZone(change.target.value)}
          >
            {ZONES.map((one) => (
              <option key={one} value={one}>
                {one}
              </option>
            ))}
          </select>
          <Glyph name="chevdown" size={18} weight={2.3} />
        </div>
        <p id={`${id}-zone-help`} className="desk-help">
          {W.timesIn(zone)}
        </p>
      </div>
      <OnceSaved />
    </Opened>
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
  const [listOpen, setListOpen] = useState(state === 'venueSuggestions');
  const [active, setActive] = useState(-1);
  const [offer, setOffer] = useState<string | null>(state === 'venueZone' ? 'Africa/Lagos' : null);
  const [zone, setZone] = useState(event.timeZone);
  const [zoneSaid, setZoneSaid] = useState<string | null>(null);
  const down = state === 'venueDown';
  const field = useRef<HTMLInputElement>(null);
  const shown = down || !listOpen ? [] : suggestionsFor(address);
  const changed =
    name !== (event.venue?.name ?? '') ||
    address !== (event.venue?.address ?? '') ||
    zone !== event.timeZone;

  useDirty(changed, onDirty);
  useEffect(() => {
    if (typing) field.current?.focus();
  }, [typing]);

  function choose(one: SampleVenue): void {
    setPicked(one);
    setAddress(one.address);
    if (name.trim() === '') setName(one.name);
    setListOpen(false);
    setActive(-1);
    setOffer(one.timeZone === zone ? null : one.timeZone);
  }

  return (
    <Opened
      label={W.venue}
      changed={changed}
      onCancel={onClose}
      onSave={() => {
        const city = picked?.city ?? address.split(',').at(-1)?.trim() ?? event.venue?.city ?? '';
        const title = name.trim() || address.trim();

        onSave({
          ...event,
          timeZone: zone,
          venue:
            title === ''
              ? null
              : { name: title, address: address.trim() === '' ? null : address.trim(), city },
        });
      }}
    >
      <Text label={W.venueName} optional value={name} onChange={setName} />
      <div className="desk-field ev-combo">
        <label htmlFor={id} className="desk-label">
          {W.address}
          <span className="ev-optional">{` · ${W.optional}`}</span>
        </label>
        <div className="desk-box">
          <input
            ref={field}
            id={id}
            type="text"
            role="combobox"
            value={address}
            spellCheck={false}
            autoComplete="off"
            aria-autocomplete="list"
            aria-expanded={shown.length > 0}
            aria-controls={shown.length > 0 ? `${id}-list` : undefined}
            aria-activedescendant={active >= 0 ? `${id}-option-${active}` : undefined}
            aria-describedby={`${id}-help`}
            onChange={(change) => {
              setAddress(change.target.value);
              setPicked(null);
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
                  setZone(offer);
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
      <OnceSaved />
    </Opened>
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

  function move(index: number, by: -1 | 1): void {
    const next = [...typed];
    const [one] = next.splice(index, 1);
    next.splice(index + by, 0, one ?? '');
    setTyped(next);
    setSaid(W.hostMoved(one ?? '', index + by + 1, next.length));
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
      <p className="desk-line">{W.hostsExplainer}</p>
      <ol className="ev-hosts">
        {typed.map((name, index) => {
          const error = problemWords(index);
          const only = typed.length === 1;
          const called = name.trim() || W.host(index + 1);

          return (
            <li key={index} className="ev-host">
              <div className="ev-host-head">
                <label htmlFor={`host-${index}`} className="desk-label">
                  {W.host(index + 1)}
                </label>
                {!(only && keep) && (
                  <button
                    type="button"
                    className="desk-text"
                    aria-label={W.removeNamed(called)}
                    onClick={() => {
                      setTyped(only ? [''] : typed.filter((_, at) => at !== index));
                      setSaid(W.hostRemoved(called));
                      focusAt.current = Math.max(0, index - 1);
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
                      fields.current[index] = input;
                    }}
                    id={`host-${index}`}
                    type="text"
                    value={name}
                    spellCheck={false}
                    aria-invalid={error != null}
                    aria-describedby={error == null ? undefined : `host-${index}-error`}
                    onChange={(change) =>
                      setTyped(typed.map((one, at) => (at === index ? change.target.value : one)))
                    }
                  />
                </div>
                {!only && (
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
        <TextAction
          label={W.addHost}
          before="plus"
          onClick={() => {
            setTyped([...typed, '']);
            focusAt.current = typed.length;
          }}
        />
      )}
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

function Radios<T extends string>({
  legend,
  choices,
  picked,
  onPick,
}: {
  legend: string;
  choices: readonly (readonly [T, string])[];
  picked: T;
  onPick: (one: T) => void;
}) {
  const name = useId();

  return (
    <fieldset className="desk-choices">
      <legend className="desk-unseen">{legend}</legend>
      <ul className="desk-rows">
        {choices.map(([one, words]) => (
          <li key={one}>
            <label
              className={one === picked ? 'desk-row ev-choice is-picked' : 'desk-row ev-choice'}
            >
              <RowWords title={words} />
              <input
                type="radio"
                className="desk-radio"
                name={name}
                checked={one === picked}
                onChange={() => onPick(one)}
              />
            </label>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}

const CURRENCY_CODES = Object.keys(CURRENCIES) as Currency[];

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
      <Radios
        legend={W.currency}
        choices={CURRENCY_CODES.map((code) => [code, `${code} · ${CURRENCIES[code]}`])}
        picked={picked}
        onPick={setPicked}
      />
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

/** Cover: Soirely's cover in the event's own colours, or a photo, its position and what a screen reader says for it. */
export function CoverPart({ event, state, onDirty, onClose, onSave }: PartProps) {
  const [photo, setPhoto] = useState(state === 'coverPhoto' ? true : event.photo);
  const [position, setPosition] = useState(50);
  const [described, setDescribed] = useState(PHOTO_DESCRIPTION);
  const refused = state === 'coverRefused';
  const part = positionPart(position);
  const changed = photo !== event.photo || (photo && position !== 50);
  const id = useId();

  useDirty(changed, onDirty);

  return (
    <Opened
      label={W.cover}
      changed={changed}
      verb={photo && !event.photo ? W.usePhoto : W.save}
      onCancel={onClose}
      onSave={() => onSave({ ...event, photo })}
    >
      <div
        className={photo ? 'ev-preview is-photo' : `ev-preview today-cover is-${event.mesh}`}
        aria-hidden="true"
      >
        <span className="ev-scrim" />
        {photo ? (
          <Glyph name="photo" size={56} weight={1.6} />
        ) : (
          [1, 2, 3, 4, 5, 6].map((piece) => <span key={piece} className={`desk-piece p${piece}`} />)
        )}
      </div>
      {photo ? (
        <>
          <TextAction label={W.changePhoto} onClick={() => setPosition(50)} />
          <div className="desk-field">
            <label htmlFor={`${id}-position`} className="desk-label">
              {W.position}
            </label>
            <input
              id={`${id}-position`}
              type="range"
              className="ev-slider"
              min={0}
              max={100}
              value={position}
              aria-valuetext={W.showing(part)}
              onChange={(change) => setPosition(Number(change.target.value))}
            />
            <div className="ev-slider-ends" aria-hidden="true">
              <span>{W.top}</span>
              <span>{W.bottom}</span>
            </div>
            <p className="desk-help">{W.showing(part)}</p>
          </div>
          <Text
            label={W.describe}
            optional
            value={described}
            maxLength={COVER_DESCRIPTION_MAXIMUM}
            help={`${W.describeHint} ${W.describeCount(Array.from(described).length, COVER_DESCRIPTION_MAXIMUM)}`}
            onChange={setDescribed}
          />
          <RedAction
            label={W.removePhoto}
            line={W.removePhotoLine}
            onClick={() => setPhoto(false)}
          />
        </>
      ) : (
        <>
          {refused ? (
            <Broken>{W.refusedDimensions}</Broken>
          ) : (
            <p className="desk-line">{W.coverLine}</p>
          )}
          <button type="button" className="ev-upload" onClick={() => setPhoto(true)}>
            <Glyph name="photo" size={19} weight={2.2} />
            {W.upload}
          </button>
          <p className="desk-help">{W.accepted}</p>
        </>
      )}
    </Opened>
  );
}
