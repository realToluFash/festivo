import { type OrganisationEvent, type TaggedEvent } from '@soirely/api-client';
import {
  EVENT_NAME_MAXIMUM,
  HOSTS_MAXIMUM,
  NOTHING_SEEN,
  type EventDraft,
  type EventSaveRefusal,
  type EventFormField,
  type EventType,
  type HostErrors,
  type HostRow,
  type VenueDraft,
  addressLookup,
  draftOf,
  eventChanges,
  eventSaveRefusal,
  eventFormErrors,
  eventNameLength,
  hostCalled,
  hostErrorsOf,
  hostsChanged,
  hostsSent,
  keepsLastHost,
  movedHost,
  removedHost,
  skippedLine,
  venueDraftOf,
} from '@soirely/domain';
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../../../api.ts';
import { useComboboxKeys } from '../../../comboboxKeys.ts';
import {
  Alert,
  Broken,
  DateTime,
  EditText,
  Opened,
  Quiet,
  Radios,
  type Wall,
} from '../../../components/EventPageParts.tsx';
import { Glyph } from '../../../components/Glyph.tsx';
import { RowWords, TextAction } from '../../../components/SettingsParts.tsx';
import { currentLocale, dateLocale } from '../../../i18n/index.ts';
import { currencyChoices, timeZoneChoices } from '../../../zoneAndCurrencyChoices.ts';
import { CoverSection } from './CoverSection.tsx';
import { typeChoices } from './eventTypes.ts';
import { useStartCarriesEnd } from './useStartCarriesEnd.ts';

export type Part = 'name' | 'dates' | 'venue' | 'hosts' | 'type' | 'currency' | 'cover';

export interface PartProps {
  event: OrganisationEvent;
  tag: string;
  onDirty: (dirty: boolean) => void;
  onClose: () => void;
  onSaved: (saved: TaggedEvent) => void;
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
    venue: venueDraftOf(event.venue),
  };
}

/** One part's save, as Edit details saves the whole form: only what changed, against the tag read, and the API's refusals mapped back to the fields. */
function useSave({ event, tag, onSaved }: Pick<PartProps, 'event' | 'tag' | 'onSaved'>) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  async function save(typed: Typed, hosts: readonly HostRow[] | null): Promise<Saving> {
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
      onSaved(saved);

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

/** The notice a save that failed for no reason the part can show leaves, and Changed elsewhere's way to the latest. */
function useOutcome(onLatest: PartProps['onLatest'], latest: ReturnType<typeof useSave>['latest']) {
  const { t } = useTranslation();
  const [outcome, setOutcome] = useState<'changed' | 'failed' | null>(null);

  return {
    refused: outcome === 'changed',
    failed: outcome === 'failed' ? <Broken>{t('eventEdit.notSaved')}</Broken> : null,
    took(saving: Saving): void {
      setOutcome(saving.kind === 'changed' || saving.kind === 'failed' ? saving.kind : null);
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

/** Dates: when it starts and ends in its zone; a new start carries the end with it. */
export function DatesPart({ event, tag, onDirty, onClose, onSaved, onLatest }: PartProps) {
  const { t } = useTranslation();
  const id = useId();
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

  useDirty(changed, onDirty);

  async function send(): Promise<void> {
    const typed = {
      ...typedOf(event),
      draft: { ...draftOf(event), ...pick(draft) },
      timeZone: zone,
    };
    const found = only(eventFormErrors(typed, t), ['startsAt', 'endsAt', 'timeZone']);

    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const saving = await save(typed, null);

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
      onSave={() => void send()}
    >
      {outcome.failed}
      <DateTime
        legend={t('eventForm.starts')}
        wall={wallOf(draft, false)}
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
  const savedVenue = venueDraftOf(event.venue);
  const [venue, setVenue] = useState(savedVenue);
  const [zone, setZone] = useState(event.timeZone);
  const [zoneSet, setZoneSet] = useState<string | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [seen, setSeen] = useState(NOTHING_SEEN);
  const field = useRef<HTMLInputElement>(null);
  const { busy, save, latest } = useSave({ event, tag, onSaved });
  const outcome = useOutcome(onLatest, latest);
  const [lookup] = useState(() =>
    addressLookup({
      suggest: (query) => api.addressSuggestions(query),
      resolve: (address) => api.address(address),
      onVenue: (change) => setVenue((was) => ({ ...was, ...change })),
      onSeen: setSeen,
    }),
  );
  const { suggestions, down } = seen;
  const { active, setActive, onKeyDown } = useComboboxKeys({
    count: suggestions.length,
    onPick: (index) => {
      const chosen = suggestions[index];
      if (chosen != null) void lookup.pick(chosen, zone);
    },
    onEscape: () => lookup.dismiss(),
  });
  const offer = seen.offered != null && seen.offered.zone !== zone && !over ? seen.offered : null;
  const changed =
    venue.name !== savedVenue.name ||
    venue.address !== savedVenue.address ||
    zone !== event.timeZone;

  useDirty(changed, onDirty);
  useEffect(() => () => lookup.stop(), [lookup]);

  async function send(): Promise<void> {
    const typed = { ...typedOf(event), venue, timeZone: zone };
    const found = only(eventFormErrors(typed, t), ['venueName', 'venueAddress']);

    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const saving = await save(typed, null);

    outcome.took(saving);
    if (saving.kind === 'refused') setErrors(saving.errors);
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
      <EditText
        label={t('eventForm.venueName')}
        optional
        value={venue.name}
        error={errors.venueName ?? null}
        input={{ autoComplete: 'off' }}
        onChange={(name) => {
          setVenue((was) => ({ ...was, name }));
          setErrors((was) => ({ ...was, venueName: undefined }));
        }}
      />
      <div className="desk-field ev-combo">
        <label htmlFor={id} className="desk-label">
          {t('eventForm.venueAddress')}
          <span className="ev-optional">{` · ${t('eventForm.optional')}`}</span>
        </label>
        <div className={errors.venueAddress == null ? 'desk-box' : 'desk-box is-wrong'}>
          <input
            ref={field}
            id={id}
            type="text"
            role="combobox"
            value={venue.address}
            spellCheck={false}
            autoComplete="off"
            aria-autocomplete="list"
            aria-expanded={suggestions.length > 0}
            aria-controls={suggestions.length > 0 ? `${id}-list` : undefined}
            aria-activedescendant={active >= 0 ? `${id}-option-${active}` : undefined}
            aria-invalid={errors.venueAddress != null}
            aria-describedby={`${id}-help`}
            onChange={(change) => {
              setActive(-1);
              setZoneSet(null);
              setErrors((was) => ({ ...was, venueAddress: undefined }));
              lookup.type(change.target.value);
            }}
            onKeyDown={onKeyDown}
            onBlur={() => lookup.dismiss()}
          />
        </div>
        {errors.venueAddress != null && <Alert>{errors.venueAddress}</Alert>}
        {down ? (
          <Alert>{t('eventForm.venueLookupDown')}</Alert>
        ) : suggestions.length > 0 ? (
          <p id={`${id}-help`} className="desk-help" role="status">
            {t('eventForm.venueSuggestionsFound', { count: suggestions.length })}
          </p>
        ) : (
          <p id={`${id}-help`} className="desk-help">
            {t('eventForm.venueAddressHint')}
          </p>
        )}
        {suggestions.length > 0 && (
          <ul
            id={`${id}-list`}
            className="desk-rows ev-options"
            role="listbox"
            aria-label={t('eventForm.venueSuggestions')}
          >
            {suggestions.map((one, index) => (
              <li
                key={one.id}
                id={`${id}-option-${index}`}
                role="option"
                aria-selected={index === active}
                className={index === active ? 'desk-row ev-option is-active' : 'desk-row ev-option'}
                onPointerDown={(pointer) => pointer.preventDefault()}
                onClick={() => void lookup.pick(one, zone)}
                onKeyDown={(key) => {
                  if (key.key === 'Enter') void lookup.pick(one, zone);
                }}
              >
                <Glyph name="pin" size={20} />
                <RowWords
                  title={one.text}
                  lines={one.secondaryText == null ? [] : [one.secondaryText]}
                />
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
                label={t('eventForm.venueZoneUse', { zone: offer.zone })}
                onClick={() => {
                  setZone(offer.zone);
                  setZoneSet(offer.zone);
                  lookup.answered();
                  field.current?.focus();
                }}
              />
              <TextAction
                label={t('eventForm.venueZoneKeep', { zone: offer.keep })}
                onClick={() => {
                  lookup.answered();
                  field.current?.focus();
                }}
              />
            </div>
          }
        >
          {t('eventForm.venueZoneOffer', { zone: offer.zone })}
        </Quiet>
      )}
      {zoneSet != null && (
        <p className="ev-said" role="status">
          {t('eventForm.venueZoneSet', { zone: zoneSet })}
        </p>
      )}
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
  const [said, setSaid] = useState('');
  const nextKey = useRef(Math.max(0, event.hosts.length) + 1);
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

  function inputId(row: HostRow): string {
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
      <p className="desk-line">{t('eventHosts.explainer')}</p>
      <ol className="ev-hosts">
        {rows.map((row, index) => {
          const error = errors[row.key] ?? null;
          const alone = rows.length === 1;
          const called = hostCalled(row, index, t);

          return (
            <li key={row.key} className="ev-host">
              <div className="ev-host-head">
                <label htmlFor={inputId(row)} className="desk-label">
                  {t('eventHosts.label', { position: index + 1 })}
                </label>
                {!(alone && keep) && (
                  <button
                    type="button"
                    className="desk-text"
                    aria-label={t('eventHosts.removeNamed', { name: called })}
                    onClick={() => {
                      const change = alone ? null : removedHost(rows, index, t);

                      if (change == null) {
                        setRows([{ key: nextKey.current++, name: '' }]);
                        setSaid(t('eventHosts.removed', { name: called }));
                      } else {
                        setRows(change.rows);
                        setSaid(change.said);
                      }
                      const before = rows[Math.max(0, index - 1)];
                      focusNext.current =
                        alone || before == null
                          ? null
                          : inputId(index === 0 ? (rows[1] ?? before) : before);
                    }}
                  >
                    {t('eventHosts.remove')}
                  </button>
                )}
              </div>
              <div className="ev-host-line">
                <div className={error == null ? 'desk-box' : 'desk-box is-wrong'}>
                  <input
                    id={inputId(row)}
                    type="text"
                    value={row.name}
                    spellCheck={false}
                    autoComplete="off"
                    aria-invalid={error != null}
                    aria-describedby={error == null ? undefined : `${inputId(row)}-error`}
                    onChange={(change) => {
                      setRows(
                        rows.map((one) =>
                          one.key === row.key ? { ...one, name: change.target.value } : one,
                        ),
                      );
                      setErrors((was) => ({ ...was, [row.key]: undefined }));
                    }}
                  />
                </div>
                {!alone && (
                  <>
                    <button
                      type="button"
                      className="ev-round"
                      aria-label={t('eventHosts.moveUp', { name: called })}
                      aria-disabled={index === 0}
                      onClick={() => {
                        const change = index > 0 ? movedHost(rows, index, -1, t) : null;
                        if (change == null) return;
                        setRows(change.rows);
                        setSaid(change.said);
                      }}
                    >
                      <Glyph name="chevup" size={18} weight={2.4} />
                    </button>
                    <button
                      type="button"
                      className="ev-round"
                      aria-label={t('eventHosts.moveDown', { name: called })}
                      aria-disabled={index === rows.length - 1}
                      onClick={() => {
                        const change =
                          index < rows.length - 1 ? movedHost(rows, index, 1, t) : null;
                        if (change == null) return;
                        setRows(change.rows);
                        setSaid(change.said);
                      }}
                    >
                      <Glyph name="chevdown" size={18} weight={2.4} />
                    </button>
                  </>
                )}
              </div>
              {error != null && (
                <p id={`${inputId(row)}-error`} className="desk-error">
                  <Glyph name="alert" size={15} weight={2.2} />
                  {error}
                </p>
              )}
            </li>
          );
        })}
      </ol>
      {rows.length === 1 && keep && <p className="desk-note">{t('eventHosts.lastHost')}</p>}
      {rows.length >= HOSTS_MAXIMUM ? (
        <p className="desk-note">{t('eventHosts.most', { most: HOSTS_MAXIMUM })}</p>
      ) : (
        <TextAction
          label={t('eventHosts.add')}
          before="plus"
          onClick={() => {
            const key = nextKey.current++;
            setRows([...rows, { key, name: '' }]);
            focusNext.current = inputId({ key, name: '' });
          }}
        />
      )}
      <p className="desk-unseen" role="status">
        {said}
      </p>
    </Opened>
  );
}

/** Cover: the product's cover and its Cover photo dialog, which save as they are used, so Close is all this edit needs. */
export function CoverPart({
  event,
  onClose,
  onCover,
}: Pick<PartProps, 'event' | 'onClose'> & { onCover: (event: OrganisationEvent) => void }) {
  const { t } = useTranslation();

  return (
    <div className="ev-opened" role="group" aria-label={t('eventCover.heading')}>
      <CoverSection
        type={event.type}
        photo={event.cover}
        organisationId={event.organisationId}
        onUse={async ({ upload, position, description }) =>
          onCover(
            await api.setEventCover(event.id, {
              ...(upload == null ? {} : { uploadKey: upload.key }),
              position,
              description,
            }),
          )
        }
        onRemove={async () => onCover(await api.removeEventCover(event.id))}
      />
      <div className="ev-opened-actions">
        <TextAction label={t('eventCover.close')} onClick={onClose} />
      </div>
    </div>
  );
}
