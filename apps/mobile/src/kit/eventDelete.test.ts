import { ApiError } from '@soirely/api-client';
import { describe, expect, it } from 'vitest';

import { type DeletesEvents, deleteEvent, offersDelete } from './eventDelete.ts';

function recording(fails?: unknown): DeletesEvents & { sent: unknown[][] } {
  const sent: unknown[][] = [];

  return {
    sent,
    deleteEvent: (...args: unknown[]) => {
      sent.push(args);

      return fails === undefined ? Promise.resolve() : Promise.reject(fails);
    },
  };
}

const gala = { id: 'evt_1', name: "Ada's Gala" };

describe('offersDelete', () => {
  it('offers Delete event to a role with events.create', () => {
    expect(offersDelete({ permissions: ['events.read', 'events.create'] })).toBe(true);
  });

  it.each([[{ permissions: ['events.read', 'events.manage'] }], [null]])(
    'offers nothing without events.create',
    (organisation) => {
      expect(offersDelete(organisation)).toBe(false);
    },
  );
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

  it('reads the server refusing the name as the same mismatch', async () => {
    const refused = new ApiError({
      type: 'https://soirely.com/errors/validation_failed',
      title: 'Validation failed',
      status: 422,
      violations: [{ propertyPath: 'name', message: 'No match.', code: 'event_name_mismatch' }],
    });

    expect(await deleteEvent(recording(refused), gala, true, "Ada's Gala")).toEqual({
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
});
