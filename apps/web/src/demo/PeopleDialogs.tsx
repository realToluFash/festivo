import { type KeyboardEvent, useEffect, useEffectEvent, useId, useRef, useState } from 'react';

import { Glyph } from '../components/Glyph.tsx';
import { inWithLine, jobHelp, LABEL_MOST, W } from './doorCode.ts';
import {
  type Address,
  addedToast,
  EVENT_ROLES,
  FIND_LABEL,
  fromOutside,
  NAME_LABEL,
  onAlreadyLine,
  outsideRefusal,
  outsideView,
  PICK_ANOTHER,
  UNUSABLE,
  everyoneOn,
  type EventRole,
  FIRST_ROLE,
  firstName,
  inOrganisation,
  leadOff,
  type Level,
  LEVEL_LINES,
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
  SERVICE_CLOSING,
  SERVICE_HEAD,
  SERVICE_LEVELS,
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
import { AddressIn, WholeAddress } from '../components/WholeAddress.tsx';

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
  asking: askingFirst = false,
  onSaved,
  onLost,
  onClose,
  onRemove,
}: {
  person: OnEvent;
  roleFails: boolean;
  organisation?: string;
  removing?: Removing | undefined;
  asking?: boolean;
  onSaved: (role: Level) => void;
  onLost: (words: string) => void;
  onClose: () => void;
  onRemove: () => void;
}) {
  const name = useId();
  const [picked, setPicked] = useState<Level>(person.role);
  const [saving, setSaving] = useState<Saving>('idle');
  const [lost, setLost] = useState<string | null>(null);
  const [live, setLive] = useState('');
  const [asking, setAsking] = useState(askingFirst || removing?.start != null);
  const [gone, setGone] = useState<number | null>(
    removing?.start === 'held' ? removing.heldMs : null,
  );
  const held = useRef<Level>(person.role);
  const byArrow = useRef(false);
  const settle = useRef<number | undefined>(undefined);
  const sending = useRef<number | undefined>(undefined);
  const open = useRef(true);
  const first = useRef<HTMLInputElement>(null);
  const off: readonly Level[] = rolesOff(person);
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

  function send(role: Level): void {
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

  function pick(role: Level): void {
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

  function row(role: Level) {
    const isOff = off.includes(role);
    const rowClass = ['desk-row', role === picked && 'is-picked', isOff && 'is-off'].filter(
      Boolean,
    );

    return (
      <li key={role}>
        <label className={rowClass.join(' ')}>
          <RowWords
            title={role}
            tag={role === picked && <SavingTag saving={saving} />}
            lines={[isOff ? leadOff(organisation) : LEVEL_LINES[role]]}
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
          <RowWords
            title={<WholeAddress text={person.name} />}
            lines={[sheetLine(person, organisation)]}
          />
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
          <ul className="desk-rows">{EVENT_ROLES.map(row)}</ul>
          {person.outside && (
            <>
              <p className="desk-legend">{SERVICE_HEAD}</p>
              <ul className="desk-rows">{SERVICE_LEVELS.map(row)}</ul>
              <p className="desk-line">{SERVICE_CLOSING}</p>
            </>
          )}
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
          title={<AddressIn text={person.name} words={removeTitle} />}
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

export interface Added {
  role: EventRole;
  members: OrgMember[];
  outside: { address: Address; job: string } | null;
}

/** Add people: members found by name, and someone from outside by email address or mobile number (sc-71). */
export function AddDialog({
  members,
  onEvent,
  viewer,
  organisation,
  country,
  start,
  onClose,
  onAdd,
}: {
  members: readonly OrgMember[];
  onEvent: readonly OnEvent[];
  viewer: PeopleViewer;
  organisation?: string;
  country: string;
  start?: { typed: string; role: EventRole } | undefined;
  onClose: () => void;
  onAdd: (added: Added, finished: boolean) => void;
}) {
  const [role, setRole] = useState<EventRole>(start?.role ?? FIRST_ROLE);
  const [typed, setTyped] = useState(start?.typed ?? '');
  const [ticked, setTicked] = useState<readonly string[]>([]);
  const [outsideOn, setOutsideOn] = useState(true);
  const [job, setJob] = useState('');
  const [refused, setRefused] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const nameBox = useRef<HTMLInputElement>(null);
  const offered = offeredMembers(members, onEvent, viewer, typed, ticked);
  const outside = outsideView(typed, country, role, onEvent);
  const address = outside.kind === 'offer' ? outside.address : null;
  const sendsOutside = address != null && outsideOn;
  const canAdd = ticked.length > 0 || sendsOutside;
  const changed = ticked.length > 0 || role !== FIRST_ROLE || typed.trim() !== '';
  const quiet = outside.kind === 'offer' || outside.kind === 'leadOff';

  function tick(id: string): void {
    setTicked((was) => (was.includes(id) ? was.filter((one) => one !== id) : [...was, id]));
  }

  function add(): void {
    if (!canAdd) return;
    const adding = members.filter((one) => ticked.includes(one.id));
    const said = sendsOutside ? outsideRefusal(address, members) : null;
    if (said == null) {
      onAdd({ role, members: adding, outside: sendsOutside ? { address, job } : null }, true);
      return;
    }
    if (adding.length > 0) {
      onAdd({ role, members: adding, outside: null }, false);
      setTicked([]);
    }
    const went = adding.map((one) => one.name);
    setRefused(went.length === 0 ? said : `${addedToast(went, role)} ${said}`);
  }

  return (
    <>
      <Dialog
        title="Add people"
        verb="Add"
        on={canAdd}
        first={nameBox}
        onDismiss={() => (changed ? setAsking(true) : onClose())}
        onConfirm={add}
      >
        <div className="people-add-body">
          <div role="status">
            {refused != null && (
              <p className="people-outside-notice">
                <Glyph name="alert" size={18} weight={2.3} />
                <span>{refused}</span>
              </p>
            )}
          </div>
          <Choices
            legend="Their role"
            choices={EVENT_ROLES.map((one) => ({ name: one, line: ROLE_LINES[one] }))}
            picked={role}
            onPick={(one) => setRole(EVENT_ROLES.find((each) => each === one) ?? FIRST_ROLE)}
          />
          <Field
            label={role === 'Lead' ? NAME_LABEL : FIND_LABEL}
            value={typed}
            onChange={(value) => {
              setTyped(value);
              setOutsideOn(true);
            }}
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
              {offered.length === 0 && !quiet && (
                <p className="desk-line">
                  {typed.trim() === ''
                    ? everyoneOn(organisation)
                    : noMatchLine(typed, organisation)}
                </p>
              )}
              {outside.kind === 'unusable' && <p className="desk-line">{UNUSABLE}</p>}
              {outside.kind === 'onEvent' && (
                <p className="desk-line">{onAlreadyLine(outside.name)}</p>
              )}
              {outside.kind === 'leadOff' && (
                <>
                  <p className="desk-empty-title">{leadOff(organisation)}</p>
                  <p className="desk-line">{PICK_ANOTHER}</p>
                </>
              )}
            </div>
          </section>
          {address != null && (
            <section className="desk-block" aria-label={fromOutside(organisation)}>
              <Head title={fromOutside(organisation)} level={3} />
              <ul className="desk-rows has-lead">
                <li>
                  <label className={outsideOn ? 'desk-row is-picked' : 'desk-row'}>
                    <span className="people-outside-face" aria-hidden="true">
                      <Glyph name={address.kind === 'email' ? 'mail' : 'phone'} size={18} />
                    </span>
                    <RowWords title={address.shown} lines={[]} />
                    <input
                      type="checkbox"
                      className="people-check"
                      checked={outsideOn}
                      onChange={() => setOutsideOn((was) => !was)}
                    />
                  </label>
                </li>
              </ul>
              {outsideOn && (
                <Field
                  label={W.jobLabel}
                  value={job}
                  help={jobHelp(job)}
                  autoComplete="off"
                  onChange={(value) => setJob(Array.from(value).slice(0, LABEL_MOST).join(''))}
                />
              )}
            </section>
          )}
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
