import { createContext, useContext, useId, useLayoutEffect } from 'react';

interface Layers {
  stack: readonly string[];
  push: (id: string) => void;
  pop: (id: string) => void;
}

export const LayersContext = createContext<Layers>({ stack: [], push() {}, pop() {} });

/** A dialog takes the top of the stack while it is open: everything under it is inert. */
export function useLayer(): boolean {
  const id = useId();
  const { stack, push, pop } = useContext(LayersContext);

  useLayoutEffect(() => {
    push(id);

    return () => pop(id);
  }, [id, push, pop]);

  return stack.length > 0 && stack.at(-1) !== id;
}
