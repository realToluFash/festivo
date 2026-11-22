import type { ManagedAccount } from '@soirely/api-client';
import { useContext, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { api } from '../api.ts';
import { keepFocusIn } from '../dialogFocus.ts';
import { LayersContext } from '../layers.ts';
import { focusStep } from '../stepFocus.ts';
import { Glyph } from './Glyph.tsx';
import './createWalk.css';
import './Managed.css';

/** sc-563's refusal wherever a membership path ends for an account its home organisation manages: an "i", the API's sentence, and the way out. */
export function ManagedBanner({
  managed,
  alert = false,
  level = 2,
  way = true,
  takesFocus = false,
}: {
  managed: Pick<ManagedAccount, 'message'> & { organisation: { name: string } };
  alert?: boolean;
  level?: 2 | 3;
  /** Off on A few details, where Account settings is still behind the onboarding gate. */
  way?: boolean;
  /** It replaced the button just pressed, so it comes wholly into view and its title takes focus, read as it lands rather than as an alert (sc-563). */
  takesFocus?: boolean;
}) {
  const { t } = useTranslation();
  const id = useId();
  const Heading = level === 2 ? 'h2' : 'h3';
  const banner = useRef<HTMLElement>(null);
  const title = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!takesFocus) return;
    focusStep(title.current, banner.current);
  }, [takesFocus]);

  return (
    <section
      ref={banner}
      className="managed"
      role={alert && !takesFocus ? 'alert' : undefined}
      aria-labelledby={id}
    >
      <span className="managed-mark" aria-hidden="true">
        <Glyph name="info" size={20} weight={2.2} />
      </span>
      <div className="managed-words">
        <Heading
          ref={title}
          id={id}
          className="managed-title"
          tabIndex={takesFocus ? -1 : undefined}
        >
          {t('managed.title', { organisation: managed.organisation.name })}
        </Heading>
        <p>{managed.message}</p>
        <p>{t('managed.single')}</p>
        {way && (
          <Link className="managed-way" to="/app/account">
            {t('managed.way')}
          </Link>
        )}
      </div>
    </section>
  );
}

/** Whether the signed-in account is managed, read once: undefined until known, null when it is not or the read failed. */
export function useManaged(): ManagedAccount | null | undefined {
  const [managed, setManaged] = useState<ManagedAccount | null | undefined>(undefined);

  useEffect(() => {
    let live = true;

    api.joinOffers().then(
      (found) => {
        if (live) setManaged(found.managed);
      },
      () => {
        if (live) setManaged(null);
      },
    );

    return () => {
      live = false;
    };
  }, []);

  return managed;
}

/** Create an organisation for a managed account: the banner in the first step's place, and Close. */
export function ManagedWalk({
  managed,
  onClose,
}: {
  managed: ManagedAccount;
  onClose: () => void;
}) {
  const { host } = useContext(LayersContext);

  return host == null ? null : createPortal(<Panel managed={managed} onClose={onClose} />, host);
}

function Panel({ managed, onClose }: { managed: ManagedAccount; onClose: () => void }) {
  const { t } = useTranslation();
  const id = useId();
  const panel = useRef<HTMLDivElement>(null);
  const title = t('createOrganisation.title');

  useLayoutEffect(() => {
    panel.current?.focus();
  }, []);

  useLayoutEffect(() => {
    const keys = (event: globalThis.KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
      if (event.key === 'Tab' && panel.current != null) keepFocusIn(panel.current, event);
    };

    document.addEventListener('keydown', keys);

    return () => document.removeEventListener('keydown', keys);
  }, [onClose]);

  return (
    <>
      <button
        type="button"
        className="dialog-scrim"
        tabIndex={-1}
        aria-label={t('managed.close')}
        onClick={onClose}
      />
      <div
        ref={panel}
        className="cw-panel"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        aria-describedby={`${id}-managed`}
        tabIndex={-1}
      >
        <div className="cw-side">
          <div className="cw-body">
            <h1 className="cw-question">{title}</h1>
            <div id={`${id}-managed`}>
              <ManagedBanner managed={managed} />
            </div>
          </div>
          <div className="cw-foot">
            <button type="button" className="cw-button" onClick={onClose}>
              {t('managed.close')}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
