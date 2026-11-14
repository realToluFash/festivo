import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { setLanguage } from '../i18n/index.ts';
import { LanguagePicker } from './LanguagePicker.tsx';

function options(): string[] {
  return screen.getAllByRole('option').map((option) => option.textContent ?? '');
}

afterEach(async () => {
  vi.restoreAllMocks();
  localStorage.clear();
  await setLanguage(null);
});

describe('the language picker (sc-9797)', () => {
  it('lists the four languages and no Automatic in the signed-in app', () => {
    render(<LanguagePicker automatic={false} />);

    expect(options()).toEqual(['English', 'Español', 'Français', 'Português']);
  });

  it('shows the language the screen is in when nothing is stored', async () => {
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('pt-BR');
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['pt-BR']);
    await setLanguage(null);

    render(<LanguagePicker automatic={false} />);

    expect(screen.getByRole<HTMLSelectElement>('combobox').value).toBe('pt');
  });

  it('shows the stored language', async () => {
    await setLanguage('es');
    render(<LanguagePicker automatic={false} />);

    expect(screen.getByRole<HTMLSelectElement>('combobox').value).toBe('es');
  });

  it('offers Automatic first on the public and guest pages', () => {
    render(<LanguagePicker />);

    expect(options()).toHaveLength(5);
    expect(screen.getByRole<HTMLSelectElement>('combobox').value).toBe('');
    expect(options().slice(1)).toEqual(['English', 'Español', 'Français', 'Português']);
  });
});
