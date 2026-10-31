<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Deletion\Pruner;
use App\Domain\Event\Cover\CoverPhotoProcessor;
use App\Domain\Event\Cover\EventCoverEditor;
use App\Domain\Event\EventCreator;
use App\Domain\Organisation\OrganisationFounder;
use App\Domain\User\UserRegistrar;
use App\Entity\AuditEntry;
use App\Entity\Membership;
use App\Entity\Organisation;
use App\Entity\Role;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\MembershipStatus;
use App\Enum\SeededRole;
use App\Storage\ObjectStore;
use App\Tests\ApiTestCase;
use App\Tests\Double\ScriptedActiveEventsLimit;
use App\Tests\Traits\OnboardsAccounts;
use DateTimeImmutable;
use Doctrine\DBAL\Connection;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use Psl\Json;
use Psl\Type;
use Psl\Vec;
use Symfony\Component\Clock\Test\ClockSensitiveTrait;
use Symfony\Component\Uid\Uuid;

final class EventDuplicateTest extends ApiTestCase
{
    use ClockSensitiveTrait;
    use OnboardsAccounts;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    private const string NOW = '2026-10-27T09:00:00+00:00';

    private User $owner;

    private Organisation $organisation;

    protected function setUp(): void
    {
        parent::setUp();
        $this->client->disableReboot();
        self::mockTime(new DateTimeImmutable(self::NOW));
        $this->owner = $this->account('folake@ire.events');
        $this->organisation = self::service(OrganisationFounder::class)->found($this->owner, 'Ìrè Events', 'NG', 'Africa/Lagos');
        self::em()->flush();
    }

    #[Test]
    public function aCopyIsADraftSetUpAsTheOriginalWithTheNewStartAndItsLength(): void
    {
        $id = $this->live($this->original(['venue' => ['name' => 'The Civic Centre', 'address' => '12 Bode Thomas Street, Surulere'], 'currency' => 'GHS']));
        $original = $this->show($id);

        $copy = $this->duplicate($id, '2027-05-15T16:00');

        self::assertSame(201, $this->statusCode(), Json\encode($this->last()));
        self::assertNotSame($id, $copy['id']);
        self::assertSame(
            ['name' => $original['name'], 'type' => $original['type'], 'timeZone' => 'Africa/Lagos', 'currency' => 'GHS', 'venue' => $original['venue']],
            ['name' => $copy['name'], 'type' => $copy['type'], 'timeZone' => $copy['timeZone'], 'currency' => $copy['currency'], 'venue' => $copy['venue']],
        );
        self::assertSame(['draft', '2027-05-15T16:00:00+01:00', '2027-05-16T02:00:00+01:00'], [$copy['status'], $copy['startsAt'], $copy['endsAt']]);
        self::assertSame([null, null, []], [$copy['madeLiveAt'], $copy['concludedAt'], $copy['hosts']]);
        self::assertSame($copy, $this->show($copy['id']));
    }

    /**
     * @return iterable<string, array{string, string, string, string}>
     */
    public static function clockChanges(): iterable
    {
        yield 'the original crosses the change' => ['2027-03-27T20:00', '2027-03-28T08:00', '2027-07-17T20:00', '2027-07-18T08:00:00+02:00'];
        yield 'the copy crosses the change' => ['2027-07-17T20:00', '2027-07-18T08:00', '2027-03-27T20:00', '2027-03-28T08:00:00+02:00'];
        yield 'the original crosses it, copied an hour later' => ['2027-03-27T20:00', '2027-03-28T08:00', '2027-07-17T21:00', '2027-07-18T09:00:00+02:00'];
        yield 'the copy crosses it an hour later' => ['2027-07-17T20:00', '2027-07-18T08:00', '2027-03-27T21:00', '2027-03-28T09:00:00+02:00'];
        yield 'an end in the skipped hour moves later by the gap' => ['2027-07-17T20:00', '2027-07-18T06:30', '2027-03-27T16:00', '2027-03-28T03:30:00+02:00'];
        yield 'an end in the repeated hour takes the earlier offset' => ['2027-07-17T20:00', '2027-07-18T02:30', '2027-10-30T20:00', '2027-10-31T02:30:00+02:00'];
    }

    #[Test]
    #[DataProvider('clockChanges')]
    public function theLengthIsKeptOnTheClockWhateverTheClocksDo(string $startsAt, string $endsAt, string $copiedStart, string $copiedEnd): void
    {
        $id = $this->original(['startsAt' => $startsAt, 'endsAt' => $endsAt, 'timeZone' => 'Europe/Madrid']);

        $copy = $this->duplicate($id, $copiedStart);

        self::assertSame(201, $this->statusCode(), Json\encode($this->last()));
        self::assertSame(['Europe/Madrid', $copiedEnd], [$copy['timeZone'], $copy['endsAt']]);
    }

    #[Test]
    public function theOriginalIsUnchanged(): void
    {
        $id = $this->live($this->original());
        $before = $this->show($id);
        $tag = $this->tag();
        $events = $this->eventRows();

        $this->duplicate($id, '2027-05-15T16:00');
        self::em()->clear();

        self::assertSame($before, $this->show($id));
        self::assertSame($tag, $this->tag());
        self::assertSame($events + 1, $this->eventRows());
    }

    #[Test]
    public function aCopyOfAnOriginalWithNoPhotoHasNoCover(): void
    {
        $copy = $this->duplicate($this->original(), '2027-05-15T16:00');

        self::assertSame(201, $this->statusCode());
        self::assertNull($copy['cover']);
    }

    #[Test]
    public function theCoverIsCopiedWithItsFramingAndDescriptionUnderAPhotoOfItsOwn(): void
    {
        $id = $this->original();
        $photo = $this->withCover($id, 30, 'Guests dancing under the lights');

        $copy = $this->duplicate($id, '2027-05-15T16:00');
        $copied = $this->photoKeyOf($copy['id']);

        self::assertSame(201, $this->statusCode(), Json\encode($this->last()));
        $cover = Type\shape(['position' => Type\int(), 'description' => Type\nullable(Type\string())], true)->coerce($copy['cover']);
        self::assertSame([30, 'Guests dancing under the lights'], [$cover['position'], $cover['description']]);
        self::assertStringStartsWith('event_cover/' . $copy['id'] . '/', $copied);
        self::assertSame([true, true, true], $this->published($copied));
        self::assertSame([true, true, true], $this->published($photo));
    }

    #[Test]
    public function removingTheOriginalsCoverLeavesTheCopysAsItWas(): void
    {
        $id = $this->original();
        $this->withCover($id, 50, null);
        $copy = $this->duplicate($id, '2027-05-15T16:00');

        $this->as($this->owner, 'DELETE', '/api/events/' . $id . '/cover');

        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        self::assertSame([true, true, true], $this->published($this->photoKeyOf($copy['id'])));
        self::assertNotNull($this->show($copy['id'])['cover']);
    }

    #[Test]
    public function removingTheCopysCoverLeavesTheOriginalsAsItWas(): void
    {
        $id = $this->original();
        $photo = $this->withCover($id, 50, null);
        $copy = $this->duplicate($id, '2027-05-15T16:00');

        $this->as($this->owner, 'DELETE', '/api/events/' . $copy['id'] . '/cover');

        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        self::assertSame([true, true, true], $this->published($photo));
    }

    #[Test]
    public function theOriginalsPurgeLeavesTheCopysCover(): void
    {
        $id = $this->original();
        $photo = $this->withCover($id, 50, null);
        $copy = $this->duplicate($id, '2027-05-15T16:00');
        $copied = $this->photoKeyOf($copy['id']);

        $this->as($this->owner, 'DELETE', '/api/events/' . $id);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        self::mockTime(new DateTimeImmutable('2026-12-01T09:00:00+00:00'));
        self::em()->clear();
        self::service(Pruner::class)->prune();

        self::assertSame([false, false, false], $this->published($photo));
        self::assertSame([true, true, true], $this->published($copied));
    }

    /** @return iterable<string, array{?string, string}> */
    public static function missingStarts(): iterable
    {
        yield 'no start' => [null, 'Choose when the event starts.'];
        yield 'a blank start' => ['  ', 'Choose when the event starts.'];
    }

    #[Test]
    #[DataProvider('missingStarts')]
    public function aCopyNeedsAStartAndSavesNothingWithout(?string $startsAt, string $line): void
    {
        $id = $this->original();
        $events = $this->eventRows();

        $this->as($this->owner, 'POST', '/api/events/' . $id . '/duplicate', ['startsAt' => $startsAt]);

        self::assertSame(422, $this->statusCode(), Json\encode($this->last()));
        self::assertSame($line, $this->violation('startsAt'));
        self::assertSame($events, $this->eventRows());
    }

    #[Test]
    public function aStartThatIsNotADateAndTimeIsRefused(): void
    {
        $this->as($this->owner, 'POST', '/api/events/' . $this->original() . '/duplicate', ['startsAt' => '2027-02-30T16:00']);

        self::assertSame(422, $this->statusCode());
        self::assertNotNull($this->violation('startsAt'));
    }

    /** @return iterable<string, array{SeededRole, bool}> */
    public static function creators(): iterable
    {
        yield 'an administrator' => [SeededRole::Administrator, true];
        yield 'an event manager' => [SeededRole::EventManager, true];
        yield 'a coordinator' => [SeededRole::Coordinator, false];
        yield 'a read-only member' => [SeededRole::ReadOnly, false];
    }

    #[Test]
    #[DataProvider('creators')]
    public function onlyCreateEventsDuplicates(SeededRole $seeded, bool $creates): void
    {
        $id = $this->original();
        $member = $this->member('member@ire.events', $seeded);

        $this->as($member, 'POST', '/api/events/' . $id . '/duplicate', ['startsAt' => '2027-05-15T16:00']);

        self::assertSame($creates ? 201 : 403, $this->statusCode());

        if (!$creates) {
            self::assertSame(ErrorCode::PermissionRequired->type(), $this->last()['type'] ?? null);
        }
    }

    #[Test]
    public function anotherOrganisationsEventIsNotFound(): void
    {
        $id = $this->original();
        $stranger = $this->account('stranger@elsewhere.events');
        self::service(OrganisationFounder::class)->found($stranger, 'Elsewhere', 'NG', 'Africa/Lagos');
        self::em()->flush();
        $events = $this->eventRows();

        $this->as($stranger, 'POST', '/api/events/' . $id . '/duplicate', ['startsAt' => '2027-05-15T16:00']);

        self::assertSame(404, $this->statusCode());
        self::assertSame($events, $this->eventRows());
    }

    #[Test]
    public function aCopyIsAuditedAsACreateNamingTheOriginal(): void
    {
        $id = $this->original();
        $this->withCover($id, 50, null);

        $copy = $this->duplicate($id, '2027-05-15T16:00');

        $entry = self::em()->getRepository(AuditEntry::class)->findOneBy(['action' => EventCreator::CREATED, 'subjectId' => Uuid::fromString($copy['id'])]);
        self::assertInstanceOf(AuditEntry::class, $entry);
        self::assertSame($this->owner->getId()->toRfc4122(), $entry->getActorId()?->toRfc4122());
        self::assertSame([null, $id], $entry->getChanges()['duplicatedFrom'] ?? null);
        self::assertSame([null, '2027-05-15T16:00:00+01:00'], $entry->getChanges()['startsAt'] ?? null);
        self::assertSame([null, $this->photoKeyOf($copy['id'])], $entry->getChanges()['photo'] ?? null);
    }

    #[Test]
    public function aCopyIsMadeAtThePlansLimitSinceADraftCountsTowardNothing(): void
    {
        $id = $this->live($this->original());
        self::service(ScriptedActiveEventsLimit::class)->reach('Free', 1);

        $copy = $this->duplicate($id, '2027-05-15T16:00');

        self::assertSame(201, $this->statusCode(), Json\encode($this->last()));
        self::assertSame('draft', $copy['status']);
    }

    /** @param array<string, mixed> $fields */
    private function original(array $fields = []): string
    {
        $body = $this->as($this->owner, 'POST', $this->path('/events'), [
            'name' => "Amara & Tobi's wedding",
            'type' => 'wedding',
            'startsAt' => '2030-11-14T16:00',
            'endsAt' => '2030-11-15T02:00',
            'timeZone' => 'Africa/Lagos',
            'currency' => 'NGN',
            ...$fields,
        ]);
        self::assertSame(201, $this->statusCode(), Json\encode($body));

        return Type\shape(['id' => Type\string()], true)->coerce($body['event'] ?? null)['id'];
    }

    private function live(string $id): string
    {
        self::service(Connection::class)->executeStatement('UPDATE events SET hosts = :hosts WHERE id = :id', ['hosts' => '["Funmi Adeyemi"]', 'id' => $id]);
        $this->as($this->owner, 'POST', '/api/events/' . $id . '/make-live');
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        return $id;
    }

    /** @return array<string, mixed> */
    private function duplicate(string $id, string $startsAt): array
    {
        return Type\dict(Type\string(), Type\mixed())->coerce($this->as($this->owner, 'POST', '/api/events/' . $id . '/duplicate', ['startsAt' => $startsAt])['event'] ?? []) + ['id' => ''];
    }

    /** @return array<string, mixed> */
    private function show(string $id): array
    {
        $body = $this->as($this->owner, 'GET', '/api/events/' . $id);
        self::assertSame(200, $this->statusCode(), Json\encode($body));

        return Type\dict(Type\string(), Type\mixed())->coerce($body['event'] ?? null);
    }

    private function tag(): string
    {
        return (string) $this->client->getResponse()->headers->get('ETag');
    }

    private function withCover(string $id, int $position, ?string $description): string
    {
        $photoKey = 'event_cover/' . $id . '/' . Uuid::v7()->toRfc4122();
        foreach (Vec\keys(CoverPhotoProcessor::SIZES) as $size) {
            self::service(ObjectStore::class)->publish(EventCoverEditor::sizeKey($photoKey, $size), 'webp', 'image/webp');
        }
        self::em()->getConnection()->executeStatement(
            'INSERT INTO event_covers (event_id, photo_key, position, description, created_at, updated_at) VALUES (:id, :photo, :position, :description, NOW(), NOW())',
            ['id' => $id, 'photo' => $photoKey, 'position' => $position, 'description' => $description],
        );

        return $photoKey;
    }

    private function photoKeyOf(string $id): string
    {
        return Type\string()->coerce(self::em()->getConnection()->fetchOne('SELECT photo_key FROM event_covers WHERE event_id = :id', ['id' => $id]));
    }

    /** @return list<bool> */
    private function published(string $photoKey): array
    {
        $bucket = Type\string()->coerce($_SERVER['STORAGE_BUCKET_PUBLIC'] ?? null);

        return Vec\map(Vec\keys(CoverPhotoProcessor::SIZES), static fn (string $size): bool => self::service(ObjectStore::class)->exists($bucket, EventCoverEditor::sizeKey($photoKey, $size)));
    }

    private function eventRows(): int
    {
        return Type\int()->coerce(self::em()->getConnection()->fetchOne('SELECT COUNT(*) FROM events WHERE organisation_id = :organisation', ['organisation' => $this->organisation->getId()->toRfc4122()]));
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

    private function account(string $address): User
    {
        $user = self::service(UserRegistrar::class)->register($address, 'Person', self::PASSWORD)->user;
        $user->setTimezone('Africa/Lagos');
        self::onboard($user, withOrganisation: false);

        return $user;
    }

    private function member(string $address, SeededRole $seeded): User
    {
        $user = $this->account($address);
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
