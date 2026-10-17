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
  request: { redirectUri: string; state: string; nonceHash: string; codeChallenge: string },
): string {
  return `${endpoints.authorizeUrl}?${form({
    client_id: endpoints.clientId,
    response_type: 'code',
    redirect_uri: request.redirectUri,
    scope: 'openid email profile',
    state: request.state,
    nonce: request.nonceHash,
    code_challenge: request.codeChallenge,
    code_challenge_method: 'S256',
    prompt: 'select_account',
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
