import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { Glyph } from '../../../components/Glyph.tsx';
import type { HandoffPage } from './handoff.ts';

/** `EventHandoff.dc.html`: at a phone's width an event's page says it is in the app, with one way to see it anyway (sc-55397). */
export function EventHandoff({
  page,
  name,
  onShowAnyway,
}: {
  page: HandoffPage;
  name: string | null;
  onShowAnyway: () => void;
}) {
  const { t } = useTranslation();
  const heading = useRef<HTMLHeadingElement>(null);
  const area = page.kind === 'event' && page.area != null ? t(`eventNav.${page.area}`) : null;

  useEffect(() => heading.current?.focus({ preventScroll: true }), []);

  return (
    <div className="ho-card">
      <span className="ho-glyph" aria-hidden="true">
        <Glyph name="device" size={22} />
      </span>
      {area != null && <p className="ho-area">{area}</p>}
      <h1 ref={heading} id="content" className="ho-title" tabIndex={-1}>
        {page.kind === 'new' ? t('events.newEvent') : name}
      </h1>
      <p className="ho-line">{t('handoff.line')}</p>
      <button type="button" className="button ho-anyway" onClick={onShowAnyway}>
        {t('handoff.anyway')}
      </button>
    </div>
  );
}
