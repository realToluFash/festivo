import { Fragment, type ReactNode } from 'react';

import { Glyph, type GlyphName } from '../components/Glyph.tsx';
import {
  type Delivery,
  type Kind,
  type Lead,
  type Reach,
  type Segment,
  type Where,
  MW,
  filled,
  legendWord,
  tokenWord,
} from './messages.ts';
import { type Bit, useInbox } from './messagesContext.ts';

export function WhereGlyph({ where, size = 14 }: { where: Where; size?: number }) {
  const name: GlyphName = where === 'page' ? 'page' : where === 'email' ? 'mail' : where;

  return <Glyph name={name} size={size} weight={2} />;
}

/** WhatsApp's reach line (sc-3950), whenever WhatsApp is ticked: its mark, then who it reaches and who it can't. */
export function WhatsAppReach({ line }: { line: string }) {
  return (
    <p className="mg-wa-reach">
      <WhereGlyph where="whatsApp" size={15} />
      <span>{line}</span>
    </p>
  );
}

/** A delivery's shape, always beside its word: never colour alone. */
export function DeliveryMark({ kind }: { kind: Delivery }) {
  switch (kind) {
    case 'delivered':
    case 'sent':
      return (
        <span className={`mg-mark is-${kind}`} aria-hidden="true">
          <Glyph name="tick" size={8} weight={3.6} />
        </span>
      );
    case 'bounced':
      return (
        <span className="mg-mark is-bounced" aria-hidden="true">
          <Glyph name="clear" size={8} weight={3.4} />
        </span>
      );
    case 'unconfirmed':
      return (
        <span className="mg-mark is-unconfirmed" aria-hidden="true">
          <Glyph name="question" size={12} weight={2.6} />
        </span>
      );
    case 'held':
      return (
        <span className="mg-mark is-held" aria-hidden="true">
          <Glyph name="clock" size={14} weight={2.4} />
        </span>
      );
    case 'optout':
      return (
        <span className="mg-mark is-optout" aria-hidden="true">
          <Glyph name="slash" size={14} weight={2.2} />
        </span>
      );
    default:
      return <span className={`mg-mark is-${kind}`} aria-hidden="true" />;
  }
}

export function Meta({ bits, end = false }: { bits: readonly Bit[]; end?: boolean }) {
  return (
    <p className={end ? 'mg-meta is-end' : 'mg-meta'}>
      {bits.map((bit, index) => (
        <Fragment key={index}>
          {index > 0 && <span aria-hidden="true">·</span>}
          <span className="mg-bit">
            {bit.where != null && <WhereGlyph where={bit.where} />}
            {bit.mark != null && <DeliveryMark kind={bit.mark} />}
            {bit.clip === true && <Paperclip />}
            {bit.words}
          </span>
        </Fragment>
      ))}
    </p>
  );
}

function Paperclip() {
  return (
    <svg
      className="mg-clip"
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m21 11-8.6 8.6a5.5 5.5 0 0 1-7.8-7.8l8.6-8.6a3.7 3.7 0 0 1 5.2 5.2l-8.6 8.6a1.8 1.8 0 0 1-2.6-2.6l7.9-7.9" />
    </svg>
  );
}

export function DayRule({ children }: { children: string }) {
  return (
    <li className="mg-day">
      <span>{children}</span>
    </li>
  );
}

export function TokenChip({ token }: { token: Segment & { kind: 'token' } }) {
  const word = tokenWord(token.token);

  return (
    <span className="mg-token" role="img" aria-label={filled(MW.tokenName, { token: word })}>
      {word}
    </span>
  );
}

export function Words({ body }: { body: readonly Segment[] }) {
  return body.map((part, index) =>
    part.kind === 'text' ? (
      <Fragment key={index}>{part.text}</Fragment>
    ) : (
      <TokenChip key={index} token={part} />
    ),
  );
}

export function GuestBubble({ text, bits }: { text: string; bits: readonly Bit[] }) {
  return (
    <li className="mg-said is-guest">
      <p className="mg-bubble is-guest">{text}</p>
      <Meta bits={bits} />
    </li>
  );
}

const LOOK = {
  sent: 'is-sent',
  dashed: 'is-dashed',
  dashedFaded: 'is-dashed is-dim',
  faded: 'is-faded',
  arriving: 'is-arriving',
  greyed: 'is-greyed',
} as const;

export function HostBubble({
  subject,
  body,
  bits,
  look = 'sent',
  bare = false,
  children,
}: {
  subject?: string;
  body: ReactNode;
  bits: readonly Bit[];
  look?: 'sent' | 'dashed' | 'dashedFaded' | 'faded' | 'arriving' | 'greyed';
  /** Only what goes under the bubble: an invitation sent with no note (sc-3971). */
  bare?: boolean;
  children?: ReactNode;
}) {
  return (
    <li className="mg-said is-host">
      {!bare && (
        <div className={`mg-bubble is-host ${LOOK[look]}`}>
          {subject != null && subject.trim() !== '' && <p className="mg-subject-line">{subject}</p>}
          <p>{body}</p>
        </div>
      )}
      {bits.length > 0 && <Meta bits={bits} end />}
      {children}
    </li>
  );
}

export function SoirelyCard({
  title,
  lines,
  bits,
  glyph = 'mail',
  lang,
}: {
  title?: string;
  lines: readonly string[];
  bits: readonly Bit[];
  glyph?: GlyphName;
  lang?: string;
}) {
  return (
    <li className="mg-said is-host">
      <div className="mg-soirely" lang={lang}>
        <Glyph name={glyph} size={16} />
        <div className="mg-soirely-words">
          {title != null && <p className="mg-soirely-title">{title}</p>}
          {lines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      </div>
      <Meta bits={bits} end />
    </li>
  );
}

export function Stub({
  title,
  glyph,
  bits,
}: {
  title: string;
  glyph: GlyphName;
  bits: readonly Bit[];
}) {
  return (
    <li className="mg-said is-host">
      <div className="mg-stub">
        <Glyph name={glyph} size={16} />
        <div>
          <p className="mg-stub-title">{title}</p>
          <Meta bits={bits} />
        </div>
      </div>
    </li>
  );
}

export function SystemLine({ glyph, children }: { glyph: GlyphName; children: ReactNode }) {
  return (
    <li className="mg-system">
      <Glyph name={glyph} size={15} weight={2.1} />
      <p>{children}</p>
    </li>
  );
}

export function ReachBar({ reach, size = 'small' }: { reach: Reach; size?: 'small' | 'big' }) {
  const total = reach.parts.reduce((sum, part) => sum + part.count, 0);
  const width = 1000;
  const gap = 4;
  const room = width - gap * (reach.parts.length - 1);
  const widths = reach.parts.map((part) => Math.max(8, (part.count / Math.max(total, 1)) * room));
  const starts = widths.map((_, index) =>
    widths.slice(0, index).reduce((sum, one) => sum + one + gap, 0),
  );

  return (
    <svg
      className={`mg-bar is-${size}`}
      viewBox={`0 0 ${width} 10`}
      preserveAspectRatio="none"
      role="img"
      aria-label={filled(MW.reached, { count: reach.reached, total: reach.of })}
    >
      <rect className="mg-bar-track" x={0} y={0} width={width} height={10} />
      {reach.parts.map((part, index) => (
        <rect
          key={part.kind}
          className={`mg-bar-${BAR[part.kind]}`}
          x={starts[index]}
          y={0}
          width={widths[index]}
          height={10}
        />
      ))}
    </svg>
  );
}

const BAR: Record<'reached' | Kind, string> = {
  reached: 'reached',
  inProgress: 'in-progress',
  held: 'in-progress',
  skipped: 'not-sent',
  bounced: 'bounced',
  failed: 'bounced',
  notSent: 'not-sent',
  notConfirmed: 'not-confirmed',
  optedOut: 'opted-out',
  none: 'none',
  cant: 'none',
};

const LEGEND_MARK: Record<'reached' | Kind, Delivery> = {
  reached: 'delivered',
  inProgress: 'sending',
  held: 'held',
  skipped: 'notsent',
  bounced: 'bounced',
  failed: 'bounced',
  notSent: 'notsent',
  notConfirmed: 'unconfirmed',
  optedOut: 'optout',
  none: 'none',
  cant: 'none',
};

export function Legend({ reach }: { reach: Reach }) {
  return (
    <ul className="mg-legend">
      {reach.parts.map((part) => (
        <li key={part.kind}>
          <DeliveryMark kind={LEGEND_MARK[part.kind]} />
          <strong>{part.count}</strong> {legendWord(part.kind)}
        </li>
      ))}
    </ul>
  );
}

export function LeadMark({ lead, size = 40 }: { lead: Lead; size?: 40 | 44 }) {
  const { mesh } = useInbox();

  if (lead.kind === 'many')
    return (
      <span className={`mg-group today-cover is-${mesh} is-${size}`} aria-hidden="true">
        <Glyph name="group" size={size / 2} weight={2.1} />
      </span>
    );

  return (
    <span
      className={`mg-avatar is-${size} ${lead.kind === 'guest' && lead.unread ? 'is-unread' : ''}`}
      aria-hidden="true"
    >
      {lead.kind === 'guest' ? lead.initials : '?'}
    </span>
  );
}

/** Why New is unavailable: the mark and the reason in the secondary ink, never colour alone (sc-3942). */
export function WhyNot({ id, words }: { id?: string; words: string }) {
  return (
    <p id={id} className="mg-why" data-testid="messages-closed">
      <Glyph name="info" size={16} weight={2.2} />
      <span>{words}</span>
    </p>
  );
}
