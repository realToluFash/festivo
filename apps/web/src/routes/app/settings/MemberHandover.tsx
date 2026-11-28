import type { Membership, OrganisationMember } from '@soirely/api-client';
import { firstName } from '@soirely/domain';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../../../api.ts';
import {
  type AskWords,
  HandoverAsk,
  type Sending,
  WorkNotIn,
  refusedHandTo,
  useWork,
} from '../../../components/Handover.tsx';

/** Who took the events, by name, or null for the viewer, and how many. */
export interface Handed {
  to: string | null;
  count: number;
}

/** Remove's and Hand over now's confirm (sc-614): the work list first, then who takes it, or Remove as it was when they lead nothing. */
export function MemberHandover({
  kind,
  organisation,
  member,
  renderPlain,
  onKeep,
  onDone,
  onFailed,
}: {
  kind: 'remove' | 'hand';
  organisation: Membership;
  member: OrganisationMember;
  renderPlain: (go: () => void, busy: boolean, failed: string | null) => ReactNode;
  onKeep: () => void;
  onDone: (handed: Handed | null) => void;
  onFailed: (error: unknown) => string | null;
}) {
  const { t } = useTranslation();
  const name = member.user.name;
  const { work, retry } = useWork(organisation.id, member.id, () =>
    api.memberWork(organisation.id, member.id),
  );
  const [picked, setPicked] = useState<string | null | undefined>(undefined);
  const [sending, setSending] = useState<Sending>('asking');
  const [failed, setFailed] = useState<string | null>(null);
  const count = work.state === 'loaded' ? work.events.length : 0;
  const words: AskWords =
    kind === 'remove'
      ? {
          title: t('membersScreen.removeAskTitle', { name, organisation: organisation.name }),
          lead: t('handover.leads', { name, count }),
          last: t('handover.removeTail'),
          keep: t('membersScreen.removeKeep', { name: firstName(name) }),
          go: t('membersScreen.removeGo'),
          red: true,
          busy: t('handover.busyRemove'),
          failed: failed ?? t('handover.failedRemove'),
          checking: t('handover.checking', { name }),
          notLoaded: t('handover.notLoaded', { name }),
        }
      : {
          title: t('handover.handTitle', { name, count }),
          lead: t('handover.leads', { name, count }),
          last: t('handover.handTail', { name, count }),
          keep: t('handover.cancel'),
          go: t('handover.handOver'),
          red: false,
          busy: t('handover.busyHand'),
          failed: failed ?? t('handover.failedHand'),
          checking: t('handover.checking', { name }),
          notLoaded: t('handover.notLoaded', { name }),
        };

  if (work.state !== 'loaded')
    return <WorkNotIn work={work} words={words} onKeep={onKeep} onRetry={retry} />;

  const to = picked === undefined ? work.viewer : picked;

  async function go(handTo: string | null): Promise<void> {
    if (sending === 'sending') return;
    if (kind === 'hand' && handTo == null) {
      setSending('refused');

      return;
    }
    setSending('sending');

    try {
      if (kind === 'hand') await api.handOverWork(organisation.id, member.id, handTo ?? '');
      else await api.removeMember(organisation.id, member.id, handTo);
      const taker =
        work.state === 'loaded' ? work.offered.find((one) => one.id === handTo) : undefined;
      onDone(
        handTo == null || count === 0
          ? null
          : {
              to:
                handTo === (work.state === 'loaded' ? work.viewer : null)
                  ? null
                  : (taker?.name ?? null),
              count,
            },
      );
    } catch (error) {
      if (refusedHandTo(error)) {
        setSending('refused');
        retry();

        return;
      }
      setFailed(onFailed(error));
      setSending('failed');
    }
  }

  if (work.events.length === 0)
    return kind === 'hand'
      ? null
      : renderPlain(
          () => void go(null),
          sending === 'sending',
          sending === 'failed' ? words.failed : null,
        );

  return (
    <HandoverAsk
      words={words}
      events={work.events}
      offered={work.offered}
      viewer={work.viewer ?? ''}
      organisation={organisation.name}
      to={to}
      sending={sending}
      onPick={setPicked}
      onKeep={onKeep}
      onGo={() => void go(to)}
    />
  );
}
