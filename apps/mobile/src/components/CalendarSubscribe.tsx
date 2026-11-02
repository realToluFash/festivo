import { type CalendarFeedLink } from '@soirely/api-client';
import { setStringAsync } from 'expo-clipboard';
import { useEffect, useRef, useState } from 'react';
import { Linking, ScrollView, StyleSheet, View, type ViewInstance } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import { tokens } from '../theme/tokens.ts';
import { DestructiveButton, PrimaryButton, QuietButton, SecondaryButton } from './Buttons.tsx';
import { Notice } from './Notice.tsx';
import { ReadOut } from './ReadOut.tsx';
import { Sheet } from './Sheet.tsx';
import { Text } from './Text.tsx';

const IN_FEED = ['inName', 'inTimes', 'inVenue', 'inMilestones'] as const;

const NEVER_IN_FEED = ['outGuests', 'outContacts', 'outDietary', 'outMoney'] as const;

type Load = { kind: 'loading' } | { kind: 'failed' } | { kind: 'loaded'; link: CalendarFeedLink };

/** The Calendar's "Subscribe in your calendar app" (sc-3626): the reader's own private feed link, to copy, open or reset. */
export function CalendarSubscribe({
  organisationId,
  organisationName,
  phone,
}: {
  organisationId: string;
  organisationName: string;
  phone: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const opener = useRef<ViewInstance>(null);

  return (
    <>
      <SecondaryButton
        ref={opener}
        label={t('calendarFeed.open')}
        stacked={phone}
        onPress={() => setOpen(true)}
        testID="calendarFeed.open"
      />
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        scrimLabel={t('calendarFeed.close')}
        held={resetting}
        opener={opener}
        testID="calendarFeed.sheet"
      >
        {open && (
          <SubscribePanel
            organisationId={organisationId}
            organisationName={organisationName}
            phone={phone}
            onResetting={setResetting}
            onClose={() => setOpen(false)}
          />
        )}
      </Sheet>
    </>
  );
}

function SubscribePanel({
  organisationId,
  organisationName,
  phone,
  onResetting,
  onClose,
}: {
  organisationId: string;
  organisationName: string;
  phone: boolean;
  onResetting: (resetting: boolean) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [copied, setCopied] = useState(false);
  const [copyRefused, setCopyRefused] = useState(false);
  const [noApp, setNoApp] = useState(false);
  const [renewed, setRenewed] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [notReset, setNotReset] = useState(false);
  const [announce, setAnnounce] = useState('');

  useEffect(() => {
    let current = true;

    api.calendarFeed(organisationId).then(
      (link) => current && setLoad({ kind: 'loaded', link }),
      () => current && setLoad({ kind: 'failed' }),
    );

    return () => {
      current = false;
    };
  }, [organisationId, attempt]);

  async function copy(url: string): Promise<void> {
    try {
      await setStringAsync(url);
      setCopied(true);
      setCopyRefused(false);
      setAnnounce(t('calendarFeed.copiedAnnounce'));
    } catch {
      setCopyRefused(true);
    }
  }

  async function openInApp(webcal: string): Promise<void> {
    try {
      await Linking.openURL(webcal);
      setNoApp(false);
    } catch {
      setNoApp(true);
    }
  }

  async function reset(): Promise<void> {
    setResetting(true);
    onResetting(true);
    setNotReset(false);

    try {
      const link = await api.resetCalendarFeed(organisationId);
      setLoad({ kind: 'loaded', link });
      setConfirming(false);
      setRenewed(true);
      setCopied(false);
      setCopyRefused(false);
      setAnnounce(t('calendarFeed.newLink'));
    } catch {
      setNotReset(true);
    } finally {
      setResetting(false);
      onResetting(false);
    }
  }

  if (confirming) {
    return (
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.panel}
        testID="calendarFeed.confirm"
      >
        <Text size={tokens.typeRowTitle.size} weight="bold" accessibilityRole="header">
          {t('calendarFeed.confirmTitle')}
        </Text>
        <Text size={tokens.typeBodyPhone.size}>{t('calendarFeed.confirmBody')}</Text>
        {notReset && (
          <ReadOut words={t('calendarFeed.notReset')} interrupts accessibilityRole="alert">
            <Notice
              tone="broken"
              mark={tokens.marks.broken.glyph}
              body={t('calendarFeed.notReset')}
            />
          </ReadOut>
        )}
        <View style={phone ? styles.confirmButtonsPhone : styles.confirmButtons}>
          <QuietButton
            label={t('calendarFeed.keep')}
            off={resetting}
            onPress={() => {
              setConfirming(false);
              setAnnounce(t('calendarFeed.kept'));
            }}
            testID="calendarFeed.keep"
          />
          <DestructiveButton
            label={t('calendarFeed.reset')}
            busy={resetting}
            onPress={() => void reset()}
            testID="calendarFeed.resetConfirm"
          />
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.panel}
      testID="calendarFeed.panel"
    >
      <View style={styles.head}>
        <Text
          size={tokens.typeRowTitle.size}
          weight="bold"
          accessibilityRole="header"
          style={styles.fill}
        >
          {t('calendarFeed.title')}
        </Text>
        <QuietButton
          label={t('calendarFeed.close')}
          onPress={onClose}
          testID="calendarFeed.close"
        />
      </View>
      <Text size={tokens.typeBodyPhone.size}>
        {t('calendarFeed.intro', { organisation: organisationName })}
      </Text>

      {load.kind === 'loading' && (
        <Text size={tokens.typeBodyPhone.size} muted>
          {t('calendarFeed.loading')}
        </Text>
      )}

      {load.kind === 'failed' && (
        <View style={styles.section}>
          <ReadOut words={t('calendarFeed.unreadable')} accessibilityRole="alert">
            <Notice
              tone="broken"
              mark={tokens.marks.broken.glyph}
              body={t('calendarFeed.unreadable')}
            />
          </ReadOut>
          <SecondaryButton
            label={t('calendarFeed.retry')}
            onPress={() => {
              setLoad({ kind: 'loading' });
              setAttempt((tries) => tries + 1);
            }}
            testID="calendarFeed.retry"
          />
        </View>
      )}

      {load.kind === 'loaded' && (
        <View style={styles.section}>
          <Text size={tokens.typeSmall.size} weight="semibold" muted>
            {t('calendarFeed.linkLabel')}
          </Text>
          <View style={styles.url}>
            <Text size={tokens.typeBodyPhone.size} selectable testID="calendarFeed.url">
              {load.link.url}
            </Text>
          </View>
          {renewed && (
            <Notice tone="done" mark={tokens.marks.done.glyph} body={t('calendarFeed.newLink')} />
          )}
          {copyRefused && (
            <ReadOut words={t('calendarFeed.copyRefused')} accessibilityRole="alert">
              <Text size={tokens.typeBodyPhone.size} style={styles.warning}>
                {t('calendarFeed.copyRefused')}
              </Text>
            </ReadOut>
          )}
          {noApp && (
            <ReadOut words={t('calendarFeed.noApp')} accessibilityRole="alert">
              <Text size={tokens.typeBodyPhone.size} style={styles.warning}>
                {t('calendarFeed.noApp')}
              </Text>
            </ReadOut>
          )}
          <View style={phone ? styles.buttonsPhone : styles.buttons}>
            <PrimaryButton
              label={copied ? t('calendarFeed.copied') : t('calendarFeed.copy')}
              onPress={() => void copy(load.link.url)}
              testID="calendarFeed.copy"
            />
            <SecondaryButton
              label={t('calendarFeed.openInApp')}
              onPress={() => void openInApp(load.link.webcal)}
              testID="calendarFeed.openInApp"
            />
          </View>
          <Text size={tokens.typeBodyPhone.size} style={styles.warning}>
            {t('calendarFeed.private')}
          </Text>
        </View>
      )}

      <View style={styles.lists}>
        <View style={styles.section}>
          <Text size={tokens.typeBodyPhone.size} weight="bold" accessibilityRole="header">
            {t('calendarFeed.inTitle')}
          </Text>
          {IN_FEED.map((key) => (
            <Text key={key} size={tokens.typeBodyPhone.size}>
              {`• ${t(`calendarFeed.${key}`)}`}
            </Text>
          ))}
        </View>
        <View style={styles.section}>
          <Text size={tokens.typeBodyPhone.size} weight="bold" accessibilityRole="header">
            {t('calendarFeed.outTitle')}
          </Text>
          {NEVER_IN_FEED.map((key) => (
            <Text key={key} size={tokens.typeBodyPhone.size}>
              {`• ${t(`calendarFeed.${key}`)}`}
            </Text>
          ))}
        </View>
        <Text size={tokens.typeSmall.size} muted>
          {t('calendarFeed.access')}
        </Text>
      </View>

      {load.kind === 'loaded' && (
        <View style={[styles.section, styles.reset]}>
          <Text size={tokens.typeBodyPhone.size} weight="bold" accessibilityRole="header">
            {t('calendarFeed.resetTitle')}
          </Text>
          <Text size={tokens.typeBodyPhone.size} muted>
            {t('calendarFeed.resetBody')}
          </Text>
          <SecondaryButton
            label={t('calendarFeed.reset')}
            onPress={() => {
              setNotReset(false);
              setAnnounce('');
              setConfirming(true);
            }}
            testID="calendarFeed.reset"
          />
        </View>
      )}

      <ReadOut words={announce} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexShrink: 1, flexGrow: 0 },
  panel: { gap: tokens.spaceXl, padding: tokens.space3xl },
  head: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceLg },
  fill: { flex: 1 },
  section: { gap: tokens.spaceSm },
  url: {
    padding: tokens.spaceLg,
    borderRadius: tokens.radiusInset,
    backgroundColor: tokens.colorInset,
  },
  warning: { color: tokens.colorAttentionText },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spaceSm },
  buttonsPhone: { gap: tokens.spaceSm },
  confirmButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: tokens.spaceSm,
  },
  confirmButtonsPhone: { flexDirection: 'column-reverse', gap: tokens.spaceSm },
  lists: {
    gap: tokens.spaceLg,
    padding: tokens.spaceXl,
    borderRadius: tokens.radiusInset,
    borderWidth: 1,
    borderColor: tokens.colorInsetBorder,
    backgroundColor: tokens.colorInset,
  },
  reset: {
    paddingTop: tokens.spaceLg,
    borderTopWidth: 1,
    borderTopColor: tokens.colorInsetBorder,
  },
});
