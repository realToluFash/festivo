import type { CalendarFeedLink } from '@soirely/api-client';
import { setStringAsync } from 'expo-clipboard';
import { type RefObject, useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View, type ViewInstance } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import { rereadOrganisations } from '../signedIn.ts';
import { tokens } from '../theme/tokens.ts';
import { CentredDialog } from './CalendarOverlays.tsx';
import { Glyph, type GlyphName } from './Glyph.tsx';
import { Notice } from './Notice.tsx';
import { useReadOut } from './ReadOut.tsx';
import { Pill } from './SettingsParts.tsx';
import { Sheet } from './Sheet.tsx';
import { TextAction } from './SummaryRows.tsx';
import { Text } from './Text.tsx';

const IN_FEED = ['inName', 'inTimes', 'inVenue', 'inMilestones'] as const;

const NEVER_IN_FEED = ['outGuests', 'outContacts', 'outDietary', 'outMoney'] as const;

/** Where the panel's link comes from: the API in the product, the sample in the demo. */
export interface FeedSource {
  read: () => Promise<CalendarFeedLink>;
  reset: () => Promise<CalendarFeedLink>;
  openInApp: (link: CalendarFeedLink) => Promise<void>;
  /** Before a read is tried again. */
  onRetry?: () => void;
  /** A link already in hand, shown without a read. */
  known?: CalendarFeedLink;
}

/** How the panel opens: as it is, with a copy already refused, or asking to reset. */
export type FeedStart = 'panel' | 'refused' | 'reset';

export function apiFeed(organisationId: string): FeedSource {
  return {
    read: () => api.calendarFeed(organisationId),
    reset: () => api.resetCalendarFeed(organisationId),
    openInApp: async (link) => {
      await Linking.openURL(link.webcal);
    },
    onRetry: () => void rereadOrganisations(),
  };
}

type Load = { kind: 'loading' } | { kind: 'failed' } | { kind: 'loaded'; link: CalendarFeedLink };

/** The Calendar's "Subscribe in your calendar app" (sc-3626): a sheet on the phone, a centred dialog on an iPad. */
export function CalendarFeed({
  open,
  onClose,
  opener,
  phone,
  upright,
  organisationName,
  source,
  start = 'panel',
}: {
  open: boolean;
  onClose: () => void;
  opener: RefObject<ViewInstance | null>;
  phone: boolean;
  upright: boolean;
  organisationName: string;
  source: FeedSource;
  start?: FeedStart;
}) {
  const { t } = useTranslation();
  const [resetting, setResetting] = useState(false);
  const close = () => {
    if (!resetting) onClose();
  };
  const panel = open && (
    <SubscribePanel
      organisationName={organisationName}
      source={source}
      start={start}
      wide={!phone}
      onResetting={setResetting}
      onClose={close}
    />
  );

  if (phone)
    return (
      <Sheet
        open={open}
        onClose={onClose}
        held={resetting}
        opener={opener}
        scrimLabel={t('calendarFeed.close')}
        headingTakesFocus
        testID="calendarFeed.sheet"
      >
        <ScrollView bounces={false} contentContainerStyle={styles.sheetBody}>
          {panel}
        </ScrollView>
      </Sheet>
    );

  return (
    <CentredDialog
      open={open}
      onClose={close}
      opener={opener}
      width={upright ? 560 : 600}
      testID="calendarFeed.sheet"
    >
      {panel}
    </CentredDialog>
  );
}

function Disc({ yes }: { yes: boolean }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.disc, yes ? styles.discYes : styles.discNo]}
    >
      <Glyph
        name={yes ? 'tick' : 'x'}
        size={yes ? 12 : 11}
        ink={yes ? tokens.marks.done.ink : tokens.colorInkSecondary}
        weight={3}
      />
    </View>
  );
}

function List({ title, items, yes }: { title: string; items: readonly string[]; yes: boolean }) {
  return (
    <View style={styles.listBlock}>
      <Text size={15} weight="bold" accessibilityRole="header" style={styles.listTitle}>
        {title}
      </Text>
      {items.map((item) => (
        <View key={item} style={styles.listRow}>
          <Disc yes={yes} />
          <Text size={15} weight="medium" style={styles.listWords}>
            {item}
          </Text>
        </View>
      ))}
    </View>
  );
}

function Close({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();

  return (
    <Pressable
      onPress={onClose}
      style={({ pressed }) => [styles.close, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={t('calendarFeed.close')}
      testID="calendarFeed.close"
    >
      <Glyph name="x" size={18} ink={tokens.colorInk} weight={2.4} />
    </Pressable>
  );
}

function Said({ words, answer }: { words: string; answer: unknown }) {
  useReadOut(words, { answer });

  return null;
}

/** The reader's own private feed link, to copy, open in a calendar app or reset; stacked on the phone, side by side on an iPad. */
export function SubscribePanel({
  organisationName,
  source,
  start,
  wide,
  onResetting,
  onClose,
}: {
  organisationName: string;
  source: FeedSource;
  start: FeedStart;
  wide: boolean;
  onResetting: (resetting: boolean) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [load, setLoad] = useState<Load>(
    source.known == null ? { kind: 'loading' } : { kind: 'loaded', link: source.known },
  );
  const [attempt, setAttempt] = useState(0);
  const [asking, setAsking] = useState(start === 'reset');
  const [refused, setRefused] = useState(start === 'refused');
  const [noApp, setNoApp] = useState(false);
  const [copied, setCopied] = useState(false);
  const [renewed, setRenewed] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [notReset, setNotReset] = useState(false);
  const [said, setSaid] = useState<{ words: string; at: number } | null>(null);
  const say = (words: string) => setSaid({ words, at: Date.now() });

  useEffect(() => {
    if (source.known != null && attempt === 0) return;
    let current = true;

    source.read().then(
      (link) => current && setLoad({ kind: 'loaded', link }),
      () => current && setLoad({ kind: 'failed' }),
    );

    return () => {
      current = false;
    };
  }, [source, attempt]);

  const copy = (url: string) => {
    setStringAsync(url).then(
      () => {
        setCopied(true);
        setRefused(false);
        say(t('calendarFeed.copiedAnnounce'));
      },
      () => setRefused(true),
    );
  };

  const openInApp = (link: CalendarFeedLink) => {
    source.openInApp(link).then(
      () => setNoApp(false),
      () => setNoApp(true),
    );
  };

  const reset = () => {
    setResetting(true);
    onResetting(true);
    setNotReset(false);
    source
      .reset()
      .then(
        (link) => {
          setLoad({ kind: 'loaded', link });
          setAsking(false);
          setRenewed(true);
          setCopied(false);
          setRefused(false);
          say(t('calendarFeed.newLink'));
        },
        () => setNotReset(true),
      )
      .finally(() => {
        setResetting(false);
        onResetting(false);
      });
  };

  const keep = () => {
    setAsking(false);
    say(t('calendarFeed.kept'));
  };

  const head = (title: string) => (
    <View style={styles.head}>
      <Text size={20} weight="bold" accessibilityRole="header" style={[styles.grow, styles.title]}>
        {title}
      </Text>
      <Close onClose={onClose} />
    </View>
  );

  if (asking) {
    const keepPill = (
      <Pill
        label={t('calendarFeed.keep')}
        kind={resetting ? 'off' : 'secondary'}
        height={wide ? tokens.sizeHit : tokens.sizeHitPhonePrimary}
        full={!wide}
        onPress={keep}
        testID="calendarFeed.keep"
      />
    );

    return (
      <View style={styles.panel} testID="calendarFeed.confirm">
        {said != null && <Said words={said.words} answer={said.at} />}
        {head(t('calendarFeed.confirmTitle'))}
        <Text size={15} weight="medium" style={styles.body}>
          {t('calendarFeed.confirmBody')}
        </Text>
        {notReset && (
          <Notice
            tone="broken"
            mark={tokens.marks.broken.glyph}
            body={t('calendarFeed.notReset')}
            announce
            interrupts
          />
        )}
        <View style={wide ? styles.pairRow : styles.stack}>
          {wide && keepPill}
          <Pill
            label={t('calendarFeed.reset')}
            kind={resetting ? 'off' : 'danger'}
            height={wide ? tokens.sizeHit : tokens.sizeHitPhonePrimary}
            full={!wide}
            onPress={reset}
            testID="calendarFeed.resetConfirm"
          />
          {!wide && keepPill}
        </View>
      </View>
    );
  }

  const link = load.kind === 'loaded' ? load.link : null;
  const buttons =
    link == null
      ? []
      : [
          <Pill
            key="copy"
            label={copied ? t('calendarFeed.copied') : t('calendarFeed.copy')}
            glyph={copied ? 'tick' : 'copy'}
            height={tokens.sizeHitPhonePrimary}
            onPress={() => copy(link.url)}
            testID="calendarFeed.copy"
          />,
          <Pill
            key="open"
            label={t('calendarFeed.openInApp')}
            kind="secondary"
            glyph="link"
            height={tokens.sizeHitPhonePrimary}
            onPress={() => openInApp(link)}
            testID="calendarFeed.openInApp"
          />,
        ];

  return (
    <View style={styles.panel} testID="calendarFeed.panel">
      {said != null && <Said words={said.words} answer={said.at} />}
      {head(t('calendarFeed.title'))}
      <Text size={15} weight="medium" style={[styles.secondary, styles.body]}>
        {t('calendarFeed.intro', { organisation: organisationName })}
      </Text>
      {load.kind === 'loading' && (
        <Text size={15} weight="medium" style={[styles.secondary, styles.body]}>
          {t('calendarFeed.loading')}
        </Text>
      )}
      {load.kind === 'failed' && (
        <View style={styles.stack}>
          <Notice
            tone="broken"
            mark={tokens.marks.broken.glyph}
            body={t('calendarFeed.unreadable')}
            announce
          />
          <Pill
            label={t('calendarFeed.retry')}
            kind="secondary"
            height={tokens.sizeHit}
            full={false}
            onPress={() => {
              source.onRetry?.();
              setLoad({ kind: 'loading' });
              setAttempt((tries) => tries + 1);
            }}
            testID="calendarFeed.retry"
          />
        </View>
      )}
      {link != null && (
        <>
          <View style={styles.linkBlock}>
            <Text size={13} weight="semibold" style={styles.secondary}>
              {t('calendarFeed.linkLabel')}
            </Text>
            <View style={styles.link}>
              <Text
                size={14.5}
                weight="medium"
                selectable
                style={styles.linkWords}
                testID="calendarFeed.url"
              >
                {link.url}
              </Text>
            </View>
          </View>
          {renewed && (
            <Notice tone="done" mark={tokens.marks.done.glyph} body={t('calendarFeed.newLink')} />
          )}
          {refused && (
            <Notice
              tone="broken"
              mark={tokens.marks.broken.glyph}
              body={t('calendarFeed.copyRefused')}
              announce={start !== 'refused'}
            />
          )}
          {noApp && (
            <Notice
              tone="broken"
              mark={tokens.marks.broken.glyph}
              body={t('calendarFeed.noApp')}
              announce
            />
          )}
          <View style={wide ? styles.pairWide : styles.stack}>
            {wide
              ? buttons.map((button) => (
                  <View key={button.key} style={styles.grow}>
                    {button}
                  </View>
                ))
              : buttons}
          </View>
          <Line glyph="shield" words={t('calendarFeed.private')} />
        </>
      )}
      <View style={styles.rule} />
      <View style={wide ? styles.columns : styles.stackLists}>
        <View style={wide ? styles.grow : undefined}>
          <List
            title={t('calendarFeed.inTitle')}
            items={IN_FEED.map((key) => t(`calendarFeed.${key}`))}
            yes
          />
        </View>
        <View style={wide ? styles.grow : undefined}>
          <List
            title={t('calendarFeed.outTitle')}
            items={NEVER_IN_FEED.map((key) => t(`calendarFeed.${key}`))}
            yes={false}
          />
        </View>
      </View>
      <Text size={14} weight="medium" style={[styles.secondary, styles.small]}>
        {t('calendarFeed.access')}
      </Text>
      {link != null && (
        <>
          <View style={styles.rule} />
          <View style={styles.resetBlock}>
            <Text size={15} weight="bold" accessibilityRole="header" style={styles.listTitle}>
              {t('calendarFeed.resetTitle')}
            </Text>
            <Text size={14} weight="medium" style={[styles.secondary, styles.small]}>
              {t('calendarFeed.resetBody')}
            </Text>
            <View style={styles.resetAction}>
              <TextAction
                label={t('calendarFeed.resetOpen')}
                removes
                onPress={() => {
                  setNotReset(false);
                  setAsking(true);
                }}
                testID="calendarFeed.reset"
              />
            </View>
          </View>
        </>
      )}
    </View>
  );
}

function Line({ glyph, words }: { glyph: GlyphName; words: string }) {
  return (
    <View style={styles.line}>
      <View style={styles.lineGlyph}>
        <Glyph name={glyph} size={16} ink={tokens.colorInkSecondary} weight={2} />
      </View>
      <Text size={14} weight="medium" style={[styles.grow, styles.secondary, styles.small]}>
        {words}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  secondary: { color: tokens.colorInkSecondary },
  pressed: { opacity: tokens.opacityPressed },
  sheetBody: {
    paddingTop: tokens.spaceXl,
    paddingHorizontal: tokens.spaceXxl,
    paddingBottom: tokens.spaceSm,
  },
  panel: { gap: tokens.spacePillEnd },
  head: {
    minHeight: tokens.sizeHit,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceMd,
  },
  title: { lineHeight: 20 * 1.25, letterSpacing: -0.2 },
  close: {
    width: tokens.sizeHit,
    height: tokens.sizeHit,
    borderRadius: tokens.sizeHit / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorInset,
  },
  body: { lineHeight: 15 * 1.45 },
  small: { lineHeight: 14 * 1.45 },
  linkBlock: { gap: tokens.spaceXs },
  link: {
    paddingVertical: tokens.spaceLg,
    paddingHorizontal: tokens.spacePillEnd,
    borderRadius: tokens.spacePillEnd,
    backgroundColor: tokens.colorInset,
  },
  linkWords: { lineHeight: 14.5 * 1.45 },
  stack: { gap: tokens.spaceMd },
  pairWide: { flexDirection: 'row', gap: tokens.spaceMd },
  pairRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: tokens.spaceMd },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceSm },
  lineGlyph: { paddingTop: 2 },
  rule: { height: 1, backgroundColor: tokens.colorBorder },
  columns: { flexDirection: 'row', gap: tokens.space3xl },
  stackLists: { gap: tokens.spaceXl },
  listBlock: { gap: tokens.spaceSm },
  listTitle: { lineHeight: 15 * 1.3 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceMd },
  listWords: { flexShrink: 1, lineHeight: 15 * 1.4 },
  disc: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  discYes: { backgroundColor: tokens.marks.done.fill },
  discNo: { backgroundColor: tokens.colorInsetBorder },
  resetBlock: { gap: tokens.spaceXs },
  resetAction: { alignItems: 'flex-start' },
});
