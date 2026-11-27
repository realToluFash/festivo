import type { ReactNode } from 'react';

import { Glyph } from '../../components/Glyph.tsx';
import { dateLocale } from '../../i18n/index.ts';
import { offButton } from '../../offButton.ts';

export function TextAction({
  children,
  off = false,
  busy = false,
  ink = false,
  icon,
  focus,
  describedBy,
  onClick,
}: {
  children: ReactNode;
  off?: boolean;
  busy?: boolean;
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
      aria-busy={busy || undefined}
      {...offButton(off || busy, { dim: false })}
      onClick={onClick}
    >
      {busy ? <span className="gp-spinner is-small" aria-hidden="true" /> : icon}
      <span>{children}</span>
    </button>
  );
}

export function Filled({
  children,
  busy,
  focus,
  wraps = false,
  onClick,
}: {
  children: ReactNode;
  busy: boolean;
  focus?: string;
  /** A label that may run to two lines or more, never cut (sc-3969's Stop emails). */
  wraps?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={wraps ? 'gp-filled is-wraps' : 'gp-filled'}
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
  action,
  className,
  children,
}: {
  kind: 'broken' | 'attention';
  alert?: boolean;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`gp-notice is-${kind}${className == null ? '' : ` ${className}`}`}
      role={alert ? 'alert' : 'status'}
    >
      <span className="gp-notice-mark" aria-hidden="true">
        {kind === 'broken' && <Glyph name="clear" size={14} weight={3} />}
      </span>
      {action == null ? (
        <p>{children}</p>
      ) : (
        <div className="gp-unsaved-words">
          <p>{children}</p>
          {action}
        </div>
      )}
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

/** A calendar day the event set, such as Reply by, written for the reader's locale with no zone to move it. */
export function wallDayOf(day: string): string {
  return dayOf(`${day}T12:00:00Z`, 'UTC');
}

/** The day an answer was given, in the event's zone, written for the reader's locale. */
export function dayOf(at: string, timeZone: string): string {
  return format(at, timeZone, { weekday: 'long', month: 'long', day: 'numeric' });
}
