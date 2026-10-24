<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Organisation\OrganisationFounder;
use App\Domain\User\UserRegistrar;
use App\Entity\Role;
use App\Enum\SeededRole;
use App\Tests\FunctionalTestCase;
use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\DependencyFactory;
use Doctrine\Migrations\Version\Version;
use PHPUnit\Framework\Attributes\Test;
use Psl\SecureRandom;
use Psl\Type;

final class PreTransitionLeaverJoinedAtTest extends FunctionalTestCase
{
    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    private const string CREATED = '2026-10-10 09:00:00';

    #[Test]
    public function aMemberGoneBefore19OctJoinedWhenTheMembershipWasMade(): void
    {
        $membership = $this->membership('left_or_removed');
        $this->transition($membership, null, 'left_or_removed', '2026-10-19 12:00:00');

        $this->migrate();

        self::assertSame(self::CREATED, $this->joinedAt($membership));
    }

    #[Test]
    public function thatMemberAskingAgainAndTurnedDownStillJoinedWhenTheMembershipWasMade(): void
    {
        $membership = $this->membership('left_or_removed');
        $this->transition($membership, null, 'left_or_removed', '2026-10-19 12:00:00');
        $this->transition($membership, 'left_or_removed', 'pending_approval', '2026-10-22 10:00:00');
        $this->transition($membership, 'pending_approval', 'left_or_removed', '2026-10-23 10:00:00');

        $this->migrate();

        self::assertSame(self::CREATED, $this->joinedAt($membership));
    }

    #[Test]
    public function thatMemberStillWaitingOnTheirRequestJoinedWhenTheMembershipWasMade(): void
    {
        $membership = $this->membership('pending_approval');
        $this->transition($membership, null, 'left_or_removed', '2026-10-19 12:00:00');
        $this->transition($membership, 'left_or_removed', 'pending_approval', '2026-10-22 10:00:00');

        $this->migrate();

        self::assertSame(self::CREATED, $this->joinedAt($membership));
    }

    #[Test]
    public function aRequesterTurnedDownNeverJoined(): void
    {
        $membership = $this->membership('left_or_removed');
        $this->transition($membership, null, 'pending_approval', '2026-10-22 10:00:00');
        $this->transition($membership, 'pending_approval', 'left_or_removed', '2026-10-23 10:00:00');

        $this->migrate();

        self::assertNull($this->joinedAt($membership));
    }

    #[Test]
    public function aRequesterStillWaitingHasNotJoined(): void
    {
        $membership = $this->membership('pending_approval');
        $this->transition($membership, null, 'pending_approval', '2026-10-22 10:00:00');

        $this->migrate();

        self::assertNull($this->joinedAt($membership));
    }

    #[Test]
    public function aFormerMemberWhoAskedAgainKeepsTheirMoveIntoActive(): void
    {
        $membership = $this->membership('left_or_removed', '2026-10-20 08:00:00');
        $this->transition($membership, null, 'active', '2026-10-20 08:00:00');
        $this->transition($membership, 'active', 'left_or_removed', '2026-10-21 08:00:00');
        $this->transition($membership, 'left_or_removed', 'pending_approval', '2026-10-22 10:00:00');
        $this->transition($membership, 'pending_approval', 'left_or_removed', '2026-10-23 10:00:00');

        $this->migrate();

        self::assertSame('2026-10-20 08:00:00', $this->joinedAt($membership));
    }

    private function membership(string $status, ?string $joinedAt = null): string
    {
        $owner = self::service(UserRegistrar::class)->register('owner-' . \bin2hex(SecureRandom\bytes(4)) . '@ire.events', 'Folake', self::PASSWORD)->user;
        self::em()->flush();
        $organisation = self::service(OrganisationFounder::class)->found($owner, 'Ìrè Events', 'NG', 'Africa/Lagos');
        $user = self::service(UserRegistrar::class)->register('lola-' . \bin2hex(SecureRandom\bytes(4)) . '@example.com', 'Lola Legacy', self::PASSWORD)->user;
        self::em()->flush();
        $role = Type\instance_of(Role::class)->coerce(self::em()->getRepository(Role::class)->findOneBy(['organisation' => $organisation, 'seededAs' => SeededRole::ReadOnly]));

        $id = Type\string()->coerce(self::em()->getConnection()->fetchOne('SELECT gen_random_uuid()::text'));
        self::em()->getConnection()->executeStatement(
            'INSERT INTO memberships (id, organisation_id, user_id, role_id, status, created_at, updated_at, joined_at) VALUES (:id, :organisation, :user, :role, :status, :created, :created, :joined)',
            [
                'id' => $id,
                'organisation' => $organisation->getId()->toRfc4122(),
                'user' => $user->getId()->toRfc4122(),
                'role' => $role->getId()->toRfc4122(),
                'status' => $status,
                'created' => self::CREATED,
                'joined' => $joinedAt,
            ],
        );

        return $id;
    }

    private function transition(string $membership, ?string $from, string $to, string $at): void
    {
        self::em()->getConnection()->executeStatement(
            "INSERT INTO membership_transitions (id, membership_id, from_status, to_status, channel, occurred_at) VALUES (gen_random_uuid(), :membership, :from, :to, 'request', :at)",
            ['membership' => $membership, 'from' => $from, 'to' => $to, 'at' => $at],
        );
    }

    private function migrate(): void
    {
        $factory = self::serviceById('doctrine.migrations.dependency_factory', DependencyFactory::class);
        $migration = $factory->getMigrationRepository()->getMigration(new Version('DoctrineMigrations\Version20261024200000'))->getMigration();
        $migration->up(new Schema());

        foreach ($migration->getSql() as $query) {
            self::em()->getConnection()->executeStatement($query->getStatement());
        }

        self::em()->clear();
    }

    private function joinedAt(string $membership): ?string
    {
        return Type\nullable(Type\string())->coerce(self::em()->getConnection()->fetchOne('SELECT joined_at FROM memberships WHERE id = :id', ['id' => $membership]));
    }
}
