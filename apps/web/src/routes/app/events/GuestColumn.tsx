import {
  ApiError,
  GUEST_ANSWERS,
  GUEST_NAME_MAXIMUM,
  type Guest,
  type GuestAnswer,
  type GuestDetails,
  type GuestInvitationHow,
  type TaggedGuest,
} from '@soirely/api-client';
import { formatPhone, ownLanguageName, phoneE164, phoneFields } from '@soirely/domain';
import type { TFunction } from 'i18next';
import { type ReactNode, useEffect, useEffectEvent, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../../../api.ts';
import { Glyph } from '../../../components/Glyph.tsx';
import { Ask, CardStep, Head, RowWords } from '../../../components/SettingsParts.tsx';
import { dateLocale } from '../../../i18n/index.ts';
import { focusWhenFree } from '../../../layers.ts';
import { type Mesh } from '../../../mesh.ts';
import { offButton } from '../../../offButton.ts';
import { phoneProblemMessage } from '../../../phoneProblem.ts';
import {
  ChoseNote,
  CompanionField,
  GuestField,
  LanguageField,
  PhoneField,
  PlacesStepper,
} from './GuestFields.tsx';
import { type Copy, IconLead, Invitation, invitationLine } from './GuestInvitation.tsx';
import {
  type CompanionNeeds,
  CompanionNeedsSection,
  NeedsBlock,
  NeedsRefused,
  NeedsSection,
} from './GuestNeeds.tsx';
import {
  NO_NEEDS,
  type NeedsProblems,
  type NeedsTyped,
  firstNeedsFailing,
  needsChips,
  needsFailingCount,
  needsInputOf,
  needsTypedOf,
  needsViolations,
  problemsByWho,
  useNeedsOpen,
} from './guestNeeds.ts';
import {
  MOST_COMPANIONS,
  type Problem,
  type Problems,
  REPLY_KEY,
  type ReplyWord,
  type Typed,
  companionShown,
  firstProblem,
  isListed,
  namedCount,
  newGuestOf,
  problemsOf,
  replyDate,
  shownReply,
  violationProblems,
} from '@soirely/domain';

const SHOWN_COMPANIONS = 3;
const PIECES = [1, 2, 3, 4, 5, 6];

const MARK: Record<ReplyWord, string> = {
  coming: 'is-coming',
  maybe: 'is-maybe',
  notComing: 'is-not-coming',
  noReply: 'is-no-reply',
  held: 'is-held',
  notYetInvited: 'is-not-yet',
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

type Replace =
  { kind: 'none' } | { kind: 'asking'; busy: boolean } | { kind: 'failed' } | { kind: 'replaced' };

type Unmark =
  | { kind: 'none' }
  | { kind: 'unmarked' }
  | { kind: 'replied'; reply: GuestAnswer; at: string }
  | { kind: 'failed' };

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
  draft,
  flagged,
  onCopy,
  onReplace,
  onMark,
  onUnmark,
  focus,
  onDirty,
  onAsk,
  onSaved,
  onChanged,
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
  /** On a Draft, somebody who cannot add guests sees only why the marks are not theirs (sc-3788). */
  draft: boolean;
  /** Someone who opened this guest's link pressed Tell them; only ever true for those who can add guests. */
  flagged: boolean;
  /** The whole link; refused 409 on a phase that does not invite. */
  onCopy: () => Promise<string>;
  onReplace: () => Promise<void>;
  /** Mark as invited (sc-3788); refused 409 on a phase that does not invite. */
  onMark: (how: GuestInvitationHow) => Promise<TaggedGuest>;
  onUnmark: () => Promise<TaggedGuest>;
  focus: (...keys: string[]) => void;
  onDirty: (dirty: boolean) => void;
  /** Asks "Discard your changes?" and runs `then` only on Discard. */
  onAsk: (then: () => void) => void;
  onSaved: (guest: GuestDetails) => void;
  /** A change made from the details, not by Save: the list shows it with no Saved. */
  onChanged: (guest: GuestDetails) => void;
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
      draft={draft}
      flagged={flagged}
      onCopy={onCopy}
      onReplace={onReplace}
      onMark={(how) =>
        onMark(how).then((tagged) => {
          setPane({ kind: 'guest', tagged });
          onChanged(tagged.guest);
        })
      }
      onUnmark={() =>
        onUnmark().then(
          (tagged) => {
            setPane({ kind: 'guest', tagged });
            onChanged(tagged.guest);
          },
          (error: unknown) => {
            setAttempt((n) => n + 1);
            throw error;
          },
        )
      }
      focus={focus}
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
  draft,
  flagged,
  onCopy,
  onReplace,
  onMark,
  onUnmark,
  focus,
  onEdit,
}: {
  guest: GuestDetails;
  timeZone: string;
  mesh: Mesh;
  manages: boolean;
  invites: boolean;
  draft: boolean;
  flagged: boolean;
  onCopy: () => Promise<string>;
  onReplace: () => Promise<void>;
  onMark: (how: GuestInvitationHow) => Promise<void>;
  onUnmark: () => Promise<void>;
  focus: (...keys: string[]) => void;
  onEdit: () => void;
}) {
  const { t } = useTranslation();
  const heading = useId();
  const [copy, setCopy] = useState<Copy>({ kind: 'none' });
  const [replace, setReplace] = useState<Replace>({ kind: 'none' });
  const [marking, setMarking] = useState(false);
  const [markFailed, setMarkFailed] = useState(false);
  const [unmark, setUnmark] = useState<Unmark>({ kind: 'none' });
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

  function marked(how: GuestInvitationHow): void {
    setMarkFailed(false);
    setUnmark({ kind: 'none' });
    onMark(how).then(
      () => {
        setMarking(false);
        setCopy({ kind: 'none' });
        focus('guest-heading');
      },
      (error: unknown) => {
        if (error instanceof ApiError && error.is('event_state_invalid')) setMarking(false);
        else setMarkFailed(true);
      },
    );
  }

  function unmarked(): void {
    onUnmark().then(
      () => {
        setUnmark({ kind: 'unmarked' });
        focus('guest-heading');
      },
      (error: unknown) => {
        const refused =
          error instanceof ApiError && error.is('guest_replied') ? error.problem : null;
        const answer = GUEST_ANSWERS.find((known) => known === refused?.reply);
        const at = refused?.repliedAt;

        setUnmark(
          answer != null && at != null
            ? { kind: 'replied', reply: answer, at }
            : { kind: 'failed' },
        );
      },
    );
  }

  const ask = () => setReplace({ kind: 'asking', busy: false });
  const added = new Intl.DateTimeFormat(dateLocale(), {
    month: 'short',
    day: 'numeric',
  }).format(new Date(guest.added.at));
  const names = guest.companions.map((one) => one.fullName);
  const replied =
    guest.repliedAt == null ? null : replyDate(guest.repliedAt, timeZone, dateLocale());
  const reply = shownReply(guest);
  const notYet = reply === 'notYetInvited';
  const cardLine =
    replied != null
      ? t('guestList.replied', { reply: t(REPLY_KEY[guest.reply]), date: replied })
      : notYet
        ? manages && invites
          ? t('guestList.copyFirst')
          : null
        : invitationLine(t, guest, timeZone);

  return (
    <div className="gs-guest">
      {replace.kind === 'replaced' && (
        <p className="gs-ok" role="status">
          <Glyph name="tick" size={17} weight={2.6} />
          {t('guestList.linkReplaced', { name: guest.fullName })}
        </p>
      )}
      {unmark.kind === 'unmarked' && (
        <p className="gs-ok" role="status">
          <Glyph name="tick" size={17} weight={2.6} />
          {t('guestList.unmarked')}
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
              <ReplyMark reply={reply} cover />
              {t(REPLY_KEY[reply])}
            </li>
          </ul>
          <h2 id={heading} className="gs-name" tabIndex={-1} data-focus="guest-heading">
            {guest.fullName}
          </h2>
          {cardLine != null && <p className="desk-on-card">{cardLine}</p>}
          {manages && invites && notYet && (
            <div className="ev-card-foot" data-focus="step">
              <CardStep label={t('guestList.markAsInvited')} onClick={() => setMarking(true)} />
            </div>
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
      {unmark.kind === 'replied' && (
        <p className="desk-error gs-refused" role="alert">
          <Glyph name="alert" size={15} weight={2.2} />
          {t('guestList.unmarkRefused', {
            name: guest.fullName,
            reply: t(REPLY_KEY[unmark.reply]),
            date: replyDate(unmark.at, timeZone, dateLocale()),
          })}
        </p>
      )}
      {unmark.kind === 'failed' && (
        <p className="desk-error gs-refused" role="alert">
          <Glyph name="alert" size={15} weight={2.2} />
          {t('guestList.loadFailedLine')}
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
                <li className={guest.language == null ? 'desk-row is-none' : 'desk-row'}>
                  <IconLead name="globe" />
                  <div className="gs-row-words">
                    <RowWords
                      title={
                        ownLanguageName(guest.language) ??
                        t('guestList.languageNotSetLine', {
                          language: t(`languageNames.${guest.organisationLanguage ?? 'en'}`),
                        })
                      }
                      lines={[t('language.label')]}
                    />
                    {guest.chosenLanguage != null && <ChoseNote chose={guest.chosenLanguage} />}
                  </div>
                </li>
              </>
            )}
            {guest.companions.length > 0 && (
              <li className="desk-row">
                <IconLead name="users" />
                <RowWords
                  title={t('guestList.companionsNamed', {
                    count: guest.companions.length,
                    named: namedCount(names),
                  })}
                  lines={[t('guestList.placesFor')]}
                />
              </li>
            )}
            {guest.companions.map((companion, at) => (
              <li key={companion.id} className="desk-row">
                <MarkLead reply={companion.state} />
                <div className="gs-row-words">
                  <RowWords
                    title={companionShown(t, guest.fullName, names, at)}
                    lines={[
                      companion.state === 'held'
                        ? t('guestList.heldCompanion')
                        : t('guestList.companionLine', { reply: t(REPLY_KEY[companion.state]) }),
                    ]}
                  />
                  {companion.namedByGuest && (
                    <span className="gs-named-by">{t('guestList.namedByGuest')}</span>
                  )}
                </div>
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
        <NeedsBlock
          guest={guest}
          heading={heading}
          nameOf={(at) => companionShown(t, guest.fullName, names, at)}
        />
      )}
      {manages || !draft ? (
        <Invitation
          guest={guest}
          timeZone={timeZone}
          heading={heading}
          manages={manages}
          invites={invites}
          copy={copy}
          copyByHand={copy.kind === 'byHand' && <CopyByHand url={copy.url} />}
          marking={marking}
          markFailed={markFailed}
          replaceButton={replaceButton}
          onCopy={copied}
          onReplace={ask}
          onMarking={(on) => {
            setMarkFailed(false);
            setMarking(on);
            if (!on) focus('mark');
          }}
          onMark={marked}
          onUnmark={unmarked}
        />
      ) : (
        <p className="gs-inset gs-read-only">{t('guestList.readOnlyInvited')}</p>
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
  companions: readonly { id: string | null; name: string; needs: NeedsTyped }[];
  language: string | null;
  needs: NeedsTyped;
}

function valuesOf(guest: GuestDetails, country: string): Values {
  const phone = guest.mobile == null ? null : phoneFields(guest.mobile);

  return {
    fullName: guest.fullName,
    email: guest.email ?? '',
    country: phone?.country ?? country,
    number: phone?.number ?? guest.mobile ?? '',
    companions: guest.companions.map((one) => ({
      id: one.id,
      name: one.fullName ?? '',
      needs: needsTypedOf(one.needs),
    })),
    language: guest.language,
    needs: needsTypedOf(guest.needs),
  };
}

function needsOf(values: Values, who: string): NeedsTyped {
  return who === 'guest'
    ? values.needs
    : (values.companions[Number(who.slice(1))]?.needs ?? NO_NEEDS);
}

function needsProblemsByWho(values: Values): Record<string, NeedsProblems> {
  return problemsByWho([values.needs, ...values.companions.map((one) => one.needs)]);
}

function needsWords(t: TFunction, needs: NeedsTyped): string {
  return needsChips(t, needs)
    .filter((chip) => chip.kind !== 'note')
    .map((chip) => chip.word)
    .join(', ');
}

function factsOf(needs: NeedsTyped): string {
  const kept = needsInputOf(needs);

  return JSON.stringify([
    [...kept.allergies].sort(),
    [...kept.diet].sort(),
    [...kept.access].sort(),
    kept.otherAllergy,
    kept.otherDiet,
    kept.otherAccess,
  ]);
}

/** One person's Needs and Private note rows on a 412, each shown when its record differs, since two different records can read the same words. */
function needsDiffers(
  t: TFunction,
  theirs: NeedsTyped,
  yours: NeedsTyped,
  name: string | null,
): Differs {
  const none = t('guestList.none');
  const theirNote = needsInputOf(theirs).note;
  const myNote = needsInputOf(yours).note;

  return [
    ...(factsOf(theirs) === factsOf(yours)
      ? []
      : [
          {
            key: 'needs' as const,
            field: name == null ? t('guestNeeds.needs') : t('guestNeeds.needsOf', { name }),
            theirs: needsWords(t, theirs) || none,
            yours: needsWords(t, yours) || none,
          },
        ]),
    ...(theirNote === myNote
      ? []
      : [
          {
            key: 'needs' as const,
            field:
              name == null ? t('guestNeeds.privateNote') : t('guestNeeds.privateNoteOf', { name }),
            theirs: theirNote ?? none,
            yours: myNote ?? none,
          },
        ]),
  ];
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

type Field = 'fullName' | 'email' | 'mobile' | 'language' | 'companions' | 'needs';

const FIELDS: readonly Field[] = ['fullName', 'email', 'mobile', 'language', 'companions', 'needs'];

/** What the API would keep of each field, so a save that changes nothing sends nothing. */
function keptOf(values: Values): Record<Field, string> {
  const sent = newGuestOf(typedOf(values), false);

  return {
    fullName: sent.fullName,
    email: JSON.stringify(sent.email),
    mobile: JSON.stringify(mobileOf(values)),
    language: JSON.stringify(values.language),
    companions: JSON.stringify(
      values.companions.map((one, at) => [one.id, sent.companions?.[at]?.fullName ?? null]),
    ),
    needs: JSON.stringify([
      needsInputOf(values.needs),
      ...values.companions.map((one) => needsInputOf(one.needs)),
    ]),
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
    language: mine('language') ? values.language : theirs.language,
    companions: mine('companions')
      ? values.companions.map((one) => (held.has(one.id) ? one : { ...one, id: null }))
      : theirs.companions.map((one) => ({
          ...one,
          needs: mine('needs')
            ? (values.companions.find((mineOne) => mineOne.id === one.id)?.needs ?? one.needs)
            : one.needs,
        })),
    needs: mine('needs') ? values.needs : theirs.needs,
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
  const [needsRefused, setNeedsRefused] = useState<Record<string, NeedsProblems>>({});
  const opened = useNeedsOpen();
  const needsProblems: Record<string, NeedsProblems> = {
    ...(tried ? needsProblemsByWho(values) : {}),
    ...needsRefused,
  };
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
    setNeedsRefused({});
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
        key: 'language',
        field: t('language.label'),
        theirs: ownLanguageName(theirs.language) ?? t('guestList.languageNotSet'),
        yours: ownLanguageName(sent.language) ?? t('guestList.languageNotSet'),
      },
      {
        key: 'companions',
        field: t('guestList.companionsTitle'),
        theirs: theirNames.join(', ') || none,
        yours: myNames.join(', ') || none,
      },
    ];
    const their = valuesOf(theirs, country);
    const needs: Differs = changed.includes('needs')
      ? [
          ...needsDiffers(t, their.needs, sent.needs, null),
          ...sent.companions.flatMap((one, at) =>
            needsDiffers(
              t,
              (one.id == null ? null : their.companions.find((c) => c.id === one.id)?.needs) ??
                NO_NEEDS,
              one.needs,
              myNames[at] ?? one.name,
            ),
          ),
        ]
      : [];

    return [
      ...rows.filter((row) => changed.includes(row.key) && row.theirs !== row.yours),
      ...needs,
    ];
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
          needs: needsInputOf(sending.needs),
          companions: sending.companions.map((one, at) => ({
            id: one.id,
            fullName: sent.companions?.[at]?.fullName ?? null,
            needs: needsInputOf(one.needs),
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
        const violations = error.problem.violations ?? [];
        const found = violationProblems(violations, typedOf(sending));
        const at = firstProblem(found, sending.companions.length);
        const theirNeeds = needsViolations(violations, (who) => needsOf(sending, who));
        const needsAt = firstNeedsFailing(theirNeeds);

        if (at == null && needsAt == null) setFailed(true);
        else {
          setRefused(found);
          setNeedsRefused(theirNeeds);
          opened.openFailing(theirNeeds);
          if (at != null) focus(at === 'mobile' && found.mobile === 'noCountry' ? 'country' : at);
          else if (needsAt != null) focus(needsAt);
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
    const needsFound = needsProblemsByWho(values);
    const needsFirst = firstNeedsFailing(needsFound);

    if (first != null || needsFirst != null) {
      setTried(true);
      setRefused({});
      setNeedsRefused({});
      opened.openFailing(needsFound);
      if (first != null)
        focus(first === 'mobile' && found.mobile === 'noCountry' ? 'country' : first);
      else if (needsFirst != null) focus(needsFirst);
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
      <NeedsRefused count={needsFailingCount(needsProblems)} />
      {conflict != null && (
        <Amber title={t('guestList.conflict')} focusKey="conflict">
          <dl className="gs-differ">
            {conflict.differs.map((row, at) => (
              <div key={`${row.field}-${at}`} className="gs-differ-field">
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
        <LanguageField
          value={values.language}
          chose={host.chosenLanguage}
          onChange={(language) => change({ language })}
        />
        <NeedsSection
          title={t('guestNeeds.needs')}
          needs={values.needs}
          problems={needsProblems.guest ?? {}}
          open={opened.open.has('guest')}
          focusKey="needs"
          onOpen={(open) => opened.toggle('guest', open)}
          onChange={(needs) => change({ needs })}
        />
        <EditCompanions
          host={values.fullName.trim() === '' ? host.fullName : values.fullName.trim()}
          companions={values.companions}
          said={said}
          words={words}
          needs={{ problems: needsProblems, open: opened.open, toggle: opened.toggle }}
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
  needs,
  focus,
  onSaid,
  onChange,
}: {
  host: string;
  companions: Values['companions'];
  said: string | null;
  words: (key: string) => string | undefined;
  needs: CompanionNeeds;
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
      <PlacesStepper
        host={host}
        names={companions.map((one) => one.name)}
        onStep={(kept, added) =>
          onChange([
            ...kept.flatMap((at) => companions[at] ?? []),
            ...Array.from({ length: added }, () => ({ id: null, name: '', needs: NO_NEEDS })),
          ])
        }
      />
      {companions.map((companion, at) => {
        if (!seen(at)) return null;
        const label = t('guestList.companionName', { nth: at + 1, total: count });
        const shown = companion.name.trim() === '' ? placeholder(at) : companion.name.trim();

        return (
          <div key={companion.id ?? `new-${at}`} className="gs-companion-block">
            <CompanionField
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
                focus(`companion-${at + 1 < count ? at : at - 1}`, 'places');
              }}
            />
            <CompanionNeedsSection
              at={at}
              typed={companion.needs}
              needs={needs}
              onChange={(next) =>
                onChange(
                  companions.map((each, index) => (index === at ? { ...each, needs: next } : each)),
                )
              }
            />
          </div>
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
      {count >= MOST_COMPANIONS && (
        <p className="gs-most">{t('guestList.mostCompanions', { most: MOST_COMPANIONS })}</p>
      )}
    </fieldset>
  );
}
