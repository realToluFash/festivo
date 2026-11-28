import type { DoorCodeCard, OrganisationEvent } from '@soirely/api-client';
import type { TFunction } from 'i18next';
import { useRef, useState } from 'react';

import { api } from '../api.ts';
import { dateLocale } from '../i18n/index.ts';
import { type CodeClock, renewal, shownCode } from '../kit/doorCodes.ts';
import type { AskProps } from './AskLayer.tsx';

export interface CodeAsk {
  kind: 'new' | 'stop';
  id: string;
  open: boolean;
  sending: boolean;
  failed: boolean;
}

export function codeClock(event: OrganisationEvent, now: Date): CodeClock {
  return { endsAt: event.endsAt, timeZone: event.timeZone, locale: dateLocale(), now };
}

/** Make a new code and Stop this code, the same Ask from People and from Show the code; each answer replaces the card it was about. */
export function useCodeAsk(
  eventId: string,
  clock: CodeClock,
  onAnswer: (was: string, card: DoorCodeCard, kind: CodeAsk['kind']) => void,
): {
  asking: CodeAsk | null;
  askAbout: (kind: CodeAsk['kind'], code: DoorCodeCard) => void;
  close: () => void;
  props: (code: DoorCodeCard, t: TFunction, testID: string) => AskProps;
} {
  const [asking, setAsking] = useState<CodeAsk | null>(null);
  const going = useRef(false);

  function askAbout(kind: CodeAsk['kind'], code: DoorCodeCard): void {
    setAsking({ kind, id: code.id, open: true, sending: false, failed: false });
  }

  function close(): void {
    setAsking((now) => (now == null || now.sending ? now : { ...now, open: false }));
  }

  async function answer(code: DoorCodeCard, kind: CodeAsk['kind']): Promise<void> {
    if (going.current) return;
    going.current = true;
    setAsking((now) => (now == null ? now : { ...now, sending: true, failed: false }));

    try {
      const card =
        kind === 'stop'
          ? await api.stopDoorCode(eventId, code.id)
          : await api.makeDoorCode(eventId, renewal(code, clock));
      setAsking((now) => (now == null ? now : { ...now, sending: false, open: false }));
      onAnswer(code.id, card, kind);
    } catch {
      setAsking((now) => (now == null ? now : { ...now, sending: false, failed: true }));
    } finally {
      going.current = false;
    }
  }

  function props(code: DoorCodeCard, t: TFunction, testID: string): AskProps {
    const stop = asking?.kind === 'stop';
    const sending = asking?.sending === true;
    const failed = asking?.failed === true;
    const busyWords = t(stop ? 'doorCodes.stopping' : 'doorCodes.making');

    return {
      title: t(stop ? 'doorCodes.stopTitle' : 'doorCodes.newTitle'),
      line: stop
        ? t('doorCodes.stopLine', { count: code.used })
        : t('doorCodes.newLine', { count: code.used, code: shownCode(code.code) }),
      keep: {
        label: t(stop ? 'doorCodes.stopKeep' : 'doorCodes.newKeep'),
        off: sending,
        testID: `${testID}.keep`,
      },
      confirm: {
        label: failed
          ? t('doorCodes.tryAgain')
          : t(stop ? 'doorCodes.stopGo' : 'doorCodes.makeNew'),
        removes: stop,
        busy: sending ? busyWords : undefined,
        busyWords,
        testID: `${testID}.confirm`,
      },
      failed: failed ? t(stop ? 'doorCodes.failStop' : 'doorCodes.failMake') : null,
      onKeep: close,
      onConfirm: () => void answer(code, asking?.kind ?? 'new'),
    };
  }

  return { asking, askAbout, close, props };
}
