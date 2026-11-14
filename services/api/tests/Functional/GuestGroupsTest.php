<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Guest\Group\GuestGroupEditor;
use App\Domain\Organisation\OrganisationFounder;
use App\Domain\User\UserRegistrar;
use App\Entity\AuditEntry;
use App\Entity\GuestGroup;
use App\Entity\Membership;
use App\Entity\Organisation;
use App\Entity\Role;
use App\Entity\User;
use App\Enum\EventRole;
use App\Enum\MembershipStatus;
use App\Enum\SeededRole;
use App\Tests\ApiTestCase;
use App\Tests\Traits\OnboardsAccounts;
use App\Tests\Traits\PutsPeopleOnEvents;
use DateTimeImmutable;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use Psl\Iter;
use Psl\Json;
use Psl\Str;
use Psl\Type;
use Psl\Vec;

/** An event's guest groups (sc-3775): one per guest, their companions with them, so the counts add up. */
final class GuestGroupsTest extends ApiTestCase
{
    use OnboardsAccounts;
    use PutsPeopleOnEvents;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    private User $owner;

    private Organisation $organisation;

    private string $eventId;

    protected function setUp(): void
    {
        parent::setUp();
        $this->client->disableReboot();
        $this->owner = $this->account('owner@ire.events');
        $this->organisation = self::service(OrganisationFounder::class)->found($this->owner, 'Ìrè Events', 'NG', 'Africa/Lagos');
        self::em()->flush();
        $this->eventId = $this->newEvent();
    }

    #[Test]
    public function aGroupStartsEmptyAndTheListCarriesItWithItsCount(): void
    {
        $made = $this->as($this->owner, 'POST', $this->groupsPath(), ['name' => "  Bride's   side "]);

        self::assertSame(201, $this->statusCode());
        $group = Type\shape(['id' => Type\string(), 'name' => Type\string()])->coerce($made['group'] ?? null);
        self::assertSame("Bride's side", $group['name']);
        self::assertSame([[...$group, 'counts' => ['people' => 0, 'guests' => 0, 'companions' => 0]]], $this->list()['groups'] ?? null);
        self::assertCount(1, self::em()->getRepository(AuditEntry::class)->findBy(['action' => GuestGroupEditor::MADE]));
    }

    #[Test]
    public function aGuestIsInOneGroupAndTheirCompanionsAreInItWithThem(): void
    {
        $work = $this->make('Work');
        $guest = $this->add(['fullName' => 'Bisi', 'group' => ['id' => $work], 'companions' => [['fullName' => 'Tunde'], ['fullName' => null]]]);

        self::assertSame(['id' => $work, 'name' => 'Work'], $guest['group'] ?? null);
        self::assertArrayNotHasKey('group', Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce($guest['companions'] ?? [])[0] ?? []);
        self::assertSame(['people' => 3, 'guests' => 1, 'companions' => 2], $this->countsOf($work));

        $this->as($this->owner, 'PUT', $this->guest($guest), ['fullName' => 'Bisi', 'group' => ['name' => 'Family'], 'companions' => $this->kept($guest)], '"1"');

        self::assertSame(200, $this->statusCode());
        self::assertSame(['people' => 0, 'guests' => 0, 'companions' => 0], $this->countsOf($work));
        self::assertSame(['people' => 3, 'guests' => 1, 'companions' => 2], $this->countsOf($this->idOf('Family')));
    }

    #[Test]
    public function aNameTypedOnTheFormIsTheGroupAlreadyCalledThatOrANewOneMadeOnSave(): void
    {
        $bride = $this->make("Bride's side");

        $first = $this->add(['fullName' => 'Bisi', 'group' => ['name' => 'BRIDE’S SIDE']]);
        $second = $this->add(['fullName' => 'Kemi', 'group' => ['name' => 'Óld school']]);

        self::assertSame($bride, Type\shape(['id' => Type\string()], true)->coerce($first['group'])['id']);
        self::assertSame('Óld school', Type\shape(['name' => Type\string()], true)->coerce($second['group'])['name']);
        self::assertCount(2, $this->list()['groups'] ?? []);
    }

    #[Test]
    public function aBlankGroupIsNoGroupAndAnEditWithoutGroupKeepsIt(): void
    {
        $work = $this->make('Work');
        $guest = $this->add(['fullName' => 'Bisi', 'group' => ['name' => '   ']]);
        self::assertNull($guest['group']);

        $this->as($this->owner, 'PUT', $this->guest($guest), ['fullName' => 'Bisi', 'group' => ['id' => $work]], '"1"');
        $kept = $this->as($this->owner, 'PUT', $this->guest($guest), ['fullName' => 'Bisi Adewale'], '"2"');

        self::assertSame(200, $this->statusCode());
        self::assertSame(['id' => $work, 'name' => 'Work'], Type\dict(Type\string(), Type\mixed())->coerce($kept['guest'] ?? null)['group'] ?? null);

        $none = $this->as($this->owner, 'PUT', $this->guest($guest), ['fullName' => 'Bisi Adewale', 'group' => null], '"3"');
        $guest = Type\dict(Type\string(), Type\mixed())->coerce($none['guest'] ?? null);
        self::assertArrayHasKey('group', $guest);
        self::assertNull($guest['group']);
    }

    #[Test]
    public function aGuestAddedOrEditedWithoutAGroupWorksAsBefore(): void
    {
        $guest = $this->add(['fullName' => 'Bisi', 'companions' => [['fullName' => 'Tunde']]]);
        self::assertNull($guest['group']);

        $this->as($this->owner, 'PUT', $this->guest($guest), ['fullName' => 'Bisi Adewale', 'companions' => $this->kept($guest)], '"1"');

        self::assertSame(200, $this->statusCode());
        self::assertSame(['people' => 2, 'guests' => 1, 'companions' => 1], $this->list()['ungrouped'] ?? null);
    }

    /** @return iterable<string, array{string, string}> */
    public static function refusals(): iterable
    {
        yield 'blank' => ['   ', 'Enter a name for the group.'];
        yield 'over 60 characters' => [Str\repeat('é', 61), 'A group name can be up to 60 characters.'];
        yield 'a name already used, case and accents aside' => ['WÖRK', "There's already a group called Work."];
    }

    #[Test]
    #[DataProvider('refusals')]
    public function aNameIsRefusedBesideTheFieldAndNothingIsSaved(string $typed, string $message): void
    {
        $work = $this->make('Work');

        $this->as($this->owner, 'POST', $this->groupsPath(), ['name' => $typed]);
        self::assertSame(422, $this->statusCode());
        self::assertSame(['name' => $message], $this->violations());

        $this->as($this->owner, 'PUT', $this->groupsPath() . '/' . $this->make('Family'), ['name' => $typed]);
        self::assertSame(422, $this->statusCode());
        self::assertSame(['name' => $message], $this->violations());
        self::assertSame(['Family', 'Work'], $this->names());
        self::assertNotSame('', $work);
    }

    #[Test]
    public function aGroupNameIsRefusedOnTheGuestFormWithTheGuestsOtherProblems(): void
    {
        $this->as($this->owner, 'POST', $this->guests(), ['fullName' => '', 'group' => ['name' => Str\repeat('a', 61)]]);

        self::assertSame(422, $this->statusCode());
        self::assertSame(['fullName' => 'Enter their full name.', 'group.name' => 'A group name can be up to 60 characters.'], $this->violations());
        self::assertSame([], $this->names());
    }

    #[Test]
    public function fiftyGroupsIsTheMostAndTheFormCanStillChooseOne(): void
    {
        foreach (Vec\range(1, GuestGroup::MOST_PER_EVENT) as $number) {
            $this->make('Table ' . $number);
        }

        $this->as($this->owner, 'POST', $this->groupsPath(), ['name' => 'Work']);
        self::assertSame(422, $this->statusCode());
        self::assertSame(['name' => 'This event has 50 groups, the most it can have. Delete one to make another.'], $this->violations());

        $this->as($this->owner, 'POST', $this->guests(), ['fullName' => 'Bisi', 'group' => ['name' => 'Work']]);
        self::assertSame(422, $this->statusCode());
        self::assertSame(['group.name'], Vec\keys($this->violations()));
        self::assertSame(0, $this->rows('guests'));

        $this->add(['fullName' => 'Bisi', 'group' => ['name' => 'table 7']]);
        $this->as($this->owner, 'PUT', $this->groupsPath() . '/' . $this->idOf('Table 1'), ['name' => 'Work']);
        self::assertSame(200, $this->statusCode());
        self::assertCount(GuestGroup::MOST_PER_EVENT, $this->names());
    }

    #[Test]
    public function aRenameAppliesEverywhereAtOnceAndMayChangeOnlyTheCase(): void
    {
        $work = $this->make('Work');
        $guest = $this->add(['fullName' => 'Bisi', 'group' => ['id' => $work]]);

        $this->as($this->owner, 'PUT', $this->groupsPath() . '/' . $work, ['name' => 'WORK']);
        self::assertSame(200, $this->statusCode());
        $this->as($this->owner, 'PUT', $this->groupsPath() . '/' . $work, ['name' => 'Office']);
        self::assertSame(200, $this->statusCode());

        self::assertSame(['id' => $work, 'name' => 'Office'], Type\dict(Type\string(), Type\mixed())->coerce($this->as($this->owner, 'GET', $this->guest($guest))['guest'] ?? null)['group'] ?? null);
        self::assertSame(['Office'], $this->names());
        self::assertSame([['id' => $work, 'name' => 'Office']], Vec\map($this->byGroup(), static fn (array $row): mixed => $row['group']));
    }

    #[Test]
    public function deletingAGroupLeavesItsGuestsOnTheListWithNoGroup(): void
    {
        $work = $this->make('Work');
        $this->add(['fullName' => 'Bisi', 'group' => ['id' => $work], 'companions' => [['fullName' => 'Tunde']]]);
        $this->add(['fullName' => 'Kemi']);

        $this->as($this->owner, 'DELETE', $this->groupsPath() . '/' . $work);

        self::assertSame(204, $this->statusCode());
        self::assertSame([], $this->names());
        self::assertSame(3, $this->rows('guests'));
        self::assertSame(['people' => 3, 'guests' => 2, 'companions' => 1], $this->list()['ungrouped'] ?? null);
        self::assertSame([null, null], Vec\map(Type\vec(Type\shape(['group' => Type\mixed()], true))->coerce($this->list()['guests'] ?? []), static fn (array $row): mixed => $row['group']));
    }

    #[Test]
    public function theCountsByGroupAddUpToEveryoneWithNoGroupAsAGroupOfItsOwn(): void
    {
        $bride = $this->make("Bride's side");
        $work = $this->make('Work');
        $this->make('Empty');
        $this->add(['fullName' => 'Bisi', 'group' => ['id' => $bride], 'companions' => [['fullName' => 'Tunde'], ['fullName' => null]]]);
        $this->add(['fullName' => 'Kemi', 'group' => ['id' => $work]]);
        $this->add(['fullName' => 'Musa', 'companions' => [['fullName' => 'Amina']]]);

        $list = $this->list();
        $byGroup = $this->byGroup();

        self::assertSame([3, 0, 1, 2], Vec\map($byGroup, static fn (array $row): mixed => Type\shape(['onList' => Type\int()], true)->coerce($row['counts'])['onList']));
        self::assertSame(["Bride's side", 'Empty', 'Work', null], Vec\map($byGroup, static fn (array $row): mixed => null === $row['group'] ? null : Type\shape(['name' => Type\string()], true)->coerce($row['group'])['name']));
        $people = Vec\map(Type\vec(Type\shape(['counts' => Type\shape(['people' => Type\int()], true)], true))->coerce($list['groups'] ?? []), static fn (array $row): int => $row['counts']['people']);
        $ungrouped = Type\shape(['people' => Type\int()], true)->coerce($list['ungrouped'] ?? null)['people'];
        self::assertSame(6, Iter\reduce($people, static fn (int $sum, int $one): int => $sum + $one, $ungrouped));
        self::assertSame(6, Type\shape(['people' => Type\int()], true)->coerce($list['counts'] ?? null)['people']);
    }

    #[Test]
    public function withoutGuestsManageGroupsAreSeenButNotChanged(): void
    {
        $work = $this->make('Work');
        $guest = $this->add(['fullName' => 'Bisi', 'group' => ['id' => $work]]);
        $viewer = $this->member('viewer@ire.events', EventRole::CanView);

        $seen = $this->as($viewer, 'GET', $this->guests());
        self::assertSame(200, $this->statusCode());
        self::assertSame(['id' => $work, 'name' => 'Work'], Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce($seen['guests'] ?? [])[0]['group'] ?? null);

        foreach ([['POST', $this->groupsPath(), ['name' => 'Family']], ['PUT', $this->groupsPath() . '/' . $work, ['name' => 'Office']], ['DELETE', $this->groupsPath() . '/' . $work, null]] as [$method, $path, $body]) {
            $this->as($viewer, $method, $path, $body);
            self::assertSame(403, $this->statusCode(), $method);
        }

        $this->as($viewer, 'PUT', $this->guest($guest), ['fullName' => 'Bisi', 'group' => null], '"1"');
        self::assertSame(403, $this->statusCode());
        self::assertSame(['Work'], $this->names());
    }

    #[Test]
    public function anotherEventsGroupIsNotFoundAndAnotherOrganisationsEventIsNotFound(): void
    {
        $stranger = $this->account('stranger@elsewhere.events');
        self::service(OrganisationFounder::class)->found($stranger, 'Elsewhere', 'NG', 'Africa/Lagos');
        self::em()->flush();
        $theirs = $this->newEvent();
        $theirGroup = Type\shape(['id' => Type\string()], true)->coerce($this->as($this->owner, 'POST', '/api/events/' . $theirs . '/guest-groups', ['name' => 'Work'])['group'] ?? null)['id'];

        $this->as($stranger, 'POST', $this->groupsPath(), ['name' => 'Work']);
        self::assertSame(404, $this->statusCode());
        $this->as($this->owner, 'PUT', $this->groupsPath() . '/' . $theirGroup, ['name' => 'Office']);
        self::assertSame(404, $this->statusCode());
        $this->as($this->owner, 'DELETE', $this->groupsPath() . '/' . $theirGroup);
        self::assertSame(404, $this->statusCode());
        $this->as($this->owner, 'POST', $this->guests(), ['fullName' => 'Bisi', 'group' => ['id' => $theirGroup]]);
        self::assertSame(422, $this->statusCode());
        self::assertSame(['group.id'], Vec\keys($this->violations()));
    }

    #[Test]
    public function aDuplicatedEventCopiesTheGroupsEmpty(): void
    {
        $work = $this->make('Work');
        $this->add(['fullName' => 'Bisi', 'group' => ['id' => $work]]);

        $copy = $this->as($this->owner, 'POST', '/api/events/' . $this->eventId . '/duplicate', ['startsAt' => '2027-05-15T16:00', 'copyGuests' => true]);
        self::assertSame(201, $this->statusCode(), Json\encode($copy));
        $this->eventId = Type\shape(['id' => Type\string()], true)->coerce($copy['event'] ?? null)['id'];

        self::assertSame(['Work'], $this->names());
        self::assertSame([['people' => 0, 'guests' => 0, 'companions' => 0]], Vec\map(Type\vec(Type\shape(['counts' => Type\mixed()], true))->coerce($this->list()['groups'] ?? []), static fn (array $row): mixed => $row['counts']));
    }

    private function make(string $name): string
    {
        $body = $this->as($this->owner, 'POST', $this->groupsPath(), ['name' => $name]);
        self::assertSame(201, $this->statusCode(), Json\encode($body));

        return Type\shape(['id' => Type\string()], true)->coerce($body['group'] ?? null)['id'];
    }

    private function idOf(string $name): string
    {
        $group = Iter\search(Type\vec(Type\shape(['id' => Type\string(), 'name' => Type\string()], true))->coerce($this->list()['groups'] ?? []), static fn (array $row): bool => $row['name'] === $name);

        return $group['id'] ?? self::fail('no group called ' . $name);
    }

    /** @return array<string, mixed> */
    private function countsOf(string $id): mixed
    {
        $group = Iter\search(Type\vec(Type\shape(['id' => Type\string(), 'counts' => Type\dict(Type\string(), Type\mixed())], true))->coerce($this->list()['groups'] ?? []), static fn (array $row): bool => $row['id'] === $id);

        return $group['counts'] ?? self::fail('no group ' . $id);
    }

    /** @return list<string> */
    private function names(): array
    {
        return Vec\map(Type\vec(Type\shape(['name' => Type\string()], true))->coerce($this->list()['groups'] ?? []), static fn (array $row): string => $row['name']);
    }

    /** @return array<string, mixed> */
    private function list(): array
    {
        $body = $this->as($this->owner, 'GET', $this->guests());
        self::assertSame(200, $this->statusCode());

        return $body;
    }

    /** @return list<array{group: mixed, counts: mixed}> */
    private function byGroup(): array
    {
        $headcount = Type\shape(['headcount' => Type\shape(['byGroup' => Type\vec(Type\shape(['group' => Type\mixed(), 'counts' => Type\mixed()]))], true)], true)->coerce($this->as($this->owner, 'GET', '/api/events/' . $this->eventId . '/headcount'));

        return $headcount['headcount']['byGroup'];
    }

    /** @return list<array{id: string, fullName: mixed}> */
    private function kept(mixed $guest): array
    {
        return Vec\map(Type\shape(['companions' => Type\vec(Type\shape(['id' => Type\string(), 'fullName' => Type\mixed()], true))], true)->coerce($guest)['companions'], static fn (array $one): array => ['id' => $one['id'], 'fullName' => $one['fullName']]);
    }

    private function groupsPath(): string
    {
        return '/api/events/' . $this->eventId . '/guest-groups';
    }

    /** @return array<string, mixed> */
    private function add(mixed $guest): array
    {
        $body = $this->as($this->owner, 'POST', $this->guests(), Type\dict(Type\string(), Type\mixed())->coerce($guest));
        self::assertSame(201, $this->statusCode(), Json\encode($body));

        return Type\dict(Type\string(), Type\mixed())->coerce($body['guest'] ?? null);
    }

    private function rows(string $table): int
    {
        return Type\int()->coerce(self::em()->getConnection()->fetchOne('SELECT COUNT(*) FROM ' . $table));
    }

    private function newEvent(): string
    {
        $body = $this->as($this->owner, 'POST', '/api/orgs/' . $this->organisation->getId()->toRfc4122() . '/events', [
            'name' => 'Owambe',
            'type' => 'wedding',
            'startsAt' => '2026-11-14T16:00',
            'endsAt' => '2026-11-15T02:00',
        ]);
        self::assertSame(201, $this->statusCode());

        return Type\shape(['id' => Type\string()], true)->coerce($body['event'] ?? null)['id'];
    }

    private function guests(): string
    {
        return '/api/events/' . $this->eventId . '/guests';
    }

    private function guest(mixed $guest): string
    {
        return $this->guests() . '/' . Type\shape(['id' => Type\string()], true)->coerce($guest)['id'];
    }

    /** @return array<string, string> */
    private function violations(): array
    {
        $violations = Type\vec(Type\shape(['propertyPath' => Type\string(), 'message' => Type\string()], true))->coerce($this->last()['violations'] ?? []);
        $byPath = [];

        foreach ($violations as $violation) {
            $byPath[$violation['propertyPath']] = $violation['message'];
        }

        return $byPath;
    }

    private function account(string $address): User
    {
        $user = self::service(UserRegistrar::class)->register($address, 'Person', self::PASSWORD)->user;
        self::onboard($user, withOrganisation: false);

        return $user;
    }

    private function member(string $address, EventRole $on): User
    {
        $user = $this->account($address);
        $role = self::em()->getRepository(Role::class)->findOneBy(['organisation' => $this->organisation, 'seededAs' => SeededRole::Member]);
        $organisation = self::em()->find(Organisation::class, $this->organisation->getId()) ?? self::fail('no organisation');
        self::em()->persist(new Membership($organisation, $user, Type\instance_of(Role::class)->coerce($role), MembershipStatus::Active, new DateTimeImmutable()));
        self::em()->flush();
        self::onEvent($user, $this->eventId, $on);

        return $user;
    }

    /**
     * @param array<string, mixed>|null $body
     *
     * @return array<string, mixed>
     */
    private function as(User $user, string $method, string $path, ?array $body = null, ?string $ifMatch = null): array
    {
        $who = self::em()->find(User::class, $user->getId()) ?? self::fail('no user');
        $this->client->request($method, $path, server: [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_AUTHORIZATION' => 'Bearer ' . self::service(JWTTokenManagerInterface::class)->create($who),
            'HTTP_ACCEPT_LANGUAGE' => 'en',
            ...null === $ifMatch ? [] : ['HTTP_IF_MATCH' => $ifMatch],
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
