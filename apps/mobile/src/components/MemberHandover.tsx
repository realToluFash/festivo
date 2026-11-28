import type { Membership, OrganisationMember } from '@soirely/api-client';
import { firstName } from '@soirely/domain';
import { type RefObject, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import { refusedHandTo } from '../kit/handover.ts';
import { HandoverAsk, type HandoverWords, type Sending, useWork } from './Handover.tsx';
import type { ScreenReaderTarget } from './screenReaderFocus.ts';

/** Who took the events, by name, or null for the viewer, and how many. */
export interface Handed {
  to: string | null;
  count: number;
}

/** Remove's and Hand over now's Ask (sc-614): the work list first, then who takes it, or Remove as it was when they lead nothing. */
export function MemberHandover({
  kind,
  open,
  opener,
  organisation,
  member,
  onKeep,
  onDone,
  failedOf,
}: {
  kind: 'remove' | 'hand';
  open: boolean;
  opener: RefObject<ScreenReaderTarget | null>;
  organisation: Membership;
  member: OrganisationMember;
  onKeep: () => void;
  /** Sent: what moved, or null when nothing did. */
  onDone: (handed: Handed | null) => Promise<void> | void;
  failedOf: (error: unknown) => string;
}) {
  const { t } = useTranslation();
  const name = member.user.name;
  const { work, retry } = useWork(
    organisation.id,
    member.id,
    () => api.memberWork(organisation.id, member.id),
    open,
  );
  const [picked, setPicked] = useState<string | null | undefined>(undefined);
  const [sending, setSending] = useState<Sending>('asking');
  const [failed, setFailed] = useState<string | null>(null);
  const loaded = work.state === 'loaded' ? work : null;
  const count = loaded?.events.length ?? 0;
  const to = picked === undefined ? (loaded?.viewer ?? null) : picked;

  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) {
      setPicked(undefined);
      setSending('asking');
      setFailed(null);
    }
  }

  const removing = kind === 'remove';
  const words: HandoverWords = {
    title: removing
      ? t('membersScreen.removeAsk', { name, organisation: organisation.name })
      : t('handover.handTitle', { name, count }),
    lead: t('handover.leads', { name, count }),
    tail: removing ? t('handover.removeTail') : t('handover.handTail', { name, count }),
    keep: removing
      ? {
          label: t('membersScreen.removeKeep', { name: firstName(name) }),
          testID: 'members.remove.keep',
        }
      : { label: t('handover.cancel'), testID: 'members.handOver.cancel' },
    verb: removing
      ? { label: t('membersScreen.removeVerb'), testID: 'members.remove.confirm', removes: true }
      : { label: t('handover.handOver'), testID: 'members.handOver.confirm', removes: false },
    busy: removing ? t('handover.busyRemove') : t('handover.busyHand'),
    failed: failed ?? (removing ? t('handover.failedRemove') : t('handover.failedHand')),
    checking: t('handover.checking', { name }),
    notLoaded: t('handover.notLoaded', { name }),
  };

  async function go(): Promise<void> {
    if (sending === 'sending' || loaded == null) return;
    const handTo = count === 0 ? null : to;
    setSending('sending');
    setFailed(null);

    try {
      if (kind === 'hand' && handTo != null)
        await api.handOverWork(organisation.id, member.id, handTo);
      else await api.removeMember(organisation.id, member.id, handTo);
    } catch (error) {
      if (refusedHandTo(error)) {
        setPicked(undefined);
        setSending('refused');
        retry();

        return;
      }
      setFailed(failedOf(error));
      setSending('failed');

      return;
    }
    const taker = loaded.offered.find((one) => one.id === handTo);
    await onDone(
      handTo == null
        ? null
        : { to: handTo === loaded.viewer ? null : (taker?.name ?? null), count },
    );
    setSending('asking');
  }

  return (
    <HandoverAsk
      open={open}
      opener={opener}
      work={work}
      words={words}
      plain={
        removing
          ? {
              line: t('membersScreen.removeBody', { organisation: organisation.name }),
              verb: words.verb,
            }
          : null
      }
      organisation={organisation.name}
      to={to}
      sending={sending}
      onPick={setPicked}
      onKeep={onKeep}
      onConfirm={() => void go()}
      onRetry={retry}
      testID={removing ? 'members.remove.ask' : 'members.handOver.ask'}
    />
  );
}
