<?php

declare(strict_types=1);

namespace App\Domain\Event\Cover;

use Imagick;
use Psl\Iter;
use Psl\Str\Byte;

/** The decoder paints a JPEG's missing or garbled picture grey and Imagick drops its warning, so the stream is walked. */
final readonly class JpegStream
{
    private const int SOS = 0xDA;
    private const int EOI = 0xD9;
    private const int DRI = 0xDD;
    private const int RST0 = 0xD0;

    /** What may follow a scan's data: the end, another scan, or a table or note between scans. */
    private const array AFTER_SCAN = [0xD9, 0xDA, 0xC4, 0xDB, 0xDD, 0xCC, 0xDC, 0xFE, 0xE0, 0xE1, 0xE2, 0xE3, 0xE4, 0xE5, 0xE6, 0xE7, 0xE8, 0xE9, 0xEA, 0xEB, 0xEC, 0xED, 0xEE, 0xEF];

    public static function isWhole(string $bytes, Imagick $decoded): bool
    {
        return match (self::walk($bytes)) {
            'whole' => true,
            'garbled' => false,
            'unended' => !self::endsInFill($decoded),
        };
    }

    /** @return 'whole'|'garbled'|'unended' */
    private static function walk(string $bytes): string
    {
        $length = Byte\length($bytes);
        $at = 2;
        $restarts = false;
        $scanned = false;

        while (true) {
            // Bytes between segments are skipped, as the decoder does: some cameras leave padding there.
            while ($at < $length && "\xFF" !== $bytes[$at]) {
                ++$at;
            }
            while ($at < $length && "\xFF" === $bytes[$at]) {
                ++$at;
            }
            if ($at >= $length) {
                return 'unended';
            }

            $marker = Byte\ord($bytes[$at]);
            ++$at;
            if (self::EOI === $marker) {
                return $scanned ? 'whole' : 'garbled';
            }
            if (0x00 === $marker || 0x01 === $marker || ($marker >= self::RST0 && $marker <= self::RST0 + 7)) {
                continue;
            }
            if ($at + 2 > $length) {
                return 'unended';
            }

            $segment = (Byte\ord($bytes[$at]) << 8) | Byte\ord($bytes[$at + 1]);
            if ($segment < 2) {
                return 'garbled';
            }
            if ($at + $segment > $length) {
                return 'unended';
            }
            if (self::DRI === $marker && $segment >= 4) {
                $restarts = 0 !== ((Byte\ord($bytes[$at + 2]) << 8) | Byte\ord($bytes[$at + 3]));
            }
            $at += $segment;

            if (self::SOS === $marker) {
                $scanned = true;
                $after = self::scanEnd($bytes, $at, $restarts);
                if (null === $after) {
                    return 'garbled';
                }
                if ($after >= $length) {
                    return 'unended';
                }
                $at = $after;
            }
        }
    }

    /** Where the scan's data ends at the marker after it, the length if the file stops first, or null if the data is not scan data. */
    private static function scanEnd(string $bytes, int $at, bool $restarts): ?int
    {
        $length = Byte\length($bytes);
        $next = 0;

        while (true) {
            $flag = $at < $length ? Byte\search($bytes, "\xFF", $at) : null;
            if (null === $flag) {
                return $length;
            }

            $at = $flag + 1;
            while ($at < $length && "\xFF" === $bytes[$at]) {
                ++$at;
            }
            if ($at >= $length) {
                return $length;
            }

            $marker = Byte\ord($bytes[$at]);
            if (0x00 === $marker) {
                ++$at;
                continue;
            }
            if ($marker >= self::RST0 && $marker <= self::RST0 + 7) {
                if (!$restarts || self::RST0 + $next !== $marker) {
                    return null;
                }
                $next = ($next + 1) % 8;
                ++$at;
                continue;
            }

            return Iter\contains(self::AFTER_SCAN, $marker) ? $flag : null;
        }
    }

    /** A file that stops before its end marker may still hold the whole picture; if not, the last block is the decoder's mid-grey. */
    private static function endsInFill(Imagick $decoded): bool
    {
        $corner = $decoded->exportImagePixels($decoded->getImageWidth() - 1, $decoded->getImageHeight() - 1, 1, 1, 'RGB', Imagick::PIXEL_CHAR);

        return [128, 128, 128] === $corner;
    }
}
