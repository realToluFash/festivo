export function DownloadMark() {
  return (
    <svg className="kitchen-mark" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
    </svg>
  );
}

export function PrintMark() {
  return (
    <svg className="kitchen-mark" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" rx="1" />
    </svg>
  );
}

export type CellState = 'kitchen' | 'skipped' | 'host' | 'changed' | 'notYet' | 'never';

/** Each state a shape with its word: Needs the host a triangle, Skipped a circle with a minus, not chosen a dashed circle. */
export function StateMark({ kind }: { kind: CellState }) {
  if (kind === 'host')
    return (
      <svg className="ks-mark" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M8 2 14.5 13.5h-13Z" />
      </svg>
    );
  if (kind === 'skipped')
    return (
      <svg className="ks-mark" viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="8" cy="8" r="6" />
        <path d="M5 8h6" />
      </svg>
    );
  if (kind === 'notYet' || kind === 'never')
    return (
      <svg className="ks-mark" viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="8" cy="8" r="6" className="is-dashed" />
      </svg>
    );

  return null;
}
