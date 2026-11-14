import { ACCESS_NEEDS, type AccessNeed, type Allergen, type Diet } from '@soirely/api-client';
import { listFormat } from '@soirely/domain';
import { type ReactNode, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { Glyph } from '../../components/Glyph.tsx';
import { currentLocale } from '../../i18n/index.ts';
import { offButton } from '../../offButton.ts';
import { Filled, Notice, TextAction, dayOf } from './GuestParts.tsx';
import {
  ALLERGEN_ORDER,
  DIET_CHIPS,
  type Field,
  type Kitchen,
  type KitchenWords,
  type Person,
  allergyNames,
  fieldId,
  kitchenLines,
  problemsOf,
  toggled,
  whoOf,
} from './kitchen.ts';
import './kitchen.css';

type Translate = ReturnType<typeof useTranslation>['t'];

function useWords(): { t: Translate; words: KitchenWords } {
  const { t } = useTranslation();
  const locale = currentLocale();

  const words = useMemo<KitchenWords>(
    () => ({
      allergen: (code: Allergen) => t(`guestNeeds.allergen.${code}`),
      diet: (code: Diet) => t(`guestNeeds.dietName.${code}`),
      access: (code: AccessNeed) => t(`guestNeeds.accessName.${code}`),
      lower: (text) => text.charAt(0).toLocaleLowerCase(locale) + text.slice(1),
      list: (items) => listFormat(locale, { type: 'conjunction' }).format(items),
      allergyLine: (list, count) => t('guestKitchen.allergyLine', { list, count }),
      quote: (text) => t('guestKitchen.quote', { text }),
      removed: (label) => t('guestKitchen.removed', { label }),
      gettingIn: (text) => t('guestKitchen.gettingIn', { text }),
      nothing: t('guestKitchen.nothingRow'),
    }),
    [t, locale],
  );

  return { t, words };
}

function who(one: Person, kitchen: Kitchen, t: Translate): string {
  return whoOf(one, kitchen.people, {
    you: t('guestKitchen.you'),
    yourGuest: t('guestKitchen.yourGuest'),
    yourGuestN: (n) => t('guestKitchen.yourGuestN', { n }),
  });
}

function Ring({ kind }: { kind: 'allergy' | 'broken' | 'removed' | 'diet' }) {
  return (
    <span className={`gk-ring is-${kind}`} aria-hidden="true">
      {kind === 'allergy' && '!'}
      {kind === 'removed' && '−'}
      {kind === 'broken' && <Glyph name="clear" size={12} weight={3} />}
      {kind === 'diet' && <Glyph name="tick" size={13} weight={3} />}
    </span>
  );
}

function Chip({
  name,
  on,
  allergy,
  word,
  focus,
  off,
  onClick,
}: {
  name: string;
  on: boolean;
  allergy: boolean;
  word: string;
  focus: string;
  off: boolean;
  onClick: () => void;
}) {
  const kind = allergy ? 'allergy' : 'diet';

  return (
    <button
      className={on ? `gk-chip is-${kind}` : 'gk-chip'}
      type="button"
      aria-pressed={on}
      data-focus={focus}
      {...offButton(off, { dim: false })}
      onClick={onClick}
    >
      {on && <Ring kind={kind} />}
      <span>{name}</span>
      {on && allergy && (
        <span className="gk-chip-word" aria-hidden="true">
          {`· ${word}`}
        </span>
      )}
    </button>
  );
}

function TextField({
  id,
  label,
  optional,
  value,
  error,
  onChange,
}: {
  id: string;
  label: string;
  optional: string | null;
  value: string;
  error: string | null;
  onChange: (value: string) => void;
}) {
  const errorId = `${id}-error`;

  return (
    <div className="gk-field">
      <label className="gk-label" htmlFor={id}>
        <span>{label}</span>
        {optional != null && <span className="gk-optional">{optional}</span>}
      </label>
      <input
        id={id}
        className={error == null ? 'gk-input' : 'gk-input is-wrong'}
        type="text"
        value={value}
        autoComplete="off"
        data-focus={id}
        aria-invalid={error != null}
        aria-describedby={error == null ? undefined : errorId}
        onChange={(event) => onChange(event.target.value)}
      />
      {error != null && (
        <p id={errorId} className="gk-error">
          <Ring kind="broken" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}

type Change = (key: string, change: (one: Person) => Partial<Person>, focus?: string) => void;

function HostRows({
  one,
  hosts,
  count,
  onChange,
}: {
  one: Person;
  hosts: string;
  count: number;
  onChange: Change;
}) {
  const { t, words } = useWords();
  const head = `gk-host-${one.key}`;

  return (
    <div className="gk-group" role="group" aria-labelledby={head}>
      <p id={head} className="gk-label">
        {t('guestKitchen.alsoNoted', { hosts, count })}
      </p>
      <div className="gk-hosts">
        {ACCESS_NEEDS.filter((code) => one.host.includes(code)).map((code) => {
          const label = words.access(code);
          const gone = `gk-gone-${one.key}-${code}`;

          return one.removed.includes(code) ? (
            <div key={code} className="gk-host is-removed">
              <p className="gk-host-words">
                <Ring kind="removed" />
                <span id={gone}>{t('guestKitchen.willRemove', { label })}</span>
              </p>
              <button
                className="gk-small"
                type="button"
                aria-label={t('guestKitchen.keepAria', { label })}
                aria-describedby={gone}
                data-focus={`keep-${one.key}-${code}`}
                onClick={() =>
                  onChange(
                    one.key,
                    (was) => ({ removed: was.removed.filter((each) => each !== code) }),
                    `remove-${one.key}-${code}`,
                  )
                }
              >
                {t('guestKitchen.keepIt')}
              </button>
            </div>
          ) : (
            <div key={code} className="gk-host">
              <p className="gk-host-words">{label}</p>
              <button
                className="gk-small"
                type="button"
                aria-label={t('guestKitchen.removeAria', { label })}
                data-focus={`remove-${one.key}-${code}`}
                onClick={() =>
                  onChange(
                    one.key,
                    (was) => ({ removed: [...was.removed, code] }),
                    `keep-${one.key}-${code}`,
                  )
                }
              >
                {t('guestKitchen.remove')}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const NO_PROBLEMS: Record<Field, null> = { other: null, words: null, access: null };

function Card({
  one,
  kitchen,
  hosts,
  hostCount,
  timeZone,
  onChange,
}: {
  one: Person;
  kitchen: Kitchen;
  hosts: string;
  hostCount: number;
  timeZone: string;
  onChange: Change;
}) {
  const { t, words } = useWords();
  const problems = kitchen.tried ? problemsOf(one) : NO_PROBLEMS;
  const problem = (field: Field) => {
    const found = problems[field];

    return found == null
      ? null
      : found === 'empty'
        ? t('guestKitchen.sayWhich')
        : t('guestKitchen.tooLong', { most: 100 });
  };
  const named = allergyNames(one, words);
  const allergiesId = `gk-al-${one.key}`;
  const dietId = `gk-di-${one.key}`;
  const changed = one.changed;

  return (
    <fieldset className="gk-card">
      <legend className="gk-who">{who(one, kitchen, t)}</legend>
      <div className="gk-card-body">
        {changed != null && (
          <p className="gk-text is-quiet">
            {changed.by === 'hosts'
              ? t('guestKitchen.byHosts', { hosts, date: dayOf(changed.at, timeZone) })
              : t('guestKitchen.byYou', { date: dayOf(changed.at, timeZone) })}
          </p>
        )}
        <div className="gk-group" role="group" aria-labelledby={allergiesId}>
          <p id={allergiesId} className="gk-label">
            {t('guestKitchen.allergies')}
          </p>
          <div className="gk-chips">
            {ALLERGEN_ORDER.map((code) => (
              <Chip
                key={code}
                name={words.allergen(code)}
                on={one.allergies.includes(code)}
                allergy
                word={t('guestKitchen.allergyWord')}
                focus={`chip-${one.key}-${code}`}
                off={false}
                onClick={() =>
                  onChange(one.key, (was) => ({
                    allergies: toggled(was.allergies, code, ALLERGEN_ORDER),
                  }))
                }
              />
            ))}
          </div>
          {one.allergies.includes('other') && (
            <TextField
              id={fieldId('other', one.key)}
              label={t('guestKitchen.which')}
              optional={null}
              value={one.other}
              error={problem('other')}
              onChange={(value) => onChange(one.key, () => ({ other: value }))}
            />
          )}
          <div className="gk-live" aria-live="polite">
            {named.length > 0 && (
              <p className="gk-line">
                <Ring kind="allergy" />
                <span>{t('guestKitchen.line', { allergies: words.list(named) })}</span>
              </p>
            )}
          </div>
        </div>
        <div className="gk-group" role="group" aria-labelledby={dietId}>
          <p id={dietId} className="gk-label">
            {t('guestKitchen.diet')}
          </p>
          <div className="gk-chips">
            {DIET_CHIPS.map((code) => (
              <Chip
                key={code}
                name={words.diet(code)}
                on={one.diet.includes(code)}
                allergy={false}
                word=""
                focus={`chip-${one.key}-${code}`}
                off={false}
                onClick={() =>
                  onChange(one.key, (was) => ({ diet: toggled(was.diet, code, DIET_CHIPS) }))
                }
              />
            ))}
          </div>
        </div>
        <TextField
          id={fieldId('words', one.key)}
          label={t('guestKitchen.words')}
          optional={t('guestKitchen.optional')}
          value={one.words}
          error={problem('words')}
          onChange={(value) => onChange(one.key, () => ({ words: value }))}
        />
        {one.host.length > 0 && (
          <HostRows one={one} hosts={hosts} count={hostCount} onChange={onChange} />
        )}
        <TextField
          id={fieldId('access', one.key)}
          label={t('guestKitchen.access')}
          optional={t('guestKitchen.optional')}
          value={one.access}
          error={problem('access')}
          onChange={(value) => onChange(one.key, () => ({ access: value }))}
        />
      </div>
    </fieldset>
  );
}

/** Anything the kitchen must know?: who will see it first, then one card per person coming. */
export function KitchenStep({
  kitchen,
  hosts,
  hostCount,
  timeZone,
  onChange,
  onBack,
  onNext,
  onSkip,
}: {
  kitchen: Kitchen;
  hosts: string;
  hostCount: number;
  timeZone: string;
  onChange: Change;
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
}) {
  const { t } = useTranslation();

  return (
    <section className="gk" aria-labelledby="gk-h">
      <TextAction ink icon={<Glyph name="back" size={18} weight={2.2} />} onClick={onBack}>
        {t('guest.back')}
      </TextAction>
      <div className="gk-head">
        <h2
          id="gk-h"
          className="gp-h2 gk-h2"
          tabIndex={-1}
          data-focus="kitchenHead"
          aria-describedby="gk-consent"
        >
          {t('guestKitchen.title')}
        </h2>
        <p className="gk-text is-quiet">
          {t(kitchen.people.length > 1 ? 'guestKitchen.intro' : 'guestKitchen.introAlone')}
        </p>
      </div>
      <div className="gk-consent">
        <Glyph name="lock" size={20} />
        <p id="gk-consent">{t('guestKitchen.consent', { hosts })}</p>
      </div>
      {kitchen.people.map((one) => (
        <Card
          key={one.key}
          one={one}
          kitchen={kitchen}
          hosts={hosts}
          hostCount={hostCount}
          timeZone={timeZone}
          onChange={onChange}
        />
      ))}
      <div className="gk-actions">
        <Filled busy={false} focus="kitchenNext" onClick={onNext}>
          {t('guestKitchen.next')}
        </Filled>
        <button className="gp-outlined" type="button" onClick={onSkip}>
          {t(kitchen.record ? 'guestKitchen.leave' : 'guestKitchen.nothing')}
        </button>
      </div>
    </section>
  );
}

function RowChange({
  label,
  off,
  focus,
  onClick,
  children,
}: {
  label: string;
  off: boolean;
  focus?: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      className="gp-text gk-change"
      type="button"
      aria-label={label}
      data-focus={focus}
      {...offButton(off, { dim: false })}
      onClick={onClick}
    >
      <span>{children}</span>
    </button>
  );
}

/** Check and send with For the kitchen after Your answer and Who's coming. Nothing is saved until Send. */
export function KitchenCheck({
  kitchen,
  busy,
  alert,
  party,
  onBack,
  onAnswer,
  onParty,
  onKitchen,
  onSend,
}: {
  kitchen: Kitchen;
  busy: boolean;
  alert: string | null;
  party: { line: string } | null;
  onBack: () => void;
  onAnswer: () => void;
  onParty: () => void;
  onKitchen: () => void;
  onSend: () => void;
}) {
  const { t, words } = useWords();

  return (
    <section className="gk gk-check" aria-labelledby="gp-check-h" aria-busy={busy}>
      <TextAction
        ink
        off={busy}
        icon={<Glyph name="back" size={18} weight={2.2} />}
        onClick={onBack}
      >
        {t('guest.back')}
      </TextAction>
      <h2 id="gp-check-h" className="gp-h2 gk-h2" tabIndex={-1} data-focus="checkHead">
        {t('guest.check')}
      </h2>
      <div className="gk-rows">
        <div className="gk-row">
          <div className="gk-row-words">
            <p className="gk-label">{t('guest.yourAnswer')}</p>
            <p className="gk-value">{t('guest.coming')}</p>
          </div>
          <RowChange label={t('guestKitchen.changeAnswer')} off={busy} onClick={onAnswer}>
            {t('guest.changeShort')}
          </RowChange>
        </div>
        {party != null && (
          <div className="gk-row">
            <div className="gk-row-words">
              <p className="gk-label">{t('guest.withYouRow')}</p>
              <p className="gk-value">{party.line}</p>
            </div>
            <RowChange label={t('guest.withYouChange')} off={busy} onClick={onParty}>
              {t('guest.changeShort')}
            </RowChange>
          </div>
        )}
        <div className="gk-row">
          <div className="gk-row-words">
            <p className="gk-label">{t('guestKitchen.row')}</p>
            {kitchenLines(kitchen, (one) => who(one, kitchen, t), words).map(({ who, lines }) => (
              <div key={who ?? 'nobody'} className="gk-person">
                {who != null && <p className="gk-value">{who}</p>}
                {lines.map((line, at) => (
                  <p
                    key={`${String(at)}-${line.text}`}
                    className={`gk-said${line.allergy ? ' is-allergy' : ''}${line.quiet ? ' is-quiet' : ''}`}
                  >
                    {line.allergy && <Ring kind="allergy" />}
                    <span>{line.text}</span>
                  </p>
                ))}
              </div>
            ))}
          </div>
          <RowChange
            label={t('guestKitchen.changeKitchen')}
            off={busy}
            focus="kitchenRow"
            onClick={onKitchen}
          >
            {t('guest.changeShort')}
          </RowChange>
        </div>
      </div>
      {alert != null && <Notice kind="broken">{alert}</Notice>}
      <Filled busy={busy} focus="send" onClick={onSend}>
        {t('guest.send')}
      </Filled>
      <p className="gk-text is-quiet">{t('guest.nothingSent')}</p>
    </section>
  );
}
