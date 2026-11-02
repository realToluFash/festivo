import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { offButton } from './offButton.ts';

function Saving({ onSave, onSubmit }: { onSave: () => void; onSubmit: () => void }) {
  const [off, setOff] = useState(false);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <button
        type="submit"
        {...offButton(off)}
        onClick={() => {
          onSave();
          setOff(true);
        }}
      >
        Save
      </button>
    </form>
  );
}

describe('a button that is off but keeps focus', () => {
  it('keeps focus as it turns off, and reads as dimmed', () => {
    render(<Saving onSave={() => {}} onSubmit={() => {}} />);
    const save = screen.getByRole('button', { name: 'Save' });
    save.focus();

    fireEvent.click(save);

    expect(document.activeElement).toBe(save);
    expect(save.getAttribute('aria-disabled')).toBe('true');
    expect(save.hasAttribute('disabled')).toBe(false);
    expect(save.tabIndex).toBe(0);
  });

  it('neither runs its click nor sends its form while it is off', () => {
    const onSave = vi.fn();
    const onSubmit = vi.fn();
    render(<Saving onSave={onSave} onSubmit={onSubmit} />);
    const save = screen.getByRole('button', { name: 'Save' });

    fireEvent.click(save);
    fireEvent.click(save);

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
