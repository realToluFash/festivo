<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Domain\Event\DoorCode\DoorCodeText;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;
use Psl\Regex;
use Psl\Vec;

/** sc-72: 8 characters of Crockford's base32, read in any case with spaces and hyphens ignored. */
final class DoorCodeTextTest extends TestCase
{
    #[Test]
    public function aMadeCodeIsEightCharactersWithNoILOOrU(): void
    {
        foreach (Vec\range(1, 200) as $_) {
            self::assertTrue(Regex\matches(DoorCodeText::generate(), '/^[0-9ABCDEFGHJKMNPQRSTVWXYZ]{8}$/'));
        }
    }

    /** @return iterable<string, array{0: string, 1: string|null}> */
    public static function typed(): iterable
    {
        yield 'as shown' => ['Q7KM 4XP2', 'Q7KM4XP2'];
        yield 'lower case and a hyphen' => ['q7km-4xp2', 'Q7KM4XP2'];
        yield 'spaces anywhere' => ['  Q7 KM4X P2 ', 'Q7KM4XP2'];
        yield 'I, L and O read as digits' => ['iLoK 4XP2', '110K4XP2'];
        yield 'seven' => ['Q7KM4XP', null];
        yield 'nine' => ['Q7KM4XP22', null];
        yield 'a U' => ['Q7KM4XPU', null];
        yield 'a letter from elsewhere' => ['Q7KM4XPÉ', null];
    }

    #[Test]
    #[DataProvider('typed')]
    public function whatWasTypedIsReadAsOneCodeOrNone(string $typed, ?string $code): void
    {
        self::assertSame($code, DoorCodeText::normalise($typed));
    }
}
