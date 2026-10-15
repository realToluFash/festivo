export interface ReadableAgent {
  browser: string;
  platform: string;
}

export function readableAgent(userAgent: string | null | undefined): ReadableAgent | null {
  const raw = userAgent?.trim() ?? '';

  if (raw === '') return null;

  const browser = browserOf(raw);
  const platform = platformOf(raw);

  return browser == null || platform == null ? null : { browser, platform };
}

/** Order matters: every Chromium browser claims to be Chrome and Safari, and Chrome claims Safari. */
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
