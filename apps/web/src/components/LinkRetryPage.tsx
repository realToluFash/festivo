import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import type { LinkRetry } from '../linkRetry.ts';
import { AuthPage } from './AuthPage.tsx';

/** A link that could not be read, drawn as the page itself; a Try again that ends here, `brought` from another page or not, lands on its heading. */
export function LinkRetryPage({
  title,
  body,
  retry,
  role,
  brought = false,
}: {
  title: string;
  body: string;
  retry: LinkRetry;
  role?: 'status';
  brought?: boolean;
}) {
  const { t } = useTranslation();
  const heading = useRef<HTMLDivElement>(null);
  const wasRetrying = useRef(false);
  const arrived = useRef(brought);

  useEffect(() => {
    if (arrived.current) heading.current?.focus();
  }, []);

  useEffect(() => {
    if (wasRetrying.current && !retry.retrying) heading.current?.focus();
    wasRetrying.current = retry.retrying;
  }, [retry.retrying]);

  return (
    <AuthPage bare end={null}>
      <div className="auth-heading" ref={heading} role={brought ? undefined : role} tabIndex={-1}>
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
