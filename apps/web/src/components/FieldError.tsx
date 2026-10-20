import type { ReactNode } from 'react';

/** The red mark and its sentence under a field; `children` are any ways out of the refusal. */
export function FieldError({
  id,
  message,
  children,
}: {
  id: string;
  message: string;
  children?: ReactNode;
}) {
  return (
    <div className="field-error" id={id} role="alert">
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
