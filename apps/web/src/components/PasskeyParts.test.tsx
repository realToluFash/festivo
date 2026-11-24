import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import { MakeDialog } from './PasskeyParts.tsx';

afterEach(() => vi.unstubAllGlobals());

it('closes Add a passkey with no error when the sheet says it is already saved (sc-86885)', async () => {
  vi.stubGlobal('PublicKeyCredential', class {});
  Object.defineProperty(navigator, 'credentials', {
    value: { create: () => Promise.reject(new DOMException('exists', 'InvalidStateError')) },
    configurable: true,
  });
  const add = vi.fn();
  const onClose = vi.fn();

  render(
    <MakeDialog
      options={() => Promise.resolve({ challenge: 'AAEC', user: { id: 'AQID' } })}
      add={add}
      onClose={onClose}
    />,
  );

  await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  expect(add).not.toHaveBeenCalled();
  expect(screen.queryByRole('alert')).toBeNull();
});
