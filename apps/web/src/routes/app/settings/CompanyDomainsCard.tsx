import { ApiError, type CompanyDomains, type Membership } from '@soirely/api-client';
import { companyDomainProblem, domainOf, normaliseDomain } from '@soirely/domain';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../../../api.ts';
import { FieldError } from '../../../components/FieldError.tsx';
import { focusWhereSent, offField } from '../../../offField.ts';

type Flash = { kind: 'added' | 'removed'; domain: string } | null;

/** General's "Company domain joining" (sc-561), for those who can manage members. */
export function CompanyDomainsCard({ organisation }: { organisation: Membership }) {
  const { t } = useTranslation();
  const [list, setList] = useState<CompanyDomains | null>(null);
  const [failed, setFailed] = useState(false);
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [flash, setFlash] = useState<Flash>(null);
  const [removeFailed, setRemoveFailed] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const removeFailure = useRef<HTMLDivElement>(null);
  const confirmHeading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    let current = true;

    api.companyDomains(organisation.id).then(
      (found) => current && setList(found),
      () => current && setFailed(true),
    );

    return () => {
      current = false;
    };
  }, [organisation.id]);

  useEffect(() => {
    if (confirming != null) confirmHeading.current?.focus();
  }, [confirming]);

  useEffect(() => {
    if (removeFailed) removeFailure.current?.scrollIntoView({ block: 'nearest' });
  }, [removeFailed]);

  if (list == null) {
    return failed ? (
      <section className="card settings-card" aria-labelledby="company-domains-title">
        <h2 id="company-domains-title">{t('companyDomains.title')}</h2>
        <p className="muted">{t('companyDomains.unreadable')}</p>
      </section>
    ) : null;
  }

  const on = list.domains.some((one) => !one.stopped);
  const full = list.domains.length >= list.most;
  const example = domainOf(list.ownAddress) ?? 'example.com';

  async function add(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (busy) return;

    const problem = companyDomainProblem(typed);

    if (problem != null) {
      setError(
        problem === 'blank'
          ? t('companyDomains.blank', { example })
          : t('companyDomains.shape', { example }),
      );
      input.current?.focus();
      return;
    }

    setBusy(true);
    setFlash(null);
    setRemoveFailed(false);
    const land = focusWhereSent();

    try {
      const domain = normaliseDomain(typed);
      setList(await api.addCompanyDomain(organisation.id, domain));
      setTyped('');
      setError(null);
      setFlash({ kind: 'added', domain });
    } catch (refusal) {
      const message =
        refusal instanceof ApiError && refusal.is('validation_failed')
          ? refusal.fieldErrors().domain
          : undefined;
      setError(message ?? t('companyDomains.failed'));
      land('company-domain');
    } finally {
      setBusy(false);
    }
  }

  async function remove(domain: string): Promise<void> {
    setBusy(true);
    setFlash(null);
    setRemoveFailed(false);

    try {
      setList(await api.removeCompanyDomain(organisation.id, domain));
      setFlash({ kind: 'removed', domain });
    } catch {
      setRemoveFailed(true);
    } finally {
      setConfirming(null);
      setBusy(false);
    }
  }

  return (
    <section className="card settings-card" aria-labelledby="company-domains-title">
      <div className="card-heading">
        <h2 id="company-domains-title">{t('companyDomains.title')}</h2>
        <span className={on ? 'state-word state-word-on' : 'state-word'}>
          <span className="state-dot" aria-hidden="true" />
          {on ? t('companyDomains.on') : t('companyDomains.off')}
        </span>
      </div>
      <p className="muted">{t('companyDomains.intro', { organisation: organisation.name })}</p>

      {flash != null && (
        <div className="notice notice-done" role="status">
          <span className="mark mark-done" aria-hidden="true">
            ✓
          </span>
          <div className="notice-body">
            <p className="notice-title">
              {flash.kind === 'added'
                ? t('companyDomains.added', { domain: flash.domain })
                : t('companyDomains.removed', { domain: flash.domain })}
            </p>
            <p>
              {flash.kind === 'added'
                ? t('companyDomains.addedNext')
                : t('companyDomains.removedNext')}
            </p>
          </div>
        </div>
      )}

      {removeFailed && (
        <div ref={removeFailure} className="notice notice-broken" role="alert">
          <span className="mark mark-broken" aria-hidden="true">
            ✕
          </span>
          <p>{t('companyDomains.failed')}</p>
        </div>
      )}

      {list.domains.length > 0 && (
        <ul className="company-domains" aria-label={t('companyDomains.listLabel')}>
          {list.domains.map(({ domain, stopped }) => (
            <li key={domain} className="company-domain">
              <div className="company-domain-row">
                <div className="company-domain-naming">
                  <span className="company-domain-name">{domain}</span>
                  <span className={stopped ? 'state-word' : 'state-word state-word-on'}>
                    <span className="state-dot" aria-hidden="true" />
                    {stopped ? t('companyDomains.stopped') : t('companyDomains.working')}
                  </span>
                </div>
                {confirming !== domain && (
                  <button
                    className="button"
                    type="button"
                    disabled={busy}
                    aria-label={t('companyDomains.removeLabel', { domain })}
                    onClick={() => setConfirming(domain)}
                  >
                    {t('companyDomains.remove')}
                  </button>
                )}
              </div>
              {stopped && <p className="muted">{t('companyDomains.stoppedBody', { domain })}</p>}
              {confirming === domain && (
                <div className="company-domain-confirm">
                  <h3 ref={confirmHeading} tabIndex={-1}>
                    {t('companyDomains.removeTitle', { domain })}
                  </h3>
                  <p>{t('companyDomains.removeBody', { domain })}</p>
                  <div className="company-domain-buttons">
                    <button
                      className="button button-danger"
                      type="button"
                      aria-busy={busy}
                      disabled={busy}
                      onClick={() => void remove(domain)}
                    >
                      {t('companyDomains.removeConfirm', { domain })}
                    </button>
                    <button
                      className="button"
                      type="button"
                      disabled={busy}
                      onClick={() => setConfirming(null)}
                    >
                      {t('companyDomains.keep')}
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {full ? (
        <p className="muted">{t('companyDomains.full', { count: list.most })}</p>
      ) : (
        <form className="field" noValidate onSubmit={(event) => void add(event)}>
          <label htmlFor="company-domain">{t('companyDomains.addLabel')}</label>
          <div className="company-domain-add">
            <input
              ref={input}
              className={error == null ? 'input' : 'input input-wrong'}
              id="company-domain"
              type="text"
              inputMode="url"
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder={example}
              value={typed}
              {...offField(busy)}
              aria-invalid={error != null}
              aria-describedby={
                error == null ? 'company-domain-help' : 'company-domain-error company-domain-help'
              }
              onChange={(event) => {
                setTyped(event.target.value);
                setError(null);
              }}
            />
            <button className="button button-primary" type="submit" aria-busy={busy}>
              {t('companyDomains.add')}
            </button>
          </div>
          {error != null && <FieldError id="company-domain-error" message={error} />}
          <p className="field-help" id="company-domain-help">
            {list.ownAddress == null
              ? t('companyDomains.helpNoAddress', { count: list.most })
              : t('companyDomains.help', { email: list.ownAddress, count: list.most })}
          </p>
        </form>
      )}
    </section>
  );
}
