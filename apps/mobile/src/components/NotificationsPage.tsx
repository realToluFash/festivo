import type { NotificationCategory } from '@soirely/api-client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Linking } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import { followPushBlocked } from '../appPush.ts';
import { currentLocale } from '../i18n/index.ts';
import {
  type Channel,
  readSettings,
  saveSetting,
  type SwitchesNotifications,
} from '../kit/notificationSettings.ts';
import {
  cardCounts,
  cardSays,
  type NotificationsPage as Page,
  pageOf,
  rowToggled,
  saveAnswered,
  spoken,
  switchSaving,
  unsavedNow,
} from '../kit/notificationsPage.ts';
import { rereadOrganisations } from '../signedIn.ts';
import { NotificationsCard } from './NotificationsCard.tsx';
import { KindsSection } from './NotificationsKinds.tsx';
import { useReadOut } from './ReadOut.tsx';
import { useShellLayout } from './settingsShell.ts';
import { FailedBlock, LoadingBlock } from './Summary.tsx';

/** Settings › Notification settings in the app, summary first: the card, then the six kinds (sc-30411). */
export function NotificationsPage({
  watch,
  refresh,
  onLoaded,
}: {
  /** The screen's offline watch, and the count it raises to read the page again under the band. */
  watch: <T>(load: Promise<T>) => Promise<T>;
  refresh: number;
  onLoaded: (loaded: boolean) => void;
}) {
  const [blocked, setBlocked] = useState(false);
  const [start] = useState(() => pageOf({ status: 'loading' }));
  const client = useMemo<SwitchesNotifications>(
    () => ({
      notificationSettings: () => watch(api.notificationSettings()),
      setNotificationSetting: (...change) => api.setNotificationSetting(...change),
    }),
    [watch],
  );

  useEffect(() => followPushBlocked(setBlocked), []);

  return (
    <NotificationsBody
      client={client}
      start={start}
      blocked={blocked}
      locale={currentLocale()}
      refresh={refresh}
      onLoaded={onLoaded}
      onRetry={() => void rereadOrganisations()}
    />
  );
}

/** The page on whichever client it is given: the API in the product, the sample in the demo. */
export function NotificationsBody({
  client,
  start,
  blocked,
  locale,
  refresh = 0,
  onLoaded,
  onRetry,
}: {
  client: SwitchesNotifications;
  /** Read at once when it opens loading; a link to another state opens as it says. */
  start: Page;
  blocked: boolean;
  locale: string;
  refresh?: number;
  onLoaded?: (loaded: boolean) => void;
  onRetry?: () => void;
}) {
  const { t } = useTranslation();
  const layout = useShellLayout();
  const [page, setPage] = useState(start);
  const [attempt, setAttempt] = useState(start.grid.status === 'loading' ? 1 : 0);
  const mounted = useRef(true);
  const { grid } = page;
  const loaded = grid.status === 'loaded';

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (attempt === 0 && refresh === 0) return;
    let current = true;
    void readSettings(client).then((apply) => {
      if (current) setPage((now) => ({ ...now, grid: apply(now.grid) }));
    });

    return () => {
      current = false;
    };
  }, [attempt, refresh, client]);

  useEffect(() => onLoaded?.(loaded), [loaded, onLoaded]);

  useReadOut(spoken(page, t), {
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

  if (grid.status === 'loading')
    return (
      <LoadingBlock
        words={t('pending.loading')}
        height={layout === 'landscape' ? 156 : 200}
        icons
      />
    );

  if (grid.status === 'failed')
    return (
      <FailedBlock
        title={t('notificationSettings.couldNotLoad')}
        line={t('notificationSettings.notLoadedLine')}
        onRetry={() => {
          onRetry?.();
          setPage((now) => ({ ...now, grid: { status: 'loading' } }));
          setAttempt((tries) => tries + 1);
        }}
        testID="notifications.tryAgain"
      />
    );

  return (
    <>
      <NotificationsCard
        says={cardSays(grid.settings, t)}
        counts={cardCounts(grid.settings, t)}
        blocked={blocked}
        wide={layout === 'portrait'}
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
  );
}
