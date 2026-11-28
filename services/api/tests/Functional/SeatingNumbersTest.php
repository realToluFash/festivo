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
use App\Enum\SeededRole;
use App\Tests\ApiTestCase;
use App\Tests\Double\Messaging\RecordingHub;
use App\Tests\Traits\OnboardsAccounts;
use App\Tests\Traits\PutsPeopleOnEvents;
use DateTimeImmutable;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\Test;
use Psl\Dict;
use Psl\Iter;
use Psl\Json;
use Psl\Math;
use Psl\Str;
use Psl\Type;
use Psl\Vec;

/** The room in numbers (sc-103). */
final class SeatingNumbersTest extends ApiTestCase
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
        $this->eventId = $this->newEvent($this->owner, $this->organisation);
    }

    #[Test]
    public function anEventWithNoPlanAnswers200WithZerosAndTheReasonAndComingIsStillCounted(): void
    {
        $this->guest('Ada Obi', reply: 'coming');

        $numbers = $this->numbers();

        self::assertSame(200, $this->statusCode());
        self::assertSame('no_seating_plan', $numbers['reason']);
        self::assertSame(['coming' => 1, 'comingAndSeated' => 0, 'withoutSeat' => 0], $numbers['people']);
        self::assertSame(0, $numbers['plan']['seats']);
        self::assertSame(0, $numbers['plan']['tables']);
        self::assertSame([], $numbers['sections']);
    }

    #[Test]
    public function aPlanWithNothingToSitAtSaysSoAndOneWithOnlyRowsHasNoReason(): void
    {
        $this->startPlan();
        $this->guest('Ada Obi', reply: 'coming');

        $empty = $this->numbers();
        self::assertSame(200, $this->statusCode());
        self::assertSame('nothing_to_sit_at_yet', $empty['reason']);
        self::assertSame(0, $empty['plan']['seats']);
        self::assertSame(['coming' => 1, 'comingAndSeated' => 0, 'withoutSeat' => 1], $empty['people']);

        $this->addRow();
        $rows = $this->numbers();
        self::assertNull($rows['reason']);
        self::assertSame(0, $rows['plan']['tables']);
        self::assertSame(1, $rows['plan']['rows']);
    }

    #[Test]
    public function everyNumberOnThePlanWithEveryShapeAHeldChairAndAPartyOfThree(): void
    {
        $this->fixedPlan();

        $numbers = $this->numbers();

        self::assertNull($numbers['reason']);
        self::assertSame(
            ['tables' => 3, 'tablesByShape' => ['round' => 1, 'rectangular' => 0, 'head' => 1, 'cocktail' => 1], 'rows' => 1, 'singleSeats' => 2, 'seats' => 25, 'taken' => 3, 'heldForCompanion' => 1, 'unusable' => 3, 'free' => 18],
            $numbers['plan'],
        );
        self::assertSame(
            ['tables' => 1, 'tablesByShape' => ['round' => 1, 'rectangular' => 0, 'head' => 0, 'cocktail' => 0], 'rows' => 0, 'singleSeats' => 0, 'seats' => 10, 'taken' => 2, 'heldForCompanion' => 1, 'unusable' => 1, 'free' => 6],
            $numbers['sections'][0]['counts'],
        );
        self::assertSame('Front', $numbers['sections'][0]['name']);
        self::assertSame(
            ['tables' => 2, 'tablesByShape' => ['round' => 0, 'rectangular' => 0, 'head' => 1, 'cocktail' => 1], 'rows' => 1, 'singleSeats' => 2, 'seats' => 15, 'taken' => 1, 'heldForCompanion' => 0, 'unusable' => 2, 'free' => 12],
            $numbers['noSection'],
        );
        self::assertSame(['coming' => 5, 'comingAndSeated' => 4, 'withoutSeat' => 1], $numbers['people']);
        $this->assertConsistent();
    }

    #[Test]
    public function theNumbersStayTrueAfterEveryChangeToThePlanAndPublishThemEachTime(): void
    {
        $this->fixedPlan();
        $this->assertConsistent();
        $tables = $this->planNow()['tables'];
        $head = Type\string()->coerce($tables[2]['id']);

        $added = $this->addTable();
        $this->assertConsistent();
        $this->changeTable($added, ['shape' => 'rectangular', 'seats' => 8, 'endSeats' => 2]);
        $this->assertConsistent();
        $this->changeTable($added, ['sectionId' => Type\string()->coerce($this->planNow()['sections'][0]['id'])]);
        $this->assertConsistent();
        $this->as($this->owner, 'POST', $this->plan() . '/furniture/duplicate', ['items' => [['kind' => 'table', 'id' => $added, 'version' => $this->versionOf('tables', $added)]]]);
        self::assertSame(201, $this->statusCode(), Json\encode($this->last()));
        $this->assertConsistent();
        $this->deleteItem('tables', $added);
        $this->assertConsistent();

        $row = $this->addRow();
        $this->changeItem('rows', $row, ['seats' => 7]);
        $this->assertConsistent();
        $this->changeItem('rows', $row, ['unusableSeats' => [1, 2]]);
        $this->assertConsistent();
        $this->changeItem('rows', $row, ['unusableSeats' => []]);
        $this->assertConsistent();
        $this->deleteItem('rows', $row);
        $this->assertConsistent();
        $seat = $this->addSingleSeat();
        $this->changeItem('seats', $seat, ['unusable' => true]);
        $this->assertConsistent();
        $this->changeItem('seats', $seat, ['unusable' => false]);
        $this->assertConsistent();
        $this->deleteItem('seats', $seat);
        $this->assertConsistent();

        $this->changeTable($head, ['unusableSeats' => [4]]);
        $this->assertConsistent();
        $this->changeTable($head, ['unusableSeats' => []]);
        $this->assertConsistent();

        $section = $this->planNow()['sections'][0];
        $this->as($this->owner, 'DELETE', $this->plan() . '/sections/' . Type\string()->coerce($section['id']), null, '"' . Type\int()->coerce($section['version']) . '"');
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        self::assertSame([], $this->numbers()['sections']);
        $this->assertConsistent();
        self::assertSame(4, $this->numbers()['plan']['tables']);
    }

    #[Test]
    public function theNumbersStayTrueAsGuestsAreSeatedMovedUnseatedUndoneAndReplyAndAreRemoved(): void
    {
        $this->startPlan();
        $one = $this->addTable();
        $two = $this->addTable();
        $ada = $this->guest('Ada Obi', ['Chidi Obi', null], reply: 'coming');
        $bola = $this->guest('Bola Ade', reply: 'coming');
        $kemi = $this->guest('Kemi Ade');
        $this->assertConsistent();

        $seated = $this->seat($ada, $one);
        $this->assertConsistent();
        self::assertSame(['taken' => 2, 'heldForCompanion' => 1, 'free' => 17], $this->slice($this->numbers()['plan'], ['taken', 'heldForCompanion', 'free']));
        $moved = $this->seat($ada, $two);
        $this->assertConsistent();
        $this->undo($moved['moves']);
        $this->assertConsistent();
        $this->undo($seated['moves']);
        $this->assertConsistent();
        self::assertSame(0, $this->numbers()['plan']['taken']);
        $this->seat($ada, $one);
        $this->seat($bola, $one);
        $this->as($this->owner, 'POST', $this->plan() . '/guests/unseat', ['guestIds' => [$bola]]);
        $this->assertConsistent();
        $this->seat($kemi, $two);
        self::assertSame(4, $this->numbers()['plan']['taken'] + $this->numbers()['plan']['heldForCompanion']);
        self::assertSame(1, $this->numbers()['people']['withoutSeat']);
        $this->assertConsistent();

        $this->reply($kemi, 'coming');
        $this->assertConsistent();
        $this->reply($bola, 'notComing');
        $this->assertConsistent();
        $this->reply($bola, 'coming');
        self::assertSame(1, $this->numbers()['people']['withoutSeat']);
        $this->assertConsistent();
        $this->reply($ada, 'notComing');
        $this->assertConsistent();
        self::assertSame(0, $this->numbers()['plan']['heldForCompanion']);
        $this->reply($ada, 'coming');
        $this->assertConsistent();
        $this->as($this->owner, 'DELETE', '/api/events/' . $this->eventId . '/guests/' . $kemi);
        $this->assertConsistent();
    }

    #[Test]
    public function undoingAnUnseatPutsTheNumbersBack(): void
    {
        $this->startPlan();
        $table = $this->addTable();
        $ada = $this->guest('Ada Obi', ['Chidi Obi'], reply: 'coming');
        $this->seat($ada, $table);
        $seated = $this->slice($this->numbers()['plan'], ['taken', 'heldForCompanion', 'free']);

        $this->as($this->owner, 'POST', $this->plan() . '/guests/unseat', ['guestIds' => [$ada]]);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        $unseated = Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce($this->last()['moves']);
        self::assertSame(['taken' => 1, 'heldForCompanion' => 0, 'free' => 9], $this->slice($this->numbers()['plan'], ['taken', 'heldForCompanion', 'free']));
        $this->assertConsistent();

        $this->undo($unseated);
        self::assertSame($seated, $this->slice($this->numbers()['plan'], ['taken', 'heldForCompanion', 'free']));
        self::assertSame(0, $this->numbers()['people']['withoutSeat']);
        $this->assertConsistent();
    }

    #[Test]
    public function anUnseatedPartyReplyingComingRaisesComingAndWithoutASeatByTheWholeParty(): void
    {
        $this->startPlan();
        $this->addTable();
        $dayo = $this->guest('Dayo Bello', ['Femi Bello', 'Gina Bello']);
        $before = $this->numbers()['people'];
        $this->assertConsistent();

        $this->reply($dayo, 'coming');

        $after = $this->numbers()['people'];
        self::assertSame($before['coming'] + 3, $after['coming']);
        self::assertSame($before['withoutSeat'] + 3, $after['withoutSeat']);
        self::assertSame($before['comingAndSeated'], $after['comingAndSeated']);
        $this->assertConsistent();
    }

    #[Test]
    public function aSeatedCompanionRemovedOnTheirOwnLeavesTheRestOfThePartySeated(): void
    {
        $this->startPlan();
        $table = $this->addTable();
        $ada = $this->guest('Ada Obi', ['Chidi Obi', 'Nneka Obi'], reply: 'coming');
        $this->seat($ada, $table);
        self::assertSame(['coming' => 3, 'comingAndSeated' => 3, 'withoutSeat' => 0], $this->numbers()['people']);
        $this->assertConsistent();

        $details = $this->as($this->owner, 'GET', '/api/events/' . $this->eventId . '/guests/' . $ada);
        $etag = (string) $this->client->getResponse()->headers->get('ETag');
        $chidi = Iter\first(Vec\filter(Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce(Type\dict(Type\string(), Type\mixed())->coerce($details['guest'])['companions']), static fn (array $one): bool => 'Chidi Obi' === $one['fullName'])) ?? self::fail('no Chidi');
        $this->as($this->owner, 'PUT', '/api/events/' . $this->eventId . '/guests/' . $ada, [
            'fullName' => 'Ada Obi',
            'companions' => [['id' => Type\string()->coerce($chidi['id']), 'fullName' => 'Chidi Obi']],
        ], $etag);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        self::assertSame(['coming' => 2, 'comingAndSeated' => 2, 'withoutSeat' => 0], $this->numbers()['people']);
        self::assertSame(2, $this->numbers()['plan']['taken'] + $this->numbers()['plan']['heldForCompanion']);
        $this->assertConsistent();
    }

    #[Test]
    public function aCanViewMemberReadsItSomeoneWithoutSeatingReadIsRefusedAndAnotherOrganisationGets404(): void
    {
        $this->fixedPlan();
        $viewer = $this->member('viewer@ire.events', SeededRole::Member, EventRole::CanView);
        $floor = $this->member('floor@ire.events', SeededRole::Member, EventRole::CanWorkFloor);
        $stranger = $this->account('stranger@else.where');
        self::service(OrganisationFounder::class)->found($stranger, 'Elsewhere', 'NG', 'Africa/Lagos');
        self::em()->flush();

        $this->as($viewer, 'GET', $this->path());
        self::assertSame(200, $this->statusCode());
        self::assertSame(25, $this->last()['plan']['seats']);
        $this->as($floor, 'GET', $this->path());
        self::assertSame(403, $this->statusCode());
        $this->as($stranger, 'GET', $this->path());
        self::assertSame(404, $this->statusCode());
    }

    #[Test]
    public function aBudgetLinePerTableAlwaysEqualsTables(): void
    {
        $this->startPlan();
        $this->as($this->owner, 'POST', '/api/events/' . $this->eventId . '/budget/lines', ['label' => 'Centrepieces', 'category' => 'flowers', 'basis' => 'per_table', 'rate' => '0', 'currency' => 'NGN']);

        foreach ([0, 1, 2] as $tables) {
            if ($tables > 0) {
                $this->addTable();
            }
            $line = $this->as($this->owner, 'GET', '/api/events/' . $this->eventId . '/budget');
            self::assertSame($tables, Type\int()->coerce($this->numbers()['plan']['tables']));
            self::assertStringContainsString('"count":' . $tables . ',"source":"seating_tables"', Json\encode($line));
        }
    }

    private function fixedPlan(): void
    {
        $this->startPlan();
        $this->as($this->owner, 'POST', $this->plan() . '/sections', ['name' => 'Front']);
        $section = Type\string()->coerce($this->planNow()['sections'][0]['id']);
        $round = $this->addTable();
        $this->as($this->owner, 'POST', $this->plan() . '/tables', ['shape' => 'cocktail']);
        $head = Type\string()->coerce($this->as($this->owner, 'POST', $this->plan() . '/tables', ['shape' => 'head'])['tableId'] ?? null);
        $this->changeTable($round, ['sectionId' => $section, 'unusableSeats' => [10]]);
        $row = $this->addRow();
        $this->changeItem('rows', $row, ['seats' => 5, 'unusableSeats' => [5]]);
        $loose = $this->addSingleSeat();
        $this->changeItem('seats', $loose, ['unusable' => true]);
        $this->addSingleSeat();
        $this->seat($this->guest('Ada Obi', ['Chidi Obi', null], reply: 'coming'), $round);
        $this->seat($this->guest('Bola Ade', reply: 'coming'), $head);
        $this->guest('Kemi Ade', reply: 'coming');
        $this->guest('Tunde Ade', reply: 'maybe');
    }

    private function startPlan(): void
    {
        $this->as($this->owner, 'POST', $this->plan(), ['roomName' => 'Main hall', 'widthCm' => 2400, 'lengthCm' => 1800]);
        self::assertSame(201, $this->statusCode());
    }

    private function assertConsistent(): void
    {
        $numbers = $this->numbers();
        $plan = $this->planNow();
        $guests = Dict\pull($this->guestsNow(), static fn (array $guest): ?string => Type\nullable(Type\string())->coerce($guest['fullName']), static fn (array $guest): string => Type\string()->coerce($guest['id']));
        $places = Vec\concat(...Vec\map(['tables', 'rows', 'singleSeats'], static fn (string $list): array => Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce($plan[$list])));
        $seats = 0;
        $unusable = 0;
        $held = 0;
        $taken = 0;
        foreach ($places as $place) {
            $seats += Type\int()->coerce($place['seats'] ?? 1);
            $unusable += Iter\count(Type\vec(Type\int())->coerce($place['unusableSeats'] ?? [])) + (true === ($place['unusable'] ?? false) ? 1 : 0);
            foreach (Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce($place['seated']) as $at) {
                null === $guests[Type\string()->coerce($at['guestId'])] ? ++$held : ++$taken;
            }
        }

        self::assertSame(['seats' => $seats, 'taken' => $taken, 'heldForCompanion' => $held, 'unusable' => $unusable, 'free' => $seats - $taken - $held - $unusable], $this->slice($numbers['plan'], ['seats', 'taken', 'heldForCompanion', 'unusable', 'free']));
        self::assertSame($plan['counts']['tables'], $numbers['plan']['tables']);
        self::assertSame($plan['counts']['rows'], $numbers['plan']['rows']);
        self::assertSame($plan['counts']['singleSeats'], $numbers['plan']['singleSeats']);
        self::assertSame($taken + $held, $plan['counts']['seatedGuests']);

        foreach ([$numbers['plan'], ...Vec\map($numbers['sections'], static fn (array $section): array => $section['counts']), $numbers['noSection']] as $counts) {
            self::assertSame($counts['seats'], $counts['taken'] + $counts['heldForCompanion'] + $counts['unusable'] + $counts['free']);
            self::assertSame($counts['tables'], Math\sum($counts['tablesByShape']));
        }

        foreach (['tables', 'rows', 'singleSeats', 'seats', 'taken', 'heldForCompanion', 'unusable', 'free'] as $number) {
            self::assertSame($numbers['plan'][$number], Math\sum(Vec\map($numbers['sections'], static fn (array $section): int => Type\int()->coerce($section['counts'][$number]))) + $numbers['noSection'][$number], $number);
        }

        self::assertSame($numbers['people']['coming'], $numbers['people']['comingAndSeated'] + $numbers['people']['withoutSeat']);
        $headcount = $this->as($this->owner, 'GET', '/api/events/' . $this->eventId . '/headcount');
        self::assertSame($headcount['headcount']['counts']['accepted'], $numbers['people']['coming']);

        $message = Vec\filter(self::service(RecordingHub::class)->published, static fn ($update): bool => Str\contains($update->getData(), '"reason"'));
        self::assertSame($numbers, Json\decode((Iter\last($message) ?? self::fail('the numbers were never published'))->getData()));
        self::assertSame(['events/' . $this->eventId . '/seating'], (Iter\last($message) ?? self::fail('none'))->getTopics());
    }

    private function path(): string
    {
        return '/api/events/' . $this->eventId . '/seating-numbers';
    }

    /** @return array<string, mixed> */
    private function numbers(): array
    {
        return $this->as($this->owner, 'GET', $this->path());
    }

    /** @param array<string, mixed> $from @param list<string> $keys @return array<string, mixed> */
    private function slice(array $from, array $keys): array
    {
        $out = [];
        foreach ($keys as $key) {
            $out[$key] = $from[$key];
        }

        return $out;
    }

    private function deleteItem(string $kind, string $id): void
    {
        $this->as($this->owner, 'DELETE', $this->plan() . '/' . $kind . '/' . $id, null, '"' . $this->versionOf($kind, $id) . '"');
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
    }

    private function undo(array $moves): void
    {
        $this->as($this->owner, 'POST', $this->plan() . '/guests/undo', ['moves' => $moves]);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
    }

    /**
     * @param list<?string> $companions
     */
    private function guest(string $name, array $companions = [], ?string $reply = null): string
    {
        $body = $this->as($this->owner, 'POST', '/api/events/' . $this->eventId . '/guests', [
            'fullName' => $name,
            'companions' => Vec\map($companions, static fn (?string $companion): array => ['fullName' => $companion]),
        ]);
        self::assertSame(201, $this->statusCode(), Json\encode($body));
        $id = Type\shape(['guest' => Type\shape(['id' => Type\string()], true)], true)->coerce($body)['guest']['id'];

        if (null !== $reply) {
            $this->reply($id, $reply);
        }

        return $id;
    }

    private function reply(string $guest, string $answer): void
    {
        $this->as($this->owner, 'POST', '/api/events/' . $this->eventId . '/guests/' . $guest . '/record-reply', ['answer' => $answer, 'how' => 'phone', 'replace' => true]);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
    }

    /** @return array{moves: list<array<string, mixed>>, apart: bool, ...} */
    private function seat(string $guest, string $table, ?int $seat = null, bool $justGuest = false): array
    {
        $body = $this->as($this->owner, 'POST', $this->plan() . '/guests/seat', ['guestId' => $guest, 'kind' => 'table', 'placeId' => $table, 'seat' => $seat, 'justGuest' => $justGuest]);

        return 200 === $this->statusCode()
            ? Type\shape(['moves' => Type\vec(Type\dict(Type\string(), Type\mixed())), 'apart' => Type\bool()], true)->coerce($body)
            : ['moves' => [], 'apart' => false];
    }

    private function addTable(int $seats = 10): string
    {
        $body = $this->as($this->owner, 'POST', $this->plan() . '/tables', ['shape' => 'round']);
        $id = Type\string()->coerce($body['tableId'] ?? null);

        if (10 !== $seats) {
            $this->changeTable($id, ['seats' => $seats]);
        }

        return $id;
    }

    private function addRow(): string
    {
        return Type\string()->coerce($this->as($this->owner, 'POST', $this->plan() . '/rows')['rowId'] ?? null);
    }

    private function addSingleSeat(): string
    {
        return Type\string()->coerce($this->as($this->owner, 'POST', $this->plan() . '/seats')['seatId'] ?? null);
    }

    /** @param array<string, mixed> $fields */
    private function changeTable(string $table, array $fields, int $expected = 200): void
    {
        $this->changeItem('tables', $table, $fields, $expected);
    }

    /** @param array<string, mixed> $fields */
    private function changeItem(string $kind, string $id, array $fields, int $expected = 200): void
    {
        $this->as($this->owner, 'PATCH', $this->plan() . '/' . $kind . '/' . $id, $fields, '"' . $this->versionOf($kind, $id) . '"');
        self::assertSame($expected, $this->statusCode(), Json\encode($this->last()));
    }

    private function versionOf(string $kind, string $id): int
    {
        return Type\int()->coerce($this->itemNow('seats' === $kind ? 'singleSeats' : $kind, $id)['version']);
    }

    /** @return array<string, mixed> */
    private function itemNow(string $list, string $id): array
    {
        foreach (Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce($this->planNow()[$list]) as $item) {
            if ($item['id'] === $id) {
                return $item;
            }
        }

        self::fail('no ' . $id . ' in ' . $list);
    }

    /** @return list<array<string, mixed>> */
    private function guestsNow(): array
    {
        return Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce($this->planNow()['guests']);
    }

    /** @return array{counts: array<string, int>, guests: mixed, tables: mixed, rows: mixed, singleSeats: mixed, ...} */
    private function planNow(): array
    {
        $body = $this->as($this->owner, 'GET', $this->plan());
        $seating = Type\dict(Type\string(), Type\mixed())->coerce($body['seating'] ?? null);

        return Type\shape([
            'counts' => Type\dict(Type\string(), Type\int()),
            'guests' => Type\mixed(),
            'tables' => Type\mixed(),
            'rows' => Type\mixed(),
            'singleSeats' => Type\mixed(),
        ], true)->coerce($seating['plan'] ?? null);
    }

    private function newEvent(User $by, Organisation $organisation): string
    {
        $body = $this->as($by, 'POST', '/api/orgs/' . $organisation->getId()->toRfc4122() . '/events', [
            'name' => 'Owambe',
            'type' => 'wedding',
            'startsAt' => '2030-06-12T16:00',
            'endsAt' => '2030-06-13T02:00',
            'timeZone' => 'Africa/Lagos',
            'currency' => 'NGN',
        ]);
        self::assertSame(201, $this->statusCode());
        $id = Type\shape(['id' => Type\string()], true)->coerce($body['event'] ?? null)['id'];
        self::em()->getConnection()->executeStatement('UPDATE events SET hosts = :hosts WHERE id = :id', ['hosts' => '["Funmi Adeyemi"]', 'id' => $id]);
        $this->as($by, 'POST', '/api/events/' . $id . '/make-live');
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        return $id;
    }

    private function plan(): string
    {
        return '/api/events/' . $this->eventId . '/seating-plan';
    }

    private function account(string $address): User
    {
        $user = self::service(UserRegistrar::class)->register($address, 'Person', self::PASSWORD)->user;
        self::onboard($user, withOrganisation: false);

        return $user;
    }

    private function member(string $address, SeededRole $seeded, ?EventRole $on): User
    {
        $user = $this->account($address);
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
