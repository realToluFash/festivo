import { ApiError } from '@soirely/api-client';
import { describe, expect, it } from 'vitest';

import { type DeletesEvents, deleteEvent, offersDelete, refusedVerb } from './eventDelete.ts';

function recording(
  fails?: unknown,
  reread: () => Promise<{ name: string }> = () => Promise.resolve(gala),
): DeletesEvents & { sent: unknown[][] } {
  const sent: unknown[][] = [];

  return {
    sent,
    deleteEvent: (...args: unknown[]) => {
      sent.push(args);

      return fails === undefined ? Promise.resolve() : Promise.reject(fails);
    },
    event: reread,
  };
}

const refused = new ApiError({
  type: 'https://soirely.com/errors/validation_failed',
  title: 'Validation failed',
  status: 422,
  violations: [{ propertyPath: 'name', message: 'No match.', code: 'event_name_mismatch' }],
});

const gala = { id: 'evt_1', name: "Ada's Gala" };

describe('offersDelete', () => {
  it('offers Delete event to a role with events.create on the event', () => {
    expect(offersDelete({ permissions: ['events.read', 'events.create'] })).toBe(true);
  });

  it.each([[{ permissions: ['events.read', 'events.manage'] }], [null]])(
    'offers nothing without events.create',
    (event) => {
      expect(offersDelete(event)).toBe(false);
    },
  );
});

describe('refusedVerb (sc-14445)', () => {
  const wedding = { startsAt: '2030-06-01T16:00:00Z' };

  it('opens on Call off a second before the start, and on End now at it', () => {
    expect(refusedVerb(wedding, 'live', new Date('2030-06-01T15:59:59Z'), true)).toBe('callOff');
    expect(refusedVerb(wedding, 'happening_now', new Date('2030-06-01T16:00:00Z'), true)).toBe(
      'endNow',
    );
  });

  it('refuses a Paused event as a Live one', () => {
    expect(refusedVerb(wedding, 'paused', new Date('2030-05-01T00:00:00Z'), true)).toBe('callOff');
  });

  it.each([
    ['a Finished event, its page left open past the end', 'finished', true],
    ['a Draft', 'draft', true],
    ['an event with nobody Invited', 'live', false],
  ] as const)('opens on the delete for %s', (_, phase, refused) => {
    expect(refusedVerb(wedding, phase, new Date('2030-06-02T00:00:00Z'), refused)).toBeNull();
  });
});

describe('deleteEvent', () => {
  it('sends a Draft with no name, and answers deleted', async () => {
    const client = recording();

    expect(await deleteEvent(client, gala, false, '')).toEqual({ kind: 'deleted' });
    expect(client.sent).toEqual([['evt_1']]);
  });

  it('sends nothing for a name that does not match', async () => {
    const client = recording();

    expect(await deleteEvent(client, gala, true, 'Ada Gala')).toEqual({
      kind: 'mismatch',
      typed: 'Ada Gala',
    });
    expect(client.sent).toEqual([]);
  });

  it('deletes with a curly apostrophe typed for a straight one', async () => {
    const client = recording();

    expect(await deleteEvent(client, gala, true, 'Ada’s Gala')).toEqual({ kind: 'deleted' });
    expect(client.sent).toEqual([['evt_1', 'Ada’s Gala']]);
  });

  it('refuses the name in the wrong case', async () => {
    const client = recording();

    expect(await deleteEvent(client, gala, true, "ada's gala")).toEqual({
      kind: 'mismatch',
      typed: "ada's gala",
    });
    expect(client.sent).toEqual([]);
  });

  it('reads the server refusing the name as a mismatch with the name it rereads', async () => {
    expect(await deleteEvent(recording(refused), gala, true, "Ada's Gala")).toEqual({
      kind: 'mismatch',
      typed: "Ada's Gala",
      current: "Ada's Gala",
    });
  });

  it('answers a refusal after a rename with the event’s current name', async () => {
    const renamed = recording(refused, () => Promise.resolve({ name: 'Ada at Sixty' }));

    expect(await deleteEvent(renamed, gala, true, "Ada's Gala")).toEqual({
      kind: 'mismatch',
      typed: "Ada's Gala",
      current: 'Ada at Sixty',
    });
  });

  it('keeps the name it has when the event cannot be reread', async () => {
    const unread = recording(refused, () => Promise.reject(new Error('offline')));

    expect(await deleteEvent(unread, gala, true, "Ada's Gala")).toEqual({
      kind: 'mismatch',
      typed: "Ada's Gala",
    });
  });

  it('keeps the typed name when the server fails', async () => {
    const offline = new Error('offline');

    expect(await deleteEvent(recording(offline), gala, true, "Ada's Gala")).toEqual({
      kind: 'failed',
      typed: "Ada's Gala",
      error: offline,
    });
  });

  it('answers refused, never the detail, when a guest was Invited since the screen opened (sc-14445)', async () => {
    const client = recording(
      new ApiError({
        type: 'https://soirely.com/errors/event_call_off_first',
        title: 'This event cannot be deleted until it is finished.',
        detail:
          'Guests have been invited to it, or staff briefed for it. Call it off or end it first.',
        status: 409,
      }),
    );

    expect(await deleteEvent(client, gala, true, "Ada's Gala")).toEqual({ kind: 'refused' });
  });
});
