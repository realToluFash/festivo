import { act, fireEvent, render, screen } from '@testing-library/react';
import { useRef, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PasteCode } from './PasteCode.tsx';
import { NOTHING_TO_PASTE } from './pasteCode.ts';
import { usePasteCode } from './usePasteCode.ts';

function Board() {
  const field = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState('');
  const paste = usePasteCode(field, setCode);

  return (
    <>
      <label htmlFor="code">Code from WhatsApp</label>
      <input
        id="code"
        ref={field}
        value={code}
        onChange={(event) => {
          setCode(event.target.value);
          paste.typed();
        }}
      />
      <PasteCode id="code-paste" paste={paste} />
    </>
  );
}

function copied(read: () => Promise<string>) {
  vi.stubGlobal('navigator', { ...navigator, clipboard: { readText: read } });
}

const press = async () => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Paste code' }));
    await Promise.resolve();
  });
};

describe('Paste code on the web (sc-99215)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('fills the six digits from a whole message and moves focus to the field', async () => {
    const read = vi.fn(() => Promise.resolve('*482193* is your verification code.'));
    copied(read);
    render(<Board />);
    expect(read).not.toHaveBeenCalled();
    await press();
    const field = screen.getByLabelText('Code from WhatsApp');
    expect(field).toHaveProperty('value', '482193');
    expect(document.activeElement).toBe(field);
  });

  it('says Nothing to paste for a phone number and leaves the field as it was, until the person types', async () => {
    copied(() => Promise.resolve('+234 801 234 5678'));
    render(<Board />);
    const field = screen.getByLabelText('Code from WhatsApp');
    fireEvent.change(field, { target: { value: '12' } });
    await press();
    expect(field).toHaveProperty('value', '12');
    expect(screen.getByRole('status').textContent).toBe(NOTHING_TO_PASTE);
    fireEvent.change(field, { target: { value: '123' } });
    expect(screen.getByRole('status').textContent).toBe('');
  });

  it('only moves focus when the browser refuses the read', async () => {
    copied(() => Promise.reject(new Error('denied')));
    render(<Board />);
    await press();
    expect(document.activeElement).toBe(screen.getByLabelText('Code from WhatsApp'));
    expect(screen.getByRole('status').textContent).toBe('');
  });
});
