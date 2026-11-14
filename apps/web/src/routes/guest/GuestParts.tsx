import type { ReactNode } from 'react';

import { Glyph } from '../../components/Glyph.tsx';
import { dateLocale } from '../../i18n/index.ts';
import { offButton } from '../../offButton.ts';

export function TextAction({
  children,
  off = false,
  ink = false,
  icon,
  focus,
  describedBy,
  onClick,
}: {
  children: ReactNode;
  off?: boolean;
  ink?: boolean;
  icon?: ReactNode;
  focus?: string;
  describedBy?: string;
  onClick?: () => void;
}) {
  return (
    <button
      className={`gp-text${ink ? ' is-ink' : ''}${off ? ' is-off' : ''}`}
      type="button"
      data-focus={focus}
      aria-describedby={describedBy}
      {...offButton(off, { dim: false })}
      onClick={onClick}
    >
      {icon}
      <span>{children}</span>
    </button>
  );
}

export function Filled({
  children,
  busy,
  focus,
  onClick,
}: {
  children: ReactNode;
  busy: boolean;
  focus?: string;
  onClick: () => void;
}) {
  return (
    <button
      className="gp-filled"
      type="button"
      data-focus={focus}
      aria-busy={busy}
      {...offButton(busy, { dim: false })}
      onClick={onClick}
    >
      {busy && <span className="gp-spinner" aria-hidden="true" />}
      {children}
    </button>
  );
}

export function Notice({
  kind,
  alert = kind === 'broken',
  children,
}: {
  kind: 'broken' | 'attention';
  alert?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`gp-notice is-${kind}`} role={alert ? 'alert' : 'status'}>
      <span className="gp-notice-mark" aria-hidden="true">
        {kind === 'broken' && <Glyph name="clear" size={14} weight={3} />}
      </span>
      <p>{children}</p>
    </div>
  );
}

export function readerZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}

export function format(at: string, timeZone: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(dateLocale(), { timeZone, ...options }).format(new Date(at));
}

/** The day an answer was given, in the event's zone, written for the reader's locale. */
export function dayOf(at: string, timeZone: string): string {
  return format(at, timeZone, { weekday: 'long', month: 'long', day: 'numeric' });
}
