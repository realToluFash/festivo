export interface StepOpeners<Opener> {
  /** The ref an opener named `key` takes: the same function on every render, so it is never detached and attached again. */
  ref(key: string): (opener: Opener | null) => void;
  /** The opener named `key` while it is on screen, or else `fallback`. */
  target<Fallback>(key: string | null, fallback: Fallback | null): Opener | Fallback | null;
}

/** The buttons that open a card's steps, by name, so a step closed without a change can send focus back to its opener (sc-11173). */
export function stepOpeners<Opener>(): StepOpeners<Opener> {
  const shown = new Map<string, Opener>();
  const refs = new Map<string, (opener: Opener | null) => void>();

  return {
    ref(key) {
      let ref = refs.get(key);
      if (ref == null) {
        ref = (opener) => {
          if (opener == null) shown.delete(key);
          else shown.set(key, opener);
        };
        refs.set(key, ref);
      }

      return ref;
    },
    target(key, fallback) {
      return (key == null ? undefined : shown.get(key)) ?? fallback;
    },
  };
}
