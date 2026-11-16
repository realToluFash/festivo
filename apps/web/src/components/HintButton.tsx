import { type ReactNode, useEffect, useState } from 'react';

/** A round icon button with its word in a hint above it. The hint meets WCAG 1.4.13: Esc dismisses it, the pointer can move onto it, and it stays until hover and focus leave. */
export function HintButton({
  id,
  label,
  hint,
  className,
  disabled = false,
  onClick,
  children,
}: {
  id: string;
  label: string;
  hint: string;
  className?: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  const [over, setOver] = useState(false);
  const [focused, setFocused] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const shown = (over || focused) && !dismissed;

  useEffect(() => {
    if (!shown) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDismissed(true);
    };
    document.addEventListener('keydown', onKey);

    return () => document.removeEventListener('keydown', onKey);
  }, [shown]);

  return (
    <span
      className={dismissed ? 'mn-icon is-dismissed' : 'mn-icon'}
      onPointerEnter={() => setOver(true)}
      onPointerLeave={() => {
        setOver(false);
        if (!focused) setDismissed(false);
      }}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        if (!over) setDismissed(false);
      }}
    >
      <button
        id={id}
        type="button"
        className={
          className == null ? 'ev-round mn-icon-button' : `ev-round mn-icon-button ${className}`
        }
        aria-label={label}
        aria-disabled={disabled || undefined}
        onClick={() => {
          if (!disabled) onClick();
        }}
      >
        {children}
      </button>
      <span className="mn-hint" aria-hidden="true">
        {hint}
      </span>
    </span>
  );
}
