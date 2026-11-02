import { ApiError, type RecoveryRequest } from '@soirely/api-client';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../../../api.ts';
import { ActionPair } from '../../../components/ActionPair.tsx';
import { useStepFocus } from '../../../stepFocus.ts';

type Asking = { id: string; answer: 'approve' | 'turnDown' } | null;
type Done = { name: string; answer: 'approve' | 'turnDown' } | null;

/** "Requests to get back in" (sc-509), on General until Members exists: no card when none wait. */
export function RecoveryRequestsCard() {
  const { t } = useTranslation();
  const [requests, setRequests] = useState<RecoveryRequest[]>([]);
  const [asking, setAsking] = useState<Asking>(null);
  const [done, setDone] = useState<Done>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const panel = useRef<HTMLHeadingElement>(null);
  const flash = useRef<HTMLDivElement>(null);
  const [back, setBack] = useState<Asking>(null);
  const [opener, arriveAtOpener] = useStepFocus<HTMLButtonElement>();

  useEffect(() => {
    let live = true;

    api
      .recoveryRequests()
      .then((found) => {
        if (live) setRequests(found);
      })
      .catch(() => {});

    return () => {
      live = false;
    };
  }, []);

  useEffect(() => panel.current?.focus(), [asking]);
  useEffect(() => flash.current?.focus(), [done]);

  function keep(request: RecoveryRequest, kind: 'approve' | 'turnDown'): void {
    setAsking(null);
    setBack({ id: request.id, answer: kind });
    arriveAtOpener();
  }

  async function answer(request: RecoveryRequest, kind: 'approve' | 'turnDown'): Promise<void> {
    setProblem(null);

    try {
      await (kind === 'approve'
        ? api.approveRecovery(request.id)
        : api.turnDownRecovery(request.id));
      setAsking(null);
      setDone({ name: request.name, answer: kind });
      setRequests((now) => now.filter((other) => other.id !== request.id));
    } catch (refusal) {
      setProblem(
        refusal instanceof ApiError && refusal.is('recovery_request_closed')
          ? t('recoveryRequests.closed')
          : t('recoveryRequests.failed'),
      );
    }
  }

  return (
    <>
      {done != null && (
        <div className="notice notice-done" tabIndex={-1} ref={flash}>
          <span className="mark mark-done" aria-hidden="true">
            ✓
          </span>
          <div className="notice-body">
            <p className="notice-title">
              {done.answer === 'approve'
                ? t('recoveryRequests.approved', { name: done.name })
                : t('recoveryRequests.turnedDown', { name: done.name })}
            </p>
            <p>
              {done.answer === 'approve'
                ? t('recoveryRequests.approvedNext')
                : t('recoveryRequests.turnedDownNext')}
            </p>
          </div>
        </div>
      )}

      {requests.length > 0 && (
        <section className="card settings-card" id="requests" aria-labelledby="requests-title">
          <div className="request-card-head">
            <h2 id="requests-title">{t('recoveryRequests.cardTitle')}</h2>
            <p className="field-help">{t('recoveryRequests.cardNote')}</p>
          </div>
          {requests.map((request) => {
            const proved = request.own
              ? request.provedPhone
                ? t('recoveryRequests.provedBothOwn')
                : t('recoveryRequests.provedEmailOwn')
              : request.provedPhone
                ? t('recoveryRequests.provedBoth')
                : t('recoveryRequests.provedEmail');
            const here = asking?.id === request.id ? asking.answer : null;
            const backTo = back?.id === request.id ? back.answer : null;

            return (
              <article
                className="request"
                key={request.id}
                aria-labelledby={`request-${request.id}`}
              >
                <p className="request-state request-state-attention">
                  <span className="mark mark-attention" aria-hidden="true">
                    …
                  </span>
                  <span>{t('recoveryRequests.mark')}</span>
                </p>
                <h3 id={`request-${request.id}`}>{t('recoveryRequests.title')}</h3>
                <p className="field-help">{t('recoveryRequests.intro')}</p>

                <div className="request-card-row">
                  <strong>
                    {request.own ? t('recoveryRequests.you', { name: request.name }) : request.name}
                  </strong>
                  <span className="field-help">{request.email}</span>
                  <span>{proved}</span>
                  <span className="field-help">
                    {t('recoveryRequests.when', { asked: request.asked, expires: request.expires })}
                  </span>

                  {request.own ? (
                    <div className="notice notice-quiet">
                      <p>
                        {t('recoveryRequests.own', {
                          organisations: new Intl.ListFormat(undefined, {
                            type: 'conjunction',
                          }).format(request.organisations),
                        })}
                      </p>
                    </div>
                  ) : here == null ? (
                    <div className="actions">
                      <button
                        className="button button-primary"
                        type="button"
                        ref={backTo === 'approve' ? opener : undefined}
                        onClick={() => setAsking({ id: request.id, answer: 'approve' })}
                      >
                        {t('recoveryRequests.approve')}
                      </button>
                      <button
                        className="button button-danger"
                        type="button"
                        ref={backTo === 'turnDown' ? opener : undefined}
                        onClick={() => setAsking({ id: request.id, answer: 'turnDown' })}
                      >
                        {t('recoveryRequests.turnDown')}
                      </button>
                    </div>
                  ) : (
                    <div className="notice notice-quiet">
                      <div className="notice-body">
                        <h4 ref={panel} tabIndex={-1} className="notice-heading">
                          {here === 'approve'
                            ? t('recoveryRequests.approveTitle', { name: request.name })
                            : t('recoveryRequests.turnDownTitle', { name: request.name })}
                        </h4>
                        <p>
                          {here === 'approve'
                            ? t('recoveryRequests.approveBody')
                            : t('recoveryRequests.turnDownBody')}
                        </p>
                        {problem != null && <p role="alert">{problem}</p>}
                        <ActionPair
                          dismiss={
                            <button
                              className={here === 'approve' ? 'button' : 'link-button'}
                              type="button"
                              onClick={() => keep(request, here)}
                            >
                              {here === 'approve'
                                ? t('recoveryRequests.cancel')
                                : t('recoveryRequests.keep')}
                            </button>
                          }
                          confirm={
                            <button
                              className={
                                here === 'approve'
                                  ? 'button button-primary'
                                  : 'button button-danger'
                              }
                              type="button"
                              onClick={() => void answer(request, here)}
                            >
                              {here === 'approve'
                                ? t('recoveryRequests.approveConfirm')
                                : t('recoveryRequests.turnDownConfirm')}
                            </button>
                          }
                        />
                      </div>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      )}
    </>
  );
}
