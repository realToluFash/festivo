import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import type { LinkRetry } from '../linkRetry.ts';
import { AuthPage } from './AuthPage.tsx';

/** A link that could not be read, drawn as the page itself; a failed Try again lands back on its heading. */
export function LinkRetryPage({
  title,
  body,
  retry,
  role,
}: {
  title: string;
  body: string;
  retry: LinkRetry;
  role?: 'status';
}) {
  const { t } = useTranslation();
  const heading = useRef<HTMLDivElement>(null);
  const wasRetrying = useRef(false);

  useEffect(() => {
    if (wasRetrying.current && !retry.retrying) heading.current?.focus();
    wasRetrying.current = retry.retrying;
  }, [retry.retrying]);

  return (
    <AuthPage bare end={null}>
      <div className="auth-heading" ref={heading} role={role} tabIndex={-1}>
        <h1>{title}</h1>
        <p>{body}</p>
      </div>
      <button
        className="button button-primary"
        type="button"
        disabled={retry.retrying}
        aria-busy={retry.retrying}
        onClick={retry.again}
      >
        {retry.retrying ? t('session.retrying') : t('error.retry')}
      </button>
    </AuthPage>
  );
}
