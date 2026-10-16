// One lift per platform; both at once is the double lift. iOS never moves the window, so
// the scroll view adjusts its insets. Android is edge to edge here, so the window does not
// resize either, and a KeyboardAvoidingView pads the content.
export interface KeyboardLift {
  avoid: 'padding' | null;
  adjustScrollInsets: boolean;
}

export function keyboardLift(os: string): KeyboardLift {
  if (os === 'ios') return { avoid: null, adjustScrollInsets: true };
  if (os === 'android') return { avoid: 'padding', adjustScrollInsets: false };

  return { avoid: null, adjustScrollInsets: false };
}
