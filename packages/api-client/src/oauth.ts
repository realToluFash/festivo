// The provider half of signing in with Google: the code flow with PKCE, and a nonce whose hash goes to the
// provider and whose raw value goes to the API. Each client brings its platform's randomness and hashing.
export interface ProviderEndpoints {
  authorizeUrl: string;
  tokenUrl: string;
  clientId: string;
}

/** What a client keeps between leaving for the provider and coming back. */
export interface ProviderAttempt {
  state: string;
  nonce: string;
  codeVerifier: string;
}

export class ProviderCancelled extends Error {
  constructor() {
    super('The person closed the provider without signing in.');
    this.name = 'ProviderCancelled';
  }
}

export class ProviderFailed extends Error {
  constructor(reason: string) {
    super(`The provider did not sign the person in: ${reason}`);
    this.name = 'ProviderFailed';
  }
}

// By hand, not through URL or URLSearchParams: React Native's are incomplete, and this runs there too.
function form(fields: Record<string, string>): string {
  return Object.entries(fields)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
}

function query(url: string): Map<string, string> {
  const start = url.indexOf('?');
  const end = url.indexOf('#', start);
  const raw = start < 0 ? '' : url.slice(start + 1, end < 0 ? undefined : end);
  const found = new Map<string, string>();

  for (const pair of raw.split('&')) {
    if (pair === '') continue;
    const [key = '', value = ''] = pair.split('=');
    found.set(decodeURIComponent(key), decodeURIComponent(value.replaceAll('+', ' ')));
  }

  return found;
}

export function base64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);

  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
}

export function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** The provider's URL, carrying the nonce's SHA-256 (hex) and the verifier's S256 challenge. */
export function authorizationUrl(
  endpoints: Pick<ProviderEndpoints, 'authorizeUrl' | 'clientId'>,
  request: {
    redirectUri: string;
    state: string;
    nonceHash: string;
    codeChallenge: string;
    /** Apple asks for `name email` and must answer by form_post; Google takes `prompt`. */
    scope?: string;
    extra?: Record<string, string>;
  },
): string {
  return `${endpoints.authorizeUrl}?${form({
    client_id: endpoints.clientId,
    response_type: 'code',
    redirect_uri: request.redirectUri,
    scope: request.scope ?? 'openid email profile',
    state: request.state,
    nonce: request.nonceHash,
    code_challenge: request.codeChallenge,
    code_challenge_method: 'S256',
    ...(request.extra ?? { prompt: 'select_account' }),
  })}`;
}

/** The code the provider came back with; a refusal or a closed window is a cancellation. */
export function codeFromCallback(callbackUrl: string, expectedState: string): string {
  const params = query(callbackUrl);
  const error = params.get('error');

  if (error === 'access_denied') throw new ProviderCancelled();
  if (error != null) throw new ProviderFailed(error);
  if (params.get('state') !== expectedState) throw new ProviderFailed('state does not match');

  const code = params.get('code');
  if (code == null || code === '') throw new ProviderFailed('no code');

  return code;
}

/** The code exchanged, with the verifier only this client held, for the ID token the API checks. */
export async function exchangeCode(
  endpoints: ProviderEndpoints,
  exchange: { code: string; codeVerifier: string; redirectUri: string },
  fetchFn: typeof fetch = fetch,
): Promise<string> {
  const response = await fetchFn(endpoints.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form({
      grant_type: 'authorization_code',
      code: exchange.code,
      client_id: endpoints.clientId,
      redirect_uri: exchange.redirectUri,
      code_verifier: exchange.codeVerifier,
    }),
  });

  if (!response.ok) throw new ProviderFailed(`token endpoint answered ${response.status}`);

  const body = (await response.json()) as { id_token?: unknown };
  if (typeof body.id_token !== 'string') throw new ProviderFailed('no ID token');

  return body.id_token;
}

/** Apple's `user` value, sent once on the first authorisation, as the name a person would read. */
export function appleName(user: string | null | undefined): string | undefined {
  if (user == null || user === '') return undefined;

  try {
    const parsed = JSON.parse(user) as { name?: { firstName?: unknown; lastName?: unknown } };
    const parts = [parsed.name?.firstName, parsed.name?.lastName].filter(
      (part): part is string => typeof part === 'string' && part.trim() !== '',
    );

    return parts.length === 0 ? undefined : parts.join(' ');
  } catch {
    return undefined;
  }
}

/** The value of one query parameter of a callback, read without URL, which React Native lacks. */
export function callbackParam(callbackUrl: string, name: string): string | null {
  return query(callbackUrl).get(name) ?? null;
}

/** What the App Link brought back from Apple on Android: the one-time handle, or a cancel. */
export function appleAppLinkOutcome(url: string): { handle: string } | { cancelled: true } | null {
  const handle = callbackParam(url, 'handle');
  if (handle != null && handle !== '') return { handle };

  return callbackParam(url, 'error') === 'cancelled' ? { cancelled: true } : null;
}
