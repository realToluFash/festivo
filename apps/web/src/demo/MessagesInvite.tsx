import { useEffect, useId, useRef, useState } from 'react';

import { currentLocale } from '../i18n/index.ts';
import { offButton } from '../offButton.ts';
import { Glyph } from '../components/Glyph.tsx';
import { useLater } from '../useLater.ts';
import {
  type Draft,
  type Untellable,
  EVENT_NAME,
  HOSTS,
  INVITE,
  MW,
  ORGANISATION,
  PAGE_WHEN,
  byName,
  channelWord,
  filled,
  inviteCheck,
  many,
  refusalOf,
} from './messages.ts';
import { useInbox } from './messagesContext.ts';
import {
  type InviteDraft,
  type InviteRefusal,
  INVITE_WORLD,
  IW,
  REPLY_BY,
  firstOf,
  goesBySms,
  goesByWhatsApp,
  greetingOf,
  inviteChannelsOf,
  inviteReachOf,
  inviteSmsOf,
  noteRefusal,
  noteTooLong,
  previewPeople,
  weddingAbout,
  whatsAppInvitationOf,
} from './messagesInvite.ts';
import type { OneGuest } from './messagesTo.ts';
import { chipWords } from './messagesTo.ts';
import { OnEscape, TickChip } from './MessagesCompose.tsx';
import { WhatsAppReach, WhereGlyph } from './MessagesParts.tsx';
import { FILL_MS, PreviewAs, PreviewBones } from './MessagesPreview.tsx';
import { PW } from './messagesPreviewWords.ts';
import { ToPopover } from './MessagesTo.tsx';
import { WaitBlock } from './MessagesWaits.tsx';
import { demoWords } from './demoWords.ts';
import './messagesInvite.css';

const iw = demoWords(IW);

/** sc-3950's reach line and sc-3954's instead line, whenever WhatsApp is ticked (sc-45251). */
function ReachLines({ whatsApp, instead }: { whatsApp: string | null; instead: string | null }) {
  return (
    <>
      {whatsApp != null && <WhatsAppReach line={whatsApp} />}
      {instead != null && <p className="mg-instead">{instead}</p>}
    </>
  );
}
const ANSWERS = [MW.replyYes, MW.replyNo, MW.replyNotSure];

function invitationLines(guest: OneGuest): { subject: string; lines: string[] } {
  return {
    subject: filled(MW.inviteSubject, { event: EVENT_NAME, hosts: HOSTS }),
    lines: [
      filled(MW.dear, { greeting: greetingOf(guest) }),
      filled(MW.invitedOn, { event: EVENT_NAME, date: INVITE.date }),
      filled(MW.willYou, { replyBy: REPLY_BY }),
    ],
  };
}

/** An invitation on the composer (sc-3971): To and Let them know by at the head, Soirely's invitation as the first guest sees it, the check, and the note for their page at the foot. */
export function InviteCompose() {
  const { inbox, act, focus, to: event } = useInbox();
  const draft = inbox.draft;
  const [toOpen, setToOpen] = useState(draft?.openTo === true);
  const [refused, setRefused] = useState<string | null>(null);
  const chip = useRef<HTMLButtonElement>(null);
  const byId = useId();
  const { viewed } = event;

  useEffect(() => viewed(), [viewed]);

  if (draft?.invite == null) return null;

  const current = draft;
  const invite = draft.invite;
  const groups = event.book.groups;
  const first = firstOf(draft.to, groups);

  function update(next: Partial<InviteDraft>): void {
    act({ kind: 'draft', draft: { invite: { ...invite, ...next } } });
  }

  function send(): void {
    const why = refusalOf(current.to, groups, INVITE_WORLD);

    if (why != null) {
      setRefused(why);
      focus('refused');
      return;
    }
    setRefused(null);
    if (noteTooLong(invite.note)) {
      update({ wrong: true, pressed: true });
      focus('body');
      return;
    }
    act({
      kind: 'draft',
      draft: { step: 'check', invite: { ...invite, wrong: false, pressed: true } },
    });
    focus('check');
  }

  function edit(): void {
    act({ kind: 'draft', draft: { step: 'write' } });
    focus('body');
  }

  return (
    <div className="mg-in is-compose">
      <h2 className="desk-unseen">{MW.invitation}</h2>
      {draft.step !== 'preview' && (
        <header className="mg-to-head">
          <div className="mg-to-row">
            <span className="mg-to-label">{MW.to}</span>
            <div className="mg-to-at">
              <button
                ref={chip}
                type="button"
                className="mg-to-chip"
                aria-haspopup="dialog"
                aria-expanded={toOpen}
                data-focus="to-chip"
                onClick={() => setToOpen((open) => !open)}
              >
                {chipWords(draft.to, event.book, INVITE_WORLD)}
                <Glyph name="chevdown" size={14} weight={2.6} />
              </button>
              {toOpen && (
                <ToPopover
                  to={draft.to}
                  chip={chip}
                  invite
                  onPick={(to) => {
                    act({ kind: 'draft', draft: { to } });
                    setRefused(null);
                  }}
                  onClose={(back) => {
                    setToOpen(false);
                    if (back) focus('to-chip');
                  }}
                />
              )}
            </div>
          </div>
          <div className="mg-by-row" role="group" aria-labelledby={byId}>
            <span id={byId} className="mg-by-label">
              {MW.letThemKnowBy}
            </span>
            <InviteTicks draft={draft} />
          </div>
          {draft.step === 'write' && (
            <ReachLines {...inviteReachOf(draft.to, invite.wa, draft.ticks, groups)} />
          )}
        </header>
      )}
      {draft.step === 'preview' ? (
        <>
          <div className="mg-compose-body is-top">
            <InvitePreview draft={draft} invite={invite} />
          </div>
          <div className="mg-preview-bar">
            <button type="button" className="desk-text" data-focus="preview-edit" onClick={edit}>
              <Glyph name="pen" size={17} weight={2.2} />
              {MW.edit}
            </button>
            <button type="button" className="desk-text" aria-pressed="true" onClick={edit}>
              <Glyph name="eye" size={17} weight={2.2} />
              {MW.previewOn}
            </button>
            <span className="today-grow" />
            <button type="button" className="mg-send" aria-label={MW.send} onClick={send}>
              <Glyph name="send" size={20} weight={2.4} />
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="mg-compose-body">
            {first != null && <Inset guest={first} />}
            {draft.step === 'check' && <InviteCard draft={draft} invite={invite} />}
            {draft.step === 'write' && inbox.cancelled && (
              <p className="mg-status" role="status">
                <Glyph name="info" size={15} weight={2.2} />
                {IW.cancelled}
              </p>
            )}
          </div>
          <NoteBox
            invite={invite}
            held={draft.step === 'check'}
            refused={refused}
            previewOff={first == null ? PW.nobodyToPreview : null}
            onNote={update}
            onSend={send}
            onPreview={() => {
              act({ kind: 'draft', draft: { step: 'preview' } });
              focus('preview-edit');
            }}
          />
        </>
      )}
    </div>
  );
}

/** Email and SMS, and WhatsApp once Soirely's template is approved (sc-45251). */
function InviteTicks({ draft }: { draft: Draft }) {
  const { act } = useInbox();

  return (
    <div className="mg-ticks">
      {inviteChannelsOf(draft.invite?.wa).map((channel) => (
        <TickChip
          key={channel}
          word={channelWord(channel)}
          on={draft.ticks[channel]}
          onToggle={() =>
            act({
              kind: 'draft',
              draft: { ticks: { ...draft.ticks, [channel]: !draft.ticks[channel] } },
            })
          }
        />
      ))}
    </div>
  );
}

function Inset({ guest }: { guest: OneGuest }) {
  const headId = useId();
  const words = invitationLines(guest);

  return (
    <section className="mgi-inset" aria-labelledby={headId}>
      <h3 id={headId} className="mgi-inset-head">
        <span className="mgi-inset-name">{MW.invitation}</span>
        {` · ${filled(MW.previewAs, { name: guest.name })}`}
      </h3>
      <div className="mg-tell-box mgi-inset-box">
        <p className="mgi-subject">{words.subject}</p>
        {words.lines.map((line) => (
          <p key={line}>{line}</p>
        ))}
        <p className="mgi-answers">{ANSWERS.join(' · ')}</p>
      </div>
      <p className="mg-tell-hint">{MW.eachLanguage}</p>
    </section>
  );
}

function NoteBox({
  invite,
  held,
  refused,
  previewOff,
  onNote,
  onSend,
  onPreview,
}: {
  invite: InviteDraft;
  held: boolean;
  refused: string | null;
  previewOff: string | null;
  onNote: (next: Partial<InviteDraft>) => void;
  onSend: () => void;
  onPreview: () => void;
}) {
  const noteId = useId();
  const hintId = useId();
  const wrongId = useId();
  const refusedId = useId();
  const offId = useId();
  const wrong = invite.wrong ? noteRefusal(invite.note) : null;

  return (
    <form
      className={[
        'mg-composer mgi-note-box',
        held ? 'is-held' : '',
        wrong == null ? '' : 'is-wrong',
      ].join(' ')}
      onSubmit={(press) => {
        press.preventDefault();
        onSend();
      }}
    >
      <label htmlFor={noteId} className="mg-tell-label">
        {MW.noteForGuests}
        <span className="mg-optional">{MW.optional}</span>
      </label>
      <textarea
        id={noteId}
        className="mgi-note"
        rows={1}
        value={invite.note}
        readOnly={held}
        aria-invalid={wrong == null ? undefined : true}
        aria-describedby={wrong == null ? hintId : `${wrongId} ${hintId}`}
        aria-keyshortcuts="Meta+Enter Control+Enter"
        data-focus="body"
        onChange={(typed) => {
          const note = typed.target.value;

          onNote({ note, wrong: invite.wrong && noteTooLong(note) });
        }}
        onBlur={() => {
          if (invite.pressed && !held) onNote({ wrong: noteTooLong(invite.note) });
        }}
        onKeyDown={(key) => {
          if (key.key !== 'Enter' || !(key.metaKey || key.ctrlKey)) return;
          key.preventDefault();
          onSend();
        }}
      />
      {wrong != null && (
        <p id={wrongId} className="mg-tell-hint is-wrong" role="alert">
          <Glyph name="alert" size={15} weight={2.2} />
          {wrong}
        </p>
      )}
      {refused != null && (
        <p id={refusedId} className="desk-error" role="alert" tabIndex={-1} data-focus="refused">
          <Glyph name="alert" size={15} weight={2.2} />
          {refused}
        </p>
      )}
      {held ? (
        <p id={hintId} className="mg-tell-hint">
          {invite.wa == null ? IW.noteHint : MW.noteHint}
        </p>
      ) : (
        <div className="mg-tools">
          <button
            type="button"
            className="desk-text mg-preview-tool"
            data-focus="preview"
            aria-describedby={previewOff == null ? undefined : offId}
            {...offButton(previewOff != null)}
            onClick={onPreview}
          >
            <Glyph name="eye" size={17} weight={2.2} />
            {MW.preview}
          </button>
          <span id={hintId} className="mg-goes-page">
            {invite.wa == null ? IW.noteHint : MW.noteHint}
          </span>
          <button
            type="submit"
            className="mg-send"
            aria-label={MW.send}
            aria-keyshortcuts="Meta+Enter Control+Enter"
            aria-describedby={refused == null ? undefined : refusedId}
            data-focus="send"
          >
            <Glyph name="send" size={20} weight={2.4} />
          </button>
        </div>
      )}
      {!held && previewOff != null && (
        <p id={offId} className="mg-why">
          <Glyph name="info" size={16} weight={2.2} />
          <span>{previewOff}</span>
        </p>
      )}
    </form>
  );
}

function CantLines({
  head,
  count,
  names,
  onSeeAll,
}: {
  head: string | null;
  count: number;
  names: InviteRefusal['cantNames'];
  onSeeAll: () => void;
}) {
  return (
    <div className="mg-cant">
      {head != null && <p className="mg-cant-head">{head}</p>}
      {names.map((one) => (
        <p key={one.name}>{[one.name, ...one.why].join(' · ')}</p>
      ))}
      {count > names.length && (
        <button type="button" className="desk-text" data-focus="see-all-cant" onClick={onSeeAll}>
          {filled(MW.seeAll, { count })}
        </button>
      )}
    </div>
  );
}

/** See all, open in the card as sc-3954's: everyone in it A to Z, each with their line; the actions stay under it. */
function InviteSeeAll({
  head,
  people,
  onBack,
}: {
  head: string;
  people: readonly Untellable[];
  onBack: () => void;
}) {
  const headId = useId();

  return (
    <div className="mg-all">
      <button type="button" className="desk-text mg-all-back" onClick={onBack}>
        <Glyph name="back" size={17} weight={2.2} />
        {MW.backToCheck}
      </button>
      <p id={headId} className="mg-cant-head" tabIndex={-1} data-focus="see-all">
        {head}
      </p>
      <ul className="mg-all-list" aria-labelledby={headId}>
        {byName(people, currentLocale()).map((one) => (
          <li key={one.name} className="mg-all-row">
            <span className="mg-all-name">{one.name}</span>
            <span>{one.why.join(' · ')}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The invitation's check, or why it cannot go (sc-3971): a card in the stream, Escape and Change it give the note back. */
function InviteCard({ draft, invite }: { draft: Draft; invite: InviteDraft }) {
  const { inbox, act, focus, to } = useInbox();
  const result = inviteCheck(draft, inbox.balance, to.book.groups);
  const sentenceId = useId();
  const alreadyId = useId();
  const choice = useId();
  const listing =
    invite.seeAll === 'already' && result.kind === 'check' && result.already > 0
      ? { head: iw.many('alreadyHave', result.already), people: result.alreadyAll }
      : invite.seeAll === 'cant' && result.cant > 0
        ? { head: iw.many('cantBeReached', result.cant), people: result.cantAll }
        : null;
  const { seeAll: _open, ...shut } = invite;

  function back(): void {
    act({ kind: 'draft', draft: { step: 'write', invite: shut } });
    focus('send');
  }

  function seeAll(open: 'already' | 'cant' | null): void {
    act({ kind: 'draft', draft: { invite: open == null ? shut : { ...invite, seeAll: open } } });
    focus(open == null ? `see-all-${invite.seeAll ?? 'already'}` : 'see-all');
  }

  const close = listing == null ? back : () => seeAll(null);
  const seeAllList = listing != null && (
    <InviteSeeAll head={listing.head} people={listing.people} onBack={() => seeAll(null)} />
  );

  if (result.kind === 'refused')
    return (
      <div
        className="mg-check"
        role="alertdialog"
        aria-label={MW.checkName}
        aria-describedby={sentenceId}
      >
        <OnEscape then={close} />
        <p id={sentenceId} className="mg-check-sentence" tabIndex={-1} data-focus="check">
          {result.title}
        </p>
        {seeAllList || (
          <>
            <p className="mg-check-line">{result.reason}</p>
            <InviteTicks draft={draft} />
            {result.cantNames.length > 0 && (
              <CantLines
                head={null}
                count={result.cant}
                names={result.cantNames}
                onSeeAll={() => seeAll('cant')}
              />
            )}
          </>
        )}
        <div className="mg-check-acts">
          <button type="button" className="desk-text" onClick={back}>
            {MW.changeIt}
          </button>
        </div>
      </div>
    );

  return (
    <div
      className="mg-check"
      role="alertdialog"
      aria-label={MW.checkName}
      aria-describedby={sentenceId}
    >
      <OnEscape then={close} />
      <p id={sentenceId} className="mg-check-sentence" tabIndex={-1} data-focus="check">
        {many('cannotUndo', result.count)}
      </p>
      {seeAllList || (
        <>
          {result.already > 0 && (
            <div className="mgi-already">
              <p id={alreadyId} className="mg-cant-head">
                {iw.many('alreadyHave', result.already)}
              </p>
              {result.named.map((one) => (
                <p key={one.name} className="mgi-named">
                  {[one.name, ...one.why].join(' · ')}
                </p>
              ))}
              {result.already > result.named.length && (
                <button
                  type="button"
                  className="desk-text"
                  data-focus="see-all-already"
                  onClick={() => seeAll('already')}
                >
                  {filled(MW.seeAll, { count: result.already })}
                </button>
              )}
              {result.choose && (
                <div className="mgi-choice" role="radiogroup" aria-labelledby={alreadyId}>
                  {[false, true].map((value) => (
                    <label key={String(value)} className="mg-radio-row">
                      <input
                        type="radio"
                        name={choice}
                        className="desk-radio"
                        checked={invite.again === value}
                        onChange={() =>
                          act({ kind: 'draft', draft: { invite: { ...invite, again: value } } })
                        }
                      />
                      <span>{value ? IW.sendAgain : IW.leaveOut}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
          <InviteTicks draft={draft} />
          {result.pills.length > 0 && (
            <ul className="mg-pills">
              {result.pills.map((pill) => (
                <li key={pill.channel}>
                  <WhereGlyph where={pill.channel} size={15} />
                  {channelWord(pill.channel)} · {pill.count}
                </li>
              ))}
            </ul>
          )}
          {result.cant > 0 && (
            <CantLines
              head={iw.many('cantBeReached', result.cant)}
              count={result.cant}
              names={result.cantNames}
              onSeeAll={() => seeAll('cant')}
            />
          )}
          <ReachLines whatsApp={result.whatsApp} instead={result.instead} />
          {result.credits != null && <p className="mg-credits">{result.credits}</p>}
          {result.waits != null && <WaitBlock waits={result.waits} />}
        </>
      )}
      <div className="mg-check-acts">
        <button
          type="button"
          className="button button-primary mg-go"
          data-focus="go"
          onClick={() => {
            act({ kind: 'go' });
            focus('cancel');
          }}
        >
          {many('sendTo', result.count)}
        </button>
        <button type="button" className="desk-text" onClick={back}>
          {MW.changeIt}
        </button>
      </div>
    </div>
  );
}

function optionWords(guest: OneGuest): string {
  return filled(PW.option, { name: guest.name, language: 'English' });
}

/** The invitation as one guest of the audience gets it: their page with the note, if any, and Soirely's own email and text. */
function InvitePreview({ draft, invite }: { draft: Draft; invite: InviteDraft }) {
  const { act, mesh, to } = useInbox();
  const later = useLater();
  const people = previewPeople(draft.to, to.book.groups, invite.wa);
  const [who, setWho] = useState(invite.previewAs ?? people[0]?.id ?? '');
  const [filling, setFilling] = useState(false);
  const person = people.find((one) => one.id === who) ?? people[0];

  if (person == null) return null;

  const note = invite.note.trim();
  const words = invitationLines(person);
  const email = draft.ticks.email && person.email;
  const sms = goesBySms(person, draft.ticks, invite.wa);
  const shownWa = goesByWhatsApp(person, draft.ticks, invite.wa);
  const wa = whatsAppInvitationOf(person, invite.noReplyBy === true);

  function pick(id: string): void {
    setWho(id);
    setFilling(true);
    act({ kind: 'draft', draft: { invite: { ...invite, previewAs: id } } });
    later(FILL_MS, () => setFilling(false));
  }

  return (
    <div className="mg-preview">
      <div className="mg-preview-top">
        <h3 className="mg-preview-heading">{filled(MW.previewAs, { name: person.name })}</h3>
        <PreviewAs
          who={person.id}
          options={people.map((one) => ({ id: one.id, words: optionWords(one) }))}
          first={false}
          onPick={pick}
        />
      </div>
      <p className="desk-unseen" role="status">
        {filling ? filled(PW.filling, { name: person.name }) : ''}
      </p>
      {filling ? (
        <PreviewBones name={person.name} />
      ) : (
        <>
          <div className={note === '' ? 'mg-preview-cols mgi-cols-one' : 'mg-preview-cols'}>
            {note !== '' && (
              <section
                className="mg-page"
                aria-label={filled(IW.onTheirPage, { name: person.name })}
              >
                <div className={`mg-page-cover today-cover is-${mesh}`}>
                  <span className="desk-piece p1" aria-hidden="true" />
                  <span className="desk-piece p2" aria-hidden="true" />
                  <span className="desk-piece p4" aria-hidden="true" />
                  <p className="mg-page-name">{EVENT_NAME}</p>
                  <p className="mg-page-when">{PAGE_WHEN}</p>
                </div>
                <div className="mgi-page-messages">
                  <h4 className="mgi-page-head">{IW.messages}</h4>
                  <p className="mgi-page-meta">{filled(IW.noteFrom, { hosts: HOSTS })}</p>
                  <p className="mgi-page-bubble">{note}</p>
                </div>
              </section>
            )}
            {(email || sms || shownWa) && (
              <section className="mg-sends" aria-label={MW.whatSoirelySends}>
                <h3>{MW.whatSoirelySends}</h3>
                {email && (
                  <div className="mg-email">
                    <p className="mg-notice-head">
                      <WhereGlyph where="email" />
                      {filled(MW.emailFrom, { organisation: HOSTS })}
                    </p>
                    <div className="mg-notice-words">
                      <p className="mg-email-subject">{words.subject}</p>
                      {words.lines.map((line) => (
                        <p key={line}>{line}</p>
                      ))}
                      <div className="mgi-email-answers">
                        {ANSWERS.map((answer) => (
                          <span key={answer} className="mg-email-button">
                            {answer}
                          </span>
                        ))}
                      </div>
                      <p>{IW.eachAnswer}</p>
                      <p>{IW.notForward}</p>
                      <p className="mgi-email-why">
                        {filled(IW.whySent, { organisation: ORGANISATION, event: EVENT_NAME })}
                      </p>
                      <span className="mg-email-stop">
                        {filled(MW.stopEmails, { organisation: ORGANISATION })}
                      </span>
                    </div>
                  </div>
                )}
                {sms && (
                  <div className="mg-notice">
                    <p className="mg-notice-head">
                      <WhereGlyph where="sms" />
                      {many('smsParts', inviteSmsOf(person, weddingAbout()).parts)}
                    </p>
                    <p className="mg-notice-bubble mgi-sms">
                      {inviteSmsOf(person, weddingAbout()).text}
                    </p>
                  </div>
                )}
                {shownWa && (
                  <div className="mg-notice">
                    <p className="mg-notice-head">
                      <WhereGlyph where="whatsApp" />
                      {MW.whatsAppTemplate}
                    </p>
                    <div
                      className="mg-notice-bubble is-wa mi-wa"
                      lang={wa.lang === 'en' ? undefined : wa.lang}
                    >
                      {wa.lines.map((line) => (
                        <p key={line}>{line}</p>
                      ))}
                      <span>{wa.button}</span>
                    </div>
                  </div>
                )}
              </section>
            )}
          </div>
          <ul className="mg-preview-lines">
            <li>
              {person.greetAs == null
                ? filled(MW.greetedAs, { name: person.name })
                : filled(PW.greetedAs, { greetAs: person.greetAs })}
            </li>
            <li>{filled(PW.organisationLanguage, { language: 'English' })}</li>
            {note !== '' && <li>{MW.onlyOurs}</li>}
          </ul>
        </>
      )}
    </div>
  );
}
