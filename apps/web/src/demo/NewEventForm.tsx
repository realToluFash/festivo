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
import { Ask, RedAction } from '../components/SettingsParts.tsx';
import {
  CoverPreview,
  CoverUpload,
  FormBlock as Block,
  Select,
} from '../components/EventFormParts.tsx';
import { CoverPhotoFields } from '../components/CoverEdit.tsx';
import { HostFields, VenueFields, ZoneSelect } from './EventEdits.tsx';
import { CURRENCY_CHOICES, EVENT_WORDS as W, TYPE_WORDS, type Wall } from './events.ts';
import { meshFor } from '../mesh.ts';
import {
  CHOSEN,
  FILLED,
  NEW_WORDS as N,
  NO_PHOTO,
  type NewEventState,
  type NewTyped,
  type Refusals,
  SENDING_STATES,
  checkOf,
  coverRefusalOf,
  draftOf,
  firstRefused,
  hostWords,
  refusalsOf,
  sentForCopy,
  typedFor,
  typedSomething,
} from './newEvent.ts';
import { useCoverPick } from './useCoverPick.tsx';
import { useLeaveAsk } from './useLeaveAsk.ts';

const LOCALE = 'en-US';
const ORGANISATION = 'Ire Events';
/** The draft the demo opens once Create goes through; the product opens the event it just made. */
export const CREATED_ID = 'evt-draft-4';
const CREATING_MS = 1200;
const OPENING_MS = 1600;
/** How long a HEIC's copy takes on the demo's slow line (sc-60915). */
const SENDING_MS = 3000;

type Status = 'editing' | 'creating' | 'failed' | 'created';

function statusOf(state: NewEventState | null): Status {
  if (state === 'creating' || state === 'photoSendingCreating') return 'creating';
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
  const cover = useCoverPick(chosen, state === 'photoSendFailed' ? W.uploadFailed : null);
  const [sending, setSending] = useState(() => state != null && SENDING_STATES.includes(state));
  const [lost, setLost] = useState<string | null>(null);
  const sends = useRef(0);
  const timers = useRef<number[]>([]);
  const slowFirst = useRef(state === 'photoSending' || state === 'photoSendLost');
  const pressed = useRef(state === 'photoSendingCreating');
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
  const [leaving, setLeaving] = useState(state === 'leave');
  const [target, setTarget] = useState<Target | null>(() =>
    state === 'refused' ? targetOf(typedFor(state), {}) : null,
  );
  const away = useLeaveAsk((typedSomething(typed) || sending) && status !== 'created');
  const id = useId();
  const noteId = `${id}-note`;
  const typeRef = useRef<HTMLDivElement>(null);
  const startRef = useRef<HTMLFieldSetElement>(null);
  const endRef = useRef<HTMLFieldSetElement>(null);
  const zoneRef = useRef<HTMLDivElement>(null);
  const currencyRef = useRef<HTMLDivElement>(null);
  const hostFields = useRef<(HTMLInputElement | null)[]>([]);
  const nameRef = useRef<HTMLInputElement>(null);
  const venueNameRef = useRef<HTMLInputElement>(null);
  const addressRef = useRef<HTMLInputElement>(null);
  const describeRef = useRef<HTMLInputElement>(null);
  const busy = status === 'creating' || status === 'created';
  const shown: Refusals = { ...(tried ? refusalsOf(typed) : {}), ...server };
  const hostErrors = hostWords(typed.hosts, tried);
  const skipped = skippedLine(typed.start.date, typed.start.time, typed.timeZone, LOCALE, WORDED);
  const nameLength = eventNameLength(typed.name);

  useEffect(() => {
    if (target == null) return;
    if ('host' in target) {
      hostFields.current[target.host]?.focus();
      return;
    }
    if ('cover' in target) {
      describeRef.current?.focus();
      return;
    }
    const at: Record<EventFormField, RefObject<HTMLElement | null>> = {
      name: nameRef,
      type: typeRef,
      startsAt: startRef,
      endsAt: endRef,
      venueName: venueNameRef,
      venueAddress: addressRef,
      arrivalNote: { current: document.getElementById(noteId) },
      timeZone: zoneRef,
      currency: currencyRef,
    };
    const field = at[target.field].current;
    (field?.querySelector<HTMLElement>('input, select') ?? field)?.focus();
  }, [target, noteId]);

  useEffect(() => () => timers.current.forEach((one) => window.clearTimeout(one)), []);

  useEffect(() => {
    if (status === 'creating' && statusOf(state) !== 'creating' && !sending) {
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
            : lost != null
              ? { state: { noPhoto: N.createdWithout(lost) } }
              : undefined,
        ),
      OPENING_MS,
    );

    return () => clearTimeout(later);
  }, [status, state, navigate, sending, lost]);

  function change(next: Partial<NewTyped>): void {
    setTyped((was) => ({ ...was, ...next }));
    setSummary(null);
    if (status === 'failed') setStatus('editing');
  }

  /** A photo that shows goes in the frame at once; a HEIC waits for its copy, and only the last one picked may land. */
  function chosen(file: File): void {
    if (sentForCopy(file)) return send(state !== 'photoSendLost');
    sends.current += 1;
    setSending(false);
    change(CHOSEN);
  }

  function send(lands: boolean): void {
    const mine = ++sends.current;
    slowFirst.current = false;
    setSending(true);
    change(NO_PHOTO);
    timers.current.push(window.setTimeout(() => settle(mine, lands), SENDING_MS));
  }

  /** An earlier copy than the last one picked never takes the frame: the product discards it. */
  function settle(mine: number, lands: boolean): void {
    if (mine !== sends.current) return;
    setSending(false);
    if (lands) cover.setRefusal(null);
    if (lands) return pressed.current ? setTyped((was) => ({ ...was, ...CHOSEN })) : change(CHOSEN);
    if (pressed.current) return setLost(W.uploadFailed);
    cover.setRefusal(W.uploadFailed);
  }

  function stopSending(): void {
    sends.current += 1;
    setSending(false);
    cover.setRefusal(null);
    change(NO_PHOTO);
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
    pressed.current = true;
    if (sending && slowFirst.current) {
      const mine = sends.current;
      slowFirst.current = false;
      timers.current.push(
        window.setTimeout(() => settle(mine, state !== 'photoSendLost'), SENDING_MS),
      );
    }
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
    <form className="ev-new-form" noValidate aria-busy={busy} onSubmit={create}>
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
        />
      </Block>

      <Block title={W.coverPhoto}>
        <div className="ev-new-frame">
          <CoverPreview
            photo={typed.photo ? <Glyph name="photo" size={56} weight={1.6} /> : null}
            mesh={meshFor(typed.type === '' ? 'new-event' : typed.type)}
            className="ev-new-cover"
          />
          {sending && (
            <p className="ev-cover-uploading" role="status">
              {W.uploading}
            </p>
          )}
        </div>
        {cover.input}
        {sending ? (
          <>
            {cover.refusal != null && <Broken>{cover.refusal}</Broken>}
            <button type="button" className="desk-text" disabled={busy} onClick={cover.pick}>
              {W.changePhoto}
            </button>
            {!busy && (
              <RedAction label={W.removePhoto} line={W.removePhotoLine} onClick={stopSending} />
            )}
          </>
        ) : typed.photo ? (
          <CoverPhotoFields
            position={typed.position}
            onPosition={(position) => change({ position })}
            description={typed.described}
            onDescription={(described) => change({ described })}
            tooLong={tried && coverRefusalOf(typed) != null}
            describeRef={describeRef}
            onChange={cover.pick}
            onRemove={() => change(NO_PHOTO)}
            off={busy}
          />
        ) : (
          <CoverUpload
            words={{ line: W.coverLine, upload: W.upload, accepted: W.accepted }}
            refusal={cover.refusal}
            off={busy}
            onUpload={cover.pick}
          />
        )}
      </Block>

      <Block title={N.whenHeading}>
        <fieldset ref={startRef} className="ev-new-when" disabled={busy}>
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
        </fieldset>
        <fieldset ref={endRef} className="ev-new-when" disabled={busy}>
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
        </fieldset>
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
          note={typed.note}
          onNote={(note) => change({ note })}
          noteError={shown.arrivalNote ?? null}
          noteId={noteId}
          off={busy}
        />
      </Block>

      <Block title={N.zoneHeading}>
        <div className="ev-new-pair">
          <ZoneSelect
            refTo={zoneRef}
            value={typed.timeZone}
            error={shown.timeZone}
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
            choices={CURRENCY_CHOICES}
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

type Target = { field: EventFormField } | { host: number } | { cover: true };

function targetOf(typed: NewTyped, server: Refusals): Target | null {
  const check = checkOf(typed, server);
  const first = firstRefused(check.refusals, check.hosts, check.cover);

  return first == null ? null : { ...first };
}
