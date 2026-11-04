import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { SAMPLE } from '../samples.ts';
import { AccountBand } from './AccountBand.tsx';
import { type Asking, ContactsCard } from './AccountContacts.tsx';
import { NameCard } from './AccountName.tsx';
import { type Contact, EMAILS, HOME_ZONE, PHONES, SECOND_PHONE } from './AccountSample.ts';
import { VerifyTask, type VerifyStart } from './AccountVerify.tsx';
import { TimeZoneCard } from './AccountZone.tsx';
import { SettingsPage, useShell } from './Frame.tsx';

/** Each starting state a board frame drew, as `/demo/settings/account?state=<name>`. */
export const ACCOUNT_STATES = [
  'rest',
  'name',
  'promote',
  'confirm',
  'remove',
  'addEmail',
  'addPhone',
  'zone',
  'verifyEmail',
  'verifyEmailWrong',
  'verifyEmailExpired',
  'verifyEmailDone',
  'verifyPhone',
  'verifyPhoneExpired',
  'verifyPhoneDone',
] as const;

type Start = (typeof ACCOUNT_STATES)[number];

interface Task {
  kind: 'email' | 'phone';
  id: string;
  start: VerifyStart;
}

const SECOND_EMAIL_ID = 'email-2';
const SECOND_PHONE_ID = 'phone-2';

export function AccountSection() {
  const { state } = useLocalSearchParams<{ state?: string }>();
  const start = ACCOUNT_STATES.find((name) => name === state) ?? 'rest';

  return <AccountPage key={start} start={start} />;
}

function startingEmails(start: Start): Contact[] {
  if (start === 'addEmail') return EMAILS.filter((row) => row.primary);
  const proved = ['promote', 'confirm', 'remove', 'verifyEmailDone'].includes(start);

  return EMAILS.map((row) => (row.id === SECOND_EMAIL_ID ? { ...row, verified: proved } : row));
}

function startingPhones(start: Start): Contact[] {
  if (!start.startsWith('verifyPhone')) return [...PHONES];

  return [
    ...PHONES,
    {
      id: SECOND_PHONE_ID,
      shown: SECOND_PHONE,
      verified: start === 'verifyPhoneDone',
      primary: false,
    },
  ];
}

function startingTask(start: Start): Task | null {
  const email = { kind: 'email', id: SECOND_EMAIL_ID } as const;
  const phone = { kind: 'phone', id: SECOND_PHONE_ID } as const;

  switch (start) {
    case 'verifyEmail':
      return { ...email, start: 'entering' };
    case 'verifyEmailWrong':
      return { ...email, start: 'wrong' };
    case 'verifyEmailExpired':
      return { ...email, start: 'expired' };
    case 'verifyEmailDone':
      return { ...email, start: 'done' };
    case 'verifyPhone':
      return { ...phone, start: 'entering' };
    case 'verifyPhoneExpired':
      return { ...phone, start: 'expired' };
    case 'verifyPhoneDone':
      return { ...phone, start: 'done' };
    default:
      return null;
  }
}

function startingAsk(start: Start): Asking {
  if (start === 'promote') return { id: SECOND_EMAIL_ID, what: 'promote' };
  if (start === 'confirm') return { id: SECOND_EMAIL_ID, what: 'prove' };
  if (start === 'remove') return { id: SECOND_EMAIL_ID, what: 'remove' };

  return null;
}

function verifiedIn(rows: Contact[], id: string): Contact[] {
  return rows.map((row) => (row.id === id ? { ...row, verified: true } : row));
}

function AccountPage({ start }: { start: Start }) {
  const { layout } = useShell();
  const [opening, setOpening] = useState<Start>(start);
  const [name, setName] = useState<string>(SAMPLE.name);
  const [emails, setEmails] = useState(() => startingEmails(start));
  const [phones, setPhones] = useState(() => startingPhones(start));
  const [zone, setZone] = useState(HOME_ZONE);
  const [task, setTask] = useState<Task | null>(() => startingTask(start));
  const [arrived, setArrived] = useState<string | null>(() => {
    const opened = startingTask(start);

    return opened?.start === 'done' ? opened.id : null;
  });
  const primaryEmail = emails.find((row) => row.primary)?.shown ?? SAMPLE.email;

  function verify(kind: 'email' | 'phone', row: Contact): void {
    // The start's open step was for the board's frame; coming back from the task finds the page at rest.
    setOpening('rest');
    setArrived(null);
    setTask({ kind, id: row.id, start: 'entering' });
  }

  if (task != null) {
    const rows = task.kind === 'email' ? emails : phones;

    return (
      <VerifyTask
        key={`${task.kind}.${task.id}`}
        kind={task.kind}
        shown={rows.find((row) => row.id === task.id)?.shown ?? ''}
        start={task.start}
        onPassed={() => {
          if (task.kind === 'email') setEmails(verifiedIn(emails, task.id));
          else setPhones(verifiedIn(phones, task.id));
          setArrived(task.id);
        }}
        onBack={() => {
          setOpening('rest');
          setTask(null);
        }}
      />
    );
  }

  return (
    <SettingsPage title="Your account">
      {layout !== 'landscape' && (
        <AccountBand name={name} email={primaryEmail} portrait={layout === 'portrait'} />
      )}
      <NameCard layout={layout} name={name} startEditing={opening === 'name'} onSaved={setName} />
      <ContactsCard
        kind="email"
        layout={layout}
        rows={emails}
        onRows={setEmails}
        arrived={arrived}
        startAsking={startingAsk(opening)}
        startAdding={opening === 'addEmail'}
        onVerify={(row) => verify('email', row)}
      />
      <ContactsCard
        kind="phone"
        layout={layout}
        rows={phones}
        onRows={setPhones}
        arrived={arrived}
        startAsking={null}
        startAdding={opening === 'addPhone'}
        onVerify={(row) => verify('phone', row)}
      />
      <TimeZoneCard
        layout={layout}
        zone={zone}
        onSaved={setZone}
        startTyped={opening === 'zone' ? 'San' : null}
      />
    </SettingsPage>
  );
}
