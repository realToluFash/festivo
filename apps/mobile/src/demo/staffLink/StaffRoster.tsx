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
import { HeadCount, Row, RowList, SectionHead } from '../../components/SummaryRows.tsx';
import { Text } from '../../components/Text.tsx';
import { useLayout } from '../../layout/useLayout.ts';
import { DemoOnly } from '../../steps/Lines.tsx';
import { tokens } from '../../theme/tokens.ts';
import { useBriefing } from '../briefing/StaffBriefing.tsx';
import { type BriefingState, briefingStart } from '../briefing/briefingModel.ts';
import { useShiftNotices } from '../shiftNotices/ShiftNotices.tsx';
import { type ShiftState, briefingFor, shiftStart } from '../shiftNotices/shiftNoticesModel.ts';
import { ISSUE_MS as SEND_MS, SHOWN_WORDS, shownOf } from './StaffLinkModel.ts';
import { StatusShape } from './StaffLinkScreen.tsx';
import {
  LIVE_CHANGE,
  LIVE_MS,
  type OnRoster,
  RW,
  type RosterState,
  keep,
  resetKept,
  rosterOrder,
  rowLine,
  sampleRoster,
  withKept,
} from './StaffRosterModel.ts';
import {
  BALANCE,
  type Check,
  QUIET_ENDS,
  SENT_MS,
  TW,
  bulkCheck,
  creditsNow,
  sentOn,
  setCredits,
  textAll,
  textRoster,
} from './StaffTextModel.ts';

const RETRY_MS = 1200;

type Phase = 'loading' | 'failed' | 'ready';

/** The event's Staff in the app (sc-77903): the roster to read, in sc-3906's order, each person opening their own link, with sc-3917's briefing on it on a tablet, or sc-4333's reminder card and shift notices with it on every layout. */
export function StaffRoster({
  state,
  briefing = null,
  shift = null,
}: {
  state: RosterState;
  briefing?: BriefingState | null;
  shift?: ShiftState | null;
}) {
  const texts = textRoster(state);
  const startOf = () =>
    shift != null
      ? briefingFor(shiftStart(shift))
      : briefing == null
        ? null
        : briefingStart(briefing);
  const [opening] = useState(startOf);
  const first = (): OnRoster[] => opening?.people ?? texts?.people ?? sampleRoster();
  const sms = texts != null;
  const [phase, setPhase] = useState<Phase>(
    state === 'loading' ? 'loading' : state === 'failed' ? 'failed' : 'ready',
  );
  const [answer, setAnswer] = useState(0);
  const [people, setPeople] = useState<OnRoster[]>(() => {
    resetKept();
    setCredits(texts?.credits ?? BALANCE);
    return state === 'empty' ? [] : rosterOrder(first());
  });
  const [credits, setLeft] = useState(texts?.credits ?? BALANCE);
  const [checking, setChecking] = useState(texts?.checking ?? false);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<string[] | null>(texts?.toast ?? null);
  const [quiet, setQuiet] = useState(texts?.quiet ?? false);
  const [asked, setAsked] = useState(false);
  const billing = texts?.billing ?? true;
  const bulkRef = useRef<ViewInstance | null>(null);
  const { kind } = useLayout();
  const insets = useSafeAreaInsets();
  const phone = kind === 'phone';
  const rows = useRef<Partial<Record<string, ViewInstance | null>>>({});
  const head = useRef<ViewInstance | null>(null);
  const opened = useRef<string | null>(null);
  const erased = state === 'erased';
  const manage = state !== 'readOnly' && state !== 'smsReadOnly';
  const [base, setBase] = useState<OnRoster[]>(first);
  const counted = phase === 'ready' && people.length > 0;

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

  const brief = useBriefing(
    shift ?? briefing,
    opening,
    people,
    (next) => hold(next),
    () => startOf() ?? briefingStart('populated'),
  );
  const notices = useShiftNotices(shift, brief);
  const check = bulkCheck(people, credits);
  const bulkShown =
    sms && manage && !erased && opening?.finished !== true && phase === 'ready' && check.n > 0;
  const allSent =
    sms && manage && !erased && phase === 'ready' && people.length > 0 && check.n === 0;

  function hold(next: OnRoster[]): void {
    for (const p of next)
      keep(p.id, p.status, p.trail, {
        pending: p.pending ?? null,
        notDelivered: p.notDelivered ?? null,
      });
    setBase(next);
    setPeople(next);
  }

  function send(): void {
    setSending(true);
    setTimeout(() => {
      const pressed = textAll(people, credits, quiet);
      const next = rosterOrder(pressed.people);
      hold(next);
      setLeft(pressed.credits);
      setCredits(pressed.credits);
      setSending(false);
      setChecking(false);
      setToast(pressed.lines);
      readOut(pressed.lines.join(' '));
      setTimeout(() => hold(rosterOrder(next.map(sentOn))), SENT_MS);
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
              !sms || erased || person.mobile == null
                ? null
                : person.pending === 'sending'
                  ? TW.sending
                  : person.pending === 'held'
                    ? TW.held
                    : person.pending === 'waits'
                      ? TW.waits(QUIET_ENDS)
                      : person.notDelivered != null
                        ? TW.notDelivered(person.notDelivered)
                        : person.stopped === true
                          ? TW.stopped
                          : null;
            const word = note == null ? SHOWN_WORDS[shown] : `${SHOWN_WORDS[shown]} · ${note}`;
            const line = rowLine(person);
            const briefed = brief?.row(person) ?? null;

            return {
              key: person.id,
              row: (
                <View>
                  <Row
                    ref={(view) => {
                      rows.current[person.id] = view;
                    }}
                    title={person.name}
                    line={line}
                    below={
                      <View style={styles.stack}>
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
                        {briefed?.below}
                      </View>
                    }
                    opens
                    onPress={() => open(person)}
                    accessibilityLabel={
                      briefed == null
                        ? `${person.name}. ${line}. ${word}`
                        : `${person.name}. ${line}. Link: ${word}. Briefing: ${briefed.words}`
                    }
                    testID={`staff.row.${person.id}`}
                  />
                  {briefed?.after}
                </View>
              ),
            };
          })}
        />
      </>
    );

  return (
    <View style={styles.page} testID={`staff.${state}`}>
      {brief?.card}
      {notices?.card}
      <View style={styles.entries} testID="staff.entries">
        <SecondaryButton
          label={RW.hours}
          link
          onPress={() => router.push('/demo/staff-hours')}
          testID="staff.hours"
        />
        <SecondaryButton
          label={RW.whosHere}
          link
          onPress={() => router.push('/demo/whos-here')}
          testID="staff.whosHere"
        />
      </View>
      <View style={styles.head}>
        <View
          ref={head}
          accessible
          accessibilityRole="header"
          accessibilityLabel={counted ? `${RW.roster}, ${RW.people(people.length)}` : RW.roster}
          testID="staff.heading"
        >
          <SectionHead
            title={RW.roster}
            right={counted ? <HeadCount text={RW.people(people.length)} /> : undefined}
          />
        </View>
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
        {phase === 'ready' && notices?.foot}
      </View>
      <DemoOnly title="Demo only: the board’s switches">
        {brief?.demo}
        {notices?.demo}
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
            label={quiet ? 'At 22:40 the night before · on' : 'At 22:40 the night before'}
            onPress={() => setQuiet(!quiet)}
            testID="staff.demo.quiet"
          />
        )}
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
            const people = startOf()?.people ?? again?.people ?? sampleRoster();
            setBase(people);
            setPeople(state === 'empty' ? [] : rosterOrder(people));
            brief?.restart();
            notices?.restart();
            setLeft(again?.credits ?? BALANCE);
            setCredits(again?.credits ?? BALANCE);
            setChecking(again?.checking ?? false);
            setToast(again?.toast ?? null);
            setQuiet(again?.quiet ?? false);
          }}
          testID="staff.demo.reset"
        />
      </DemoOnly>
      <Sheet
        open={checking}
        onClose={() => setChecking(false)}
        scrimLabel={TW.cancel}
        held={sending}
        opener={bulkRef}
        docked
        testID="staff.check"
      >
        <CheckBody
          check={check}
          phone={phone}
          sending={sending}
          quiet={quiet}
          billing={billing}
          onSend={send}
          onCancel={() => setChecking(false)}
          onAsk={() => setAsked(true)}
        />
      </Sheet>
      {brief?.panels}
      {(toast != null || asked) && (
        <PageToast
          words={asked ? `${TW.askOwner} has its own design (sc-3963).` : (toast ?? []).join(' ')}
          onClose={() => {
            setToast(null);
            setAsked(false);
          }}
          bottom={insets.bottom + tokens.spaceXl}
        />
      )}
    </View>
  );
}

/** sc-3931's check in Messaging B's way, with sc-3963's credit lines; the confirm keeps the opener's label. */
function CheckBody({
  check,
  phone,
  sending,
  quiet,
  billing,
  onSend,
  onCancel,
  onAsk,
}: {
  check: Check;
  phone: boolean;
  sending: boolean;
  quiet: boolean;
  billing: boolean;
  onSend: () => void;
  onCancel: () => void;
  onAsk: () => void;
}) {
  const go = (
    <PrimaryButton
      label={TW.bulk(check.n)}
      busy={sending}
      onPress={onSend}
      paired={!phone}
      testID="staff.check.send"
    />
  );
  const cancel = (
    <QuietButton
      label={TW.cancel}
      onPress={onCancel}
      off={sending}
      inset={!phone}
      testID="staff.check.cancel"
    />
  );

  return (
    <View style={styles.check}>
      <Text size={tokens.typeTitleSection.size} weight="bold" accessibilityRole="header">
        {TW.checkMany(check.n)}
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
              {TW.stoppedCount(check.k)}
            </Text>
          )}
        </View>
      )}
      <View style={styles.credits} testID="staff.check.credits">
        {check.uses > 0 && (
          <Text size={15} weight="semibold">
            {TW.textsUse(check.uses)}
          </Text>
        )}
        {check.wait === 0 && (
          <Text size={15} style={styles.secondary}>
            {TW.after(check.after)}
          </Text>
        )}
        {check.wait > 0 && (
          <View style={styles.status}>
            <Glyph name="clock" size={16} ink={tokens.colorAttentionText} />
            <Text size={15} weight="semibold" style={[styles.attention, styles.shrink]}>
              {TW.smsWaits(check.wait)}
            </Text>
          </View>
        )}
        {check.wait > 0 &&
          (billing ? (
            <Text size={15} style={styles.secondary}>
              {TW.notInApp}
            </Text>
          ) : (
            <QuietButton label={TW.askOwner} onPress={onAsk} testID="staff.check.ask" />
          ))}
        {quiet && (
          <Text size={15} style={styles.secondary}>
            {TW.quiet(check.n, QUIET_ENDS)}
          </Text>
        )}
      </View>
      <SheetActions>
        {phone ? (
          <>
            {go}
            {cancel}
          </>
        ) : (
          <>
            {cancel}
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
  entries: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spaceSm },
  bulkBeside: { alignSelf: 'flex-start' },
  stack: { gap: tokens.spaceXs },
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
