import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../../api.ts';
import { Pending } from '../../components/Pending.tsx';

/**
 * The health endpoint, read through the shared client.
 *
 * Its job is to prove three things at once that are otherwise only proved in
 * production: the client package resolves and runs in a browser, the runtime
 * configuration produced a reachable base URL, and CORS is right. Each of those
 * fails silently in a skeleton with no API call in it.
 */
interface Health {
  status: string;
  checks: Record<string, { status: string; error?: string }>;
}

type State = { kind: 'loading' } | { kind: 'ok'; health: Health } | { kind: 'failed' };

export function Status() {
  const { t } = useTranslation();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;

    api
      .get<Health>('/api/health')
      .then((health) => {
        if (live) setState({ kind: 'ok', health });
      })
      .catch(() => {
        // Deliberately not surfacing the thrown message: it names a host and a
        // port, which is internal detail on a page anybody can open.
        if (live) setState({ kind: 'failed' });
      });

    return () => {
      live = false;
    };
  }, [attempt]);

  return (
    <main id="content" className="public-main">
      <h1>{t('status.title')}</h1>
      <p className="muted">{t('status.intro')}</p>

      {state.kind === 'loading' && <Pending />}

      {state.kind === 'failed' && (
        <div className="panel panel-error" role="alert">
          <p>{t('status.unreachable')}</p>
          <button type="button" onClick={() => setAttempt((n) => n + 1)}>
            {t('status.retry')}
          </button>
        </div>
      )}

      {state.kind === 'ok' && (
        <>
          <p role="status">
            {state.health.status === 'ok' ? t('status.healthy') : t('status.degraded')}
          </p>
          <table className="table">
            <thead>
              <tr>
                <th>{t('status.check')}</th>
                <th>{t('status.state')}</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(state.health.checks).map(([name, check]) => (
                <tr key={name}>
                  <td>{name}</td>
                  <td>{check.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </main>
  );
}
