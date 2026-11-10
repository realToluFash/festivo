import { Glyph } from '../components/Glyph.tsx';
import type { Channel, Visit, Words } from './guest.ts';
import { channelRows } from './guestMessages.ts';
import { TextAction } from './GuestParts.tsx';

/** sc-3969's Your messages, opened from the guest's page: the switches alone, no lead button (sc-3950). */
export function YourMessages({
  visit,
  words,
  onSwitch,
  onBack,
}: {
  visit: Visit;
  words: Words;
  onSwitch: (channel: Channel) => void;
  onBack: () => void;
}) {
  const rows = channelRows(visit);
  const saved = rows.find((row) => row.saved);

  return (
    <section className="gp-yours" aria-labelledby="gp-yours-h">
      <TextAction ink icon={<Glyph name="back" size={18} weight={2.2} />} onClick={onBack}>
        {words.back}
      </TextAction>
      <h1 id="gp-yours-h" className="gp-yours-title" tabIndex={-1} data-focus="yoursHead">
        {words.yourMessages}
      </h1>
      <p className="gp-sub">{words.yourMessagesIntro}</p>
      <div className="gp-yours-rows">
        {rows.map((row) => {
          const id = (part: string) => `gp-${row.channel}-${part}`;
          const describedBy = [row.whatsAppLine && id('line'), row.saved && id('saved')]
            .filter(Boolean)
            .join(' ');

          return (
            <div key={row.channel} className="gp-yours-row">
              <div className="gp-yours-words">
                <p id={id('name')} className="gp-yours-name">
                  {words.channel(row.channel)}
                </p>
                {!row.has && (
                  <p className="gp-yours-line">
                    <span className="gp-yours-none" aria-hidden="true" />
                    <span>{words.noPhone}</span>
                  </p>
                )}
                {row.whatsAppLine && (
                  <p id={id('line')} className="gp-yours-line">
                    {words.whatsAppUpdates}
                  </p>
                )}
                {row.saved && (
                  <p id={id('saved')} className="gp-yours-line is-saved">
                    <Glyph name="tick" size={15} weight={3} />
                    <span>{words.savedLine(row.channel, row.on)}</span>
                  </p>
                )}
              </div>
              {row.has && (
                <label className="gp-switch">
                  <span className="gp-switch-track">
                    <input
                      type="checkbox"
                      role="switch"
                      className="gp-switch-input"
                      checked={row.on}
                      data-focus={`switch-${row.channel}`}
                      aria-labelledby={id('name')}
                      aria-describedby={describedBy === '' ? undefined : describedBy}
                      onChange={() => onSwitch(row.channel)}
                    />
                    <span className="gp-switch-knob" aria-hidden="true" />
                  </span>
                  <span className="gp-switch-word" aria-hidden="true">
                    {words.switchWord(row.on)}
                  </span>
                </label>
              )}
            </div>
          );
        })}
      </div>
      <p className="gp-small">{words.yourMessagesFoot}</p>
      <p className="visually-hidden" aria-live="polite" aria-atomic="true">
        {saved == null ? '' : words.savedLine(saved.channel, saved.on)}
      </p>
    </section>
  );
}
