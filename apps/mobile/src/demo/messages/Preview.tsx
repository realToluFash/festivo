import { type ReactNode, useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type ViewInstance } from 'react-native';

import { EventMesh } from '../../components/EventMesh.tsx';
import { Glyph } from '../../components/Glyph.tsx';
import { useReadOut } from '../../components/ReadOut.tsx';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { meshFor } from '../../kit/today.ts';
import { MessageGlyph } from './MessageMarks.tsx';
import type { Action, Draft } from './MessagesModel.ts';
import { EVENT, HOSTS, ORG, SAMPLE_EVENT_ID } from './MessagesSample.ts';
import { W, say } from './MessagesWords.ts';
import {
  FILLING_MS,
  type Previewing,
  chosen,
  coverFor,
  filledAs,
  greetingFor,
  noticeFor,
  previewLines,
  smsNoticeFor,
} from './PreviewModel.ts';
import { PREVIEW_PEOPLE, type PreviewPerson } from './PreviewSample.ts';
import { sayPreview } from './PreviewWords.ts';
import { smsHead } from './Sms.ts';
import { saySms } from './SmsWords.ts';
import { type Anchored, PreviewAsChooser, PreviewAsControl, anchorAt } from './WriteItOnce.tsx';

/** The message as the guest's own page shows it (GuestPage-A): the cover, then the hosts' words in a figure, signed. */
function PagePreview({ draft, person }: { draft: Draft; person: PreviewPerson }) {
  const subject = draft.subject.trim();
  const words = filledAs(draft.body, person);
  const cover = coverFor(person);

  return (
    <View
      style={styles.page}
      accessible
      accessibilityLabel={[say.pageAs(person.name), EVENT, cover, subject, words, HOSTS]
        .filter((part) => part !== '')
        .join('. ')}
    >
      <View style={styles.cover}>
        <EventMesh event={{ mesh: meshFor(SAMPLE_EVENT_ID), photo: null }} shade="band" />
        <View style={styles.coverWords}>
          <Text size={20} weight="bold" accessible={false} style={[styles.white, styles.title]}>
            {EVENT}
          </Text>
          <Text size={13.5} weight="medium" accessible={false} style={styles.white}>
            {cover}
          </Text>
        </View>
      </View>
      <View style={styles.figureAt}>
        <View style={styles.figure}>
          {subject !== '' && (
            <Text size={17} weight="bold" accessible={false} style={styles.heading}>
              {subject}
            </Text>
          )}
          <Text size={16} weight="medium" accessible={false} style={styles.words}>
            {words}
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

function EmailNotice({ person }: { person: PreviewPerson }) {
  const notice = noticeFor(person);

  return (
    <View style={styles.email}>
      <View style={styles.from}>
        <Glyph name="mail" size={14} ink={tokens.colorInkSecondary} />
        <Text size={13} weight="semibold" style={styles.secondary}>
          {say.emailFrom(ORG)}
        </Text>
      </View>
      <Text size={15} weight="bold" style={styles.noticeSubject}>
        {notice.subject}
      </Text>
      <Text size={14} weight="medium" style={styles.body}>
        {`${say.dear(greetingFor(person))}\n${notice.body}`}
      </Text>
      <View style={styles.readIt}>
        <Text size={14.5} weight="semibold">
          {notice.button}
        </Text>
      </View>
      <Text size={13} weight="medium" style={[styles.secondary, styles.stop]}>
        {say.stopEmails(ORG)}
      </Text>
    </View>
  );
}

function SmsNotice({ person }: { person: PreviewPerson }) {
  const notice = smsNoticeFor(person);

  return (
    <View style={styles.sms}>
      <View style={styles.from}>
        <MessageGlyph name="sms" size={14} ink={tokens.colorInkSecondary} />
        <Text size={13} weight="semibold" style={[styles.secondary, styles.figures]}>
          {smsHead(notice.count)}
        </Text>
      </View>
      <View style={styles.smsBubble}>
        <Text size={14.5} weight="medium" style={styles.body145}>
          {notice.text}
        </Text>
      </View>
      {notice.first && (
        <Text size={13} weight="medium" style={[styles.secondary, styles.small, styles.under]}>
          {saySms.firstText(ORG)}
        </Text>
      )}
    </View>
  );
}

function WhatsAppNotice({ person }: { person: PreviewPerson }) {
  const notice = noticeFor(person);

  return (
    <View style={styles.sms}>
      <View style={styles.from}>
        <MessageGlyph name="wa" size={14} ink={tokens.colorInkSecondary} />
        <Text size={13} weight="semibold" style={styles.secondary}>
          {say.whatsAppTemplate}
        </Text>
      </View>
      <View style={styles.waCard}>
        <Text size={14.5} weight="medium" style={[styles.body145, styles.waBody]}>
          {notice.body}
        </Text>
        <View style={styles.waButton}>
          <Text size={14.5} weight="semibold" style={styles.accent}>
            {notice.button}
          </Text>
        </View>
      </View>
    </View>
  );
}

/** While a newly chosen guest's preview is filled in: the words said once, over the page drawn as Sunk shapes. */
function Filling({ name, columns }: { name: string; columns: boolean }) {
  const words = sayPreview.filling(name);
  useReadOut(words);

  return (
    <View style={styles.filling} testID="messages.preview.filling">
      <Text size={14.5} weight="medium" style={styles.secondary}>
        {words}
      </Text>
      <View
        style={columns ? styles.columns : styles.stacked}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <View style={[styles.sunkPage, columns && styles.pageColumn]}>
          <View style={styles.sunkCover} />
          <View style={styles.sunkFigure}>
            {[88, 96, 70, 42].map((width) => (
              <View key={width} style={[styles.sunkBar, { width: `${width}%` }]} />
            ))}
          </View>
        </View>
        <View style={[styles.sunkNotice, columns && styles.grow]} />
      </View>
    </View>
  );
}

/** The preview: Preview as, the page the guest opens, and what Soirely sends by each ticked channel, never the hosts' words. */
export function Preview({
  draft,
  columns,
  phone,
  as,
  dispatch,
}: {
  draft: Draft;
  columns: boolean;
  phone: boolean;
  as: Previewing;
  dispatch: (action: Action) => void;
}) {
  const person = PREVIEW_PEOPLE[as.who];
  const control = useRef<ViewInstance>(null);
  const [at, setAt] = useState<Anchored | null>(null);
  const set = (previewing: Previewing) => dispatch({ type: 'previewing', previewing });

  useEffect(() => {
    if (!as.choosing || phone) return undefined;
    const later = setTimeout(() => anchorAt(control.current, setAt), 300);

    return () => clearTimeout(later);
  }, [as.choosing, phone]);

  useEffect(() => {
    if (!as.filling || as.held) return undefined;
    const done = setTimeout(
      () => dispatch({ type: 'previewing', previewing: { ...as, filling: false } }),
      FILLING_MS,
    );

    return () => clearTimeout(done);
  }, [as, dispatch]);

  const email = draft.channels.email && person.email;
  const any = email || draft.channels.sms || draft.channels.wa;
  const notices = any ? (
    <View style={styles.notices}>
      <Text size={14} weight="semibold" accessibilityRole="header">
        {W.whatSoirelySends}
      </Text>
      {email && <EmailNotice person={person} />}
      {draft.channels.sms && <SmsNotice person={person} />}
      {draft.channels.wa && <WhatsAppNotice person={person} />}
    </View>
  ) : null;
  let shown: ReactNode;
  if (as.filling) shown = <Filling name={person.name} columns={columns} />;
  else if (columns)
    shown = (
      <View style={styles.columns}>
        <View style={styles.pageColumn}>
          <PagePreview draft={draft} person={person} />
        </View>
        <View style={styles.grow}>{notices}</View>
      </View>
    );
  else
    shown = (
      <>
        <PagePreview draft={draft} person={person} />
        {notices}
      </>
    );

  return (
    <View style={styles.preview}>
      <Text size={14} weight="semibold" accessibilityRole="header">
        {say.previewAs(person.name)}
      </Text>
      <PreviewAsControl
        ref={control}
        person={person}
        phone={phone}
        open={as.choosing}
        onOpen={() => set({ ...as, choosing: true })}
      />
      {shown}
      {!as.filling && (
        <View style={styles.lines}>
          {previewLines(draft.body, person).map((line) => (
            <Text key={line} size={13.5} weight="medium" style={[styles.secondary, styles.small]}>
              {line}
            </Text>
          ))}
        </View>
      )}
      <PreviewAsChooser
        open={as.choosing && (phone || at != null)}
        phone={phone}
        at={as.choosing ? at : null}
        shown={as.who}
        opener={control}
        onPick={(who) => {
          setAt(null);
          set(chosen(as, who));
        }}
        onClose={() => {
          setAt(null);
          set({ ...as, choosing: false });
        }}
      />
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
  accent: { color: tokens.colorAccentText },
  waCard: {
    maxWidth: 320,
    overflow: 'hidden',
    borderRadius: tokens.spaceXl,
    backgroundColor: tokens.colorInsetBorder,
  },
  waBody: { paddingVertical: tokens.spaceMd, paddingHorizontal: 14 },
  waButton: {
    minHeight: tokens.sizeHit,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1,
    borderTopColor: tokens.colorBorder,
  },
  small: { lineHeight: 13.5 * 1.45 },
  figures: { fontVariant: ['tabular-nums'] },
  under: { maxWidth: 320 },
  filling: { gap: tokens.spaceMd },
  stacked: { gap: 14 },
  sunkPage: {
    overflow: 'hidden',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
    backgroundColor: tokens.colorCard,
  },
  sunkCover: { height: 112, backgroundColor: tokens.colorNeutralFill },
  sunkFigure: { gap: tokens.spaceSm, padding: tokens.spaceXl },
  sunkBar: { height: 14, borderRadius: 7, backgroundColor: tokens.colorNeutralFill },
  sunkNotice: {
    height: 150,
    borderRadius: tokens.spaceXl,
    backgroundColor: tokens.colorNeutralFill,
  },
});
