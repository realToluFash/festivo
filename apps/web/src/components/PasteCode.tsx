import { codeInPaste } from '@soirely/domain';
import { type RefObject, useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';

import './PasteCode.css';

/** The field a code goes in: an id, or a ref where the field makes its own id. */
export type CodeField = string | RefObject<HTMLInputElement | null>;

function fieldOf(field: CodeField): HTMLElement | null {
  return typeof field === 'string' ? document.getElementById(field) : field.current;
}

/** Puts a code in a field the way typing does, so a form that reads the field or listens to it sees it. */
function fill(field: HTMLInputElement, code: string): void {
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  set?.call(field, code);
  field.dispatchEvent(new Event('input', { bubbles: true }));
}

export function usePasteCode(codeField: CodeField) {
  const [nothing, setNothing] = useState(false);

  // Typing in the field takes the line away.
  useEffect(() => {
    function typed(event: Event): void {
      if (event.target === fieldOf(codeField)) setNothing(false);
    }
    document.addEventListener('input', typed);
    return () => document.removeEventListener('input', typed);
  }, [codeField]);

  async function press(): Promise<void> {
    const field = fieldOf(codeField);
    const focus = () => field?.focus();
    if (!(field instanceof HTMLInputElement)) return;
    const read = navigator.clipboard?.readText;
    if (read == null) return focus();
    let text: string;
    try {
      text = await navigator.clipboard.readText();
    } catch {
      return focus();
    }
    const code = codeInPaste(text);
    if (code == null) {
      setNothing(true);
      return;
    }
    setNothing(false);
    fill(field, code);
    focus();
  }

  return { nothing, press };
}

/** The Paste code button under a code field, and the line beside it that says nothing was found. */
export function PasteCode({ field }: { field: CodeField }) {
  const { t } = useTranslation();
  const { nothing, press } = usePasteCode(field);
  const lineId = useId();

  return (
    <div className="paste-code">
      <button
        type="button"
        className="button paste-code-button"
        aria-describedby={nothing ? lineId : undefined}
        onClick={() => void press()}
      >
        {t('pasteCode.button')}
      </button>
      <p className="paste-code-nothing" id={lineId} role="status">
        {nothing ? t('pasteCode.nothing') : ''}
      </p>
    </div>
  );
}
