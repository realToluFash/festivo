import { ApiUnreachableError } from '@soirely/api-client';
import { type RefObject, useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../../../api.ts';
import {
  followAccountScheme,
  keyStep,
  nextScheme,
  savedScheme,
  schemeIn,
  schemeName,
  useColourScheme,
} from '../../../colourScheme.ts';
import { AccountHeader } from '../../../components/AccountHeader.tsx';
import { ActionPair } from '../../../components/ActionPair.tsx';
import { Glyph } from '../../../components/Glyph.tsx';
import { Dots, Ground, Pieces } from '../../../components/SchemeArt.tsx';
import {
  NotSaved,
  PersonalisationFailed,
  PersonalisationLoading,
  SavedMark,
} from '../../../components/PersonalisationParts.tsx';
import { TitleRow } from '../../../components/SettingsParts.tsx';
import { useDialogKeys } from '../../../dialogFocus.ts';
import { offButton } from '../../../offButton.ts';
import { usePhoneWidth } from '../../../phoneWidth.ts';
import { PAGE_ART, PREVIEW_ART, SWATCH_ART, isLightGround } from '../../../schemeArt.ts';
import { type Scheme, confetti, defaultScheme, schemeNames } from '../../../scheme.ts';

type Refusal = 'failed' | 'offline';

/** Settings › Personalisation (sc-30441): the colours Soirely shows this person, on every device they sign in on. */
export function Personalisation() {
  const { t } = useTranslation();
  const phone = usePhoneWidth();
  const { shown, chosen } = useColourScheme();
  const [load, setLoad] = useState<'loading' | 'failed' | 'loaded'>(
    chosen === undefined ? 'loading' : 'loaded',
  );
  const [attempt, setAttempt] = useState(0);
  const [pick, setPick] = useState<Scheme | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [unsaved, setUnsaved] = useState<Refusal | null>(null);
  const [said, setSaid] = useState('');
  const step = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (load !== 'loading') return;
    let current = true;

    api.request<unknown>('/api/auth/me').then(
      (answer) => {
        followAccountScheme(schemeIn(answer));
        if (current) setLoad('loaded');
      },
      () => {
        if (current) setLoad('failed');
      },
    );

    return () => {
      current = false;
    };
  }, [load, attempt]);

  function open(): void {
    setSaved(false);
    setSaid('');
    setUnsaved(null);
    setPick(shown);
  }

  function close(): void {
    setPick(null);
    setUnsaved(null);
    step.current?.focus();
  }

  async function save(): Promise<void> {
    if (pick == null || saving || pick === shown) return;

    setUnsaved(null);
    setSaving(true);
    setSaid('');
    try {
      savedScheme(
        await api
          .request('/api/auth/colour-scheme', {
            method: 'PUT',
            body: { colourScheme: pick },
          })
          .then((answer) => schemeIn(answer) ?? pick),
      );
    } catch (error) {
      setSaving(false);
      setUnsaved(error instanceof ApiUnreachableError ? 'offline' : 'failed');
      return;
    }

    setSaving(false);
    setSaved(true);
    setSaid(t('personalisation.saved'));
    close();
  }

  return (
    <div className="desk account personalisation">
      {phone ? (
        <AccountHeader title={t('personalisation.title')} />
      ) : (
        <TitleRow title={t('personalisation.title')} />
      )}

      <div className="visually-hidden" aria-live="polite">
        {said}
      </div>

      {load === 'loading' && <PersonalisationLoading words={t('personalisation.loading')} />}

      {load === 'failed' && (
        <PersonalisationFailed
          title={t('personalisation.couldNotLoad')}
          line={t('personalisation.check')}
          retry={t('personalisation.tryAgain')}
          onRetry={() => {
            setLoad('loading');
            setAttempt((tries) => tries + 1);
          }}
        />
      )}

      {load === 'loaded' && (
        <>
          <PageCard
            scheme={shown}
            line={saved ? 'saved' : chosen == null ? 'never' : 'chosen'}
            step={step}
            onChoose={open}
          />
          <div className="personalisation-after">
            <p>{t('personalisation.follow')}</p>
            <p>{t('personalisation.keeps')}</p>
          </div>
        </>
      )}

      {pick != null && (
        <Colours
          current={shown}
          pick={pick}
          saving={saving}
          unsaved={unsaved}
          onPick={(scheme) => {
            setPick(scheme);
            setUnsaved(null);
          }}
          onCancel={() => {
            if (!saving) close();
          }}
          onSave={() => void save()}
        />
      )}
    </div>
  );
}

function PageCard({
  scheme,
  line,
  step,
  onChoose,
}: {
  scheme: Scheme;
  line: 'never' | 'chosen' | 'saved';
  step: RefObject<HTMLButtonElement | null>;
  onChoose: () => void;
}) {
  const { t } = useTranslation();
  const name = schemeName(t, scheme);

  return (
    <div
      className={isLightGround(scheme) ? 'personalisation-card is-light' : 'personalisation-card'}
      role="group"
      aria-label={t('personalisation.card', { name })}
    >
      <Ground scheme={scheme} wash />
      <Pieces scheme={scheme} art={PAGE_ART} />
      <div className="personalisation-card-inner">
        <p className="personalisation-says">{t('personalisation.says', { name })}</p>
        {line === 'saved' ? (
          <p className="personalisation-done">
            <SavedMark />
            {t('personalisation.saved')}
          </p>
        ) : (
          <p className="personalisation-line">
            {line === 'never'
              ? t('personalisation.never')
              : t('personalisation.chosen', { own: schemeName(t, defaultScheme) })}
          </p>
        )}
        <Dots scheme={scheme} size={24} />
        <button ref={step} type="button" className="personalisation-step" onClick={onChoose}>
          {t('personalisation.choose')}
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
          >
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}

interface ColoursProps {
  current: Scheme;
  pick: Scheme;
  saving: boolean;
  unsaved: Refusal | null;
  onPick: (scheme: Scheme) => void;
  onCancel: () => void;
  onSave: () => void;
}

/** Colours, 540 wide: the pick on its own card, then the eight swatches as one radio group. */
function Colours({ current, pick, saving, unsaved, onPick, onCancel, onSave }: ColoursProps) {
  const { t } = useTranslation();
  const id = useId();
  const dialog = useRef<HTMLDivElement>(null);
  const verb = useRef<HTMLButtonElement>(null);
  const radios = useRef(new Map<Scheme, HTMLInputElement>());
  const [opened] = useState(pick);

  useDialogKeys(dialog, onCancel, saving);

  useEffect(() => {
    radios.current.get(opened)?.focus();
  }, [opened]);

  function move(to: Scheme): void {
    if (saving) return;

    onPick(to);
    radios.current.get(to)?.focus();
  }

  const pickedName = schemeName(t, pick);
  const keptName = schemeName(t, current);

  return (
    <>
      <div className="dialog-scrim" aria-hidden="true" />
      <div
        ref={dialog}
        className="dialog colours-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        tabIndex={-1}
      >
        <ActionPair
          className="colours-nav"
          dismiss={
            <button
              type="button"
              className={saving ? 'colours-nav-cancel is-waiting' : 'colours-nav-cancel'}
              {...offButton(saving, { dim: false })}
              onClick={onCancel}
            >
              {t('personalisation.cancel')}
            </button>
          }
          between={
            <h2 id={`${id}-title`} className="colours-nav-title">
              {t('personalisation.dialog')}
            </h2>
          }
          confirm={
            <button
              ref={verb}
              type="button"
              className={[
                'colours-nav-verb',
                saving && 'is-saving',
                !saving && pick === current && 'is-off',
              ]
                .filter(Boolean)
                .join(' ')}
              aria-busy={saving || undefined}
              {...offButton(saving || pick === current, { dim: false })}
              onClick={onSave}
            >
              {saving && <span className="colours-spin" aria-hidden="true" />}
              {saving ? t('personalisation.saving') : t('personalisation.save')}
            </button>
          }
        />
        <div className="colours-body">
          <p className="colours-lead">{t('personalisation.lead')}</p>
          <div className="colours-pick">
            <Preview scheme={pick} name={pickedName} />
            {unsaved == null ? (
              <p className="colours-status" role="status">
                {pick === current
                  ? t('personalisation.inUse')
                  : t('personalisation.notYet', { name: pickedName })}
              </p>
            ) : (
              <NotSaved
                words={t(
                  unsaved === 'offline' ? 'personalisation.offline' : 'personalisation.failed',
                  { picked: pickedName, kept: keptName },
                )}
                retry={t('personalisation.tryAgain')}
                onRetry={() => {
                  verb.current?.focus();
                  onSave();
                }}
              />
            )}
          </div>
          <div
            className={saving ? 'colours-swatches is-still' : 'colours-swatches'}
            role="radiogroup"
            aria-label={t('personalisation.dialog')}
            aria-disabled={saving || undefined}
          >
            {schemeNames.map((scheme) => (
              <Swatch
                key={scheme}
                scheme={scheme}
                group={`${id}-scheme`}
                picked={scheme === pick}
                current={scheme === current}
                onRef={(node) => {
                  if (node == null) radios.current.delete(scheme);
                  else radios.current.set(scheme, node);
                }}
                onPick={() => move(scheme)}
                onStep={(by) => move(nextScheme(scheme, by))}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function Preview({ scheme, name }: { scheme: Scheme; name: string }) {
  const { t } = useTranslation();

  return (
    <div className="colours-preview" role="img" aria-label={t('personalisation.preview', { name })}>
      <Ground scheme={scheme} wash />
      <Pieces scheme={scheme} art={PREVIEW_ART} />
      <span className="colours-preview-inner">
        <svg className="colours-preview-name" aria-hidden="true" focusable="false">
          <text x="0" y="20" fill={confetti[scheme].on}>
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
  group,
  picked,
  current,
  onRef,
  onPick,
  onStep,
}: {
  scheme: Scheme;
  group: string;
  picked: boolean;
  current: boolean;
  onRef: (node: HTMLInputElement | null) => void;
  onPick: () => void;
  onStep: (by: 1 | -1) => void;
}) {
  const { t } = useTranslation();
  const name = schemeName(t, scheme);

  return (
    <label className={picked ? 'colours-swatch is-picked' : 'colours-swatch'}>
      <input
        ref={onRef}
        className="visually-hidden"
        type="radio"
        name={group}
        checked={picked}
        aria-label={current ? t('personalisation.swatchCurrent', { name }) : name}
        onChange={onPick}
        onKeyDown={(event) => {
          const by = keyStep(event.key);
          if (by == null) return;

          event.preventDefault();
          onStep(by);
        }}
      />
      <span className="colours-mesh" aria-hidden="true">
        <Ground scheme={scheme} wash={false} />
        <Pieces scheme={scheme} art={SWATCH_ART} />
      </span>
      {current && (
        <span className="colours-current" aria-hidden="true">
          <span className="personalisation-mark is-small" aria-hidden="true">
            <Glyph name="tick" size={9} weight={3.4} />
          </span>
          {t('personalisation.current')}
        </span>
      )}
      <span className="colours-swatch-row" aria-hidden="true">
        <span className={picked ? 'colours-radio is-on' : 'colours-radio'}>
          {picked && <span className="colours-radio-dot" />}
        </span>
        <span className="colours-swatch-name">{name}</span>
      </span>
    </label>
  );
}
