/**
 * Configuration, read at boot rather than compiled in.
 *
 * The previous build took the API URL as a Vite build argument, so it ended up
 * inside the JavaScript bundle. Changing it in compose did nothing at all — no
 * error, no warning, just a client calling the wrong host — and that cost an
 * afternoon. One built image has to work in every environment, which means the
 * value cannot be in the image.
 *
 * So it is fetched once, before the first render, from a file the container
 * writes at start-up from its environment. Deliberately NOT through
 * `import.meta.env`: anything read from there is substituted at build time by
 * definition, and configIsNotBaked.test.ts fails if an API URL is read that way
 * again.
 */
export interface Config {
  /** Where the API is, from this browser. */
  apiBaseUrl: string;
  /** Where Mercure is, from this browser. Empty until something subscribes. */
  mercureUrl: string;
  /** Named so a support conversation can establish which deployment. */
  environment: string;
  /** Google's authorization endpoint and this client's id; the API redeems the code, so no token endpoint. */
  google: { authorizeUrl: string; clientId: string } | null;
}

const CONFIG_URL = '/config.json';

let loaded: Config | null = null;

/**
 * The configuration, or an explicit failure.
 *
 * Throwing rather than returning a default is deliberate. A default base URL is
 * a client silently talking to the wrong API, which looks like every other kind
 * of outage; a missing config file should say so once, loudly, at boot.
 */
export function config(): Config {
  if (loaded == null) {
    throw new Error('Configuration was read before load() finished. Await load() in main.tsx.');
  }

  return loaded;
}

export async function load(fetcher: typeof fetch = fetch): Promise<Config> {
  // Cache-busted, because the whole point is that this file differs between
  // deployments while the bundle beside it does not. A cached config.json from
  // a previous deployment is the exact failure this design exists to prevent.
  const response = await fetcher(`${CONFIG_URL}?t=${Date.now()}`, { cache: 'no-store' });

  if (!response.ok) {
    throw new Error(
      `Could not read ${CONFIG_URL} (${response.status}). The container writes it at start-up from SOIRELY_API_URL — see apps/web/README.md.`,
    );
  }

  loaded = parse(await response.json());

  return loaded;
}

/** For tests, and for nothing else. */
export function __setConfig(next: Config | null): void {
  loaded = next;
}

function parse(raw: unknown): Config {
  if (typeof raw !== 'object' || raw == null) {
    throw new Error(`${CONFIG_URL} is not an object.`);
  }

  const candidate = raw as Partial<Record<keyof Config, unknown>>;
  const apiBaseUrl = candidate.apiBaseUrl;

  // Checked rather than cast. A config file with the key misspelled would
  // otherwise put `undefined` in every request URL, and the browser's error for
  // that names neither the key nor the file.
  if (typeof apiBaseUrl !== 'string' || apiBaseUrl === '') {
    throw new Error(`${CONFIG_URL} has no apiBaseUrl.`);
  }

  return {
    apiBaseUrl: apiBaseUrl.replace(/\/$/, ''),
    mercureUrl: typeof candidate.mercureUrl === 'string' ? candidate.mercureUrl : '',
    environment: typeof candidate.environment === 'string' ? candidate.environment : 'unknown',
    google: providerFrom(candidate.google),
  };
}

/** Absent or half-filled is null: the button then says sign-in did not work, rather than guessing a host. */
function providerFrom(raw: unknown): Config['google'] {
  if (typeof raw !== 'object' || raw == null) return null;

  const { authorizeUrl, clientId } = raw as Record<string, unknown>;

  if (typeof authorizeUrl !== 'string' || typeof clientId !== 'string') return null;

  return authorizeUrl === '' || clientId === '' ? null : { authorizeUrl, clientId };
}
