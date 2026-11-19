<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Budget\QuantityResolver;
use App\Domain\Budget\WhatIfRules;
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

final class BudgetWhatIfTest extends ApiTestCase
{
    use ClockSensitiveTrait;
    use OnboardsAccounts;
    use PutsPeopleOnEvents;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    private const array CATERING = ['label' => 'Catering', 'category' => 'catering', 'basis' => 'per_head', 'rate' => '50', 'currency' => 'GBP'];

    private const array CENTREPIECES = ['label' => 'Centrepieces', 'category' => 'flowers', 'basis' => 'per_table', 'rate' => '30', 'currency' => 'GBP'];

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
    public function twoGuestsMoveOnlyTheUpperFigureOfAPerHeadLine(): void
    {
        $this->tenComing();
        $id = $this->add(self::CATERING);
        $this->add(self::VENUE);

        self::assertSame([
            'currency' => 'GBP',
            'confirmed' => ['from' => '2900.50', 'to' => '2900.50', 'delta' => '0.00'],
            'potential' => ['from' => '2900.50', 'to' => '3000.50', 'delta' => '100.00'],
            'fullCostKnown' => true,
            'lines' => [[
                'id' => $id,
                'label' => 'Catering',
                'category' => 'catering',
                'basis' => 'per_head',
                'quantity' => ['confirmed' => ['from' => 10, 'to' => 10], 'potential' => ['from' => 10, 'to' => 12], 'reason' => null],
                'known' => true,
                'cost' => [
                    'confirmed' => ['from' => '500.00', 'to' => '500.00', 'delta' => '0.00'],
                    'potential' => ['from' => '500.00', 'to' => '600.00', 'delta' => '100.00'],
                ],
            ]],
        ], $this->whatIf('guests', 2));
    }

    #[Test]
    public function aTableWithNoSeatingPlanCostsTheSameOnBothFiguresAndSaysWhy(): void
    {
        $this->add(self::CENTREPIECES);

        $answer = $this->whatIf('tables', 1);

        self::assertSame(['from' => '0.00', 'to' => '30.00', 'delta' => '30.00'], $answer['confirmed'] ?? null);
        self::assertSame(['from' => '0.00', 'to' => '30.00', 'delta' => '30.00'], $answer['potential'] ?? null);
        self::assertSame(
            ['confirmed' => ['from' => 0, 'to' => 1], 'potential' => ['from' => 0, 'to' => 1], 'reason' => QuantityResolver::NO_SEATING_PLAN],
            self::moved($answer)[0]['quantity'],
        );
    }

    #[Test]
    public function aPerHeadLineAtZeroThatAGuestMovesIsUnknownNotFree(): void
    {
        $this->add([...self::CATERING, 'rate' => '0']);
        $this->add(['label' => 'Favours', 'category' => 'other', 'basis' => 'per_head', 'rate' => '4', 'currency' => 'GBP']);

        $answer = $this->whatIf('guests', 1);

        self::assertFalse($answer['fullCostKnown'] ?? null);
        self::assertSame(['from' => '0.00', 'to' => '4.00', 'delta' => '4.00'], $answer['potential'] ?? null);
        self::assertSame(
            [['Catering', false, null], ['Favours', true, ['confirmed' => ['from' => '0.00', 'to' => '0.00', 'delta' => '0.00'], 'potential' => ['from' => '0.00', 'to' => '4.00', 'delta' => '4.00']]]],
            Vec\map(self::moved($answer), static fn (array $line): array => [$line['label'], $line['known'], $line['cost']]),
        );
    }

    #[Test]
    public function changesInOneRequestAreAddedTogetherAndUnmovedLinesAreAbsent(): void
    {
        $this->add(self::CATERING);
        $this->add(self::CENTREPIECES);
        $this->add(self::VENUE);
        $this->add(['label' => 'Generator hire', 'category' => 'hire', 'basis' => 'per_day', 'rate' => '180', 'currency' => 'GBP']);

        $answer = $this->ask([['change' => 'guests', 'by' => 1], ['change' => 'tables', 'by' => 2], ['change' => 'guests', 'by' => 2], ['change' => 'days', 'by' => -1]]);

        self::assertSame(['Catering', 'Centrepieces', 'Generator hire'], Vec\map(self::moved($answer), static fn (array $line): string => $line['label']));
        self::assertSame('-120.00', $answer['confirmed']['delta'] ?? null);
        self::assertSame('30.00', $answer['potential']['delta'] ?? null);
    }

    #[Test]
    public function noChangesOrChangesThatCancelOutAnswerNoChange(): void
    {
        $this->add(self::CENTREPIECES);
        $nothing = ['currency' => 'GBP', 'confirmed' => ['from' => '0.00', 'to' => '0.00', 'delta' => '0.00'], 'potential' => ['from' => '0.00', 'to' => '0.00', 'delta' => '0.00'], 'fullCostKnown' => true, 'lines' => []];

        self::assertSame($nothing, $this->ask([]));
        self::assertSame($nothing, $this->ask([['change' => 'tables', 'by' => 2], ['change' => 'tables', 'by' => -2]]));
    }

    public static function refusals(): iterable
    {
        yield 'removing a guest' => [[['change' => 'guests', 'by' => -1]], 'changes.0.by'];
        yield 'no guest' => [[['change' => 'guests', 'by' => 0]], 'changes.0.by'];
        yield 'a table below zero' => [[['change' => 'tables', 'by' => -1]], 'changes.0.by'];
        yield 'days below zero' => [[['change' => 'days', 'by' => -3]], 'changes.0.by'];
        yield 'a change it does not know' => [[['change' => 'menu_choice', 'by' => 1]], 'changes.0.change'];
        yield 'not a whole number' => [[['change' => 'tables', 'by' => 1.5]], 'changes.0.by'];
        yield 'a number as text' => [[['change' => 'tables', 'by' => '1']], 'changes.0.by'];
        yield 'past the most' => [[['change' => 'staff_hours', 'by' => 100001]], 'changes.0.by'];
        yield 'guests past the most' => [[['change' => 'guests', 'by' => 100001]], 'changes.0.by'];
        yield 'tables past the most below' => [[['change' => 'tables', 'by' => -100001]], 'changes.0.by'];
        yield 'guests past the most together' => [[['change' => 'guests', 'by' => 60000], ['change' => 'guests', 'by' => 60000]], 'changes.0.by'];
    }

    #[Test]
    #[DataProvider('refusals')]
    public function anUnmatchedChangeIsRefusedAndNamedAndNothingIsAnswered(array $changes, string $path): void
    {
        $this->add(self::CENTREPIECES);

        $body = $this->as($this->owner, 'POST', $this->path(), ['changes' => $changes]);

        self::assertSame(422, $this->statusCode(), Json\encode($body));
        self::assertSame([$path], Vec\map(Type\vec(Type\shape(['propertyPath' => Type\string()], true))->coerce($body['violations'] ?? null), static fn (array $one): string => $one['propertyPath']));
        self::assertArrayNotHasKey('lines', $body);
    }

    #[Test]
    public function aRefusalNamesTheChangeAndGroupsItsNumbers(): void
    {
        $body = $this->as($this->owner, 'POST', $this->path(), ['changes' => [['change' => 'staff_hours', 'by' => 100001], ['change' => 'days', 'by' => -3]]]);

        self::assertSame(
            ['Change staff_hours by 100,000 or fewer.', 'That would take days below 0. The event has 2 now.'],
            Vec\map(Type\vec(Type\shape(['message' => Type\string()], true))->coerce($body['violations'] ?? null), static fn (array $one): string => $one['message']),
        );
    }

    #[Test]
    public function theMostGuestsAreAnswered(): void
    {
        $this->add(self::CATERING);

        self::assertSame('5000000.00', $this->whatIf('guests', WhatIfRules::MOST)['potential']['delta'] ?? null);
    }

    #[Test]
    public function aWholeNumberWrittenWithAPointIsAWholeNumber(): void
    {
        $this->add(self::CENTREPIECES);

        self::assertSame('60.00', $this->ask([['change' => 'tables', 'by' => 2.0]])['potential']['delta'] ?? null);
    }

    #[Test]
    public function askingTwiceGivesTheSameAnswerAndChangesNeitherTheBudgetNorTheGuests(): void
    {
        $this->tenComing();
        $this->add(self::CATERING);
        $this->add(self::CENTREPIECES);
        $budget = $this->as($this->owner, 'GET', '/api/events/' . $this->eventId . '/budget');
        $lines = $this->as($this->owner, 'GET', $this->lines());
        $guests = $this->as($this->owner, 'GET', '/api/events/' . $this->eventId . '/guests');

        $first = $this->ask([['change' => 'guests', 'by' => 3], ['change' => 'tables', 'by' => 2]]);

        self::assertSame($first, $this->ask([['change' => 'guests', 'by' => 3], ['change' => 'tables', 'by' => 2]]));
        self::assertSame($budget, $this->as($this->owner, 'GET', '/api/events/' . $this->eventId . '/budget'));
        self::assertSame($lines, $this->as($this->owner, 'GET', $this->lines()));
        self::assertSame($guests, $this->as($this->owner, 'GET', '/api/events/' . $this->eventId . '/guests'));
    }

    /** @return iterable<string, array{SeededRole, ?EventRole}> */
    public static function holders(): iterable
    {
        yield 'an admin of the organisation' => [SeededRole::Admin, null];
        yield 'the event lead' => [SeededRole::Member, EventRole::Lead];
    }

    #[Test]
    #[DataProvider('holders')]
    public function adminsAndTheEventLeadAsk(SeededRole $role, ?EventRole $on): void
    {
        $this->as($this->member('holder@bloom.events', 'Priya Shah', $role, $on), 'POST', $this->path(), ['changes' => []]);

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
        $this->as($this->member('member@bloom.events', 'Sam Reid', SeededRole::Member, $on), 'POST', $this->path(), ['changes' => []]);

        self::assertSame(403, $this->statusCode());
        self::assertSame(ErrorCode::PermissionRequired->type(), $this->last()['type'] ?? null);
    }

    #[Test]
    public function aMemberWithNoRoleOnTheEventAnotherOrganisationAndAMissingEventAreAllNotFound(): void
    {
        $this->as($this->member('kemi@bloom.events', 'Kemi Ade', SeededRole::Member, null), 'POST', $this->path(), ['changes' => []]);
        self::assertSame(404, $this->statusCode());
        self::assertSame(ErrorCode::NotFound->type(), $this->last()['type'] ?? null);

        $stranger = $this->account('stranger@else.where', 'Stranger');
        self::service(OrganisationFounder::class)->found($stranger, 'Elsewhere', 'GB', 'Europe/London');
        self::em()->flush();
        $this->as($stranger, 'POST', $this->path(), ['changes' => []]);
        self::assertSame(404, $this->statusCode());
        self::assertSame(ErrorCode::NotFound->type(), $this->last()['type'] ?? null);

        $this->as($this->owner, 'POST', '/api/events/' . Uuid::v7()->toRfc4122() . '/budget/what-if', ['changes' => []]);
        self::assertSame(404, $this->statusCode());
        self::assertSame(ErrorCode::NotFound->type(), $this->last()['type'] ?? null);
    }

    private function tenComing(): void
    {
        $this->live();
        foreach (Vec\range(1, 10) as $number) {
            $this->answer($this->guest('Guest ' . $number), 'coming');
        }
    }

    /** @return array<string, mixed> */
    private function whatIf(string $change, int $by): array
    {
        return $this->ask([['change' => $change, 'by' => $by]]);
    }

    /**
     * @param list<array{change: mixed, by: mixed}> $changes
     *
     * @return array<string, mixed>
     */
    private function ask(array $changes): array
    {
        $body = $this->as($this->owner, 'POST', $this->path(), ['changes' => $changes]);
        self::assertSame(200, $this->statusCode(), Json\encode($body));

        return $body;
    }

    /** @return list<array{label: string, known: bool, cost: mixed, quantity: mixed, ...}> */
    private static function moved(mixed $answer): array
    {
        return Type\vec(Type\shape([
            'label' => Type\string(),
            'known' => Type\bool(),
            'cost' => Type\mixed(),
            'quantity' => Type\mixed(),
        ], true))->coerce(Type\shape(['lines' => Type\mixed()], true)->coerce($answer)['lines']);
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
        return '/api/events/' . $this->eventId . '/budget/what-if';
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
