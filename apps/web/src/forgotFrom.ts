/** The step that sent somebody to Reset your password, when it is not Sign in. */
export type ForgotFrom = {
  back: 'code' | 'used' | 'expired' | 'invalid' | 'account' | 'join';
} | null;
