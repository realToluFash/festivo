import { Glyph } from '../components/Glyph.tsx';
import { Switch } from '../components/GeneralParts.tsx';
import { type Card, type Mark, NW, REMINDER_AT, type rowLines } from './notices.ts';
import './notices.css';

export function ReminderCard({
  card,
  manage,
  on,
  notSaved,
  billing,
  over,
  onSwitch,
  onCredits,
}: {
  card: Card;
  manage: boolean;
  on: boolean;
  notSaved: boolean;
  billing: boolean;
  over: boolean;
  onSwitch: (next: boolean) => void;
  onCredits: () => void;
}) {
  return (
    <>
      {over && (
        <p id="sv-over" className="sv-over" role="status" tabIndex={-1}>
          <Glyph name="info" size={18} weight={2.2} />
          {NW.alreadyOver}
        </p>
      )}
      <section className="sn-card sv-card" aria-labelledby="sv-title">
        <div className="sn-card-top">
          <div className="sn-card-names">
            <h2 id="sv-title">{NW.card}</h2>
          </div>
          {card.kind === 'open' &&
            (manage ? (
              <Switch
                on={on}
                label={NW.switchLabel}
                words={{ on: NW.on, off: NW.off }}
                told="sv-does"
                onChange={onSwitch}
              />
            ) : (
              <p className="sv-word">{on ? NW.on : NW.off}</p>
            ))}
        </div>
        {card.kind === 'finished' ? (
          <p className="sv-finished">{card.line}</p>
        ) : (
          <>
            <p id="sv-does" className="mn-sub">
              {NW.does(REMINDER_AT)}
            </p>
            {notSaved && (
              <p className="rs-missed" role="alert">
                <Glyph name="alert" size={15} weight={2.2} />
                {NW.notSaved(on)}
              </p>
            )}
            {(card.top != null || card.left.length > 0) && (
              <div className="sv-lines">
                {card.top != null && <p className="sv-next">{card.top}</p>}
                {card.cost != null && <p className="sv-line">{card.cost}</p>}
                {card.short > 0 && (
                  <div className="sv-short">
                    <p className="sv-short-says">
                      <Glyph name="warn" size={18} weight={2.3} />
                      {NW.short(card.short)}
                    </p>
                    <button
                      type="button"
                      className={
                        billing
                          ? 'gs-pill is-primary sv-short-act'
                          : 'gs-pill is-secondary sv-short-act'
                      }
                      onClick={onCredits}
                    >
                      {billing ? NW.buyCredits : NW.askOwner}
                    </button>
                  </div>
                )}
                {card.left.map((line) => (
                  <p key={line} className="sv-line">
                    {line}
                  </p>
                ))}
              </div>
            )}
          </>
        )}
      </section>
    </>
  );
}

export function UnreachableWord() {
  return (
    <span className="rs-link">
      <NoticeMark mark="unreachable" />
      {NW.unreachable}
    </span>
  );
}

export function NoticeLines({ lines }: { lines: ReturnType<typeof rowLines> }) {
  if (lines.length === 0) return null;

  return (
    <span className="sv-row-lines">
      {lines.map((line) => (
        <span
          key={line.words}
          className={line.mark == null ? 'sv-row-line is-under' : 'sv-row-line'}
        >
          {line.mark != null && <NoticeMark mark={line.mark} />}
          {line.words}
        </span>
      ))}
    </span>
  );
}

const MARK_CLASS = {
  waiting: 'is-waiting',
  quiet: 'is-quiet',
  told: 'is-told',
  failed: 'is-failed',
  unreachable: 'is-unreachable',
  calledOff: 'is-called-off',
  ended: 'is-ended',
} satisfies Record<Mark, string>;

const GLYPHS = {
  waiting: 'clock',
  quiet: 'bellOff',
  told: 'message',
  failed: 'clear',
  unreachable: 'alert',
} as const;

export function NoticeMark({ mark }: { mark: Mark }) {
  if (mark === 'calledOff' || mark === 'ended')
    return (
      <span className={`sv-mark ${MARK_CLASS[mark]}`} aria-hidden="true">
        <span className="sv-mark-inner" />
      </span>
    );

  return (
    <span className={`sv-mark ${MARK_CLASS[mark]}`} aria-hidden="true">
      <Glyph name={GLYPHS[mark]} size={mark === 'failed' ? 10 : 14} weight={2.6} />
    </span>
  );
}
