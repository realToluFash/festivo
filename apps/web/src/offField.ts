/** Never `disabled` on a field a form sends from: HTML's focus fixup rule drops focus from a focused field that is (sc-11588). Read-only takes no typing, so the form sends what it shows. */
export function offField(off: boolean): {
  readOnly: boolean;
  'aria-disabled': true | undefined;
} {
  return { readOnly: off, 'aria-disabled': off || undefined };
}

/** `land` before the field's line renders, or the line is read twice: once as its alert, once as the field's description. */
export function focusWhereSent(): (id: string) => void {
  const from = document.activeElement;

  return (id) => {
    const now = document.activeElement;
    if (now !== from && now !== document.body && now != null) return;

    document.getElementById(id)?.focus();
  };
}
