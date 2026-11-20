import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type ViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton, QuietButton, SecondaryButton } from '../../components/Buttons.tsx';
import { Glyph } from '../../components/Glyph.tsx';
import { Notice } from '../../components/Notice.tsx';
import { readOut } from '../../components/ReadOut.tsx';
import { Sheet, SheetActions } from '../../components/Sheet.tsx';
import { moveScreenReaderFocus } from '../../components/screenReaderFocus.ts';
import { Skeleton } from '../../components/Skeleton.tsx';
import { PageToast } from '../../components/Summary.tsx';
import { HeadCount, Row, RowList, Section } from '../../components/SummaryRows.tsx';
import { Text } from '../../components/Text.tsx';
import { useLayout } from '../../layout/useLayout.ts';
import { DemoOnly } from '../../steps/Lines.tsx';
import { tokens } from '../../theme/tokens.ts';
import { ISSUE_MS as SEND_MS, WORDS } from './StaffLinkModel.ts';
import { StatusShape } from './StaffLinkScreen.tsx';
import {
  LIVE_CHANGE,
  LIVE_MS,
  type OnRoster,
  RW,
  type RosterState,
  type Shown,
  keep,
  resetKept,
  rosterOrder,
  rowLine,
  sampleRoster,
  shownOf,
  withKept,
} from './StaffRosterModel.ts';
import {
  BALANCE,
  TW,
  checkOf,
  creditsNow,
  sendAll,
  setCredits,
  textRoster,
} from './StaffTextModel.ts';

const RETRY_MS = 1200;

const SHOWN_WORDS: Record<Shown, string> = { ...WORDS, noMobile: RW.noMobile, erased: RW.erased };

type Phase = 'loading' | 'failed' | 'ready';

/** The event's Staff in the app (sc-77903): the roster to read, in sc-3906's order, each person opening their own link. */
export function StaffRoster({ state }: { state: RosterState }) {
  const texts = textRoster(state);
  const sms = texts != null;
  const [phase, setPhase] = useState<Phase>(
    state === 'loading' ? 'loading' : state === 'failed' ? 'failed' : 'ready',
  );
  const [answer, setAnswer] = useState(0);
  const [people, setPeople] = useState<OnRoster[]>(() => {
    resetKept();
    setCredits(texts?.credits ?? BALANCE);
    return state === 'empty' ? [] : rosterOrder(texts?.people ?? sampleRoster());
  });
  const [credits, setLeft] = useState(texts?.credits ?? BALANCE);
  const [checking, setChecking] = useState(texts?.checking ?? false);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<string | null>(texts?.toast ?? null);
  const bulkRef = useRef<ViewInstance | null>(null);
  const { kind } = useLayout();
  const insets = useSafeAreaInsets();
  const phone = kind === 'phone';
  const rows = useRef<Partial<Record<string, ViewInstance | null>>>({});
  const head = useRef<ViewInstance | null>(null);
  const opened = useRef<string | null>(null);
  const erased = state === 'erased';
  const manage = state !== 'readOnly' && state !== 'smsReadOnly';
  const [base, setBase] = useState<OnRoster[]>(() => texts?.people ?? sampleRoster());

  const reread = useCallback(() => {
    if (state === 'empty') return;
    setPeople(rosterOrder(withKept(base)));
    setLeft(creditsNow());
  }, [state, base]);

  useFocusEffect(
    useCallback(() => {
      reread();
      const id = opened.current;
      if (id == null) return undefined;
      opened.current = null;
      const timer = setTimeout(() => moveScreenReaderFocus(rows.current[id] ?? head.current), 350);
      return () => clearTimeout(timer);
    }, [reread]),
  );

  const webChange = useCallback(() => {
    keep(LIVE_CHANGE.id, LIVE_CHANGE.status, LIVE_CHANGE.trail);
    reread();
  }, [reread]);

  useEffect(() => {
    if (state !== 'live' || phase !== 'ready') return undefined;
    const timer = setTimeout(webChange, LIVE_MS);
    return () => clearTimeout(timer);
  }, [state, phase, webChange]);

  useEffect(() => {
    if (phase !== 'loading' || state === 'loading') return undefined;
    const timer = setTimeout(() => setPhase('ready'), RETRY_MS);
    return () => clearTimeout(timer);
  }, [phase, state]);

  function open(person: OnRoster): void {
    opened.current = person.id;
    const view = erased ? '&view=erased' : manage ? '' : '&view=read';
    const withSms = sms ? `&sms=${credits}` : '';
    router.push(`/demo/staff-link?person=${person.id}${view}${withSms}`);
  }

  const check = checkOf(people, credits);
  const bulkShown = sms && manage && !erased && phase === 'ready' && check.n > 0;
  const allSent =
    sms && manage && !erased && phase === 'ready' && people.length > 0 && check.n === 0;

  function send(): void {
    setSending(true);
    setTimeout(() => {
      const sent = sendAll(people, credits);
      const next = rosterOrder(sent.people);
      for (const person of next) keep(person.id, person.status, person.trail, person.held);
      setBase(next);
      setPeople(next);
      setLeft(sent.credits);
      setCredits(sent.credits);
      setSending(false);
      setChecking(false);
      setToast(sent.line);
      readOut(sent.line);
    }, SEND_MS);
  }

  const bulk = bulkShown ? (
    <SecondaryButton
      ref={bulkRef}
      label={TW.bulk(check.n)}
      onPress={() => setChecking(true)}
      testID="staff.bulk"
    />
  ) : null;

  let body;
  if (phase === 'loading')
    body = <Skeleton shape="rows" rowHeight={64} rows={6} words={RW.loading} />;
  else if (phase === 'failed')
    body = (
      <View style={styles.failed} testID="staff.failed">
        <Notice tone="broken" mark="alert" body={RW.failed} answer={answer} />
        <SecondaryButton
          label={RW.tryAgain}
          onPress={() => {
            setAnswer((n) => n + 1);
            setPhase('loading');
          }}
          testID="staff.retry"
        />
      </View>
    );
  else if (people.length === 0)
    body = (
      <View style={styles.empty} testID="staff.empty">
        <Text size={17} weight="semibold" accessibilityRole="header">
          {RW.empty}
        </Text>
        <Text size={15} weight="medium" style={styles.secondary}>
          {RW.emptyLine}
        </Text>
      </View>
    );
  else
    body = (
      <>
        {!manage && (
          <View style={styles.lock} testID="staff.readOnly">
            <Glyph name="lock" size={16} ink={tokens.colorInkSecondary} />
            <Text size={15} weight="medium" style={[styles.secondary, styles.shrink]}>
              {RW.lock}
            </Text>
          </View>
        )}
        <RowList
          items={people.map((person) => {
            const shown = shownOf(person, erased);
            const note =
              !sms || erased || !person.mobile
                ? null
                : person.held === true
                  ? TW.held
                  : person.stopped === true
                    ? TW.stopped
                    : null;
            const word = note == null ? SHOWN_WORDS[shown] : `${SHOWN_WORDS[shown]} · ${note}`;
            const line = rowLine(person);

            return {
              key: person.id,
              row: (
                <Row
                  ref={(view) => {
                    rows.current[person.id] = view;
                  }}
                  title={person.name}
                  line={line}
                  below={
                    <View style={styles.status}>
                      <StatusShape shape={shown} side={14} />
                      <Text
                        size={14}
                        weight="semibold"
                        accessible={false}
                        style={[styles.shrink, shown === 'noMobile' && styles.attention]}
                      >
                        {word}
                      </Text>
                    </View>
                  }
                  opens
                  onPress={() => open(person)}
                  accessibilityLabel={`${person.name}. ${line}. ${word}`}
                  testID={`staff.row.${person.id}`}
                />
              ),
            };
          })}
        />
      </>
    );

  return (
    <View style={styles.page} testID={`staff.${state}`}>
      <View ref={head} accessible={false} style={styles.head}>
        <Section
          title={RW.roster}
          right={
            phase === 'ready' && people.length > 0 ? (
              <HeadCount text={RW.people(people.length)} />
            ) : undefined
          }
        >
          {bulk != null && (
            <View style={phone ? undefined : styles.bulkBeside} testID="staff.bulkHead">
              {bulk}
            </View>
          )}
          {allSent && (
            <Text size={15} weight="medium" style={styles.secondary} testID="staff.allSent">
              {TW.allSent}
            </Text>
          )}
          {body}
        </Section>
      </View>
      <DemoOnly title="Demo only: the board’s switches">
        <SecondaryButton
          label="A change on the web: Amina Yusuf’s link sent"
          onPress={webChange}
          testID="staff.demo.web"
        />
        <SecondaryButton
          label="The roster fails to load"
          onPress={() => setPhase('failed')}
          testID="staff.demo.fails"
        />
        {sms && (
          <SecondaryButton
            label={credits === 0 ? 'No credits · on' : 'No credits'}
            onPress={() => {
              const next = credits === 0 ? BALANCE : 0;
              setLeft(next);
              setCredits(next);
            }}
            testID="staff.demo.noCredits"
          />
        )}
        <SecondaryButton
          label="Start again"
          onPress={() => {
            resetKept();
            const again = textRoster(state);
            setPhase(state === 'loading' ? 'loading' : state === 'failed' ? 'failed' : 'ready');
            setBase(again?.people ?? sampleRoster());
            setPeople(state === 'empty' ? [] : rosterOrder(again?.people ?? sampleRoster()));
            setLeft(again?.credits ?? BALANCE);
            setCredits(again?.credits ?? BALANCE);
            setChecking(again?.checking ?? false);
            setToast(again?.toast ?? null);
          }}
          testID="staff.demo.reset"
        />
      </DemoOnly>
      <Sheet
        open={checking}
        onClose={() => setChecking(false)}
        scrimLabel={TW.notNow}
        held={sending}
        opener={bulkRef}
        docked
        testID="staff.check"
      >
        <CheckBody
          check={check}
          phone={phone}
          sending={sending}
          onSend={send}
          onNotNow={() => setChecking(false)}
        />
      </Sheet>
      {toast != null && (
        <PageToast
          words={toast}
          onClose={() => setToast(null)}
          bottom={insets.bottom + tokens.spaceXl}
        />
      )}
    </View>
  );
}

/** sc-3931's check in Messaging B's way: who goes, who is left out, the credits it uses and the balance after. */
function CheckBody({
  check,
  phone,
  sending,
  onSend,
  onNotNow,
}: {
  check: ReturnType<typeof checkOf>;
  phone: boolean;
  sending: boolean;
  onSend: () => void;
  onNotNow: () => void;
}) {
  const go = (
    <PrimaryButton label={TW.send} busy={sending} onPress={onSend} testID="staff.check.send" />
  );
  const notNow = (
    <QuietButton label={TW.notNow} onPress={onNotNow} off={sending} testID="staff.check.notNow" />
  );

  return (
    <View style={styles.check}>
      <Text size={tokens.typeTitleSection.size} weight="bold" accessibilityRole="header">
        {TW.checkTitle(check.n)}
      </Text>
      <Text size={tokens.typeBodyPhone.size}>{TW.checkLine}</Text>
      {(check.m > 0 || check.k > 0) && (
        <View style={styles.skips}>
          {check.m > 0 && (
            <Text size={15} style={styles.secondary}>
              {TW.noMobile(check.m)}
            </Text>
          )}
          {check.k > 0 && (
            <Text size={15} style={styles.secondary}>
              {TW.stoppedSkip(check.k)}
            </Text>
          )}
        </View>
      )}
      <View style={styles.credits} testID="staff.check.credits">
        <Text size={15} weight="semibold">
          {TW.uses(check.uses)}
        </Text>
        <Text size={15} style={styles.secondary}>
          {TW.after(check.after)}
        </Text>
        {check.wait > 0 && (
          <Text size={15} weight="semibold" style={styles.attention}>
            {TW.wait(check.wait)}
          </Text>
        )}
      </View>
      <SheetActions>
        {phone ? (
          <>
            {go}
            {notNow}
          </>
        ) : (
          <>
            {notNow}
            {go}
          </>
        )}
      </SheetActions>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: tokens.spaceXl },
  head: { gap: tokens.spaceMd },
  bulkBeside: { alignSelf: 'flex-start' },
  check: { flexShrink: 1, gap: tokens.spaceLg, padding: tokens.space3xl },
  skips: { gap: tokens.spaceXs },
  credits: {
    gap: tokens.spaceXs,
    padding: tokens.spaceLg,
    borderRadius: tokens.radiusCardPhone,
    backgroundColor: tokens.colorInset,
  },
  secondary: { color: tokens.colorInkSecondary },
  attention: { color: tokens.colorAttentionText },
  shrink: { flexShrink: 1 },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceSm,
    paddingTop: tokens.spaceXs,
  },
  lock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spaceSm,
    paddingBottom: tokens.spaceSm,
  },
  failed: { gap: tokens.spaceMd, alignItems: 'flex-start' },
  empty: {
    gap: tokens.spaceXxs,
    paddingVertical: 18,
    paddingHorizontal: tokens.spaceXxl,
    borderRadius: tokens.radiusCardLarge,
    backgroundColor: tokens.colorInset,
  },
});
