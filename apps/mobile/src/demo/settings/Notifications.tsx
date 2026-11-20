import { formattingLocale } from '@soirely/domain';
import { getLocales } from 'expo-localization';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import { I18nextProvider, useTranslation } from 'react-i18next';

import { NotificationsBody } from '../../components/NotificationsPage.tsx';
import { DemoOnly } from '../../steps/Lines.tsx';
import { CARD_WORDS, CW, type CardLanguage, cardLanguage } from '../night/lockCard.ts';
import {
  firstPage,
  type NotificationsState,
  notificationsStateOf,
  sampleClient,
} from './NotificationsModel.ts';
import { SummaryPage } from './SummaryPage.tsx';

/** Settings › Notification settings in B, summary first, on sample settings that never leave the device. */
export function NotificationsSection() {
  const { state, lang } = useLocalSearchParams<{ state?: string; lang?: string }>();
  const shown = notificationsStateOf(state);

  return (
    <NotificationsScreen key={`${shown ?? 'atRest'}|${lang ?? ''}`} state={shown} lang={lang} />
  );
}

function NotificationsScreen({
  state,
  lang,
}: {
  state: NotificationsState | null;
  lang: string | undefined;
}) {
  const { t, i18n } = useTranslation();
  const proposed = useMemo(() => {
    const words = i18n.cloneInstance({
      forkResourceStore: true,
      initAsync: false,
      ...(lang == null ? {} : { lng: cardLanguage(lang) }),
    });

    for (const one of Object.keys(CARD_WORDS) as CardLanguage[])
      words.addResource(
        one,
        'translation',
        'notificationSettings.note.event_day',
        CARD_WORDS[one].eventDayNote,
      );

    return words;
  }, [i18n, lang]);
  const locale = formattingLocale('en', getLocales()[0]?.languageTag);
  const blocked = useSampleBlocked(state === 'pushBlocked');
  const [client] = useState(() => sampleClient(state));
  const [start] = useState(() => firstPage(state));

  return (
    <SummaryPage title={t('notificationSettings.title')}>
      <I18nextProvider i18n={proposed}>
        <NotificationsBody client={client} start={start} blocked={blocked} locale={locale} />
      </I18nextProvider>
      <DemoOnly
        title={`Event day’s description is sc-66580’s, in ${CW.settled}, naming the run-of-show notification; ?lang=fr shows it in French, whole on an iPhone SE. With Event day’s push off, no card comes, the pressing device’s own included.`}
      >
        {null}
      </DemoOnly>
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
