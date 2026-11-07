import { setStringAsync } from 'expo-clipboard';
import { type RefObject, useEffect, useState } from 'react';

import { useReadOut } from '../../components/ReadOut.tsx';
import type { ScreenReaderTarget } from '../../components/screenReaderFocus.ts';
import {
  CLAIM_RECORD,
  type ClaimState,
  DEADLINES,
  DOMAIN,
  KEEPS_WORKING,
  type MembersSay,
  ORGANISATION,
} from './MembersSample.ts';
import { FocusedScreen, Line, Row, RowList, Section, TextAction } from './Summary.tsx';

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
}

/** Julien's claim to own Ire Events while its only owner is suspended: open it, prove the domain, or withdraw. */
export function useOwnerClaim(start: ClaimState | null, withdrawing: boolean): OwnerClaim {
  const [claim, setClaim] = useState(start);
  const [screen, setScreen] = useState(withdrawing);
  const [asking, setAsking] = useState(withdrawing);
  const [check, setCheck] = useState<Check>('resting');

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
      setScreen(false);
      setCheck('resting');
      setClaim('withdrawn');
    },
    moveOn: () => {
      if (claim === 'withdrawn') setClaim('unclaimed');
    },
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
  const [copied, setCopied] = useState<(typeof CLAIM_RECORD)[number] | null>(null);
  const checking = owner.check === 'checking';

  function copy(row: (typeof CLAIM_RECORD)[number]): void {
    setStringAsync(row.value).then(
      () => setCopied(row),
      () => setCopied(null),
    );
  }

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
      ask={
        owner.asking
          ? {
              title: 'Withdraw your claim?',
              line: `You won't become the owner of ${ORGANISATION}. Any admin, you included, can start a new claim.`,
              keep: { label: 'Keep my claim', testID: 'ownerClaim.withdrawNo' },
              confirm: { label: 'Withdraw', testID: 'ownerClaim.withdrawYes', removes: true },
              onKeep: () => owner.ask(false),
              onConfirm: owner.withdraw,
              testID: 'ownerClaim.withdrawConfirm',
            }
          : null
      }
      toast={copied == null ? null : { words: copied.copied, onClose: () => setCopied(null) }}
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
        <RowList
          items={CLAIM_RECORD.map((row) => ({
            key: row.label,
            row: (
              <Row
                title={row.value}
                line={row.label}
                selectable
                trail={
                  <TextAction
                    label={copied?.label === row.label ? 'Copied' : 'Copy'}
                    glyph={copied?.label === row.label ? 'tick' : 'copy'}
                    onPress={() => copy(row)}
                    accessibilityLabel={
                      copied?.label === row.label ? `${row.label}, copied` : `Copy ${row.label}`
                    }
                    testID={`ownerClaim.copy.${row.label.toLowerCase()}`}
                  />
                }
              />
            ),
          }))}
        />
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
