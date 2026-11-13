import {
  ApiError,
  GUEST_NAME_MAXIMUM,
  type Guest,
  type GuestDetails,
  type TaggedGuest,
} from '@soirely/api-client';
import { formatPhone, phoneE164, phoneFields } from '@soirely/domain';
import { type ReactNode, useEffect, useEffectEvent, useId, useRef, useState } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

import { api } from '../../../api.ts';
import { Glyph, type GlyphName } from '../../../components/Glyph.tsx';
import { Ask, Head, RowWords } from '../../../components/SettingsParts.tsx';
import { dateLocale } from '../../../i18n/index.ts';
import { focusWhenFree } from '../../../layers.ts';
import { type Mesh } from '../../../mesh.ts';
import { offButton } from '../../../offButton.ts';
import { phoneProblemMessage } from '../../../phoneProblem.ts';
import { CompanionField, GuestField, PhoneField } from './GuestFields.tsx';
import {
  MOST_COMPANIONS,
  type Problem,
  type Problems,
  type ReplyWord,
  type Typed,
  blank,
  firstProblem,
  isListed,
  newGuestOf,
  problemsOf,
  violationProblems,
} from './guestRows.ts';

const SHOWN_COMPANIONS = 3;
const PIECES = [1, 2, 3, 4, 5, 6];

export const REPLY_KEY: Record<ReplyWord, string> = {
  coming: 'guestList.reply.coming',
  maybe: 'guestList.reply.maybe',
  notComing: 'guestList.reply.notComing',
  noReply: 'guestList.reply.noReply',
  held: 'guestList.reply.held',
};

export function replyDate(repliedAt: string, timeZone: string): string {
  return new Intl.DateTimeFormat(dateLocale(), { month: 'short', day: 'numeric', timeZone }).format(
    new Date(repliedAt),
  );
}

const MARK: Record<ReplyWord, string> = {
  coming: 'is-coming',
  maybe: 'is-maybe',
  notComing: 'is-not-coming',
  noReply: 'is-no-reply',
  held: 'is-held',
};

export function ReplyMark({ reply, cover = false }: { reply: ReplyWord; cover?: boolean }) {
  const size = cover ? 16 : 22;

  return (
    <span className={`gs-mark ${MARK[reply]}${cover ? ' is-16 on-cover' : ''}`} aria-hidden="true">
      {reply === 'coming' && <Glyph name="tick" size={Math.round(size * 0.68)} weight={3.2} />}
      {reply === 'notComing' && <span className="gs-bar" />}
      {reply === 'maybe' && <Glyph name="question" size={Math.round(size * 0.8)} weight={2.8} />}
    </span>
  );
}

function MarkLead({ reply }: { reply: ReplyWord }) {
  return (
    <span className="gs-lead">
      <ReplyMark reply={reply} />
    </span>
  );
}

function IconLead({ name }: { name: GlyphName }) {
  return (
    <span className="gs-lead is-icon" aria-hidden="true">
      <Glyph name={name} size={20} weight={2} />
    </span>
  );
}

/** "Guest of Bisi Adewale", numbered after the first unnamed one, as the list names them. */
export function companionShown(
  t: TFunction,
  host: string,
  names: readonly (string | null)[],
  at: number,
): string {
  const name = names[at];

  if (!blank(name ?? null)) return (name ?? '').trim();
  const nth = names.slice(0, at + 1).filter((one) => blank(one)).length;

  return nth > 1 ? t('guestList.guestOfNth', { host, nth }) : t('guestList.guestOf', { host });
}

/** A guest's address on the list (sc-3773): opening it opens them beside the list. */
export function guestAddress(eventId: string, guestId: string): string {
  return `/app/events/${encodeURIComponent(eventId)}/guests?guest=${encodeURIComponent(guestId)}`;
}

type Pane =
  | { kind: 'loading' }
  | { kind: 'failed' }
  | { kind: 'notFound' }
  | { kind: 'guest'; tagged: TaggedGuest }
  | { kind: 'edit'; tagged: TaggedGuest };

type Copy =
  { kind: 'none' } | { kind: 'copied' } | { kind: 'byHand'; url: string } | { kind: 'failed' };

type Replace =
  { kind: 'none' } | { kind: 'asking'; busy: boolean } | { kind: 'failed' } | { kind: 'replaced' };

/** The guest beside the list: their card, the wrong-person notice (sc-1526), Details (sc-3773), then Invitation for those who can add guests (sc-1526); or Edit in their place. */
export function GuestColumn({
  eventId,
  guestId,
  timeZone,
  mesh,
  manages,
  guests,
  country,
  stamp,
  invites,
  flagged,
  onCopy,
  onReplace,
  focus,
  onDirty,
  onAsk,
  onSaved,
  onShown,
  onClose,
}: {
  eventId: string;
  guestId: string;
  timeZone: string;
  mesh: Mesh;
  manages: boolean;
  guests: readonly Guest[];
  country: string;
  /** Raised on each change published to the list; the guest is read again unless being edited. */
  stamp: number;
  invites: boolean;
  /** Someone who opened this guest's link pressed Tell them; only ever true for those who can add guests. */
  flagged: boolean;
  /** The whole link; refused 409 on a phase that does not invite. */
  onCopy: () => Promise<string>;
  onReplace: () => Promise<void>;
  focus: (...keys: string[]) => void;
  onDirty: (dirty: boolean) => void;
  /** Asks "Discard your changes?" and runs `then` only on Discard. */
  onAsk: (then: () => void) => void;
  onSaved: (guest: GuestDetails) => void;
  /** Once the guest, or why they cannot be shown, first replaces the loading bones. */
  onShown: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [pane, setPane] = useState<Pane>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const editing = useRef(false);
  const missed = useRef(false);
  const shown = pane.kind !== 'loading';
  const showing = useEffectEvent(onShown);

  useEffect(() => {
    editing.current = pane.kind === 'edit';
  });

  useEffect(() => {
    if (shown) showing();
  }, [shown]);

  useEffect(() => {
    if (editing.current) {
      missed.current = true;
      return;
    }
    let current = true;

    api.guest(eventId, guestId).then(
      (tagged) => current && setPane({ kind: 'guest', tagged }),
      (error: unknown) =>
        current &&
        setPane((was) =>
          error instanceof ApiError && error.status === 404
            ? { kind: 'notFound' }
            : was.kind === 'guest'
              ? was
              : { kind: 'failed' },
        ),
    );

    return () => {
      current = false;
    };
  }, [eventId, guestId, stamp, attempt]);

  if (pane.kind === 'loading') {
    return (
      <div className="desk-loading gs-bones" role="status" aria-busy="true">
        <span className="desk-unseen">{t('pending.loading')}</span>
        <span className="desk-sunk gs-bone-guest" aria-hidden="true" />
        <ul className="desk-rows gs-rows" aria-hidden="true">
          {[1, 2, 3].map((bone) => (
            <li key={bone} className="desk-row is-bones">
              <span className="desk-sunk gs-bone-icon" />
              <span className="desk-row-words">
                <span className={`desk-sunk is-title b${bone}`} />
                <span className={`desk-sunk is-line b${bone}`} />
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (pane.kind === 'failed') {
    return (
      <div className="desk-failed gs-failed" role="alert">
        <h2 tabIndex={-1} data-focus="guest-heading">
          {t('guestList.loadFailed')}
        </h2>
        <p className="desk-line">{t('guestList.loadFailedLine')}</p>
        <button
          type="button"
          className="desk-text"
          onClick={() => {
            setPane({ kind: 'loading' });
            setAttempt((n) => n + 1);
          }}
        >
          {t('events.retry')}
        </button>
      </div>
    );
  }

  if (pane.kind === 'notFound') {
    return (
      <div className="gs-gone" role="alert">
        <h2 tabIndex={-1} data-focus="guest-heading">
          {t('guestList.notFound')}
        </h2>
        <p className="desk-line">{t('guestList.notFoundLine')}</p>
        <button type="button" className="gs-pill is-secondary" onClick={onClose}>
          {t('guestList.backToGuests')}
        </button>
      </div>
    );
  }

  if (pane.kind === 'edit') {
    const leave = (tagged: TaggedGuest): void => {
      onDirty(false);
      setPane({ kind: 'guest', tagged });
      if (missed.current) {
        missed.current = false;
        setAttempt((n) => n + 1);
      }
    };

    return (
      <EditForm
        eventId={eventId}
        tagged={pane.tagged}
        guests={guests}
        country={country}
        focus={focus}
        onDirty={onDirty}
        onCancel={(dirty) => {
          const back = () => {
            leave(pane.tagged);
            focus('edit');
          };

          if (dirty) onAsk(back);
          else back();
        }}
        onGone={() => {
          onDirty(false);
          setPane({ kind: 'notFound' });
          focus('guest-heading');
        }}
        onSaved={(tagged, changed) => {
          leave(tagged);
          if (changed) onSaved(tagged.guest);
          focus('edit');
        }}
      />
    );
  }

  return (
    <GuestView
      guest={pane.tagged.guest}
      timeZone={timeZone}
      mesh={mesh}
      manages={manages}
      invites={invites}
      flagged={flagged}
      onCopy={onCopy}
      onReplace={onReplace}
      onEdit={() => {
        setPane({ kind: 'edit', tagged: pane.tagged });
        focus('fullName');
      }}
    />
  );
}

function GuestView({
  guest,
  timeZone,
  mesh,
  manages,
  invites,
  flagged,
  onCopy,
  onReplace,
  onEdit,
}: {
  guest: GuestDetails;
  timeZone: string;
  mesh: Mesh;
  manages: boolean;
  invites: boolean;
  flagged: boolean;
  onCopy: () => Promise<string>;
  onReplace: () => Promise<void>;
  onEdit: () => void;
}) {
  const { t } = useTranslation();
  const heading = useId();
  const [copy, setCopy] = useState<Copy>({ kind: 'none' });
  const [replace, setReplace] = useState<Replace>({ kind: 'none' });
  const replaceButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (replace.kind === 'replaced') focusWhenFree(() => replaceButton.current);
  }, [replace.kind]);

  function copied(): void {
    onCopy().then(
      (url) => {
        const byHand = () => setCopy({ kind: 'byHand', url });

        if (navigator.clipboard == null) byHand();
        else navigator.clipboard.writeText(url).then(() => setCopy({ kind: 'copied' }), byHand);
      },
      () => setCopy({ kind: 'failed' }),
    );
  }

  function replaced(): void {
    setReplace({ kind: 'asking', busy: true });
    onReplace().then(
      () => {
        setCopy({ kind: 'none' });
        setReplace({ kind: 'replaced' });
      },
      () => setReplace({ kind: 'failed' }),
    );
  }

  const ask = () => setReplace({ kind: 'asking', busy: false });
  const added = new Intl.DateTimeFormat(dateLocale(), {
    month: 'short',
    day: 'numeric',
  }).format(new Date(guest.added.at));
  const names = guest.companions.map((one) => one.fullName);
  const replied = guest.repliedAt == null ? null : replyDate(guest.repliedAt, timeZone);

  return (
    <div className="gs-guest">
      {replace.kind === 'replaced' && (
        <p className="gs-ok" role="status">
          <Glyph name="tick" size={17} weight={2.6} />
          {t('guestList.linkReplaced', { name: guest.fullName })}
        </p>
      )}
      <section
        className={`ev-card today-cover is-${mesh} gs-card is-guest`}
        aria-labelledby={heading}
      >
        <span className="ev-scrim" aria-hidden="true" />
        {PIECES.map((piece) => (
          <span key={piece} className={`desk-piece p${piece}`} aria-hidden="true" />
        ))}
        <div className="ev-card-inner gs-card-inner">
          <ul className="desk-glass-tags">
            <li className="desk-glass">
              <ReplyMark reply={guest.reply} cover />
              {t(REPLY_KEY[guest.reply])}
            </li>
          </ul>
          <h2 id={heading} className="gs-name" tabIndex={-1} data-focus="guest-heading">
            {guest.fullName}
          </h2>
          {replied != null && (
            <p className="desk-on-card">
              {t('guestList.replied', { reply: t(REPLY_KEY[guest.reply]), date: replied })}
            </p>
          )}
        </div>
      </section>
      {manages && flagged && (
        <WrongPerson name={guest.fullName} heading={heading} onReplace={ask} />
      )}
      {replace.kind === 'failed' && (
        <p className="desk-error gs-refused" role="alert">
          <Glyph name="alert" size={15} weight={2.2} />
          {t('guestList.notReplaced')}
        </p>
      )}
      {replied != null && (
        <section className="desk-block" aria-labelledby={`${heading}-reply`}>
          <Head
            level={3}
            title={<span id={`${heading}-reply`}>{t('guestList.replyHeading')}</span>}
          />
          <ul className="desk-rows gs-rows">
            <li className="desk-row">
              <MarkLead reply={guest.reply} />
              <RowWords
                title={t(REPLY_KEY[guest.reply])}
                lines={[t('guestList.repliedOn', { date: replied })]}
              />
            </li>
          </ul>
        </section>
      )}
      {(manages || guest.companions.length > 0) && (
        <section className="desk-block" aria-labelledby={`${heading}-details`}>
          <Head level={3} title={<span id={`${heading}-details`}>{t('guestList.details')}</span>}>
            {manages && (
              <button type="button" className="desk-text" data-focus="edit" onClick={onEdit}>
                {t('guestList.edit')}
              </button>
            )}
          </Head>
          <ul className="desk-rows gs-rows">
            {manages && (
              <>
                <li className={guest.email == null ? 'desk-row is-none' : 'desk-row'}>
                  <IconLead name="mail" />
                  <RowWords
                    title={guest.email ?? t('guestList.none')}
                    lines={[t('guestList.emailAddress')]}
                  />
                </li>
                <li className={guest.mobile == null ? 'desk-row is-none' : 'desk-row'}>
                  <IconLead name="phone" />
                  <RowWords
                    title={guest.mobile == null ? t('guestList.none') : formatPhone(guest.mobile)}
                    lines={[t('guestList.mobileNumber')]}
                  />
                </li>
              </>
            )}
            {guest.companions.map((companion, at) => (
              <li key={companion.id} className="desk-row">
                <MarkLead reply={companion.state} />
                <RowWords
                  title={companionShown(t, guest.fullName, names, at)}
                  lines={[
                    companion.state === 'held'
                      ? t('guestList.heldCompanion')
                      : t('guestList.companionLine', { reply: t(REPLY_KEY[companion.state]) }),
                  ]}
                />
              </li>
            ))}
            {manages && (
              <li className="desk-row">
                <IconLead name="user" />
                <RowWords
                  title={
                    guest.added.by == null
                      ? added
                      : t('guestList.addedBy', { date: added, name: guest.added.by })
                  }
                  lines={[t('guestList.added')]}
                />
              </li>
            )}
          </ul>
        </section>
      )}
      {manages && (
        <section className="desk-block" aria-labelledby={`${heading}-invitation`}>
          <Head
            level={3}
            title={<span id={`${heading}-invitation`}>{t('guestList.invitation')}</span>}
          />
          <ul className="desk-rows gs-rows">
            {invites && (
              <li>
                <button type="button" className="desk-row gs-do" data-focus="copy" onClick={copied}>
                  <IconLead name="link" />
                  <RowWords title={t('guestList.copyLink')} lines={[t('guestList.copyLinkLine')]} />
                </button>
                <p className="gs-copied" role="status">
                  {copy.kind === 'copied' && (
                    <span>
                      <Glyph name="tick" size={16} weight={2.6} />
                      {t('guestList.linkCopied')}
                    </span>
                  )}
                </p>
                {copy.kind === 'byHand' && <CopyByHand url={copy.url} />}
                {copy.kind === 'failed' && (
                  <p className="gs-refused" role="alert">
                    {t('guestList.loadFailedLine')}
                  </p>
                )}
              </li>
            )}
            <li>
              <button
                ref={replaceButton}
                type="button"
                className="desk-row gs-do"
                data-focus="replace"
                onClick={ask}
              >
                <IconLead name="refresh" />
                <RowWords
                  title={t('guestList.replaceLink')}
                  lines={[t('guestList.replaceLinkLine')]}
                />
              </button>
            </li>
          </ul>
        </section>
      )}
      {replace.kind === 'asking' && (
        <Ask
          title={t('guestList.replaceTitle', { name: guest.fullName })}
          line={t('guestList.replaceLine')}
          keep={t('guestList.keepIt')}
          go={t('guestList.replace')}
          red={false}
          busy={replace.busy ? t('guestList.replace') : undefined}
          onKeep={() => setReplace({ kind: 'none' })}
          onGo={replaced}
        />
      )}
    </div>
  );
}

/** Marked by the triangle and the words, not the amber alone; there when the page opens, so a region, not an alert. */
function WrongPerson({
  name,
  heading,
  onReplace,
}: {
  name: string;
  heading: string;
  onReplace: () => void;
}) {
  const { t } = useTranslation();

  return (
    <section className="gs-amber" aria-labelledby={`${heading}-flag`}>
      <h3 id={`${heading}-flag`} className="gs-amber-head">
        <Glyph name="warn" size={17} weight={2.2} />
        {t('guestList.flaggedTitle')}
      </h3>
      <p className="gs-amber-line">{t('guestList.flaggedLine', { name })}</p>
      <button type="button" className="desk-text" data-focus="flag-replace" onClick={onReplace}>
        {t('guestList.replaceLink')}
      </button>
    </section>
  );
}

/** The browser kept the clipboard, so the link is selected to copy by hand. */
function CopyByHand({ url }: { url: string }) {
  const { t } = useTranslation();
  const id = useId();
  const field = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    field.current?.focus();
    field.current?.select();
  }, []);

  return (
    <div className="desk-field gs-by-hand">
      <label htmlFor={id} className="desk-label">
        {t('guestList.invitationLink')}
      </label>
      <textarea
        ref={field}
        id={id}
        className="gs-link"
        readOnly
        rows={2}
        value={url}
        aria-describedby={`${id}-help`}
        onFocus={(event) => event.target.select()}
      />
      <p id={`${id}-help`} className="desk-help">
        {t('guestList.clipboardRefused')}
      </p>
    </div>
  );
}

interface Values {
  fullName: string;
  email: string;
  country: string;
  number: string;
  companions: readonly { id: string | null; name: string }[];
}

function valuesOf(guest: GuestDetails, country: string): Values {
  const phone = guest.mobile == null ? null : phoneFields(guest.mobile);

  return {
    fullName: guest.fullName,
    email: guest.email ?? '',
    country: phone?.country ?? country,
    number: phone?.number ?? guest.mobile ?? '',
    companions: guest.companions.map((one) => ({ id: one.id, name: one.fullName ?? '' })),
  };
}

function typedOf(values: Values): Typed {
  return { ...values, companions: values.companions.map((one) => one.name) };
}

function mobileOf(values: Values): string | null {
  const number = values.number.trim();

  return number === ''
    ? null
    : (phoneE164(number, values.country) ?? `${values.country} ${number}`);
}

type Field = 'fullName' | 'email' | 'mobile' | 'companions';

const FIELDS: readonly Field[] = ['fullName', 'email', 'mobile', 'companions'];

/** What the API would keep of each field, so a save that changes nothing sends nothing. */
function keptOf(values: Values): Record<Field, string> {
  const sent = newGuestOf(typedOf(values), false);

  return {
    fullName: sent.fullName,
    email: JSON.stringify(sent.email),
    mobile: JSON.stringify(mobileOf(values)),
    companions: JSON.stringify(
      values.companions.map((one, at) => [one.id, sent.companions?.[at]?.fullName ?? null]),
    ),
  };
}

function kept(values: Values): string {
  return JSON.stringify(keptOf(values));
}

/** The fields this host changed against the version they opened or took with Use theirs, with those held through a Keep mine. */
function changedOf(values: Values, base: Values, held: readonly Field[] = []): readonly Field[] {
  const now = keptOf(values);
  const was = keptOf(base);

  return FIELDS.filter((field) => held.includes(field) || now[field] !== was[field]);
}

/** Their version with only this host's changed fields taken from the form, so Keep mine overwrites nothing a colleague changed. */
function mergedOf(values: Values, theirs: Values, changed: readonly Field[]): Values {
  const mine = (field: Field) => changed.includes(field);
  const held = new Set(theirs.companions.map((one) => one.id));

  return {
    fullName: mine('fullName') ? values.fullName : theirs.fullName,
    email: mine('email') ? values.email : theirs.email,
    country: mine('mobile') ? values.country : theirs.country,
    number: mine('mobile') ? values.number : theirs.number,
    companions: mine('companions')
      ? values.companions.map((one) => (held.has(one.id) ? one : { ...one, id: null }))
      : theirs.companions,
  };
}

type Differs = readonly { key: Field; field: string; theirs: string; yours: string }[];

/** Edit (sc-3773), in place in the guest's column: refused before sending, a duplicate asked about, a colleague's change (412) held at the top. */
function EditForm({
  eventId,
  tagged,
  guests,
  country,
  focus,
  onDirty,
  onCancel,
  onGone,
  onSaved,
}: {
  eventId: string;
  tagged: TaggedGuest;
  guests: readonly Guest[];
  country: string;
  focus: (...keys: string[]) => void;
  onDirty: (dirty: boolean) => void;
  onCancel: (dirty: boolean) => void;
  onGone: () => void;
  onSaved: (tagged: TaggedGuest, changed: boolean) => void;
}) {
  const { t } = useTranslation();
  const [host, setHost] = useState(tagged.guest);
  const [base, setBase] = useState(() => valuesOf(tagged.guest, country));
  const [values, setValues] = useState<Values>(base);
  const [tag, setTag] = useState(tagged.tag);
  const [tried, setTried] = useState(false);
  const [refused, setRefused] = useState<Problems>({});
  const [duplicate, setDuplicate] = useState<'asked' | 'kept' | null>(null);
  const [held, setHeld] = useState<readonly Field[]>([]);
  const [conflict, setConflict] = useState<{
    theirs: TaggedGuest;
    differs: Differs;
    sent: Values;
    changed: readonly Field[];
  } | null>(null);
  const [failed, setFailed] = useState(false);
  const [said, setSaid] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const form = useRef<HTMLDivElement>(null);
  const typed = typedOf(values);
  const problems: Problems = { ...(tried ? problemsOf(typed) : {}), ...refused };
  const dirty = kept(values) !== kept(base);

  useEffect(() => onDirty(dirty), [dirty, onDirty]);

  const onEscape = useEffectEvent((key: globalThis.KeyboardEvent) => {
    if (key.key !== 'Escape' || key.defaultPrevented) return;
    key.preventDefault();
    onCancel(dirty);
  });

  useEffect(() => {
    const at = form.current;
    const listen = (key: globalThis.KeyboardEvent) => onEscape(key);

    at?.addEventListener('keydown', listen);

    return () => at?.removeEventListener('keydown', listen);
  });

  function change(next: Partial<Values>): void {
    setValues((was) => ({ ...was, ...next }));
    setRefused({});
    if (next.fullName != null && duplicate === 'asked') setDuplicate(null);
  }

  function words(key: string): string | undefined {
    const problem: Problem | undefined = problems[key];

    if (problem == null) return undefined;
    if (typeof problem === 'object') return problem.refused;
    if (problem === 'blank') return t('guestList.blankName');
    if (problem === 'tooLong') return t('guestList.nameTooLong', { most: GUEST_NAME_MAXIMUM });
    if (problem === 'emailShape') return t('forms.emailShape');

    return (
      phoneProblemMessage(
        problem === 'phoneTooShort'
          ? 'tooShort'
          : problem === 'phoneTooLong'
            ? 'tooLong'
            : 'noCountry',
        values.country,
        t,
      ) ?? undefined
    );
  }

  function differs(theirs: GuestDetails, sent: Values, changed: readonly Field[]): Differs {
    const mine = newGuestOf(typedOf(sent), false);
    const theirNames = theirs.companions.map((one, at) =>
      companionShown(
        t,
        theirs.fullName,
        theirs.companions.map((c) => c.fullName),
        at,
      ),
    );
    const myNames = sent.companions.map((_, at) =>
      companionShown(
        t,
        mine.fullName,
        sent.companions.map((c) => c.name),
        at,
      ),
    );
    const none = t('guestList.none');
    const mobile = mobileOf(sent);
    const rows: Differs = [
      {
        key: 'fullName',
        field: t('account.fullName'),
        theirs: theirs.fullName,
        yours: mine.fullName,
      },
      {
        key: 'email',
        field: t('guestList.emailAddress'),
        theirs: theirs.email ?? none,
        yours: mine.email ?? none,
      },
      {
        key: 'mobile',
        field: t('guestList.mobileNumber'),
        theirs: theirs.mobile == null ? none : formatPhone(theirs.mobile),
        yours: mobile == null ? none : formatPhone(mobile),
      },
      {
        key: 'companions',
        field: t('guestList.companionsTitle'),
        theirs: theirNames.join(', ') || none,
        yours: myNames.join(', ') || none,
      },
    ];

    return rows.filter((row) => changed.includes(row.key) && row.theirs !== row.yours);
  }

  async function send(
    allowDuplicate: boolean,
    against: string,
    sending = values,
    changed = changedOf(values, base, held),
  ): Promise<void> {
    setBusy(true);
    setFailed(false);
    try {
      const sent = newGuestOf(typedOf(sending), allowDuplicate);
      const saved = await api.updateGuest(
        eventId,
        host.id,
        {
          ...sent,
          companions: sending.companions.map((one, at) => ({
            id: one.id,
            fullName: sent.companions?.[at]?.fullName ?? null,
          })),
        },
        against,
      );

      onSaved(saved, true);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) onGone();
      else if (error instanceof ApiError && error.status === 412) {
        try {
          const theirs = await api.guest(eventId, host.id);
          const rows = differs(theirs.guest, sending, changed);

          if (rows.length === 0) onSaved(theirs, false);
          else {
            setConflict({ theirs, differs: rows, sent: sending, changed });
            focus('conflict');
          }
        } catch (again) {
          if (again instanceof ApiError && again.status === 404) onGone();
          else setFailed(true);
        }
      } else if (error instanceof ApiError && error.code === 'guest_already_listed') {
        setDuplicate('asked');
        focus('duplicate');
      } else if (error instanceof ApiError && error.status === 422) {
        const found = violationProblems(error.problem.violations ?? [], typedOf(sending));
        const at = firstProblem(found, sending.companions.length);

        if (at == null) setFailed(true);
        else {
          setRefused(found);
          focus(at === 'mobile' && found.mobile === 'noCountry' ? 'country' : at);
        }
      } else setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  function save(): void {
    if (busy || conflict != null) return;
    const found = problemsOf(typed);
    const first = firstProblem(found, values.companions.length);

    if (first != null) {
      setTried(true);
      setRefused({});
      focus(first === 'mobile' && found.mobile === 'noCountry' ? 'country' : first);
      return;
    }
    if (!dirty) {
      onSaved({ guest: host, tag }, false);
      return;
    }
    const renamed = newGuestOf(typed, false).fullName !== host.fullName;
    const others = guests.filter((one) => one.id !== host.id);

    if (renamed && duplicate !== 'kept' && isListed(others, values.fullName)) {
      setDuplicate('asked');
      focus('duplicate');
      return;
    }
    void send(duplicate === 'kept', tag);
  }

  return (
    <div ref={form} className="gs-form">
      <div className="gs-col-head">
        <h2 className="gs-col-title" tabIndex={-1} data-focus="form-heading">
          {t('guestList.editGuest')}
        </h2>
        <div className="gs-col-actions">
          <button type="button" className="desk-text" onClick={() => onCancel(dirty)}>
            {t('guestList.cancel')}
          </button>
          <button
            type="button"
            className={conflict != null ? 'desk-text is-held' : 'desk-text'}
            aria-busy={busy || undefined}
            {...offButton(conflict != null || busy, { dim: false })}
            onClick={save}
          >
            {busy ? t('guestList.saving') : t('guestList.save')}
          </button>
        </div>
      </div>
      {failed && (
        <p className="desk-error gs-refused" role="alert">
          <Glyph name="alert" size={15} weight={2.2} />
          {t('guestList.notSaved')}
        </p>
      )}
      {conflict != null && (
        <Amber title={t('guestList.conflict')} focusKey="conflict">
          <dl className="gs-differ">
            {conflict.differs.map((row) => (
              <div key={row.field} className="gs-differ-field">
                <dt>{row.field}</dt>
                <dd>
                  <span className="gs-who">{t('guestList.theirs')}</span>
                  {row.theirs}
                </dd>
                <dd>
                  <span className="gs-who">{t('guestList.yours')}</span>
                  {row.yours}
                </dd>
              </div>
            ))}
          </dl>
          <p className="gs-amber-line">{t('guestList.conflictLine')}</p>
          <div className="gs-pair">
            <button
              type="button"
              className="gs-pill is-secondary"
              onClick={() => {
                const theirs = valuesOf(conflict.theirs.guest, country);

                setHost(conflict.theirs.guest);
                setBase(theirs);
                setValues(theirs);
                setHeld([]);
                setTag(conflict.theirs.tag);
                setConflict(null);
                setDuplicate(null);
                setTried(false);
                setRefused({});
                focus('fullName');
              }}
            >
              {t('guestList.useTheirs')}
            </button>
            <button
              type="button"
              className="gs-pill is-secondary"
              aria-busy={busy || undefined}
              onClick={() => {
                const against = conflict.theirs.tag;
                const theirs = valuesOf(conflict.theirs.guest, country);
                const sending = mergedOf(conflict.sent, theirs, conflict.changed);

                setHost(conflict.theirs.guest);
                setBase(theirs);
                setHeld(conflict.changed);
                setValues(sending);
                setTag(against);
                setConflict(null);
                void send(duplicate === 'kept', against, sending, conflict.changed);
              }}
            >
              {t('guestList.keepMine')}
            </button>
          </div>
        </Amber>
      )}
      {duplicate === 'asked' && (
        <Amber
          title={t('guestList.duplicate', { name: values.fullName.trim() })}
          focusKey="duplicate"
        >
          <p className="gs-amber-line">{t('guestList.duplicateLine')}</p>
          <div className="gs-pair">
            <button
              type="button"
              className="gs-pill is-secondary"
              aria-busy={busy || undefined}
              onClick={() => {
                setDuplicate('kept');
                void send(true, tag);
              }}
            >
              {t('guestList.saveAnyway')}
            </button>
            <button
              type="button"
              className="gs-pill is-secondary"
              onClick={() => {
                setDuplicate(null);
                focus('fullName');
              }}
            >
              {t('guestList.changeName')}
            </button>
          </div>
        </Amber>
      )}
      <div className="desk-fields gs-fields">
        <GuestField
          label={t('account.fullName')}
          value={values.fullName}
          error={words('fullName')}
          focusKey="fullName"
          onChange={(fullName) => change({ fullName })}
        />
        <GuestField
          label={t('guestList.emailAddress')}
          value={values.email}
          optional
          type="email"
          error={words('email')}
          focusKey="email"
          onChange={(email) => change({ email })}
        />
        <PhoneField
          country={values.country}
          number={values.number}
          error={words('mobile')}
          help={t('guestList.keepsLink')}
          onCountry={(code) => change({ country: code })}
          onNumber={(number) => change({ number })}
        />
        <EditCompanions
          host={values.fullName.trim() === '' ? host.fullName : values.fullName.trim()}
          companions={values.companions}
          said={said}
          words={words}
          focus={focus}
          onSaid={setSaid}
          onChange={(companions) => change({ companions })}
        />
      </div>
    </div>
  );
}

function Amber({
  title,
  focusKey,
  children,
}: {
  title: string;
  focusKey: string;
  children: ReactNode;
}) {
  return (
    <div className="gs-amber" role="alert">
      <h3 className="gs-amber-head" tabIndex={-1} data-focus={focusKey}>
        <Glyph name="alert" size={17} weight={2.2} />
        {title}
      </h3>
      {children}
    </div>
  );
}

/** sc-1468's places, filled in: three shown, then "{n} more companions"; each removed at once, nothing seated or fed yet to ask about. */
function EditCompanions({
  host,
  companions,
  said,
  words,
  focus,
  onSaid,
  onChange,
}: {
  host: string;
  companions: Values['companions'];
  said: string | null;
  words: (key: string) => string | undefined;
  focus: (...keys: string[]) => void;
  onSaid: (said: string) => void;
  onChange: (companions: Values['companions']) => void;
}) {
  const { t } = useTranslation();
  const [all, setAll] = useState(false);
  const count = companions.length;
  const seen = (at: number) => all || at < SHOWN_COMPANIONS || companions[at]?.id == null;
  const unseen = companions.filter((_, at) => !seen(at)).length;
  const placeholder = (at: number) =>
    at === 0 ? t('guestList.guestOf', { host }) : t('guestList.guestOfNth', { host, nth: at + 1 });

  return (
    <fieldset className="gs-fieldset gs-companions">
      <legend className="gs-legend">{t('guestList.companionsTitle')}</legend>
      <p className="gs-count">
        {count === 0
          ? t('guestList.noneYet', { most: MOST_COMPANIONS })
          : t('guestList.ofMost', { n: count, most: MOST_COMPANIONS })}
      </p>
      {companions.map((companion, at) => {
        if (!seen(at)) return null;
        const label = t('guestList.companionName', { nth: at + 1, total: count });
        const shown = companion.name.trim() === '' ? placeholder(at) : companion.name.trim();

        return (
          <CompanionField
            key={companion.id ?? `new-${at}`}
            at={at}
            name={companion.name}
            host={host}
            label={label}
            placeholder={placeholder(at)}
            error={words(`companion-${at}`)}
            onChange={(name) =>
              onChange(companions.map((each, index) => (index === at ? { ...each, name } : each)))
            }
            onRemove={() => {
              onChange(companions.filter((_, index) => index !== at));
              onSaid(t('guestList.removed', { name: shown }));
              focus(`companion-${at + 1 < count ? at : at - 1}`, 'add-companion');
            }}
          />
        );
      })}
      {unseen > 0 && (
        <button
          type="button"
          className="desk-text gs-more"
          onClick={() => {
            const next = companions.findIndex((_, at) => !seen(at));

            setAll(true);
            focus(`companion-${next}`);
          }}
        >
          {t('guestList.moreCompanions', { count: unseen })}
        </button>
      )}
      {said != null && (
        <p className="gs-ok" role="status">
          <Glyph name="tick" size={17} weight={2.6} />
          {said}
        </p>
      )}
      {count < MOST_COMPANIONS ? (
        <button
          type="button"
          className="desk-text"
          data-focus="add-companion"
          onClick={() => {
            onChange([...companions, { id: null, name: '' }]);
            focus(`companion-${count}`);
          }}
        >
          <Glyph name="plus" size={17} weight={2.3} />
          {t('guestList.addCompanion')}
        </button>
      ) : (
        <p className="gs-most">{t('guestList.mostCompanions', { most: MOST_COMPANIONS })}</p>
      )}
    </fieldset>
  );
}
