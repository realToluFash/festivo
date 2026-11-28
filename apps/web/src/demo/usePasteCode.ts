import { type RefObject, useState } from 'react';

import { codeInPaste } from './pasteCode.ts';

export type PasteCodeState = ReturnType<typeof usePasteCode>;

/** What a press found, and the line beside the button until the person types or presses again. */
export function usePasteCode(
  field: RefObject<HTMLInputElement | null>,
  onCode: (code: string) => void,
) {
  const [nothing, setNothing] = useState(false);

  function found(text: string): void {
    const code = codeInPaste(text);
    if (code == null) {
      setNothing(true);
      return;
    }
    setNothing(false);
    onCode(code);
    field.current?.focus();
  }

  /** Reads the clipboard on this press only. A browser that refuses or has no read leaves focus on the field and nothing else. */
  async function press(): Promise<void> {
    setNothing(false);
    const read = navigator.clipboard?.readText;
    if (read == null) {
      field.current?.focus();
      return;
    }
    try {
      found(await navigator.clipboard.readText());
    } catch {
      field.current?.focus();
    }
  }

  return { nothing, press, found, typed: () => setNothing(false) };
}
