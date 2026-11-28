<?php

declare(strict_types=1);

namespace App\Domain\Messaging\Audience;

use App\Entity\Event;
use App\Entity\GuestGroup;
use App\Enum\ErrorCode;
use App\Enum\GuestConditionType;
use App\Http\Exception\ApiException;
use App\Repository\GuestGroupRepository;
use Psl\Dict;
use Psl\Iter;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use Symfony\Component\Uid\Uuid;

/** @phpstan-type Condition array{type: string, groupId?: ?string} */
final readonly class GuestConditions
{
    public function __construct(
        private GuestGroupRepository $guestGroupRepository,
    ) {
    }

    /** @return list<Condition> */
    public function read(Event $event, mixed $raw): array
    {
        $shape = Type\vec(Type\dict(Type\string(), Type\mixed()));

        if (!$shape->matches($raw ?? [])) {
            throw ApiException::validation([['propertyPath' => 'conditions', 'message' => 'validation.audience_conditions_list', 'code' => ErrorCode::ValidationFailed->value]]);
        }

        $listed = $shape->coerce($raw ?? []);
        $conditions = [];

        foreach ($listed as $index => $condition) {
            $typed = $condition['type'] ?? null;
            $type = Type\string()->matches($typed) ? GuestConditionType::tryFrom($typed) : null;

            if (null === $type) {
                throw ApiException::validation([self::violation($index, 'validation.audience_condition_unknown', Type\string()->matches($typed) ? $typed : '?')]);
            }

            if (GuestConditionType::InGroup !== $type) {
                $conditions[] = ['type' => $type->value];

                continue;
            }

            $groupId = $condition['groupId'] ?? null;

            if (null !== $groupId && (!Type\string()->matches($groupId) || !Uuid::isValid($groupId) || [] === $this->guestGroupRepository->findEverIn($event, [$groupId]))) {
                throw ApiException::validation([self::violation($index, 'validation.audience_group_unknown')]);
            }

            $conditions[] = ['type' => $type->value, 'groupId' => null === $groupId ? null : Uuid::fromString($groupId)->toRfc4122()];
        }

        return $conditions;
    }

    /**
     * @param list<Condition> $conditions
     *
     * @return array{string, array<string, string>} the clause on `guests g`: none matches nobody, never everybody
     */
    public static function where(array $conditions): array
    {
        $clauses = [];
        $parameters = [];

        foreach ($conditions as $index => $condition) {
            $groupId = $condition['groupId'] ?? null;
            $sql = GuestConditionType::from($condition['type'])->sql(null !== $groupId);

            if (null !== $groupId) {
                $sql = Str\replace($sql, ':group', ':group' . $index);
                $parameters['group' . $index] = $groupId;
            }

            $clauses[] = '(' . $sql . ')';
        }

        return [[] === $clauses ? 'FALSE' : Str\join($clauses, ' AND '), $parameters];
    }

    /** @param list<Condition> $conditions */
    public function shown(Event $event, array $conditions): array
    {
        return Iter\first($this->shownEach($event, [$conditions])) ?? [];
    }

    /**
     * @param list<list<Condition>> $lists
     *
     * @return list<list<array<string, mixed>>> each group by its name now, and whether it was deleted, in one lookup
     */
    public function shownEach(Event $event, array $lists): array
    {
        $groups = Dict\from_entries(Vec\map(
            $this->guestGroupRepository->findEverIn($event, Vec\unique(Vec\filter_nulls(Vec\map(Vec\flatten($lists), static fn (array $condition): ?string => $condition['groupId'] ?? null)))),
            static fn (GuestGroup $group): array => [$group->getId()->toRfc4122(), $group],
        ));

        return Vec\map($lists, static fn (array $conditions): array => Vec\map($conditions, static function (array $condition) use ($groups): array {
            if (GuestConditionType::InGroup->value !== $condition['type']) {
                return ['type' => $condition['type']];
            }

            $group = $groups[$condition['groupId'] ?? ''] ?? null;

            return [
                'type' => $condition['type'],
                'groupId' => $condition['groupId'] ?? null,
                'group' => null === $group ? null : ['name' => $group->getName(), 'deleted' => $group->isDeleted()],
            ];
        }));
    }

    /** @return array{propertyPath: string, message: string, code: string, parameters: array<string, string>} */
    private static function violation(int $index, string $key, string $condition = ''): array
    {
        return ['propertyPath' => Str\format('conditions[%d]', $index), 'message' => $key, 'code' => ErrorCode::ValidationFailed->value, 'parameters' => ['{condition}' => $condition]];
    }
}
