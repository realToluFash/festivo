/** The signed-out redirect, held back while launch asks who is signed in, so a held sign-up can win (sc-927). */
export function signedOutHold(redirect: () => void) {
  let held: { ended: boolean } | null = null;

  return {
    onSignedOut(): void {
      if (held != null) held.ended = true;
      else redirect();
    },

    async during<T>(
      work: () => Promise<T>,
    ): Promise<{ value: T; ended: boolean } | { error: unknown; ended: boolean }> {
      const hold = { ended: false };
      held = hold;

      try {
        return { value: await work(), ended: hold.ended };
      } catch (error) {
        return { error, ended: hold.ended };
      } finally {
        if (held === hold) held = null;
      }
    },
  };
}
