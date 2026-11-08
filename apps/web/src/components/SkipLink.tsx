import { useContext } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import { SkipLinkSlot } from '../skipLinkSlot.ts';

export function SkipLink({ inert }: { inert?: boolean }) {
  const { t } = useTranslation();
  const slot = useContext(SkipLinkSlot);
  const link = (
    <a className="skip-link" href="#content" inert={inert}>
      {t('app.skipToContent')}
    </a>
  );

  return slot == null ? link : createPortal(link, slot);
}
