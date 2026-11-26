import {
  type Account,
  ApiError,
  type OpenedDoorCode,
  type RedeemedDoorCode,
} from '@soirely/api-client';
import { listFormat, phoneLengthProblem } from '@soirely/domain';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, type TextInputInstance, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api, meAtLaunch } from '../api.ts';
import { currentLocale, dateLocale } from '../i18n/index.ts';
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
import { providerNames } from '../kit/signInRules.ts';
import { meshFor } from '../kit/today.ts';
import { nextAfterSignIn } from '../challenge.ts';
import { phoneProblemMessage } from '../phoneProblem.ts';
import { reloadSignedIn, signOutThen } from '../signedIn.ts';
import { InsideField } from '../steps/InsideField.tsx';
import { Heading, Says } from '../steps/Lines.tsx';
import { NavBar, StepScreen } from '../steps/StepScreen.tsx';
import { tokens } from '../theme/tokens.ts';
import { PrimaryButton, QuietButton } from './Buttons.tsx';
import { EventThumb } from './EventThumb.tsx';
import { focusChecked } from './Field.tsx';
import { deviceNow } from './CreateWalkWindow.tsx';
import { ProviderButtons } from './ProviderSignIn.tsx';
import { useReadOut } from './ReadOut.tsx';
import { type CodeLeave, NumberFields, PhoneCodeScreen, shownNumber } from './RedeemPhone.tsx';
import { TextAction } from './SummaryRows.tsx';
import { Text } from './Text.tsx';

type Step =
  | { kind: 'enter'; typed: string; line: CodeLine | null; busy: boolean }
  | TooMany
  | { kind: 'event'; code: string; opened: OpenedDoorCode; alternative?: boolean }
  | { kind: 'member'; organisation: string; eventId: string }
  | {
      kind: 'providerOnly';
      code: string;
      opened: OpenedDoorCode;
      organisation: string;
      providers: string[];
    }
  | {
      kind: 'code';
      code: string;
      opened: OpenedDoorCode;
      handle: string;
      number: string;
    }
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

  async function left(at: Extract<Step, { kind: 'code' }>, leave: CodeLeave): Promise<void> {
    const back = { kind: 'event' as const, code: at.code, opened: at.opened };
    if (leave.kind === 'alternative') {
      go({ ...back, alternative: true });
      return;
    }
    if (leave.kind === 'providerOnly') {
      go({
        kind: 'providerOnly',
        code: at.code,
        opened: at.opened,
        organisation: leave.organisation,
        providers: leave.providers,
      });
      return;
    }
    if (leave.kind === 'refused') {
      const refusal = joinRefusal(leave.error);
      go(refusal.kind === 'tooMany' ? refusal : back);
      return;
    }
    const { outcome, redeemed } = leave.signedIn;
    if ('challenge' in outcome) {
      // Two-factor is asked before the grant: its code screen, then the door code again as the account.
      router.push(await nextAfterSignIn(outcome));
      return;
    }
    await reloadSignedIn().catch(() => undefined);
    setAccount(outcome.account);
    if (redeemed != null) go({ kind: 'in', redeemed, event: at.opened.event });
  }

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
          onSent={(handle, number) =>
            go({ kind: 'code', code: step.code, opened: step.opened, handle, number })
          }
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
    case 'providerOnly':
      return (
        <ProviderOnlyStep
          key={key}
          step={step}
          onClose={() => go({ kind: 'enter', typed: '', line: null, busy: false })}
          onSignedIn={async (who) => {
            await reloadSignedIn().catch(() => undefined);
            setAccount(who);
            go({ kind: 'event', code: step.code, opened: step.opened });
          }}
        />
      );
    case 'code':
      return (
        <StepScreen
          nav={
            <NavBar
              onLeft={() => go({ kind: 'event', code: step.code, opened: step.opened })}
              testID="redeem.code.nav"
            />
          }
        >
          <PhoneCodeScreen
            code={step.code}
            handle={step.handle}
            number={step.number}
            onLeave={(leave) => void left(step, leave)}
          />
        </StepScreen>
      );
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
  onSent,
  onMember,
  onTooMany,
  onSignedOut,
}: {
  step: Extract<Step, { kind: 'event' }>;
  account: Account | null;
  onJoined: (redeemed: RedeemedDoorCode) => void;
  onSent: (handle: string, number: string) => void;
  onMember: () => void;
  onTooMany: (tooMany: TooMany) => void;
  onSignedOut: () => void;
}) {
  const { t } = useTranslation();
  const field = useRef<TextInputInstance>(null);
  const name = useRef('');
  const number = useRef('');
  const numberField = useRef<TextInputInstance>(null);
  const [country, setCountry] = useState(() => deviceNow().country ?? '');
  const [nameSaid, setNameSaid] = useState<string | null>(null);
  const [numberSaid, setNumberSaid] = useState<string | null>(
    step.alternative === true ? t('redeem.phone.alternative') : null,
  );
  const [checked, setChecked] = useState(false);
  const [joining, setJoining] = useState(false);
  const [trouble, setTrouble] = useState<{ words: string; n: number } | null>(null);
  const signedIn = account != null;
  const { event } = step.opened;

  function refused(error: unknown): void {
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

  async function join(): Promise<void> {
    if (joining) return;
    setJoining(true);
    try {
      const redeemed = await api.redeemDoorCode(step.code);
      await reloadSignedIn().catch(() => undefined);
      onJoined(redeemed);
    } catch (error) {
      refused(error);
    }
  }

  /** Signed out, Send code: the code goes to the number typed, whether or not it has an account (sc-4235). */
  async function send(): Promise<void> {
    if (joining) return;
    setChecked(true);
    const nameWrong = nameProblem(name.current) ? t('redeem.nameBlank') : null;
    const numberWrong = phoneProblemMessage(
      phoneLengthProblem(number.current, country),
      country,
      t,
    );
    setNameSaid(nameWrong);
    setNumberSaid(numberWrong);
    if (nameWrong != null) {
      focusChecked(field);
      return;
    }
    if (numberWrong != null) {
      focusChecked(numberField);
      return;
    }
    setJoining(true);
    try {
      const { handle } = await api.sendDoorCodeSignIn(
        step.code,
        name.current.trim(),
        country,
        number.current,
      );
      onSent(handle, shownNumber(country, number.current));
    } catch (error) {
      const said = error instanceof ApiError && error.status === 422 ? error.fieldErrors() : {};
      if (said.name == null && said.number == null) {
        refused(error);
        return;
      }
      setJoining(false);
      setNameSaid(said.name ?? null);
      setNumberSaid(said.number ?? null);
      focusChecked(said.name == null ? numberField : field);
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
            label={t('redeem.phone.sendCode')}
            busy={joining}
            onPress={() => void send()}
            testID="redeem.event.send"
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
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => numberField.current?.focus()}
              autoFocus={step.alternative !== true}
              testID="redeem.name.field"
            />
            {nameSaid != null && <Says words={nameSaid} />}
          </View>
        )}
        {!signedIn && (
          <NumberFields
            country={country}
            numberRef={numberField}
            said={numberSaid}
            sending={joining}
            onCountry={(code) => {
              setCountry(code);
              if (numberSaid != null) setNumberSaid(null);
            }}
            onNumber={(typed) => {
              number.current = typed;
              if (numberSaid != null) setNumberSaid(null);
            }}
            onSubmit={() => void send()}
          />
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

/** The right phone code refused, as sc-69 refuses a password (sc-94849): each linked provider in the platform's order, and signed in, the door code again as the account. */
function ProviderOnlyStep({
  step,
  onClose,
  onSignedIn,
}: {
  step: Extract<Step, { kind: 'providerOnly' }>;
  onClose: () => void;
  onSignedIn: (account: Account) => Promise<void>;
}) {
  const { t } = useTranslation();

  return (
    <StepScreen
      nav={<NavBar left="close" onLeft={onClose} testID="redeem.nav" />}
      foot={<ProviderButtons only={step.providers} onSignedIn={onSignedIn} />}
    >
      <EventTile id={step.opened.event.id} />
      <Heading
        title={t('signIn.providerOnlyTitle', { organisation: step.organisation })}
        intro={t('signIn.providerOnlyCode', {
          organisation: step.organisation,
          providers: listFormat(currentLocale(), { type: 'disjunction' }).format(
            providerNames(step.providers),
          ),
        })}
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
