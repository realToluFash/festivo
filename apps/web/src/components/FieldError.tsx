import type { ReactNode } from 'react';

/** The red mark and its sentence under a field; `children` are any ways out of the refusal. */
export function FieldError({
  id,
  message,
  quiet = false,
  focusable = false,
  children,
}: {
  id: string;
  message: string;
  quiet?: boolean;
  /** Takes focus when its refusal leaves nothing nearer to land on: a row whose Ask has closed. */
  focusable?: boolean;
  children?: ReactNode;
}) {
  return (
    <div
      className="field-error"
      id={id}
      role={quiet ? undefined : 'alert'}
      tabIndex={focusable ? -1 : undefined}
    >
      <span className="mark mark-broken" aria-hidden="true">
        ✕
      </span>
      {children == null ? (
        <p>{message}</p>
      ) : (
        <div className="field-error-body">
          <p>{message}</p>
          {children}
        </div>
      )}
    </div>
  );
}
