<?php

declare(strict_types=1);

namespace App\Tests\Functional\Service;

use App\Domain\Guest\GuestNeedsRecord;
use App\Domain\Guest\Model\GuestNeeds;
use App\Domain\Service\OrderMaker;
use App\Entity\Guest;
use App\Entity\SeatAssignment;
use App\Entity\SeatingRow;
use App\Entity\SeatingSeat;
use App\Entity\StaffItemStation;
use App\Entity\StaffStation;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\NeedKind;
use App\Enum\StationKind;
use App\Locale\NameNormaliser;
use PHPUnit\Framework\Attributes\Test;
use Psl\Iter;
use Psl\Json;
use Psl\Type;
use Psl\Vec;

/** sc-4005: what a tray takes, its route and marks, the check, and the plates taken to the table. */
final class ServiceTraysTest extends ServiceTestCase
{
    #[Test]
    public function aTrayCarriesThreePlatesFromThePassToTheTableAndAllServedServesThem(): void
    {
        $this->arrive('Adaeze Obi', 'Bola Ade', 'Chidi Eze', 'Dayo Ola');
        $this->fire();

        $tray = $this->startTray();

        self::assertSame($this->orderIds('Adaeze Obi', 'Bola Ade', 'Chidi Eze'), $tray['plates'], 'up to 3 plates a tray, in seat order');
        self::assertSame('dishing', $this->orderOf('Adaeze Obi')['stage']);

        $this->post('/trays/' . self::id($tray) . '/take-to-table');
        $this->assertRefused(409, ErrorCode::PlateStageInvalid->type());

        $this->toTheTable($tray);
        $served = $this->post('/trays/' . self::id($tray) . '/all-served');
        self::assertSame(200, $this->statusCode(), Json\encode($served));
        self::assertSame([3, 0], [$served['ticked'], $served['left']]);

        $stages = Type\mixed_dict()->coerce(Type\mixed_dict()->coerce(self::tableOf($this->read())['counts'])['stages']);
        self::assertSame([3, 1], [$stages['served'], $stages['toServe']], 'the fourth waits for the next tray');
        self::assertTrue(self::trayOf($this->read(), self::id($tray))['done']);
    }

    #[Test]
    public function aSecondStartAtTheTableGetsTheRestAndAThirdHasNothingToServe(): void
    {
        $this->arrive(...self::GUESTS);
        $this->fire();

        self::assertSame($this->orderIds('Adaeze Obi', 'Bola Ade', 'Chidi Eze'), $this->startTray()['plates']);
        self::assertSame($this->orderIds('Dayo Ola', 'Ese Ugo'), $this->startTray()['plates']);

        $this->post('/course/' . $this->courseId() . '/trays', ['table' => $this->tableKey()]);
        $this->assertRefused(409, ErrorCode::TableNothingToServe->type());
        self::assertCount(2, Type\vec(Type\mixed())->coerce($this->read()['trays']), 'nothing changed');
    }

    #[Test]
    public function aTrayNeverMixesTables(): void
    {
        $second = $this->tableIn($this->section, 'Table 2');
        $this->seat('Funmi Bello', $second, 1);
        self::em()->flush();
        $this->arrive('Adaeze Obi', 'Funmi Bello');
        $this->fire();
        $this->fire(null, $second);

        $tray = $this->startTray();

        self::assertSame($this->orderIds('Adaeze Obi'), $tray['plates']);
        self::assertSame($this->tableKey(), $tray['table']);
    }

    #[Test]
    public function aRowIsATableAndSoIsEachBlockOfTenSingleSeatsInNumberOrder(): void
    {
        $row = new SeatingRow($this->plan, 'Row A', NameNormaliser::key('Row A'), 0, 0, null);
        $row->setSection($this->section);
        self::em()->persist($row);
        $seats = Vec\map(Vec\range(12, 1), function (int $number): SeatingSeat {
            $seat = new SeatingSeat($this->plan, (string) $number, (string) $number, 0, 0, null);
            $seat->setSection($this->section);
            self::em()->persist($seat);

            return $seat;
        });

        foreach ([['Ngozi Row', $row, 1], ['Seat Two', $seats[10], 1], ['Seat Ten', $seats[2], 1], ['Seat Eleven', $seats[1], 1]] as [$name, $place, $at]) {
            $guest = Guest::listed($this->event, $name, NameNormaliser::key($name), null, null, $this->owner, 'link-' . NameNormaliser::key($name), 'S' . Iter\count($this->guests));
            self::em()->persist($guest);
            self::em()->persist(new SeatAssignment($guest, $place, $at));
            $this->guests[$name] = $guest;
        }

        self::em()->flush();
        $this->arrive('Ngozi Row', 'Seat Two', 'Seat Ten', 'Seat Eleven');
        $first = 'block:' . $this->section->getId()->toRfc4122() . ':1';
        $second = 'block:' . $this->section->getId()->toRfc4122() . ':2';
        $rowKey = 'row:' . $row->getId()->toRfc4122();

        foreach ([$rowKey, $first, $second] as $key) {
            $this->fireAt($this->course, $key);
        }

        $tables = Type\vec(Type\mixed_dict())->coerce($this->read()['tables']);
        $blocks = Vec\filter($tables, static fn (array $table): bool => 'block' === $table['kind']);
        self::assertSame([Vec\map(Vec\range(1, 10), static fn (int $n): string => (string) $n), ['11', '12']], Vec\map($blocks, static fn (array $table): mixed => $table['seats']), 'ten to a block, numbers by value');

        self::assertSame($this->orderIds('Ngozi Row'), $this->startTray($rowKey)['plates']);
        self::assertSame($this->orderIds('Seat Two', 'Seat Ten'), $this->startTray($first)['plates']);
        self::assertSame($this->orderIds('Seat Eleven'), $this->startTray($second)['plates']);
    }

    #[Test]
    public function theStopsAreThePassThenTheWalkingOrderAndMarksCanBeMadeInAnyOrder(): void
    {
        $grill = $this->place('Grill', 0, 2);
        $coldRoom = $this->place('Cold room', 1, 1);
        self::em()->persist(new StaffItemStation($this->course, 'jollof rice', $grill));
        self::em()->persist(new StaffItemStation($this->course, 'plantain', $coldRoom));
        self::em()->flush();
        $this->arrive('Adaeze Obi');
        $this->fire();

        $tray = $this->startTray();
        $stops = Type\vec(Type\mixed_dict())->coerce($tray['stops']);
        self::assertSame(['Pass', 'Cold room', 'Grill'], Vec\map($stops, static fn (array $stop): mixed => $stop['name']));
        self::assertSame([[OrderMaker::CHEFS_CHOICE], ['plantain'], ['jollof rice']], Vec\map($stops, static fn (array $stop): array => Vec\map(Type\vec(Type\shape(['item' => Type\string()], true))->coerce($stop['marks']), static fn (array $mark): string => $mark['item'])));

        foreach (Vec\reverse(self::marksOf($tray)) as $one) {
            $this->mark($tray, $one['plateId'], $one['item'], 'notOn');
            $this->mark($tray, $one['plateId'], $one['item'], 'on');
        }

        $this->post('/trays/' . self::id($tray) . '/check');
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        self::assertSame('checked', $this->orderOf('Adaeze Obi')['stage']);
    }

    #[Test]
    public function theCheckIsRefusedNamingEachItemUnmarkedOrNotOnAndBringAfterLetsItPass(): void
    {
        $this->arrive('Adaeze Obi', 'Bola Ade');
        $this->fire();
        $tray = $this->startTray();
        [$adaeze, $bola] = $this->orderIds('Adaeze Obi', 'Bola Ade');
        $this->markAll($tray, 'on');
        $this->mark($tray, $adaeze, 'plantain', 'notOn');
        $this->mark($tray, $bola, 'jollof rice', null);

        $this->post('/trays/' . self::id($tray) . '/check');
        $this->assertRefused(409, ErrorCode::TrayCheckIncomplete->type());
        self::assertSame([['plateId' => $adaeze, 'item' => 'plantain'], ['plateId' => $bola, 'item' => 'jollof rice']], $this->last()['missing']);
        self::assertSame('dishing', $this->orderOf('Adaeze Obi')['stage'], 'nothing changed');

        $this->mark($tray, $adaeze, 'plantain', 'bringAfter');
        $this->mark($tray, $bola, 'jollof rice', 'on');
        $this->post('/trays/' . self::id($tray) . '/check');
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        self::assertSame(['checked', 'checked'], [$this->orderOf('Adaeze Obi')['stage'], $this->orderOf('Bola Ade')['stage']]);
    }

    #[Test]
    public function bringAfterIsRefusedOnAPlatesLastItemNotOn(): void
    {
        $this->arrive('Adaeze Obi');
        $this->fire();
        $tray = $this->startTray();
        [$adaeze] = $this->orderIds('Adaeze Obi');

        $this->mark($tray, $adaeze, 'jollof rice', 'bringAfter');
        $this->mark($tray, $adaeze, OrderMaker::CHEFS_CHOICE, 'notOn');
        $this->put('/trays/' . self::id($tray) . '/marks', ['plateId' => $adaeze, 'item' => 'plantain', 'mark' => 'bringAfter']);

        $this->assertRefused(409, ErrorCode::PlateEmpty->type());
        $this->mark($tray, $adaeze, 'plantain', 'on');
    }

    #[Test]
    public function aPlateTakenOffIsBackAtToServeWithItsMarksClearedAndTakeToTheTableEndsTakingOff(): void
    {
        $this->arrive('Adaeze Obi', 'Bola Ade');
        $this->fire();
        $tray = $this->startTray();
        [$adaeze, $bola] = $this->orderIds('Adaeze Obi', 'Bola Ade');
        $this->markAll($tray, 'on');

        $this->takeOff(self::id($tray), $adaeze);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        $order = $this->orderOf('Adaeze Obi');
        self::assertSame(['toServe', null], [$order['stage'], $order['trayId']]);
        self::assertSame([$bola], self::trayOf($this->read(), self::id($tray))['plates']);

        $this->post('/trays/' . self::id($tray) . '/check');
        $this->post('/trays/' . self::id($tray) . '/take-to-table');
        $this->takeOff(self::id($tray), $bola);
        $this->assertRefused(409, ErrorCode::PlateStageInvalid->type());

        $again = $this->startTray();
        self::assertSame([$adaeze], $again['plates']);
        self::assertSame([null, null, null], Vec\map(self::marksOf($again), static fn (array $one): mixed => $one['mark'] ?? null), 'its marks went with it');
    }

    #[Test]
    public function allServedLeavesAFlaggedGuestToBeTickedByName(): void
    {
        $by = self::em()->find(User::class, $this->owner->getId()) ?? self::fail('no owner');
        self::service(GuestNeedsRecord::class)->write($this->guests['Bola Ade'], new GuestNeeds([NeedKind::Allergen->value => ['peanuts']], [], null), $by);
        self::service(GuestNeedsRecord::class)->write($this->guests['Chidi Eze'], new GuestNeeds([], [NeedKind::Diet->value => 'No seed oils'], null), $by);
        self::em()->flush();
        $this->arrive('Adaeze Obi', 'Bola Ade', 'Chidi Eze');
        $this->fire();
        $tray = $this->startTray();
        [, $bola, $chidi] = $this->orderIds('Adaeze Obi', 'Bola Ade', 'Chidi Eze');
        $this->toTheTable($tray);

        $served = $this->post('/trays/' . self::id($tray) . '/all-served');
        self::assertSame([1, 2], [$served['ticked'], $served['left']]);
        self::assertSame(['served', 'onItsWay', 'onItsWay'], Vec\map(['Adaeze Obi', 'Bola Ade', 'Chidi Eze'], fn (string $name): mixed => $this->orderOf($name)['stage']));
        self::assertFalse(self::trayOf($this->read(), self::id($tray))['done']);

        foreach ([$bola, $chidi] as $plate) {
            $this->post('/trays/' . self::id($tray) . '/plates/' . $plate . '/served');
            self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        }

        self::assertTrue(self::trayOf($this->read(), self::id($tray))['done']);
    }

    #[Test]
    public function aStepTheStageDoesNotAllowIsRefusedAndChangesNothing(): void
    {
        $this->arrive('Adaeze Obi', 'Bola Ade');
        $this->fire();
        $tray = $this->startTray();
        [$adaeze, $bola] = $this->orderIds('Adaeze Obi', 'Bola Ade');
        $trayPath = '/trays/' . self::id($tray);

        $refusals = [
            'served before it is on its way' => fn () => $this->post($trayPath . '/plates/' . $adaeze . '/served'),
            'all served before the table' => fn () => $this->post($trayPath . '/all-served'),
            'sent back from the tray' => fn () => $this->post('/plates/' . $adaeze . '/sent-back', ['reason' => 'dropped']),
        ];
        $this->assertEachRefused($refusals, 'dishing');

        $this->markAll($tray, 'on');
        $this->post($trayPath . '/check');
        $refusals = [
            'checked twice' => fn () => $this->post($trayPath . '/check'),
            'marked once checked' => fn () => $this->put($trayPath . '/marks', ['plateId' => $adaeze, 'item' => 'plantain', 'mark' => 'notOn']),
            'served before it is on its way' => fn () => $this->post($trayPath . '/plates/' . $adaeze . '/served'),
        ];
        $this->assertEachRefused($refusals, 'checked');

        $this->post($trayPath . '/take-to-table');
        $refusals = [
            'taken to the table twice' => fn () => $this->post($trayPath . '/take-to-table'),
            'taken off at the table' => fn () => $this->takeOff(self::id($tray), $bola),
        ];
        $this->assertEachRefused($refusals, 'onItsWay');

        $this->post($trayPath . '/all-served');
        $this->assertEachRefused(['served twice' => fn () => $this->post($trayPath . '/plates/' . $adaeze . '/served')], 'served');
    }

    #[Test]
    public function undoingAStartPutsItsPlatesBackAndUndoingAllServedUndoesItAsOneStep(): void
    {
        $this->arrive('Adaeze Obi', 'Bola Ade');
        $this->fire();
        $tray = $this->startTray();

        $this->post('/undo', ['subject' => self::id($tray)]);
        self::assertSame(204, $this->statusCode(), Json\encode($this->last()));
        self::assertSame([['toServe', null], ['toServe', null]], Vec\map(['Adaeze Obi', 'Bola Ade'], fn (string $name): array => [$this->orderOf($name)['stage'], $this->orderOf($name)['trayId']]));

        $tray = $this->startTray();
        $this->toTheTable($tray);
        $this->post('/trays/' . self::id($tray) . '/all-served');
        self::assertSame(['served', 'served'], Vec\map(['Adaeze Obi', 'Bola Ade'], fn (string $name): mixed => $this->orderOf($name)['stage']));

        $this->post('/undo', ['subject' => self::id($tray)]);
        self::assertSame(204, $this->statusCode(), Json\encode($this->last()));
        self::assertSame(['onItsWay', 'onItsWay'], Vec\map(['Adaeze Obi', 'Bola Ade'], fn (string $name): mixed => $this->orderOf($name)['stage']), 'both plates, as one step');
    }

    /** @param array<string, callable(): mixed> $refusals */
    private function assertEachRefused(array $refusals, string $stage): void
    {
        foreach ($refusals as $what => $step) {
            $step();
            self::assertSame(409, $this->statusCode(), $what . ': ' . Json\encode($this->last()));
            self::assertSame(ErrorCode::PlateStageInvalid->type(), $this->last()['type'] ?? null, $what);
            self::assertSame($stage, $this->orderOf('Adaeze Obi')['stage'], $what . ' changed nothing');
        }
    }

    private function place(string $name, int $position, int $walk): StaffStation
    {
        $place = new StaffStation($this->event, StationKind::Place, $name, NameNormaliser::key($name), null, $position);
        $place->setWalkPosition($walk);
        self::em()->persist($place);

        return $place;
    }

    /** @param array<array-key, mixed> $tray */
    private function mark(array $tray, string $plateId, string $item, ?string $mark): void
    {
        $this->put('/trays/' . self::id($tray) . '/marks', ['plateId' => $plateId, 'item' => $item, 'mark' => $mark]);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
    }

    /** @return list<string> */
    private function orderIds(string ...$names): array
    {
        $read = $this->read();

        return Vec\map($names, function (string $name) use ($read): string {
            $tables = Type\vec(Type\mixed_dict())->coerce($read['tables']);
            $table = Iter\search($tables, fn (array $table): bool => Iter\any(Type\vec(Type\mixed_dict())->coerce($table['guests']), fn (array $guest): bool => $guest['id'] === $this->guests[$name]->getId()->toRfc4122())) ?? self::fail('nowhere ' . $name);

            return Type\string()->coerce(Type\mixed_dict()->coerce($this->guestOf($table, $name)['order'])['id']);
        });
    }

    /** @param array<array-key, mixed> $tray */
    private static function id(array $tray): string
    {
        return Type\string()->coerce($tray['id']);
    }
}
