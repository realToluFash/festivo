import { type LimitRefusal, type LimitWay } from '@soirely/domain';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { Glyph } from './Glyph.tsx';
import { Dialog } from './SettingsParts.tsx';
import './LimitRefusal.css';

const MEMBERS_AT = '/app/settings/members';

/** sc-3930: a plan's hard limit, or the ceiling, refused over the page it was met on; the way back leaves the work as it was. */
export function LimitRefusalDialog({
  refusal,
  guestsAt,
  onBack,
}: {
  refusal: LimitRefusal;
  /** The event's guest list, for Remove a guest. */
  guestsAt?: string;
  onBack: () => void;
}) {
  return (
    <Dialog title={refusal.title} verb={null} cancel={false} onDismiss={onBack} onConfirm={onBack}>
      <div className="lr lr-hard-limit">
        {refusal.line != null && <p className="desk-line is-ink">{refusal.line}</p>}
        {refusal.figure != null && <p className="lr-figure">{refusal.figure}</p>}
        <p className="lr-safe">
          <Glyph name="shield" size={16} weight={2.2} />
          {refusal.safe}
        </p>
        {(refusal.goLive != null || refusal.ways.length > 0) && (
          <ul className="lr-ways">
            {refusal.goLive != null && (
              <li>
                <p className="lr-inset">
                  <Glyph name="clock" size={16} weight={2.2} />
                  {refusal.goLive}
                </p>
              </li>
            )}
            {refusal.ways.map((way) => (
              <li key={way}>
                <WayPast way={way} guestsAt={guestsAt} />
              </li>
            ))}
          </ul>
        )}
        {refusal.untick != null && <p className="desk-line is-ink">{refusal.untick}</p>}
        <div className="lr-back">
          <button type="button" className="button" onClick={onBack}>
            <span className="button-label">{refusal.back}</span>
          </button>
        </div>
      </div>
    </Dialog>
  );
}

function WayPast({ way, guestsAt }: { way: LimitWay; guestsAt: string | undefined }) {
  const { t } = useTranslation();

  if (way === 'removeGuest') {
    return (
      <div className="lr-row">
        <div className="lr-row-words">
          <p className="lr-row-title">{t('limitReached.removeGuest')}</p>
          <p className="desk-line is-small">{t('limitReached.removeGuestLine')}</p>
        </div>
        {guestsAt != null && (
          <Link to={guestsAt} className="desk-text">
            {t('limitReached.toGuestList')}
          </Link>
        )}
      </div>
    );
  }

  const withdraw = way === 'withdraw';

  return (
    <Link to={MEMBERS_AT} className="lr-row lr-row-link">
      <span className="lr-row-words">
        <span className="lr-row-title">
          {t(withdraw ? 'limitReached.withdraw' : 'limitReached.removeMember')}
        </span>
        <span className="desk-line is-small">
          {t(withdraw ? 'limitReached.withdrawLine' : 'limitReached.removeMemberLine')}
        </span>
      </span>
      <Glyph name="chevron" size={16} weight={2.2} />
    </Link>
  );
}
