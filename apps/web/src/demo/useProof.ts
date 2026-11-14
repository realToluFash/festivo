import { type RefObject, useRef, useState } from 'react';

import { proofProblem, type Proving } from './members.ts';

/** The proof's fields and its check: the first field with a problem says so and takes the focus. */
export function useProof(
  start: Proving | null,
): [
  Proving | null,
  (proving: Proving | null) => void,
  RefObject<HTMLInputElement | null>,
  RefObject<HTMLInputElement | null>,
  () => boolean,
] {
  const [proving, setProving] = useState(start);
  const password = useRef<HTMLInputElement>(null);
  const code = useRef<HTMLInputElement>(null);
  const check = () => {
    if (proving == null) return true;
    const problem = proofProblem(proving.password, proving.code);
    if (problem == null) return true;

    setProving({ ...proving, problem });
    (problem.field === 'password' ? password : code).current?.focus();

    return false;
  };

  return [proving, setProving, password, code, check];
}
