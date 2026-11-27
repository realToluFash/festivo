import {
  type InvitationOutcome,
  type LimitRefusal,
  type LimitWay,
  limitRefusalOf,
} from '@soirely/domain';
import { type ReactNode, useContext, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { dateLocale } from '../i18n/index.ts';
import { LayersContext, useDeskLayers } from '../layers.ts';

import { Glyph } from './Glyph.tsx';
import { Dialog } from './SettingsParts.tsx';
import './LimitRefusal.css';

const MEMBERS_AT = '/app/settings/members';

/** A join the seats refused, from an invitation's row: Not now closes it, and the next Accept that meets them opens it again. */
export function SeatsFullRefusal({ outcome }: { outcome: InvitationOutcome | undefined }) {
  const { t } = useTranslation();
  const [shut, setShut] = useState<InvitationOutcome | null>(null);

  if (outcome?.kind !== 'seatsFull' || outcome === shut) return null;

  const refusal = limitRefusalOf(outcome.error, 'seatAccept', t, dateLocale());

  return refusal == null ? null : (
    <OwnLayers>
      <LimitRefusalDialog refusal={refusal} onBack={() => setShut(outcome)} />
    </OwnLayers>
  );
}

/** A dialog's layers where the page has none to draw it in, as the switcher's. */
function OwnLayers({ children }: { children: ReactNode }) {
  const outer = useContext(LayersContext);
  const { layers, setHost } = useDeskLayers();

  if (outer.host != null) return children;

  return (
    <LayersContext value={layers}>
      {children}
      <div className="desk">
        <div ref={setHost} className="desk-layers" />
      </div>
    </LayersContext>
  );
}

/** sc-3930: a plan's hard limit, or the ceiling, refused over the page it was met on; the way back leaves the work as it was. */
export function LimitRefusalDialog({
  refusal,
  guestsAt,
  onBack,
  onWay = onBack,
  inPlace = false,
}: {
  refusal: LimitRefusal;
  /** In another dialog's place, as Duplicate's: the way back is that dialog's own, at its top. */
  inPlace?: boolean;
  /** The event's guest list, for Remove a guest. */
  guestsAt?: string;
  onBack: () => void;
  /** A way past pressed, when its page is under a dialog that has to close too. */
  onWay?: () => void;
}) {
  return (
    <Dialog
      title={refusal.title}
      verb={null}
      cancel={inPlace}
      dismiss={refusal.back}
      onDismiss={onBack}
      onConfirm={onBack}
    >
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
                <WayPast way={way} guestsAt={guestsAt} onWay={onWay} />
              </li>
            ))}
          </ul>
        )}
        {refusal.untick != null && <p className="desk-line is-ink">{refusal.untick}</p>}
        {!inPlace && (
          <div className="lr-back">
            <button type="button" className="button" onClick={onBack}>
              <span className="button-label">{refusal.back}</span>
            </button>
          </div>
        )}
      </div>
    </Dialog>
  );
}

/** A way past closes the refusal as it opens the page, which may be the one under it. */
function WayPast({
  way,
  guestsAt,
  onWay,
}: {
  way: LimitWay;
  guestsAt: string | undefined;
  onWay: () => void;
}) {
  const { t } = useTranslation();

  if (way === 'removeGuest') {
    return (
      <div className="lr-row">
        <div className="lr-row-words">
          <p className="lr-row-title">{t('limitReached.removeGuest')}</p>
          <p className="desk-line is-small">{t('limitReached.removeGuestLine')}</p>
        </div>
        {guestsAt != null && (
          <Link to={guestsAt} className="desk-text" onClick={onWay}>
            {t('limitReached.toGuestList')}
          </Link>
        )}
      </div>
    );
  }

  const withdraw = way === 'withdraw';

  return (
    <Link to={MEMBERS_AT} className="lr-row lr-row-link" onClick={onWay}>
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
