<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Domain\Event\LocalTimeResolver;
use DateTimeImmutable;
use DateTimeZone;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;
use Psl\File;
use Psl\Json;
use Psl\Type;

final class LocalTimeResolverTest extends TestCase
{
    /** @return iterable<string, array{string, string, string}> */
    public static function times(): iterable
    {
        $table = Type\dict(Type\string(), Type\shape([
            'zone' => Type\string(),
            'typed' => Type\string(),
            'saved' => Type\string(),
        ]))->coerce(Json\decode(File\read(\dirname(__DIR__) . '/Fixtures/LocalTime/wall-clock-times.json')));

        foreach ($table as $case => $time) {
            yield $case => [$time['zone'], $time['typed'], $time['saved']];
        }
    }

    #[Test]
    #[DataProvider('times')]
    public function aWallClockTimeIsTheInstantRfc5545MakesIt(string $zone, string $typed, string $expected): void
    {
        $resolved = LocalTimeResolver::resolve(new DateTimeImmutable($typed, new DateTimeZone('UTC')), new DateTimeZone($zone));

        self::assertSame($expected, $resolved->format(\DATE_ATOM));
        self::assertSame($zone, $resolved->getTimezone()->getName());
    }

    #[Test]
    public function theRepeatedTimeIsTheEarlierOfItsTwoInstants(): void
    {
        $resolved = LocalTimeResolver::resolve(new DateTimeImmutable('2026-10-25T02:30', new DateTimeZone('UTC')), new DateTimeZone('Europe/Madrid'));

        self::assertSame('2026-10-25T00:30:00+00:00', $resolved->setTimezone(new DateTimeZone('UTC'))->format(\DATE_ATOM));
    }
}
