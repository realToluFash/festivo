import { type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router';

import type { SampleEvent } from './events.ts';
import { Glyph } from '../components/Glyph.tsx';
import {
  type Guest,
  type GuestNote,
  type Invite,
  LINK,
  ORGANISATION_LANGUAGE,
  WEDDING,
  cardLine,
  companionName,
  dayOf,
  handMarked,
  invitationLine,
  invitesOn,
  languageName,
  phoneShown,
  replyByOf,
  replyTail,
  repliesClosed,
  weekdayOf,
} from './guests.ts';
import {
  ChoseNote,
  Cover,
  IconLead,
  MarkLead,
  OkLine,
  Pill,
  Refused,
  ReplyMark,
  Triangle,
} from './GuestsParts.tsx';
import { GW, HOW_INVITED, type HowInvited, REPLY_WORDS } from './guestsWords.ts';
import { GUESTS as CONVERSATIONS, MESSAGES_AT } from './messages.ts';
import { Turning } from './DataControlParts.tsx';
import { THEIR_WORDS } from './guestRequest.ts';
import { type Needs, NW, accessNames, allergyNames, dietNames } from './guestNeeds.ts';
import { AllergyMark } from './GuestNeeds.tsx';
import { whatsAppRowOf } from './whatsAppConsent.ts';
import { sendOffered, whatsAppHref } from './whatsAppSend.ts';
import { useLater } from '../useLater.ts';
import { CardStep, Chevron, Head, RowWords, TextAction } from '../components/SettingsParts.tsx';

export interface GuestActions {
  onRecord: () => void;
  onEdit: () => void;
  onReopen: () => void;
  onCopy: () => void;
  onReplace: () => void;
  onInvite: (invite: Invite | null) => void;
  onMark: (how: HowInvited) => void;
  onUnmark: () => void;
  onAgree: () => void;
  onSend: () => void;
  onNotSent: () => void;
  /** The mark from the question: false when it was not saved and the question stays. */
  onSent: () => boolean;
}

type Step = { label: string; does: () => void } | null;

const SAVE_MS = 900;

/** A guest beside the list (sc-3773): the cover card the guest sees, their reply, Details, Invitation and their conversation. */
export function GuestView({
  guest,
  event,
  clock,
  manages,
  note,
  invite,
  actions,
  erase = null,
  erasedLine,
  theirData,
  asked = false,
  askFailed = false,
}: {
  guest: Guest;
  event: SampleEvent;
  clock: Date;
  manages: boolean;
  note: GuestNote | undefined;
  invite: Invite | undefined;
  actions: GuestActions;
  /** sc-30193: while their data is erased nothing changes; once erased, what stays and the line saying so. */
  erase?: 'erasing' | 'erased' | null;
  erasedLine?: string;
  theirData?: ReactNode;
  asked?: boolean;
  askFailed?: boolean;
}) {
  const heading = useId();
  const acts = manages && erase == null;
  const replyBy = replyByOf(event.id);
  const invited = guest.reply !== 'notYet' && guest.reply !== 'walkIn';
  const closed = invited && repliesClosed(event.id, clock) && guest.reopened == null;
  const replied =
    guest.reply === 'coming' || guest.reply === 'notSure' || guest.reply === 'notComing';
  const draft = event.status === 'draft';
  const invites = invitesOn(event, clock);
  const showsInvitation = erase == null && (!draft || acts) && guest.reply !== 'walkIn';
  let line: string | null = draft ? null : cardLine(guest, replyBy);
  let step: Step = null;

  if (erase === 'erased' && erasedLine != null) line = erasedLine;
  else if (closed && replyBy != null) {
    line = manages ? GW.repliesClosed(weekdayOf(replyBy)) : GW.closedOn(weekdayOf(replyBy));
    step = { label: GW.letThemChange, does: actions.onReopen };
  } else if (guest.reopened != null) {
    line = GW.reopened(guest.reopened.by ?? '', dayOf(guest.reopened.on));
    step = { label: GW.recordReply, does: actions.onRecord };
  } else if (guest.reply === 'noReply') step = { label: GW.recordReply, does: actions.onRecord };
  else if (guest.reply === 'notYet' && invites && !asked)
    step = { label: GW.markAsInvited, does: () => actions.onInvite('mark') };

  return (
    <div className="gs-guest">
      {note === 'recorded' && <OkLine>{GW.recorded}</OkLine>}
      {note === 'unmarked' && <OkLine>{GW.unmarked}</OkLine>}
      {note === 'linkReplaced' && <OkLine>{GW.linkReplacedNote(guest.name)}</OkLine>}
      <Cover mesh={event.mesh} size="guest" label={heading}>
        <ul className="desk-glass-tags">
          <li className="desk-glass">
            <ReplyMark reply={guest.reply} size={16} cover />
            {REPLY_WORDS[guest.reply]}
          </li>
        </ul>
        <h2 id={heading} className="gs-name" tabIndex={-1} data-focus="guest-heading">
          {guest.name}
        </h2>
        {line != null && <p className="desk-on-card">{line}</p>}
        {acts && step != null && (
          <div className="ev-card-foot" data-focus="step">
            <CardStep label={step.label} onClick={step.does} />
          </div>
        )}
      </Cover>
      {acts && guest.flagged && (
        <WrongPerson name={guest.name} heading={heading} onReplace={actions.onReplace} />
      )}
      {erase === 'erasing' && <Turning words={THEIR_WORDS.erasing} />}
      {note === 'notReplaced' && <Refused>{GW.notReplaced}</Refused>}
      {note === 'unmarkRefused' && guest.replied != null && (
        <Refused>
          {GW.unmarkRefused(guest.name, REPLY_WORDS[guest.reply], dayOf(guest.replied))}
        </Refused>
      )}
      {replied && (
        <section className="desk-block" aria-labelledby={`${heading}-reply`}>
          <Head level={3} title={<span id={`${heading}-reply`}>{GW.reply}</span>} />
          <ul className="desk-rows gs-rows">
            <li className="desk-row">
              <MarkLead reply={guest.reply} />
              <RowWords title={REPLY_WORDS[guest.reply]} lines={[replyTail(guest, replyBy)]} />
            </li>
          </ul>
          {acts && !closed && (
            <button
              type="button"
              className="desk-text"
              data-focus="record"
              onClick={actions.onRecord}
            >
              {GW.recordReply}
            </button>
          )}
        </section>
      )}
      <Details
        guest={guest}
        manages={manages}
        edits={acts}
        erased={erase === 'erased'}
        heading={heading}
        onEdit={actions.onEdit}
        onAgree={actions.onAgree}
      />
      {manages && erase !== 'erased' && <NeedsBlock guest={guest} heading={heading} />}
      {showsInvitation ? (
        <Invitation
          guest={guest}
          acts={acts}
          invites={acts && invites}
          invite={invite}
          heading={heading}
          actions={actions}
          send={sendOffered(guest, event, clock, acts) ? whatsAppHref(guest, event, LINK) : null}
          asked={asked}
          askFailed={askFailed}
        />
      ) : (
        !manages && <p className="gs-inset gs-read-only">{GW.readOnlyInvited}</p>
      )}
      {manages && invited && event.id === WEDDING && erase !== 'erased' && (
        <Conversation guest={guest} heading={heading} />
      )}
      {theirData}
    </div>
  );
}

/** sc-1526: Tell them was pressed on the guest's own page; marked by the triangle and the words, not the amber alone. */
function WrongPerson({
  name,
  heading,
  onReplace,
}: {
  name: string;
  heading: string;
  onReplace: () => void;
}) {
  return (
    <section className="gs-amber" aria-labelledby={`${heading}-flag`}>
      <h3 id={`${heading}-flag`} className="gs-amber-head">
        <Triangle size={17} />
        {GW.flaggedTitle}
      </h3>
      <p className="gs-amber-line">{GW.flaggedLine(name)}</p>
      <button type="button" className="desk-text" data-focus="flag-replace" onClick={onReplace}>
        {GW.replaceLink}
      </button>
    </section>
  );
}

function Details({
  guest,
  manages,
  edits,
  erased,
  heading,
  onEdit,
  onAgree,
}: {
  guest: Guest;
  manages: boolean;
  edits: boolean;
  erased: boolean;
  heading: string;
  onEdit: () => void;
  onAgree: () => void;
}) {
  const whatsApp = whatsAppRowOf(
    guest.whatsApp,
    { mobile: guest.phone != null, edits: manages && !erased },
    dayOf,
  );

  return (
    <section className="desk-block" aria-labelledby={`${heading}-details`}>
      <Head level={3} title={<span id={`${heading}-details`}>{GW.details}</span>}>
        {edits && (
          <button type="button" className="desk-text" data-focus="edit" onClick={onEdit}>
            {GW.edit}
          </button>
        )}
      </Head>
      <ul className="desk-rows gs-rows">
        <li className={guest.greetAs == null ? 'desk-row is-none' : 'desk-row'}>
          <IconLead name="message" />
          <RowWords
            title={guest.greetAs == null ? GW.greetsByName : GW.greetsThemAs(guest.greetAs)}
            lines={[GW.greetAs]}
          />
        </li>
        {manages && !erased && (
          <>
            <li className={guest.email == null ? 'desk-row is-none' : 'desk-row'}>
              <IconLead name="mail" />
              <RowWords title={guest.email ?? GW.none} lines={[GW.emailAddress]} />
            </li>
            <li className={guest.phone == null ? 'desk-row is-none' : 'desk-row'}>
              <IconLead name="phone" />
              <RowWords
                title={guest.phone == null ? GW.none : phoneShown(guest.phone)}
                lines={[GW.mobileNumber]}
              />
            </li>
            {whatsApp != null && (
              <li className="desk-row gs-whatsapp" tabIndex={-1} data-focus="whatsapp">
                <IconLead name="whatsApp" />
                <div className="gs-row-words">
                  <RowWords title={whatsApp.title} lines={[whatsApp.note ?? GW.whatsApp]} />
                  {whatsApp.agree && edits && (
                    <button
                      type="button"
                      className="desk-text gs-agree"
                      data-focus="whatsapp-agree"
                      onClick={onAgree}
                    >
                      {GW.guestAgreed}
                    </button>
                  )}
                </div>
              </li>
            )}
            <li className={guest.language == null ? 'desk-row is-none' : 'desk-row'}>
              <IconLead name="globe" />
              <div className="gs-row-words">
                <RowWords
                  title={
                    languageName(guest.language) ??
                    GW.notSetLine(languageName(ORGANISATION_LANGUAGE) ?? '')
                  }
                  lines={[GW.language]}
                />
                {guest.chose != null && <ChoseNote chose={guest.chose} />}
              </div>
            </li>
          </>
        )}
        {guest.companions.map((companion) => (
          <li key={companion.id} className="desk-row">
            <MarkLead reply={companion.reply} />
            <RowWords
              title={companionName(guest, companion)}
              lines={[
                companion.reply === 'held'
                  ? GW.heldCompanion
                  : GW.companion(REPLY_WORDS[companion.reply]),
              ]}
            />
          </li>
        ))}
        {manages && (
          <li className="desk-row">
            <IconLead name="user" />
            <RowWords
              title={GW.addedBy(dayOf(guest.added.on), guest.added.by ?? '')}
              lines={[GW.added]}
            />
          </li>
        )}
      </ul>
    </section>
  );
}

function NeedsRows({ needs }: { needs: Needs }) {
  const rows = [
    { key: 'allergies', title: allergyNames(needs).join(', '), label: NW.allergies },
    { key: 'diet', title: dietNames(needs).join(', '), label: NW.diet },
    { key: 'access', title: accessNames(needs).join(', '), label: NW.access },
    { key: 'note', title: needs.note, label: NW.privateNote },
  ].filter((row) => row.title !== '');

  return rows.map((row) => (
    <li key={row.key} className="desk-row">
      <IconLead name={row.key === 'allergies' ? 'alert' : row.key === 'note' ? 'lock' : 'info'} />
      <div className="gs-row-words">
        <RowWords title={row.title} lines={[row.label]} />
        {row.key === 'allergies' && <AllergyMark />}
      </div>
    </li>
  ));
}

function recorded(needs: Needs | undefined): needs is Needs {
  return (
    needs != null &&
    (needs.allergies.length > 0 ||
      needs.diet.length > 0 ||
      needs.access.length > 0 ||
      needs.note.trim() !== '')
  );
}

/** sc-3777: allergies, diet and access under their own headings, the guest's then each companion's; for people who manage guests only. */
function NeedsBlock({ guest, heading }: { guest: Guest; heading: string }) {
  const companions = guest.companions.flatMap((one) =>
    recorded(one.needs) ? [{ one, needs: one.needs }] : [],
  );
  const none = !recorded(guest.needs) && companions.length === 0;

  return (
    <section className="desk-block" aria-labelledby={`${heading}-needs`}>
      <Head level={3} title={<span id={`${heading}-needs`}>{NW.needs}</span>} />
      {none ? (
        <p className="desk-line">{NW.noDietary}</p>
      ) : (
        <>
          {recorded(guest.needs) && (
            <ul className="desk-rows gs-rows">
              <NeedsRows needs={guest.needs} />
            </ul>
          )}
          {companions.map(({ one, needs }) => (
            <div key={one.id} className="gs-their-needs">
              <h4 className="gs-their-head">{companionName(guest, one)}</h4>
              <ul className="desk-rows gs-rows">
                <NeedsRows needs={needs} />
              </ul>
            </div>
          ))}
        </>
      )}
    </section>
  );
}

function Invitation({
  guest,
  acts,
  invites,
  invite,
  heading,
  actions,
  send,
  asked,
  askFailed,
}: {
  guest: Guest;
  acts: boolean;
  invites: boolean;
  invite: Invite | undefined;
  heading: string;
  actions: GuestActions;
  send: string | null;
  asked: boolean;
  askFailed: boolean;
}) {
  const notYet = guest.reply === 'notYet';
  const marking = invite === 'mark' || invite === 'markRefused' || invite === 'markNotSaved';
  const line = invitationLine(guest);

  return (
    <section className="desk-block" aria-labelledby={`${heading}-invitation`}>
      <Head level={3} title={<span id={`${heading}-invitation`}>{GW.invitation}</span>} />
      {(acts || line != null || guest.replaced != null) && (
        <ul className="desk-rows gs-rows">
          {line != null && (
            <li className="desk-row">
              <IconLead name="send" />
              <div className="gs-row-words">
                <RowWords title={line} lines={[]} />
                {acts && handMarked(guest) && (
                  <button
                    type="button"
                    className="desk-text gs-agree"
                    data-focus="unmark"
                    onClick={actions.onUnmark}
                  >
                    {GW.markNotInvited}
                  </button>
                )}
              </div>
            </li>
          )}
          {guest.replaced != null && (
            <li className="desk-row">
              <IconLead name="refresh" />
              <RowWords
                title={GW.linkReplaced(dayOf(guest.replaced))}
                lines={[GW.linkReplacedLine]}
              />
            </li>
          )}
          {invites && (
            <li>
              <button
                type="button"
                className="desk-row gs-do"
                data-focus="copy"
                onClick={actions.onCopy}
              >
                <IconLead name="link" />
                <RowWords title={GW.copyLink} lines={[GW.copyLinkLine]} />
              </button>
              {invite === 'copied' && (
                <div className="gs-copied">
                  <p role="status">
                    <Glyph name="tick" size={16} weight={2.6} />
                    {GW.linkCopied}
                  </p>
                  {notYet && (
                    <button
                      type="button"
                      className="desk-text is-green"
                      onClick={() => actions.onInvite('mark')}
                    >
                      {GW.markAsInvited}
                    </button>
                  )}
                </div>
              )}
              {invite === 'refused' && <CopyByHand />}
            </li>
          )}
          {send != null && (
            <li>
              <a
                href={send}
                className="desk-row gs-do"
                aria-label={GW.sendOnWhatsAppTo(guest.name)}
                data-focus="send"
                onClick={(press) => {
                  press.preventDefault();
                  actions.onSend();
                }}
              >
                <IconLead name="whatsApp" />
                <RowWords title={GW.sendOnWhatsApp} lines={[GW.sendLine]} />
              </a>
              {asked && notYet && (
                <SentQuestion
                  name={guest.name}
                  startFailed={askFailed}
                  onNotSent={actions.onNotSent}
                  onSent={actions.onSent}
                />
              )}
            </li>
          )}
          {acts && (
            <li>
              <button
                type="button"
                className="desk-row gs-do"
                data-focus="replace"
                onClick={actions.onReplace}
              >
                <IconLead name="refresh" />
                <RowWords title={GW.replaceLink} lines={[GW.replaceLinkLine]} />
              </button>
            </li>
          )}
          {notYet && invites && !asked && (
            <li>
              <button
                type="button"
                className="desk-row gs-do"
                onClick={() => actions.onInvite('mark')}
              >
                <IconLead name="tick" />
                <RowWords title={GW.markAsInvited} lines={[GW.markLine]} />
              </button>
            </li>
          )}
        </ul>
      )}
      {acts && marking && notYet && (
        <MarkInset start={invite} onCancel={() => actions.onInvite(null)} onMark={actions.onMark} />
      )}
      {!acts && <p className="gs-inset gs-read-only">{GW.readOnlyInvited}</p>}
    </section>
  );
}

/** The web's own refusal (sc-1526): the browser kept the clipboard, so the link is selected to copy by hand. */
function CopyByHand() {
  const id = useId();
  const field = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    field.current?.focus();
    field.current?.select();
  }, []);

  return (
    <div className="desk-field gs-by-hand">
      <label htmlFor={id} className="desk-label">
        {GW.invitationLink}
      </label>
      <textarea
        ref={field}
        id={id}
        className="gs-link"
        readOnly
        rows={2}
        value={LINK}
        aria-describedby={`${id}-help`}
        onFocus={(event) => event.target.select()}
      />
      <p id={`${id}-help`} className="desk-help">
        {GW.clipboardRefused}
      </p>
    </div>
  );
}

/** sc-3788 at a desk: an inset in the guest's Invitation, nothing chosen. */
function MarkInset({
  start,
  onCancel,
  onMark,
}: {
  start: Invite;
  onCancel: () => void;
  onMark: (how: HowInvited) => void;
}) {
  const name = useId();
  const [picked, setPicked] = useState<HowInvited | null>(
    start === 'markNotSaved' ? 'WhatsApp' : null,
  );
  const [tried, setTried] = useState(start === 'markRefused');
  const [failed, setFailed] = useState(start === 'markNotSaved');
  const wrong = tried && picked == null;
  const first = useRef<HTMLInputElement>(null);

  useEffect(() => {
    first.current?.focus();
  }, []);

  return (
    <div className="gs-inset">
      {failed && <Refused>{GW.markNotSaved}</Refused>}
      <fieldset className="gs-fieldset" aria-describedby={wrong ? `${name}-error` : undefined}>
        <legend className="gs-inset-title">{GW.howInvited}</legend>
        <div className="gs-ways">
          {HOW_INVITED.map((how, index) => (
            <label key={how} className={wrong ? 'gs-way is-wrong' : 'gs-way'}>
              <input
                ref={index === 0 ? first : undefined}
                type="radio"
                className="desk-radio"
                name={name}
                checked={picked === how}
                onChange={() => setPicked(how)}
              />
              {how}
            </label>
          ))}
        </div>
      </fieldset>
      {wrong && (
        <p id={`${name}-error`} className="desk-error">
          <Glyph name="alert" size={15} weight={2.2} />
          {GW.howInvitedBlank}
        </p>
      )}
      <div className="gs-inset-foot">
        <Pill
          primary
          label={GW.markAsInvited}
          onClick={() => {
            if (picked == null) {
              setTried(true);
              first.current?.focus();
              return;
            }
            setFailed(false);
            onMark(picked);
          }}
        />
        <TextAction label={GW.cancel} onClick={onCancel} />
      </div>
    </div>
  );
}

/** sc-26025: asked after the press, answered here; it stays until answered, a failed mark included. */
function SentQuestion({
  name,
  startFailed,
  onNotSent,
  onSent,
}: {
  name: string;
  startFailed: boolean;
  onNotSent: () => void;
  onSent: () => boolean;
}) {
  const id = useId();
  const later = useLater();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(startFailed);

  return (
    <div
      className="gs-inset gs-asked"
      role="group"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-line`}
      tabIndex={-1}
      data-focus="send-question"
    >
      {failed && <Refused>{GW.markNotSaved}</Refused>}
      <p id={`${id}-title`} className="gs-inset-title" aria-live="polite">
        {GW.sentOnWhatsApp(name)}
      </p>
      <div className="gs-inset-foot">
        <TextAction label={GW.notSent} onClick={onNotSent} />
        <Pill
          primary
          busy={busy}
          label={busy ? GW.saving : GW.markAsInvited}
          onClick={() => {
            if (busy) return;
            setFailed(false);
            setBusy(true);
            later(SAVE_MS, () => {
              if (onSent()) return;
              setBusy(false);
              setFailed(true);
            });
          }}
        />
      </div>
      <p id={`${id}-line`} className="desk-help">
        {GW.ifNotOpened}
      </p>
    </div>
  );
}

/** Messaging B's conversation with them, or the message they last had from the event. */
function Conversation({ guest, heading }: { guest: Guest; heading: string }) {
  const thread = Object.hasOwn(CONVERSATIONS, guest.id) ? guest.id : 'parking';

  return (
    <section className="desk-block" aria-labelledby={`${heading}-conversation`}>
      <Head level={3} title={<span id={`${heading}-conversation`}>{GW.conversation}</span>} />
      <ul className="desk-rows gs-rows">
        <li>
          <Link className="desk-row" to={`${MESSAGES_AT}?c=${thread}`}>
            <IconLead name="messages" />
            <RowWords title={GW.messages(2)} lines={[GW.conversationLine]} />
            <Chevron />
          </Link>
        </li>
      </ul>
    </section>
  );
}
