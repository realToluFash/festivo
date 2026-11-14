import { type RefObject, useEffect, useMemo, useRef, useState } from 'react';
import { View, type ViewInstance } from 'react-native';

import { AlertLine } from '../../components/AlertLine.tsx';

import { useReadOut } from '../../components/ReadOut.tsx';
import type { ScreenReaderTarget } from '../../components/screenReaderFocus.ts';
import {
  CLAIM_RECORD,
  CLAIM_REFUSALS,
  type ClaimRefusal,
  type ClaimState,
  DEADLINES,
  DOMAIN,
  KEEP_PUBLISHED,
  KEEPS_WORKING,
  type MembersSay,
  ORGANISATION,
  STOP_CONSEQUENCE,
} from './MembersSample.ts';
import { RecordRows, useCopied } from '../../components/RecordRows.tsx';
import {
  Ask,
  type AskProps,
  FocusedScreen,
  Line,
  Section,
  TextAction,
} from '../../components/Summary.tsx';

const CHECK_MS = 900;

type Check = 'resting' | 'checking' | 'notFound';

export interface OwnerClaim {
  claim: ClaimState | null;
  screen: boolean;
  asking: boolean;
  check: Check;
  become: () => void;
  checkRecord: () => void;
  close: () => void;
  ask: (asking: boolean) => void;
  withdraw: () => void;
  moveOn: () => void;
  pageAsk: 'withdraw' | 'stop' | null;
  askOnPage: (ask: 'withdraw' | 'stop' | null) => void;
  stop: () => void;
  /** Become the owner, refused: the line under the card, said again at each press. */
  refused: { refusal: ClaimRefusal; at: number } | null;
}

export interface ClaimStart {
  claim: ClaimState | null;
  withdrawing: boolean;
  stopping: boolean;
  refusal: ClaimRefusal | null;
}

/** Julien's claim to own Ire Events while its only owner is suspended: open it, prove the domain, or withdraw; or Ana's, which he may stop. */
export function useOwnerClaim(start: ClaimStart): OwnerClaim {
  const [claim, setClaim] = useState(start.claim);
  const [screen, setScreen] = useState(start.withdrawing);
  const [asking, setAsking] = useState(start.withdrawing);
  const [check, setCheck] = useState<Check>('resting');
  const [pageAsk, setPageAsk] = useState<OwnerClaim['pageAsk']>(start.stopping ? 'stop' : null);
  const [refused, setRefused] = useState<OwnerClaim['refused']>(
    start.refusal == null ? null : { refusal: start.refusal, at: 0 },
  );

  useEffect(() => {
    if (check !== 'checking') return;
    const timer = setTimeout(() => setCheck('notFound'), CHECK_MS);

    return () => clearTimeout(timer);
  }, [check]);

  return {
    claim,
    screen,
    asking,
    check,
    become: () => {
      if (start.refusal != null) {
        setRefused({ refusal: start.refusal, at: Date.now() });

        return;
      }
      setClaim('open');
      setScreen(true);
    },
    checkRecord: () => {
      setScreen(true);
      if (check !== 'checking') setCheck('checking');
    },
    close: () => setScreen(false),
    ask: setAsking,
    withdraw: () => {
      setAsking(false);
      setPageAsk(null);
      setScreen(false);
      setCheck('resting');
      setClaim('withdrawn');
    },
    moveOn: () => {
      if (claim === 'withdrawn') setClaim('unclaimed');
      if (claim === 'stopped') setClaim('closed');
    },
    pageAsk,
    askOnPage: setPageAsk,
    stop: () => {
      setPageAsk(null);
      setClaim('stopped');
    },
    refused,
  };
}

/** Withdraw your claim, from its screen or, once the record is found, from under the card. */
function withdrawAsk(found: boolean, onKeep: () => void, onConfirm: () => void): AskProps {
  const record = found ? ', and the record is no longer needed' : '';

  return {
    title: 'Withdraw your claim?',
    line: `You won't become the owner of ${ORGANISATION}${record}. Any admin, you included, can start a new claim.`,
    keep: { label: 'Keep my claim', testID: 'ownerClaim.withdrawNo' },
    confirm: { label: 'Withdraw', testID: 'ownerClaim.withdrawYes', removes: true },
    onKeep,
    onConfirm,
    testID: 'ownerClaim.withdrawConfirm',
  };
}

/** Become the owner, on its own screen: the record to publish, checking it, and withdrawing the claim. */
export function ClaimScreen({
  owner,
  say,
  opener,
}: {
  owner: OwnerClaim;
  say: MembersSay;
  opener: RefObject<ScreenReaderTarget | null>;
}) {
  const { copied, copy, clear } = useCopied();
  const checking = owner.check === 'checking';

  return (
    <FocusedScreen
      open={owner.screen}
      title="Become the owner"
      verb={{
        label: 'Check record',
        on: !checking,
        onPress: owner.checkRecord,
        testID: 'ownerClaim.check',
      }}
      onCancel={owner.close}
      cancelTestID="ownerClaim.cancel"
      opener={opener}
      ask={owner.asking ? withdrawAsk(false, () => owner.ask(false), owner.withdraw) : null}
      toast={copied == null ? null : { words: copied.copied, onClose: clear }}
    >
      <Line
        quiet={false}
        text="To become the owner, you publish a DNS record on your company domain to prove you control it."
      />
      <Section
        title={`Prove you control ${DOMAIN}`}
        foot={`We check every hour until ${say.deadline(DEADLINES.claim)}.`}
      >
        <Line
          text={`Add this TXT record to the DNS for ${DOMAIN}. The value is new for this claim.`}
        />
        <RecordRows rows={CLAIM_RECORD} copied={copied} onCopy={copy} testID="ownerClaim.copy" />
      </Section>
      {checking && <Said text="Checking the record" />}
      {owner.check === 'notFound' && (
        <Said text="We couldn't find the record yet. DNS changes can take up to 48 hours." />
      )}
      <TextAction
        label="Withdraw my claim"
        onPress={() => owner.ask(true)}
        testID="ownerClaim.withdraw"
      />
      <Line text={KEEPS_WORKING} />
    </FocusedScreen>
  );
}

function Said({ text }: { text: string }) {
  useReadOut(text);

  return <Line quiet={false} text={text} />;
}

/** Under the card: Withdraw a found claim, Stop another admin's, or why Become the owner was refused. */
export function ClaimUnderCard({
  owner,
  claimant,
  cardSays,
}: {
  owner: OwnerClaim;
  claimant: string;
  cardSays: RefObject<ScreenReaderTarget | null>;
}) {
  const action = useRef<ViewInstance>(null);
  const opener = useMemo<RefObject<ScreenReaderTarget | null>>(
    () => ({
      get current() {
        return action.current ?? cardSays.current;
      },
    }),
    [cardSays],
  );
  return (
    <>
      {owner.claim === 'found' && (
        <>
          <Line text={KEEP_PUBLISHED} />
          <TextAction
            ref={action}
            label="Withdraw my claim"
            onPress={() => owner.askOnPage('withdraw')}
            testID="ownerClaim.withdraw"
          />
        </>
      )}
      {(owner.claim === 'theirs' || owner.claim === 'theirsFound') && (
        <TextAction
          ref={action}
          label="Stop this claim"
          removes
          consequence={STOP_CONSEQUENCE}
          onPress={() => owner.askOnPage('stop')}
          testID="ownerClaim.stop"
        />
      )}
      {owner.claim === 'unclaimed' && owner.refused != null && (
        <Refused key={owner.refused.at} text={CLAIM_REFUSALS[owner.refused.refusal]} />
      )}
      <Ask
        open={owner.pageAsk === 'withdraw'}
        opener={opener}
        {...withdrawAsk(true, () => owner.askOnPage(null), owner.withdraw)}
      />
      <Ask
        open={owner.pageAsk === 'stop'}
        opener={opener}
        title={`Stop ${claimant}’s claim?`}
        line={`It ends at once, and everybody who was told about it is emailed. After a stop, only Soirely support can restore an owner of ${ORGANISATION}.`}
        keep={{ label: 'Let it continue', testID: 'ownerClaim.stopNo' }}
        confirm={{ label: 'Stop the claim', testID: 'ownerClaim.stopYes', removes: true }}
        onKeep={() => owner.askOnPage(null)}
        onConfirm={owner.stop}
        testID="ownerClaim.stopConfirm"
      />
    </>
  );
}

function Refused({ text }: { text: string }) {
  useReadOut(text);

  return (
    <View testID="ownerClaim.refused">
      <AlertLine text={text} />
    </View>
  );
}
