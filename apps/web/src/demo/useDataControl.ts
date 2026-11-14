import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';

import { type DataControlPage, dataControlPath } from './dataControl.ts';
import type { Viewer } from './settings.ts';

/** Opens a page of the area, the focus landing on its title. */
export function useOpen(viewer: Viewer): (page: DataControlPage, state?: string) => void {
  const navigate = useNavigate();

  return (page, state) =>
    void navigate(dataControlPath(page, viewer, state), { state: { landed: true } });
}

const RETRY_MS = 1200;

export type Load = 'loaded' | 'loading' | 'failed';

/** A page's own load: Try again shows it loading a moment, then loaded. */
export function useLoad(start: Load): [Load, () => void] {
  const [load, setLoad] = useState<Load | 'retrying'>(start);

  useEffect(() => {
    if (load !== 'retrying') return;
    const timer = setTimeout(() => setLoad('loaded'), RETRY_MS);

    return () => clearTimeout(timer);
  }, [load]);

  return [load === 'retrying' ? 'loading' : load, () => setLoad('retrying')];
}
