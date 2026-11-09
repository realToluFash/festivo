import { formattingLocale } from '@soirely/domain';
import { getLocales } from 'expo-localization';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useTranslation } from 'react-i18next';

import { NotificationsBody } from '../../components/NotificationsPage.tsx';
import {
  firstPage,
  type NotificationsState,
  notificationsStateOf,
  sampleClient,
} from './NotificationsModel.ts';
import { SummaryPage } from './SummaryPage.tsx';

/** Settings › Notification settings in B, summary first, on sample settings that never leave the device. */
export function NotificationsSection() {
  const { state } = useLocalSearchParams<{ state?: string }>();
  const shown = notificationsStateOf(state);

  return <NotificationsScreen key={shown ?? 'atRest'} state={shown} />;
}

function NotificationsScreen({ state }: { state: NotificationsState | null }) {
  const { t } = useTranslation();
  const locale = formattingLocale('en', getLocales()[0]?.languageTag);
  const blocked = useSampleBlocked(state === 'pushBlocked');
  const [client] = useState(() => sampleClient(state));
  const [start] = useState(() => firstPage(state));

  return (
    <SummaryPage title={t('notificationSettings.title')}>
      <NotificationsBody client={client} start={start} blocked={blocked} locale={locale} />
    </SummaryPage>
  );
}

/** The demo's stand-in for followPushBlocked, which would register for push: the sample's answer, asked again on return. */
function useSampleBlocked(sample: boolean): boolean {
  const [blocked, setBlocked] = useState(sample);

  useEffect(() => {
    const back = AppState.addEventListener('change', (now) => {
      if (now === 'active') setBlocked(sample);
    });

    return () => back.remove();
  }, [sample]);

  return blocked;
}
