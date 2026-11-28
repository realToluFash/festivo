import { useEffect, useId, useRef } from 'react';

import { Icon } from './SeatingGlyph.tsx';
import { initials } from './seating.ts';
import { useSeating } from './seatingContext.ts';
import {
  type Broken,
  EMPTY_DRAFT,
  type NoteDraft,
  type NoteKind,
  type NoteState,
  type Notes,
  NW,
  type SeatNote,
  adding,
  brokenNotes,
  kindWords,
  many,
  matching,
  nextId,
  notesOf,
  offered,
  otherIn,
  removing,
  replacing,
  say,
  seatOf,
  shortWords,
  stateOf,
  tablesWords,
  unnamedOf,
} from './seatingNotes.ts';
import type { Ui } from './seatingSeed.ts';
import { BackHead } from './SeatingPanel.tsx';
import { Mark, TextAction } from '../components/SettingsParts.tsx';
import './seatingNotes.css';

const SHOWN_GUESTS = 6;

function withNotes(ui: Ui, change: (notes: Notes) => Notes): Ui {
  return { ...ui, notes: change(ui.notes) };
}

function withDraft(ui: Ui, change: (draft: NoteDraft) => NoteDraft): Ui {
  return withNotes(ui, (notes) => ({
    ...notes,
    draft: change(notes.draft ?? EMPTY_DRAFT),
    said: null,
  }));
}

/** The notched tag no seat state uses: red for broken, and always with words, so colour never carries it alone. */
export function TagMark({ size = 16 }: { size?: 14 | 16 }) {
  return (
    <svg className="sn-tag-mark" width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path d="M1 8 5.5 2.5H15v11H5.5Z" />
      <circle cx="6.5" cy="8" r="1.6" />
    </svg>
  );
}

export function NotesButton({ name }: { name: string }) {
  const { ui, set } = useSeating();
  const n = notesOf(ui.notes.list, name).length;

  if (ui.readOnly) return null;
  return (
    <button
      type="button"
      className="sn-open"
      aria-label={many('openNotesFor', n, { name })}
      onClick={() =>
        set((now) =>
          withNotes(now, (notes) => ({ ...notes, guest: name, draft: null, said: null })),
        )
      }
    >
      {NW.openNotes}
      {n > 0 && <span className="sn-open-n">{n}</span>}
    </button>
  );
}

export function TraySwitch() {
  const { ui, set } = useSeating();
  const broken = brokenNotes(ui.plan, ui.notes.list).length;
  const without = ui.tray
    .filter((party) => party.reply === 'coming')
    .reduce((sum, party) => sum + (party.behind === true ? 0 : 1) + party.companions.length, 0);
  const tabs: ['without' | 'notes', string, number][] = [
    ['without', NW.without, without],
    ['notes', NW.notes, broken],
  ];

  if (ui.readOnly) return null;
  return (
    <div className="st-seg sn-switch" role="group" aria-label={NW.lists}>
      {tabs.map(([key, word, n]) => (
        <button
          key={key}
          type="button"
          aria-pressed={ui.notes.shown === key}
          className={ui.notes.shown === key ? 'st-seg-one is-on' : 'st-seg-one'}
          onClick={() => set((now) => withNotes(now, (notes) => ({ ...notes, shown: key })))}
        >
          <span id={key === 'without' ? 'st-without' : 'sn-notes-tab'}>{word}</span>
          <span className={key === 'notes' && n > 0 ? 'sn-count is-broken' : 'sn-count'}>
            {key === 'notes' && n > 0 && <TagMark size={14} />}
            {n}
          </span>
        </button>
      ))}
    </div>
  );
}

export function NotesList() {
  const { ui, set } = useSeating();
  const broken = brokenNotes(ui.plan, ui.notes.list);
  const show = (one: Broken) => {
    const first = one.tables[0];

    if (first == null) return;
    set((now) => ({
      ...now,
      chosen: one.tables.map((item) => item.id),
      camera: now.camera == null ? null : { ...now.camera, cx: first.x, cy: first.y },
    }));
    window.setTimeout(
      () =>
        document
          .querySelector<HTMLElement>(`[data-card="${first.id}"]`)
          ?.scrollIntoView({ block: 'nearest' }),
      0,
    );
  };

  if (ui.notes.list.length === 0)
    return (
      <div className="sn-none">
        <p className="st-strong">{NW.noNotes}</p>
        <p className="st-line">{NW.noNotesLine}</p>
      </div>
    );
  return (
    <div className="st-stack is-tight">
      <div className="st-tray-head">
        <h2 id="sn-broken">{many('brokenCount', broken.length)}</h2>
      </div>
      {broken.length === 0 ? (
        <div className="sn-none">
          <p className="sn-ok">
            <Mark kind="yes" />
            {NW.nothingBroken}
          </p>
          <p className="st-line">{NW.nothingBrokenLine}</p>
        </div>
      ) : (
        <ul className="st-rows" aria-labelledby="sn-broken">
          {broken.map((one) => {
            const on = one.tables.every((item) => ui.chosen.includes(item.id));

            return (
              <li key={one.note.id} className="st-party-line">
                <button
                  type="button"
                  className={on ? 'sn-entry is-on' : 'sn-entry'}
                  aria-pressed={on}
                  aria-label={`${one.words} ${say(NW.showTable, { table: tablesWords(one.tables) })}`}
                  onClick={() => show(one)}
                >
                  <span className="sn-entry-tag">
                    <TagMark />
                    {shortWords(one.note.kind)}
                  </span>
                  <span className="sn-entry-words">{one.words}</span>
                  <span className="st-row-line">{tablesWords(one.tables)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <p className="st-line">{many('allNotes', ui.notes.list.length)}</p>
    </div>
  );
}

function StateWord({ state }: { state: NoteState }) {
  if (state === 'broken')
    return (
      <span className="sn-state is-broken">
        <TagMark size={14} />
        {NW.broken}
      </span>
    );
  if (state === 'kept')
    return (
      <span className="sn-state is-kept">
        <Mark kind="yes" />
        {NW.kept}
      </span>
    );
  return (
    <span className="sn-state is-waiting">
      <Mark kind="waiting" />
      {NW.waiting}
    </span>
  );
}

function NoteRow({ note, self }: { note: SeatNote; self: string }) {
  const { ui, set } = useSeating();
  const other = otherIn(note, self);
  const { state, tables } = stateOf(ui.plan, note);
  const broken = brokenNotes(ui.plan, [note])[0];

  return (
    <li className="sn-note">
      <div className="sn-note-words">
        <span className="st-row-line">{kindWords(note.kind)}</span>
        <span className="st-row-name">{other}</span>
        <StateWord state={state} />
        {broken != null && <span className="sn-note-why">{broken.words}</span>}
        {state === 'kept' && <span className="st-row-line">{tablesWords(tables)}</span>}
      </div>
      <button
        type="button"
        className="desk-text is-red"
        aria-label={say(NW.removeFor, { name: other })}
        onClick={() =>
          set((now) =>
            withNotes(now, (notes) => ({
              ...notes,
              list: removing(notes.list, note.id),
              said: say(NW.removed, { kind: kindWords(note.kind), other }),
            })),
          )
        }
      >
        {NW.remove}
      </button>
    </li>
  );
}

function FieldError({ id, words }: { id: string; words: string | undefined }) {
  if (words == null) return null;
  return (
    <p id={id} className="st-field-error">
      <Icon name="alert" size={15} weight={2.2} />
      <span>{words}</span>
    </p>
  );
}

function Replacing({ draft, self }: { draft: NoteDraft; self: string }) {
  const { set } = useSeating();
  const titleId = useId();
  const replace = useRef<HTMLButtonElement>(null);
  const old = draft.asking;

  useEffect(() => replace.current?.focus(), []);
  if (old == null || draft.kind == null) return null;
  const kind = draft.kind;
  const other = otherIn(old, self);

  return (
    <div
      className="sn-ask"
      role="alertdialog"
      aria-labelledby={titleId}
      aria-describedby={`${titleId}-line`}
    >
      <p id={titleId} className="st-strong">
        {NW.replaceTitle}
      </p>
      <p id={`${titleId}-line`} className="st-line is-ink">
        {say(NW.replaceLine, {
          name: self,
          other,
          old: `${kindWords(old.kind)} ${other}`,
          new: `${kindWords(kind)} ${other}`,
        })}
      </p>
      <div className="st-pair">
        <button
          type="button"
          className="button"
          onClick={() =>
            set((now) =>
              withNotes(now, (notes) => ({
                ...notes,
                draft: null,
                said: say(NW.keptOld, { kind: kindWords(old.kind), other }),
              })),
            )
          }
        >
          {NW.cancel}
        </button>
        <button
          ref={replace}
          type="button"
          className="button button-primary"
          onClick={() =>
            set((now) =>
              withNotes(now, (notes) => ({
                ...notes,
                list: replacing(notes.list, old, kind, self),
                draft: null,
                said: say(NW.replaced, { kind: kindWords(kind), other }),
              })),
            )
          }
        >
          {NW.replace}
        </button>
      </div>
    </div>
  );
}

function AddNote({ self, draft }: { self: string; draft: NoteDraft }) {
  const { ui, set } = useSeating();
  const id = useId();
  const names = offered(ui.plan, ui.tray, self, unnamedOf);
  const found = matching(names, draft.search);
  const shown = found.slice(0, SHOWN_GUESTS);
  const nobody = draft.search.trim() !== '' && found.length === 0;
  const kinds: NoteKind[] = ['together', 'apart'];
  const add = () =>
    set((now) =>
      withNotes(now, (notes) => {
        const d = notes.draft ?? EMPTY_DRAFT;
        const errors = {
          ...(d.kind == null ? { kind: NW.chooseKind } : {}),
          ...(d.guest == null ? { guest: NW.chooseGuest } : {}),
        };

        if (d.kind == null || d.guest == null) return { ...notes, draft: { ...d, errors } };
        const result = adding(notes.list, self, d.guest, d.kind, nextId(notes.list));

        if (result.kind === 'same')
          return {
            ...notes,
            draft: { ...d, errors: { guest: say(NW.same, { name: self, other: d.guest }) } },
          };
        if (result.kind === 'replace') return { ...notes, draft: { ...d, asking: result.old } };
        return {
          ...notes,
          list: result.list,
          draft: null,
          said: say(NW.added, { kind: kindWords(d.kind), other: d.guest }),
        };
      }),
    );

  if (draft.asking != null) return <Replacing draft={draft} self={self} />;
  return (
    <div className="sn-add">
      <h3 className="sn-h">{NW.addNote}</h3>
      <fieldset
        className="sn-kinds"
        aria-describedby={draft.errors.kind == null ? undefined : `${id}-kind`}
      >
        <legend className="st-label">{NW.kind}</legend>
        {kinds.map((kind) => (
          <label key={kind} className="st-radio">
            <input
              type="radio"
              name={`${id}-kinds`}
              checked={draft.kind === kind}
              onChange={() =>
                set((now) =>
                  withDraft(now, (d) => ({ ...d, kind, errors: { ...d.errors, kind: undefined } })),
                )
              }
            />
            {kindWords(kind)}
          </label>
        ))}
        <FieldError id={`${id}-kind`} words={draft.errors.kind} />
      </fieldset>
      <div className="sn-guests">
        <label className="st-label" htmlFor={`${id}-search`}>
          {NW.guest}
        </label>
        <div className={draft.errors.guest == null ? 'st-search' : 'st-search is-wrong'}>
          <Icon name="search" size={16} />
          <input
            id={`${id}-search`}
            type="search"
            placeholder={NW.searchGuests}
            value={draft.search}
            aria-invalid={draft.errors.guest != null}
            aria-describedby={draft.errors.guest == null ? undefined : `${id}-guest`}
            onChange={(event) => {
              const search = event.target.value;

              set((now) =>
                withDraft(now, (d) => ({
                  ...d,
                  search,
                  errors: { ...d.errors, guest: undefined },
                })),
              );
            }}
          />
        </div>
        <FieldError id={`${id}-guest`} words={draft.errors.guest} />
        {nobody ? (
          <div className="sn-none" role="status">
            <p className="st-strong">{say(NW.noMatch, { q: draft.search.trim() })}</p>
            <p className="st-line">{NW.noMatchLine}</p>
          </div>
        ) : (
          <>
            <ul className="sn-picks" aria-label={NW.guest}>
              {shown.map((name) => (
                <li key={name}>
                  <button
                    type="button"
                    className={draft.guest === name ? 'st-party is-seat is-on' : 'st-party is-seat'}
                    aria-pressed={draft.guest === name}
                    onClick={() =>
                      set((now) =>
                        withDraft(now, (d) => ({
                          ...d,
                          guest: d.guest === name ? null : name,
                          errors: { ...d.errors, guest: undefined },
                        })),
                      )
                    }
                  >
                    <span className="st-avatar sn-avatar" aria-hidden="true">
                      {initials(name)}
                    </span>
                    <span className="st-row-words">
                      <span className="st-row-name">{name}</span>
                      <span className="st-row-line">
                        {seatOf(ui.plan, name)?.name ?? NW.noSeat}
                      </span>
                    </span>
                    {draft.guest === name && <Mark kind="yes" />}
                  </button>
                </li>
              ))}
            </ul>
            {found.length > shown.length && (
              <p className="st-line">{many('more', found.length - shown.length)}</p>
            )}
          </>
        )}
      </div>
      <div className="st-pair">
        <button
          type="button"
          className="button"
          onClick={() => set((now) => withNotes(now, (notes) => ({ ...notes, draft: null })))}
        >
          {NW.cancel}
        </button>
        <button type="button" className="button button-primary" onClick={add}>
          {NW.add}
        </button>
      </div>
    </div>
  );
}

export function GuestNotes({ name }: { name: string }) {
  const { ui, set } = useSeating();
  const mine = notesOf(ui.notes.list, name);
  const seat = seatOf(ui.plan, name);
  const draft = ui.notes.draft;

  return (
    <div className="st-stack">
      <BackHead
        title={name}
        line={seat == null ? NW.noSeat : say(NW.atTable, { table: seat.name })}
        onClose={() =>
          set((now) =>
            withNotes(now, (notes) => ({ ...notes, guest: null, draft: null, said: null })),
          )
        }
      />
      <p className="sn-private">{NW.private}</p>
      {ui.notes.said != null && (
        <p className="st-added" role="status">
          <Mark kind="yes" />
          {ui.notes.said}
        </p>
      )}
      <div className="st-tray-head">
        <h3 className="sn-h" id="sn-mine">
          {NW.notes}
        </h3>
        <span className="st-tray-count">{mine.length}</span>
      </div>
      {mine.length === 0 ? (
        <p className="st-line">{say(NW.noGuestNotes, { name })}</p>
      ) : (
        <ul className="sn-notes" aria-labelledby="sn-mine">
          {mine.map((note) => (
            <NoteRow key={note.id} note={note} self={name} />
          ))}
        </ul>
      )}
      {draft == null ? (
        <div className="st-acts">
          <TextAction
            label={NW.addNote}
            before="plus"
            onClick={() =>
              set((now) =>
                withNotes(now, (notes) => ({ ...notes, draft: EMPTY_DRAFT, said: null })),
              )
            }
          />
        </div>
      ) : (
        <AddNote self={name} draft={draft} />
      )}
    </div>
  );
}

/** The Tables card's line for each note broken at that table, in full words. */
export function CardNotes({ broken }: { broken: readonly Broken[] }) {
  if (broken.length === 0) return null;
  return (
    <ul className="sn-card-notes">
      {broken.map((one) => (
        <li key={one.note.id} className="sn-card-note">
          <TagMark size={14} />
          <span>{one.words}</span>
        </li>
      ))}
    </ul>
  );
}
