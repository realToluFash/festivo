import { type RefObject, useEffect, useLayoutEffect } from 'react';

import { leaveDialog } from './leaving.ts';

/** Escape dismisses an open dialog unless it is locked while its request is in flight, Tab stays inside it, and it plays its exit as it closes. */
export function useDialogKeys(
  dialog: RefObject<HTMLElement | null>,
  onDismiss: () => void,
  locked: boolean,
): void {
  useLayoutEffect(() => {
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
  const stops = tabStops(dialog);
  const first = stops[0];
  const last = stops[stops.length - 1];

  if (first == null || last == null) {
    event.preventDefault();
    dialog.focus();
    return;
  }

  const active = document.activeElement;
  const inside = dialog.contains(active);

  if (event.shiftKey && (!inside || isAt(first, active))) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (!inside || isAt(last, active))) {
    event.preventDefault();
    first.focus();
  }
}

/** A choice list is one stop: its picked choice, or its first when none is picked (WAI-ARIA APG, Radio Group). */
function tabStops(dialog: HTMLElement): HTMLElement[] {
  const controls = [
    ...dialog.querySelectorAll<HTMLElement>('input, select, textarea, button, a[href]'),
  ].filter((control) => !control.matches(':disabled'));

  return controls.filter((control) => {
    const group = choicesWith(control, controls);

    return group.length === 0 || control === (group.find((choice) => choice.checked) ?? group[0]);
  });
}

function choicesWith(
  control: Element | null,
  controls: readonly HTMLElement[],
): HTMLInputElement[] {
  if (!(control instanceof HTMLInputElement) || control.type !== 'radio' || control.name === '') {
    return [];
  }

  return controls.filter(
    (other): other is HTMLInputElement =>
      other instanceof HTMLInputElement &&
      other.type === 'radio' &&
      other.name === control.name &&
      other.form === control.form,
  );
}

function isAt(stop: HTMLElement, active: Element | null): boolean {
  if (active === stop) return true;
  if (!(active instanceof HTMLInputElement) || !(stop instanceof HTMLInputElement)) return false;

  return (
    active.type === 'radio' &&
    stop.type === 'radio' &&
    active.name !== '' &&
    active.name === stop.name &&
    active.form === stop.form
  );
}
