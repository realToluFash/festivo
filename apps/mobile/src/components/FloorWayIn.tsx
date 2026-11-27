import type { OrganisationEvent } from '@soirely/api-client';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import { dateLocale } from '../i18n/index.ts';
import { readFloorRow } from '../kit/floorWayIn.ts';
import { stationTime } from '../kit/kitchenStation.ts';
import { useSignedIn } from '../signedIn.ts';
import { useServiceRowItem } from './StationWayIn.tsx';

/** Floor (sc-98893): the row under Kitchen station, or Your night, on either Overview, for an account the floor read answers (sc-4002); its line from Floor's own read, its as of in the device's zone. */
export function useFloorRowItem(event: OrganisationEvent) {
  const { t } = useTranslation();
  const signedIn = useSignedIn().account != null;

  return useServiceRowItem(
    event,
    {
      key: 'floor',
      icon: 'seating',
      title: t('service.floor.wayIn.title'),
      said: (line) => t('service.floor.wayIn.said', { line }),
      asOf: (at) => stationTime(at, dateLocale()),
      read: () => readFloorRow(t, api.serviceFloor(event.id), dateLocale()),
      open: () =>
        router.push({
          pathname: '/events/[id]/floor',
          params: { id: event.id, from: 'overview' },
        }),
      testID: 'events.floor',
    },
    signedIn,
  );
}
