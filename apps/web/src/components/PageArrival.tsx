import { type Ref, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigationType } from 'react-router';

import {
  Arriving,
  arriveAt,
  currentSection,
  pageStart,
  sharesHeading,
  unasked,
} from '../pageArrival.ts';
import { retitle } from '../pageTitle.ts';
import { SkipLinkSlot } from '../skipLinkSlot.ts';
import { ReleaseBand } from './ReleaseBand.tsx';

/** Focus goes where an opened page begins (WCAG 2.2 SC 2.4.3), and the tab names the page (SC 2.4.2). */
export function PageArrival() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const asked = useRef(false);
  const shown = useRef(location.pathname);
  const stopArriving = useRef<(() => void) | null>(null);
  const [arriving, setArriving] = useState(false);
  const [skipLinkSlot, setSkipLinkSlot] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    const ask = () => {
      asked.current = true;
    };
    const observer = new MutationObserver(retitle);

    document.addEventListener('click', ask, true);
    document.addEventListener('submit', ask, true);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    retitle();

    return () => {
      document.removeEventListener('click', ask, true);
      document.removeEventListener('submit', ask, true);
      observer.disconnect();
      stopArriving.current?.();
    };
  }, []);

  useLayoutEffect(() => {
    const from = shown.current;

    if (from === location.pathname) return;

    // A page that sends the person straight on, before its heading shows, passes their click to the next.
    const redirected = stopArriving.current != null;
    const opened =
      !unasked(location.state) && (navigationType === 'POP' || asked.current || redirected);

    stopArriving.current?.();
    shown.current = location.pathname;
    asked.current = false;

    if (!opened) return;

    window.scrollTo(0, 0);
    setArriving(true);
    stopArriving.current = arriveAt(
      sharesHeading(from, location.pathname) ? currentSection : pageStart,
      () => {
        stopArriving.current = null;
        setArriving(false);
      },
    );
  }, [location, navigationType]);

  return (
    <Arriving.Provider value={arriving}>
      <SkipLinkSlot.Provider value={skipLinkSlot}>
        <div className="frame">
          <div ref={setSkipLinkSlot} />
          <ReleaseBand />
          <Outlet />
        </div>
      </SkipLinkSlot.Provider>
    </Arriving.Provider>
  );
}

/** Says the page did not load; as the page opens, focus lands on its line and is read once, not also as an alert. */
export function ArrivalNotice({
  role,
  line,
  lineRef,
  focusable,
  retry,
  onRetry,
}: {
  role: 'alert' | undefined;
  line: string;
  lineRef: Ref<HTMLParagraphElement>;
  focusable: boolean;
  retry: string;
  onRetry: () => void;
}) {
  const arriving = useContext(Arriving);
  const [taking] = useState(arriving);

  return (
    <div className="notice notice-broken" role={taking ? undefined : role}>
      <span className="mark mark-broken" aria-hidden="true">
        ✕
      </span>
      <div className="notice-body">
        <p
          ref={lineRef}
          tabIndex={taking || focusable ? -1 : undefined}
          data-page-focus={taking ? '' : undefined}
        >
          {line}
        </p>
        <button type="button" className="button" onClick={onRetry}>
          {retry}
        </button>
      </div>
    </div>
  );
}
