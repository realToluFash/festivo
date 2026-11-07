import { StyleSheet, View } from 'react-native';

import { PrimaryButton, SecondaryButton } from '../../components/Buttons.tsx';
import { useShell } from '../../components/settingsShell.ts';
import { Line, RowList, Section, ShapeMark } from '../../components/Summary.tsx';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import type { Shown } from '../events/EventsModel.ts';
import {
  AS_OF,
  type BudgetModel,
  coverAmount,
  money,
  openedAt,
  payerOf,
  payerPaid,
  payersOf,
  shareOf,
  stillToCome,
  totalsOf,
  whole,
} from './BudgetModel.ts';
import { LINES, LONG_NAME, OPENED, PAYERS, type LinkState, type PayerKey } from './BudgetSample.ts';
import { PayerCard, PayersCard } from './BudgetCard.tsx';
import { AlertBox, InfoLine, MoneyRow, PageTitle, Strip } from './BudgetParts.tsx';
import { W, say } from './BudgetWords.ts';

type Range = { settled: number; ifAll: number };

function rangeOf(range: Range, format: (pence: number) => string): string {
  return say.range(format(range.settled), format(range.ifAll));
}

export function linkWords(link: LinkState, locale: string): string {
  if (link === 'notSent') return say.notSent;
  if (link === 'sent') return say.sent;
  const at = openedAt(OPENED.last, locale);
  return say.opened(OPENED.times, at.day, at.time);
}

/** The link's state as a shape and a word (sc-1300): a ring with a bar, a hollow ring, a tick. */
export function LinkLine({ link, locale }: { link: LinkState; locale: string }) {
  const kind = link === 'notSent' ? 'ended' : link === 'sent' ? 'notyet' : 'yes';

  return (
    <View style={styles.link}>
      <View style={styles.linkMark}>
        <ShapeMark kind={kind} side={14} ink={tokens.colorInkSecondary} />
      </View>
      <Text size={14} weight="medium" style={[styles.grow, styles.secondary, styles.linkText]}>
        {linkWords(link, locale)}
      </Text>
    </View>
  );
}

export interface PayersProps {
  m: BudgetModel;
  event: Shown;
  locale: string;
  offline: boolean;
  onPayer: (key: PayerKey) => void;
  onSend: (key: PayerKey) => void;
}

/** sc-30200 on the iPhone: the payers' card, a row per payer with its link's state, read only. */
export function PayersList({ m, event, locale, onPayer }: PayersProps) {
  const payers = payersOf(m.lines);
  const totals = totalsOf(m.lines);
  const range = rangeOf(totals, (pence) => whole(pence, locale));

  if (m.payers === 'none')
    return (
      <>
        <PageTitle title={W.whoIsPaying} />
        <Line text={W.noPayersLine} size={16} />
      </>
    );

  if (m.payers === 'noCosts')
    return (
      <>
        <PageTitle title={W.whoIsPaying} />
        <Line text={W.noCostsLine} />
        <RowList
          items={PAYERS.map((payer) => ({
            key: payer.key,
            row: <MoneyRow title={payer.name} line={payer.note} />,
          }))}
        />
      </>
    );

  return (
    <>
      <PageTitle title={W.whoIsPaying} />
      {m.removed != null && <InfoLine text={say.removed(m.removed)} />}
      <PayersCard
        event={event}
        count={say.payers(PAYERS.length)}
        has={rangeOf(payers.has, (pence) => whole(pence, locale))}
        line={say.hasAPayer(range, whole(payers.noPayer, locale), payers.noPayerCosts)}
      />
      <RowList
        items={PAYERS.map((payer) => ({
          key: payer.key,
          row: (
            <MoneyRow
              title={payer.name}
              line={`${payer.note} · ${linkWords(m.links[payer.key], locale)}`}
              value={rangeOf(shareOf(payer, m.lines), (pence) => money(pence, locale))}
              quiet
              opens
              onPress={() => onPayer(payer.key)}
              testID={`budget.payer.${payer.key}`}
            />
          ),
        }))}
      />
      <InfoLine text={W.chosenOnComputer} />
    </>
  );
}

function PayerFigures({ m, keyOf, locale }: { m: BudgetModel; keyOf: PayerKey; locale: string }) {
  const payer = payerOf(keyOf);
  const share = shareOf(payer, m.lines);
  const paid = payerPaid(m.ledger, keyOf);
  const still = stillToCome(share, paid);

  return (
    <>
      <RowList
        items={[
          {
            key: 'paid',
            row: <MoneyRow title={W.paid} value={money(paid, locale)} quiet />,
          },
          {
            key: 'still',
            row: (
              <MoneyRow
                title={W.stillToCome}
                value={
                  still.ifAll === 0
                    ? W.nothingStillToCome
                    : rangeOf(still, (pence) => money(pence, locale))
                }
                quiet
              />
            ),
          },
        ]}
      />
      <Section title={W.covers}>
        <RowList
          items={payer.covers.map((cover) => {
            const line = LINES.find((one) => one.key === cover.line);
            return {
              key: cover.line,
              row: (
                <MoneyRow
                  title={line?.name ?? cover.line}
                  line={cover.share === 1 ? W.allOfIt : W.half}
                  value={rangeOf(coverAmount(cover.line, cover.share, m.lines), (pence) =>
                    money(pence, locale),
                  )}
                  quiet
                />
              ),
            };
          })}
        />
      </Section>
    </>
  );
}

/** A payer's page: their share as the card, Paid, Still to come, Covers, and the link's state. */
export function PayerPage({ m, event, locale, keyOf }: PayersProps & { keyOf: PayerKey }) {
  const payer = payerOf(keyOf);
  const share = shareOf(payer, m.lines);
  const fixed = share.settled === share.ifAll;

  if (m.longName)
    return (
      <>
        <Text size={22} weight="bold" accessibilityRole="header" style={styles.longName}>
          {LONG_NAME.name}
        </Text>
        <Line text={LONG_NAME.note} />
        <MoneyRow
          title={LONG_NAME.share}
          line={LONG_NAME.shareLine}
          value={LONG_NAME.amount}
          quiet
        />
      </>
    );

  return (
    <>
      <PageTitle title={payer.name} />
      {m.link === 'offline' && <Strip words={say.asOf(AS_OF.time, AS_OF.minutes)} />}
      {m.failed === keyOf && <AlertBox text={W.notCreated} />}
      <PayerCard
        event={event}
        note={payer.note}
        share={rangeOf(share, (pence) => whole(pence, locale))}
        line={fixed ? W.fixedShare : W.rangeLine}
      />
      <PayerFigures m={m} keyOf={keyOf} locale={locale} />
      <LinkLine link={m.links[keyOf]} locale={locale} />
      {m.link === 'offline' && <InfoLine text={W.sendNeedsConnection} />}
    </>
  );
}

/** The bottom action on the phone's payer page, above the tab bar; a long name wraps in full (sc-1300). */
export function SendAction({
  m,
  keyOf,
  onSend,
}: {
  m: BudgetModel;
  keyOf: PayerKey;
  onSend: (key: PayerKey) => void;
}) {
  const payer = payerOf(keyOf);
  const link = m.links[keyOf];
  const busy = m.sending === keyOf;
  const name = m.longName ? LONG_NAME.name : payer.name;
  const first = link === 'notSent';
  const label = m.longName ? `${LONG_NAME.send} ${name}` : first ? say.sendTo(name) : W.sendAgain;

  if (m.link === 'offline') return null;
  if (first || busy)
    return (
      <PrimaryButton
        label={busy ? W.sending : label}
        busy={busy}
        onPress={() => onSend(keyOf)}
        accessibilityLabel={busy ? W.sending : label}
        testID={`budget.send.${keyOf}`}
      />
    );

  return (
    <SecondaryButton
      label={label}
      stacked
      onPress={() => onSend(keyOf)}
      accessibilityLabel={say.sendAgainTo(name)}
      testID={`budget.send.${keyOf}`}
    />
  );
}

/** The iPad: what has a payer and what has none, then a card per payer in two columns, Send in each card's foot. */
export function PayersPad({ m, locale, onSend }: PayersProps) {
  const { layout } = useShell();
  const payers = payersOf(m.lines);
  const totals = totalsOf(m.lines);
  const gap = layout === 'landscape' ? tokens.space5xl : tokens.space3xl;

  if (m.payers !== 'shown')
    return (
      <>
        <PageTitle title={W.whoIsPaying} />
        <Line text={m.payers === 'none' ? W.noPayersLine : W.noCostsLine} size={16} />
      </>
    );

  return (
    <>
      <PageTitle title={W.whoIsPaying} />
      {m.removed != null && <InfoLine text={say.removed(m.removed)} />}
      {m.link === 'offline' && <Strip words={say.asOf(AS_OF.time, AS_OF.minutes)} />}
      <RowList
        items={[
          {
            key: 'has',
            row: (
              <MoneyRow
                title={W.hasAPayer}
                line={say.outOf(rangeOf(totals, (pence) => whole(pence, locale)))}
                value={rangeOf(payers.has, (pence) => money(pence, locale))}
                quiet
              />
            ),
          },
          {
            key: 'none',
            row: (
              <MoneyRow
                title={W.noPayerYet}
                line={say.costCount(payers.noPayerCosts)}
                value={money(payers.noPayer, locale)}
                quiet
              />
            ),
          },
        ]}
      />
      <View style={[styles.cards, { gap }]}>
        {PAYERS.map((payer) => (
          <View key={payer.key} style={styles.cardCell}>
            <PadCard m={m} keyOf={payer.key} locale={locale} onSend={onSend} />
          </View>
        ))}
      </View>
      <InfoLine text={W.chosenOnComputer} />
    </>
  );
}

function PadCard({
  m,
  keyOf,
  locale,
  onSend,
}: {
  m: BudgetModel;
  keyOf: PayerKey;
  locale: string;
  onSend: (key: PayerKey) => void;
}) {
  const payer = payerOf(keyOf);
  const share = shareOf(payer, m.lines);
  const paid = payerPaid(m.ledger, keyOf);
  const still = stillToCome(share, paid);
  const link = m.links[keyOf];
  const busy = m.sending === keyOf;
  const label = link === 'notSent' ? say.sendTo(payer.name) : W.sendAgain;

  return (
    <View style={styles.card} testID={`budget.payerCard.${keyOf}`}>
      <Text size={18} weight="bold" accessibilityRole="header">
        {payer.name}
      </Text>
      <Text size={14} weight="medium" style={styles.secondary}>
        {payer.note}
      </Text>
      <RowList
        items={[
          {
            key: 'share',
            row: (
              <MoneyRow
                title={W.theirShare}
                value={rangeOf(share, (pence) => money(pence, locale))}
                quiet
              />
            ),
          },
          { key: 'paid', row: <MoneyRow title={W.paid} value={money(paid, locale)} quiet /> },
          {
            key: 'still',
            row: (
              <MoneyRow
                title={W.stillToCome}
                value={
                  still.ifAll === 0
                    ? W.nothingStillToCome
                    : rangeOf(still, (pence) => money(pence, locale))
                }
                quiet
              />
            ),
          },
          ...payer.covers.map((cover) => ({
            key: cover.line,
            row: (
              <MoneyRow
                title={LINES.find((one) => one.key === cover.line)?.name ?? cover.line}
                line={cover.share === 1 ? W.allOfIt : W.half}
                value={rangeOf(coverAmount(cover.line, cover.share, m.lines), (pence) =>
                  money(pence, locale),
                )}
                quiet
              />
            ),
          })),
        ]}
      />
      <View style={styles.foot}>
        {m.failed === keyOf && <AlertBox text={W.notCreated} />}
        <LinkLine link={link} locale={locale} />
        {m.link === 'offline' ? (
          <InfoLine text={W.sendNeedsConnection} />
        ) : link === 'notSent' || busy ? (
          <PrimaryButton
            label={busy ? W.sending : label}
            busy={busy}
            onPress={() => onSend(keyOf)}
            testID={`budget.send.${keyOf}`}
          />
        ) : (
          <SecondaryButton
            label={label}
            onPress={() => onSend(keyOf)}
            accessibilityLabel={say.sendAgainTo(payer.name)}
            testID={`budget.send.${keyOf}`}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  secondary: { color: tokens.colorInkSecondary },
  link: { flexDirection: 'row', alignItems: 'flex-start', gap: 7 },
  linkMark: { marginTop: 3 },
  linkText: { lineHeight: 14 * 1.45 },
  longName: { letterSpacing: 22 * -0.02, lineHeight: 22 * 1.2 },
  cards: { flexDirection: 'row', flexWrap: 'wrap' },
  cardCell: { flexBasis: '45%', flexGrow: 1, minWidth: 0 },
  card: {
    gap: tokens.spaceMd,
    padding: tokens.spaceXl,
    borderRadius: tokens.radiusCardLarge,
    borderWidth: 1.5,
    borderColor: tokens.colorBorder,
    backgroundColor: tokens.colorCard,
  },
  foot: {
    gap: tokens.spaceMd,
    paddingTop: tokens.spaceMd,
    borderTopWidth: 1,
    borderTopColor: tokens.colorBorder,
  },
});
