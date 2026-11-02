<?php

declare(strict_types=1);

namespace App\Domain\Event\Cover\Exception;

use Psl\Str;
use RuntimeException;

final class CoverPhotoRefused extends RuntimeException
{
    /** @param 'type'|'size'|'dimensions' $reason */
    private function __construct(
        public readonly string $reason,
    ) {
        parent::__construct(Str\format('The cover photo was refused: %s.', $reason));
    }

    public static function type(): self
    {
        return new self('type');
    }

    public static function size(): self
    {
        return new self('size');
    }

    public static function dimensions(): self
    {
        return new self('dimensions');
    }
}
