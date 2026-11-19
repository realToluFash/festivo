import { type ReactNode, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { LockTag as ProductLockTag } from '../components/DataControlParts.tsx';
import { BackRow, type Tell, TextAction, TitleRow } from '../components/SettingsParts.tsx';
import { DemoBell } from './DemoBell.tsx';
import { type DataControlPage, SHARED_WORDS as S, dataControlPath } from './dataControl.ts';
import type { Viewer } from './settings.ts';
import './dataControl.css';

export {
  DrawnGlyph,
  type DrawnName,
  NoTag,
  PageLoading,
  StatusLine,
} from '../components/DataControlParts.tsx';

export function LockTag() {
  return <ProductLockTag word={S.enterprise} />;
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

export function PageFailed({ words, onRetry }: { words: string; onRetry: () => void }) {
  return (
    <div className="desk-failed" role="alert">
      <h2>{words}</h2>
      <p className="desk-line">{S.failedLine}</p>
      <TextAction label={S.tryAgain} onClick={onRetry} />
    </div>
  );
}
