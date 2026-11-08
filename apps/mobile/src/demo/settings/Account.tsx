import { useLocalSearchParams } from 'expo-router';
import { createRef, type RefObject, useEffect, useMemo, useRef, useState } from 'react';
import type { ScrollViewInstance, ViewInstance } from 'react-native';

import { SETTLED_MS } from '../../components/Screen.tsx';
import {
  type ScreenReaderTarget,
  moveScreenReaderFocus,
} from '../../components/screenReaderFocus.ts';
import type { TextHandle } from '../../components/Text.tsx';
import { SAMPLE } from '../samples.ts';
import { AddScreen } from './AccountAdd.tsx';
import { AboutSection, YouCard } from './AccountCard.tsx';
import { ConfirmScreen } from './AccountConfirm.tsx';
import { ContactsSection } from './AccountContacts.tsx';
import {
  type AccountScreen,
  type AccountStart,
  accountStart,
  accountStateOf,
  cardLine,
  type ContactKind,
  firstUnverified,
  KIND_WORDS,
  keepPrimary,
  primaryOf,
  promoteLine,
  RESULTS,
  verifiedWords,
  type Verifying,
  WORDS,
} from './AccountModel.ts';
import { NameScreen } from './AccountName.tsx';
import { type Contact, HOME_ZONE, PHONE_COUNTRY } from './AccountSample.ts';
import { VerifyScreen } from './AccountVerify.tsx';
import { ZoneScreen } from './AccountZone.tsx';
import { useShell } from '../../components/settingsShell.ts';
import { SummaryPage } from './SummaryPage.tsx';
import { Ask, bringIntoView, useRowClear } from '../../components/Summary.tsx';

export { ACCOUNT_STATES } from './AccountModel.ts';

type Target =
  'card' | 'step' | 'name' | 'zone' | 'addEmail' | 'addPhone' | 'send' | 'promote' | 'remove';

/** Settings › Your account in B, summary first, on sample data that stays on the device. */
export function AccountSection() {
  const { state } = useLocalSearchParams<{ state?: string }>();
  const name = accountStateOf(state);

  return <AccountPage key={name} start={accountStart(name)} />;
}

function AccountPage({ start }: { start: AccountStart }) {
  const shell = useShell();
  const clear = useRowClear();
  const [name, setName] = useState<string>(SAMPLE.name);
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
    if (kind === 'email') done(RESULTS.primary(kind, shown));
    else doneAtOnce(RESULTS.primary(kind, shown));
  }

  function remove(kind: ContactKind, row: Contact, atOnce: boolean): void {
    const [rows, setRows] = rowsOf(kind);
    setRows(rows.filter((each) => each.id !== row.id));
    if (atOnce) doneAtOnce(RESULTS.removed(row.shown));
    else done(RESULTS.removed(row.shown));
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

  const verifyRows = verifying == null ? [] : rowsOf(verifying.kind)[0];
  const openedKind: ContactKind = emails.some((row) => row.id === opened) ? 'email' : 'phone';

  return (
    <>
      <SummaryPage title={WORDS.title} scrollRef={scroll}>
        <YouCard
          name={name}
          email={primaryEmail}
          line={cardLine(emails, phones, said)}
          wide={shell.layout === 'portrait'}
          nameRef={targets.card}
          step={
            waiting == null
              ? null
              : {
                  label: WORDS.sendCode,
                  onPress: () => verify(waiting.kind, waiting.row, 'step'),
                  testID: 'account.step',
                  ref: targets.step,
                }
          }
        />
        <AboutSection
          name={name}
          zone={zone}
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
        title={WORDS.promoteTitle}
        line={promoteLine(primaryEmail)}
        keep={{ label: keepPrimary(primaryEmail), testID: 'account.promote.keep' }}
        confirm={{ label: WORDS.makeItPrimary, testID: 'account.promote.confirm' }}
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
        title={KIND_WORDS[openedKind].removeTitle}
        line={WORDS.removeLine}
        keep={{ label: WORDS.keepIt, testID: 'account.remove.keep' }}
        confirm={{ label: WORDS.removeIt, testID: 'account.remove.confirm', removes: true }}
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
        onSaved={(next) => {
          setName(next);
          done(RESULTS.name(next));
        }}
      />
      <ZoneScreen
        key={`zone.${visit}`}
        open={screen === 'zone'}
        held={zone}
        startTyped={first ? start.typedZone : ''}
        opener={opener}
        onClose={() => setScreen(null)}
        onSaved={(next) => {
          setZone(next);
          done(RESULTS.zone(next));
        }}
      />
      {(['email', 'phone'] as const).map((kind) => (
        <AddScreen
          key={`${kind}.${visit}`}
          kind={kind}
          open={screen === (kind === 'email' ? 'addEmail' : 'addPhone')}
          rows={rowsOf(kind)[0]}
          startCountry={first ? start.phoneCountry : PHONE_COUNTRY}
          opener={opener}
          onClose={() => setScreen(null)}
          onAdded={(row) => {
            const [rows, setRows] = rowsOf(kind);
            setRows([...rows, row]);
            done(WORDS.added);
          }}
        />
      ))}
      <ConfirmScreen
        key={`confirm.${visit}`}
        open={screen === 'confirm' && openedRow != null}
        opener={opener}
        onClose={() => setScreen(null)}
        onProved={() => {
          if (openedRow != null) makePrimary('email', openedRow.id);
        }}
      />
      <VerifyScreen
        key={`verify.${verifying?.id ?? ''}.${visit}`}
        open={screen === 'verify' && verifying != null}
        kind={verifying?.kind ?? 'email'}
        shown={verifyRows.find((row) => row.id === verifying?.id)?.shown ?? ''}
        start={first && verifying != null ? verifying.stage : 'entering'}
        opener={opener}
        onClose={() => setScreen(null)}
        onVerified={() => {
          if (verifying == null) return;
          const [rows, setRows] = rowsOf(verifying.kind);
          const row = rows.find((each) => each.id === verifying.id);
          setRows(
            rows.map((each) => (each.id === verifying.id ? { ...each, verified: true } : each)),
          );
          done(verifiedWords(row?.shown ?? '', verifying.kind));
        }}
      />
    </>
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
