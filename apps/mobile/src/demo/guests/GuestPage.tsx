import { eventAllows } from '@soirely/domain';
import type { Ref } from 'react';
import { StyleSheet, View, type ViewInstance } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useReadOut } from '../../components/ReadOut.tsx';
import type { TextHandle } from '../../components/Text.tsx';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { AlertLine } from '../events/EventEdits.tsx';
import type { Shown } from '../events/EventsModel.ts';
import { LineIcon } from '../../components/AccountCard.tsx';
import { Pill } from '../../components/SettingsParts.tsx';
import { Row, RowList, TextAction } from '../../components/Summary.tsx';
import {
  type Role,
  dayWords,
  handMarked,
  invitationWords,
  invitedWords,
  replyLine,
  replyParts,
} from './GuestsModel.ts';
import { GreetAsRow } from './GuestGreetAs.tsx';
import { GW, NW } from './GuestNeeds.ts';
import { NeedsRows } from './GuestNeedsParts.tsx';
import { ChoseNote } from './GuestLanguage.tsx';
import { BlockHead, DoneLine, GuestCover, type Layout } from './GuestsParts.tsx';
import {
  COLLEAGUE,
  ORGANISATION_LANGUAGE,
  READER,
  type SampleGuest,
  TODAY,
  languageName,
} from './GuestsSample.ts';
import { REPLY_WORD, W, say } from './GuestsWords.ts';
import { MessageGlyph } from '../messages/MessageMarks.tsx';
import { type OptOutRow, optOutRowsOf } from './OptOuts.ts';
import { MarkSlot } from '../../components/ReplyMark.tsx';
import { type WhatsAppRow, whatsAppRowOf } from './WhatsAppConsent.ts';

const REOPENED_ON = '2026-11-05';
const TRIANGLE = [
  'M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  'M12 9v4',
  'M12 17h.01',
] as const;
const ADDED_ON = '2026-09-14';

export interface GuestActions {
  onRecord: () => void;
  onEdit: () => void;
  onCopy: () => void;
  onReplace: () => void;
  onReplaceFromNotice: () => void;
  onMark: () => void;
  onUnmark: () => void;
  onAgree: () => void;
  onLetChange: () => void;
  onConversation: () => void;
  onBack: () => void;
}

/** The card's line and step, per spec §4's table for a guest. */
function cardOf(
  g: SampleGuest,
  role: Role,
  replies: 'closed' | 'reopened' | null,
  locale: string,
  actions: GuestActions,
  invites: boolean,
  replyBy: string | null,
  draft: boolean,
): { line: string | null; step: { label: string; onPress: () => void } | null } {
  const owner = role === 'owner';
  if (replies === 'closed' && replyBy != null)
    return {
      line: owner
        ? say.closed(dayWords(replyBy, locale, true))
        : say.closedOn(dayWords(replyBy, locale, true)),
      step: owner ? { label: W.letThemChange, onPress: actions.onLetChange } : null,
    };
  if (replies === 'reopened')
    return {
      line: say.reopened(READER, dayWords(REOPENED_ON, locale)),
      step: owner ? { label: W.recordReply, onPress: actions.onRecord } : null,
    };
  if (g.kind === 'noreply')
    return {
      line: invitedWords(g, locale),
      step: owner ? { label: W.recordReply, onPress: actions.onRecord } : null,
    };
  if (g.kind === 'notyet')
    return {
      line: draft ? null : W.copyFirst,
      step: owner && invites ? { label: W.markAsInvited, onPress: actions.onMark } : null,
    };
  return { line: replyLine(g, locale, replyBy), step: null };
}

/** A guest's page: the cover card the guest sees, then Reply, Details, Invitation and their conversation. */
export function GuestPage({
  event,
  guest: g,
  phase,
  role,
  layout,
  locale,
  replies,
  replaced,
  notReplaced,
  flagged,
  copyFailed,
  unmarked,
  status,
  replyBy,
  nameRef,
  refFor,
  actions,
}: {
  event: Shown;
  guest: SampleGuest | null;
  phase: 'ok' | 'loading' | 'notFound';
  role: Role;
  layout: Layout;
  locale: string;
  replies: 'closed' | 'reopened' | null;
  replaced: boolean;
  /** sc-55558: the button the failed replace started from; its line goes under that button. */
  notReplaced: 'replace' | 'notice' | null;
  /** sc-55558: someone told us this guest's link reached the wrong person. */
  flagged: boolean;
  /** sc-55558: the last Copy invitation link put nothing on the clipboard. */
  copyFailed: string | null;
  /** sc-3788: Mark as not invited landed, the guest replied first (409), or it failed (sc-46879). */
  unmarked: 'done' | 'refused' | 'notSaved' | null;
  status: string | null;
  /** The event's Reply by date, or none (sc-3780). */
  replyBy: string | null;
  nameRef: Ref<TextHandle>;
  refFor: (key: string) => Ref<ViewInstance>;
  actions: GuestActions;
}) {
  if (phase === 'loading' || g == null)
    return phase === 'notFound' ? <NotFound onBack={actions.onBack} /> : <GuestLoading />;

  const owner = role === 'owner';
  const invites = eventAllows(event.phase, 'invite');
  const draft = event.phase === 'draft';
  const card = cardOf(g, role, replies, locale, actions, invites, replyBy, draft);
  const notInviting =
    event.phase === 'paused' ? W.pausedLine : event.phase === 'finished' ? W.finishedLine : null;
  const invitation = invitationWords(g, locale);
  const readOnly = (
    <View style={styles.readOnly} testID="guest.readOnly">
      <Text size={15} weight="medium" style={[styles.secondary, styles.lines]}>
        {W.readOnlyInvited}
      </Text>
    </View>
  );
  const kind = g.kind === 'walkin' ? 'walkin' : g.kind;
  const replied = g.kind === 'coming' || g.kind === 'maybe' || g.kind === 'notcoming';
  const { word, detail } = replyParts(g, locale, replyBy);
  const whatsApp = whatsAppRowOf(g.whatsApp, { mobile: g.phone != null, edits: owner }, (day) =>
    dayWords(day, locale),
  );
  const optOuts = optOutRowsOf(g, { edits: owner }, (day) => dayWords(day, locale));

  return (
    <View style={styles.blocks} testID={`guest.${g.key}`}>
      {status != null && <DoneLine text={status} />}
      {unmarked === 'done' && <DoneLine text={W.unmarked} />}
      <GuestCover
        event={event}
        kind={kind}
        word={REPLY_WORD[kind]}
        name={g.name}
        line={card.line}
        step={card.step}
        layout={layout}
        nameRef={nameRef}
      />
      {owner && flagged && (
        <WrongPerson
          name={g.name}
          replaceRef={refFor('flagReplace')}
          onReplace={actions.onReplaceFromNotice}
        />
      )}
      {notReplaced === 'notice' && owner && flagged && (
        <UnderRow text={W.notReplaced} testID="guest.flagged.notReplaced" />
      )}
      {unmarked === 'notSaved' && <AlertLine text={W.unmarkNotSaved} />}
      {unmarked === 'refused' && g.when != null && (
        <AlertLine text={say.unmarkRefused(g.name, REPLY_WORD[kind], dayWords(g.when, locale))} />
      )}
      {replied && (
        <View>
          <BlockHead title={W.reply} />
          <Row
            title={word}
            line={detail ?? undefined}
            lead={<MarkSlot kind={kind} />}
            testID="guest.reply"
          />
          {owner && (
            <TextAction
              ref={refFor('record')}
              label={W.recordReply}
              onPress={actions.onRecord}
              testID="guest.record"
            />
          )}
        </View>
      )}
      <View>
        <BlockHead
          title={W.details}
          right={
            owner ? (
              <TextAction
                ref={refFor('edit')}
                label={W.edit}
                onPress={actions.onEdit}
                testID="guest.edit"
              />
            ) : null
          }
        />
        <RowList
          items={[
            { key: 'greetAs', inset: 40, row: <GreetAsRow g={g} /> },
            { key: 'group', inset: 40, row: <GroupRow g={g} /> },
            ...(owner
              ? [
                  {
                    key: 'email',
                    inset: 40,
                    row: <ValueRow value={g.email} label={W.emailAddress} icon="mail" />,
                  },
                  ...(optOuts.email != null
                    ? [
                        {
                          key: 'optOutEmail',
                          inset: 40,
                          row: <OptOutLine row={optOuts.email} testID="guest.optOut.email" />,
                        },
                      ]
                    : []),
                  {
                    key: 'phone',
                    inset: 40,
                    row: <ValueRow value={g.phone} label={W.mobileNumber} icon="phone" />,
                  },
                  ...(optOuts.texts != null
                    ? [
                        {
                          key: 'optOutTexts',
                          inset: 40,
                          row: <OptOutLine row={optOuts.texts} testID="guest.optOut.texts" />,
                        },
                      ]
                    : []),
                  ...(whatsApp != null
                    ? [
                        {
                          key: 'whatsApp',
                          inset: 40,
                          row: (
                            <WhatsAppRows
                              row={whatsApp}
                              rowRef={refFor('whatsAppRow')}
                              agreeRef={refFor('whatsApp')}
                              onAgree={actions.onAgree}
                            />
                          ),
                        },
                      ]
                    : []),
                  { key: 'language', inset: 40, row: <LanguageRow g={g} /> },
                ]
              : []),
            ...g.companions.map((c, index) => ({
              key: `c${index}`,
              inset: 40,
              row: (
                <Row
                  title={c.name}
                  line={say.companionOf(c.kind === 'held' ? W.heldLine : REPLY_WORD[c.kind])}
                  lead={<MarkSlot kind={c.kind} />}
                />
              ),
            })),
            ...(owner
              ? [
                  {
                    key: 'added',
                    inset: 40,
                    row: (
                      <Row
                        title={`${dayWords(ADDED_ON, locale)} by ${COLLEAGUE}`}
                        line={W.added}
                        lead={<LineIcon name="user" />}
                      />
                    ),
                  },
                ]
              : []),
          ]}
        />
      </View>
      {owner && (
        <View testID="guest.needs">
          <BlockHead title={NW.needs} />
          <NeedsRows
            people={[
              { name: g.name, needs: g.needs, guest: true },
              ...g.companions.map((c) => ({ name: c.name, needs: c.needs, guest: false })),
            ]}
          />
        </View>
      )}
      {!owner && draft && readOnly}
      {(owner || !draft) && (
        <View>
          <BlockHead title={W.invitation} />
          {owner && notInviting != null && (
            <View style={[styles.readOnly, styles.above]} testID="guest.notInviting">
              <Text size={15} weight="medium" style={[styles.secondary, styles.lines]}>
                {notInviting}
              </Text>
            </View>
          )}
          <RowList
            items={[
              ...(invitation != null
                ? [
                    {
                      key: 'invited',
                      inset: 40,
                      row: (
                        <View>
                          <Row
                            title={invitation}
                            lead={<LineIcon name="mail" />}
                            testID="guest.invited"
                          />
                          {owner && handMarked(g) && (
                            <View style={styles.agree}>
                              <TextAction
                                ref={refFor('unmark')}
                                label={W.markNotInvited}
                                onPress={actions.onUnmark}
                                testID="guest.unmark"
                              />
                            </View>
                          )}
                        </View>
                      ),
                    },
                  ]
                : []),
              ...(replaced
                ? [
                    {
                      key: 'replaced',
                      inset: 40,
                      row: (
                        <Row
                          title={say.linkReplaced(dayWords(TODAY, locale))}
                          line={W.linkReplacedLine}
                          lead={<LineIcon name="refresh" />}
                        />
                      ),
                    },
                  ]
                : []),
              ...(owner && invites
                ? [
                    {
                      key: 'copy',
                      inset: 40,
                      row: (
                        <View>
                          <Row
                            ref={refFor('copy')}
                            title={W.copyLink}
                            line={W.copyLinkLine}
                            lead={<LineIcon name="link" />}
                            accent
                            weight="medium"
                            onPress={actions.onCopy}
                            testID="guest.copy"
                          />
                          {copyFailed != null && (
                            <UnderRow text={copyFailed} testID="guest.notCopied" />
                          )}
                        </View>
                      ),
                    },
                  ]
                : []),
              ...(owner
                ? [
                    {
                      key: 'replace',
                      inset: 40,
                      row: (
                        <View>
                          <Row
                            ref={refFor('replace')}
                            title={W.replaceLink}
                            line={W.replaceLinkLine}
                            lead={<LineIcon name="refresh" />}
                            accent
                            weight="medium"
                            onPress={actions.onReplace}
                            testID="guest.replace"
                          />
                          {notReplaced === 'replace' && (
                            <UnderRow text={W.notReplaced} testID="guest.notReplaced" />
                          )}
                        </View>
                      ),
                    },
                  ]
                : []),
              ...(owner && g.kind === 'notyet' && invites
                ? [
                    {
                      key: 'mark',
                      inset: 40,
                      row: (
                        <Row
                          ref={refFor('mark')}
                          title={W.markAsInvited}
                          line={W.markLine}
                          lead={<LineIcon name="tick" />}
                          accent
                          weight="medium"
                          onPress={actions.onMark}
                          testID="guest.mark"
                        />
                      ),
                    },
                  ]
                : []),
              ...(owner && g.kind === 'notyet' && invites
                ? [
                    {
                      key: 'recordNotYet',
                      inset: 40,
                      row: (
                        <Row
                          ref={refFor('recordNotYet')}
                          title={W.recordReply}
                          line={W.recordNotYetLine}
                          lead={<LineIcon name="chat" />}
                          accent
                          weight="medium"
                          onPress={actions.onRecord}
                          testID="guest.recordNotYet"
                        />
                      ),
                    },
                  ]
                : []),
            ]}
          />
          {!owner && <View style={styles.below}>{readOnly}</View>}
        </View>
      )}
      {owner && (
        <View>
          <BlockHead title={W.theirConversation} />
          <Row
            title={W.conversationTitle}
            line={W.conversationLine}
            lead={<LineIcon name="chat" />}
            opens
            onPress={actions.onConversation}
            testID="guest.conversation"
          />
        </View>
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
  return (
    <View style={styles.wrongPerson} testID="guest.flagged">
      <View style={styles.flagHead}>
        <View style={styles.flagMark}>
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
            {TRIANGLE.map((d) => (
              <Path
                key={d}
                d={d}
                stroke={tokens.colorAttentionText}
                strokeWidth={2.2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
          </Svg>
        </View>
        <Text size={16} weight="bold" accessibilityRole="header" style={styles.flagTitle}>
          {W.flaggedTitle}
        </Text>
      </View>
      <Text size={15} weight="medium" style={[styles.secondary, styles.lines]}>
        {say.flaggedLine(name)}
      </Text>
      <View style={styles.flagAction}>
        <TextAction
          ref={replaceRef}
          label={W.replaceLink}
          onPress={onReplace}
          testID="guest.flagged.replace"
        />
      </View>
    </View>
  );
}

/** sc-55558: a failed copy or replace, read out as it appears; the button above is the retry. */
function UnderRow({ text, testID }: { text: string; testID: string }) {
  useReadOut(text, { interrupts: true });

  return (
    <View style={styles.agree} testID={testID}>
      <AlertLine text={text} small />
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
  return (
    <Row
      title={value ?? W.none}
      line={label}
      lead={<LineIcon name={icon} />}
      weight={value == null ? 'medium' : 'semibold'}
      off={value == null}
      accessibilityLabel={`${label}, ${value ?? W.none}`}
    />
  );
}

/** sc-3969: a channel the guest unsubscribed from; not a control, read as one item. */
function OptOutLine({ row, testID }: { row: OptOutRow; testID: string }) {
  return (
    <Row
      title={row.title}
      line={row.note ?? undefined}
      lead={
        <View style={styles.optOutMark}>
          <MessageGlyph name="slash" size={22} ink={tokens.colorInkSecondary} weight={2} />
        </View>
      }
      accessibilityLabel={[row.title, row.note].filter(Boolean).join(', ')}
      testID={testID}
    />
  );
}

/** sc-3950: the consent as the value, WhatsApp as the label; while nothing is in force, the host's way to record it under it. */
function WhatsAppRows({
  row,
  rowRef,
  agreeRef,
  onAgree,
}: {
  row: WhatsAppRow;
  rowRef: Ref<ViewInstance>;
  agreeRef: Ref<ViewInstance>;
  onAgree: () => void;
}) {
  return (
    <View>
      <Row
        ref={rowRef}
        title={row.title}
        line={row.note ?? W.whatsApp}
        lead={<LineIcon name="chat" />}
        accessibilityLabel={[W.whatsApp, row.title, row.note].filter(Boolean).join(', ')}
        testID="guest.whatsApp.row"
      />
      {row.agree && (
        <View style={styles.agree}>
          <TextAction
            ref={agreeRef}
            label={W.guestAgreed}
            onPress={onAgree}
            testID="guest.whatsApp.agree"
          />
        </View>
      )}
    </View>
  );
}

/** sc-5519: the group read-only, for every role that reads the guest; none is No group in Ink 2, as Not set is. */
function GroupRow({ g }: { g: SampleGuest }) {
  const name = g.group ?? null;
  const title = name ?? GW.noGroup;

  return (
    <Row
      title={title}
      line={GW.group}
      lead={<LineIcon name="users" />}
      weight={name == null ? 'medium' : 'semibold'}
      off={name == null}
      accessibilityLabel={`${GW.group}, ${title}`}
      testID="guest.group"
    />
  );
}

/** sc-3790: the host's Language, or what Not set falls back to in Ink 2 as None is; the guest's own choice under it. */
function LanguageRow({ g }: { g: SampleGuest }) {
  const name = languageName(g.language);
  const title = name ?? say.notSetLine(languageName(ORGANISATION_LANGUAGE) ?? '');

  return (
    <View>
      <Row
        title={title}
        line={W.language}
        lead={<LineIcon name="globe" />}
        weight={name == null ? 'medium' : 'semibold'}
        off={name == null}
        accessibilityLabel={`${W.language}, ${title}`}
      />
      {g.chose != null && (
        <View style={styles.chose}>
          <ChoseNote chose={g.chose} />
        </View>
      )}
    </View>
  );
}

function GuestLoading() {
  useReadOut(W.loading);

  return (
    <View style={styles.blocks} accessible accessibilityLabel={W.loading} testID="guest.loading">
      <View style={styles.sunkCard} />
      <View style={styles.sunkHead} />
      {[0, 1, 2].map((index) => (
        <View key={index} style={styles.sunkRow}>
          <View style={styles.sunkIcon} />
          <View style={styles.bars}>
            <View style={[styles.barThick, { width: `${[52, 44, 60][index] ?? 50}%` }]} />
            <View style={[styles.barThin, { width: `${[34, 30, 22][index] ?? 30}%` }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

function NotFound({ onBack }: { onBack: () => void }) {
  useReadOut(`${W.notFound}. ${W.notFoundLine}`);

  return (
    <View style={styles.notFound} testID="guest.notFound">
      <Text size={20} weight="bold" accessibilityRole="header" style={styles.notFoundTitle}>
        {W.notFound}
      </Text>
      <Text size={15} weight="medium" style={[styles.secondary, styles.lines]}>
        {W.notFoundLine}
      </Text>
      <View style={styles.backTo}>
        <Pill
          label={W.backToGuests}
          kind="secondary"
          height={tokens.sizeHit}
          full={false}
          onPress={onBack}
          testID="guest.notFound.back"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  blocks: { gap: 18 },
  chose: { paddingLeft: 40, paddingBottom: 12 },
  optOutMark: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  agree: { paddingLeft: 40, paddingBottom: tokens.spaceXs, alignItems: 'flex-start' },
  readOnly: {
    paddingVertical: 14,
    paddingHorizontal: tokens.spaceXl,
    borderRadius: 18,
    backgroundColor: tokens.colorInset,
  },
  below: { marginTop: tokens.spaceSm },
  above: { marginBottom: tokens.spaceSm },
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
  secondary: { color: tokens.colorInkSecondary },
  lines: { lineHeight: 15 * 1.45 },
  sunkCard: { height: 190, borderRadius: 26, backgroundColor: tokens.colorNeutralFill },
  sunkHead: { width: '30%', height: 18, borderRadius: 9, backgroundColor: tokens.colorNeutralFill },
  sunkRow: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceLg,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colorBorder,
  },
  sunkIcon: { width: 28, height: 28, borderRadius: 8, backgroundColor: tokens.colorNeutralFill },
  bars: { flex: 1, gap: tokens.spaceSm },
  barThick: { height: 14, borderRadius: 7, backgroundColor: tokens.colorNeutralFill },
  barThin: { height: 12, borderRadius: 6, backgroundColor: tokens.colorNeutralFill },
  notFound: { paddingTop: 120, gap: 10 },
  notFoundTitle: { lineHeight: 20 * 1.3 },
  backTo: { alignItems: 'flex-start', paddingTop: tokens.spaceXs },
});
