<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Domain\Staff\ShiftNotice\Model\ShiftChange;
use App\Domain\Staff\ShiftNotice\Model\ShiftTold;
use App\Domain\Staff\ShiftNotice\ShiftChanges;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;
use Psl\Iter;
use Psl\Vec;

/** What a change notice says, against what the person was last told (sc-4333, "Decided, 26 Nov (pm): several shifts"). */
final class ShiftChangesTest extends TestCase
{
    private const array WAITER = ['job-waiter', 'Waiter'];

    #[Test]
    public function oneShiftRetimedGivesTheStartTimeAlone(): void
    {
        self::assertSame(
            [['start_time', '2027-03-06 15:00', '2027-03-06 17:00']],
            self::read(self::told(['a' => ['2027-03-06 17:00', '2027-03-06 23:00']]), self::told(['a' => ['2027-03-06 15:00', '2027-03-06 23:00']])),
        );
    }

    #[Test]
    public function aMoveToAnotherShiftReadsAsTheTimesThatDiffer(): void
    {
        self::assertSame(
            [['end_time', '2027-03-07 01:00', '2027-03-06 23:00']],
            self::read(self::told(['a' => ['2027-03-06 17:00', '2027-03-06 23:00']]), self::told(['b' => ['2027-03-06 17:00', '2027-03-07 01:00']])),
        );
    }

    #[Test]
    public function aMoveToTheSameHoursSendsNothingAndOnAnotherDaySendsBothLines(): void
    {
        $told = self::told(['a' => ['2027-03-06 17:00', '2027-03-06 23:00']]);

        self::assertSame([], self::read($told, self::told(['b' => ['2027-03-06 17:00', '2027-03-06 23:00']])));
        self::assertSame(
            [['start_time', '2027-03-07 17:00', '2027-03-06 17:00'], ['end_time', '2027-03-07 23:00', '2027-03-06 23:00']],
            self::read($told, self::told(['b' => ['2027-03-07 17:00', '2027-03-07 23:00']])),
        );
    }

    #[Test]
    public function anAssignBesideAShiftNamesTheNewShift(): void
    {
        self::assertSame(
            [['shift_added', '2027-03-07 12:00', '2027-03-07 18:00']],
            self::read(
                self::told(['a' => ['2027-03-06 17:00', '2027-03-06 23:00']]),
                self::told(['a' => ['2027-03-06 17:00', '2027-03-06 23:00'], 'b' => ['2027-03-07 12:00', '2027-03-07 18:00']]),
            ),
        );
    }

    #[Test]
    public function anUnassignWithAShiftLeftNamesTheShiftGone(): void
    {
        self::assertSame(
            [['shift_removed', '2027-03-07 12:00', '2027-03-07 18:00']],
            self::read(
                self::told(['a' => ['2027-03-06 17:00', '2027-03-06 23:00'], 'b' => ['2027-03-07 12:00', '2027-03-07 18:00']]),
                self::told(['a' => ['2027-03-06 17:00', '2027-03-06 23:00']]),
            ),
        );
    }

    #[Test]
    public function anUnassignOfTheLastShiftSaysTheyHaveNoneLeft(): void
    {
        self::assertSame(
            [['shift_removed', '2027-03-06 17:00', '2027-03-06 23:00'], ['no_shift_left', null, null]],
            self::read(self::told(['a' => ['2027-03-06 17:00', '2027-03-06 23:00']]), self::told([])),
        );
    }

    #[Test]
    public function editTimesOnOneOfSeveralShiftsGivesItsNewAndOldTimes(): void
    {
        $lines = ShiftChanges::between(
            self::told(['a' => ['2027-03-06 17:00', '2027-03-06 23:00'], 'b' => ['2027-03-07 12:00', '2027-03-07 18:00']]),
            self::told(['a' => ['2027-03-06 15:00', '2027-03-06 23:00'], 'b' => ['2027-03-07 12:00', '2027-03-07 18:00']]),
        );

        self::assertCount(1, $lines);
        self::assertSame('shift_retimed', $lines[0]->kind->value);
        self::assertSame(['2027-03-06 15:00', '2027-03-06 23:00', '2027-03-06 17:00', '2027-03-06 23:00'], [
            $lines[0]->start?->format('Y-m-d H:i'),
            $lines[0]->end?->format('Y-m-d H:i'),
            $lines[0]->oldStart?->format('Y-m-d H:i'),
            $lines[0]->oldEnd?->format('Y-m-d H:i'),
        ]);
    }

    #[Test]
    public function fourShiftLinesNameTheRemovalAndTheTwoSoonestOthersInStartOrder(): void
    {
        self::assertSame(
            [
                ['shift_added', '2027-03-05 18:00', '2027-03-05 23:00'],
                ['shift_retimed', '2027-03-06 15:00', '2027-03-06 23:00'],
                ['shift_removed', '2027-03-07 16:00', '2027-03-07 22:00'],
                ['more_changes', null, null],
            ],
            self::read(
                self::told(['r' => ['2027-03-06 17:00', '2027-03-06 23:00'], 'x' => ['2027-03-07 16:00', '2027-03-07 22:00']]),
                self::told([
                    'f' => ['2027-03-05 18:00', '2027-03-05 23:00'],
                    'r' => ['2027-03-06 15:00', '2027-03-06 23:00'],
                    's' => ['2027-03-07 10:00', '2027-03-07 14:00'],
                ]),
            ),
        );
    }

    #[Test]
    public function theMoreChangesLineCountsTheLinesLeftOut(): void
    {
        $lines = ShiftChanges::between(self::told([]), self::told([
            'a' => ['2027-03-05 10:00', '2027-03-05 12:00'],
            'b' => ['2027-03-05 13:00', '2027-03-05 15:00'],
            'c' => ['2027-03-05 16:00', '2027-03-05 18:00'],
            'd' => ['2027-03-06 10:00', '2027-03-06 12:00'],
            'e' => ['2027-03-06 13:00', '2027-03-06 15:00'],
        ]));

        self::assertSame(2, Iter\search($lines, static fn (ShiftChange $line): bool => 'more_changes' === $line->kind->value)?->count);
    }

    #[Test]
    public function fiveRemovalsWithNoShiftLeftNameTheThreeSoonestThenTheNoShiftLine(): void
    {
        self::assertSame(
            [
                ['shift_removed', '2027-03-05 10:00', '2027-03-05 12:00'],
                ['shift_removed', '2027-03-05 13:00', '2027-03-05 15:00'],
                ['shift_removed', '2027-03-05 16:00', '2027-03-05 18:00'],
                ['no_shift_left', null, null],
            ],
            self::read(self::told([
                'e' => ['2027-03-06 13:00', '2027-03-06 15:00'],
                'a' => ['2027-03-05 10:00', '2027-03-05 12:00'],
                'd' => ['2027-03-06 10:00', '2027-03-06 12:00'],
                'b' => ['2027-03-05 13:00', '2027-03-05 15:00'],
                'c' => ['2027-03-05 16:00', '2027-03-05 18:00'],
            ]), self::told([])),
        );
    }

    #[Test]
    public function aNewJobGoesOnlyWithAShiftAndARenameSendsNothing(): void
    {
        $told = self::told(['a' => ['2027-03-06 17:00', '2027-03-06 23:00']]);
        $runner = new ShiftTold($told->shifts, ['job-runner', 'Runner'], $told->date, $told->venue);
        $renamed = new ShiftTold($told->shifts, ['job-waiter', 'Server'], $told->date, $told->venue);
        $noShift = new ShiftTold([], ['job-runner', 'Runner'], $told->date, $told->venue);

        self::assertSame([['job', 'Runner', 'Waiter']], self::values(ShiftChanges::between($told, $runner)));
        self::assertSame([], ShiftChanges::between($told, $renamed));
        self::assertNotContains(['job', 'Runner', 'Waiter'], self::values(ShiftChanges::between($told, $noShift)));
    }

    #[Test]
    public function theDateLineLeadsTheShiftsAndTheVenueFollowsThem(): void
    {
        $told = self::told(['a' => ['2027-03-06 17:00', '2027-03-06 23:00']]);
        $moved = new ShiftTold(['a' => ['2027-03-07 17:00', '2027-03-07 23:00']], $told->job, '2027-03-07', 'Eko Hotel');

        self::assertSame(
            ['date', 'start_time', 'end_time', 'venue'],
            Vec\map(ShiftChanges::between($told, $moved), static fn (ShiftChange $line): string => $line->kind->value),
        );
        $values = self::values(ShiftChanges::between($told, $moved));
        self::assertSame([['date', '2027-03-07', '2027-03-06'], ['venue', 'Eko Hotel', 'Harbour Hall']], [$values[0], $values[3]]);
    }

    /** @param array<string, array{0: string, 1: string}> $shifts */
    private static function told(array $shifts): ShiftTold
    {
        return new ShiftTold($shifts, self::WAITER, '2027-03-06', 'Harbour Hall');
    }

    /** @return list<array{0: string, 1: ?string, 2: ?string}> */
    private static function read(ShiftTold $told, ShiftTold $now): array
    {
        return Vec\map(ShiftChanges::between($told, $now), static fn (ShiftChange $line): array => [
            $line->kind->value,
            $line->start?->format('Y-m-d H:i'),
            ($line->end ?? $line->oldStart)?->format('Y-m-d H:i'),
        ]);
    }

    /**
     * @param list<ShiftChange> $lines
     *
     * @return list<array{0: string, 1: ?string, 2: ?string}>
     */
    private static function values(array $lines): array
    {
        return Vec\map($lines, static fn (ShiftChange $line): array => [$line->kind->value, $line->new, $line->old]);
    }
}
