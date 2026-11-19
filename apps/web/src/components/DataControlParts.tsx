import type { ReactNode } from 'react';

import { Glyph } from './Glyph.tsx';
import './DataControlParts.css';

type Shape = { d: string } | { cx: number; cy: number; r: number };

const DRAWN = {
  history: [
    { d: 'M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8' },
    { d: 'M3 3v5h5' },
    { d: 'M12 7v5l4 2' },
  ],
  download: [
    { d: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' },
    { d: 'm7 10 5 5 5-5' },
    { d: 'M12 15V3' },
  ],
  schedule: [
    { d: 'M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5' },
    { d: 'M16 2v4' },
    { d: 'M8 2v4' },
    { d: 'M3 10h5' },
    { d: 'M17.5 17.5 16 16.3V14' },
    { cx: 16, cy: 16, r: 6 },
  ],
  data: [
    { d: 'M3 5a9 3 0 1 0 18 0a9 3 0 1 0-18 0' },
    { d: 'M3 5v14a9 3 0 0 0 18 0V5' },
    { d: 'M3 12a9 3 0 0 0 18 0' },
  ],
} satisfies Record<string, readonly Shape[]>;

export type DrawnName = keyof typeof DRAWN;

/** The leads this area adds, drawn here rather than in the product's icon set. */
export function DrawnGlyph({ name, size = 22 }: { name: DrawnName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {DRAWN[name].map((shape: Shape, index) =>
        'd' in shape ? (
          <path key={index} d={shape.d} />
        ) : (
          <circle key={index} cx={shape.cx} cy={shape.cy} r={shape.r} />
        ),
      )}
    </svg>
  );
}

/** A line that says where something stands: amber's half-filled ring, or red's alert for a refusal. */
export function StatusLine({
  kind,
  alert = false,
  children,
}: {
  kind: 'waiting' | 'refused' | 'ended';
  alert?: boolean;
  children: ReactNode;
}) {
  return (
    <p className={`dc-status is-${kind}`} role={alert ? 'alert' : 'status'}>
      {kind === 'refused' ? (
        <Glyph name="alert" size={16} weight={2.2} />
      ) : (
        <span className={`desk-mark is-${kind}`} aria-hidden="true">
          {kind === 'ended' && <span />}
        </span>
      )}
      <span>{children}</span>
    </p>
  );
}

export function PageLoading({ words }: { words: string }) {
  return (
    <p className="dc-loading" role="status">
      <span className="pending-spinner" aria-hidden="true" />
      {words}
    </p>
  );
}
