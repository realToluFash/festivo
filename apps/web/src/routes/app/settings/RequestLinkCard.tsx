import { type Membership, type RequestLink } from '@soirely/api-client';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../../../api.ts';
import { offButton } from '../../../offButton.ts';

type Flash = 'on' | 'off' | 'replaced' | 'copied' | null;

/** General's "Requests to join" (sc-562), for those who can manage members: off until somebody turns it on. */
export function RequestLinkCard({ organisation }: { organisation: Membership }) {
  const { t } = useTranslation();
  const [link, setLink] = useState<RequestLink | null>(null);
  const [unreadable, setUnreadable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [flash, setFlash] = useState<Flash>(null);
  const confirmHeading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    let current = true;

    api.requestLink(organisation.id).then(
      (found) => current && setLink(found),
      () => current && setUnreadable(true),
    );

    return () => {
      current = false;
    };
  }, [organisation.id]);

  useEffect(() => {
    if (confirming) confirmHeading.current?.focus();
  }, [confirming]);

  if (link == null) {
    return unreadable ? (
      <section className="card settings-card" aria-labelledby="request-link-title">
        <h2 id="request-link-title">{t('requestLink.title')}</h2>
        <p className="muted">{t('requestLink.unreadable')}</p>
      </section>
    ) : null;
  }

  async function change(next: () => Promise<RequestLink>, done: Flash): Promise<void> {
    setBusy(true);
    setFailed(false);
    setFlash(null);

    try {
      setLink(await next());
      setFlash(done);
    } catch {
      setFailed(true);
    } finally {
      setConfirming(false);
      setBusy(false);
    }
  }

  async function copy(url: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(url);
      setFlash('copied');
    } catch {
      setFailed(true);
    }
  }

  return (
    <section className="card settings-card" aria-labelledby="request-link-title">
      <div className="card-heading">
        <h2 id="request-link-title">{t('requestLink.title')}</h2>
        <button
          className={link.on ? 'state-switch state-switch-on' : 'state-switch'}
          type="button"
          role="switch"
          aria-checked={link.on}
          aria-label={t('requestLink.switchLabel')}
          aria-busy={busy && !confirming}
          disabled={busy && confirming}
          {...offButton(busy && !confirming)}
          onClick={() =>
            void (link.on
              ? change(() => api.turnOffRequestLink(organisation.id), 'off')
              : change(() => api.turnOnRequestLink(organisation.id), 'on'))
          }
        >
          <span className="state-dot" aria-hidden="true" />
          {link.on ? t('requestLink.on') : t('requestLink.off')}
        </button>
      </div>
      <p className="muted">{t('requestLink.intro', { organisation: organisation.name })}</p>

      {flash != null && (
        <div className="notice notice-done" role="status">
          <span className="mark mark-done" aria-hidden="true">
            ✓
          </span>
          <p>{t(`requestLink.flash.${flash}`)}</p>
        </div>
      )}

      {failed && (
        <div className="notice notice-broken" role="alert">
          <span className="mark mark-broken" aria-hidden="true">
            ✕
          </span>
          <p>{t('requestLink.failed')}</p>
        </div>
      )}

      {link.on && link.url != null && (
        <div className="field">
          <label htmlFor="request-link-url">{t('requestLink.linkLabel')}</label>
          <div className="company-domain-add">
            <input
              className="input input-locked"
              id="request-link-url"
              type="text"
              value={link.url}
              readOnly
              aria-describedby="request-link-help"
              onFocus={(event) => event.target.select()}
            />
            <button
              className="button button-primary"
              type="button"
              onClick={() => void copy(link.url ?? '')}
            >
              {t('requestLink.copy')}
            </button>
          </div>
          <p className="field-help" id="request-link-help">
            {t('requestLink.help')}
          </p>

          {confirming ? (
            <div className="company-domain-confirm">
              <h3 ref={confirmHeading} tabIndex={-1}>
                {t('requestLink.replaceTitle')}
              </h3>
              <p>{t('requestLink.replaceBody')}</p>
              <div className="company-domain-buttons">
                <button
                  className="button button-danger"
                  type="button"
                  aria-busy={busy}
                  disabled={busy}
                  onClick={() =>
                    void change(() => api.replaceRequestLink(organisation.id), 'replaced')
                  }
                >
                  {t('requestLink.replaceConfirm')}
                </button>
                <button
                  className="button"
                  type="button"
                  disabled={busy}
                  onClick={() => setConfirming(false)}
                >
                  {t('requestLink.keep')}
                </button>
              </div>
            </div>
          ) : (
            <div>
              <button
                className="button"
                type="button"
                disabled={busy}
                onClick={() => setConfirming(true)}
              >
                {t('requestLink.replace')}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
