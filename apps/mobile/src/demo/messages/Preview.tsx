import { StyleSheet, View } from 'react-native';

import { EventMesh } from '../../components/EventMesh.tsx';
import { Glyph } from '../../components/Glyph.tsx';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { meshFor } from '../events/EventsSample.ts';
import { MessageGlyph } from './MessageMarks.tsx';
import type { Draft } from './MessagesModel.ts';
import { EVENT, HOSTS, ORG, PREVIEW, SAMPLE_EVENT_ID, filledFor } from './MessagesSample.ts';
import { W, say } from './MessagesWords.ts';

/** The message as the guest's own page shows it (GuestPage-A): the cover, then the hosts' words in a figure, signed. */
function PagePreview({ draft }: { draft: Draft }) {
  return (
    <View style={styles.page} accessible accessibilityLabel={say.pageAs(PREVIEW.name)}>
      <View style={styles.cover}>
        <EventMesh event={{ mesh: meshFor(SAMPLE_EVENT_ID), photo: null }} shade="band" />
        <View style={styles.coverWords}>
          <Text size={20} weight="bold" accessible={false} style={[styles.white, styles.title]}>
            {EVENT}
          </Text>
          <Text size={13.5} weight="medium" accessible={false} style={styles.white}>
            {PREVIEW.cover}
          </Text>
        </View>
      </View>
      <View style={styles.figureAt}>
        <View style={styles.figure}>
          {draft.subject.trim() !== '' && (
            <Text size={17} weight="bold" accessible={false} style={styles.heading}>
              {draft.subject.trim()}
            </Text>
          )}
          <Text size={16} weight="medium" accessible={false} style={styles.words}>
            {filledFor(draft.body, PREVIEW.name)}
          </Text>
          <Text
            size={15}
            weight="semibold"
            accessible={false}
            style={[styles.secondary, styles.signed]}
          >
            {HOSTS}
          </Text>
        </View>
      </View>
    </View>
  );
}

function EmailNotice() {
  return (
    <View style={styles.email}>
      <View style={styles.from}>
        <Glyph name="mail" size={14} ink={tokens.colorInkSecondary} />
        <Text size={13} weight="semibold" style={styles.secondary}>
          {say.emailFrom(ORG)}
        </Text>
      </View>
      <Text size={15} weight="bold" style={styles.noticeSubject}>
        {say.noticeSubject(EVENT, HOSTS)}
      </Text>
      <Text size={14} weight="medium" style={styles.body}>
        {`${say.dear(PREVIEW.name)}\n${say.noticeBody(HOSTS, EVENT)}`}
      </Text>
      <View style={styles.readIt}>
        <Text size={14.5} weight="semibold">
          {W.readOnYourPage}
        </Text>
      </View>
      <Text size={13} weight="medium" style={[styles.secondary, styles.stop]}>
        {say.stopEmails(ORG)}
      </Text>
    </View>
  );
}

function SmsNotice() {
  return (
    <View style={styles.sms}>
      <View style={styles.from}>
        <MessageGlyph name="sms" size={14} ink={tokens.colorInkSecondary} />
        <Text size={13} weight="semibold" style={styles.secondary}>
          {say.smsParts(1)}
        </Text>
      </View>
      <View style={styles.smsBubble}>
        <Text size={14.5} weight="medium" style={styles.body145}>
          {say.noticeSms(HOSTS, EVENT, PREVIEW.link)}
        </Text>
      </View>
    </View>
  );
}

/** The preview: the page the guest opens, and what Soirely sends by each ticked channel, never the hosts' words. */
export function Preview({ draft, columns }: { draft: Draft; columns: boolean }) {
  const notices = (
    <View style={styles.notices}>
      <Text size={14} weight="semibold" accessibilityRole="header">
        {W.whatSoirelySends}
      </Text>
      {draft.channels.email && <EmailNotice />}
      {draft.channels.sms && <SmsNotice />}
    </View>
  );

  return (
    <View style={styles.preview}>
      <Text size={14} weight="semibold" accessibilityRole="header">
        {`${say.previewAs(PREVIEW.name)} · ${PREVIEW.language}`}
      </Text>
      {columns ? (
        <View style={styles.columns}>
          <View style={styles.pageColumn}>
            <PagePreview draft={draft} />
          </View>
          <View style={styles.grow}>{notices}</View>
        </View>
      ) : (
        <>
          <PagePreview draft={draft} />
          {notices}
        </>
      )}
      <View style={styles.lines}>
        {[say.greetedAs(PREVIEW.name), say.inLanguage(PREVIEW.language), W.onlyOurs].map((line) => (
          <Text key={line} size={13.5} weight="medium" style={[styles.secondary, styles.small]}>
            {line}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  secondary: { color: tokens.colorInkSecondary },
  white: { color: tokens.colorInkOnDark },
  preview: { gap: 14 },
  columns: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceXxl },
  pageColumn: { width: '52%' },
  page: {
    overflow: 'hidden',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
    backgroundColor: tokens.colorCard,
  },
  cover: { minHeight: 112, justifyContent: 'flex-end', overflow: 'hidden' },
  coverWords: {
    gap: tokens.spaceXxs,
    paddingTop: tokens.space3xl,
    paddingHorizontal: tokens.spaceXl,
    paddingBottom: 14,
  },
  title: { letterSpacing: -0.4, lineHeight: 20 * 1.2 },
  figureAt: { paddingTop: 14, paddingHorizontal: 14, paddingBottom: tokens.spaceXl },
  figure: {
    gap: tokens.spaceXxs,
    paddingVertical: 18,
    paddingHorizontal: tokens.spaceXxl,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: tokens.colorInsetBorder,
    backgroundColor: tokens.colorInset,
  },
  heading: { lineHeight: 17 * 1.35 },
  words: { lineHeight: 16 * 1.45 },
  signed: { marginTop: tokens.spaceXxs, lineHeight: 15 * 1.4 },
  notices: { gap: tokens.spaceMd },
  email: {
    gap: tokens.spaceXs,
    paddingVertical: tokens.spaceLg,
    paddingHorizontal: tokens.spaceXl,
    borderRadius: tokens.spaceXl,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
    backgroundColor: tokens.colorCard,
  },
  from: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceXs },
  noticeSubject: { lineHeight: 15 * 1.3 },
  body: { lineHeight: 14 * 1.45 },
  body145: { lineHeight: 14.5 * 1.45 },
  readIt: {
    minHeight: tokens.sizeHit,
    alignSelf: 'flex-start',
    justifyContent: 'center',
    paddingHorizontal: tokens.spaceXl,
    borderRadius: tokens.spaceLg,
    borderWidth: 1.5,
    borderColor: tokens.colorInk,
  },
  stop: { textDecorationLine: 'underline' },
  sms: { gap: 5, alignItems: 'flex-start' },
  smsBubble: {
    maxWidth: 320,
    paddingVertical: tokens.spaceMd,
    paddingHorizontal: 14,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomRightRadius: 20,
    borderBottomLeftRadius: tokens.spaceXs,
    backgroundColor: tokens.colorInsetBorder,
  },
  lines: { gap: tokens.spaceXxs },
  small: { lineHeight: 13.5 * 1.45 },
});
