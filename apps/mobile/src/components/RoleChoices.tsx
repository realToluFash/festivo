import { roleMeans } from '../kit/roleChoices.ts';
import { RadioMark } from './RadioMark.tsx';
import { Row, RowList, type RowTag } from './Summary.tsx';

/** Radio rows, each role with what it means; the picked one in Violet, a tag on the role held today, and any role not offered dimmed with why. */
export function RoleChoices<R extends string>({
  roles,
  picked,
  name = (role) => role,
  now,
  owned,
  lines,
  off,
  pickedTag,
  onPick,
  testID,
}: {
  roles: readonly R[];
  picked: R;
  name?: (role: R) => string;
  now?: { role: R; word: string } | null;
  owned?: { role: R; line: string };
  lines: Readonly<Partial<Record<R, string>>>;
  off?: { roles: readonly R[]; line: string } | undefined;
  pickedTag?: RowTag | null;
  onPick: (role: R) => void;
  testID: string;
}) {
  return (
    <RowList
      items={roles.map((role) => {
        const on = role === picked;
        const dim = off?.roles.includes(role) === true;
        const means = roleMeans(role, { lines, owned, off });
        const tag: RowTag | null =
          on && pickedTag != null
            ? pickedTag
            : now != null && role === now.role
              ? { kind: 'now', word: now.word }
              : null;

        return {
          key: role,
          row: (
            <Row
              title={name(role)}
              line={means === '' ? undefined : means}
              tag={tag}
              accent={on}
              off={dim}
              trail={<RadioMark on={on} />}
              onPress={() => onPick(role)}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              testID={`${testID}.${role}`}
            />
          ),
        };
      })}
    />
  );
}
