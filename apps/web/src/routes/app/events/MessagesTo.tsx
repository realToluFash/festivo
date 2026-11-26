import type {
  AudienceBook,
  AudienceMatch,
  GuestCondition,
  SavedAudience,
  ShownCondition,
} from '@soirely/api-client';
import { numberFormat, sameGroup } from '@soirely/domain';
import type { TFunction } from 'i18next';
import { type KeyboardEvent, type RefObject, useCallback, useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../../../api.ts';
import { Glyph } from '../../../components/Glyph.tsx';
import { currentLocale } from '../../../i18n/index.ts';
import {
  ADDABLE,
  AUDIENCE_NAME_MAXIMUM,
  AUDIENCES_MOST,
  type Addable,
  type AudienceRefusal,
  type NameProblem,
  type Picked,
  type Who,
  asCondition,
  audienceNameProblem,
  changedFrom,
  conditionKey,
  nameProblemOf,
  savedOf,
} from './messagesArea.ts';
import '../../../components/SettingsParts.css';

const COUNT_WAIT_MS = 300;

export type Groups = ReadonlyMap<string, { name: string; deleted: boolean }>;

export interface Counted {
  match: AudienceMatch | null;
  counting: boolean;
}

/** The live count for a set of conditions, asked again a moment after they stop changing. */
export function useAudienceMatch(
  eventId: string,
  conditions: readonly GuestCondition[] | null,
): Counted {
  const key = conditions == null || conditions.length === 0 ? null : conditionsKey(conditions);
  const [got, setGot] = useState<{ key: string; match: AudienceMatch | null } | null>(null);

  useEffect(() => {
    if (key == null) return;

    let current = true;
    const timer = window.setTimeout(() => {
      api.audienceMatch(eventId, conditionsOfKey(key)).then(
        (match) => current && setGot({ key, match }),
        () => current && setGot({ key, match: null }),
      );
    }, COUNT_WAIT_MS);

    return () => {
      current = false;
      window.clearTimeout(timer);
    };
  }, [eventId, key]);

  if (key == null) return { match: null, counting: false };

  return got?.key === key ? { match: got.match, counting: false } : { match: null, counting: true };
}

function conditionsKey(conditions: readonly GuestCondition[]): string {
  return conditions.map(conditionKey).join('|');
}

function conditionsOfKey(key: string): GuestCondition[] {
  return key
    .split('|')
    .map((one) =>
      one.startsWith('inGroup:')
        ? { type: 'inGroup', groupId: one.slice('inGroup:'.length) || null }
        : ({ type: one } as GuestCondition),
    );
}

/** Each group a condition may name: the live ones from the book, and a deleted one by the name the API reads back. */
export function groupsOf(book: AudienceBook | null, read: readonly ShownCondition[]): Groups {
  const groups = new Map<string, { name: string; deleted: boolean }>();
  const shown = [...(book?.audiences ?? []).flatMap((one) => one.conditions), ...read];

  for (const one of shown)
    if (one.type === 'inGroup' && one.groupId != null && one.group != null)
      groups.set(one.groupId, one.group);
  for (const one of book?.groups ?? []) groups.set(one.id, { name: one.name, deleted: false });

  return groups;
}

export function deletedGroups(who: Who, groups: Groups): string[] {
  if (who.kind !== 'conditions') return [];

  return who.conditions.flatMap((one) => {
    const group = one.type === 'inGroup' && one.groupId != null ? groups.get(one.groupId) : null;

    return group?.deleted === true ? [group.name] : [];
  });
}

const PLAIN: Record<Exclude<Addable, 'inGroup'>, { word: string; line: string }> = {
  replied: { word: 'hasReplied', line: 'hasRepliedLine' },
  notReplied: { word: 'hasntReplied', line: 'hasntRepliedLine' },
  coming: { word: 'isComing', line: 'isComingLine' },
  notComing: { word: 'isntComing', line: 'isntComingLine' },
  notSure: { word: 'notSureYet', line: 'notSureYetLine' },
  invited: { word: 'invited', line: 'invitedLine' },
  notInvited: { word: 'notYetInvited', line: 'notYetInvitedLine' },
  hasEmail: { word: 'hasEmail', line: 'hasEmailLine' },
  hasMobile: { word: 'hasMobile', line: 'hasMobileLine' },
};

function addWord(kind: Addable, t: TFunction): string {
  return t(`eventMessages.${kind === 'inGroup' ? 'isInGroup' : PLAIN[kind].word}`);
}

function addLine(kind: Addable, t: TFunction): string {
  return t(`eventMessages.${kind === 'inGroup' ? 'isInGroupLine' : PLAIN[kind].line}`);
}

export function conditionWords(condition: GuestCondition, groups: Groups, t: TFunction): string {
  if (condition.type !== 'inGroup') return t(`eventMessages.${PLAIN[condition.type].word}`);
  if (condition.groupId == null)
    return t('eventMessages.inGroup', { group: t('eventMessages.noGroup') });

  const group = groups.get(condition.groupId);

  if (group == null) return t('eventMessages.isInGroup');

  return t('eventMessages.inGroup', {
    group: group.deleted ? t('eventMessages.deletedGroup', { group: group.name }) : group.name,
  });
}

export function conditionsWords(
  conditions: readonly GuestCondition[],
  groups: Groups,
  t: TFunction,
): string {
  return conditions.map((one) => conditionWords(one, groups, t)).join(' · ');
}

export function countWords(count: number | null, t: TFunction): string {
  if (count == null) return '';

  return count === 0 ? t('eventMessages.nobodyMatches') : t('eventMessages.guests', { count });
}

export function refusalLine(refusal: AudienceRefusal, t: TFunction): string {
  if (refusal.kind === 'deleted') return t('eventMessages.deletedSend', { group: refusal.group });

  return t(`eventMessages.${refusal.kind === 'nobody' ? 'nobodyLine' : 'noCondition'}`);
}

/** The To chip: a quick pick as "Coming · 96", a saved audience by its name, else Guests who… with its count. */
export function conditionsChip(
  who: Extract<Who, { kind: 'conditions' }>,
  saved: readonly SavedAudience[],
  counted: Counted,
  t: TFunction,
): string {
  const count = counted.counting ? null : (counted.match?.count ?? null);
  const kept = !changedFrom(who, saved);

  if (kept && (who.pick === 'coming' || who.pick === 'notReplied')) {
    const word = t(`eventMessages.${who.pick === 'coming' ? 'coming' : 'hasntReplied'}`);

    return count == null ? word : `${word} · ${numberFormat(currentLocale()).format(count)}`;
  }

  const lead = (kept ? savedOf(saved, who.pick)?.name : null) ?? t('eventMessages.guestsWho');

  return count == null ? lead : `${lead} · ${countWords(count, t)}`;
}

function nameLine(
  problem: NameProblem,
  name: string,
  saved: readonly SavedAudience[],
  t: TFunction,
) {
  if (problem === 'nameTaken')
    return t('eventMessages.nameTaken', { name: sameGroup(saved, name)?.name ?? name.trim() });

  return t(`eventMessages.${problem}`, {
    most: problem === 'nameLong' ? AUDIENCE_NAME_MAXIMUM : AUDIENCES_MOST,
  });
}

export function useFocusLater(box: RefObject<HTMLElement | null>): (selector: string) => void {
  const [later, setLater] = useState<{ selector: string } | null>(null);

  useEffect(() => {
    if (later == null) return;
    box.current?.querySelector<HTMLElement>(later.selector)?.focus();
  }, [box, later]);

  return useCallback((selector: string) => setLater({ selector }), []);
}

interface Shared {
  eventId: string;
  book: AudienceBook;
  setBook: (change: (book: AudienceBook) => AudienceBook) => void;
  focusLater: (selector: string) => void;
  say: (words: string) => void;
}

/** A saved audience in To's radio group, with its conditions as a second line, and More actions: Rename, Delete…. */
export function SavedRow({
  shared,
  audience,
  radio,
  groups,
  onChoose,
  onGone,
}: {
  shared: Shared;
  audience: SavedAudience;
  radio: { name: string; checked: boolean };
  groups: Groups;
  onChoose: () => void;
  onGone: () => void;
}) {
  const { t } = useTranslation();
  const { eventId, book, setBook, focusLater, say } = shared;
  const [menu, setMenu] = useState(false);
  const [renaming, setRenaming] = useState<{ name: string; wrong: string | null } | null>(null);
  const [deleting, setDeleting] = useState<{ wrong: string | null } | null>(null);
  const ids = useId();
  const more = `[data-to="more:${audience.id}"]`;
  const moreLabel = t('eventMessages.moreActions', { name: audience.name });

  function rename(typed: string): void {
    if (typed.trim() === audience.name) {
      setRenaming(null);
      focusLater(more);
      return;
    }

    const problem = audienceNameProblem(book.audiences, typed, audience.id);

    if (problem != null) {
      setRenaming({ name: typed, wrong: nameLine(problem, typed, book.audiences, t) });
      focusLater('[data-to="rename"]');
      return;
    }
    api.renameAudience(eventId, audience.id, typed.trim()).then(
      (renamed) => {
        setBook((was) => ({
          ...was,
          audiences: was.audiences.map((one) => (one.id === renamed.id ? renamed : one)),
        }));
        setRenaming(null);
        focusLater(more);
        say(t('eventMessages.renamedSaid', { name: renamed.name }));
      },
      (error: unknown) => {
        const problem = nameProblemOf(error);

        setRenaming({
          name: typed,
          wrong:
            problem == null
              ? t('eventMessages.failRefused')
              : nameLine(problem, typed, book.audiences, t),
        });
        focusLater('[data-to="rename"]');
      },
    );
  }

  function remove(): void {
    api.deleteAudience(eventId, audience.id).then(
      () => {
        setBook((was) => ({
          ...was,
          audiences: was.audiences.filter((one) => one.id !== audience.id),
        }));
        setDeleting(null);
        say(t('eventMessages.deletedSaid', { name: audience.name }));
        onGone();
      },
      () => setDeleting({ wrong: t('eventMessages.failRefused') }),
    );
  }

  function menuKeys(key: KeyboardEvent): void {
    const items = [...key.currentTarget.querySelectorAll<HTMLElement>('[role=menuitem]')];
    const at = items.indexOf(document.activeElement as HTMLElement);

    if (key.key === 'Escape') {
      key.preventDefault();
      setMenu(false);
      focusLater(more);
    } else if (key.key === 'Tab') setMenu(false);
    else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(key.key)) {
      key.preventDefault();
      const next =
        key.key === 'Home'
          ? 0
          : key.key === 'End'
            ? items.length - 1
            : (at + (key.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items[next]?.focus();
    }
  }

  return (
    <div className="mgt-saved">
      {renaming != null ? (
        <NameForm
          label={t('eventMessages.renameField', { name: audience.name })}
          typed={renaming.name}
          wrong={renaming.wrong}
          hint={null}
          act={t('eventMessages.save')}
          focusKey="rename"
          onType={(typed) => setRenaming({ name: typed, wrong: null })}
          onSubmit={() => rename(renaming.name)}
          onCancel={() => {
            focusLater(more);
            setRenaming(null);
          }}
        />
      ) : (
        <div className="mgt-saved-row">
          <label className="mg-radio-row mgt-saved-pick">
            <input
              type="radio"
              name={radio.name}
              className="desk-radio"
              checked={radio.checked}
              aria-labelledby={`${ids}-name`}
              aria-describedby={`${ids}-line`}
              data-saved={audience.id}
              onChange={onChoose}
            />
            <span className="mgt-saved-words">
              <span id={`${ids}-name`} className="mgt-saved-name">
                {audience.name}
              </span>
              <span id={`${ids}-line`} className="mgt-saved-line">
                {conditionsWords(audience.conditions.map(asCondition), groups, t)}
              </span>
            </span>
          </label>
          <div
            className="mgt-more-at"
            onBlur={(blur) => {
              if (!blur.currentTarget.contains(blur.relatedTarget)) setMenu(false);
            }}
          >
            <button
              type="button"
              className="mgt-more"
              aria-label={moreLabel}
              aria-haspopup="menu"
              aria-expanded={menu}
              aria-controls={menu ? `${ids}-menu` : undefined}
              data-to={`more:${audience.id}`}
              onClick={() => {
                setMenu(!menu);
                if (!menu) focusLater(`[id="${ids}-menu"] [role=menuitem]`);
              }}
            >
              <MoreMark />
            </button>
            {menu && (
              <ul
                id={`${ids}-menu`}
                className="mg-pop mgt-menu"
                role="menu"
                aria-label={moreLabel}
                onKeyDown={menuKeys}
              >
                <li role="none">
                  <button
                    type="button"
                    role="menuitem"
                    className="mgt-menu-item"
                    onClick={() => {
                      setMenu(false);
                      setRenaming({ name: audience.name, wrong: null });
                      focusLater('[data-to="rename"]');
                    }}
                  >
                    {t('eventMessages.rename')}
                  </button>
                </li>
                <li role="none">
                  <button
                    type="button"
                    role="menuitem"
                    className="mgt-menu-item is-red"
                    onClick={() => {
                      setMenu(false);
                      setDeleting({ wrong: null });
                      focusLater('[data-to="keep"]');
                    }}
                  >
                    <BinMark />
                    {t('eventMessages.deleteEllipsis')}
                  </button>
                </li>
              </ul>
            )}
          </div>
        </div>
      )}
      {deleting != null && (
        <DeleteAsk
          name={audience.name}
          wrong={deleting.wrong}
          onKeep={() => {
            focusLater(more);
            setDeleting(null);
          }}
          onDelete={remove}
        />
      )}
    </div>
  );
}

/** Guests who…: the message's own conditions as chips, Add a condition, the count with See who, and Save this audience. */
export function WhoBlock({
  shared,
  who,
  counted,
  groups,
  onConditions,
  onSaved,
}: {
  shared: Shared;
  who: Extract<Who, { kind: 'conditions' }>;
  counted: Counted;
  groups: Groups;
  onConditions: (conditions: GuestCondition[]) => void;
  onSaved: (pick: Picked) => void;
}) {
  const { t } = useTranslation();
  const { eventId, book, setBook, focusLater, say } = shared;
  const [adding, setAdding] = useState<'top' | 'group' | null>(null);
  const [seeing, setSeeing] = useState(false);
  const [saveRefused, setSaveRefused] = useState(false);
  const [saving, setSaving] = useState<{ name: string; wrong: string | null } | null>(null);
  const ids = useId();
  const conditions = who.conditions;
  const keys = new Set(conditions.map(conditionKey));
  const from = savedOf(book.audiences, who.pick);
  const count = counted.counting ? null : (counted.match?.count ?? null);
  const shown = count != null && count > 0;
  const options: { condition: GuestCondition; word: string }[] = [
    ...[...book.groups]
      .sort((a, b) => a.name.localeCompare(b.name, currentLocale(), { sensitivity: 'base' }))
      .map((one) => ({
        condition: { type: 'inGroup' as const, groupId: one.id },
        word: one.name,
      })),
    { condition: { type: 'inGroup' as const, groupId: null }, word: t('eventMessages.noGroup') },
  ].filter((option) => !keys.has(conditionKey(option.condition)));
  const left = ADDABLE.filter((kind) =>
    kind === 'inGroup' ? options.length > 0 : !keys.has(kind),
  );
  const gone = conditions.flatMap((one) => {
    const group = one.type === 'inGroup' && one.groupId != null ? groups.get(one.groupId) : null;

    return group?.deleted === true ? [{ key: conditionKey(one), name: group.name }] : [];
  });

  function add(condition: GuestCondition): void {
    onConditions([...conditions, condition]);
    setAdding(null);
    setSaveRefused(false);
    focusLater('[data-to="add"]');
  }

  function addKeys(key: KeyboardEvent): void {
    if (key.key !== 'Escape') return;
    key.preventDefault();
    if (adding === 'group') {
      setAdding('top');
      focusLater('[data-to="add-group"]');
    } else {
      setAdding(null);
      focusLater('[data-to="add"]');
    }
  }

  function startSave(): void {
    if (conditions.length === 0) {
      setSaveRefused(true);
      return;
    }
    setSaving({ name: '', wrong: null });
    focusLater('[data-to="name"]');
  }

  function save(typed: string): void {
    const problem = audienceNameProblem(book.audiences, typed);
    const refuse = (wrong: string) => {
      setSaving({ name: typed, wrong });
      focusLater('[data-to="name"]');
    };

    if (problem != null) {
      refuse(nameLine(problem, typed, book.audiences, t));
      return;
    }
    api.saveAudience(eventId, typed.trim(), [...conditions]).then(
      (made) => {
        setBook((was) => ({ ...was, audiences: [...was.audiences, made] }));
        onSaved(`saved:${made.id}`);
        setSaving(null);
        say(t('eventMessages.savedSaid', { name: made.name }));
        focusLater(`[data-saved="${made.id}"]`);
      },
      (error: unknown) => {
        const refused = nameProblemOf(error);

        refuse(
          refused == null
            ? t('eventMessages.failRefused')
            : nameLine(refused, typed, book.audiences, t),
        );
      },
    );
  }

  return (
    <div className="mg-who-block">
      {from != null && (
        <p className="mg-pop-line">{t('eventMessages.fromSaved', { name: from.name })}</p>
      )}
      <ul className="mg-conds">
        {conditions.map((condition) => {
          const words = conditionWords(condition, groups, t);
          const key = conditionKey(condition);

          return (
            <li
              key={key}
              className={gone.some((one) => one.key === key) ? 'mg-cond is-gone' : 'mg-cond'}
            >
              {words}
              <button
                type="button"
                aria-label={t('eventMessages.removeCondition', { condition: words })}
                onClick={() => {
                  onConditions(conditions.filter((one) => conditionKey(one) !== key));
                  focusLater('[data-to="add"]');
                }}
              >
                <Glyph name="clear" size={13} weight={2.6} />
              </button>
            </li>
          );
        })}
        {left.length > 0 && (
          <li className="mg-add-at">
            <button
              type="button"
              className="desk-text"
              aria-expanded={adding != null}
              aria-controls={adding == null ? undefined : `${ids}-add`}
              data-to="add"
              onClick={() => {
                setAdding(adding == null ? 'top' : null);
                if (adding == null) focusLater(`[id="${ids}-add"] button`);
              }}
            >
              <Glyph name="plus" size={17} weight={2.3} />
              {t('eventMessages.addCondition')}
            </button>
          </li>
        )}
      </ul>
      {adding === 'top' && (
        <ul id={`${ids}-add`} className="mgt-add">
          {left.map((kind) => (
            <li key={kind}>
              <button
                type="button"
                className="mgt-add-item"
                onKeyDown={addKeys}
                aria-label={addWord(kind, t)}
                aria-describedby={`${ids}-add-${kind}`}
                data-to={kind === 'inGroup' ? 'add-group' : undefined}
                onClick={() => {
                  if (kind !== 'inGroup') add({ type: kind });
                  else {
                    setAdding('group');
                    focusLater(`[id="${ids}-add"] button`);
                  }
                }}
              >
                <span className="mgt-add-word">{addWord(kind, t)}</span>
                <span id={`${ids}-add-${kind}`} className="mgt-add-line">
                  {addLine(kind, t)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {adding === 'group' && (
        <div id={`${ids}-add`} className="mgt-add">
          <p id={`${ids}-which`} className="mgt-add-head">
            {t('eventMessages.whichGroup')}
          </p>
          <ul aria-labelledby={`${ids}-which`}>
            {options.map((option) => (
              <li key={conditionKey(option.condition)}>
                <button
                  type="button"
                  className="mgt-add-item"
                  onKeyDown={addKeys}
                  onClick={() => add(option.condition)}
                >
                  <span className="mgt-add-word">{option.word}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {gone.map((group) => (
        <p key={group.key} className="mgt-gone">
          <Glyph name="info" size={15} weight={2.2} />
          {t('eventMessages.deletedNote', { group: group.name })}
        </p>
      ))}
      <p className="mg-pop-line">{t('eventMessages.matchEvery')}</p>
      {changedFrom(who, book.audiences) && (
        <p className="mg-pop-line">{t('eventMessages.thisMessageOnly')}</p>
      )}
      <div className="mg-pop-count">
        <p role="status" aria-live="polite">
          {counted.counting ? t('eventMessages.counting') : countWords(count, t)}
        </p>
        {shown && (
          <button
            type="button"
            className="desk-text"
            aria-expanded={seeing}
            aria-controls={seeing ? `${ids}-see` : undefined}
            onClick={() => setSeeing((open) => !open)}
          >
            {t('eventMessages.seeWho')}
          </button>
        )}
      </div>
      {shown && seeing && (
        <ul id={`${ids}-see`} className="mgt-see" aria-label={t('eventMessages.seeWho')}>
          {counted.match?.guests.map((guest) => (
            <li key={guest.id}>
              <span className="mgt-see-name">{guest.name}</span>
              {' · '}
              {channelsWords(guest, t)}
            </li>
          ))}
        </ul>
      )}
      {saving == null ? (
        <div className="mgt-save-at">
          <button
            type="button"
            className="desk-text"
            aria-describedby={saveRefused ? `${ids}-refused` : undefined}
            data-to="save"
            onClick={startSave}
          >
            {t('eventMessages.saveThisAudience')}
          </button>
          {saveRefused && (
            <p id={`${ids}-refused`} className="desk-error" role="alert">
              <Glyph name="alert" size={15} weight={2.2} />
              {t('eventMessages.noCondition')}
            </p>
          )}
        </div>
      ) : (
        <NameForm
          label={t('eventMessages.nameAudience')}
          typed={saving.name}
          wrong={saving.wrong}
          hint={t('eventMessages.nameHint')}
          act={t('eventMessages.saveAudience')}
          focusKey="name"
          onType={(typed) => setSaving({ name: typed, wrong: null })}
          onSubmit={() => save(saving.name)}
          onCancel={() => {
            focusLater('[data-to="save"]');
            setSaving(null);
          }}
        />
      )}
    </div>
  );
}

function channelsWords(guest: { email: boolean; mobile: boolean }, t: TFunction): string {
  const has = [
    guest.email ? t('eventMessages.emailAddress') : null,
    guest.mobile ? t('eventMessages.mobileNumber') : null,
  ].filter((one) => one != null);

  return has.length === 0 ? t('eventMessages.noChannels') : has.join(' · ');
}

/** A saved audience's name, as Save this audience asks for it and Rename edits it: counted, and refused beside the field. */
function NameForm({
  label,
  typed,
  wrong,
  hint,
  act,
  focusKey,
  onType,
  onSubmit,
  onCancel,
}: {
  label: string;
  typed: string;
  wrong: string | null;
  hint: string | null;
  act: string;
  focusKey: string;
  onType: (typed: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const told = [
    `${id}-count`,
    hint == null ? null : `${id}-hint`,
    wrong == null ? null : `${id}-error`,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <form
      className="mgt-name"
      noValidate
      onSubmit={(submitted) => {
        submitted.preventDefault();
        onSubmit();
      }}
    >
      <div className="desk-field">
        <label htmlFor={id} className="desk-label">
          {label}
        </label>
        <div className={wrong == null ? 'desk-box' : 'desk-box is-wrong'}>
          <input
            id={id}
            type="text"
            value={typed}
            autoComplete="off"
            spellCheck={false}
            aria-invalid={wrong != null}
            aria-describedby={told}
            data-to={focusKey}
            onKeyDown={(key) => {
              if (key.key !== 'Escape') return;
              key.preventDefault();
              onCancel();
            }}
            onChange={(changed) => onType(changed.target.value)}
          />
        </div>
        <p id={`${id}-count`} className="desk-help">
          {t('eventMessages.nameCount', {
            count: [...typed.trim()].length,
            most: AUDIENCE_NAME_MAXIMUM,
          })}
        </p>
        {hint != null && (
          <p id={`${id}-hint`} className="desk-help">
            {hint}
          </p>
        )}
        {wrong != null && (
          <p id={`${id}-error`} className="desk-error" role="alert">
            <Glyph name="alert" size={15} weight={2.2} />
            {wrong}
          </p>
        )}
      </div>
      <div className="mgt-name-acts">
        <button type="submit" className="button button-primary mgt-name-save">
          {act}
        </button>
        <button type="button" className="desk-text" onClick={onCancel}>
          {t('eventMessages.cancel')}
        </button>
      </div>
    </form>
  );
}

/** Delete… asks first, inline under the row, the focus on Keep it (WAI-ARIA APG, the least destructive choice). */
function DeleteAsk({
  name,
  wrong,
  onKeep,
  onDelete,
}: {
  name: string;
  wrong: string | null;
  onKeep: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const questionId = useId();
  const lineId = useId();
  const keys = (key: KeyboardEvent) => {
    if (key.key !== 'Escape') return;
    key.preventDefault();
    onKeep();
  };

  return (
    <div
      className="mg-ask mgt-ask"
      role="alertdialog"
      aria-labelledby={questionId}
      aria-describedby={lineId}
    >
      <p id={questionId} className="mg-ask-question mgt-ask-question">
        {t('eventMessages.deleteAsk', { name })}
      </p>
      <p id={lineId} className="mg-check-line">
        {t('eventMessages.deleteLine')}
      </p>
      {wrong != null && (
        <p className="desk-error" role="alert">
          <Glyph name="alert" size={15} weight={2.2} />
          {wrong}
        </p>
      )}
      <div className="mg-acts is-end">
        <button
          type="button"
          className="desk-text"
          data-to="keep"
          onClick={onKeep}
          onKeyDown={keys}
        >
          {t('eventMessages.keepIt')}
        </button>
        <button type="button" className="mg-danger" onClick={onDelete} onKeyDown={keys}>
          {t('eventMessages.deleteAudience')}
        </button>
      </div>
    </div>
  );
}

function MoreMark() {
  return (
    <svg width={20} height={20} viewBox="0 0 20 20" aria-hidden="true" className="mgt-mark">
      <circle cx={4.5} cy={10} r={1.8} />
      <circle cx={10} cy={10} r={1.8} />
      <circle cx={15.5} cy={10} r={1.8} />
    </svg>
  );
}

function BinMark() {
  return (
    <svg
      width={17}
      height={17}
      viewBox="0 0 20 20"
      aria-hidden="true"
      className="mgt-bin"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3.5 5.5h13M8 5.5V3.8h4v1.7M5.2 5.5l.8 11h8l.8-11M8.4 8.6v5M11.6 8.6v5" />
    </svg>
  );
}
