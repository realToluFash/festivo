import { type ReactNode, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
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

/** Focus goes where an opened page begins (WCAG 2.2 SC 2.4.3), and the tab names the page (SC 2.4.2). */
export function PageArrival() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const asked = useRef(false);
  const shown = useRef(location.pathname);
  const stopArriving = useRef<(() => void) | null>(null);
  const [arriving, setArriving] = useState(false);

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
      <Outlet />
    </Arriving.Provider>
  );
}

/** A notice that takes focus as its page opens is read once, as focus lands, not also as it appears. */
export function ArrivalNotice({
  className,
  role,
  children,
}: {
  className: string;
  role: 'alert' | 'status';
  children: ReactNode;
}) {
  const arriving = useContext(Arriving);
  const [taking] = useState(arriving);

  return taking ? (
    <div className={className} tabIndex={-1} data-page-focus="">
      {children}
    </div>
  ) : (
    <div className={className} role={role}>
      {children}
    </div>
  );
}
