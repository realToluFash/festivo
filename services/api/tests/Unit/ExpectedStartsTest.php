<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Domain\RunOfShow\ExpectedStarts;
use App\Entity\Event;
use App\Entity\Organisation;
use App\Entity\ScheduleItem;
use App\Entity\User;
use App\Enum\EventType;
use DateTimeImmutable;
use DateTimeZone;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;
use Psl\Dict;
use Psl\File;
use Psl\Json;
use Psl\Str;
use Psl\Type;
use Psl\Vec;

/** The cases packages/domain's runTimes.test.ts reads too, so the server's expected starts and the run view's runTrack cannot drift apart. */
final class ExpectedStartsTest extends TestCase
{
    /** @return iterable<string, array{string, string, list<array{id: string, planned: string, lengthMinutes: ?int, fixedTime: bool, startedAt: ?string, endedAt: ?string}>, array<string, string>}> */
    public static function cases(): iterable
    {
        $table = Type\dict(Type\string(), Type\shape([
            'zone' => Type\string(),
            'now' => Type\string(),
            'items' => Type\vec(Type\shape([
                'id' => Type\string(),
                'planned' => Type\string(),
                'lengthMinutes' => Type\nullable(Type\int()),
                'fixedTime' => Type\bool(),
                'startedAt' => Type\nullable(Type\string()),
                'endedAt' => Type\nullable(Type\string()),
            ])),
            'expected' => Type\dict(Type\string(), Type\string()),
        ]))->coerce(Json\decode(File\read(\dirname(__DIR__) . '/Fixtures/RunOfShow/expected-starts.json')));

        foreach ($table as $case => $track) {
            yield $case => [$track['zone'], $track['now'], $track['items'], $track['expected']];
        }
    }

    /**
     * @param list<array{id: string, planned: string, lengthMinutes: ?int, fixedTime: bool, startedAt: ?string, endedAt: ?string}> $rows
     * @param array<string, string>                                                                                                $expected
     */
    #[Test]
    #[DataProvider('cases')]
    public function eachItemNotYetStartedIsExpectedWhenTheRunViewExpectsIt(string $zone, string $now, array $rows, array $expected): void
    {
        $timeZone = new DateTimeZone($zone);
        $by = new User('Funmi Adeyemi');
        $event = new Event(new Organisation('Ìrè Events', 'FR', 'EUR', $zone, 'hello@ire.events', 'en'), 'Owambe', EventType::Wedding, new DateTimeImmutable('2026-11-20T17:00:00Z'), new DateTimeImmutable('2026-11-21T03:00:00Z'), 'EUR');
        $items = [];

        foreach ($rows as $row) {
            $item = new ScheduleItem($event, $row['id'], new DateTimeImmutable(Str\slice($row['planned'], 0, 16), new DateTimeZone('UTC')), $by);
            $item->describe($row['id'], $item->getStartsAt(), $row['lengthMinutes'], null, null, null, null, $row['fixedTime'], false, $by);

            if (null !== $row['startedAt']) {
                $item->setStartedAt(new DateTimeImmutable($row['startedAt']));
            }

            if (null !== $row['endedAt']) {
                $item->setEndedAt(new DateTimeImmutable($row['endedAt']));
            }

            $items[$item->getId()->toRfc4122()] = $item;
        }

        $starts = ExpectedStarts::of(Vec\values($items), new DateTimeImmutable($now), $timeZone);
        $actual = Dict\map_with_key(
            Dict\filter_keys($items, static fn (string $id): bool => isset($expected[$items[$id]->getTitle()])),
            static fn (string $id, ScheduleItem $item): string => $starts[$id]->setTimezone($timeZone)->format(\DATE_ATOM),
        );

        self::assertSame($expected, Dict\map_keys($actual, static fn (string $id): string => $items[$id]->getTitle()));
    }
}
