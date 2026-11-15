import {
  type RefObject,
  useContext,
  useEffect,
  useEffectEvent,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

import { ActionPair } from '../components/ActionPair.tsx';
import { DemoBell } from './DemoBell.tsx';
import { DemoOffline } from './DemoOffline.tsx';
import { offButton } from '../offButton.ts';
import { Glyph } from '../components/Glyph.tsx';
import { choose, useChosenScheme } from './chosenScheme.ts';
import {
  NotSaved,
  PersonalisationFailed,
  PersonalisationLoading,
  SavedMark,
} from '../components/PersonalisationParts.tsx';
import { LayersContext, focusWhenFree, useDeskDialog } from '../layers.ts';
import {
  HOLD_MS,
  LOADING_MS,
  OWN_SCHEME,
  PAGE_ART,
  PERSONALISATION_WORDS as W,
  PREVIEW_ART,
  RETRY_MS,
  type Refusal,
  SAVE_MS,
  SCHEMES,
  SCHEME_ORDER,
  SWATCH_ART,
  type SchemeKey,
  keyStep,
  nextScheme,
  notSaved,
  personalisationStart,
  statusLine,
} from './personalisation.ts';
import { Dots, Ground, Pieces } from './SchemeArt.tsx';
import { TitleRow } from '../components/SettingsParts.tsx';
import type { Tell } from '../components/SettingsParts.tsx';
import { useLater } from '../useLater.ts';

/** Settings › Personalisation at a desk, A · Swatches (Web-Personalisation-*.dc.html): the person's colours, the same for every role. */
export function Personalisation({ state, tell }: { state: string; tell: Tell }) {
  const [start] = useState(() => personalisationStart(state));
  const chosen = useChosenScheme();
  const current = chosen ?? OWN_SCHEME;
  const [load, setLoad] = useState(start.load);
  const [wait, setWait] = useState(LOADING_MS);
  const [pick, setPick] = useState(start.pick);
  const [saving, setSaving] = useState(start.saving);
  const [saved, setSaved] = useState(start.saved);
  const [unsaved, setUnsaved] = useState(start.unsaved);
  const [said, setSaid] = useState('');
  const [keyed, setKeyed] = useState(start.keyed);
  const step = useRef<HTMLButtonElement>(null);
  const later = useLater();

  useLayoutEffect(() => {
    if (start.scheme !== undefined) choose(start.scheme);
  }, [start]);

  function done(to: SchemeKey): void {
    choose(to);
    setSaving(false);
    setPick(null);
    setSaved(true);
    setSaid(W.saved);
    focusWhenFree(() => step.current);
  }

  function save(): void {
    if (pick == null || saving || pick === current) return;

    const to = pick;
    setUnsaved(null);
    setSaving(true);
    setSaid('');
    later(SAVE_MS, () => done(to));
  }

  function open(): void {
    setSaved(false);
    setSaid('');
    setUnsaved(null);
    setPick(current);
  }

  function cancel(): void {
    if (saving) return;

    setPick(null);
    setUnsaved(null);
    focusWhenFree(() => step.current);
  }

  function retry(): void {
    setWait(RETRY_MS);
    setLoad('loading');
  }

  const held = useEffectEvent(() => {
    if (pick != null) done(pick);
  });

  useEffect(() => {
    if (!start.saving) return;
    const timer = setTimeout(held, HOLD_MS);

    return () => clearTimeout(timer);
  }, [start.saving]);

  useEffect(() => {
    if (load !== 'loading') return;
    const timer = setTimeout(() => setLoad('loaded'), wait);

    return () => clearTimeout(timer);
  }, [load, wait]);

  useEffect(() => {
    if (start.step) step.current?.focus();
  }, [start.step]);

  useEffect(() => {
    if (!keyed) return;
    const off = () => setKeyed(false);
    document.addEventListener('pointerdown', off);

    return () => document.removeEventListener('pointerdown', off);
  }, [keyed]);

  return (
    <div className={keyed ? 'desk-page pers is-keyed' : 'desk-page pers'}>
      <div className="desk-column">
        <DemoOffline />
        <TitleRow title={W.title} bell={<DemoBell tell={tell} />} />
        {load === 'loading' && <PersonalisationLoading words={W.loading} />}
        {load === 'failed' && (
          <PersonalisationFailed
            title={W.couldNotLoad}
            line={W.check}
            retry={W.tryAgain}
            onRetry={retry}
          />
        )}
        {load === 'loaded' && (
          <>
            <PageCard
              scheme={current}
              line={saved ? 'saved' : chosen == null ? 'never' : 'chosen'}
              step={step}
              onChoose={open}
            />
            <div className="pers-after">
              <p className="desk-note">{W.follow}</p>
              <p className="desk-note">{W.keeps}</p>
            </div>
          </>
        )}
        <p className="desk-unseen" aria-live="polite">
          {said}
        </p>
      </div>
      {pick != null && (
        <Colours
          current={current}
          pick={pick}
          saving={saving}
          unsaved={unsaved}
          keyed={keyed}
          onPick={(key) => {
            setPick(key);
            setUnsaved(null);
          }}
          onCancel={cancel}
          onSave={save}
        />
      )}
    </div>
  );
}

/** The card in the person's colours: what they see, the line under it, the scheme's dots and the one step. */
function PageCard({
  scheme,
  line,
  step,
  onChoose,
}: {
  scheme: SchemeKey;
  line: 'never' | 'chosen' | 'saved';
  step: RefObject<HTMLButtonElement | null>;
  onChoose: () => void;
}) {
  const { name, dark } = SCHEMES[scheme];

  return (
    <div
      className={dark ? 'desk-card pers-card is-dark' : 'desk-card pers-card'}
      role="group"
      aria-label={W.card(name)}
    >
      <Ground scheme={scheme} wash />
      <Pieces scheme={scheme} art={PAGE_ART} />
      <div className="desk-card-inner">
        <p className="desk-says pers-says">{W.says(name)}</p>
        {line === 'saved' ? (
          <p className="pers-done">
            <SavedMark />
            {W.saved}
          </p>
        ) : (
          <p className="desk-on-card">{line === 'never' ? W.never : W.chosen}</p>
        )}
        <Dots scheme={scheme} size={24} />
        <button ref={step} type="button" className="desk-step pers-step" onClick={onChoose}>
          {W.choose}
          <Glyph name="arrow" size={16} weight={2.4} />
        </button>
      </div>
    </div>
  );
}

interface ColoursProps {
  current: SchemeKey;
  pick: SchemeKey;
  saving: boolean;
  unsaved: Refusal | null;
  keyed: boolean;
  onPick: (key: SchemeKey) => void;
  onCancel: () => void;
  onSave: () => void;
}

function Colours(props: ColoursProps) {
  const { host } = useContext(LayersContext);

  return host == null ? null : createPortal(<ColoursBox {...props} />, host);
}

/** Colours, a 540 dialog: the pick on its own card, then the eight swatches as one radio group the arrow keys move through. */
function ColoursBox({
  current,
  pick,
  saving,
  unsaved,
  keyed,
  onPick,
  onCancel,
  onSave,
}: ColoursProps) {
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  const first = useRef<HTMLElement | null>(null);
  const verb = useRef<HTMLButtonElement>(null);
  const radios = useRef(new Map<SchemeKey, HTMLElement>());
  const [opened] = useState(pick);
  const covered = useDeskDialog(box, first, onCancel, saving);

  function move(to: SchemeKey): void {
    if (saving) return;

    onPick(to);
    radios.current.get(to)?.focus();
  }

  function again(): void {
    verb.current?.focus();
    onSave();
  }

  return (
    <>
      <div className="dialog-scrim" aria-hidden="true" />
      <div
        ref={box}
        className={keyed ? 'desk-dialog pers-dialog is-keyed' : 'desk-dialog pers-dialog'}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        tabIndex={-1}
        inert={covered}
      >
        <ActionPair
          className="desk-nav"
          dismiss={
            <button
              type="button"
              className={saving ? 'desk-nav-cancel pers-waits' : 'desk-nav-cancel'}
              {...offButton(saving, { dim: false })}
              onClick={onCancel}
            >
              {W.cancel}
            </button>
          }
          between={
            <h2 id={`${id}-title`} className="desk-nav-title">
              {W.dialog}
            </h2>
          }
          confirm={
            <button
              ref={verb}
              type="button"
              className={[
                'desk-nav-verb',
                saving && 'pers-saving',
                !saving && pick === current && 'is-off',
              ]
                .filter(Boolean)
                .join(' ')}
              aria-busy={saving || undefined}
              {...offButton(saving || pick === current, { dim: false })}
              onClick={onSave}
            >
              {saving && <span className="pers-spin" aria-hidden="true" />}
              {saving ? W.saving : W.save}
            </button>
          }
        />
        <div className="desk-dialog-body">
          <p className="desk-line is-ink">{W.lead}</p>
          <div className="pers-pick">
            <Preview scheme={pick} />
            {unsaved == null ? (
              <p className="desk-note" role="status">
                {statusLine(pick, current)}
              </p>
            ) : (
              <NotSaved
                words={notSaved(unsaved, pick, current)}
                retry={W.tryAgain}
                onRetry={again}
              />
            )}
          </div>
          <div
            className={saving ? 'pers-swatches is-still' : 'pers-swatches'}
            role="radiogroup"
            aria-label={W.dialog}
            aria-disabled={saving || undefined}
          >
            {SCHEME_ORDER.map((key) => (
              <Swatch
                key={key}
                scheme={key}
                picked={key === pick}
                current={key === current}
                onRef={(node) => {
                  if (node == null) radios.current.delete(key);
                  else radios.current.set(key, node);
                  if (key === opened) first.current = node;
                }}
                onPick={() => move(key)}
                onStep={(by) => move(nextScheme(key, by))}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function Preview({ scheme }: { scheme: SchemeKey }) {
  const { name, on } = SCHEMES[scheme];

  return (
    <div className="pers-preview" role="img" aria-label={W.preview(name)}>
      <Ground scheme={scheme} wash />
      <Pieces scheme={scheme} art={PREVIEW_ART} />
      <span className="pers-preview-inner">
        <svg className="pers-preview-name" aria-hidden="true" focusable="false">
          <text x="0" y="20" fill={on}>
            {name}
          </text>
        </svg>
        <Dots scheme={scheme} size={20} />
      </span>
    </div>
  );
}

function Swatch({
  scheme,
  picked,
  current,
  onRef,
  onPick,
  onStep,
}: {
  scheme: SchemeKey;
  picked: boolean;
  current: boolean;
  onRef: (node: HTMLElement | null) => void;
  onPick: () => void;
  onStep: (by: 1 | -1) => void;
}) {
  const { name } = SCHEMES[scheme];

  return (
    <div
      ref={onRef}
      className={picked ? 'pers-swatch is-picked' : 'pers-swatch'}
      role="radio"
      aria-checked={picked}
      aria-label={W.swatch(name, current)}
      tabIndex={picked ? 0 : -1}
      onClick={onPick}
      onKeyDown={(event) => {
        const by = keyStep(event.key);
        if (by == null && event.key !== ' ') return;

        event.preventDefault();
        if (by == null) onPick();
        else onStep(by);
      }}
    >
      <span className="pers-mesh" aria-hidden="true">
        <Ground scheme={scheme} wash={false} />
        <Pieces scheme={scheme} art={SWATCH_ART} />
      </span>
      {current && (
        <span className="pers-current" aria-hidden="true">
          <span className="desk-mark is-yes">
            <Glyph name="tick" size={9} weight={3.4} />
          </span>
          {W.current}
        </span>
      )}
      <span className="pers-swatch-row" aria-hidden="true">
        <span className={picked ? 'pers-radio is-on' : 'pers-radio'} />
        <span className="pers-swatch-name">{name}</span>
      </span>
    </div>
  );
}
