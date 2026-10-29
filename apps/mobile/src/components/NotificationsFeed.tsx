import type { NotificationItem } from '@soirely/api-client';
import { feedAllRead, feedWithPage, feedWithRead } from '@soirely/domain';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type ViewInstance } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import { markPushAsked, pushAskDue, turnOnAppPush } from '../appPush.ts';
import { currentLocale } from '../i18n/index.ts';
import { SECTION_HREF } from '../kit/appNav.ts';
import { appPlace, whenShown } from '../kit/notificationPlace.ts';
import { setUnread } from '../notificationsUnread.ts';
import { tokens } from '../theme/tokens.ts';
import { Footnote, PrimaryButton, QuietButton } from './Buttons.tsx';
import { Notice } from './Notice.tsx';
import { useReadOut } from './ReadOut.tsx';
import { Text } from './Text.tsx';

type Feed =
  | { status: 'loading' }
  | { status: 'failed' }
  | { status: 'loaded'; items: NotificationItem[]; unread: number; next: string | null };

/** `NotificationsBell-*` in the app (sc-3980): the feed, its push ask, Mark all read and Show more. */
export function NotificationsFeed() {
  const { t } = useTranslation();
  const [feed, setFeed] = useState<Feed>({ status: 'loading' });
  const [gone, setGone] = useState<ReadonlySet<string>>(new Set());
  const [more, setMore] = useState<'idle' | 'loading' | 'failed'>('idle');
  const [asking, setAsking] = useState(false);
  const [said, setSaid] = useState<{ words: string } | null>(null);
  const heading = useRef<ViewInstance>(null);

  const fetchFeed = useCallback((): void => {
    api.notifications().then(
      (loaded) => {
        setFeed({
          status: 'loaded',
          items: loaded.items,
          unread: loaded.unreadCount,
          next: loaded.next,
        });
        setUnread(loaded.unreadCount);
      },
      () => setFeed({ status: 'failed' }),
    );
  }, []);

  function load(): void {
    setFeed({ status: 'loading' });
    fetchFeed();
  }

  useEffect(() => {
    fetchFeed();
    void pushAskDue().then(
      (due) => {
        if (!due) return;
        setAsking(true);
        void markPushAsked();
      },
      () => undefined,
    );
  }, [fetchFeed]);

  useReadOut(said?.words ?? null, { answer: said });

  useEffect(() => {
    if (feed.status === 'loaded') setUnread(feed.unread);
  }, [feed]);

  async function answerPush(turnOn: boolean): Promise<void> {
    if (turnOn) await turnOnAppPush().catch(() => undefined);
    setAsking(false);
    heading.current?.focus?.();
  }

  function openItem(item: NotificationItem): void {
    if (!item.read) {
      setFeed((current) =>
        current.status === 'loaded'
          ? { ...feedWithRead(current, item.id), status: 'loaded' }
          : current,
      );
      void api.readNotification(item.id).then(
        (answer) =>
          setFeed((current) =>
            current.status === 'loaded' ? { ...current, unread: answer.unreadCount } : current,
          ),
        () => undefined,
      );
    }

    if (item.eventId != null && !item.eventAvailable) {
      setGone((shown) => new Set(shown).add(item.id));
      return;
    }

    const place = appPlace(item.place);
    if (place != null) router.push(place);
  }

  async function readAll(): Promise<void> {
    if (feed.status !== 'loaded' || feed.unread === 0) return;

    setFeed({ ...feedAllRead(feed), status: 'loaded' });
    setSaid({ words: t('notifications.allRead') });
    try {
      const left = await api.readAllNotifications();
      setFeed((current) => (current.status === 'loaded' ? { ...current, unread: left } : current));
    } catch {
      load();
    }
  }

  function showMore(after: string): void {
    setMore('loading');
    api.notifications(after).then(
      (page) => {
        setFeed((current) =>
          current.status === 'loaded'
            ? { ...feedWithPage(current, page).feed, status: 'loaded' }
            : current,
        );
        setSaid({ words: t('notifications.moreShown', { count: page.items.length }) });
        setMore('idle');
      },
      () => setMore('failed'),
    );
  }

  const unread = feed.status === 'loaded' ? feed.unread : 0;

  return (
    <View style={styles.feed}>
      <View style={styles.header}>
        <View ref={heading} accessible focusable style={styles.fill}>
          <Text size={tokens.typeTitleSection.size} weight="bold" accessibilityRole="header">
            {t('notifications.heading')}
          </Text>
        </View>
        <Pressable
          style={styles.textButton}
          onPress={() => void readAll()}
          accessibilityRole="button"
          accessibilityState={{ disabled: unread === 0 }}
          testID="notifications.markAllRead"
        >
          <Text
            size={tokens.typeButton.size}
            weight="semibold"
            style={unread === 0 ? styles.secondaryInk : styles.accent}
          >
            {t('notifications.markAllRead')}
          </Text>
        </Pressable>
      </View>

      {asking && (
        <View style={styles.ask} testID="notifications.pushAsk">
          <Text size={tokens.typeRowTitle.size} weight="bold" accessibilityRole="header">
            {t('notifications.pushAsk.title')}
          </Text>
          <Text size={tokens.typeBodyPhone.size}>{t('notifications.pushAsk.reason')}</Text>
          <View style={styles.askActions}>
            <PrimaryButton
              label={t('notifications.pushAsk.turnOn')}
              onPress={() => void answerPush(true)}
              testID="notifications.pushAsk.turnOn"
            />
            <QuietButton
              label={t('notifications.pushAsk.notNow')}
              onPress={() => void answerPush(false)}
              testID="notifications.pushAsk.notNow"
            />
          </View>
        </View>
      )}

      {feed.status === 'loading' && (
        <View
          accessibilityState={{ busy: true }}
          accessible
          accessibilityLabel={t('notifications.loading')}
        >
          {[0, 1, 2].map((row) => (
            <View key={row} style={styles.skeleton} />
          ))}
        </View>
      )}

      {feed.status === 'failed' && (
        <Notice
          tone="broken"
          mark={tokens.marks.broken.glyph}
          body={t('notifications.couldNotLoad')}
          announce
          action={{
            label: t('notifications.tryAgain'),
            onPress: load,
            testID: 'notifications.tryAgain',
          }}
        />
      )}

      {feed.status === 'loaded' && feed.items.length === 0 && (
        <View style={styles.empty}>
          <Text size={tokens.typeBodyPhone.size} muted>
            {t('notifications.empty')}
          </Text>
        </View>
      )}

      {feed.status === 'loaded' &&
        feed.items.map((item) => (
          <View key={item.id} style={styles.row}>
            <Pressable
              style={styles.item}
              onPress={() => openItem(item)}
              accessibilityRole="button"
              testID={`notifications.item.${item.id}`}
            >
              <Text size={tokens.typeBodyPhone.size} weight={item.read ? 'regular' : 'bold'}>
                {item.title}
              </Text>
              {item.lines.map((line, index) => (
                <Text key={index} size={tokens.typeBodyPhone.size}>
                  {line}
                </Text>
              ))}
              <Text size={tokens.typeSmall.size} muted>
                {item.eventName == null
                  ? when(item.createdAt)
                  : t('notifications.whereWhen', {
                      event: item.eventName,
                      when: when(item.createdAt),
                    })}
              </Text>
              {(!item.read || item.muted) && (
                <View style={styles.marks}>
                  {!item.read && (
                    <View style={styles.mark}>
                      <View style={styles.dot} />
                      <Text size={tokens.typeSmall.size} weight="semibold">
                        {t('notifications.unread')}
                      </Text>
                    </View>
                  )}
                  {item.muted && (
                    <Text size={tokens.typeSmall.size} muted>
                      {t('notifications.muted')}
                    </Text>
                  )}
                </View>
              )}
            </Pressable>
            {gone.has(item.id) && (
              <Notice
                tone="quiet"
                mark={tokens.marks.info.glyph}
                body={t('notifications.eventGone')}
                announce
              />
            )}
          </View>
        ))}

      {feed.status === 'loaded' && feed.next != null && (
        <View style={styles.more}>
          <Pressable
            style={styles.textButton}
            onPress={() => more !== 'loading' && feed.next != null && showMore(feed.next)}
            accessibilityRole="button"
            accessibilityState={{ busy: more === 'loading' }}
            testID="notifications.showMore"
          >
            {more === 'loading' && <ActivityIndicator color={tokens.colorAccent} />}
            <Text size={tokens.typeButton.size} weight="semibold" style={styles.accent}>
              {t('notifications.showMore')}
            </Text>
          </Pressable>
          {more === 'failed' && (
            <Notice tone="attention" mark="!" body={t('notifications.moreFailed')} announce />
          )}
        </View>
      )}

      <Footnote
        action={t('notifications.settings')}
        role="link"
        onPress={() => router.push(SECTION_HREF.notifications)}
        testID="notifications.settings"
      />
    </View>
  );

  function when(createdAt: string): string {
    const shown = whenShown(createdAt, new Date(), currentLocale());

    return shown.today ? t('notifications.atTime', { time: shown.time }) : shown.date;
  }
}

const styles = StyleSheet.create({
  feed: { gap: tokens.spaceLg },
  header: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceLg },
  fill: { flex: 1 },
  textButton: {
    minHeight: tokens.sizeHit,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceXs,
  },
  accent: { color: tokens.colorAccentText },
  secondaryInk: { color: tokens.colorInkSecondary },
  ask: {
    gap: tokens.spaceSm,
    padding: tokens.spaceLg,
    borderRadius: tokens.radiusInset,
    backgroundColor: tokens.colorInset,
    borderWidth: 1,
    borderColor: tokens.colorInsetBorder,
  },
  askActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: tokens.spaceLg },
  skeleton: {
    height: tokens.sizeHitPhonePrimary,
    marginBottom: tokens.spaceSm,
    borderRadius: tokens.radiusSmall,
    backgroundColor: tokens.colorInset,
  },
  empty: { paddingVertical: tokens.spaceXl },
  row: { gap: tokens.spaceXs },
  item: {
    gap: tokens.spaceXxs,
    minHeight: tokens.sizeHit,
    paddingVertical: tokens.spaceSm,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colorInsetBorder,
  },
  marks: { flexDirection: 'row', gap: tokens.spaceLg },
  mark: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceXs },
  dot: {
    width: tokens.spaceSm,
    height: tokens.spaceSm,
    borderRadius: tokens.spaceSm / 2,
    backgroundColor: tokens.colorAccent,
  },
  more: { gap: tokens.spaceSm },
});
