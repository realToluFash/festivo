/**
 * A user-agent string, made readable.
 *
 * The devices list shows what each client said about itself when it signed in,
 * and a raw user-agent string is unreadable to the person who has to decide
 * whether they recognise it. So it is reduced to two words.
 *
 * Two rules, both from the design. **A string this cannot read is shown as it
 * came** rather than guessed at or hidden — a session nobody can identify is
 * exactly the one worth looking at. And the two parts come back separately,
 * because joining them with "on" would put an English word in three other
 * languages' sentences.
 */
export interface ReadableAgent {
  browser: string;
  platform: string;
}

/** Null when there is nothing to read, so the caller can say so in its own words. */
export function readableAgent(userAgent: string | null | undefined): ReadableAgent | null {
  const raw = userAgent?.trim() ?? '';

  if (raw === '') return null;

  const browser = browserOf(raw);
  const platform = platformOf(raw);

  return browser == null || platform == null ? null : { browser, platform };
}

/**
 * The order is the whole trick. Every Chromium browser claims to be Chrome and
 * Safari, and Chrome claims to be Safari, so the most specific token has to be
 * tested first or everything reports as Safari.
 */
function browserOf(raw: string): string | null {
  if (raw.includes('Edg/')) return 'Edge';
  if (raw.includes('OPR/') || raw.includes('Opera')) return 'Opera';
  if (raw.includes('SamsungBrowser')) return 'Samsung Internet';
  if (raw.includes('Firefox/') || raw.includes('FxiOS')) return 'Firefox';
  if (raw.includes('CriOS')) return 'Chrome';
  if (raw.includes('Chrome/')) return 'Chrome';
  if (raw.includes('Safari/')) return 'Safari';

  return null;
}

function platformOf(raw: string): string | null {
  if (raw.includes('iPhone')) return 'iPhone';
  if (raw.includes('iPad')) return 'iPad';
  if (raw.includes('Android')) return 'Android';
  if (raw.includes('Macintosh') || raw.includes('Mac OS X')) return 'macOS';
  if (raw.includes('Windows')) return 'Windows';
  if (raw.includes('CrOS')) return 'ChromeOS';
  if (raw.includes('Linux')) return 'Linux';

  return null;
}
