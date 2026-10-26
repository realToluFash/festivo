import { type AddressSuggestion, type PickedAddress } from '@soirely/api-client';
import { type VenueDraft } from '@soirely/domain';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ASK_AFTER_MS, type LookupSeen, addressLookup } from './venueLookup.ts';

const admiralty: AddressSuggestion = {
  id: 'node:1',
  text: '12 Admiralty Way',
  secondaryText: 'Lekki, Lagos',
};

const picked: PickedAddress = {
  formatted: '12 Admiralty Way, Lekki Phase 1, Lagos',
  line1: '12 Admiralty Way',
  line2: null,
  city: 'Lagos',
  region: 'Lagos',
  postalCode: '106104',
  countryCode: 'NG',
  latitude: 6.4474,
  longitude: 3.4723,
  timeZone: 'Africa/Lagos',
};

function lookupWith(
  suggest: (query: string) => Promise<AddressSuggestion[]>,
  resolve: (id: string) => Promise<PickedAddress> = () => Promise.resolve(picked),
) {
  const venue: Partial<VenueDraft>[] = [];
  let seen: LookupSeen | null = null;
  const lookup = addressLookup({
    suggest,
    resolve,
    onVenue: (change) => venue.push(change),
    onSeen: (next) => (seen = next),
  });

  return { lookup, venue, seen: () => seen };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('addressLookup', () => {
  it('asks nothing under three characters', async () => {
    const suggest = vi.fn(() => Promise.resolve([admiralty]));
    const { lookup } = lookupWith(suggest);

    lookup.type('12 ');
    await vi.advanceTimersByTimeAsync(ASK_AFTER_MS);

    expect(suggest).not.toHaveBeenCalled();
  });

  it('shows the latest answer once typing pauses', async () => {
    const suggest = vi.fn(() => Promise.resolve([admiralty]));
    const { lookup, seen } = lookupWith(suggest);

    lookup.type('12 A');
    lookup.type('12 Adm');
    await vi.advanceTimersByTimeAsync(ASK_AFTER_MS);

    expect(suggest).toHaveBeenCalledOnce();
    expect(suggest).toHaveBeenCalledWith('12 Adm');
    expect(seen()?.suggestions).toEqual([admiralty]);
  });

  it('keeps a picked address with its id, so the API stores its parts and coordinates', async () => {
    const { lookup, venue, seen } = lookupWith(() => Promise.resolve([admiralty]));

    await lookup.pick(admiralty, 'Africa/Lagos');

    expect(venue).toEqual([
      { address: '12 Admiralty Way, Lekki, Lagos', addressId: 'node:1' },
      { address: picked.formatted, addressId: 'node:1' },
    ]);
    expect(seen()?.suggestions).toEqual([]);
  });

  it('says the suggestions are unavailable when the lookup is down, and keeps what was typed', async () => {
    const { lookup, venue, seen } = lookupWith(() => Promise.reject(new Error('503')));

    lookup.type('12 Admiralty Way');
    await vi.advanceTimersByTimeAsync(ASK_AFTER_MS);

    expect(seen()?.down).toBe(true);
    expect(venue.at(-1)).toEqual({ address: '12 Admiralty Way', addressId: null });
  });

  it("offers the venue's zone when it differs, and the offer goes once answered", async () => {
    const { lookup, seen } = lookupWith(() => Promise.resolve([admiralty]));

    await lookup.pick(admiralty, 'Europe/London');
    expect(seen()?.offered).toEqual({ zone: 'Africa/Lagos', keep: 'Europe/London' });

    lookup.answered();
    expect(seen()?.offered).toBeNull();
  });

  it("offers nothing when the venue is in the event's zone already", async () => {
    const { lookup, seen } = lookupWith(() => Promise.resolve([admiralty]));

    await lookup.pick(admiralty, 'Africa/Lagos');

    expect(seen()?.offered).toBeNull();
  });

  it('typing after a pick drops the id, so the address is saved as typed', async () => {
    const { lookup, venue } = lookupWith(() => Promise.resolve([]));

    await lookup.pick(admiralty, 'Africa/Lagos');
    lookup.type('12 Admiralty Way, Lekki Phase 2');

    expect(venue.at(-1)).toEqual({ address: '12 Admiralty Way, Lekki Phase 2', addressId: null });
  });
});
