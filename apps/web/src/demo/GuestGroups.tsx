import { type FormEvent, type KeyboardEvent, useEffect, useId, useRef, useState } from 'react';

import { Glyph } from '../components/Glyph.tsx';
import { Ask, RowWords } from '../components/SettingsParts.tsx';
import { ColumnHead, Verb } from './GuestForms.tsx';
import { OkLine } from './GuestsParts.tsx';
import {
  GGW,
  type GroupFieldStart,
  type GroupFilter,
  type GroupPick,
  type GroupsStart,
  type GuestGroup,
  NO_GROUP,
  groupCounts,
  groupLine,
  groupNameLength,
  groupOptions,
  groupProblem,
  sameGroup,
  sortedGroups,
} from './guestGroups.ts';
import type { Guest } from './guests.ts';
import { GW } from './guestsWords.ts';
import './guestGroups.css';

const BLUR_MS = 120;

/** sc-3775's chips under the search: one per group, A to Z, then No group while anyone has none; one pressed at a time. */
export function GroupChips({
  groups,
  list,
  filter,
  onFilter,
}: {
  groups: readonly GuestGroup[];
  list: readonly Guest[];
  filter: GroupFilter | null;
  onFilter: (next: GroupFilter | null) => void;
}) {
  if (groups.length === 0) return null;
  const chips = [
    ...sortedGroups(groups).map((one) => ({ key: one.id, word: one.name })),
    ...(list.some((one) => one.group == null) ? [{ key: NO_GROUP, word: GGW.noGroup }] : []),
  ];

  return (
    <div className="gs-chips gs-filters gg-chips" role="group" aria-label={GGW.chips}>
      {chips.map((chip) => {
        const on = chip.key === filter;

        return (
          <button
            key={chip.key}
            type="button"
            className={on ? 'gs-chip is-on' : 'gs-chip'}
            aria-pressed={on}
            data-focus={`group-chip:${chip.key}`}
            onClick={() => onFilter(on ? null : chip.key)}
          >
            {on && <Glyph name="tick" size={16} weight={2.6} />}
            {chip.word}
          </button>
        );
      })}
    </div>
  );
}

function nameOf(groups: readonly GuestGroup[], pick: GroupPick): string {
  if (pick == null) return '';
  if ('name' in pick) return pick.name;

  return groups.find((one) => one.id === pick.id)?.name ?? '';
}

/** What typing means before anything is chosen: nothing, a group already there (case and accents aside), or a new name made on save. */
function pickOf(groups: readonly GuestGroup[], typed: string): GroupPick {
  if (typed.trim() === '') return null;
  const found = sameGroup(groups, typed);

  return found == null ? { name: typed.trim() } : { id: found.id };
}

/** The guest form's Group: an accessible combobox (WAI-ARIA 1.2, list autocomplete); choose a group or Create one, refused beside the field. */
export function GroupField({
  groups,
  value,
  error,
  start = {},
  onChange,
}: {
  groups: readonly GuestGroup[];
  value: GroupPick | undefined;
  error: string | undefined;
  start?: GroupFieldStart | undefined;
  onChange: (pick: GroupPick) => void;
}) {
  const id = useId();
  const [typed, setTyped] = useState(() => start.typed ?? nameOf(groups, value ?? null));
  const [open, setOpen] = useState(start.open ?? false);
  const [active, setActive] = useState(0);
  const [refused, setRefused] = useState<string | null>(() =>
    start.refused == null ? null : groupLine(groups, typed, start.refused, 'form'),
  );
  const blurred = useRef<number | undefined>(undefined);
  const options = groupOptions(groups, typed);
  const rows: ({ kind: 'group'; group: GuestGroup } | { kind: 'create'; name: string })[] = [
    ...options.groups.map((group) => ({ kind: 'group' as const, group })),
    ...(options.create == null ? [] : [{ kind: 'create' as const, name: options.create }]),
  ];
  const showList = open && rows.length > 0;
  const shown = refused ?? error;
  const fresh = value != null && 'name' in value ? value.name : null;
  const help = fresh != null && shown == null ? GGW.madeOnSave(fresh) : GGW.chooserHint;
  const told = [`${id}-help`, shown == null ? null : `${id}-error`].filter(Boolean).join(' ');

  useEffect(() => () => window.clearTimeout(blurred.current), []);

  function type(next: string): void {
    setTyped(next);
    setOpen(true);
    setActive(0);
    setRefused(null);
    onChange(pickOf(groups, next));
  }

  function choose(row: (typeof rows)[number] | undefined): void {
    if (row == null) return;
    if (row.kind === 'group') {
      setTyped(row.group.name);
      onChange({ id: row.group.id });
      setOpen(false);
      return;
    }
    const problem = groupProblem(groups, row.name);

    setOpen(false);
    if (problem != null) {
      setRefused(groupLine(groups, row.name, problem, 'form'));
      return;
    }
    setTyped(row.name);
    onChange({ name: row.name });
  }

  function keys(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      const step = event.key === 'ArrowDown' ? 1 : -1;

      setActive((now) => Math.min(Math.max(0, now + step), Math.max(0, rows.length - 1)));
    } else if (event.key === 'Enter' && showList) {
      event.preventDefault();
      choose(rows[active]);
    } else if (event.key === 'Escape' && showList) {
      event.preventDefault();
      setOpen(false);
    }
  }

  return (
    <div className="desk-field gg-field">
      <label htmlFor={id} className="desk-label gs-label">
        {GGW.group}
        <span className="gs-optional">{GW.optional}</span>
      </label>
      <div className={shown == null ? 'desk-box gg-combo' : 'desk-box gg-combo is-wrong'}>
        <input
          id={id}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showList}
          aria-controls={`${id}-list`}
          aria-activedescendant={showList ? `${id}-option-${active}` : undefined}
          aria-invalid={shown != null}
          aria-describedby={told}
          autoComplete="off"
          spellCheck={false}
          placeholder={GGW.placeholder}
          value={typed}
          data-focus="group"
          onFocus={() => window.clearTimeout(blurred.current)}
          onClick={() => setOpen(true)}
          onBlur={() => {
            blurred.current = window.setTimeout(() => setOpen(false), BLUR_MS);
          }}
          onChange={(event) => type(event.target.value)}
          onKeyDown={keys}
        />
        {typed !== '' && (
          <button
            type="button"
            className="ev-clear"
            aria-label={GGW.clearGroup}
            onClick={() => {
              type('');
              setOpen(false);
              document.getElementById(id)?.focus();
            }}
          >
            <span className="ev-clear-disc" aria-hidden="true">
              <Glyph name="clear" size={12} weight={3} />
            </span>
          </button>
        )}
      </div>
      {showList && (
        <ul id={`${id}-list`} role="listbox" aria-label={GGW.groupList} className="gg-options">
          {rows.map((row, index) => (
            <li
              key={row.kind === 'group' ? row.group.id : 'create'}
              id={`${id}-option-${index}`}
              role="option"
              aria-selected={index === active}
              className={[
                'gg-option',
                index === active && 'is-active',
                row.kind === 'create' && 'is-create',
              ]
                .filter(Boolean)
                .join(' ')}
              onPointerDown={(pointer) => pointer.preventDefault()}
              onMouseEnter={() => setActive(index)}
              onClick={() => choose(row)}
              onKeyDown={(key) => {
                if (key.key === 'Enter') choose(row);
              }}
            >
              {row.kind === 'create' && <Glyph name="plus" size={17} weight={2.4} />}
              {row.kind === 'group' ? row.group.name : GGW.createNamed(row.name)}
            </li>
          ))}
        </ul>
      )}
      <p id={`${id}-status`} role="status" className="visually-hidden">
        {showList ? GGW.options(options.groups.length) : ''}
      </p>
      {shown != null && (
        <p id={`${id}-error`} className="desk-error">
          <Glyph name="alert" size={15} weight={2.2} />
          {shown}
        </p>
      )}
      <p id={`${id}-help`} className="desk-help">
        {help}
      </p>
    </div>
  );
}

/** A name field with its counter and refusal, for New group and Rename: checked on press, then again as it is typed. */
function NameBox({
  label,
  typed,
  error,
  focusKey,
  placeholder,
  onType,
  onEscape,
}: {
  label: string;
  typed: string;
  error: string | null;
  focusKey: string;
  placeholder?: string;
  onType: (next: string) => void;
  onEscape?: () => void;
}) {
  const id = useId();
  const told = [`${id}-count`, error == null ? null : `${id}-error`].filter(Boolean).join(' ');

  return (
    <div className="desk-field gg-name">
      <label htmlFor={id} className="desk-label gs-label">
        {label}
      </label>
      <div className={error == null ? 'desk-box' : 'desk-box is-wrong'}>
        <input
          id={id}
          type="text"
          value={typed}
          autoComplete="off"
          spellCheck={false}
          placeholder={placeholder}
          aria-invalid={error != null}
          aria-describedby={told}
          data-focus={focusKey}
          onChange={(event) => onType(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape' && onEscape != null) {
              event.preventDefault();
              onEscape();
            }
          }}
        />
      </div>
      {error != null && (
        <p id={`${id}-error`} className="desk-error">
          <Glyph name="alert" size={15} weight={2.2} />
          {error}
        </p>
      )}
      <p id={`${id}-count`} className="desk-help">
        {GGW.ofMost(groupNameLength(typed))}
      </p>
    </div>
  );
}

/** Groups (sc-3775), in the guest's column at a desk: New group at the top for guests.manage, each group with sc-99's count, Rename in place and Delete asked first; No group last, so the counts add up. */
export function GroupsColumn({
  groups,
  list,
  manages,
  start,
  focus,
  onMake,
  onRename,
  onDelete,
  onDone,
}: {
  groups: readonly GuestGroup[];
  list: readonly Guest[];
  manages: boolean;
  start: GroupsStart;
  focus: (...keys: string[]) => void;
  onMake: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onDone: () => void;
}) {
  const [typed, setTyped] = useState(start.typed ?? '');
  const [tried, setTried] = useState(start.tried ?? false);
  const [renaming, setRenaming] = useState(start.renaming ?? null);
  const [deleting, setDeleting] = useState<string | null>(start.deleting ?? null);
  const [said, setSaid] = useState<string | null>(start.said ?? null);
  const counts = groupCounts(list, groups);
  const problem = tried ? groupProblem(groups, typed) : null;
  const renameProblem =
    renaming?.tried === true ? groupProblem(groups, renaming.typed, renaming.id) : null;
  const doomed = counts.rows.find((row) => row.group?.id === deleting);

  function make(event?: FormEvent): void {
    event?.preventDefault();
    const found = groupProblem(groups, typed);

    if (found != null) {
      setTried(true);
      focus('new-group');
      return;
    }
    onMake(typed);
    setSaid(GGW.created(typed.trim()));
    setTyped('');
    setTried(false);
    focus('new-group');
  }

  function saveRename(event?: FormEvent): void {
    event?.preventDefault();
    if (renaming == null) return;
    const was = groups.find((one) => one.id === renaming.id);

    if (was != null && was.name === renaming.typed.trim()) {
      setRenaming(null);
      focus(`rename:${renaming.id}`);
      return;
    }
    if (groupProblem(groups, renaming.typed, renaming.id) != null) {
      setRenaming({ ...renaming, tried: true });
      focus('rename-field');
      return;
    }
    onRename(renaming.id, renaming.typed);
    setSaid(GGW.renamed(renaming.typed.trim()));
    setRenaming(null);
    focus(`rename:${renaming.id}`);
  }

  function cancelRename(): void {
    if (renaming == null) return;
    setRenaming(null);
    focus(`rename:${renaming.id}`);
  }

  return (
    <div className="gs-form gg">
      <ColumnHead title={GGW.groupsCount(groups.length)}>
        <Verb label={GGW.done} onClick={onDone} />
      </ColumnHead>
      {said != null && <OkLine>{said}</OkLine>}
      {manages ? (
        <form className="gg-new" noValidate onSubmit={make}>
          <NameBox
            label={GGW.newGroup}
            typed={typed}
            error={problem == null ? null : groupLine(groups, typed, problem)}
            focusKey="new-group"
            placeholder={GGW.placeholder}
            onType={setTyped}
          />
          <button type="submit" className="gs-pill is-primary gg-create">
            {GGW.createGroup}
          </button>
        </form>
      ) : (
        <p className="desk-line gg-read-only">{GGW.readOnly}</p>
      )}
      {groups.length === 0 ? (
        <div className="gs-none gg-none">
          <h3>{GGW.noneYet}</h3>
          <p className="desk-line">{manages ? GGW.noneYetLine : GGW.noneYetViewer}</p>
        </div>
      ) : (
        <ul className="desk-rows gg-rows" aria-label={GGW.groups}>
          {counts.rows.map((row) => {
            const group = row.group;

            if (group == null) return null;
            if (renaming?.id === group.id)
              return (
                <li key={group.id} className="gg-row is-renaming">
                  <form className="gg-rename" noValidate onSubmit={saveRename}>
                    <NameBox
                      label={GGW.renameLabel(group.name)}
                      typed={renaming.typed}
                      error={
                        renameProblem == null
                          ? null
                          : groupLine(groups, renaming.typed, renameProblem)
                      }
                      focusKey="rename-field"
                      onType={(next) => setRenaming({ ...renaming, typed: next })}
                      onEscape={cancelRename}
                    />
                    <div className="gg-row-acts">
                      <button type="button" className="desk-text" onClick={cancelRename}>
                        {GGW.cancel}
                      </button>
                      <button type="submit" className="gs-pill is-primary">
                        {GGW.save}
                      </button>
                    </div>
                  </form>
                </li>
              );

            return (
              <li key={group.id} className="gg-row">
                <RowWords
                  title={group.name}
                  lines={[GGW.peopleLine(row.people, row.guests, row.companions)]}
                />
                {manages && (
                  <div className="gg-row-acts">
                    <button
                      type="button"
                      className="desk-text"
                      aria-label={GGW.renameNamed(group.name)}
                      data-focus={`rename:${group.id}`}
                      onClick={() => {
                        setRenaming({ id: group.id, typed: group.name });
                        focus('rename-field');
                      }}
                    >
                      {GGW.rename}
                    </button>
                    <button
                      type="button"
                      className="desk-text is-red"
                      aria-label={GGW.deleteNamed(group.name)}
                      data-focus={`delete:${group.id}`}
                      onClick={() => setDeleting(group.id)}
                    >
                      {GGW.delete}
                    </button>
                  </div>
                )}
              </li>
            );
          })}
          <li className="gg-row is-none">
            <RowWords
              title={GGW.noGroup}
              lines={[
                GGW.peopleLine(counts.none.people, counts.none.guests, counts.none.companions),
              ]}
            />
          </li>
        </ul>
      )}
      {groups.length > 0 && <p className="desk-help gg-adds-up">{GGW.addsUp(counts.total)}</p>}
      {doomed?.group != null && (
        <Ask
          title={GGW.deleteTitle(doomed.group.name)}
          line={GGW.deleteLine(doomed.guests)}
          keep={GGW.cancel}
          go={GGW.deleteGo}
          onKeep={() => {
            const at = deleting;

            setDeleting(null);
            focus(`delete:${at ?? ''}`);
          }}
          onGo={() => {
            const name = doomed.group?.name ?? '';

            setDeleting(null);
            onDelete(doomed.group?.id ?? '');
            setSaid(GGW.deleted(name));
            focus(manages ? 'new-group' : 'form-heading', 'form-heading');
          }}
        />
      )}
    </div>
  );
}
