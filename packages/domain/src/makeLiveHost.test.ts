import { ApiError, type OrganisationEvent, type TaggedEvent } from '@soirely/api-client';
import { describe, expect, it, vi } from 'vitest';

import { type Translate } from './eventWords.ts';
import {
  type MakeLiveCalls,
  makeLiveHostError,
  makeLiveWithHost,
  newEventHosts,
  rereadOf,
} from './makeLiveHost.ts';

const t: Translate = (key: string, values?: Record<string, string | number>) =>
  values == null ? key : `${key} ${JSON.stringify(values)}`;

function problem(status: number, code: string, violations?: unknown[]): ApiError {
  return new ApiError({
    type: `https://soirely.com/errors/${code}`,
    title: code,
    status,
    ...(violations == null ? {} : { violations }),
  } as ConstructorParameters<typeof ApiError>[0]);
}

function tagged(status: OrganisationEvent['status'], hosts: string[], tag = '"1"'): TaggedEvent {
  return { event: { id: 'ev_1', status, hosts } as unknown as OrganisationEvent, tag };
}

function calls(overrides: Partial<MakeLiveCalls> = {}): MakeLiveCalls {
  return {
    updateEvent: vi.fn(async (_id, changes) => tagged('draft', changes.hosts, '"2"')),
    makeLive: vi.fn(async () => tagged('live', ['Funmi Adeyemi'], '"3"')),
    ...overrides,
  };
}

describe("New event's Hosted by (sc-22143)", () => {
  it('sends no hosts and checks nothing for a lone empty Host 1', () => {
    expect(newEventHosts([{ key: 0, name: ' \n ' }])).toEqual([]);
  });

  it('keeps every row once there are two, so an empty Host 1 is refused', () => {
    const rows = [
      { key: 0, name: '' },
      { key: 1, name: 'Tayo' },
    ];

    expect(newEventHosts(rows)).toBe(rows);
    expect(newEventHosts([{ key: 0, name: 'Tayo' }])).toEqual([{ key: 0, name: 'Tayo' }]);
  });
});

describe("Make live's Host 1 (sc-22143)", () => {
  it('asks for the host when empty, and gives sc-6713 its own message for a long name', () => {
    expect(makeLiveHostError('  ', t)).toBe('eventLive.hostEmpty');
    expect(makeLiveHostError('é'.repeat(66), t)).toBe('eventHosts.tooLong {"most":60,"length":66}');
    expect(makeLiveHostError('Funmi Adeyemi', t)).toBeNull();
  });

  it('saves the typed name as the one host with the version read, then makes the event live', async () => {
    const api = calls();

    const step = await makeLiveWithHost(api, tagged('draft', []), ' Funmi\nAdeyemi ');

    expect(api.updateEvent).toHaveBeenCalledWith('ev_1', { hosts: ['Funmi Adeyemi'] }, '"1"');
    expect(api.makeLive).toHaveBeenCalledWith('ev_1');
    expect(step).toMatchObject({ kind: 'live', tagged: { tag: '"3"' } });
  });

  it('only makes live a draft that already has a host', async () => {
    const api = calls();

    await makeLiveWithHost(api, tagged('draft', ['Tayo']), '');

    expect(api.updateEvent).not.toHaveBeenCalled();
    expect(api.makeLive).toHaveBeenCalled();
  });

  it('reads the event again on a 412, and makes nothing live', async () => {
    const api = calls({
      updateEvent: vi.fn(async () => {
        throw problem(412, 'precondition_failed');
      }),
    });

    expect(await makeLiveWithHost(api, tagged('draft', []), 'Funmi')).toEqual({ kind: 'stale' });
    expect(api.makeLive).not.toHaveBeenCalled();
  });

  it('reads the event again when somebody acted between the save and going live', async () => {
    for (const code of ['event_state_invalid', 'event_host_required']) {
      const api = calls({
        makeLive: vi.fn(async () => {
          throw problem(409, code);
        }),
      });

      expect(await makeLiveWithHost(api, tagged('draft', []), 'Funmi')).toEqual({
        kind: 'stale',
      });
    }
  });

  it("shows the server's refusal of the name under the field", async () => {
    const api = calls({
      updateEvent: vi.fn(async () => {
        throw problem(422, 'validation_failed', [
          { propertyPath: 'hosts[0]', message: 'Refused here.' },
        ]);
      }),
    });

    expect(await makeLiveWithHost(api, tagged('draft', []), 'Funmi')).toEqual({
      kind: 'hostRefused',
      message: 'Refused here.',
    });
  });

  it('keeps the saved host when going live is refused, with the version the save returned', async () => {
    const limit = problem(403, 'plan_limit');
    const api = calls({
      makeLive: vi.fn(async () => {
        throw limit;
      }),
    });

    expect(await makeLiveWithHost(api, tagged('draft', []), 'Funmi')).toEqual({
      kind: 'refused',
      error: limit,
      saved: tagged('draft', ['Funmi'], '"2"'),
    });
  });

  it('goes by what the event is now after a reread', () => {
    expect(rereadOf({ status: 'draft', hosts: [] })).toBe('noHost');
    expect(rereadOf({ status: 'draft', hosts: ['Tayo'] })).toBe('hosted');
    expect(rereadOf({ status: 'live', hosts: ['Tayo'] })).toBe('notDraft');
  });
});
