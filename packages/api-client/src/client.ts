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
  /** A provider was linked to this existing account just now, which the person is told once. */
  linked: boolean;
}

/** A first factor that passed on an account with two-factor on: no tokens until a code does. */
export interface TwoFactorChallenge {
  kind: 'twoFactor';
  challenge: string;
  expiresAt: string;
  /** The address the code is for, shown as "the 6-digit code for <address>". */
  email: string;
}

export type SignInOutcome = SignedIn | TwoFactorChallenge;

/** A password sign-up waiting on its emailed code; `registration` is its one-day handle. */
export interface PendingRegistration {
  registration: string;
  email: string;
}

export interface TwoFactorStatus {
  on: boolean;
  recoveryCodesLeft: number;
}

export interface TwoFactorEnrolment {
  secret: string;
  otpauthUri: string;
  qrSvg: string;
}

export type SecondFactor = { code: string } | { recoveryCode: string };

export type Provider = 'google' | 'apple';

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
  /** E.164. */
  number: string;
  /** The country it was entered for; null for a number saved before that was recorded. */
  countryCode: string | null;
  verified: boolean;
  primary: boolean;
  /** Texted to replace the primary, which it does only once it is verified. */
  pending: boolean;
}

export interface Account {
  id: string;
  name: string;
  businessName: string | null;
  countryCode: string | null;
  locale: string | null;
  verified: boolean;
  complete: boolean;
  /** The details screen asks for an organisation: a self-registered account in none. */
  needsOrganisation: boolean;
  /** The providers that vouch for this account, such as Google. */
  providers: string[];
  emailAddresses: LinkedAddress[];
  phoneNumbers: LinkedPhone[];
}

export interface Organisation {
  id: string;
  name: string;
  countryCode: string;
  currency: string;
  timezone: string;
  contactAddress: string;
}

/** A seeded role is named by `seededAs`, which each client words itself; a custom one by `name`. */
export interface MemberRole {
  id: string;
  seededAs: string | null;
  name: string | null;
}

export interface Membership extends Organisation {
  role: MemberRole;
}

export type OrganisationChanges = Partial<Omit<Organisation, 'id'>>;

/** The two codes the onboarding gate refuses with; each names the screen that passes it. */
export type Gate = 'account_unverified' | 'profile_incomplete';

export interface ProfileDetails {
  name: string;
  /** Sent only when the account `needsOrganisation`. */
  organisationName?: string;
  countryCode?: string;
  timezone?: string;
  /** Optional; an empty number means no phone, and removes the one there was. */
  phoneCountryCode?: string;
  phoneNumber?: string;
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
  /** Called when the API refuses a request because the account is behind an onboarding gate. */
  onGate?: (gate: Gate) => void;
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
      const error = new ApiError(await toProblem(response), response);

      if (error.is('account_unverified') || error.is('profile_incomplete')) {
        this.options.onGate?.(error.code as Gate);
      }

      throw error;
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

  put<T>(path: string, body?: unknown, init?: Omit<RequestOptions, 'method'>): Promise<T> {
    return this.request<T>(path, { ...init, method: 'PUT', body });
  }

  patch<T>(path: string, body?: unknown, init?: Omit<RequestOptions, 'method'>): Promise<T> {
    return this.request<T>(path, { ...init, method: 'PATCH', body });
  }

  delete<T>(path: string, init?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> {
    return this.request<T>(path, { ...init, method: 'DELETE' });
  }

  async signIn(email: string, password: string): Promise<SignInOutcome> {
    return this.signedIn('/api/auth/login', { email, password }, 'SignInController');
  }

  async verifyTwoFactor(challenge: string, factor: SecondFactor): Promise<SignedIn> {
    return this.signedInOnly(
      '/api/auth/two-factor/verify',
      { challenge, ...factor },
      'TwoFactorSignInController',
    );
  }

  async twoFactorStatus(): Promise<TwoFactorStatus> {
    return this.get<TwoFactorStatus>('/api/auth/two-factor');
  }

  /** A new secret, off until `activateTwoFactor` is sent a code it made. */
  async enrolTwoFactor(): Promise<TwoFactorEnrolment> {
    return this.post<TwoFactorEnrolment>('/api/auth/two-factor/enrol');
  }

  /** @returns the recovery codes, which the API shows this once */
  async activateTwoFactor(code: string): Promise<string[]> {
    return (await this.post<{ recoveryCodes: string[] }>('/api/auth/two-factor/activate', { code }))
      .recoveryCodes;
  }

  /** Takes an app code or an unused recovery code; every earlier recovery code stops working. */
  async newRecoveryCodes(code: string): Promise<string[]> {
    return (
      await this.post<{ recoveryCodes: string[] }>('/api/auth/two-factor/recovery-codes', { code })
    ).recoveryCodes;
  }

  async disableTwoFactor(code: string): Promise<void> {
    await this.post('/api/auth/two-factor/disable', { code });
  }

  /** The ID token a provider issued, and the nonce whose hash went to the provider with the request. */
  /** `name` is for Apple, which gives one only on the first authorisation and never puts it in the token. */
  async signInWithProvider(
    provider: Provider,
    idToken: string,
    nonce: string,
    name?: string,
  ): Promise<SignInOutcome> {
    return this.signedIn(
      `/api/auth/oauth/${provider}`,
      { idToken, nonce, ...(name == null || name === '' ? {} : { name }) },
      'ProviderSignInController',
    );
  }

  /** Android starts Apple here, so the API can tell Apple's form_post for the app from the web's. */
  async startAppleAttempt(state: string, codeChallenge: string): Promise<void> {
    await this.post('/api/auth/oauth/apple/attempts', { state, codeChallenge });
  }

  /** The App Link's one-time handle, with the verifier that started the attempt. */
  async exchangeAppleHandle(attempt: {
    handle: string;
    codeVerifier: string;
    nonce: string;
    redirectUri: string;
  }): Promise<SignInOutcome> {
    return this.signedIn('/api/auth/oauth/apple/handle', attempt, 'AppleAppController');
  }

  /** The web's way in: its code and PKCE verifier, which only the API can redeem, with the secret it holds. */
  async signInWithProviderCode(
    provider: Provider,
    attempt: {
      code: string;
      codeVerifier: string;
      redirectUri: string;
      nonce: string;
      name?: string;
    },
  ): Promise<SignInOutcome> {
    const { name, ...rest } = attempt;

    return this.signedIn(
      `/api/auth/oauth/${provider}`,
      { ...rest, ...(name == null || name === '' ? {} : { name }) },
      'ProviderSignInController',
    );
  }

  /** The same answer whether or not the address has an account; what happens next is only in the inbox. */
  async forgotPassword(email: string): Promise<void> {
    await this.post('/api/auth/password/forgot', { email });
  }

  /** Whose reset link this is; refused as `reset_link_invalid`, `reset_link_used` or `reset_link_expired`. */
  async checkResetLink(token: string): Promise<{ email: string; twoFactor: boolean }> {
    const body = await this.post<{ email?: unknown; twoFactor?: unknown }>(
      '/api/auth/password/reset/check',
      { token },
    );

    return {
      email: typeof body?.email === 'string' ? body.email : '',
      twoFactor: body?.twoFactor === true,
    };
  }

  /** With two-factor on, the code comes before the new password; nothing changes until it passes. */
  async passResetCode(token: string, factor: SecondFactor): Promise<void> {
    await this.post('/api/auth/password/reset/code', { token, ...factor });
  }

  /** A new password from a reset link, which signs this device in and every other one out. */
  async resetPassword(token: string, password: string): Promise<SignedIn> {
    return this.signedInOnly(
      '/api/auth/password/reset',
      { token, password },
      'PasswordRecoveryController',
    );
  }

  /** Signed in as sign-in is: the same tokens, the same account. */
  /** The same answer for every address, so it says nothing of who has an account; no session yet. */
  async register(email: string, name: string, password: string): Promise<PendingRegistration> {
    const body = await this.post<{ registration?: unknown; email?: unknown }>(
      '/api/auth/register',
      {
        email,
        name,
        password,
      },
    );

    if (typeof body?.registration !== 'string') {
      throw new Error(
        'The API answered /api/auth/register without a registration. Check RegisterController in services/api.',
      );
    }

    return {
      registration: body.registration,
      email: typeof body.email === 'string' ? body.email : email,
    };
  }

  /** The code proves the address: only now is the account made, and signed in. */
  async confirmRegistration(registration: string, code: string): Promise<SignedIn> {
    return this.signedInOnly(
      '/api/auth/register/verify',
      { registration, code },
      'RegisterController',
    );
  }

  async registrationCooldown(registration: string): Promise<number> {
    return cooldownFrom(
      await this.get<unknown>('/api/auth/register/resend', { query: { registration } }),
    );
  }

  async resendRegistrationCode(registration: string): Promise<number> {
    return cooldownFrom(await this.post<unknown>('/api/auth/register/resend', { registration }));
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

  /** A new number is texted a code at once; the answer says whether one was, and how long until another. */
  async setPhone(
    countryCode: string,
    number: string,
  ): Promise<{ phone: LinkedPhone | null; verificationNeeded: boolean; cooldownSeconds: number }> {
    const raw = await this.put<Record<string, unknown>>('/api/auth/phone', { countryCode, number });

    return {
      phone: raw.phone == null ? null : asLinkedPhone(raw.phone),
      verificationNeeded: raw.verificationNeeded === true,
      cooldownSeconds: typeof raw.cooldownSeconds === 'number' ? raw.cooldownSeconds : 0,
    };
  }

  async verifyPhone(code: string): Promise<LinkedPhone> {
    const phone = asLinkedPhone(await this.post<unknown>('/api/auth/verify/phone', { code }));

    if (phone == null) {
      throw new Error(
        'The API answered /api/auth/verify/phone in a shape this client does not know. Check PhoneController in services/api.',
      );
    }

    return phone;
  }

  async phoneCooldown(): Promise<number> {
    return (await this.get<{ cooldownSeconds: number }>('/api/auth/verify/phone/resend'))
      .cooldownSeconds;
  }

  async resendPhoneCode(): Promise<number> {
    return (await this.post<{ cooldownSeconds: number }>('/api/auth/verify/phone/resend'))
      .cooldownSeconds;
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
    return cooldownFrom(await this.post<unknown>('/api/auth/verify/resend'));
  }

  /** Reads the cooldown without spending it, so a screen opens already counting down. */
  async verificationCooldown(): Promise<number> {
    return cooldownFrom(await this.get<unknown>('/api/auth/verify/resend'));
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

  /** The details screen. Answers whether a phone still has to be verified before the product opens. */
  async completeProfile(
    details: ProfileDetails,
  ): Promise<{ account: Account; verificationNeeded: boolean }> {
    const raw = await this.patch<Record<string, unknown>>('/api/auth/complete-profile', details);
    const account = asAccount(raw?.account);

    if (account == null) {
      throw new Error(
        'The API answered /api/auth/complete-profile without the account. Check ProfileController in services/api.',
      );
    }

    return { account, verificationNeeded: raw.verificationNeeded === true };
  }

  async organisations(): Promise<Membership[]> {
    const raw = await this.get<unknown>('/api/orgs');
    const listed =
      typeof raw === 'object' && raw != null
        ? (raw as Record<string, unknown>).organisations
        : null;
    const memberships = Array.isArray(listed) ? listed.map(asMembership) : null;

    if (memberships == null || memberships.some((membership) => membership == null)) {
      throw new Error(
        'The API answered /api/orgs in a shape this client does not know. Check OrganisationController in services/api.',
      );
    }

    return memberships as Membership[];
  }

  async updateOrganisation(id: string, changes: OrganisationChanges): Promise<Organisation> {
    const organisation = asOrganisation(
      await this.patch<unknown>(`/api/orgs/${encodeURIComponent(id)}`, changes),
    );

    if (organisation == null) {
      throw new Error(
        'The API answered PATCH /api/orgs/{id} in a shape this client does not know. Check OrganisationController in services/api.',
      );
    }

    return organisation;
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

  /** Tokens and the account, or, with two-factor on, the challenge the code answers. */
  private async signedIn(
    path: string,
    credentials: Record<string, string>,
    controller: string,
  ): Promise<SignInOutcome> {
    const response = await this.sendTokenRequest(path, credentials);

    if (response.status === 202) {
      const challenge = asChallenge(await response.json().catch(() => null));

      if (challenge == null) {
        throw new Error(
          `The API answered ${path} with a challenge this client cannot read. Check SignInResponse in services/api.`,
        );
      }

      return challenge;
    }

    return this.adopt(response, path, controller);
  }

  /** A way in that never asks for a second factor: registering, or the code that just passed. */
  private async signedInOnly(
    path: string,
    credentials: Record<string, string>,
    controller: string,
  ): Promise<SignedIn> {
    return this.adopt(await this.sendTokenRequest(path, credentials), path, controller);
  }

  private async adopt(response: Response, path: string, controller: string): Promise<SignedIn> {
    const { tokens, body } = await this.issued(response);
    const account = asAccount(body.account);

    if (account == null) {
      throw new Error(
        `The API answered ${path} without the account. Check ${controller} in services/api.`,
      );
    }

    await this.options.tokens?.save(tokens);

    return { tokens, account, linked: body.linked === true };
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

/** The number a code is waiting on: a replacement texted, else the primary. */
export function phoneAwaitingCode(account: Pick<Account, 'phoneNumbers'>): LinkedPhone | null {
  return (
    account.phoneNumbers.find((phone) => phone.pending) ??
    account.phoneNumbers.find((phone) => phone.primary) ??
    null
  );
}

export type Awaiting = 'email' | 'phone' | 'details';

/** The gate an account is behind, in the API's order: the email, then a phone it has, then the details. */
export function awaiting(
  account: Pick<Account, 'verified' | 'complete' | 'emailAddresses'>,
): Awaiting | null {
  if (!account.verified) {
    const email = account.emailAddresses.find((address) => address.primary);

    return email?.verified === true ? 'phone' : 'email';
  }

  return account.complete ? null : 'details';
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
    const phone = asLinkedPhone(value);

    if (phone == null) return null;

    phoneNumbers.push(phone);
  }

  return {
    id: candidate.id,
    name: candidate.name,
    businessName: typeof candidate.businessName === 'string' ? candidate.businessName : null,
    countryCode: typeof candidate.countryCode === 'string' ? candidate.countryCode : null,
    locale: typeof candidate.locale === 'string' ? candidate.locale : null,
    verified: candidate.verified === true,
    complete: candidate.complete === true,
    needsOrganisation: candidate.needsOrganisation === true,
    providers: Array.isArray(candidate.providers)
      ? candidate.providers.filter((provider): provider is string => typeof provider === 'string')
      : [],
    emailAddresses,
    phoneNumbers,
  };
}

function asOrganisation(raw: unknown): Organisation | null {
  if (typeof raw !== 'object' || raw == null) return null;

  const candidate = raw as Record<string, unknown>;
  const fields = ['id', 'name', 'countryCode', 'currency', 'timezone', 'contactAddress'] as const;

  if (fields.some((field) => typeof candidate[field] !== 'string')) return null;

  return {
    id: candidate.id as string,
    name: candidate.name as string,
    countryCode: candidate.countryCode as string,
    currency: candidate.currency as string,
    timezone: candidate.timezone as string,
    contactAddress: candidate.contactAddress as string,
  };
}

function asMembership(raw: unknown): Membership | null {
  const organisation = asOrganisation(raw);
  const role = (raw as Record<string, unknown> | null)?.role as Record<string, unknown> | undefined;

  if (organisation == null || typeof role?.id !== 'string') return null;

  return {
    ...organisation,
    role: {
      id: role.id,
      seededAs: typeof role.seededAs === 'string' ? role.seededAs : null,
      name: typeof role.name === 'string' ? role.name : null,
    },
  };
}

function asLinkedPhone(raw: unknown): LinkedPhone | null {
  if (typeof raw !== 'object' || raw == null) return null;

  const phone = raw as Record<string, unknown>;

  if (typeof phone.id !== 'string' || typeof phone.number !== 'string') return null;

  return {
    id: phone.id,
    number: phone.number,
    countryCode: typeof phone.countryCode === 'string' ? phone.countryCode : null,
    verified: phone.verified === true,
    primary: phone.primary === true,
    pending: phone.pending === true,
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

function asChallenge(raw: unknown): TwoFactorChallenge | null {
  if (typeof raw !== 'object' || raw === null) return null;

  const body = raw as Record<string, unknown>;
  const { twoFactorChallenge, challengeExpiresAt, email } = body;

  if (typeof twoFactorChallenge !== 'string' || typeof challengeExpiresAt !== 'string') return null;

  return {
    kind: 'twoFactor',
    challenge: twoFactorChallenge,
    expiresAt: challengeExpiresAt,
    email: typeof email === 'string' ? email : '',
  };
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

function cooldownFrom(answer: unknown): number {
  if (typeof answer !== 'object' || answer == null) return 0;

  const seconds = (answer as Record<string, unknown>).cooldownSeconds;

  return typeof seconds === 'number' && Number.isFinite(seconds) ? seconds : 0;
}
