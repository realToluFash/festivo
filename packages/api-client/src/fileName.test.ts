import { describe, expect, it } from 'vitest';

import { downloadName } from './fileName.ts';

describe('downloadName', () => {
  it('reads filename* first, decoding letters outside ASCII', () => {
    expect(
      downloadName(
        "attachment; filename=export.zip; filename*=utf-8''Soir%C3%A9e%20%C3%A0%20Lisboa%202026-11-20.zip",
      ),
    ).toBe('Soirée à Lisboa 2026-11-20.zip');
  });

  it('reads filename* wherever it stands and whatever case its charset is in', () => {
    expect(
      downloadName(
        "attachment; filename*=UTF-8''Acme%20-%20Quote%20Co%20audit%20log%202026-11-20.csv; filename=audit-log.csv",
      ),
    ).toBe('Acme - Quote Co audit log 2026-11-20.csv');
  });

  it('reads filename when there is no filename*', () => {
    expect(downloadName('attachment; filename="Acme - Quote Co 2026-11-20.zip"')).toBe(
      'Acme - Quote Co 2026-11-20.zip',
    );
    expect(downloadName('attachment; filename=export.zip')).toBe('export.zip');
  });

  it('reads filename when filename* does not decode', () => {
    expect(downloadName("attachment; filename=export.zip; filename*=utf-8''%E0%A4%A")).toBe(
      'export.zip',
    );
    expect(downloadName("attachment; filename=export.zip; filename*=koi8-r''%C1")).toBe(
      'export.zip',
    );
  });

  it('gives no name when the header has neither, or there is no header', () => {
    expect(downloadName('attachment')).toBeNull();
    expect(downloadName(null)).toBeNull();
  });
});
