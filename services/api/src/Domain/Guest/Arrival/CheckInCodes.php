<?php

declare(strict_types=1);

namespace App\Domain\Guest\Arrival;

use App\Entity\Guest;
use App\Enum\GuestReply;
use BaconQrCode\Renderer\Image\SvgImageBackEnd;
use BaconQrCode\Renderer\ImageRenderer;
use BaconQrCode\Renderer\RendererStyle\RendererStyle;
use BaconQrCode\Writer;
use Psl\Hash;

/** The code a guest shows at the door (sc-1301). The QR holds the code alone, so a camera outside Soirely reads 43 characters and nothing else; the door's list holds its digest, so a lost door phone holds no code. */
final readonly class CheckInCodes
{
    private const int QR_SIZE = 300;

    /** @return ?array{code: string, qrSvg: string} only for a guest whose reply is Coming */
    public function of(Guest $guest): ?array
    {
        $code = $guest->getCheckInCode();

        if (null === $code || GuestReply::Coming !== $guest->getReply() || $guest->isRemoved()) {
            return null;
        }

        return [
            'code' => $code,
            'qrSvg' => new Writer(new ImageRenderer(new RendererStyle(self::QR_SIZE, 4), new SvgImageBackEnd()))->writeString($code),
        ];
    }

    public static function digestOf(?string $code): ?string
    {
        return null === $code ? null : Hash\hash($code, Hash\Algorithm::Sha256);
    }
}
