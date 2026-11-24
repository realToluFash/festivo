<?php

declare(strict_types=1);

namespace App\WebAuthn;

use App\WebAuthn\Exception\CeremonyRefused;
use Psl\Str\Byte;

/** The definite-length CBOR (RFC 8949) an authenticator writes. Byte and text strings both come back as strings. */
final readonly class Cbor
{
    private const int MAX_DEPTH = 8;

    /** @return array{0: mixed, 1: int} the value, and the offset just past it */
    public function decode(string $bytes, int $offset = 0): array
    {
        return $this->item($bytes, $offset, 0);
    }

    /** @return array{0: mixed, 1: int} */
    private function item(string $bytes, int $offset, int $depth): array
    {
        if ($depth > self::MAX_DEPTH) {
            throw new CeremonyRefused('CBOR nested too deep');
        }

        $initial = \ord($this->take($bytes, $offset, 1));
        ++$offset;
        $major = $initial >> 5;
        [$argument, $offset] = $this->argument($bytes, $offset, $initial & 0x1F);

        switch ($major) {
            case 0:
                return [$argument, $offset];
            case 1:
                return [-1 - $argument, $offset];
            case 2:
            case 3:
                return [$this->take($bytes, $offset, $argument), $offset + $argument];
            case 4:
                $list = [];
                for ($i = 0; $i < $argument; ++$i) {
                    [$list[], $offset] = $this->item($bytes, $offset, $depth + 1);
                }

                return [$list, $offset];
            case 5:
                $map = [];
                for ($i = 0; $i < $argument; ++$i) {
                    [$key, $offset] = $this->item($bytes, $offset, $depth + 1);
                    if (!\is_int($key) && !\is_string($key)) {
                        throw new CeremonyRefused('CBOR map key is neither an integer nor a string');
                    }
                    [$map[$key], $offset] = $this->item($bytes, $offset, $depth + 1);
                }

                return [$map, $offset];
            case 7:
                return [match ($argument) {
                    20 => false,
                    21 => true,
                    22 => null,
                    default => throw new CeremonyRefused('CBOR simple value not supported'),
                }, $offset];
            default:
                throw new CeremonyRefused('CBOR tag not supported');
        }
    }

    /** @return array{0: int, 1: int} */
    private function argument(string $bytes, int $offset, int $info): array
    {
        if ($info < 24) {
            return [$info, $offset];
        }

        $length = match ($info) {
            24 => 1,
            25 => 2,
            26 => 4,
            27 => 8,
            default => throw new CeremonyRefused('CBOR indefinite length not supported'),
        };
        $value = 0;
        foreach (Byte\chunk($this->take($bytes, $offset, $length)) as $byte) {
            if ($value > (\PHP_INT_MAX >> 8)) {
                throw new CeremonyRefused('CBOR integer too large');
            }

            $value = ($value << 8) | \ord($byte);
        }

        return [$value, $offset + $length];
    }

    private function take(string $bytes, int $offset, int $length): string
    {
        if ($length < 0 || $offset + $length > Byte\length($bytes)) {
            throw new CeremonyRefused('CBOR ends early');
        }

        return Byte\slice($bytes, $offset, $length);
    }
}
