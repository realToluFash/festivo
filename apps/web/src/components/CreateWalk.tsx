import {
  countrySearch,
  formattingLocale,
  initials,
  newOrganisationEntered,
  newOrganisationLimit,
  newOrganisationRefusal,
  timezoneLabel,
} from '@soirely/domain';
import type { TFunction } from 'i18next';
import {
  type KeyboardEvent,
  type RefObject,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import { ActionPair } from './ActionPair.tsx';
import { keepFocusIn } from '../dialogFocus.ts';
import { currentLocale } from '../i18n/index.ts';
import { duration, easing, leaveDialog, lessMotion } from '../leaving.ts';
import {
  type Country,
  type Currencies,
  type Landing,
  STEPS,
  type Step,
  type Walk,
  type WalkAnswer,
  answered,
  cardLine,
  countriesOf,
  optionLabel,
  pickLine,
  shrinks,
  stepRefused,
} from './createWalk.ts';
import { Glyph } from './Glyph.tsx';
import { LayersContext, useLayer } from '../layers.ts';
import { Notice } from './Notice.tsx';
import { Ask } from './SettingsParts.tsx';
import './createWalk.css';

interface WalkProps<Made> {
  start: Walk;
  email: string;
  currencies: Currencies | null;
  create: (walk: Walk) => Promise<WalkAnswer<Made>>;
  onClose: () => void;
  onCreated: (made: Made) => void;
}

/** Create an organisation in B · A short walk, one focused panel over the page (CreateOrg-B-Walk-Web, page 29). `create` sends it, and `onCreated` has what it made. */
export function CreateWalk<Made>(props: WalkProps<Made>) {
  const { host } = useContext(LayersContext);

  return host == null ? null : createPortal(<Panel {...props} />, host);
}

function Panel<Made>({ start, email, currencies, create, onClose, onCreated }: WalkProps<Made>) {
  const { t } = useTranslation();
  const id = useId();
  const language = currentLocale();
  const countries = useMemo(() => countriesOf(language, currencies, t), [language, currencies, t]);
  const locale = formattingLocale(language, navigator.language);
  const [walk, setWalk] = useState(start);
  const [landing, setLanding] = useState({ to: start.landing, count: 0 });
  const [moved, setMoved] = useState<'on' | 'back' | null>(null);
  const [heard, setHeard] = useState('');
  const [tries, setTries] = useState(0);
  const covered = useLayer();
  const panel = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const question = useRef<HTMLHeadingElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const createButton = useRef<HTMLButtonElement>(null);
  const height = useRef(0);
  const live = useRef(false);
  const sending = useRef(false);
  const opened = useRef(start);
  const picked = countries.find((one) => one.code === walk.country) ?? null;
  const device = countries.find((one) => one.code === walk.device.country) ?? null;
  const questions: Record<Step, string> = {
    1: t('createOrganisation.whatTitle'),
    2: t('createOrganisation.whereTitle'),
    3: t('createOrganisation.readyTitle'),
  };

  function land(to: Landing): void {
    setLanding((now) => ({ to, count: now.count + 1 }));
  }

  function cancel(): void {
    if (walk.creating) return;
    if (newOrganisationEntered(walk)) setWalk((now) => ({ ...now, asking: true }));
    else onClose();
  }

  function goOn(): void {
    const refused = stepRefused(walk, t);
    if (refused != null) {
      setWalk((now) => ({ ...now, ...refused }));
      land(walk.step === 1 ? 'field' : 'search');
      return;
    }

    setWalk((now) => ({
      ...now,
      step: (now.step + 1) as Step,
      query: '',
      nameRefused: null,
      countryRefused: null,
      answer: null,
      inList: false,
    }));
    setMoved('on');
    setHeard('');
    land('question');
  }

  function goBack(): void {
    setWalk((now) => ({
      ...now,
      step: (now.step - 1) as Step,
      query: '',
      countryRefused: null,
      answer: null,
      inList: true,
    }));
    setMoved('back');
    setHeard('');
    land('question');
  }

  const sent = useRef(create);
  const made = useRef(onCreated);

  useLayoutEffect(() => {
    sent.current = create;
    made.current = onCreated;
  });

  const send = useRef((from: Walk): void => {
    if (sending.current) return;
    sending.current = true;

    void sent.current(from).then((answer) => {
      sending.current = false;
      if (!live.current) return;
      if (answer.kind === 'created') {
        made.current(answer.made);
        return;
      }

      const next = answered(from, answer);
      setWalk(next);
      if (next.step !== from.step) setMoved('back');
      setTries((now) => now + 1);
      land(next.landing);
    });
  });

  function createIt(): void {
    if (walk.creating) return;

    const from = { ...walk, creating: true };
    setWalk({ ...from, answer: null });
    land('dialog');
    send.current(from);
  }

  function rename(name: string): void {
    setWalk((now) => ({
      ...now,
      name,
      nameRefused:
        now.nameRefused != null && newOrganisationRefusal('name', name, t) == null
          ? null
          : now.nameRefused,
    }));
  }

  function pick(country: Country): void {
    if (country.code !== walk.country) setHeard(pickLine(country, walk, t));
    setWalk((now) => ({ ...now, country: country.code, countryRefused: null }));
  }

  useEffect(() => {
    live.current = true;
    // A walk that opens creating sends as it opens.
    if (opened.current.creating) send.current(opened.current);

    return () => {
      live.current = false;
    };
  }, []);

  useEffect(() => {
    const node = panel.current;
    const parent = node?.parentElement;
    if (node == null || parent == null) return;

    const scrim = node.previousElementSibling;

    return () => {
      if (!node.isConnected) leaveDialog(node, scrim, parent);
    };
  }, []);

  useLayoutEffect(() => {
    if (covered) return;

    const keys = (event: globalThis.KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        cancel();
      }
      if (event.key === 'Tab' && panel.current != null) keepFocusIn(panel.current, event);
    };

    document.addEventListener('keydown', keys);

    return () => document.removeEventListener('keydown', keys);
  });

  useLayoutEffect(() => {
    const to = {
      field: field.current,
      question: question.current,
      search: search.current,
      create: createButton.current,
      dialog: panel.current,
      option: list.current?.querySelector<HTMLElement>('[tabindex="0"]') ?? null,
    }[landing.to];

    to?.focus();
  }, [landing]);

  useLayoutEffect(() => {
    const node = panel.current;
    if (node == null) return;

    const was = height.current;
    const now = node.getBoundingClientRect().height;
    if (was === 0 || was === now || lessMotion() || typeof node.animate !== 'function') return;

    node.animate([{ height: `${was}px` }, { height: `${now}px` }], {
      duration: duration('motionBase'),
      easing: easing(),
    });
  }, [walk.step]);

  useLayoutEffect(() => {
    const node = panel.current;
    if (
      node == null ||
      (typeof node.getAnimations === 'function' && node.getAnimations().length > 0)
    )
      return;

    height.current = node.getBoundingClientRect().height;
  });

  const title = t('createOrganisation.title');

  const refusalId = `${id}-refusal`;
  const limited = newOrganisationLimit(walk.lifts, locale, t).body;

  return (
    <>
      <button
        type="button"
        className="dialog-scrim"
        tabIndex={-1}
        aria-label={t('createOrganisation.cancel')}
        disabled={walk.creating}
        onClick={cancel}
      />
      <div
        ref={panel}
        className="cw-panel"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        aria-describedby={`${id}-step`}
        tabIndex={-1}
      >
        <div className="cw-side">
          <div className="cw-top">
            <div className="cw-progress" aria-hidden="true">
              <span className="cw-bars">
                {([1, 2, 3] as const).map((bar) => (
                  <span key={bar} className={bar <= walk.step ? 'cw-bar is-on' : 'cw-bar'} />
                ))}
              </span>
              <span id={`${id}-step`}>
                {t('createOrganisation.stepOf', { step: walk.step, steps: STEPS })}
              </span>
            </div>
            {!walk.creating && (
              <button type="button" className="cw-cancel" onClick={cancel}>
                {t('createOrganisation.cancel')}
              </button>
            )}
          </div>
          <div key={walk.step} className={moved == null ? 'cw-body' : `cw-body is-${moved}`}>
            <h1 ref={question} className="cw-question" tabIndex={-1}>
              {questions[walk.step]}
            </h1>
            {walk.step === 1 && (
              <div className="desk-field">
                <label htmlFor={`${id}-name`} className="desk-label">
                  {t('createOrganisation.name')}
                </label>
                <div className={walk.nameRefused == null ? 'desk-box' : 'desk-box is-wrong'}>
                  <input
                    ref={field}
                    id={`${id}-name`}
                    type="text"
                    value={walk.name}
                    autoComplete="organization"
                    spellCheck={false}
                    aria-invalid={walk.nameRefused != null}
                    aria-describedby={walk.nameRefused == null ? `${id}-help` : refusalId}
                    onChange={(event) => rename(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter') return;

                      event.preventDefault();
                      goOn();
                    }}
                  />
                </div>
                {walk.nameRefused == null ? (
                  <p id={`${id}-help`} className="desk-help">
                    {t('createOrganisation.nameHelp')}
                  </p>
                ) : (
                  <Refusal id={refusalId} words={walk.nameRefused} />
                )}
              </div>
            )}
            {walk.step === 2 && (
              <>
                {walk.countryRefused != null && (
                  <Refusal id={refusalId} words={walk.countryRefused} />
                )}
                <CountryPicker
                  countries={countries}
                  device={device}
                  walk={walk}
                  language={language}
                  search={search}
                  list={list}
                  refusalId={walk.countryRefused != null ? refusalId : undefined}
                  onQuery={(query) => setWalk((now) => ({ ...now, query }))}
                  onPick={pick}
                />
                <p className="visually-hidden" aria-live="polite">
                  {heard}
                </p>
              </>
            )}
            {walk.step === 3 && (
              <>
                {walk.answer === 'limited' && (
                  <Notice key={tries} kind="attention">
                    <span className="cw-notice-title">{t('createOrganisation.limitedTitle')}</span>
                    {limited != null && <span className="cw-notice-line">{limited}</span>}
                  </Notice>
                )}
                {walk.answer === 'failed' && (
                  <Notice key={tries} kind="broken">
                    {t('createOrganisation.failed')}
                  </Notice>
                )}
                <p className="visually-hidden">{cardLine(walk, countries, email, t)}</p>
                <p className="cw-intro">{t('createOrganisation.intro')}</p>
                <p className="cw-defaults">{t('createOrganisation.defaults', { email })}</p>
              </>
            )}
          </div>
          <div className="cw-foot">
            {walk.step === 1 ? (
              <button type="button" className="cw-button" onClick={goOn}>
                {t('createOrganisation.continue')}
              </button>
            ) : walk.creating ? (
              <button
                ref={createButton}
                type="button"
                className="cw-button"
                disabled
                aria-busy="true"
              >
                <span className="cw-ring" aria-hidden="true" />
                {t('createOrganisation.creating')}
              </button>
            ) : (
              <ActionPair
                className="cw-pair"
                dismiss={
                  <button type="button" className="cw-button is-quiet" onClick={goBack}>
                    {t('createOrganisation.back')}
                  </button>
                }
                confirm={
                  walk.step === 2 ? (
                    <button type="button" className="cw-button" onClick={goOn}>
                      {t('createOrganisation.continue')}
                    </button>
                  ) : (
                    <button
                      ref={createButton}
                      type="button"
                      className="cw-button"
                      onClick={createIt}
                    >
                      {t('createOrganisation.create')}
                    </button>
                  )
                }
              />
            )}
          </div>
        </div>
        <Card walk={walk} picked={picked} email={email} t={t} />
      </div>
      {walk.asking && (
        <Ask
          title={t('createOrganisation.discardTitle')}
          line={t('createOrganisation.discardBody')}
          keep={t('createOrganisation.keepEditing')}
          go={t('createOrganisation.discard')}
          onKeep={() => {
            setWalk((now) => ({ ...now, asking: false }));
            land(walk.step === 1 ? 'field' : 'question');
          }}
          onGo={onClose}
        />
      )}
    </>
  );
}

/** The new organisation as it will be: the tile stays in Tint with a dashed rim, since no id exists until the server makes one. */
function Card({
  walk,
  picked,
  email,
  t,
}: {
  walk: Walk;
  picked: Country | null;
  email: string;
  t: TFunction;
}) {
  const name = walk.name.trim();

  return (
    <div className="cw-card" aria-hidden="true">
      <span className="cw-tile">
        {name === '' ? <Glyph name="plus" size={29} weight={2.4} /> : initials(name)}
      </span>
      {name !== '' && <p className={shrinks(name) ? 'cw-name is-long' : 'cw-name'}>{name}</p>}
      <p className="cw-role">{t('switcher.yourRole', { role: t('roles.owner') })}</p>
      {walk.step > 1 && picked != null && (
        <dl className="cw-facts">
          <Fact label={t('createOrganisation.country')} value={picked.name} />
          {picked.currency != null && (
            <Fact
              label={t('orgGeneral.currency')}
              value={picked.currency.words}
              none={picked.currency.none}
            />
          )}
          <Fact
            label={t('orgGeneral.timezone')}
            value={timezoneLabel(walk.device.zone)}
            tag={t('createOrganisation.fromDevice')}
          />
          {walk.step === 3 && <Fact label={t('orgGeneral.contact')} value={email} />}
        </dl>
      )}
    </div>
  );
}

function centre(box: HTMLElement, row: HTMLElement): void {
  box.scrollTop = row.offsetTop - (box.clientHeight - row.offsetHeight) / 2;
}

function Refusal({ id, words }: { id: string; words: string }) {
  return (
    <p id={id} className="desk-error" role="alert">
      <Glyph name="alert" size={15} weight={2.2} />
      {words}
    </p>
  );
}

function Fact({
  label,
  value,
  tag,
  none = false,
}: {
  label: string;
  value: string;
  tag?: string;
  none?: boolean;
}) {
  return (
    <div className="cw-fact">
      <dt>
        {label}
        {tag != null && <span className="cw-tag">{tag}</span>}
      </dt>
      <dd className={none ? 'is-none' : undefined}>{value}</dd>
    </div>
  );
}

interface Row {
  key: string;
  country: Country;
}

/** WAI-ARIA's grouped listbox after a search field: the list is one Tab stop, the arrows move within it. */
function CountryPicker({
  countries,
  device,
  walk,
  language,
  search,
  list,
  refusalId,
  onQuery,
  onPick,
}: {
  countries: readonly Country[];
  device: Country | null;
  walk: Walk;
  language: string;
  search: RefObject<HTMLInputElement | null>;
  list: RefObject<HTMLDivElement | null>;
  refusalId: string | undefined;
  onQuery: (query: string) => void;
  onPick: (country: Country) => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const [active, setActive] = useState<string | null>(null);
  const searching = walk.query.trim() !== '';
  const ours: Row[] =
    searching || device == null ? [] : [{ key: `device-${device.code}`, country: device }];
  const all: Row[] = countrySearch(countries, walk.query, language).map((country) => ({
    key: `all-${country.code}`,
    country,
  }));
  const rows = [...ours, ...all];
  const pickedAt = (walk.inList ? all : rows).find((row) => row.country.code === walk.country);
  const named = rows.findIndex((row) => row.key === active);
  const at =
    named >= 0
      ? named
      : Math.max(
          0,
          rows.findIndex((row) => row.key === pickedAt?.key),
        );
  const inList = walk.inList;
  const nothing = searching && rows.length === 0;

  useLayoutEffect(() => {
    const box = list.current;
    const row = box?.querySelector<HTMLElement>('[tabindex="0"]');
    if (!inList || box == null || row == null) return;

    centre(box, row);
  }, [inList, list]);

  function move(index: number): void {
    const row = rows[index];
    if (row == null) return;

    setActive(row.key);
    document.getElementById(`${id}-${row.key}`)?.focus();
  }

  function keys(event: KeyboardEvent<HTMLDivElement>, row: Row): void {
    const last = rows.length - 1;
    const to =
      event.key === 'ArrowDown'
        ? Math.min(last, at + 1)
        : event.key === 'ArrowUp'
          ? Math.max(0, at - 1)
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? last
              : null;

    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      onPick(row.country);
    } else if (to != null) {
      event.preventDefault();
      move(to);
    }
  }

  function option(row: Row, index: number, lastOne: boolean) {
    const on = row.country.code === walk.country;

    return (
      <div
        key={row.key}
        id={`${id}-${row.key}`}
        role="option"
        aria-selected={on}
        aria-label={optionLabel(row.country)}
        tabIndex={index === at ? 0 : -1}
        className={['cw-option', on && 'is-picked', lastOne && 'is-last'].filter(Boolean).join(' ')}
        onClick={() => {
          setActive(row.key);
          onPick(row.country);
        }}
        onKeyDown={(event) => keys(event, row)}
      >
        <span className="cw-option-words">
          <span className="cw-option-name">{row.country.name}</span>
          {row.country.currency != null && (
            <span className="cw-option-line">{row.country.currency.words}</span>
          )}
        </span>
        {on && (
          <span className="cw-tick" aria-hidden="true">
            <Glyph name="tick" size={15} weight={3} />
          </span>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="cw-search">
        <Glyph name="search" size={18} weight={2.2} />
        <input
          ref={search}
          type="text"
          role="searchbox"
          value={walk.query}
          placeholder={t('createOrganisation.search')}
          aria-label={t('createOrganisation.search')}
          aria-describedby={refusalId}
          aria-controls={nothing ? undefined : `${id}-list`}
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="search"
          onChange={(event) => {
            setActive(null);
            onQuery(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.preventDefault();
            if (event.key !== 'ArrowDown') return;

            event.preventDefault();
            move(at);
          }}
        />
        {walk.query !== '' && (
          <button
            type="button"
            className="cw-clear"
            aria-label={t('createOrganisation.clearSearch')}
            onClick={() => {
              setActive(null);
              onQuery('');
              search.current?.focus();
            }}
          >
            <span className="sw-clear-disc" aria-hidden="true">
              <Glyph name="clear" size={11} weight={3} />
            </span>
          </button>
        )}
      </div>
      {rows.length > 0 && (
        <div
          ref={list}
          id={`${id}-list`}
          className={['cw-list', ours.length > 0 && 'has-ours', !searching && 'has-all']
            .filter(Boolean)
            .join(' ')}
          role="listbox"
          aria-label={t('createOrganisation.country')}
        >
          {ours.length > 0 && (
            <div role="group" aria-labelledby={`${id}-ours`} className="cw-group">
              <div id={`${id}-ours`} role="presentation" className="cw-group-name">
                {t('createOrganisation.fromDevice')}
              </div>
              {ours.map((row, index) => option(row, index, true))}
            </div>
          )}
          {searching ? (
            all.map((row, index) => option(row, index, index === all.length - 1))
          ) : (
            <div role="group" aria-labelledby={`${id}-all`} className="cw-group">
              <div id={`${id}-all`} role="presentation" className="cw-group-name">
                {t('createOrganisation.allCountries')}
              </div>
              {all.map((row, index) => option(row, ours.length + index, index === all.length - 1))}
            </div>
          )}
        </div>
      )}
      <p className={nothing ? 'cw-nomatch' : 'visually-hidden'} role="status">
        {nothing ? t('createOrganisation.noMatch', { text: walk.query.trim() }) : ''}
      </p>
    </>
  );
}
