import { Glyph } from '../components/Glyph.tsx';
import { CHANNELS, type Channel, type Visit, type Words, type Yours } from './guest.ts';
import { type ChannelRow, channelRows } from './guestMessages.ts';
import { Line, Mark, Notice, Spinner, TextAction, Filled } from './GuestParts.tsx';

/** sc-3969: every page the email's link opens is kept out of search results and other sites' referrers. */
export function KeptOut() {
  return (
    <>
      <meta name="robots" content="noindex" />
      <meta name="referrer" content="no-referrer" />
    </>
  );
}

/** sc-3969's Your messages: from an email's link it leads with Stop emails; from the guest's page, Back and the switches alone. */
export function YourMessages({
  visit,
  words,
  onPress,
  onSwitch,
  onRetry,
  onBack,
}: {
  visit: Visit;
  words: Words;
  onPress: (press: 'stop' | 'undo') => void;
  onSwitch: (channel: Channel) => void;
  onRetry: () => void;
  onBack: () => void;
}) {
  const { yours } = visit;
  const rows = channelRows(visit);
  const saved = rows.find((row) => row.saved);
  const waiting = yours.opening === 'loading';
  const said = waiting
    ? words.loading
    : yours.busy === 'stop' || yours.busy === 'undo'
      ? words.saving
      : saved == null
        ? ''
        : words.savedLine(saved.channel, saved.on);

  return (
    <section className="gp-yours" aria-labelledby="gp-yours-h">
      <KeptOut />
      {yours.from === 'page' && (
        <TextAction ink icon={<Glyph name="back" size={18} weight={2.2} />} onClick={onBack}>
          {words.back}
        </TextAction>
      )}
      <h1 id="gp-yours-h" className="gp-yours-title" tabIndex={-1} data-focus="yoursHead">
        {words.yourMessages}
      </h1>
      {waiting ? (
        <Shapes />
      ) : (
        <>
          <p className="gp-sub">{words.yourMessagesIntro}</p>
          <Lead yours={yours} words={words} onPress={onPress} onRetry={onRetry} />
          <div className="gp-yours-rows" role="group" aria-labelledby="gp-yours-h">
            {rows.map((row) => (
              <Row
                key={row.channel}
                row={row}
                words={words}
                retrying={yours.retrying}
                onSwitch={onSwitch}
                onRetry={onRetry}
              />
            ))}
          </div>
          <p className="gp-small">{words.yourMessagesFoot}</p>
        </>
      )}
      <p className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">
        {said}
      </p>
    </section>
  );
}

function Lead({
  yours,
  words,
  onPress,
  onRetry,
}: {
  yours: Yours;
  words: Words;
  onPress: (press: 'stop' | 'undo') => void;
  onRetry: () => void;
}) {
  if (yours.lead == null) return null;
  const pressing = yours.retrying ? null : yours.busy;

  return (
    <div className="gp-yours-lead">
      {yours.lead === 'button' ? (
        <Filled wraps busy={pressing === 'stop'} focus="stop" onClick={() => onPress('stop')}>
          {words.stopEmails}
        </Filled>
      ) : (
        <div className="gp-yours-done">
          <Mark answer="coming" />
          <div className="gp-yours-done-words">
            <p tabIndex={-1} data-focus="yoursLead">
              {words.lead(yours.lead)}
            </p>
            {yours.lead === 'stopped' && (
              <TextAction busy={pressing === 'undo'} focus="undo" onClick={() => onPress('undo')}>
                {words.undo}
              </TextAction>
            )}
          </div>
        </div>
      )}
      {(yours.failed === 'stop' || yours.failed === 'undo') && (
        <Notice
          kind="broken"
          className="gp-yours-alert"
          action={
            <TextAction busy={yours.retrying} focus="yoursRetry" onClick={onRetry}>
              {words.retry}
            </TextAction>
          }
        >
          {words.saveFailed}
        </Notice>
      )}
    </div>
  );
}

function Row({
  row,
  words,
  retrying,
  onSwitch,
  onRetry,
}: {
  row: ChannelRow;
  words: Words;
  retrying: boolean;
  onSwitch: (channel: Channel) => void;
  onRetry: () => void;
}) {
  const id = (part: string) => `gp-${row.channel}-${part}`;
  const describedBy = [
    row.whatsAppLine && id('line'),
    row.saved && id('saved'),
    row.failed && id('failed'),
  ]
    .filter(Boolean)
    .join(' ');
  const word = row.saving ? 'saving' : row.shown ? 'on' : 'off';

  return (
    <div className="gp-yours-row">
      <div className="gp-yours-words">
        <p id={id('name')} className="gp-yours-name">
          {words.channel(row.channel)}
        </p>
        {!row.has && (
          <p className="gp-yours-line">
            <span className="gp-yours-none" aria-hidden="true" />
            <span>{row.channel === 'email' ? words.noEmail : words.noPhone}</span>
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
        {row.failed && (
          <>
            <p id={id('failed')} className="gp-yours-line is-failed" role="alert">
              <Line name="ringCross" size={15} weight={2.2} />
              <span>{words.saveFailed}</span>
            </p>
            <TextAction busy={retrying} focus={`retry-${row.channel}`} onClick={onRetry}>
              {words.retry}
            </TextAction>
          </>
        )}
      </div>
      {row.has && (
        <label className="gp-switch">
          <span className="gp-switch-word" aria-hidden="true">
            {(['on', 'off', 'saving'] as const).map((one) => (
              <span key={one} className={one === word ? 'gp-switch-say is-shown' : 'gp-switch-say'}>
                {one === 'saving' ? words.saving : words.switchWord(one === 'on')}
              </span>
            ))}
          </span>
          <span className="gp-switch-track">
            <input
              type="checkbox"
              role="switch"
              className="gp-switch-input"
              checked={row.shown}
              data-focus={`switch-${row.channel}`}
              aria-labelledby={id('name')}
              aria-describedby={describedBy === '' ? undefined : describedBy}
              aria-busy={row.saving || undefined}
              onChange={() => onSwitch(row.channel)}
            />
            <span
              className={row.saving ? 'gp-switch-knob is-saving' : 'gp-switch-knob'}
              aria-hidden="true"
            >
              {row.saving && <Spinner size={16} on={row.shown ? 'fill' : 'card'} />}
            </span>
          </span>
        </label>
      )}
    </div>
  );
}

/** Loading: the title at once; the rest waits, since the intro and the footnote name the organisation the page has not read yet. */
function Shapes() {
  return (
    <>
      <span className="gp-skel gp-yours-skel is-intro" />
      <span className="gp-skel gp-yours-skel is-intro-end" />
      <div className="gp-yours-rows" role="group" aria-labelledby="gp-yours-h" aria-busy="true">
        {CHANNELS.map((channel) => (
          <div key={channel} className="gp-yours-row is-waiting">
            <span className="gp-skel gp-yours-skel is-name" />
            <span className="gp-skel gp-yours-skel is-switch" />
          </div>
        ))}
      </div>
      <span className="gp-skel gp-yours-skel is-foot" />
      <span className="gp-skel gp-yours-skel is-foot-end" />
    </>
  );
}
