import { ApiError } from '@soirely/api-client';
import { type Translate } from '@soirely/domain';
import { describe, expect, it } from 'vitest';

import {
  type DuplicatesEvents,
  backToOriginal,
  copyHref,
  duplicateEvent,
} from './eventDuplicate.ts';

const t: Translate = (key: string) => key;

function recording(answer: { id: string } | Error): DuplicatesEvents & { sent: unknown[][] } {
  const sent: unknown[][] = [];

  return {
    sent,
    duplicateEvent: (...args: unknown[]) => {
      sent.push(args);

      return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer);
    },
  };
}

describe('duplicateEvent', () => {
  it('sends nothing with no start, and asks for it from the date', async () => {
    const client = recording({ id: 'evt_2' });

    expect(await duplicateEvent(client, 'evt_1', '', '', t)).toEqual({
      kind: 'refused',
      message: 'eventDuplicate.startMissing',
      focus: 'date',
    });
    expect(client.sent).toEqual([]);
  });

  it('sends nothing with a date and no time, and asks for the time', async () => {
    const client = recording({ id: 'evt_2' });

    expect(await duplicateEvent(client, 'evt_1', '2027-05-15', '', t)).toEqual({
      kind: 'refused',
      message: 'eventDuplicate.timeMissing',
      focus: 'time',
    });
    expect(client.sent).toEqual([]);
  });

  it('sends the start on the clock and lands on the copy, knowing its original', async () => {
    const client = recording({ id: 'evt_2' });

    expect(await duplicateEvent(client, 'evt_1', '2027-05-15', '16:00', t)).toEqual({
      kind: 'created',
      href: '/events/evt_2?from=evt_1',
    });
    expect(client.sent).toEqual([['evt_1', '2027-05-15T16:00']]);
  });

  it("shows the API's refusal of the start in its words", async () => {
    const refused = new ApiError({
      type: 'https://soirely.com/errors/validation_failed',
      title: 'Validation failed',
      status: 422,
      violations: [{ propertyPath: 'startsAt', message: 'Not a start.', code: 'invalid' }],
    });

    expect(await duplicateEvent(recording(refused), 'evt_1', '2027-05-15', '16:00', t)).toEqual({
      kind: 'refused',
      message: 'Not a start.',
      focus: 'date',
    });
  });

  it('fails anything else, so the start stays chosen for another try', async () => {
    expect(
      await duplicateEvent(recording(new Error('offline')), 'evt_1', '2027-05-15', '16:00', t),
    ).toEqual({ kind: 'failed' });
  });
});

describe('copyHref', () => {
  it('escapes both ids', () => {
    expect(copyHref('a/b', 'c&d')).toBe('/events/a%2Fb?from=c%26d');
  });
});

describe('backToOriginal', () => {
  it("goes to the original from the copy's own page", () => {
    expect(backToOriginal('evt_2', 'evt_2', 'evt_1')).toBe('evt_1');
  });

  it.each([
    ['opened any other way', 'evt_2', 'evt_2', undefined],
    ['another row chosen beside it', 'evt_2', 'evt_3', 'evt_1'],
    ['the list in front', 'evt_2', null, 'evt_1'],
    ['not opened by a link', null, 'evt_2', 'evt_1'],
  ])('goes to the list with %s', (_case, linked, open, from) => {
    expect(backToOriginal(linked, open, from)).toBeNull();
  });
});
