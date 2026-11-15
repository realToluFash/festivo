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
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use Psl\Iter;
use Psl\Json;
use Psl\Math;
use Psl\Str;
use Psl\Type;
use Psl\Vec;

/** Rows of numbered seats and single seats in a seating plan: numbering, labels and names, the limits, unusable seats, duplicate and delete, the room that cannot shrink past them, the 412 path and who may change them (sc-4003). */
final class SeatingRowsTest extends ApiTestCase
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
        $this->as($this->owner, 'POST', $this->plan(), ['roomName' => 'Main hall', 'widthCm' => 2400, 'lengthCm' => 1800]);
        self::assertSame(201, $this->statusCode());
    }

    #[Test]
    public function aRowIsTenSeatsLabelledAAtTheRoomsCentre(): void
    {
        $row = $this->addRow();

        self::assertSame(201, $this->statusCode());
        self::assertSame('A', $row['label']);
        self::assertSame(10, $row['seats']);
        self::assertSame(50, $row['spacingCm']);
        self::assertSame(0, $row['rotation']);
        self::assertSame([1200, 900], [$row['xCm'], $row['yCm']]);
        self::assertSame([], $row['unusableSeats']);
        self::assertNull($row['sectionId']);
    }

    #[Test]
    public function theNextRowTakesTheNextFreeLetterAndTheNearestFreeFloor(): void
    {
        $first = $this->addRow();
        $second = $this->addRow();
        $this->changeRow($first, ['label' => 'Front']);
        $third = $this->addRow();

        self::assertSame('B', $second['label']);
        self::assertSame('A', $third['label']);
        self::assertSame($first['xCm'], $second['xCm']);
        self::assertGreaterThanOrEqual(44, Math\abs(Type\int()->coerce($second['yCm']) - Type\int()->coerce($first['yCm'])));
    }

    #[Test]
    public function aRowBesideATableStandsClearOfIt(): void
    {
        $this->as($this->owner, 'POST', $this->plan() . '/tables', ['shape' => 'round']);
        self::assertSame(201, $this->statusCode());

        $row = $this->addRow();

        self::assertNotSame([1200, 900], [$row['xCm'], $row['yCm']]);
    }

    /** @return iterable<string, array{array<string, mixed>, string, string}> */
    public static function refusedRowFields(): iterable
    {
        yield 'a blank label' => [['label' => '  '], 'label', 'Enter a label for the row.'];
        yield 'a label too long' => [['label' => 'Balcony row'], 'label', 'Use 10 characters or fewer.'];
        yield 'no seats' => [['seats' => 0], 'seats', 'Enter a number of seats from 1 to 60.'];
        yield 'too many seats' => [['seats' => 61], 'seats', 'Enter a number of seats from 1 to 60.'];
        yield 'too close' => [['spacingCm' => 39], 'spacingCm', 'Enter a spacing from 40 cm to 1 m.'];
        yield 'too far apart' => [['spacingCm' => 101], 'spacingCm', 'Enter a spacing from 40 cm to 1 m.'];
        yield 'off the 15° steps' => [['rotation' => 10], 'rotation', 'Choose a rotation in 15° steps, from 0° to 345°.'];
        yield 'a full turn' => [['rotation' => 360], 'rotation', 'Choose a rotation in 15° steps, from 0° to 345°.'];
        yield 'no such seat' => [['unusableSeats' => [11]], 'unusableSeats', 'Choose seats from 1 to 10, each once.'];
        yield 'a section of another plan' => [['sectionId' => '0195c0de-0000-7000-8000-000000000000'], 'sectionId', 'Choose one of this plan\'s sections, or no section.'];
    }

    /** @param array<string, mixed> $fields */
    #[Test]
    #[DataProvider('refusedRowFields')]
    public function aRowFieldOutOfRangeIsRefusedBesideItAndNothingIsSaved(array $fields, string $path, string $message): void
    {
        $row = $this->addRow();

        $this->as($this->owner, 'PATCH', $this->rows() . '/' . $row['id'], $fields, '"1"');

        self::assertSame(422, $this->statusCode());
        self::assertSame($message, $this->violation($path));
        self::assertSame($row, $this->rowsNow()[0]);
    }

    #[Test]
    public function aNonNumericSeatCountIsRefused(): void
    {
        $row = $this->addRow();

        $this->as($this->owner, 'PATCH', $this->rows() . '/' . $row['id'], ['seats' => 'ten'], '"1"');

        self::assertSame(422, $this->statusCode());
        self::assertSame($row, $this->rowsNow()[0]);
    }

    #[Test]
    public function inFeetTheSpacingIsRefusedInWholeInches(): void
    {
        $host = $this->account('host@party.us');
        $organisation = self::service(OrganisationFounder::class)->found($host, 'Party Co', 'US', 'America/New_York');
        self::em()->flush();
        $this->eventId = $this->newEvent($host, $organisation);
        $this->as($host, 'POST', $this->plan(), ['widthCm' => 2400, 'lengthCm' => 1800]);
        $row = $this->rowOf($this->as($host, 'POST', $this->rows()));

        $this->as($host, 'PATCH', $this->rows() . '/' . $row['id'], ['spacingCm' => 30], '"1"');

        self::assertSame('Enter a spacing from 1 ft 4 in to 3 ft 3 in.', $this->violation('spacingCm'));
    }

    #[Test]
    public function aLabelAlreadyInThePlanIsRefusedWhateverItsCase(): void
    {
        $this->addRow();
        $second = $this->addRow();

        $this->as($this->owner, 'PATCH', $this->rows() . '/' . $second['id'], ['label' => 'a'], '"1"');

        self::assertSame(422, $this->statusCode());
        self::assertSame('This plan already has a row labelled A.', $this->violation('label'));
    }

    #[Test]
    public function fewerSeatsComeOffTheRightHandEndWithTheirUnusableMarks(): void
    {
        $row = $this->changeRow($this->addRow(), ['unusableSeats' => [9, 2]]);
        self::assertSame([2, 9], $row['unusableSeats']);

        $row = $this->changeRow($row, ['seats' => 8]);

        self::assertSame(8, $row['seats']);
        self::assertSame([2], $row['unusableSeats']);
    }

    #[Test]
    public function aRowsSeatAndASingleSeatAreMarkedUnusableAndUsableAgain(): void
    {
        $row = $this->changeRow($this->addRow(), ['unusableSeats' => [4]]);
        $seat = $this->changeSeat($this->addSeat(), ['unusable' => true]);

        self::assertSame([4], $row['unusableSeats']);
        self::assertTrue($seat['unusable']);

        self::assertSame([], $this->changeRow($row, ['unusableSeats' => []])['unusableSeats']);
        self::assertFalse($this->changeSeat($seat, ['unusable' => false])['unusable']);
    }

    #[Test]
    public function aTurnedRowKeepsItsSeatsAndNumbers(): void
    {
        $row = $this->changeRow($this->addRow(), ['unusableSeats' => [1]]);

        $row = $this->changeRow($row, ['rotation' => 90]);

        self::assertSame([90, 10, [1]], [$row['rotation'], $row['seats'], $row['unusableSeats']]);
    }

    #[Test]
    public function duplicateCopiesTheRowWithTheNextFreeLabelSomewhereFree(): void
    {
        $section = $this->addSection('Ceremony');
        $original = $this->changeRow($this->addRow(), ['seats' => 12, 'spacingCm' => 60, 'rotation' => 15, 'unusableSeats' => [3], 'sectionId' => $section]);

        $copy = $this->rowOf($this->as($this->owner, 'POST', $this->rows() . '/' . $original['id'] . '/duplicate', null, '"' . $original['version'] . '"'));

        self::assertSame(201, $this->statusCode());
        self::assertSame('B', $copy['label']);
        foreach (['seats', 'spacingCm', 'rotation', 'unusableSeats', 'sectionId'] as $kept) {
            self::assertSame($original[$kept], $copy[$kept], $kept);
        }
        self::assertNotSame([$original['xCm'], $original['yCm']], [$copy['xCm'], $copy['yCm']]);
    }

    #[Test]
    public function deleteTakesTheRowOrTheSeatOutOfThePlan(): void
    {
        $row = $this->addRow();
        $kept = $this->addRow();
        $seat = $this->addSeat();

        $this->as($this->owner, 'DELETE', $this->rows() . '/' . $row['id'], null, '"1"');
        self::assertSame(200, $this->statusCode());
        $this->as($this->owner, 'DELETE', $this->seats() . '/' . $seat['id'], null, '"1"');
        self::assertSame(200, $this->statusCode());

        self::assertSame([$kept['id']], Vec\map($this->rowsNow(), static fn (array $one): mixed => $one['id']));
        self::assertSame([], $this->seatsNow());
        self::assertSame([1, 0], [$this->planNow()['counts']['rows'], $this->planNow()['counts']['singleSeats']]);
    }

    #[Test]
    public function aSingleSeatIsNamedSeatNWithTheNextFreeNumber(): void
    {
        $first = $this->addSeat();
        $second = $this->addSeat();
        $this->changeSeat($first, ['name' => 'By the door']);
        $third = $this->addSeat();

        self::assertSame(201, $this->statusCode());
        self::assertSame(['Seat 1', 'Seat 2', 'Seat 1'], [$first['name'], $second['name'], $third['name']]);
        self::assertFalse($first['unusable']);
        self::assertNotSame([$first['xCm'], $first['yCm']], [$second['xCm'], $second['yCm']]);
    }

    #[Test]
    public function aSeatsNameIsStoredAsTyped(): void
    {
        $seat = $this->changeSeat($this->addSeat(), ['name' => '  Intérprete  ']);

        self::assertSame('Intérprete', $seat['name']);
        self::assertSame('Intérprete', $this->seatsNow()[0]['name']);
    }

    /** @return iterable<string, array{string, string}> */
    public static function refusedSeatNames(): iterable
    {
        yield 'blank' => ['', 'Enter a name for the seat.'];
        yield 'too long' => [Str\repeat('x', 31), 'Use 30 characters or fewer.'];
        yield 'already used' => ['seat 1', 'This plan already has a seat called Seat 1.'];
    }

    #[Test]
    #[DataProvider('refusedSeatNames')]
    public function aSeatNameIsRefusedBesideItAndNothingIsSaved(string $name, string $message): void
    {
        $this->addSeat();
        $second = $this->addSeat();

        $this->as($this->owner, 'PATCH', $this->seats() . '/' . $second['id'], ['name' => $name], '"1"');

        self::assertSame(422, $this->statusCode());
        self::assertSame($message, $this->violation('name'));
        self::assertSame($second, $this->seatsNow()[1]);
    }

    #[Test]
    public function theRoomCannotShrinkPastARowOrASingleSeatEachCountedOnce(): void
    {
        $row = $this->addRow();
        $seat = $this->addSeat();

        $this->as($this->owner, 'PATCH', $this->plan(), ['widthCm' => 1300], '"1"');

        self::assertSame(409, $this->statusCode());
        self::assertSame([$row['id']], $this->last()['outside'] ?? null);
        self::assertSame('1 item sits outside 13 m × 18 m. Move it first.', $this->last()['detail'] ?? null);

        $this->as($this->owner, 'PATCH', $this->plan(), ['widthCm' => 1200], '"1"');

        self::assertSame(409, $this->statusCode());
        self::assertSame([$row['id'], $seat['id']], $this->last()['outside'] ?? null);
        self::assertSame('2 items sit outside 12 m × 18 m. Move them first.', $this->last()['detail'] ?? null);
        self::assertSame(2400, $this->planNow()['widthCm']);
    }

    #[Test]
    public function deletingThePlanDeletesItsRowsAndSingleSeats(): void
    {
        $this->addRow();
        $this->addSeat();
        self::assertSame([1, 1], [$this->planNow()['counts']['rows'], $this->planNow()['counts']['singleSeats']]);

        $this->as($this->owner, 'DELETE', $this->plan());
        self::assertSame(200, $this->statusCode());
        $this->as($this->owner, 'POST', $this->plan(), ['widthCm' => 2400, 'lengthCm' => 1800]);

        self::assertSame([[], []], [$this->rowsNow(), $this->seatsNow()]);
    }

    #[Test]
    public function rowsAndSingleSeatsLeaveTheTablesCountsAsTheyWere(): void
    {
        $section = $this->addSection('Ceremony');
        $this->as($this->owner, 'POST', $this->plan() . '/tables', ['shape' => 'round']);
        $this->changeRow($this->addRow(), ['sectionId' => $section]);
        $this->changeSeat($this->addSeat(), ['sectionId' => $section]);

        $plan = $this->planNow();

        self::assertSame(['sections' => 1, 'tables' => 1, 'rows' => 1, 'singleSeats' => 1, 'seatedGuests' => 0], $plan['counts']);
        self::assertSame(['tables' => 0, 'seats' => 0], ['tables' => $plan['sections'][0]['tables'], 'seats' => $plan['sections'][0]['seats']]);
        self::assertSame(['tables' => 1, 'seats' => 10], $plan['withoutSection']);
    }

    #[Test]
    public function deletingASectionLeavesItsRowsAndSeatsWhereTheyAreWithNoSection(): void
    {
        $section = $this->addSection('Ceremony');
        $row = $this->changeRow($this->addRow(), ['sectionId' => $section]);
        $this->changeSeat($this->addSeat(), ['sectionId' => $section]);

        $this->as($this->owner, 'DELETE', $this->plan() . '/sections/' . $section);

        self::assertSame(200, $this->statusCode());
        self::assertNull($this->rowsNow()[0]['sectionId']);
        self::assertNull($this->seatsNow()[0]['sectionId']);
        self::assertSame([$row['xCm'], $row['yCm']], [$this->rowsNow()[0]['xCm'], $this->rowsNow()[0]['yCm']]);
    }

    #[Test]
    public function aDuplicatedEventCopiesItsRowsAndSingleSeats(): void
    {
        $section = $this->addSection('Ceremony');
        $row = $this->changeRow($this->addRow(), ['seats' => 14, 'unusableSeats' => [2], 'sectionId' => $section]);
        $seat = $this->changeSeat($this->addSeat(), ['name' => 'By the door', 'unusable' => true]);

        $copy = Type\shape(['id' => Type\string()], true)->coerce($this->as($this->owner, 'POST', '/api/events/' . $this->eventId . '/duplicate', ['startsAt' => '2026-12-14T16:00'])['event'] ?? null)['id'];
        self::assertSame(201, $this->statusCode());

        $plan = Type\dict(Type\string(), Type\mixed())->coerce($this->seating($this->as($this->owner, 'GET', '/api/events/' . $copy . '/seating-plan'))['plan'] ?? null);
        $rows = Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce($plan['rows']);
        $seats = Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce($plan['singleSeats']);
        self::assertNotSame($row['id'], $rows[0]['id']);
        self::assertNotNull($rows[0]['sectionId']);
        self::assertNotSame($section, $rows[0]['sectionId']);
        foreach (['label', 'seats', 'spacingCm', 'rotation', 'unusableSeats', 'xCm', 'yCm'] as $kept) {
            self::assertSame($row[$kept], $rows[0][$kept], $kept);
        }
        self::assertSame([$seat['name'], true], [$seats[0]['name'], $seats[0]['unusable']]);
    }

    #[Test]
    public function everyChangeIsPublishedWholeOnTheEventsSeatingTopic(): void
    {
        $row = $this->addRow();
        self::assertSame([[$row['id']], []], $this->published());

        $seat = $this->addSeat();
        self::assertSame([[$row['id']], [$seat['id']]], $this->published());

        $this->as($this->owner, 'DELETE', $this->rows() . '/' . $row['id'], null, '"1"');
        self::assertSame([[], [$seat['id']]], $this->published());
    }

    #[Test]
    public function aStaleVersionIs412NamingWhoChangedItAndNoVersionIs428(): void
    {
        $row = $this->addRow();
        $this->changeRow($row, ['seats' => 8]);
        $seat = $this->addSeat();
        $this->changeSeat($seat, ['name' => 'By the door']);

        foreach ([
            ['PATCH', $this->rows() . '/' . $row['id'], ['seats' => 6]],
            ['POST', $this->rows() . '/' . $row['id'] . '/duplicate', null],
            ['DELETE', $this->rows() . '/' . $row['id'], null],
            ['PATCH', $this->seats() . '/' . $seat['id'], ['unusable' => true]],
            ['DELETE', $this->seats() . '/' . $seat['id'], null],
        ] as [$method, $path, $body]) {
            $this->as($this->owner, $method, $path, $body, '"1"');
            self::assertSame(412, $this->statusCode(), $method . ' ' . $path);
            self::assertSame('Person', $this->last()['changedBy'] ?? null);

            $this->as($this->owner, $method, $path, $body);
            self::assertSame(428, $this->statusCode(), $method . ' ' . $path);
        }

        self::assertSame(8, $this->rowsNow()[0]['seats']);
        self::assertSame([false, 'By the door'], [$this->seatsNow()[0]['unusable'], $this->seatsNow()[0]['name']]);
    }

    /** @return iterable<string, array{EventRole}> */
    public static function readOnlyRoles(): iterable
    {
        yield 'Can view' => [EventRole::CanView];
        yield 'Can check guests in' => [EventRole::CanCheckIn];
    }

    #[Test]
    #[DataProvider('readOnlyRoles')]
    public function aReadOnlyRoleSeesRowsAndSeatsButCannotChangeThem(EventRole $role): void
    {
        $row = $this->addRow();
        $seat = $this->addSeat();
        $viewer = $this->member('ada@ire.events', SeededRole::Member, $role);

        $this->as($viewer, 'GET', $this->plan());
        self::assertSame([[$row], [$seat]], [$this->rowsNow(), $this->seatsNow()]);

        foreach ([
            ['POST', $this->rows(), null],
            ['PATCH', $this->rows() . '/' . $row['id'], ['seats' => 6]],
            ['POST', $this->rows() . '/' . $row['id'] . '/duplicate', null],
            ['DELETE', $this->rows() . '/' . $row['id'], null],
            ['POST', $this->seats(), null],
            ['PATCH', $this->seats() . '/' . $seat['id'], ['unusable' => true]],
            ['DELETE', $this->seats() . '/' . $seat['id'], null],
        ] as [$method, $path, $body]) {
            $this->as($viewer, $method, $path, $body, '"1"');
            self::assertSame(403, $this->statusCode(), $method . ' ' . $path);
        }

        self::assertSame([[$row], [$seat]], [$this->rowsNow(), $this->seatsNow()]);
    }

    #[Test]
    public function anotherOrganisationsRowOrSeatIsNotFound(): void
    {
        $row = $this->addRow();
        $seat = $this->addSeat();
        $stranger = $this->account('stranger@else.where');
        $theirs = self::service(OrganisationFounder::class)->found($stranger, 'Elsewhere', 'NG', 'Africa/Lagos');
        self::em()->flush();
        $theirEvent = $this->newEvent($stranger, $theirs);
        $this->as($stranger, 'POST', '/api/events/' . $theirEvent . '/seating-plan', ['widthCm' => 2400, 'lengthCm' => 1800]);

        foreach ([$this->eventId, $theirEvent] as $event) {
            $this->as($stranger, 'PATCH', '/api/events/' . $event . '/seating-plan/rows/' . $row['id'], ['seats' => 6], '"1"');
            self::assertSame(404, $this->statusCode());
            $this->as($stranger, 'PATCH', '/api/events/' . $event . '/seating-plan/seats/' . $seat['id'], ['unusable' => true], '"1"');
            self::assertSame(404, $this->statusCode());
        }
    }

    /** @return array<string, mixed> */
    private function addRow(): array
    {
        return $this->rowOf($this->as($this->owner, 'POST', $this->rows()));
    }

    /** @return array<string, mixed> */
    private function addSeat(): array
    {
        return $this->seatOf($this->as($this->owner, 'POST', $this->seats()));
    }

    /**
     * @param array<string, mixed> $row
     * @param array<string, mixed> $fields
     *
     * @return array<string, mixed>
     */
    private function changeRow(array $row, array $fields): array
    {
        $changed = $this->rowOf($this->as($this->owner, 'PATCH', $this->rows() . '/' . Type\string()->coerce($row['id']), $fields, '"' . Type\int()->coerce($row['version']) . '"'));
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        return $changed;
    }

    /**
     * @param array<string, mixed> $seat
     * @param array<string, mixed> $fields
     *
     * @return array<string, mixed>
     */
    private function changeSeat(array $seat, array $fields): array
    {
        $changed = $this->seatOf($this->as($this->owner, 'PATCH', $this->seats() . '/' . Type\string()->coerce($seat['id']), $fields, '"' . Type\int()->coerce($seat['version']) . '"'));
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        return $changed;
    }

    /** @return array<string, mixed> */
    private function rowOf(mixed $body): array
    {
        return $this->itemOf($body, 'rowId', 'rows');
    }

    /** @return array<string, mixed> */
    private function seatOf(mixed $body): array
    {
        return $this->itemOf($body, 'seatId', 'singleSeats');
    }

    /** @return array<string, mixed> */
    private function itemOf(mixed $body, string $idKey, string $listKey): array
    {
        $id = Type\string()->coerce(Type\dict(Type\string(), Type\mixed())->coerce($body)[$idKey] ?? null);
        $plan = Type\dict(Type\string(), Type\mixed())->coerce($this->seating($body)['plan'] ?? null);

        foreach (Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce($plan[$listKey] ?? null) as $item) {
            if ($item['id'] === $id) {
                return $item;
            }
        }

        self::fail('no ' . $listKey . ' ' . $id);
    }

    /** @return array{0: list<string>, 1: list<string>} the row and single seat ids in the last update on this event's seating topic */
    private function published(): array
    {
        $update = Iter\last(self::service(RecordingHub::class)->published) ?? self::fail('nothing published');
        self::assertSame(['events/' . $this->eventId . '/seating'], $update->getTopics());
        $ids = Type\vec(Type\shape(['id' => Type\string()], true));
        $published = Type\shape(['plan' => Type\shape(['rows' => $ids, 'singleSeats' => $ids], true)], true)->coerce(Json\decode($update->getData()));

        return [
            Vec\map($published['plan']['rows'], static fn (array $one): string => $one['id']),
            Vec\map($published['plan']['singleSeats'], static fn (array $one): string => $one['id']),
        ];
    }

    /** @return list<array<string, mixed>> */
    private function rowsNow(): array
    {
        return Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce(Type\dict(Type\string(), Type\mixed())->coerce($this->seating($this->as($this->owner, 'GET', $this->plan()))['plan'] ?? null)['rows'] ?? null);
    }

    /** @return list<array<string, mixed>> */
    private function seatsNow(): array
    {
        return Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce(Type\dict(Type\string(), Type\mixed())->coerce($this->seating($this->as($this->owner, 'GET', $this->plan()))['plan'] ?? null)['singleSeats'] ?? null);
    }

    private function rows(): string
    {
        return $this->plan() . '/rows';
    }

    private function seats(): string
    {
        return $this->plan() . '/seats';
    }

    private function addSection(string $name): string
    {
        $sections = $this->planOf($this->seating($this->as($this->owner, 'POST', $this->plan() . '/sections', ['name' => $name])))['sections'];
        self::assertSame(201, $this->statusCode());

        return Type\string()->coerce((Iter\last($sections) ?? self::fail('no section'))['id']);
    }

    /** @return array{sections: list<array<string, mixed>>, tables: mixed, withoutSection: mixed, counts: array<string, int>, widthCm: int, ...} */
    private function planNow(): array
    {
        return $this->planOf($this->seating($this->as($this->owner, 'GET', $this->plan())));
    }

    private function newEvent(User $by, Organisation $organisation): string
    {
        $body = $this->as($by, 'POST', '/api/orgs/' . $organisation->getId()->toRfc4122() . '/events', [
            'name' => 'Owambe',
            'type' => 'wedding',
            'startsAt' => '2026-11-14T16:00',
            'endsAt' => '2026-11-15T02:00',
        ]);
        self::assertSame(201, $this->statusCode());

        return Type\shape(['id' => Type\string()], true)->coerce($body['event'] ?? null)['id'];
    }

    private function plan(): string
    {
        return '/api/events/' . $this->eventId . '/seating-plan';
    }

    /** @return array<string, mixed> */
    private function seating(mixed $body): array
    {
        return Type\dict(Type\string(), Type\mixed())->coerce(Type\dict(Type\string(), Type\mixed())->coerce($body)['seating'] ?? null);
    }

    /** @return array{sections: list<array<string, mixed>>, tables: mixed, withoutSection: mixed, counts: array<string, int>, widthCm: int, ...} */
    private function planOf(mixed $seating): array
    {
        return Type\shape([
            'widthCm' => Type\int(),
            'sections' => Type\vec(Type\dict(Type\string(), Type\mixed())),
            'tables' => Type\mixed(),
            'withoutSection' => Type\mixed(),
            'counts' => Type\dict(Type\string(), Type\int()),
        ], true)->coerce(Type\dict(Type\string(), Type\mixed())->coerce($seating)['plan'] ?? null);
    }

    private function violation(string $path): ?string
    {
        $violations = Type\vec(Type\shape(['propertyPath' => Type\string(), 'message' => Type\string()], true))->coerce($this->last()['violations'] ?? []);

        foreach ($violations as $violation) {
            if ($violation['propertyPath'] === $path) {
                return $violation['message'];
            }
        }

        return null;
    }

    private function account(string $address): User
    {
        $user = self::service(UserRegistrar::class)->register($address, 'Person', self::PASSWORD)->user;
        self::onboard($user, withOrganisation: false);

        return $user;
    }

    private function member(string $address, SeededRole $seeded, EventRole $on): User
    {
        $user = $this->account($address);
        $role = self::em()->getRepository(Role::class)->findOneBy(['organisation' => $this->organisation, 'seededAs' => $seeded]);
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
