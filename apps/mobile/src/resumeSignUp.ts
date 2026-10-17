import { ApiError, type CodeOpening, type PendingRegistration } from '@soirely/api-client';

/** On launch, a sign-up waiting on its code (no session since sc-512) goes back to it; a spent one is cleared. */
export async function resumeSignUp(store: {
  held: () => Promise<PendingRegistration | null>;
  open: (registration: string) => Promise<CodeOpening>;
  drop: () => Promise<void>;
}): Promise<'/verify-email' | null> {
  const pending = await store.held();
  if (pending == null) return null;

  try {
    await store.open(pending.registration);

    return '/verify-email';
  } catch (error) {
    if (error instanceof ApiError && error.is('registration_expired')) {
      await store.drop();

      return null;
    }

    // Unreachable or refused for another reason: the screen itself says so, and keeps the handle.
    return '/verify-email';
  }
}
