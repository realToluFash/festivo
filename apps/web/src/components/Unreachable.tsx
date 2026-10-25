import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { retrySession, useSessionState } from '../session.ts';
import { focusStep, useStepFocus } from '../stepFocus.ts';
import { LanguageChoice } from './LanguageChoice.tsx';

/** No sign-in heading or form: the person is still signed in, and those would say otherwise. */
export function Unreachable() {
  const { t } = useTranslation();
  const state = useSessionState();
  const retrying = state.status === 'unreachable' && state.retrying;
  const [pressed, setPressed] = useState(false);
  const [notice, arriveAtNotice] = useStepFocus<HTMLDivElement>();
  const retried = useRef(false);

  useEffect(
    () => () => {
      if (retried.current) landOnPageHeading();
    },
    [],
  );

  async function retry(): Promise<void> {
    setPressed(true);
    retried.current = true;
    await retrySession();
    arriveAtNotice();
  }

  return (
    <div className="auth">
      <header className="auth-header">
        <span className="brand">{t('app.name')}</span>
        <LanguageChoice />
      </header>

      <main id="content" className="auth-main">
        <section className="auth-card">
          <div className="notice notice-quiet" role={pressed ? undefined : 'status'}>
            <span className="mark mark-info" aria-hidden="true">
              i
            </span>
            <div className="notice-body" ref={notice} tabIndex={pressed ? -1 : undefined}>
              <h1 className="notice-heading">{t('session.unreachableTitle')}</h1>
              <p>{t('session.unreachableBody')}</p>
            </div>
          </div>

          <button
            className="button button-primary"
            type="button"
            disabled={retrying}
            aria-busy={retrying}
            onClick={() => void retry()}
          >
            {retrying ? t('session.retrying') : t('error.retry')}
          </button>
        </section>
      </main>
    </div>
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
