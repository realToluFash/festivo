import { ApiError, type SingleSignOnInput, type SingleSignOnPage } from '@soirely/api-client';
import { type RefObject, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Glyph } from '../../../components/Glyph.tsx';
import { Choices, Field, Head, Note, TextAction } from '../../../components/SettingsParts.tsx';
import { offButton } from '../../../offButton.ts';
import {
  type Draft,
  type FieldKey,
  type Faults,
  emptyDraft,
  faultKey,
  faultsOf,
  fieldsOf,
  inputOf,
  ourValues,
  refusedField,
} from './singleSignOn.ts';
import { ValueRows } from './SingleSignOnValues.tsx';

/** Pick SAML or OpenID Connect, then its fields: Save checks what it can before it sends, and the server's refusal lands under its field. */
export function SingleSignOnForm({
  ours,
  organisation,
  domains,
  changing,
  note,
  onCancel,
  onSave,
}: {
  ours: SingleSignOnPage['ours'];
  organisation: string;
  domains: string;
  changing: boolean;
  note: string | null;
  onCancel: () => void;
  onSave: (input: SingleSignOnInput) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [pressed, setPressed] = useState(false);
  const [shown, setShown] = useState<Faults>({});
  const [refused, setRefused] = useState<{ field: FieldKey; words: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const name = useRef<HTMLInputElement>(null);
  const url = useRef<HTMLInputElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const issuer = useRef<HTMLInputElement>(null);
  const clientId = useRef<HTMLInputElement>(null);
  const clientSecret = useRef<HTMLInputElement>(null);
  const refs: Record<FieldKey, RefObject<HTMLInputElement | null>> = {
    name,
    metadata: draft.way === 'url' ? url : file,
    issuer,
    clientId,
    clientSecret,
  };
  const errorOf = (field: FieldKey) => {
    const key = shown[field];

    return refused?.field === field ? refused.words : key == null ? null : t(key);
  };
  const check = (field: FieldKey, of: Draft) =>
    setShown((now) => ({ ...now, [field]: faultKey(of, field) ?? undefined }));
  const edit = (field: FieldKey, next: Draft) => {
    setDraft(next);
    if (refused?.field === field) setRefused(null);
    if (shown[field] != null) check(field, next);
  };
  const left = (field: FieldKey) => {
    if (pressed) check(field, draft);
  };

  async function save(): Promise<void> {
    if (saving || draft.protocol == null) return;

    const faults = faultsOf(draft);
    const failing = fieldsOf(draft.protocol).find((field) => faults[field] != null);
    setPressed(true);
    setShown(faults);
    setRefused(null);
    setFailed(false);
    if (failing != null) {
      refs[failing].current?.focus();
      return;
    }

    setSaving(true);
    try {
      await onSave(inputOf(draft, draft.protocol));
    } catch (error) {
      setSaving(false);
      const refusal = error instanceof ApiError ? refusedField(error) : null;
      if (refusal == null) setFailed(true);
      else {
        setRefused(refusal);
        refs[refusal.field].current?.focus();
      }
    }
  }

  const text = (
    field: 'name' | 'issuer' | 'clientId' | 'clientSecret',
    label: string,
    help?: string,
  ) => (
    <div className="sso-field" onBlur={() => left(field)}>
      <Field
        label={label}
        value={draft[field]}
        inputRef={refs[field]}
        {...(help == null ? {} : { help })}
        secret={field === 'clientSecret'}
        autoComplete="off"
        error={errorOf(field)}
        onChange={(value) => edit(field, { ...draft, [field]: value })}
      />
    </div>
  );

  return (
    <div className="sso-form">
      {!changing && <Note strong>{t('sso.intro', { domains, organisation })}</Note>}
      {note != null && <Note strong>{note}</Note>}
      <Choices
        legend={t('sso.protocol')}
        hideLegend
        choices={[
          { id: 'saml', name: t('sso.saml'), line: t('sso.samlLine') },
          { id: 'oidc', name: t('sso.oidc'), line: t('sso.oidcLine') },
        ]}
        picked={draft.protocol ?? ''}
        onPick={(picked) => {
          setDraft({ ...draft, protocol: picked === 'saml' ? 'saml' : 'oidc' });
          setPressed(false);
          setShown({});
          setRefused(null);
        }}
      />
      {draft.protocol != null && (
        <>
          <div className="sso-fields">
            {text(
              'name',
              t('sso.name'),
              t('sso.nameHelp', { organisation, provider: draft.name.trim() || 'Okta' }),
            )}
            {draft.protocol === 'saml' ? (
              <Metadata
                draft={draft}
                error={errorOf('metadata')}
                url={url}
                file={file}
                onEdit={(next) => edit('metadata', next)}
                onWay={(way) => {
                  setDraft({ ...draft, way });
                  setShown((now) => ({ ...now, metadata: undefined }));
                  setRefused(null);
                }}
                onLeave={() => left('metadata')}
              />
            ) : (
              <>
                {text('issuer', t('sso.issuer'), t('sso.issuerHelp'))}
                {text('clientId', t('sso.clientId'))}
                {text('clientSecret', t('sso.clientSecret'))}
              </>
            )}
          </div>
          <section className="desk-block">
            <Head
              title={t(draft.protocol === 'saml' ? 'sso.giveThese' : 'sso.giveThis')}
              level={3}
            />
            <ValueRows values={ourValues(ours, draft.protocol, t)} />
          </section>
          {failed && (
            <p className="desk-line" role="alert">
              {t('sso.failed')}
            </p>
          )}
        </>
      )}
      {(draft.protocol != null || changing) && (
        <div className="sso-buttons">
          <TextAction label={t('sso.cancel')} onClick={onCancel} />
          {draft.protocol != null && (
            <button
              type="button"
              className="button button-primary"
              aria-busy={saving}
              {...offButton(saving, { dim: false })}
              onClick={() => void save()}
            >
              {t('sso.save')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** The metadata by its URL or as its file: one of the two is required. */
function Metadata({
  draft,
  error,
  url,
  file,
  onEdit,
  onWay,
  onLeave,
}: {
  draft: Draft;
  error: string | null;
  url: RefObject<HTMLInputElement | null>;
  file: RefObject<HTMLInputElement | null>;
  onEdit: (next: Draft) => void;
  onWay: (way: Draft['way']) => void;
  onLeave: () => void;
}) {
  const id = useId();
  const { t } = useTranslation();

  return (
    <fieldset className="sso-metadata">
      <legend className="desk-label">{t('sso.metadata')}</legend>
      <div className="sso-ways">
        {(['url', 'file'] as const).map((way) => (
          <label key={way} className={draft.way === way ? 'sso-way is-picked' : 'sso-way'}>
            <input
              type="radio"
              className="sso-way-radio"
              name={`${id}-way`}
              checked={draft.way === way}
              onChange={() => onWay(way)}
            />
            {t(way === 'url' ? 'sso.pasteUrl' : 'sso.uploadFile')}
          </label>
        ))}
      </div>
      {draft.way === 'url' ? (
        <div className="sso-field" onBlur={onLeave}>
          <Field
            label={t('sso.metadataUrl')}
            value={draft.url}
            inputRef={url}
            help={t('sso.urlHelp')}
            autoComplete="off"
            error={error}
            onChange={(value) => onEdit({ ...draft, url: value })}
          />
        </div>
      ) : (
        <div className="sso-file">
          <input
            ref={file}
            id={`${id}-file`}
            type="file"
            accept=".xml,application/xml,text/xml"
            className="sso-file-input"
            aria-invalid={error != null}
            aria-describedby={error == null ? undefined : `${id}-error`}
            onBlur={onLeave}
            onChange={(event) => {
              const chosen = event.target.files?.[0];
              if (chosen != null)
                void chosen
                  .text()
                  .then((xml) => onEdit({ ...draft, file: { name: chosen.name, xml } }));
            }}
          />
          <label htmlFor={`${id}-file`} className="button sso-file-label">
            {t(draft.file == null ? 'sso.chooseFile' : 'sso.chooseAnother')}
          </label>
          {draft.file != null && (
            <p className="desk-line is-ink sso-file-name">{draft.file.name}</p>
          )}
          {error != null && (
            <p id={`${id}-error`} className="desk-error">
              <Glyph name="alert" size={15} weight={2.2} />
              {error}
            </p>
          )}
        </div>
      )}
    </fieldset>
  );
}
