<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Organisation\OrganisationFounder;
use App\Domain\User\UserRegistrar;
use App\Entity\Membership;
use App\Entity\Organisation;
use App\Entity\Role;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\EventRole;
use App\Enum\MembershipStatus;
use App\Enum\Permission;
use App\Enum\SeededRole;
use App\Http\Access\Grants;
use App\Http\Access\Interfaces\EventDirectoryInterface;
use App\Http\Access\Interfaces\MembershipDirectoryInterface;
use App\Tests\ApiTestCase;
use App\Tests\Double\Messaging\RecordingHub;
use App\Tests\Fixtures\Access\FixtureDirectories;
use App\Tests\Traits\OnboardsAccounts;
use App\Tests\Traits\PutsPeopleOnEvents;
use DateTimeImmutable;
use Doctrine\DBAL\Connection;
use Lcobucci\JWT\Encoding\JoseEncoder;
use Lcobucci\JWT\Token\Parser;
use Lcobucci\JWT\UnencryptedToken;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\Test;
use Psl\Dict;
use Psl\Iter;
use Psl\Json;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use SensitiveParameter;
use Symfony\Component\Clock\Test\ClockSensitiveTrait;

final class HeadcountTest extends ApiTestCase
{
    use ClockSensitiveTrait;
    use OnboardsAccounts;
    use PutsPeopleOnEvents;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    private const array NOBODY = [
        'onList' => 0,
        'notYetInvited' => 0,
        'invited' => 0,
        'accepted' => 0,
        'maybe' => 0,
        'awaitingReply' => 0,
        'held' => 0,
        'heldBy' => ['hostNoReply' => 0, 'hostMaybe' => 0, 'hostNotComing' => 0],
        'declined' => 0,
    ];

    private User $owner;

    private Organisation $organisation;

    private string $eventId;

    protected function setUp(): void
    {
        parent::setUp();
        $this->client->disableReboot();
        self::mockTime(new DateTimeImmutable('2026-10-17T13:20:00+00:00'));
        $this->owner = $this->account('owner@ire.events');
        $this->organisation = self::service(OrganisationFounder::class)->found($this->owner, 'Ìrè Events', 'NG', 'Africa/Lagos');
        self::em()->flush();
        $this->eventId = $this->live("Amara & Tobi's wedding");
    }

    #[Test]
    public function anEventWithNobodyOnTheListCountsZeroEverywhere(): void
    {
        $empty = $this->newEvent();

        $headcount = $this->as($this->owner, 'GET', $this->headcount($empty));

        self::assertSame(200, $this->statusCode());
        self::assertSame(['headcount' => ['counts' => self::NOBODY, 'byGroup' => [], 'byDietaryNeed' => ['addsUp' => false, 'needs' => []]]], $headcount);
    }

    #[Test]
    public function everyoneIsCountedOnceAsPeopleAndTheCountsAddUp(): void
    {
        $this->answer($this->add('Adaeze', ['Obi', null]), 'coming');
        $this->answer($this->add('Bisi', ['Tunde']), 'maybe');
        $this->answer($this->add('Chidi', ['Ngozi']), 'notComing');
        $this->markInvited($this->add('Dayo', ['Femi']));
        $this->add('Emeka');

        $counts = $this->counts();

        self::assertSame([
            'onList' => 10,
            'notYetInvited' => 1,
            'invited' => 9,
            'accepted' => 3,
            'maybe' => 1,
            'awaitingReply' => 1,
            'held' => 3,
            'heldBy' => ['hostNoReply' => 1, 'hostMaybe' => 1, 'hostNotComing' => 1],
            'declined' => 1,
        ], $counts);
        self::assertSame($counts['invited'], $counts['accepted'] + $counts['maybe'] + $counts['awaitingReply'] + $counts['held'] + $counts['declined']);
        self::assertSame($counts['onList'], $counts['invited'] + $counts['notYetInvited']);
        self::assertSame($counts['held'], Iter\reduce($counts['heldBy'], static fn (int $sum, int $held): int => $sum + $held, 0));
        self::assertSame($counts['onList'], $this->listed());
    }

    #[Test]
    public function untilGroupsExistEveryoneIsInNoGroupAndNoNeedIsCounted(): void
    {
        $this->add('Adaeze', ['Obi']);

        $headcount = Type\dict(Type\string(), Type\mixed())->coerce($this->as($this->owner, 'GET', $this->headcount())['headcount'] ?? null);

        self::assertSame([['group' => null, 'counts' => $this->counts()]], $headcount['byGroup']);
        self::assertSame(['addsUp' => false, 'needs' => []], $headcount['byDietaryNeed']);
    }

    #[Test]
    public function aHostsReplyInvitesThemWithTheirCompanionAndMovesTheCompanion(): void
    {
        $token = $this->token($this->add('Adaeze', ['Obi']));
        $this->add('Bisi');
        $held = fn (): array => Vec\map(['heldBy', 'accepted', 'invited', 'notYetInvited'], fn (string $key): mixed => $this->counts()[$key]);

        self::assertSame([['hostNoReply' => 0, 'hostMaybe' => 0, 'hostNotComing' => 0], 0, 0, 3], $held());

        $this->reply($token, 'notComing');
        self::assertSame([['hostNoReply' => 0, 'hostMaybe' => 0, 'hostNotComing' => 1], 0, 2, 1], $held());

        $this->reply($token, 'coming');
        self::assertSame([['hostNoReply' => 0, 'hostMaybe' => 0, 'hostNotComing' => 0], 2, 2, 1], $held());
    }

    #[Test]
    public function aGuestMarkedByHandIsAwaitingAReplyAndTheirCompanionIsHeld(): void
    {
        $guest = $this->add('Dayo', ['Femi']);
        self::assertSame([0, 2, 0], Vec\map(['awaitingReply', 'notYetInvited', 'held'], fn (string $key): mixed => $this->counts()[$key]));

        $this->markInvited($guest);
        self::assertSame([1, 0, 1, 2], Vec\map(['awaitingReply', 'notYetInvited', 'held', 'invited'], fn (string $key): mixed => $this->counts()[$key]));

        $this->as($this->owner, 'DELETE', $this->guests() . '/' . $guest . '/invitation');
        self::assertSame([0, 2, 0, 0], Vec\map(['awaitingReply', 'notYetInvited', 'held', 'invited'], fn (string $key): mixed => $this->counts()[$key]));
    }

    #[Test]
    public function eachChangeIsPublishedPrivatelyToThisEventsHeadcountAsTheReadAnswers(): void
    {
        $token = $this->token($this->add('Adaeze', ['Obi']));
        $topic = 'events/' . $this->eventId . '/headcount';
        $hub = self::service(RecordingHub::class);
        $viewer = $this->member('ada@ire.events', EventRole::CanView);

        $added = $hub->lastOn($topic) ?? self::fail('nothing published on adding');
        self::assertTrue($added->isPrivate());
        self::assertSame($this->as($viewer, 'GET', $this->headcount()), Json\decode($added->getData()));

        $this->reply($token, 'coming');

        $replied = $hub->lastOn($topic) ?? self::fail('nothing published on a reply');
        self::assertNotSame($added, $replied);
        self::assertSame($this->as($viewer, 'GET', $this->headcount()), Json\decode($replied->getData()));
        self::assertSame(2, $this->counts()['accepted']);
    }

    #[Test]
    public function readingTheCountsChangesNoGuestAndPublishesNothing(): void
    {
        $this->answer($this->add('Adaeze', ['Obi']), 'maybe');
        $list = $this->as($this->owner, 'GET', $this->guests());
        $published = Iter\count(self::service(RecordingHub::class)->published);

        $this->as($this->owner, 'GET', $this->headcount());
        $this->as($this->owner, 'GET', $this->headcount());

        self::assertSame($list, $this->as($this->owner, 'GET', $this->guests()));
        self::assertSame($published, Iter\count(self::service(RecordingHub::class)->published));
    }

    #[Test]
    public function aMemberWithoutGuestsReadOnThisEventIsRefused403(): void
    {
        $organisation = $this->organisation->getId();
        $directories = new FixtureDirectories(
            [$organisation->toRfc4122() => Grants::only(Vec\filter(Permission::cases(), static fn (Permission $permission): bool => Permission::GuestsRead !== $permission))],
            [$this->eventId => $organisation],
        );
        $this->client->getKernel()->shutdown();
        $this->client->getKernel()->boot();
        self::getContainer()->set(MembershipDirectoryInterface::class, $directories);
        self::getContainer()->set(EventDirectoryInterface::class, $directories);

        $body = $this->as($this->owner, 'GET', $this->headcount());

        self::assertSame(403, $this->statusCode());
        self::assertSame(ErrorCode::PermissionRequired->type(), $body['type'] ?? null);
        self::assertSame(Permission::GuestsRead->value, $body['permission'] ?? null);
        self::assertArrayNotHasKey('headcount', $body);
    }

    #[Test]
    public function aMemberWithNoRoleOnThisEventIsToldNotFound(): void
    {
        $elsewhere = $this->newEvent();
        $outsider = $this->member('ada@ire.events', null);
        self::onEvent($outsider, $elsewhere, EventRole::Lead);

        $body = $this->as($outsider, 'GET', $this->headcount());

        self::assertSame(404, $this->statusCode());
        self::assertArrayNotHasKey('headcount', $body);
    }

    #[Test]
    public function anotherOrganisationsEventAndOneThatDoesNotExistAreTheSameNotFound(): void
    {
        $this->add('Adaeze');
        $stranger = $this->account('stranger@else.where');
        self::service(OrganisationFounder::class)->found($stranger, 'Elsewhere', 'NG', 'Africa/Lagos');
        self::em()->flush();

        $answers = [];
        foreach ([$this->eventId, '0193f5a8-0000-7000-8000-000000000000'] as $event) {
            $this->as($stranger, 'GET', $this->headcount($event));
            $answers[] = [$this->statusCode(), $this->last()['type'] ?? null, $this->last()['detail'] ?? null];
        }

        self::assertSame(404, $answers[0][0]);
        self::assertSame(ErrorCode::NotFound->type(), $answers[0][1]);
        self::assertSame([$answers[0], $answers[0]], $answers);
    }

    #[Test]
    public function eachEventOnEventsCarriesTheTilesMeasureOfItsGuests(): void
    {
        $this->answer($this->add('Adaeze', ['Obi']), 'coming');
        $this->answer($this->add('Bisi'), 'notComing');
        $this->answer($this->add('Chidi'), 'maybe');
        $this->markInvited($this->add('Dayo', ['Femi']));
        $this->add('Emeka');
        $empty = $this->newEvent();

        $figures = $this->listedFigures($this->owner);

        self::assertSame(['invited' => 6, 'coming' => 2, 'notReplied' => 2], $figures[$this->eventId] ?? null);
        self::assertSame(['invited' => 0, 'coming' => 0, 'notReplied' => 0], $figures[$empty] ?? null);
    }

    #[Test]
    public function eventsCarriesNoGuestFiguresWithoutGuestsRead(): void
    {
        $this->answer($this->add('Adaeze'), 'coming');
        $organisation = $this->organisation->getId();
        $directories = new FixtureDirectories(
            [$organisation->toRfc4122() => Grants::only(Vec\filter(Permission::cases(), static fn (Permission $permission): bool => Permission::GuestsRead !== $permission))],
            [$this->eventId => $organisation],
        );
        $this->client->getKernel()->shutdown();
        $this->client->getKernel()->boot();
        self::getContainer()->set(MembershipDirectoryInterface::class, $directories);
        self::getContainer()->set(EventDirectoryInterface::class, $directories);

        self::assertSame([$this->eventId => null], $this->listedFigures($this->owner));

        $body = $this->as($this->owner, 'POST', $this->headcountsSubscription(), ['events' => [$this->eventId]]);
        self::assertSame(200, $this->statusCode(), Json\encode($body));
        self::assertSame(['subscribe' => []], $this->claims($body));
    }

    #[Test]
    public function aMemberSeesTheFiguresOfTheEventTheyHoldARoleOnAlone(): void
    {
        $this->answer($this->add('Adaeze', ['Obi']), 'coming');
        $other = $this->newEvent();
        $member = $this->member('ada@ire.events', EventRole::CanView);

        self::assertSame([$this->eventId => ['invited' => 2, 'coming' => 2, 'notReplied' => 0]], $this->listedFigures($member));

        $body = $this->as($member, 'POST', $this->headcountsSubscription(), ['events' => [$this->eventId, $other, 'not-an-id']]);
        self::assertSame(200, $this->statusCode(), Json\encode($body));
        self::assertSame(['subscribe' => ['events/' . $this->eventId . '/headcount']], $this->claims($body));
    }

    #[Test]
    public function anotherOrganisationsEventsAreLeftOutOfTheHeadcountsSubscription(): void
    {
        $stranger = $this->account('stranger@else.where');
        $elsewhere = self::service(OrganisationFounder::class)->found($stranger, 'Elsewhere', 'NG', 'Africa/Lagos');
        self::em()->flush();

        $body = $this->as($stranger, 'POST', '/api/orgs/' . $elsewhere->getId()->toRfc4122() . '/events/headcounts/subscriptions', ['events' => [$this->eventId]]);

        self::assertSame(200, $this->statusCode(), Json\encode($body));
        self::assertSame(['subscribe' => []], $this->claims($body));

        $this->as($stranger, 'POST', $this->headcountsSubscription(), ['events' => [$this->eventId]]);
        self::assertSame(404, $this->statusCode());
    }

    /** @return array<string, mixed> */
    private function listedFigures(User $user): array
    {
        $body = $this->as($user, 'GET', '/api/orgs/' . $this->organisation->getId()->toRfc4122() . '/events');
        self::assertSame(200, $this->statusCode(), Json\encode($body));
        $events = Type\vec(Type\shape(['id' => Type\string(), 'guests' => Type\mixed()], true))->coerce($body['events'] ?? null);

        return Dict\from_entries(Vec\map($events, static fn (array $event): array => [$event['id'], $event['guests']]));
    }

    private function headcountsSubscription(): string
    {
        return '/api/orgs/' . $this->organisation->getId()->toRfc4122() . '/events/headcounts/subscriptions';
    }

    /**
     * @param array<string, mixed> $body
     */
    private function claims(array $body): mixed
    {
        $token = new Parser(new JoseEncoder())->parse(Type\non_empty_string()->coerce($body['token'] ?? null));
        self::assertInstanceOf(UnencryptedToken::class, $token);

        return $token->claims()->get('mercure');
    }

    /** @return array<string, mixed> */
    private function counts(): array
    {
        $body = $this->as($this->owner, 'GET', $this->headcount());
        self::assertSame(200, $this->statusCode(), Json\encode($body));

        return Type\dict(Type\string(), Type\mixed())->coerce($body['headcount']['counts'] ?? null);
    }

    private function listed(): int
    {
        return Type\int()->coerce(self::service(Connection::class)->fetchOne('SELECT COUNT(*) FROM guests WHERE event_id = :event', ['event' => $this->eventId]));
    }

    /** @param list<?string> $companions */
    private function add(string $name, array $companions = []): string
    {
        $body = $this->as($this->owner, 'POST', $this->guests(), [
            'fullName' => $name,
            'companions' => Vec\map($companions, static fn (?string $companion): array => ['fullName' => $companion]),
        ]);
        self::assertSame(201, $this->statusCode(), Json\encode($body));

        return Type\shape(['id' => Type\string()], true)->coerce($body['guest'] ?? null)['id'];
    }

    private function markInvited(string $guest): void
    {
        $this->as($this->owner, 'PUT', $this->guests() . '/' . $guest . '/invitation', ['how' => 'inPerson']);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
    }

    private function answer(string $guest, string $answer): void
    {
        $this->reply($this->token($guest), $answer);
    }

    private function token(string $guest): string
    {
        $body = $this->as($this->owner, 'GET', $this->guests() . '/' . $guest . '/link');
        self::assertSame(200, $this->statusCode(), Json\encode($body));

        return Str\after(Type\string()->coerce($body['url'] ?? null), '/i/') ?? self::fail('no token');
    }

    private function reply(#[SensitiveParameter] string $token, string $answer): void
    {
        $this->client->request('POST', '/api/guest-links/reply', server: ['CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT_LANGUAGE' => 'en'], content: Json\encode(['token' => $token, 'answer' => $answer]));
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
    }

    private function newEvent(): string
    {
        $body = $this->as($this->owner, 'POST', '/api/orgs/' . $this->organisation->getId()->toRfc4122() . '/events', ['name' => 'Owambe', 'type' => 'wedding', 'startsAt' => '2030-11-14T16:00', 'endsAt' => '2030-11-15T02:00', 'timeZone' => 'Africa/Lagos', 'currency' => 'NGN']);
        self::assertSame(201, $this->statusCode(), Json\encode($body));

        return Type\shape(['id' => Type\string()], true)->coerce($body['event'] ?? null)['id'];
    }

    private function live(string $name): string
    {
        $body = $this->as($this->owner, 'POST', '/api/orgs/' . $this->organisation->getId()->toRfc4122() . '/events', ['name' => $name, 'type' => 'wedding', 'startsAt' => '2030-11-14T16:00', 'endsAt' => '2030-11-15T02:00', 'timeZone' => 'Africa/Lagos', 'currency' => 'NGN']);
        self::assertSame(201, $this->statusCode(), Json\encode($body));
        $id = Type\shape(['id' => Type\string()], true)->coerce($body['event'] ?? null)['id'];
        self::service(Connection::class)->executeStatement('UPDATE events SET hosts = :hosts WHERE id = :id', ['hosts' => '["Funmi Adeyemi"]', 'id' => $id]);
        $this->as($this->owner, 'POST', '/api/events/' . $id . '/make-live');
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        return $id;
    }

    private function guests(): string
    {
        return '/api/events/' . $this->eventId . '/guests';
    }

    private function headcount(?string $eventId = null): string
    {
        return '/api/events/' . ($eventId ?? $this->eventId) . '/headcount';
    }

    private function account(string $address): User
    {
        $user = self::service(UserRegistrar::class)->register($address, 'Person', self::PASSWORD)->user;
        self::onboard($user, withOrganisation: false);

        return $user;
    }

    private function member(string $address, ?EventRole $on): User
    {
        $user = $this->account($address);
        $role = self::em()->getRepository(Role::class)->findOneBy(['organisation' => $this->organisation, 'seededAs' => SeededRole::Member]);
        $organisation = self::em()->find(Organisation::class, $this->organisation->getId()) ?? self::fail('no organisation');
        self::em()->persist(new Membership($organisation, $user, Type\instance_of(Role::class)->coerce($role), MembershipStatus::Active, new DateTimeImmutable()));
        self::em()->flush();

        if (null !== $on) {
            self::onEvent($user, $this->eventId, $on);
        }

        return $user;
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
            'HTTP_ACCEPT_LANGUAGE' => 'en',
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
