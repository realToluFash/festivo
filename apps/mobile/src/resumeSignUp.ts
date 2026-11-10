import { ApiError, type CodeOpening, type PendingRegistration } from '@soirely/api-client';

/** Create your account, saying the sign-up timed out, with the email it was held for (sc-29923). */
export interface TimedOut {
  pathname: '/register';
  params: { email: string; timedOut: string };
}

export function timedOutRoute(email: string): TimedOut {
  return { pathname: '/register', params: { email, timedOut: String(Date.now()) } };
}

/** On launch, a sign-up waiting on its code (no session since sc-512) goes back to it; a spent one is cleared and starts again. */
export async function resumeSignUp(store: {
  held: () => Promise<PendingRegistration | null>;
  open: (registration: string) => Promise<CodeOpening>;
  drop: () => Promise<void>;
}): Promise<'/verify-email' | TimedOut | null> {
  const pending = await store.held();
  if (pending == null) return null;

  try {
    await store.open(pending.registration);

    return '/verify-email';
  } catch (error) {
    if (error instanceof ApiError && error.is('registration_expired')) {
      await store.drop();

      return timedOutRoute(pending.email);
    }

    // Unreachable or refused for another reason: the screen itself says so, and keeps the handle.
    return '/verify-email';
  }
}

/** After launch's `me()` is refused: a held sign-up wins only on launch, an ended session says so anywhere. */
export async function launchRoute(
  ended: boolean,
  store: Parameters<typeof resumeSignUp>[0],
  onLaunch: () => boolean,
): Promise<'/verify-email' | TimedOut | '/sign-in?signedOut=1' | null> {
  const resumed = await resumeSignUp(store);
  if (resumed === '/verify-email') return onLaunch() ? resumed : null;
  if (ended) return '/sign-in?signedOut=1';

  return resumed != null && onLaunch() ? resumed : null;
}
