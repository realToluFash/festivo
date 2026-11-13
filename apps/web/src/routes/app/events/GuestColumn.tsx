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
import { Head, RowWords } from '../../../components/SettingsParts.tsx';
import { Skeleton } from '../../../components/Skeleton.tsx';
import { currentLocale } from '../../../i18n/index.ts';
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
  listedAs,
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

/** The guest beside the list (sc-3773): their card and Details, or Edit in their place. */
export function GuestColumn({
  eventId,
  guestId,
  mesh,
  manages,
  guests,
  country,
  stamp,
  focus,
  onDirty,
  onAsk,
  onSaved,
  onClose,
}: {
  eventId: string;
  guestId: string;
  mesh: Mesh;
  manages: boolean;
  guests: readonly Guest[];
  country: string;
  /** Raised on each change published to the list; the guest is read again unless being edited. */
  stamp: number;
  focus: (...keys: string[]) => void;
  onDirty: (dirty: boolean) => void;
  /** Asks "Discard your changes?" and runs `then` only on Discard. */
  onAsk: (then: () => void) => void;
  onSaved: (guest: GuestDetails) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [pane, setPane] = useState<Pane>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const editing = useRef(false);

  useEffect(() => {
    editing.current = pane.kind === 'edit';
  });

  useEffect(() => {
    if (editing.current) return;
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
      <div aria-busy="true">
        <Skeleton words={t('pending.loading')} shape="rows" rowHeight={64} />
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
            onDirty(false);
            setPane({ kind: 'guest', tagged: pane.tagged });
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
          onDirty(false);
          setPane({ kind: 'guest', tagged });
          if (changed) onSaved(tagged.guest);
          focus('edit');
        }}
      />
    );
  }

  return (
    <GuestView
      guest={pane.tagged.guest}
      mesh={mesh}
      manages={manages}
      onEdit={() => {
        setPane({ kind: 'edit', tagged: pane.tagged });
        focus('fullName');
      }}
    />
  );
}

function GuestView({
  guest,
  mesh,
  manages,
  onEdit,
}: {
  guest: GuestDetails;
  mesh: Mesh;
  manages: boolean;
  onEdit: () => void;
}) {
  const { t } = useTranslation();
  const heading = useId();
  const added = new Intl.DateTimeFormat(currentLocale(), {
    month: 'short',
    day: 'numeric',
  }).format(new Date(guest.added.at));
  const names = guest.companions.map((one) => one.fullName);

  return (
    <div className="gs-guest">
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
        </div>
      </section>
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

/** What the API would keep, so a save that changes nothing sends nothing. */
function kept(values: Values): string {
  const sent = newGuestOf(typedOf(values), false);

  return JSON.stringify([
    sent.fullName,
    sent.email,
    mobileOf(values),
    values.companions.map((one, at) => [one.id, sent.companions?.[at]?.fullName ?? null]),
  ]);
}

type Differs = readonly { field: string; theirs: string; yours: string }[];

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
  const [conflict, setConflict] = useState<{ theirs: TaggedGuest; differs: Differs } | null>(null);
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

  function differs(theirs: GuestDetails): Differs {
    const mine = newGuestOf(typed, false);
    const theirNames = theirs.companions.map((one, at) =>
      companionShown(
        t,
        theirs.fullName,
        theirs.companions.map((c) => c.fullName),
        at,
      ),
    );
    const myNames = values.companions.map((_, at) =>
      companionShown(
        t,
        mine.fullName,
        values.companions.map((c) => c.name),
        at,
      ),
    );
    const none = t('guestList.none');
    const mobile = mobileOf(values);
    const rows = [
      { field: t('account.fullName'), theirs: theirs.fullName, yours: mine.fullName },
      {
        field: t('guestList.emailAddress'),
        theirs: theirs.email ?? none,
        yours: mine.email ?? none,
      },
      {
        field: t('guestList.mobileNumber'),
        theirs: theirs.mobile == null ? none : formatPhone(theirs.mobile),
        yours: mobile == null ? none : formatPhone(mobile),
      },
      {
        field: t('guestList.companionsTitle'),
        theirs: theirNames.join(', ') || none,
        yours: myNames.join(', ') || none,
      },
    ];

    return rows.filter((row) => row.theirs !== row.yours);
  }

  async function send(allowDuplicate: boolean, against: string): Promise<void> {
    setBusy(true);
    setFailed(false);
    try {
      const sent = newGuestOf(typed, allowDuplicate);
      const saved = await api.updateGuest(
        eventId,
        host.id,
        {
          ...sent,
          companions: values.companions.map((one, at) => ({
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

          setConflict({ theirs, differs: differs(theirs.guest) });
          focus('conflict');
        } catch (again) {
          if (again instanceof ApiError && again.status === 404) onGone();
          else setFailed(true);
        }
      } else if (error instanceof ApiError && error.code === 'guest_already_listed') {
        setDuplicate('asked');
        focus('duplicate');
      } else if (error instanceof ApiError && error.status === 422) {
        const found = violationProblems(error.problem.violations ?? [], typed);
        const at = firstProblem(found, values.companions.length);

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

    if (renamed && duplicate !== 'kept' && listedAs(others, values.fullName) != null) {
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

                setTag(against);
                setConflict(null);
                void send(duplicate === 'kept', against);
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
            label={label}
            shown={shown}
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
