import { ApiError, type OrganisationEvent } from '@soirely/api-client';
import { copyEndsLine, copyStartRefusal, localDateTime, skippedLine } from '@soirely/domain';
import { type ReactNode, useContext, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { api } from '../../../api.ts';
import { DateTime } from '../../../components/EventPageParts.tsx';
import { Glyph } from '../../../components/Glyph.tsx';
import { Dialog, Head } from '../../../components/SettingsParts.tsx';
import { copyStart } from '../../../copyStart.ts';
import { dateLocale } from '../../../i18n/index.ts';
import { LayersContext, useDeskLayers } from '../../../layers.ts';
import { DUPLICATED } from './duplicated.ts';

/** `Duplicate` (sc-3593): how the event is set up, as a new Draft from a start the organiser chooses. */
export function DuplicateEvent({
  event,
  primary = false,
  look,
}: {
  event: OrganisationEvent;
  primary?: boolean;
  look?: { className: string; describedBy: string } | undefined;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);

  const close = () => {
    setOpen(false);
    window.setTimeout(() => opener.current?.focus(), 0);
  };

  return (
    <>
      <button
        ref={opener}
        type="button"
        className={look?.className ?? (primary ? 'button button-primary' : 'button')}
        aria-describedby={look?.describedBy}
        onClick={() => setOpen(true)}
      >
        {t('eventDuplicate.open')}
      </button>
      {open && <DuplicateDialog event={event} onClose={close} />}
    </>
  );
}

/** The desk dialog, as the demo draws it (sc-39471): its top bar, then what is copied and what is not, and Starts filled in a year on. */
export function DuplicateDialog({
  event,
  onClose,
}: {
  event: OrganisationEvent;
  onClose: () => void;
}) {
  return (
    <OwnLayers>
      <DuplicateBox event={event} onClose={onClose} />
    </OwnLayers>
  );
}

/** A dialog's layers where the page has none to draw it in, as an event's areas other than Overview. */
function OwnLayers({ children }: { children: ReactNode }) {
  const outer = useContext(LayersContext);
  const { layers, setHost } = useDeskLayers();

  if (outer.host != null) return children;

  return (
    <LayersContext value={layers}>
      {children}
      <div className="desk">
        <div ref={setHost} className="desk-layers" />
      </div>
    </LayersContext>
  );
}

function DuplicateBox({ event, onClose }: { event: OrganisationEvent; onClose: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const id = useId();
  const [start, setStart] = useState(() => copyStart(event));
  const [error, setError] = useState<string | undefined>(undefined);
  const [status, setStatus] = useState<'editing' | 'creating' | 'failed'>('editing');
  const when = useRef<HTMLDivElement>(null);
  const busy = status === 'creating';
  const locale = dateLocale();
  const skipped = skippedLine(start.date, start.time, event.timeZone, locale, t);

  const focusHalf = (half: 'date' | 'time') =>
    when.current?.querySelector<HTMLElement>(`input[type="${half}"]`)?.focus();

  async function create(): Promise<void> {
    if (busy) return;

    const refusal = copyStartRefusal(start.date, start.time, t);

    if (refusal != null) {
      setError(refusal.message);
      focusHalf(refusal.focus);

      return;
    }

    setStatus('creating');

    try {
      const copy = await api.duplicateEvent(event.id, localDateTime(start.date, start.time) ?? '');

      void navigate(`/app/events/${encodeURIComponent(copy.id)}`, { state: DUPLICATED });
    } catch (failure) {
      const refused =
        failure instanceof ApiError && failure.status === 422
          ? failure.fieldErrors().startsAt
          : undefined;

      if (refused != null) {
        setStatus('editing');
        setError(refused);
        focusHalf('date');
        return;
      }

      setStatus('failed');
    }
  }

  return (
    <Dialog
      title={t('eventDuplicate.open')}
      verb={t('eventDuplicate.create')}
      dismiss={t('eventDuplicate.cancel')}
      locked={busy}
      onDismiss={onClose}
      onConfirm={() => void create()}
    >
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
      {status === 'failed' && (
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
          onChange={(next) => {
            setStart(next);
            if (next.date !== '' && next.time !== '') setError(undefined);
          }}
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
    </Dialog>
  );
}
