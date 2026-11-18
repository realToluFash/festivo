import { formatPhone, formattingLocale } from '@soirely/domain';
import { getLocales } from 'expo-localization';
import { type Href, router } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, ScrollView, StyleSheet, View, type ViewInstance } from 'react-native';

import { BackButton } from '../../components/AppFrame.tsx';
import { SecondaryButton } from '../../components/Buttons.tsx';
import { NoteBox, SelectBox } from '../../components/EventEdits.tsx';
import { Field, FieldError, TextField } from '../../components/Field.tsx';
import { SheetBody, SheetLayer } from '../../components/FormLayers.tsx';
import { Glyph } from '../../components/Glyph.tsx';
import { ListTop } from '../../components/ListTop.tsx';
import { Notice } from '../../components/Notice.tsx';
import { kindOf, useShell } from '../../components/settingsShell.ts';
import { Pair, Pill } from '../../components/SettingsParts.tsx';
import { TextAction } from '../../components/Summary.tsx';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { Choices } from '../events/EventEdits.tsx';
import { Bell, OrgPill } from '../settings/Frame.tsx';
import { EnquiriesFrame } from './EnquiriesFrame.tsx';
import { Failed, enquiryHref } from './EnquiriesList.tsx';
import {
  type Enquiry,
  LOST_REASONS,
  type LostReason,
  NOW,
  type Note,
  PEOPLE,
  type Person,
  asQuery,
  personOf,
} from './EnquiriesModel.ts';
import { W } from './EnquiriesWords.ts';
import { EnquiryForm } from './EnquiryForm.tsx';
import { type PageState, noteWhen, notesNewestFirst, pageStartOf } from './EnquiryPageModel.ts';
import { Fact, PagePart, StatusLine, StatusShape } from './EnquiryParts.tsx';
import {
  NOTE_COUNTER_FROM,
  NOTE_MOST,
  counterWords,
  letters,
  lostProblems,
  moneyWords,
  noteProblem,
  savedLine,
} from './EnquiryRules.ts';
import { madeOf } from './made.ts';

type Closing = { reason: LostReason | null; line: string; tried: boolean };

function dayWords(date: string, locale: string): string {
  const day = new Date(`${date}T12:00:00Z`);

  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
    ...(day.getUTCFullYear() === new Date(NOW).getUTCFullYear() ? {} : { year: 'numeric' }),
  }).format(day);
}

/** An enquiry's page (sc-31226): how to reach them, the event, who has it, the notes, and Close as lost or Reopen. */
export function EnquiryPage({
  id,
  state,
  as,
}: {
  id: string | undefined;
  state: PageState;
  as: string | undefined;
}) {
  const { t } = useTranslation();
  const shell = useShell();
  const locale = formattingLocale('en', getLocales()[0]?.languageTag);
  const [start] = useState(() => pageStartOf(state, id, as, madeOf));
  const viewer = start.viewer;
  const [enquiry, setEnquiry] = useState<Enquiry | null>(start.enquiry);
  const [failed, setFailed] = useState(start.failed);
  const [closing, setClosing] = useState<Closing | null>(start.closing);
  const [assigning, setAssigning] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [edits, setEdits] = useState(0);
  const editOpener = useRef<ViewInstance>(null);
  const wide = shell.layout !== 'phone';
  const manages = viewer.role !== 'member';
  const listHref = (manages ? '/demo/enquiries' : '/demo/enquiries?state=memberList') as Href;
  const back = () => (router.canGoBack() ? router.back() : router.replace(listHref));
  const top = <BackButton label={W.enquiries} onPress={back} testID="enquiry.back" />;

  if (failed)
    return (
      <EnquiriesFrame band={null}>
        {top}
        <Failed words={W.pageFailed} onRetry={() => setFailed(false)} testID="enquiry.failed" />
      </EnquiriesFrame>
    );

  if (enquiry == null)
    return (
      <EnquiriesFrame band={null}>
        {top}
        <View style={styles.stack} testID="enquiry.notFound">
          <Notice
            tone="quiet"
            mark={tokens.marks.info.glyph}
            title={W.notFound}
            body={W.notFoundLine}
            heading
          />
          <SecondaryButton
            label={W.backToEnquiries}
            onPress={() => router.replace(listHref)}
            testID="enquiry.backToEnquiries"
          />
        </View>
      </EnquiriesFrame>
    );

  const lost = enquiry.lost;
  const status = lost == null ? W.open : `${W.lost} · ${W.reasons[lost.reason]}`;
  const close = (reason: LostReason, line: string) => {
    setEnquiry({
      ...enquiry,
      tab: 'lost',
      changedAt: NOW,
      lost: { reason, line: savedLine(line) },
    });
    setClosing(null);
    shell.tell(W.closed);
  };
  const reopen = () => {
    setEnquiry({ ...enquiry, tab: 'open', changedAt: NOW, lost: null });
    shell.tell(W.reopened);
  };
  const nameOf = (person: Person) => (person.id === viewer.id ? W.you(person.name) : person.name);
  const assigned = personOf(enquiry.assignedTo);
  const panel = closing != null && (
    <CloseAsLost start={closing} onKeep={() => setClosing(null)} onConfirm={close} />
  );
  const docked = shell.layout === 'landscape';
  const form = edits > 0 && (
    <EnquiryForm
      key={edits}
      open={editOpen}
      viewer={viewer}
      start={null}
      editing={enquiry}
      locale={locale}
      opener={editOpener}
      onClose={() => setEditOpen(false)}
      onSaved={(saved) => {
        setEnquiry(saved);
        setEditOpen(false);
        shell.tell(W.saved);
      }}
      onOpenSame={(other) => {
        setEditOpen(false);
        router.push(enquiryHref(other, asQuery(viewer)));
      }}
    />
  );
  const overlay = (
    <>
      {form}
      {closing != null && !docked && (
        <SheetLayer onClose={() => setClosing(null)} label={W.keepOpen}>
          {panel}
        </SheetLayer>
      )}
      {assigning && (
        <SheetLayer onClose={() => setAssigning(false)} label={W.cancel}>
          <SheetBody
            title={W.assignedTo}
            close={W.cancel}
            onClose={() => setAssigning(false)}
            closeTestID="enquiry.assigned.close"
          >
            <Choices
              items={Object.values(PEOPLE).map((person) => ({
                key: person.id,
                title: nameOf(person),
              }))}
              on={enquiry.assignedTo}
              onPick={(assignedTo) => {
                setEnquiry({ ...enquiry, assignedTo, changedAt: NOW });
                setAssigning(false);
              }}
              testID="enquiry.assigned"
            />
          </SheetBody>
        </SheetLayer>
      )}
    </>
  );
  const open = (url: string) => {
    Linking.openURL(url).catch(() => shell.tell(`Opens ${url}`));
  };
  const notGiven = (value: string | null) => ({
    value: value ?? W.notGiven,
    given: value != null,
  });

  return (
    <EnquiriesFrame
      band={null}
      overlay={overlay}
      dock={docked && closing != null ? <ScrollView>{panel}</ScrollView> : null}
    >
      {top}
      <ListTop
        kind={kindOf(shell.layout)}
        title={enquiry.client}
        pill={<OrgPill />}
        bell={<Bell tell={shell.tell} />}
        under={<StatusLine lost={lost != null} words={status} />}
      />
      {lost != null && (
        <View style={styles.banner} testID="enquiry.lost">
          <View style={styles.bannerHead}>
            <StatusShape lost />
            <Text size={17} weight="bold" accessibilityRole="header" style={styles.grow}>
              {status}
            </Text>
          </View>
          {lost.line != null && (
            <Text size={15} weight="medium" style={styles.lines}>
              {lost.line}
            </Text>
          )}
          <View style={styles.start}>
            <SecondaryButton label={W.reopen} onPress={reopen} testID="enquiry.reopen" />
          </View>
        </View>
      )}

      <PagePart wide={wide} title={W.reachThem} testID="enquiry.reach">
        {enquiry.phone != null && (
          <View style={styles.start}>
            <TextAction
              label={W.call(formatPhone(enquiry.phone))}
              glyph="phone"
              figures
              onPress={() => open(`tel:${enquiry.phone}`)}
              testID="enquiry.call"
            />
          </View>
        )}
        {enquiry.email != null && (
          <View style={styles.start}>
            <TextAction
              label={W.write(enquiry.email)}
              glyph="mail"
              onPress={() => open(`mailto:${enquiry.email}`)}
              testID="enquiry.email"
            />
          </View>
        )}
        {enquiry.bestWay === 'whatsapp' && enquiry.phone != null && (
          <View style={styles.start}>
            <SecondaryButton
              label={W.whatsapp}
              onPress={() => open(`https://wa.me/${enquiry.phone?.slice(1) ?? ''}`)}
              testID="enquiry.whatsapp"
            />
          </View>
        )}
        {enquiry.bestWay != null && (
          <Text size={15} weight="medium" style={styles.secondary}>
            {W.bestWayLine(W.bestWays[enquiry.bestWay])}
          </Text>
        )}
      </PagePart>

      <PagePart wide={wide} title={W.aboutEvent} testID="enquiry.about">
        <View style={[styles.facts, wide && styles.factsWide]}>
          {[
            [W.eventType, notGiven(enquiry.type == null ? null : t(`eventTypes.${enquiry.type}`))],
            [
              W.date,
              {
                value: enquiry.date == null ? W.noDate : dayWords(enquiry.date, locale),
                given: enquiry.date != null,
              },
            ],
            [
              W.guests,
              notGiven(enquiry.guests == null ? null : enquiry.guests.toLocaleString(locale)),
            ],
            [W.where, notGiven(enquiry.where)],
            [
              W.budget,
              notGiven(enquiry.budget == null ? null : moneyWords(enquiry.budget, locale)),
            ],
            [W.foundVia, notGiven(enquiry.foundVia == null ? null : W.foundVias[enquiry.foundVia])],
          ].map(([label, fact]) =>
            typeof label === 'string' && typeof fact === 'object' ? (
              <View key={label} style={wide ? styles.factWide : undefined}>
                <Fact label={label} value={fact.value} given={fact.given} />
              </View>
            ) : null,
          )}
        </View>
        <View style={styles.start}>
          <SecondaryButton
            ref={editOpener}
            label={W.edit}
            onPress={() => {
              setEdits((times) => times + 1);
              setEditOpen(true);
            }}
            testID="enquiry.edit"
          />
        </View>
      </PagePart>

      <PagePart wide={wide} title={W.assignedTo} testID="enquiry.assignedTo">
        {manages ? (
          <SelectBox
            label={W.assignedTo}
            value={assigned == null ? W.notAssigned : nameOf(assigned)}
            onPress={() => setAssigning(true)}
            testID="enquiry.assignedTo.select"
          />
        ) : (
          <Text size={16} weight="medium">
            {W.assignedToYou}
          </Text>
        )}
      </PagePart>

      <Notes
        wide={wide}
        viewer={viewer}
        notes={enquiry.notesList}
        editingAtStart={start.editing}
        locale={locale}
        onNotes={(notesList) => setEnquiry({ ...enquiry, notesList, changedAt: NOW })}
      />

      {lost == null && (
        <View style={styles.start}>
          <Pill
            label={W.closeAsLostOpens}
            kind="dangerQuiet"
            full={false}
            height={tokens.sizeHitPhonePrimary}
            onPress={() => setClosing({ reason: null, line: '', tried: false })}
            testID="enquiry.closeAsLost"
          />
        </View>
      )}
    </EnquiriesFrame>
  );
}

function Notes({
  wide,
  viewer,
  notes,
  editingAtStart,
  locale,
  onNotes,
}: {
  wide: boolean;
  viewer: Person;
  notes: readonly Note[];
  editingAtStart: string | null;
  locale: string;
  onNotes: (notes: Note[]) => void;
}) {
  const [typed, setTyped] = useState('');
  const [tried, setTried] = useState(false);
  const [editing, setEditing] = useState<{ id: string; text: string; tried: boolean } | null>(
    () => {
      const note = notes.find((one) => one.id === editingAtStart);

      return note == null ? null : { id: note.id, text: note.text, tried: false };
    },
  );
  const addProblem = tried ? noteProblem(typed) : null;
  const editProblem = editing?.tried === true ? noteProblem(editing.text) : null;
  const add = () => {
    setTried(true);
    if (noteProblem(typed) != null) return;
    onNotes([
      {
        id: `n${notes.length + 1}`,
        author: viewer.id,
        at: NOW,
        text: typed.trim(),
        edited: false,
      },
      ...notes,
    ]);
    setTyped('');
    setTried(false);
  };
  const saveEdit = () => {
    if (editing == null) return;
    if (noteProblem(editing.text) != null) {
      setEditing({ ...editing, tried: true });
      return;
    }
    onNotes(
      notes.map((one) =>
        one.id === editing.id ? { ...one, text: editing.text.trim(), edited: true } : one,
      ),
    );
    setEditing(null);
  };

  return (
    <PagePart wide={wide} title={W.notesCount(notes.length)} testID="enquiry.notes">
      <Field
        label={W.addNote}
        error={addProblem}
        {...(letters(typed) >= NOTE_COUNTER_FROM
          ? { help: counterWords(letters(typed), NOTE_MOST) }
          : {})}
      >
        <NoteBox
          accessibilityLabel={W.addNote}
          value={typed}
          onChangeText={setTyped}
          wrong={addProblem != null}
          testID="enquiry.notes.add"
        />
      </Field>
      <View style={styles.start}>
        <SecondaryButton label={W.addNoteButton} onPress={add} testID="enquiry.notes.addNote" />
      </View>
      {notes.length === 0 && (
        <Text size={15} weight="medium" style={styles.secondary}>
          {W.noNotes}
        </Text>
      )}
      {notesNewestFirst(notes).map((note) => {
        const author = personOf(note.author)?.name ?? '';
        const own = note.author === viewer.id;

        return editing?.id === note.id ? (
          <View key={note.id} style={styles.note} testID={`enquiry.note.${note.id}.editing`}>
            <Field label={W.notes} error={editProblem}>
              <NoteBox
                accessibilityLabel={W.notes}
                value={editing.text}
                onChangeText={(text) => setEditing({ ...editing, text })}
                wrong={editProblem != null}
                testID={`enquiry.note.${note.id}.field`}
              />
            </Field>
            <View style={styles.row}>
              <SecondaryButton
                label={W.saveNote}
                onPress={saveEdit}
                testID={`enquiry.note.${note.id}.save`}
              />
              <TextAction
                label={W.cancel}
                onPress={() => setEditing(null)}
                testID={`enquiry.note.${note.id}.cancel`}
              />
            </View>
          </View>
        ) : (
          <View key={note.id} style={styles.note} testID={`enquiry.note.${note.id}`}>
            <Text size={16} weight="medium" style={styles.lines}>
              {note.text}
            </Text>
            <View style={styles.meta}>
              <Text size={14} weight="medium" style={styles.secondary}>
                {`${author} · ${noteWhen(note.at, NOW, locale)}`}
              </Text>
              {note.edited && (
                <View style={styles.edited}>
                  <Text size={14} weight="medium" style={styles.secondary}>
                    ·
                  </Text>
                  <Glyph name="edit" size={13} ink={tokens.colorInkSecondary} weight={2.2} />
                  <Text size={14} weight="medium" style={styles.secondary}>
                    {W.edited}
                  </Text>
                </View>
              )}
            </View>
            {own && (
              <View style={styles.start}>
                <TextAction
                  label={W.edit}
                  onPress={() => setEditing({ id: note.id, text: note.text, tried: false })}
                  testID={`enquiry.note.${note.id}.edit`}
                />
              </View>
            )}
          </View>
        );
      })}
    </PagePart>
  );
}

/** Close as lost: a reason, an optional line, then Keep it open or Close as lost; nothing closes until both check. */
function CloseAsLost({
  start,
  onKeep,
  onConfirm,
}: {
  start: Closing;
  onKeep: () => void;
  onConfirm: (reason: LostReason, line: string) => void;
}) {
  const shell = useShell();
  const [reason, setReason] = useState(start.reason);
  const [line, setLine] = useState(start.line);
  const [tried, setTried] = useState(start.tried);
  const problems = tried ? lostProblems(reason, line) : {};
  const confirm = () => {
    setTried(true);
    const now = lostProblems(reason, line);
    if (reason == null || now.line != null) return;
    onConfirm(reason, line);
  };
  const phone = shell.layout === 'phone';

  return (
    <View style={styles.panel} testID="enquiry.close">
      <View style={styles.panelHead}>
        <Text size={20} weight="bold" accessibilityRole="header">
          {W.closeAsLost}
        </Text>
        <Text size={15} weight="medium" style={styles.secondary}>
          {W.closeLine}
        </Text>
      </View>
      <View style={styles.reasons}>
        <Text size={15} weight="bold" accessibilityRole="header">
          {W.why}
        </Text>
        <Choices
          items={LOST_REASONS.map((key) => ({ key, title: W.reasons[key] }))}
          on={reason}
          onPick={setReason}
          testID="enquiry.close.reason"
        />
        {problems.reason != null && <FieldError message={problems.reason} />}
      </View>
      <Field label={W.anythingToAdd} pill={W.optional} error={problems.line}>
        <TextField
          accessibilityLabel={W.anythingToAdd}
          value={line}
          onChangeText={setLine}
          wrong={problems.line != null}
          testID="enquiry.close.line"
        />
      </Field>
      <Pair
        layout={phone ? 'phone' : 'portrait'}
        dismiss={
          <Pill
            label={W.keepOpen}
            kind="quiet"
            full={phone}
            height={tokens.sizeHitPhonePrimary}
            onPress={onKeep}
            testID="enquiry.close.keep"
          />
        }
        confirm={
          <Pill
            label={W.closeAsLost}
            kind="dangerQuiet"
            full={phone}
            height={tokens.sizeHitPhonePrimary}
            onPress={confirm}
            testID="enquiry.close.confirm"
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  secondary: { color: tokens.colorInkSecondary },
  lines: { lineHeight: 16 * 1.45 },
  stack: { gap: tokens.spaceMd },
  start: { flexDirection: 'row', alignItems: 'flex-start' },
  row: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceLg },
  banner: {
    gap: tokens.spaceSm,
    padding: tokens.spaceLg,
    borderRadius: tokens.radiusInset,
    borderWidth: 1,
    borderColor: tokens.colorInsetBorder,
    backgroundColor: tokens.colorInset,
  },
  bannerHead: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm },
  facts: { gap: tokens.spaceMd },
  factsWide: { flexDirection: 'row', flexWrap: 'wrap', rowGap: tokens.spaceMd },
  factWide: { width: '50%', paddingRight: tokens.spaceLg },
  note: {
    gap: tokens.spaceXs,
    paddingTop: tokens.spaceMd,
    borderTopWidth: 1,
    borderTopColor: tokens.colorBorder,
  },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: tokens.spaceXs },
  edited: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceXs },
  panel: {
    gap: tokens.spaceLg,
    paddingHorizontal: tokens.spaceXxl,
    paddingTop: tokens.spaceXl,
    paddingBottom: tokens.space4xl,
  },
  panelHead: { gap: tokens.spaceXs },
  reasons: { gap: tokens.spaceSm },
});
