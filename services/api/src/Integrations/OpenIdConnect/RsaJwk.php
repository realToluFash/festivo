<?php

declare(strict_types=1);

namespace App\Integrations\OpenIdConnect;

use Psl\Str\Byte;

/** A provider publishes RSA keys as a modulus and an exponent; OpenSSL reads them as PEM. */
final class RsaJwk
{
    private const string RSA_ENCRYPTION_OID = "\x06\x09\x2a\x86\x48\x86\xf7\x0d\x01\x01\x01";

    public static function toPem(string $modulus, string $exponent): string
    {
        $key = self::sequence(self::integer(self::base64Url($modulus)) . self::integer(self::base64Url($exponent)));
        $algorithm = self::sequence(self::RSA_ENCRYPTION_OID . "\x05\x00");
        $info = self::sequence($algorithm . "\x03" . self::length(Byte\length($key) + 1) . "\x00" . $key);

        return "-----BEGIN PUBLIC KEY-----\n" . \chunk_split(\base64_encode($info), 64, "\n") . "-----END PUBLIC KEY-----\n";
    }

    private static function base64Url(string $encoded): string
    {
        return (string) \base64_decode(\strtr($encoded, '-_', '+/'), true);
    }

    private static function integer(string $bytes): string
    {
        // DER integers are signed, so a leading byte with its top bit set needs a zero in front.
        if ('' !== $bytes && Byte\ord($bytes[0]) > 0x7F) {
            $bytes = "\x00" . $bytes;
        }

        return "\x02" . self::length(Byte\length($bytes)) . $bytes;
    }

    private static function sequence(string $contents): string
    {
        return "\x30" . self::length(Byte\length($contents)) . $contents;
    }

    private static function length(int $length): string
    {
        if ($length < 0x80) {
            return Byte\chr($length);
        }

        $bytes = Byte\trim_left(\pack('N', $length), "\x00");

        return Byte\chr(0x80 | Byte\length($bytes)) . $bytes;
    }
}
