import { type KeyboardEvent, useState } from 'react';

/** Focus stays in the input and `aria-activedescendant` names the active option, so the options themselves never hear a key. */
export function useComboboxKeys({
  count,
  onPick,
  onEscape,
  onEnter,
}: {
  count: number;
  onPick: (index: number) => void;
  onEscape: () => void;
  onEnter?: () => void;
}) {
  const [active, setActive] = useState(-1);
  const picking = active >= 0 && active < count;

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'ArrowDown' && count > 0) {
      event.preventDefault();
      setActive((index) => Math.min(index + 1, count - 1));
    } else if (event.key === 'ArrowUp' && count > 0) {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter' && (picking || onEnter != null)) {
      event.preventDefault();
      if (picking) onPick(active);
      else onEnter?.();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      onEscape();
    }
  }

  return { active: picking ? active : -1, setActive, onKeyDown };
}
