export type SignInProvider = 'google' | 'apple';

export interface ProviderRow {
  provider: SignInProvider;
  /** The address it vouched for; null when not linked, or linked before addresses were kept. */
  email: string | null;
  linked: boolean;
  canLink: boolean;
  canUnlink: boolean;
  /** The only way in left: Unlink is not offered, and Set a password is. */
  last: boolean;
}

const PROVIDERS: readonly SignInProvider[] = ['google', 'apple'];

/** Security's Ways to sign in: the last way in is never removable (sc-510). */
export function providerRows(
  hasPassword: boolean,
  linked: readonly { provider: SignInProvider; email: string | null }[],
): ProviderRow[] {
  return PROVIDERS.map((provider) => {
    const mine = linked.find((entry) => entry.provider === provider);
    const another = remainingWay(hasPassword, linked, provider) != null;

    return {
      provider,
      email: mine?.email ?? null,
      linked: mine != null,
      canLink: mine == null,
      canUnlink: mine != null && another,
      last: mine != null && !another,
    };
  });
}

/** How to confirm it is you when no provider is acted on: the password, else the provider linked first. */
export function confirmWith(
  hasPassword: boolean,
  linked: readonly { provider: SignInProvider }[],
): 'password' | SignInProvider | null {
  if (hasPassword) return 'password';

  return linked[0]?.provider ?? null;
}

/** How to confirm it is you: the password, else the provider acted on if linked, else the one that is. */
export function proveWith(
  hasPassword: boolean,
  linked: readonly { provider: SignInProvider }[],
  actingOn: SignInProvider,
): 'password' | SignInProvider | null {
  if (!hasPassword && linked.some((entry) => entry.provider === actingOn)) return actingOn;

  return confirmWith(hasPassword, linked);
}

/** The way in left once a provider is unlinked: the password if set, else the other provider. */
export function remainingWay(
  hasPassword: boolean,
  linked: readonly { provider: SignInProvider }[],
  unlinking: SignInProvider,
): 'password' | SignInProvider | null {
  if (hasPassword) return 'password';

  return linked.find((entry) => entry.provider !== unlinking)?.provider ?? null;
}

/** The API's SignInProof::MINUTES: how long a proof stands, counted from its first factor. */
export const PROOF_MINUTES = 5;

/** A proof stands until a few seconds before it lapses, so a slow request is not refused mid-way. */
export function proofStands(expiresAt: string | null, now: Date = new Date()): boolean {
  if (expiresAt == null) return false;

  return Date.parse(expiresAt) - now.getTime() > 10_000;
}
