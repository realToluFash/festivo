import { ApiError, type StaffEntry, realtimeTopic } from '@soirely/api-client';
import { setStringAsync } from 'expo-clipboard';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Share, StyleSheet, View, type ViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '../../api.ts';
import { followReadingAgain } from '../../followTopic.ts';
import { dateLocale } from '../../i18n/index.ts';
import {
  acts,
  asksAfterShare,
  helpLine,
  linkWord,
  offersMarkSent,
  offersReplace,
  shiftLine,
  trailLine,
} from '../../kit/staffRoster.ts';
import { useLayout } from '../../layout/useLayout.ts';
import { tokens } from '../../theme/tokens.ts';
import { DestructiveButton, PrimaryButton, QuietButton, SecondaryButton } from '../Buttons.tsx';
import { Spinner } from '../CalendarControls.tsx';
import { Field, TextField } from '../Field.tsx';
import { Glyph } from '../Glyph.tsx';
import { Notice } from '../Notice.tsx';
import { readOut } from '../ReadOut.tsx';
import { Sheet, SheetActions } from '../Sheet.tsx';
import { Skeleton } from '../Skeleton.tsx';
import { PageToast } from '../Summary.tsx';
import { Text } from '../Text.tsx';
import { LinkMark } from './StaffParts.tsx';
import { openedEntry } from './openedEntry.ts';

/** Under the AC's ten seconds from a change made anywhere else, while no line to the hub is open. */
const READ_AGAIN_MS = 5_000;

type Seen =
  | { kind: 'loading' }
  | { kind: 'failed' }
  | { kind: 'notOnStaff' }
  | { kind: 'shown'; entry: StaffEntry }
  | { kind: 'removed'; entry: StaffEntry };

type Busy = 'share' | 'copy' | 'mark' | 'replace' | null;

/** One person's own link in the app (sc-77903), as /demo/staff-link draws it: Share link first, Copy link, Mark as sent where it applies, and Replace link…. */
export function StaffLinkScreen({
  eventId,
  staffId,
  onBack,
}: {
  eventId: string;
  staffId: string;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const locale = dateLocale();
  const insets = useSafeAreaInsets();
  const { kind } = useLayout();
  const phone = kind === 'phone';
  const landscape = kind === 'tabletLandscape';
  const [seen, setSeen] = useState<Seen>({ kind: 'loading' });
  const [manages, setManages] = useState<boolean | null>(null);
  const [eventFailed, setEventFailed] = useState(false);
  const [round, setRound] = useState(0);
  const [busy, setBusy] = useState<Busy>(null);
  const [failed, setFailed] = useState(false);
  const [held, setHeld] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [toast, setToast] = useState('');
  const [say, setSay] = useState<{ words: string; n: number } | null>(null);
  const ticket = useRef(0);
  const gone = useRef(false);
  const replaceOpener = useRef<ViewInstance | null>(null);

  const latest = useRef<StaffEntry | null>(null);

  function announce(words: string): void {
    setSay((was) => ({ words, n: (was?.n ?? 0) + 1 }));
  }

  function removed(entry: StaffEntry): void {
    if (gone.current) return;
    gone.current = true;
    setSeen({ kind: 'removed', entry });
    setAsking(false);
    setReplacing(false);
    setFailed(false);
    setHeld(null);
    setToast('');
    announce(t('staffLink.removed', { name: entry.fullName }));
  }

  /** Opened at its address for an id the roster lacks: a removed person and one never on the staff look the same, so no name and no "removed". */
  function notOnStaff(): void {
    if (gone.current) return;
    gone.current = true;
    setSeen({ kind: 'notOnStaff' });
    announce(t('staffLink.notOnStaff'));
  }

  function read(): void {
    if (gone.current) return;
    const mine = ++ticket.current;
    api.staff(eventId).then(
      (staff) => {
        if (mine !== ticket.current || gone.current) return;
        const entry = staff.find((one) => one.id === staffId);
        if (entry == null) {
          const was = latest.current ?? openedEntry(eventId, staffId);
          if (was != null) removed(was);
          else notOnStaff();
          return;
        }
        latest.current = entry;
        setSeen({ kind: 'shown', entry });
      },
      () => {
        if (mine !== ticket.current || latest.current != null) return;
        setSeen({ kind: 'failed' });
      },
    );
  }

  const reader = useRef(read);
  useEffect(() => {
    reader.current = read;
  });

  useEffect(() => {
    let current = true;
    api.event(eventId).then(
      (event) => {
        if (current) setManages(event.permissions.includes('staff.manage'));
      },
      () => {
        if (current) setEventFailed(true);
      },
    );
    reader.current();
    const stop = followReadingAgain(
      realtimeTopic('EventStaff', eventId),
      () => api.staffSubscription(eventId),
      () => reader.current(),
      READ_AGAIN_MS,
    );

    return () => {
      current = false;
      stop();
    };
  }, [eventId, round]);

  useEffect(() => {
    if (say == null || say.words === '') return undefined;

    return readOut(say.words);
  }, [say]);

  function took(entry: StaffEntry): void {
    if (gone.current) return;
    latest.current = entry;
    setSeen({ kind: 'shown', entry });
  }

  /** Refused because they are gone: the screen says so, and nothing is recorded. Otherwise the status stays and the line says to try again. */
  function refused(error: unknown, entry: StaffEntry): void {
    if (error instanceof ApiError && error.status === 404) removed(entry);
    else if (!gone.current) {
      setFailed(true);
      announce(t('staffLink.notIssued'));
    }
  }

  function start(what: Exclude<Busy, null>): boolean {
    if (busy != null || gone.current) return false;
    setBusy(what);
    setFailed(false);
    setHeld(null);
    setAsking(false);

    return true;
  }

  async function share(entry: StaffEntry): Promise<void> {
    if (!start('share')) return;
    let answer;
    try {
      answer = await api.shareStaffLink(eventId, entry.id);
    } catch (error) {
      setBusy(null);
      refused(error, entry);
      return;
    }
    setBusy(null);
    if (gone.current) return;
    took(answer.staff);
    await Share.share({ message: answer.url }).catch(() => undefined);
    if (gone.current || !asksAfterShare(answer.staff)) return;
    setAsking(true);
    announce(t('staffLink.didYouSend', { name: entry.fullName }));
  }

  async function copy(entry: StaffEntry): Promise<void> {
    if (!start('copy')) return;
    let answer;
    try {
      answer = await api.deliverStaffLink(eventId, entry.id);
    } catch (error) {
      setBusy(null);
      refused(error, entry);
      return;
    }
    if (gone.current) {
      setBusy(null);
      return;
    }
    const copied = await setStringAsync(answer.url).then(
      () => true,
      () => false,
    );
    setBusy(null);
    took(answer.staff);
    if (copied) {
      setToast(t('staffLink.copiedSaid'));
      announce(t('staffLink.copiedSaid'));
    } else {
      setHeld(answer.url);
      announce(t('staffLink.refused'));
    }
  }

  async function markSent(entry: StaffEntry): Promise<void> {
    if (!start('mark')) return;
    try {
      took(await api.markStaffLinkSent(eventId, entry.id));
      const words = t('staffLink.marked', { name: entry.fullName });
      setToast(words);
      announce(words);
    } catch (error) {
      refused(error, entry);
    } finally {
      setBusy(null);
    }
  }

  async function replace(entry: StaffEntry): Promise<void> {
    if (busy != null || gone.current) return;
    setBusy('replace');
    try {
      took(await api.replaceStaffLink(eventId, entry.id));
      setReplacing(false);
      setHeld(null);
      setFailed(false);
      setAsking(false);
      const words = t('staffLink.replaced', { name: entry.fullName });
      setToast(words);
      announce(words);
    } catch (error) {
      setReplacing(false);
      refused(error, entry);
    } finally {
      setBusy(null);
    }
  }

  const back = (
    <Pressable
      onPress={onBack}
      accessibilityRole="button"
      style={styles.back}
      testID="staffLink.back"
    >
      <Text size={16} weight="semibold" style={styles.accent}>
        {t('staffRoster.roster')}
      </Text>
    </Pressable>
  );

  if (seen.kind === 'notOnStaff')
    return (
      <Page insets={insets} phone={phone} landscape={false}>
        {back}
        <View testID="staffLink.notOnStaff">
          <Notice tone="attention" mark="!" title={t('staffLink.notOnStaff')} />
        </View>
      </Page>
    );

  const failedLoad = seen.kind === 'failed' || (seen.kind === 'shown' && eventFailed);
  const loading =
    seen.kind === 'loading' || (seen.kind === 'shown' && manages == null && !failedLoad);
  if (loading || failedLoad)
    return (
      <Page insets={insets} phone={phone} landscape={false}>
        {back}
        {loading ? (
          <Skeleton shape="rows" rowHeight={64} rows={3} words={t('staffLink.loading')} />
        ) : (
          <View style={styles.failedBlock} testID="staffLink.loadFailed">
            <Notice tone="broken" mark={tokens.marks.broken.glyph} body={t('staffRoster.failed')} />
            <SecondaryButton
              label={t('staffRoster.tryAgain')}
              onPress={() => {
                setSeen({ kind: 'loading' });
                setEventFailed(false);
                setRound((n) => n + 1);
              }}
              testID="staffLink.retry"
            />
          </View>
        )}
      </Page>
    );

  const entry = seen.entry;
  const isGone = seen.kind === 'removed';
  const shift = shiftLine(t, entry, locale) ?? t('staffRoster.noShift');
  const trail = trailLine(t, entry, locale);
  const may = manages === true;
  const doing = !isGone && acts(entry, may);

  const person = (
    <View style={styles.header}>
      <Text size={30} weight="bold" accessibilityRole="header">
        {entry.fullName}
      </Text>
      <Text size={16} weight="medium" style={styles.secondary}>
        {`${entry.job?.name ?? t('staffRoster.noJob')} · ${shift}`}
      </Text>
    </View>
  );

  const status = isGone ? (
    <View testID="staffLink.removed">
      <Notice
        tone="attention"
        mark="!"
        title={t('staffLink.removed', { name: entry.fullName })}
        body={t('staffLink.removedLine')}
      />
    </View>
  ) : (
    <View style={styles.card} testID="staffLink.status">
      <Text size={13} weight="semibold" style={styles.kicker}>
        {t('staffLink.link').toLocaleUpperCase(locale)}
      </Text>
      <View style={styles.statusRow}>
        <LinkMark link={entry.link} />
        <Text size={17} weight="semibold" style={styles.shrink}>
          {linkWord(t, entry.link)}
        </Text>
      </View>
      {trail != null && (
        <Text size={15} style={styles.secondary}>
          {trail}
        </Text>
      )}
      <Text size={15} style={styles.secondary}>
        {helpLine(t, entry.link)}
      </Text>
      {!may && (
        <View style={styles.lock} testID="staffLink.readOnly">
          <Glyph name="lock" size={16} ink={tokens.colorInkSecondary} />
          <Text size={15} weight="medium" style={[styles.secondary, styles.shrink]}>
            {t('staffLink.readOnly')}
          </Text>
        </View>
      )}
    </View>
  );

  const actions = !doing ? null : (
    <View style={styles.actions}>
      {failed && (
        <View style={styles.failed} testID="staffLink.failed">
          <Glyph name="alert" size={18} ink={tokens.colorBrokenText} />
          <Text size={16} weight="semibold" style={styles.broken}>
            {t('staffLink.notIssued')}
          </Text>
        </View>
      )}
      {held != null && (
        <View style={styles.held} testID="staffLink.held">
          <View style={styles.failed}>
            <Glyph name="alert" size={18} ink={tokens.colorBrokenText} />
            <Text size={16} weight="semibold" style={styles.broken}>
              {t('staffLink.refused')}
            </Text>
          </View>
          <Field label={t('staffLink.linkFor', { name: entry.fullName })}>
            <TextField
              value={held}
              accessibilityLabel={t('staffLink.linkFor', { name: entry.fullName })}
              submitting
              selectTextOnFocus
              testID="staffLink.held.field"
            />
          </Field>
        </View>
      )}
      {asking && (
        <View style={styles.ask} testID="staffLink.ask">
          <Text size={17} weight="bold" accessibilityRole="header">
            {t('staffLink.didYouSend', { name: entry.fullName })}
          </Text>
          <Text size={15} style={styles.secondary}>
            {t('staffLink.didYouSendLine')}
          </Text>
          <View style={phone ? styles.stack : styles.row}>
            <PrimaryButton
              label={t('staffLink.markSent')}
              busy={busy === 'mark'}
              onPress={() => void markSent(entry)}
              paired={!phone}
              testID="staffLink.ask.sent"
            />
            <QuietButton
              label={t('staffLink.notYet')}
              onPress={() => {
                setAsking(false);
                setSay(null);
              }}
              inset={!phone}
              testID="staffLink.ask.notYet"
            />
          </View>
        </View>
      )}
      <PrimaryButton
        label={t('staffLink.share')}
        busy={busy === 'share'}
        onPress={() => void share(entry)}
        testID="staffLink.share"
      />
      <View>
        <SecondaryButton
          label={t('staffLink.copy')}
          off={busy === 'copy'}
          onPress={() => void copy(entry)}
          testID="staffLink.copy"
        />
        {busy === 'copy' && (
          <View style={styles.issuing} pointerEvents="none" testID="staffLink.copy.spinner">
            <Spinner />
          </View>
        )}
      </View>
      {offersMarkSent(entry, may, asking) && (
        <SecondaryButton
          label={t('staffLink.markSent')}
          off={busy === 'mark'}
          onPress={() => void markSent(entry)}
          testID="staffLink.markSent"
        />
      )}
      {offersReplace(entry, may) && (
        <QuietButton
          ref={replaceOpener}
          label={t('staffLink.replaceOpen')}
          onPress={() => setReplacing(true)}
          testID="staffLink.replace"
        />
      )}
    </View>
  );

  const replaceGo = (
    <DestructiveButton
      label={t('staffLink.replace')}
      busy={busy === 'replace'}
      onPress={() => void replace(entry)}
      stacked={phone}
      testID="staffLink.replace.go"
    />
  );
  const replaceKeep = (
    <QuietButton
      label={t('staffLink.keep')}
      onPress={() => setReplacing(false)}
      testID="staffLink.replace.keep"
    />
  );

  return (
    <View style={styles.page}>
      <Page insets={insets} phone={phone} landscape={landscape}>
        {back}
        {landscape && actions != null ? (
          <View style={styles.sides}>
            <View style={styles.sideMain}>
              {person}
              {status}
            </View>
            <View style={styles.sidePanel}>{actions}</View>
          </View>
        ) : (
          <View style={styles.list}>
            {person}
            {status}
            {actions}
          </View>
        )}
      </Page>
      <Sheet
        open={replacing && !isGone}
        onClose={() => setReplacing(false)}
        scrimLabel={t('staffLink.keep')}
        held={busy === 'replace'}
        opener={replaceOpener}
        docked
        testID="staffLink.replaceSheet"
      >
        <View style={styles.confirm}>
          <Text size={tokens.typeTitleSection.size} weight="bold" accessibilityRole="header">
            {t('staffLink.replaceTitle', { name: entry.fullName })}
          </Text>
          <Text size={tokens.typeBodyPhone.size}>{t('staffLink.replaceLine')}</Text>
          <SheetActions>
            {phone ? (
              <>
                {replaceGo}
                {replaceKeep}
              </>
            ) : (
              <>
                {replaceKeep}
                {replaceGo}
              </>
            )}
          </SheetActions>
        </View>
      </Sheet>
      {toast !== '' && (
        <PageToast
          words={toast}
          onClose={() => setToast('')}
          bottom={insets.bottom + tokens.spaceXl}
        />
      )}
    </View>
  );
}

function Page({
  insets,
  phone,
  landscape,
  children,
}: {
  insets: { top: number; bottom: number };
  phone: boolean;
  landscape: boolean;
  children: ReactNode;
}) {
  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={[
          styles.body,
          phone ? styles.bodyPhone : styles.bodyTablet,
          { paddingBottom: insets.bottom + 96 },
        ]}
        testID="staffLink.page"
      >
        <View style={phone ? undefined : landscape ? styles.wide : styles.column}>{children}</View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: tokens.colorPage },
  body: { gap: tokens.spaceLg },
  bodyPhone: { padding: tokens.spaceLg },
  bodyTablet: { padding: tokens.spaceXl, alignItems: 'center' },
  column: { width: '100%', maxWidth: 560, gap: tokens.spaceLg },
  wide: { width: '100%', maxWidth: 960, gap: tokens.spaceLg },
  back: { minHeight: tokens.sizeHit, justifyContent: 'center', alignSelf: 'flex-start' },
  accent: { color: tokens.colorAccentText },
  secondary: { color: tokens.colorInkSecondary },
  broken: { color: tokens.colorBrokenText, flexShrink: 1 },
  kicker: { color: tokens.colorInkSecondary, letterSpacing: 0.6 },
  header: { gap: tokens.spaceXs },
  list: { gap: tokens.spaceLg },
  sides: { flexDirection: 'row', gap: tokens.spaceXl, alignItems: 'flex-start' },
  sideMain: { flex: 1, minWidth: 0, gap: tokens.spaceLg },
  sidePanel: { width: 360 },
  card: {
    gap: tokens.spaceSm,
    padding: tokens.spaceLg,
    borderRadius: tokens.radiusCardPhone,
    backgroundColor: tokens.colorCard,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm },
  shrink: { flexShrink: 1 },
  lock: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceSm },
  actions: { gap: tokens.spaceMd },
  issuing: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: tokens.spaceLg,
    justifyContent: 'center',
  },
  held: { gap: tokens.spaceSm },
  failed: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceSm },
  failedBlock: { gap: tokens.spaceMd, alignItems: 'flex-start' },
  ask: {
    gap: tokens.spaceSm,
    padding: tokens.spaceLg,
    borderRadius: tokens.radiusCardPhone,
    backgroundColor: tokens.colorAccentTint,
    borderWidth: 1,
    borderColor: tokens.colorAccentTintBorder,
  },
  stack: { gap: tokens.spaceSm },
  row: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceMd, flexWrap: 'wrap' },
  confirm: { flexShrink: 1, gap: tokens.spaceLg, padding: tokens.space3xl },
});
