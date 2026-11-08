import {
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import {
  AppState,
  type ScrollViewInstance,
  StyleSheet,
  View,
  type ViewInstance,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useReadOut } from '../../components/ReadOut.tsx';
import type { ScreenReaderTarget } from '../../components/screenReaderFocus.ts';
import { useShell } from '../../components/settingsShell.ts';
import { PHONE_TAB_BAR } from '../../components/TodayCover.tsx';
import { tokens } from '../../theme/tokens.ts';
import { EventFrame } from '../events/EventFrame.tsx';
import type { Shown } from '../events/EventsModel.ts';
import type { AreaKey } from '../events/EventsSample.ts';
import {
  type BudgetState,
  LIVE_CHANGE,
  days,
  money,
  owed,
  paymentOf,
  reduce,
  startOf,
  withRate,
} from './BudgetModel.ts';
import { LINES, REMOVED_PAYER, TODAY, VENDORS, type PayerKey } from './BudgetSample.ts';
import { BudgetHome, liveWords } from './BudgetHome.tsx';
import { DueNow } from './DueNow.tsx';
import { MarkPaid } from './MarkPaid.tsx';
import { PayerPage, PayersList, PayersPad, SendAction } from './Payers.tsx';
import { W, say } from './BudgetWords.ts';

const READER = 'Folake Adeyemi';
const SEND_MS = 700;
const LINK_MS = 900;
const RECONNECT_MS = 2500;
const LIVE_MS = 1200;

/** Budget A in the event's frame, on sample data: nothing reaches the API, and each wait is a timer. */
export function BudgetScreen({
  state,
  event,
  now,
  locale,
  more,
  onMore,
  onArea,
}: {
  state: BudgetState | null;
  event: Shown;
  now: Date;
  locale: string;
  more: boolean;
  onMore: (open: boolean) => void;
  onArea: (area: AreaKey) => void;
}) {
  const { layout } = useShell();
  const insets = useSafeAreaInsets();
  const phone = layout === 'phone';
  const [m, go] = useReducer(reduce, null, () => startOf(state, REMOVED_PAYER));
  const [toast, setToast] = useState<string | null>(null);
  const rows = useRef<Partial<Record<string, ViewInstance | null>>>({});
  const from = useRef('card');
  const opener = useMemo<RefObject<ScreenReaderTarget | null>>(
    () => ({
      get current() {
        return rows.current[from.current] ?? null;
      },
    }),
    [],
  );
  const scroll = useRef<ScrollViewInstance>(null);
  const scrolledOnce = useRef(false);
  useReadOut(m.told?.words ?? null, { answer: m.told?.at });

  const sendingForm = m.form?.phase === 'sending' ? m.form : null;
  useEffect(() => {
    if (sendingForm == null) return undefined;
    const amount = sendingForm.amount ?? paymentOf(sendingForm.id).amount;
    const words = say.markedPaid(money(amount, locale), days.long(sendingForm.on, locale));
    const timer = setTimeout(() => go({ type: 'marked', amount, reader: READER, words }), SEND_MS);
    return () => clearTimeout(timer);
  }, [sendingForm, locale]);

  const live = state === 'live_update';
  useEffect(() => {
    if (!live) return undefined;
    const words = liveWords(withRate(LINES, LIVE_CHANGE.line, LIVE_CHANGE.to), locale);
    const timer = setTimeout(() => go({ type: 'liveChange', words }), LIVE_MS);
    return () => clearTimeout(timer);
  }, [live, locale]);

  useEffect(() => {
    if (m.link !== 'reconnecting') return undefined;
    const timer = setTimeout(() => go({ type: 'reconnected' }), RECONNECT_MS);
    return () => clearTimeout(timer);
  }, [m.link]);

  useEffect(() => {
    const key = m.sending;
    if (key == null) return undefined;
    const timer = setTimeout(() => {
      go({ type: 'linkMade', key });
      setToast(W.shareSheet);
    }, LINK_MS);
    return () => clearTimeout(timer);
  }, [m.sending]);

  useEffect(() => {
    const away = AppState.addEventListener('change', (next) => {
      if (next === 'background') go({ type: 'leave' });
    });
    return () => away.remove();
  }, []);

  const onMark = (amount: number, on: string) => go({ type: 'sendMark', amount, on });
  const onWashed = useCallback(() => go({ type: 'washed' }), []);
  const ceilingAt = (y: number) => {
    if (!m.scrolled || scrolledOnce.current) return;
    scrolledOnce.current = true;
    setTimeout(() => scroll.current?.scrollTo({ y: Math.max(0, y - 8), animated: false }), 50);
  };
  const ownDesign = (what: string) => setToast(say.ownDesign(what));
  const toBudget = () => go({ type: 'view', view: { page: 'home' } });
  const toPayers = () => go({ type: 'view', view: { page: 'payers' } });
  const onPayer = (key: PayerKey) => go({ type: 'view', view: { page: 'payer', key } });
  const onSend = (key: PayerKey) => {
    if (m.sending == null) go({ type: 'send', key });
  };
  const area = (next: AreaKey) => {
    if (next === 'budget') toBudget();
    else onArea(next);
  };
  const view = m.view;
  const props = { m, event, locale, offline: m.link === 'offline', onPayer, onSend };

  let page;
  if (view.page === 'payers') page = phone ? <PayersList {...props} /> : <PayersPad {...props} />;
  else if (view.page === 'payer')
    page = phone ? <PayerPage {...props} keyOf={view.key} /> : <PayersPad {...props} />;
  else
    page = (
      <BudgetHome
        m={m}
        event={event}
        locale={locale}
        onWashed={onWashed}
        actions={{
          onStep: (id) => {
            from.current = 'card';
            go({ type: 'openMark', id, from: 'card' });
          },
          onRow: (id) => {
            from.current = id;
            go({ type: 'openMark', id, from: 'card' });
          },
          rowRef: (id) => (node) => {
            rows.current[id] = node;
          },
          onEverything: () => {
            from.current = 'everything';
            go({ type: 'openDueNow', ids: owed(m.ledger).map((payment) => payment.id) });
          },
          onUndo: (id, vendor) => go({ type: 'undo', id, words: say.unmarked(vendor) }),
          onPayers: toPayers,
          onOwnDesign: ownDesign,
          stepRef: (node: ViewInstance | null) => {
            rows.current.card = node;
          },
          ceilingAt,
        }}
      />
    );

  const phoneBack =
    view.page === 'payers'
      ? { label: W.budget, onPress: toBudget }
      : view.page === 'payer'
        ? { label: W.whoIsPaying, onPress: toPayers }
        : undefined;
  const foot = Math.max(insets.bottom - tokens.spaceXxs, tokens.spaceLg);
  const pinned =
    phone && view.page === 'payer' && m.link !== 'offline' ? (
      <View style={[styles.pinned, { bottom: foot + PHONE_TAB_BAR + tokens.spaceMd }]}>
        <SendAction m={m} keyOf={view.key} onSend={onSend} />
      </View>
    ) : null;

  return (
    <EventFrame
      key={view.page === 'payer' ? `payer:${view.key}` : view.page}
      event={event}
      now={now}
      area="budget"
      onArea={area}
      more={more}
      onMore={onMore}
      scrollRef={scroll}
      phoneBack={phoneBack}
      toast={toast == null ? null : { words: toast, onClose: () => setToast(null) }}
      overlay={
        <>
          {pinned}
          <MarkPaid
            form={m.form}
            locale={locale}
            opener={opener}
            onClose={() => go({ type: 'closeForm' })}
            onMark={onMark}
          />
          <DueNow
            sheet={m.dueNow}
            form={m.form}
            ledger={m.ledger}
            locale={locale}
            opener={opener}
            onClose={() => go({ type: 'closeDueNow' })}
            onPaid={(id) =>
              go({
                type: 'duePaid',
                id,
                reader: READER,
                words: say.markedPaid(
                  money(paymentOf(id).amount, locale),
                  days.long(TODAY, locale),
                ),
              })
            }
            onUndo={(id) =>
              go({ type: 'dueUndo', id, words: say.unmarked(VENDORS[paymentOf(id).vendor].name) })
            }
            onDifferent={(id) => go({ type: 'openMark', id, from: 'dueNow' })}
            onCloseForm={() => go({ type: 'closeForm' })}
            onMark={onMark}
          />
        </>
      }
    >
      {page}
      {pinned != null && <View style={styles.room} />}
    </EventFrame>
  );
}

const styles = StyleSheet.create({
  pinned: { position: 'absolute', left: tokens.spaceXxl, right: tokens.spaceXxl },
  room: { height: 72 },
});
