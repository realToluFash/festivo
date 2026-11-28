export function FieldError({ id, message }: { id: string; message: string | undefined }) {
  if (message == null) return null;

  return (
    <div className="field-error" id={id}>
      <span className="mark mark-broken" aria-hidden="true">
        ✕
      </span>
      <p>{message}</p>
    </div>
  );
}
