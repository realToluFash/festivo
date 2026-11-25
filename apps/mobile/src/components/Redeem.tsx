import type { Account, OpenedDoorCode, RedeemedDoorCode } from '@soirely/api-client';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, type TextInputInstance, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api, meAtLaunch } from '../api.ts';
import { dateLocale } from '../i18n/index.ts';
import { eventHref } from '../kit/eventNav.ts';
import {
  type CodeLine,
  codeProblem,
  eventLine,
  joinRefusal,
  nameProblem,
  normalCode,
  type Opening,
  openedTo,
  refusedTo,
  type TooMany,
  tryAgainWords,
} from '../kit/redeem.ts';
import { meshFor } from '../kit/today.ts';
import { reloadSignedIn, signOutThen } from '../signedIn.ts';
import { InsideField } from '../steps/InsideField.tsx';
import { Heading, Says } from '../steps/Lines.tsx';
import { NavBar, StepScreen } from '../steps/StepScreen.tsx';
import { tokens } from '../theme/tokens.ts';
import { PrimaryButton, QuietButton } from './Buttons.tsx';
import { EventThumb } from './EventThumb.tsx';
import { focusChecked } from './Field.tsx';
import { useReadOut } from './ReadOut.tsx';
import { TextAction } from './SummaryRows.tsx';
import { Text } from './Text.tsx';

type Step =
  | { kind: 'enter'; typed: string; line: CodeLine | null; busy: boolean }
  | TooMany
  | { kind: 'event'; code: string; opened: OpenedDoorCode }
  | { kind: 'member'; organisation: string; eventId: string }
  | { kind: 'in'; redeemed: RedeemedDoorCode; event: OpenedDoorCode['event'] };

interface Opened {
  account: Account | null;
  to: Opening;
}

async function signedInAs(): Promise<Account | null> {
  const me = await meAtLaunch();

  return 'account' in me ? me.account : null;
}

/** Who this device is signed in as, then where the code leads for them. */
async function opening(typed: string): Promise<Opened> {
  const normal = normalCode(typed);
  const account = await signedInAs();
  const to = await api.openDoorCode(normal).then(
    (answer) => openedTo(normal, answer),
    (error: unknown) => refusedTo(error),
  );

  return { account, to };
}

function close(): void {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

/** Joining with a door code (sc-72), as the app demo's redeem draws it: the code, the event and a name, then You're in. */
export function Redeem({ code }: { code: string }) {
  const [step, setStep] = useState<Step>({
    kind: 'enter',
    typed: code,
    line: null,
    busy: code !== '',
  });
  const [visit, setVisit] = useState(0);
  const [account, setAccount] = useState<Account | null>(null);

  function go(next: Step): void {
    setStep(next);
    setVisit((now) => now + 1);
  }

  function opened(typed: string, { account: who, to }: Opened): void {
    setAccount(who);
    if (to.kind === 'enter') go({ kind: 'enter', typed, line: to.line, busy: false });
    else go(to);
  }

  // A code in the link, as the QR carries it, is opened at once, as whoever this device is signed in as.
  useEffect(() => {
    let live = true;
    if (code === '')
      void signedInAs().then((who) => {
        if (live) setAccount(who);
      });
    else
      void opening(code).then((answer) => {
        if (live) opened(code, answer);
      });

    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- opened once, for the code the link carried
  }, [code]);

  const key = `${step.kind}-${visit}`;

  switch (step.kind) {
    case 'enter':
      return (
        <EnterStep
          key={key}
          step={step}
          onContinue={(typed) => {
            setStep({ ...step, typed, line: null, busy: true });
            void opening(typed).then((answer) => opened(typed, answer));
          }}
        />
      );
    case 'tooMany':
      return <TooManyStep step={step} />;
    case 'event':
      return (
        <EventStep
          key={key}
          step={step}
          account={account}
          onJoined={(redeemed) => go({ kind: 'in', redeemed, event: step.opened.event })}
          onMember={() =>
            go({
              kind: 'member',
              organisation: step.opened.event.organisation,
              eventId: step.opened.event.id,
            })
          }
          onTooMany={go}
          onSignedOut={() => {
            setAccount(null);
            go({ ...step });
          }}
        />
      );
    case 'member':
      return <MemberStep step={step} />;
    case 'in':
      return (
        <InStep
          step={step}
          onSignedOut={() => {
            setAccount(null);
            go({ kind: 'enter', typed: '', line: null, busy: false });
          }}
        />
      );
  }
}

function EventTile({ id }: { id: string }) {
  return (
    <View style={styles.tile}>
      <EventThumb event={{ id, mesh: meshFor(id), photo: null }} side={56} radius={16} />
    </View>
  );
}

/** sc-72's one refusal: an alert, said at once; focus stays where it was. */
function Refused({ words }: { words: string }) {
  useReadOut(words, { interrupts: true });

  return (
    <Text size={tokens.typeBody.size} style={styles.refused}>
      {words}
    </Text>
  );
}

function EnterStep({
  step,
  onContinue,
}: {
  step: Extract<Step, { kind: 'enter' }>;
  onContinue: (typed: string) => void;
}) {
  const { t } = useTranslation();
  const field = useRef<TextInputInstance>(null);
  const typed = useRef(step.typed);
  const [line, setLine] = useState(step.line);
  const said = line == null ? null : t(`redeem.line.${line}`);

  function send(): void {
    if (step.busy) return;
    const problem = codeProblem(typed.current);
    setLine(problem);
    if (problem != null) {
      focusChecked(field);
      return;
    }
    onContinue(typed.current);
  }

  return (
    <StepScreen
      nav={<NavBar onLeft={close} testID="redeem.nav" />}
      foot={
        <PrimaryButton
          label={t('redeem.continue')}
          busy={step.busy}
          onPress={send}
          testID="redeem.enter.continue"
        />
      }
    >
      <Heading title={t('redeem.enterTitle')} />
      <View style={styles.fields}>
        <InsideField
          ref={field}
          label={t('redeem.doorCode')}
          defaultValue={step.typed}
          onChangeText={(text) => {
            typed.current = text;
            if (line != null) setLine(null);
          }}
          state={said == null ? 'plain' : 'blank'}
          line={said}
          submitting={step.busy}
          autoCapitalize="characters"
          autoCorrect={false}
          autoComplete="off"
          spellCheck={false}
          returnKeyType="go"
          submitBehavior="submit"
          onSubmitEditing={send}
          autoFocus={step.typed === ''}
          testID="redeem.enter.code"
        />
        {said != null &&
          (line === 'refused' || line === 'failed' ? (
            <Refused words={said} />
          ) : (
            <Says words={said} />
          ))}
      </View>
    </StepScreen>
  );
}

function TooManyStep({ step }: { step: TooMany }) {
  const { t } = useTranslation();

  return (
    <StepScreen nav={<NavBar onLeft={close} testID="redeem.nav" />}>
      <Heading
        title={t('redeem.tooMany')}
        intro={tryAgainWords(t, step, dateLocale())}
        answer={step}
      />
    </StepScreen>
  );
}

/** The event before anything is asked; signed out, a name and nothing else (sc-72, until sc-4235); signed in, Join as the account. */
function EventStep({
  step,
  account,
  onJoined,
  onMember,
  onTooMany,
  onSignedOut,
}: {
  step: Extract<Step, { kind: 'event' }>;
  account: Account | null;
  onJoined: (redeemed: RedeemedDoorCode) => void;
  onMember: () => void;
  onTooMany: (tooMany: TooMany) => void;
  onSignedOut: () => void;
}) {
  const { t } = useTranslation();
  const field = useRef<TextInputInstance>(null);
  const name = useRef('');
  const [nameSaid, setNameSaid] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [joining, setJoining] = useState(false);
  const [trouble, setTrouble] = useState<{ words: string; n: number } | null>(null);
  const signedIn = account != null;
  const { event } = step.opened;

  async function join(): Promise<void> {
    if (joining) return;
    if (!signedIn) {
      setChecked(true);
      if (nameProblem(name.current)) {
        setNameSaid(t('redeem.nameBlank'));
        focusChecked(field);
        return;
      }
    }
    setJoining(true);
    try {
      const redeemed = await api.redeemDoorCode(step.code, signedIn ? null : name.current.trim());
      await reloadSignedIn().catch(() => undefined);
      onJoined(redeemed);
    } catch (error) {
      const refusal = joinRefusal(error);
      if (refusal.kind === 'member') onMember();
      else if (refusal.kind === 'tooMany') onTooMany(refusal);
      else {
        setJoining(false);
        setTrouble((was) => ({
          words: t(refusal.trouble === 'refused' ? 'redeem.refused' : 'redeem.line.failed'),
          n: (was?.n ?? 0) + 1,
        }));
      }
    }
  }

  return (
    <StepScreen
      nav={<NavBar left="close" onLeft={close} testID="redeem.nav" />}
      foot={
        signedIn ? (
          <>
            <PrimaryButton
              label={t('redeem.joinAs', { name: account.name })}
              busy={joining}
              onPress={() => void join()}
              testID="redeem.joinAs"
            />
            <QuietButton
              label={t('redeem.signOut')}
              off={joining}
              onPress={() => signOutThen(onSignedOut)}
              testID="redeem.joinAs.signOut"
            />
          </>
        ) : (
          <PrimaryButton
            label={joining ? t('redeem.joining') : t('redeem.join')}
            busy={joining}
            onPress={() => void join()}
            testID="redeem.name.join"
          />
        )
      }
    >
      <EventTile id={event.id} />
      <Heading title={event.name} intro={eventLine(t, step.opened, dateLocale())} answer={step} />
      <View style={styles.fields}>
        {trouble != null && <Refused key={trouble.n} words={trouble.words} />}
        {!signedIn && (
          <View>
            <InsideField
              ref={field}
              label={t('redeem.yourName')}
              onChangeText={(text) => {
                name.current = text;
                if (nameSaid != null) setNameSaid(null);
              }}
              onBlur={() => {
                if (checked && nameProblem(name.current)) setNameSaid(t('redeem.nameBlank'));
              }}
              state={nameSaid == null ? 'plain' : 'blank'}
              line={nameSaid}
              submitting={joining}
              autoCapitalize="words"
              autoComplete="name"
              textContentType="name"
              returnKeyType="go"
              submitBehavior="submit"
              onSubmitEditing={() => void join()}
              autoFocus
              testID="redeem.name.field"
            />
            {nameSaid != null && <Says words={nameSaid} />}
          </View>
        )}
      </View>
    </StepScreen>
  );
}

function MemberStep({ step }: { step: Extract<Step, { kind: 'member' }> }) {
  const { t } = useTranslation();

  return (
    <StepScreen
      nav={<NavBar left="close" onLeft={close} testID="redeem.nav" />}
      foot={
        <PrimaryButton
          label={t('redeem.openEvents')}
          onPress={() => router.replace('/events')}
          testID="redeem.member.events"
        />
      }
    >
      <EventTile id={step.eventId} />
      <Heading
        title={t('redeem.memberTitle', { organisation: step.organisation })}
        intro={t('redeem.memberLine')}
        answer={step}
      />
    </StepScreen>
  );
}

function InStep({
  step,
  onSignedOut,
}: {
  step: Extract<Step, { kind: 'in' }>;
  onSignedOut: () => void;
}) {
  const { t } = useTranslation();
  const { redeemed, event } = step;

  return (
    <StepScreen
      nav={<NavBar left={null} onLeft={() => undefined} testID="redeem.nav" />}
      foot={
        <View style={styles.inFoot}>
          <PrimaryButton
            label={t('redeem.openEvent')}
            onPress={() => router.replace(eventHref(redeemed.eventId))}
            testID="redeem.in.open"
          />
          <View style={styles.you}>
            <Text size={15} weight="semibold">
              {t('redeem.signedInAs', { name: redeemed.name })}
            </Text>
            <TextAction
              label={t('redeem.signOut')}
              plain
              glyph="signOut"
              onPress={() => signOutThen(onSignedOut)}
              testID="redeem.in.signOut"
            />
          </View>
        </View>
      }
    >
      <EventTile id={event.id} />
      <Heading
        title={
          redeemed.jobLabel == null
            ? t('redeem.inTitleNoJob', { event: event.name })
            : t('redeem.inTitle', { event: event.name, job: redeemed.jobLabel })
        }
        intro={t('redeem.endsLine')}
        answer={step}
      />
    </StepScreen>
  );
}

const styles = StyleSheet.create({
  tile: { marginTop: tokens.spaceLg },
  fields: { marginTop: tokens.space3xl, gap: tokens.spaceLg },
  refused: { color: tokens.colorBrokenText },
  inFoot: { gap: tokens.spaceXl },
  you: { gap: tokens.spaceXs },
});
