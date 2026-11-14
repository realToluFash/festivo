import type { GuestDetails as Details } from '@soirely/api-client';
import {
  REPLY_KEY,
  companionShown,
  formatPhone,
  ownLanguageName,
  replyDate,
} from '@soirely/domain';
import type { ReactNode, Ref } from 'react';
import { StyleSheet, View, type ViewInstance } from 'react-native';
import { useTranslation } from 'react-i18next';

import { dateLocale } from '../i18n/index.ts';
import { markOf } from '../kit/guestRows.ts';
import { tokens } from '../theme/tokens.ts';
import { LineIcon } from './AccountCard.tsx';
import { ChoseNote } from './GuestLanguage.tsx';
import { type InvitationOffer, InvitationBlock } from './GuestInvitation.tsx';
import { AlertLine } from './AlertLine.tsx';
import { MarkSlot } from './ReplyMark.tsx';
import { Row, RowList, TextAction } from './SummaryRows.tsx';
import { FailedBlock } from './Summary.tsx';
import { useReadOut } from './ReadOut.tsx';
import { Text, type TextHandle } from './Text.tsx';
import { Title } from './Title.tsx';

export type GuestPane =
  | { kind: 'loading' }
  | { kind: 'failed' }
  | { kind: 'notFound' }
  | { kind: 'guest'; guest: Details };

/** What the last Mark as not invited left above the guest (sc-46879). */
export type GuestNotice =
  | { kind: 'unmarked' }
  | { kind: 'refused'; line: string }
  | { kind: 'offline' }
  | { kind: 'failed' }
  | null;

/** A guest's details (sc-3773's content and order): their name, Reply, then Details with Edit; contact and Language only for those who can edit guests. */
export function GuestDetails({
  pane,
  manages,
  timeZone,
  saved,
  notice,
  invitation,
  nameRef,
  editRef,
  markRef,
  unmarkRef,
  onEdit,
  onMark,
  onUnmark,
  onBack,
  onRetry,
}: {
  pane: GuestPane;
  manages: boolean;
  timeZone: string;
  saved: boolean;
  notice: GuestNotice;
  /** Null on a Draft, where nobody can be invited yet. */
  invitation: InvitationOffer | null;
  nameRef: Ref<TextHandle>;
  editRef: Ref<ViewInstance>;
  markRef: Ref<ViewInstance>;
  unmarkRef: Ref<ViewInstance>;
  onEdit: () => void;
  onMark: () => void;
  onUnmark: () => void;
  onBack: () => void;
  onRetry: () => void;
}) {
  const { t } = useTranslation();

  if (pane.kind === 'loading') return <GuestLoading />;
  if (pane.kind === 'failed')
    return (
      <View accessibilityRole="alert">
        <FailedBlock
          title={t('guestList.loadFailed')}
          line={t('guestList.loadFailedLine')}
          onRetry={onRetry}
          testID="guest.failed.retry"
        />
      </View>
    );
  if (pane.kind === 'notFound') return <NotFound onBack={onBack} />;

  const { guest } = pane;
  const locale = dateLocale();
  const word = t(REPLY_KEY[guest.reply]);
  const names = guest.companions.map((one) => one.fullName);
  const language = ownLanguageName(guest.language);
  const fallback = ownLanguageName(guest.organisationLanguage) ?? guest.organisationLanguage ?? '';
  const added = replyDate(guest.added.at, timeZone, locale);
  const rows: { key: string; inset: number; row: ReactNode }[] = [
    ...(manages
      ? [
          {
            key: 'email',
            inset: 40,
            row: <ValueRow value={guest.email} label={t('guestList.emailAddress')} icon="mail" />,
          },
          {
            key: 'mobile',
            inset: 40,
            row: (
              <ValueRow
                value={guest.mobile == null ? null : formatPhone(guest.mobile)}
                label={t('guestList.mobileNumber')}
                icon="phone"
              />
            ),
          },
          {
            key: 'language',
            inset: 40,
            row: (
              <View>
                <Row
                  title={language ?? t('guestList.languageNotSetLine', { language: fallback })}
                  line={t('language.label')}
                  lead={<LineIcon name="globe" />}
                  weight={language == null ? 'medium' : 'semibold'}
                  off={language == null}
                  accessibilityLabel={`${t('language.label')}, ${
                    language ?? t('guestList.languageNotSetLine', { language: fallback })
                  }`}
                  testID="guest.language"
                />
                {guest.chosenLanguage != null && (
                  <View style={styles.chose}>
                    <ChoseNote chose={guest.chosenLanguage} />
                  </View>
                )}
              </View>
            ),
          },
        ]
      : []),
    ...guest.companions.map((one, at) => ({
      key: one.id,
      inset: 40,
      row: (
        <Row
          title={companionShown(t, guest.fullName, names, at)}
          line={
            one.state === 'held'
              ? t('guestList.heldCompanion')
              : t('guestList.companionLine', { reply: t(REPLY_KEY[one.state]) })
          }
          lead={<MarkSlot kind={markOf(one.state)} />}
          testID={`guest.companion.${at}`}
        />
      ),
    })),
    ...(manages
      ? [
          {
            key: 'added',
            inset: 40,
            row: (
              <Row
                title={
                  guest.added.by == null
                    ? added
                    : t('guestList.addedBy', { date: added, name: guest.added.by })
                }
                line={t('guestList.added')}
                lead={<LineIcon name="user" />}
              />
            ),
          },
        ]
      : []),
  ];

  return (
    <View style={styles.blocks} testID={`guest.${guest.id}`}>
      {saved && <SavedLine />}
      {notice?.kind === 'unmarked' && <SavedLine words={t('guestList.unmarked')} />}
      <Title size={26} accessibilityRole="header" ref={nameRef}>
        {guest.fullName}
      </Title>
      {notice?.kind === 'refused' && <AlertLine text={notice.line} />}
      {notice?.kind === 'offline' && <AlertLine text={t('guestList.offlineRefused')} />}
      {notice?.kind === 'failed' && <AlertLine text={t('guestList.loadFailedLine')} />}
      {invitation != null ? (
        <InvitationBlock
          guest={guest}
          timeZone={timeZone}
          offer={invitation}
          markRef={markRef}
          unmarkRef={unmarkRef}
          onMark={onMark}
          onUnmark={onUnmark}
        />
      ) : (
        !manages && (
          <Text size={15} weight="medium" style={styles.secondary} testID="guest.readOnly">
            {t('guestList.readOnlyInvited')}
          </Text>
        )
      )}
      <View>
        <BlockHead title={t('guestList.replyHeading')} />
        <Row
          title={word}
          line={
            guest.repliedAt == null
              ? undefined
              : t('guestList.repliedOn', { date: replyDate(guest.repliedAt, timeZone, locale) })
          }
          lead={<MarkSlot kind={markOf(guest.reply)} />}
          testID="guest.reply"
        />
      </View>
      <View>
        <BlockHead
          title={t('guestList.details')}
          right={
            manages ? (
              <TextAction
                ref={editRef}
                label={t('guestList.edit')}
                onPress={onEdit}
                testID="guest.edit"
              />
            ) : null
          }
        />
        {rows.length > 0 && <RowList items={rows} />}
      </View>
    </View>
  );
}

function SavedLine({ words }: { words?: string }) {
  const { t } = useTranslation();
  const said = words ?? t('guestList.saved');
  useReadOut(said);

  return (
    <View style={styles.saved} testID="guest.saved">
      <LineIcon name="tick" />
      <Text size={15} weight="semibold">
        {said}
      </Text>
    </View>
  );
}

function BlockHead({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <View style={styles.head}>
      <Text
        size={18}
        weight="bold"
        accessibilityRole="header"
        style={[styles.grow, styles.headTitle]}
      >
        {title}
      </Text>
      {right}
    </View>
  );
}

function ValueRow({
  value,
  label,
  icon,
}: {
  value: string | null;
  label: string;
  icon: 'mail' | 'phone';
}) {
  const { t } = useTranslation();
  const shown = value ?? t('guestList.none');

  return (
    <Row
      title={shown}
      line={label}
      lead={<LineIcon name={icon} />}
      weight={value == null ? 'medium' : 'semibold'}
      off={value == null}
      accessibilityLabel={`${label}, ${shown}`}
    />
  );
}

function NotFound({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  useReadOut(t('guestList.notFound'));

  return (
    <View style={styles.notFound} testID="guest.notFound">
      <Text size={18} weight="bold" accessibilityRole="header">
        {t('guestList.notFound')}
      </Text>
      <Text size={15} weight="medium" style={styles.secondary}>
        {t('guestList.notFoundLine')}
      </Text>
      <TextAction
        label={t('guestList.backToGuests')}
        onPress={onBack}
        testID="guest.notFound.back"
      />
    </View>
  );
}

function GuestLoading() {
  const { t } = useTranslation();
  useReadOut(t('pending.loading'));

  return (
    <View
      style={styles.blocks}
      accessible
      accessibilityLabel={t('pending.loading')}
      testID="guest.loading"
    >
      <View style={styles.sunkHead} />
      {[0, 1, 2].map((index) => (
        <View key={index} style={styles.sunkRow} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  secondary: { color: tokens.colorInkSecondary },
  blocks: { gap: 18 },
  head: { minHeight: tokens.sizeHit, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headTitle: { letterSpacing: -0.18, lineHeight: 18 * 1.25 },
  chose: { paddingLeft: 40, paddingBottom: tokens.spaceSm },
  saved: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceXs },
  notFound: { gap: 6, paddingTop: tokens.spaceXs },
  sunkHead: { height: 28, width: '60%', borderRadius: 8, backgroundColor: tokens.colorNeutralFill },
  sunkRow: { height: 56, borderRadius: 12, backgroundColor: tokens.colorNeutralFill },
});
