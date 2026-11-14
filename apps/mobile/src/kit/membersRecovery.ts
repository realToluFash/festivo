import { ApiError, type RecoveryRequest } from '@soirely/api-client';
import { initials, listFormat } from '@soirely/domain';
import type { TFunction } from 'i18next';

import type { AskProps } from '../components/Summary.tsx';
import type { MemberFace } from './membersSummary.ts';
import { toneOf } from './personFace.ts';

/** The asker's face, as their row under People draws it. */
export function recoveryFace(request: RecoveryRequest): MemberFace {
  return { initials: initials(request.name), tone: toneOf(request.userId) };
}

export function askerName(t: TFunction, request: RecoveryRequest): string {
  return request.own ? t('recoveryRequests.you', { name: request.name }) : request.name;
}

export function provedLine(t: TFunction, request: RecoveryRequest): string {
  if (request.provedPhone)
    return t(request.own ? 'recoveryRequests.provedBothOwn' : 'recoveryRequests.provedBoth');

  return t(request.own ? 'recoveryRequests.provedEmailOwn' : 'recoveryRequests.provedEmail');
}

export function whenLine(t: TFunction, request: RecoveryRequest): string {
  return t('recoveryRequests.when', { asked: request.asked ?? '', expires: request.expires ?? '' });
}

export function recoveryFacts(t: TFunction, request: RecoveryRequest): string[] {
  return [
    request.email,
    `${t('recoveryRequests.title')} · ${provedLine(t, request)}`,
    whenLine(t, request),
  ];
}

/** One group for a screen reader, in the AC's order, the list's paragraph with it; Approve and Turn down follow. */
export function recoveryHeard(t: TFunction, request: RecoveryRequest): string {
  return [
    `${t('recoveryRequests.mark')}.`,
    `${t('recoveryRequests.title')}.`,
    t('recoveryRequests.intro'),
    `${askerName(t, request)}, ${request.email}.`,
    `${provedLine(t, request)}.`,
    `${whenLine(t, request)}.`,
  ].join(' ');
}

export function ownLine(t: TFunction, request: RecoveryRequest, locale: string): string {
  return t('recoveryRequests.own', {
    organisations: listFormat(locale, { type: 'conjunction' }).format(request.organisations),
  });
}

export type RecoveryAnswer = 'approve' | 'turnDown';

/** Which confirm is open, and where it is: asking, its answer on its way, failed, or its request gone meanwhile. */
export interface RecoveryAsk {
  id: string;
  answer: RecoveryAnswer;
  phase: 'asking' | 'sending' | 'failed' | 'closed';
}

/** Closed, or no longer this viewer's to answer (a 404, RFC 9110 §15.5.5): the request has gone. Anything else may work again. */
export function recoveryGone(refusal: unknown): boolean {
  return (
    refusal instanceof ApiError && (refusal.is('recovery_request_closed') || refusal.status === 404)
  );
}

/** Members' one Ask for each answer: Cancel or Keep the request first, the verb last; Sending your answer… while it goes, the failed line if it fails, and Close alone once the request has gone. */
export function recoveryQuestion(
  t: TFunction,
  ask: RecoveryAsk | null,
  name: string,
): Omit<AskProps, 'onKeep' | 'onConfirm'> {
  const turningDown = ask?.answer === 'turnDown';
  const title = turningDown
    ? t('recoveryRequests.turnDownTitle', { name })
    : t('recoveryRequests.approveTitle', { name });
  const off = ask?.phase === 'sending';
  const busy = off ? t('recoveryRequests.sending') : undefined;
  const failed = ask?.phase === 'failed' ? t('recoveryRequests.failed') : null;

  if (ask?.phase === 'closed')
    return {
      title,
      line: t('recoveryRequests.closed'),
      alert: true,
      keep: { label: t('recoveryRequests.close'), testID: 'members.recovery.close' },
      confirm: null,
    };
  if (turningDown)
    return {
      title,
      line: t('recoveryRequests.turnDownBody'),
      failed,
      keep: { label: t('recoveryRequests.keep'), testID: 'members.recovery.keep', off },
      confirm: {
        label: t('recoveryRequests.turnDownConfirm'),
        testID: 'members.recovery.turnDownConfirm',
        busy,
      },
    };

  return {
    title,
    line: t('recoveryRequests.approveBody'),
    failed,
    keep: { label: t('recoveryRequests.cancel'), testID: 'members.recovery.cancel', off },
    confirm: {
      label: t('recoveryRequests.approveConfirm'),
      testID: 'members.recovery.turnOff',
      removes: true,
      busy,
    },
  };
}
