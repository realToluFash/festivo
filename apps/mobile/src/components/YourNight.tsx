import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { dateLocale } from '../i18n/index.ts';
import { rowLineOf } from '../kit/myNight.ts';
import { LineIcon } from './AccountCard.tsx';
import { useMyNight } from './MyNightScreen.tsx';
import { Row } from './Summary.tsx';

/** Your night (sc-3915), Overview's first row for an account on this event's roster with a shift; null for anybody else, and Overview is as it was. */
export function useYourNightItem(eventId: string) {
  const { t } = useTranslation();
  const { seen } = useMyNight(eventId, null);
  const line = seen.kind === 'shown' ? rowLineOf(t, seen.night, dateLocale()) : null;

  if (line == null) return null;

  return {
    key: 'night',
    inset: 40,
    row: (
      <Row
        title={t('myNight.title')}
        line={line}
        lead={<LineIcon name="clock" />}
        opens
        onPress={() => router.push({ pathname: '/events/[id]/my-night', params: { id: eventId } })}
        testID="events.yourNight"
      />
    ),
  };
}
