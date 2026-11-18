import { ApiError, type OrganisationEvent, type TaggedEvent } from '@soirely/api-client';
import {
  EVENT_NAME_MAXIMUM,
  type EventDraft,
  type EventSaveRefusal,
  type EventFormField,
  type EventType,
  type HostErrors,
  type HostRow,
  type VenueDraft,
  arrivalNoteTooLong,
  coverTypeOf,
  draftOf,
  eventChanges,
  eventSaveRefusal,
  eventFormErrors,
  eventNameLength,
  formatWallDay,
  hostErrorsOf,
  hostsChanged,
  hostsSent,
  keepsLastHost,
  replyByAfterStart,
  replyByAsk,
  skippedLine,
  venueDraftOf,
  wallDay,
} from '@soirely/domain';
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../../../api.ts';
import {
  Broken,
  DateTime,
  EditText,
  Opened,
  Radios,
  type Wall,
} from '../../../components/EventPageParts.tsx';
import { type CoverEdited, type CoverUploaded, CoverEdit } from '../../../components/CoverEdit.tsx';
import { Glyph } from '../../../components/Glyph.tsx';
import { currentLocale, dateLocale } from '../../../i18n/index.ts';
import { meshFor } from '../../../mesh.ts';
import { currencyChoices, timeZoneChoices } from '../../../zoneAndCurrencyChoices.ts';
import { discardCoverUpload, refusalOf } from './coverPhoto.ts';
import { HostFields, VenueFields } from './EventFormFields.tsx';
import { typeChoices } from './eventTypes.ts';
import { useStartCarriesEnd } from './useStartCarriesEnd.ts';
import { ReplyByAsk } from './ReplyByPart.tsx';
import { replyBySaid, useHavent } from './replyByHavent.ts';

export type Part = 'name' | 'dates' | 'replyBy' | 'venue' | 'hosts' | 'type' | 'currency' | 'cover';

export interface PartProps {
  event: OrganisationEvent;
  tag: string;
  onDirty: (dirty: boolean) => void;
  onClose: () => void;
  /** `said` is the toast, when it is more than Saved. */
  onSaved: (saved: TaggedEvent, said?: string) => void;
  onLatest: (latest: TaggedEvent) => void;
}

type Typed = { draft: EventDraft; timeZone: string; currency: string; venue: VenueDraft };

type Errors = { [Field in EventFormField]?: string | undefined };

/** What a save came back with: the event as saved, or why not, in the words each part shows. */
type Saving = { kind: 'saved' } | EventSaveRefusal;

function typedOf(event: OrganisationEvent): Typed {
  return {
    draft: draftOf(event),
    timeZone: event.timeZone,
    currency: event.currency,
    venue: venueDraftOf(event.venue, event.arrivalNote),
  };
}

/** One part's save, as Edit details saves the whole form: only what changed, against the tag read, and the API's refusals mapped back to the fields. */
function useSave({ event, tag, onSaved }: Pick<PartProps, 'event' | 'tag' | 'onSaved'>) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  async function save(
    typed: Typed,
    hosts: readonly HostRow[] | null,
    said?: (saved: TaggedEvent) => string | undefined,
  ): Promise<Saving> {
    const changes = {
      ...eventChanges(event, typed),
      ...(hosts != null &&
      hostsChanged(
        event.hosts,
        hosts.map((row) => row.name),
      )
        ? { hosts: hostsSent(hosts.map((row) => row.name)) }
        : {}),
    };

    if (Object.keys(changes).length === 0) return { kind: 'saved' };

    setBusy(true);

    try {
      const saved = await api.updateEvent(event.id, changes, tag);
      setBusy(false);
      onSaved(saved, said?.(saved));

      return { kind: 'saved' };
    } catch (error) {
      setBusy(false);

      return eventSaveRefusal(error, hosts ?? [], t);
    }
  }

  async function latest(onLatest: (latest: TaggedEvent) => void): Promise<boolean> {
    try {
      onLatest(await api.taggedEvent(event.id));

      return true;
    } catch {
      return false;
    }
  }

  return { busy, save, latest };
}

function only(errors: Errors, fields: readonly EventFormField[]): Errors {
  return Object.fromEntries(
    Object.entries(errors).filter(([field]) => fields.includes(field as EventFormField)),
  );
}

function useDirty(changed: boolean, onDirty: (dirty: boolean) => void): void {
  useEffect(() => onDirty(changed), [changed, onDirty]);
}

/** The notice a save that failed for no reason the part can show leaves, or for the role, and Changed elsewhere's way to the latest. */
function useOutcome(onLatest: PartProps['onLatest'], latest: ReturnType<typeof useSave>['latest']) {
  const { t } = useTranslation();
  const [outcome, setOutcome] = useState<'changed' | 'failed' | 'forbidden' | null>(null);

  return {
    refused: outcome === 'changed',
    failed:
      outcome === 'failed' || outcome === 'forbidden' ? (
        <Broken>{t(outcome === 'forbidden' ? 'eventEdit.forbidden' : 'eventEdit.notSaved')}</Broken>
      ) : null,
    took(saving: Saving): void {
      setOutcome(saving.kind === 'refused' || saving.kind === 'saved' ? null : saving.kind);
    },
    showLatest(): void {
      void latest(onLatest).then((read) => setOutcome(read ? null : 'failed'));
    },
  };
}

export function NamePart({ event, tag, onDirty, onClose, onSaved, onLatest }: PartProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(event.name);
  const [error, setError] = useState<string | null>(null);
  const field = useRef<HTMLInputElement>(null);
  const { busy, save, latest } = useSave({ event, tag, onSaved });
  const outcome = useOutcome(onLatest, latest);
  const length = eventNameLength(name);
  const changed = name !== event.name;

  useDirty(changed, onDirty);
  useEffect(() => field.current?.focus(), []);

  async function send(): Promise<void> {
    const typed = { ...typedOf(event), draft: { ...draftOf(event), name } };
    const found = only(eventFormErrors(typed, t), ['name']).name ?? null;

    setError(found);
    if (found != null) return field.current?.focus();

    const saving = await save(typed, null);

    outcome.took(saving);
    if (saving.kind === 'refused') {
      setError(saving.errors.name ?? null);
      field.current?.focus();
    }
  }

  return (
    <Opened
      label={t('eventForm.name')}
      changed={changed}
      refused={outcome.refused}
      busy={busy}
      onLatest={outcome.showLatest}
      onCancel={onClose}
      onSave={() => void send()}
    >
      {outcome.failed}
      <EditText
        label={t('eventForm.name')}
        value={name}
        inputRef={field}
        error={error}
        help={
          error == null
            ? t('eventForm.nameCount', { count: length, most: EVENT_NAME_MAXIMUM })
            : null
        }
        input={{ autoComplete: 'off' }}
        onChange={(value) => {
          setName(value);
          setError(null);
        }}
      />
    </Opened>
  );
}

export function TypePart({ event, tag, onDirty, onClose, onSaved, onLatest }: PartProps) {
  const { t } = useTranslation();
  const [picked, setPicked] = useState<EventType>(event.type);
  const [q, setQ] = useState('');
  const { busy, save, latest } = useSave({ event, tag, onSaved });
  const outcome = useOutcome(onLatest, latest);
  const choices = typeChoices(event.type, t);
  const shown = choices.filter((choice) =>
    choice.label.toLowerCase().includes(q.trim().toLowerCase()),
  );
  const changed = picked !== event.type;

  useDirty(changed, onDirty);

  return (
    <Opened
      label={t('eventForm.type')}
      changed={changed}
      refused={outcome.refused}
      busy={busy}
      onLatest={outcome.showLatest}
      onCancel={onClose}
      onSave={() =>
        void save({ ...typedOf(event), draft: { ...draftOf(event), type: picked } }, null).then(
          outcome.took,
        )
      }
    >
      {outcome.failed}
      <div className="ev-field is-small" role="search" aria-label={t('eventPage.searchTypes')}>
        <Glyph name="search" size={18} weight={2.2} />
        <input
          type="search"
          aria-label={t('eventPage.searchTypes')}
          placeholder={t('eventPage.searchTypes')}
          value={q}
          spellCheck={false}
          onChange={(change) => setQ(change.target.value)}
        />
      </div>
      <Radios
        legend={t('eventForm.type')}
        choices={shown.map((choice) => [choice.value as EventType, choice.label] as const)}
        picked={picked}
        onPick={setPicked}
      />
    </Opened>
  );
}

/** Currency: refused once amounts are recorded against the event. */
export function CurrencyPart({ event, tag, onDirty, onClose, onSaved, onLatest }: PartProps) {
  const { t } = useTranslation();
  const [picked, setPicked] = useState(event.currency);
  const [inUse, setInUse] = useState(false);
  const { busy, save, latest } = useSave({ event, tag, onSaved });
  const outcome = useOutcome(onLatest, latest);
  const locale = currentLocale();
  const choices = useMemo(
    () => currencyChoices(event.currency, picked, locale, t),
    [event.currency, picked, locale, t],
  );
  const changed = picked !== event.currency;

  useDirty(changed, onDirty);

  return (
    <Opened
      label={t('eventForm.currency')}
      changed={changed}
      refused={outcome.refused}
      busy={busy}
      onLatest={outcome.showLatest}
      onCancel={onClose}
      onSave={() =>
        void save({ ...typedOf(event), currency: picked }, null).then((saving) => {
          outcome.took(saving);
          setInUse(saving.kind === 'refused' && saving.currencyInUse);
        })
      }
    >
      {outcome.failed}
      {inUse && <Broken>{t('eventEdit.currencyInUse')}</Broken>}
      <Radios
        legend={t('eventForm.currency')}
        choices={choices.map((choice) => [choice.value, choice.label] as const)}
        picked={picked}
        onPick={setPicked}
      />
    </Opened>
  );
}

function wallOf(draft: EventDraft, end: boolean): Wall {
  return end
    ? { date: draft.endDate, time: draft.endTime }
    : { date: draft.startDate, time: draft.startTime };
}

/** Dates: when it starts and ends in its zone; a new start carries the end with it, and Reply by when the start reaches it (sc-3780). */
export function DatesPart({
  event,
  tag,
  now,
  onDirty,
  onClose,
  onSaved,
  onLatest,
  focusStart = 0,
}: PartProps & { now: Date; focusStart?: number }) {
  const { t } = useTranslation();
  const id = useId();
  const replyBy = event.replyBy ?? null;
  const havent = useHavent(event, replyBy != null);
  const [asking, setAsking] = useState(false);
  const saved = draftOf(event);
  const [draft, setDraft] = useState(saved);
  const [zone, setZone] = useState(event.timeZone);
  const [said, setSaid] = useState<string | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const { busy, save, latest } = useSave({ event, tag, onSaved });
  const outcome = useOutcome(onLatest, latest);
  const zones = useMemo(() => timeZoneChoices(event.timeZone, zone), [event.timeZone, zone]);
  const { moveStart, moveEnd } = useStartCarriesEnd({
    draft,
    endChosen: true,
    timeZone: zone,
    edit: (field, change) => {
      setDraft((was) => ({ ...was, ...change }));
      setErrors((was) => ({ ...was, [field]: undefined }));
    },
    say: setSaid,
  });
  const changed =
    draft.startDate !== saved.startDate ||
    draft.startTime !== saved.startTime ||
    draft.endDate !== saved.endDate ||
    draft.endTime !== saved.endTime ||
    zone !== event.timeZone;
  const startSkipped = skippedLine(draft.startDate, draft.startTime, zone, dateLocale(), t);
  const endSkipped = skippedLine(draft.endDate, draft.endTime, zone, dateLocale(), t);
  const endWrong = errors.endsAt ?? null;
  const startWrong = errors.startsAt ?? null;
  const replyMoved = draft.startDate === '' ? null : replyByAfterStart(replyBy, draft.startDate);
  const ask = replyByAsk(replyBy, replyMoved, wallDay(now, zone), havent?.count ?? 1);

  useDirty(changed, onDirty);

  async function send(asked: boolean): Promise<void> {
    const typed = {
      ...typedOf(event),
      draft: { ...draftOf(event), ...pick(draft) },
      timeZone: zone,
    };
    const found = only(eventFormErrors(typed, t), ['startsAt', 'endsAt', 'timeZone']);

    setErrors(found);
    if (Object.keys(found).length > 0) return;
    if (ask != null && !asked) return setAsking(true);

    const saving = await save(typed, null, (saved) =>
      replyMoved == null
        ? undefined
        : replyBySaid(saved.event.replyBy ?? replyMoved, now, saved.event.timeZone, t),
    );

    outcome.took(saving);
    if (saving.kind === 'refused') setErrors(saving.errors);
  }

  return (
    <Opened
      label={t('eventPage.dates')}
      changed={changed}
      refused={outcome.refused}
      busy={busy}
      onLatest={outcome.showLatest}
      onCancel={onClose}
      onSave={() => void send(false)}
    >
      {outcome.failed}
      <DateTime
        legend={t('eventForm.starts')}
        wall={wallOf(draft, false)}
        focus={focusStart}
        wrong={startWrong != null}
        told={
          startWrong != null ? `${id}-start-wrong` : startSkipped != null ? `${id}-skip` : undefined
        }
        onChange={(wall) => {
          setSaid(null);
          moveStart({ startDate: wall.date, startTime: wall.time });
        }}
      />
      {startWrong != null && (
        <p id={`${id}-start-wrong`} className="desk-error" role="alert">
          <Glyph name="alert" size={15} weight={2.2} />
          {startWrong}
        </p>
      )}
      {startSkipped != null && (
        <p id={`${id}-skip`} className="desk-help">
          {startSkipped}
        </p>
      )}
      {asking && ask != null && replyMoved != null && (
        <ReplyByAsk
          asking={ask}
          next={replyMoved}
          havent={havent}
          keep={t('eventEdit.keepEditing')}
          onKeep={() => setAsking(false)}
          onGo={() => {
            setAsking(false);
            void send(true);
          }}
        />
      )}
      {replyMoved != null && replyBy != null && (
        <p className="ev-said" role="status">
          {t('eventReplyBy.startMoves', {
            old: formatWallDay(replyBy, dateLocale()),
            next: formatWallDay(replyMoved, dateLocale()),
          })}
        </p>
      )}
      <DateTime
        legend={t('eventForm.ends')}
        wall={wallOf(draft, true)}
        wrong={endWrong != null}
        told={endWrong != null ? `${id}-wrong` : `${id}-hint`}
        onChange={(wall) => {
          setSaid(null);
          moveEnd({ endDate: wall.date, endTime: wall.time });
        }}
      />
      {endWrong != null ? (
        <p id={`${id}-wrong`} className="desk-error" role="alert">
          <Glyph name="alert" size={15} weight={2.2} />
          {endWrong}
        </p>
      ) : said != null ? (
        <p id={`${id}-hint`} className="ev-said" role="status">
          {said}
        </p>
      ) : (
        <p id={`${id}-hint`} className="desk-help">
          {endSkipped ?? t('eventForm.endsHint')}
        </p>
      )}
      <div className="desk-field">
        <label htmlFor={`${id}-zone`} className="desk-label">
          {t('eventForm.timeZone')}
        </label>
        <div className="desk-box ev-select">
          <select
            id={`${id}-zone`}
            value={zone}
            aria-describedby={`${id}-zone-help`}
            onChange={(change) => setZone(change.target.value)}
          >
            {zones.map((one) => (
              <option key={one.value} value={one.value}>
                {one.label}
              </option>
            ))}
          </select>
          <Glyph name="chevdown" size={18} weight={2.3} />
        </div>
        <p id={`${id}-zone-help`} className="desk-help">
          {errors.timeZone ?? t('eventPage.timesIn', { timeZone: zone })}
        </p>
      </div>
    </Opened>
  );
}

function pick(draft: EventDraft): Partial<EventDraft> {
  const { startDate, startTime, endDate, endTime } = draft;

  return { startDate, startTime, endDate, endTime };
}

/** Venue: its name and address, suggestions from 3 characters, and the zone it is in when that differs. */
export function VenuePart({
  event,
  tag,
  over,
  onDirty,
  onClose,
  onSaved,
  onLatest,
}: PartProps & { over: boolean }) {
  const { t } = useTranslation();
  const id = useId();
  const savedVenue = venueDraftOf(event.venue, event.arrivalNote);
  const [venue, setVenue] = useState(savedVenue);
  const [zone, setZone] = useState(event.timeZone);
  const [errors, setErrors] = useState<Errors>({});
  const [said, setSaid] = useState('');
  const { busy, save, latest } = useSave({ event, tag, onSaved });
  const outcome = useOutcome(onLatest, latest);
  const changed =
    venue.name !== savedVenue.name ||
    venue.address !== savedVenue.address ||
    venue.note !== savedVenue.note ||
    zone !== event.timeZone;

  useDirty(changed, onDirty);

  function refused(found: Errors): void {
    const count = Object.keys(found).length;

    setErrors(found);
    setSaid(count === 0 ? '' : t('eventForm.problems', { count }));
    if (found.arrivalNote != null) document.getElementById(`${id}-note`)?.focus();
  }

  async function send(): Promise<void> {
    const typed = { ...typedOf(event), venue, timeZone: zone };
    const found = only(eventFormErrors(typed, t), ['venueName', 'venueAddress', 'arrivalNote']);

    refused(found);
    if (Object.keys(found).length > 0) return;

    const saving = await save(typed, null);

    outcome.took(saving);
    if (saving.kind === 'refused') refused(saving.errors);
  }

  return (
    <Opened
      label={t('eventPage.venue')}
      changed={changed}
      refused={outcome.refused}
      busy={busy}
      onLatest={outcome.showLatest}
      onCancel={onClose}
      onSave={() => void send()}
    >
      {outcome.failed}
      <VenueFields
        venue={venue}
        errors={errors}
        zone={zone}
        over={over}
        ids={{ name: `${id}-name`, address: id, note: `${id}-note` }}
        onVenue={(change) => {
          setVenue((was) => ({ ...was, ...change }));
          setErrors((was) => ({
            ...was,
            ...('name' in change ? { venueName: undefined } : {}),
            ...('address' in change ? { venueAddress: undefined } : {}),
            ...(change.note != null && !arrivalNoteTooLong(change.note)
              ? { arrivalNote: undefined }
              : {}),
          }));
        }}
        onUseZone={setZone}
      />
      <p className="visually-hidden" role="status">
        {said}
      </p>
    </Opened>
  );
}

/** Hosted by: the names guests read, in order; at most six, never the same twice, and a live event keeps one. */
export function HostsPart({ event, tag, onDirty, onClose, onSaved, onLatest }: PartProps) {
  const { t } = useTranslation();
  const [rows, setRows] = useState<HostRow[]>(() =>
    event.hosts.length === 0
      ? [{ key: 0, name: '' }]
      : event.hosts.map((name, key) => ({ key, name })),
  );
  const [errors, setErrors] = useState<HostErrors>({});
  const focusNext = useRef<string | null>(null);
  const { busy, save, latest } = useSave({ event, tag, onSaved });
  const outcome = useOutcome(onLatest, latest);
  const keep = keepsLastHost(event, rows.length);
  const names = rows.map((row) => row.name);
  const blankOnly = hostsSent(names).every((name) => name === '');
  const changed = hostsChanged(event.hosts, blankOnly ? [] : names);

  useDirty(changed, onDirty);
  useLayoutEffect(() => {
    if (focusNext.current == null) return;
    document.getElementById(focusNext.current)?.focus();
    focusNext.current = null;
  });

  function inputId(row: { key: number }): string {
    return `ev-host-${row.key}`;
  }

  async function send(): Promise<void> {
    const sent = blankOnly && event.status === 'draft' ? [] : rows;
    const found = hostErrorsOf(sent, t);
    const wrong = sent.find((row) => found[row.key] != null);

    setErrors(found);
    if (wrong != null) {
      focusNext.current = inputId(wrong);
      return;
    }

    const saving = await save(typedOf(event), sent);

    outcome.took(saving);
    if (saving.kind === 'refused') {
      setErrors(saving.hosts);
      const first = rows.find((row) => saving.hosts[row.key] != null);
      if (first != null) document.getElementById(inputId(first))?.focus();
    }
  }

  return (
    <Opened
      label={t('eventHosts.heading')}
      changed={changed}
      refused={outcome.refused}
      busy={busy}
      onLatest={outcome.showLatest}
      onCancel={onClose}
      onSave={() => void send()}
    >
      {outcome.failed}
      <HostFields
        rows={rows}
        errors={errors}
        keep={keep}
        inputId={inputId}
        onRows={setRows}
        onEdited={(key) => setErrors((was) => ({ ...was, [key]: undefined }))}
      />
    </Opened>
  );
}

/** Cover: Soirely's cover in the event's own colours, or a photo, its position and what a screen reader says for it. */
export function CoverPart({
  event,
  onDirty,
  onClose,
  onCover,
}: Pick<PartProps, 'event' | 'onDirty' | 'onClose'> & {
  onCover: (event: OrganisationEvent) => void;
}) {
  const { t } = useTranslation();
  const organisationId = event.organisationId;

  async function upload(file: File, shows: boolean): Promise<CoverUploaded> {
    let key: string | null = null;

    try {
      const signed = await api.signEventCoverUpload(organisationId, {
        contentType: coverTypeOf(file) ?? file.type,
        size: file.size,
        filename: file.name,
      });
      await api.uploadTo(signed, file);
      key = signed.key;
      // The server reads every new photo whole, so a damaged JPEG the browser sized is refused here, not saved grey.
      const copy = await api.previewEventCoverUpload(organisationId, signed.key);

      return { key: signed.key, url: shows ? URL.createObjectURL(file) : copy };
    } catch (error) {
      if (key != null) discardCoverUpload(organisationId, key);
      throw new Error(refusalOf(error, t));
    }
  }

  async function save(change: CoverEdited): Promise<OrganisationEvent> {
    try {
      return change.removed
        ? await api.removeEventCover(event.id)
        : await api.setEventCover(event.id, {
            ...(change.upload == null ? {} : { uploadKey: change.upload.key }),
            position: change.position,
            description: change.description,
          });
    } catch (error) {
      throw new Error(
        error instanceof ApiError && error.is('permission_required')
          ? t('eventEdit.forbidden')
          : refusalOf(error, t),
      );
    }
  }

  return (
    <CoverEdit
      mesh={meshFor(event.id)}
      saved={event.cover}
      upload={upload}
      discard={(uploaded) => {
        if (uploaded.url.startsWith('blob:')) URL.revokeObjectURL(uploaded.url);
        discardCoverUpload(organisationId, uploaded.key);
      }}
      save={save}
      onSaved={onCover}
      onDirty={onDirty}
      onClose={onClose}
    />
  );
}
