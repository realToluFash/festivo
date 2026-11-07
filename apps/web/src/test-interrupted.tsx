import { act, render } from '@testing-library/react';
import { startTransition, use, type ReactNode } from 'react';

/** Renders `ui` in a transition that suspends once, so React abandons that render and restarts it on `release`. */
export async function renderInterrupted(
  ui: ReactNode,
): Promise<ReturnType<typeof render> & { release: () => Promise<void> }> {
  let resolve = () => {};
  const ready = new Promise<void>((done) => (resolve = done));

  function Slow(): ReactNode {
    use(ready);
    return null;
  }

  const rendered = render(<></>);
  await act(async () =>
    startTransition(() =>
      rendered.rerender(
        <>
          {ui}
          <Slow />
        </>,
      ),
    ),
  );

  return {
    ...rendered,
    release: async () => {
      await act(async () => {
        resolve();
        await ready;
      });
    },
  };
}
