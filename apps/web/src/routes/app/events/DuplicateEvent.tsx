import { ApiError, type OrganisationEvent } from '@soirely/api-client';
import { copyStartRefusal, localDateTime } from '@soirely/domain';
import { type ReactNode, useContext, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { api } from '../../../api.ts';
import { DuplicateBody } from '../../../components/DuplicateBody.tsx';
import { Dialog } from '../../../components/SettingsParts.tsx';
import { copyStart } from '../../../copyStart.ts';
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
  const [start, setStart] = useState(() => copyStart(event));
  const [error, setError] = useState<string | undefined>(undefined);
  const [status, setStatus] = useState<'editing' | 'creating' | 'failed'>('editing');
  const when = useRef<HTMLDivElement>(null);
  const busy = status === 'creating';

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
      <DuplicateBody
        event={event}
        start={start}
        onStart={(next) => {
          setStart(next);
          if (next.date !== '' && next.time !== '') setError(undefined);
        }}
        failed={status === 'failed'}
        error={error}
        when={when}
      />
    </Dialog>
  );
}
