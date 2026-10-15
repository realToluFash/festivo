/**
 * One fetch layer, used by both clients.
 *
 * Base URL, auth header, token refresh, the correlation id and the error shape
 * are decided once here. Written per client, each would grow its own error path
 * and most of those would never be exercised.
 */
import { ApiError, toProblem } from './problem.ts';

/**
 * Where the refresh token lives.
 *
 * `cookie` is for browsers: the API returns it as an httpOnly cookie the page
 * cannot read, so a cross-site script cannot carry the session away with it.
 * `body` is for native clients, which keep it in the Keychain — better than any
 * cookie, and with no cross-site request forgery to answer for.
 *
 * See docs/architecture/sessions.md.
 */
export type RefreshTokenDelivery = 'body' | 'cookie';

/** Exactly what the API answers with. Generated types live in schema.d.ts. */
export interface IssuedTokens {
  accessToken: string;
  /** Absent in cookie mode — that is the entire point of cookie mode. */
  refreshToken?: string;
  refreshExpiresAt: string;
  sessionId: string;
}

/**
 * What `GET /api/health` answers, flat, like every other response in this API.
 *
 * It was read wrongly for as long as both clients existed: the endpoint used
 * to wrap this in `{success, data}`, nothing read `data`, and both clients'
 * tests agreed with the client rather than with the server. Hence `asHealth`
 * below, and a test here that refuses that envelope by name.
 */
export interface Health {
  status: string;
  checks: Record<string, { status: string; error?: string }>;
}

/** A linked address or number, as `GET /api/auth/me` reports it. */
export interface LinkedAddress {
  id: string;
  address: string;
  verified: boolean;
  primary: boolean;
}

export interface LinkedPhone {
  id: string;
  number: string;
  verified: boolean;
  primary: boolean;
}

/** The signed-in account. `AccountController::me` is the shape. */
export interface Account {
  id: string;
  name: string;
  businessName: string | null;
  countryCode: string | null;
  locale: string | null;
  verified: boolean;
  complete: boolean;
  emailAddresses: LinkedAddress[];
  phoneNumbers: LinkedPhone[];
}

/**
 * One signed-in session, as `GET /api/auth/sessions` reports it.
 *
 * `userAgent` and `ipAddress` are what the client CLAIMED when it signed in.
 * Nothing verifies either, and no screen may imply otherwise.
 */
export interface DeviceSession {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  /** When this chain of tokens began — the sign-in itself. */
  startedAt: string;
  /** When it was last renewed, which lags real use by the access lifetime. */
  renewedAt: string;
  expiresAt: string;
}

export interface TokenStore {
  access(): string | null | Promise<string | null>;
  /** Null in cookie mode: the browser holds it and the page cannot read it. */
  refresh(): string | null | Promise<string | null>;
  save(tokens: IssuedTokens): void | Promise<void>;
  clear(): void | Promise<void>;
}

export interface ClientOptions {
  /** Read lazily, so a client built at import time still honours runtime config. */
  baseUrl: () => string;
  tokens?: TokenStore;
  /** Defaults to `body`. The web client passes `cookie`. */
  refreshTokenIn?: RefreshTokenDelivery;
  /** The reader's language, for the API's own locale negotiation. */
  locale?: () => string | null;
  /** Called when refresh fails and the session is over. */
  onSignedOut?: () => void;
  fetch?: typeof fetch;
}

export interface RequestOptions {
  method?: string;
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  /** Skip the Authorization header — for sign-in and guest routes. */
  anonymous?: boolean;
}

export class ApiClient {
  private refreshing: Promise<boolean> | null = null;

  constructor(private readonly options: ClientOptions) {}

  async request<T>(path: string, init: RequestOptions = {}): Promise<T> {
    let response = await this.send(path, init);

    // One retry, and only after a refresh that actually succeeded. Retrying a
    // 401 without that is an infinite loop against an expired session.
    if (response.status === 401 && !init.anonymous && this.options.tokens != null) {
      if (await this.refreshOnce()) {
        response = await this.send(path, init);
      }
    }

    if (!response.ok) {
      throw new ApiError(await toProblem(response), response);
    }

    if (response.status === 204) return undefined as T;

    return (await response.json()) as T;
  }

  get<T>(path: string, init?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> {
    return this.request<T>(path, { ...init, method: 'GET' });
  }

  post<T>(path: string, body?: unknown, init?: Omit<RequestOptions, 'method'>): Promise<T> {
    return this.request<T>(path, { ...init, method: 'POST', body });
  }

  patch<T>(path: string, body?: unknown, init?: Omit<RequestOptions, 'method'>): Promise<T> {
    return this.request<T>(path, { ...init, method: 'PATCH', body });
  }

  delete<T>(path: string, init?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> {
    return this.request<T>(path, { ...init, method: 'DELETE' });
  }

  /**
   * The three calls that issue or end a session are the only ones that know
   * where the refresh token is carried, so they live here rather than in a
   * screen. A screen that built the request itself would have to remember to
   * send `refreshTokenIn` and to let the cookie travel — and in cookie mode a
   * forgotten `credentials: 'include'` fails by signing the person out one
   * access token later, nowhere near the code that caused it.
   */
  async signIn(email: string, password: string): Promise<IssuedTokens> {
    return this.adopt(await this.sendTokenRequest('/api/auth/login', { email, password }));
  }

  async register(email: string, name: string, password: string): Promise<IssuedTokens> {
    return this.adopt(await this.sendTokenRequest('/api/auth/register', { email, name, password }));
  }

  /** Who is signed in. Works while unverified: it is how a client finds out. */
  async me(): Promise<Account> {
    const account = asAccount(await this.get<unknown>('/api/auth/me'));

    if (account == null) {
      throw new Error(
        'The API answered /api/auth/me in a shape this client does not know. Check AccountController in services/api.',
      );
    }

    return account;
  }

  /** Every session still usable for this account, newest chain included. */
  async sessions(): Promise<DeviceSession[]> {
    const sessions = asSessions(await this.get<unknown>('/api/auth/sessions'));

    if (sessions == null) {
      throw new Error(
        'The API answered /api/auth/sessions in a shape this client does not know. Check AccountController in services/api.',
      );
    }

    return sessions;
  }

  /**
   * Ends one named session, which may be this one.
   *
   * A session that is already gone answers `not_found` — deliberately, since
   * saying "forbidden" would confirm that somebody else's session exists.
   */
  async endSession(id: string): Promise<void> {
    await this.delete(`/api/auth/sessions/${encodeURIComponent(id)}`);
  }

  /** Ends this one session. The other devices keep theirs. */
  async signOut(): Promise<void> {
    const body: Record<string, string> = { refreshTokenIn: this.delivery() };

    if (this.delivery() === 'body') {
      const token = await this.options.tokens?.refresh();
      if (token != null && token !== '') body.refreshToken = token;
    }

    // Local state goes whatever the server said. A refusal here would leave
    // somebody looking at a signed-in screen having pressed Sign out.
    await this.sendTokenRequest('/api/auth/logout', body).catch(() => null);
    await this.options.tokens?.clear();
  }

  /**
   * The one call that must not throw on the status.
   *
   * The API answers 503 when a dependency is down, and that response is the
   * answer rather than a failure — it names which dependency. Letting
   * `request()` reject it is how a status page reports "the API could not be
   * reached" about an API that just told it exactly what was wrong.
   */
  async health(): Promise<Health> {
    const response = await this.send('/api/health', { method: 'GET', anonymous: true });
    const health = asHealth(await response.json().catch(() => null));

    if (health == null) {
      throw new Error(
        'The API answered /api/health in a shape this client does not know. Check HealthController in services/api.',
      );
    }

    return health;
  }

  private async send(path: string, init: RequestOptions): Promise<Response> {
    const doFetch = this.options.fetch ?? fetch;
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...init.headers,
    };

    if (init.body !== undefined) headers['Content-Type'] = 'application/json';

    const locale = this.options.locale?.();
    if (locale != null && locale !== '') headers['Accept-Language'] = locale;

    if (!init.anonymous && this.options.tokens != null) {
      const token = await this.options.tokens.access();
      if (token != null && token !== '') headers.Authorization = `Bearer ${token}`;
    }

    const request: RequestInit = { method: init.method ?? 'GET', headers };

    // Assigned only when present. Under exactOptionalPropertyTypes an explicit
    // `undefined` is not the same as an absent key, and RequestInit does not
    // accept it.
    if (init.body !== undefined) request.body = JSON.stringify(init.body);
    if (init.signal !== undefined) request.signal = init.signal;

    return doFetch(this.url(path, init.query), request);
  }

  /**
   * Refresh at most once at a time.
   *
   * Four requests failing together must not start four refreshes: the API
   * rotates refresh tokens and treats a replayed one as theft, so the second
   * refresh would revoke the whole chain and sign the user out mid-task.
   */
  private refreshOnce(): Promise<boolean> {
    this.refreshing ??= this.doRefresh().finally(() => {
      this.refreshing = null;
    });

    return this.refreshing;
  }

  private async doRefresh(): Promise<boolean> {
    const store = this.options.tokens;
    if (store == null) return false;

    const body: Record<string, string> = { refreshTokenIn: this.delivery() };

    if (this.delivery() === 'body') {
      const token = await store.refresh();
      if (token == null || token === '') return false;
      body.refreshToken = token;
    }

    const response = await this.sendTokenRequest('/api/auth/refresh', body).catch(() => null);

    if (response == null || !response.ok) {
      await this.forgetSession();
      return false;
    }

    const issued = asIssuedTokens(await response.json().catch(() => null), this.delivery());

    if (issued == null) {
      await this.forgetSession();
      return false;
    }

    await store.save(issued);
    return true;
  }

  private delivery(): RefreshTokenDelivery {
    return this.options.refreshTokenIn ?? 'body';
  }

  /**
   * `credentials: 'include'` only on these routes. The cookie is scoped to
   * /api/auth, so including it everywhere would attach it to `me` and
   * `sessions` as well — requests that are already authorised by the access
   * token and have no business carrying the thing that renews it.
   */
  private sendTokenRequest(path: string, body: Record<string, string>): Promise<Response> {
    const doFetch = this.options.fetch ?? fetch;

    return doFetch(this.url(path), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ ...body, refreshTokenIn: this.delivery() }),
      credentials: this.delivery() === 'cookie' ? 'include' : 'omit',
    });
  }

  private async adopt(response: Response): Promise<IssuedTokens> {
    if (!response.ok) throw new ApiError(await toProblem(response), response);

    const issued = asIssuedTokens(await response.json(), this.delivery());

    if (issued == null) {
      throw new Error(
        'The API answered without an access token. Check IssuedTokensResponse in services/api.',
      );
    }

    await this.options.tokens?.save(issued);

    return issued;
  }

  /** Local state goes, and whoever is listening is told the session is over. */
  private async forgetSession(): Promise<void> {
    await this.options.tokens?.clear();
    this.options.onSignedOut?.();
  }

  private url(path: string, query?: RequestOptions['query']): string {
    const base = this.options.baseUrl().replace(/\/+$/, '');
    const url = new URL(`${base}${path.startsWith('/') ? path : `/${path}`}`);

    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }

    return url.toString();
  }
}

/**
 * Checked rather than cast.
 *
 * The previous version of this file read `body.data.access` — a shape the API
 * has never once sent. It passed its own tests because the tests asserted
 * against the same invented payload, so nothing here knew the refresh path had
 * never worked. A cast would have hidden it again; this reports it.
 */
/** The address sign-in matches. An alternative reaches somebody; this one is them. */
export function primaryEmailAddress(account: Account): string | null {
  return account.emailAddresses.find((address) => address.primary)?.address ?? null;
}

function asAccount(raw: unknown): Account | null {
  if (typeof raw !== 'object' || raw == null) return null;

  const candidate = raw as Record<string, unknown>;

  if (typeof candidate.id !== 'string' || candidate.id === '') return null;
  if (typeof candidate.name !== 'string') return null;
  if (!Array.isArray(candidate.emailAddresses) || !Array.isArray(candidate.phoneNumbers)) {
    return null;
  }

  const emailAddresses: LinkedAddress[] = [];

  for (const value of candidate.emailAddresses) {
    const address = value as Record<string, unknown>;

    if (typeof address?.address !== 'string' || typeof address.id !== 'string') return null;

    emailAddresses.push({
      id: address.id,
      address: address.address,
      verified: address.verified === true,
      primary: address.primary === true,
    });
  }

  const phoneNumbers: LinkedPhone[] = [];

  for (const value of candidate.phoneNumbers) {
    const phone = value as Record<string, unknown>;

    if (typeof phone?.number !== 'string' || typeof phone.id !== 'string') return null;

    phoneNumbers.push({
      id: phone.id,
      number: phone.number,
      verified: phone.verified === true,
      primary: phone.primary === true,
    });
  }

  return {
    id: candidate.id,
    name: candidate.name,
    businessName: typeof candidate.businessName === 'string' ? candidate.businessName : null,
    countryCode: typeof candidate.countryCode === 'string' ? candidate.countryCode : null,
    locale: typeof candidate.locale === 'string' ? candidate.locale : null,
    verified: candidate.verified === true,
    complete: candidate.complete === true,
    emailAddresses,
    phoneNumbers,
  };
}

function asSessions(raw: unknown): DeviceSession[] | null {
  if (typeof raw !== 'object' || raw == null) return null;

  const listed = (raw as Record<string, unknown>).sessions;

  if (!Array.isArray(listed)) return null;

  const sessions: DeviceSession[] = [];

  for (const value of listed) {
    const session = value as Record<string, unknown>;

    if (typeof session?.id !== 'string' || session.id === '') return null;
    if (typeof session.startedAt !== 'string' || typeof session.expiresAt !== 'string') return null;

    sessions.push({
      id: session.id,
      userAgent: typeof session.userAgent === 'string' ? session.userAgent : null,
      ipAddress: typeof session.ipAddress === 'string' ? session.ipAddress : null,
      startedAt: session.startedAt,
      renewedAt: typeof session.renewedAt === 'string' ? session.renewedAt : session.startedAt,
      expiresAt: session.expiresAt,
    });
  }

  return sessions;
}

/**
 * Checked rather than cast, for the same reason as the tokens below: the shape
 * came back different once already, and a cast turns that into
 * `Object.entries(undefined)` inside a component rather than a sentence naming
 * the file to look in.
 */
function asHealth(raw: unknown): Health | null {
  if (typeof raw !== 'object' || raw == null) return null;

  const candidate = raw as Record<string, unknown>;

  if (typeof candidate.status !== 'string' || candidate.status === '') return null;
  if (typeof candidate.checks !== 'object' || candidate.checks == null) return null;

  const checks: Health['checks'] = {};

  for (const [name, value] of Object.entries(candidate.checks)) {
    if (typeof value !== 'object' || value == null) return null;

    const check = value as Record<string, unknown>;

    if (typeof check.status !== 'string') return null;

    checks[name] = {
      status: check.status,
      ...(typeof check.error === 'string' ? { error: check.error } : {}),
    };
  }

  return { status: candidate.status, checks };
}

function asIssuedTokens(raw: unknown, delivery: RefreshTokenDelivery): IssuedTokens | null {
  if (typeof raw !== 'object' || raw == null) return null;

  const candidate = raw as Partial<Record<keyof IssuedTokens, unknown>>;

  if (typeof candidate.accessToken !== 'string' || candidate.accessToken === '') return null;

  // In body mode there is nowhere else for it to be, so a response without one
  // ends the session at the next expiry rather than at this line.
  if (delivery === 'body' && typeof candidate.refreshToken !== 'string') return null;

  return {
    accessToken: candidate.accessToken,
    ...(typeof candidate.refreshToken === 'string' ? { refreshToken: candidate.refreshToken } : {}),
    refreshExpiresAt:
      typeof candidate.refreshExpiresAt === 'string' ? candidate.refreshExpiresAt : '',
    sessionId: typeof candidate.sessionId === 'string' ? candidate.sessionId : '',
  };
}
