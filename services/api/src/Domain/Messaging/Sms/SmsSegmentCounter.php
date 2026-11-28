<?php

declare(strict_types=1);

namespace App\Domain\Messaging\Sms;

use App\Domain\Messaging\Sms\Model\SmsCount;
use Psl\Iter;
use Psl\Math;
use Psl\Str;
use Psl\Vec;

/** Counts a text's parts (3GPP TS 23.038): GSM-7 holds 160 characters, or 153 a part when split; any other character sends the whole text as UCS-2, 70 or 67. */
final class SmsSegmentCounter
{
    private const string BASIC = "@£\$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";

    /** Each takes two septets, an escape and the character, which a split never parts. */
    private const string EXTENSION = "\f^{}\\[~]|€";

    public static function count(string $text): SmsCount
    {
        $characters = Str\chunk($text);
        $unicode = !Iter\all($characters, static fn (string $character): bool => Str\contains(self::BASIC . self::EXTENSION, $character));
        $widths = Vec\map($characters, static fn (string $character): int => match (true) {
            $unicode => Str\Byte\length($character) > 3 ? 2 : 1,
            Str\contains(self::EXTENSION, $character) => 2,
            default => 1,
        });
        $length = Math\sum($widths);
        [$whole, $part] = $unicode ? [70, 67] : [160, 153];

        return new SmsCount($length <= $whole ? 1 : self::split($widths, $part), $unicode, Math\maxva(0, $length));
    }

    /**
     * @param list<int> $widths
     *
     * @return int<1, max>
     */
    private static function split(array $widths, int $room): int
    {
        $parts = 1;
        $used = 0;

        foreach ($widths as $width) {
            if ($used + $width > $room) {
                ++$parts;
                $used = 0;
            }

            $used += $width;
        }

        return $parts;
    }
}
