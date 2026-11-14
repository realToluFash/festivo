import {
  EVENT_NAME_MAXIMUM,
  EVENT_TYPES,
  type EventFormField,
  type EventType,
  endMovedLine,
  eventNameLength,
  skippedLine,
  startMoved,
} from '@soirely/domain';
import {
  type FormEvent,
  type ReactNode,
  type RefObject,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { useNavigate } from 'react-router';

import { Broken, DateTime, EditText as Text } from '../components/EventPageParts.tsx';
import { Glyph } from '../components/Glyph.tsx';
import { Ask, Head, RedAction } from '../components/SettingsParts.tsx';
import { HostFields, VenueFields } from './EventEdits.tsx';
import {
  CURRENCIES,
  type Currency,
  EVENT_WORDS as W,
  TYPE_WORDS,
  type Wall,
  ZONES,
} from './events.ts';
import { meshFor } from '../mesh.ts';
import {
  FILLED,
  NEW_WORDS as N,
  type NewEventState,
  type NewTyped,
  type Refusals,
  checkOf,
  draftOf,
  firstRefused,
  hostWords,
  refusalsOf,
  typedFor,
  typedSomething,
} from './newEvent.ts';
import { useLeaveAsk } from './useLeaveAsk.ts';
import './newEvent.css';

const LOCALE = 'en-US';
const ORGANISATION = 'Ire Events';
/** The draft the demo opens once Create goes through; the product opens the event it just made. */
export const CREATED_ID = 'evt-draft-4';
const CREATING_MS = 1200;
const OPENING_MS = 1600;
const CURRENCY_CODES = Object.keys(CURRENCIES) as Currency[];

type Status = 'editing' | 'creating' | 'failed' | 'created';

function statusOf(state: NewEventState | null): Status {
  if (state === 'creating') return 'creating';
  if (state === 'notCreated' || state === 'offline') return 'failed';
  if (state === 'created') return 'created';
  return 'editing';
}

const WORDED = (key: string, values?: Record<string, string | number>): string => {
  if (values == null) return key;
  if (key === 'eventForm.endMoved')
    return W.endMoved(`${String(values.day)}, ${String(values.time)}`);
  if (key.startsWith('eventForm.clocksSkip'))
    return N.clocksSkip(
      String(values.time),
      String(values.day),
      String(values.zone),
      key === 'eventForm.clocksSkipNextDay'
        ? `${String(values.savedAs)} on ${String(values.savedDay)}`
        : String(values.savedAs),
    );
  return key;
};

/** New event's form at a desk (sc-48607): the event's own parts in today's order, in blocks, Create event at the foot. */
export function NewEventForm({ state }: { state: NewEventState | null }) {
  const navigate = useNavigate();
  const [typed, setTyped] = useState<NewTyped>(() => typedFor(state));
  const [tried, setTried] = useState(state === 'refused');
  const [status, setStatus] = useState<Status>(() => statusOf(state));
  const [server, setServer] = useState<Refusals>(
    state === 'server' ? { timeZone: N.zoneRefused } : {},
  );
  const [endChosen, setEndChosen] = useState(state === 'refused');
  const [moved, setMoved] = useState<string | null>(() =>
    state === 'moved'
      ? endMovedLine(draftOf(FILLED), draftOf(typedFor('moved')), LOCALE, WORDED)
      : null,
  );
  const [summary, setSummary] = useState<string | null>(() =>
    state === 'refused' ? N.problems(checkOf(typedFor(state)).count) : null,
  );
  const [said, setSaid] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(state === 'leave');
  const [target, setTarget] = useState<Target | null>(() =>
    state === 'refused' ? targetOf(typedFor(state), {}) : null,
  );
  const away = useLeaveAsk(typedSomething(typed) && status !== 'created');
  const id = useId();
  const typeRef = useRef<HTMLDivElement>(null);
  const startRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const zoneRef = useRef<HTMLDivElement>(null);
  const currencyRef = useRef<HTMLDivElement>(null);
  const hostFields = useRef<(HTMLInputElement | null)[]>([]);
  const hostFocus = useRef<number | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const venueNameRef = useRef<HTMLInputElement>(null);
  const addressRef = useRef<HTMLInputElement>(null);
  const busy = status === 'creating' || status === 'created';
  const shown: Refusals = { ...(tried ? refusalsOf(typed) : {}), ...server };
  const hostErrors = hostWords(typed.hosts, tried);
  const skipped = skippedLine(typed.start.date, typed.start.time, typed.timeZone, LOCALE, WORDED);
  const nameLength = eventNameLength(typed.name);

  useEffect(() => {
    if (hostFocus.current == null) return;
    hostFields.current[hostFocus.current]?.focus();
    hostFocus.current = null;
  });

  useEffect(() => {
    if (target == null) return;
    if ('host' in target) {
      hostFields.current[target.host]?.focus();
      return;
    }
    const at: Record<EventFormField, RefObject<HTMLElement | null>> = {
      name: nameRef,
      type: typeRef,
      startsAt: startRef,
      endsAt: endRef,
      venueName: venueNameRef,
      venueAddress: addressRef,
      timeZone: zoneRef,
      currency: currencyRef,
    };
    const field = at[target.field].current;
    (field?.querySelector<HTMLElement>('input, select') ?? field)?.focus();
  }, [target]);

  useEffect(() => {
    if (status === 'creating' && state !== 'creating') {
      const later = setTimeout(() => setStatus('created'), CREATING_MS);

      return () => clearTimeout(later);
    }
    if (status !== 'created') return undefined;
    const later = setTimeout(
      () =>
        void navigate(
          `/demo/events/${CREATED_ID}`,
          state === 'photoRefused'
            ? { state: { noPhoto: N.createdWithout(W.refusedDimensions) } }
            : undefined,
        ),
      OPENING_MS,
    );

    return () => clearTimeout(later);
  }, [status, state, navigate]);

  function change(next: Partial<NewTyped>): void {
    setTyped((was) => ({ ...was, ...next }));
    setSummary(null);
    if (status === 'failed') setStatus('editing');
  }

  function moveStart(next: Wall): void {
    const before = draftOf(typed);
    const after = startMoved(
      before,
      { startDate: next.date, startTime: next.time },
      endChosen,
      typed.timeZone,
    );

    change({ start: next, end: { date: after.endDate, time: after.endTime } });
    setMoved(endMovedLine(before, after, LOCALE, WORDED));
  }

  function create(submit: FormEvent): void {
    submit.preventDefault();
    if (busy) return;
    setTried(true);
    const check = checkOf(typed, server);
    if (check.count > 0) {
      setSummary(N.problems(check.count));
      setTarget(targetOf(typed, server));
      return;
    }
    setSummary(null);
    setStatus('creating');
  }

  function leave(): void {
    setLeaving(false);
    away.release();
    if (away.blocked) away.go();
    else void navigate('/demo/events');
  }

  const error = (field: EventFormField, words: string | undefined): ReactNode =>
    words != null && (
      <p id={`${id}-${field}-error`} className="desk-error">
        <Glyph name="alert" size={15} weight={2.2} />
        {words}
      </p>
    );

  return (
    <form className="ev-new" noValidate aria-busy={busy} onSubmit={create}>
      <Block title={N.aboutHeading}>
        <Text
          label={W.eventName}
          value={typed.name}
          inputRef={nameRef}
          error={shown.name ?? null}
          help={W.nameCount(nameLength, EVENT_NAME_MAXIMUM)}
          input={{ readOnly: busy }}
          onChange={(name) => change({ name })}
        />
        <Select
          refTo={typeRef}
          label={W.type}
          value={typed.type}
          placeholder={N.typePlaceholder}
          choices={EVENT_TYPES.map((one) => [one, TYPE_WORDS[one]])}
          error={shown.type}
          off={busy}
          onChange={(type) => change({ type: type as EventType })}
        />
      </Block>

      <Block title={W.hostedBy}>
        <HostFields
          typed={typed.hosts}
          onTyped={(hosts) => change({ hosts })}
          errors={hostErrors}
          off={busy}
          fieldsRef={hostFields}
          focusAtRef={hostFocus}
          onSaid={setSaid}
        />
      </Block>

      <Block title={W.coverPhoto}>
        <div
          className={
            typed.photo
              ? 'ev-preview ev-new-cover is-photo'
              : `ev-preview ev-new-cover today-cover is-${meshFor(typed.type === '' ? 'new-event' : typed.type)}`
          }
          aria-hidden="true"
        >
          <span className="ev-scrim" />
          {typed.photo ? (
            <Glyph name="photo" size={56} weight={1.6} />
          ) : (
            [1, 2, 3, 4, 5, 6].map((piece) => (
              <span key={piece} className={`desk-piece p${piece}`} />
            ))
          )}
        </div>
        {typed.photo ? (
          !busy && (
            <RedAction
              label={W.removePhoto}
              line={W.removePhotoLine}
              onClick={() => change({ photo: false })}
            />
          )
        ) : (
          <>
            <p className="desk-line">{W.coverLine}</p>
            {!busy && (
              <button type="button" className="ev-upload" onClick={() => change({ photo: true })}>
                <Glyph name="photo" size={19} weight={2.2} />
                {W.upload}
              </button>
            )}
            <p className="desk-help">{W.accepted}</p>
          </>
        )}
      </Block>

      <Block title={N.whenHeading}>
        <div ref={startRef} className="ev-new-when">
          <DateTime
            legend={W.starts}
            wall={typed.start}
            wrong={shown.startsAt != null}
            told={shown.startsAt == null ? undefined : `${id}-startsAt-error`}
            onChange={moveStart}
          />
          {error('startsAt', shown.startsAt)}
          {skipped != null && (
            <p className="ev-said" role="status">
              {skipped}
            </p>
          )}
        </div>
        <div ref={endRef} className="ev-new-when">
          <DateTime
            legend={W.ends}
            wall={typed.end}
            wrong={shown.endsAt != null}
            told={shown.endsAt == null ? `${id}-endsAt-help` : `${id}-endsAt-error`}
            onChange={(end) => {
              change({ end });
              setEndChosen(true);
              setMoved(null);
            }}
          />
          {shown.endsAt != null ? (
            error('endsAt', shown.endsAt)
          ) : moved != null ? (
            <p id={`${id}-endsAt-help`} className="ev-said" role="status">
              {moved}
            </p>
          ) : (
            <p id={`${id}-endsAt-help`} className="desk-help">
              {W.endsHint}
            </p>
          )}
        </div>
      </Block>

      <Block title={N.venueHeading}>
        <VenueFields
          name={typed.venueName}
          onName={(venueName) => change({ venueName })}
          address={typed.venueAddress}
          onAddress={(venueAddress) => change({ venueAddress })}
          zone={typed.timeZone}
          onZone={(timeZone) => {
            change({ timeZone });
            setServer({});
          }}
          down={false}
          nameError={shown.venueName ?? null}
          addressError={shown.venueAddress ?? null}
          nameRef={venueNameRef}
          addressRef={addressRef}
          off={busy}
        />
      </Block>

      <Block title={N.zoneHeading}>
        <div className="ev-new-pair">
          <Select
            refTo={zoneRef}
            label={W.timeZone}
            value={typed.timeZone}
            choices={ZONES.map((one) => [one, one])}
            error={shown.timeZone}
            help={W.timesIn(typed.timeZone)}
            off={busy}
            onChange={(timeZone) => {
              change({ timeZone });
              setServer({});
            }}
          />
          <Select
            refTo={currencyRef}
            label={W.currency}
            value={typed.currency}
            placeholder={N.currencyBlank}
            choices={CURRENCY_CODES.map((code) => [code, `${code} · ${CURRENCIES[code]}`])}
            error={shown.currency}
            help={N.defaultsHint(ORGANISATION)}
            off={busy}
            onChange={(currency) => change({ currency })}
          />
        </div>
      </Block>

      <div className="ev-new-foot">
        {status === 'failed' && <Broken>{N.notCreated}</Broken>}
        {summary != null && (
          <p className="desk-error" role="alert">
            <Glyph name="alert" size={15} weight={2.2} />
            {summary}
          </p>
        )}
        {status === 'created' && (
          <div className="notice notice-done" role="status">
            <span className="mark mark-done" aria-hidden="true">
              ✓
            </span>
            <p>{N.created}</p>
          </div>
        )}
        <button type="submit" className="button button-primary" aria-disabled={busy}>
          {status === 'creating' ? N.creating : N.create}
        </button>
      </div>
      <p className="desk-unseen" role="status">
        {said}
      </p>
      {(leaving || away.blocked) && (
        <Ask
          title={N.leaveTitle}
          line={N.leaveBody}
          keep={W.keepEditing}
          go={N.leave}
          onKeep={() => {
            setLeaving(false);
            away.stay();
          }}
          onGo={leave}
        />
      )}
    </form>
  );
}

type Target = { field: EventFormField } | { host: number };

function targetOf(typed: NewTyped, server: Refusals): Target | null {
  const check = checkOf(typed, server);
  const first = firstRefused(check.refusals, check.hosts);

  return first == null ? null : { ...first };
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();

  return (
    <section className="desk-block ev-new-block" aria-labelledby={id}>
      <Head title={<span id={id}>{title}</span>} />
      <div className="ev-new-fields">{children}</div>
    </section>
  );
}

function Select({
  refTo,
  label,
  value,
  placeholder,
  choices,
  error,
  help,
  off,
  onChange,
}: {
  refTo: RefObject<HTMLDivElement | null>;
  label: string;
  value: string;
  placeholder?: string;
  choices: readonly (readonly [string, string])[];
  error: string | undefined;
  help?: string;
  off: boolean;
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
