<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Deletion\Pruner;
use App\Deletion\Restorer;
use App\Domain\Event\Deletion\EventDeleter;
use App\Domain\Organisation\OrganisationFounder;
use App\Domain\User\UserRegistrar;
use App\Entity\AuditEntry;
use App\Entity\Membership;
use App\Entity\Organisation;
use App\Entity\Role;
use App\Entity\User;
use App\Enum\DeletedKind;
use App\Enum\ErrorCode;
use App\Enum\MembershipStatus;
use App\Enum\SeededRole;
use App\Tests\ApiTestCase;
use App\Tests\Traits\OnboardsAccounts;
use DateTimeImmutable;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use LogicException;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use Psl\Json;
use Psl\Type;
use Psl\Vec;
use RuntimeException;
use Symfony\Bundle\FrameworkBundle\Console\Application;
use Symfony\Component\Clock\Test\ClockSensitiveTrait;
use Symfony\Component\Console\Tester\CommandTester;
use Symfony\Component\Uid\Uuid;

final class EventDeletionTest extends ApiTestCase
{
    use ClockSensitiveTrait;
    use OnboardsAccounts;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    private const string DELETED_AT = '2026-10-17T13:20:00+00:00';

    private const string NAME = "Amara & Tobi's wedding";

    private User $owner;

    private Organisation $organisation;

    protected function setUp(): void
    {
        parent::setUp();
        $this->client->disableReboot();
        self::mockTime(new DateTimeImmutable(self::DELETED_AT));
        $this->owner = $this->account('folake@ire.events', 'Africa/Lagos');
        $this->organisation = self::service(OrganisationFounder::class)->found($this->owner, 'Ìrè Events', 'NG', 'Africa/Lagos');
        self::em()->flush();
    }

    #[Test]
    public function aDraftIsDeletedWithAPlainConfirmation(): void
    {
        $id = $this->draft(self::NAME);

        $preview = $this->as($this->owner, 'GET', '/api/events/' . $id . '/deletion');
        self::assertSame(200, $this->statusCode(), Json\encode($preview));
        self::assertSame(['needsName' => false, 'restoreClosesAt' => '2026-11-16T13:20:00+00:00', 'restoreCloses' => 'Monday 16 Nov at 14:20 WAT'], $preview);

        $body = $this->as($this->owner, 'DELETE', '/api/events/' . $id);

        self::assertSame(200, $this->statusCode(), Json\encode($body));
        self::assertSame([self::DELETED_AT, '2026-11-16T13:20:00+00:00'], [$body['deletedAt'] ?? null, $body['restoreClosesAt'] ?? null]);
        self::assertSame([], $this->names($this->owner));
    }

    #[Test]
    public function anEventPastDraftAsksForItsNameTyped(): void
    {
        $id = $this->live(self::NAME);

        self::assertTrue($this->as($this->owner, 'GET', '/api/events/' . $id . '/deletion')['needsName'] ?? null);

        $this->as($this->owner, 'DELETE', '/api/events/' . $id);
        self::assertSame(422, $this->statusCode());
        self::assertSame("Type Amara & Tobi's wedding exactly as shown to delete it.", $this->violation('name'));

        $this->delete($id, '  ' . self::NAME . ' ');
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
    }

    /** @return iterable<string, array{string, string}> */
    public static function sameNames(): iterable
    {
        yield 'a curly apostrophe for a straight one' => ["Amara & Tobi's wedding", "Amara & Tobi\u{2019}s wedding"];
        yield 'a straight apostrophe for a curly one' => ["Amara & Tobi\u{2019}s wedding", "Amara & Tobi's wedding"];
        yield 'straight quotes for curly ones' => ["The \u{201C}big\u{201D} day", 'The "big" day'];
        yield 'a decomposed accent' => ['Adé at 40', "Ade\u{0301} at 40"];
    }

    #[Test]
    #[DataProvider('sameNames')]
    public function aNameThatLooksTheSameMatches(string $name, string $typed): void
    {
        $id = $this->live($name);

        $this->delete($id, $typed);

        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
    }

    /** @return iterable<string, array{string}> */
    public static function mismatches(): iterable
    {
        yield 'another case' => ["amara & tobi's wedding"];
        yield 'another name' => ['Amara & Tobi wedding'];
        yield 'blank' => ['   '];
    }

    #[Test]
    #[DataProvider('mismatches')]
    public function aNameNotTypedExactlyDeletesNothing(string $typed): void
    {
        $id = $this->live(self::NAME);

        $this->delete($id, $typed);

        self::assertSame(422, $this->statusCode());
        self::assertSame("Type Amara & Tobi's wedding exactly as shown to delete it.", $this->violation('name'));
        $this->as($this->owner, 'GET', '/api/events/' . $id);
        self::assertSame(200, $this->statusCode());
    }

    /** @return iterable<string, array{SeededRole, bool}> */
    public static function deleters(): iterable
    {
        yield 'an administrator' => [SeededRole::Administrator, true];
        yield 'an event manager' => [SeededRole::EventManager, true];
        yield 'a coordinator' => [SeededRole::Coordinator, false];
        yield 'a read-only member' => [SeededRole::ReadOnly, false];
    }

    #[Test]
    #[DataProvider('deleters')]
    public function onlyCreateEventsDeletes(SeededRole $seeded, bool $deletes): void
    {
        $id = $this->live(self::NAME);
        $member = $this->member('member@ire.events', $seeded);

        $this->as($member, 'GET', '/api/events/' . $id . '/deletion');
        self::assertSame($deletes ? 200 : 403, $this->statusCode());

        $this->as($member, 'DELETE', '/api/events/' . $id, ['name' => self::NAME]);
        self::assertSame($deletes ? 200 : 403, $this->statusCode());

        if (!$deletes) {
            self::assertSame(ErrorCode::PermissionRequired->type(), $this->last()['type'] ?? null);
        }
    }

    #[Test]
    public function aDeletedEventAndEverythingBeneathItReadAsNeverThere(): void
    {
        $id = $this->live(self::NAME);
        $this->delete($id, self::NAME);
        $reader = $this->member('reader@ire.events', SeededRole::ReadOnly);

        $this->as($reader, 'GET', '/api/events/0193f5a8-0000-7000-8000-000000000000');
        $none = [$this->statusCode(), $this->last()['code'] ?? null, $this->last()['detail'] ?? null];

        foreach ([[$reader, 'GET', ''], [$this->owner, 'GET', ''], [$this->owner, 'PATCH', ''], [$this->owner, 'POST', '/end'], [$this->owner, 'GET', '/deletion'], [$this->owner, 'DELETE', ''], [$this->owner, 'PUT', '/cover']] as [$who, $method, $rest]) {
            $this->as($who, $method, '/api/events/' . $id . $rest, ['name' => self::NAME]);
            self::assertSame($none, [$this->statusCode(), $this->last()['code'] ?? null, $this->last()['detail'] ?? null], $method . ' ' . $rest);
        }
    }

    #[Test]
    public function itLeavesTheListAndItsCountForEverybodyAndTouchesNothingElse(): void
    {
        $kept = $this->draft('Kept');
        $id = $this->draft(self::NAME);
        $colleague = $this->member('bisi@ire.events', SeededRole::Coordinator);
        self::assertSame([self::NAME, 'Kept'], $this->names($colleague));
        self::assertSame(2, $this->as($this->owner, 'GET', $this->path('/deletion'))['events'] ?? null);

        $this->as($this->owner, 'DELETE', '/api/events/' . $id);

        self::assertSame(['Kept'], $this->names($colleague));
        self::assertSame(['Kept'], $this->names($this->owner));
        self::assertSame(1, $this->as($this->owner, 'GET', $this->path('/deletion'))['events'] ?? null);
        $this->as($this->owner, 'GET', '/api/events/' . $kept);
        self::assertSame(200, $this->statusCode());
        $this->as($colleague, 'GET', $this->path('/permissions'));
        self::assertSame(200, $this->statusCode());
    }

    #[Test]
    public function theDeleteIsAuditedWithTheNameAndThePurgeWithout(): void
    {
        $id = $this->live(self::NAME);
        $this->delete($id, self::NAME);

        $deleted = $this->entry(EventDeleter::DELETED, $id) ?? self::fail('no delete entry');
        self::assertSame($this->owner->getId()->toRfc4122(), $deleted->getActorId()?->toRfc4122());
        self::assertSame(['name' => [self::NAME, null], 'deletedAt' => [null, self::DELETED_AT]], $deleted->getChanges());

        self::mockTime(new DateTimeImmutable('2026-11-16T13:20:00+00:00'));
        self::em()->clear();
        self::service(Pruner::class)->prune();

        $purged = $this->entry('event.purged', $id) ?? self::fail('no purge entry');
        self::assertSame([], $purged->getChanges());
    }

    #[Test]
    public function supportRestoresItWholeInsideTheWindowAndTheRestoreIsAudited(): void
    {
        $id = $this->live(self::NAME);
        $this->delete($id, self::NAME);

        self::mockTime(new DateTimeImmutable('2026-11-16T13:19:59+00:00'));
        $this->restore($id, 'Adaeze from support');

        self::assertSame([self::NAME], $this->names($this->owner));
        $event = $this->as($this->owner, 'GET', '/api/events/' . $id)['event'] ?? null;
        self::assertSame('live', Type\shape(['status' => Type\string()], true)->coerce($event)['status']);
        $restored = $this->entry('event.restored', $id) ?? self::fail('no restore entry');
        self::assertSame('Adaeze from support', $restored->getActorLabel());
    }

    #[Test]
    public function nothingIsRestorableFromTheDeadlineAndThenItIsPurged(): void
    {
        $id = $this->draft(self::NAME);
        $kept = $this->draft('Kept');
        $this->as($this->owner, 'DELETE', '/api/events/' . $id);
        self::em()->clear();
        $pruner = self::service(Pruner::class);

        self::mockTime(new DateTimeImmutable('2026-11-16T13:19:59+00:00'));
        self::assertSame(0, $pruner->prune());
        self::assertSame(2, $this->eventRows());

        self::mockTime(new DateTimeImmutable('2026-11-16T13:20:00+00:00'));
        $this->expectRestoreRefused($id, 'restore window closed');
        self::em()->clear();
        self::assertSame(1, $pruner->prune());
        self::assertSame(1, $this->eventRows());
        $this->expectRestoreRefused($id, 'purged');
        $this->as($this->owner, 'GET', '/api/events/' . $kept);
        self::assertSame(200, $this->statusCode());
    }

    #[Test]
    public function anEventInADeletedOrganisationIsRestoredOnlyOnceTheOrganisationIs(): void
    {
        $id = $this->draft(self::NAME);
        $this->as($this->owner, 'DELETE', '/api/events/' . $id);
        $this->as($this->owner, 'DELETE', $this->path(''), ['name' => 'Ìrè Events']);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        $this->expectRestoreRefused($id, 'Restore the organisation first');
        self::assertNotNull($this->deletedAtOf($id), 'the refusal changed nothing');

        self::service(Restorer::class)->restore(DeletedKind::Organisation, $this->organisation->getId(), 'Adaeze from support');
        self::em()->clear();
        self::assertSame([], $this->names($this->owner), 'restoring the organisation left the event deleted');
        self::assertNotNull($this->deletedAtOf($id));

        $this->restore($id, 'Adaeze from support');
        self::assertSame([self::NAME], $this->names($this->owner));
    }

    #[Test]
    public function theRestoreCommandNamesTheAgentAndSaysWhyItRefuses(): void
    {
        $id = $this->draft(self::NAME);
        $this->as($this->owner, 'DELETE', '/api/events/' . $id);
        $command = new CommandTester(new Application(self::$kernel ?? throw new LogicException('No kernel.'))->find('app:restore-event'));

        self::assertSame(1, $command->execute(['event' => $id]));
        self::assertSame(0, $command->execute(['event' => $id, '--agent' => 'Adaeze from support']));
        self::assertSame(1, $command->execute(['event' => $id, '--agent' => 'Adaeze from support']), 'not deleted any more');
    }

    #[Test]
    public function anOrganisationsPurgeTakesItsEventsDeletedOrNot(): void
    {
        $id = $this->draft(self::NAME);
        $this->draft('Kept');
        self::mockTime(new DateTimeImmutable('2026-10-18T13:20:00+00:00'));
        $this->as($this->owner, 'DELETE', '/api/events/' . $id);
        self::mockTime(new DateTimeImmutable(self::DELETED_AT));
        $this->as($this->owner, 'DELETE', $this->path(''), ['name' => 'Ìrè Events']);

        self::mockTime(new DateTimeImmutable('2026-11-16T13:20:00+00:00'));
        self::em()->clear();
        self::assertSame(1, self::service(Pruner::class)->prune());
        self::assertSame(0, $this->eventRows());
    }

    private function draft(string $name): string
    {
        $body = $this->as($this->owner, 'POST', $this->path('/events'), ['name' => $name, 'type' => 'wedding', 'startsAt' => '2030-11-14T16:00', 'endsAt' => '2030-11-15T02:00', 'timeZone' => 'Africa/Lagos', 'currency' => 'NGN']);
        self::assertSame(201, $this->statusCode(), Json\encode($body));

        return Type\shape(['id' => Type\string()], true)->coerce($body['event'] ?? null)['id'];
    }

    private function live(string $name): string
    {
        $id = $this->draft($name);
        $this->as($this->owner, 'POST', '/api/events/' . $id . '/make-live');
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        return $id;
    }

    /** @return array<string, mixed> */
    private function delete(string $id, string $typed): array
    {
        return $this->as($this->owner, 'DELETE', '/api/events/' . $id, ['name' => $typed]);
    }

    private function restore(string $id, string $agent): void
    {
        self::service(Restorer::class)->restore(DeletedKind::Event, Uuid::fromString($id), $agent);
        self::em()->clear();
    }

    private function expectRestoreRefused(string $id, string $because): void
    {
        try {
            $this->restore($id, 'Adaeze from support');
            self::fail('the restore went through');
        } catch (RuntimeException $refused) {
            self::assertStringContainsString($because, $refused->getMessage());
        }
    }

    private function deletedAtOf(string $id): ?string
    {
        return Type\nullable(Type\string())->coerce(self::em()->getConnection()->fetchOne('SELECT deleted_at FROM events WHERE id = :id', ['id' => $id]));
    }

    private function eventRows(): int
    {
        return Type\int()->coerce(self::em()->getConnection()->fetchOne('SELECT COUNT(*) FROM events WHERE organisation_id = :organisation', ['organisation' => $this->organisation->getId()->toRfc4122()]));
    }

    private function entry(string $action, string $id): ?AuditEntry
    {
        return self::em()->getRepository(AuditEntry::class)->findOneBy(['action' => $action, 'subjectId' => Uuid::fromString($id)]);
    }

    /** @return list<string> */
    private function names(User $user): array
    {
        $body = $this->as($user, 'GET', $this->path('/events'));
        self::assertSame(200, $this->statusCode(), Json\encode($body));

        return Vec\map(Type\vec(Type\shape(['name' => Type\string()], true))->coerce($body['events'] ?? null), static fn (array $event): string => $event['name']);
    }

    private function account(string $address, ?string $zone = null): User
    {
        $user = self::service(UserRegistrar::class)->register($address, 'Person', self::PASSWORD)->user;
        $user->setTimezone($zone);
        self::onboard($user, withOrganisation: false);

        return $user;
    }

    private function member(string $address, SeededRole $seeded): User
    {
        $user = $this->account($address, 'Africa/Lagos');
        $organisation = self::em()->find(Organisation::class, $this->organisation->getId()) ?? self::fail('no organisation');
        $role = self::em()->getRepository(Role::class)->findOneBy(['organisation' => $organisation, 'seededAs' => $seeded]) ?? self::fail('no role');
        self::em()->persist(new Membership($organisation, $user, $role, MembershipStatus::Active, new DateTimeImmutable()));
        self::em()->flush();

        return $user;
    }

    private function path(string $rest): string
    {
        return '/api/orgs/' . $this->organisation->getId()->toRfc4122() . $rest;
    }

    private function violation(string $field): ?string
    {
        foreach (Type\vec(Type\shape(['propertyPath' => Type\string(), 'message' => Type\string()], true))->coerce($this->last()['violations'] ?? []) as $violation) {
            if ($violation['propertyPath'] === $field) {
                return $violation['message'];
            }
        }

        return null;
    }

    /**
     * @param array<string, mixed>|null $body
     *
     * @return array<string, mixed>
     */
    private function as(User $user, string $method, string $path, ?array $body = null): array
    {
        $who = self::em()->find(User::class, $user->getId()) ?? self::fail('no user');
        $this->client->request($method, $path, server: [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_AUTHORIZATION' => 'Bearer ' . self::service(JWTTokenManagerInterface::class)->create($who),
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
