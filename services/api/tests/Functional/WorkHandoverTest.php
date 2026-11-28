<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Organisation\OrganisationFounder;
use App\Domain\User\UserRegistrar;
use App\Entity\AuditEntry;
use App\Entity\EventPerson;
use App\Entity\Membership;
use App\Entity\Organisation;
use App\Entity\Role;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\EventRole;
use App\Enum\MembershipStatus;
use App\Enum\SeededRole;
use App\Tests\ApiTestCase;
use App\Tests\Traits\OnboardsAccounts;
use App\Tests\Traits\PutsPeopleOnEvents;
use DateTimeImmutable;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\Test;
use Psl\Iter;
use Psl\Json;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use Symfony\Component\Mime\Email;

/** sc-614: a departing member's events go to whoever takes them, and never to nobody. */
final class WorkHandoverTest extends ApiTestCase
{
    use OnboardsAccounts;
    use PutsPeopleOnEvents;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    private User $owner;

    private Organisation $organisation;

    private string $owambe;

    private string $naming;

    protected function setUp(): void
    {
        parent::setUp();
        $this->client->disableReboot();
        $this->owner = $this->account('owner@ire.events', 'Folake Adeyemi');
        $this->organisation = self::service(OrganisationFounder::class)->found($this->owner, 'Ìrè Events', 'NG', 'Africa/Lagos');
        self::em()->flush();
        $this->owambe = $this->create('Owambe', '2030-11-21T16:00');
        $this->naming = $this->create('Naming', '2030-11-14T16:00');
    }

    #[Test]
    public function theWorkListIsWhatTheyLeadSoonestFirstAndNotTheirOtherRoles(): void
    {
        $chidi = $this->member('chidi@ire.events', SeededRole::Member, 'Chidi Okafor');
        $past = $this->create('Last year', '2020-11-14T16:00');
        $older = $this->create('Long ago', '2019-11-14T16:00');
        $viewed = $this->create('Viewed', '2030-12-01T16:00');

        foreach ([$this->owambe, $past, $this->naming, $older] as $led) {
            self::onEvent($chidi, $led, EventRole::Lead);
        }

        self::onEvent($chidi, $viewed, EventRole::CanView);

        $listed = $this->as($this->owner, 'GET', $this->path('members/' . $this->membershipOf($chidi) . '/work'));
        self::assertSame(200, $this->statusCode(), Json\encode($listed));
        self::assertSame(['Naming', 'Owambe', 'Last year', 'Long ago'], $this->titles($listed), 'not yet over by start, then over, most recent first');

        $own = $this->as($chidi, 'GET', $this->path('work'));
        self::assertSame(['Naming', 'Owambe', 'Last year', 'Long ago'], $this->titles($own));

        $member = $this->member('member@ire.events', SeededRole::Member);
        $this->as($member, 'GET', $this->path('members/' . $this->membershipOf($chidi) . '/work'));
        self::assertSame(403, $this->statusCode(), 'only whoever may remove them reads it');
    }

    #[Test]
    public function aRemovalWithWorkNamingNobodyIsRefusedAndChangesNothing(): void
    {
        $chidi = $this->member('chidi@ire.events', SeededRole::Member, 'Chidi Okafor');
        self::onEvent($chidi, $this->owambe, EventRole::Lead);

        $refused = $this->as($this->owner, 'DELETE', $this->path('members/' . $this->membershipOf($chidi)));
        self::assertSame(422, $this->statusCode(), Json\encode($refused));
        self::assertSame(ErrorCode::ValidationFailed->type(), $refused['type'] ?? null);
        self::assertSame([['propertyPath' => 'handTo', 'message' => 'Choose who takes over their events.']], $this->violations($refused));
        self::assertSame(MembershipStatus::Active, $this->membership($chidi)->getStatus());
        self::assertSame(EventRole::Lead, $this->personOf($chidi, $this->owambe)?->getRole());

        $this->as($this->owner, 'DELETE', $this->path('members/' . $this->membershipOf($chidi)), ['handTo' => $this->membershipOf($chidi)]);
        self::assertSame(422, $this->statusCode(), 'never to the person leaving');

        $outsider = $this->account('other@elsewhere.events', 'Other');
        $elsewhere = self::service(OrganisationFounder::class)->found($outsider, 'Elsewhere', 'NG', 'Africa/Lagos');
        self::em()->flush();
        $theirs = self::em()->getRepository(Membership::class)->findOneBy(['user' => $outsider->getId(), 'organisation' => $elsewhere->getId()]) ?? self::fail('no membership');
        $this->as($this->owner, 'DELETE', $this->path('members/' . $this->membershipOf($chidi)), ['handTo' => $theirs->getId()->toRfc4122()]);
        self::assertSame(422, $this->statusCode(), 'never to anyone from outside');
    }

    #[Test]
    public function aRemovalWithNoWorkAsksNothing(): void
    {
        $chidi = $this->member('chidi@ire.events', SeededRole::Member, 'Chidi Okafor');
        self::onEvent($chidi, $this->owambe, EventRole::CanEdit);

        $listed = $this->as($this->owner, 'GET', $this->path('members/' . $this->membershipOf($chidi) . '/work'));
        self::assertSame([], $this->titles($listed));
        $this->as($this->owner, 'DELETE', $this->path('members/' . $this->membershipOf($chidi)));
        self::assertSame(204, $this->statusCode());
        self::assertNull($this->personOf($chidi, $this->owambe), 'their other roles end with the removal, as sc-29912 says');
        self::assertSame(0, $this->audited('membership.work_handed_over'));
    }

    #[Test]
    public function handingOverRaisesAnExistingRoleAddsSomeoneWithNoneAndLeavesALeadAlone(): void
    {
        $chidi = $this->member('chidi@ire.events', SeededRole::Member, 'Chidi Okafor');
        $amaka = $this->member('amaka@ire.events', SeededRole::Member, 'Amaka Eze');
        $third = $this->create('Third', '2030-12-05T16:00');

        foreach ([$this->owambe, $this->naming, $third] as $led) {
            self::onEvent($chidi, $led, EventRole::Lead);
        }

        $editor = self::onEvent($amaka, $this->owambe, EventRole::CanEdit);
        $editor->setJobLabel('Caterer');
        self::em()->flush();
        self::onEvent($amaka, $third, EventRole::Lead);
        self::drainNotifications();

        $this->as($this->owner, 'DELETE', $this->path('members/' . $this->membershipOf($chidi)), ['handTo' => $this->membershipOf($amaka)]);
        self::assertSame(204, $this->statusCode(), Json\encode($this->last()));

        $raised = $this->personOf($amaka, $this->owambe);
        self::assertSame([EventRole::Lead, 'Caterer'], [$raised?->getRole(), $raised?->getJobLabel()], 'their role becomes Lead and their job label stays');
        $added = $this->personOf($amaka, $this->naming);
        self::assertSame([EventRole::Lead, null], [$added?->getRole(), $added?->getJobLabel()], 'added as Lead with no job label');
        self::assertSame(EventRole::Lead, $this->personOf($amaka, $third)?->getRole(), 'already Lead, and left so');
        self::assertCount(0, self::em()->getRepository(EventPerson::class)->findBy(['membership' => $this->membershipOf($chidi)]), "the departing member's roles end");
        self::assertSame(MembershipStatus::LeftOrRemoved, $this->membership($chidi)->getStatus());

        self::assertSame(['Events handed over: Ìrè Events'], $this->subjectsTo('amaka@ire.events'));
        self::assertSame(
            "Chidi Okafor's events in Ìrè Events have been handed to you. You now lead these 3 events:\n\n- Naming\n- Owambe\n- Third",
            $this->opening('amaka@ire.events'),
        );
        self::assertStringNotContainsString('no longer a member', $this->bodyTo('amaka@ire.events'));

        $audit = self::em()->getRepository(AuditEntry::class)->findOneBy(['action' => 'membership.work_handed_over']) ?? self::fail('not audited');
        self::assertSame($this->owner->getId()->toRfc4122(), $audit->getActorId()?->toRfc4122(), 'by whom');
        self::assertSame([null, [$this->membershipOf($amaka)]], $audit->getChanges()['handedTo'] ?? null, 'to whom');
        self::assertSame(['Naming', 'Owambe', 'Third'], Vec\map(Type\vec(Type\shape(['title' => Type\string()], true))->coerce($audit->getChanges()['events'][1] ?? null), static fn (array $event): string => $event['title']), 'the list');
        self::assertSame($this->membershipOf($chidi), $audit->getSubjectId()->toRfc4122(), 'from whom');
    }

    #[Test]
    public function oneEventReadsInTheSingularAndHandingToYourselfSendsNoEmail(): void
    {
        $chidi = $this->member('chidi@ire.events', SeededRole::Member, 'Chidi Okafor');
        $amaka = $this->member('amaka@ire.events', SeededRole::Member, 'Amaka Eze');
        $bola = $this->member('bola@ire.events', SeededRole::Member, 'Bola Ade');
        self::onEvent($chidi, $this->owambe, EventRole::Lead);
        self::onEvent($bola, $this->owambe, EventRole::Lead);
        self::drainNotifications();

        $this->as($this->owner, 'DELETE', $this->path('members/' . $this->membershipOf($chidi)), ['handTo' => $this->membershipOf($amaka)]);
        self::assertSame(204, $this->statusCode());
        self::assertSame("Chidi Okafor's events in Ìrè Events have been handed to you. You now lead this event:\n\n- Owambe", $this->opening('amaka@ire.events'));

        $this->as($this->owner, 'DELETE', $this->path('members/' . $this->membershipOf($bola)), ['handTo' => $this->membershipOf($this->owner)]);
        self::assertSame(204, $this->statusCode());
        self::assertSame(EventRole::Lead, $this->personOf($this->owner, $this->owambe)?->getRole());
        self::assertSame([], $this->subjectsTo('owner@ire.events'), 'you did it, and the done line says so');
    }

    #[Test]
    public function aRemovalIsRefusedWhenTheMemberWasMadeALeadAfterTheAskOpened(): void
    {
        $chidi = $this->member('chidi@ire.events', SeededRole::Member, 'Chidi Okafor');
        self::assertSame([], $this->titles($this->as($this->owner, 'GET', $this->path('members/' . $this->membershipOf($chidi) . '/work'))));

        self::onEvent($chidi, $this->owambe, EventRole::Lead);
        $this->as($this->owner, 'DELETE', $this->path('members/' . $this->membershipOf($chidi)));
        self::assertSame(422, $this->statusCode());
        self::assertSame('Choose who takes over their events.', $this->violations($this->last())[0]['message'] ?? null);
    }

    #[Test]
    public function leavingWithNobodyMakesEveryRemainingOwnerItsLeadAndEmailsEachNamingTheOthers(): void
    {
        $second = $this->member('second@ire.events', SeededRole::Owner, 'Ngozi Bello');
        $third = $this->member('third@ire.events', SeededRole::Owner, 'Tunde Bakare');
        $chidi = $this->member('chidi@ire.events', SeededRole::Member, 'Chidi Okafor');
        self::onEvent($chidi, $this->owambe, EventRole::Lead);
        self::onEvent($chidi, $this->naming, EventRole::Lead);
        self::drainNotifications();

        $this->as($chidi, 'POST', $this->path('leave'));
        self::assertSame(204, $this->statusCode(), Json\encode($this->last()));

        foreach ([$this->owner, $second, $third] as $owner) {
            self::assertSame(EventRole::Lead, $this->personOf($owner, $this->owambe)?->getRole());
            self::assertSame(EventRole::Lead, $this->personOf($owner, $this->naming)?->getRole());
        }

        self::assertSame(MembershipStatus::LeftOrRemoved, $this->membership($chidi)->getStatus());
        self::assertSame(['Events handed over: Ìrè Events'], $this->subjectsTo('owner@ire.events'));
        self::assertSame(
            "Chidi Okafor left Ìrè Events without choosing who takes over the 2 events they led, so you and Ngozi Bello and Tunde Bakare now lead them:\n\n- Naming\n- Owambe",
            $this->opening('owner@ire.events'),
        );
        self::assertSame(
            "Chidi Okafor left Ìrè Events without choosing who takes over the 2 events they led, so you and Folake Adeyemi and Tunde Bakare now lead them:\n\n- Naming\n- Owambe",
            $this->opening('second@ire.events'),
        );
    }

    #[Test]
    public function leavingWithNobodyToTheOnlyOtherOwnerNamesNoOthers(): void
    {
        $chidi = $this->member('chidi@ire.events', SeededRole::Member, 'Chidi Okafor');
        self::onEvent($chidi, $this->owambe, EventRole::Lead);
        self::drainNotifications();

        $this->as($chidi, 'POST', $this->path('leave'), ['handTo' => null]);
        self::assertSame(204, $this->statusCode());
        self::assertSame(
            "Chidi Okafor left Ìrè Events without choosing who takes over the event they led, so you now lead it:\n\n- Owambe",
            $this->opening('owner@ire.events'),
        );
    }

    #[Test]
    public function leavingToAPersonGivesThemTheEvents(): void
    {
        $chidi = $this->member('chidi@ire.events', SeededRole::Member, 'Chidi Okafor');
        $amaka = $this->member('amaka@ire.events', SeededRole::Member, 'Amaka Eze');
        self::onEvent($chidi, $this->owambe, EventRole::Lead);
        self::drainNotifications();

        $this->as($chidi, 'POST', $this->path('leave'), ['handTo' => $this->membershipOf($amaka)]);
        self::assertSame(204, $this->statusCode());
        self::assertSame(EventRole::Lead, $this->personOf($amaka, $this->owambe)?->getRole());
        self::assertNull($this->personOf($this->owner, $this->owambe), 'the owners are not made its Lead');
        self::assertSame(['Events handed over: Ìrè Events'], $this->subjectsTo('amaka@ire.events'));
        self::assertSame([], $this->subjectsTo('owner@ire.events'));
    }

    #[Test]
    public function aSuspensionMovesNothingUntilHandOverNowAndARestoreBringsBackTheRest(): void
    {
        $chidi = $this->member('chidi@ire.events', SeededRole::Member, 'Chidi Okafor');
        $amaka = $this->member('amaka@ire.events', SeededRole::Member, 'Amaka Eze');
        $kept = $this->create('Kept', '2030-12-05T16:00');
        self::onEvent($chidi, $this->owambe, EventRole::Lead);
        self::onEvent($chidi, $kept, EventRole::CanEdit);
        self::drainNotifications();

        $this->as($this->owner, 'POST', $this->path('members/' . $this->membershipOf($chidi) . '/suspend'));
        self::assertSame(204, $this->statusCode());
        self::assertSame(EventRole::Lead, $this->personOf($chidi, $this->owambe)?->getRole(), 'a suspension moves nothing');
        self::assertSame(['Owambe'], $this->titles($this->as($this->owner, 'GET', $this->path('members/' . $this->membershipOf($chidi) . '/work'))));

        $this->as($this->owner, 'POST', $this->path('members/' . $this->membershipOf($chidi) . '/handover'));
        self::assertSame(422, $this->statusCode(), 'never to nobody');

        $this->as($this->owner, 'POST', $this->path('members/' . $this->membershipOf($chidi) . '/handover'), ['handTo' => $this->membershipOf($amaka)]);
        self::assertSame(204, $this->statusCode(), Json\encode($this->last()));
        self::assertSame(EventRole::Lead, $this->personOf($amaka, $this->owambe)?->getRole());
        self::assertNull($this->personOf($chidi, $this->owambe));
        self::assertSame(MembershipStatus::Suspended, $this->membership($chidi)->getStatus(), 'still suspended');
        self::assertSame(['Events handed over: Ìrè Events'], $this->subjectsTo('amaka@ire.events'));

        $this->as($this->owner, 'POST', $this->path('members/' . $this->membershipOf($chidi) . '/restore'));
        self::assertSame(204, $this->statusCode());
        self::assertNull($this->personOf($chidi, $this->owambe), 'the Lead handed over does not come back');
        self::assertSame(EventRole::CanEdit, $this->personOf($chidi, $kept)?->getRole(), 'their other roles do');
    }

    #[Test]
    public function handOverNowIsForASuspendedMemberAndAnAdminCannotMoveAnOwners(): void
    {
        $chidi = $this->member('chidi@ire.events', SeededRole::Member, 'Chidi Okafor');
        self::onEvent($chidi, $this->owambe, EventRole::Lead);

        $this->as($this->owner, 'POST', $this->path('members/' . $this->membershipOf($chidi) . '/handover'), ['handTo' => $this->membershipOf($this->owner)]);
        self::assertSame(409, $this->statusCode(), 'an active member is removed, not handed over');

        $admin = $this->member('admin@ire.events', SeededRole::Admin);
        $second = $this->member('second@ire.events', SeededRole::Owner, 'Ngozi Bello');
        self::onEvent($second, $this->naming, EventRole::Lead);
        $membership = $this->membership($second);
        $membership->setStatus(MembershipStatus::Suspended, new DateTimeImmutable());
        self::em()->flush();

        $this->as($admin, 'POST', $this->path('members/' . $this->membershipOf($second) . '/handover'), ['handTo' => $this->membershipOf($admin)]);
        self::assertSame(403, $this->statusCode(), 'an admin sees a suspended owner read-only');
        self::assertSame(EventRole::Lead, $this->personOf($second, $this->naming)?->getRole());
    }

    /** @return list<string> */
    private function titles(array $body): array
    {
        return Vec\map(Type\vec(Type\shape(['id' => Type\string(), 'title' => Type\string()]))->coerce($body['events'] ?? null), static fn (array $event): string => $event['title']);
    }

    /** @return list<array{propertyPath: string, message: string}> */
    private function violations(array $body): array
    {
        return Type\vec(Type\shape(['propertyPath' => Type\string(), 'message' => Type\string()]))->coerce(Vec\map(
            Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce($body['violations'] ?? null),
            static fn (array $violation): array => ['propertyPath' => $violation['propertyPath'] ?? null, 'message' => $violation['message'] ?? null],
        ));
    }

    private function opening(string $address): string
    {
        $body = $this->bodyTo($address);

        return Str\before($body, "\n\n--") ?? $body;
    }

    private function bodyTo(string $address): string
    {
        $mail = Iter\first(Vec\filter(self::getMailerMessages(), static fn (object $message): bool => $message instanceof Email && $address === $message->getTo()[0]->getAddress()));

        return (string) Type\instance_of(Email::class)->coerce($mail)->getTextBody();
    }

    /** @return list<string> */
    private function subjectsTo(string $address): array
    {
        return Vec\filter_nulls(Vec\map(
            self::getMailerMessages(),
            static fn (object $message): ?string => $message instanceof Email && $address === $message->getTo()[0]->getAddress() ? $message->getSubject() : null,
        ));
    }

    private function audited(string $action): int
    {
        return self::em()->getRepository(AuditEntry::class)->count(['action' => $action]);
    }

    private function create(string $name, string $startsAt): string
    {
        $body = $this->as($this->owner, 'POST', $this->path('events'), [
            'name' => $name,
            'type' => 'wedding',
            'startsAt' => $startsAt,
            'endsAt' => $startsAt,
            'timeZone' => 'Africa/Lagos',
            'currency' => 'NGN',
        ]);
        self::assertSame(201, $this->statusCode(), Json\encode($body));

        return Type\shape(['id' => Type\string()], true)->coerce($body['event'])['id'];
    }

    private function account(string $address, string $name = 'Person'): User
    {
        $user = self::service(UserRegistrar::class)->register($address, $name, self::PASSWORD)->user;
        self::onboard($user, withOrganisation: false);

        return $user;
    }

    private function member(string $address, SeededRole $seeded, string $name = 'Person'): User
    {
        $user = $this->account($address, $name);
        $organisation = self::em()->find(Organisation::class, $this->organisation->getId()) ?? self::fail('no organisation');
        $role = self::em()->getRepository(Role::class)->findOneBy(['organisation' => $organisation, 'seededAs' => $seeded]) ?? self::fail('no role');
        self::em()->persist(new Membership($organisation, $user, $role, MembershipStatus::Active, new DateTimeImmutable()));
        self::em()->flush();

        return $user;
    }

    private function membership(User $user): Membership
    {
        self::em()->clear();

        return self::em()->getRepository(Membership::class)->findOneBy(['user' => $user->getId(), 'organisation' => $this->organisation->getId()]) ?? self::fail('no membership');
    }

    private function membershipOf(User $user): string
    {
        return $this->membership($user)->getId()->toRfc4122();
    }

    private function personOf(User $user, string $eventId): ?EventPerson
    {
        $membership = $this->membershipOf($user);
        self::em()->clear();

        return self::em()->getRepository(EventPerson::class)->findOneBy(['event' => $eventId, 'membership' => $membership]);
    }

    private function path(string $rest): string
    {
        return '/api/orgs/' . $this->organisation->getId()->toRfc4122() . '/' . $rest;
    }

    private function tokenFor(User $user): string
    {
        return self::service(JWTTokenManagerInterface::class)->create(self::em()->find(User::class, $user->getId()) ?? self::fail('no user'));
    }

    /** @return array<string, mixed> */
    private function as(User $user, string $method, string $path, ?array $body = null): array
    {
        $this->client->request($method, $path, server: [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_AUTHORIZATION' => 'Bearer ' . $this->tokenFor($user),
        ], content: null === $body ? null : Json\encode($body));

        return $this->last();
    }

    /** @return array<string, mixed> */
    private function last(): array
    {
        $raw = (string) $this->client->getResponse()->getContent();

        return '' === $raw ? [] : Type\dict(Type\string(), Type\mixed())->coerce(Json\decode($raw));
    }

    private function statusCode(): int
    {
        return $this->client->getResponse()->getStatusCode();
    }
}
