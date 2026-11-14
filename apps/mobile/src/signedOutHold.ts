import type { Problem } from '@soirely/api-client';

/** The signed-out redirect, held back while launch asks who is signed in, so a held sign-up can win (sc-927). */
export function signedOutHold(redirect: (why?: Problem) => void) {
  let held: { ended: boolean; why?: Problem } | null = null;

  return {
    /** `why` is the API's reason when it gave one, such as an organisation's inactivity limit (sc-69). */
    onSignedOut(why?: Problem): void {
      if (held == null) redirect(why);
      else {
        held.ended = true;
        if (why != null) held.why = why;
      }
    },

    async during<T>(
      work: () => Promise<T>,
    ): Promise<
      | { value: T; ended: boolean; why?: Problem }
      | { error: unknown; ended: boolean; why?: Problem }
    > {
      const hold: { ended: boolean; why?: Problem } = { ended: false };
      held = hold;

      try {
        return { value: await work(), ...hold };
      } catch (error) {
        return { error, ...hold };
      } finally {
        if (held === hold) held = null;
      }
    },
  };
}
