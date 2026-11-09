import { firstUnverified, primaryOf, zoneLabel } from '@soirely/domain';
import { useLocalSearchParams } from 'expo-router';
import { createRef, type RefObject, useEffect, useMemo, useRef, useState } from 'react';
import type { ScrollViewInstance, ViewInstance } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AddScreen } from '../../components/AccountAdd.tsx';
import { AboutSection, YouCard } from '../../components/AccountCard.tsx';
import { ConfirmScreen } from '../../components/AccountConfirm.tsx';
import { ContactsSection } from '../../components/AccountContacts.tsx';
import { NameScreen } from '../../components/AccountName.tsx';
import { VerifyScreen } from '../../components/AccountVerify.tsx';
import { ZoneScreen } from '../../components/AccountZone.tsx';
import { SETTLED_MS } from '../../components/Screen.tsx';
import {
  type ScreenReaderTarget,
  moveScreenReaderFocus,
} from '../../components/screenReaderFocus.ts';
import { useShell } from '../../components/settingsShell.ts';
import { Ask, bringIntoView, useRowClear } from '../../components/Summary.tsx';
import type { TextHandle } from '../../components/Text.tsx';
import {
  cardLine,
  type Contact,
  type ContactKind,
  KIND_KEYS,
  promotedWords,
  verifiedWords,
  verifyWords,
  zoneLine,
} from '../../kit/accountPage.ts';
import { SAMPLE } from '../samples.ts';
import {
  type AccountScreen,
  type AccountStart,
  accountProof,
  accountStart,
  accountStateOf,
  addRefusal,
  type Channel,
  CHANNEL_LINE,
  COUNTDOWN_SECONDS,
  sampleContinue,
  type Verifying,
  WRONG_CODE,
} from './AccountModel.ts';
import { useCountdown } from './AccountParts.tsx';
import { HOME_ZONE, PHONE_COUNTRY, phoneShown, sentCodeProblem, ZONES } from './AccountSample.ts';
import { saveName, savedName } from './savedName.ts';
import { SummaryPage } from './SummaryPage.tsx';

export { ACCOUNT_STATES } from './AccountModel.ts';

type Target =
  'card' | 'step' | 'name' | 'zone' | 'addEmail' | 'addPhone' | 'send' | 'promote' | 'remove';

/** Settings › Your account in B, summary first, on sample data that stays on the device. */
export function AccountSection() {
  const { t } = useTranslation();
  const { state } = useLocalSearchParams<{ state?: string }>();
  const name = accountStateOf(state);

  return <AccountPage key={name} start={accountStart(name, t)} />;
}

function AccountPage({ start }: { start: AccountStart }) {
  const { t } = useTranslation();
  const shell = useShell();
  const clear = useRowClear();
  const yours = shell.viewer !== 'member';
  const [name, setName] = useState<string>(() => (yours ? savedName() : null) ?? SAMPLE.name);
  const [zone, setZone] = useState(HOME_ZONE);
  const [emails, setEmails] = useState(start.emails);
  const [phones, setPhones] = useState(start.phones);
  const [said, setSaid] = useState(start.said);
  const [opened, setOpened] = useState(start.opened);
  const [ask, setAsk] = useState(start.ask);
  const [screen, setScreen] = useState<AccountScreen | null>(start.screen);
  const [verifying, setVerifying] = useState<Verifying | null>(start.verifying);
  const [visit, setVisit] = useState(0);
  const scroll = useRef<ScrollViewInstance>(null);
  const blocks = useRef<Partial<Record<string, ViewInstance | null>>>({});
  const [targets] = useState(() => ({
    card: createRef<TextHandle>(),
    step: createRef<ViewInstance>(),
    name: createRef<ViewInstance>(),
    zone: createRef<ViewInstance>(),
    addEmail: createRef<ViewInstance>(),
    addPhone: createRef<ViewInstance>(),
    send: createRef<ViewInstance>(),
    promote: createRef<ViewInstance>(),
    remove: createRef<ViewInstance>(),
  }));
  const from = useRef<Target>(startTarget(start));
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const opener = useMemo<RefObject<ScreenReaderTarget | null>>(
    () => ({
      get current() {
        return targets[from.current].current ?? targets.card.current;
      },
    }),
    [targets],
  );
  const first = visit === 0;
  const waiting = firstUnverified(emails, phones);
  const primaryEmail = primaryOf(emails)?.shown ?? SAMPLE.email;
  const openedRow = [...emails, ...phones].find((row) => row.id === opened) ?? null;

  useEffect(() => {
    if (said != null) scroll.current?.scrollTo({ y: 0, animated: true });
  }, [said]);

  useEffect(() => () => clearTimeout(timer.current), []);

  useEffect(() => {
    if (start.opened == null) return;
    const frame = requestAnimationFrame(() =>
      bringIntoView(blocks.current[start.opened ?? ''], scroll.current, clear, false),
    );

    return () => cancelAnimationFrame(frame);
  }, [start.opened, clear]);

  function show(next: AccountScreen, target: Target): void {
    from.current = target;
    setVisit((count) => count + 1);
    setScreen(next);
  }

  function done(words: string): void {
    from.current = 'card';
    setSaid(words);
    setOpened(null);
    setAsk(null);
    setScreen(null);
  }

  function doneAtOnce(words: string): void {
    done(words);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => moveScreenReaderFocus(targets.card.current), SETTLED_MS);
  }

  function asking(question: 'promote' | 'remove', row: Contact): void {
    setAsk(question);
    bringIntoView(blocks.current[row.id], scroll.current, clear, true);
  }

  function rowsOf(kind: ContactKind): [Contact[], (rows: Contact[]) => void] {
    return kind === 'email' ? [emails, setEmails] : [phones, setPhones];
  }

  function verify(kind: ContactKind, row: Contact, target: Target): void {
    setVerifying({ kind, id: row.id, stage: 'entering' });
    show('verify', target);
  }

  function makePrimary(kind: ContactKind, id: string): void {
    const [rows, setRows] = rowsOf(kind);
    setRows(rows.map((row) => ({ ...row, primary: row.id === id })));
    const shown = rows.find((row) => row.id === id)?.shown ?? '';
    if (kind === 'email') done(promotedWords(kind, shown, t));
    else doneAtOnce(promotedWords(kind, shown, t));
  }

  function remove(kind: ContactKind, row: Contact, atOnce: boolean): void {
    const [rows, setRows] = rowsOf(kind);
    setRows(rows.filter((each) => each.id !== row.id));
    const words = t('contacts.removed', { address: row.shown });
    if (atOnce) doneAtOnce(words);
    else done(words);
  }

  const contacts = (kind: ContactKind) => {
    const [rows] = rowsOf(kind);
    const adding = kind === 'email' ? 'addEmail' : 'addPhone';

    return (
      <ContactsSection
        kind={kind}
        rows={rows}
        opened={opened}
        addRef={targets[adding]}
        sendRef={targets.send}
        promoteRef={targets.promote}
        removeRef={targets.remove}
        onAdd={() => show(adding, adding)}
        onBlock={(id, block) => {
          blocks.current[id] = block;
        }}
        onToggle={(id) => setOpened((now) => (now === id ? null : id))}
        onVerify={(row) => verify(kind, row, 'send')}
        onMakePrimary={(row) => {
          from.current = 'promote';
          if (kind === 'email') asking('promote', row);
          else makePrimary(kind, row.id);
        }}
        onRemove={(row) => {
          from.current = 'remove';
          if (row.verified) asking('remove', row);
          else remove(kind, row, true);
        }}
      />
    );
  };

  const openedKind: ContactKind = emails.some((row) => row.id === opened) ? 'email' : 'phone';
  const proof = accountProof(t);

  return (
    <>
      <SummaryPage title={t('account.title')} scrollRef={scroll}>
        <YouCard
          name={name}
          email={primaryEmail}
          line={cardLine(emails, phones, said, t)}
          wide={shell.layout === 'portrait'}
          nameRef={targets.card}
          step={
            waiting == null
              ? null
              : {
                  label: t('contacts.sendCode'),
                  onPress: () => verify(waiting.kind, waiting.row, 'step'),
                  testID: 'account.step',
                  ref: targets.step,
                }
          }
        />
        <AboutSection
          name={name}
          zone={{ title: zoneLabel(zone), line: zoneLine(zone.id, t) }}
          nameRef={targets.name}
          zoneRef={targets.zone}
          onName={() => show('name', 'name')}
          onZone={() => show('zone', 'zone')}
        />
        {contacts('email')}
        {contacts('phone')}
      </SummaryPage>
      <Ask
        open={ask === 'promote' && openedRow != null}
        opener={opener}
        title={t('contacts.promoteTitle')}
        line={t('contacts.promoteBody', { old: primaryEmail })}
        keep={{
          label: t('contacts.promoteKeep', { old: primaryEmail }),
          testID: 'account.promote.keep',
        }}
        confirm={{ label: t('contacts.promoteConfirm'), testID: 'account.promote.confirm' }}
        onKeep={() => setAsk(null)}
        onConfirm={() => {
          setAsk(null);
          show('confirm', 'promote');
        }}
        testID="account.promote"
      />
      <Ask
        open={ask === 'remove' && openedRow != null}
        opener={opener}
        title={t(KIND_KEYS[openedKind].removeTitle)}
        line={t('contacts.removeBody')}
        keep={{ label: t('contacts.removeKeep'), testID: 'account.remove.keep' }}
        confirm={{
          label: t('contacts.removeConfirm'),
          testID: 'account.remove.confirm',
          removes: true,
        }}
        onKeep={() => setAsk(null)}
        onConfirm={() => {
          if (openedRow != null) remove(openedKind, openedRow, false);
        }}
        testID="account.remove"
      />
      <NameScreen
        key={`name.${visit}`}
        open={screen === 'name'}
        held={name}
        opener={opener}
        onClose={() => setScreen(null)}
        onSave={(next) => {
          setName(next);
          if (yours) saveName(next);
          done(t('nameCard.saved', { name: next }));

          return Promise.resolve(null);
        }}
      />
      <ZoneScreen
        key={`zone.${visit}`}
        open={screen === 'zone'}
        zones={ZONES}
        now={zoneLabel(zone)}
        startTyped={first ? start.typedZone : ''}
        opener={opener}
        onClose={() => setScreen(null)}
        onSave={(next) => {
          setZone(next);
          done(t('timeZone.saved', { zone: zoneLabel(next) }));

          return Promise.resolve(null);
        }}
      />
      {(['email', 'phone'] as const).map((kind) => (
        <AddScreen
          key={`${kind}.${visit}`}
          kind={kind}
          open={screen === (kind === 'email' ? 'addEmail' : 'addPhone')}
          startCountry={first ? start.phoneCountry : PHONE_COUNTRY}
          opener={opener}
          onClose={() => setScreen(null)}
          onAdd={({ typed, country }) => {
            const [rows, setRows] = rowsOf(kind);
            const shown = kind === 'email' ? typed : phoneShown(country, typed);
            const refused = addRefusal(kind, shown, rows, t);
            if (refused == null) {
              setRows([
                ...rows,
                { id: `${kind}-${shown}`, shown, verified: false, primary: false },
              ]);
              done(t('contacts.added'));
            }

            return Promise.resolve(refused);
          }}
        />
      ))}
      <ConfirmScreen
        key={`confirm.${visit}`}
        open={screen === 'confirm' && openedRow != null}
        asks={proof}
        opener={opener}
        onClose={() => setScreen(null)}
        onContinue={(password, code) =>
          sampleContinue(proof, () => {
            if (openedRow != null) makePrimary('email', openedRow.id);
          })(password, code)
        }
      />
      {verifying != null && (
        <SampleVerify
          key={`verify.${verifying.id}.${visit}`}
          open={screen === 'verify'}
          verifying={verifying}
          row={rowsOf(verifying.kind)[0].find((row) => row.id === verifying.id) ?? null}
          start={first ? verifying.stage : 'entering'}
          opener={opener}
          onClose={() => setScreen(null)}
          onVerified={(row) => {
            const [rows, setRows] = rowsOf(verifying.kind);
            setRows(rows.map((each) => (each.id === row.id ? { ...each, verified: true } : each)));
            done(verifiedWords(row, verifying.kind, t));
          }}
        />
      )}
    </>
  );
}

/** The sample's code: only the demo's own passes, and a new one waits the demo's countdown. */
function SampleVerify({
  open,
  verifying,
  row,
  start,
  opener,
  onClose,
  onVerified,
}: {
  open: boolean;
  verifying: Verifying;
  row: Contact | null;
  start: Verifying['stage'];
  opener: RefObject<ScreenReaderTarget | null>;
  onClose: () => void;
  onVerified: (row: Contact) => void;
}) {
  const { t } = useTranslation();
  const [channel, setChannel] = useState<Channel>(
    verifying.kind === 'email' ? 'email' : 'whatsApp',
  );
  const [expired, setExpired] = useState(start === 'expired');
  const countdown = useCountdown(COUNTDOWN_SECONDS, start !== 'expired');
  const words = verifyWords(CHANNEL_LINE[channel], row?.shown ?? '', t);

  return (
    <VerifyScreen
      open={open && row != null}
      title={words.title}
      lead={words.lead}
      codeLabel={words.codeLabel}
      spent={expired ? words.expired : null}
      wait={countdown.left}
      prefill={start === 'wrong' ? WRONG_CODE : ''}
      startError={start === 'wrong' ? words.wrong : null}
      autoFocus={start === 'entering'}
      opener={opener}
      onClose={onClose}
      onVerify={(typed) => {
        const problem = sentCodeProblem(typed);
        if (problem == null) {
          if (row != null) onVerified(row);
          return Promise.resolve(null);
        }
        const error =
          problem === 'blank' ? words.blank : problem === 'short' ? words.short : words.wrong;

        return Promise.resolve({ error, checked: problem !== 'wrong' });
      }}
      onResend={() => {
        setExpired(false);
        countdown.restart();

        return Promise.resolve(true);
      }}
      onTextInstead={
        channel === 'whatsApp'
          ? () => {
              setChannel('text');
              return Promise.resolve();
            }
          : null
      }
    />
  );
}

function startTarget(start: AccountStart): Target {
  if (start.ask != null) return start.ask;
  switch (start.screen) {
    case 'name':
    case 'zone':
    case 'addEmail':
    case 'addPhone':
      return start.screen;
    case 'confirm':
      return 'promote';
    case 'verify':
      return 'step';
    case null:
      return 'card';
  }
}
