import { type RefObject, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

/** Hidden by default, and hidden again on submit and when the tab is left. Paste always works. */
export function PasswordField({
  id,
  autoComplete,
  wrong = false,
  disabled = false,
  submitting = false,
  describedBy,
  value,
  inputRef,
  onChange,
  onBlur,
}: {
  id: string;
  autoComplete: 'current-password' | 'new-password';
  wrong?: boolean;
  disabled?: boolean;
  submitting?: boolean;
  describedBy?: string | undefined;
  value?: string;
  inputRef?: RefObject<HTMLInputElement | null>;
  onChange?: (typed: string) => void;
  onBlur?: (typed: string) => void;
}) {
  const { t } = useTranslation();
  const [revealed, setRevealed] = useState(false);
  const [wasSubmitting, setWasSubmitting] = useState(submitting);

  if (submitting !== wasSubmitting) {
    setWasSubmitting(submitting);
    if (submitting) setRevealed(false);
  }

  useEffect(() => {
    const hide = () => {
      if (document.visibilityState === 'hidden') setRevealed(false);
    };

    document.addEventListener('visibilitychange', hide);

    return () => document.removeEventListener('visibilitychange', hide);
  }, []);

  return (
    <div className="field-reveal">
      <input
        ref={inputRef}
        className={wrong ? 'input input-wrong' : 'input'}
        id={id}
        name={id}
        type={revealed ? 'text' : 'password'}
        autoComplete={autoComplete}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        disabled={disabled}
        value={value}
        required
        aria-invalid={wrong}
        aria-describedby={describedBy}
        onChange={onChange == null ? undefined : (event) => onChange(event.target.value)}
        onBlur={onBlur == null ? undefined : (event) => onBlur(event.target.value)}
      />
      <button
        type="button"
        aria-pressed={revealed}
        aria-controls={id}
        onClick={() => setRevealed((shown) => !shown)}
      >
        {revealed ? t('signIn.conceal') : t('signIn.reveal')}
      </button>
    </div>
  );
}
