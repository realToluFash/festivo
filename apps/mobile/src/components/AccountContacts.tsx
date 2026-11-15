import { contactActions, contactsLeft, primaryFirst } from '@soirely/domain';
import type { Ref } from 'react';
import { StyleSheet, View, type ViewInstance } from 'react-native';
import { useTranslation } from 'react-i18next';

import {
  type Contact,
  type ContactKind,
  contactLine,
  contactsFoot,
  KIND_KEYS,
} from '../kit/accountPage.ts';
import { tokens } from '../theme/tokens.ts';
import { LEAD_INSET, LineIcon } from './AccountCard.tsx';
import { FieldError } from './Field.tsx';
import { Line, OpenRow, Row, RowList, Section, TextAction } from './Summary.tsx';

interface OfferRefs {
  sendRef: Ref<ViewInstance>;
  promoteRef: Ref<ViewInstance>;
  removeRef: Ref<ViewInstance>;
}

/** Email addresses or phone numbers: one row each, the primary first; any other opens in place with what it offers. */
export function ContactsSection({
  kind,
  rows,
  opened,
  error,
  addRef,
  sendRef,
  promoteRef,
  removeRef,
  onAdd,
  onBlock,
  onToggle,
  onVerify,
  onMakePrimary,
  onRemove,
}: {
  kind: ContactKind;
  rows: readonly Contact[];
  opened: string | null;
  /** Why the opened row's last step was refused, under its offers. */
  error?: string | null | undefined;
  addRef: Ref<ViewInstance>;
  onAdd: () => void;
  onBlock: (id: string, block: ViewInstance | null) => void;
  onToggle: (id: string) => void;
  onVerify: (row: Contact) => void;
  onMakePrimary: (row: Contact) => void;
  onRemove: (row: Contact) => void;
} & OfferRefs) {
  const { t } = useTranslation();
  const keys = KIND_KEYS[kind];
  const lead = <LineIcon name={kind === 'email' ? 'mail' : 'phone'} />;
  const unverified = { kind: 'notyet', word: t('contacts.unverified') } as const;

  return (
    <Section
      title={t(keys.section)}
      right={
        contactsLeft(rows) > 0 ? (
          <TextAction
            ref={addRef}
            label={t(keys.add)}
            onPress={onAdd}
            testID={`account.${kind}.add`}
          />
        ) : null
      }
      foot={contactsFoot(kind, rows, t)}
    >
      <RowList
        items={primaryFirst(rows).map((row) => {
          const line = contactLine(kind, row, t);
          const tag = row.verified ? null : unverified;
          const label = [row.shown, tag?.word, line].filter(Boolean).join('. ');
          const open = opened === row.id;

          return {
            key: row.id,
            inset: LEAD_INSET,
            selected: open,
            row: row.primary ? (
              <Row
                title={row.shown}
                line={line}
                lead={lead}
                tag={tag}
                accessibilityLabel={label}
                testID={`account.${row.id}`}
              />
            ) : (
              <View ref={(block) => onBlock(row.id, block)} collapsable={false}>
                <OpenRow
                  title={row.shown}
                  line={line}
                  lead={lead}
                  tag={tag}
                  weight="semibold"
                  lit
                  open={open}
                  onToggle={() => onToggle(row.id)}
                  accessibilityLabel={label}
                  testID={`account.${row.id}`}
                >
                  <Offers
                    kind={kind}
                    row={row}
                    error={open ? (error ?? null) : null}
                    sendRef={sendRef}
                    promoteRef={promoteRef}
                    removeRef={removeRef}
                    onVerify={onVerify}
                    onMakePrimary={onMakePrimary}
                    onRemove={onRemove}
                  />
                </OpenRow>
              </View>
            ),
          };
        })}
      />
    </Section>
  );
}

function Offers({
  kind,
  row,
  error,
  sendRef,
  promoteRef,
  removeRef,
  onVerify,
  onMakePrimary,
  onRemove,
}: {
  kind: ContactKind;
  row: Contact;
  error: string | null;
  onVerify: (row: Contact) => void;
  onMakePrimary: (row: Contact) => void;
  onRemove: (row: Contact) => void;
} & OfferRefs) {
  const { t } = useTranslation();
  const offers = contactActions(row);

  return (
    <>
      <View style={styles.actions}>
        {offers.verify && (
          <TextAction
            ref={sendRef}
            label={t('contacts.sendCode')}
            onPress={() => onVerify(row)}
            testID={`account.${row.id}.send`}
          />
        )}
        {offers.makePrimary && (
          <TextAction
            ref={promoteRef}
            label={t(KIND_KEYS[kind].makePrimary)}
            onPress={() => onMakePrimary(row)}
            testID={`account.${row.id}.primary`}
          />
        )}
        {offers.remove && (
          <TextAction
            ref={removeRef}
            label={t(offers.askBeforeRemoving ? 'contacts.removeAsks' : 'contacts.remove')}
            removes
            onPress={() => onRemove(row)}
            accessibilityLabel={t('contacts.remove')}
            testID={`account.${row.id}.remove`}
          />
        )}
      </View>
      <Line size={14} text={t('contacts.removeBody')} />
      {error != null && <FieldError message={error} answer={error} />}
    </>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', flexWrap: 'wrap', columnGap: tokens.space3xl },
});
