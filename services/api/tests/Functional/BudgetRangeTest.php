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
use App\Enum\SeededRole;
use App\Tests\ApiTestCase;
use App\Tests\Traits\OnboardsAccounts;
use App\Tests\Traits\PutsPeopleOnEvents;
use DateTimeImmutable;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use Psl\Json;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use SensitiveParameter;
use Symfony\Component\Clock\Test\ClockSensitiveTrait;
use Symfony\Component\Uid\Uuid;

final class BudgetRangeTest extends ApiTestCase
{
    use ClockSensitiveTrait;
    use OnboardsAccounts;
    use PutsPeopleOnEvents;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    private const array CATERING = ['label' => 'Catering', 'category' => 'catering', 'basis' => 'per_head', 'rate' => '50', 'currency' => 'GBP'];

    private const array VENUE = ['label' => 'Venue hire', 'category' => 'venue', 'basis' => 'fixed', 'amount' => '2400.50', 'currency' => 'GBP'];

    private User $owner;

    private Organisation $organisation;

    private string $eventId;

    protected function setUp(): void
    {
        parent::setUp();
        $this->client->disableReboot();
        self::mockTime(new DateTimeImmutable('2027-03-01T10:00:00Z'));
        $this->owner = $this->account('owner@bloom.events', 'Harriet Cole');
        $this->organisation = self::service(OrganisationFounder::class)->found($this->owner, 'Bloom Events', 'GB', 'Europe/London');
        self::em()->flush();
        $this->eventId = $this->newEvent('GBP');
    }

    #[Test]
    public function anEventWithNoLineIsZeroAtBothEndsWithNoFigurePerHead(): void
    {
        self::assertSame([
            'currency' => 'GBP',
            'confirmed' => '0.00',
            'potential' => '0.00',
            'perHead' => ['confirmed' => ['amount' => null, 'heads' => 0], 'potential' => ['amount' => null, 'heads' => 0]],
            'notPriced' => 0,
            'lines' => [],
        ], $this->budget());
        self::assertSame(200, $this->statusCode());
    }

    #[Test]
    public function aHeldCompanionIsNotSettledAndLeavesTheUpperFigureWithAHostWhoSaysNo(): void
    {
        [$first, $second] = $this->tenComingAndTwoUnansweredWithACompanionEach();
        $this->add(self::CATERING);

        self::assertSame(['500.00', '700.00'], $this->range());
        self::assertSame(['confirmed' => ['amount' => '50.00', 'heads' => 10], 'potential' => ['amount' => '50.00', 'heads' => 14]], $this->budget()['perHead'] ?? null);

        $this->answer($first, 'maybe');
        self::assertSame(['500.00', '700.00'], $this->range());

        $this->answer($second, 'notComing');
        self::assertSame(['500.00', '600.00'], $this->range());
        self::assertSame(12, Type\shape(['potential' => Type\shape(['heads' => Type\int()], true)], true)->coerce($this->budget()['perHead'] ?? null)['potential']['heads']);
    }

    #[Test]
    public function whenTheHostsSayComingTheirCompanionsAreSettledOnTheNextRead(): void
    {
        [$first, $second] = $this->tenComingAndTwoUnansweredWithACompanionEach();
        $this->add(self::CATERING);

        $this->answer($first, 'coming');
        $this->answer($second, 'coming');

        self::assertSame(['700.00', '700.00'], $this->range());
    }

    #[Test]
    public function linesNotOnAHeadAddTheSameToBothEndsAndEachLineSaysWhereItsQuantityCameFrom(): void
    {
        $this->add(self::VENUE);
        $this->add(['label' => 'Generator hire', 'category' => 'hire', 'basis' => 'per_day', 'rate' => '180', 'currency' => 'GBP']);
        $this->add(['label' => 'Staff', 'category' => 'staffing', 'basis' => 'per_staff_hour']);

        $budget = $this->budget();

        self::assertSame(['2760.50', '2760.50'], $this->range());
        self::assertSame(
            [['fixed', 1, ['confirmed' => '2400.50', 'potential' => '2400.50']], ['event_days', 2, ['confirmed' => '360.00', 'potential' => '360.00']], ['staff_hours', 0, ['confirmed' => '0.00', 'potential' => '0.00']]],
            Vec\map(self::costed($budget), static fn (array $line): array => [$line['quantity']['source'], $line['quantity']['count'], $line['cost']]),
        );
        self::assertSame(0, $budget['notPriced'] ?? null);
    }

    #[Test]
    public function aLineAtZeroIsCountedAsNotPricedUntilItHasAPrice(): void
    {
        $this->add(self::VENUE);
        $waiting = $this->add([...self::CATERING, 'rate' => '0']);
        $this->add(['label' => 'Centrepieces', 'category' => 'flowers', 'basis' => 'per_table', 'rate' => '30', 'currency' => 'GBP']);

        self::assertSame(1, $this->budget()['notPriced'] ?? null);
        self::assertSame(['2400.50', '2400.50'], $this->range());
        self::assertCount(3, self::costed($this->budget()));

        $this->as($this->owner, 'PUT', $this->lines($waiting), self::CATERING);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        self::assertSame(0, $this->budget()['notPriced'] ?? null);
    }

    /** @return iterable<string, array{string, string, int, string}> */
    public static function divisions(): iterable
    {
        yield 'below a half, down' => ['GBP', '1000', 3, '333.33'];
        yield 'exactly a half, up' => ['GBP', '0.01', 2, '0.01'];
        yield 'above a half, up' => ['GBP', '1000.01', 3, '333.34'];
        yield 'a half in whole yen, up' => ['JPY', '1001', 2, '501'];
        yield 'a half in the third decimal, up' => ['KWD', '0.001', 2, '0.001'];
        yield 'above a half in the third decimal, up' => ['KWD', '0.002', 3, '0.001'];
    }

    #[Test]
    #[DataProvider('divisions')]
    public function perHeadIsRoundedHalfUpToTheCurrencysMinorUnit(string $currency, string $amount, int $heads, string $perHead): void
    {
        $this->eventId = $this->newEvent($currency);
        $this->live();
        foreach (Vec\range(1, $heads) as $number) {
            $this->answer($this->guest('Guest ' . $number), 'coming');
        }
        $this->add([...self::VENUE, 'amount' => $amount, 'currency' => $currency]);

        self::assertSame(['amount' => $perHead, 'heads' => $heads], $this->budget()['perHead']['confirmed'] ?? null);
    }

    #[Test]
    public function aCurrencyWithNoMinorUnitIsDividedToWholeUnits(): void
    {
        $this->eventId = $this->newEvent('JPY');
        $this->live();
        foreach (['Ada', 'Bisi', 'Chidi'] as $name) {
            $this->answer($this->guest($name), 'coming');
        }
        $this->add([...self::VENUE, 'amount' => '1000', 'currency' => 'JPY']);

        self::assertSame(['1000', '1000'], $this->range());
        self::assertSame(['amount' => '333', 'heads' => 3], $this->budget()['perHead']['confirmed'] ?? null);
    }

    #[Test]
    public function readingTheBudgetChangesNoLine(): void
    {
        $this->add(self::CATERING);
        $before = $this->as($this->owner, 'GET', $this->lines());

        $this->budget();

        self::assertSame($before, $this->as($this->owner, 'GET', $this->lines()));
    }

    /** @return iterable<string, array{SeededRole, ?EventRole}> */
    public static function holders(): iterable
    {
        yield 'an admin of the organisation' => [SeededRole::Admin, null];
        yield 'the event lead' => [SeededRole::Member, EventRole::Lead];
    }

    #[Test]
    #[DataProvider('holders')]
    public function adminsAndTheEventLeadReadTheRange(SeededRole $role, ?EventRole $on): void
    {
        $this->as($this->member('holder@bloom.events', 'Priya Shah', $role, $on), 'GET', $this->path());

        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
    }

    /** @return iterable<string, array{EventRole}> */
    public static function withoutTheBudget(): iterable
    {
        yield 'can edit' => [EventRole::CanEdit];
        yield 'can view' => [EventRole::CanView];
        yield 'can check guests in' => [EventRole::CanCheckIn];
    }

    #[Test]
    #[DataProvider('withoutTheBudget')]
    public function someoneOnTheEventWithoutTheBudgetIsRefused(EventRole $on): void
    {
        $this->as($this->member('member@bloom.events', 'Sam Reid', SeededRole::Member, $on), 'GET', $this->path());

        self::assertSame(403, $this->statusCode());
        self::assertSame(ErrorCode::PermissionRequired->type(), $this->last()['type'] ?? null);
    }

    #[Test]
    public function aMemberWithNoRoleOnTheEventAnotherOrganisationAndAMissingEventAreAllNotFound(): void
    {
        $this->as($this->member('kemi@bloom.events', 'Kemi Ade', SeededRole::Member, null), 'GET', $this->path());
        self::assertSame(404, $this->statusCode());
        self::assertSame(ErrorCode::NotFound->type(), $this->last()['type'] ?? null);

        $stranger = $this->account('stranger@else.where', 'Stranger');
        self::service(OrganisationFounder::class)->found($stranger, 'Elsewhere', 'GB', 'Europe/London');
        self::em()->flush();
        $this->as($stranger, 'GET', $this->path());
        self::assertSame(404, $this->statusCode());
        self::assertSame(ErrorCode::NotFound->type(), $this->last()['type'] ?? null);

        $this->as($this->owner, 'GET', '/api/events/' . Uuid::v7()->toRfc4122() . '/budget');
        self::assertSame(404, $this->statusCode());
        self::assertSame(ErrorCode::NotFound->type(), $this->last()['type'] ?? null);
    }

    /** @return array{string, string} the two guests with no reply yet */
    private function tenComingAndTwoUnansweredWithACompanionEach(): array
    {
        $this->live();
        foreach (Vec\range(1, 10) as $number) {
            $this->answer($this->guest('Guest ' . $number), 'coming');
        }

        $unanswered = [$this->guest('Dayo', ['Femi']), $this->guest('Ebun', ['Gbenga'])];
        foreach ($unanswered as $guest) {
            $this->as($this->owner, 'PUT', '/api/events/' . $this->eventId . '/guests/' . $guest . '/invitation', ['how' => 'inPerson']);
            self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        }

        return $unanswered;
    }

    /** @return array{string, string} */
    private function range(): array
    {
        $budget = Type\shape(['confirmed' => Type\string(), 'potential' => Type\string()], true)->coerce($this->budget());

        return [$budget['confirmed'], $budget['potential']];
    }

    /** @return array<string, mixed> */
    private function budget(): array
    {
        $body = $this->as($this->owner, 'GET', $this->path());
        self::assertSame(200, $this->statusCode(), Json\encode($body));

        return $body;
    }

    /**
     * @param array<string, mixed> $budget
     *
     * @return list<array{quantity: array{count: int, source: string, ...}, cost: array{confirmed: string, potential: string}, ...}>
     */
    private static function costed(array $budget): array
    {
        return Type\vec(Type\shape([
            'quantity' => Type\shape(['count' => Type\int(), 'source' => Type\string()], true),
            'cost' => Type\shape(['confirmed' => Type\string(), 'potential' => Type\string()]),
        ], true))->coerce($budget['lines'] ?? null);
    }

    /** @param array<string, mixed> $body */
    private function add(array $body): string
    {
        $answer = $this->as($this->owner, 'POST', $this->lines(), $body);
        self::assertSame(201, $this->statusCode(), Json\encode($answer));

        return Type\shape(['line' => Type\shape(['id' => Type\string()], true)], true)->coerce($answer)['line']['id'];
    }

    private function live(): void
    {
        self::em()->getConnection()->executeStatement('UPDATE events SET hosts = :hosts WHERE id = :id', ['hosts' => '["Ada and Obi"]', 'id' => $this->eventId]);
        $this->as($this->owner, 'POST', '/api/events/' . $this->eventId . '/make-live');
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
    }

    /** @param list<string> $companions */
    private function guest(string $name, array $companions = []): string
    {
        $body = $this->as($this->owner, 'POST', '/api/events/' . $this->eventId . '/guests', [
            'fullName' => $name,
            'companions' => Vec\map($companions, static fn (string $companion): array => ['fullName' => $companion]),
        ]);
        self::assertSame(201, $this->statusCode(), Json\encode($body));

        return Type\shape(['id' => Type\string()], true)->coerce($body['guest'] ?? null)['id'];
    }

    private function answer(string $guest, string $answer): void
    {
        $body = $this->as($this->owner, 'GET', '/api/events/' . $this->eventId . '/guests/' . $guest . '/link');
        self::assertSame(200, $this->statusCode(), Json\encode($body));
        $this->reply(Str\after(Type\string()->coerce($body['url'] ?? null), '/i/') ?? self::fail('no token'), $answer);
    }

    private function reply(#[SensitiveParameter] string $token, string $answer): void
    {
        $this->client->request('POST', '/api/guest-links/reply', server: ['CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT_LANGUAGE' => 'en'], content: Json\encode(['token' => $token, 'answer' => $answer]));
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
    }

    private function newEvent(string $currency): string
    {
        $body = $this->as($this->owner, 'POST', '/api/orgs/' . $this->organisation->getId()->toRfc4122() . '/events', [
            'name' => 'Summer wedding',
            'type' => 'wedding',
            'startsAt' => '2027-06-12T14:00',
            'endsAt' => '2027-06-13T01:00',
            'timeZone' => 'Europe/London',
            'currency' => $currency,
        ]);
        self::assertSame(201, $this->statusCode(), Json\encode($body));

        return Type\shape(['id' => Type\string()], true)->coerce($body['event'] ?? null)['id'];
    }

    private function path(): string
    {
        return '/api/events/' . $this->eventId . '/budget';
    }

    private function lines(?string $id = null): string
    {
        return '/api/events/' . $this->eventId . '/budget/lines' . (null === $id ? '' : '/' . $id);
    }

    private function account(string $address, string $name): User
    {
        $user = self::service(UserRegistrar::class)->register($address, $name, self::PASSWORD)->user;
        self::onboard($user, withOrganisation: false);

        return $user;
    }

    private function member(string $address, string $name, SeededRole $seeded, ?EventRole $on): User
    {
        $user = $this->account($address, $name);
        $role = self::em()->getRepository(Role::class)->findOneBy(['organisation' => $this->organisation, 'seededAs' => $seeded]);
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
