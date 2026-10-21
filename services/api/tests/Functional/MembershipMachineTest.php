<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Organisation\Members\MembershipMachine;
use App\Entity\Membership;
use App\Entity\MembershipTransition;
use App\Entity\Organisation;
use App\Entity\Role;
use App\Entity\User;
use App\Enum\MembershipChannel;
use App\Enum\MembershipStatus;
use App\Enum\SeededRole;
use App\Http\Access\Interfaces\MembershipDirectoryInterface;
use App\Tests\FunctionalTestCase;
use App\Tests\Traits\InvitesPeople;
use Doctrine\DBAL\Exception\NotNullConstraintViolationException;
use Doctrine\DBAL\Exception\UniqueConstraintViolationException;
use LogicException;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use Psl\Type;
use Psl\Vec;

final class MembershipMachineTest extends FunctionalTestCase
{
    use InvitesPeople;

    /** @return iterable<string, array{MembershipStatus}> */
    public static function grantingNothing(): iterable
    {
        yield 'suspended' => [MembershipStatus::Suspended];
        yield 'left or removed' => [MembershipStatus::LeftOrRemoved];
    }

    #[Test]
    #[DataProvider('grantingNothing')]
    public function onlyActiveGrantsAnything(MembershipStatus $state): void
    {
        [$organisation, $member, $membership] = $this->member();
        self::assertNotNull(self::service(MembershipDirectoryInterface::class)->grantsIn($member, $organisation->getId()));

        $this->machine()->move($membership, $state, MembershipChannel::Invitation, null);
        self::em()->flush();

        self::assertNull(self::service(MembershipDirectoryInterface::class)->grantsIn($member, $organisation->getId()));
    }

    #[Test]
    public function awaitingApprovalGrantsNothing(): void
    {
        $organisation = self::organisationFor(self::inviter('owner-waiting@example.com'));
        $asker = self::inviter('asker@example.com', 'Ngozi Eze');
        $this->machine()->join($organisation, $asker, $this->role($organisation, SeededRole::ReadOnly), MembershipStatus::PendingApproval, MembershipChannel::Request, $asker);
        self::em()->flush();

        self::assertNull(self::service(MembershipDirectoryInterface::class)->grantsIn($asker, $organisation->getId()));
    }

    #[Test]
    public function theMachineRefusesAnUndeclaredTransition(): void
    {
        [, , $membership] = $this->member();
        $this->machine()->move($membership, MembershipStatus::LeftOrRemoved, MembershipChannel::Invitation, null);

        $this->expectException(LogicException::class);
        $this->machine()->move($membership, MembershipStatus::Suspended, MembershipChannel::Invitation, null);
    }

    #[Test]
    public function reJoiningReusesTheRowAndKeepsItsHistory(): void
    {
        [$organisation, $member, $membership] = $this->member();
        $this->machine()->move($membership, MembershipStatus::LeftOrRemoved, MembershipChannel::Invitation, $member);
        self::em()->flush();

        $again = $this->machine()->join($organisation, $member, $this->role($organisation, SeededRole::Administrator), MembershipStatus::Active, MembershipChannel::Invitation, $member);
        self::em()->flush();

        self::assertTrue($again->getId()->equals($membership->getId()), 'the same row');
        self::assertSame(MembershipStatus::Active, $again->getStatus());
        self::assertSame(SeededRole::Administrator, $again->getRole()->getSeededAs(), 'with the role they came back with');
        self::assertCount(1, self::em()->getRepository(Membership::class)->findBy(['organisation' => $organisation, 'user' => $member]));
        self::assertSame(
            [[null, 'active'], ['active', 'left_or_removed'], ['left_or_removed', 'active']],
            Vec\map($this->history($membership), static fn (MembershipTransition $step): array => [$step->getFromStatus()?->value, $step->getToStatus()->value]),
        );
    }

    #[Test]
    public function everyTransitionRecordsWhoWhenAndTheChannel(): void
    {
        $owner = self::inviter('founder@example.com', 'Folake Adeyemi');
        self::organisationFor($owner);

        $founding = $this->history(Type\instance_of(Membership::class)->coerce(self::em()->getRepository(Membership::class)->findOneBy(['user' => $owner])));

        self::assertCount(1, $founding);
        self::assertSame(MembershipChannel::SelfCreated, $founding[0]->getChannel());
        self::assertSame($owner->getId()->toRfc4122(), $founding[0]->getActor()?->getId()->toRfc4122(), 'the founder caused it');
    }

    #[Test]
    public function aSecondMembershipForOneAccountIsRefusedByTheDatabase(): void
    {
        [$organisation, $member] = $this->member();
        self::em()->persist(new Membership($organisation, $member, $this->role($organisation, SeededRole::ReadOnly), MembershipStatus::Active));

        $this->expectException(UniqueConstraintViolationException::class);
        self::em()->flush();
    }

    #[Test]
    public function aMembershipWithNoAccountCannotBeStored(): void
    {
        [$organisation] = $this->member();

        $this->expectException(NotNullConstraintViolationException::class);
        self::em()->getConnection()->executeStatement(
            "INSERT INTO memberships (id, organisation_id, user_id, role_id, status, created_at, updated_at) VALUES (gen_random_uuid(), ?, NULL, ?, 'active', NOW(), NOW())",
            [$organisation->getId()->toRfc4122(), $this->role($organisation, SeededRole::ReadOnly)->getId()->toRfc4122()],
        );
    }

    /** @return array{Organisation, User, Membership} */
    private function member(): array
    {
        $organisation = self::organisationFor(self::inviter('owner-' . \spl_object_id($this) . '@example.com'));
        $member = self::inviter('member-' . \spl_object_id($this) . '@example.com', 'Kemi Lawal');
        $membership = $this->machine()->join($organisation, $member, $this->role($organisation, SeededRole::Coordinator), MembershipStatus::Active, MembershipChannel::Invitation, $member);
        self::em()->flush();

        return [$organisation, $member, $membership];
    }

    /** @return list<MembershipTransition> */
    private function history(Membership $membership): array
    {
        return self::em()->getRepository(MembershipTransition::class)->findBy(['membership' => $membership], ['occurredAt' => 'ASC', 'id' => 'ASC']);
    }

    private function role(Organisation $organisation, SeededRole $seeded): Role
    {
        return Type\instance_of(Role::class)->coerce(self::em()->getRepository(Role::class)->findOneBy(['organisation' => $organisation, 'seededAs' => $seeded]));
    }

    private function machine(): MembershipMachine
    {
        return self::service(MembershipMachine::class);
    }
}
