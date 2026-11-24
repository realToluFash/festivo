<?php

declare(strict_types=1);

namespace App\WebAuthn;

use App\WebAuthn\Exception\CeremonyRefused;
use Psl\Encoding\Base64;
use Psl\Str;
use Psl\Str\Byte;

/** A credential's public key as COSE (RFC 9053) writes it, turned into the PEM openssl verifies with. */
final readonly class CoseKey
{
    /** ES256 then RS256, the two WebAuthn Level 3 asks every relying party to accept. */
    public const array ALGORITHMS = [self::ES256, self::RS256];

    private const int ES256 = -7;
    private const int RS256 = -257;
    private const string P256_PREFIX = "\x30\x59\x30\x13\x06\x07\x2a\x86\x48\xce\x3d\x02\x01\x06\x08\x2a\x86\x48\xce\x3d\x03\x01\x07\x03\x42\x00\x04";
    private const string RSA_ALGORITHM = "\x30\x0d\x06\x09\x2a\x86\x48\x86\xf7\x0d\x01\x01\x01\x05\x00";

    /** @param array<int|string, mixed> $cose */
    public function toPem(array $cose): string
    {
        $der = match ($cose[3] ?? null) {
            self::ES256 => $this->p256($cose),
            self::RS256 => $this->rsa($cose),
            default => throw new CeremonyRefused('COSE algorithm not supported'),
        };

        return "-----BEGIN PUBLIC KEY-----\n" . Str\join(Byte\chunk(Base64\encode($der), 64), "\n") . "\n-----END PUBLIC KEY-----\n";
    }

    /** @param array<int|string, mixed> $cose */
    private function p256(array $cose): string
    {
        $x = $cose[-2] ?? null;
        $y = $cose[-3] ?? null;

        if (2 !== ($cose[1] ?? null) || 1 !== ($cose[-1] ?? null) || !\is_string($x) || !\is_string($y) || 32 !== Byte\length($x) || 32 !== Byte\length($y)) {
            throw new CeremonyRefused('COSE key is not a P-256 point');
        }

        return self::P256_PREFIX . $x . $y;
    }

    /** @param array<int|string, mixed> $cose */
    private function rsa(array $cose): string
    {
        $n = $cose[-1] ?? null;
        $e = $cose[-2] ?? null;

        if (3 !== ($cose[1] ?? null) || !\is_string($n) || !\is_string($e) || Byte\length($n) < 256) {
            throw new CeremonyRefused('COSE key is not an RSA key of 2048 bits or more');
        }

        $key = $this->der(0x30, $this->integer($n) . $this->integer($e));

        return $this->der(0x30, self::RSA_ALGORITHM . $this->der(0x03, "\x00" . $key));
    }

    private function integer(string $unsigned): string
    {
        $trimmed = Byte\trim_left($unsigned, "\x00");

        return $this->der(0x02, (\ord($trimmed[0] ?? "\x00") & 0x80) !== 0 || '' === $trimmed ? "\x00" . $trimmed : $trimmed);
    }

    private function der(int $tag, string $content): string
    {
        $length = Byte\length($content);

        if ($length < 0x80) {
            return Byte\chr($tag) . Byte\chr($length) . $content;
        }

        $bytes = Byte\trim_left(\pack('N', $length), "\x00");

        return Byte\chr($tag) . Byte\chr(0x80 | Byte\length($bytes)) . $bytes . $content;
    }
}
