import { ApiError } from '@soirely/api-client';
import { describe, expect, it } from 'vitest';

import { type Translate } from './eventWords.ts';
import {
  type HostRow,
  eventSaveRefusal,
  firstRefusedOf,
  hostErrorsOf,
  hostRefusalsOf,
  hostRequiredOf,
  hostsArrival,
  movedHost,
  removedHost,
} from './hostWords.ts';

const t: Translate = (key: string, values?: Record<string, string | number>) =>
  values == null ? key : `${key} ${JSON.stringify(values)}`;

const rows = (...names: string[]): HostRow[] => names.map((name, key) => ({ key, name }));

describe('Hosted by on both clients (sc-6713, sc-15497)', () => {
  it('refuses an empty name, a long one with its own count, and a repeat naming the earlier as typed', () => {
    const long = 'é'.repeat(66);

    expect(hostErrorsOf(rows('  ', long, ' Funmi Adeyemi', 'funmi adeyemi\n'), t)).toEqual({
      0: 'eventHosts.blank',
      1: 'eventHosts.tooLong {"most":60,"length":66}',
      3: 'eventHosts.duplicate {"name":"Funmi Adeyemi"}',
    });
    expect(hostErrorsOf(rows('a'.repeat(60), 'Tayo\r\nAdeyemi'), t)).toEqual({});
  });

  it("puts the server's refusal of one name under its row, and of the whole list under the last", () => {
    const hosts: HostRow[] = [
      { key: 7, name: 'Funmi' },
      { key: 3, name: 'Tayo' },
    ];

    expect(hostRefusalsOf({ 'hosts[1]': 'Not this one.', endsAt: 'Too early.' }, hosts)).toEqual({
      3: 'Not this one.',
    });
    expect(hostRefusalsOf({ hosts: 'Six.' }, hosts)).toEqual({ 3: 'Six.' });
    expect(hostRefusalsOf({ 'hosts[4]': 'Gone.' }, hosts)).toEqual({});
    expect(hostRequiredOf(hosts, t)).toEqual({ 7: 'eventHosts.lastHostRefused' });
    expect(hostRequiredOf([], t)).toBeNull();
  });

  it('focuses the name and type first, then the hosts top to bottom, then the rest', () => {
    const hosts = rows('', 'Tayo', '');

    expect(firstRefusedOf({ startsAt: 'x' }, { 2: 'y', 0: 'z' }, hosts)).toEqual({ host: 0 });
    expect(firstRefusedOf({ type: 'x', startsAt: 'x' }, { 0: 'z' }, hosts)).toEqual({
      field: 'type',
    });
    expect(firstRefusedOf({ endsAt: 'x' }, {}, hosts)).toEqual({ field: 'endsAt' });
    expect(firstRefusedOf({}, {}, hosts)).toBeNull();
  });
});

describe('moving and removing a host (sc-15497)', () => {
  it('moves a row, keeps focus on the pressed arrow, and says where it went', () => {
    expect(movedHost(rows('Funmi', 'Tayo', 'Bisi'), 2, -1, t)).toEqual({
      rows: [
        { key: 0, name: 'Funmi' },
        { key: 2, name: 'Bisi' },
        { key: 1, name: 'Tayo' },
      ],
      focus: { key: 2, control: 'up' },
      said: 'eventHosts.moved {"name":"Bisi","position":2,"count":3}',
    });
  });

  it('moves focus to the other arrow once a row reaches the top or the bottom', () => {
    expect(movedHost(rows('Funmi', 'Tayo'), 1, -1, t)?.focus).toEqual({
      key: 1,
      control: 'down',
    });
    expect(movedHost(rows('Funmi', 'Tayo'), 0, 1, t)?.focus).toEqual({ key: 0, control: 'up' });
    expect(movedHost(rows('Funmi'), 0, -1, t)).toBeNull();
  });

  it("removes a row, focusing the next row's name, else Add a host, and names an empty one by position", () => {
    expect(removedHost(rows('Funmi', '', 'Bisi'), 1, t)).toEqual({
      rows: [
        { key: 0, name: 'Funmi' },
        { key: 2, name: 'Bisi' },
      ],
      focus: { key: 2, control: 'name' },
      said: 'eventHosts.removed {"name":"eventHosts.label {\\"position\\":2}"}',
    });
    expect(removedHost(rows('Funmi'), 0, t)?.focus).toBe('add');
  });

  it("arrives from Add who is hosting at the first host's name, else Add a host", () => {
    expect(hostsArrival(rows('Funmi', 'Tayo'))).toEqual({ key: 0, control: 'name' });
    expect(hostsArrival([])).toBe('add');
  });
});

function problem(status: number, code: string, violations?: unknown[]): ApiError {
  return new ApiError({
    type: `https://soirely.com/errors/${code}`,
    title: code,
    status,
    ...(violations == null ? {} : { violations }),
  } as ConstructorParameters<typeof ApiError>[0]);
}

describe('A refused save of an event, read once for Edit details and the parts edited in place (sc-30413)', () => {
  it('reads a 412 as changed elsewhere, and anything not from the API as failed', () => {
    expect(eventSaveRefusal(problem(412, 'precondition_failed'), [], t)).toEqual({
      kind: 'changed',
    });
    expect(eventSaveRefusal(new Error('offline'), [], t)).toEqual({ kind: 'failed' });
    expect(eventSaveRefusal(problem(500, 'server_error'), [], t)).toEqual({ kind: 'failed' });
  });

  it('puts a concluded schedule under Starts, and says a currency in use', () => {
    expect(eventSaveRefusal(problem(409, 'event_concluded'), [], t)).toEqual({
      kind: 'refused',
      errors: { startsAt: 'eventEdit.scheduleConcluded' },
      hosts: {},
      currencyInUse: false,
    });
    expect(eventSaveRefusal(problem(409, 'event_currency_in_use'), [], t)).toEqual({
      kind: 'refused',
      errors: {},
      hosts: {},
      currencyInUse: true,
    });
  });

  it('puts the last host refused under the first row, and is failed with no rows to put it under', () => {
    expect(eventSaveRefusal(problem(409, 'event_host_required'), rows('Funmi'), t)).toEqual({
      kind: 'refused',
      errors: {},
      hosts: { 0: 'eventHosts.lastHostRefused' },
      currencyInUse: false,
    });
    expect(eventSaveRefusal(problem(409, 'event_host_required'), [], t)).toEqual({
      kind: 'failed',
    });
  });

  it('keeps the form’s fields and host rows a 422 names, and is failed when it names none of them', () => {
    const refused = problem(422, 'validation_failed', [
      { propertyPath: 'name', message: 'Too long.' },
      { propertyPath: 'hosts[1]', message: 'Blank.' },
      { propertyPath: 'organisationId', message: 'Not yours.' },
    ]);

    expect(eventSaveRefusal(refused, rows('Funmi', ' '), t)).toEqual({
      kind: 'refused',
      errors: { name: 'Too long.' },
      hosts: { 1: 'Blank.' },
      currencyInUse: false,
    });
    expect(
      eventSaveRefusal(
        problem(422, 'validation_failed', [{ propertyPath: 'organisationId', message: 'No.' }]),
        [],
        t,
      ),
    ).toEqual({ kind: 'failed' });
  });
});
