<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Deletion\TypedName;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

final class TypedNameTest extends TestCase
{
    #[Test]
    #[DataProvider('typings')]
    public function aTypedNameMatchesOnlyAsTheRuleSays(string $typed, string $name, bool $matches): void
    {
        self::assertSame($matches, TypedName::matches($typed, $name));
    }

    /** @return iterable<string, array{string, string, bool}> */
    public static function typings(): iterable
    {
        yield 'exact' => ["Amara & Tobi's wedding", "Amara & Tobi's wedding", true];
        yield 'spaces around it' => ["  Amara & Tobi's wedding ", "Amara & Tobi's wedding", true];
        yield 'curly typed for straight' => ["Amara & Tobi\u{2019}s wedding", "Amara & Tobi's wedding", true];
        yield 'straight typed for curly' => ["Amara & Tobi's wedding", "Amara & Tobi\u{2019}s wedding", true];
        yield 'opening curly for straight' => ["\u{2018}Tobi'", "'Tobi'", true];
        yield 'curly double quotes' => ["The \u{201C}Big\u{201D} night", 'The "Big" night', true];
        yield 'decomposed accents' => ["I\u{0300}re\u{0300} Events", 'Ìrè Events', true];
        yield 'another case' => ["amara & tobi's wedding", "Amara & Tobi's wedding", false];
        yield 'an apostrophe for a quote' => ["Tobi's", 'Tobi"s', false];
        yield 'a backtick is not an apostrophe' => ['Tobi`s', "Tobi's", false];
        yield 'a dash is not folded' => ['Ìrè – Events', 'Ìrè - Events', false];
        yield 'blank' => ['   ', 'Ìrè Events', false];
    }
}
