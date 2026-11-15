import type { EventVenue } from '@soirely/api-client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const rn = vi.hoisted(() => ({
  Linking: { openURL: vi.fn<(url: string) => Promise<void>>() },
  Platform: { OS: 'android' },
}));

vi.mock('react-native', () => rn);

const { mapsLinks, openInMaps } = await import('./mapsApp.ts');

function venue(name: string | null, at: [number, number] | null): EventVenue {
  return {
    name,
    address: {
      formatted: '12 Bode Thomas St, Lagos',
      line1: null,
      line2: null,
      city: null,
      region: null,
      postalCode: null,
      countryCode: null,
      latitude: at?.[0] ?? null,
      longitude: at?.[1] ?? null,
    },
  };
}

describe('mapsLinks', () => {
  it('hands nothing over without an address', () => {
    expect(mapsLinks(null, 'ios')).toBeNull();
    expect(mapsLinks({ name: 'Finca', address: null }, 'android')).toBeNull();
  });

  it('pins Apple Maps at the coordinates under the name, else searches the address as saved', () => {
    expect(mapsLinks(venue('Finca & Co', [6.5, 3.35]), 'ios')?.app).toBe(
      'https://maps.apple.com/?ll=6.5,3.35&q=Finca%20%26%20Co',
    );
    expect(mapsLinks(venue(null, [6.5, 3.35]), 'ios')?.app).toBe(
      'https://maps.apple.com/?ll=6.5,3.35&q=12%20Bode%20Thomas%20St%2C%20Lagos',
    );
    expect(mapsLinks(venue('Finca', null), 'ios')?.app).toBe(
      'https://maps.apple.com/?q=12%20Bode%20Thomas%20St%2C%20Lagos',
    );
  });

  it('gives Android a geo: link, and the browser Google Maps search', () => {
    expect(mapsLinks(venue('Finca', [6.5, 3.35]), 'android')).toEqual({
      app: 'geo:6.5,3.35?q=6.5,3.35(Finca)',
      browser: 'https://www.google.com/maps/search/?api=1&query=6.5%2C3.35',
    });
    expect(mapsLinks(venue('Finca (Lekki)', [6.5, 3.35]), 'android')?.app).toBe(
      'geo:6.5,3.35?q=6.5,3.35(Finca%20%28Lekki%29)',
    );
    expect(mapsLinks(venue('Finca', null), 'android')).toEqual({
      app: 'geo:0,0?q=12%20Bode%20Thomas%20St%2C%20Lagos',
      browser: 'https://www.google.com/maps/search/?api=1&query=12%20Bode%20Thomas%20St%2C%20Lagos',
    });
  });
});

describe('openInMaps', () => {
  beforeEach(() => rn.Linking.openURL.mockReset());

  it('falls back to the browser when no app takes the place', async () => {
    rn.Linking.openURL.mockRejectedValueOnce(new Error('No Activity found')).mockResolvedValue();

    openInMaps(venue('Finca', null));
    await vi.waitFor(() => expect(rn.Linking.openURL).toHaveBeenCalledTimes(2));

    expect(rn.Linking.openURL).toHaveBeenLastCalledWith(
      'https://www.google.com/maps/search/?api=1&query=12%20Bode%20Thomas%20St%2C%20Lagos',
    );
  });
});
