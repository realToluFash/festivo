import { formattingLocale } from '@soirely/domain';
import { getLocales } from 'expo-localization';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, type TextInputInstance, View, type ViewInstance } from 'react-native';

import { PrimaryButton, QuietButton } from '../../components/Buttons.tsx';
import { focusChecked } from '../../components/Field.tsx';
import { focusPicker } from '../../components/CountryPicker.tsx';
import { LanguageChoice } from '../../components/LanguageChoice.tsx';
import { useReadOut } from '../../components/ReadOut.tsx';
import { Text } from '../../components/Text.tsx';
import { useLineSize, WelcomeBrand } from '../../components/Welcome.tsx';
import { meshFor } from '../../kit/today.ts';
import { CodeBoxes, type CodeBoxesHandle } from '../../steps/CodeBoxes.tsx';
import { InsideField } from '../../steps/InsideField.tsx';
import { Heading, Says } from '../../steps/Lines.tsx';
import { minutesSeconds, RESEND_SECONDS } from '../../steps/rules.ts';
import { useCountdown } from '../../steps/useCountdown.ts';
import { tokens } from '../../theme/tokens.ts';
import { Choices } from '../Choices.tsx';
import { COUNTRIES } from '../countries.ts';
import { DemoScreen, NavBar } from '../DemoScreen.tsx';
import { EventThumb } from '../../components/EventThumb.tsx';
import { HELD_MS } from '../people/PeopleSample.ts';
import { SAMPLE } from '../samples.ts';
import { SelectRow } from '../SelectRow.tsx';
import { coverLine, WelcomeFrame } from '../Welcome.tsx';
import { CameraStandIn } from './Camera.tsx';
import {
  EVENT,
  eventLine,
  joinCodeProblem,
  nameProblem,
  numberProblem,
  ORGANISATION,
  redeemed,
  TRIES_A_MINUTE,
  TRY_AT,
} from './DoorCodeModel.ts';
import {
  joinAs,
  memberTitle,
  resendIn,
  sentTo,
  tryAgainAt,
  W,
  wrongCode,
  youreIn,
} from './DoorCodeWords.ts';
import { SEND_MS } from './HoldItUp.tsx';
import { InsideEvent, You } from './Inside.tsx';
import {
  afterPhoneCode,
  type Flow,
  flowAt,
  freshFlow,
  phoneTitle,
  redeemStateOf,
  refusalOf,
} from './RedeemModel.ts';

type Go = (next: Partial<Flow>) => void;

const PORTUGAL = COUNTRIES.find((one) => one.code === EVENT.country) ?? null;
const NEXT_STEP_MS = 500;

/** Joining with a door code (sc-72, sc-4235): the welcome or the camera, the code, the event, a phone code, then inside the event. */
export function RedeemRoute() {
  const { state } = useLocalSearchParams<{ state?: string }>();
  const name = redeemStateOf(state);

  return <RedeemFlow key={name} start={flowAt(name)} />;
}

function RedeemFlow({ start }: { start: Flow }) {
  const [flow, setFlow] = useState(start);
  const [visit, setVisit] = useState(0);
  const locale = formattingLocale('en', getLocales()[0]?.languageTag);
  const go = useCallback<Go>((next) => {
    setFlow((now) => ({ ...now, held: false, more: false, ...next }));
    setVisit((now) => now + 1);
  }, []);
  const signOut = () => go(freshFlow());
  const step = `${flow.step}-${visit}`;

  switch (flow.step) {
    case 'welcome':
      return <Welcome onJoinCode={() => go({ step: 'enter', typed: '', said: null })} />;
    case 'camera':
      return <CameraStandIn onChip={() => go({ step: 'event', code: flow.code })} />;
    case 'enter':
      return <EnterStep key={step} flow={flow} go={go} />;
    case 'tooMany':
      return (
        <DemoScreen nav={<NavBar onLeft={() => go({ step: 'welcome' })} />}>
          <Heading title={W.tooMany} intro={tryAgainAt(TRY_AT)} answer={flow.step} />
        </DemoScreen>
      );
    case 'event':
      return <EventStep key={step} flow={flow} go={go} locale={locale} />;
    case 'joinAs':
      return (
        <DemoScreen
          nav={<NavBar left="close" onLeft={() => go({ step: 'welcome' })} />}
          foot={
            <>
              <PrimaryButton
                label={joinAs(flow.who)}
                onPress={() => go({ step: 'in' })}
                testID="redeem.joinAs"
              />
              <QuietButton
                label={W.signOut}
                onPress={() => go({ ...freshFlow('event'), code: flow.code })}
                testID="redeem.joinAs.signOut"
              />
            </>
          }
        >
          <EventTile />
          <Heading title={EVENT.name} intro={eventLine(flow.code, locale)} answer={flow.step} />
        </DemoScreen>
      );
    case 'member':
      return (
        <DemoScreen
          nav={<NavBar left="close" onLeft={() => go({ step: 'welcome' })} />}
          foot={
            <PrimaryButton
              label={W.openEvents}
              onPress={() => router.push('/demo/events')}
              testID="redeem.member.events"
            />
          }
        >
          <EventTile />
          <Heading title={memberTitle(ORGANISATION)} intro={W.memberLine} answer={flow.step} />
        </DemoScreen>
      );
    case 'code':
      return <PhoneCodeStep key={step} flow={flow} go={go} />;
    case 'in':
      return (
        <DemoScreen
          nav={<NavBar left={null} onLeft={() => undefined} />}
          foot={
            <View style={styles.inFoot}>
              <PrimaryButton
                label={W.openEvent}
                onPress={() => go({ step: 'inside' })}
                testID="redeem.in.open"
              />
              <You who={flow.who} onSignOut={signOut} />
            </View>
          }
        >
          <EventTile />
          <Heading
            title={youreIn(EVENT.name, flow.code.job)}
            intro={W.endsLine}
            answer={flow.step}
          />
        </DemoScreen>
      );
    case 'inside':
    case 'peopleIn':
      return (
        <InsideEvent
          at={flow.step === 'inside' ? 'overview' : 'people'}
          code={flow.code}
          role={flow.role}
          who={flow.who}
          locale={locale}
          moreAtStart={flow.more}
          onAt={(at) => go({ step: at === 'overview' ? 'inside' : 'peopleIn' })}
          onSignOut={signOut}
          onAccount={() => router.push('/demo/settings/account?as=noOrg')}
        />
      );
  }
}

function Welcome({ onJoinCode }: { onJoinCode: () => void }) {
  const line = useLineSize();

  return (
    <WelcomeFrame
      cover
      top={<LanguageChoice />}
      brand={
        <>
          <WelcomeBrand />
          <Text
            weight="bold"
            size={line}
            maxFontSizeMultiplier={1.25}
            style={[styles.onCover, coverLine(line)]}
          >
            {'Plan the event.\nRun the day.'}
          </Text>
        </>
      }
      choices={
        <Choices
          onEmail={() => router.push('/demo/sign-in')}
          onApple={() => router.push('/demo/apple')}
          onGoogle={() => router.push('/demo/organisation?via=google')}
          onCreate={() => router.push('/demo/create')}
          onJoinCode={onJoinCode}
        />
      }
    />
  );
}

function EventTile() {
  return (
    <View style={styles.tile}>
      <EventThumb
        event={{ id: EVENT.id, mesh: meshFor(EVENT.id), photo: null }}
        side={56}
        radius={16}
      />
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

function EnterStep({ flow, go }: { flow: Flow; go: Go }) {
  const field = useRef<TextInputInstance>(null);
  const typed = useRef(flow.typed);
  const held = useRef(flow.held);
  const [said, setSaid] = useState(flow.said);
  const [sending, setSending] = useState(flow.held);
  const [tries, setTries] = useState(flow.tries);

  useEffect(() => {
    if (!sending) return;
    const answer = setTimeout(
      () => {
        setSending(false);
        const found = redeemed(typed.current);
        if (found != null) {
          go({
            step: 'event',
            code: found,
            role: found.role,
            typed: typed.current,
            said: null,
            name: '',
            number: '',
          });
          return;
        }
        if (tries + 1 >= TRIES_A_MINUTE) {
          go({ step: 'tooMany' });
          return;
        }
        setTries(tries + 1);
        setSaid(W.refused);
      },
      held.current ? HELD_MS : SEND_MS,
    );
    held.current = false;

    return () => clearTimeout(answer);
  }, [sending, tries, go]);

  function send(): void {
    if (sending) return;
    const problem = joinCodeProblem(typed.current);
    setSaid(problem);
    if (problem != null) {
      focusChecked(field);
      return;
    }
    setSending(true);
  }

  return (
    <DemoScreen
      nav={<NavBar onLeft={() => go({ step: 'welcome' })} />}
      foot={
        <PrimaryButton
          label={W.continue}
          busy={sending}
          onPress={send}
          testID="redeem.enter.continue"
        />
      }
    >
      <Heading title={W.enterCode} />
      <View style={styles.fields}>
        <InsideField
          ref={field}
          label={W.doorCode}
          defaultValue={flow.typed}
          onChangeText={(text) => {
            typed.current = text;
            if (said != null) setSaid(null);
          }}
          state={said == null ? 'plain' : 'blank'}
          line={said}
          submitting={sending}
          autoCapitalize="characters"
          autoCorrect={false}
          autoComplete="off"
          spellCheck={false}
          maxLength={12}
          returnKeyType="go"
          submitBehavior="submit"
          onSubmitEditing={send}
          autoFocus
          testID="redeem.enter.code"
        />
        {said === W.refused ? <Refused words={said} /> : said != null && <Says words={said} />}
      </View>
    </DemoScreen>
  );
}

function EventStep({ flow, go, locale }: { flow: Flow; go: Go; locale: string }) {
  const nameField = useRef<TextInputInstance>(null);
  const numberField = useRef<TextInputInstance>(null);
  const picker = useRef<ViewInstance>(null);
  const name = useRef(flow.name);
  const number = useRef(flow.number);
  const held = useRef(flow.held);
  const [country, setCountry] = useState(PORTUGAL);
  const [nameSaid, setNameSaid] = useState(flow.nameSaid);
  const [numberSaid, setNumberSaid] = useState(flow.numberSaid);
  const [sending, setSending] = useState(flow.held);

  useEffect(() => {
    if (!sending) return;
    const sent = setTimeout(
      () =>
        go({
          step: 'code',
          name: name.current.trim(),
          number: number.current.trim(),
          digits: '',
          phone: 'entering',
          texted: false,
        }),
      held.current ? HELD_MS : SEND_MS,
    );
    held.current = false;

    return () => clearTimeout(sent);
  }, [sending, go]);

  function send(): void {
    if (sending) return;
    const nameWrong = nameProblem(name.current);
    const numberWrong = country == null ? W.numberBlank : numberProblem(number.current);
    setNameSaid(nameWrong);
    setNumberSaid(numberWrong);
    if (nameWrong != null) {
      focusChecked(nameField);
      return;
    }
    if (numberWrong != null) {
      if (country == null) focusPicker(picker);
      else focusChecked(numberField);
      return;
    }
    setSending(true);
  }

  return (
    <DemoScreen
      nav={<NavBar left="close" onLeft={() => go({ step: 'welcome' })} />}
      foot={
        <PrimaryButton
          label={W.sendCode}
          busy={sending}
          onPress={send}
          testID="redeem.event.send"
        />
      }
    >
      <EventTile />
      <Heading title={EVENT.name} intro={eventLine(flow.code, locale)} answer={flow.step} />
      <View style={styles.fields}>
        {flow.usedUp && <Refused words={W.refused} />}
        <View>
          <InsideField
            ref={nameField}
            label={W.yourName}
            defaultValue={flow.name}
            onChangeText={(text) => {
              name.current = text;
              if (nameSaid != null) setNameSaid(null);
            }}
            state={nameSaid == null ? 'plain' : 'blank'}
            line={nameSaid}
            submitting={sending}
            autoCapitalize="words"
            autoComplete="name"
            textContentType="name"
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => numberField.current?.focus()}
            autoFocus={flow.name === '' && !flow.usedUp}
            testID="redeem.event.name"
          />
          {nameSaid != null && <Says words={nameSaid} />}
        </View>
        <View>
          <View style={styles.phoneRow}>
            <SelectRow
              label={W.countryCode}
              country={country}
              onChange={setCountry}
              compact
              pickerRef={picker}
              testID="redeem.event.country"
            />
            <View style={styles.grow}>
              <InsideField
                ref={numberField}
                label={W.mobileNumber}
                defaultValue={flow.number}
                onChangeText={(text) => {
                  number.current = text;
                  if (numberSaid != null) setNumberSaid(null);
                }}
                state={numberSaid == null ? 'plain' : 'blank'}
                line={numberSaid}
                submitting={sending}
                keyboardType="phone-pad"
                autoComplete="tel"
                textContentType="telephoneNumber"
                returnKeyType="go"
                submitBehavior="submit"
                onSubmitEditing={send}
                testID="redeem.event.number"
              />
            </View>
          </View>
          {numberSaid != null && <Says words={numberSaid} />}
        </View>
      </View>
    </DemoScreen>
  );
}

function PhoneCodeStep({ flow, go }: { flow: Flow; go: Go }) {
  const boxes = useRef<CodeBoxesHandle>(null);
  const [texted, setTexted] = useState(flow.texted);
  const [digits, setDigits] = useState(flow.digits);
  const [status, setStatus] = useState(flow.phone);
  const [done, setDone] = useState(false);
  const { left, restart } = useCountdown(RESEND_SECONDS);
  const spent = status === 'expired' || status === 'exhausted';
  const refusal = refusalOf(status, texted);
  const shown = `${PORTUGAL?.dial ?? ''} ${flow.number}`.trim();

  useEffect(() => {
    if (flow.phone === 'wrong') boxes.current?.refuse();
  }, [flow.phone]);

  useEffect(() => {
    if (!done) return;
    const next = setTimeout(() => go(afterPhoneCode(flow)), NEXT_STEP_MS);

    return () => clearTimeout(next);
  }, [done, flow, go]);

  function check(full: string): void {
    if (full === SAMPLE.code) {
      setDone(true);
      return;
    }
    setStatus('wrong');
    boxes.current?.refuse();
  }

  function sendNew(): void {
    setStatus('entering');
    setDigits('');
    restart();
    boxes.current?.focus();
  }

  return (
    <DemoScreen nav={<NavBar onLeft={() => go({ step: 'event', held: false })} />}>
      <Heading title={phoneTitle(texted)} intro={sentTo(shown, texted)} />
      {refusal != null && (
        <View style={styles.refusal}>
          <Refusal title={refusal.title} body={refusal.body} />
        </View>
      )}
      <View style={styles.boxes}>
        <CodeBoxes
          ref={boxes}
          label={W.codeLabel}
          value={digits}
          onChange={(next) => {
            setDigits(next);
            if (next !== '' && (status === 'wrong' || status === 'failed')) setStatus('entering');
          }}
          onFull={check}
          done={done}
          line={status === 'wrong' && digits === '' ? wrongCode(texted) : null}
          testID="redeem.code"
        />
        {status === 'wrong' && digits === '' && <Says words={wrongCode(texted)} />}
      </View>
      {!done && (
        <View style={styles.ways}>
          {!texted && status !== 'exhausted' && (
            <QuietButton
              label={W.textInstead}
              onPress={() => {
                setTexted(true);
                sendNew();
              }}
              testID="redeem.code.text"
            />
          )}
          <QuietButton
            label={left > 0 && !spent ? resendIn(minutesSeconds(left)) : W.sendNew}
            off={left > 0 && !spent}
            onPress={sendNew}
            testID="redeem.code.resend"
          />
        </View>
      )}
    </DemoScreen>
  );
}

/** The app's phone-step refusals, in red above the boxes as the board draws them, read out as they come. */
function Refusal({ title, body }: { title: string; body: string }) {
  useReadOut(`${title}. ${body}`, { interrupts: true });

  return (
    <View style={styles.refusalWords}>
      <Text size={16} weight="semibold" style={styles.refusedTitle}>
        {title}
      </Text>
      <Text size={15} style={styles.secondary}>
        {body}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  onCover: { color: tokens.colorInkOnDark },
  secondary: { color: tokens.colorInkSecondary },
  tile: { marginTop: tokens.spaceLg },
  fields: { marginTop: tokens.space3xl, gap: tokens.spaceLg },
  phoneRow: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceSm },
  refused: { color: tokens.colorBrokenText },
  refusal: { marginTop: tokens.space3xl },
  refusalWords: { gap: tokens.spaceXxs },
  refusedTitle: { color: tokens.colorBrokenText },
  boxes: { marginTop: tokens.space3xl },
  ways: { marginTop: tokens.spaceLg, alignItems: 'flex-start' },
  inFoot: { gap: tokens.spaceXl },
});
