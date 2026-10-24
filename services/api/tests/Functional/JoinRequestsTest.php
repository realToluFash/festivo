<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Organisation\Members\MembershipMachine;
use App\Domain\Organisation\OrganisationFounder;
use App\Domain\Organisation\RequestLink\LinkRequester;
use App\Domain\User\Mail\UserMailer;
use App\Domain\User\UserRegistrar;
use App\Entity\AuditEntry;
use App\Entity\Membership;
use App\Entity\MembershipTransition;
use App\Entity\Organisation;
use App\Entity\Role;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\MembershipChannel;
use App\Enum\MembershipStatus;
use App\Enum\Permission;
use App\Enum\SeededRole;
use App\Repository\MembershipRepository;
use App\Tests\ApiTestCase;
use App\Tests\Traits\OnboardsAccounts;
use Doctrine\ORM\EntityManagerInterface;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\Test;
use Psl\Iter;
use Psl\Json;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use Symfony\Bundle\FrameworkBundle\Console\Application;
use Symfony\Component\Clock\Test\ClockSensitiveTrait;
use Symfony\Component\Console\Tester\CommandTester;
use Symfony\Component\Mime\Email;

final class JoinRequestsTest extends ApiTestCase
{
    use ClockSensitiveTrait;
    use OnboardsAccounts;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    /** Monday 12 Oct at 09:40 WAT: the AC's own ask. */
    private const string ASKED = '2026-10-12 08:40:00';

    #[Test]
    public function approvingMakesThemAnActiveMemberInTheRoleChosen(): void
    {
        [$owner, $organisation] = $this->organisation();
        $asker = $this->asks($organisation, 'ada@okeke.ng');
        $this->signIn($owner);

        $this->send('POST', $this->path($organisation, $asker, '/approve'), ['roleId' => $this->role($organisation, SeededRole::Coordinator)->getId()->toRfc4122()]);

        self::assertResponseStatusCodeSame(204);
        $membership = $this->membershipOf($asker, $organisation);
        self::assertSame(MembershipStatus::Active, $membership->getStatus());
        self::assertSame(SeededRole::Coordinator, $membership->getRole()->getSeededAs());
        self::assertNull($membership->getRequestExpiresAt());
        self::assertSame(MembershipStatus::Active, $this->lastStep($membership)->getToStatus());
        self::assertSame('membership.approved', $this->audited($membership)->getAction());
        self::assertSame([MembershipStatus::PendingApproval->value, MembershipStatus::Active->value], $this->audited($membership)->getChanges()['status'] ?? null);
    }

    #[Test]
    public function anApprovedMemberIsStillListedAsHavingAskedToJoin(): void
    {
        [$owner, $organisation] = $this->organisation();
        $asker = $this->asks($organisation, 'ada@okeke.ng');
        $this->signIn($owner);

        $this->send('POST', $this->path($organisation, $asker, '/approve'), ['roleId' => $this->role($organisation, SeededRole::ReadOnly)->getId()->toRfc4122()]);

        $listed = Iter\first(Vec\filter($this->listed($organisation), static fn (array $member): bool => 'ada@okeke.ng' === ($member['user']['email'] ?? null)));
        self::assertSame(['active', 'request'], [$listed['status'] ?? null, $listed['channel'] ?? null]);
    }

    #[Test]
    public function nobodyApprovesIntoARoleTheyCouldNotGrant(): void
    {
        [, $organisation] = $this->organisation();
        $manager = $this->member($organisation, 'tunde@ire.events', SeededRole::Coordinator);
        $this->role($organisation, SeededRole::Coordinator)->setPermissions([Permission::MembersRead, Permission::MembersManage]);
        $asker = $this->asks($organisation, 'ada@okeke.ng');
        $this->signIn($manager);

        $this->send('POST', $this->path($organisation, $asker, '/approve'), ['roleId' => $this->role($organisation, SeededRole::EventManager)->getId()->toRfc4122()]);

        self::assertResponseStatusCodeSame(403);
        self::assertSame(MembershipStatus::PendingApproval, $this->membershipOf($asker, $organisation)->getStatus());
    }

    #[Test]
    public function nobodyIsApprovedStraightIntoOwner(): void
    {
        [$owner, $organisation] = $this->organisation();
        $asker = $this->asks($organisation, 'ada@okeke.ng');
        $this->signIn($owner);
        $mailed = Iter\count(self::getMailerMessages());

        $body = $this->send('POST', $this->path($organisation, $asker, '/approve'), ['roleId' => $this->role($organisation, SeededRole::Owner)->getId()->toRfc4122()]);

        self::assertResponseStatusCodeSame(422);
        self::assertSame(ErrorCode::ValidationFailed->type(), $body['type'] ?? null);
        self::assertSame(
            [['propertyPath' => 'roleId', 'message' => 'Approve them first, then make them an owner from Members.']],
            Vec\map(Type\vec(Type\shape(['propertyPath' => Type\string(), 'message' => Type\string()], true))->coerce($body['violations'] ?? null), static fn (array $violation): array => ['propertyPath' => $violation['propertyPath'], 'message' => $violation['message']]),
        );
        $membership = $this->membershipOf($asker, $organisation);
        self::assertSame(MembershipStatus::PendingApproval, $membership->getStatus());
        self::assertSame(SeededRole::ReadOnly, $membership->getRole()->getSeededAs());
        self::assertNull(self::service(EntityManagerInterface::class)->getRepository(AuditEntry::class)->findOneBy(['subjectId' => $membership->getId(), 'action' => 'membership.approved']));
        self::assertCount($mailed, self::getMailerMessages());
    }

    #[Test]
    public function turningDownRemovesThemAndTellsThemWithoutSayingWho(): void
    {
        [$owner, $organisation] = $this->organisation();
        $asker = $this->asks($organisation, 'ada@okeke.ng');
        $this->signIn($owner);

        $this->send('POST', $this->path($organisation, $asker, '/turn-down'));

        self::assertResponseStatusCodeSame(204);
        $membership = $this->membershipOf($asker, $organisation);
        self::assertSame(MembershipStatus::LeftOrRemoved, $membership->getStatus());
        self::assertSame('membership.turned_down', $this->audited($membership)->getAction());
        $mail = $this->mailTo('ada@okeke.ng', 'Your request to join Ìrè Events');
        self::assertStringContainsString('turned down', $mail);
        self::assertStringNotContainsString($owner->getName(), $mail);
    }

    #[Test]
    public function anAnsweredRequestCannotBeAnsweredAgain(): void
    {
        [$owner, $organisation] = $this->organisation();
        $asker = $this->asks($organisation, 'ada@okeke.ng');
        $this->signIn($owner);
        $this->send('POST', $this->path($organisation, $asker, '/turn-down'));

        $body = $this->send('POST', $this->path($organisation, $asker, '/approve'), ['roleId' => $this->role($organisation, SeededRole::ReadOnly)->getId()->toRfc4122()]);

        self::assertResponseStatusCodeSame(409);
        self::assertSame(ErrorCode::JoinRequestAnswered->type(), $body['type'] ?? null);
    }

    #[Test]
    public function withoutThePermissionPendingPeopleCannotBeSeenOrAnswered(): void
    {
        [, $organisation] = $this->organisation();
        $coordinator = $this->member($organisation, 'tunde@ire.events', SeededRole::Coordinator);
        $reads = $this->role($organisation, SeededRole::Coordinator);
        $reads->setPermissions([...$reads->getPermissions(), Permission::MembersRead]);
        $asker = $this->asks($organisation, 'ada@okeke.ng');
        $this->signIn($coordinator);

        $listed = $this->listed($organisation);

        self::assertFalse(Iter\any($listed, static fn (array $member): bool => 'pending_approval' === $member['status']));
        $this->send('POST', $this->path($organisation, $asker, '/approve'), ['roleId' => $this->role($organisation, SeededRole::ReadOnly)->getId()->toRfc4122()]);
        self::assertResponseStatusCodeSame(403);
        $this->send('POST', $this->path($organisation, $asker, '/turn-down'));
        self::assertResponseStatusCodeSame(403);
    }

    #[Test]
    public function aRequesterNeverLetInIsNowhereForAViewerWhoCannotManageMembers(): void
    {
        self::mockTime(self::ASKED);
        [$owner, $organisation] = $this->organisation();
        $coordinator = $this->member($organisation, 'tunde@ire.events', SeededRole::Coordinator);
        $reads = $this->role($organisation, SeededRole::Coordinator);
        $reads->setPermissions([...$reads->getPermissions(), Permission::MembersRead]);
        $turnedDown = $this->asks($organisation, 'kemi@lawal.ng');
        $expired = $this->asks($organisation, 'ada@okeke.ng');
        $this->signIn($owner);
        $this->send('POST', $this->path($organisation, $turnedDown, '/turn-down'));
        self::mockTime('2026-11-11 08:40:00');
        $this->runJob();
        $this->signIn($coordinator);

        $this->listed($organisation);
        $content = (string) $this->client->getResponse()->getContent();

        foreach ([$turnedDown, $expired] as $requester) {
            self::assertSame(MembershipStatus::LeftOrRemoved, $this->membershipOf($requester, $organisation)->getStatus());
            self::assertStringNotContainsString($requester->getId()->toRfc4122(), $content);
            self::assertStringNotContainsString($this->membershipOf($requester, $organisation)->getId()->toRfc4122(), $content);
        }
    }

    #[Test]
    public function whoeverManagesMembersStillSeesARequesterNeverLetInUnderFormer(): void
    {
        [$owner, $organisation] = $this->organisation();
        $turnedDown = $this->asks($organisation, 'kemi@lawal.ng');
        $this->signIn($owner);
        $this->send('POST', $this->path($organisation, $turnedDown, '/turn-down'));

        $listed = Iter\first(Vec\filter($this->listed($organisation), static fn (array $member): bool => 'kemi@lawal.ng' === ($member['user']['email'] ?? null)));

        self::assertSame('left_or_removed', $listed['status'] ?? null);
        self::assertSame(
            [[null, 'pending_approval'], ['pending_approval', 'left_or_removed']],
            Vec\map(
                Type\vec(Type\shape(['from' => Type\nullable(Type\string()), 'to' => Type\string()], true))->coerce($listed['history'] ?? null),
                static fn (array $step): array => [$step['from'], $step['to']],
            ),
        );
    }

    #[Test]
    public function aFormerMemberWhoAskedAgainStillShowsUnderFormerToAViewerWhoCannotManageMembers(): void
    {
        [$owner, $organisation] = $this->organisation();
        $coordinator = $this->member($organisation, 'tunde@ire.events', SeededRole::Coordinator);
        $reads = $this->role($organisation, SeededRole::Coordinator);
        $reads->setPermissions([...$reads->getPermissions(), Permission::MembersRead]);
        $removed = $this->member($organisation, 'bola@ire.events', SeededRole::ReadOnly);
        $returning = $this->member($organisation, 'chidi@ire.events', SeededRole::ReadOnly);
        $this->signIn($owner);
        $this->send('DELETE', $this->path($organisation, $removed, ''));
        $this->send('DELETE', $this->path($organisation, $returning, ''));
        self::service(MembershipMachine::class)->ask($this->membershipOf($returning, $organisation)->getOrganisation(), $this->fresh($returning), MembershipChannel::Request);
        $this->send('POST', $this->path($organisation, $returning, '/turn-down'));
        $this->signIn($coordinator);

        $former = Vec\filter($this->listed($organisation), static fn (array $member): bool => 'left_or_removed' === $member['status']);

        self::assertEqualsCanonicalizing(['bola@ire.events', 'chidi@ire.events'], Vec\map($former, static fn (array $member): mixed => $member['user']['email'] ?? null));
    }

    #[Test]
    public function aRoleCountsOnlyThePeopleWhoHoldIt(): void
    {
        [$owner, $organisation] = $this->organisation();
        $coordinator = $this->member($organisation, 'tunde@ire.events', SeededRole::Coordinator);
        $reads = $this->role($organisation, SeededRole::Coordinator);
        $reads->setPermissions([...$reads->getPermissions(), Permission::MembersRead]);
        $this->asks($organisation, 'ada@okeke.ng');
        $turnedDown = $this->asks($organisation, 'kemi@lawal.ng');
        $this->signIn($owner);
        $this->send('POST', $this->path($organisation, $turnedDown, '/turn-down'));
        self::service(EntityManagerInterface::class)->flush();
        $this->signIn($coordinator);

        $roles = Type\vec(Type\shape(['seededAs' => Type\nullable(Type\string()), 'holders' => Type\int()], true))
            ->coerce($this->send('GET', Str\format('/api/orgs/%s/roles', $organisation->getId()->toRfc4122()))['roles'] ?? null);

        $readOnly = Iter\first(Vec\filter($roles, static fn (array $role): bool => SeededRole::ReadOnly->value === $role['seededAs']));
        self::assertSame(0, $readOnly['holders'] ?? null);
    }

    #[Test]
    public function aRequestIsNotRemovedOrRoledThroughTheMemberRoutes(): void
    {
        [$owner, $organisation] = $this->organisation();
        $asker = $this->asks($organisation, 'ada@okeke.ng');
        $this->signIn($owner);

        $this->send('DELETE', $this->path($organisation, $asker, ''));
        self::assertResponseStatusCodeSame(404);
        $this->send('PATCH', $this->path($organisation, $asker, ''), ['roleId' => $this->role($organisation, SeededRole::Coordinator)->getId()->toRfc4122()]);
        self::assertResponseStatusCodeSame(404);
        self::assertSame(MembershipStatus::PendingApproval, $this->membershipOf($asker, $organisation)->getStatus());
    }

    /** The AC's instant: asked Monday 12 Oct at 09:40 WAT, removed 30 × 24 h later, read in each reader's zone. */
    #[Test]
    public function theRemovalIsOneInstantInEveryReadersZone(): void
    {
        self::mockTime(self::ASKED);
        [$owner, $organisation] = $this->organisation();
        $this->asks($organisation, 'ada@okeke.ng');
        $this->signIn($owner);
        $removes = fn (): mixed => Iter\first(Vec\filter($this->listed($organisation), static fn (array $member): bool => 'pending_approval' === $member['status']))['removesAt'] ?? null;

        $this->fresh($owner)->setTimezone('Africa/Lagos');
        self::assertSame(['at' => '2026-11-11T08:40:00+00:00', 'written' => 'Wednesday 11 Nov at 09:40 WAT'], $removes());
        $this->fresh($owner)->setTimezone('Europe/London');
        self::assertSame('Wednesday 11 Nov at 08:40 GMT', Type\shape(['written' => Type\string()], true)->coerce($removes())['written']);
        $this->fresh($owner)->setTimezone(null);
        self::assertSame('Wednesday 11 Nov at 08:40 UTC', Type\shape(['written' => Type\string()], true)->coerce($removes())['written']);
    }

    #[Test]
    public function aRequestStillWaitsASecondBeforeItsInstant(): void
    {
        self::mockTime(self::ASKED);
        [$owner, $organisation] = $this->organisation();
        $asker = $this->asks($organisation, 'ada@okeke.ng');
        $this->signIn($owner);

        self::mockTime('2026-11-11 08:39:59');
        $this->runJob();
        $this->send('POST', $this->path($organisation, $asker, '/approve'), ['roleId' => $this->role($organisation, SeededRole::ReadOnly)->getId()->toRfc4122()]);

        self::assertResponseStatusCodeSame(204);
    }

    /** At the instant, not at the end of a day, and recorded as of the instant whenever the job runs. */
    #[Test]
    public function anUnansweredRequestIsRemovedAtItsInstantAndTheyAreTold(): void
    {
        self::mockTime(self::ASKED);
        [$owner, $organisation] = $this->organisation();
        $asker = $this->asks($organisation, 'ada@okeke.ng');
        $this->fresh($asker)->setLocale('fr');
        $this->fresh($asker)->setTimezone('Africa/Lagos');
        $this->signIn($owner);

        self::mockTime('2026-11-11 08:40:00');
        $body = $this->send('POST', $this->path($organisation, $asker, '/approve'), ['roleId' => $this->role($organisation, SeededRole::ReadOnly)->getId()->toRfc4122()]);

        self::assertResponseStatusCodeSame(409);
        self::assertSame(ErrorCode::JoinRequestAnswered->type(), $body['type'] ?? null);
        $membership = $this->membershipOf($asker, $organisation);
        self::assertSame(MembershipStatus::LeftOrRemoved, $membership->getStatus());
        self::assertSame('2026-11-11 08:40:00', $this->lastStep($membership)->getOccurredAt()->format('Y-m-d H:i:s'));
        self::assertNull($this->lastStep($membership)->getActor());
        self::assertSame('membership.request_expired', $this->audited($membership)->getAction());
        self::assertStringContainsString('mercredi 11 nov. à 09:40 WAT', $this->mailTo('ada@okeke.ng', self::service(UserMailer::class)->line('joinRequest.expired.subject', 'fr', ['{organisation}' => 'Ìrè Events'])));
    }

    #[Test]
    public function theJobRemovesEachAsOfItsOwnInstant(): void
    {
        self::mockTime(self::ASKED);
        [, $organisation] = $this->organisation();
        $asker = $this->asks($organisation, 'ada@okeke.ng');

        self::mockTime('2026-11-13 18:05:00');
        $this->runJob();

        $membership = $this->membershipOf($asker, $organisation);
        self::assertSame(MembershipStatus::LeftOrRemoved, $membership->getStatus());
        self::assertSame('2026-11-11 08:40:00', $this->lastStep($membership)->getOccurredAt()->format('Y-m-d H:i:s'));
        self::assertCount(1, $this->mailsTo('ada@okeke.ng', 'Your request to join Ìrè Events was removed'));
    }

    #[Test]
    public function everyoneWhoDecidesHearsOfRequestsAtMostOnceADay(): void
    {
        self::mockTime(self::ASKED);
        [, $organisation] = $this->organisation();
        $this->member($organisation, 'tunde@ire.events', SeededRole::Administrator);
        $this->member($organisation, 'bola@ire.events', SeededRole::Coordinator);
        $subject = 'Somebody is waiting to join Ìrè Events';

        $this->asks($organisation, 'ada@okeke.ng');
        $this->runJob();
        self::mockTime('2026-10-12 20:00:00');
        $this->asks($organisation, 'chidi@okeke.ng');
        $this->runJob();

        self::assertCount(1, $this->mailsTo('folake@ire.events', $subject));
        self::assertCount(1, $this->mailsTo('tunde@ire.events', $subject));
        self::assertCount(0, $this->mailsTo('bola@ire.events', $subject), 'a coordinator does not manage members');

        self::mockTime('2026-10-13 08:40:00');
        $this->runJob();
        self::assertCount(2, $this->mailsTo('folake@ire.events', $subject), 'the second request, a day after the first notice');
        self::assertStringContainsString('2 people are waiting', Iter\last($this->mailsTo('folake@ire.events', $subject)) ?? '');

        self::mockTime('2026-10-15 08:40:00');
        $this->runJob();
        self::assertCount(2, $this->mailsTo('folake@ire.events', $subject), 'nothing new since');
    }

    #[Test]
    public function activeMembersAndTheirRoutesAreUnchanged(): void
    {
        [$owner, $organisation] = $this->organisation();
        $coordinator = $this->member($organisation, 'tunde@ire.events', SeededRole::Coordinator);
        $this->signIn($owner);

        $listed = Iter\first(Vec\filter($this->listed($organisation), static fn (array $member): bool => 'tunde@ire.events' === ($member['user']['email'] ?? null)));
        self::assertArrayHasKey('removesAt', $listed ?? []);
        self::assertNull($listed['removesAt'] ?? null);
        $this->send('POST', $this->path($organisation, $coordinator, '/approve'), ['roleId' => $this->role($organisation, SeededRole::ReadOnly)->getId()->toRfc4122()]);
        self::assertResponseStatusCodeSame(409);
        $this->send('DELETE', $this->path($organisation, $coordinator, ''));
        self::assertResponseStatusCodeSame(204);
    }

    /** @return array{0: User, 1: Organisation} */
    private function organisation(): array
    {
        $owner = self::service(UserRegistrar::class)->register('folake@ire.events', 'Folake Adeyemi', self::PASSWORD)->user;
        self::onboard($owner, withOrganisation: false);
        $organisation = self::service(OrganisationFounder::class)->found($owner, 'Ìrè Events', 'NG', 'Africa/Lagos');
        self::service(EntityManagerInterface::class)->flush();

        return [$owner, $organisation];
    }

    private function member(Organisation $organisation, string $address, SeededRole $as): User
    {
        $user = self::service(UserRegistrar::class)->register($address, 'Member', self::PASSWORD)->user;
        self::onboard($user, withOrganisation: false);
        self::service(MembershipMachine::class)->join($organisation, $user, $this->role($organisation, $as), MembershipStatus::Active, MembershipChannel::Invitation, $user);
        self::service(EntityManagerInterface::class)->flush();

        return $user;
    }

    private function asks(Organisation $organisation, string $address): User
    {
        $user = self::service(UserRegistrar::class)->register($address, 'Ada Okeke', self::PASSWORD)->user;
        self::onboard($user);
        self::service(LinkRequester::class)->ask($user, $organisation, null);

        return $user;
    }

    private function fresh(User $user): User
    {
        return Type\instance_of(User::class)->coerce(self::service(EntityManagerInterface::class)->find(User::class, $user->getId()));
    }

    private function role(Organisation $organisation, SeededRole $as): Role
    {
        return Type\instance_of(Role::class)->coerce(
            self::service(EntityManagerInterface::class)->getRepository(Role::class)->findOneBy(['organisation' => $organisation, 'seededAs' => $as]),
        );
    }

    private function path(Organisation $organisation, User $user, string $tail): string
    {
        return Str\format('/api/orgs/%s/members/%s%s', $organisation->getId()->toRfc4122(), $this->membershipOf($user, $organisation)->getId()->toRfc4122(), $tail);
    }

    /** @return list<array<string, mixed>> */
    private function listed(Organisation $organisation): array
    {
        self::service(EntityManagerInterface::class)->flush();
        $body = $this->send('GET', Str\format('/api/orgs/%s/members', $organisation->getId()->toRfc4122()));

        return Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce($body['members'] ?? null);
    }

    private function membershipOf(User $user, Organisation $organisation): Membership
    {
        $membership = self::service(MembershipRepository::class)->findOneBy(['user' => $user, 'organisation' => $organisation]);
        self::assertNotNull($membership);
        self::service(EntityManagerInterface::class)->refresh($membership);

        return $membership;
    }

    private function lastStep(Membership $membership): MembershipTransition
    {
        return Type\instance_of(MembershipTransition::class)->coerce(
            self::service(EntityManagerInterface::class)->getRepository(MembershipTransition::class)->findOneBy(['membership' => $membership], ['occurredAt' => 'DESC', 'id' => 'DESC']),
        );
    }

    private function audited(Membership $membership): AuditEntry
    {
        return Type\instance_of(AuditEntry::class)->coerce(
            self::service(EntityManagerInterface::class)->getRepository(AuditEntry::class)->findOneBy(['subjectId' => $membership->getId()], ['occurredAt' => 'DESC', 'id' => 'DESC']),
        );
    }

    private function runJob(): void
    {
        self::service(EntityManagerInterface::class)->flush();
        new CommandTester(new Application(self::$kernel ?? self::fail('no kernel'))->find('app:join-requests:run'))->execute([]);
    }

    private function mailTo(string $address, string $subject): string
    {
        return Iter\last($this->mailsTo($address, $subject)) ?? self::fail('no "' . $subject . '" to ' . $address);
    }

    /** @return list<string> the bodies */
    private function mailsTo(string $address, string $subject): array
    {
        $mails = Vec\filter(
            Type\vec(Type\instance_of(Email::class))->coerce(self::getMailerMessages()),
            static fn (Email $mail): bool => $mail->getSubject() === $subject && Iter\any($mail->getTo(), static fn ($to): bool => $to->getAddress() === $address),
        );

        return Vec\map($mails, static fn (Email $mail): string => Type\string()->coerce($mail->getTextBody()));
    }

    private function signIn(User $user): void
    {
        self::service(EntityManagerInterface::class)->flush();
        $this->client->setServerParameter('HTTP_AUTHORIZATION', 'Bearer ' . self::service(JWTTokenManagerInterface::class)->create($user));
    }

    /**
     * @param array<string, mixed>|null $body
     *
     * @return array<string, mixed>
     */
    private function send(string $method, string $uri, ?array $body = null): array
    {
        self::service(EntityManagerInterface::class)->flush();
        $this->client->request($method, $uri, server: ['CONTENT_TYPE' => 'application/json'], content: null === $body ? null : Json\encode($body));
        $content = (string) $this->client->getResponse()->getContent();

        return '' === $content ? [] : Type\dict(Type\string(), Type\mixed())->coerce(Json\decode($content));
    }
}
