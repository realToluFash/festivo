import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PasteCode } from './PasteCode.tsx';

function Board() {
  const [code, setCode] = useState('');

  return (
    <>
      <label htmlFor="code">Code</label>
      <input id="code" value={code} onChange={(event) => setCode(event.target.value)} />
      <PasteCode field="code" />
    </>
  );
}

function copied(read: () => Promise<string>) {
  vi.stubGlobal('navigator', { ...navigator, clipboard: { readText: read } });
}

const press = async () => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button'));
    await Promise.resolve();
  });
};

describe('Paste code (sc-99215)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reads nothing until pressed, then fills the code and focuses the field', async () => {
    const read = vi.fn(() => Promise.resolve('*482193* is your verification code.'));
    copied(read);
    render(<Board />);
    expect(read).not.toHaveBeenCalled();
    await press();
    const field = screen.getByLabelText('Code');
    expect(field).toHaveProperty('value', '482193');
    expect(document.activeElement).toBe(field);
  });

  it('says nothing was found for a phone number and keeps the field, until the person types', async () => {
    copied(() => Promise.resolve('+234 801 234 5678'));
    render(<Board />);
    const field = screen.getByLabelText('Code');
    fireEvent.change(field, { target: { value: '12' } });
    await press();
    expect(field).toHaveProperty('value', '12');
    expect(screen.getByRole('status').textContent).not.toBe('');
    fireEvent.input(field, { target: { value: '123' } });
    expect(screen.getByRole('status').textContent).toBe('');
  });

  it('only focuses the field when the browser refuses', async () => {
    copied(() => Promise.reject(new Error('denied')));
    render(<Board />);
    await press();
    expect(document.activeElement).toBe(screen.getByLabelText('Code'));
    expect(screen.getByRole('status').textContent).toBe('');
  });
});
