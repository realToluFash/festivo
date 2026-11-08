import type { Ref } from 'react';
import { View, type ViewInstance } from 'react-native';

import { LEAD_INSET, LineIcon } from './AccountCard.tsx';
import {
  keptByRule,
  keptNote,
  lastWayIn,
  linkNote,
  passwordLine,
  providerLine,
  type Rules,
  unlinkNote,
  waysFoot,
  WORDS,
} from './SecurityModel.ts';
import { type Provider, PROVIDERS, type Ways } from './SecuritySample.ts';
import { OpenRow, Row, RowList, Section, TextAction } from '../../components/Summary.tsx';

/** Password, Google and Apple: the password opens its screen, a provider opens in place, and the last way in does not open. */
export function WaysSection({
  ways,
  rules,
  opened,
  passwordRef,
  linkRef,
  unlinkRef,
  onPassword,
  onBlock,
  onToggle,
  onLink,
  onUnlink,
}: {
  ways: Ways;
  rules: Rules;
  opened: string | null;
  passwordRef: Ref<ViewInstance>;
  linkRef: Ref<ViewInstance>;
  unlinkRef: Ref<ViewInstance>;
  onPassword: () => void;
  onBlock: (id: string, block: ViewInstance | null) => void;
  onToggle: (id: string) => void;
  onLink: (provider: Provider) => void;
  onUnlink: (provider: Provider) => void;
}) {
  const last = lastWayIn(ways);
  const password = passwordLine(ways);

  return (
    <Section title={WORDS.ways} foot={waysFoot(ways)}>
      <RowList
        items={[
          {
            key: 'password',
            inset: LEAD_INSET,
            row: (
              <Row
                ref={passwordRef}
                title={WORDS.password}
                line={password}
                lead={<LineIcon name="key" />}
                opens
                onPress={onPassword}
                accessibilityLabel={`${WORDS.password}. ${password}`}
                testID="security.password"
              />
            ),
          },
          ...PROVIDERS.map((provider) => {
            const line = providerLine(ways, provider);
            const label = `${provider}. ${line}`;
            const lead = <LineIcon name="link" />;
            const open = opened === provider;

            return {
              key: provider,
              inset: LEAD_INSET,
              selected: open,
              row:
                last === provider ? (
                  <Row
                    title={provider}
                    line={line}
                    lead={lead}
                    accessibilityLabel={label}
                    testID={`security.${provider}`}
                  />
                ) : (
                  <View ref={(block) => onBlock(provider, block)} collapsable={false}>
                    <OpenRow
                      title={provider}
                      line={line}
                      lead={lead}
                      weight="semibold"
                      lit
                      open={open}
                      onToggle={() => onToggle(provider)}
                      accessibilityLabel={label}
                      testID={`security.${provider}`}
                    >
                      <ProviderOffer
                        provider={provider}
                        ways={ways}
                        rules={rules}
                        linkRef={linkRef}
                        unlinkRef={unlinkRef}
                        onLink={onLink}
                        onUnlink={onUnlink}
                      />
                    </OpenRow>
                  </View>
                ),
            };
          }),
        ]}
      />
    </Section>
  );
}

function ProviderOffer({
  provider,
  ways,
  rules,
  linkRef,
  unlinkRef,
  onLink,
  onUnlink,
}: {
  provider: Provider;
  ways: Ways;
  rules: Rules;
  linkRef: Ref<ViewInstance>;
  unlinkRef: Ref<ViewInstance>;
  onLink: (provider: Provider) => void;
  onUnlink: (provider: Provider) => void;
}) {
  if (!ways[provider])
    return (
      <TextAction
        ref={linkRef}
        label={`Link ${provider}`}
        onPress={() => onLink(provider)}
        consequence={linkNote(provider)}
        testID={`security.${provider}.link`}
      />
    );
  if (keptByRule(ways, provider, rules))
    return (
      <TextAction
        label={WORDS.unlinkKept}
        off
        onPress={() => undefined}
        consequence={keptNote(provider)}
        testID={`security.${provider}.unlink`}
      />
    );

  return (
    <TextAction
      ref={unlinkRef}
      label={WORDS.unlink}
      removes
      onPress={() => onUnlink(provider)}
      consequence={unlinkNote(ways, provider)}
      accessibilityLabel={WORDS.unlinkKept}
      testID={`security.${provider}.unlink`}
    />
  );
}
