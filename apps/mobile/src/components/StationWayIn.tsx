import AsyncStorage from '@react-native-async-storage/async-storage';
import type { OrganisationEvent } from '@soirely/api-client';
import { formatEventClock } from '@soirely/domain';
import { router } from 'expo-router';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated } from 'react-native';

import { api } from '../api.ts';
import { dateLocale } from '../i18n/index.ts';
import { readPick } from '../kit/kitchenStation.ts';
import { useServerNow } from '../kit/serverNow.ts';
import {
  type StationRowRead,
  afterFailedRead,
  readStationRow,
  stationRowShows,
} from '../kit/stationWayIn.ts';
import { glide } from '../motion.ts';
import { useReducedMotion } from '../reducedMotion.ts';
import { useSignedIn } from '../signedIn.ts';
import { tokens } from '../theme/tokens.ts';
import { LineIcon } from './AccountCard.tsx';
import { usePhaseOf } from './Events.tsx';
import type { GlyphName } from './Glyph.tsx';
import { Row } from './Summary.tsx';

/** The line follows a fire within this long. */
const EVERY_MS = 30_000;

/** A service row on Overview: Kitchen station (sc-95382) or Floor (sc-98893), the same row with its own words, read and destination. */
export interface ServiceRow {
  key: string;
  icon: GlyphName;
  title: string;
  said: (line: string) => string;
  /** The line's time once it is stale, in the zone the row's story settled. */
  asOf: (at: string) => string;
  read: () => Promise<NonNullable<StationRowRead>>;
  open: () => void;
  testID: string;
}

/** A service row under Your night on either Overview, on the event's day, for an account its read answers; null for anybody else, and Overview is as it was. The read is held in a ref so a new closure does not start the polling over. */
export function useServiceRowItem(event: OrganisationEvent, row: ServiceRow, ready: boolean) {
  const { t } = useTranslation();
  const now = useServerNow();
  const phase = usePhaseOf(event, now);
  const shows = ready && phase != null && stationRowShows(event, phase, now);
  const [read, setRead] = useState<StationRowRead>(null);
  const reads = useRef(row.read);

  useEffect(() => {
    reads.current = row.read;
  });

  useEffect(() => {
    if (!shows) return;
    let current = true;
    const load = () =>
      reads.current().then(
        (fresh) => current && setRead(fresh),
        (error: unknown) => current && setRead((was) => afterFailedRead(was, error)),
      );
    void load();
    const timer = setInterval(() => void load(), EVERY_MS);

    return () => {
      current = false;
      clearInterval(timer);
    };
  }, [shows, event.id]);

  if (!shows || read == null) return null;

  const line = read.stale
    ? t('station.wayIn.asOf', { line: read.line, time: row.asOf(read.at) })
    : read.line;

  return {
    key: row.key,
    inset: 40,
    row: (
      <FadeIn>
        <Row
          title={row.title}
          line={line}
          lead={<LineIcon name={row.icon} />}
          opens
          accessibilityLabel={row.said(line)}
          onPress={row.open}
          testID={row.testID}
        />
      </FadeIn>
    ),
  };
}

/** Kitchen station (sc-95382): its line from the stations read and the device's last pick, its as of in the event's zone until sc-97945 moves it. */
export function useStationRowItem(event: OrganisationEvent) {
  const { t } = useTranslation();
  const accountId = useSignedIn().account?.id;

  return useServiceRowItem(
    event,
    {
      key: 'station',
      icon: 'tablet',
      title: t('station.wayIn.title'),
      said: (line) => t('station.wayIn.said', { line }),
      asOf: (at) => formatEventClock(at, event.timeZone, dateLocale()),
      read: () =>
        readStationRow(
          t,
          api.kitchenStations(event.id),
          readPick(AsyncStorage, accountId ?? '', event.id),
        ),
      open: () =>
        router.push({
          pathname: '/events/[id]/station',
          params: { id: event.id, from: 'overview' },
        }),
      testID: 'events.station',
    },
    accountId != null,
  );
}

/** It arrives once the read answers, over motionBase; at once under Reduce motion. */
function FadeIn({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  const [shown] = useState(() => new Animated.Value(reduced ? 1 : 0));

  useEffect(() => {
    if (!reduced) glide(shown, 1, tokens.motionBase).start();
  }, [shown, reduced]);

  return <Animated.View style={{ opacity: shown }}>{children}</Animated.View>;
}
