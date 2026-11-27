<?php

declare(strict_types=1);

namespace App\Domain\Messaging\Sms;

/** Typographic punctuation in a value filled into a text goes as its plain equivalent, so the text stays GSM-7 where it can (sc-3946). Letters are never changed. */
final class PlainPunctuation
{
    private const array PLAIN = [
        "\u{2018}" => "'", "\u{2019}" => "'", "\u{201A}" => "'", "\u{201B}" => "'", "\u{2032}" => "'",
        "\u{201C}" => '"', "\u{201D}" => '"', "\u{201E}" => '"', "\u{201F}" => '"', "\u{2033}" => '"',
        "\u{00AB}" => '"', "\u{00BB}" => '"', "\u{2039}" => "'", "\u{203A}" => "'",
        "\u{2010}" => '-', "\u{2011}" => '-', "\u{2012}" => '-', "\u{2013}" => '-', "\u{2014}" => '-', "\u{2015}" => '-', "\u{2212}" => '-',
        "\u{2026}" => '...', "\u{00A0}" => ' ', "\u{2009}" => ' ', "\u{202F}" => ' ',
    ];

    public static function of(string $value): string
    {
        return \strtr($value, self::PLAIN);
    }
}
