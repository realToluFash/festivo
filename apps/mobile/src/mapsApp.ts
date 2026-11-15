import type { EventVenue } from '@soirely/api-client';
import { Linking, Platform } from 'react-native';

/** The links that hand a venue to a maps app (sc-51754), or null when it has no address to hand over. */
export function mapsLinks(
  venue: EventVenue | null,
  os: string,
): { app: string; browser: string } | null {
  const address = venue?.address;
  if (address == null) return null;

  const { latitude, longitude, formatted } = address;
  const at = latitude != null && longitude != null ? `${latitude},${longitude}` : null;
  const label = encodeURIComponent(venue?.name ?? formatted);
  const browser = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(at ?? formatted)}`;

  if (os === 'ios')
    return {
      app:
        at == null
          ? `https://maps.apple.com/?q=${encodeURIComponent(formatted)}`
          : `https://maps.apple.com/?ll=${at}&q=${label}`,
      browser,
    };

  // RFC 5870 with Android's `q`, so the phone's own maps app, or its chooser, takes it.
  return {
    app: at == null ? `geo:0,0?q=${encodeURIComponent(formatted)}` : `geo:${at}?q=${at}(${label})`,
    browser,
  };
}

export function openInMaps(venue: EventVenue | null): void {
  const links = mapsLinks(venue, Platform.OS);
  if (links == null) return;

  Linking.openURL(links.app).catch(() => Linking.openURL(links.browser).catch(() => {}));
}
