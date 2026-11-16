import { type ReactNode, type RefObject, useContext, useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

import { ActionPair } from './ActionPair.tsx';
import { Glyph } from './Glyph.tsx';
import { AskAlert } from './SettingsParts.tsx';
import { LayersContext, useDeskDialog } from '../layers.ts';
import { offButton } from '../offButton.ts';

/** Host 1, asked of a draft with no host (sc-22143). */
export interface HostOne {
  label: string;
  value: string;
  /** Said in place of the help, as Host 1 left empty is. */
  wrong: string | null;
  help: string;
  onType: (typed: string) => void;
}

export interface MakeLiveDialogProps {
  title: string;
  line: string;
  /** The line answers instead of asking, as a refusal does: an alert, and the title takes the focus when it turns. */
  told?: boolean;
  /** Turned into a question of its own, as the demo's offer to send is: the line and what follows are one body. */
  turned?: boolean;
  host?: HostOne | undefined;
  /** Host 1's box, which takes the focus while it is asked. */
  field?: RefObject<HTMLInputElement | null> | undefined;
  /** Under the line, before Host 1. */
  children?: ReactNode;
  failed?: string | undefined;
  keep: string;
  go?: string | undefined;
  /** The verb's words while it goes: it turns, and the way back and Escape wait. */
  busy?: string | undefined;
  onKeep: () => void;
  onGo?: () => void;
}

/** Make live in A's 400 dialog (sc-3971), the product's and the demo's. */
export function MakeLiveDialog(props: MakeLiveDialogProps) {
  const { host } = useContext(LayersContext);

  return host == null ? null : createPortal(<MakeLiveBox {...props} />, host);
}

function MakeLiveBox({
  title,
  line,
  told = false,
  turned = false,
  host,
  field,
  children,
  failed,
  keep,
  go,
  busy,
  onKeep,
  onGo,
}: MakeLiveDialogProps) {
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const keepButton = useRef<HTMLButtonElement>(null);
  const toldFirst = useRef(told);
  const waits = busy != null;

  useDeskDialog(
    box,
    turned ? heading : host != null && field != null ? field : keepButton,
    onKeep,
    waits,
  );

  useEffect(() => {
    if (turned || (told && !toldFirst.current)) heading.current?.focus();
  }, [turned, told]);

  const describedBy = [`${id}-line`, host == null ? null : `${id}-help`].filter(Boolean).join(' ');
  const alert = failed != null && <AskAlert>{failed}</AskAlert>;

  return (
    <>
      <div className="dialog-scrim is-over" aria-hidden="true" />
      <div
        ref={box}
        className="desk-ask ml-ask"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={describedBy}
      >
        <h2 ref={heading} id={`${id}-title`} tabIndex={turned || told ? -1 : undefined}>
          {title}
        </h2>
        {told ? (
          <AskAlert id={`${id}-line`}>{line}</AskAlert>
        ) : turned ? (
          <div className="desk-ask-body">
            <p id={`${id}-line`}>{line}</p>
            {children}
            {alert}
          </div>
        ) : (
          <>
            <p id={`${id}-line`}>{line}</p>
            {children}
            {host != null && (
              <HostField id={id} host={host} field={field} readOnly={waits} onGo={onGo} />
            )}
            {alert}
          </>
        )}
        <ActionPair
          className="desk-ask-pair"
          stacks={false}
          dismiss={
            <button
              ref={keepButton}
              type="button"
              className={waits ? 'desk-text desk-ask-keep is-waits' : 'desk-text desk-ask-keep'}
              {...offButton(waits, { dim: false })}
              onClick={onKeep}
            >
              {keep}
            </button>
          }
          confirm={
            go != null && (
              <button
                type="button"
                className={waits ? 'desk-text is-busy' : 'desk-text'}
                aria-busy={waits || undefined}
                {...offButton(waits, { dim: false })}
                onClick={onGo}
              >
                {waits && <span className="pending-spinner desk-turning" aria-hidden="true" />}
                {busy ?? go}
              </button>
            )
          }
        />
      </div>
    </>
  );
}

function HostField({
  id,
  host,
  field,
  readOnly,
  onGo,
}: {
  id: string;
  host: HostOne;
  field: RefObject<HTMLInputElement | null> | undefined;
  readOnly: boolean;
  onGo: (() => void) | undefined;
}) {
  const wrong = host.wrong != null;

  return (
    <div className="desk-field">
      <label htmlFor={`${id}-host`} className="desk-label">
        {host.label}
      </label>
      <div className={wrong ? 'desk-box is-wrong' : 'desk-box'}>
        <input
          ref={field}
          id={`${id}-host`}
          type="text"
          value={host.value}
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="go"
          aria-invalid={wrong}
          aria-describedby={`${id}-help`}
          readOnly={readOnly}
          onChange={(change) => host.onType(change.target.value.replaceAll(/[\r\n]+/gu, ' '))}
          onKeyDown={(key) => {
            if (key.key !== 'Enter' || key.nativeEvent.isComposing) return;
            key.preventDefault();
            onGo?.();
          }}
        />
      </div>
      {wrong ? (
        <p id={`${id}-help`} className="desk-error" role="alert">
          <Glyph name="alert" size={18} weight={2.2} />
          {host.wrong}
        </p>
      ) : (
        <p id={`${id}-help`} className="desk-help">
          {host.help}
        </p>
      )}
    </div>
  );
}
