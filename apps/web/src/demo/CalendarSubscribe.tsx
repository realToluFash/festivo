import { useContext, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { ActionPair } from '../components/ActionPair.tsx';
import { type Feed, FEED_LINK, FEED_WORDS as F, NEW_FEED_LINK } from './calendar.ts';
import { BrokenLine } from './CalendarWeeks.tsx';
import { Glyph } from './Glyph.tsx';
import { LayersContext, useDeskDialog } from './layers.ts';
import { useWhere } from './switcher.ts';

/** main's Subscribe panel (sc-3626) in a desk dialog, on the sample's link: nothing is sent, and the demo's refused copy is always refused. */
export function CalendarSubscribe({ start, onClose }: { start: Feed; onClose: () => void }) {
  const { host } = useContext(LayersContext);

  return host == null ? null : createPortal(<SubscribeBox start={start} onClose={onClose} />, host);
}

function SubscribeBox({ start, onClose }: { start: Feed; onClose: () => void }) {
  const id = useId();
  const where = useWhere();
  const organisation = where.places.find((place) => place.id === where.current)?.name ?? '';
  const box = useRef<HTMLDivElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const [link, setLink] = useState(FEED_LINK);
  const [confirming, setConfirming] = useState(start === 'reset');
  const [copied, setCopied] = useState(false);
  const [refused, setRefused] = useState(start === 'refused');
  const [renewed, setRenewed] = useState(false);
  const [said, setSaid] = useState('');
  const [chosen, setChosen] = useState(start === 'refused' ? 1 : 0);
  const [opened, setOpened] = useState(false);
  const back = useRef(false);
  const resetOpen = useRef<HTMLButtonElement>(null);

  useDeskDialog(box, close, confirming ? keep : onClose);

  useEffect(() => {
    if (chosen === 0) return;

    field.current?.focus();
    field.current?.select();
  }, [chosen]);

  useEffect(() => {
    if (confirming) title.current?.focus();
    else if (back.current) resetOpen.current?.focus();
    back.current = false;
  }, [confirming]);

  async function copy(): Promise<void> {
    try {
      if (start === 'refused') throw new Error('refused');
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setRefused(false);
      setSaid(F.copiedAnnounce);
    } catch {
      setRefused(true);
      setChosen((times) => times + 1);
    }
  }

  function keep(): void {
    setConfirming(false);
    setSaid(F.kept);
    back.current = true;
  }

  function reset(): void {
    setLink(NEW_FEED_LINK);
    setConfirming(false);
    setRenewed(true);
    setCopied(false);
    setRefused(false);
    setSaid('');
    setChosen((times) => times + 1);
  }

  return (
    <>
      <div className="dialog-scrim" aria-hidden="true" />
      <div
        ref={box}
        className="desk-dialog cal-feed"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
      >
        <div className="cal-feed-head">
          <h2 id={`${id}-title`} ref={title} tabIndex={-1}>
            {confirming ? F.confirmTitle : F.open}
          </h2>
          <button
            ref={close}
            type="button"
            className="cal-round"
            aria-label={F.close}
            onClick={onClose}
          >
            <Glyph name="clear" size={19} weight={2.3} />
          </button>
        </div>
        <div className="cal-feed-body">
          {confirming ? (
            <>
              <p className="cal-feed-intro">{F.confirmBody}</p>
              <ActionPair
                className="cal-feed-pair"
                dismiss={
                  <button type="button" className="cal-feed-button" onClick={keep}>
                    {F.keep}
                  </button>
                }
                confirm={
                  <button type="button" className="cal-feed-button is-red" onClick={reset}>
                    {F.reset}
                  </button>
                }
              />
            </>
          ) : (
            <>
              <p className="cal-feed-intro">{F.intro(organisation)}</p>
              <div className="cal-feed-link">
                <label htmlFor={`${id}-link`}>{F.linkLabel}</label>
                <textarea
                  ref={field}
                  id={`${id}-link`}
                  className="cal-feed-url"
                  value={link}
                  readOnly
                  rows={2}
                  spellCheck={false}
                  aria-describedby={`${id}-private`}
                  onFocus={(event) => event.target.select()}
                />
              </div>
              {renewed && (
                <p className="cal-feed-new">
                  <span className="cal-feed-disc is-in" aria-hidden="true">
                    <Glyph name="tick" size={13} weight={3} />
                  </span>
                  {F.newLink}
                </p>
              )}
              {refused && <BrokenLine words={F.copyRefused} />}
              <div className="cal-feed-buttons">
                <button
                  type="button"
                  className="cal-feed-button is-primary"
                  onClick={() => void copy()}
                >
                  <Glyph name={copied ? 'tick' : 'copy'} size={18} weight={2.2} />
                  {copied ? F.copied : F.copy}
                </button>
                <button type="button" className="cal-feed-button" onClick={() => setOpened(true)}>
                  <Glyph name="calendar" size={18} weight={2.2} />
                  {F.openInApp}
                </button>
              </div>
              {opened && (
                <p className="cal-feed-line" role="status">
                  {F.openedInApp}
                </p>
              )}
              <p id={`${id}-private`} className="cal-feed-private">
                <Glyph name="shield" size={18} weight={2.1} />
                {F.private}
              </p>
              <hr className="cal-feed-rule" />
              <div className="cal-feed-lists">
                <FeedList title={F.inTitle} lines={F.inFeed} has />
                <FeedList title={F.outTitle} lines={F.neverInFeed} has={false} />
              </div>
              <p className="cal-feed-line">{F.access}</p>
              <hr className="cal-feed-rule" />
              <div className="cal-feed-reset">
                <h3>{F.resetTitle}</h3>
                <p className="cal-feed-line">{F.resetBody}</p>
                <button
                  ref={resetOpen}
                  type="button"
                  className="cal-feed-button is-reset"
                  onClick={() => {
                    setSaid('');
                    setConfirming(true);
                  }}
                >
                  {F.resetOpen}
                </button>
              </div>
            </>
          )}
        </div>
        <p className="visually-hidden" role="status">
          {said}
        </p>
      </div>
    </>
  );
}

function FeedList({
  title,
  lines,
  has,
}: {
  title: string;
  lines: readonly string[];
  has: boolean;
}) {
  const id = useId();

  return (
    <section className="cal-feed-list" aria-labelledby={id}>
      <h3 id={id}>{title}</h3>
      <ul>
        {lines.map((line) => (
          <li key={line}>
            <span className={has ? 'cal-feed-disc is-in' : 'cal-feed-disc'} aria-hidden="true">
              <Glyph name={has ? 'tick' : 'clear'} size={has ? 13 : 12} weight={3} />
            </span>
            {line}
          </li>
        ))}
      </ul>
    </section>
  );
}
