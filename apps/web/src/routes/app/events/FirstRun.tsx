import type { RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

const STEPS = ['events.firstRunStepName', 'events.firstRunStepDefaults', 'events.firstRunStepOpen'];

/** The organisation has no events yet: on Events, and on the Calendar with its own button (sc-3625). */
export function FirstRun({
  creates,
  createLabel = 'events.firstRunCreate',
  title,
}: {
  creates: boolean;
  createLabel?: string;
  title?: RefObject<HTMLHeadingElement | null>;
}) {
  const { t } = useTranslation();

  return (
    <section className="card events-first-run" aria-labelledby="events-first-run-title">
      <h2 id="events-first-run-title" ref={title} tabIndex={-1}>
        {t('events.firstRunTitle')}
      </h2>
      <ol className="steps-list">
        {STEPS.map((step, index) => (
          <li key={step}>
            <span className="step-mark" aria-hidden="true">
              {index + 1}
            </span>
            <span>{t(step)}</span>
          </li>
        ))}
      </ol>
      {creates ? (
        <Link className="button button-primary events-first-run-create" to="/app/events/new">
          {t(createLabel)}
        </Link>
      ) : (
        <div className="notice notice-quiet">
          <p>{t('events.firstRunAskOwner')}</p>
        </div>
      )}
    </section>
  );
}
