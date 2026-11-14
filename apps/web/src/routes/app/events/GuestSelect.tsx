import { GUEST_GROUP_NAME_MAXIMUM, type GuestList } from '@soirely/api-client';
import { type FocusEvent, useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Glyph, type GlyphName } from '../../../components/Glyph.tsx';
import { Ask, Dialog, TextAction } from '../../../components/SettingsParts.tsx';
import { COUNTED_SECONDS } from '../../../components/Toast.tsx';
import { groupNameLength, groupProblem, problemLine, sortedGroups } from './guestGroups.ts';
import {
  type Action,
  type Line,
  MOST_AT_ONCE,
  type RemoveQuestion,
  lineWords,
  removeTitle,
} from './guestSelect.ts';
import './guestSelect.css';

const NEW_GROUP = 'new';

const LINE_GLYPH: Record<Line['kind'], GlyphName> = {
  moved: 'tick',
  removed: 'tick',
  undone: 'tick',
  failed: 'alert',
};

/** The bar sc-3776 builds and later epics add to: the count with its companions, Add to group, Remove from the list, Clear. */
export function SelectBar({
  count,
  companions,
  onAdd,
  onRemove,
  onClear,
}: {
  count: number;
  companions: number;
  onAdd: () => void;
  onRemove: () => void;
  onClear: () => void;
}) {
  const { t } = useTranslation();

  return (
    <section className="gm-bar" aria-label={t('guestSelect.bar')}>
      <p className="gm-count">
        <strong>{t('guestSelect.selected', { count })}</strong>
        {companions > 0 && <span>{t('guestSelect.withCompanions', { count: companions })}</span>}
      </p>
      {count > MOST_AT_ONCE && (
        <p className="desk-line gm-narrow">{t('guestSelect.narrowing', { most: MOST_AT_ONCE })}</p>
      )}
      <div className="gm-actions">
        <button
          type="button"
          className="gs-pill is-secondary"
          data-focus="many-add"
          onClick={onAdd}
        >
          {t('guestSelect.addToGroup')}
        </button>
        <button
          type="button"
          className="gs-pill is-secondary"
          data-focus="many-remove"
          onClick={onRemove}
        >
          {t('guestSelect.remove')}
        </button>
        <TextAction label={t('guestSelect.clear')} onClick={onClear} />
      </div>
    </section>
  );
}

/** Says the count as the bar comes up, since the bar itself is not a live region. */
export function SelectedSaid({ count, companions }: { count: number | null; companions: number }) {
  const { t } = useTranslation();

  return (
    <p className="visually-hidden" role="status">
      {count != null &&
        [
          t('guestSelect.selected', { count }),
          companions > 0 ? t('guestSelect.withCompanions', { count: companions }) : '',
        ]
          .filter((words) => words !== '')
          .join(', ')}
    </p>
  );
}

/** The line that takes the bar's place, a shape and a word, never colour alone. After a removal it holds Undo for 10 seconds, paused while it has focus or the pointer. */
export function ResultLine({
  line,
  undo,
  onUndo,
  onGone,
  onRetry,
}: {
  line: Line;
  undo: boolean;
  onUndo: () => void;
  onGone: () => void;
  onRetry: (action: Action) => void;
}) {
  const { t } = useTranslation();
  const [left, setLeft] = useState(COUNTED_SECONDS);
  const focused = useRef(false);
  const pointed = useRef(false);
  const end = useRef(onGone);

  useEffect(() => {
    end.current = onGone;
  }, [onGone]);

  useEffect(() => {
    if (!undo) return;
    const timer = window.setInterval(
      () =>
        setLeft((was) =>
          focused.current || pointed.current ? COUNTED_SECONDS : Math.max(was - 1, 0),
        ),
      1000,
    );

    return () => window.clearInterval(timer);
  }, [undo]);

  useEffect(() => {
    if (undo && left === 0) end.current();
  }, [undo, left]);

  function blurred(event: FocusEvent<HTMLDivElement>): void {
    if (event.currentTarget.contains(event.relatedTarget)) return;
    focused.current = false;
  }

  return (
    <div
      className={`gm-line is-${line.kind === 'failed' ? 'held' : 'done'}`}
      onPointerEnter={() => {
        pointed.current = true;
      }}
      onPointerLeave={() => {
        pointed.current = false;
      }}
      onFocus={() => {
        focused.current = true;
      }}
      onBlur={blurred}
    >
      <Glyph name={LINE_GLYPH[line.kind]} size={18} weight={2.4} />
      <p>
        {lineWords(t, line).map((words) => (
          <span key={words}>{words}</span>
        ))}
        {undo && <span className="visually-hidden">{t('guestList.undoOpen')}</span>}
      </p>
      {undo && (
        <>
          <span className="gb-count" aria-hidden="true">
            {t('toast.secondsLeft', { count: left })}
          </span>
          <button
            type="button"
            className="gs-pill is-secondary"
            data-focus="many-undo"
            onClick={onUndo}
          >
            {t('toast.undo')}
          </button>
        </>
      )}
      {line.kind === 'failed' && (
        <TextAction label={t('guestSelect.tryAgain')} onClick={() => onRetry(line.action)} />
      )}
    </div>
  );
}

/** Add to group: the event's groups with how many people each holds, then New group, its name checked by sc-3775's rules before anything is sent. */
export function GroupSheet({
  count,
  list,
  refused,
  onCancel,
  onMove,
}: {
  count: number;
  list: GuestList;
  /** The API's sentence for a name it refused. */
  refused: string | null;
  onCancel: () => void;
  onMove: (to: { id: string } | { name: string }) => void;
}) {
  const { t } = useTranslation();
  const name = useId();
  const [pick, setPick] = useState<string | null>(null);
  const [typed, setTyped] = useState('');
  const [tried, setTried] = useState(false);
  const first = useRef<HTMLInputElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const groups = list.groups;
  const fresh = pick === NEW_GROUP;
  const problem = fresh ? groupProblem(groups, typed) : null;
  const wrong = tried
    ? pick == null
      ? t('guestSelect.chooseOne')
      : problem == null
        ? refused
        : problemLine(t, groups, typed, problem, 'groups')
    : refused;

  function confirm(): void {
    if (pick == null) {
      setTried(true);
      first.current?.focus();
      return;
    }
    if (pick !== NEW_GROUP) {
      onMove({ id: pick });
      return;
    }
    if (problem != null) {
      setTried(true);
      field.current?.focus();
      return;
    }
    onMove({ name: typed.trim() });
  }

  return (
    <Dialog
      title={t('guestSelect.groupTitle', { count })}
      verb={t('guestSelect.addToGroup')}
      first={first}
      onDismiss={onCancel}
      onConfirm={confirm}
    >
      <p className="desk-line gb-sheet-line">{t('guestSelect.groupLine')}</p>
      <fieldset
        className="gs-fieldset"
        aria-describedby={wrong != null && pick == null ? `${name}-error` : undefined}
      >
        <legend className="gs-inset-title">{t('guestGroups.groupList')}</legend>
        <div className="gs-ways gb-groups">
          {sortedGroups(groups).map((group, index) => (
            <label key={group.id} className={tried && pick == null ? 'gs-way is-wrong' : 'gs-way'}>
              <input
                ref={index === 0 ? first : undefined}
                type="radio"
                className="desk-radio"
                name={name}
                checked={pick === group.id}
                onChange={() => setPick(group.id)}
              />
              <span className="gb-group">
                {group.name}
                <span className="gb-people">
                  {t('guestGroups.people', { count: group.counts.people })}
                </span>
              </span>
            </label>
          ))}
          <label className={tried && pick == null ? 'gs-way is-wrong' : 'gs-way'}>
            <input
              ref={groups.length === 0 ? first : undefined}
              type="radio"
              className="desk-radio"
              name={name}
              checked={fresh}
              onChange={() => setPick(NEW_GROUP)}
            />
            {t('guestGroups.newGroup')}
          </label>
        </div>
      </fieldset>
      {fresh && (
        <div className="desk-field gg-name gb-new">
          <label htmlFor={`${name}-new`} className="desk-label gs-label">
            {t('guestSelect.groupName')}
          </label>
          <div className={wrong == null ? 'desk-box' : 'desk-box is-wrong'}>
            <input
              ref={field}
              id={`${name}-new`}
              type="text"
              value={typed}
              autoComplete="off"
              spellCheck={false}
              placeholder={t('guestGroups.placeholder')}
              aria-invalid={wrong != null}
              aria-describedby={[`${name}-count`, wrong == null ? null : `${name}-error`]
                .filter(Boolean)
                .join(' ')}
              onChange={(change) => setTyped(change.target.value)}
            />
          </div>
          <p id={`${name}-count`} className="desk-help">
            {t('guestGroups.ofMost', {
              count: groupNameLength(typed),
              most: GUEST_GROUP_NAME_MAXIMUM,
            })}
          </p>
        </div>
      )}
      {wrong != null && (
        <p id={`${name}-error`} className="desk-error">
          <Glyph name="alert" size={15} weight={2.2} />
          {wrong}
        </p>
      )}
    </Dialog>
  );
}

/** Remove {n} guests and their {m} companions? Who has replied and who goes with them; Keep on the list first. */
export function RemoveMany({
  asked,
  busy,
  onKeep,
  onRemove,
}: {
  asked: RemoveQuestion;
  busy: boolean;
  onKeep: () => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const go = t('guestSelect.go', { count: asked.goes });

  return (
    <Ask
      title={removeTitle(t, asked)}
      keep={t('guestList.keepOnList')}
      go={go}
      red={false}
      busy={busy ? go : undefined}
      describedBy={`${id}-goes`}
      onKeep={onKeep}
      onGo={onRemove}
    >
      <ul id={`${id}-goes`} className="gb-goes">
        {asked.replied > 0 && <li>{t('guestSelect.replied', { count: asked.replied })}</li>}
        {asked.companions > 0 && (
          <li>{t('guestSelect.companionsGo', { count: asked.companions })}</li>
        )}
        <li>{t('guestList.removeNothingSent')}</li>
      </ul>
    </Ask>
  );
}
