<?php

declare(strict_types=1);

namespace App\Domain\Event\Cover;

use App\Domain\Event\Cover\Exception\CoverPhotoRefused;
use Imagick;
use ImagickException;
use Psl\Iter;

/** Turns an uploaded photo into the sizes a cover is shown at, re-encoded so nothing of the original's metadata survives (sc-3590). */
final readonly class CoverPhotoProcessor
{
    public const int MINIMUM_WIDTH = 1200;
    public const int MINIMUM_HEIGHT = 675;

    /** Each size's width; a photo narrower than one is kept at its own width. */
    public const array SIZES = ['small' => 640, 'medium' => 1280, 'large' => 1920];

    private const array FORMATS = ['JPEG', 'PNG', 'WEBP', 'HEIC', 'HEIF'];

    /**
     * @return array<key-of<self::SIZES>, string> WebP bytes by size
     *
     * @throws CoverPhotoRefused
     */
    public function process(string $bytes): array
    {
        $image = new Imagick();

        try {
            $image->readImageBlob($bytes);
        } catch (ImagickException) {
            throw CoverPhotoRefused::type();
        }

        if (!Iter\contains(self::FORMATS, $image->getImageFormat())) {
            throw CoverPhotoRefused::type();
        }

        $image->setIteratorIndex(0);
        $image->autoOrient();

        if ($image->getImageWidth() < self::MINIMUM_WIDTH || $image->getImageHeight() < self::MINIMUM_HEIGHT) {
            throw CoverPhotoRefused::dimensions();
        }

        $image->stripImage();
        $image->setImageColorspace(Imagick::COLORSPACE_SRGB);

        $sizes = [];
        foreach (self::SIZES as $size => $width) {
            $copy = clone $image;
            if ($copy->getImageWidth() > $width) {
                $copy->resizeImage($width, 0, Imagick::FILTER_LANCZOS, 1);
            }
            $copy->setImageFormat('WEBP');
            $copy->setImageCompressionQuality(82);
            $copy->stripImage();
            $sizes[$size] = $copy->getImageBlob();
            $copy->clear();
        }

        $image->clear();

        return $sizes;
    }
}
