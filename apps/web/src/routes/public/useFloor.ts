import {
  ApiError,
  type KeptServiceTap,
  type ServiceTapStep,
  keepServiceTap,
  keptServiceTap,
  realtimeTopic,
  sendServiceTaps,
} from '@soirely/api-client';
import {
  type FloorRead,
  type Freshness,
  type KeptTap,
  type ServicePhase,
  type TapExpected,
  type TapRefusal,
  createServiceFreshness,
  tapNow,
} from '@soirely/domain';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { api } from '../../api.ts';
import { restoreSession } from '../../session.ts';
import { storedServiceTaps } from '../app/events/serviceTaps.ts';
import { useHubTopics } from '../app/events/useHubTopics.ts';

export type FloorSeen =
  | { kind: 'loading' }
  | { kind: 'refused' }
  | { kind: 'failed' }
  | { kind: 'shown'; floor: FloorRead };

/** Floor's read, followed live from sc-4005's topic, with sc-4028's freshness and kept taps; the names it reads stay in memory. */
export function useFloor(eventId: string) {
  const [seen, setSeen] = useState<FloorSeen>({ kind: 'loading' });
  const [freshness, setFreshness] = useState<Freshness>({
    state: 'noConnection',
    asOf: null,
    waiting: 0,
  });
  const [kept, setKept] = useState<KeptServiceTap[]>([]);
  const [notSent, setNotSent] = useState<TapRefusal[]>([]);
  const store = useMemo(() => storedServiceTaps(eventId), [eventId]);
  const read = useCallback(async (): Promise<ServicePhase> => {
    try {
      await restoreSession();
      const floor = await api.serviceFloor(eventId);
      setSeen({ kind: 'shown', floor });

      return floor.courses[0]?.phase ?? 'on';
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) setSeen({ kind: 'refused' });
      else setSeen((was) => (was.kind === 'shown' ? was : { kind: 'failed' }));
      throw error;
    }
  }, [eventId]);
  const readAgain = useCallback(() => void read().catch(() => undefined), [read]);

  const fresh = useMemo(() => createServiceFreshness({ read }), [read]);

  const flush = useCallback(async () => {
    const sent = await sendServiceTaps(store, (tap) => api.sendServiceTap(tap));
    setKept(sent.left);
    fresh.waiting(sent.left.length);
    if (sent.refused.length > 0)
      setNotSent((was) => [...was, ...sent.refused.flatMap((one) => one.lines)]);
    if (sent.refetch) readAgain();
  }, [fresh, readAgain, store]);

  useEffect(() => {
    const off = fresh.subscribe(setFreshness);
    const dropped = () => fresh.deviceOffline();
    const back = () => {
      readAgain();
      void flush();
    };
    fresh.start();
    void store.load().then((taps) => {
      setKept(taps);
      fresh.waiting(taps.length);
    });
    window.addEventListener('offline', dropped);
    window.addEventListener('online', back);

    return () => {
      window.removeEventListener('offline', dropped);
      window.removeEventListener('online', back);
      off();
      fresh.stop();
    };
  }, [flush, fresh, readAgain, store]);

  useHubTopics(
    [realtimeTopic('EventService', eventId)],
    () => api.serviceSubscription(eventId),
    (data) => {
      if ((data as { type?: string } | null)?.type === 'heartbeat') {
        fresh.message('heartbeat');
        return;
      }
      fresh.message('data');
      // ponytail: reads Floor again on each patch, as the app does; apply sc-4005's patches if a busy room makes this too many reads.
      readAgain();
    },
    () => {
      readAgain();
      void flush();
    },
  );

  const tap = useCallback(
    async (step: ServiceTapStep, expected: TapExpected): Promise<boolean> => {
      const now = tapNow(step.kind as KeptTap, fresh.state());
      if (typeof now === 'object') return false;
      const taps = await keepServiceTap(
        store,
        keptServiceTap(eventId, step, expected, crypto.randomUUID()),
      );
      setKept(taps);
      fresh.waiting(taps.length);
      if (now === 'send') await flush();

      return true;
    },
    [eventId, flush, fresh, store],
  );

  return {
    seen,
    freshness,
    kept,
    notSent,
    dismissNotSent: () => setNotSent([]),
    tap,
    retry: readAgain,
  };
}
