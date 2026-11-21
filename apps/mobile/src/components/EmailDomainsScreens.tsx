import type { EmailDomain } from '@soirely/api-client';
import { normaliseDomain } from '@soirely/domain';
import { type RefObject, useRef, useState } from 'react';
import type { TextInputInstance } from 'react-native';
import { useTranslation } from 'react-i18next';

import { domainFieldProblem, recordFoot, removeAsks } from '../kit/emailDomains.ts';
import { StatusLine } from './DataParts.tsx';
import { FailureLine } from './FailureLine.tsx';
import { Field, focusChecked, focusRefused, keysStayDown, TextField } from './Field.tsx';
import { useReadOut } from './ReadOut.tsx';
import { RecordRows, useCopied } from './RecordRows.tsx';
import type { ScreenReaderTarget } from './screenReaderFocus.ts';
import { FocusedScreen, Line, TextAction } from './Summary.tsx';

/** Verify's state in the record: at rest, out, not found yet, or refused in the server's words. */
export type RecordCheck =
  | { kind: 'resting' }
  | { kind: 'checking' }
  | { kind: 'notFound' }
  | { kind: 'refused'; words: string };

/** The record to add where the domain's DNS is managed: Close, the title and Verify, the three values, and Remove at its foot. */
export function RecordScreen({
  open,
  domain,
  check,
  listed,
  removing,
  removeFailed,
  opener,
  onClose,
  onVerify,
  onRemove,
}: {
  open: boolean;
  domain: EmailDomain | null;
  check: RecordCheck;
  /** Off Enterprise the page is read only, so the record has no Remove. */
  listed: boolean;
  removing: boolean;
  removeFailed: string | null;
  opener: RefObject<ScreenReaderTarget | null>;
  onClose: () => void;
  onVerify: () => void;
  onRemove: (domain: EmailDomain, asked: boolean) => void;
}) {
  const { t } = useTranslation();
  const { copied, copy, clear } = useCopied();
  const [asking, setAsking] = useState(false);
  const checking = check.kind === 'checking';
  const name = domain?.domain ?? '';
  const values =
    domain == null
      ? []
      : [
          {
            label: t('ownerClaim.type'),
            value: domain.record.type,
            copied: t('ownerClaim.typeCopied'),
          },
          {
            label: t('ownerClaim.name'),
            value: domain.record.name,
            copied: t('ownerClaim.nameCopied'),
          },
          {
            label: t('ownerClaim.value'),
            value: domain.record.value,
            copied: t('ownerClaim.valueCopied'),
          },
        ];
  const asks = domain != null && removeAsks(domain);

  return (
    <FocusedScreen
      open={open && domain != null}
      title={t('emailDomains.record.title', { domain: name })}
      cancelLabel={t('emailDomains.record.close')}
      verb={{
        label: checking ? t('emailDomains.record.verifying') : t('emailDomains.record.verify'),
        on: !checking && !removing,
        busy: checking,
        onPress: onVerify,
        testID: 'emailDomains.record.verify',
      }}
      waits={removing}
      onCancel={onClose}
      cancelTestID="emailDomains.record.close"
      opener={opener}
      ask={
        asking && domain != null
          ? {
              title: t('emailDomains.removeAsk.title', { domain: name }),
              line: t('emailDomains.removeAsk.line'),
              keep: {
                label: t('emailDomains.removeAsk.keep'),
                testID: 'emailDomains.record.keep',
                off: removing,
              },
              confirm: {
                label: t('emailDomains.remove'),
                removes: true,
                busy: removing ? t('emailDomains.remove') : undefined,
                busyWords: t('emailDomains.remove'),
                testID: 'emailDomains.record.confirm',
              },
              failed: removeFailed,
              onKeep: () => {
                if (!removing) setAsking(false);
              },
              onConfirm: () => onRemove(domain, true),
            }
          : null
      }
      toast={copied == null ? null : { words: copied.copied, onClose: clear }}
      testID="emailDomains.record"
    >
      <Line quiet={false} text={t('emailDomains.record.lead', { domain: name })} />
      <RecordRows rows={values} copied={copied} onCopy={copy} testID="emailDomains.record.copy" />
      {check.kind === 'notFound' && <Answer words={t('emailDomains.record.notFound')} />}
      {check.kind === 'refused' && <Answer words={check.words} />}
      {domain != null && <Line text={recordFoot(t, domain)} />}
      {!asks && removeFailed != null && (
        <FailureLine words={removeFailed} testID="emailDomains.record.failed" />
      )}
      {listed && domain != null && (
        <TextAction
          label={asks ? t('emailDomains.removeAsks') : t('emailDomains.remove')}
          removes
          onPress={() => {
            if (removing) return;
            if (asks) setAsking(true);
            else onRemove(domain, false);
          }}
          accessibilityLabel={t('emailDomains.removeLabel', { domain: name })}
          testID="emailDomains.record.remove"
        />
      )}
    </FocusedScreen>
  );
}

function Answer({ words }: { words: string }) {
  useReadOut(words);

  return <StatusLine text={words} />;
}

/** Prove a domain: the one field, checked before it is sent, then the server's refusals under it. */
export function ProveScreen({
  open,
  example,
  opener,
  onCancel,
  onAdd,
}: {
  open: boolean;
  /** The domain of the reader's own address, as Company domain joining's example. */
  example: string;
  opener: RefObject<ScreenReaderTarget | null>;
  onCancel: () => void;
  /** Answers the server's words for a refused domain, or null once it is added; throws on any other failure. */
  onAdd: (domain: string) => Promise<string | null>;
}) {
  const { t } = useTranslation();
  const typed = useRef('');
  const input = useRef<TextInputInstance>(null);
  const [error, setError] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function add(): Promise<void> {
    if (busy) return;
    const problem = domainFieldProblem(t, typed.current, example);
    setError(problem);
    if (problem != null) {
      focusChecked(input);
      return;
    }
    keysStayDown();
    setBusy(true);
    setFailed(null);
    try {
      const refusal = await onAdd(normaliseDomain(typed.current));
      if (refusal != null) {
        setError(refusal);
        focusRefused(input);
      }
    } catch {
      setFailed(t('companyDomains.failed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <FocusedScreen
      open={open}
      title={t('emailDomains.add.title')}
      verb={{
        label: t('emailDomains.add.verb'),
        on: !busy,
        busy,
        onPress: () => void add(),
        testID: 'emailDomains.prove.add',
      }}
      waits={busy}
      onCancel={onCancel}
      cancelTestID="emailDomains.prove.cancel"
      opener={opener}
      testID="emailDomains.proveScreen"
    >
      {failed != null && <FailureLine words={failed} testID="emailDomains.prove.failed" />}
      <Field
        label={t('emailDomains.add.field')}
        error={error}
        help={t('emailDomains.add.help', { example })}
      >
        <TextField
          ref={input}
          defaultValue=""
          placeholder={example}
          onChangeText={(text) => {
            typed.current = text;
            if (error != null && domainFieldProblem(t, text, example) == null) setError(null);
          }}
          wrong={error != null}
          submitting={busy}
          keyboardType="url"
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={() => void add()}
          submitBehavior="submit"
          accessibilityLabel={t('emailDomains.add.field')}
          testID="emailDomains.prove.field"
        />
      </Field>
    </FocusedScreen>
  );
}
