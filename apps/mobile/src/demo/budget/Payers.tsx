import { StyleSheet, View } from 'react-native';

import { PrimaryButton, SecondaryButton } from '../../components/Buttons.tsx';
import { useShell } from '../../components/settingsShell.ts';
import { useAccessibilitySizes } from '../../layout/useLayout.ts';
import { Line, RowList, RowShapes, Section, ShapeMark } from '../../components/Summary.tsx';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import type { Shown } from '../events/EventsModel.ts';
import {
  AS_OF,
  type BudgetModel,
  amountOf,
  coverPart,
  linkWords,
  money,
  notPricedFor,
  payerOf,
  payerPaid,
  payersOf,
  shareOf,
  stillToCome,
  totalsOf,
  washes,
  whole,
} from './BudgetModel.ts';
import { type Cover, LINES, LONG_NAME, type LinkState, type PayerKey } from './BudgetSample.ts';
import { PayerCard, PayersCard } from './BudgetCard.tsx';
import { Wash } from './BudgetHome.tsx';
import {
  AlertBox,
  InfoLine,
  LiveLine,
  LiveMark,
  MarkWord,
  MoneyRow,
  PageTitle,
  RingMark,
  Strip,
} from './BudgetParts.tsx';
import { W, say } from './BudgetWords.ts';

type Range = { settled: number; ifAll: number };

function rangeOf(range: Range, format: (pence: number) => string): string {
  return say.range(format(range.settled), format(range.ifAll));
}

/** The link's state as a shape and a word (sc-1300): a ring with a bar, a hollow ring, a tick. */
export function LinkLine({
  link,
  locale,
  passphrase = false,
}: {
  link: LinkState;
  locale: string;
  passphrase?: boolean;
}) {
  const kind = link === 'notSent' ? 'ended' : link === 'sent' ? 'notyet' : 'yes';
  const words = linkWords(link, locale, passphrase);
  if (words == null) return null;

  return (
    <View style={styles.link}>
      <View style={styles.linkMark}>
        <ShapeMark kind={kind} side={14} ink={tokens.colorInkSecondary} />
      </View>
      <Text size={14} weight="medium" style={[styles.grow, styles.secondary, styles.linkText]}>
        {words}
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
  onWashed: () => void;
}

/** sc-30200 on the iPhone: the payers' card, a row per payer with its link's state, read only. */
export function PayersList({ m, event, locale, onPayer, onWashed }: PayersProps) {
  const list = m.payerList;
  const payers = payersOf(m.lines, list);
  const totals = totalsOf(m.lines);
  const range = rangeOf(totals, (pence) => whole(pence, locale));
  if (m.figures !== 'shown' || m.payers === 'none') return <PayersFirst m={m} />;

  if (m.payers === 'noCosts')
    return (
      <>
        <PageTitle title={W.whoIsPaying} />
        <Line text={W.noCostsLine} />
        <RowList
          items={list.map((payer) => ({
            key: payer.key,
            row: <MoneyRow title={payer.name} line={payer.note} />,
          }))}
        />
      </>
    );

  return (
    <>
      <PayersTitle m={m} />
      <PayersNotices m={m} />
      {m.removed != null && <InfoLine text={say.removed(m.removed)} />}
      <PayersCard
        event={event}
        count={say.payers(list.length)}
        has={rangeOf(payers.has, (pence) => whole(pence, locale))}
        line={say.hasAPayer(range, whole(payers.noPayer, locale), payers.noPayerCosts)}
      />
      <RowList
        items={list.map((payer) => {
          const link = linkWords(m.links[payer.key], locale, m.passphrase.includes(payer.key));
          const unpriced = notPricedFor(payer, m.lines);
          const parts = [
            payer.note,
            ...(unpriced > 0 ? [say.notPriced(unpriced)] : []),
            ...(link == null ? [] : [link]),
          ];
          return {
            key: payer.key,
            row: (
              <Wash on={washes(m, 'payer') && m.washed.includes(payer.key)} onDone={onWashed}>
                <MoneyRow
                  title={payer.name}
                  line={parts.join(' · ')}
                  value={rangeOf(shareOf(payer, m.lines, list), (pence) => money(pence, locale))}
                  quiet
                  opens
                  onPress={() => onPayer(payer.key)}
                  testID={`budget.payer.${payer.key}`}
                />
              </Wash>
            ),
          };
        })}
      />
      <InfoLine text={W.chosenOnComputer} />
    </>
  );
}

/** Who is paying's title, with Live once a change from the web has arrived (sc-30200). */
function PayersTitle({ m }: { m: BudgetModel }) {
  return (
    <PageTitle
      title={W.whoIsPaying}
      right={m.showLive && m.link === 'live' ? <LiveMark word={W.live} /> : undefined}
    />
  );
}

/** Not live and coming back, then what changed on the web: sc-93's strip and lines, on this view too. */
function PayersNotices({ m }: { m: BudgetModel }) {
  return (
    <>
      {m.link !== 'live' && <Strip words={say.asOf(AS_OF.time, AS_OF.minutes)} />}
      {m.link === 'reconnecting' && <InfoLine text={W.reconnecting} glyph="refresh" />}
      {m.news != null && <LiveLine words={m.news} />}
    </>
  );
}

/** Loading, never loaded, no payers, and no payers with no costs either: no figures and no zeros (sc-30200). */
function PayersFirst({ m }: { m: BudgetModel }) {
  if (m.figures === 'loading')
    return (
      <>
        <PayersTitle m={m} />
        <View style={styles.sunk} />
        <Line text={W.loadingPayers} />
        <RowShapes count={4} />
      </>
    );
  if (m.figures === 'never')
    return (
      <>
        <PageTitle title={W.whoIsPaying} />
        <Line text={W.neverLoaded} size={16} />
      </>
    );
  return (
    <>
      <PayersTitle m={m} />
      <PayersNotices m={m} />
      {!m.costs && <Line text={W.noCostsLine} />}
      <Line text={W.noPayersLine} size={16} />
    </>
  );
}

/** One cost on a payer's Covers: its split in words, Needs new amounts once flagged on the web, never £0 for no price. */
function CoverRow({ m, cover, locale }: { m: BudgetModel; cover: Cover; locale: string }) {
  const line =
    m.lines.find((one) => one.key === cover.line) ?? LINES.find((one) => one.key === cover.line);
  const flagged = m.flagged.includes(cover.line);
  const unpriced = line != null && amountOf(line).kind === 'notPriced';
  const part = coverPart(cover, m.lines, m.payerList);
  const words = flagged ? W.needsNewAmounts : cover.share === 1 ? W.allOfIt : W.half;

  return (
    <MoneyRow
      title={line?.name ?? cover.line}
      line={words}
      value={unpriced ? W.notPriced : rangeOf(part, (pence) => money(pence, locale))}
      trail={
        unpriced ? (
          <MarkWord mark={<RingMark dashed ink={tokens.colorInkSecondary} />} word={W.notPriced} />
        ) : undefined
      }
      quiet
    />
  );
}

function PayerFigures({ m, keyOf, locale }: { m: BudgetModel; keyOf: PayerKey; locale: string }) {
  const payer = payerOf(keyOf, m.payerList);
  const share = shareOf(payer, m.lines, m.payerList);
  const paid = payerPaid(m.ledger, keyOf, m.vendorPayers);
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
          items={payer.covers.map((cover) => ({
            key: cover.line,
            row: <CoverRow m={m} cover={cover} locale={locale} />,
          }))}
        />
      </Section>
    </>
  );
}

/** A payer's page: their share as the card, Paid, Still to come, Covers, and the link's state. */
export function PayerPage({ m, event, locale, keyOf }: PayersProps & { keyOf: PayerKey }) {
  const payer = payerOf(keyOf, m.payerList);
  const share = shareOf(payer, m.lines, m.payerList);
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
          value={LONG_NAME.range(
            money(share.settled, LONG_NAME.locale),
            money(share.ifAll, LONG_NAME.locale),
          )}
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
        notPriced={notPricedFor(payer, m.lines)}
      />
      <PayerFigures m={m} keyOf={keyOf} locale={locale} />
      <LinkLine link={m.links[keyOf]} locale={locale} passphrase={m.passphrase.includes(keyOf)} />
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
  const payer = payerOf(keyOf, m.payerList);
  const link = m.links[keyOf];
  const busy = m.sending === keyOf;
  const name = m.longName ? LONG_NAME.name : payer.name;
  const first = link === 'notSent' || link === 'revoked';
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
export function PayersPad({ m, locale, onSend, onWashed }: PayersProps) {
  const { layout } = useShell();
  const big = useAccessibilitySizes();
  const list = m.payerList;
  const payers = payersOf(m.lines, list);
  const totals = totalsOf(m.lines);
  const gap = layout === 'landscape' ? tokens.space5xl : tokens.space3xl;
  if (m.figures !== 'shown' || m.payers === 'none') return <PayersFirst m={m} />;

  if (m.payers !== 'shown')
    return (
      <>
        <PageTitle title={W.whoIsPaying} />
        <Line text={W.noCostsLine} size={16} />
      </>
    );

  return (
    <>
      <PayersTitle m={m} />
      {m.removed != null && <InfoLine text={say.removed(m.removed)} />}
      <PayersNotices m={m} />
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
        {list.map((payer) => (
          <View key={payer.key} style={big ? styles.cardWhole : styles.cardCell}>
            <PadCard m={m} keyOf={payer.key} locale={locale} onSend={onSend} onWashed={onWashed} />
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
  onWashed,
}: {
  m: BudgetModel;
  keyOf: PayerKey;
  locale: string;
  onSend: (key: PayerKey) => void;
  onWashed: () => void;
}) {
  const payer = payerOf(keyOf, m.payerList);
  const share = shareOf(payer, m.lines, m.payerList);
  const paid = payerPaid(m.ledger, keyOf, m.vendorPayers);
  const still = stillToCome(share, paid);
  const link = m.links[keyOf];
  const busy = m.sending === keyOf;
  const first = link === 'notSent' || link === 'revoked';
  const label = first ? say.sendTo(payer.name) : W.sendAgain;
  const unpriced = notPricedFor(payer, m.lines);

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
              <Wash on={washes(m, 'payer') && m.washed.includes(keyOf)} onDone={onWashed}>
                <MoneyRow
                  title={W.theirShare}
                  line={unpriced > 0 ? say.notPriced(unpriced) : undefined}
                  value={rangeOf(share, (pence) => money(pence, locale))}
                  quiet
                />
              </Wash>
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
            row: <CoverRow m={m} cover={cover} locale={locale} />,
          })),
        ]}
      />
      <View style={styles.foot}>
        {m.failed === keyOf && <AlertBox text={W.notCreated} />}
        <LinkLine link={link} locale={locale} passphrase={m.passphrase.includes(keyOf)} />
        {m.link === 'offline' ? (
          <InfoLine text={W.sendNeedsConnection} />
        ) : first || busy ? (
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
  sunk: { height: 200, borderRadius: 26, backgroundColor: tokens.colorNeutralFill },
  cardCell: { flexBasis: '45%', flexGrow: 1, minWidth: 0 },
  cardWhole: { flexBasis: '100%', minWidth: 0 },
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
