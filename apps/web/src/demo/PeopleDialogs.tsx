import { type KeyboardEvent, useEffect, useEffectEvent, useId, useRef, useState } from 'react';

import { Glyph } from '../components/Glyph.tsx';
import { inWithLine } from './doorCode.ts';
import {
  EVENT_ROLES,
  everyoneOn,
  type EventRole,
  FIRST_ROLE,
  firstName,
  inOrganisation,
  leadOff,
  noMatchLine,
  notChangedLine,
  offeredMembers,
  type OnEvent,
  type OrgMember,
  OUTSIDE_ENDS,
  type PeopleViewer,
  removeLine,
  removeTitle,
  ROLE_LINES,
  rolesOff,
  SAVE_MS,
  savedWords,
  SAVING,
  SETTLE_MS,
  sheetLine,
} from './people.ts';
import {
  Ask,
  Avatar,
  Choices,
  Dialog,
  Field,
  Head,
  RowWords,
  TextAction,
} from '../components/SettingsParts.tsx';

const ARROWS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

type Saving = 'idle' | 'saving' | 'saved';

/** Remove's verb turns while it sends: `held` from a deep link, long enough to look at. */
export interface Removing {
  words: string;
  ms: number;
  start: 'ask' | 'held' | null;
  heldMs: number;
}

/** Arrows check each radio they reach (APG Radio Group), so an arrow pick waits for the keys to rest. */
export function RoleDialog({
  person,
  roleFails,
  organisation,
  removing,
  onSaved,
  onLost,
  onClose,
  onRemove,
}: {
  person: OnEvent;
  roleFails: boolean;
  organisation?: string;
  removing?: Removing | undefined;
  onSaved: (role: EventRole) => void;
  onLost: (words: string) => void;
  onClose: () => void;
  onRemove: () => void;
}) {
  const name = useId();
  const [picked, setPicked] = useState<EventRole>(person.role);
  const [saving, setSaving] = useState<Saving>('idle');
  const [lost, setLost] = useState<string | null>(null);
  const [live, setLive] = useState('');
  const [asking, setAsking] = useState(removing?.start != null);
  const [gone, setGone] = useState<number | null>(
    removing?.start === 'held' ? removing.heldMs : null,
  );
  const held = useRef<EventRole>(person.role);
  const byArrow = useRef(false);
  const settle = useRef<number | undefined>(undefined);
  const sending = useRef<number | undefined>(undefined);
  const open = useRef(true);
  const first = useRef<HTMLInputElement>(null);
  const off = rolesOff(person);
  useEffect(() => {
    open.current = true;

    return () => {
      open.current = false;
    };
  }, []);

  const removed = useEffectEvent(onRemove);

  useEffect(() => {
    if (gone == null) return;
    const timer = window.setTimeout(removed, gone);

    return () => window.clearTimeout(timer);
  }, [gone]);

  function send(role: EventRole): void {
    sending.current = window.setTimeout(() => {
      sending.current = undefined;
      if (roleFails) {
        const words = notChangedLine({ ...person, role: held.current });
        setPicked(held.current);
        setSaving('idle');
        setLost(words);
        setLive(words);
        if (!open.current) onLost(words);

        return;
      }
      held.current = role;
      onSaved(role);
      setSaving('saved');
      setLive(savedWords(person, role));
    }, SAVE_MS);
  }

  function pick(role: EventRole): void {
    const arrowed = byArrow.current;
    byArrow.current = false;
    window.clearTimeout(settle.current);
    window.clearTimeout(sending.current);
    setPicked(role);
    setLost(null);
    if (role === held.current) {
      setSaving('idle');
      setLive('');

      return;
    }
    setSaving('saving');
    setLive(SAVING);
    if (arrowed) settle.current = window.setTimeout(() => send(role), SETTLE_MS);
    else send(role);
  }

  function noteArrow(event: KeyboardEvent): void {
    byArrow.current = ARROWS.has(event.key);
  }

  return (
    <>
      <Dialog
        title="Role on this event"
        verb="Done"
        cancel={false}
        first={first}
        onDismiss={onClose}
        onConfirm={onClose}
      >
        <div className="people-who">
          <Avatar initials={person.initials} tone={person.tone} size="face" />
          <RowWords title={person.name} lines={[sheetLine(person, organisation)]} />
        </div>
        {person.door != null ? (
          <div className="people-ends dc-door-lines">
            <p className="desk-line">{inWithLine(person.door)}</p>
            <p className="desk-line">{OUTSIDE_ENDS}</p>
          </div>
        ) : (
          person.outside && <p className="desk-line people-ends">{OUTSIDE_ENDS}</p>
        )}
        {lost != null && (
          <p className="desk-error people-lost" role="alert">
            <Glyph name="alert" size={15} weight={2.2} />
            {lost}
          </p>
        )}
        <fieldset className="desk-choices">
          <legend className="desk-unseen">{`${firstName(person)}’s role on this event`}</legend>
          <ul className="desk-rows">
            {EVENT_ROLES.map((role) => {
              const isOff = off.includes(role);
              const rowClass = [
                'desk-row',
                role === picked && 'is-picked',
                isOff && 'is-off',
              ].filter(Boolean);

              return (
                <li key={role}>
                  <label className={rowClass.join(' ')}>
                    <RowWords
                      title={role}
                      tag={role === picked && <SavingTag saving={saving} />}
                      lines={[isOff ? leadOff(organisation) : ROLE_LINES[role]]}
                    />
                    <input
                      ref={role === picked ? first : undefined}
                      type="radio"
                      className="desk-radio"
                      name={name}
                      checked={role === picked}
                      disabled={isOff}
                      onKeyDown={noteArrow}
                      onChange={() => pick(role)}
                    />
                  </label>
                </li>
              );
            })}
          </ul>
        </fieldset>
        <p className="desk-unseen" role="status">
          {live}
        </p>
        <div className="people-remove">
          <TextAction label="Remove from this event…" red onClick={() => setAsking(true)} />
        </div>
      </Dialog>
      {asking && (
        <Ask
          title={removeTitle(person)}
          line={removeLine(person, organisation)}
          keep={`Keep ${firstName(person)}`}
          go="Remove"
          busy={gone == null ? undefined : removing?.words}
          onKeep={() => setAsking(false)}
          onGo={() => (removing == null ? onRemove() : setGone(removing.ms))}
        />
      )}
    </>
  );
}

function SavingTag({ saving }: { saving: Saving }) {
  if (saving === 'idle') return null;

  return (
    <span className={`desk-tag ${saving === 'saving' ? 'is-now' : 'is-yes'}`} aria-hidden="true">
      {saving === 'saving' ? (
        <span className="people-spinner" />
      ) : (
        <Glyph name="tick" size={14} weight={3} />
      )}
      {saving === 'saving' ? SAVING : 'Saved'}
    </span>
  );
}

/** Add people offers members of the organisation, by name only; someone from outside is sc-71's. */
export function AddDialog({
  members,
  onEvent,
  viewer,
  organisation,
  onClose,
  onAdd,
}: {
  members: readonly OrgMember[];
  onEvent: readonly OnEvent[];
  viewer: PeopleViewer;
  organisation?: string;
  onClose: () => void;
  onAdd: (role: EventRole, added: OrgMember[]) => void;
}) {
  const [role, setRole] = useState<EventRole>(FIRST_ROLE);
  const [typed, setTyped] = useState('');
  const [ticked, setTicked] = useState<readonly string[]>([]);
  const [asking, setAsking] = useState(false);
  const nameBox = useRef<HTMLInputElement>(null);
  const offered = offeredMembers(members, onEvent, viewer, typed, ticked);
  const changed = ticked.length > 0 || role !== FIRST_ROLE;

  function tick(id: string): void {
    setTicked((was) => (was.includes(id) ? was.filter((one) => one !== id) : [...was, id]));
  }

  return (
    <>
      <Dialog
        title="Add people"
        verb="Add"
        on={ticked.length > 0}
        first={nameBox}
        onDismiss={() => (changed ? setAsking(true) : onClose())}
        onConfirm={() =>
          ticked.length > 0 &&
          onAdd(
            role,
            members.filter((one) => ticked.includes(one.id)),
          )
        }
      >
        <div className="people-add-body">
          <Choices
            legend="Their role"
            choices={EVENT_ROLES.map((one) => ({ name: one, line: ROLE_LINES[one] }))}
            picked={role}
            onPick={(one) => setRole(EVENT_ROLES.find((each) => each === one) ?? FIRST_ROLE)}
          />
          <Field
            label="Name"
            value={typed}
            onChange={setTyped}
            inputRef={nameBox}
            autoComplete="off"
          />
          <section className="desk-block" aria-label={inOrganisation(organisation)}>
            <Head title={inOrganisation(organisation)} level={3} />
            {offered.length > 0 && (
              <ul className="desk-rows has-lead">
                {offered.map((one) => (
                  <li key={one.id}>
                    <label className={ticked.includes(one.id) ? 'desk-row is-picked' : 'desk-row'}>
                      <Avatar initials={one.initials} tone={one.tone} />
                      <RowWords title={one.name} lines={[]} />
                      <input
                        type="checkbox"
                        className="people-check"
                        checked={ticked.includes(one.id)}
                        onChange={() => tick(one.id)}
                      />
                    </label>
                  </li>
                ))}
              </ul>
            )}
            <div role="status">
              {offered.length === 0 && (
                <p className="desk-line">
                  {typed.trim() === ''
                    ? everyoneOn(organisation)
                    : noMatchLine(typed, organisation)}
                </p>
              )}
            </div>
          </section>
        </div>
      </Dialog>
      {asking && (
        <Ask
          title="Discard your changes?"
          line="Nobody is added to this event."
          keep="Keep editing"
          go="Discard"
          onKeep={() => setAsking(false)}
          onGo={onClose}
        />
      )}
    </>
  );
}
