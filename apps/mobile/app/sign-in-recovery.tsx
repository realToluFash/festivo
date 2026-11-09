import { SignInSecondFactor } from '../src/steps/SignInSecondFactor.tsx';

/** "Enter a recovery code", opened from Enter your code. */
export default function SignInRecovery() {
  return <SignInSecondFactor recovery />;
}
