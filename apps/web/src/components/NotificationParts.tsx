import type { NotificationCategory } from '@soirely/api-client';
import { useId } from 'react';

import type { Channel, RowTag } from '../notificationsPage.ts';
import { offButton } from '../offButton.ts';
import { Glyph, type GlyphName } from './Glyph.tsx';
import { Card, CardStep, Dialog, OnCard, RowWords, Says, Tag } from './SettingsParts.tsx';
import './AccountParts.css';
import './NotificationParts.css';

const LEADS: Record<NotificationCategory, GlyphName> = {
  guest_replies: 'users',
  messages: 'message',
  event_day: 'day',
  event_changes: 'calendar',
  money: 'wallet',
  account_security: 'shield',
};

/** How you hear: the bell, struck through while this browser blocks pushes, and the step to allow them. */
export function HearingCard({
  says,
  summary,
  blocked,
  step,
}: {
  says: string;
  summary: string;
  blocked: string | null;
  step: { label: string; onClick: () => void } | null;
}) {
  return (
    <Card size="person">
      <div>
        <div className="desk-who">
          <span className="desk-disc" aria-hidden="true">
            <Glyph name={blocked == null ? 'bell' : 'bellOff'} size={29} weight={2.2} />
          </span>
          <div className="desk-who-words">
            <Says>{says}</Says>
            <OnCard>{summary}</OnCard>
          </div>
        </div>
        {blocked != null && <p className="account-said">{blocked}</p>}
      </div>
      {step != null && <CardStep label={step.label} onClick={step.onClick} />}
    </Card>
  );
}

export function KindsLoading({ label }: { label: string }) {
  return (
    <div className="desk-loading" role="status" aria-label={label}>
      <span className="desk-unseen">{label}</span>
      <span className="desk-sunk is-card" aria-hidden="true" />
      <ul className="desk-rows account-rows notif-bones" aria-hidden="true">
        {[1, 2, 3, 1, 2, 3].map((bar, index) => (
          <li key={index} className="desk-row is-bones">
            <span className="desk-sunk notif-lead-bone" />
            <span className="desk-row-words">
              <span className={`desk-sunk is-title b${bar}`} />
              <span className={`desk-sunk is-line b${bar}`} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SaveTag({ tag, words }: { tag: RowTag; words: { saving: string; saved: string } }) {
  if (tag === 'saved') return <Tag kind="yes" word={words.saved} />;
  if (tag !== 'saving') return null;

  return (
    <span className="desk-tag is-now notif-saving">
      <span className="notif-spin" aria-hidden="true" />
      {words.saving}
    </span>
  );
}

function SaveFailure({ text, id }: { text: string; id?: string }) {
  return (
    <p id={id} className="desk-error notif-failed" role="alert">
      <Glyph name="alert" size={15} weight={2.2} />
      {text}
    </p>
  );
}

export interface KindSwitch {
  channel: Channel;
  title: string;
  label: string;
  line: string | null;
  on: boolean;
  locked: boolean;
  busy: boolean;
  failure: string | null;
}

/** One kind: its value in words, opening in place, under the Violet rule, to its two switches. */
export function Kind({
  category,
  name,
  value,
  covers,
  open,
  tag,
  failure,
  switches,
  words,
  onToggle,
  onChange,
}: {
  category: NotificationCategory;
  name: string;
  value: string;
  covers: string;
  open: boolean;
  tag: RowTag;
  failure: string | null;
  switches: readonly KindSwitch[];
  words: { on: string; off: string; saving: string; saved: string };
  onToggle: () => void;
  onChange: (channel: Channel, on: boolean) => void;
}) {
  const id = useId();

  return (
    <li>
      <button
        type="button"
        className={open ? 'desk-row account-row is-open' : 'desk-row account-row'}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={onToggle}
      >
        <span className="account-lead" aria-hidden="true">
          <Glyph name={LEADS[category]} size={22} />
        </span>
        <RowWords title={name} tag={<SaveTag tag={tag} words={words} />} lines={[value]} />
        <Glyph
          name={open ? 'chevup' : 'chevdown'}
          size={18}
          weight={2.4}
          className="desk-chevron"
        />
      </button>
      {!open && failure != null && <SaveFailure text={failure} />}
      {open && (
        <div id={id} className="account-open" role="group" aria-label={name}>
          <p id={`${id}-covers`} className="desk-note notif-covers">
            {covers}
          </p>
          <ul className="notif-switches">
            {switches.map((one) => (
              <li key={one.channel}>
                <div className="notif-switch-row">
                  <RowWords title={one.title} lines={one.line == null ? [] : [one.line]} />
                  <OnOff
                    on={one.on}
                    locked={one.locked}
                    busy={one.busy}
                    label={one.label}
                    told={
                      one.failure == null ? `${id}-covers` : `${id}-covers ${id}-${one.channel}`
                    }
                    words={words}
                    onChange={(next) => onChange(one.channel, next)}
                  />
                </div>
                {one.failure != null && (
                  <SaveFailure text={one.failure} id={`${id}-${one.channel}`} />
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </li>
  );
}

function OnOff({
  on,
  locked,
  busy,
  label,
  told,
  words,
  onChange,
}: {
  on: boolean;
  locked: boolean;
  busy: boolean;
  label: string;
  told: string;
  words: { on: string; off: string };
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      className="notif-switch"
      aria-checked={on}
      aria-label={label}
      aria-describedby={told}
      aria-busy={busy}
      {...offButton(locked, { dim: false })}
      onClick={() => {
        if (!busy) onChange(!on);
      }}
    >
      {locked && <Glyph name="lock" size={14} weight={2.4} />}
      <span className="notif-word" aria-hidden="true">
        {on ? words.on : words.off}
      </span>
      <span className="notif-track" aria-hidden="true">
        <span className="notif-knob" />
      </span>
    </button>
  );
}

/** A browser cannot ask again once blocked, so the steps are the reader's. */
export function AllowPushDialog({
  words,
  onDone,
}: {
  words: {
    title: string;
    verb: string;
    intro: string;
    steps: readonly string[];
    elsewhere: string;
  };
  onDone: () => void;
}) {
  return (
    <Dialog
      title={words.title}
      verb={words.verb}
      cancel={false}
      onDismiss={onDone}
      onConfirm={onDone}
    >
      <p className="desk-line is-ink">{words.intro}</p>
      <ol className="notif-steps">
        {words.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <p className="desk-note">{words.elsewhere}</p>
    </Dialog>
  );
}
