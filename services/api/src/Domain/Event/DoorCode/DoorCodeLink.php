<?php

declare(strict_types=1);

namespace App\Domain\Event\DoorCode;

use App\Entity\DoorCode;
use BaconQrCode\Renderer\Image\SvgImageBackEnd;
use BaconQrCode\Renderer\ImageRenderer;
use BaconQrCode\Renderer\RendererStyle\RendererStyle;
use BaconQrCode\Writer;
use Psl\Str;

/** The app claims /d/ where installed, as it does the staff link's /w/; the browser answers it otherwise. */
final readonly class DoorCodeLink
{
    public const string PATH = '/d/';

    private const int QR_SIZE = 300;

    public function __construct(
        private string $webOrigin,
    ) {
    }

    public function of(DoorCode $code): string
    {
        return Str\trim_right($this->webOrigin, '/') . self::PATH . $code->getCode();
    }

    /** Black on white with a quiet zone, so a phone held up in bad light still scans. */
    public function qrSvgOf(DoorCode $code): string
    {
        return new Writer(new ImageRenderer(new RendererStyle(self::QR_SIZE, 4), new SvgImageBackEnd()))->writeString($this->of($code));
    }
}
