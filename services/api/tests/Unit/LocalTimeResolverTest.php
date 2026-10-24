<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Domain\Event\LocalTimeResolver;
use DateTimeImmutable;
use DateTimeZone;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

final class LocalTimeResolverTest extends TestCase
{
    /** @return iterable<string, array{string, string, string}> */
    public static function times(): iterable
    {
        yield 'an ordinary time keeps its offset' => ['Europe/Madrid', '2026-11-14T16:00', '2026-11-14T16:00:00+01:00'];
        yield 'summer time' => ['Europe/Madrid', '2026-07-01T19:00', '2026-07-01T19:00:00+02:00'];
        yield 'a time the clocks skip moves later by the gap' => ['Europe/Madrid', '2026-03-29T02:30', '2026-03-29T03:30:00+02:00'];
        yield 'the first minute of the gap' => ['Europe/Madrid', '2026-03-29T02:00', '2026-03-29T03:00:00+02:00'];
        yield 'a time the clocks repeat takes the earlier offset' => ['Europe/Madrid', '2026-10-25T02:30', '2026-10-25T02:30:00+02:00'];
        yield 'just after the repeat' => ['Europe/Madrid', '2026-10-25T03:00', '2026-10-25T03:00:00+01:00'];
        yield 'a zone with no clock changes' => ['Africa/Lagos', '2026-03-29T02:30', '2026-03-29T02:30:00+01:00'];
        yield 'a gap of half an hour' => ['Australia/Lord_Howe', '2026-10-04T02:15', '2026-10-04T02:45:00+11:00'];
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
