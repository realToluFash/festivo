/**
 * One fetch layer, used by both clients.
 *
 * Base URL, auth header, token refresh, the correlation id and the error shape
 * are decided once here. Written per client, each would grow its own error path
 * and most of those would never be exercised.
 */
import { ApiError, ApiUnreachableError, toProblem } from './problem.ts';

/** See docs/architecture/sessions.md. */
export type RefreshTokenDelivery = 'body' | 'cookie';

export interface IssuedTokens {
  accessToken: string;
  /** Absent in cookie mode. */
  refreshToken?: string;
  refreshExpiresAt: string;
  sessionId: string;
}

export interface SignedIn {
  tokens: IssuedTokens;
  account: Account;
}

export interface Health {
  status: string;
  checks: Record<string, { status: string; error?: string }>;
}

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

/** `userAgent` and `ipAddress` are what the client claimed; nothing verifies either. */
export interface DeviceSession {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  startedAt: string;
  renewedAt: string;
  expiresAt: string;
}

export interface TokenStore {
  access(): string | null | Promise<string | null>;
  refresh(): string | null | Promise<string | null>;
  save(tokens: IssuedTokens): void | Promise<void>;
  clear(): void | Promise<void>;
}

export interface ClientOptions {
  /** Read lazily, so a client built at import time still honours runtime config. */
  baseUrl: () => string;
  tokens?: TokenStore;
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

  async signIn(email: string, password: string): Promise<SignedIn> {
    const { tokens, body } = await this.issued(
      await this.sendTokenRequest('/api/auth/login', { email, password }),
    );
    const account = asAccount(body.account);

    if (account == null) {
      throw new Error(
        'The API answered /api/auth/login without the account. Check SignInController in services/api.',
      );
    }

    await this.options.tokens?.save(tokens);

    return { tokens, account };
  }

  async register(email: string, name: string, password: string): Promise<IssuedTokens> {
    const { tokens } = await this.issued(
      await this.sendTokenRequest('/api/auth/register', { email, name, password }),
    );

    await this.options.tokens?.save(tokens);

    return tokens;
  }

  async me(): Promise<Account> {
    const account = asAccount(await this.get<unknown>('/api/auth/me'));

    if (account == null) {
      throw new Error(
        'The API answered /api/auth/me in a shape this client does not know. Check AccountController in services/api.',
      );
    }

    return account;
  }

  async verifyEmail(code: string): Promise<LinkedAddress> {
    const address = asLinkedAddress(await this.post<unknown>('/api/auth/verify/email', { code }));

    if (address == null) {
      throw new Error(
        'The API answered /api/auth/verify/email in a shape this client does not know. Check VerificationController in services/api.',
      );
    }

    return address;
  }

  async resendVerification(): Promise<number> {
    const answer = await this.post<unknown>('/api/auth/verify/resend');

    if (typeof answer !== 'object' || answer == null) return 0;

    const seconds = (answer as Record<string, unknown>).cooldownSeconds;

    return typeof seconds === 'number' && Number.isFinite(seconds) ? seconds : 0;
  }

  async sessions(): Promise<DeviceSession[]> {
    const sessions = asSessions(await this.get<unknown>('/api/auth/sessions'));

    if (sessions == null) {
      throw new Error(
        'The API answered /api/auth/sessions in a shape this client does not know. Check AccountController in services/api.',
      );
    }

    return sessions;
  }

  async endSession(id: string): Promise<void> {
    await this.delete(`/api/auth/sessions/${encodeURIComponent(id)}`);
  }

  async signOut(): Promise<void> {
    const body: Record<string, string> = { refreshTokenIn: this.delivery() };

    if (this.delivery() === 'body') {
      const token = await this.options.tokens?.refresh();
      if (token != null && token !== '') body.refreshToken = token;
    }

    await this.sendTokenRequest('/api/auth/logout', body).catch(() => null);
    await this.options.tokens?.clear();
  }

  /** A 503 is an answer here — it names the dependency that is down — so it is not thrown. */
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

    try {
      return await doFetch(this.url(path, init.query), request);
    } catch (error) {
      if (init.signal?.aborted === true) throw error;

      throw new ApiUnreachableError(error);
    }
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

    const response = await this.sendTokenRequest('/api/auth/refresh', body).catch(
      (error: unknown) => {
        throw new ApiUnreachableError(error);
      },
    );

    if (response.status >= 500) throw new ApiUnreachableError();

    if (!response.ok) {
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

  /** `credentials: 'include'` only here: the cookie is scoped to /api/auth. */
  private sendTokenRequest(path: string, body: Record<string, string>): Promise<Response> {
    const doFetch = this.options.fetch ?? fetch;

    return doFetch(this.url(path), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ ...body, refreshTokenIn: this.delivery() }),
      credentials: this.delivery() === 'cookie' ? 'include' : 'omit',
    });
  }

  private async issued(
    response: Response,
  ): Promise<{ tokens: IssuedTokens; body: Record<string, unknown> }> {
    if (!response.ok) throw new ApiError(await toProblem(response), response);

    const body: unknown = await response.json();
    const tokens = asIssuedTokens(body, this.delivery());

    if (tokens == null) {
      throw new Error(
        'The API answered without an access token. Check IssuedTokensResponse in services/api.',
      );
    }

    return { tokens, body: body as Record<string, unknown> };
  }

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

/** The primary address, which is the only one sign-in matches. */
export function primaryEmailAddress(account: Account): string | null {
  return account.emailAddresses.find((address) => address.primary)?.address ?? null;
}

function asLinkedAddress(raw: unknown): LinkedAddress | null {
  if (typeof raw !== 'object' || raw == null) return null;

  const candidate = raw as Record<string, unknown>;

  if (typeof candidate.id !== 'string' || typeof candidate.address !== 'string') return null;

  return {
    id: candidate.id,
    address: candidate.address,
    verified: candidate.verified === true,
    primary: candidate.primary === true,
  };
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

  if (delivery === 'body' && typeof candidate.refreshToken !== 'string') return null;

  return {
    accessToken: candidate.accessToken,
    ...(typeof candidate.refreshToken === 'string' ? { refreshToken: candidate.refreshToken } : {}),
    refreshExpiresAt:
      typeof candidate.refreshExpiresAt === 'string' ? candidate.refreshExpiresAt : '',
    sessionId: typeof candidate.sessionId === 'string' ? candidate.sessionId : '',
  };
}
