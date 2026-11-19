import { type RefObject, useId, useRef, useState } from 'react';

import { Glyph } from '../components/Glyph.tsx';
import { Choices, Field, Head, Note, type Tell, TextAction } from '../components/SettingsParts.tsx';
import { CopyRows } from './SingleSignOnParts.tsx';
import {
  type Draft,
  type FieldKey,
  type Faults,
  type Form,
  type MetadataWay,
  type Provider,
  SSO_WORDS as W,
  faultOf,
  faultsOf,
  fieldsOf,
  ourValues,
  protocolOf,
  providerOf,
  refusalOf,
} from './singleSignOn.ts';

/** Pick SAML or OpenID Connect, then its fields: Save checks what it can before it sends, and the server's refusal lands under its field. */
export function SsoForm({
  start,
  note,
  tell,
  onCancel,
  onSaved,
}: {
  start: Form;
  note: string | null;
  tell: Tell;
  onCancel: () => void;
  onSaved: (provider: Provider) => void;
}) {
  const [draft, setDraft] = useState<Draft>(start.draft);
  const [pressed, setPressed] = useState(start.pressed);
  const [shown, setShown] = useState<Faults>(() => (start.pressed ? faultsOf(start.draft) : {}));
  const [refused, setRefused] = useState(start.refused);
  const name = useRef<HTMLInputElement>(null);
  const url = useRef<HTMLInputElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const issuer = useRef<HTMLInputElement>(null);
  const clientId = useRef<HTMLInputElement>(null);
  const secret = useRef<HTMLInputElement>(null);
  const refs: Record<FieldKey, RefObject<HTMLInputElement | null>> = {
    name,
    metadata: draft.way === 'url' ? url : file,
    issuer,
    clientId,
    secret,
  };
  const errorOf = (field: FieldKey) =>
    refused?.field === field ? refused.words : (shown[field] ?? null);
  const edit = (field: FieldKey, next: Draft) => {
    setDraft(next);
    if (refused?.field === field) setRefused(null);
    if (shown[field] != null)
      setShown((now) => ({ ...now, [field]: faultOf(next, field) ?? undefined }));
  };
  const left = (field: FieldKey) => {
    if (pressed) setShown((now) => ({ ...now, [field]: faultOf(draft, field) ?? undefined }));
  };
  const save = () => {
    const faults = faultsOf(draft);
    const failing =
      draft.protocol == null ? [] : fieldsOf(draft.protocol).filter((one) => faults[one] != null);
    const refusal = failing.length === 0 ? refusalOf(draft) : null;
    const first = failing[0] ?? refusal?.field;

    setPressed(true);
    setShown(faults);
    setRefused(refusal);
    if (first != null) {
      refs[first].current?.focus();
      return;
    }
    const provider = providerOf(draft);
    if (provider != null) onSaved(provider);
  };
  const shownName = draft.name.trim() === '' ? 'Okta' : draft.name.trim();

  return (
    <div className="sso-form">
      {!start.changing && <Note strong>{W.intro}</Note>}
      {note != null && <Note strong>{note}</Note>}
      <Choices
        legend={W.protocol}
        hideLegend
        choices={[
          { id: 'saml', name: W.saml, line: W.samlLine },
          { id: 'oidc', name: W.oidc, line: W.oidcLine },
        ]}
        picked={draft.protocol ?? ''}
        onPick={(picked) => {
          setDraft((now) => ({ ...now, protocol: protocolOf(picked) }));
          setPressed(false);
          setShown({});
          setRefused(null);
        }}
      />
      {draft.protocol != null && (
        <>
          <div className="sso-fields">
            <div className="sso-field" onBlur={() => left('name')}>
              <Field
                label={W.name}
                value={draft.name}
                inputRef={name}
                help={W.nameHelp(shownName)}
                autoComplete="off"
                error={errorOf('name')}
                onChange={(value) => edit('name', { ...draft, name: value })}
              />
            </div>
            {draft.protocol === 'saml' ? (
              <Metadata
                draft={draft}
                error={errorOf('metadata')}
                url={url}
                file={file}
                onWay={(way) => {
                  setDraft({ ...draft, way });
                  setShown((now) => ({ ...now, metadata: undefined }));
                  setRefused(null);
                }}
                onEdit={(next) => edit('metadata', next)}
                onLeave={() => left('metadata')}
              />
            ) : (
              <>
                <div className="sso-field" onBlur={() => left('issuer')}>
                  <Field
                    label={W.issuer}
                    value={draft.issuer}
                    inputRef={issuer}
                    help={W.issuerHelp}
                    autoComplete="off"
                    error={errorOf('issuer')}
                    onChange={(value) => edit('issuer', { ...draft, issuer: value })}
                  />
                </div>
                <div className="sso-field" onBlur={() => left('clientId')}>
                  <Field
                    label={W.clientId}
                    value={draft.clientId}
                    inputRef={clientId}
                    autoComplete="off"
                    error={errorOf('clientId')}
                    onChange={(value) => edit('clientId', { ...draft, clientId: value })}
                  />
                </div>
                <div className="sso-field" onBlur={() => left('secret')}>
                  <Field
                    label={W.secret}
                    value={draft.secret}
                    inputRef={secret}
                    secret
                    autoComplete="off"
                    error={errorOf('secret')}
                    onChange={(value) => edit('secret', { ...draft, secret: value })}
                  />
                </div>
              </>
            )}
          </div>
          <section className="desk-block">
            <Head title={draft.protocol === 'saml' ? W.giveThese : W.giveThis} level={3} />
            <CopyRows parts={ourValues(draft.protocol)} tell={tell} />
          </section>
          <div className="sso-buttons">
            <TextAction label={W.cancel} onClick={onCancel} />
            <button type="button" className="button button-primary" onClick={save}>
              {W.save}
            </button>
          </div>
        </>
      )}
      {draft.protocol == null && start.changing && (
        <div className="sso-buttons">
          <TextAction label={W.cancel} onClick={onCancel} />
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
  onWay,
  onEdit,
  onLeave,
}: {
  draft: Draft;
  error: string | null;
  url: RefObject<HTMLInputElement | null>;
  file: RefObject<HTMLInputElement | null>;
  onWay: (way: MetadataWay) => void;
  onEdit: (next: Draft) => void;
  onLeave: () => void;
}) {
  const id = useId();
  const ways: { way: MetadataWay; words: string }[] = [
    { way: 'url', words: W.pasteUrl },
    { way: 'file', words: W.uploadFile },
  ];

  return (
    <fieldset className="sso-metadata">
      <legend className="desk-label">{W.metadata}</legend>
      <div className="sso-ways">
        {ways.map((one) => (
          <label key={one.way} className={draft.way === one.way ? 'sso-way is-picked' : 'sso-way'}>
            <input
              type="radio"
              className="sso-way-radio"
              name={`${id}-way`}
              checked={draft.way === one.way}
              onChange={() => onWay(one.way)}
            />
            {one.words}
          </label>
        ))}
      </div>
      {draft.way === 'url' ? (
        <div className="sso-field" onBlur={onLeave}>
          <Field
            label={W.metadataUrl}
            value={draft.url}
            inputRef={url}
            help={W.urlHelp}
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
              if (chosen != null) onEdit({ ...draft, file: chosen.name });
            }}
          />
          <label htmlFor={`${id}-file`} className="button sso-file-label">
            {draft.file == null ? W.chooseFile : W.chooseAnother}
          </label>
          {draft.file != null && <p className="desk-line is-ink sso-file-name">{draft.file}</p>}
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
