import { createContext } from 'react';

/** True while a phone window on Android slides in, the beat in which a field it opens with loses its focus (sc-91027). */
export const WindowArriving = createContext(false);

/** Raises the keys on the field it opened with as they rise and once more at `settledMs`, while nobody or that field holds focus, and never once the keys go down. Returns what stops it. */
export function holdOpenedFocus<Field>({
  field,
  holder,
  raise,
  onKeys,
  settledMs,
}: {
  field: () => Field | null;
  holder: () => Field | null | undefined;
  raise: (field: Field) => void;
  onKeys: (up: () => void, down: () => void) => () => void;
  settledMs: number;
}): () => void {
  const retake = () => {
    const opened = field();
    if (opened == null) return;
    const holding = holder();
    if (holding == null || holding === opened) raise(opened);
  };
  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    clearTimeout(settled);
    off();
  };
  const off = onKeys(retake, stop);
  const settled = setTimeout(() => {
    stop();
    retake();
  }, settledMs);

  return stop;
}
