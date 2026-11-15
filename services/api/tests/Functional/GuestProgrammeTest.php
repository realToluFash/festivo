<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Organisation\OrganisationFounder;
use App\Domain\User\UserRegistrar;
use App\Entity\Organisation;
use App\Entity\User;
use App\Tests\ApiTestCase;
use App\Tests\Traits\OnboardsAccounts;
use DateTimeImmutable;
use Doctrine\DBAL\Connection;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use Psl\Json;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use SensitiveParameter;
use Symfony\Component\Clock\Test\ClockSensitiveTrait;

/** The day on the guest's page (sc-3899): the items the hosts show to guests, planned before and after the day, expected and rounded down while it happens. */
final class GuestProgrammeTest extends ApiTestCase
{
    use ClockSensitiveTrait;
    use OnboardsAccounts;

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
        $this->owner = $this->account('owner@ire.events');
        $this->organisation = self::service(OrganisationFounder::class)->found($this->owner, 'Ìrè Events', 'NG', 'Africa/Lagos');
        self::em()->flush();
        $this->eventId = $this->live();
    }

    #[Test]
    public function onlyTheItemsShownToGuestsAreReturnedWithTheirTitleTimeAndPlaceAlone(): void
    {
        $this->sample();

        $programme = $this->programme();

        self::assertSame([
            ['title' => 'Ceremony', 'startsAt' => '2027-03-06T14:00:00+01:00', 'day' => '2027-03-06', 'place' => 'Garden'],
            ['title' => 'Dinner', 'startsAt' => '2027-03-06T15:30:00+01:00', 'day' => '2027-03-06', 'place' => 'Garden'],
            ['title' => 'First dance', 'startsAt' => '2027-03-06T17:00:00+01:00', 'day' => '2027-03-06', 'place' => null],
        ], $programme);
        self::assertStringNotContainsString('Bisi', Json\encode($this->last()));
        self::assertStringNotContainsString('Back door', Json\encode($this->last()));
    }

    #[Test]
    public function withNothingShownToGuestsThereIsNoProgramme(): void
    {
        $this->item(['title' => 'Vendors load in', 'startsAt' => '2027-03-06T12:00']);

        self::assertSame([], $this->programme());
    }

    /** @return iterable<string, array{string, list<string>}> */
    public static function startedAt(): iterable
    {
        yield 'just past a 5-minute mark' => ['2027-03-06T13:12:40Z', ['14:10', '15:40', '17:00']];
        yield 'on a 5-minute mark' => ['2027-03-06T13:15:00Z', ['14:15', '15:45', '17:00']];
    }

    /** @param list<string> $expected */
    #[Test]
    #[DataProvider('startedAt')]
    public function whileItHappensTimesAreExpectedOverEveryItemAndRoundedDownToFiveMinutes(string $startedAt, array $expected): void
    {
        $this->sample();

        self::mockTime(new DateTimeImmutable($startedAt));
        $this->as($this->owner, 'POST', $this->path($this->items['Ceremony']) . '/start');
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        self::mockTime(new DateTimeImmutable('2027-03-06T13:30:00Z'));

        self::assertSame($expected, Vec\map($this->programme(), static fn (array $item): string => Str\slice($item['startsAt'], 11, 5)));
    }

    #[Test]
    public function afterTheEndTheProgrammeStaysWithItsPlannedTimes(): void
    {
        $this->sample();
        $token = $this->token($this->guest());
        self::mockTime(new DateTimeImmutable('2027-03-06T13:12:00Z'));
        $this->as($this->owner, 'POST', $this->path($this->items['Ceremony']) . '/start');

        self::mockTime(new DateTimeImmutable('2027-03-07T03:00:00Z'));
        $programme = $this->programme($token);

        self::assertSame('finished', $this->last()['phase'] ?? null);
        self::assertSame(['14:00', '15:30', '17:00'], Vec\map($programme, static fn (array $item): string => Str\slice($item['startsAt'], 11, 5)));
    }

    #[Test]
    public function aCalledOffEventHasNoProgramme(): void
    {
        $this->sample();
        $token = $this->token($this->guest());
        $this->as($this->owner, 'POST', '/api/events/' . $this->eventId . '/end');
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        $page = $this->open($token);

        self::assertSame(['calledOff', []], [$page['phase'] ?? null, $page['programme'] ?? null]);
    }

    private function sample(): void
    {
        $this->item(['title' => 'Vendors load in', 'startsAt' => '2027-03-06T12:00', 'place' => 'Hall', 'ownerName' => 'Bisi', 'note' => 'Back door']);
        $this->item(['title' => 'Ceremony', 'startsAt' => '2027-03-06T14:00', 'lengthMinutes' => 60, 'place' => 'Garden', 'showToGuests' => true]);
        $this->item(['title' => 'Photos', 'startsAt' => '2027-03-06T15:00', 'lengthMinutes' => 30, 'place' => 'Garden']);
        $this->item(['title' => 'Dinner', 'startsAt' => '2027-03-06T15:30', 'lengthMinutes' => 90, 'place' => 'Garden', 'showToGuests' => true]);
        $this->item(['title' => 'First dance', 'startsAt' => '2027-03-06T17:00', 'showToGuests' => true]);
    }

    /** @param array<string, mixed> $body */
    private function item(array $body): void
    {
        $answer = $this->as($this->owner, 'POST', $this->path(), $body);
        self::assertSame(201, $this->statusCode(), Json\encode($answer));
        $this->items[Type\string()->coerce($body['title'])] = Type\string()->coerce($answer['itemId'] ?? null);
    }

    /** @return list<array{title: string, startsAt: string, day: string, place: ?string}> */
    private function programme(#[SensitiveParameter] ?string $token = null): array
    {
        $page = $this->open($token ?? $this->token($this->guest()));
        self::assertSame(200, $this->statusCode(), Json\encode($page));

        return Type\vec(Type\shape([
            'title' => Type\string(),
            'startsAt' => Type\string(),
            'day' => Type\string(),
            'place' => Type\nullable(Type\string()),
        ]))->coerce($page['programme'] ?? null);
    }

    private function path(?string $item = null): string
    {
        return '/api/events/' . $this->eventId . '/schedule/items' . (null === $item ? '' : '/' . $item);
    }

    private function guest(): string
    {
        $body = $this->as($this->owner, 'POST', '/api/events/' . $this->eventId . '/guests', ['fullName' => 'Adaeze Okonkwo']);
        self::assertSame(201, $this->statusCode(), Json\encode($body));

        return Type\shape(['id' => Type\string()], true)->coerce($body['guest'] ?? null)['id'];
    }

    private function token(string $guest): string
    {
        $body = $this->as($this->owner, 'GET', '/api/events/' . $this->eventId . '/guests/' . $guest . '/link');
        self::assertSame(200, $this->statusCode(), Json\encode($body));

        return Str\after(Type\string()->coerce($body['url'] ?? null), '/i/') ?? self::fail('no token');
    }

    /** @return array<string, mixed> */
    private function open(#[SensitiveParameter] string $token): array
    {
        $this->client->request('POST', '/api/guest-links/page', server: ['CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT_LANGUAGE' => 'en'], content: Json\encode(['token' => $token]));

        return $this->last();
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

    private function account(string $address): User
    {
        $user = self::service(UserRegistrar::class)->register($address, 'Person', self::PASSWORD)->user;
        self::onboard($user, withOrganisation: false);

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
