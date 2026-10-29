import {
  ApiError,
  type EventChanges,
  type NewEvent,
  type OrganisationEvent,
} from '@soirely/api-client';
import {
  CURRENCY_CODES,
  EVENT_FORM_FIELDS,
  type EventDraft,
  type EventFormField,
  type HostErrors,
  type HostRow,
  type VenueDraft,
  draftOf,
  eventChanges,
  eventNameOf,
  hostRefusalsOf,
  hostRequiredOf,
  hostsChanged,
  hostsSent,
  localDateTime,
  venueDraftOf,
  venueSent,
} from '@soirely/domain';
import { type TFunction } from 'i18next';

export type EventErrors = Partial<Record<EventFormField, string>>;

export interface EventTyped {
  draft: EventDraft;
  venue: VenueDraft;
  timeZone: string;
  currency: string;
  hosts: HostRow[];
}

/** A new event starts from the organisation's zone and currency, as the web's does (sc-1486). */
export function blankEvent(organisation: { timezone: string; currency: string }): EventTyped {
  return {
    draft: { name: '', type: '', startDate: '', startTime: '', endDate: '', endTime: '' },
    venue: venueDraftOf(null),
    timeZone: organisation.timezone,
    currency: CURRENCY_CODES.includes(organisation.currency) ? organisation.currency : '',
    hosts: [],
  };
}

export function typedOf(event: OrganisationEvent): EventTyped {
  return {
    draft: draftOf(event),
    venue: venueDraftOf(event.venue),
    timeZone: event.timeZone,
    currency: event.currency,
    hosts: event.hosts.map((name, key) => ({ key, name })),
  };
}

export function firstRefused(errors: EventErrors): EventFormField | null {
  return EVENT_FORM_FIELDS.find((field) => errors[field] != null) ?? null;
}

/** What Save changes sends: the details that changed, and the whole list of hosts when it did. */
export function changesOf(saved: OrganisationEvent, typed: EventTyped): EventChanges {
  const names = typed.hosts.map((row) => row.name);

  return {
    ...eventChanges(saved, typed),
    ...(hostsChanged(saved.hosts, names) ? { hosts: hostsSent(names) } : {}),
  };
}

export function newEventOf(typed: EventTyped): NewEvent | null {
  const { draft, venue, timeZone, currency } = typed;

  if (draft.type === '') return null;

  const sent = venueSent(venue);

  return {
    name: eventNameOf(draft.name),
    type: draft.type,
    startsAt: localDateTime(draft.startDate, draft.startTime) ?? '',
    endsAt: localDateTime(draft.endDate, draft.endTime) ?? '',
    timeZone,
    currency,
    ...(sent == null ? {} : { venue: sent }),
  };
}

/** Typed back to what it was is not a change, so it leaves without asking. */
export function isDirty(typed: EventTyped, from: EventTyped): boolean {
  return JSON.stringify(typed) !== JSON.stringify(from);
}

export type SendOutcome =
  | { kind: 'refused'; errors: EventErrors; hosts?: HostErrors }
  | { kind: 'changedElsewhere' }
  | { kind: 'failed' };

/** What a refused create or save means for the form; 428 is a failure, as on the web (sc-3587). A refused name goes under its row. */
export function sendOutcome(
  error: unknown,
  t: TFunction,
  hosts: readonly HostRow[] = [],
): SendOutcome {
  if (!(error instanceof ApiError)) return { kind: 'failed' };
  if (error.status === 412) return { kind: 'changedElsewhere' };
  if (error.is('event_currency_in_use'))
    return { kind: 'refused', errors: { currency: t('eventEdit.currencyInUse') } };
  if (error.is('event_concluded'))
    return { kind: 'refused', errors: { startsAt: t('eventEdit.scheduleConcluded') } };
  const hostRequired = error.is('event_host_required') ? hostRequiredOf(hosts, t) : null;
  if (hostRequired != null) return { kind: 'refused', errors: {}, hosts: hostRequired };

  if (error.status === 422) {
    const named = error.fieldErrors();
    const errors: EventErrors = {};
    for (const field of EVENT_FORM_FIELDS) if (named[field] != null) errors[field] = named[field];

    const hostErrors = hostRefusalsOf(named, hosts);

    if (Object.keys(hostErrors).length > 0) return { kind: 'refused', errors, hosts: hostErrors };
    if (Object.keys(errors).length > 0) return { kind: 'refused', errors };
  }

  return { kind: 'failed' };
}

/** The pickers' value: the wall-clock moment read as UTC, so the device's own zone never moves it. */
export function pickerValue(date: string, time: string, fallback: Date): Date {
  const typed = localDateTime(date || fallback.toISOString().slice(0, 10), time || '12:00');
  const read = Date.parse(`${typed}:00Z`);

  return Number.isNaN(read) ? fallback : new Date(read);
}

export function pickedDate(picked: Date): string {
  return picked.toISOString().slice(0, 10);
}

export function pickedTime(picked: Date): string {
  return picked.toISOString().slice(11, 16);
}
