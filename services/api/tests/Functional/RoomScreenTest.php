<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Organisation\OrganisationFounder;
use App\Domain\User\UserRegistrar;
use App\Entity\Membership;
use App\Entity\Organisation;
use App\Entity\Role;
use App\Entity\User;
use App\Enum\EventRole;
use App\Enum\MembershipStatus;
use App\Enum\RealtimeTopic;
use App\Enum\SeededRole;
use App\Tests\ApiTestCase;
use App\Tests\Double\Messaging\RecordingHub;
use App\Tests\Traits\OnboardsAccounts;
use App\Tests\Traits\PutsPeopleOnEvents;
use DateTimeImmutable;
use Doctrine\DBAL\Connection;
use Lcobucci\JWT\Encoding\JoseEncoder;
use Lcobucci\JWT\Token\Parser;
use Lcobucci\JWT\UnencryptedToken;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use Psl\Dict;
use Psl\Json;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use SensitiveParameter;
use Symfony\Component\Clock\Test\ClockSensitiveTrait;

/** The room screen (sc-3897): a link for each place, what is on and the next three shown to guests, rounded down, never late; replaced, and Finished. */
final class RoomScreenTest extends ApiTestCase
{
    use ClockSensitiveTrait;
    use OnboardsAccounts;
    use PutsPeopleOnEvents;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    private User $owner;

    private Organisation $organisation;

    private string $eventId;

    /** @var array<string, string> item ids by title */
    private array $items = [];

    protected function setUp(): void
    {
        parent::setUp();
        $this->client->disableReboot();
        self::mockTime(new DateTimeImmutable('2027-03-01T10:00:00Z'));
        $this->owner = $this->account('owner@ire.events', 'Funmi Adeyemi');
        $this->organisation = self::service(OrganisationFounder::class)->found($this->owner, 'Ìrè Events', 'NG', 'Africa/Lagos');
        self::em()->flush();
        $this->eventId = $this->live();
    }

    #[Test]
    public function thereIsALinkForEachPlaceMainFirstThenByFirstItemAndTheSameOneEachTime(): void
    {
        $this->sample();

        $links = $this->links();

        self::assertSame([null, 'Hall', 'Garden'], Vec\map($links, static fn (array $link): ?string => $link['place']));
        foreach ($links as $link) {
            self::assertMatchesRegularExpression('/^[A-Za-z0-9_-]{22}$/', $link['token']);
            self::assertNull($link['replacedAt']);
        }
        self::assertSame($links, $this->links());
    }

    #[Test]
    public function aPlaceMovedToANewNameHasItsLinkTheFirstTimeTheLinksAreAsked(): void
    {
        $this->sample();
        $this->links();

        $this->client->request('PUT', '/api/events/' . $this->eventId . '/schedule/items/' . $this->items['Vendors load in'], server: [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_AUTHORIZATION' => 'Bearer ' . self::service(JWTTokenManagerInterface::class)->create($this->owner),
            'HTTP_IF_MATCH' => '"1"',
        ], content: Json\encode(['title' => 'Vendors load in', 'startsAt' => '2027-03-06T12:00', 'place' => 'Ballroom', 'ownerName' => 'Bisi', 'note' => 'Back door']));
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        self::assertSame([null, 'Ballroom', 'Garden'], Vec\map($this->links(), static fn (array $link): ?string => $link['place']));
    }

    #[Test]
    public function onlyThoseWhoManageTheRunOfShowSeeOrReplaceTheLinks(): void
    {
        $this->sample();
        $viewer = $this->member('viewer@ire.events', 'Kemi Ade', EventRole::CanView);

        $this->as($viewer, 'GET', $this->linksPath());
        self::assertSame(403, $this->statusCode());
        $this->as($viewer, 'POST', $this->linksPath() . '/replace', ['place' => 'Garden']);
        self::assertSame(403, $this->statusCode());
    }

    #[Test]
    public function theScreenShowsOnlyTheItemsShownToGuestsAndOfEachItsTitleAndExpectedStartAlone(): void
    {
        $this->sample();

        $screen = $this->screen($this->tokenFor('Garden'));
        $raw = (string) $this->client->getResponse()->getContent();

        self::assertSame(['kind', 'eventId', 'event', 'locale', 'at', 'now', 'coming'], Vec\keys($screen));
        self::assertSame(['live', 'Owambe', 'en', null], [$screen['kind'], $screen['event'], $screen['locale'], $screen['now']]);
        self::assertSame([
            ['id' => $this->items['Ceremony'], 'title' => 'Ceremony', 'startsAt' => '2027-03-06T14:00:00+01:00'],
            ['id' => $this->items['Dinner'], 'title' => 'Dinner', 'startsAt' => '2027-03-06T15:30:00+01:00'],
            ['id' => $this->items['Cake'], 'title' => 'Cake', 'startsAt' => '2027-03-06T17:00:00+01:00'],
        ], $screen['coming']);
        foreach (['Photos', 'Bisi', 'Back door', 'lengthMinutes', 'owner', 'note', 'late', 'planned', 'Toasts'] as $never) {
            self::assertStringNotContainsString($never, $raw);
        }
    }

    #[Test]
    public function aPlaceWithNothingShownToGuestsShowsTheEventsNameAlone(): void
    {
        $this->sample();

        self::assertSame(['kind', 'eventId', 'event', 'locale', 'at'], Vec\keys($this->screen($this->tokenFor('Hall'))));
        self::assertSame('nothingLeft', $this->screen($this->tokenFor('Hall'))['kind']);
    }

    /** @return iterable<string, array{string, string}> */
    public static function startedAt(): iterable
    {
        yield 'Dinner expected at 15:42 reads 15:40' => ['2027-03-06T13:12:40Z', '15:40'];
        yield 'Dinner expected at 15:44 reads 15:40' => ['2027-03-06T13:14:00Z', '15:40'];
        yield 'Dinner expected at 15:45 reads 15:45' => ['2027-03-06T13:15:00Z', '15:45'];
    }

    #[Test]
    #[DataProvider('startedAt')]
    public function whileItHappensNowIsTheRunningItemAndTheTimesAreExpectedOverEveryItemRoundedDown(string $startedAt, string $dinner): void
    {
        $this->sample();
        $token = $this->tokenFor('Garden');
        self::mockTime(new DateTimeImmutable($startedAt));
        $this->pressed('Ceremony', 'start');

        self::mockTime(new DateTimeImmutable('2027-03-06T13:30:00Z'));
        $screen = $this->screen($token);

        self::assertSame(['id' => $this->items['Ceremony'], 'title' => 'Ceremony'], $screen['now']);
        self::assertSame([$dinner, '17:00'], $this->times($screen));
    }

    #[Test]
    public function anItemRunningPastItsLengthWithNoPressMovesTheTimesOn(): void
    {
        $this->sample();
        $token = $this->tokenFor('Garden');
        self::mockTime(new DateTimeImmutable('2027-03-06T13:00:00Z'));
        $this->pressed('Ceremony', 'start');
        self::mockTime(new DateTimeImmutable('2027-03-06T13:30:00Z'));
        self::assertSame(['15:30', '17:00'], $this->times($this->screen($token)));

        self::mockTime(new DateTimeImmutable('2027-03-06T14:20:00Z'));

        self::assertSame(['15:50', '17:00'], $this->times($this->screen($token)));
    }

    #[Test]
    public function betweenItemsThereIsNoNow(): void
    {
        $this->sample();
        $token = $this->tokenFor('Garden');
        self::mockTime(new DateTimeImmutable('2027-03-06T13:00:00Z'));
        $this->pressed('Ceremony', 'start');
        self::mockTime(new DateTimeImmutable('2027-03-06T13:50:00Z'));
        $this->pressed('Ceremony', 'done');

        $screen = $this->screen($token);

        self::assertNull($screen['now']);
        self::assertSame(['Dinner', 'Cake'], Vec\map(Type\vec(Type\shape(['title' => Type\string()], true))->coerce($screen['coming']), static fn (array $item): string => $item['title']));
    }

    #[Test]
    public function aPressSignalsTheScreensWithNoItemData(): void
    {
        $this->sample();
        $hub = self::service(RecordingHub::class);
        $hub->published = [];
        self::mockTime(new DateTimeImmutable('2027-03-06T13:00:00Z'));

        $this->pressed('Ceremony', 'start');

        $update = $hub->lastOn(RealtimeTopic::EventScreens->for($this->eventId)) ?? self::fail('nothing published');
        self::assertSame('[]', $update->getData());
        self::assertTrue($update->isPrivate());
    }

    #[Test]
    public function aScreenLinkGetsAHubTokenForItsEventsSignalAlone(): void
    {
        $this->sample();

        $this->client->request('POST', '/api/screen-links/subscriptions', server: ['CONTENT_TYPE' => 'application/json'], content: Json\encode(['token' => $this->tokenFor('Garden')]));
        self::assertSame(200, $this->statusCode());
        $token = new Parser(new JoseEncoder())->parse(Type\non_empty_string()->coerce($this->last()['token'] ?? null));
        self::assertInstanceOf(UnencryptedToken::class, $token);

        self::assertSame([RealtimeTopic::EventScreens->for($this->eventId)], Type\shape(['subscribe' => Type\vec(Type\string())], true)->coerce($token->claims()->get('mercure'))['subscribe']);
    }

    #[Test]
    public function replacingALinkEndsTheOldOneWithNoEventDetailsAndSignalsAtOnce(): void
    {
        $this->sample();
        $old = $this->tokenFor('Garden');
        $hub = self::service(RecordingHub::class);
        $hub->published = [];
        self::mockTime(new DateTimeImmutable('2027-03-02T16:25:00Z'));

        $answer = $this->as($this->owner, 'POST', $this->linksPath() . '/replace', ['place' => 'Garden']);
        self::assertSame(200, $this->statusCode(), Json\encode($answer));
        $garden = Dict\from_entries(Vec\map($this->linksIn($answer), static fn (array $link): array => [$link['place'] ?? 'Main', $link]))['Garden'];

        self::assertNotSame($old, $garden['token']);
        self::assertSame('2027-03-02T17:25:00+01:00', $garden['replacedAt']);
        self::assertSame(['kind' => 'replaced', 'at' => '2027-03-02T17:25:00+01:00'], $this->screen($old));
        self::assertSame('live', $this->screen($garden['token'])['kind']);
        self::assertSame('[]', ($hub->lastOn(RealtimeTopic::EventScreens->for($this->eventId)) ?? self::fail('nothing published'))->getData());

        $this->client->request('POST', '/api/screen-links/subscriptions', server: ['CONTENT_TYPE' => 'application/json'], content: Json\encode(['token' => $old]));
        self::assertSame(404, $this->statusCode());
    }

    #[Test]
    public function aPlaceNotOnTheScheduleHasNoLinkToReplace(): void
    {
        $this->sample();

        $this->as($this->owner, 'POST', $this->linksPath() . '/replace', ['place' => 'Rooftop']);

        self::assertSame(404, $this->statusCode());
    }

    #[Test]
    public function aTokenNeverIssuedFindsNothing(): void
    {
        $this->client->request('POST', '/api/screen-links/screen', server: ['CONTENT_TYPE' => 'application/json'], content: Json\encode(['token' => Str\repeat('q', 22)]));

        self::assertSame(404, $this->statusCode());
    }

    #[Test]
    public function aDeletedEventsLinkFindsNothing(): void
    {
        $this->sample();
        $token = $this->tokenFor('Garden');
        $this->as($this->owner, 'DELETE', '/api/events/' . $this->eventId, ['name' => 'Owambe']);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        $this->client->request('POST', '/api/screen-links/screen', server: ['CONTENT_TYPE' => 'application/json'], content: Json\encode(['token' => $token]));

        self::assertSame(404, $this->statusCode());
    }

    #[Test]
    public function afterTheEventIsFinishedTheScreenThanksTheRoom(): void
    {
        $this->sample();
        $token = $this->tokenFor('Garden');

        self::mockTime(new DateTimeImmutable('2027-03-07T03:00:00Z'));

        self::assertSame(['kind' => 'finished', 'eventId' => $this->eventId, 'event' => 'Owambe', 'locale' => 'en', 'at' => '2027-03-07T04:00:00+01:00'], $this->screen($token));
    }

    #[Test]
    public function aCalledOffEventShowsItsNameAlone(): void
    {
        $this->sample();
        $token = $this->tokenFor('Garden');
        $this->as($this->owner, 'POST', '/api/events/' . $this->eventId . '/end');
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        self::assertSame('nothingLeft', $this->screen($token)['kind']);
    }

    private function sample(): void
    {
        $this->item(['title' => 'Vendors load in', 'startsAt' => '2027-03-06T12:00', 'place' => 'Hall', 'ownerName' => 'Bisi', 'note' => 'Back door']);
        $this->item(['title' => 'Ceremony', 'startsAt' => '2027-03-06T14:00', 'lengthMinutes' => 60, 'place' => 'Garden', 'showToGuests' => true]);
        $this->item(['title' => 'Photos', 'startsAt' => '2027-03-06T15:00', 'lengthMinutes' => 30, 'place' => 'Garden']);
        $this->item(['title' => 'Dinner', 'startsAt' => '2027-03-06T15:30', 'lengthMinutes' => 90, 'place' => 'Garden', 'showToGuests' => true]);
        $this->item(['title' => 'Cake', 'startsAt' => '2027-03-06T17:00', 'place' => 'Garden', 'showToGuests' => true, 'fixedTime' => true]);
        $this->item(['title' => 'Toasts', 'startsAt' => '2027-03-06T17:30', 'showToGuests' => true]);
    }

    /** @param array<string, mixed> $body */
    private function item(array $body): void
    {
        $answer = $this->as($this->owner, 'POST', '/api/events/' . $this->eventId . '/schedule/items', $body);
        self::assertSame(201, $this->statusCode(), Json\encode($answer));
        $this->items[Type\string()->coerce($body['title'])] = Type\string()->coerce($answer['itemId'] ?? null);
    }

    private function pressed(string $title, string $kind): void
    {
        $this->as($this->owner, 'POST', '/api/events/' . $this->eventId . '/schedule/items/' . $this->items[$title] . '/presses', ['kind' => $kind], $kind . '-' . $title);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
    }

    private function linksPath(): string
    {
        return '/api/events/' . $this->eventId . '/screen-links';
    }

    /** @return list<array{place: ?string, token: string, replacedAt: ?string}> */
    private function links(): array
    {
        $answer = $this->as($this->owner, 'GET', $this->linksPath());
        self::assertSame(200, $this->statusCode(), Json\encode($answer));

        return $this->linksIn($answer);
    }

    /** @param array<string, mixed> $answer
     * @return list<array{place: ?string, token: string, replacedAt: ?string}> */
    private function linksIn(array $answer): array
    {
        return Type\vec(Type\shape([
            'place' => Type\nullable(Type\string()),
            'token' => Type\string(),
            'replacedAt' => Type\nullable(Type\string()),
        ]))->coerce($answer['links'] ?? null);
    }

    private function tokenFor(string $place): string
    {
        foreach ($this->links() as $link) {
            if ($place === $link['place']) {
                return $link['token'];
            }
        }

        self::fail('no link for ' . $place);
    }

    /** @return array<string, mixed> */
    private function screen(#[SensitiveParameter] string $token): array
    {
        $this->client->request('POST', '/api/screen-links/screen', server: ['CONTENT_TYPE' => 'application/json'], content: Json\encode(['token' => $token]));
        self::assertSame(200, $this->statusCode(), (string) $this->client->getResponse()->getContent());

        return $this->last();
    }

    /** @param array<string, mixed> $screen
     * @return list<string> */
    private function times(array $screen): array
    {
        return Vec\map(Type\vec(Type\shape(['startsAt' => Type\string()], true))->coerce($screen['coming'] ?? null), static fn (array $item): string => Str\slice($item['startsAt'], 11, 5));
    }

    private function live(): string
    {
        $body = $this->as($this->owner, 'POST', '/api/orgs/' . $this->organisation->getId()->toRfc4122() . '/events', ['name' => 'Owambe', 'type' => 'wedding', 'startsAt' => '2027-03-06T14:00', 'endsAt' => '2027-03-07T02:00', 'timeZone' => 'Africa/Lagos', 'currency' => 'NGN']);
        self::assertSame(201, $this->statusCode(), Json\encode($body));
        $id = Type\shape(['id' => Type\string()], true)->coerce($body['event'] ?? null)['id'];
        self::service(Connection::class)->executeStatement('UPDATE events SET hosts = :hosts WHERE id = :id', ['hosts' => '["Funmi Adeyemi"]', 'id' => $id]);
        $this->as($this->owner, 'POST', '/api/events/' . $id . '/make-live');
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        return $id;
    }

    private function account(string $address, string $name): User
    {
        $user = self::service(UserRegistrar::class)->register($address, $name, self::PASSWORD)->user;
        self::onboard($user, withOrganisation: false);

        return $user;
    }

    private function member(string $address, string $name, EventRole $on): User
    {
        $user = $this->account($address, $name);
        $organisation = self::em()->find(Organisation::class, $this->organisation->getId()) ?? self::fail('no organisation');
        $role = self::em()->getRepository(Role::class)->findOneBy(['organisation' => $organisation, 'seededAs' => SeededRole::Member]) ?? self::fail('no role');
        self::em()->persist(new Membership($organisation, $user, $role, MembershipStatus::Active, new DateTimeImmutable()));
        self::em()->flush();
        self::onEvent($user, $this->eventId, $on);

        return $user;
    }

    /**
     * @param array<string, mixed>|null $body
     *
     * @return array<string, mixed>
     */
    private function as(User $user, string $method, string $path, ?array $body = null, ?string $key = null): array
    {
        $who = self::em()->find(User::class, $user->getId()) ?? self::fail('no user');
        $this->client->request($method, $path, server: [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_AUTHORIZATION' => 'Bearer ' . self::service(JWTTokenManagerInterface::class)->create($who),
            'HTTP_ACCEPT_LANGUAGE' => 'en',
        ] + (null === $key ? [] : ['HTTP_IDEMPOTENCY_KEY' => $key]), content: null === $body ? null : Json\encode($body));

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
