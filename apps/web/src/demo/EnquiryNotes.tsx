import { type RefObject, useEffect, useId, useRef, useState } from 'react';

import { Glyph } from '../components/Glyph.tsx';
import { TextAction } from '../components/SettingsParts.tsx';
import { dateLocale } from '../i18n/index.ts';
import { NOW, type Note, type Person, changedWords, personOf } from './enquiries.ts';
import { lengthOf } from './enquiryForm.ts';
import { noteProblem } from './enquiryPage.ts';
import { FORM_WORDS as F, MIND_MOST, PAGE_WORDS as P } from './enquiryWords.ts';

const COUNT_FROM = 4500;

/** Notes newest first; only a note's author has Edit on it. */
export function Notes({
  notes,
  viewer,
  editingOwn,
  headingRef,
  onNotes,
}: {
  notes: readonly Note[];
  viewer: Person;
  editingOwn: boolean;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onNotes: (notes: Note[]) => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState('');
  const [draftError, setDraftError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(() =>
    editingOwn ? (notes.find((one) => one.author === viewer.id)?.id ?? null) : null,
  );
  const box = useRef<HTMLTextAreaElement>(null);
  const locale = dateLocale();

  function add(): void {
    const problem = noteProblem(draft);
    setDraftError(problem);
    if (problem != null) {
      box.current?.focus();
      return;
    }
    onNotes([
      { id: `n${Date.now()}`, author: viewer.id, at: NOW, text: draft.trim(), edited: false },
      ...notes,
    ]);
    setDraft('');
  }

  return (
    <section className="desk-block enq-card" aria-labelledby={`${id}-head`}>
      <div className="desk-head">
        <h2 id={`${id}-head`} ref={headingRef} tabIndex={-1}>
          {P.notes(notes.length)}
        </h2>
      </div>
      <div className="enq-add">
        <NoteBox
          id={`${id}-add`}
          label={P.addNote}
          value={draft}
          error={draftError}
          areaRef={box}
          onChange={(text) => {
            setDraft(text);
            if (draftError != null) setDraftError(noteProblem(text));
          }}
        />
        <button type="button" className="button enq-add-button" onClick={add}>
          {P.addNoteButton}
        </button>
      </div>
      {notes.length > 0 && (
        <ul className="enq-notes">
          {notes.map((note) => (
            <NoteRow
              key={note.id}
              note={note}
              mine={note.author === viewer.id}
              editing={editing === note.id}
              locale={locale}
              onEdit={() => setEditing(note.id)}
              onDone={(text) => {
                setEditing(null);
                if (text != null && text !== note.text)
                  onNotes(
                    notes.map((one) => (one.id === note.id ? { ...one, text, edited: true } : one)),
                  );
              }}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function NoteRow({
  note,
  mine,
  editing,
  locale,
  onEdit,
  onDone,
}: {
  note: Note;
  mine: boolean;
  editing: boolean;
  locale: string;
  onEdit: () => void;
  onDone: (text: string | null) => void;
}) {
  const id = useId();
  const [text, setText] = useState(note.text);
  const [error, setError] = useState<string | null>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const row = useRef<HTMLLIElement>(null);
  const was = useRef(editing);

  useEffect(() => {
    if (editing) area.current?.focus();
    else if (was.current) row.current?.querySelector<HTMLButtonElement>('button')?.focus();
    was.current = editing;
  }, [editing]);

  const by = `${personOf(note.author)?.name ?? ''} · ${changedWords(note.at, NOW, locale)}`;

  if (editing)
    return (
      <li ref={row} className="enq-note is-editing">
        <NoteBox
          id={`${id}-edit`}
          label={P.editNoteLabel}
          unseen
          value={text}
          error={error}
          areaRef={area}
          onChange={(next) => {
            setText(next);
            if (error != null) setError(noteProblem(next));
          }}
        />
        <div className="enq-note-actions">
          <button
            type="button"
            className="button button-primary"
            onClick={() => {
              const problem = noteProblem(text);
              setError(problem);
              if (problem != null) area.current?.focus();
              else onDone(text.trim());
            }}
          >
            {P.saveNote}
          </button>
          <TextAction
            label={P.cancel}
            onClick={() => {
              setText(note.text);
              setError(null);
              onDone(null);
            }}
          />
        </div>
      </li>
    );

  return (
    <li ref={row} className="enq-note">
      <p className="enq-note-text">{note.text}</p>
      <p className="enq-note-by">
        {by}
        {note.edited && (
          <span className="enq-edited">
            {' · '}
            <Glyph name="pen" size={13} weight={2.3} />
            {P.edited}
          </span>
        )}
      </p>
      {mine && <TextAction label={P.editNote} onClick={onEdit} />}
    </li>
  );
}

function NoteBox({
  id,
  label,
  unseen = false,
  value,
  error,
  areaRef,
  onChange,
}: {
  id: string;
  label: string;
  unseen?: boolean;
  value: string;
  error: string | null;
  areaRef: RefObject<HTMLTextAreaElement | null>;
  onChange: (value: string) => void;
}) {
  const length = lengthOf(value);
  const counting = length >= COUNT_FROM;

  return (
    <div className="desk-field">
      <label htmlFor={id} className={unseen ? 'desk-unseen' : 'desk-label'}>
        {label}
      </label>
      <div className={error == null ? 'desk-box ev-note-box' : 'desk-box ev-note-box is-wrong'}>
        <textarea
          ref={areaRef}
          id={id}
          rows={3}
          value={value}
          aria-invalid={error != null}
          aria-describedby={
            [error == null ? null : `${id}-error`, counting ? `${id}-count` : null]
              .filter(Boolean)
              .join(' ') || undefined
          }
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
      {error != null && (
        <p id={`${id}-error`} className="desk-error">
          <Glyph name="alert" size={15} weight={2.2} />
          {error}
        </p>
      )}
      {counting && (
        <p id={`${id}-count`} className="desk-help">
          {F.counter(length, MIND_MOST)}
        </p>
      )}
    </div>
  );
}
