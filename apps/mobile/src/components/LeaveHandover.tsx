import { ApiError } from '@soirely/api-client';
import { type RefObject, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import { refusedHandTo } from '../kit/handover.ts';
import { refusalTitle } from '../kit/refusal.ts';
import { HandoverAsk, type Sending, useWork } from './Handover.tsx';
import type { ScreenReaderTarget } from './screenReaderFocus.ts';

/** Leave's Ask (sc-614): what the leaver leads first, then who takes it, nobody meaning every other owner; Leave as it was when they lead nothing. */
export function LeaveHandover({
  open,
  opener,
  organisation,
  onKeep,
  onOnlyOwner,
  onGone,
}: {
  open: boolean;
  opener: RefObject<ScreenReaderTarget | null>;
  organisation: { id: string; name: string };
  onKeep: () => void;
  /** Refused last_owner: they became the only owner while the Ask stood open. */
  onOnlyOwner: () => void;
  onGone: () => void;
}) {
  const { t } = useTranslation();
  const name = organisation.name;
  const { work, retry } = useWork(organisation.id, 'self', () => api.myWork(organisation.id), open);
  const [to, setTo] = useState<string | null>(null);
  const [sending, setSending] = useState<Sending>('asking');
  const [failed, setFailed] = useState<string | null>(null);
  const count = work.state === 'loaded' ? work.events.length : 0;
  const verb = {
    label: t('ownership.leave', { organisation: name }),
    testID: 'organisation.leave.confirm',
    removes: true,
  };

  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) {
      setTo(null);
      setSending('asking');
      setFailed(null);
    }
  }

  async function go(): Promise<void> {
    if (sending === 'sending' || work.state !== 'loaded') return;
    setSending('sending');
    setFailed(null);

    try {
      await api.leaveOrganisation(organisation.id, count === 0 ? null : to);
    } catch (error) {
      if (refusedHandTo(error)) {
        setSending('refused');
        retry();

        return;
      }
      if (error instanceof ApiError && error.is('last_owner')) {
        setSending('asking');
        onOnlyOwner();

        return;
      }
      setFailed(refusalTitle(error, t('ownership.failed')));
      setSending('failed');

      return;
    }
    onGone();
  }

  return (
    <HandoverAsk
      open={open}
      opener={opener}
      work={work}
      words={{
        title: t('ownership.leaveTitle', { organisation: name }),
        lead: t('handover.youLead', { count }),
        tail: t('ownership.leaveBody', { organisation: name }),
        keep: { label: t('ownership.stay'), testID: 'organisation.leave.stay' },
        verb,
        busy: t('handover.busyLeave'),
        failed: failed ?? t('handover.failedLeave'),
        checking: t('handover.checkingYou'),
        notLoaded: t('handover.notLoadedYou'),
      }}
      plain={{ line: t('ownership.leaveBody', { organisation: name }), verb }}
      organisation={name}
      nobody
      to={to}
      sending={sending}
      onPick={setTo}
      onKeep={onKeep}
      onConfirm={() => void go()}
      onRetry={retry}
      testID="organisation.leave"
    />
  );
}
