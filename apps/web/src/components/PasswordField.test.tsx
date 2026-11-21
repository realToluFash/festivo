import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import '../i18n/index.ts';
import { PasswordField } from './PasswordField.tsx';

function field(): HTMLInputElement {
  return document.getElementById('password') as HTMLInputElement;
}

describe('the password field', () => {
  it('is hidden by default, and the control names the state it moves to', () => {
    render(<PasswordField id="password" autoComplete="current-password" />);

    expect(field().type).toBe('password');
    expect(screen.getByRole('button', { name: 'Show' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('keeps what was typed through a reveal and a hide', () => {
    render(<PasswordField id="password" autoComplete="current-password" />);
    fireEvent.change(field(), { target: { value: 'a long passphrase here' } });

    fireEvent.click(screen.getByRole('button', { name: 'Show' }));
    expect(field().type).toBe('text');
    expect(field().value).toBe('a long passphrase here');

    fireEvent.click(screen.getByRole('button', { name: 'Hide' }));
    expect(field().type).toBe('password');
    expect(field().value).toBe('a long passphrase here');
  });

  it('takes a paste, and never corrects what is revealed', () => {
    render(<PasswordField id="password" autoComplete="new-password" />);

    const pasted = fireEvent.paste(field(), { clipboardData: { getData: () => 'from a manager' } });
    expect(pasted, 'nothing cancels the paste').toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Show' }));
    expect(field().getAttribute('autocorrect')).toBe('off');
    expect(field().getAttribute('autocapitalize')).toBe('none');
    expect(field().getAttribute('spellcheck')).toBe('false');
  });

  it('hides again when the form is submitted', () => {
    const { rerender } = render(<PasswordField id="password" autoComplete="current-password" />);
    fireEvent.click(screen.getByRole('button', { name: 'Show' }));

    rerender(<PasswordField id="password" autoComplete="current-password" submitting />);

    expect(field().type).toBe('password');
  });

  it('hides again when the tab is left', () => {
    render(<PasswordField id="password" autoComplete="current-password" />);
    fireEvent.click(screen.getByRole('button', { name: 'Show' }));

    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });

    expect(field().type).toBe('password');
  });
});
