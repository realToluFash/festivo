import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';

import { Glyph } from '../components/Glyph.tsx';
import { useDialogKeys } from '../dialogFocus.ts';
import {
  type ScreenPlace,
  SCREEN_PLACES,
  SCREEN_START,
  SHOW_WORDS as W,
  screenAt,
  screenLinkOf,
  screenTime,
} from './roomScreen.ts';
import './showOnScreen.css';

export type ScreensStart = 'list' | 'replace' | 'replaced';

/** sc-3897's Show on a screen: one screen link per place, each with Copy screen link, Open here and Replace link. */
export function ShowOnScreen({ start, onClose }: { start: ScreensStart; onClose: () => void }) {
  const dialog = useRef<HTMLDivElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const [rounds, setRounds] = useState<Partial<Record<ScreenPlace, number>>>(
    start === 'replaced' ? { Ballroom: 1 } : {},
  );
  const [asking, setAsking] = useState<ScreenPlace | null>(start === 'replace' ? 'Ballroom' : null);
  const [said, setSaid] = useState(start === 'replaced' ? W.replacedSaid('Ballroom') : '');

  useDialogKeys(dialog, onClose, false);
  const keep = useRef<HTMLButtonElement>(null);

  useEffect(() => title.current?.focus(), []);
  useEffect(() => {
    if (asking != null) keep.current?.focus();
  }, [asking]);

  function copy(place: ScreenPlace) {
    const done = () => setSaid(W.copied(place));

    if (navigator.clipboard == null) done();
    else navigator.clipboard.writeText(screenLinkOf(place, rounds[place])).then(done, done);
  }

  function replace(place: ScreenPlace) {
    setRounds({ ...rounds, [place]: (rounds[place] ?? 0) + 1 });
    setAsking(null);
    setSaid(W.replacedSaid(place));
  }

  return (
    <>
      <div className="dialog-scrim" aria-hidden="true" onClick={onClose} />
      <div
        ref={dialog}
        className="dialog ss-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ss-title"
        aria-describedby="ss-line"
      >
        <div className="dialog-heading">
          <h2 id="ss-title" ref={title} tabIndex={-1}>
            {W.title}
          </h2>
          <p id="ss-line" className="ss-line">
            {W.line}
          </p>
        </div>
        <ul className="ss-rows">
          {SCREEN_PLACES.map((place) => {
            const round = rounds[place] ?? 0;
            const id = `ss-${place.toLowerCase()}`;

            return (
              <li key={place} className="ss-row" aria-labelledby={id}>
                <div className="ss-what">
                  <h3 id={id} className="ss-place">
                    {place}
                  </h3>
                  <p className="ss-link">{screenLinkOf(place, round)}</p>
                  {round > 0 && (
                    <p className="ss-replaced">
                      <Glyph name="tick" size={15} weight={2.6} />
                      {W.replacedAt(screenTime(SCREEN_START, 'en-GB'))}
                    </p>
                  )}
                </div>
                {asking === place ? (
                  <div className="ss-ask" role="group" aria-labelledby={`${id}-ask`}>
                    <p id={`${id}-ask`} className="ss-ask-title">
                      {W.replaceTitle(place)}
                    </p>
                    <p className="ss-line">{W.replaceBody}</p>
                    <div className="ss-acts">
                      <button
                        type="button"
                        className="link-button"
                        ref={keep}
                        onClick={() => setAsking(null)}
                      >
                        {W.keep}
                      </button>
                      <button
                        type="button"
                        className="gs-pill is-secondary"
                        onClick={() => replace(place)}
                      >
                        {W.replace}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="ss-acts">
                    <button
                      type="button"
                      className="gs-pill is-secondary"
                      onClick={() => copy(place)}
                    >
                      <Glyph name="copy" size={16} weight={2.2} />
                      {W.copy}
                    </button>
                    <Link className="gs-pill is-secondary" to={screenAt(place)}>
                      {W.openHere}
                    </Link>
                    <button
                      type="button"
                      className="gs-pill is-secondary"
                      onClick={() => {
                        setSaid('');
                        setAsking(place);
                      }}
                    >
                      {W.replace}
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        <p className="ss-said" role="status">
          {said !== '' && (
            <>
              <Glyph name="tick" size={17} weight={2.6} />
              {said}
            </>
          )}
        </p>
        <div className="dialog-actions">
          <button type="button" className="gs-pill is-secondary" onClick={onClose}>
            {W.close}
          </button>
        </div>
      </div>
    </>
  );
}
