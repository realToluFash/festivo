import { setStringAsync } from 'expo-clipboard';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, type ViewInstance } from 'react-native';

import { Notice } from '../../components/Notice.tsx';
import { readOut } from '../../components/ReadOut.tsx';
import { Sheet } from '../../components/Sheet.tsx';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { Glyph } from '../Glyph.tsx';
import { CLAIM_RECORD, DEADLINES, DOMAIN, type MembersSay, ORGANISATION } from './MembersSample.ts';
import { Card, CardHead, Pair, Pill, TYPE } from './parts.tsx';
import type { SettingsLayout } from './sample.ts';

export type Claim = 'open' | 'withdrawn';

const KEEPS_WORKING =
  'Events, guests and your permissions keep working. Only Owner actions, such as billing, wait for an owner.';
const CHECK_MS = 900;

/** Julien's claim to own Ire Events while its only owner is suspended: prove the domain, or withdraw. */
export function OwnerClaim({
  claim,
  withdrawing,
  layout,
  say,
  onClaim,
}: {
  claim: Claim;
  withdrawing: boolean;
  layout: SettingsLayout;
  say: MembersSay;
  onClaim: (claim: Claim) => void;
}) {
  const phone = layout === 'phone';
  const height = tokens.sizeHitPhoneHero;

  if (claim === 'withdrawn')
    return (
      <>
        <Notice
          tone="done"
          mark={tokens.marks.done.glyph}
          body="You withdrew your claim. Everybody who was told is emailed."
          announce
        />
        <Card>
          <Notice tone="attention" mark="!" title={`${ORGANISATION} has no active owner`} heading />
          <Words text="To become the owner, you publish a DNS record on your company domain to prove you control it." />
          <Pill
            label="Become the owner"
            full={phone}
            height={height}
            onPress={() => onClaim('open')}
            testID="ownerClaim.become"
          />
          <Notice tone="quiet" mark={tokens.marks.info.glyph} body={KEEPS_WORKING} />
        </Card>
      </>
    );

  return <OpenClaim withdrawing={withdrawing} layout={layout} say={say} onClaim={onClaim} />;
}

function OpenClaim({
  withdrawing,
  layout,
  say,
  onClaim,
}: {
  withdrawing: boolean;
  layout: SettingsLayout;
  say: MembersSay;
  onClaim: (claim: Claim) => void;
}) {
  const phone = layout === 'phone';
  const height = tokens.sizeHitPhoneHero;
  const [check, setCheck] = useState<'resting' | 'checking' | 'notFound'>('resting');
  const [asking, setAsking] = useState(withdrawing);
  const opener = useRef<ViewInstance>(null);

  useEffect(() => {
    if (check !== 'checking') return;
    const timer = setTimeout(() => setCheck('notFound'), CHECK_MS);

    return () => clearTimeout(timer);
  }, [check]);

  return (
    <Card>
      <CardHead
        title={`Prove you control ${DOMAIN}`}
        line={`Add this TXT record to the DNS for ${DOMAIN}. The value is new for this claim.`}
      />
      <RecordPanel />
      {check === 'notFound' && (
        <Notice
          tone="attention"
          mark="!"
          body={`We couldn't find the record yet. DNS changes can take up to 48 hours.`}
          announce
        />
      )}
      <Words text={`We check every hour until ${say.deadline(DEADLINES.claim)}.`} quiet />
      <Pill
        label={check === 'checking' ? 'Checking the record' : 'Check record'}
        full={phone}
        height={height}
        onPress={() => {
          if (check !== 'checking') setCheck('checking');
        }}
        testID="ownerClaim.check"
      />
      <Pill
        ref={opener}
        label="Withdraw my claim"
        kind="secondary"
        height={height}
        full={phone}
        onPress={() => setAsking(true)}
        testID="ownerClaim.withdraw"
      />
      <Notice tone="quiet" mark={tokens.marks.info.glyph} body={KEEPS_WORKING} />
      <Sheet
        open={asking}
        onClose={() => setAsking(false)}
        opener={opener}
        testID="ownerClaim.withdrawConfirm"
      >
        <View style={styles.sheet}>
          <Text size={22} weight="bold" accessibilityRole="header">
            Withdraw your claim?
          </Text>
          <Words
            text={`You won't become the owner of ${ORGANISATION}. Any Administrator, you included, can start a new claim.`}
          />
          <Pair
            layout={layout}
            dismiss={
              <Pill
                label="Keep my claim"
                kind="quiet"
                full={phone}
                height={height}
                onPress={() => setAsking(false)}
                testID="ownerClaim.withdrawNo"
              />
            }
            confirm={
              <Pill
                label="Withdraw"
                kind="danger"
                full={phone}
                height={height}
                onPress={() => {
                  setAsking(false);
                  onClaim('withdrawn');
                }}
                testID="ownerClaim.withdrawYes"
              />
            }
          />
        </View>
      </Sheet>
    </Card>
  );
}

function RecordPanel() {
  const [copied, setCopied] = useState<string | null>(null);

  function copy(row: (typeof CLAIM_RECORD)[number]): void {
    setStringAsync(row.value).then(
      () => {
        setCopied(row.label);
        readOut(row.copied);
      },
      () => setCopied(null),
    );
  }

  return (
    <View style={styles.record}>
      {CLAIM_RECORD.map((row, index) => (
        <View key={row.label} style={[styles.recordRow, index > 0 && styles.divided]}>
          <View style={styles.recordWords}>
            <Text size={TYPE.small} weight="medium" style={styles.secondary}>
              {row.label}
            </Text>
            <Text size={TYPE.row} weight="semibold" selectable style={styles.value}>
              {row.value}
            </Text>
          </View>
          <Pressable
            onPress={() => copy(row)}
            style={({ pressed }) => [styles.copy, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={copied === row.label ? `${row.label}, copied` : `Copy ${row.label}`}
            testID={`ownerClaim.copy.${row.label.toLowerCase()}`}
          >
            <Glyph
              name={copied === row.label ? 'tick' : 'copy'}
              size={16}
              ink={tokens.colorAccentText}
              weight={2.2}
            />
            <Text size={TYPE.line} weight="semibold" accessible={false} style={styles.accent}>
              {copied === row.label ? 'Copied' : 'Copy'}
            </Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

function Words({ text, quiet = false }: { text: string; quiet?: boolean }) {
  return (
    <Text size={TYPE.body} weight="medium" style={quiet ? styles.secondary : undefined}>
      {text}
    </Text>
  );
}

const styles = StyleSheet.create({
  secondary: { color: tokens.colorInkSecondary },
  accent: { color: tokens.colorAccentText },
  pressed: { opacity: 0.8 },
  record: {
    borderRadius: 18,
    backgroundColor: tokens.colorCard,
    paddingHorizontal: tokens.spaceXl,
    paddingVertical: tokens.spaceXxs,
  },
  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceLg,
    paddingVertical: tokens.spaceLg,
  },
  divided: { borderTopWidth: 1, borderTopColor: tokens.colorBorder },
  recordWords: { flex: 1, minWidth: 0, gap: 2 },
  value: { flexShrink: 1, fontVariant: ['tabular-nums'] },
  copy: {
    minHeight: tokens.sizeHit,
    minWidth: tokens.sizeHit,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceXs,
    paddingHorizontal: tokens.spaceMd,
    borderRadius: tokens.sizeHit / 2,
  },
  sheet: { gap: tokens.spaceLg, padding: tokens.space3xl },
});
