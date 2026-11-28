import { formatPhone, formattingLocale } from '@soirely/domain';
import { getLocales } from 'expo-localization';
import { type Href, router } from 'expo-router';
import { type ReactNode, useRef, useState } from 'react';
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
  enquiryOf,
  personOf,
} from './EnquiriesModel.ts';
import { W } from './EnquiriesWords.ts';
import { EnquiryForm } from './EnquiryForm.tsx';
import {
  type PageState,
  type PageStart,
  noteWhen,
  notesNewestFirst,
  pageStartOf,
  visibleEnquiry,
} from './EnquiryPageModel.ts';
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
import { nextFor } from './ConsultationsModel.ts';
import {
  DeleteFoot,
  DeleteSheet,
  ErasedConsultations,
  ErasedStatus,
  WarningNote,
  WonNote,
} from './ErasedParts.tsx';
import {
  type Asking,
  ERASE_WORDS as E,
  type ErasePageState,
  type ErasedEnquiry,
  erasePageStart,
  extraOf,
  landingHref,
  mayDelete,
  monthWords,
  shortDay,
  warnsOn,
} from './EraseModel.ts';

const DELETE_MS = 700;

const foundOf = (id: string | undefined): Enquiry | null => madeOf(id) ?? extraOf(id);

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

function startFor(
  state: PageState,
  erase: ErasePageState | null,
  id: string | undefined,
  as: string | undefined,
): PageStart & { asking: Asking; consultations: ErasePageStart['consultations'] } {
  if (erase == null)
    return { ...pageStartOf(state, id, as, foundOf), asking: 'none', consultations: [] };
  const begin = erasePageStart(erase);
  const found = enquiryOf(id) ?? foundOf(id);

  return {
    viewer: begin.viewer,
    enquiry: visibleEnquiry(found == null ? null : { ...found, ...begin.patch }, begin.viewer),
    editing: null,
    closing: null,
    failed: false,
    asking: begin.asking,
    consultations: begin.consultations,
  };
}

type ErasePageStart = ReturnType<typeof erasePageStart>;

/** An enquiry's page (sc-31226): how to reach them, the event, who has it, the notes, and Close as lost or Reopen; sc-31235's erased page, warning and Delete enquiry. */
export function EnquiryPage({
  id,
  state,
  erase = null,
  as,
  from,
  backTo,
}: {
  id: string | undefined;
  state: PageState;
  erase?: ErasePageState | null;
  as: string | undefined;
  from?: string | undefined;
  backTo?: string | undefined;
}) {
  const { t } = useTranslation();
  const shell = useShell();
  const locale = formattingLocale('en', getLocales()[0]?.languageTag);
  const [start] = useState(() => startFor(state, erase, id, as));
  const viewer = start.viewer;
  const [enquiry, setEnquiry] = useState<ErasedEnquiry | null>(start.enquiry);
  const [failed, setFailed] = useState(start.failed);
  const [asking, setAsking] = useState<Asking>(start.asking);
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

  const remove = () => {
    setAsking('deleting');
    setTimeout(() => router.dismissTo(landingHref(enquiry.id, from, backTo) as Href), DELETE_MS);
  };
  const sheet = asking !== 'none' && (
    <DeleteSheet
      asking={asking}
      body={enquiry.erased == null ? E.deleteBody(enquiry.client) : E.deleteBodyErased}
      onKeep={() => setAsking('none')}
      onDelete={remove}
      onCloseRace={() => {
        setEnquiry({ ...enquiry, tab: 'won' });
        setAsking('none');
      }}
    />
  );
  const deletes = mayDelete(enquiry, viewer);
  const deleteFoot = deletes && (
    <DeleteFoot erased={enquiry.erased != null} onPress={() => setAsking('confirm')} />
  );

  if (enquiry.erased != null)
    return (
      <ErasedPage
        enquiry={enquiry}
        viewer={viewer}
        wide={wide}
        locale={locale}
        top={top}
        consultations={start.consultations}
        foot={deleteFoot}
        overlay={sheet}
      />
    );

  const lost = enquiry.lost;
  const won = enquiry.tab === 'won';
  const status = won ? E.won : lost == null ? W.open : `${W.lost} · ${W.reasons[lost.reason]}`;
  const warnDay = warnsOn(enquiry, nextFor(enquiry));
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
      {sheet}
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
        under={won ? <WonLine /> : <StatusLine lost={lost != null} words={status} />}
      />
      {warnDay != null && <WarningNote words={E.warning(shortDay(warnDay, locale))} />}
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

      {lost == null && !won && (
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
      {won && viewer.role !== 'member' && <WonNote />}
      {deleteFoot}
    </EnquiriesFrame>
  );
}

function WonLine() {
  return (
    <View style={styles.won} accessible accessibilityLabel={E.won} testID="enquiry.status">
      <Glyph name="tick" size={14} ink={tokens.colorInk} weight={2.8} />
      <Text size={16} weight="semibold" accessible={false}>
        {E.won}
      </Text>
    </View>
  );
}

/** What the clock kept, read only: no way to reach them, no notes, no Edit, no Where, no Reopen. */
function ErasedPage({
  enquiry,
  viewer,
  wide,
  locale,
  top,
  consultations,
  foot,
  overlay,
}: {
  enquiry: ErasedEnquiry;
  viewer: Person;
  wide: boolean;
  locale: string;
  top: ReactNode;
  consultations: ErasePageStart['consultations'];
  foot: ReactNode;
  overlay: ReactNode;
}) {
  const { t } = useTranslation();
  const shell = useShell();
  const erased = enquiry.erased!;
  const status = erased.reason == null ? W.lost : `${W.lost} · ${W.reasons[erased.reason]}`;
  const assigned = personOf(enquiry.assignedTo);
  const facts: [string, string | null][] = [
    [W.eventType, enquiry.type == null ? null : t(`eventTypes.${enquiry.type}`)],
    [W.date, erased.month == null ? null : monthWords(erased.month, locale)],
    [W.guests, enquiry.guests == null ? null : enquiry.guests.toLocaleString(locale)],
    [W.budget, enquiry.budget == null ? null : moneyWords(enquiry.budget, locale)],
    [W.foundVia, enquiry.foundVia == null ? null : W.foundVias[enquiry.foundVia]],
  ];

  return (
    <EnquiriesFrame band={null} overlay={overlay}>
      {top}
      <ListTop
        kind={kindOf(shell.layout)}
        title={E.erasedEnquiry}
        pill={<OrgPill />}
        bell={<Bell tell={shell.tell} />}
        under={<StatusLine lost words={status} />}
      />
      <ErasedStatus date={shortDay(erased.on, locale)} />
      <PagePart wide={wide} title={W.aboutEvent} testID="enquiry.about">
        <View style={[styles.facts, wide && styles.factsWide]}>
          {facts.map(([label, value]) => (
            <View key={label} style={wide ? styles.factWide : undefined}>
              <Fact label={label} value={value ?? W.notGiven} given={value != null} />
            </View>
          ))}
        </View>
      </PagePart>
      <PagePart wide={wide} title={W.assignedTo} testID="enquiry.assignedTo">
        <Text size={16} weight="medium">
          {assigned == null
            ? W.notAssigned
            : assigned.id === viewer.id
              ? W.you(assigned.name)
              : assigned.name}
        </Text>
      </PagePart>
      <PagePart wide={wide} title={E.dates} testID="enquiry.dates">
        <View style={[styles.facts, wide && styles.factsWide]}>
          <View style={wide ? styles.factWide : undefined}>
            <Fact label={E.created} value={shortDay(erased.createdAt, locale)} given />
          </View>
          <View style={wide ? styles.factWide : undefined}>
            <Fact label={E.closedAsLost} value={shortDay(erased.closedAt, locale)} given />
          </View>
        </View>
      </PagePart>
      <ErasedConsultations wide={wide} list={consultations} locale={locale} />
      {foot}
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
  won: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm },
  panel: {
    gap: tokens.spaceLg,
    paddingHorizontal: tokens.spaceXxl,
    paddingTop: tokens.spaceXl,
    paddingBottom: tokens.space4xl,
  },
  panelHead: { gap: tokens.spaceXs },
  reasons: { gap: tokens.spaceSm },
});
