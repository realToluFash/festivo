import type { NotificationSetting } from '@soirely/api-client';
import { formattingLocale, settingFlipped } from '@soirely/domain';
import { useEffect, useEffectEvent, useId, useMemo, useRef, useState } from 'react';

import { offButton } from '../offButton.ts';
import { Glyph, type GlyphName } from './Glyph.tsx';
import {
  ALLOW_WORDS as A,
  CATEGORY_NAMES,
  CHANNELS,
  type Category,
  type Channel,
  HOLD_MS,
  LOADING_MS,
  NOTIFICATION_WORDS as W,
  RETRY_MS,
  SAVE_MS,
  type Switch,
  cardOf,
  coversLine,
  keyOf,
  notSaved,
  notificationsStart,
  quietHoursLine,
  rowValue,
  sameSwitch,
  switchName,
} from './notifications.ts';
import {
  Card,
  CardStep,
  Dialog,
  Head,
  OnCard,
  RowWords,
  Says,
  Tag,
  TextAction,
  TitleRow,
} from './SettingsParts.tsx';
import type { Tell } from './TodayParts.tsx';
import './account.css';
import './notifications.css';

const LEADS: Record<Category, GlyphName> = {
  guest_replies: 'users',
  messages: 'message',
  event_day: 'today',
  event_changes: 'calendar',
  money: 'wallet',
  account_security: 'shield',
};

/** Notification settings at a desk in B · Summary first (Web-Notifications-*.dc.html): the app's page, the same for every role. */
export function Notifications({ state, tell }: { state: string; tell: Tell }) {
  const locale = useMemo(() => formattingLocale('en', navigator.language), []);
  const [start] = useState(() => notificationsStart(state));
  const [load, setLoad] = useState(start.load);
  const [settings, setSettings] = useState(start.settings);
  const [open, setOpen] = useState(start.open);
  const [saving, setSaving] = useState<readonly string[]>(
    start.saving == null ? [] : [keyOf(start.saving)],
  );
  const [saved, setSaved] = useState(start.saved);
  const [unsaved, setUnsaved] = useState(start.unsaved);
  const [said, setSaid] = useState('');
  const [allow, setAllow] = useState(start.allow);
  const [wait, setWait] = useState(LOADING_MS);
  const later = useTimers();
  const column = useRef<HTMLDivElement>(null);

  function finish(one: Switch, on: boolean): void {
    const refused = sameSwitch(start.refuses, one);
    if (refused) setSettings((now) => settingFlipped(now, one.category, one.channel, !on));
    setUnsaved(refused ? one : null);
    setSaved(refused ? null : one.category);
    setSaid(refused ? '' : W.savedSaid);
    setSaving((now) => now.filter((key) => key !== keyOf(one)));
  }

  function change(one: Switch, on: boolean): void {
    if (saving.includes(keyOf(one))) return;

    setSettings((now) => settingFlipped(now, one.category, one.channel, on));
    setSaving((now) => [...now, keyOf(one)]);
    setUnsaved(null);
    setSaid('');
    later(SAVE_MS, () => finish(one, on));
  }

  function toggle(category: Category): void {
    if (open !== category) setSaved(null);
    setOpen((now) => (now === category ? null : category));
  }

  function retry(): void {
    setWait(RETRY_MS);
    setLoad('loading');
  }

  const held = useEffectEvent((one: Switch) => finish(one, false));

  useEffect(() => {
    if (load !== 'loading') return;
    const timer = setTimeout(() => setLoad('loaded'), wait);

    return () => clearTimeout(timer);
  }, [load, wait]);

  useEffect(() => {
    if (start.saving == null) return;
    const one = start.saving;
    const timer = setTimeout(() => held(one), HOLD_MS);

    return () => clearTimeout(timer);
  }, [start.saving]);

  useEffect(() => {
    if (start.open == null) return;
    const opened = column.current?.querySelector('.account-open');
    if (opened != null && 'scrollIntoView' in opened) opened.scrollIntoView({ block: 'center' });
  }, [start.open]);

  const card = cardOf(settings);

  return (
    <div className="desk-page">
      <div ref={column} className="desk-column">
        <TitleRow title={W.title} tell={tell} />
        {load === 'loading' && <Loading />}
        {load === 'failed' && (
          <div className="desk-failed" role="alert">
            <h2>{W.couldNotLoad}</h2>
            <p className="desk-line">{W.check}</p>
            <TextAction label={W.tryAgain} onClick={retry} />
          </div>
        )}
        {load === 'loaded' && (
          <>
            <Card size="person">
              <div>
                <div className="desk-who">
                  <span className="desk-disc" aria-hidden="true">
                    <Glyph name={start.blocked ? 'bellOff' : 'bell'} size={29} weight={2.2} />
                  </span>
                  <div className="desk-who-words">
                    <Says>{card.says}</Says>
                    <OnCard>{card.summary}</OnCard>
                  </div>
                </div>
                {start.blocked && <p className="account-said">{W.blockedLine}</p>}
              </div>
              {start.blocked && <CardStep label={W.allow} onClick={() => setAllow(true)} />}
            </Card>
            <section className="desk-block">
              <Head title={W.head} />
              <ul className="desk-rows account-rows">
                {settings.map((setting) => (
                  <Kind
                    key={setting.category}
                    setting={setting}
                    locale={locale}
                    on={open === setting.category}
                    tag={tagOf(setting.category, saving, saved)}
                    unsaved={unsaved?.category === setting.category ? unsaved.channel : null}
                    blocked={start.blocked}
                    busy={saving}
                    onToggle={() => toggle(setting.category)}
                    onChange={change}
                  />
                ))}
              </ul>
              <p className="desk-foot">{quietHoursLine(locale)}</p>
            </section>
            <p className="desk-unseen" aria-live="polite">
              {said}
            </p>
          </>
        )}
      </div>
      {allow && (
        <Dialog
          title={A.title}
          verb={A.verb}
          cancel={false}
          onDismiss={() => setAllow(false)}
          onConfirm={() => setAllow(false)}
        >
          <p className="desk-line is-ink">{A.intro}</p>
          <ol className="notif-steps">
            {A.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <p className="desk-note">{A.elsewhere}</p>
        </Dialog>
      )}
    </div>
  );
}

type RowTag = 'saving' | 'saved' | null;

function tagOf(category: Category, saving: readonly string[], saved: Category | null): RowTag {
  if (CHANNELS.some((channel) => saving.includes(keyOf({ category, channel })))) return 'saving';

  return saved === category ? 'saved' : null;
}

function useTimers(): (ms: number, then: () => void) => void {
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const held = timers.current;

    return () => held.forEach((timer) => clearTimeout(timer));
  }, []);

  return (ms, then) => {
    const timer = setTimeout(() => {
      timers.current.delete(timer);
      then();
    }, ms);
    timers.current.add(timer);
  };
}

function Loading() {
  return (
    <div className="desk-loading" role="status" aria-label={W.loading}>
      <span className="desk-unseen">{W.loading}</span>
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

function RowTagView({ tag }: { tag: RowTag }) {
  if (tag === 'saved') return <Tag kind="yes" word={W.saved} />;
  if (tag !== 'saving') return null;

  return (
    <span className="desk-tag is-now notif-saving">
      <span className="notif-spin" aria-hidden="true" />
      {W.saving}
    </span>
  );
}

function Failure({ channel, id }: { channel: Channel; id?: string }) {
  return (
    <p id={id} className="desk-error notif-failed" role="alert">
      <Glyph name="alert" size={15} weight={2.2} />
      {notSaved(channel)}
    </p>
  );
}

/** One kind: its value in words, opening in place, under the Violet rule, to its two switches. */
function Kind({
  setting,
  locale,
  on,
  tag,
  unsaved,
  blocked,
  busy,
  onToggle,
  onChange,
}: {
  setting: NotificationSetting;
  locale: string;
  on: boolean;
  tag: RowTag;
  unsaved: Channel | null;
  blocked: boolean;
  busy: readonly string[];
  onToggle: () => void;
  onChange: (one: Switch, on: boolean) => void;
}) {
  const id = useId();
  const { category } = setting;
  const name = CATEGORY_NAMES[category];

  return (
    <li>
      <button
        type="button"
        className={on ? 'desk-row account-row is-open' : 'desk-row account-row'}
        aria-expanded={on}
        aria-controls={on ? id : undefined}
        onClick={onToggle}
      >
        <span className="account-lead" aria-hidden="true">
          <Glyph name={LEADS[category]} size={22} />
        </span>
        <RowWords title={name} tag={<RowTagView tag={tag} />} lines={[rowValue(setting)]} />
        <Glyph name={on ? 'chevup' : 'chevdown'} size={18} weight={2.4} className="desk-chevron" />
      </button>
      {!on && unsaved != null && <Failure channel={unsaved} />}
      {on && (
        <div id={id} className="account-open" role="group" aria-label={name}>
          <p id={`${id}-covers`} className="desk-note notif-covers">
            {coversLine(setting, locale)}
          </p>
          <ul className="notif-switches">
            {CHANNELS.map((channel) => {
              const locked = !setting[channel].switchable;
              const line = locked ? W.locked : channel === 'push' && blocked ? W.blockedHere : null;
              const failed = unsaved === channel;

              return (
                <li key={channel}>
                  <div className="notif-switch-row">
                    <RowWords
                      title={channel === 'push' ? W.push : W.email}
                      lines={line == null ? [] : [line]}
                    />
                    <OnOff
                      on={setting[channel].on}
                      locked={locked}
                      busy={busy.includes(keyOf({ category, channel }))}
                      label={switchName(category, channel)}
                      told={failed ? `${id}-covers ${id}-${channel}` : `${id}-covers`}
                      onChange={(next) => onChange({ category, channel }, next)}
                    />
                  </div>
                  {failed && <Failure channel={channel} id={`${id}-${channel}`} />}
                </li>
              );
            })}
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
  onChange,
}: {
  on: boolean;
  locked: boolean;
  busy: boolean;
  label: string;
  told: string;
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
        {on ? W.on : W.off}
      </span>
      <span className="notif-track" aria-hidden="true">
        <span className="notif-knob" />
      </span>
    </button>
  );
}
