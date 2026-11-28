import type { StaffEntry } from '@soirely/api-client';
import { init, t } from 'i18next';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import en from '../../i18n/locales/en.json';
import { copyDelivered } from './copyLink.ts';

const { setStringAsync } = vi.hoisted(() => ({
  setStringAsync: vi.fn<(text: string) => Promise<boolean>>(),
}));
vi.mock('expo-clipboard', () => ({ setStringAsync }));

beforeAll(() =>
  init({
    lng: 'en',
    resources: { en: { translation: en } },
    interpolation: { escapeValue: false },
  }),
);

beforeEach(() => {
  setStringAsync.mockReset();
});

const url = 'https://soirely.test/s/abc123';
const answer = {
  url,
  staff: { id: 'st_1', fullName: 'Kunle Ajayi', link: 'copied' } as StaffEntry,
};

describe('copyDelivered', () => {
  it('holds the link in the field labelled for the person when the clipboard refuses', async () => {
    setStringAsync.mockImplementation(() => Promise.reject(new Error('refused')));

    const outcome = await copyDelivered(t, answer);

    expect(setStringAsync).toHaveBeenCalledWith(url);
    expect(outcome.held).toEqual({ label: 'Link for Kunle Ajayi', url });
    expect(outcome.said).toBe('The link could not be copied. Copy it from the link field.');
    expect(outcome.toast).toBeNull();
    expect(outcome.said).not.toBe('Link copied.');
    expect(outcome.staff.link).toBe('copied');
  });

  it('says the link was copied when the clipboard takes it', async () => {
    setStringAsync.mockResolvedValue(true);

    const outcome = await copyDelivered(t, answer);

    expect(outcome.held).toBeNull();
    expect(outcome.said).toBe('Link copied.');
    expect(outcome.toast).toBe('Link copied.');
    expect(outcome.staff.link).toBe('copied');
  });
});
