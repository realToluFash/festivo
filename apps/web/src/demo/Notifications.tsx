import { DemoBell } from './DemoBell.tsx';
import { formattingLocale, settingFlipped } from '@soirely/domain';
import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';

import {
  AllowPushDialog,
  HearingCard,
  Kind,
  KindsLoading,
} from '../components/NotificationParts.tsx';
import { CHANNELS, keyOf, tagOf } from '../notificationsPage.ts';
import {
  ALLOW_WORDS as A,
  CATEGORY_NAMES,
  type Category,
  HOLD_MS,
  LOADING_MS,
  NOTIFICATION_WORDS as W,
  RETRY_MS,
  SAVE_MS,
  type Switch,
  cardOf,
  coversLine,
  notSaved,
  notificationsStart,
  quietHoursLine,
  rowValue,
  sameSwitch,
  switchName,
} from './notifications.ts';
import { Head, TextAction, TitleRow } from '../components/SettingsParts.tsx';
import type { Tell } from '../components/SettingsParts.tsx';

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
        <TitleRow title={W.title} bell={<DemoBell tell={tell} />} />
        {load === 'loading' && <KindsLoading label={W.loading} />}
        {load === 'failed' && (
          <div className="desk-failed" role="alert">
            <h2>{W.couldNotLoad}</h2>
            <p className="desk-line">{W.check}</p>
            <TextAction label={W.tryAgain} onClick={retry} />
          </div>
        )}
        {load === 'loaded' && (
          <>
            <HearingCard
              says={card.says}
              summary={card.summary}
              blocked={start.blocked ? W.blockedLine : null}
              step={start.blocked ? { label: W.allow, onClick: () => setAllow(true) } : null}
            />
            <section className="desk-block">
              <Head title={W.head} />
              <ul className="desk-rows account-rows">
                {settings.map((setting) => {
                  const { category } = setting;
                  const failed = unsaved?.category === category ? unsaved.channel : null;

                  return (
                    <Kind
                      key={category}
                      category={category}
                      name={CATEGORY_NAMES[category]}
                      value={rowValue(setting)}
                      covers={coversLine(setting, locale)}
                      open={open === category}
                      tag={tagOf(category, saving, saved)}
                      failure={failed == null ? null : notSaved(failed)}
                      switches={CHANNELS.map((channel) => {
                        const locked = !setting[channel].switchable;

                        return {
                          channel,
                          title: channel === 'push' ? W.push : W.email,
                          label: switchName(category, channel),
                          line: locked
                            ? W.locked
                            : channel === 'push' && start.blocked
                              ? W.blockedHere
                              : null,
                          on: setting[channel].on,
                          locked,
                          busy: saving.includes(keyOf({ category, channel })),
                          failure: failed === channel ? notSaved(channel) : null,
                        };
                      })}
                      words={{ on: W.on, off: W.off, saving: W.saving, saved: W.saved }}
                      onToggle={() => toggle(category)}
                      onChange={(channel, on) => change({ category, channel }, on)}
                    />
                  );
                })}
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
        <AllowPushDialog
          words={{
            title: A.title,
            verb: A.verb,
            intro: A.intro,
            steps: A.steps,
            elsewhere: A.elsewhere,
          }}
          onDone={() => setAllow(false)}
        />
      )}
    </div>
  );
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
