import type { MouseEvent } from 'react';

/** Never `disabled`: HTML's focus fixup rule drops focus from a focused button that is (sc-11487). `dim: false` keeps its colours. */
export function offButton(
  off: boolean,
  { dim = true }: { dim?: boolean } = {},
): {
  'aria-disabled': boolean;
  'data-off': true | undefined;
  onClickCapture: (event: MouseEvent<HTMLButtonElement>) => void;
} {
  return {
    'aria-disabled': off,
    'data-off': (off && dim) || undefined,
    onClickCapture: (event) => {
      if (!off) return;

      event.preventDefault();
      event.stopPropagation();
    },
  };
}
