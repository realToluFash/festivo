import { emailProblem } from '@soirely/domain';
import {
  type FormEvent,
  type KeyboardEvent,
  type RefObject,
  useEffect,
  useEffectEvent,
  useId,
  useRef,
  useState,
} from 'react';

import { offButton } from '../offButton.ts';
import { ADD_WORDS } from './account.ts';
import { Glyph } from '../components/Glyph.tsx';
import {
  type AddressFix,
  type Change,
  type ConvoId,
  type Fix,
  type MessagesState,
  type ReachedOf,
  type Show,
  type ShowItem,
  type Unreached,
  MW,
  NEW_ADDRESS,
  PARKING,
  TICKS,
  changed,
  filled,
  fixWord,
  many,
  outTitle,
  outsIn,
  phoneProblem,
  showAfter,
  showItems,
  shownOf,
  whoOf,
} from './messages.ts';
import { useInbox } from './messagesContext.ts';
import { DeliveryMark, Legend, ReachBar } from './MessagesParts.tsx';
import { MessagesBell } from './MessagesTell.tsx';
import { Field } from '../components/SettingsParts.tsx';

interface Fixing {
  id: string;
  fix: AddressFix;
  typed: string;
}

function showFirst(state: MessagesState | null, of: ReachedOf): Show {
  if (state === 'filtered') return 'bounced';
  if (state === 'told') return 'told';
  if (state === 'added') return 'none';
  if (state === 'addedPhone') return 'optedOut';

  return of === 'new' || of === 'receipts' ? 'everyone' : 'notReached';
}

/** Who it reached, per person and grouped as sc-3966 counts them: a line per channel for Soirely's notice, its fix beside a failure, and their page. */
export function ReachedView({
  of,
  thread,
  state,
}: {
  of: ReachedOf;
  thread: ConvoId;
  state: MessagesState | null;
}) {
  const { inbox, act, focus, tell, whyOff, to } = useInbox();
  const [fixing, setFixing] = useState<Fixing | null>(
    state === 'fix' && of === 'parking'
      ? { id: 'tomas', fix: 'fixEmail', typed: NEW_ADDRESS }
      : null,
  );
  const [show, setShow] = useState<Show>(showFirst(state, of));
  const [menu, setMenu] = useState(state === 'filterMenu' && of === 'parking');
  const [status, setStatus] = useState<string | null>(
    state === 'sentAgain' ? filled(MW.sentToSaid, { name: 'Tomás Ferreira' }) : null,
  );
  const headId = useId();
  const who = whoOf(inbox, of, thread, to.book.groups);
  const { reach } = who;
  const shown = shownOf(who, show);
  const first = outsIn(inbox, thread)[0];
  const back =
    of === 'parking' || of === 'receipts'
      ? PARKING.subject
      : of === 'invite'
        ? MW.invitation
        : first == null
          ? MW.newMessage
          : outTitle(first);
  const resend = who.waiting.length;

  /** The host's own action: the Filter stays unless the group shown is left with nobody, the status says what was done, and focus goes to the list's heading. */
  function hostDid(change: Change, said: string): void {
    act(change);
    setShow(showAfter(whoOf(changed(inbox, change), of, thread, to.book.groups), show));
    setStatus(said);
    focus('not-reached');
  }

  function onFix(person: Unreached, fix: Fix): void {
    if (fix === 'copyLink') tell(`${fixWord(fix)} has its own design.`);
    else if (fix === 'toldInPerson')
      hostDid(
        { kind: 'toldInPerson', id: person.id, thread },
        filled(MW.markedSaid, { name: person.name }),
      );
    else
      setFixing({
        id: person.id,
        fix,
        typed: fix === 'fixEmail' ? (person.address ?? '') : '',
      });
  }

  function onShow(next: Show): void {
    setShow(next);
    focus('not-reached');
  }

  return (
    <div className="mg-in is-reached">
      <div className="mg-reached-top">
        <button
          type="button"
          className="desk-back"
          onClick={() => {
            act({ kind: 'open', id: thread });
            focus('heading');
          }}
        >
          <Glyph name="back" size={17} weight={2.4} />
          {back}
        </button>
        <span className="today-grow" />
        <MessagesBell />
      </div>
      <div className="mg-reached-body">
        <div role="status">
          {status != null && (
            <p className="mg-status">
              <Glyph name="info" size={15} weight={2.2} />
              {status}
            </p>
          )}
        </div>
        <h2 className="mg-reached-sum" tabIndex={-1} data-focus="heading">
          {filled(of === 'new' ? MW.reachedSoFar : MW.reached, {
            count: reach.reached,
            total: reach.of,
          })}
        </h2>
        <p className="mg-reached-line">{who.line}</p>
        <ReachBar reach={reach} size="big" />
        <Legend reach={reach} />
        <div className="mg-reached-head">
          <h3 id={headId} tabIndex={-1} data-focus="not-reached">
            {shown.heading}
          </h3>
          <ShowMenu
            items={showItems(who)}
            show={show}
            open={menu}
            onOpen={() => setMenu(true)}
            onClose={() => setMenu(false)}
            onShow={setShow}
          />
        </div>
        {shown.empty != null && (
          <div className="mg-told-none">
            <p>{shown.empty}</p>
            {show !== 'notReached' && (
              <button type="button" className="desk-text" onClick={() => onShow('notReached')}>
                {MW.showNotReached}
              </button>
            )}
          </div>
        )}
        {shown.groups
          .filter((group) => group.count > 0)
          .map((group) => (
            <section
              key={group.key}
              className="mg-group-of"
              aria-label={`${group.name} · ${group.count}`}
            >
              <h4 className="mg-group-head">
                {group.name}
                <span className="mg-section-count"> · {group.count}</span>
              </h4>
              <ul className="mg-people">
                {group.people.map((person) => (
                  <Person
                    key={person.id}
                    person={person}
                    fixing={fixing?.id === person.id ? fixing : null}
                    marked={group.key === 'told'}
                    onFix={(fix) => onFix(person, fix)}
                    onSave={(address) => {
                      if (fixing == null) return;
                      setFixing(null);
                      act({ kind: 'fixed', id: person.id, thread, fix: fixing.fix, address });
                      focus('again');
                    }}
                    onCancel={() => {
                      setFixing(null);
                      focus(`fix:${person.id}`);
                    }}
                    onNotNow={() => {
                      act({ kind: 'notNow', id: person.id, thread });
                      focus(`person:${person.id}`);
                    }}
                    onAgain={() =>
                      hostDid(
                        { kind: 'sendAgain', id: person.id, thread },
                        filled(MW.sentToSaid, { name: person.name }),
                      )
                    }
                    onUndo={() =>
                      hostDid(
                        { kind: 'undoTold', id: person.id, thread },
                        filled(MW.unmarkedSaid, { name: person.name }),
                      )
                    }
                  />
                ))}
              </ul>
              {group.more > 0 && <p className="mg-more">{many('andMore', group.more)}</p>}
            </section>
          ))}
      </div>
      {resend > 0 && to.manage && (
        <button
          type="button"
          className="button button-primary mg-resend"
          data-focus="resend"
          aria-describedby={whyOff}
          {...offButton(whyOff != null)}
          onClick={() => {
            act({ kind: 'open', id: thread });
            act({ kind: 'resend', resend: TICKS });
            focus('check');
          }}
        >
          {many('resend', resend)}
        </button>
      )}
    </div>
  );
}

/** The Filter, as the desk's menus drop: a tick on the one shown, Escape back to the button. */
function ShowMenu({
  items,
  show,
  open,
  onOpen,
  onClose,
  onShow,
}: {
  items: readonly ShowItem[];
  show: Show;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onShow: (show: Show) => void;
}) {
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLUListElement>(null);
  const closeOutside = useEffectEvent(onClose);

  useEffect(() => {
    if (!open) return;

    const all = [...(menu.current?.querySelectorAll<HTMLElement>('[role=menuitemradio]') ?? [])];
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;

      if (!menu.current?.contains(target) && !button.current?.contains(target)) closeOutside();
    };

    (all.find((item) => item.getAttribute('aria-checked') === 'true') ?? all[0])?.focus();
    document.addEventListener('pointerdown', outside);

    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);

  function close(back: boolean): void {
    onClose();
    if (back) button.current?.focus();
  }

  function keys(event: KeyboardEvent<HTMLUListElement>): void {
    const all = [...(menu.current?.querySelectorAll<HTMLElement>('[role=menuitemradio]') ?? [])];
    const at = all.indexOf(document.activeElement as HTMLElement);

    event.stopPropagation();
    if (event.key === 'Escape') {
      event.preventDefault();
      close(true);
    } else if (event.key === 'Tab') close(false);
    else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const next = at + (event.key === 'ArrowDown' ? 1 : -1);
      all[(next + all.length) % all.length]?.focus();
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      (event.key === 'Home' ? all[0] : all.at(-1))?.focus();
    }
  }

  return (
    <div className="desk-menu-at">
      <button
        ref={button}
        id={id}
        type="button"
        className="desk-filter"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? `${id}-menu` : undefined}
        onClick={() => (open ? onClose() : onOpen())}
      >
        {MW.filter}
        <Glyph name={open ? 'chevup' : 'chevdown'} size={16} weight={2.4} />
      </button>
      {open && (
        <ul
          ref={menu}
          id={`${id}-menu`}
          className="desk-menu mg-show-menu"
          role="menu"
          aria-labelledby={id}
          onKeyDown={keys}
        >
          {items.map((item) => (
            <li key={item.key} role="none">
              <button
                type="button"
                role="menuitemradio"
                aria-checked={item.key === show}
                aria-label={`${item.word} · ${item.count}`}
                tabIndex={-1}
                className="desk-menu-item"
                onClick={() => {
                  onShow(item.key);
                  close(true);
                }}
              >
                <span className="desk-menu-tick">
                  {item.key === show && <Glyph name="tick" size={16} weight={2.6} />}
                </span>
                <span className="today-grow">{item.word}</span>
                <span className="desk-menu-count">{item.count}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Person({
  person,
  fixing,
  marked,
  onFix,
  onSave,
  onCancel,
  onNotNow,
  onAgain,
  onUndo,
}: {
  person: Unreached;
  fixing: Fixing | null;
  marked: boolean;
  onFix: (fix: Fix) => void;
  onSave: (address: string) => void;
  onCancel: () => void;
  onNotNow: () => void;
  onAgain: () => void;
  onUndo: () => void;
}) {
  const { whyOff, to } = useInbox();
  const lines = fixing?.fix === 'fixEmail' ? person.lines.slice(0, 1) : person.lines;

  return (
    <li className="mg-person">
      <span className="mg-avatar is-40" aria-hidden="true">
        {person.initials}
      </span>
      <div className="mg-person-words">
        <p className="mg-person-name" tabIndex={-1} data-focus={`person:${person.id}`}>
          {person.name}
        </p>
        <ul className="mg-person-lines">
          {lines.map((line) => (
            <li key={line.word}>
              <DeliveryMark kind={line.mark} />
              <span>
                <strong>{line.word}</strong>
                {line.why != null && ` · ${line.why}`}
              </span>
            </li>
          ))}
        </ul>
        {person.updated != null && fixing == null && (
          <p className="mg-person-updated">
            <DeliveryMark kind="notsent" />
            <span className="mg-person-updated-words">
              <strong>{MW.updatedNotSent}</strong>
              {person.updated.map((words) => (
                <span key={words}>{words}</span>
              ))}
            </span>
          </p>
        )}
        {fixing != null ? (
          <FixForm person={person} fixing={fixing} onSave={onSave} onCancel={onCancel} />
        ) : !to.manage ? null : person.offer === true ? (
          <>
            <button
              type="button"
              className="button button-primary mg-again"
              data-focus="again"
              aria-describedby={whyOff}
              onClick={onAgain}
              {...offButton(whyOff != null)}
            >
              <Glyph name="send" size={17} weight={2.4} />
              {filled(MW.sendAgain, { name: person.name })}
            </button>
            <div className="mg-acts">
              <button type="button" className="desk-text" onClick={onNotNow}>
                {MW.notNow}
              </button>
            </div>
          </>
        ) : marked ? (
          <div className="mg-acts">
            <button type="button" className="desk-text" onClick={onUndo}>
              {MW.undo}
            </button>
          </div>
        ) : (
          <div className="mg-acts">
            {person.fixes.map((fix) => (
              <button
                key={fix}
                type="button"
                className="desk-text"
                data-focus={`fix:${person.id}`}
                onClick={() => onFix(fix)}
              >
                {fixWord(fix)}
              </button>
            ))}
          </div>
        )}
      </div>
    </li>
  );
}

function FixForm({
  person,
  fixing,
  onSave,
  onCancel,
}: {
  person: Unreached;
  fixing: Fixing;
  onSave: (address: string) => void;
  onCancel: () => void;
}) {
  const [address, setAddress] = useState(fixing.typed);
  const [wrong, setWrong] = useState<string | null>(null);
  const field = useRef<HTMLInputElement>(null);
  const phone = fixing.fix === 'addPhone';

  useEffect(() => {
    window.setTimeout(() => field.current?.focus(), 0);
  }, []);

  function save(event: FormEvent): void {
    event.preventDefault();

    const problem = phone
      ? phoneProblem(address)
      : emailProblem(address) == null
        ? null
        : ADD_WORDS.shape;

    if (problem != null) {
      setWrong(problem);
      return;
    }
    onSave(address.trim());
  }

  function typed(value: string): void {
    setAddress(value);
    setWrong(null);
  }

  return (
    <form className="mg-fix" onSubmit={save} noValidate>
      {phone ? (
        <PhoneField value={address} inputRef={field} onChange={typed} error={wrong} />
      ) : (
        <Field
          label={MW.emailAddress}
          value={address}
          inputRef={field}
          onChange={typed}
          inputMode="email"
          autoComplete="off"
          {...(fixing.fix === 'fixEmail'
            ? { help: filled(MW.wasAddress, { address: person.address ?? '' }) }
            : {})}
          error={wrong}
        />
      )}
      <div className="mg-acts">
        <button type="submit" className="button button-primary mg-save">
          {MW.save}
        </button>
        <button type="button" className="desk-text" onClick={onCancel}>
          {MW.cancel}
        </button>
      </div>
    </form>
  );
}

function PhoneField({
  value,
  inputRef,
  error,
  onChange,
}: {
  value: string;
  inputRef: RefObject<HTMLInputElement | null>;
  error: string | null;
  onChange: (value: string) => void;
}) {
  const id = useId();

  return (
    <div className="desk-field">
      <label htmlFor={id} className="desk-label">
        {MW.mobileNumber}
      </label>
      <div className={error == null ? 'desk-box' : 'desk-box is-wrong'}>
        <input
          ref={inputRef}
          id={id}
          type="tel"
          inputMode="tel"
          autoComplete="off"
          value={value}
          spellCheck={false}
          aria-invalid={error != null}
          aria-describedby={error == null ? undefined : `${id}-error`}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
      {error != null && (
        <p id={`${id}-error`} className="desk-error">
          <Glyph name="alert" size={15} weight={2.2} />
          {error}
        </p>
      )}
    </div>
  );
}
