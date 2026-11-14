import { useContext, useId, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import { CreateWalk as ProductWalk } from '../components/CreateWalk.tsx';
import { keepFocusIn } from '../dialogFocus.ts';
import { LayersContext } from '../layers.ts';
import { type DemoWalk, SAMPLE_CURRENCIES, sampleSend } from './createOrg.ts';
import { ManagedBanner } from './managed.tsx';
import { SAMPLE } from './rules.ts';
import '../components/createWalk.css';

/** The product's walk on the demo's sample: its countries and its send, or sc-563's refusal in its place. */
export function CreateWalk({
  start,
  onClose,
  onCreated,
}: {
  start: DemoWalk;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { host } = useContext(LayersContext);

  if (start.managed === true)
    return host == null ? null : createPortal(<Managed onClose={onClose} />, host);

  return (
    <ProductWalk
      start={start}
      email={SAMPLE.email}
      currencies={SAMPLE_CURRENCIES}
      create={sampleSend}
      onClose={onClose}
      onCreated={onCreated}
    />
  );
}

/** sc-563 is not in the API yet, so only the demo refuses the walk: the banner in the first step's place, and Close. */
function Managed({ onClose }: { onClose: () => void }) {
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
        aria-label="Close"
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
              <ManagedBanner />
            </div>
          </div>
          <div className="cw-foot">
            <button type="button" className="cw-button" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
