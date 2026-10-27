<?php

declare(strict_types=1);

namespace App\Domain\Event\Cover;

use App\Domain\Event\Cover\Exception\CoverPhotoRefused;
use Imagick;
use ImagickException;
use Psl\Iter;
use Psl\Regex;

/** Turns an uploaded photo into the sizes a cover is shown at, re-encoded so nothing of the original's metadata survives (sc-3590). */
final readonly class CoverPhotoProcessor
{
    public const int MINIMUM_WIDTH = 1200;
    public const int MINIMUM_HEIGHT = 675;

    /** Each size's width; a photo narrower than one is kept at its own width. */
    public const array SIZES = ['small' => 640, 'medium' => 1280, 'large' => 1920];

    private const array FORMATS = ['JPEG', 'PNG', 'WEBP', 'HEIC', 'HEIF'];

    /** JPEG, PNG, RIFF WebP, and an ISO box whose brand is HEIC or HEIF. */
    private const string SIGNATURE = '/\A(?:\xFF\xD8\xFF|\x89PNG\r\n\x1A\n|RIFF.{4}WEBP|.{4}ftyp(?:hei[cmsx]|hev[cmsx]|mif1|msf1))/s';

    /** Read from the header before any pixel is decoded: above a phone's 200-megapixel mode, short of a decompression bomb. */
    private const int MAXIMUM_PIXELS = 210_000_000;

    /**
     * @return array<key-of<self::SIZES>, string> WebP bytes by size
     *
     * @throws CoverPhotoRefused
     */
    public function process(string $bytes): array
    {
        $image = $this->read($bytes);
        $sizes = [];
        foreach (self::SIZES as $size => $width) {
            $sizes[$size] = self::webp($image, $width);
        }

        $image->clear();

        return $sizes;
    }

    /**
     * The medium size, for a browser that cannot show the original (a HEIC outside Safari) before it is saved (sc-13861).
     *
     * @throws CoverPhotoRefused
     */
    public function preview(string $bytes): string
    {
        $image = $this->read($bytes);
        $webp = self::webp($image, self::SIZES['medium']);
        $image->clear();

        return $webp;
    }

    /** @throws CoverPhotoRefused */
    private function read(string $bytes): Imagick
    {
        if (!Regex\matches($bytes, self::SIGNATURE)) {
            throw CoverPhotoRefused::type();
        }

        $image = new Imagick();

        try {
            $image->pingImageBlob($bytes);
            if ($image->getImageWidth() * $image->getImageHeight() > self::MAXIMUM_PIXELS) {
                throw CoverPhotoRefused::type();
            }

            $image->clear();
            $image->readImageBlob($bytes);
        } catch (ImagickException) {
            throw CoverPhotoRefused::type();
        }

        if (!Iter\contains(self::FORMATS, $image->getImageFormat())) {
            throw CoverPhotoRefused::type();
        }

        if ('JPEG' === $image->getImageFormat() && !JpegStream::isWhole($bytes, $image)) {
            throw CoverPhotoRefused::type();
        }

        $image->setIteratorIndex(0);
        $image->autoOrient();

        if ($image->getImageWidth() < self::MINIMUM_WIDTH || $image->getImageHeight() < self::MINIMUM_HEIGHT) {
            throw CoverPhotoRefused::dimensions();
        }

        $image->stripImage();
        $image->setImageColorspace(Imagick::COLORSPACE_SRGB);

        return $image;
    }

    private static function webp(Imagick $image, int $width): string
    {
        $copy = clone $image;
        if ($copy->getImageWidth() > $width) {
            $copy->resizeImage($width, 0, Imagick::FILTER_LANCZOS, 1);
        }
        $copy->setImageFormat('WEBP');
        $copy->setImageCompressionQuality(82);
        $copy->stripImage();
        $webp = $copy->getImageBlob();
        $copy->clear();

        return $webp;
    }
}
