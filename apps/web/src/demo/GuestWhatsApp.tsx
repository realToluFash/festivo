import { useId, useState } from 'react';

import { Glyph } from '../components/Glyph.tsx';
import { ColumnHead, Verb } from './GuestForms.tsx';
import { type AgreeStart, type Guest, phoneShown } from './guests.ts';
import { Refused } from './GuestsParts.tsx';
import { GW } from './guestsWords.ts';
import { useLater } from '../useLater.ts';
import { HOW_AGREED, type HowAgreed, howAgreedProblem } from './whatsAppConsent.ts';

const SAVE_MS = 900;

/** sc-3950 at a desk: the guest's column becomes the change, as Edit does; How? starts with nothing picked. */
export function AgreeForm({
  guest,
  start,
  focus,
  onCancel,
  onSave,
}: {
  guest: Guest;
  start: AgreeStart;
  focus: (...keys: string[]) => void;
  onCancel: () => void;
  onSave: (how: HowAgreed) => void;
}) {
  const id = useId();
  const later = useLater();
  const [how, setHow] = useState<HowAgreed | null>(start.how ?? null);
  const [tried, setTried] = useState(start.tried ?? false);
  const [failed, setFailed] = useState(start.notSaved ?? false);
  const [busy, setBusy] = useState(false);
  const problem = tried ? howAgreedProblem(how) : null;

  function save(): void {
    if (busy) return;
    if (how == null) {
      setTried(true);
      focus('agree-0');
      return;
    }
    setFailed(false);
    setBusy(true);
    later(SAVE_MS, () => onSave(how));
  }

  return (
    <div className="gs-form">
      <ColumnHead title={GW.agreedToWhatsApp}>
        <Verb label={GW.cancel} onClick={onCancel} />
        <Verb label={GW.save} busy={busy} onClick={save} />
      </ColumnHead>
      {failed && <Refused>{GW.notSaved}</Refused>}
      <p className="desk-line">
        {GW.forAgreed(guest.name, guest.phone == null ? '' : phoneShown(guest.phone))}
      </p>
      <fieldset
        className="gs-fieldset"
        role="radiogroup"
        aria-invalid={problem != null || undefined}
        aria-describedby={problem != null ? `${id}-error` : undefined}
      >
        <legend className="gs-legend">{GW.howAgreed}</legend>
        <div className="gs-chips">
          {HOW_AGREED.map((one, at) => (
            <label
              key={one}
              className={['gs-chip', how === one && 'is-on', problem != null && 'is-wrong']
                .filter(Boolean)
                .join(' ')}
            >
              <input
                type="radio"
                className="gs-chip-input"
                name={`${id}-how`}
                checked={how === one}
                data-focus={`agree-${at}`}
                onChange={() => setHow(one)}
              />
              {how === one && <Glyph name="tick" size={15} weight={2.8} />}
              {one}
            </label>
          ))}
        </div>
        {problem != null && (
          <p id={`${id}-error`} className="desk-error">
            <Glyph name="alert" size={15} weight={2.2} />
            {problem}
          </p>
        )}
      </fieldset>
    </div>
  );
}
