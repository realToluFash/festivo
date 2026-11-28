import type { Membership } from '@soirely/api-client';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../../../api.ts';
import { type AskWords, HandoverAsk, WorkNotIn, useWork } from '../../../components/Handover.tsx';

/** Leave's confirm (sc-614): what the leaver leads first, then who takes it, nobody meaning every other owner; Leave as it was when they lead nothing. */
export function LeaveHandover({
  organisation,
  renderPlain,
  leaving,
  failed,
  onKeep,
  onGo,
}: {
  organisation: Membership;
  renderPlain: (go: () => void) => ReactNode;
  leaving: boolean;
  failed: string | null;
  onKeep: () => void;
  onGo: (handTo: string | null) => Promise<'refused' | null>;
}) {
  const { t } = useTranslation();
  const { work, retry } = useWork(organisation.id, 'self', () => api.myWork(organisation.id));
  const [to, setTo] = useState<string | null>(null);
  const [refused, setRefused] = useState(false);
  const count = work.state === 'loaded' ? work.events.length : 0;
  const words: AskWords = {
    title: t('ownership.leaveTitle', { organisation: organisation.name }),
    lead: t('handover.youLead', { count }),
    last: t('ownership.leaveBody', { organisation: organisation.name }),
    keep: t('ownership.stay'),
    go: t('ownership.leave', { organisation: organisation.name }),
    red: true,
    busy: t('handover.busyLeave'),
    failed: failed ?? t('handover.failedLeave'),
    checking: t('handover.checkingYou'),
    notLoaded: t('handover.notLoadedYou'),
  };

  async function go(handTo: string | null): Promise<void> {
    setRefused(false);
    if ((await onGo(handTo)) === 'refused') {
      setRefused(true);
      retry();
    }
  }

  if (work.state !== 'loaded')
    return <WorkNotIn work={work} words={words} onKeep={onKeep} onRetry={retry} />;
  if (work.events.length === 0) return renderPlain(() => void go(null));

  return (
    <HandoverAsk
      words={words}
      nobody
      events={work.events}
      offered={work.offered}
      viewer={work.viewer ?? ''}
      organisation={organisation.name}
      to={to}
      sending={leaving ? 'sending' : refused ? 'refused' : failed != null ? 'failed' : 'asking'}
      onPick={setTo}
      onKeep={onKeep}
      onGo={() => void go(to)}
    />
  );
}
