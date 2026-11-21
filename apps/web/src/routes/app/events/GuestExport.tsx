import {
  type ExportFormat,
  type ExportScope,
  exportColumns,
  exportFileName,
  exportScope,
} from '@soirely/domain';
import { type RefObject, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../../../api.ts';
import { Glyph } from '../../../components/Glyph.tsx';
import { Dialog, Note, RowWords } from '../../../components/SettingsParts.tsx';
import { offButton } from '../../../offButton.ts';
import { useServerNow } from '../../../serverNow.ts';
import './guestExport.css';

interface Option<Key extends string> {
  key: Key;
  name: string;
  line?: string;
  off?: boolean;
}

type Making = 'ready' | 'preparing' | 'failed';

/** sc-3784: Export at a desk, one dialog: who's in it, the format, the file and its columns, then the safety note directly above Download, as `/demo/guests?state=export` draws it. */
export function ExportDialog({
  event,
  inView,
  everyone,
  narrowing,
  needs,
  onClose,
  onReady,
}: {
  event: { id: string; name: string; timeZone: string };
  /** The ids in This view and on the whole list, each in the list's order. */
  inView: readonly string[];
  everyone: readonly string[];
  narrowing: string;
  needs: boolean;
  onClose: () => void;
  onReady: (file: string) => void;
}) {
  const { t } = useTranslation();
  const now = useServerNow();
  const [asked, setAsked] = useState<ExportScope>('view');
  const [format, setFormat] = useState<ExportFormat>('xlsx');
  const [making, setMaking] = useState<Making>('ready');
  const first = useRef<HTMLInputElement>(null);
  const scope = exportScope(asked, inView.length);
  const file = exportFileName(t, event, now, format);
  const busy = making === 'preparing';

  async function download(): Promise<void> {
    if (busy) return;
    setMaking('preparing');

    try {
      const bytes = await api.exportGuests(event.id, {
        format,
        scope,
        people: scope === 'view' ? inView : everyone,
      });

      save(bytes, file, format);
      onReady(file);
    } catch {
      setMaking('failed');
    }
  }

  return (
    <Dialog
      title={t('guestExport.title')}
      verb={null}
      locked={busy}
      first={first}
      onDismiss={onClose}
      onConfirm={() => void download()}
    >
      {making === 'failed' && (
        <p className="gs-x-failed" role="alert">
          <Glyph name="alert" size={18} weight={2.2} />
          {t('guestExport.failed')}
        </p>
      )}
      <Radios
        legend={t('guestExport.who')}
        options={[
          {
            key: 'view',
            name: t('guestExport.thisView', { count: inView.length }),
            line: inView.length === 0 ? t('guestExport.nothingInView') : narrowing,
            off: inView.length === 0,
          },
          { key: 'all', name: t('guestExport.allGuests', { count: everyone.length }) },
        ]}
        picked={scope}
        first={first}
        className="gs-x-who"
        onPick={setAsked}
      />
      <Radios
        legend={t('guestExport.format')}
        options={[
          { key: 'xlsx', name: t('guestExport.excel') },
          { key: 'csv', name: t('guestExport.csv') },
        ]}
        picked={format}
        onPick={setFormat}
      />
      <section className="gs-x-file" aria-label={t('guestExport.file')}>
        <p className="gs-x-name">
          <Glyph name="page" size={18} weight={2.2} />
          <span>{file}</span>
        </p>
        <p className="desk-line is-small">{t('guestExport.columns')}</p>
        <ul className="gs-x-columns">
          {exportColumns(needs).map((column) => (
            <li key={column}>{t(`guestExport.column.${column}`)}</li>
          ))}
        </ul>
      </section>
      {!needs && <Note>{t('guestExport.noNeeds')}</Note>}
      <div className="gs-x-foot">
        <p className="desk-line is-small">{t('guestExport.safety')}</p>
        <button
          type="button"
          className="gs-pill is-primary is-tall gs-x-go"
          aria-busy={busy || undefined}
          {...offButton(busy, { dim: false })}
          onClick={() => void download()}
        >
          {busy && <span className="pending-spinner desk-turning" aria-hidden="true" />}
          {busy ? t('guestExport.preparing') : t('guestExport.download')}
        </button>
      </div>
    </Dialog>
  );
}

const TYPES: Record<ExportFormat, string> = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv;charset=utf-8',
};

/** The browser saves the file under the name the dialog showed. */
function save(bytes: Uint8Array<ArrayBuffer>, name: string, format: ExportFormat): void {
  const url = URL.createObjectURL(new Blob([bytes], { type: TYPES[format] }));
  const link = document.createElement('a');

  link.href = url;
  link.download = name;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function Radios<Key extends string>({
  legend,
  options,
  picked,
  first,
  className,
  onPick,
}: {
  legend: string;
  options: readonly Option<Key>[];
  picked: Key;
  first?: RefObject<HTMLInputElement | null>;
  className?: string;
  onPick: (key: Key) => void;
}) {
  const name = useId();

  return (
    <fieldset className={className == null ? 'desk-choices' : `desk-choices ${className}`}>
      <legend className="desk-legend">{legend}</legend>
      <ul className="desk-rows">
        {options.map((option) => {
          const on = option.key === picked;
          const classes = ['desk-row', on && 'is-picked', option.off === true && 'gs-x-off'];

          return (
            <li key={option.key}>
              <label className={classes.filter(Boolean).join(' ')}>
                <RowWords title={option.name} lines={option.line == null ? [] : [option.line]} />
                <input
                  ref={on ? first : undefined}
                  type="radio"
                  className="desk-radio"
                  name={name}
                  checked={on}
                  disabled={option.off}
                  onChange={() => onPick(option.key)}
                />
              </label>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}
