import { ApiError, type OrganisationEvent } from '@soirely/api-client';
import { eventFormErrors } from '@soirely/domain';
import type { TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';

import {
  blankEvent,
  firstRefused,
  isDirty,
  newEventOf,
  pickedDate,
  pickedTime,
  pickerValue,
  sendOutcome,
  typedOf,
} from './eventForm.ts';

const t = ((key: string, values?: Record<string, unknown>) =>
  values?.most == null ? key : `${key}:${String(values.most)}`) as unknown as TFunction;

const gala: OrganisationEvent = {
  id: 'evt_gala',
  organisationId: 'org_a',
  name: 'Gala',
  type: 'gala',
  status: 'draft',
  startsAt: '2026-11-14T16:00:00+01:00',
  endsAt: '2026-11-14T23:00:00+01:00',
  venue: null,
  timeZone: 'Africa/Lagos',
  dayCount: 1,
  currency: 'NGN',
  cover: null,
  hosts: ['Funmi Adeyemi'],
  madeLiveAt: null,
  phase: 'draft',
  concludedAt: null,
  createdAt: '2026-10-01T09:00:00Z',
};

function refusal(
  status: number,
  code: string,
  violations: { propertyPath: string; message: string; code: string }[] = [],
): ApiError {
  const problem = { type: `https://soirely.com/errors/${code}`, title: 'No.', status, violations };

  return new ApiError(problem, new Response(JSON.stringify(problem), { status }));
}

describe('the app event form against the shared rules (sc-3595)', () => {
  it("starts a new event in the organisation's zone and currency", () => {
    expect(blankEvent({ timezone: 'Africa/Lagos', currency: 'NGN' })).toMatchObject({
      timeZone: 'Africa/Lagos',
      currency: 'NGN',
      draft: { name: '', type: '' },
    });
  });

  it("says the web's messages, and focuses the first refused field", () => {
    const errors = eventFormErrors(blankEvent({ timezone: 'Africa/Lagos', currency: 'XXX' }), t);

    expect(errors).toEqual({
      name: 'eventForm.nameBlank:120',
      type: 'eventForm.typeMissing:120',
      startsAt: 'eventForm.startMissing:120',
      endsAt: 'eventForm.endMissing:120',
      currency: 'orgGeneral.currencyBlank',
    });
    expect(firstRefused(errors)).toBe('name');
    expect(firstRefused({ currency: 'x', endsAt: 'y' })).toBe('endsAt');
  });

  it('passes an opened event as it was saved, and sends a new one in the API terms', () => {
    const typed = typedOf(gala);

    expect(typed.draft).toMatchObject({ startDate: '2026-11-14', startTime: '16:00' });
    expect(eventFormErrors(typed, t)).toEqual({});
    expect(newEventOf({ ...typed, draft: { ...typed.draft, name: ' Gala ' } })).toEqual({
      name: 'Gala',
      type: 'gala',
      startsAt: '2026-11-14T16:00',
      endsAt: '2026-11-14T23:00',
      timeZone: 'Africa/Lagos',
      currency: 'NGN',
    });
  });

  it('is unchanged once typed back to what it was', () => {
    const typed = typedOf(gala);
    const renamed = { ...typed, draft: { ...typed.draft, name: 'Ball' } };

    expect(isDirty(renamed, typed)).toBe(true);
    expect(isDirty({ ...renamed, draft: { ...renamed.draft, name: 'Gala' } }, typed)).toBe(false);
  });
});

describe('a create or save the API refuses', () => {
  it("puts a Finished event's schedule refusal on the start (sc-3585)", () => {
    expect(sendOutcome(refusal(409, 'event_concluded'), t)).toEqual({
      kind: 'refused',
      errors: { startsAt: 'eventEdit.scheduleConcluded' },
    });
  });

  it('is changed elsewhere on 412', () => {
    expect(sendOutcome(refusal(412, 'precondition_failed'), t)).toEqual({
      kind: 'changedElsewhere',
    });
  });

  it('is a failure on 428, a dropped connection, and a refusal naming no field', () => {
    expect(sendOutcome(refusal(428, 'precondition_required'), t)).toEqual({ kind: 'failed' });
    expect(sendOutcome(new TypeError('Network request failed'), t)).toEqual({ kind: 'failed' });
    expect(sendOutcome(refusal(422, 'validation_failed'), t)).toEqual({ kind: 'failed' });
  });

  it('puts what the API names under its field', () => {
    expect(
      sendOutcome(
        refusal(422, 'validation_failed', [
          { propertyPath: 'endsAt', message: 'Too early.', code: 'x' },
        ]),
        t,
      ),
    ).toEqual({ kind: 'refused', errors: { endsAt: 'Too early.' } });
    expect(sendOutcome(refusal(409, 'event_currency_in_use'), t)).toEqual({
      kind: 'refused',
      errors: { currency: 'eventEdit.currencyInUse' },
    });
  });
});

describe('the platform pickers', () => {
  it('hold the wall clock whatever zone the device is in', () => {
    const picked = pickerValue('2027-03-28', '02:30', new Date('2026-01-01T00:00:00Z'));

    expect(pickedDate(picked)).toBe('2027-03-28');
    expect(pickedTime(picked)).toBe('02:30');
  });

  it('open on today at noon while nothing is chosen', () => {
    const picked = pickerValue('', '', new Date('2026-10-26T08:15:00Z'));

    expect([pickedDate(picked), pickedTime(picked)]).toEqual(['2026-10-26', '12:00']);
  });
});
