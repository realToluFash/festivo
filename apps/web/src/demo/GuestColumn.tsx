import { type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router';

import type { SampleEvent } from './events.ts';
import { Glyph } from '../components/Glyph.tsx';
import {
  type Guest,
  type Invite,
  LINK,
  ORGANISATION_LANGUAGE,
  WEDDING,
  cardLine,
  companionName,
  dayOf,
  languageName,
  namedOf,
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
} from './GuestsParts.tsx';
import { GW, HOW_INVITED, type HowInvited, REPLY_WORDS } from './guestsWords.ts';
import { GUESTS as CONVERSATIONS, MESSAGES_AT } from './messages.ts';
import { Turning } from './DataControlParts.tsx';
import { THEIR_WORDS } from './guestRequest.ts';
import { whatsAppRowOf } from './whatsAppConsent.ts';
import { CardStep, Chevron, Head, RowWords, TextAction } from '../components/SettingsParts.tsx';

export interface GuestActions {
  onRecord: () => void;
  onEdit: () => void;
  onReopen: () => void;
  onCopy: () => void;
  onReplace: () => void;
  onInvite: (invite: Invite | null) => void;
  onMark: (how: HowInvited) => void;
  onAgree: () => void;
}

type Step = { label: string; does: () => void } | null;

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
}: {
  guest: Guest;
  event: SampleEvent;
  clock: Date;
  manages: boolean;
  note: 'recorded' | 'notReplaced' | undefined;
  invite: Invite | undefined;
  actions: GuestActions;
  /** sc-30193: while their data is erased nothing changes; once erased, what stays and the line saying so. */
  erase?: 'erasing' | 'erased' | null;
  erasedLine?: string;
  theirData?: ReactNode;
}) {
  const heading = useId();
  const acts = manages && erase == null;
  const replyBy = replyByOf(event.id);
  const invited = guest.reply !== 'notYet' && guest.reply !== 'walkIn';
  const closed = invited && repliesClosed(event.id, clock) && guest.reopened == null;
  const replied =
    guest.reply === 'coming' || guest.reply === 'notSure' || guest.reply === 'notComing';
  const draft = event.status === 'draft';
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
  else if (guest.reply === 'notYet' && event.status === 'live')
    step = { label: GW.markAsInvited, does: () => actions.onInvite('mark') };

  return (
    <div className="gs-guest">
      {note === 'recorded' && <OkLine>{GW.recorded}</OkLine>}
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
      {erase === 'erasing' && <Turning words={THEIR_WORDS.erasing} />}
      {note === 'notReplaced' && <Refused>{GW.notReplaced}</Refused>}
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
      {acts && !draft && guest.reply !== 'walkIn' && (
        <Invitation
          guest={guest}
          event={event}
          invite={invite}
          heading={heading}
          actions={actions}
        />
      )}
      {manages && invited && event.id === WEDDING && erase !== 'erased' && (
        <Conversation guest={guest} heading={heading} />
      )}
      {theirData}
    </div>
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
        {guest.companions.length > 0 && (
          <li className="desk-row">
            <IconLead name="users" />
            <RowWords
              title={`${GW.withCompanions(guest.companions.length)} · ${GW.namedOf(namedOf(guest), guest.companions.length)}`}
              lines={[GW.placesFor]}
            />
          </li>
        )}
        {guest.companions.map((companion) => (
          <li key={companion.id} className="desk-row">
            <MarkLead reply={companion.reply} />
            <div className="gs-row-words">
              <RowWords
                title={companionName(guest, companion)}
                lines={[
                  companion.reply === 'held'
                    ? GW.heldCompanion
                    : GW.companion(REPLY_WORDS[companion.reply]),
                ]}
              />
              {companion.namedBy === 'guest' && (
                <span className="gs-named-by">{GW.namedByGuest}</span>
              )}
            </div>
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

function Invitation({
  guest,
  event,
  invite,
  heading,
  actions,
}: {
  guest: Guest;
  event: SampleEvent;
  invite: Invite | undefined;
  heading: string;
  actions: GuestActions;
}) {
  const notYet = guest.reply === 'notYet';
  const marking = invite === 'mark' || invite === 'markRefused' || invite === 'markNotSaved';

  return (
    <section className="desk-block" aria-labelledby={`${heading}-invitation`}>
      <Head level={3} title={<span id={`${heading}-invitation`}>{GW.invitation}</span>} />
      <ul className="desk-rows gs-rows">
        {guest.replaced != null && (
          <li className="desk-row">
            <IconLead name="refresh" />
            <RowWords
              title={GW.linkReplaced(dayOf(guest.replaced))}
              lines={[GW.linkReplacedLine]}
            />
          </li>
        )}
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
              {notYet && event.status === 'live' && (
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
        {notYet && event.status === 'live' && (
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
      {marking && notYet && (
        <MarkInset start={invite} onCancel={() => actions.onInvite(null)} onMark={actions.onMark} />
      )}
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
