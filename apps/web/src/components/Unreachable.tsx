import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { LinkRetry } from '../linkRetry.ts';
import { usePageTitle } from '../pageTitle.ts';
import { retrySession, useSessionState } from '../session.ts';
import { focusStep, useStepFocus } from '../stepFocus.ts';
import { AuthPage } from './AuthPage.tsx';
import { LinkRetryPage } from './LinkRetryPage.tsx';

/** No sign-in heading or form, which would tell somebody signed in otherwise. Without `retry`, Try again reads the account. */
export function Unreachable({
  signedIn,
  retry,
  brought = false,
  bare = false,
}: {
  signedIn: boolean;
  retry?: LinkRetry;
  /** Opened by a Try again on another page, so it takes focus rather than announcing itself. */
  brought?: boolean;
  bare?: boolean;
}) {
  const { t } = useTranslation();
  const state = useSessionState();
  const retrying = state.status === 'unreachable' && state.retrying;
  const [pressed, setPressed] = useState(false);
  const [notice, arriveAtNotice] = useStepFocus<HTMLDivElement>();
  const retried = useRef(false);

  usePageTitle(t('session.unreachableTitle'));

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

  const tryAgain = (
    <button
      className="button button-primary"
      type="button"
      disabled={retrying}
      aria-busy={retrying}
      onClick={() => void retryAccount()}
    >
      {retrying ? t('session.retrying') : t('error.retry')}
    </button>
  );

  const body = signedIn ? t('session.unreachableBody') : t('session.unreachableBodySignedOut');

  if (retry != null)
    return (
      <LinkRetryPage
        title={t('session.unreachableTitle')}
        body={body}
        retry={retry}
        role="status"
        brought={brought}
      />
    );

  // Creating an account's steps draw it as the page itself (WebNewAccount, page 27).
  if (bare) {
    return (
      <AuthPage bare end={null}>
        <div
          className="auth-heading"
          ref={notice}
          role={pressed ? undefined : 'status'}
          tabIndex={pressed ? -1 : undefined}
        >
          <h1>{t('session.unreachableTitle')}</h1>
          <p>{body}</p>
        </div>
        {tryAgain}
      </AuthPage>
    );
  }

  return (
    <AuthPage>
      <div className="notice notice-quiet" role={pressed ? undefined : 'status'}>
        <span className="mark mark-info" aria-hidden="true">
          i
        </span>
        <div className="notice-body" ref={notice} tabIndex={pressed ? -1 : undefined}>
          <h1 className="notice-heading">{t('session.unreachableTitle')}</h1>
          <p>{body}</p>
        </div>
      </div>

      {tryAgain}
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
