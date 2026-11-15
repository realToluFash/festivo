<?php

declare(strict_types=1);

namespace App\Domain\Messaging\Audience;

use App\Domain\Messaging\Interfaces\AudienceResolverInterface;
use App\Domain\Messaging\Model\Audience;
use App\Domain\Messaging\Model\Recipient;
use App\Domain\User\Mail\AccountLanguage;
use App\Entity\User;
use App\Enum\EventRole;
use App\Enum\MembershipStatus;
use App\Enum\NotificationAudienceKind;
use App\Enum\SeededRole;
use App\Http\Access\Interfaces\MembershipDirectoryInterface;
use BackedEnum;
use Doctrine\DBAL\ArrayParameterType;
use Doctrine\DBAL\Connection;
use Doctrine\DBAL\ParameterType;
use Doctrine\ORM\EntityManagerInterface;
use InvalidArgumentException;
use Psl\Type;
use Psl\Vec;
use Symfony\Component\Uid\Uuid;

/** An organisation's active members, by permission, by role, or named, and on one event when the audience names it (sc-29912), read when the notification goes. */
final readonly class MemberAudienceResolver implements AudienceResolverInterface
{
    public function __construct(
        private Connection $connection,
        private EntityManagerInterface $entityManager,
        private MembershipDirectoryInterface $membershipDirectory,
        private AccountLanguage $accountLanguage,
    ) {
    }

    public function kind(): NotificationAudienceKind
    {
        return NotificationAudienceKind::Member;
    }

    /** A superset by role; recipient() then asks the grants themselves, which sign-in rules narrow (sc-69). */
    public function resolve(Audience $audience, ?Uuid $after, int $limit): array
    {
        return $this->matching($audience, $after, null, $limit);
    }

    public function recipient(Audience $audience, Uuid $id): ?Recipient
    {
        $organisationId = $audience->organisationId ?? throw new InvalidArgumentException('A member audience names its organisation.');
        $user = $this->entityManager->find(User::class, $id);

        if (null === $user) {
            return null;
        }

        $grants = null === $audience->eventId
            ? $this->membershipDirectory->grantsIn($user, $organisationId)
            : $this->membershipDirectory->grantsOnEvent($user, $organisationId, $audience->eventId);
        $stillIn = null !== $grants
            && (null === $audience->permission || $grants->holds($audience->permission))
            && [] !== $this->matching($audience, null, $id, 1);

        if (!$stillIn) {
            return null;
        }

        return new Recipient(
            NotificationAudienceKind::Member,
            $user->getId(),
            $user->getName(),
            $this->accountLanguage->of($user),
            $user->getPrimaryEmailAddress()?->getAddress(),
        );
    }

    /** @return list<Uuid> */
    private function matching(Audience $audience, ?Uuid $after, ?Uuid $only, int $limit): array
    {
        $organisationId = $audience->organisationId ?? throw new InvalidArgumentException('A member audience names its organisation.');

        $ids = $this->connection->fetchFirstColumn(
            <<<'SQL'
                SELECT m.user_id
                FROM memberships m
                JOIN roles r ON r.id = m.role_id
                JOIN users u ON u.id = m.user_id
                JOIN organisations o ON o.id = m.organisation_id
                WHERE m.organisation_id = :organisation
                  AND m.status = :active
                  AND u.deleted_at IS NULL
                  AND o.deleted_at IS NULL
                  AND (CAST(:event AS UUID) IS NULL OR r.seeded_as <> :member OR EXISTS (
                      SELECT 1 FROM event_people p WHERE p.event_id = CAST(:event AS UUID) AND p.membership_id = m.id
                  ))
                  AND (CAST(:permission AS TEXT) IS NULL OR r.seeded_as IN (:holding) OR EXISTS (
                      SELECT 1 FROM event_people p WHERE p.event_id = CAST(:event AS UUID) AND p.membership_id = m.id AND p.role IN (:eventRoles)
                  ))
                  AND (CAST(:role AS UUID) IS NULL OR r.id = CAST(:role AS UUID))
                  AND (:anyNamed = 0 OR m.user_id IN (:named))
                  AND m.user_id NOT IN (:except)
                  AND (CAST(:after AS UUID) IS NULL OR m.user_id > CAST(:after AS UUID))
                  AND (CAST(:one AS UUID) IS NULL OR m.user_id = CAST(:one AS UUID))
                ORDER BY m.user_id
                LIMIT :limit
                SQL,
            [
                'organisation' => $organisationId->toRfc4122(),
                'active' => MembershipStatus::Active->value,
                'member' => SeededRole::Member->value,
                'event' => $audience->eventId?->toRfc4122(),
                'permission' => $audience->permission?->value,
                'holding' => self::values(null === $audience->permission ? [] : $audience->permission->defaultRoles()),
                'eventRoles' => self::values(null === $audience->permission ? [] : EventRole::holding($audience->permission)),
                'role' => $audience->roleId?->toRfc4122(),
                'anyNamed' => [] === $audience->only ? 0 : 1,
                'named' => self::ids($audience->only),
                'except' => self::ids($audience->except),
                'after' => $after?->toRfc4122(),
                'one' => $only?->toRfc4122(),
                'limit' => $limit,
            ],
            [
                'named' => ArrayParameterType::STRING,
                'holding' => ArrayParameterType::STRING,
                'eventRoles' => ArrayParameterType::STRING,
                'except' => ArrayParameterType::STRING,
                'anyNamed' => ParameterType::INTEGER,
                'limit' => ParameterType::INTEGER,
            ],
        );

        return Vec\map($ids, static fn (mixed $id): Uuid => Uuid::fromString(Type\string()->coerce($id)));
    }

    /**
     * An empty string stands in for an empty list, which `IN ()` cannot be: it matches no role.
     *
     * @param list<BackedEnum> $cases
     *
     * @return non-empty-list<string>
     */
    private static function values(array $cases): array
    {
        return [] === $cases ? [''] : Vec\map($cases, static fn (BackedEnum $case): string => (string) $case->value);
    }

    /**
     * The nil id stands in for an empty list, which `IN ()` cannot be.
     *
     * @param list<Uuid> $ids
     *
     * @return non-empty-list<string>
     */
    private static function ids(array $ids): array
    {
        return [] === $ids ? ['00000000-0000-0000-0000-000000000000'] : Vec\map($ids, static fn (Uuid $id): string => $id->toRfc4122());
    }
}
