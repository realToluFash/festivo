export interface ReadableAgent {
  browser: string;
  platform: string;
}

export type AppDevice = 'iPhone' | 'iPad' | 'phone' | 'tablet';

export interface AppAgentParts {
  version: string;
  platform: 'ios' | 'android';
  /** The OS's own name, which on iOS says "iPadOS" on an iPad. Android's can be a build fingerprint, so it is not used. */
  osName: string | null;
  osVersion: string;
  tablet: boolean;
}

/** The whole string or nothing: a `Soirely/` agent with any other device token is shown as it came (sc-1242). */
const APP_AGENT = /^Soirely\/[^\s()]+ \([^;()]+ [^;()\s]+; (iPhone|iPad|phone|tablet)\)$/;

/** RFC 9110 §10.1.5: a product token, then a comment carrying the OS and the device class. */
export function appUserAgent(parts: AppAgentParts): string {
  const os = parts.platform === 'ios' ? (parts.osName ?? 'iOS') : 'Android';
  const device: AppDevice =
    parts.platform === 'ios'
      ? parts.tablet
        ? 'iPad'
        : 'iPhone'
      : parts.tablet
        ? 'tablet'
        : 'phone';

  return `Soirely/${parts.version} (${os} ${parts.osVersion}; ${device})`;
}

export function appDevice(userAgent: string | null | undefined): AppDevice | null {
  const found = APP_AGENT.exec(userAgent?.trim() ?? '');

  return (found?.[1] as AppDevice | undefined) ?? null;
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
