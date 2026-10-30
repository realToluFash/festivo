import { ApiError } from '@soirely/api-client';
import { ACCOUNT_NAME_MAXIMUM, nameToSave } from '@soirely/domain';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../../../api.ts';
import { FieldError } from '../../../components/FieldError.tsx';
import { focusWhereSent, offField } from '../../../offField.ts';
import { useStepFocus } from '../../../stepFocus.ts';

/** Your account > Account, the person's own name, in the Time zone card's pattern (sc-22741). */
export function NameCard({ name, onSaved }: { name: string; onSaved: () => Promise<void> }) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [refocus, setRefocus] = useState(false);
  const changeButton = useRef<HTMLButtonElement>(null);
  const [savedLine, arriveAtSaved] = useStepFocus<HTMLDivElement>();

  useEffect(() => {
    if (!editing && refocus) changeButton.current?.focus();
  }, [editing, refocus]);

  return (
    <section className="card" aria-labelledby="name-title">
      <h2 id="name-title">{t('nameCard.title')}</h2>

      {editing ? (
        <Editing
          name={name}
          onSaved={async (now) => {
            await onSaved();
            setEditing(false);
            setSaved(now);
            arriveAtSaved();
          }}
          onCancel={() => {
            setEditing(false);
            setRefocus(true);
          }}
        />
      ) : (
        <>
          <div className="current-value">
            <div className="current-value-text">
              <span className="current-value-label">{name}</span>
            </div>
            <button
              className="button"
              type="button"
              id="name-change"
              ref={changeButton}
              onClick={() => {
                setSaved(null);
                setRefocus(false);
                setEditing(true);
              }}
            >
              {t('nameCard.change')}
            </button>
          </div>

          {saved != null && (
            <div className="status-done" tabIndex={-1} ref={savedLine}>
              <span className="mark mark-done" aria-hidden="true">
                ✓
              </span>
              <p>{t('nameCard.saved', { name: saved })}</p>
            </div>
          )}
        </>
      )}
    </section>
  );
}

/** The name as it is, to correct; the same name again closes with nothing sent. */
function Editing({
  name,
  onSaved,
  onCancel,
}: {
  name: string;
  onSaved: (now: string) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [typed, setTyped] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => input.current?.focus(), []);

  async function save(): Promise<void> {
    if (saving) return;

    const checked = nameToSave(typed, name);
    if (checked.kind === 'blank') {
      setError(t('nameCard.blank'));
      input.current?.focus();
      return;
    }

    if (checked.kind === 'unchanged') {
      onCancel();
      return;
    }

    const now = checked.name;

    setSaving(true);
    const land = focusWhereSent();

    try {
      await api.setName(now);
      await onSaved(now);
    } catch (refusal) {
      setSaving(false);
      setError(
        refusal instanceof ApiError && refusal.status === 422
          ? (refusal.problem.detail ?? t('nameCard.failed'))
          : t('nameCard.failed'),
      );
      land('name-input');
    }
  }

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <div className="field">
        <label htmlFor="name-input">{t('completeProfile.name')}</label>
        <input
          className={error == null ? 'input' : 'input input-wrong'}
          id="name-input"
          ref={input}
          type="text"
          autoComplete="name"
          autoCorrect="off"
          spellCheck={false}
          maxLength={ACCOUNT_NAME_MAXIMUM}
          value={typed}
          {...offField(saving)}
          aria-invalid={error != null}
          aria-describedby={error == null ? undefined : 'name-err'}
          onChange={(event) => {
            setTyped(event.target.value);
            setError(null);
          }}
        />
        {error != null && <FieldError id="name-err" message={error} />}
      </div>

      <div className="actions">
        <button className="button button-primary" type="submit" aria-busy={saving}>
          {saving ? t('nameCard.saving') : t('nameCard.save')}
        </button>
        <button className="button" type="button" onClick={onCancel} disabled={saving}>
          {t('nameCard.cancel')}
        </button>
      </div>
    </form>
  );
}
