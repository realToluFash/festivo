import type { NotificationCategory, NotificationSetting } from '@soirely/api-client';
import { NOTIFICATION_CATEGORY_ORDER, settingFlipped } from '@soirely/domain';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../../../api.ts';
import {
  AllowPushDialog,
  HearingCard,
  Kind,
  KindsLoading,
} from '../../../components/NotificationParts.tsx';
import { Refreshing } from '../../../components/OfflineBand.tsx';
import { Head, TextAction } from '../../../components/SettingsParts.tsx';
import { currentLocale } from '../../../i18n/index.ts';
import { LayersContext, useDeskLayers } from '../../../layers.ts';
import {
  CHANNELS,
  type Channel,
  type Switch,
  allowSteps,
  cardCounts,
  cardSays,
  categoryName,
  categoryNote,
  channelName,
  keyOf,
  lockedLine,
  notSaved,
  quietHoursLine,
  rowValue,
  switchName,
  tagOf,
} from '../../../notificationsPage.ts';
import { keepsWhatLoaded, useOffline } from '../../../offline.ts';
import { usePushBlocked } from '../../../pushPermission.ts';
import '../../../components/SettingsParts.css';

type Load = NotificationSetting[] | 'failed' | null;

/** Notification settings at a desk in B · Summary first (sc-30411), as the design demo's /demo/settings/notifications draws it. */
export function NotificationsDesk() {
  const { t } = useTranslation();
  const locale = currentLocale();
  const title = useRef<HTMLHeadingElement>(null);
  const { layers, covered, setHost } = useDeskLayers();
  const blocked = usePushBlocked();
  const [settings, setSettings] = useState<Load>(null);
  const [attempt, setAttempt] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [open, setOpen] = useState<NotificationCategory | null>(null);
  const [saving, setSaving] = useState<readonly string[]>([]);
  const [saved, setSaved] = useState<NotificationCategory | null>(null);
  const [unsaved, setUnsaved] = useState<Switch | null>(null);
  const [said, setSaid] = useState('');
  const [allow, setAllow] = useState(false);
  const loaded = settings != null && settings !== 'failed' ? settings : null;
  const { watch, refreshing } = useOffline({
    loaded: loaded != null,
    reload: () => setRefresh((n) => n + 1),
    title,
  });

  useEffect(() => {
    let live = true;

    watch(api.notificationSettings()).then(
      (now) => {
        if (live) setSettings(now);
      },
      (error: unknown) => {
        if (!live) return;
        setSettings((was) => (Array.isArray(was) && keepsWhatLoaded(error) ? was : 'failed'));
      },
    );

    return () => {
      live = false;
    };
  }, [attempt, refresh, watch]);

  function flipped(category: NotificationCategory, channel: Channel, on: boolean): void {
    setSettings((now) => (Array.isArray(now) ? settingFlipped(now, category, channel, on) : now));
  }

  async function change(one: Switch, on: boolean): Promise<void> {
    const key = keyOf(one);
    if (saving.includes(key)) return;

    setSaving((now) => [...now, key]);
    setUnsaved(null);
    setSaid('');
    flipped(one.category, one.channel, on);

    try {
      const answer = await api.setNotificationSetting(one.category, one.channel, on);
      flipped(
        one.category,
        one.channel,
        answer.find((row) => row.category === one.category)?.[one.channel].on ?? on,
      );
      setSaved(one.category);
      setSaid(t('notificationSettings.saved'));
    } catch {
      flipped(one.category, one.channel, !on);
      setUnsaved(one);
      setSaved(null);
    }

    setSaving((now) => now.filter((busy) => busy !== key));
  }

  function toggle(category: NotificationCategory): void {
    if (open !== category) setSaved(null);
    setOpen((now) => (now === category ? null : category));
  }

  function kind(category: NotificationCategory) {
    const setting = loaded?.find((row) => row.category === category);
    if (setting == null) return null;
    const failed = unsaved?.category === category ? unsaved.channel : null;

    return (
      <Kind
        key={category}
        category={category}
        name={categoryName(category, t)}
        value={rowValue(setting, t)}
        covers={categoryNote(category, locale, t)}
        open={open === category}
        tag={tagOf(category, saving, saved)}
        failure={failed == null ? null : notSaved(failed, t)}
        switches={CHANNELS.map((channel) => {
          const locked = !setting[channel].switchable;

          return {
            channel,
            title: channelName(channel, t),
            label: switchName(category, channel, t),
            line: locked
              ? lockedLine(channel, t)
              : channel === 'push' && blocked
                ? t('notificationSettings.blockedHere')
                : null,
            on: setting[channel].on,
            locked,
            busy: saving.includes(keyOf({ category, channel })),
            failure: failed === channel ? notSaved(channel, t) : null,
          };
        })}
        words={{
          on: t('notificationSettings.on'),
          off: t('notificationSettings.off'),
          saving: t('notificationSettings.saving'),
          saved: t('notificationSettings.savedTag'),
        }}
        onToggle={() => toggle(category)}
        onChange={(channel, on) => void change({ category, channel }, on)}
      />
    );
  }

  return (
    <LayersContext value={layers}>
      <div className="desk-column account-desk" inert={covered}>
        {refreshing && <Refreshing />}
        <header className="desk-top">
          <h1 ref={title} className="desk-title" tabIndex={-1}>
            {t('notificationSettings.title')}
          </h1>
        </header>
        {settings == null && <KindsLoading label={t('pending.loading')} />}
        {settings === 'failed' && (
          <div className="desk-failed" role="alert">
            <h2>{t('notificationSettings.couldNotLoad')}</h2>
            <p className="desk-line">{t('notificationSettings.notLoadedLine')}</p>
            <TextAction
              label={t('notificationSettings.tryAgain')}
              onClick={() => {
                setSettings(null);
                setAttempt((n) => n + 1);
              }}
            />
          </div>
        )}
        {loaded != null && (
          <>
            <HearingCard
              says={cardSays(loaded, t)}
              summary={cardCounts(loaded, t)}
              blocked={blocked ? t('notificationSettings.blockedLine') : null}
              step={
                blocked
                  ? { label: t('notificationSettings.allow.step'), onClick: () => setAllow(true) }
                  : null
              }
            />
            <section className="desk-block">
              <Head title={t('notificationSettings.kinds')} />
              <ul className="desk-rows account-rows">{NOTIFICATION_CATEGORY_ORDER.map(kind)}</ul>
              <p className="desk-foot">{quietHoursLine(locale, t)}</p>
            </section>
            <p className="desk-unseen" aria-live="polite">
              {said}
            </p>
          </>
        )}
      </div>
      <div ref={setHost} className="desk-layers" />
      {allow && (
        <AllowPushDialog
          words={{
            title: t('notificationSettings.allow.title'),
            verb: t('notificationSettings.allow.done'),
            intro: t('notificationSettings.allow.intro'),
            steps: allowSteps(t),
            elsewhere: t('notificationSettings.allow.elsewhere'),
          }}
          onDone={() => setAllow(false)}
        />
      )}
    </LayersContext>
  );
}
