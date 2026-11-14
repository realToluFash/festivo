export function OrLine({ words }: { words: string }) {
  return (
    <div className="auth-or">
      <span className="auth-or-rule" />
      <span>{words}</span>
      <span className="auth-or-rule" />
    </div>
  );
}
