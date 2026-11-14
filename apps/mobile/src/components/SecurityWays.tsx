import type { Provider } from '@soirely/api-client';
import type { Ref } from 'react';
import { View, type ViewInstance } from 'react-native';
import { useTranslation } from 'react-i18next';

import {
  keptByRule,
  keptNote,
  lastWayIn,
  passwordLine,
  providerLine,
  type SecurityRules,
  unlinkNote,
  type WayIn,
  type Ways,
  waysFoot,
} from '../kit/securityPage.ts';
import { LEAD_INSET, LineIcon } from './AccountCard.tsx';
import { FieldError } from './Field.tsx';
import { OpenRow, Row, RowList, Section, TextAction } from './Summary.tsx';

/** Password, Google and Apple: the password opens its screen, a provider opens in place, and the last way in does not open. */
export function WaysSection({
  ways,
  rules,
  opened,
  error,
  busy = false,
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
  rules: SecurityRules;
  opened: string | null;
  /** What the server said to the opened row's offer. */
  error: string | null;
  busy?: boolean;
  passwordRef: Ref<ViewInstance>;
  linkRef: Ref<ViewInstance>;
  unlinkRef: Ref<ViewInstance>;
  onPassword: () => void;
  onBlock: (id: string, block: ViewInstance | null) => void;
  onToggle: (id: string) => void;
  onLink: (provider: Provider) => void;
  onUnlink: (provider: Provider) => void;
}) {
  const { t } = useTranslation();
  const last = lastWayIn(ways);
  const password = passwordLine(ways, t);

  return (
    <Section title={t('waysCard.title')} foot={waysFoot(ways, t)}>
      <RowList
        items={[
          {
            key: 'password',
            inset: LEAD_INSET,
            row: (
              <Row
                ref={passwordRef}
                title={t('waysCard.password')}
                line={password}
                lead={<LineIcon name="key" />}
                opens
                onPress={onPassword}
                accessibilityLabel={`${t('waysCard.password')}. ${password}`}
                testID="security.password"
              />
            ),
          },
          ...ways.providers.map((way) => {
            const line = providerLine(way, t);
            const label = `${way.name}. ${line}`;
            const lead = <LineIcon name="link" />;
            const open = opened === way.provider;

            return {
              key: way.provider,
              inset: LEAD_INSET,
              selected: open,
              row:
                last?.provider === way.provider ? (
                  <Row
                    title={way.name}
                    line={line}
                    lead={lead}
                    accessibilityLabel={label}
                    testID={`security.${way.provider}`}
                  />
                ) : (
                  <View ref={(block) => onBlock(way.provider, block)} collapsable={false}>
                    <OpenRow
                      title={way.name}
                      line={line}
                      lead={lead}
                      weight="semibold"
                      lit
                      open={open}
                      onToggle={() => onToggle(way.provider)}
                      accessibilityLabel={label}
                      testID={`security.${way.provider}`}
                    >
                      <ProviderOffer
                        way={way}
                        ways={ways}
                        rules={rules}
                        busy={busy}
                        linkRef={linkRef}
                        unlinkRef={unlinkRef}
                        onLink={onLink}
                        onUnlink={onUnlink}
                      />
                      {open && error != null && <FieldError message={error} />}
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
  way,
  ways,
  rules,
  busy,
  linkRef,
  unlinkRef,
  onLink,
  onUnlink,
}: {
  way: WayIn;
  ways: Ways;
  rules: SecurityRules;
  busy: boolean;
  linkRef: Ref<ViewInstance>;
  unlinkRef: Ref<ViewInstance>;
  onLink: (provider: Provider) => void;
  onUnlink: (provider: Provider) => void;
}) {
  const { t } = useTranslation();

  if (!way.linked)
    return (
      <TextAction
        ref={linkRef}
        label={t('waysCard.link', { provider: way.name })}
        off={busy}
        onPress={() => onLink(way.provider)}
        consequence={t('waysCard.linkNote', {
          provider: way.name,
          email: ways.email,
        })}
        testID={`security.${way.provider}.link`}
      />
    );
  if (rules.providerOnly != null && keptByRule(ways, way, rules))
    return (
      <TextAction
        label={t('security.unlinkKept')}
        off
        onPress={() => undefined}
        consequence={keptNote(ways, way, rules.providerOnly, t)}
        testID={`security.${way.provider}.unlink`}
      />
    );

  return (
    <TextAction
      ref={unlinkRef}
      label={t('waysCard.unlink')}
      removes
      off={busy}
      onPress={() => onUnlink(way.provider)}
      consequence={unlinkNote(ways, way, t)}
      accessibilityLabel={t('waysCard.unlinkLabel', { provider: way.name })}
      testID={`security.${way.provider}.unlink`}
    />
  );
}
