import { formattingLocale, initials } from '@soirely/domain';
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

import { ActionPair } from '../components/ActionPair.tsx';
import { keepFocusIn } from '../dialogFocus.ts';
import { duration, easing, leaveDialog, lessMotion } from '../leaving.ts';
import {
  CREATE_WORDS as W,
  type Country,
  type Landing,
  type Step,
  type Walk,
  answerOf,
  cardLine,
  currencyWords,
  entered,
  limitedLine,
  nameRefusal,
  narrowed,
  optionLabel,
  pickLine,
  sampleCountries,
  shrinks,
  stepRefused,
  zoneWords,
} from './createOrg.ts';
import { Glyph } from '../components/Glyph.tsx';
import { LayersContext, useLayer } from '../layers.ts';
import { Notice } from '../components/Notice.tsx';
import { SAMPLE } from './rules.ts';
import { Ask } from '../components/SettingsParts.tsx';
import './createOrg.css';

const CREATING_MS = 1200;

interface WalkProps {
  start: Walk;
  onClose: () => void;
  onCreated: () => void;
}

/** Create an organisation in B · A short walk, one focused panel over the page (CreateOrg-B-Walk-Web, page 29). */
export function CreateWalk(props: WalkProps) {
  const { host } = useContext(LayersContext);

  return host == null ? null : createPortal(<Panel {...props} />, host);
}

function Panel({ start, onClose, onCreated }: WalkProps) {
  const id = useId();
  const countries = useMemo(() => sampleCountries(), []);
  const locale = formattingLocale('en', navigator.language);
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
  const timer = useRef<number | undefined>(undefined);
  const done = useRef(onCreated);
  const [loadedBusy] = useState(start.creating);
  const picked = countries.find((one) => one.code === walk.country) ?? null;
  const device = countries.find((one) => one.code === walk.device) ?? null;

  function land(to: Landing): void {
    setLanding((now) => ({ to, count: now.count + 1 }));
  }

  function cancel(): void {
    if (walk.creating) return;
    if (entered(walk)) setWalk((now) => ({ ...now, asking: true }));
    else onClose();
  }

  function goOn(): void {
    const refused = stepRefused(walk);
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
      countryRefused: false,
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
      countryRefused: false,
      answer: null,
      inList: true,
    }));
    setMoved('back');
    setHeard('');
    land('question');
  }

  function createIt(): void {
    if (walk.creating) return;

    const answer = answerOf(walk);
    setWalk((now) => ({ ...now, creating: true, answer: null }));
    land('dialog');
    timer.current = window.setTimeout(() => {
      if (answer == null) {
        onCreated();
        return;
      }
      setWalk((now) => ({ ...now, creating: false, answer }));
      setTries((now) => now + 1);
      land('create');
    }, CREATING_MS);
  }

  function rename(name: string): void {
    setWalk((now) => ({
      ...now,
      name,
      nameRefused: now.nameRefused != null && nameRefusal(name) == null ? null : now.nameRefused,
    }));
  }

  function pick(country: Country): void {
    if (country.code !== walk.country) setHeard(pickLine(country));
    setWalk((now) => ({ ...now, country: country.code, countryRefused: false }));
  }

  useEffect(() => () => window.clearTimeout(timer.current), []);

  useLayoutEffect(() => {
    done.current = onCreated;
  });

  useEffect(() => {
    if (!loadedBusy) return;

    const wait = window.setTimeout(() => done.current(), CREATING_MS);

    return () => window.clearTimeout(wait);
  }, [loadedBusy]);

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

  const refusalId = `${id}-refusal`;
  const name = walk.name.trim();

  return (
    <>
      <button
        type="button"
        className="dialog-scrim"
        tabIndex={-1}
        aria-label={W.cancel}
        disabled={walk.creating}
        onClick={cancel}
      />
      <div
        ref={panel}
        className="cw-panel"
        role="dialog"
        aria-modal="true"
        aria-label={W.title}
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
              <span id={`${id}-step`}>{W.stepOf(walk.step)}</span>
            </div>
            {!walk.creating && (
              <button type="button" className="cw-cancel" onClick={cancel}>
                {W.cancel}
              </button>
            )}
          </div>
          <div key={walk.step} className={moved == null ? 'cw-body' : `cw-body is-${moved}`}>
            <h1 ref={question} className="cw-question" tabIndex={-1}>
              {W.questions[walk.step]}
            </h1>
            {walk.step === 1 && (
              <div className="desk-field">
                <label htmlFor={`${id}-name`} className="desk-label">
                  {W.name}
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
                    {W.nameHelp}
                  </p>
                ) : (
                  <Refusal id={refusalId} words={walk.nameRefused} />
                )}
              </div>
            )}
            {walk.step === 2 && (
              <>
                {walk.countryRefused && <Refusal id={refusalId} words={W.chooseCountry} />}
                <CountryPicker
                  countries={countries}
                  device={device}
                  walk={walk}
                  search={search}
                  list={list}
                  refusalId={walk.countryRefused ? refusalId : undefined}
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
                    <span className="cw-notice-title">{W.limitedTitle}</span>
                    <span className="cw-notice-line">{limitedLine(locale)}</span>
                  </Notice>
                )}
                {walk.answer === 'failed' && (
                  <Notice key={tries} kind="broken">
                    {W.failed}
                  </Notice>
                )}
                <p className="visually-hidden">{cardLine(walk, countries)}</p>
                <p className="cw-intro">{W.intro}</p>
                <p className="cw-defaults">{W.defaults(SAMPLE.email)}</p>
              </>
            )}
          </div>
          <div className="cw-foot">
            {walk.step === 1 ? (
              <button type="button" className="cw-button" onClick={goOn}>
                {W.continue}
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
                {W.creating}
              </button>
            ) : (
              <ActionPair
                className="cw-pair"
                dismiss={
                  <button type="button" className="cw-button is-quiet" onClick={goBack}>
                    {W.back}
                  </button>
                }
                confirm={
                  walk.step === 2 ? (
                    <button type="button" className="cw-button" onClick={goOn}>
                      {W.continue}
                    </button>
                  ) : (
                    <button
                      ref={createButton}
                      type="button"
                      className="cw-button"
                      onClick={createIt}
                    >
                      {W.create}
                    </button>
                  )
                }
              />
            )}
          </div>
        </div>
        <div className="cw-card" aria-hidden="true">
          <span className="cw-tile">
            {name === '' ? <Glyph name="plus" size={29} weight={2.4} /> : initials(name)}
          </span>
          {name !== '' && <p className={shrinks(name) ? 'cw-name is-long' : 'cw-name'}>{name}</p>}
          <p className="cw-role">{W.yourRole}</p>
          {walk.step > 1 && picked != null && (
            <dl className="cw-facts">
              <Fact label={W.country} value={picked.name} />
              <Fact
                label={W.currency}
                value={currencyWords(picked)}
                none={picked.currency == null}
              />
              <Fact label={W.timezone} value={zoneWords()} tag={W.fromDevice} />
              {walk.step === 3 && <Fact label={W.contact} value={SAMPLE.email} />}
            </dl>
          )}
        </div>
      </div>
      {walk.asking && (
        <Ask
          title={W.discardTitle}
          line={W.discardBody}
          keep={W.keepEditing}
          go={W.discard}
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
  search,
  list,
  refusalId,
  onQuery,
  onPick,
}: {
  countries: readonly Country[];
  device: Country | null;
  walk: Walk;
  search: RefObject<HTMLInputElement | null>;
  list: RefObject<HTMLDivElement | null>;
  refusalId: string | undefined;
  onQuery: (query: string) => void;
  onPick: (country: Country) => void;
}) {
  const id = useId();
  const [active, setActive] = useState<string | null>(null);
  const searching = walk.query.trim() !== '';
  const ours: Row[] =
    searching || device == null ? [] : [{ key: `device-${device.code}`, country: device }];
  const all: Row[] = narrowed(countries, walk.query).map((country) => ({
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
          <span className="cw-option-line">{currencyWords(row.country)}</span>
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
          placeholder={W.search}
          aria-label={W.search}
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
            aria-label={W.clear}
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
          aria-label={W.country}
        >
          {ours.length > 0 && (
            <div role="group" aria-labelledby={`${id}-ours`} className="cw-group">
              <div id={`${id}-ours`} role="presentation" className="cw-group-name">
                {W.fromDevice}
              </div>
              {ours.map((row, index) => option(row, index, true))}
            </div>
          )}
          {searching ? (
            all.map((row, index) => option(row, index, index === all.length - 1))
          ) : (
            <div role="group" aria-labelledby={`${id}-all`} className="cw-group">
              <div id={`${id}-all`} role="presentation" className="cw-group-name">
                {W.allCountries}
              </div>
              {all.map((row, index) => option(row, ours.length + index, index === all.length - 1))}
            </div>
          )}
        </div>
      )}
      <p className={nothing ? 'cw-nomatch' : 'visually-hidden'} role="status">
        {nothing ? W.noMatch(walk.query.trim()) : ''}
      </p>
    </>
  );
}
