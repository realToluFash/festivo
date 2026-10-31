import { type RefObject, useEffect } from 'react';

import { leaveDialog } from './leaving.ts';

/** Escape dismisses an open dialog unless it is locked while its request is in flight, Tab stays inside it, and it plays its exit as it closes. */
export function useDialogKeys(
  dialog: RefObject<HTMLElement | null>,
  onDismiss: () => void,
  locked: boolean,
): void {
  useEffect(() => {
    const keys = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && !locked) onDismiss();
      if (event.key === 'Tab' && dialog.current != null) keepFocusIn(dialog.current, event);
    };

    document.addEventListener('keydown', keys);

    return () => document.removeEventListener('keydown', keys);
  }, [dialog, onDismiss, locked]);

  useEffect(() => {
    const node = dialog.current;
    const parent = node?.parentElement;

    if (node == null || parent == null) return;

    const before = node.previousElementSibling;
    const scrim = before?.classList.contains('dialog-scrim') ? before : null;

    return () => {
      // Still in the page means React is only remounting it (StrictMode), not closing it.
      if (!node.isConnected) leaveDialog(node, scrim, parent);
    };
  }, [dialog]);
}

/** Tab and Shift+Tab wrap inside an open dialog rather than leaving it. */
export function keepFocusIn(dialog: HTMLElement, event: KeyboardEvent): void {
  const controls = [
    ...dialog.querySelectorAll<HTMLElement>('input, select, textarea, button, a[href]'),
  ].filter((control) => !control.matches(':disabled'));
  const first = controls[0];
  const last = controls[controls.length - 1];

  if (first == null || last == null) {
    event.preventDefault();
    dialog.focus();
    return;
  }

  const inside = dialog.contains(document.activeElement);

  if (event.shiftKey && (!inside || document.activeElement === first)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (!inside || document.activeElement === last)) {
    event.preventDefault();
    first.focus();
  }
}
