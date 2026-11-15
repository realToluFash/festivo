import { ApiError, type EventChanges, type OrganisationEvent } from '@soirely/api-client';
import type { TFunction } from 'i18next';
import { describe, expect, it, vi } from 'vitest';

import { heldRead, partChangedElsewhere, sendPart } from './partSave.ts';

const t = ((key: string) => key) as unknown as TFunction;

const gala: OrganisationEvent = {
  id: 'evt_gala',
  organisationId: 'org_a',
  name: 'Gala',
  type: 'gala',
  status: 'draft',
  startsAt: '2026-11-14T16:00:00+01:00',
  endsAt: '2026-11-14T23:00:00+01:00',
  venue: null,
  arrivalNote: null,
  timeZone: 'Africa/Lagos',
  dayCount: 1,
  currency: 'NGN',
  cover: null,
  hosts: ['Funmi Adeyemi'],
  madeLiveAt: null,
  pausedAt: null,
  phase: 'draft',
  concludedAt: null,
  createdAt: '2026-10-01T09:00:00Z',
  permissions: [],
};

function refusal(status: number, code: string): ApiError {
  const problem = { type: `https://soirely.com/errors/${code}`, title: 'No.', status };

  return new ApiError(problem, new Response(JSON.stringify(problem), { status }));
}

function saving(read: OrganisationEvent = gala, sent: Promise<unknown> = Promise.resolve()) {
  const updateEvent = vi.fn(async (_id: string, changes: EventChanges, tag: string) => {
    await sent;
    return { event: { ...read, ...changes } as OrganisationEvent, tag };
  });

  return {
    updateEvent,
    send: (changes: EventChanges, part: 'name' | 'venue' = 'name') =>
      sendPart(
        {
          api: { updateEvent },
          part,
          shown: gala,
          changes,
          read: async () => ({ event: read, tag: '"7"' }),
        },
        t,
      ),
  };
}

describe("one part's save (sc-48600)", () => {
  it('sends nothing when nothing changed', async () => {
    const { updateEvent, send } = saving();

    expect(await send({})).toEqual({ kind: 'unchanged' });
    expect(updateEvent).not.toHaveBeenCalled();
  });

  it('sends only that part, under the tag read at open as If-Match', async () => {
    const { updateEvent, send } = saving();

    expect(await send({ name: 'Gala night' })).toMatchObject({
      kind: 'saved',
      event: { name: 'Gala night' },
    });
    expect(updateEvent).toHaveBeenCalledWith('evt_gala', { name: 'Gala night' }, '"7"');
  });

  it("sends nothing over somebody else's change to the part since the page was read", async () => {
    const { updateEvent, send } = saving({ ...gala, name: 'Their gala' });

    expect(await send({ name: 'Gala night' })).toEqual({ kind: 'changed' });
    expect(updateEvent).not.toHaveBeenCalled();
  });

  it('saves over a change the part does not edit, such as a new cover', async () => {
    const cover = { sizes: [], position: 50, description: null };
    const { updateEvent, send } = saving({ ...gala, cover, phase: 'live', permissions: ['x'] });

    expect(await send({ arrivalNote: 'Gate B' }, 'venue')).toMatchObject({ kind: 'saved' });
    expect(updateEvent).toHaveBeenCalledOnce();
  });

  it('says changed on a 412, forbidden when the role no longer allows it, and failed on any other 403 (sc-49861)', async () => {
    expect(
      await saving(gala, Promise.reject(refusal(412, 'precondition'))).send({ name: 'G' }),
    ).toEqual({ kind: 'changed' });
    expect(
      await saving(gala, Promise.reject(refusal(403, 'permission_required'))).send({ name: 'G' }),
    ).toEqual({ kind: 'forbidden' });
    expect(
      await saving(gala, Promise.reject(refusal(403, 'two_factor_required'))).send({ name: 'G' }),
    ).toEqual({ kind: 'failed' });
  });

  it('compares only the fields the part edits', () => {
    expect(partChangedElsewhere('venue', gala, { ...gala, timeZone: 'Europe/London' })).toBe(true);
    expect(partChangedElsewhere('name', gala, { ...gala, timeZone: 'Europe/London' })).toBe(false);
  });
});

describe('the read held from the opening of the screen', () => {
  it('is read once, and read again at the save when it failed', async () => {
    const read = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue({ event: gala, tag: '"7"' });
    const held = heldRead(read);

    await expect(held()).rejects.toThrow('offline');
    await expect(held()).resolves.toMatchObject({ tag: '"7"' });
    await expect(held()).resolves.toMatchObject({ tag: '"7"' });
    expect(read).toHaveBeenCalledTimes(2);
  });
});
