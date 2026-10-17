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
    const another = hasPassword || linked.some((entry) => entry.provider !== provider);

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

/** How to confirm it is you: the password, else the provider acted on if linked, else the one that is. */
export function proveWith(
  hasPassword: boolean,
  linked: readonly { provider: SignInProvider }[],
  actingOn: SignInProvider,
): 'password' | SignInProvider | null {
  if (hasPassword) return 'password';
  if (linked.some((entry) => entry.provider === actingOn)) return actingOn;

  return linked[0]?.provider ?? null;
}

/** A proof stands until a few seconds before it lapses, so a slow request is not refused mid-way. */
export function proofStands(expiresAt: string | null, now: Date = new Date()): boolean {
  if (expiresAt == null) return false;

  return Date.parse(expiresAt) - now.getTime() > 10_000;
}
