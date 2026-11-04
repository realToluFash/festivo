import { router } from 'expo-router';

import { PrimaryButton } from '../../../src/components/Buttons.tsx';
import { DemoScreen, NavBar } from '../../../src/demo/DemoScreen.tsx';
import { Heading } from '../../../src/steps/Lines.tsx';

/** A link expired or used says so in the title, with one button. */
export default function LinkExpired() {
  return (
    <DemoScreen
      nav={<NavBar left="close" />}
      foot={
        <PrimaryButton
          label="Send a new link"
          onPress={() => router.replace('/demo/link-sent')}
          testID="demo.newLink"
        />
      }
    >
      <Heading
        title="This link has expired"
        intro="Reset links only work for a short time. Send a new one and use the newest email."
      />
    </DemoScreen>
  );
}
