import { type ReactNode, useEffect, useRef, useState } from 'react';

export const LONG_PRESS_MS = 500;
export const HINT_LINGER_MS = 1500;

/** A round icon button with its word in a hint above it, on hover, focus or a long press. The hint meets WCAG 1.4.13: Esc dismisses it, the pointer can move onto it, and it stays until hover and focus leave. */
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
  const [held, setHeld] = useState(false);
  const pressing = useRef<number | null>(null);
  const lingering = useRef<number | null>(null);
  const swallow = useRef(false);
  const shown = (over || focused || held) && !dismissed;

  function stopPressing() {
    if (pressing.current != null) window.clearTimeout(pressing.current);
    pressing.current = null;
  }

  useEffect(
    () => () => {
      if (pressing.current != null) window.clearTimeout(pressing.current);
      if (lingering.current != null) window.clearTimeout(lingering.current);
    },
    [],
  );

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
      className={['mn-icon', dismissed && 'is-dismissed', held && 'is-held']
        .filter(Boolean)
        .join(' ')}
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
        onPointerDown={(event) => {
          swallow.current = false;
          if (event.pointerType !== 'touch') return;
          stopPressing();
          if (lingering.current != null) window.clearTimeout(lingering.current);
          pressing.current = window.setTimeout(() => {
            pressing.current = null;
            swallow.current = true;
            setDismissed(false);
            setHeld(true);
          }, LONG_PRESS_MS);
        }}
        onPointerUp={() => {
          stopPressing();
          if (!swallow.current) return;
          lingering.current = window.setTimeout(() => setHeld(false), HINT_LINGER_MS);
        }}
        onPointerCancel={() => {
          stopPressing();
          swallow.current = false;
        }}
        onContextMenu={(event) => {
          if (swallow.current) event.preventDefault();
        }}
        onClick={() => {
          if (swallow.current) {
            swallow.current = false;
            return;
          }
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
