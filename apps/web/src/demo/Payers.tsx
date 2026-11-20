import { type Payer } from '@soirely/api-client';
import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router';

import { Glyph } from '../components/Glyph.tsx';
import { Mark } from '../components/SettingsParts.tsx';
import { dateLocale } from '../i18n/index.ts';
import { offButton } from '../offButton.ts';
import { PayersScreen } from '../routes/app/events/PayersArea.tsx';
import { useLater } from '../useLater.ts';
import { BudgetCard, BudgetDialog, BudgetShell, OpenMark } from './BudgetParts.tsx';
import { LINK_WORDS, type LinkState, budgetAt } from './budgetSample.ts';
import { type SampleEvent } from './events.ts';
import { type PayerEntry, SEND_MS, type SendKind, bookSource, startOf } from './payers.ts';
import { PAYERS_WORDS as W } from './payersWords.ts';
import './payers.css';

interface Sending {
  payerId: string;
  kind: SendKind;
  n: number;
}

type Links = Readonly<Record<string, Pick<PayerEntry, 'link' | 'passphrase'>>>;

const NOT_LIVE_MINUTES = 9;

const linkOf = (links: Links, id: string): Pick<PayerEntry, 'link' | 'passphrase'> =>
  links[id] ?? { link: 'notSent' };

const linkWords = ({ link, passphrase }: Pick<PayerEntry, 'link' | 'passphrase'>): string =>
  passphrase === true && link !== 'revoked'
    ? `${LINK_WORDS[link]} ${W.asksPassphrase}`
    : LINK_WORDS[link];

const unsent = (link: LinkState): boolean => link === 'notSent' || link === 'revoked';

/** Who is paying at a desk (sc-91): the product's own screen on the demo's sample data, with sc-1300's Send in the payer's pane. */
export function PayersPage({ event, state }: { event: SampleEvent; state: string }) {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [demo] = useState(() => startOf(state, params.get('payer'), t, dateLocale()));
  const [source] = useState(() =>
    bookSource(demo.book, demo.payments, demo.paidShown, demo.removed, demo.loading),
  );
  const [offline] = useState(() =>
    demo.notLive
      ? {
          at: new Date(Date.now() - NOT_LIVE_MINUTES * 60_000),
          retry: () => void navigate(budgetAt('payers')),
        }
      : null,
  );
  const [links, setLinks] = useState<Links>(() =>
    Object.fromEntries(
      demo.book.payers.map((one) => [
        one.id,
        one.passphrase === true ? { link: one.link, passphrase: true } : { link: one.link },
      ]),
    ),
  );
  const [send, setSend] = useState<Sending | null>(
    demo.send == null ? null : { ...demo.send, n: 0 },
  );
  const later = useLater();
  const link = `${window.location.origin}/demo/share/payer`;
  const linked = (id: string, to: LinkState) =>
    setLinks((now) => ({ ...now, [id]: { ...linkOf(now, id), link: to } }));

  async function copy(payerId: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(link);
      setSend((now) => ({ payerId, kind: 'copied', n: (now?.n ?? 0) + 1 }));
    } catch {
      setSend((now) => ({ payerId, kind: 'refused', n: (now?.n ?? 0) + 1 }));
    }
  }

  function sendPressed(payer: Payer): void {
    if (send?.payerId === payer.id && send.kind === 'busy') return;
    const share = () =>
      demo.shares
        ? setSend((now) => ({ payerId: payer.id, kind: 'shared', n: (now?.n ?? 0) + 1 }))
        : void copy(payer.id);
    if (!unsent(linkOf(links, payer.id).link)) {
      share();

      return;
    }
    setSend((now) => ({ payerId: payer.id, kind: 'busy', n: now?.n ?? 0 }));
    later(SEND_MS, () => {
      linked(payer.id, 'sent');
      share();
    });
  }

  return (
    <PayersScreen
      source={source}
      writes
      home={budgetAt()}
      titleTail={[t('budget.title'), event.name]}
      start={demo.start}
      offline={offline}
      renderCard={(label, children) => (
        <BudgetCard event={event} label={label}>
          {children}
        </BudgetCard>
      )}
      renderFrame={({ choosing, body, dialog }) => (
        <BudgetShell
          event={event}
          trail={[
            { label: t('budget.title'), to: budgetAt() },
            { label: choosing ? t('payers.chooseTitle') : t('payers.title') },
          ]}
        >
          {() => (
            <>
              {body}
              {dialog}
            </>
          )}
        </BudgetShell>
      )}
      extra={{
        rowLine: (payer) => linkWords(linkOf(links, payer.id)),
        renderPane: (payer) => (
          <SendFoot
            key={payer.id}
            payer={payer}
            link={link}
            state={linkOf(links, payer.id)}
            send={send?.payerId === payer.id ? send : null}
            eventName={event.name}
            onSend={() => sendPressed(payer)}
            onShared={() => {
              setSend(null);
              if (linkOf(links, payer.id).link === 'notSent') linked(payer.id, 'sent');
            }}
          />
        ),
      }}
    />
  );
}

function LinkMark({ link }: { link: LinkState }) {
  if (link === 'revoked') return null;
  if (link === 'sent') return <OpenMark />;

  return <Mark kind={link === 'opened' ? 'yes' : 'ended'} />;
}

function SendFoot({
  payer,
  link,
  state,
  send,
  eventName,
  onSend,
  onShared,
}: {
  payer: Payer;
  link: string;
  state: Pick<PayerEntry, 'link' | 'passphrase'>;
  send: Sending | null;
  eventName: string;
  onSend: () => void;
  onShared: () => void;
}) {
  const kind = send?.kind ?? null;
  const busy = kind === 'busy';
  const first = unsent(state.link);

  return (
    <>
      <div className="py-send-foot">
        <div className="py-said" role="status">
          {kind === 'copied' && (
            <p className="py-copied">
              <Glyph name="tick" size={15} weight={2.6} />
              {W.linkCopied}
            </p>
          )}
        </div>
        {kind === 'failed' && (
          <p className="desk-error py-alert" role="alert">
            <Glyph name="alert" size={15} weight={2.2} />
            {W.notCreated}
          </p>
        )}
        {kind === 'refused' && <LinkField key={send?.n} link={link} />}
        {kind !== 'failed' && kind !== 'refused' && state.link !== 'revoked' && (
          <p className="py-link">
            <span className="py-link-mark">
              <LinkMark link={state.link} />
            </span>
            {linkWords(state)}
          </p>
        )}
        <button
          type="button"
          className={busy ? 'py-send is-busy' : 'py-send'}
          aria-label={busy || first ? undefined : W.sendAgainTo(payer.name)}
          aria-busy={busy || undefined}
          {...offButton(busy, { dim: false })}
          onClick={onSend}
        >
          {busy ? W.sending : first ? W.sendTo(payer.name) : W.sendAgain}
        </button>
      </div>
      {kind === 'shared' && (
        <BudgetDialog
          title={W.browserSheet}
          verb={W.close}
          cancel={false}
          onDismiss={onShared}
          onConfirm={onShared}
        >
          <p className="desk-line is-ink">{W.message(eventName)}</p>
          <p className="desk-line py-shared-link">{link}</p>
        </BudgetDialog>
      )}
    </>
  );
}

function LinkField({ link }: { link: string }) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, []);

  return (
    <div className="desk-field">
      <label htmlFor={id} className="desk-label">
        {W.theLink}
      </label>
      <div className="desk-box">
        <input
          ref={input}
          id={id}
          type="text"
          value={link}
          readOnly
          spellCheck={false}
          aria-describedby={`${id}-line`}
          onFocus={(event) => event.currentTarget.select()}
        />
      </div>
      <p id={`${id}-line`} className="py-refused-line">
        {W.copyRefused}
      </p>
    </div>
  );
}
