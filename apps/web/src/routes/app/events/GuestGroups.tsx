import {
  GUEST_GROUP_NAME_MAXIMUM,
  type GroupChoice,
  type GuestCounts,
  type GuestGroup,
  type GuestList,
} from '@soirely/api-client';
import { type FormEvent, type KeyboardEvent, useEffect, useId, useRef, useState } from 'react';
import { type TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

import { api } from '../../../api.ts';
import { Glyph } from '../../../components/Glyph.tsx';
import { Ask, RowWords } from '../../../components/SettingsParts.tsx';
import {
  choiceOf,
  groupNameLength,
  groupOptions,
  groupProblem,
  problemLine,
  refusedLine,
  sortedGroups,
} from './guestGroups.ts';
import { NO_GROUP } from './guestView.ts';
import './guestGroups.css';

const BLUR_MS = 120;

/** One chip per group, A to Z, then No group while anyone has none; one pressed at a time (sc-3775). */
export function GroupChips({
  list,
  filter,
  onFilter,
}: {
  list: GuestList;
  filter: string | null;
  onFilter: (next: string | null) => void;
}) {
  const { t } = useTranslation();

  if (list.groups.length === 0) return null;
  const chips = [
    ...sortedGroups(list.groups).map((one) => ({ key: one.id, word: one.name })),
    ...(list.guests.some((one) => one.group == null)
      ? [{ key: NO_GROUP, word: t('guestGroups.noGroup') }]
      : []),
  ];

  return (
    <div className="gs-chips gs-filters gg-chips" role="group" aria-label={t('guestGroups.groups')}>
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

/** The grey tag at a row's end; its name ends "Group: {name}". */
export function GroupTag({ name }: { name: string }) {
  const { t } = useTranslation();

  return (
    <span className="gs-tag gg-tag">
      <span className="visually-hidden">{t('guestGroups.group')}: </span>
      {name}
    </span>
  );
}

/** The guest form's Group, after Language: a WAI-ARIA combobox with list autocomplete; a typed new name is made on save. */
export function GroupField({
  groups,
  value,
  error,
  onChange,
}: {
  groups: readonly GuestGroup[];
  value: GroupChoice | undefined;
  error: string | undefined;
  onChange: (choice: GroupChoice) => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const [typed, setTyped] = useState(() =>
    value != null && 'id' in value
      ? (groups.find((one) => one.id === value.id)?.name ?? '')
      : value != null
        ? value.name
        : '',
  );
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [refused, setRefused] = useState<string | null>(null);
  const blurred = useRef<number | undefined>(undefined);
  const options = groupOptions(groups, typed);
  const rows: ({ kind: 'group'; group: GuestGroup } | { kind: 'create'; name: string })[] = [
    ...options.groups.map((group) => ({ kind: 'group' as const, group })),
    ...(options.create == null ? [] : [{ kind: 'create' as const, name: options.create }]),
  ];
  const showList = open && rows.length > 0;
  const shown = refused ?? error;
  const fresh = value != null && 'name' in value ? value.name : null;
  const help =
    fresh != null && shown == null
      ? t('guestGroups.madeOnSave', { name: fresh })
      : t('guestGroups.chooserHint');
  const told = [`${id}-help`, shown == null ? null : `${id}-error`].filter(Boolean).join(' ');

  useEffect(() => () => window.clearTimeout(blurred.current), []);

  function type(next: string): void {
    setTyped(next);
    setOpen(true);
    setActive(0);
    setRefused(null);
    onChange(choiceOf(groups, next));
  }

  function choose(row: (typeof rows)[number] | undefined): void {
    if (row == null) return;
    setOpen(false);
    if (row.kind === 'group') {
      setTyped(row.group.name);
      onChange({ id: row.group.id });
      return;
    }
    const problem = groupProblem(groups, row.name);

    if (problem != null) {
      setRefused(problemLine(t, groups, row.name, problem, 'form'));
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
        {t('guestGroups.group')}
        <span className="gs-optional">{t('eventForm.optional')}</span>
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
          placeholder={t('guestGroups.placeholder')}
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
            aria-label={t('guestGroups.clearGroup')}
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
        <ul
          id={`${id}-list`}
          role="listbox"
          aria-label={t('guestGroups.groupList')}
          className="gg-options"
        >
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
              {row.kind === 'group'
                ? row.group.name
                : t('guestGroups.createNamed', { name: row.name })}
            </li>
          ))}
        </ul>
      )}
      <p role="status" className="visually-hidden">
        {showList ? t('guestGroups.options', { count: options.groups.length }) : ''}
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
  const { t } = useTranslation();
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
              event.stopPropagation();
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
        {t('guestGroups.ofMost', { count: groupNameLength(typed), most: GUEST_GROUP_NAME_MAXIMUM })}
      </p>
    </div>
  );
}

function peopleLine(t: TFunction, counts: GuestCounts): string {
  return t('guestGroups.peopleLine', {
    people: t('guestGroups.people', { count: counts.people }),
    guests: t('guestGroups.guests', { count: counts.guests }),
    companions:
      counts.companions === 0
        ? t('guestGroups.noCompanions')
        : t('guestGroups.companions', { count: counts.companions }),
  });
}

/** Groups in the guest's column (sc-3775): New group for guests.manage, each group with sc-99's count, Rename in place, Delete asked first, No group last. */
export function GroupsColumn({
  eventId,
  list,
  manages,
  focus,
  onChanged,
  onDone,
}: {
  eventId: string;
  list: GuestList;
  manages: boolean;
  focus: (...keys: string[]) => void;
  onChanged: (deleted?: string) => void;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const groups = sortedGroups(list.groups);
  const [typed, setTyped] = useState('');
  const [tried, setTried] = useState(false);
  const [refused, setRefused] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; typed: string; tried: boolean } | null>(
    null,
  );
  const [renameRefused, setRenameRefused] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [said, setSaid] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const problem = tried ? groupProblem(groups, typed) : null;
  const renameProblem =
    renaming?.tried === true ? groupProblem(groups, renaming.typed, renaming.id) : null;
  const doomed = groups.find((one) => one.id === deleting);

  async function make(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (busy) return;
    if (groupProblem(groups, typed) != null) {
      setTried(true);
      focus('new-group');
      return;
    }
    setBusy(true);
    setFailed(false);
    try {
      const made = await api.makeGuestGroup(eventId, typed);

      setSaid(t('guestGroups.created', { name: made.name }));
      setTyped('');
      setTried(false);
      onChanged();
    } catch (error) {
      const line = refusedLine(error, 'name');

      if (line == null) setFailed(true);
      else setRefused(line);
    } finally {
      setBusy(false);
      focus('new-group');
    }
  }

  async function saveRename(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (renaming == null || busy) return;
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
    setBusy(true);
    setFailed(false);
    try {
      const renamed = await api.renameGuestGroup(eventId, renaming.id, renaming.typed);

      setSaid(t('guestGroups.renamed', { name: renamed.name }));
      setRenaming(null);
      onChanged();
      focus(`rename:${renamed.id}`);
    } catch (error) {
      const line = refusedLine(error, 'name');

      if (line == null) setFailed(true);
      else setRenameRefused(line);
      focus('rename-field');
    } finally {
      setBusy(false);
    }
  }

  async function remove(group: GuestGroup): Promise<void> {
    setBusy(true);
    setFailed(false);
    try {
      await api.deleteGuestGroup(eventId, group.id);
      setDeleting(null);
      setSaid(t('guestGroups.deleted', { name: group.name }));
      onChanged(group.id);
      focus(manages ? 'new-group' : 'form-heading', 'form-heading');
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  function cancelRename(): void {
    if (renaming == null) return;
    setRenaming(null);
    setRenameRefused(null);
    focus(`rename:${renaming.id}`);
  }

  return (
    <div className="gs-form gg">
      <div className="gs-col-head">
        <h2 className="gs-col-title" tabIndex={-1} data-focus="form-heading">
          {t('guestGroups.groupsCount', { count: groups.length })}
        </h2>
        <div className="gs-col-actions">
          <button type="button" className="desk-text" onClick={onDone}>
            {t('guestGroups.done')}
          </button>
        </div>
      </div>
      {said != null && (
        <p className="gs-ok" role="status">
          <Glyph name="tick" size={17} weight={2.6} />
          {said}
        </p>
      )}
      {failed && deleting == null && (
        <p className="desk-error gs-refused" role="alert">
          <Glyph name="alert" size={15} weight={2.2} />
          {t('guestList.notSaved')}
        </p>
      )}
      {manages ? (
        <form className="gg-new" noValidate onSubmit={(event) => void make(event)}>
          <NameBox
            label={t('guestGroups.newGroup')}
            typed={typed}
            error={
              refused ?? (problem == null ? null : problemLine(t, groups, typed, problem, 'groups'))
            }
            focusKey="new-group"
            placeholder={t('guestGroups.placeholder')}
            onType={(next) => {
              setTyped(next);
              setRefused(null);
            }}
          />
          <button
            type="submit"
            className="gs-pill is-primary gg-create"
            aria-busy={busy || undefined}
          >
            {t('guestGroups.createGroup')}
          </button>
        </form>
      ) : (
        <p className="desk-line gg-read-only">{t('guestGroups.readOnly')}</p>
      )}
      {groups.length === 0 ? (
        <div className="gs-none gg-none">
          <h3>{t('guestGroups.noneYet')}</h3>
          <p className="desk-line">
            {t(manages ? 'guestGroups.noneYetLine' : 'guestGroups.noneYetViewer')}
          </p>
        </div>
      ) : (
        <ul className="desk-rows gg-rows" aria-label={t('guestGroups.groups')}>
          {groups.map((group) =>
            renaming?.id === group.id ? (
              <li key={group.id} className="gg-row is-renaming">
                <form className="gg-rename" noValidate onSubmit={(event) => void saveRename(event)}>
                  <NameBox
                    label={t('guestGroups.renameLabel', { name: group.name })}
                    typed={renaming.typed}
                    error={
                      renameRefused ??
                      (renameProblem == null
                        ? null
                        : problemLine(t, groups, renaming.typed, renameProblem, 'groups'))
                    }
                    focusKey="rename-field"
                    onType={(next) => {
                      setRenaming({ ...renaming, typed: next });
                      setRenameRefused(null);
                    }}
                    onEscape={cancelRename}
                  />
                  <div className="gg-row-acts">
                    <button type="button" className="desk-text" onClick={cancelRename}>
                      {t('guestGroups.cancel')}
                    </button>
                    <button
                      type="submit"
                      className="gs-pill is-primary"
                      aria-busy={busy || undefined}
                    >
                      {t('guestGroups.save')}
                    </button>
                  </div>
                </form>
              </li>
            ) : (
              <li key={group.id} className="gg-row">
                <RowWords title={group.name} lines={[peopleLine(t, group.counts)]} />
                {manages && (
                  <div className="gg-row-acts">
                    <button
                      type="button"
                      className="desk-text"
                      aria-label={t('guestGroups.renameNamed', { name: group.name })}
                      data-focus={`rename:${group.id}`}
                      onClick={() => {
                        setRenaming({ id: group.id, typed: group.name, tried: false });
                        setRenameRefused(null);
                        focus('rename-field');
                      }}
                    >
                      {t('guestGroups.rename')}
                    </button>
                    <button
                      type="button"
                      className="desk-text is-red"
                      aria-label={t('guestGroups.deleteNamed', { name: group.name })}
                      data-focus={`delete:${group.id}`}
                      onClick={() => {
                        setFailed(false);
                        setDeleting(group.id);
                      }}
                    >
                      {t('guestGroups.delete')}
                    </button>
                  </div>
                )}
              </li>
            ),
          )}
          <li className="gg-row is-none">
            <RowWords title={t('guestGroups.noGroup')} lines={[peopleLine(t, list.ungrouped)]} />
          </li>
        </ul>
      )}
      {groups.length > 0 && (
        <p className="desk-help gg-adds-up">
          {t('guestGroups.addsUp', { count: list.counts.people })}
        </p>
      )}
      {doomed != null && (
        <Ask
          title={t('guestGroups.deleteTitle', { name: doomed.name })}
          line={
            doomed.counts.guests === 0
              ? t('guestGroups.deleteEmpty')
              : t('guestGroups.deleteLine', { count: doomed.counts.guests })
          }
          keep={t('guestGroups.cancel')}
          go={t('guestGroups.deleteGo')}
          busy={busy ? t('guestGroups.deleting') : undefined}
          failed={failed ? t('guestList.notSaved') : undefined}
          onKeep={() => {
            setDeleting(null);
            setFailed(false);
            focus(`delete:${doomed.id}`);
          }}
          onGo={() => void remove(doomed)}
        />
      )}
    </div>
  );
}
