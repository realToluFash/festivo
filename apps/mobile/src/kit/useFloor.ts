import {
  ApiError,
  type KeptServiceTap,
  type ServiceTapStep,
  keepServiceTap,
  keptServiceTap,
  sendServiceTaps,
  realtimeTopic,
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
  withKeptTaps,
} from '@soirely/domain';
import { randomUUID } from 'expo-crypto';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { api } from '../api.ts';
import { followTopic } from '../followTopic.ts';
import { storedServiceTaps } from './serviceTaps.ts';

export type FloorSeen =
  | { kind: 'loading' }
  | { kind: 'refused' }
  | { kind: 'failed' }
  | { kind: 'shown'; floor: FloorRead };

/** Floor's read, followed live from sc-4005's topic, with sc-4028's freshness and kept taps. */
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
      const floor = await api.serviceFloor(eventId);
      setSeen({ kind: 'shown', floor });

      return floor.courses[0]?.phase ?? 'on';
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) setSeen({ kind: 'refused' });
      else setSeen((was) => (was.kind === 'shown' ? was : { kind: 'failed' }));
      throw error;
    }
  }, [eventId]);

  const fresh = useMemo(() => createServiceFreshness({ read }), [read]);

  const flush = useCallback(async () => {
    const sent = await sendServiceTaps(store, (tap) => api.sendServiceTap(tap));
    setKept(sent.left);
    fresh.waiting(sent.left.length);
    if (sent.refused.length > 0)
      setNotSent((was) => [...was, ...sent.refused.flatMap((one) => one.lines)]);
    if (sent.refetch) void read().catch(() => undefined);
  }, [fresh, read, store]);

  useEffect(() => {
    const off = fresh.subscribe(setFreshness);
    fresh.start();
    void store.load().then((taps) => {
      setKept(taps);
      fresh.waiting(taps.length);
    });
    const line = followTopic(realtimeTopic('EventService', eventId), {
      subscribe: () => api.serviceSubscription(eventId),
      onGap: () => {
        void read().catch(() => undefined);
        void flush();
      },
      onDrop: () => fresh.deviceOffline(),
      onData: (data) => {
        const message = parse(data);
        if (message?.type === 'heartbeat') {
          fresh.message('heartbeat');
          return;
        }
        fresh.message('data');
        // ponytail: reads Floor again on each patch rather than applying it; apply sc-4005's patches if a busy room makes this too many reads.
        void read().catch(() => undefined);
      },
    });

    return () => {
      off();
      line.stop();
      fresh.stop();
    };
  }, [eventId, flush, fresh, read, store]);

  const tap = useCallback(
    async (step: ServiceTapStep, expected: TapExpected): Promise<boolean> => {
      const now = tapNow(step.kind as KeptTap, fresh.state());
      if (typeof now === 'object') return false;
      const taps = await keepServiceTap(
        store,
        keptServiceTap(eventId, step, expected, randomUUID()),
      );
      setKept(taps);
      fresh.waiting(taps.length);
      if (now === 'send') await flush();

      return true;
    },
    [eventId, flush, fresh, store],
  );

  const shown = useMemo<FloorSeen>(
    () => (seen.kind === 'shown' ? { ...seen, floor: withKeptTaps(seen.floor, kept) } : seen),
    [seen, kept],
  );

  return {
    seen: shown,
    freshness,
    kept,
    notSent,
    dismissNotSent: () => setNotSent([]),
    tap,
    retry: () => void read().catch(() => undefined),
  };
}

function parse(data: string | null): { type?: string } | null {
  if (data == null) return null;
  try {
    return JSON.parse(data) as { type?: string };
  } catch {
    return null;
  }
}
