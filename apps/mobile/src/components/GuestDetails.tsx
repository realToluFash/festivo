import type { GuestDetails as Details } from '@soirely/api-client';
import {
  REPLY_KEY,
  companionShown,
  formatPhone,
  invitationLine,
  ownLanguageName,
  replyDate,
  shownReply,
} from '@soirely/domain';
import { type ReactNode, type Ref, useContext, useEffect } from 'react';
import { StyleSheet, View, type ViewInstance } from 'react-native';
import { useTranslation } from 'react-i18next';

import { dateLocale } from '../i18n/index.ts';
import { type GuestReplies, guestRepliedLine, guestReplyBy } from '../kit/replyBy.ts';
import type { Shown } from '../kit/eventsList.ts';
import { markOf } from '../kit/guestRows.ts';
import type { LayoutKind } from '../layout/useLayout.ts';
import { tokens } from '../theme/tokens.ts';
import { LineIcon } from './AccountCard.tsx';
import { Glyph } from './Glyph.tsx';
import { ChoseNote } from './GuestLanguage.tsx';
import { GuestCover } from './GuestsCard.tsx';
import { NeedsRows } from './GuestNeeds.tsx';
import { type InvitationOffer, InvitationBlock, type LinkRows } from './GuestInvitation.tsx';
import { AlertLine } from './AlertLine.tsx';
import { MarkSlot } from './ReplyMark.tsx';
import { Row, RowList, TextAction } from './SummaryRows.tsx';
import { FailedBlock } from './Summary.tsx';
import { useReadOut } from './ReadOut.tsx';
import { ScreenScroll } from './Screen.tsx';
import { Text, type TextHandle } from './Text.tsx';

/** sc-55558: the wrong-person notice, the replace that failed, and the guest's own link rows. */
export interface GuestLink {
  /** Someone who opened this guest's link pressed Tell them (GET …/guests/flagged). */
  flagged: boolean;
  notReplaced: boolean;
  onReplaceFromNotice: () => void;
  rows: LinkRows;
}

export type GuestPane =
  | { kind: 'loading' }
  | { kind: 'failed' }
  | { kind: 'notFound' }
  | { kind: 'guest'; guest: Details };

/** What the last Mark as not invited left above the guest (sc-46879). */
export type GuestNotice =
  | { kind: 'unmarked' }
  | { kind: 'recorded' }
  | { kind: 'refused'; line: string }
  | { kind: 'offline' }
  | { kind: 'failed' }
  | null;

/** A guest's details (sc-3773's content and order): their reply card with their name, Reply, Details with Edit, then Invitation; the group for every reader, and contact, Language and Needs only for those who can edit guests (sc-5519). */
export function GuestDetails({
  kind,
  event,
  pane,
  manages,
  timeZone,
  replies,
  reopen,
  saved,
  notice,
  invitation,
  link,
  noticeRef,
  copyRef,
  replaceRef,
  nameRef,
  editRef,
  markRef,
  coverMarkRef,
  unmarkRef,
  recordRef,
  recordNotYetRef,
  onEdit,
  onMark,
  onCoverMark,
  onUnmark,
  onRecord,
  onBack,
  onRetry,
}: {
  kind: LayoutKind;
  /** The event's colours under the card, once its phase is read. */
  event: Shown | null;
  pane: GuestPane;
  manages: boolean;
  timeZone: string;
  /** The event's Reply by, and the day replies closed once they have (sc-3780). */
  replies: GuestReplies;
  /** Let them change their reply: under way, or not saved. */
  reopen: { busy: boolean; failed: boolean; ref: Ref<ViewInstance>; onPress: () => void };
  saved: boolean;
  notice: GuestNotice;
  /** Null on a Draft for those who can't manage guests, where nobody can be invited yet. */
  invitation: InvitationOffer | null;
  link: GuestLink;
  noticeRef: Ref<ViewInstance>;
  copyRef: Ref<ViewInstance>;
  replaceRef: Ref<ViewInstance>;
  nameRef: Ref<TextHandle>;
  editRef: Ref<ViewInstance>;
  markRef: Ref<ViewInstance>;
  coverMarkRef: Ref<ViewInstance>;
  unmarkRef: Ref<ViewInstance>;
  recordRef: Ref<ViewInstance>;
  recordNotYetRef: Ref<ViewInstance>;
  onEdit: () => void;
  onMark: () => void;
  onCoverMark: () => void;
  onUnmark: () => void;
  onRecord: () => void;
  onBack: () => void;
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  const scroll = useContext(ScreenScroll);

  // Mark as not invited sits at the page's foot and its outcome under the cover, so the page goes up to show it (sc-46879).
  useEffect(() => {
    if (notice != null) scroll?.ref.current?.scrollTo({ y: 0, animated: true });
  }, [notice, scroll]);

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
  const shown = shownReply(guest);
  const word = t(REPLY_KEY[shown]);
  const names = guest.companions.map((one) => one.fullName);
  const language = ownLanguageName(guest.language);
  const organisationLanguage = guest.organisationLanguage ?? 'en';
  const fallback = t(`languageNamesInSentence.${organisationLanguage}`, {
    defaultValue: organisationLanguage,
  });
  const added = replyDate(guest.added.at, timeZone, locale);
  const group = guest.group?.name ?? null;
  const groupWords = group ?? t('guestGroups.noGroup');
  const after = guestReplyBy(guest, shown, replies, manages, timeZone, locale, t);
  const records = after.records && invitation != null;
  const recordedBy = guest.replyRecorded ?? null;
  const rows: { key: string; inset: number; row: ReactNode }[] = [
    {
      key: 'group',
      inset: 40,
      row: (
        <Row
          title={groupWords}
          line={t('guestGroups.group')}
          lead={<LineIcon name="users" />}
          weight={group == null ? 'medium' : 'semibold'}
          off={group == null}
          accessibilityLabel={`${t('guestGroups.group')}, ${groupWords}`}
          testID="guest.group"
        />
      ),
    },
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
      {notice?.kind === 'recorded' && <SavedLine words={t('guestList.replyRecorded')} />}
      <GuestCover
        kind={kind}
        event={event}
        mark={markOf(shown)}
        word={word}
        name={guest.fullName}
        line={
          after.card ??
          guestRepliedLine(guest, word, after.reply, timeZone, locale, t) ??
          (shown === 'notYetInvited'
            ? invitation == null || invitation.draft
              ? null
              : t('guestList.copyFirst')
            : invitationLine(t, guest, timeZone, locale))
        }
        step={
          after.reopens
            ? {
                label: t('guestList.letThemChange'),
                onPress: reopen.onPress,
                busy: reopen.busy,
                ref: reopen.ref,
                testID: 'guest.card.step',
              }
            : shown === 'notYetInvited' && invitation?.manages === true && invitation.invites
              ? {
                  label: t('guestList.markAsInvited'),
                  ref: coverMarkRef,
                  onPress: onCoverMark,
                  testID: 'guest.card.step',
                }
              : records && (shown === 'noReply' || guest.repliesReopened != null)
                ? {
                    label: t('guestList.recordReply'),
                    ref: recordRef,
                    onPress: onRecord,
                    testID: 'guest.card.step',
                  }
                : null
        }
        nameRef={nameRef}
      />
      {manages && link.flagged && (
        <WrongPerson
          name={guest.fullName}
          replaceRef={noticeRef}
          onReplace={link.onReplaceFromNotice}
        />
      )}
      {link.notReplaced && <NotReplaced />}
      {reopen.failed && <AlertLine text={t('guestList.reopenNotSaved')} />}
      {notice?.kind === 'refused' && <AlertLine text={notice.line} />}
      {notice?.kind === 'offline' && <AlertLine text={t('guestList.offlineRefused')} />}
      {notice?.kind === 'failed' && <AlertLine text={t('guestList.unmarkNotSaved')} />}
      {guest.repliedAt != null && (
        <View>
          <BlockHead title={t('guestList.replyHeading')} />
          <Row
            title={word}
            line={
              recordedBy != null
                ? t('guestList.recordedOn', {
                    name: recordedBy.by,
                    how: t(`guestList.toldInLine.${recordedBy.how}`),
                    date: replyDate(guest.repliedAt, timeZone, locale),
                  })
                : (after.asked ??
                  t('guestList.repliedOn', { date: replyDate(guest.repliedAt, timeZone, locale) }))
            }
            lead={<MarkSlot kind={markOf(shown)} />}
            testID="guest.reply"
          />
          {records && (
            <TextAction
              ref={recordRef}
              label={t('guestList.recordReply')}
              onPress={onRecord}
              testID="guest.record"
            />
          )}
        </View>
      )}
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
        <RowList items={rows} />
      </View>
      {manages && (
        <View testID="guest.needs">
          <BlockHead title={t('guestNeeds.needs')} />
          <NeedsRows
            people={[
              { name: guest.fullName, needs: guest.needs, guest: true },
              ...guest.companions.map((one, at) => ({
                name: companionShown(t, guest.fullName, names, at),
                needs: one.needs,
                guest: false,
              })),
            ]}
          />
        </View>
      )}
      {invitation != null ? (
        <InvitationBlock
          guest={guest}
          timeZone={timeZone}
          offer={invitation}
          markRef={markRef}
          unmarkRef={unmarkRef}
          onMark={onMark}
          onUnmark={onUnmark}
          recordRef={recordNotYetRef}
          onRecord={onRecord}
          link={link.rows}
          copyRef={copyRef}
          replaceRef={replaceRef}
        />
      ) : (
        !manages && (
          <Text size={15} weight="medium" style={styles.secondary} testID="guest.readOnly">
            {t('guestList.readOnlyInvited')}
          </Text>
        )
      )}
    </View>
  );
}

/** sc-55558: Tell them was pressed on the guest's own page. Already there when the details open, so not read out; the triangle and the words mark it, not the amber alone. */
function WrongPerson({
  name,
  replaceRef,
  onReplace,
}: {
  name: string;
  replaceRef: Ref<ViewInstance>;
  onReplace: () => void;
}) {
  const { t } = useTranslation();

  return (
    <View style={styles.wrongPerson} testID="guest.flagged">
      <View style={styles.flagHead}>
        <View style={styles.flagMark}>
          <Glyph name="warn" ink={tokens.colorAttentionText} weight={2.2} />
        </View>
        <Text size={16} weight="bold" accessibilityRole="header" style={styles.flagTitle}>
          {t('guestList.flaggedTitle')}
        </Text>
      </View>
      <Text size={15} weight="medium" style={[styles.secondary, styles.lines]}>
        {t('guestList.flaggedLine', { name })}
      </Text>
      <View style={styles.flagAction}>
        <TextAction
          ref={replaceRef}
          label={t('guestList.replaceLink')}
          onPress={onReplace}
          testID="guest.flagged.replace"
        />
      </View>
    </View>
  );
}

/** A replace that failed: the old link still works, read out as it appears (sc-55558). */
function NotReplaced() {
  const { t } = useTranslation();
  const said = t('guestList.notReplaced');
  useReadOut(said, { interrupts: true });

  return (
    <View testID="guest.notReplaced">
      <AlertLine text={said} />
    </View>
  );
}

function SavedLine({ words }: { words?: string }) {
  const { t } = useTranslation();
  const said = words ?? t('guestList.saved');
  useReadOut(said);

  return (
    <View style={styles.saved} testID="guest.saved">
      <View style={styles.savedMark}>
        <Glyph name="tick" size={17} ink={tokens.marks.done.fill} weight={2.6} />
      </View>
      <Text size={15} weight="semibold" style={styles.savedWords}>
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
  lines: { lineHeight: 15 * 1.45 },
  wrongPerson: {
    gap: tokens.spaceSm,
    paddingTop: 14,
    paddingHorizontal: tokens.spaceXl,
    paddingBottom: tokens.spaceXs,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: tokens.colorAttentionBorder,
    backgroundColor: tokens.colorAttentionTint,
  },
  flagHead: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceSm },
  flagMark: { paddingTop: 2 },
  flagTitle: { flex: 1, minWidth: 0, lineHeight: 16 * 1.35 },
  flagAction: { alignItems: 'flex-start' },
  blocks: { gap: 18 },
  head: { minHeight: tokens.sizeHit, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headTitle: { letterSpacing: -0.18, lineHeight: 18 * 1.25 },
  chose: { paddingLeft: 40, paddingBottom: tokens.spaceSm },
  saved: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceSm },
  savedMark: { paddingTop: 1 },
  savedWords: { flex: 1, minWidth: 0, lineHeight: 21 },
  notFound: { gap: 6, paddingTop: tokens.spaceXs },
  sunkHead: { height: 28, width: '60%', borderRadius: 8, backgroundColor: tokens.colorNeutralFill },
  sunkRow: { height: 56, borderRadius: 12, backgroundColor: tokens.colorNeutralFill },
});
