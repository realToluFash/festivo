import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiError, type OrganisationEvent } from '@soirely/api-client';
import { NO_ANSWER_MS, answeredWithin, formatEventClock } from '@soirely/domain';
import { router } from 'expo-router';
import { type ReactNode, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated } from 'react-native';

import { api } from '../api.ts';
import { dateLocale } from '../i18n/index.ts';
import { pickedKey } from '../kit/kitchenStation.ts';
import { useServerNow } from '../kit/serverNow.ts';
import { stationRowLine, stationRowShows } from '../kit/stationWayIn.ts';
import { glide } from '../motion.ts';
import { useReducedMotion } from '../reducedMotion.ts';
import { tokens } from '../theme/tokens.ts';
import { LineIcon } from './AccountCard.tsx';
import { usePhaseOf } from './Events.tsx';
import { Row } from './Summary.tsx';

/** The line follows a fire within this long. */
const EVERY_MS = 30_000;

type Read = { line: string; at: string; stale: boolean } | null;

/** Kitchen station (sc-95382), the row under Your night on either Overview, on the event's day, for an account the stations read answers; null for anybody else, and Overview is as it was. */
export function useStationRowItem(event: OrganisationEvent) {
  const { t } = useTranslation();
  const now = useServerNow();
  const phase = usePhaseOf(event, now);
  const shows = phase != null && stationRowShows(event, phase, now);
  const [read, setRead] = useState<Read>(null);

  useEffect(() => {
    if (!shows) return;
    let current = true;
    const load = () =>
      answeredWithin(
        Promise.all([
          api.kitchenStations(event.id),
          AsyncStorage.getItem(pickedKey(event.id)).catch(() => null),
        ]),
        () => new Error('The kitchen stations read went unanswered.'),
        NO_ANSWER_MS,
      ).then(
        ([stations, picked]) =>
          current &&
          setRead({
            line: stationRowLine(t, stations, picked),
            at: new Date().toISOString(),
            stale: false,
          }),
        (error: unknown) => {
          if (!current) return;
          if (error instanceof ApiError && (error.status === 403 || error.status === 404))
            setRead(null);
          else setRead((was) => (was == null ? was : { ...was, stale: true }));
        },
      );
    void load();
    const timer = setInterval(() => void load(), EVERY_MS);

    return () => {
      current = false;
      clearInterval(timer);
    };
  }, [shows, event.id, t]);

  if (!shows || read == null) return null;

  const line = read.stale
    ? t('station.wayIn.asOf', {
        line: read.line,
        time: formatEventClock(read.at, event.timeZone, dateLocale()),
      })
    : read.line;

  return {
    key: 'station',
    inset: 40,
    row: (
      <FadeIn>
        <Row
          title={t('station.wayIn.title')}
          line={line}
          lead={<LineIcon name="tablet" />}
          opens
          accessibilityLabel={t('station.wayIn.said', { line })}
          onPress={() =>
            router.push({
              pathname: '/events/[id]/station',
              params: { id: event.id, from: 'overview' },
            })
          }
          testID="events.station"
        />
      </FadeIn>
    ),
  };
}

/** It arrives once the stations read answers, over motionBase; at once under Reduce motion. */
function FadeIn({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  const [shown] = useState(() => new Animated.Value(reduced ? 1 : 0));

  useEffect(() => {
    if (!reduced) glide(shown, 1, tokens.motionBase).start();
  }, [shown, reduced]);

  return <Animated.View style={{ opacity: shown }}>{children}</Animated.View>;
}
