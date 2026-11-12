import { copyEndsLine, skippedLine } from '@soirely/domain';
import { type Ref, useId } from 'react';
import { useTranslation } from 'react-i18next';

import { dateLocale } from '../i18n/index.ts';
import { DateTime } from './EventPageParts.tsx';
import { Glyph } from './Glyph.tsx';
import { Head } from './SettingsParts.tsx';

type Wall = { date: string; time: string };

/** Duplicate's dialog body, drawn by the product and the demo alike (sc-39471): what is copied and what is not, Starts, and when the copy ends. */
export function DuplicateBody({
  event,
  start,
  onStart,
  failed = false,
  error,
  when,
}: {
  event: { name: string; startsAt: string; endsAt: string; timeZone: string };
  start: Wall;
  onStart: (next: Wall) => void;
  failed?: boolean;
  error?: string | undefined;
  when?: Ref<HTMLDivElement>;
}) {
  const { t } = useTranslation();
  const id = useId();
  const locale = dateLocale();
  const skipped = skippedLine(start.date, start.time, event.timeZone, locale, t);

  return (
    <>
      <h3 className="ev-dialog-title">{t('eventDuplicate.title', { event: event.name })}</h3>
      <p className="desk-line">{t('eventDuplicate.body')}</p>
      <div>
        <Head title={t('eventDuplicate.copied')} level={3} />
        <ul className="ev-bullets">
          <li>{t('eventDuplicate.copiedName')}</li>
          <li>{t('eventDuplicate.copiedType')}</li>
          <li>{t('eventDuplicate.copiedVenue')}</li>
          <li>{t('eventDuplicate.copiedCover')}</li>
          <li>{t('eventDuplicate.copiedTimeZone')}</li>
          <li>{t('eventDuplicate.copiedCurrency')}</li>
          <li>{t('eventDuplicate.copiedLength')}</li>
        </ul>
      </div>
      <div>
        <Head title={t('eventDuplicate.notCopied')} level={3} />
        <ul className="ev-bullets">
          <li>{t('eventDuplicate.notCopiedHosts')}</li>
          <li>{t('eventDuplicate.notCopiedGuests')}</li>
          <li>{t('eventDuplicate.notCopiedReplies')}</li>
          <li>{t('eventDuplicate.notCopiedHappened')}</li>
        </ul>
      </div>
      {failed && (
        <p className="desk-error" role="alert">
          <Glyph name="alert" size={15} weight={2.2} />
          {t('eventDuplicate.notCreated')}
        </p>
      )}
      <div ref={when}>
        <DateTime
          legend={t('eventDuplicate.starts')}
          wall={start}
          wrong={error != null}
          told={error != null ? `${id}-wrong` : skipped != null ? `${id}-skip` : `${id}-ends`}
          onChange={onStart}
        />
      </div>
      {error != null && (
        <p id={`${id}-wrong`} className="desk-error" role="alert">
          <Glyph name="alert" size={15} weight={2.2} />
          {error}
        </p>
      )}
      {skipped != null && (
        <p id={`${id}-skip`} className="desk-help">
          {skipped}
        </p>
      )}
      <p id={`${id}-ends`} className="desk-note" role="status">
        {copyEndsLine(start.date, start.time, event, locale, t)}
      </p>
    </>
  );
}
