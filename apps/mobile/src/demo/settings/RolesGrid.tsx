import { levelOf, withExtra, withLevel } from '@soirely/domain';
import type { Ref, RefObject } from 'react';
import type { ViewInstance } from 'react-native';

import { tokens } from '../../theme/tokens.ts';
import { ConfettiSwitch } from './NotificationsSwitch.tsx';
import {
  type Area,
  AREAS,
  extrasFor,
  extrasLine,
  LEVEL_FILLED,
  LEVEL_WORDS,
  levelLine,
  levelsFor,
  lockedLine,
} from './RolesSample.ts';
import { ChoiceRow, HeadCount, LevelValue, OpenRow, Row, RowList, Section } from './Summary.tsx';

const OWNER_FOOT = 'Owner is given one person at a time, from Members.';

/** The role's areas as rows that read: each level beside its word, and a tap opens editing on that area. */
export function AccessRows({
  grant,
  owner,
  rowRefs,
  onOpen,
}: {
  grant: readonly string[];
  owner: boolean;
  rowRefs: RefObject<Record<string, ViewInstance | null>>;
  onOpen: (area: string) => void;
}) {
  return (
    <Section
      title="Access"
      right={<HeadCount text={`${AREAS.length} areas`} />}
      foot={owner ? OWNER_FOOT : undefined}
    >
      <RowList
        items={AREAS.map((area) => {
          const level = levelOf(grant, area.area);
          const line = extrasLine(grant, area);

          return {
            key: area.area,
            row: (
              <Row
                ref={(node) => {
                  rowRefs.current[area.area] = node;
                }}
                title={area.name}
                line={line}
                weight="medium"
                trail={<LevelValue filled={LEVEL_FILLED[level]} word={LEVEL_WORDS[level]} />}
                opens={!owner}
                onPress={owner ? undefined : () => onOpen(area.area)}
                accessibilityLabel={[area.name, LEVEL_WORDS[level], line]
                  .filter(Boolean)
                  .join('. ')}
                testID={`roles.access.${area.area}`}
              />
            ),
          };
        })}
      />
    </Section>
  );
}

/** Editing: one area open at a time, its levels as radios and its extras as switches; what the viewer cannot set is locked. */
export function AreaRows({
  grant,
  saved,
  held,
  open,
  rowRefs,
  onOpen,
  onChange,
}: {
  grant: string[];
  saved: readonly string[] | null;
  held: readonly string[];
  open: string | null;
  rowRefs: RefObject<Record<string, ViewInstance | null>>;
  onOpen: (area: string | null) => void;
  onChange: (grant: string[]) => void;
}) {
  return (
    <RowList
      items={AREAS.map((area) => ({
        key: area.area,
        row: (
          <AreaRow
            area={area}
            grant={grant}
            saved={saved}
            held={held}
            open={open === area.area}
            rowRef={(node) => {
              rowRefs.current[area.area] = node;
            }}
            onToggle={() => onOpen(open === area.area ? null : area.area)}
            onChange={onChange}
          />
        ),
      }))}
    />
  );
}

function AreaRow({
  area,
  grant,
  saved,
  held,
  open,
  rowRef,
  onToggle,
  onChange,
}: {
  area: Area;
  grant: string[];
  saved: readonly string[] | null;
  held: readonly string[];
  open: boolean;
  rowRef: Ref<ViewInstance>;
  onToggle: () => void;
  onChange: (grant: string[]) => void;
}) {
  const level = levelOf(grant, area.area);
  const levels = levelsFor(grant, held, area);
  const value = (
    <LevelValue filled={LEVEL_FILLED[level]} word={LEVEL_WORDS[level]} locked={levels.length < 2} />
  );

  if (levels.length < 2)
    return (
      <Row
        ref={rowRef}
        title={area.name}
        line={lockedLine(area.name)}
        weight="medium"
        trail={value}
        accessibilityLabel={`${area.name}. ${LEVEL_WORDS[level]}. ${lockedLine(area.name)}`}
        testID={`roles.area.${area.area}.fixed`}
      />
    );

  const now = saved == null ? null : levelOf(saved, area.area);
  const extras = level === 'nothing' ? [] : extrasFor(area);

  return (
    <OpenRow
      ref={rowRef}
      title={area.name}
      openLine={area.means}
      value={value}
      open={open}
      onToggle={onToggle}
      accessibilityLabel={`${area.name}. ${LEVEL_WORDS[level]}`}
      testID={`roles.area.${area.area}`}
      below={
        extras.length === 0
          ? undefined
          : extras.map((extra) => {
              const on = grant.includes(extra.permission);
              const locked = !held.includes(extra.permission);

              return (
                <Row
                  key={extra.permission}
                  title={extra.name}
                  line={locked ? lockedLine(extra.name) : extra.means}
                  pad={tokens.spaceSm}
                  trail={
                    <ConfettiSwitch
                      on={on}
                      words={{ on: extra.on, off: extra.off }}
                      label={extra.name}
                      locked={locked}
                      onChange={(next) => onChange(withExtra(grant, extra.permission, next))}
                      testID={`roles.extra.${extra.permission}`}
                    />
                  }
                />
              );
            })
      }
    >
      {levels.map((choice) => (
        <ChoiceRow
          key={choice}
          title={LEVEL_WORDS[choice]}
          line={levelLine(choice, area)}
          on={choice === level}
          tag={choice === now ? { kind: 'now', word: 'Now' } : null}
          onPress={() => onChange(withLevel(grant, area.area, choice, area.permissions))}
          testID={`roles.area.${area.area}.${choice}`}
        />
      ))}
    </OpenRow>
  );
}
