import { useEffect, useEffectEvent, useRef, useState } from 'react';

import {
  approvalRoles,
  CLAIM_RECORD,
  DEADLINES,
  DOMAIN,
  filled,
  firstName,
  grantable,
  inviteNote,
  inviteProblem,
  KEEPS_WORKING,
  type MembersDialog,
  ORGANISATION,
  type Person,
  PROOF_LINE,
  RECOVERY_CLOSE,
  RECOVERY_SENDING,
  RECOVERY_WORDS as RR,
  type RecoveryAnswer,
  type RecoveryPhase,
  roleMeans,
} from './members.ts';
import { ProofFields } from './MembersPerson.tsx';
import type { SettingsSay, Viewer } from './settings.ts';
import {
  Ask,
  Avatar,
  Choices,
  Dialog,
  Field,
  Head,
  Note,
  RedAction,
  RowWords,
  TextAction,
} from './SettingsParts.tsx';
import type { Tell } from './TodayParts.tsx';
import { useProof } from './useProof.ts';

const CHECK_MS = 1200;
const SEND_MS = 500;
const HOLD_MS = 8000;

/** Who to invite and as what; Send invitation checks the address before it sends, and Owner asks for the proof. */
export function InviteDialog({
  viewer,
  proved,
  start,
  onClose,
  onInvited,
}: {
  viewer: Viewer;
  proved: boolean;
  start: Extract<MembersDialog, { kind: 'invite' }>;
  onClose: () => void;
  onInvited: (email: string, role: string, proved: boolean) => void;
}) {
  const [email, setEmail] = useState(start.email);
  const [role, setRole] = useState(start.role);
  const [problem, setProblem] = useState(start.problem);
  const [proving, setProving, password, code, proofOk] = useProof(null);
  const [asking, setAsking] = useState(false);
  const field = useRef<HTMLInputElement>(null);
  const owner = role === 'Owner' && !proved;
  const changed = email !== start.email || role !== start.role;

  return (
    <>
      <Dialog
        title="Invite somebody"
        verb="Send invitation"
        first={field}
        onDismiss={() => (changed ? setAsking(true) : onClose())}
        onConfirm={() => {
          const wrong = inviteProblem(email);
          setProblem(wrong);
          if (wrong != null) return field.current?.focus();
          if (!proofOk()) return;

          onInvited(email, role, owner);
          onClose();
        }}
      >
        <div className="desk-group-in">
          <Head title="Who to invite" level={3} />
          <Field
            label="Email"
            value={email}
            inputMode="email"
            autoComplete="email"
            inputRef={field}
            error={problem}
            onChange={(value) => {
              setEmail(value);
              setProblem(null);
            }}
          />
        </div>
        <Choices
          legend="Role"
          choices={grantable(viewer).map((name) => ({ name, line: roleMeans(name) }))}
          picked={role}
          onPick={(name) => {
            setRole(name);
            setProving(
              name === 'Owner' && !proved ? { password: '', code: '', problem: null } : null,
            );
          }}
        />
        <p className="desk-line is-small">{inviteNote(role)}</p>
        {owner && proving != null && (
          <>
            <Note>{PROOF_LINE}</Note>
            <ProofFields proving={proving} onChange={setProving} password={password} code={code} />
          </>
        )}
      </Dialog>
      {asking && (
        <Ask
          title="Discard your change?"
          line="Nobody is invited."
          keep="Keep editing"
          go="Discard"
          onKeep={() => setAsking(false)}
          onGo={onClose}
        />
      )}
    </>
  );
}

/** A request to join: who asked and until when, the role to let them in with, and turning it down. */
export function RequestDialog({
  person,
  viewer,
  say,
  start,
  onClose,
  onApprove,
  onTurnDown,
}: {
  person: Person;
  viewer: Viewer;
  say: SettingsSay;
  start: Extract<MembersDialog, { kind: 'request' }>;
  onClose: () => void;
  onApprove: (role: string) => void;
  onTurnDown: () => void;
}) {
  const roles = approvalRoles(viewer);
  const [picked, setPicked] = useState(start.picked);
  const [ask, setAsk] = useState(start.ask);
  const asked = say.day(person.history[0]?.when ?? '');

  return (
    <>
      <Dialog
        title={`${firstName(person.name)}’s request`}
        verb="Approve"
        onDismiss={() => (picked === roles[0] ? onClose() : setAsk('discard'))}
        onConfirm={() => {
          onApprove(picked);
          onClose();
        }}
      >
        <div className="desk-asker">
          <Avatar initials={person.initials} tone={person.tone} size="request" />
          <div className="desk-who-words">
            <h3>{person.name}</h3>
            <p className="desk-line">{person.id}</p>
          </div>
        </div>
        <Note strong>
          {`Asked to join ${ORGANISATION} on ${asked}. Removed on ${say.deadline(DEADLINES.lucia)} if nobody answers.`}
        </Note>
        <Note>
          Only people who manage members see these requests. Nobody is added until one of you
          approves them.
        </Note>
        <Choices
          legend="Role"
          choices={roles.map((name) => ({ name, line: roleMeans(name) }))}
          picked={picked}
          onPick={setPicked}
          foot="Owner is given from Members once they have joined."
        />
        <RedAction
          label="Turn down the request…"
          line={`${person.name} is emailed that their request to join ${ORGANISATION} was turned down. The email does not say who turned it down.`}
          onClick={() => setAsk('turnDown')}
        />
      </Dialog>
      {ask === 'turnDown' && (
        <Ask
          title={`Turn down ${person.name}?`}
          line="They are not added, and they are listed under Former."
          keep="Keep the request"
          go="Turn down"
          onKeep={() => setAsk(null)}
          onGo={() => {
            onTurnDown();
            onClose();
          }}
        />
      )}
      {ask === 'discard' && (
        <Ask
          title="Discard your change?"
          line={`${firstName(person.name)}’s request keeps waiting.`}
          keep="Keep editing"
          go="Discard"
          onKeep={() => setAsk(null)}
          onGo={onClose}
        />
      )}
    </>
  );
}

/** Become the owner: the record to publish with Copy on each part, checking it, and withdrawing the claim. */
export function ClaimDialog({
  start,
  say,
  tell,
  onClose,
  onClaim,
}: {
  start: Extract<MembersDialog, { kind: 'claim' }>;
  say: SettingsSay;
  tell: Tell;
  onClose: () => void;
  onClaim: (claim: 'found' | 'withdrawn') => void;
}) {
  const [check, setCheck] = useState(start.check);
  const [copied, setCopied] = useState(start.copied);
  const [ask, setAsk] = useState(start.ask);
  const missed = useRef(start.check === 'missing');
  const busy = check === 'checking' || check === 'held';

  useEffect(() => {
    if (start.copied != null) tell(`${start.copied} copied.`);
  }, [start.copied, tell]);

  useEffect(() => {
    if (check !== 'checking') return;
    const timer = setTimeout(() => {
      if (!missed.current) {
        missed.current = true;
        setCheck('missing');
        return;
      }
      onClaim('found');
      onClose();
    }, CHECK_MS);

    return () => clearTimeout(timer);
  }, [check, onClaim, onClose]);

  return (
    <>
      <Dialog
        title="Become the owner"
        verb="Check record"
        on={!busy}
        onDismiss={onClose}
        onConfirm={() => setCheck('checking')}
      >
        <Note strong>
          To become the owner, you publish a DNS record on your company domain to prove you control
          it.
        </Note>
        <section className="desk-group-in">
          <Head title={`Prove you control ${DOMAIN}`} level={3} />
          <Note>{`Add this TXT record to the DNS for ${DOMAIN}. The value is new for this claim.`}</Note>
          <ul className="desk-rows">
            {CLAIM_RECORD.map((part) => (
              <li key={part.label} className="desk-row">
                <RowWords title={part.value} lines={[part.label]} />
                <TextAction
                  label={copied === part.label ? 'Copied' : 'Copy'}
                  before={copied === part.label ? 'tick' : 'copy'}
                  onClick={() => {
                    void navigator.clipboard?.writeText(part.value).catch(() => undefined);
                    setCopied(part.label);
                    tell(`${part.label} copied.`);
                  }}
                />
              </li>
            ))}
          </ul>
          <p className="desk-foot">{`We check every hour until ${say.deadline(DEADLINES.claim)}.`}</p>
        </section>
        <div role="status" className="desk-said">
          {busy && <Note strong>Checking the record</Note>}
          {check === 'missing' && (
            <Note strong>
              We couldn’t find the record yet. DNS changes can take up to 48 hours.
            </Note>
          )}
        </div>
        <TextAction label="Withdraw my claim" onClick={() => setAsk(true)} />
        <Note>{KEEPS_WORKING}</Note>
      </Dialog>
      {ask && (
        <Ask
          title="Withdraw your claim?"
          line={`You won’t become the owner of ${ORGANISATION}. Any admin, you included, can start a new claim.`}
          keep="Keep my claim"
          go="Withdraw"
          onKeep={() => setAsk(false)}
          onGo={() => {
            onClaim('withdrawn');
            onClose();
          }}
        />
      )}
    </>
  );
}

/** One answer to a request to get back in, asked once; a link opened while it is sent holds it for the link to show. */
export function RecoveryAsk({
  name,
  answer,
  phase: opening,
  ended,
  onKeep,
  onAnswer,
  onGone,
}: {
  name: string;
  answer: RecoveryAnswer;
  phase: RecoveryPhase;
  ended: boolean;
  onKeep: () => void;
  onAnswer: () => void;
  onGone: () => void;
}) {
  const [phase, setPhase] = useState(opening);
  const approve = answer === 'approve';
  const title = filled(approve ? RR.approveTitle : RR.turnDownTitle, { name });
  const arrive = useEffectEvent(() => (ended ? setPhase('closed') : onAnswer()));
  const sending = phase === 'sending' || phase === 'held';

  useEffect(() => {
    if (phase !== 'sending' && phase !== 'held') return;
    const timer = setTimeout(arrive, phase === 'held' ? HOLD_MS : SEND_MS);

    return () => clearTimeout(timer);
  }, [phase]);

  return phase === 'closed' ? (
    <Ask key="closed" title={title} line={RR.closed} keep={RECOVERY_CLOSE} onKeep={onGone} />
  ) : (
    <Ask
      key="asking"
      title={title}
      line={approve ? RR.approveBody : RR.turnDownBody}
      keep={approve ? RR.cancel : RR.keep}
      go={approve ? RR.approveConfirm : RR.turnDownConfirm}
      red={approve}
      busy={sending ? RECOVERY_SENDING : undefined}
      failed={phase === 'failed' ? RR.failed : undefined}
      onKeep={onKeep}
      onGo={() => {
        if (!sending) setPhase('sending');
      }}
    />
  );
}
