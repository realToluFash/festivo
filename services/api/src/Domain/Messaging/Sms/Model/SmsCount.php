<?php

declare(strict_types=1);

namespace App\Domain\Messaging\Sms\Model;

/** What a text costs to carry: its parts, whether it goes as Unicode, and its length in characters. */
final readonly class SmsCount
{
    /**
     * @param int<1, max> $parts
     * @param int<0, max> $characters in a Unicode text, UTF-16 code units
     */
    public function __construct(
        public int $parts,
        public bool $unicode,
        public int $characters,
    ) {
    }
}
