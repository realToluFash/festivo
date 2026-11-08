import { REQUEST_MESSAGE_MAXIMUM } from '@soirely/domain';
import { type FormEvent, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router';

import { offField } from '../offField.ts';
import { BoardPage, HaveAccount, SignedInAs } from './BoardPage.tsx';
import { Details, type Flow } from './NewAccount.tsx';
import {
  type Answer,
  Answers,
  Heading,
  Notice,
  Organisation,
  PasswordField,
  fieldClass,
  useBusy,
} from './parts.tsx';
import { type AccountLines, BREACHED, SAMPLE, accountLines, way } from './rules.ts';

const FLOW: Flow = { name: SAMPLE.name, email: SAMPLE.email, phone: '' };
const INVITED_BY = `Invitation from ${SAMPLE.inviter} · ${SAMPLE.role}`;

export function WaysInBoard() {
  const [params] = useSearchParams();
  const location = useLocation();
  const page = params.get('page') ?? 'ask';
  const state = params.get('state') ?? '';
  const key = `${page}:${state}:${location.key}`;

  switch (page) {
    case 'invitation':
      return <Invitation key={key} state={state} />;
    case 'details':
      return <YourDetails key={key} state={state} />;
    case 'waiting':
      return <Waiting key={key} />;
    default:
      return <AskToJoin key={key} state={state} />;
  }
}

/* Ask to join, from a request link */

/** The answers a request can meet, each the line under the title and the one way on. */
const ASKED: Record<string, { title: string; body: string; open?: boolean }> = {
  sent: {
    title: `Your request has gone to ${SAMPLE.organisation}`,
    body: 'We’ll email you when they answer.',
  },
  asked: {
    title: `You have already asked to join ${SAMPLE.organisation}`,
    body: 'We’ll email you when they answer.',
  },
  member: {
    title: `You already belong to ${SAMPLE.organisation}`,
    body: 'Open it to carry on.',
    open: true,
  },
  cooling: {
    title: `${SAMPLE.organisation} answered your last request`,
    body: `You can ask again from ${SAMPLE.askAgainFrom}.`,
  },
};

function AskToJoin({ state }: { state: string }) {
  const [message, setMessage] = useState('');
  const [line, setLine] = useState<string | null>(null);
  const [asked, setAsked] = useState(ASKED[state] ?? null);
  const [busy, after] = useBusy();
  const field = useRef<HTMLTextAreaElement>(null);
  const title = `Ask to join ${SAMPLE.organisation}`;

  if (state === 'dead') {
    return (
      <BoardPage end={null}>
        <Heading title="This link does not work">
          <p className="demo-muted">Ask the organisation for a new one.</p>
        </Heading>
        <Link className="button demo-wide" to="/demo/sign-in">
          Go to Soirely
        </Link>
      </BoardPage>
    );
  }

  if (state === '') {
    return (
      <BoardPage end={null}>
        <Heading title={title} />
        <Organisation line="Request link" />
        <p className="demo-text">
          Sign in or create an account to ask to join {SAMPLE.organisation}. You will come back
          here.
        </p>
        <div className="demo-choices">
          <Link className="button button-primary demo-wide" to={way('ask', 'signed-in')}>
            Sign in
          </Link>
          <Link className="button demo-wide" to={way('ask', 'signed-in')}>
            Create an account
          </Link>
        </div>
      </BoardPage>
    );
  }

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (busy) return;

    if (message.length > REQUEST_MESSAGE_MAXIMUM) {
      setLine(`Keep your message to ${REQUEST_MESSAGE_MAXIMUM} characters or fewer.`);
      field.current?.focus();
      return;
    }

    after(() => setAsked(ASKED.sent ?? null));
  }

  return (
    <BoardPage end={<SignedInAs />}>
      <Heading title={title} />
      <Organisation line="Request link" />
      {asked != null ? (
        <>
          <Notice title={asked.title} body={asked.body} />
          <Link
            className="button button-primary demo-wide"
            to={asked.open === true ? '/demo/today' : way('waiting')}
          >
            {asked.open === true ? `Open ${SAMPLE.organisation}` : 'Continue'}
          </Link>
        </>
      ) : (
        <form className="demo-form" noValidate onSubmit={submit}>
          <div className={fieldClass(line != null)}>
            <div className="demo-label-row">
              <label htmlFor="message">Message</label>
              <span className="demo-optional">Optional</span>
            </div>
            <textarea
              ref={field}
              className="demo-input demo-message"
              id="message"
              value={message}
              {...offField(busy)}
              aria-invalid={line != null}
              aria-describedby={line == null ? 'message-count' : 'message-line message-count'}
              onChange={(event) => {
                setMessage(event.target.value);
                if (event.target.value.length <= REQUEST_MESSAGE_MAXIMUM) setLine(null);
              }}
            />
            {line != null && (
              <p className="demo-line" id="message-line">
                {line}
              </p>
            )}
            <p className="demo-help" id="message-count">
              {message.length} of {REQUEST_MESSAGE_MAXIMUM} characters.
            </p>
          </div>
          <div className="demo-choices">
            <button className="button button-primary demo-wide" type="submit" aria-busy={busy}>
              {busy ? 'Asking…' : 'Ask to join'}
            </button>
            <p className="demo-help">
              {SAMPLE.organisation} sees your name, your email address and your message.
            </p>
          </div>
        </form>
      )}
    </BoardPage>
  );
}

/* An invitation, from its email */

/** The invitation's refusals: the title says which, the line what to do. */
const REFUSED: Record<string, { title: string; body: string; line?: string }> = {
  expired: {
    title: 'This invitation has expired',
    body: `Ask ${SAMPLE.inviter} to send a new one.`,
  },
  withdrawn: {
    title: 'This invitation was withdrawn',
    body: 'If you think this is a mistake, ask the person who invited you.',
  },
  declined: {
    title: 'Already declined',
    body: `If you have changed your mind, ask ${SAMPLE.inviter} to invite you again.`,
  },
  'not-yours': {
    title: 'This invitation is for someone else',
    body: `It was sent to ${SAMPLE.email}. You are signed in as ${SAMPLE.otherEmail}.`,
  },
  deleted: {
    title: 'This organisation is gone',
    body: `The invitation to ${SAMPLE.organisation} can no longer be accepted.`,
    line: 'Deleted',
  },
};

function Invitation({ state }: { state: string }) {
  const navigate = useNavigate();
  const [pressed, setPressed] = useState<Answer | null>(null);
  const [, after] = useBusy();
  const refused = REFUSED[state];

  if (state === '') return <JoinAsNew />;

  if (state === 'joined') {
    return (
      <BoardPage end={<SignedInAs />}>
        <Heading title="You are in">
          <p className="demo-muted">
            You joined {SAMPLE.organisation} as {SAMPLE.role}.
          </p>
        </Heading>
        <Organisation line={INVITED_BY} />
        <Link className="button button-primary demo-wide" to="/demo/today">
          Open {SAMPLE.organisation}
        </Link>
      </BoardPage>
    );
  }

  if (state === 'answered') {
    return (
      <BoardPage end={<SignedInAs />}>
        <Heading title="Invitation declined">
          <p className="demo-muted">You declined. {SAMPLE.inviter} will see that you said no.</p>
        </Heading>
        <Organisation line={INVITED_BY} />
        <Link className="button demo-wide" to="/demo/today">
          Go to Soirely
        </Link>
      </BoardPage>
    );
  }

  if (refused != null) {
    const notYours = state === 'not-yours';

    return (
      <BoardPage end={<SignedInAs email={notYours ? SAMPLE.otherEmail : SAMPLE.email} />}>
        <Heading title={refused.title}>
          <p className="demo-muted">{refused.body}</p>
        </Heading>
        <Organisation line={refused.line ?? INVITED_BY} />
        {notYours ? (
          <Link className="button button-primary demo-wide" to={way('invitation')}>
            Sign out and use {SAMPLE.email}
          </Link>
        ) : (
          <Link className="button demo-wide" to="/demo/today">
            Go to Soirely
          </Link>
        )}
      </BoardPage>
    );
  }

  function answer(chosen: Answer): void {
    setPressed(chosen);
    after(() => void navigate(way('invitation', chosen === 'accept' ? 'joined' : 'answered')));
  }

  return (
    <BoardPage end={<SignedInAs />}>
      <Heading title={`Join ${SAMPLE.organisation}?`} />
      <InvitedBy who="you" />
      <Answers pressed={pressed} onAnswer={answer} />
    </BoardPage>
  );
}

/** The organisation, who invited whom, and until when. */
function InvitedBy({ who }: { who: string }) {
  return (
    <div className="demo-invited">
      <Organisation line={INVITED_BY} />
      <div className="demo-invited-lines">
        <p className="demo-text">
          {SAMPLE.inviter} invited {who} to join as {SAMPLE.role}.
        </p>
        <p className="demo-help">This invitation works until {SAMPLE.invitedUntil}.</p>
      </div>
    </div>
  );
}

function JoinAsNew() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [lines, setLines] = useState<AccountLines>({});
  const [breached, setBreached] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [busy, after] = useBusy();
  const nameField = useRef<HTMLInputElement>(null);
  const passwordField = useRef<HTMLInputElement>(null);

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (busy) return;

    const found = accountLines(name, SAMPLE.email, password);
    setLines(found);
    setBreached(false);
    if (found.name != null || found.password != null) {
      (found.name != null ? nameField : passwordField).current?.focus();
      return;
    }

    setRevealed(false);
    after(() => {
      if (password === SAMPLE.breachedPassword) {
        setBreached(true);
        passwordField.current?.focus();
        return;
      }

      void navigate(way('invitation', 'joined'));
    });
  }

  function edited(field: keyof AccountLines, now: AccountLines): void {
    if (lines[field] == null) return;

    setLines((was) => ({ ...was, [field]: now[field] }));
  }

  const passwordLine = lines.password ?? (breached ? BREACHED : null);

  return (
    <BoardPage end={<HaveAccount />}>
      <div className="demo-invitation-page">
        <Heading title={`Join ${SAMPLE.organisation}`} />
        <InvitedBy who={SAMPLE.email} />
        <form className="demo-form" noValidate onSubmit={submit}>
          <div className="demo-fields">
            <div className="demo-field">
              <label htmlFor="email">Email</label>
              <input
                className="demo-input demo-fixed"
                id="email"
                type="email"
                value={SAMPLE.email}
                readOnly
                aria-describedby="email-help"
              />
              <p className="demo-help" id="email-help">
                This is the address the invitation was sent to. It is already confirmed, so there is
                no code to enter.
              </p>
            </div>

            <div className={fieldClass(lines.name != null)}>
              <label htmlFor="name">Full name</label>
              <input
                ref={nameField}
                className="demo-input"
                id="name"
                autoComplete="name"
                value={name}
                {...offField(busy)}
                aria-invalid={lines.name != null}
                aria-describedby={lines.name == null ? undefined : 'name-line'}
                onChange={(event) => {
                  setName(event.target.value);
                  edited('name', accountLines(event.target.value, SAMPLE.email, password));
                }}
              />
              {lines.name != null && (
                <p className="demo-line" id="name-line">
                  {lines.name}
                </p>
              )}
            </div>

            <PasswordField
              label="Password"
              field={passwordField}
              password={password}
              line={passwordLine}
              busy={busy}
              revealed={revealed}
              onReveal={setRevealed}
              onChange={(typed) => {
                setPassword(typed);
                setBreached(false);
                edited('password', accountLines(name, SAMPLE.email, typed));
              }}
            />
          </div>

          <button className="button button-primary demo-wide" type="submit" aria-busy={busy}>
            {busy ? 'Joining…' : 'Create account and join'}
          </button>
        </form>
      </div>
    </BoardPage>
  );
}

/* Your details, and waiting for the company */

function YourDetails({ state }: { state: string }) {
  switch (state) {
    case 'google':
      return <Details state="" flow={FLOW} arrival="Google" />;
    case 'apple':
      return <Details state="" flow={{ ...FLOW, name: '' }} arrival="Apple" />;
    case 'invitation':
      return <Details state="" flow={FLOW} offer="invitation" />;
    case 'own':
      return <Details state="" flow={FLOW} />;
    default:
      return <Details state="" flow={FLOW} offer="company" />;
  }
}

function Waiting() {
  return (
    <BoardPage end={<SignedInAs />}>
      <Heading title={`Waiting for ${SAMPLE.organisation} to approve you`}>
        <p className="demo-muted">We’ll email {SAMPLE.email} when somebody there answers.</p>
      </Heading>
      <div className="demo-waiting">
        <p className="demo-text">Waiting for approval · asked {SAMPLE.askedOn}</p>
        <p className="demo-muted">
          Your details are saved. Until somebody at {SAMPLE.organisation} approves you, there is
          nothing of theirs to see.
        </p>
      </div>
      <Link className="button demo-wide" to={way('details', 'own')}>
        Start my own organisation instead
      </Link>
    </BoardPage>
  );
}
