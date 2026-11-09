import type { Ref } from 'react';
import { StyleSheet, View, type ViewInstance } from 'react-native';

import { useReadOut } from '../../components/ReadOut.tsx';
import type { TextHandle } from '../../components/Text.tsx';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { AlertLine } from '../events/EventEdits.tsx';
import type { Shown } from '../events/EventsModel.ts';
import { LineIcon } from '../../components/AccountCard.tsx';
import { Pill } from '../../components/SettingsParts.tsx';
import { Row, RowList, TextAction } from '../../components/Summary.tsx';
import { type Role, dayWords, invitedWords, replyLine, replyParts } from './GuestsModel.ts';
import { GreetAsRow } from './GuestGreetAs.tsx';
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
import { MarkSlot } from './ReplyMark.tsx';

const REOPENED_ON = '2026-11-05';
const ADDED_ON = '2026-09-14';

export interface GuestActions {
  onRecord: () => void;
  onEdit: () => void;
  onCopy: () => void;
  onReplace: () => void;
  onMark: () => void;
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
): { line: string; step: { label: string; onPress: () => void } | null } {
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
      line: W.copyFirst,
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
  status,
  invites,
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
  notReplaced: boolean;
  status: string | null;
  /** A Draft offers no link: nobody is invited until it is live. */
  invites: boolean;
  /** The event's Reply by date, or none (sc-3780). */
  replyBy: string | null;
  nameRef: Ref<TextHandle>;
  refFor: (key: string) => Ref<ViewInstance>;
  actions: GuestActions;
}) {
  if (phase === 'loading' || g == null)
    return phase === 'notFound' ? <NotFound onBack={actions.onBack} /> : <GuestLoading />;

  const owner = role === 'owner';
  const card = cardOf(g, role, replies, locale, actions, invites, replyBy);
  const kind = g.kind === 'walkin' ? 'walkin' : g.kind;
  const replied = g.kind === 'coming' || g.kind === 'maybe' || g.kind === 'notcoming';
  const { word, detail } = replyParts(g, locale, replyBy);

  return (
    <View style={styles.blocks} testID={`guest.${g.key}`}>
      {status != null && <DoneLine text={status} />}
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
      {notReplaced && <AlertLine text={W.notReplaced} />}
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
            ...(owner
              ? [
                  {
                    key: 'email',
                    inset: 40,
                    row: <ValueRow value={g.email} label={W.emailAddress} icon="mail" />,
                  },
                  {
                    key: 'phone',
                    inset: 40,
                    row: <ValueRow value={g.phone} label={W.mobileNumber} icon="phone" />,
                  },
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
      {owner && invites && (
        <View>
          <BlockHead title={W.invitation} />
          <RowList
            items={[
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
              {
                key: 'copy',
                inset: 40,
                row: (
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
                ),
              },
              {
                key: 'replace',
                inset: 40,
                row: (
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
                ),
              },
              ...(g.kind === 'notyet'
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
            ]}
          />
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
