<?php

declare(strict_types=1);

namespace App\Storage;

use php_user_filter;
use Psl\Iter;

/** A read filter that passes a file through unchanged and tells its callback when reading starts and after each EVERY bytes more, however many times the file is read. */
final class ReadProgress extends php_user_filter
{
    public const int EVERY = 16 * 1024 * 1024;

    private const string NAME = 'soirely.read-progress';

    private int $read = 0;

    private int $toldAt = -1;

    /**
     * @param resource         $file
     * @param callable(): void $told
     */
    public static function watch($file, callable $told): void
    {
        if (!Iter\contains(\stream_get_filters(), self::NAME)) {
            \stream_filter_register(self::NAME, self::class);
        }

        \stream_filter_append($file, self::NAME, \STREAM_FILTER_READ, $told);
    }

    /**
     * @param resource $in
     * @param resource $out
     * @param int      $consumed
     */
    public function filter($in, $out, &$consumed, bool $closing): int
    {
        while (null !== ($bucket = \stream_bucket_make_writeable($in))) {
            $consumed += $bucket->datalen;
            $this->read += $bucket->datalen;
            \stream_bucket_append($out, $bucket);
        }

        if ($this->toldAt < 0 || $this->read - $this->toldAt >= self::EVERY) {
            $this->toldAt = $this->read;
            $told = $this->params;

            if (\is_callable($told)) {
                $told();
            }
        }

        return \PSFS_PASS_ON;
    }
}
