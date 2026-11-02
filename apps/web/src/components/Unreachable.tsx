import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { LinkRetry } from '../linkRetry.ts';
import { usePageTitle } from '../pageTitle.ts';
import { retrySession, useSessionState } from '../session.ts';
import { focusStep, useStepFocus } from '../stepFocus.ts';
import { AuthPage } from './AuthPage.tsx';

/** No sign-in heading or form, which would tell somebody signed in otherwise. Without `retry`, Try again reads the account. */
export function Unreachable({ signedIn, retry }: { signedIn: boolean; retry?: LinkRetry }) {
  const { t } = useTranslation();
  const state = useSessionState();
  const retrying = retry?.retrying ?? (state.status === 'unreachable' && state.retrying);
  const linked = retry != null;
  const linkNotice = useRef<HTMLDivElement>(null);
  const wasRetrying = useRef(false);
  const [pressed, setPressed] = useState(false);
  const [notice, arriveAtNotice] = useStepFocus<HTMLDivElement>();
  const retried = useRef(false);

  usePageTitle(t('session.unreachableTitle'));

  useEffect(() => {
    if (linked && wasRetrying.current && !retrying) linkNotice.current?.focus();
    wasRetrying.current = retrying;
  }, [linked, retrying]);

  useEffect(
    () => () => {
      if (retried.current) landOnPageHeading();
    },
    [],
  );

  async function retryAccount(): Promise<void> {
    setPressed(true);
    retried.current = true;
    await retrySession();
    arriveAtNotice();
  }

  return (
    <AuthPage>
      <div
        ref={linkNotice}
        className="notice notice-quiet"
        role={pressed ? undefined : 'status'}
        tabIndex={linked ? -1 : undefined}
      >
        <span className="mark mark-info" aria-hidden="true">
          i
        </span>
        <div className="notice-body" ref={notice} tabIndex={pressed ? -1 : undefined}>
          <h1 className="notice-heading">{t('session.unreachableTitle')}</h1>
          <p>{signedIn ? t('session.unreachableBody') : t('session.unreachableBodySignedOut')}</p>
        </div>
      </div>

      <button
        className="button button-primary"
        type="button"
        disabled={retrying}
        aria-busy={retrying}
        onClick={() => void (retry == null ? retryAccount() : retry.again())}
      >
        {retrying ? t('session.retrying') : t('error.retry')}
      </button>
    </AuthPage>
  );
}

const PAGE_HEADING_WAIT_MS = 10_000;

/** Once Soirely answers, focus goes to the heading of the page that shows, as soon as it shows. */
function landOnPageHeading(): void {
  const stop = (): void => {
    watching.disconnect();
    clearTimeout(giveUp);
    document.removeEventListener('focusin', stop);
  };
  const land = (): boolean => {
    const heading = document.querySelector<HTMLElement>('#content h1');
    if (heading == null) return false;

    stop();
    if (!heading.hasAttribute('tabindex')) heading.tabIndex = -1;
    focusStep(heading);
    return true;
  };
  const watching = new MutationObserver(() => void land());
  const giveUp = setTimeout(stop, PAGE_HEADING_WAIT_MS);

  if (land()) return;

  watching.observe(document.body, { childList: true, subtree: true });
  // Somebody who moves on by hand while the page loads keeps where they went.
  document.addEventListener('focusin', stop);
}
