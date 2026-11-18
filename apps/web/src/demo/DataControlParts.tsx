import { type ReactNode, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { Glyph } from '../components/Glyph.tsx';
import { BackRow, type Tell, TextAction, TitleRow } from '../components/SettingsParts.tsx';
import { DemoBell } from './DemoBell.tsx';
import { type DataControlPage, SHARED_WORDS as S, dataControlPath } from './dataControl.ts';
import type { Viewer } from './settings.ts';
import './dataControl.css';

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

export function LockTag() {
  return (
    <span className="desk-tag">
      <Glyph name="lock" size={13} weight={2.4} />
      {S.enterprise}
    </span>
  );
}

/** Not proved: red, a circle with a cross, and the word. */
export function NoTag({ word }: { word: string }) {
  return (
    <span className="desk-tag dc-tag-no">
      <span className="dc-mark-no" aria-hidden="true">
        <svg width="8" height="8" viewBox="0 0 8 8" focusable="false">
          <path d="M2 2l4 4M6 2 2 6" />
        </svg>
      </span>
      {word}
    </span>
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

export function Turning({ words }: { words: string }) {
  return (
    <p className="dc-turning" role="status">
      <span className="pending-spinner desk-turning" aria-hidden="true" />
      {words}
    </p>
  );
}

/** A page one level down: ‹ Data and control, its title, then the page. The hub has the title alone. */
export function SubPage({
  page,
  title,
  viewer,
  tell,
  children,
}: {
  page: DataControlPage;
  title: string;
  viewer: Viewer;
  tell: Tell;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const { state } = useLocation() as { state: { landed?: boolean } | null };
  const landed = state?.landed === true;

  useEffect(() => {
    if (landed) document.querySelector<HTMLElement>('.desk-main h1')?.focus();
  }, [landed]);

  return (
    <div className="desk-page">
      <div className="desk-column">
        {page === 'hub' ? (
          <TitleRow title={title} bell={<DemoBell tell={tell} />} />
        ) : (
          <>
            <BackRow
              to={S.back}
              onBack={() =>
                void navigate(dataControlPath('hub', viewer), { state: { landed: true } })
              }
              bell={<DemoBell tell={tell} />}
            />
            <TitleRow title={title} />
          </>
        )}
        {children}
      </div>
    </div>
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

export function PageFailed({ words, onRetry }: { words: string; onRetry: () => void }) {
  return (
    <div className="desk-failed" role="alert">
      <h2>{words}</h2>
      <p className="desk-line">{S.failedLine}</p>
      <TextAction label={S.tryAgain} onClick={onRetry} />
    </div>
  );
}
