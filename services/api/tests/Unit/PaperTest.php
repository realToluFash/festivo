<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Enum\Paper;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

/** The kitchen sheet's PDF paper (sc-3911): CLDR's paperSize, from the organisation's country. */
final class PaperTest extends TestCase
{
    /** @return iterable<string, array{string, Paper}> */
    public static function countries(): iterable
    {
        yield 'the United States' => ['US', Paper::Letter];
        yield 'Canada' => ['CA', Paper::Letter];
        yield 'Mexico' => ['MX', Paper::Letter];
        yield 'the Philippines' => ['PH', Paper::Letter];
        yield 'France' => ['FR', Paper::A4];
        yield 'Nigeria' => ['NG', Paper::A4];
        yield 'the United Kingdom' => ['GB', Paper::A4];
        yield 'a code in lower case' => ['us', Paper::Letter];
    }

    #[Test]
    #[DataProvider('countries')]
    public function theCountryChoosesThePaper(string $country, Paper $paper): void
    {
        self::assertSame($paper, Paper::forCountry($country));
    }
}
