import type { NotificationCategory } from '@soirely/api-client';
import { formattingLocale } from '@soirely/domain';
import { getLocales } from 'expo-localization';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AppState, Linking } from 'react-native';

import { useReadOut } from '../../components/ReadOut.tsx';
import { type Channel, readSettings, saveSetting } from '../../kit/notificationSettings.ts';
import { NotificationsCard } from './NotificationsCard.tsx';
import {
  cardCounts,
  cardSays,
  firstPage,
  NOT_SAVED,
  NOTIFICATIONS_TITLE,
  type NotificationsPage,
  type NotificationsState,
  notificationsStateOf,
  rowToggled,
  sampleClient,
  saveAnswered,
  switchSaving,
  WORDS,
} from './NotificationsModel.ts';
import { KindsSection } from './NotificationsRows.tsx';
import { useShell } from '../../components/settingsShell.ts';
import { SummaryPage } from './SummaryPage.tsx';
import { FailedBlock, LoadingBlock } from '../../components/Summary.tsx';

/** Settings › Notification settings in B, summary first, on sample settings that never leave the device. */
export function NotificationsSection() {
  const { state } = useLocalSearchParams<{ state?: string }>();
  const shown = notificationsStateOf(state);

  return <NotificationsScreen key={shown ?? 'atRest'} state={shown} />;
}

function NotificationsScreen({ state }: { state: NotificationsState | null }) {
  const shell = useShell();
  const locale = formattingLocale('en', getLocales()[0]?.languageTag);
  const blocked = useSampleBlocked(state === 'pushBlocked');
  const [client] = useState(() => sampleClient(state));
  const [page, setPage] = useState(() => firstPage(state));
  const [attempt, setAttempt] = useState(state === 'loading' ? 1 : 0);
  const mounted = useRef(true);
  const { grid } = page;
  const landscape = shell.layout === 'landscape';

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (attempt === 0) return;
    let current = true;
    void readSettings(client).then((apply) => {
      if (current) setPage((now) => ({ ...now, grid: apply(now.grid) }));
    });

    return () => {
      current = false;
    };
  }, [attempt, client]);

  useReadOut(spoken(page), {
    answer: page.answers,
    interrupts: unsavedNow(page),
    quietAtMount: true,
  });

  const change = (category: NotificationCategory, channel: Channel, on: boolean): void => {
    const own = { category, channel };
    setPage((now) => switchSaving(now, own, on));
    void saveSetting(client, category, channel, on).then((apply) => {
      if (mounted.current) setPage((now) => saveAnswered(now, apply, own));
    });
  };

  return (
    <SummaryPage title={NOTIFICATIONS_TITLE}>
      {grid.status === 'loading' && (
        <LoadingBlock words={WORDS.loading} height={landscape ? 156 : 200} icons />
      )}
      {grid.status === 'failed' && (
        <FailedBlock
          title={WORDS.notLoaded}
          line={WORDS.notLoadedLine}
          onRetry={() => {
            setPage((now) => ({ ...now, grid: { status: 'loading' } }));
            setAttempt((tries) => tries + 1);
          }}
          testID="notifications.tryAgain"
        />
      )}
      {grid.status === 'loaded' && (
        <>
          <NotificationsCard
            says={cardSays(grid.settings)}
            counts={cardCounts(grid.settings)}
            blocked={blocked}
            wide={shell.layout === 'portrait'}
            onSettings={() => void Linking.openSettings()}
          />
          <KindsSection
            page={page}
            settings={grid.settings}
            blocked={blocked}
            locale={locale}
            onToggle={(category) => setPage((now) => rowToggled(now, category))}
            onSwitch={change}
          />
        </>
      )}
    </SummaryPage>
  );
}

function unsavedNow({ grid }: NotificationsPage): boolean {
  return grid.status === 'loaded' && grid.unsaved != null;
}

/** Saved. as each save answers, or the failed switch's line as an alert; Saving… is silent. */
function spoken({ grid }: NotificationsPage): string | null {
  if (grid.status !== 'loaded') return null;
  if (grid.unsaved != null) return NOT_SAVED[grid.unsaved.channel];

  return grid.saved ? WORDS.savedOut : null;
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
