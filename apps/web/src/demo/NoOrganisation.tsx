import { useEffect, useId, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';

import { Brand } from '../components/Brand.tsx';
import { Toast } from '../components/Toast.tsx';
import { CreateWalk } from './CreateOrg.tsx';
import { NO_ORG_WORDS as W, type Walk, freshWalk, isCreateState, walkOf } from './createOrg.ts';
import { Glyph } from '../components/Glyph.tsx';
import { LayersContext, focusWhenFree, useDeskLayers } from '../layers.ts';
import { SAMPLE } from './rules.ts';
import { NEW_PLACE, create } from './switcher.ts';
import '../components/SettingsParts.css';
import './settings.css';
import './createOrg.css';

/** main's NoOrganisation, alone under the public header in B's desk look with no card (CreateOrg-B-Walk-Web, page 29). */
export function NoOrganisation() {
  const id = useId();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { layers, covered, setHost } = useDeskLayers();
  const [walk, setWalk] = useState<Walk | null>(() => {
    const raw = params.get('create');

    return isCreateState(raw) ? walkOf(raw) : null;
  });
  const [told, setTold] = useState<string | null>(null);
  const [opensOn] = useState(walk == null);
  const start = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (opensOn) start.current?.focus();
  }, [opensOn]);

  return (
    <LayersContext value={layers}>
      <div className="cw-alone desk">
        <header className="cw-header" inert={covered}>
          <Brand lockup />
          <button
            type="button"
            className="cw-language"
            onClick={() => setTold('Choosing a language has its own design.')}
          >
            <Glyph name="globe" size={16} />
            {W.language}
          </button>
        </header>
        <main id="content" className="cw-none" inert={covered}>
          <h1>{W.title}</h1>
          <p className="cw-none-body">{W.body}</p>
          <p className="cw-none-body is-quiet">{W.wayOn(SAMPLE.email)}</p>
          <section className="cw-start" aria-labelledby={`${id}-start`}>
            <span className="cw-start-tile" aria-hidden="true">
              <Glyph name="plus" size={20} weight={2.4} />
            </span>
            <h2 id={`${id}-start`}>{W.startTitle}</h2>
            <p>{W.startBody}</p>
            <button
              ref={start}
              type="button"
              className="cw-start-button"
              onClick={() => setWalk(freshWalk())}
            >
              {W.start}
            </button>
          </section>
          <div className="cw-signed">
            <p>{W.signedInAs(SAMPLE.email)}</p>
            <div className="cw-signed-ways">
              <Link className="desk-text" to="/demo/settings/account">
                {W.account}
              </Link>
              <Link className="desk-text" to="/demo/sign-in?state=signed-out">
                {W.signOut}
              </Link>
            </div>
          </div>
        </main>
        <div ref={setHost} className="desk-layers" />
        {walk != null && (
          <CreateWalk
            start={walk}
            onClose={() => {
              setWalk(null);
              focusWhenFree(() => start.current);
            }}
            onCreated={() => {
              create(NEW_PLACE, '/demo/today', true);
              void navigate('/demo/today', { replace: true });
            }}
          />
        )}
        {told != null && <Toast key={told} words={told} onClose={() => setTold(null)} />}
      </div>
    </LayersContext>
  );
}
